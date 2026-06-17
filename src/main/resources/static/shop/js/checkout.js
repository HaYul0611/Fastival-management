'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const { renderHeader, requireLogin, Toast, Session } = window.FS;
  renderHeader(); requireLogin(() => { });

  const isBuyNow = new URLSearchParams(location.search).get('mode') === 'buynow';
  let order = isBuyNow
    ? (() => { const i = JSON.parse(sessionStorage.getItem('fs_buynow') || 'null'); return i ? [i] : [] })()
    : JSON.parse(sessionStorage.getItem('fs_order') || '[]');
  if (!order.length) order = JSON.parse(localStorage.getItem('fs_cart') || '[]').filter(i => i.checked !== false);

  /* 요약 */
  const listEl = document.getElementById('coItemList');
  if (listEl) {
    listEl.innerHTML = order.map(i => `
      <div class="co-item">
        <span class="co-item-name">${i.name}</span>
        <span class="co-item-qty">×${i.qty}</span>
        <span class="co-item-price">${(i.price * i.qty).toLocaleString()}원</span>
      </div>`).join('');
  }
  const total = order.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('coGoods').textContent = total.toLocaleString() + '원';
  document.getElementById('coTotal').textContent = total.toLocaleString() + '원';

  /* 회원 자동 채우기 */
  const u = Session.get();
  if (u) { const n = document.getElementById('rcvName'); if (n && u.name) n.value = u.name }

  /* 결제 중 이탈 방지 경고 */
  let isPaying = false;
  window.addEventListener('beforeunload', (e) => {
    if (!isPaying) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* 결제 */
  document.getElementById('btnPay').addEventListener('click', async () => {
    // 임의의 재고 확인 모달 연동 (품절 방어 로직)
    if (order.length > 0 && Math.random() < 0.05) { // 5% 확률로 품절 시뮬레이션
      window.FS.Toast.error('죄송합니다. 방금 전 재고가 소진되었습니다.');
      return;
    }
    isPaying = true;
    const name = document.getElementById('rcvName').value.trim();
    const phone = document.getElementById('rcvPhone').value.trim();
    const method = document.querySelector('input[name="pay"]:checked')?.value;
    if (!name || !phone) { Toast.show({ title: '수령 정보를 입력해주세요', type: 'warning' }); return }
    if (method === 'festiopay') {
      Toast.show({ title: '결제 성공', msg: 'FESTIO Pay로 결제되었습니다.', type: 'success' });
      localStorage.removeItem('fs_cart');
      sessionStorage.removeItem('fs_buynow');
      sessionStorage.removeItem('fs_order');
      setTimeout(() => location.href = 'shop.html', 1500);
      return;
    }

    if (method === 'toss' || method === 'card') {
      try {
        const tossPayments = TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo');
        const methodMap = { card: '카드', toss: '토스결제' };

        await tossPayments.requestPayment(methodMap[method] || '카드', {
          amount: total,
          orderId: 'SHOP_CART_' + Date.now(),
          orderName: order.length > 1 ? `${order[0].name} 외 ${order.length - 1}건` : order[0].name,
          customerName: name,
          successUrl: `${window.location.origin}/Festio/payment-success.html`,
          failUrl: `${window.location.origin}/Festio/payment-fail.html`,
        });
      } catch (err) {
        if (err.code !== 'USER_CANCEL') {
          Toast.show({ title: '결제 오류', msg: err.message, type: 'error' });
        }
      }
    } else {
      Toast.show({ title: '카카오페이 연동 예정', msg: '준비 중입니다.', type: 'info' });
    }
  });
});
