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

  const originalTotal = order.reduce((s, i) => s + i.price * i.qty, 0);
  let finalTotal = originalTotal;
  let discountAmount = 0;
  let userGrade = 'BRONZE';

  const discountRates = {
    'VVIP': 0.10,
    'SVIP': 0.07,
    'VIP': 0.07,
    'DIAMOND': 0.05,
    'EMERALD': 0.04,
    'GOLD': 0.03,
    'SILVER': 0.01,
    'BRONZE': 0.00
  };

  async function applyMembershipDiscount() {
    const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': token }
      });
      if (res.ok) {
        const user = await res.json();
        userGrade = (user.membershipGrade || 'BRONZE').toUpperCase();
        const rate = discountRates[userGrade] || 0.00;

        if (rate > 0) {
          discountAmount = Math.floor(originalTotal * rate);
          finalTotal = originalTotal - discountAmount;

          const discRow = document.getElementById('coDiscountRow');
          const discGrade = document.getElementById('coDiscountGrade');
          const discAmount = document.getElementById('coDiscountAmount');

          if (discRow && discGrade && discAmount) {
            discGrade.textContent = `${userGrade} (${Math.round(rate * 100)}%)`;
            discAmount.textContent = `-${discountAmount.toLocaleString()}원`;
            discRow.style.display = 'flex';
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch user membership info", e);
    }

    document.getElementById('coGoods').textContent = originalTotal.toLocaleString() + '원';
    document.getElementById('coTotal').textContent = finalTotal.toLocaleString() + '원';

    if (document.querySelector('input[name="pay"]:checked')?.value === 'festiopay') {
      await fetchFestioBalance();
    }
  }

  document.getElementById('coGoods').textContent = originalTotal.toLocaleString() + '원';
  document.getElementById('coTotal').textContent = finalTotal.toLocaleString() + '원';
  applyMembershipDiscount();

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

  /* 결제 수단 선택 시 FESTIO Pay 잔액 조회 */
  const payRadios = document.querySelectorAll('input[name="pay"]');
  const fpArea = document.getElementById('festioPayBalanceArea');
  const fpText = document.getElementById('festioPayBalanceText');
  const fpShortMsg = document.getElementById('festioPayShortageMsg');
  const fpShortAmountText = document.getElementById('shortageAmountText');
  let currentFestioBalance = 0;

  async function fetchFestioBalance() {
    const token = localStorage.getItem('userToken');
    if (!token) {
      fpText.textContent = '로그인이 필요합니다';
      return;
    }
    try {
      const res = await fetch('/api/wallet/balance', { headers: { 'Authorization': token } });
      const data = await res.json();
      if (res.ok) {
        currentFestioBalance = data.balance || 0;
        fpText.textContent = currentFestioBalance.toLocaleString() + '원';

        // 부족 금액 계산
        const shortage = finalTotal - currentFestioBalance;
        if (shortage > 0) {
          fpShortAmountText.textContent = shortage.toLocaleString() + '원이';
          fpShortMsg.style.display = 'block';

          // 초기 충전 권장 금액을 부족한 금액을 올림한 단위로 설정 (선택사항)
          const recAmt = Math.ceil(shortage / 10000) * 10000;
          document.getElementById('chargeInput').value = recAmt.toLocaleString();
        } else {
          fpShortMsg.style.display = 'none';
          document.getElementById('chargeInput').value = '';
        }
      } else {
        fpText.textContent = '조회 실패';
      }
    } catch (err) {
      fpText.textContent = '오류 발생';
    }
  }

  payRadios.forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (e.target.value === 'festiopay') {
        fpArea.style.display = 'block';
        await fetchFestioBalance();
      } else {
        fpArea.style.display = 'none';
      }
    });
  });

  /* 금액 입력 필드 콤마 포맷팅 */
  const chargeInput = document.getElementById('chargeInput');
  if (chargeInput) {
    chargeInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val ? parseInt(val).toLocaleString() : '';
    });
  }

  /* 빠른 충전 버튼 (1만, 3만, 5만, 10만) 클릭 이벤트 */
  document.querySelectorAll('.qp-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const amt = parseInt(e.target.dataset.amt);
      chargeInput.value = amt.toLocaleString();
    });
  });

  /* FESTIO Pay 충전 결제 로직 */
  document.getElementById('btnQuickCharge')?.addEventListener('click', () => {
    const amountStr = chargeInput ? chargeInput.value.replace(/,/g, '') : '0';
    const chargeAmount = parseInt(amountStr || '0', 10);

    if (chargeAmount < 1000) {
      Toast.show({ title: '금액 오류', msg: '최소 1,000원 이상 입력해주세요.', type: 'warning' });
      return;
    }

    if (!window.IMP) {
      Toast.show({ title: '오류', msg: '결제 모듈을 불러올 수 없습니다.', type: 'error' });
      return;
    }

    const IMP = window.IMP;
    IMP.init('imp81384776');
    const orderUid = 'festio-wallet-' + Date.now();

    IMP.request_pay({
      pg: 'html5_inicis.INIpayTest',
      pay_method: 'card',
      merchant_uid: orderUid,
      name: `FESTIO Pay 충전 ${chargeAmount.toLocaleString()}원`,
      amount: chargeAmount,
      buyer_email: (u && u.email) || '',
      buyer_name: (u && u.name) || '이용자',
      buyer_tel: (u && u.phone) || '010-0000-0000',
    }, async (rsp) => {
      if (rsp.success) {
        try {
          const token = localStorage.getItem('userToken');
          const res = await fetch('/api/wallet/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ impUid: rsp.imp_uid, amount: chargeAmount, userToken: token })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            Toast.show({ title: '충전 완료', msg: `${chargeAmount.toLocaleString()}원이 충전되었습니다.`, type: 'success' });
            await fetchFestioBalance(); // 충전 완료 후 잔액 다시 렌더링
          } else {
            Toast.show({ title: '충전 실패', msg: data.message || '서버 오류', type: 'error' });
          }
        } catch (err) {
          Toast.show({ title: '충전 오류', msg: '충전 처리 중 문제가 발생했습니다.', type: 'error' });
        }
      } else {
        Toast.show({ title: '충전 취소', msg: rsp.error_msg || '결제가 취소되었습니다.', type: 'info' });
      }
    });
  });

  /* 결제 */
  document.getElementById('btnPay').addEventListener('click', async () => {
    // 임의의 재고 확인 모달 연동 (품절 방어 로직)
    if (order.length > 0 && Math.random() < 0.05) { // 5% 확률로 품절 시뮬레이션
      Toast.show({ title: '재고 부족', msg: '죄송합니다. 방금 전 재고가 소진되었습니다.', type: 'error' });
      isPaying = false;
      return;
    }
    isPaying = true;
    const name = document.getElementById('rcvName').value.trim();
    const phone = document.getElementById('rcvPhone').value.trim();
    const method = document.querySelector('input[name="pay"]:checked')?.value;
    if (!name || !phone) { Toast.show({ title: '수령 정보를 입력해주세요', type: 'warning' }); isPaying = false; return }
    const phoneRegex = /^(01[016789])-?([0-9]{3,4})-?([0-9]{4})$/;
    if (!phoneRegex.test(phone)) {
      Toast.show({ title: '수령 정보 오류', msg: '전화번호를 잘못 입력했습니다. 올바른 휴대폰 번호를 입력해주세요.', type: 'warning' });
      isPaying = false;
      return;
    }
    // FESTIO 12자리 규격 주문번호 생성 (푸드 F, 굿즈 G)
    const prefix = order.some(i => (i.type || i.cat || '').toUpperCase() === 'GOODS') ? 'G' : 'F';
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
          body: JSON.stringify({ amount: finalTotal })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          Toast.show({ title: '결제 실패', msg: data.message || '잔액이 부족합니다.', type: 'error' });
          isPaying = false;
          return;
        }

        // 2. MySQL 백엔드 DB에 주문 데이터 전송 (업주가 볼 수 있도록 처리)
        const shopOrderPayload = {
          totalPrice: finalTotal,
          userToken: token,
          festivalId: sessionStorage.getItem('currentFestivalId') || 1, // 필요 시 페스티벌 ID 추가
          items: order.map(item => ({
            id: item.productId || item.id,
            qty: item.qty,
            type: item.type || ((item.category || item.cat) === 'fnb' || (item.category || item.cat) === 'food' ? 'FOOD' : 'GOODS'),
            options: item.opts ? JSON.stringify(item.opts) : (item.options || '')
          }))
        };

        const orderRes = await fetch('/api/order/shop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shopOrderPayload)
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok || orderData.status !== 'success') {
          throw new Error(orderData.message || '주문 등록 실패');
        }

      } catch (e) {
        console.error('Order save error:', e);
        Toast.show({ title: '오류', msg: e.message || '주문 처리 중 문제가 발생했습니다.', type: 'error' });
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
          amount: finalTotal,
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
