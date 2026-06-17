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
    profile = { id: 'mock', user_name: '관리자', user_email: email, tier: 'BRONZE', festio_pay_points: 0, total_spent: 0 };
  }

  // 1. 프로필 정보 렌더링
  document.getElementById('mpName').textContent = profile.user_name + '님';
  document.getElementById('mpEmail').textContent = profile.user_email;

  if (profile.avatar_url) {
    document.getElementById('mypageAvatar').src = profile.avatar_url;
    document.getElementById('mypageAvatar').style.display = 'block';
    document.getElementById('avatarFallback').style.display = 'none';
  }

  // 2. 등급 및 프로그레스 바 계산
  const tierEl = document.getElementById('mpTier');
  tierEl.textContent = profile.tier + ' 등급';
  tierEl.className = 'mp-tier badge-' + profile.tier.toLowerCase();

  const totalSpent = profile.total_spent || 0;
  // 임의 등급 기준 (BRONZE:0, SILVER:15000, GOLD:50000, EMERALD:100000, DIAMOND:200000)
  let nextTier = 'SILVER', nextGoal = 15000;
  if (totalSpent >= 200000) { nextTier = 'MAX'; nextGoal = totalSpent; }
  else if (totalSpent >= 100000) { nextTier = 'DIAMOND'; nextGoal = 200000; }
  else if (totalSpent >= 50000) { nextTier = 'EMERALD'; nextGoal = 100000; }
  else if (totalSpent >= 15000) { nextTier = 'GOLD'; nextGoal = 50000; }

  const bar = document.getElementById('mpProgressBar');
  const txt = document.getElementById('mpSpentTxt');
  const msgEl = document.querySelector('.tier-progress-wrap span:first-child');

  if (nextTier === 'MAX') {
    msgEl.textContent = '최고 등급입니다!';
    txt.textContent = totalSpent.toLocaleString() + 'P';
    bar.style.width = '100%';
  } else {
    msgEl.textContent = `누적 ${nextGoal.toLocaleString()}P 달성 시 다음 등급 (${nextTier})`;
    txt.textContent = `${totalSpent.toLocaleString()}P / ${nextGoal.toLocaleString()}P`;
    const pct = Math.min((totalSpent / nextGoal) * 100, 100);
    setTimeout(() => { bar.style.width = pct + '%'; }, 100);
  }

  // 3. FESTIO Pay 잔여 포인트
  const pointsEl = document.getElementById('mpPoints');
  pointsEl.textContent = (profile.festio_pay_points || 0).toLocaleString();

  // 4. 알림 토글 동기화
  const chkFood = document.getElementById('notiFood');
  const chkShip = document.getElementById('notiShip');
  const chkMark = document.getElementById('notiMark');

  chkFood.checked = profile.noti_food_truck;
  chkShip.checked = profile.noti_shipping;
  chkMark.checked = profile.noti_marketing;

  const updateNoti = async (key, val) => {
    await window.ShopDB.updateProfile(profile.id, { [key]: val });
    Toast.success('알림 설정이 저장되었습니다.');
  };
  chkFood.addEventListener('change', e => updateNoti('noti_food_truck', e.target.checked));
  chkShip.addEventListener('change', e => updateNoti('noti_shipping', e.target.checked));
  chkMark.addEventListener('change', e => updateNoti('noti_marketing', e.target.checked));

  // 5. 아바타 업로드 (Base64 변환)
  const avatarUpload = document.getElementById('avatarUpload');
  const avatarContainer = document.getElementById('avatarContainer');
  avatarContainer.addEventListener('click', () => avatarUpload.click());

  avatarUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64Str = ev.target.result;
      document.getElementById('mypageAvatar').src = base64Str;
      document.getElementById('mypageAvatar').style.display = 'block';
      document.getElementById('avatarFallback').style.display = 'none';

      // DB 업데이트
      await window.ShopDB.updateProfile(profile.id, { avatar_url: base64Str });
      Toast.success('프로필 사진이 변경되었습니다.');
      // 헤더 아바타 동기화
      const hdrAvatar = document.getElementById('hdrAvatar');
      if (hdrAvatar) hdrAvatar.src = base64Str;
    };
    reader.readAsDataURL(file);
  });

  // 6. FESTIO Pay 충전 (토스페이먼츠)
  const btnCharge = document.getElementById('btnChargePay');
  btnCharge.addEventListener('click', async () => {
    try {
      const tossPayments = TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo');
      const orderId = 'CHARGE_' + new Date().getTime();
      const chargeAmt = 50000; // 테스트용 고정 금액 (실제로는 모달에서 입력받아야 함)

      // 토스페이먼츠 호출 (모의 결제)
      await tossPayments.requestPayment('카드', {
        amount: chargeAmt,
        orderId: orderId,
        orderName: 'FESTIO Pay 충전',
        customerName: profile.user_name,
        successUrl: window.location.origin + window.location.pathname + '?charge_success=true&amt=' + chargeAmt,
        failUrl: window.location.origin + window.location.pathname + '?charge_fail=true'
      });
    } catch (err) {
      if (err.code !== 'USER_CANCEL') {
        Toast.error('결제 모듈 호출 중 오류가 발생했습니다.');
      }
    }
  });

  // 7. 결제 성공/실패 쿼리 파라미터 처리
  const params = new URLSearchParams(window.location.search);
  if (params.get('charge_success') === 'true') {
    const amt = parseInt(params.get('amt')) || 0;
    const newPoints = (profile.festio_pay_points || 0) + amt;
    await window.ShopDB.updateProfile(profile.id, { festio_pay_points: newPoints });

    Toast.success(amt.toLocaleString() + 'P 충전이 완료되었습니다!');
    pointsEl.textContent = newPoints.toLocaleString();

    // URL 정리
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});
