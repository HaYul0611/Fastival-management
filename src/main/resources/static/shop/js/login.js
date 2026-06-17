'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const { Session, Toast } = window.FS;
  if (Session.isLoggedIn()) { location.href = 'shop.html'; return }

  /* 슬라이더 초기화 */
  if (typeof Swiper !== 'undefined') {
    new Swiper('.login-swiper', {
      loop: true,
      autoplay: { delay: 3000, disableOnInteraction: false },
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: 1000,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      }
    });
  }

  /* 탭 */
  const tabL = document.getElementById('tabL'), tabR = document.getElementById('tabR');
  const paneL = document.getElementById('paneL'), paneR = document.getElementById('paneR');
  function sw(login) {
    tabL.classList.toggle('on', login); tabR.classList.toggle('on', !login);
    tabL.setAttribute('aria-selected', login); tabR.setAttribute('aria-selected', !login);
    paneL.classList.toggle('on', login); paneR.classList.toggle('on', !login);
    paneL.hidden = !login; paneR.hidden = login;
  }
  tabL.addEventListener('click', () => sw(true));
  tabR.addEventListener('click', () => sw(false));

  /* 로그인 */
  async function doLogin() {
    const email = document.getElementById('lEmail').value.trim();
    const pw = document.getElementById('lPw').value;
    const err = document.getElementById('lErr'); err.textContent = '';
    if (!email || !pw) { err.textContent = '이메일과 비밀번호를 입력해주세요.'; return }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pw })
      });
      if (response.ok) {
        const result = await response.json();
        localStorage.setItem('userToken', result.token);
        localStorage.setItem('userName', result.userName || '유저');
        localStorage.setItem('email', result.email);
        localStorage.setItem('isLoggedIn', 'true');

        Toast.show({ title: '로그인 성공', msg: '쇼핑을 시작하세요!', type: 'success' });
        setTimeout(() => location.href = 'shop.html', 500);
      } else {
        const errText = await response.text();
        err.textContent = errText || '로그인에 실패했습니다.';
      }
    } catch (error) {
      err.textContent = '로그인 처리 중 오류가 발생했습니다.';
    }
  }
  document.getElementById('btnLSubmit').addEventListener('click', doLogin);
  document.getElementById('lPw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() });

  /* 소셜 */
  document.getElementById('btnKakao').addEventListener('click', () => Toast.show({ title: '준비 중', msg: 'FESTIO 카카오 로그인 연동 예정', type: 'info' }));
  document.getElementById('btnNaver').addEventListener('click', () => Toast.show({ title: '준비 중', msg: 'FESTIO 네이버 로그인 연동 예정', type: 'info' }));
  document.getElementById('btnGoogle').addEventListener('click', () => Toast.show({ title: '준비 중', msg: 'FESTIO 구글 로그인 연동 예정', type: 'info' }));
  document.getElementById('btnToss').addEventListener('click', () => Toast.show({ title: '준비 중', msg: 'FESTIO 토스 로그인 연동 예정', type: 'info' }));
  /* 전체동의 */
  const agAll = document.getElementById('agreeAll');
  const tcs = document.querySelectorAll('.tc');
  agAll.addEventListener('change', () => tcs.forEach(c => c.checked = agAll.checked));
  tcs.forEach(c => c.addEventListener('change', () => agAll.checked = [...tcs].every(x => x.checked)));

  /* 이메일 인증 */
  let isEmailVerified = false;
  const btnEmailCode = document.getElementById('btnEmailCode');
  const btnEmailVerify = document.getElementById('btnEmailVerify');
  const emailVerifyBlock = document.getElementById('emailVerifyBlock');

  if (btnEmailCode) {
    btnEmailCode.addEventListener('click', async () => {
      const email = document.getElementById('rEmail').value.trim();
      if (!email) { Toast.show({ title: '알림', msg: '이메일을 입력해주세요.', type: 'warning' }); return; }

      try {
        const response = await fetch('/api/auth/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        if (response.ok) {
          Toast.show({ title: '인증요청', msg: '인증번호가 발송되었습니다.', type: 'info' });
          emailVerifyBlock.style.display = 'flex';
        } else {
          const res = await response.json();
          Toast.show({ title: '오류', msg: res.message || '인증번호 발송 실패', type: 'error' });
        }
      } catch (e) {
        Toast.show({ title: '오류', msg: '서버 연동 오류', type: 'error' });
      }
    });
  }

  if (btnEmailVerify) {
    btnEmailVerify.addEventListener('click', async () => {
      const email = document.getElementById('rEmail').value.trim();
      const code = document.getElementById('rEmailCode').value.trim();
      if (!code) { Toast.show({ title: '알림', msg: '인증번호를 입력해주세요.', type: 'warning' }); return; }

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, code: code })
        });
        if (response.ok) {
          isEmailVerified = true;
          document.getElementById('rEmail').readOnly = true;
          document.getElementById('rEmailCode').readOnly = true;
          btnEmailVerify.textContent = '인증완료';
          btnEmailVerify.disabled = true;
          btnEmailVerify.style.background = '#10B981';
          Toast.show({ title: '인증성공', msg: '이메일 인증이 완료되었습니다.', type: 'success' });
        } else {
          const res = await response.json();
          Toast.show({ title: '오류', msg: res.message || '인증번호가 일치하지 않습니다.', type: 'error' });
        }
      } catch (e) {
        Toast.show({ title: '오류', msg: '서버 연동 오류', type: 'error' });
      }
    });
  }

  /* 휴대폰 번호 자동 하이픈 */
  const rPhone = document.getElementById('rPhone');
  if (rPhone) {
    rPhone.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 3 && val.length <= 7) {
        val = val.replace(/(\d{3})(\d+)/, '$1-$2');
      } else if (val.length > 7) {
        val = val.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3');
      }
      e.target.value = val;
    });
  }

  /* 비밀번호 표시/숨김 토글 */
  document.querySelectorAll('.btn-pw-toggle').forEach(btn => {
    btn.addEventListener('click', function () {
      const input = this.previousElementSibling;
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      // 활성화 시 아이콘 색상 변경 효과 (선택사항)
      this.style.color = type === 'text' ? '#FF2D55' : '#9ca3af';
    });
  });

  /* 비밀번호 강도 게이지 */
  const rPw = document.getElementById('rPw');
  const strengthContainer = document.querySelector('.pw-strength-container');
  const strengthText = document.querySelector('.pw-strength-text');
  const fills = document.querySelectorAll('.pw-strength-fill');

  if (rPw && strengthContainer) {
    rPw.addEventListener('input', function () {
      const val = this.value;
      if (!val) {
        strengthContainer.style.display = 'none';
        return;
      }
      strengthContainer.style.display = 'block';
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Za-z]/.test(val) && /[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      fills.forEach(f => f.style.background = 'transparent');
      if (score === 0 || score === 1) {
        fills[0].style.background = '#FF2D55';
        strengthText.textContent = '약함';
        strengthText.style.color = '#FF2D55';
      } else if (score === 2) {
        fills[0].style.background = '#F59E0B';
        fills[1].style.background = '#F59E0B';
        strengthText.textContent = '보통';
        strengthText.style.color = '#F59E0B';
      } else if (score >= 3) {
        fills[0].style.background = '#10B981';
        fills[1].style.background = '#10B981';
        fills[2].style.background = '#10B981';
        strengthText.textContent = '안전';
        strengthText.style.color = '#10B981';
      }
    });
  }

  /* 회원가입 */
  document.getElementById('btnRSubmit').addEventListener('click', async () => {
    const name = document.getElementById('rName').value.trim();
    const email = document.getElementById('rEmail').value.trim();
    const pw = document.getElementById('rPw').value;
    const pwc = document.getElementById('rPwC').value;
    const phone = document.getElementById('rPhone').value.trim();
    const svc = document.getElementById('agSvc').checked;
    const prv = document.getElementById('agPrv').checked;
    const err = document.getElementById('rErr'); err.textContent = '';
    if (!name || !email || !pw) { err.textContent = '모든 필수 항목을 입력해주세요.'; return }
    if (!isEmailVerified) {
      Toast.show({ title: '알림', msg: '이메일 인증을 완료해주세요.', type: 'warning' });
      return;
    }
    if (pw !== pwc) { err.textContent = '비밀번호가 일치하지 않습니다.'; return }
    if (pw.length < 8) { err.textContent = '비밀번호는 8자 이상이어야 합니다.'; return }
    if (!svc || !prv) {
      Toast.show({ title: '알림', msg: '필수 약관에 동의해주세요.', type: 'warning' });
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pw, name: name, phone: phone || '010-0000-0000', gender: 'U' })
      });
      if (response.ok) {
        Toast.show({ title: '회원가입 완료', msg: '로그인하세요!', type: 'success' });
        sw(true);
      } else {
        const result = await response.json();
        err.textContent = result.message || '회원가입에 실패했습니다.';
      }
    } catch (error) {
      err.textContent = '회원가입 처리 중 오류가 발생했습니다.';
    }
  });
});
