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
  async function generateMockTotp(secret, timeWindow) {
    // 프론트엔드 모의 시연용 (실제는 백엔드와 HMAC-SHA1 일치 필요)
    let hash = 0;
    const str = secret + timeWindow;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(Math.abs(hash) % 1000000).padStart(6, '0');
  }

  let manualOffset = 0;
  window.openQrModal = function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    let secret = order?.totp_secret || 'dummysecret12345';
    manualOffset = 0; // 모달 열때 초기화

    const updateQr = async (isManual = false) => {
      if (isManual) manualOffset++;
      const timeWindow = Math.floor(Date.now() / 180000) + manualOffset; // 3분 단위 + 수동오프셋
      const totpCode = await generateMockTotp(secret, timeWindow);

      let displayOrderNo = orderNo;
      const match = orderNo.match(/0+(\d+)$/);
      if (match) displayOrderNo = match[1];

      let prefix = orderNo.startsWith('F') ? 'F' : (orderNo.startsWith('G') ? 'G' : 'O');
      let numericId = parseInt(displayOrderNo, 10);
      let orderIdBase36 = (isNaN(numericId) ? 0 : numericId).toString(36).toUpperCase();
      while (orderIdBase36.length < 5) orderIdBase36 = '0' + orderIdBase36;

      const barcodeData = prefix + orderIdBase36 + totpCode;
      document.getElementById('totpCode').textContent = barcodeData;
      document.getElementById('qrOrderNo').textContent = '주문번호: ' + (prefix + orderIdBase36 + "000000");

      const qrData = 'TOTP:' + orderNo + ':' + totpCode;
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
        bgElem.style.top = '-100%'; // -200px (multiple of 40px)
        bgElem.style.left = '-100%';
        // QR 이미지와 완벽하게 동일한 각도 및 스케일 적용 (격자선 일치)
        bgElem.style.transform = 'translateY(11px) rotate(45deg) scale(0.5)';
        bgElem.style.zIndex = '0';
        bgElem.style.imageRendering = 'pixelated';
        bgElem.style.backgroundRepeat = 'repeat';
        // 40px 타일 (8px 모듈 5개) -> 200px에 정확히 맞아떨어짐
        bgElem.style.backgroundSize = '40px 40px';
        container.insertBefore(bgElem, qrImage);
      }

      // QR 마커(Finder Pattern)가 중복해서 나타나는 것을 방지하기 위해,
      // 순수하게 8px 네모들로만 이루어진 가짜 패턴을 생성하여 배경에 타일링함.
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

      // 시간차 없이 동시에 나타나도록 처리
      qrImage.style.transition = 'opacity 0.3s ease';
      bgElem.style.transition = 'opacity 0.3s ease';
      qrImage.style.opacity = '0';
      bgElem.style.opacity = '0';

      qrImage.onload = () => {
        qrImage.style.opacity = '1';
        bgElem.style.opacity = '1';
      };

      qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrData) + '&margin=0&format=svg';

      // 남은 시간 초기화 (수동 리셋 시 180초 풀로 시작)
      let timeLeft = isManual ? 180 : 180 - Math.floor((Date.now() % 180000) / 1000);

      const bar = document.getElementById('totpTimerBar');
      const txt = document.getElementById('totpTimeTxt');
      if (totpTimer) clearInterval(totpTimer);

      const updateUI = () => {
        bar.style.width = (timeLeft / 180 * 100) + '%';
        const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        txt.textContent = m + ':' + s;
      };
      updateUI(); // 초기 렌더

      totpTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(totpTimer);
          updateQr();
        } else {
          updateUI();
        }
      }, 1000);
    };

    const btnReset = document.getElementById('btnResetTotp');
    if (btnReset) {
      btnReset.onclick = () => {
        btnReset.style.transition = 'transform 0.3s';
        btnReset.style.transform = `rotate(${manualOffset * 180 + 180}deg)`;
        updateQr(true);
      };
    }

    updateQr();
    const qrModal = document.getElementById('qrModal');
    qrModal.style.zIndex = '2147483647';
    qrModal.classList.add('show');
  };

  // 상세 모달 열기
  window.openDetailModal = async function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    if (!order) return;

    let displayOrderNo = orderNo;
    const match = orderNo.match(/0+(\d+)$/);
    if (match) displayOrderNo = match[1];

    let prefix = orderNo.startsWith('F') ? 'F' : (orderNo.startsWith('G') ? 'G' : 'O');
    let numericId = parseInt(displayOrderNo, 10);
    let orderIdBase36 = (isNaN(numericId) ? 0 : numericId).toString(36).toUpperCase();
    while (orderIdBase36.length < 5) orderIdBase36 = '0' + orderIdBase36;

    const fullBarcode = prefix + orderIdBase36 + "000000";

    const itemsHtml = (order.shop_order_items || []).map(item => {
      const isFood = item.shop_products && item.shop_products.type === 'FOOD';
      const imageUrl = (item.shop_products && item.shop_products.thumbnail_image_url)
        ? item.shop_products.thumbnail_image_url
        : (isFood ? '/Festio/images/food1.jpg' : '/Festio/images/goods1.jpg');

      return `
      <div style="display:flex; gap:12px; padding: 12px 0; border-bottom:1px solid var(--g100);">
        <div style="width:60px; height:60px; border-radius:8px; background: url('${imageUrl}') center/cover no-repeat; flex-shrink:0;"></div>
        <div style="flex:1; display:flex; justify-content:space-between;">
          <div>
            <div style="font-weight:700; color:var(--g900); font-size:15px; margin-bottom:4px;">${item.product_name || '상품명'}</div>
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
          <span class="barcode-text" style="font-weight:700;">${fullBarcode}</span>
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
      <div class="st-progress-bar"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66 : 33)}%;"><span class="st-truck ${flipClass}">${movingEmoji}</span></div></div>
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
      <div class="st-progress-bar"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66 : 33)}%;"><span class="st-truck ${flipClass}">${movingEmoji}</span></div></div>
      <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
      <div class="st-step ${isDone2 ? 'done' : 'active'}"><div class="st-dot"></div><div class="st-label">배송준비</div></div>
      <div class="st-step ${isDone3 ? 'done' : (isDone2 ? 'active' : '')}"><div class="st-dot"></div><div class="st-label">배송중</div></div>
      <div class="st-step ${isDone3 ? 'active' : ''}"><div class="st-dot"></div><div class="st-label">배송완료</div></div>
    `;
  }

  const itemsHtml = (order.shop_order_items || []).map(item => `
    <div class="order-item">
      <div class="oi-img" style="background:#f0f0f0"></div>
      <div class="oi-info">
        <span class="oi-status ${isPickup ? 'pickup' : 'shipping'}">${isPickup ? (isFood ? '푸드트럭 현장수령' : '현장 픽업') : '일반 배송'}</span>
        <div class="oi-name">${item.product_name || '상품'}</div>
        <div class="oi-opt">수량: ${item.quantity || 1}개</div>
        <div class="oi-price">${(item.price_at_purchase || 0).toLocaleString()}원</div>
      </div>
    </div>
  `).join('');

  let displayOrderNo = order.order_number;
  const match = order.order_number.match(/0+(\d+)$/);
  if (match) displayOrderNo = match[1];
  let prefix = order.order_number.startsWith('F') ? 'F' : (order.order_number.startsWith('G') ? 'G' : 'O');
  let numericId = parseInt(displayOrderNo, 10);
  let orderIdBase36 = (isNaN(numericId) ? 0 : numericId).toString(36).toUpperCase();
  while (orderIdBase36.length < 5) orderIdBase36 = '0' + orderIdBase36;
  const fullBarcode = prefix + orderIdBase36 + "000000";

  return `
    <div class="order-card">
      <div class="order-header">
        <div>
          <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
          <span class="order-no barcode-text">주문번호 ${fullBarcode}</span>
        </div>
        <a href="javascript:void(0)" onclick="openDetailModal('${order.order_number}')" class="order-detail-btn">주문상세 보기 &gt;</a>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="status-tracker">${steps}</div>
      <div class="order-actions" style="display:flex; justify-content:${isPickup ? 'space-between' : 'flex-start'}; align-items:center; margin-top:16px;">
        <button class="btn-review" onclick="openReviewModal('${order.order_number}')" style="background:var(--white); border:1px solid var(--g300); padding:10px 16px; border-radius:8px; font-weight:700; color:var(--g800); cursor:pointer;">리뷰 작성</button>
        ${isPickup ? `
        <button class="btn-qr" onclick="openQrModal('${order.order_number}')" style="background:var(--black); color:var(--white); border:none; padding:10px 16px; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /><rect x="14" y="18" width="3" height="3" /><rect x="18" y="14" width="3" height="3" />
          </svg> QR 픽업증 보기
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// 주문 취소
window.cancelOrder = function (orderNo) {
  if (confirm(orderNo + ' 주문을 취소하시겠습니까?')) {
    alert('주문이 취소되었습니다.');
    location.reload();
  }
};

// 리뷰 모달 전역 로직
let reviewImages = [];
let currentRating = 0;

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
  document.getElementById('reviewModal').classList.add('show');
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
      reviewImages.push(ev.target.result);
      renderReviewThumbs();
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
  if (reviewImages.length === 0) {
    container.innerHTML = '<div style="color:var(--g400); font-size:13px; line-height:60px;">사진을 첨부해주세요.</div>';
    return;
  }
  container.innerHTML = reviewImages.map((src, i) => `
    <div class="rv-thumb-item" style="position:relative; width:60px; height:60px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--g100);">
      <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
      <button onclick="removeReviewImage(${i})" class="rv-thumb-del" style="position:absolute; top:4px; right:4px; background:transparent; border:none; color:#fff; cursor:pointer; width:20px; height:20px; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `).join('');
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
