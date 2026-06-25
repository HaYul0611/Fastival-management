/* ============================================================
   Festival O2O — find-account.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // --- 탭 메뉴 로직 ---
  const tabFindId = document.getElementById('tabFindId');
  const tabFindPw = document.getElementById('tabFindPw');
  const panelFindId = document.getElementById('panelFindId');
  const panelFindPw = document.getElementById('panelFindPw');

  function switchTab(showId) {
    if (showId) {
      tabFindId.classList.add('active');
      tabFindId.setAttribute('aria-selected', 'true');
      tabFindPw.classList.remove('active');
      tabFindPw.setAttribute('aria-selected', 'false');

      panelFindId.classList.add('active');
      panelFindPw.classList.remove('active');
    } else {
      tabFindPw.classList.add('active');
      tabFindPw.setAttribute('aria-selected', 'true');
      tabFindId.classList.remove('active');
      tabFindId.setAttribute('aria-selected', 'false');

      panelFindPw.classList.add('active');
      panelFindId.classList.remove('active');
    }
  }

  if (tabFindId && tabFindPw) {
    tabFindId.addEventListener('click', () => switchTab(true));
    tabFindPw.addEventListener('click', () => switchTab(false));
  }

  // --- 공통 타이머 로직 ---
  function startTimer(timerElement, statusElement, onExpire) {
    let seconds = 180;
    timerElement.textContent = '03:00';

    const interval = setInterval(() => {
      seconds--;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timerElement.textContent = `${m}:${s}`;

      if (seconds <= 0) {
        clearInterval(interval);
        if (onExpire) onExpire();
        statusElement.innerHTML = '<span class="auth-error">인증 시간이 초과되었습니다. 다시 시도해주세요.</span>';
      }
    }, 1000);

    return interval;
  }

  function showError(msg) {
    if (window.Toast) window.Toast.error(msg);
    else alert(msg);
  }

  function showSuccess(msg) {
    if (window.Toast) window.Toast.success(msg);
    else alert(msg);
  }

  // --- 아이디 찾기 로직 ---
  const findIdForm = document.getElementById('findIdForm');
  const resultIdSection = document.getElementById('resultIdSection');
  const notFoundModal = document.getElementById('notFoundModal');
  const btnCancelNotFound = document.getElementById('btnCancelNotFound');
  const findIdPhoneInput = document.getElementById('findIdPhone');

  // 휴대폰 번호 자동 하이픈 추가
  if (findIdPhoneInput) {
    findIdPhoneInput.addEventListener('input', function (e) {
      let val = this.value.replace(/[^0-9]/g, '');
      let res = '';
      if (val.length < 4) {
        res = val;
      } else if (val.length < 7) {
        res = val.substr(0, 3) + '-' + val.substr(3);
      } else if (val.length < 11) {
        res = val.substr(0, 3) + '-' + val.substr(3, 3) + '-' + val.substr(6);
      } else {
        res = val.substr(0, 3) + '-' + val.substr(3, 4) + '-' + val.substr(7);
      }
      this.value = res;
    });
  }

  if (btnCancelNotFound) {
    btnCancelNotFound.addEventListener('click', () => {
      notFoundModal.style.display = 'none';
    });
  }

  function maskEmail(email) {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const local = parts[0];
    const domain = parts[1];
    if (local.length <= 3) {
      return local.charAt(0) + '***@' + domain;
    }
    return local.substring(0, 3) + '***@' + domain;
  }

  if (findIdForm) {
    findIdForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('findIdName').value.trim();
      const phone = document.getElementById('findIdPhone').value.trim();

      if (!name || !phone) {
        showError('이름과 휴대폰 번호를 모두 입력해주세요.');
        return;
      }

      // 임시 데모 로직: 번호가 0000으로 끝나면 가입내역 없음 처리
      if (phone.endsWith('0000')) {
        notFoundModal.style.display = 'flex';
        return;
      }

      // 결과 표시 처리
      try {
        await new Promise(r => setTimeout(r, 500));
        findIdForm.classList.add('hidden');
        resultIdSection.classList.remove('hidden');

        // 예시 이메일 마스킹
        const dummyEmail = 'example@festio.com';
        document.getElementById('foundIdValue').textContent = maskEmail(dummyEmail);
      } catch (err) {
        showError('아이디 찾기 중 오류가 발생했습니다.');
      }
    });
  }

  // --- 비밀번호 찾기 로직 ---
  const findPwForm = document.getElementById('findPwForm');
  const btnSendPwCode = document.getElementById('btnSendPwCode');
  const authPwSection = document.getElementById('authPwSection');
  const btnConfirmPwCode = document.getElementById('btnConfirmPwCode');
  const authPwCode = document.getElementById('authPwCode');
  const authPwTimer = document.getElementById('authPwTimer');
  const authPwStatus = document.getElementById('authPwStatus');
  const btnSubmitFindPw = document.getElementById('btnSubmitFindPw');
  const resultPwSection = document.getElementById('resultPwSection');

  let pwTimerInterval = null;
  let isPwEmailVerified = false;

  if (btnSendPwCode) {
    btnSendPwCode.addEventListener('click', async () => {
      const name = document.getElementById('findPwName').value.trim();
      const email = document.getElementById('findPwEmail').value.trim();

      if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('이름과 올바른 아이디(이메일)를 입력해주세요.');
        return;
      }

      btnSendPwCode.disabled = true;
      btnSendPwCode.textContent = '발송 중...';

      try {
        await new Promise(r => setTimeout(r, 1000));

        authPwSection.classList.remove('hidden');
        authPwStatus.innerHTML = '<span class="auth-success">인증번호가 발송되었습니다.</span>';
        btnSendPwCode.textContent = '재발송';
        btnSendPwCode.disabled = false;

        clearInterval(pwTimerInterval);
        btnConfirmPwCode.disabled = false;
        pwTimerInterval = startTimer(authPwTimer, authPwStatus, () => {
          btnConfirmPwCode.disabled = true;
        });
      } catch (err) {
        showError('발송 실패');
        btnSendPwCode.disabled = false;
        btnSendPwCode.textContent = '인증번호 발송';
      }
    });
  }

  if (btnConfirmPwCode) {
    btnConfirmPwCode.addEventListener('click', async () => {
      if (authPwCode.value.length !== 6) {
        showError('인증번호 6자리를 입력해주세요.');
        return;
      }

      try {
        await new Promise(r => setTimeout(r, 500));
        clearInterval(pwTimerInterval);
        isPwEmailVerified = true;
        authPwTimer.textContent = '';
        btnConfirmPwCode.disabled = true;
        btnConfirmPwCode.textContent = '인증완료';
        authPwCode.readOnly = true;
        authPwStatus.innerHTML = '<span class="auth-success">이메일 인증이 완료되었습니다.</span>';
        btnSubmitFindPw.disabled = false;
      } catch (err) {
        showError('잘못된 인증번호입니다.');
      }
    });
  }

  if (findPwForm) {
    findPwForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!isPwEmailVerified) {
        showError('이메일 인증을 완료해주세요.');
        return;
      }

      // 결과 표시 처리
      try {
        await new Promise(r => setTimeout(r, 500));
        findPwForm.classList.add('hidden');
        resultPwSection.classList.remove('hidden');
      } catch (err) {
        showError('오류가 발생했습니다.');
      }
    });
  }

  const btnResetPwSubmit = document.getElementById('btnResetPwSubmit');
  if (btnResetPwSubmit) {
    btnResetPwSubmit.addEventListener('click', () => {
      const pw = document.getElementById('resetPassword').value;
      const pwConfirm = document.getElementById('resetPasswordConfirm').value;
      if (!pw || pw.length < 8) {
        showError('비밀번호는 8자리 이상 입력해주세요.');
        return;
      }
      if (pw !== pwConfirm) {
        showError('비밀번호가 일치하지 않습니다.');
        return;
      }
      showSuccess('비밀번호 변경이 완료되었습니다. 로그인해주세요.');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
    });
  }

});
