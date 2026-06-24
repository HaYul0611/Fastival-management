'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const { Session, Toast, renderHeader } = window.FS;
  renderHeader();

  if (!Session.isLoggedIn()) {
    Toast.error('로그인이 필요합니다.');
    location.href = 'login.html';
    return;
  }

  const email = localStorage.getItem('email');
  if (!email || !window.ShopDB) return;

  let profile = await window.ShopDB.getProfile(email);
  if (!profile) {
    profile = { id: 'mock', user_name: '관리자', tier: 'BRONZE' };
  }

  const listEl = document.getElementById('ordersList');

  // 모달 닫기 이벤트
  const qrModal = document.getElementById('qrModal');
  const qrClose = document.getElementById('qrClose');
  qrClose.addEventListener('click', () => qrModal.classList.remove('show'));
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.classList.remove('show');
  });

  const odModal = document.getElementById('orderDetailModal');
  const odClose = document.getElementById('odClose');
  odClose.addEventListener('click', () => odModal.classList.remove('show'));
  odModal.addEventListener('click', (e) => {
    if (e.target === odModal) odModal.classList.remove('show');
  });

  // 주문 전역 변수
  window.currentOrders = [];

  // TOTP 로직
  let totpTimer = null;
  /* ================================================================
     TOTP 로직 (보안 QR 코드 생성)
     ================================================================ */

  /**
   * @description HMAC-SHA1 알고리즘을 사용하여 동적 TOTP 코드를 생성합니다.
   * @param {string} hexSecret - 16진수 시크릿 키
   * @returns {Promise<string>} 생성된 6자리 TOTP 코드
   */
  async function generateTotpCode(hexSecret, timeOffset = 0) {
    if (!hexSecret) hexSecret = 'dummysecret12345';
    let keyBytes;
    try {
      keyBytes = new Uint8Array(hexSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    } catch (e) {
      keyBytes = new TextEncoder().encode(hexSecret);
    }
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const counterBytes = new Uint8Array(8);
    let temp = Math.floor(Date.now() / 180000) + timeOffset;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = temp & 0xFF;
      temp = Math.floor(temp / 256);
    }
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
    const hash = new Uint8Array(signature);
    const offset = hash[hash.length - 1] & 0x0F;
    const binary = ((hash[offset] & 0x7F) << 24) |
      ((hash[offset + 1] & 0xFF) << 16) |
      ((hash[offset + 2] & 0xFF) << 8) |
      (hash[offset + 3] & 0xFF);
    return (binary % 1000000).toString().padStart(6, '0');
  }

  /* ================================================================
     모달 핸들러 (Modal Handlers)
     ================================================================ */

  /**
   * @description 특정 주문의 QR 코드 수령 모달을 띄우고 실시간 TOTP QR 코드를 렌더링합니다.
   * @param {string} orderNo - 주문 번호
   */
  window.openQrModal = function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    let secret = order?.totp_secret || 'dummysecret12345';

    let _qrEpochOffset = 0;
    let _qrStartTime = 0;

    const updateQr = async () => {
      const totpCode = await generateTotpCode(secret, _qrEpochOffset);

      let prefix = orderNo.startsWith('F') ? 'F' : (orderNo.startsWith('G') ? 'G' : 'O');
      let numericId = parseInt(orderNo.replace(/[^0-9]/g, ''), 10);
      if (isNaN(numericId)) numericId = 1;

      const dynamicBarcode = window.FS.BarcodeUtils.encodeDynamicBarcode(prefix, numericId, totpCode);

      const totpCodeEl = document.getElementById('totpCode');
      totpCodeEl.style.letterSpacing = '2px';
      totpCodeEl.style.fontFamily = "'Roboto Mono', 'Courier New', monospace";
      totpCodeEl.style.fontSize = '22px';
      totpCodeEl.innerHTML = `${dynamicBarcode}`;

      const displayOrderNo = window.FS.BarcodeUtils.encodeFixedOrder(prefix, numericId);
      document.getElementById('qrOrderNo').textContent = '주문번호: ' + displayOrderNo;

      const waitingTextEl = document.getElementById('waitingNumberText');
      if (waitingTextEl) {
        const waitingNum = order.waiting_number || order.waitingNumber || String(numericId).slice(-3).padStart(3, '0');
        waitingTextEl.innerHTML = `${waitingNum}<span style="font-size: 18px; font-weight: 700; margin-left: 2px;">번</span>`;
      }

      const qrData = dynamicBarcode;
      let qrImage = document.getElementById('qrImage');
      const container = qrImage.parentElement;

      container.style.position = 'relative';

      let bgElem = document.getElementById('heartQrBg_' + orderNo);
      if (!bgElem) {
        bgElem = document.createElement('div');
        bgElem.id = 'heartQrBg_' + orderNo;
        bgElem.style.position = 'absolute';
        bgElem.style.width = '300%';
        bgElem.style.height = '300%';
        bgElem.style.top = '-100%';
        bgElem.style.left = '-100%';
        bgElem.style.transform = 'translateY(11px) rotate(45deg) scale(0.5)';
        bgElem.style.zIndex = '0';
        bgElem.style.imageRendering = 'pixelated';
        bgElem.style.backgroundRepeat = 'repeat';
        bgElem.style.backgroundSize = '40px 40px';
        container.insertBefore(bgElem, qrImage);
      }

      let svg = "<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='#fff'/>";
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          if (Math.random() > 0.5) {
            svg += `<rect x='${x * 8}' y='${y * 8}' width='8' height='8' fill='#000'/>`;
          }
        }
      }
      svg += "</svg>";
      bgElem.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

      qrImage.style.display = 'none';
      let qrWrap = document.getElementById('realQrWrap_' + orderNo);
      if (!qrWrap) {
        qrWrap = document.createElement('div');
        qrWrap.id = 'realQrWrap_' + orderNo;
        qrWrap.style.width = '100%';
        qrWrap.style.height = '100%';
        qrWrap.style.position = 'absolute';
        qrWrap.style.top = '0';
        qrWrap.style.left = '0';
        qrWrap.style.zIndex = '1';
        container.appendChild(qrWrap);
      }
      qrWrap.innerHTML = '';

      qrWrap.style.opacity = '0';
      bgElem.style.opacity = '0';
      qrWrap.style.transition = 'opacity 0.3s ease';
      bgElem.style.transition = 'opacity 0.3s ease';

      new QRCode(qrWrap, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });

      setTimeout(() => {
        const qrEls = qrWrap.querySelectorAll('canvas, img');
        qrEls.forEach(el => {
          el.style.width = '100%';
          el.style.height = '100%';
          el.style.objectFit = 'cover';
          el.style.imageRendering = 'pixelated';
          el.removeAttribute('title');
          el.style.transform = 'translateY(11px) rotate(45deg) scale(0.5)';
        });
        qrWrap.removeAttribute('title');
        container.removeAttribute('title');

        qrWrap.style.opacity = '1';
        bgElem.style.opacity = '1';
      }, 50);

      // 남은 시간 초기화
      _qrStartTime = Date.now();

      const bar = document.getElementById('totpTimerBar');
      const txt = document.getElementById('totpTimeTxt');
      if (totpTimer) clearInterval(totpTimer);

      const updateUI = () => {
        let elapsed = Math.floor((Date.now() - _qrStartTime) / 1000);
        let timeLeft = 180 - elapsed;

        if (timeLeft <= 0) {
          clearInterval(totpTimer);
          updateQr();
          return;
        }

        bar.style.width = (timeLeft / 180 * 100) + '%';
        const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        txt.textContent = m + ':' + s;
        if (timeLeft < 30) {
          bar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
          txt.style.color = '#ef4444';
          txt.classList.add('text-shake');
        } else {
          bar.style.background = 'linear-gradient(90deg, #00f2fe, #4facfe)';
          txt.style.color = '#0ea5e9';
          txt.classList.remove('text-shake');
        }
      };
      updateUI(); // 초기 렌더

      totpTimer = setInterval(updateUI, 1000);
    };

    const btnReset = document.getElementById('btnResetTotp');
    if (btnReset) {
      btnReset.onclick = () => {
        _qrEpochOffset += 1;
        btnReset.style.transition = 'transform 0.3s';
        btnReset.style.transform = `rotate(180deg)`;
        updateQr();
        if (window.FS && window.FS.Toast) {
          window.FS.Toast.info('현재 유효한 보안코드 및 남은 시간과 동기화되었습니다.');
        }
        setTimeout(() => btnReset.style.transform = `rotate(0deg)`, 300);
      };
    }

    updateQr();
    const qrModal = document.getElementById('qrModal');
    qrModal.style.zIndex = '2147483647';
    qrModal.classList.add('show');
  };

  // 상세 모달 열기
  /**
   * @description 특정 주문의 상세 내역 모달을 열어 구매 상품 및 영수증 정보를 표시합니다.
   * @param {string} orderNo - 주문 번호
   */
  window.openDetailModal = async function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    if (!order) return;



    const itemsHtml = (order.shop_order_items || []).map(item => {
      const isFood = item.shop_products && item.shop_products.type === 'FOOD';
      const hasImage = !!(item.shop_products && item.shop_products.thumbnail_image_url);
      const imageUrl = hasImage ? item.shop_products.thumbnail_image_url : '';

      const svgFood = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>`;
      const svgGoods = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;

      return `
      <div style="display:flex; gap:12px; padding: 12px 0; border-bottom:1px solid var(--g100);">
        ${hasImage
          ? `<div style="width:60px; height:60px; border-radius:8px; background: url('${imageUrl}') center/cover no-repeat; flex-shrink:0;"></div>`
          : `<div style="width:60px; height:60px; border-radius:8px; background:var(--g100); display:flex; align-items:center; justify-content:center; flex-shrink:0;">${isFood ? svgFood : svgGoods}</div>`
        }
        <div style="flex:1; display:flex; justify-content:space-between;">
          <div>
            <div style="font-weight:700; color:var(--g900); font-size:15px; margin-bottom:4px;">${item.product_name || '상품명'}</div>
            ${(item.options || item.selectedOptions) ? `<div style="font-size:13px; color:var(--g600); margin-bottom:2px;">옵션: ${item.options || item.selectedOptions}</div>` : ''}
            <div style="font-size:13px; color:var(--g500);">수량: ${item.quantity || 1}개</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;">${((item.price_at_purchase || 0) * (item.quantity || 1)).toLocaleString()}원</div>
            ${order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED' ? `<button onclick="openReviewModal('${item.product_id}')" style="margin-top:8px; padding:4px 8px; font-size:12px; font-weight:700; border:1px solid var(--black); background:var(--white); color:var(--black); border-radius:4px; cursor:pointer;">리뷰 작성</button>` : ''}
          </div>
        </div>
      </div>
      `;
    }).join('');

    const html = `
      <div style="margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">주문번호</span>
          <span class="barcode-text" style="font-weight:700;">${window.FS.BarcodeUtils.encodeFixedOrder(orderNo.charAt(0), parseInt(orderNo.replace(/[^0-9]/g, '') || 1, 10))}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">결제일시</span>
          <span style="font-weight:700;">${new Date(order.created_at).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">수령방법</span>
          <span style="font-weight:700;">${order.delivery_type === 'PICKUP' ? '현장수령' : '일반배송'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">결제수단</span>
          <span style="font-weight:700;">${order.payment_method === 'FESTIO_PAY' ? 'FESTIO Pay' : '카드결제'}</span>
        </div>
      </div>
      <h4 style="font-size:16px; font-weight:800; margin-bottom:12px;">주문 상품</h4>
      <div style="margin-bottom:24px; border-top:2px solid var(--g900);">
        ${itemsHtml}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--g50); padding:16px; border-radius:8px; margin-bottom: 20px;">
        <span style="font-size:16px; font-weight:700;">총 결제금액</span>
        <span style="font-size:20px; font-weight:900; color:var(--blue);">${(order.total_amount || 0).toLocaleString()}원</span>
      </div>
      ${['PAID', 'PENDING'].includes(order.status) || !order.status || order.status === 'READY_FOR_PICKUP' ? `
        <div style="display:flex; justify-content:center;">
          <button class="btn-cancel-order" onclick="cancelOrder('${order.order_number}')" style="width:100%; padding:14px; background:var(--white); border:1px solid var(--g300); border-radius:8px; font-weight:700; color:var(--g700); cursor:pointer;">주문 취소</button>
        </div>
      ` : ''}
    `;

    document.getElementById('odContent').innerHTML = html;
    odModal.style.zIndex = '2147483647'; // 챗봇/NPC 등 외부 플러그인 위로 노출되도록 최댓값 설정
    odModal.classList.add('show');
  };

  // 주문 내역 가져오기
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
      const res = await fetch('/api/order/shop/my', { headers });

      let orders = [];
      if (res.ok) {
        let rawOrders = await res.json();
        // 실제 상품 내역이 있는 유효한 주문만 필터링 (빈 테스트 주문 방지)
        orders = rawOrders.filter(o => o.shop_order_items && o.shop_order_items.length > 0);
      }

      if (!orders || orders.length === 0) {
        // 미리보기용 더미 데이터
        const dummyOrder = {
          order_number: 'F1X9K2M4P5T8',
          created_at: new Date().toISOString(),
          delivery_type: 'PICKUP',
          status: 'READY_FOR_PICKUP',
          payment_method: 'FESTIO_PAY',
          total_amount: 12500,
          totp_secret: 'dummysecret12345',
          shop_order_items: [
            { product_name: '스모크 바베큐 버거 + 콜라 세트', quantity: 1, price_at_purchase: 12500, shop_products: { type: 'FOOD' } }
          ]
        };
        window.currentOrders = [dummyOrder];
        listEl.innerHTML = renderOrderCard(dummyOrder);
        return;
      }

      window.currentOrders = orders;
      listEl.innerHTML = orders.map(renderOrderCard).join('');
    } catch (e) {
      console.error(e);
      listEl.innerHTML = '<p>주문 내역을 불러오지 못했습니다.</p>';
    }
  };

  // 즉시 실행 (스켈레톤 지연 제거)
  fetchOrders();
});

/* ================================================================
   FESTIO SHOP — orders.js
   주문 내역 조회 · QR 생성(TOTP) · 주문 상세 · 리뷰 작성
   ================================================================ */

/* ── 상태 및 전역 변수 ────────────────────────────────────────────── */

/**
 * @description 주문 객체 데이터를 기반으로 화면에 표시할 주문 카드 HTML 문자열을 생성합니다.
 * @param {Object} order - 주문 데이터 객체
 * @returns {string} 주문 카드 HTML
 */
function renderOrderCard(order) {
  const isPickup = order.delivery_type === 'PICKUP';
  let steps = '';

  let isFood = true;
  if (order.shop_order_items && order.shop_order_items.length > 0) {
    const sp = order.shop_order_items[0].shop_products;
    const pName = order.shop_order_items[0].product_name || '';
    if (sp && sp.type === 'GOODS') {
      isFood = false;
    } else if (order.order_number && order.order_number.startsWith('G')) {
      isFood = false;
    } else if (pName.includes('굿즈') || pName.includes('티셔츠') || pName.includes('후드') || pName.includes('OFFICIAL') || pName.includes('슬로건') || pName.includes('응원봉')) {
      isFood = false;
    }
  }

  if (isPickup) {
    const isDone1 = true;
    const isDone2 = order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED';
    const isDone3 = order.status === 'COMPLETED';

    let movingEmoji = isFood ? '👨‍🍳' : '📦';
    let flipClass = '';
    if (isDone3) { movingEmoji = '🛍️'; }
    else if (isDone2) { movingEmoji = '🏃'; flipClass = 'flip'; }
    else if (isDone1) { movingEmoji = isFood ? '🍳' : '🎁'; }

    const prepLabel = isFood ? '조리 준비' : '상품 준비';

    steps = `
      <div class="st-line-bg"></div>
      <div class="st-progress-bar"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66.666 : 33.333)}%;"><span class="st-truck ${flipClass}">${movingEmoji}</span></div></div>
      <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
      <div class="st-step ${isDone2 ? 'done' : 'active'}"><div class="st-dot"></div><div class="st-label">${prepLabel}</div></div>
      <div class="st-step ${isDone3 ? 'done' : (isDone2 ? 'active' : '')}"><div class="st-dot"></div><div class="st-label">수령전</div></div>
      <div class="st-step ${isDone3 ? 'active' : ''}"><div class="st-dot"></div><div class="st-label">수령완료</div></div>
    `;
  } else {
    const isDone1 = true;
    const isDone2 = order.status === 'SHIPPING' || order.status === 'DELIVERED';
    const isDone3 = order.status === 'DELIVERED';

    let movingEmoji = '📦';
    let flipClass = '';
    if (isDone3) { movingEmoji = '📫'; }
    else if (isDone2) { movingEmoji = '🚚'; }

    steps = `
      <div class="st-line-bg"></div>
      <div class="st-progress-bar"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66.666 : 33.333)}%;"><span class="st-truck ${flipClass}">${movingEmoji}</span></div></div>
      <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
      <div class="st-step ${isDone2 ? 'done' : 'active'}"><div class="st-dot"></div><div class="st-label">배송준비</div></div>
      <div class="st-step ${isDone3 ? 'done' : (isDone2 ? 'active' : '')}"><div class="st-dot"></div><div class="st-label">배송중</div></div>
      <div class="st-step ${isDone3 ? 'active' : ''}"><div class="st-dot"></div><div class="st-label">배송완료</div></div>
    `;
  }

  const itemsHtml = (order.shop_order_items || []).map(item => {
    const isFood = item.shop_products && item.shop_products.type === 'FOOD';
    const hasImage = !!(item.shop_products && item.shop_products.thumbnail_image_url);
    const imageUrl = hasImage ? item.shop_products.thumbnail_image_url : '';

    const svgFood = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path></svg>`;
    const svgGoods = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;

    return `
    <div class="order-item">
      ${hasImage
        ? `<div class="oi-img" style="background: url('${imageUrl}') center/cover no-repeat;"></div>`
        : `<div class="oi-img" style="background:var(--g100); display:flex; align-items:center; justify-content:center;">${isFood ? svgFood : svgGoods}</div>`
      }
      <div class="oi-info">
        <span class="oi-status ${isPickup ? 'pickup' : 'shipping'}">${isPickup ? (isFood ? '푸드트럭 현장수령' : '현장 픽업') : '일반 배송'}</span>
        <div class="oi-name">${item.product_name || '상품'}</div>
        ${(item.options || item.selectedOptions) ? `<div class="oi-opt" style="margin-bottom:4px; color:var(--g600);">옵션: ${item.options || item.selectedOptions}</div>` : ''}
        <div class="oi-opt">수량: ${item.quantity || 1}개</div>
        <div class="oi-price">${(item.price_at_purchase || 0).toLocaleString()}원</div>
      </div>
    </div>
    `;
  }).join('');

  return `
    <div class="order-card">
      <div class="order-header" style="align-items: flex-start;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; color: var(--g500);">주문번호</span>
            <span class="order-no barcode-text" style="font-weight: 700; margin-left: 0;">${window.FS.BarcodeUtils.encodeFixedOrder(order.order_number.charAt(0), parseInt(order.order_number.replace(/[^0-9]/g, '') || 1, 10))}</span>
          </div>
        </div>
        <a href="javascript:void(0)" onclick="openDetailModal('${order.order_number}')" class="order-detail-btn" style="white-space: nowrap; flex-shrink: 0; padding-top: 2px;">주문상세 보기 &gt;</a>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="status-tracker">${steps}</div>
      <div class="order-actions" style="display:flex; justify-content:${isPickup ? 'space-between' : 'flex-start'}; align-items:center; margin-top:16px;">
        <button class="btn-review" onclick="openReviewModal('${order.order_number}')" style="background:var(--white); border:1px solid var(--g300); padding:10px 16px; border-radius:8px; font-weight:700; color:var(--g800); cursor:pointer;">리뷰 작성</button>
        ${isPickup ? `
        <button class="btn-qr" onclick="openQrModal('${order.order_number}')" style="background:var(--black); color:var(--white); border:none; padding:10px 16px; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /><rect x="14" y="18" width="3" height="3" /><rect x="18" y="14" width="3" height="3" />
          </svg> QR 확인
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// 주문 취소
/* ================================================================
   주문 취소 및 리뷰 작성 (Actions)
   ================================================================ */

/**
 * @description 결제 완료된 주문을 취소 처리합니다.
 * @param {string} orderNo - 취소할 주문 번호
 */
window.cancelOrder = function (orderNo) {
  if (confirm(orderNo + ' 주문을 취소하시겠습니까?')) {
    alert('주문이 취소되었습니다.');
    location.reload();
  }
};

// 리뷰 모달 전역 로직
let reviewImages = [];
let currentRating = 0;

/**
 * @description 수령 완료된 상품에 대해 리뷰를 작성하는 모달을 엽니다.
 * @param {string} productId - 리뷰를 작성할 상품 ID
 */
window.openReviewModal = function (productId) {
  if (!productId || productId === 'undefined') {
    alert('상품 정보가 부족하여 리뷰를 작성할 수 없습니다.');
    return;
  }
  window.currentReviewProductId = productId;
  reviewImages = [];
  currentRating = 0;
  updateReviewStars();
  updateReviewScore();
  renderReviewThumbs();
  document.getElementById('rvText').value = '';
  const reviewModal = document.getElementById('reviewModal');
  reviewModal.style.zIndex = '2147483648';
  reviewModal.classList.add('show');
};

window.closeReviewModal = function () {
  document.getElementById('reviewModal').classList.remove('show');
};

window.triggerReviewImageUpload = function () {
  document.getElementById('rvImageInput').click();
};

window.handleReviewImageSelect = function (e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      const img = new Image();
      img.onload = function () {
        let isBright = false;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // 우상단 영역(버튼이 위치할 곳)의 밝기 체크
          const w = Math.min(50, img.width / 2);
          const h = Math.min(50, img.height / 2);
          const imageData = ctx.getImageData(img.width - w, 0, w, h);
          const data = imageData.data;
          let sum = 0;
          let count = 0;
          for (let i = 0; i < data.length; i += 4) {
            // 투명도가 있는 경우 무시하거나 배경을 흰색으로 가정
            const alpha = data[i + 3] / 255;
            const r = data[i] * alpha + 255 * (1 - alpha);
            const g = data[i + 1] * alpha + 255 * (1 - alpha);
            const b = data[i + 2] * alpha + 255 * (1 - alpha);
            sum += (r * 299 + g * 587 + b * 114) / 1000;
            count++;
          }
          if (count > 0 && (sum / count) > 180) {
            isBright = true;
          }
        } catch (err) {
          // CORS 등 canvas 접근 오류 시 기본값 사용
        }
        reviewImages.push({ src, isBright });
        renderReviewThumbs();
      };
      img.src = src;
    };
    reader.readAsDataURL(f);
  });
  e.target.value = '';
};

window.removeReviewImage = function (index) {
  reviewImages.splice(index, 1);
  renderReviewThumbs();
};

window.scrollReviewThumbs = function (dir) {
  const container = document.getElementById('rvThumbContainer');
  if (dir === -1) {
    container.scrollBy({ left: -100, behavior: 'smooth' });
  } else {
    container.scrollBy({ left: 100, behavior: 'smooth' });
  }
};

function renderReviewThumbs() {
  const container = document.getElementById('rvThumbContainer');
  const wrapper = document.getElementById('rvThumbWrapper');

  if (reviewImages.length === 0) {
    if (wrapper) wrapper.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  if (wrapper) wrapper.style.display = 'flex';
  container.innerHTML = reviewImages.map((item, i) => {
    const src = typeof item === 'string' ? item : item.src;
    const isBright = typeof item === 'string' ? false : item.isBright;
    // 밝은 이미지일 경우 검은색(#000), 어두울 경우 흰색(#fff)으로 확실히 대비되도록 설정
    const btnColor = isBright ? '#000' : '#fff';
    // 색상만으로는 부족할 수 있으므로, 반대되는 색상의 그림자를 추가해 시인성을 극대화
    const dropShadow = isBright ? 'drop-shadow(0 0 2px rgba(255,255,255,0.9))' : 'drop-shadow(0 0 2px rgba(0,0,0,0.8))';

    return `
    <div class="rv-thumb-item" style="position:relative; width:60px; height:60px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--g100);">
      <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
      <button onclick="removeReviewImage(${i})" class="rv-thumb-del" style="position:absolute; top:4px; right:4px; background:transparent; border:none; color:${btnColor}; cursor:pointer; width:20px; height:20px; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; filter:${dropShadow};">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    `;
  }).join('');
}

window.setRating = function (val) {
  if (currentRating === val) {
    currentRating = 0; // 토글 (동일한 점수 클릭 시 초기화)
  } else {
    currentRating = val;
  }
  updateReviewStars();
  updateReviewScore();
};

function updateReviewStars() {
  for (let i = 1; i <= 5; i++) {
    const star = document.getElementById('rvStar' + i);
    if (currentRating >= i) {
      star.className = 'rv-star full';
    } else if (currentRating >= i - 0.5) {
      star.className = 'rv-star half';
    } else {
      star.className = 'rv-star rv-empty';
    }
  }
}

function updateReviewScore() {
  document.getElementById('rvScoreTxt').textContent = '(' + (currentRating.toFixed(1)) + ')';
}

window.submitReview = function () {
  if (currentRating === 0) {
    alert('별점을 입력해주세요.');
    return;
  }
  const text = document.getElementById('rvText').value.trim();
  if (!text) {
    alert('리뷰 내용을 입력해주세요.');
    return;
  }

  const reviews = JSON.parse(localStorage.getItem('shopReviews') || '[]');

  // 현재 로그인 사용자 정보 조회
  const email = localStorage.getItem('email');
  const sessionUser = window.FS && window.FS.Session ? window.FS.Session.get() : null;
  const authorName = (sessionUser && sessionUser.name) ? sessionUser.name : (email ? email.split('@')[0] : '익명');

  const newReview = {
    id: 'rv_' + Date.now(),
    productId: window.currentReviewProductId,
    rating: currentRating,
    text: text,
    images: [...reviewImages],
    author: authorName,
    date: new Date().toLocaleDateString('ko-KR')
  };

  reviews.unshift(newReview);
  localStorage.setItem('shopReviews', JSON.stringify(reviews));

  alert('리뷰가 등록되었습니다!');
  closeReviewModal();
};
