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

  window.openQrModal = function (orderNo) {
    document.getElementById('qrOrderNo').textContent = '주문번호: ' + orderNo;
    document.getElementById('qrImage').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PICKUP_' + orderNo;
    qrModal.classList.add('show');
  };

  // 주문 내역 가져오기 (가상 로딩 시간 1초 부여 - 스켈레톤 UI 확인용)
  setTimeout(async () => {
    const sb = window.ShopDB.getClient();
    let { data: orders, error } = await sb.from('shop_orders').select('*, shop_order_items(*)').eq('profile_id', profile.id).order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      listEl.innerHTML = '<p>주문 내역을 불러오지 못했습니다.</p>';
      return;
    }

    if (!orders || orders.length === 0) {
      // 미리보기용 더미 데이터 렌더링
      listEl.innerHTML = renderDummyOrders();
      return;
    }

    listEl.innerHTML = orders.map(renderOrderCard).join('');
  }, 1000);
});

function renderOrderCard(order) {
  // 트래커 상태 계산 로직 (간소화)
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
    // 일반 배송
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
        <div class="oi-name">${item.product_name}</div>
        <div class="oi-opt">수량: ${item.quantity}개</div>
        <div class="oi-price">${item.price_at_purchase.toLocaleString()}원</div>
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
        <a href="#" class="order-detail-btn">주문상세 보기 &gt;</a>
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

function renderDummyOrders() {
  return `
    <div class="order-card">
      <div class="order-header">
        <div><span class="order-date">2026.08.15</span><span class="order-no">주문번호 DEMO-00123</span></div>
        <a href="#" class="order-detail-btn">주문상세 보기 &gt;</a>
      </div>
      <div class="order-items">
        <div class="order-item">
          <div class="oi-img"></div>
          <div class="oi-info">
            <span class="oi-status pickup">푸드트럭 현장수령</span>
            <div class="oi-name">스모크 바베큐 버거 + 콜라 세트</div>
            <div class="oi-opt">옵션: 양파 빼기 | 수량: 1개</div>
            <div class="oi-price">12,500원</div>
          </div>
        </div>
      </div>
      <div class="status-tracker">
        <div class="st-line"><div class="st-progress" style="width:66%;"></div></div>
        <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
        <div class="st-step done"><div class="st-dot"></div><div class="st-label">조리 준비</div></div>
        <div class="st-step active"><div class="st-dot"></div><div class="st-label">수령전(픽업대기)</div></div>
        <div class="st-step"><div class="st-dot"></div><div class="st-label">수령완료</div></div>
      </div>
      <div class="order-actions">
        <button class="btn-qr" onclick="openQrModal('DEMO-00123')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /><rect x="14" y="18" width="3" height="3" /><rect x="18" y="14" width="3" height="3" />
          </svg> QR 픽업증 보기
        </button>
      </div>
    </div>
  `;
}
