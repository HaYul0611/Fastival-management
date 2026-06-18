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

    document.getElementById('qrOrderNo').textContent = '주문번호: ' + orderNo;
    qrModal.classList.add('show');

    const refreshTotp = async (isManual = false) => {
      if (isManual) manualOffset++;
      const timeWindow = Math.floor(Date.now() / 180000) + manualOffset; // 3분 단위 + 수동오프셋
      const code = await generateMockTotp(secret, timeWindow);

      document.getElementById('totpCode').textContent = code;
      document.getElementById('qrImage').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TOTP:' + orderNo + ':' + code;

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
          refreshTotp();
        } else {
          updateUI();
        }
      }, 1000);
    };

    const btnReset = document.getElementById('btnResetTotp');
    if (btnReset) {
      btnReset.onclick = () => {
        // SVG 회전 애니메이션 효과 (선택사항)
        btnReset.style.transition = 'transform 0.3s';
        btnReset.style.transform = `rotate(${manualOffset * 180 + 180}deg)`;
        refreshTotp(true);
      };
    }

    refreshTotp();
  };

  // 상세 모달 열기
  window.openDetailModal = function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    if (!order) return;

    const itemsHtml = (order.shop_order_items || []).map(item => `
      <div style="display:flex; justify-content:space-between; padding: 12px 0; border-bottom:1px solid var(--g100);">
        <div>
          <div style="font-weight:700; color:var(--g900);">${item.product_name || '상품명'}</div>
          <div style="font-size:13px; color:var(--g500); margin-top:4px;">수량: ${item.quantity || 1}개</div>
        </div>
        <div style="font-weight:700;">${((item.price_at_purchase || 0) * (item.quantity || 1)).toLocaleString()}원</div>
      </div>
    `).join('');

    const html = `
      <div style="margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">주문번호</span>
          <span style="font-weight:700;">${order.order_number}</span>
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
          <span style="font-weight:700;">${order.payment_method === 'FESTIO_PAY' ? '페스티오페이' : '카드결제'}</span>
        </div>
      </div>
      <h4 style="font-size:16px; font-weight:800; margin-bottom:12px;">주문 상품</h4>
      <div style="margin-bottom:24px; border-top:2px solid var(--g900);">
        ${itemsHtml}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--g50); padding:16px; border-radius:8px;">
        <span style="font-size:16px; font-weight:700;">총 결제금액</span>
        <span style="font-size:20px; font-weight:900; color:var(--blue);">${(order.total_amount || 0).toLocaleString()}원</span>
      </div>
    `;

    document.getElementById('odContent').innerHTML = html;
    odModal.classList.add('show');
  };

  // 주문 내역 가져오기
  const fetchOrders = async () => {
    const sb = window.ShopDB.getClient();
    let { data: orders, error } = await sb.from('shop_orders').select('*, shop_order_items(*)').eq('profile_id', profile.id).order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      listEl.innerHTML = '<p>주문 내역을 불러오지 못했습니다.</p>';
      return;
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
          { product_name: '스모크 바베큐 버거 + 콜라 세트', quantity: 1, price_at_purchase: 12500 }
        ]
      };
      window.currentOrders = [dummyOrder];
      listEl.innerHTML = renderOrderCard(dummyOrder);
      return;
    }

    window.currentOrders = orders;
    listEl.innerHTML = orders.map(renderOrderCard).join('');
  };

  // 즉시 실행 (스켈레톤 지연 제거)
  fetchOrders();
});

function renderOrderCard(order) {
  const isPickup = order.delivery_type === 'PICKUP';
  let steps = '';

  if (isPickup) {
    const isDone1 = true;
    const isDone2 = order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED';
    const isDone3 = order.status === 'COMPLETED';
    steps = `
      <div class="st-line"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66 : 33)}%;"></div></div>
      <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
      <div class="st-step ${isDone2 ? 'done' : 'active'}"><div class="st-dot"></div><div class="st-label">조리 준비</div></div>
      <div class="st-step ${isDone3 ? 'done' : (isDone2 ? 'active' : '')}"><div class="st-dot"></div><div class="st-label">수령전</div></div>
      <div class="st-step ${isDone3 ? 'active' : ''}"><div class="st-dot"></div><div class="st-label">수령완료</div></div>
    `;
  } else {
    const isDone1 = true;
    const isDone2 = order.status === 'SHIPPING' || order.status === 'DELIVERED';
    const isDone3 = order.status === 'DELIVERED';
    steps = `
      <div class="st-line"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66 : 33)}%;"></div></div>
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
        <span class="oi-status ${isPickup ? 'pickup' : 'shipping'}">${isPickup ? '푸드트럭 현장수령' : '일반 배송'}</span>
        <div class="oi-name">${item.product_name || '상품'}</div>
        <div class="oi-opt">수량: ${item.quantity || 1}개</div>
        <div class="oi-price">${(item.price_at_purchase || 0).toLocaleString()}원</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="order-card">
      <div class="order-header">
        <div>
          <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
          <span class="order-no">주문번호 ${order.order_number}</span>
        </div>
        <a href="javascript:void(0)" onclick="openDetailModal('${order.order_number}')" class="order-detail-btn">주문상세 보기 &gt;</a>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="status-tracker">${steps}</div>
      ${isPickup ? `
      <div class="order-actions">
        <button class="btn-qr" onclick="openQrModal('${order.order_number}')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /><rect x="14" y="18" width="3" height="3" /><rect x="18" y="14" width="3" height="3" />
          </svg> QR 픽업증 보기
        </button>
      </div>` : ''}
    </div>
  `;
}
