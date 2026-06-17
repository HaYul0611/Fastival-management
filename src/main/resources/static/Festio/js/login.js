/* ============================================================
   Festival O2O — login.js
   로그인 유효성 검증 및 가상인증 & 추후 Spring Boot API 연동 확장성 가이드
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  // 비밀번호 눈모양 토글 기능
  const btnTogglePw = document.querySelector('.btn-toggle-pw');
  const passwordInput = document.getElementById('loginPassword');
  if (btnTogglePw && passwordInput) {
    btnTogglePw.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      btnTogglePw.style.color = type === 'text' ? '#6366f1' : '#9ca3af';
    });
  }

  // 페이지 로드 시 저장된 이메일 불러오기
  const savedEmail = localStorage.getItem('savedEmail');
  const emailInput = document.getElementById('loginEmail');
  const saveEmailCheckbox = document.getElementById('saveEmail');

  if (savedEmail && emailInput && saveEmailCheckbox) {
    emailInput.value = savedEmail;
    saveEmailCheckbox.checked = true;
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      // 1. 이메일 및 비밀번호 검증
      if (!email || !password) {
        if (window.Toast) {
          window.Toast.error('아이디와 비밀번호를 입력해주세요.');
        } else {
          alert('아이디와 비밀번호를 입력해주세요.');
        }
        return;
      }

      try {
        // 1. API 요청 데이터를 생성합니다.
        const requestData = {
          email: email,
          password: password
        };

        // 2. 백엔드 로그인 API(/api/auth/login)로 fetch 요청을 보냅니다.
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });

        // 3. API 응답 성공 여부에 따라 분기 처리합니다.
        if (response.ok) {
          const result = await response.json();

          const keepLogin = document.getElementById('keepLogin').checked;
          const storage = keepLogin ? localStorage : sessionStorage;

          const userRole = result.userRole || 'ROLE_USER';
          const isAdmin = email === 'admin@gmail.com' || userRole === 'ROLE_ADMIN' || userRole === 'ADMIN';
          const isStaff = userRole === 'ROLE_STAFF' || userRole === 'STAFF' || userRole === 'ROLE_FOOD_STAFF' || userRole === 'ROLE_GATE_STAFF' || userRole === 'ROLE_GOODS_STAFF';

          storage.setItem('userToken', result.token);
          storage.setItem('userName', result.userName || '유저');
          storage.setItem('email', result.email);
          storage.setItem('userPhone', result.phone || '');
          storage.setItem('isLoggedIn', 'true');
          storage.setItem('loginTimestamp', new Date().getTime().toString());

          if (isAdmin) {
            storage.setItem('userRole', 'ADMIN');
            storage.setItem('userSpecificRole', 'ROLE_ADMIN');
            storage.setItem('userToken', 'festio-admin-jwt-token-7777');
          } else if (isStaff) {
            storage.setItem('userRole', 'STAFF');
            storage.setItem('userSpecificRole', userRole);
          } else {
            storage.setItem('userRole', 'CLIENT');
            storage.setItem('userSpecificRole', 'ROLE_USER');
          }

          // (동기화) sessionStorage 에도 데이터 동기화 저장
          if (window.Auth) {
            window.Auth.save({
              email: result.email,
              name: result.userName || '유저',
              role: isAdmin ? 'ADMIN' : (isStaff ? 'STAFF' : 'CLIENT')
            });
          }

          // 이메일 저장 체크박스 처리
          if (saveEmailCheckbox && saveEmailCheckbox.checked) {
            localStorage.setItem('savedEmail', email);
          } else {
            localStorage.removeItem('savedEmail');
          }

          // 권한별 목적지 리다이렉트 설정 (항상 홈 화면으로 진입 후 헤더 버튼으로 모드 전환)
          let redirectUrl = '/index.html'; // ※ 반드시 절대 경로 사용 (login.html 위치 기준 상대경로 문제 방지)
          let successMsg = '로그인에 성공하였습니다!';

          if (isAdmin) {
            successMsg = '관리자 로그인 성공! 메인화면 상단의 [관리자 모드 전환] 버튼을 통해 관리 콘솔로 이동할 수 있습니다.';
          } else if (isStaff) {
            successMsg = '가맹점주(STAFF) 로그인 성공! 메인화면 상단의 [업주 모드 전환] 버튼을 통해 매장 관리 포털로 이동할 수 있습니다.';
          } else {
            successMsg = '로그인에 성공하였습니다! 축제를 마음껏 즐겨보세요.';
          }

          if (window.Toast) {
            window.Toast.success(successMsg);
          } else {
            alert(successMsg);
          }

          // 약간의 딜레이를 주어 로그인 완료 토스트/알림을 볼 수 있게 한 후 홈화면으로 리다이렉트
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1200);
        } else {
          const errText = await response.text();
          if (window.Toast) {
            window.Toast.error(errText || '로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.');
          } else {
            alert(errText || '로그인에 실패했습니다. 이메일 또는 비밀번호를 확인해주세요.');
          }
        }

      } catch (error) {
        console.error('로그인 에러:', error);
        if (window.Toast) {
          window.Toast.error('로그인 처리 중 예기치 못한 오류가 발생했습니다.');
        } else {
          alert('로그인 처리 중 예기치 못한 오류가 발생했습니다.');
        }
      }
    });
  }

  // 소셜 로그인 임시 연동 (네이버, 카카오, 구글, 토스)
  const socialButtons = document.querySelectorAll('.btn-social');
  socialButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      let providerName = '';
      if (btn.classList.contains('btn-naver')) providerName = '네이버';
      else if (btn.classList.contains('btn-kakao')) providerName = '카카오';
      else if (btn.classList.contains('btn-google')) providerName = '구글';
      else if (btn.classList.contains('btn-toss')) providerName = '토스';
      else providerName = '소셜';

      if (window.Toast) {
        window.Toast.success(`${providerName} 계정으로 임시 로그인합니다.`);
      } else {
        alert(`${providerName} 계정으로 임시 로그인합니다.`);
      }

      // 임시 로그인 세션 설정
      const keepLogin = document.getElementById('keepLogin') && document.getElementById('keepLogin').checked;
      const storage = keepLogin ? localStorage : sessionStorage;

      storage.setItem('userToken', `temp-${providerName}-token-12345`);
      storage.setItem('isLoggedIn', 'true');
      storage.setItem('userName', `${providerName} 유저`);
      storage.setItem('userRole', 'CLIENT');
      storage.setItem('email', `user@${providerName}.com`);
      storage.setItem('userPhone', '010-1234-5678');
      storage.setItem('loginTimestamp', new Date().getTime().toString());

      if (window.Auth) {
        window.Auth.save({
          email: `user@${providerName}.com`,
          name: `${providerName} 유저`,
          role: 'CLIENT'
        });
      }

      // 잠시 후 메인 화면으로 이동
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);
    });
  });
});
