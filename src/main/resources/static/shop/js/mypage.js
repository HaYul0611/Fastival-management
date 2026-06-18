'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const { Session, Toast, renderHeader } = window.FS;
  renderHeader();

  if (!Session.isLoggedIn()) {
    Toast.show({ title: '오류', msg: '로그인이 필요합니다.', type: 'warning' });
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

  let hasAvatar = !!profile.avatar_url;

  if (profile.avatar_url) {
    document.getElementById('mypageAvatar').src = profile.avatar_url;
    document.getElementById('mypageAvatar').style.display = 'block';
    document.getElementById('avatarFallback').style.display = 'none';
  }

  // 2. 통합 등급 및 프로그레스 바 계산
  let festioSpent = 0;
  const tkn = localStorage.getItem('userToken');
  if (tkn) {
    try {
      const res = await fetch('/api/tickets/my', { headers: { 'Authorization': tkn } });
      if (res.ok) {
        const tickets = await res.json();
        festioSpent = tickets.filter(t => t.reservationStatus === '결제완료' || t.reservationStatus === '입장완료').reduce((sum, t) => sum + (t.paymentAmount || 0), 0);
      }
    } catch (e) { console.warn('티켓 이력 조회 실패', e); }
  }

  const totalSpent = (profile.total_spent || 0) + festioSpent;
  let currentTier = profile.tier || 'BRONZE';

  if (!['VIP', 'SVIP', 'VVIP'].includes(currentTier)) {
    if (totalSpent >= 10000000) currentTier = 'DIAMOND';
    else if (totalSpent >= 1000000) currentTier = 'EMERALD';
    else if (totalSpent >= 500000) currentTier = 'GOLD';
    else if (totalSpent >= 150000) currentTier = 'SILVER';
    else currentTier = 'BRONZE';

    if (currentTier !== profile.tier) {
      profile.tier = currentTier;
      window.ShopDB.updateProfile(profile.id, { tier: currentTier });
    }
  }

  const tierEl = document.getElementById('mpTier');
  tierEl.textContent = currentTier + ' 등급';
  tierEl.className = 'mp-tier badge-' + currentTier.toLowerCase();

  let nextTier = 'SILVER', nextGoal = 15000, barColor = 'var(--blue)';

  if (currentTier === 'BRONZE') { barColor = '#8B4513'; } // 브론즈색
  else if (currentTier === 'SILVER') { barColor = '#A9A9A9'; } // 은색
  else if (currentTier === 'GOLD') { barColor = '#DAA520'; } // 금색
  else if (currentTier === 'EMERALD') { barColor = '#50C878'; } // 에메랄드색
  else if (currentTier === 'DIAMOND') { barColor = '#B9F2FF'; } // 다이아몬드색
  else if (['VIP', 'SVIP', 'VVIP'].includes(currentTier)) { barColor = '#8930F8'; nextTier = 'SPECIAL'; } // 특수 등급

  if (nextTier !== 'SPECIAL') {
    if (totalSpent >= 10000000) { nextTier = 'MAX'; nextGoal = totalSpent; }
    else if (totalSpent >= 1000000) { nextTier = 'DIAMOND'; nextGoal = 10000000; }
    else if (totalSpent >= 500000) { nextTier = 'EMERALD'; nextGoal = 1000000; }
    else if (totalSpent >= 150000) { nextTier = 'GOLD'; nextGoal = 500000; }
    else { nextTier = 'SILVER'; nextGoal = 150000; }
  }

  const bar = document.getElementById('mpProgressBar');
  const txt = document.getElementById('mpSpentTxt');
  const nextBadge = document.getElementById('nextTierBadge');
  const msgEl = document.querySelector('.tier-progress-wrap span:first-child');

  if (nextTier === 'SPECIAL') {
    if (nextBadge) nextBadge.style.display = 'none';
    msgEl.childNodes[0].textContent = '특수 등급입니다! ';
    txt.textContent = '상향 대상 아님';
    bar.style.width = '100%';
    bar.style.background = barColor;
  } else if (nextTier === 'MAX') {
    if (nextBadge) nextBadge.style.display = 'none';
    msgEl.childNodes[0].textContent = '최고 등급입니다! ';
    txt.textContent = totalSpent.toLocaleString() + 'P';
    bar.style.width = '100%';
    bar.style.background = barColor;
  } else {
    if (nextBadge) nextBadge.textContent = nextTier;
    txt.textContent = `${totalSpent.toLocaleString()}P / ${nextGoal.toLocaleString()}P`;
    const pct = Math.min((totalSpent / nextGoal) * 100, 100);
    setTimeout(() => {
      bar.style.width = pct + '%';
      if (pct === 0) { bar.style.width = '1%'; bar.style.minWidth = '6px'; }
      bar.style.background = barColor;
    }, 100);
  }

  // 3. FESTIO Pay 잔여 포인트 (Supabase 연동)
  const pointsEl = document.getElementById('mpPoints');
  let currentBalance = profile.festio_pay_points || 0;
  pointsEl.textContent = currentBalance.toLocaleString();

  // 거래 내역 상태 관리 (임시/로컬)
  let _shopWalletHistory = JSON.parse(localStorage.getItem('shopWalletHistory_' + email) || '[]');
  let _shopWalletFilter = 'all';

  const renderShopWalletHistory = () => {
    const container = document.getElementById('shopWalletHistoryList');
    if (!container) return;

    const filtered = _shopWalletFilter === 'all'
      ? _shopWalletHistory
      : _shopWalletHistory.filter(h => h.type === _shopWalletFilter);

    if (!filtered.length) {
      container.innerHTML = `
        <div style="padding:40px 0;text-align:center;align-items:center;">
          <p style="font-size:18px;font-weight:800;color:var(--black);margin-bottom:8px;">거래 내역이 없습니다</p>
          <p style="font-size:14px;color:var(--g500);">충전 또는 결제 내역이 발생하면 이곳에 표시됩니다.</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(h => `
      <div class="wallet-history-item">
        <div style="display:flex;align-items:center;flex:1;min-width:0;">
          <div class="wallet-history-icon ${h.type}" style="font-size:24px;margin-right:16px;">
            ${h.type === 'charge' ? '💰' : '🛒'}
          </div>
          <div class="wallet-history-info">
            <div class="wallet-history-desc" style="font-weight:700;color:var(--black);font-size:15px;margin-bottom:4px;">${h.desc}</div>
            <div class="wallet-history-date" style="font-size:13px;color:var(--g500);">${h.date}</div>
          </div>
        </div>
        <div class="wallet-history-amount ${h.type}" style="font-weight:800;font-size:16px;color:${h.type === 'charge' ? '#667eea' : 'var(--red)'}">
          ${h.amount > 0 ? '+' : ''}${h.amount.toLocaleString()} P
        </div>
      </div>
    `).join('');
  };

  // 초기 렌더링
  renderShopWalletHistory();

  // 필터 버튼 이벤트
  document.getElementById('shopWalletFilterBtns')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.wallet-filter-btn');
    if (!btn) return;
    document.querySelectorAll('#shopWalletFilterBtns .wallet-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _shopWalletFilter = btn.dataset.filter;
    renderShopWalletHistory();
  });

  // 4. 알림 토글 동기화
  const chkFood = document.getElementById('notiFood');
  const chkShip = document.getElementById('notiShip');
  const chkMark = document.getElementById('notiMark');

  if (chkFood) chkFood.checked = profile.noti_food_truck;
  if (chkShip) chkShip.checked = profile.noti_shipping;
  if (chkMark) chkMark.checked = profile.noti_marketing;

  const updateNoti = async (key, val) => {
    await window.ShopDB.updateProfile(profile.id, { [key]: val });
    window.FS.Toast.show({ title: '알림', msg: '알림 설정이 저장되었습니다.', type: 'success' });
  };
  if (chkFood) chkFood.addEventListener('change', e => updateNoti('noti_food_truck', e.target.checked));
  if (chkShip) chkShip.addEventListener('change', e => updateNoti('noti_shipping', e.target.checked));
  if (chkMark) chkMark.addEventListener('change', e => updateNoti('noti_marketing', e.target.checked));

  // 5. 아바타 업로드 (Base64 변환)
  const avatarUpload = document.getElementById('avatarUpload');
  const avatarContainer = document.getElementById('avatarContainer');
  const avatarOverlay = document.querySelector('.avatar-overlay');
  const btnDeleteAvatar = document.getElementById('btnDeleteAvatar');

  avatarContainer.addEventListener('mouseenter', () => {
    if (hasAvatar) {
      btnDeleteAvatar.style.display = 'flex';
      avatarOverlay.style.display = 'none';
    } else {
      btnDeleteAvatar.style.display = 'none';
      avatarOverlay.style.display = 'flex';
    }
  });
  avatarContainer.addEventListener('mouseleave', () => {
    avatarOverlay.style.display = 'none';
    btnDeleteAvatar.style.display = 'none';
  });
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
      btnDeleteAvatar.style.display = 'flex';

      // DB 업데이트
      await window.ShopDB.updateProfile(profile.id, { avatar_url: base64Str });
      hasAvatar = true;
      Toast.show({ title: '알림', msg: '프로필 사진이 변경되었습니다.', type: 'success' });
      // 헤더 아바타 동기화 (실시간 반영)
      const hdrAvatar = document.getElementById('hdrAvatar');
      if (hdrAvatar) hdrAvatar.src = base64Str;
    };
    reader.readAsDataURL(file);
  });

  // 아바타 삭제 버튼 로직
  btnDeleteAvatar.addEventListener('click', async (e) => {
    e.stopPropagation(); // 컨테이너 클릭 이벤트 방지
    document.getElementById('mypageAvatar').style.display = 'none';
    document.getElementById('avatarFallback').style.display = 'block';
    btnDeleteAvatar.style.display = 'none';
    document.getElementById('mypageAvatar').src = '';

    await window.ShopDB.updateProfile(profile.id, { avatar_url: null });
    hasAvatar = false;
    Toast.show({ title: '알림', msg: '프로필 사진이 삭제되었습니다.', type: 'success' });

    // 즉시 헤더 롤백 (SVG)
    const hdrAvatar = document.getElementById('hdrAvatar');
    if (hdrAvatar) {
      hdrAvatar.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%23ccc" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    }
  });

  // 6. FESTIO Pay 충전 (PortOne 연동 모달)
  const btnCharge = document.getElementById('btnChargePay');
  const chargeModal = document.getElementById('chargeModal');
  const btnChargeClose = document.getElementById('btnChargeClose');
  const quickChargeBtns = document.querySelectorAll('.shop-quick-charge-btn');
  const chargeInput = document.getElementById('shopWalletChargeInput');
  const btnChargeConfirm = document.getElementById('btnShopWalletChargeConfirm');

  if (btnCharge && chargeModal) {
    btnCharge.addEventListener('click', () => {
      chargeInput.value = '';
      chargeModal.style.display = 'flex';
      setTimeout(() => chargeModal.style.opacity = '1', 10);
    });

    const closeModal = () => {
      chargeModal.style.opacity = '0';
      setTimeout(() => chargeModal.style.display = 'none', 300);
    };

    btnChargeClose.addEventListener('click', closeModal);
    chargeModal.addEventListener('click', (e) => {
      if (e.target === chargeModal) closeModal();
    });

    // 콤마 자동 입력 이벤트
    if (chargeInput) {
      chargeInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val) {
          e.target.value = parseInt(val).toLocaleString();
        } else {
          e.target.value = '';
        }
      });
    }

    const processCharge = (amountStr) => {
      const chargeAmt = parseInt(amountStr.replace(/,/g, ''));
      if (isNaN(chargeAmt) || chargeAmt < 1000) {
        Toast.show({ title: '오류', msg: '1,000원 이상 결제 가능합니다.', type: 'warning' });
        return;
      }

      if (!window.IMP) {
        Toast.show({ title: '오류', msg: '결제 모듈이 로드되지 않았습니다.', type: 'error' });
        return;
      }
      IMP.init('imp81384776');
      const orderUid = 'shop-wallet-' + Date.now();

      IMP.request_pay({
        pg: 'html5_inicis.INIpayTest',
        pay_method: 'card',
        merchant_uid: orderUid,
        name: `FESTIO Pay 충전 ${chargeAmt.toLocaleString()}원`,
        amount: chargeAmt,
        buyer_email: profile.user_email,
        buyer_name: profile.user_name
      }, async (rsp) => {
        if (rsp.success) {
          try {
            const newBalance = (profile.festio_pay_points || 0) + chargeAmt;
            await window.ShopDB.updateProfile(profile.id, { festio_pay_points: newBalance });
            profile.festio_pay_points = newBalance;
            currentBalance = newBalance;
            
            Toast.show({ title: '충전 완료', msg: `FESTIO Pay ${chargeAmt.toLocaleString()}원이 충전되었습니다.`, type: 'success' });
            document.getElementById('mpPoints').textContent = newBalance.toLocaleString();

            // 거래 내역 배열에 추가
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
            _shopWalletHistory.unshift({ type: 'charge', desc: '카드 충전', amount: chargeAmt, date: dateStr });
            localStorage.setItem('shopWalletHistory_' + email, JSON.stringify(_shopWalletHistory));
            renderShopWalletHistory();

            closeModal();
          } catch (err) {
            console.error(err);
            Toast.show({ title: '오류', msg: 'DB 충전 처리 중 오류가 발생했습니다.', type: 'error' });
          }
        } else {
          Toast.show({ title: '결제 취소', msg: rsp.error_msg || '결제가 취소되었습니다.', type: 'warning' });
        }
      });
    };

    quickChargeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        processCharge(btn.dataset.amount);
      });
    });

    btnChargeConfirm.addEventListener('click', () => {
      if (!chargeInput.value) {
        Toast.show({ title: '오류', msg: '충전할 금액을 입력해주세요.', type: 'warning' });
        return;
      }
      processCharge(chargeInput.value);
    });
  }

  // 8. 인라인 폼 (수정하기 / 탈퇴) 로직
  const btnEditProfile = document.getElementById('btnEditProfile');
  const inlineEditForm = document.getElementById('inlineEditForm');
  const btnEditCancel = document.getElementById('btnEditCancel');
  const btnEditSave = document.getElementById('btnEditSave');
  const btnWithdraw = document.getElementById('btnWithdraw');

  // 커스텀 모달
  const withdrawModal = document.getElementById('withdrawModal');
  const btnWithdrawCancel = document.getElementById('btnWithdrawCancel');
  const btnWithdrawConfirm = document.getElementById('btnWithdrawConfirm');

  if (btnEditProfile) {
    btnEditProfile.addEventListener('click', () => {
      const isHidden = inlineEditForm.style.display === 'none';
      inlineEditForm.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (btnEditCancel) {
    btnEditCancel.addEventListener('click', () => {
      inlineEditForm.style.display = 'none';
    });
  }

  if (btnEditSave) {
    btnEditSave.addEventListener('click', () => {
      const p1 = document.getElementById('editPwd').value;
      const p2 = document.getElementById('editPwdConfirm').value;
      if (p1 || p2) {
        if (p1 !== p2) {
          Toast.show({ title: '오류', msg: '비밀번호가 일치하지 않습니다.', type: 'warning' });
          return;
        }
      }
      Toast.show({ title: '완료', msg: '회원 정보가 성공적으로 수정되었습니다.', type: 'success' });
      inlineEditForm.style.display = 'none';
    });
  }

  if (btnWithdraw && withdrawModal) {
    // 팝업 열기
    btnWithdraw.addEventListener('click', (e) => {
      e.preventDefault();
      withdrawModal.style.display = 'flex';
      setTimeout(() => withdrawModal.style.opacity = '1', 10);
      document.getElementById('withdrawModalContent').style.transform = 'translateY(0)';
    });

    // 취소 닫기
    btnWithdrawCancel.addEventListener('click', () => {
      withdrawModal.style.opacity = '0';
      document.getElementById('withdrawModalContent').style.transform = 'translateY(20px)';
      setTimeout(() => withdrawModal.style.display = 'none', 300);
    });

    // 탈퇴 승인
    btnWithdrawConfirm.addEventListener('click', async () => {
      withdrawModal.style.opacity = '0';
      setTimeout(() => withdrawModal.style.display = 'none', 300);

      Toast.show({ title: '완료', msg: '회원 탈퇴 처리되었습니다.', type: 'success' });
      // 탈퇴 시 사용자 프로필 삭제
      await window.ShopDB.getClient().from('shop_profiles').delete().eq('id', profile.id);

      setTimeout(() => {
        Session.logout();
        location.href = 'index.html';
      }, 1500);
    });
  }

});
