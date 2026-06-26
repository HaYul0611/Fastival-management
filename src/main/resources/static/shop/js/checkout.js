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

  /* 연락처 자동 하이픈 및 채우기 */
  const rcvPhone = document.getElementById('rcvPhone');
  if (rcvPhone) {
    rcvPhone.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 3 && val.length <= 7) {
        val = val.replace(/(\d{3})(\d+)/, '$1-$2');
      } else if (val.length > 7) {
        val = val.replace(/(\d{3})(\d{3,4})(\d+)/, '$1-$2-$3');
      }
      e.target.value = val.substring(0, 13);
    });
    if (u && u.phone) {
      rcvPhone.value = u.phone;
      rcvPhone.dispatchEvent(new Event('input'));
    }
  }

  /* 수령 방법 변경 이벤트 (커스텀 드롭다운 연동) */
  const customRcvMethod = document.getElementById('customRcvMethod');
  const rcvSelect = document.getElementById('rcvMethod');
  const addressGroup = document.getElementById('addressGroup');

  if (customRcvMethod && rcvSelect) {
    const selected = customRcvMethod.querySelector('.select-selected');
    const items = customRcvMethod.querySelector('.select-items');

    selected.addEventListener('click', (e) => {
      e.stopPropagation();
      items.style.display = items.style.display === 'none' ? 'block' : 'none';
    });

    items.querySelectorAll('div').forEach(opt => {
      opt.addEventListener('click', (e) => {
        selected.textContent = e.target.textContent;
        rcvSelect.value = e.target.dataset.val;
        items.style.display = 'none';
        rcvSelect.dispatchEvent(new Event('change'));
      });
      // Hover effect
      opt.addEventListener('mouseenter', () => opt.style.background = 'var(--g50)');
      opt.addEventListener('mouseleave', () => opt.style.background = 'transparent');
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!customRcvMethod.contains(e.target)) items.style.display = 'none';
    });
  }

  if (rcvSelect) {
    rcvSelect.addEventListener('change', (e) => {
      if (e.target.value === 'delivery') {
        if (addressGroup) addressGroup.style.display = 'block';
      } else {
        if (addressGroup) addressGroup.style.display = 'none';
      }
    });
  }

  /* 다음 우편번호 API */
  window.execDaumPostcode = function () {
    new daum.Postcode({
      oncomplete: function (data) {
        document.getElementById('postcode').value = data.zonecode;
        document.getElementById('address1').value = data.address;
        document.getElementById('address2').focus();
      }
    }).open();
  };

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

    Toast.show({ title: '충전 중...', msg: 'FESTIO Pay 충전 진행 중...', type: 'info', dur: 1000 });

    // 빠른 모의 충전 처리 (INICIS 팝업 생략)
    setTimeout(async () => {
      try {
        const token = localStorage.getItem('userToken');
        const res = await fetch('/api/wallet/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ impUid: 'mock_uid_' + Date.now(), amount: chargeAmount, userToken: token })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          Toast.show({ title: '충전 완료', msg: `${chargeAmount.toLocaleString()}원이 충전되었습니다.`, type: 'success' });
          await fetchFestioBalance();
        } else {
          // 백엔드 오류 시에도 프론트에서 모의 충전 처리
          throw new Error('Fallback to local mock');
        }
      } catch (err) {
        let profile = await window.ShopDB.getProfile(u.email);
        if (profile) {
          await window.ShopDB.updateProfile(profile.id, { festio_pay_points: (profile.festio_pay_points || 0) + chargeAmount });
          await fetchFestioBalance();
        }
        Toast.show({ title: '충전 완료', msg: `${chargeAmount.toLocaleString()}원이 충전되었습니다.`, type: 'success' });
      }
    }, 600);
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

    async function saveOrderToDB(payMethod) {
      const sb = window.ShopDB.getClient();

      const rcvSelect = document.getElementById('rcvMethod');
      const deliveryType = (rcvSelect && rcvSelect.value === 'delivery') ? 'SHIPPING' : 'PICKUP';

      const { data: orderData, error: orderErr } = await sb.from('shop_orders').insert({
        order_number: orderNumber,
        user_email: (u && u.email) || 'guest@festio.com',
        user_name: name,
        user_phone: phone,
        total_price: originalTotal,
        discount_amount: discountAmount,
        final_price: finalTotal,
        payment_method: payMethod,
        delivery_type: deliveryType,
        status: 'PAYMENT_COMPLETED',
        secret_key: secret
      }).select().single();

      if (orderErr || !orderData) {
        throw new Error('주문 등록 실패: ' + (orderErr ? orderErr.message : ''));
      }

      const orderItems = order.map(item => ({
        order_id: orderData.id,
        store_id: item.storeId || item.id,
        store_name: item.brand || '알 수 없는 점포',
        product_id: item.productId || item.id,
        product_name: item.name,
        qty: item.qty,
        unit_price: item.price,
        options: item.opts || {}
      }));

      const { error: itemsErr } = await sb.from('shop_order_items').insert(orderItems);
      if (itemsErr) {
        console.error("Order items insert failed", itemsErr);
      }
    }

    // Supabase에 저장 시도 (FESTIO Pay)
    if (method === 'festiopay') {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) {
          Toast.show({ title: '오류', msg: '로그인이 필요합니다.', type: 'error' });
          isPaying = false;
          return;
        }

        // Supabase에서 현재 잔액 확인
        const profile = await window.ShopDB.getProfile(u.email);
        const currentBalance = profile ? (profile.festio_pay_points || 0) : 0;

        if (currentBalance < finalTotal) {
          const diff = finalTotal - currentBalance;
          const rechargeAmount = Math.ceil(diff / 10000) * 10000; // 1만원 단위 자동 충전

          if (confirm(`잔액이 부족합니다. (현재 ${currentBalance.toLocaleString()}원)\nFESTIO Pay ${rechargeAmount.toLocaleString()}원을 자동 충전하시겠습니까?`)) {
            // 원클릭 자동 충전 (테스트 환경 모의 처리)
            const newBalance = currentBalance + rechargeAmount;
            await window.ShopDB.updateProfile(profile.id, { festio_pay_points: newBalance });

            // 충전 이력 로컬스토리지 기록 (mypage.js 연동)
            let walletHist = JSON.parse(localStorage.getItem('shopWalletHistory_' + u.email) || '[]');
            walletHist.unshift({ type: 'charge', desc: '자동 충전', amount: rechargeAmount, date: new Date().toLocaleString() });
            localStorage.setItem('shopWalletHistory_' + u.email, JSON.stringify(walletHist));

            Toast.show({ title: '충전 완료', msg: `${rechargeAmount.toLocaleString()}원이 충전되었습니다. 결제를 다시 시도합니다.`, type: 'success' });
            isPaying = false;
            return;
          } else {
            Toast.show({ title: '결제 취소', msg: '잔액 부족으로 결제가 취소되었습니다.', type: 'error' });
            isPaying = false;
            return;
          }
        }

        // 결제 (잔액 차감)
        const balanceAfterPay = currentBalance - finalTotal;
        await window.ShopDB.updateProfile(profile.id, { festio_pay_points: balanceAfterPay });

        // 결제 이력 로컬스토리지 기록
        let walletHist = JSON.parse(localStorage.getItem('shopWalletHistory_' + u.email) || '[]');
        walletHist.unshift({ type: 'use', desc: 'FESTIO SHOP 결제', amount: finalTotal, date: new Date().toLocaleString() });
        localStorage.setItem('shopWalletHistory_' + u.email, JSON.stringify(walletHist));

        // 2. Supabase DB에 주문 데이터 전송
        await saveOrderToDB(method);

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

      // 결제 완료 팝업 띄우기 (알림 유지 안내)
      const modalHtml = `
        <div id="pushNoticeModal" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px;">
          <div style="background:#fff; border-radius:16px; padding:24px; max-width:320px; width:100%; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <div style="width:50px; height:50px; background:var(--primary); color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h3 style="font-size:18px; font-weight:800; margin-bottom:12px; color:var(--g900);">결제가 완료되었습니다!</h3>
            <p style="font-size:14px; color:var(--g600); line-height:1.5; margin-bottom:20px;">
              스마트폰 화면을 꺼두시거나<br>다른 앱을 보셔도 내 차례가 되면<br><strong style="color:var(--primary);">알림과 진동</strong>이 울립니다.<br><br>
              <span style="font-size:13px; color:#FF2D55; font-weight:600;">단, 원활한 푸시 알림 수신을 위해<br>현재 브라우저 창(탭)을 완전히<br>종료하지는 말아주세요!</span>
            </p>
            <button id="btnPushNoticeOk" style="width:100%; background:var(--black); color:#fff; border:none; padding:14px; border-radius:12px; font-weight:700; font-size:15px; cursor:pointer;">확인 및 주문내역 보기</button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      document.getElementById('btnPushNoticeOk').addEventListener('click', () => {
        location.href = 'orders.html';
      });
      return;
    }

    if (method === 'toss' || method === 'card') {
      try {
        if (typeof TossPayments !== 'undefined') {
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
        } else {
          throw new Error('Toss API not loaded');
        }
      } catch (err) {
        if (err.code !== 'USER_CANCEL') {
          await saveOrderToDB(method); // 모의 성공 시 DB에 저장
          Toast.show({ title: '결제 성공 (Mock)', msg: 'PG 연동 오류로 모의 결제 성공 처리됩니다.', type: 'success' });
          localStorage.removeItem('fs_cart');
          sessionStorage.removeItem('fs_buynow');
          sessionStorage.removeItem('fs_order');
          setTimeout(() => { location.href = 'orders.html'; }, 1500);
        }
      }
    } else {
      Toast.show({ title: '카카오페이 연동 예정', msg: '준비 중입니다.', type: 'info' });
    }
  });
});
