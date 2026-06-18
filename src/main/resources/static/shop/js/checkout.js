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
    // FESTIO 12자리 규격 주문번호 생성 (푸드 F, 굿즈 G)
    const prefix = order.some(i => (i.type || '').toUpperCase() === 'GOODS') ? 'G' : 'F';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rand = '';
    for (let i = 0; i < 11; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    const orderNumber = prefix + rand;

    // 40자리 Hex TOTP Secret 생성
    const hexChars = '0123456789abcdef';
    let secret = '';
    for (let i = 0; i < 40; i++) secret += hexChars.charAt(Math.floor(Math.random() * hexChars.length));

    // Supabase에 저장 시도 (FESTIO Pay)
    if (method === 'festiopay') {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) {
          Toast.show({ title: '오류', msg: '로그인이 필요합니다.', type: 'error' });
          isPaying = false;
          return;
        }

        // 실제 차감 API 호출
        const res = await fetch('/api/wallet/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': token },
          body: JSON.stringify({ amount: total })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          Toast.show({ title: '결제 실패', msg: data.message || '잔액이 부족합니다.', type: 'error' });
          isPaying = false;
          return;
        }

        const email = Session.get()?.email;
        if (email && window.ShopDB) {
          const profile = await window.ShopDB.getProfile(email);
          if (profile) {
            const sb = window.ShopDB.getClient();
            await sb.from('shop_orders').insert([{
              profile_id: profile.id,
              order_number: orderNumber,
              total_amount: total,
              payment_method: 'FESTIO_PAY',
              delivery_type: 'PICKUP',
              status: 'PAYMENT_COMPLETED',
              totp_secret: secret
            }]);
          }
        }
      } catch (e) {
        console.error('Order save error:', e);
        Toast.show({ title: '오류', msg: '주문 처리 중 문제가 발생했습니다.', type: 'error' });
        isPaying = false;
        return;
      }

      Toast.show({ title: '결제 성공', msg: 'FESTIO Pay로 결제되었습니다.', type: 'success' });
      localStorage.removeItem('fs_cart');
      sessionStorage.removeItem('fs_buynow');
      sessionStorage.removeItem('fs_order');
      setTimeout(() => location.href = 'orders.html', 1500);
      return;
    }

    if (method === 'toss' || method === 'card') {
      try {
        const tossPayments = TossPayments('test_ck_OEP59LybZ8Bdv6A1JxK366GYo7pR');
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
