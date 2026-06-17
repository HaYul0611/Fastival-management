'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const { Session, Toast } = window.FS;
  if (Session.isLoggedIn()) { location.href = 'shop.html'; return }

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
    if (pw !== pwc) { err.textContent = '비밀번호가 일치하지 않습니다.'; return }
    if (pw.length < 8) { err.textContent = '비밀번호는 8자 이상이어야 합니다.'; return }
    if (!svc || !prv) { err.textContent = '필수 약관에 동의해주세요.'; return }

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
