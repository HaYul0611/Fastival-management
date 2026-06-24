/**
 * @file appHeader.js
 * @description 전역 상단 헤더(Header) 컴포넌트입니다.
 * 현재 접속 중인 페이지의 URL을 분석하여, 해당 페이지 성격(홈, 상세, 일반 서브)에 맞는
 * 최적화된 헤더 레이아웃을 동적으로 렌더링합니다.
 */
(function () {
  // 1. 현재 접속한 페이지 URL 경로 확인
  const path = window.location.pathname;
  const isIndex = path.endsWith('index.html') || path.endsWith('/');
  const isDetail = path.endsWith('detail.html');
  const isMypage = path.endsWith('mypage.html');

  // 2. 공통으로 사용되는 UI 아이콘(SVG) 정의
  const hamburgerSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  const backSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  const searchSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
  const alarmSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;
  const mypageSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const logoutSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
  const ticketSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h6"/><path d="M14 4h6v6"/><path d="M10 14L20 4"/></svg>`;
  const wishSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
  const shareSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

  // 3. 데스크톱용 카테고리 네비게이션 마크업
  // (모든 페이지의 일반적인 헤더와 홈 화면 헤더에서 공통적으로 사용)
  const catNavHtml = `
    <nav class="header-cat-nav" aria-label="주요 카테고리">
      <button class="header-cat-item" data-cat="concert">콘서트<svg class="icon cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="cat-dropdown"><a class="cat-dropdown-item" data-cat="concert" data-sub="all"><span>전체보기</span></a><a class="cat-dropdown-item" data-cat="concert" data-sub="domestic"><span>국내뮤지션</span></a><a class="cat-dropdown-item" data-cat="concert" data-sub="overseas"><span>해외뮤지션</span></a><a class="cat-dropdown-item" data-cat="concert" data-sub="festival"><span>페스티벌</span></a></div>
      </button>
      <button class="header-cat-item" data-cat="musical">뮤지컬</button>
      <button class="header-cat-item" data-cat="play">연극</button>
      <button class="header-cat-item" data-cat="classic">클래식/무용<svg class="icon cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="cat-dropdown"><a class="cat-dropdown-item" data-cat="classic" data-sub="all"><span>전체보기</span></a><a class="cat-dropdown-item" data-cat="classic" data-sub="classic"><span>클래식</span></a><a class="cat-dropdown-item" data-cat="classic" data-sub="ballet"><span>발레/무용</span></a><a class="cat-dropdown-item" data-cat="classic" data-sub="gukak"><span>국악</span></a></div>
      </button>
      <button class="header-cat-item" data-cat="exhibition">전시/스포츠<svg class="icon cat-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        <div class="cat-dropdown"><a class="cat-dropdown-item" data-cat="exhibition" data-sub="all"><span>전체보기</span></a><a class="cat-dropdown-item" data-cat="exhibition" data-sub="exhibition"><span>전시</span></a><a class="cat-dropdown-item" data-cat="exhibition" data-sub="experience"><span>체험/행사</span></a><a class="cat-dropdown-item" data-cat="exhibition" data-sub="sports"><span>스포츠</span></a></div>
      </button>
      <button class="header-cat-item" data-cat="family">가족/어린이</button>
      <button class="header-cat-item" data-cat="local">지역축제</button>
      <button class="header-cat-item" data-cat="univ">대학축제</button>
      <button class="header-cat-item" data-cat="expo">박람회</button>
    </nav>
  `;

  let headerHtml = '';

  // 4. 로그인 및 권한 상태 확인, 세션 만료 처리 (2시간)
  const EXPIRY_TIME_MS = 2 * 60 * 60 * 1000;
  const loginTimestamp = localStorage.getItem('loginTimestamp') || sessionStorage.getItem('loginTimestamp');
  if (loginTimestamp) {
    if (new Date().getTime() - parseInt(loginTimestamp) > EXPIRY_TIME_MS) {
      ['isLoggedIn', 'userToken', 'userRole', 'userName', 'email', 'userPhone', 'userSpecificRole', 'loginTimestamp', 'savedEmail'].forEach(k => {
        if (k !== 'savedEmail') { // savedEmail(기억하기)는 예외
          localStorage.removeItem(k);
        }
        sessionStorage.removeItem(k);
      });
      if (!path.endsWith('login.html')) {
        alert('일정 시간이 지나 로그아웃 되었습니다. 다시 로그인 해주세요.');
        // Festio와 shop 모두 작동하도록 상대경로 또는 올바른 절대경로 처리
        if (path.includes('/shop/')) {
          window.location.href = '/shop/login.html';
        } else {
          window.location.href = '/Festio/login.html';
        }
        return;
      }
    }
  }

  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true' || !!localStorage.getItem('userToken') || !!sessionStorage.getItem('userToken');
  const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'CLIENT';

  // 5. 권한별 모드 전환 버튼 생성 (ADMIN / STAFF 만 렌더링)
  const adminModeBtnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`;
  const staffModeBtnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

  let modeSwitchBtnHtml = '';
  if (isLoggedIn && userRole === 'ADMIN') {
    modeSwitchBtnHtml = `
      <a href="/features/user/admin/dashboard.html" id="modeSwitchBtn" class="header-mode-switch-btn header-mode-switch-admin" aria-label="관리자 모드로 전환">
        ${adminModeBtnSvg}
        <span class="mode-btn-label">관리자 모드</span>
      </a>`;
  } else if (isLoggedIn && userRole === 'STAFF') {
    const userSpecificRole = localStorage.getItem('userSpecificRole') || sessionStorage.getItem('userSpecificRole');

    if (userSpecificRole === 'ROLE_GATE_STAFF') {
      modeSwitchBtnHtml = `
      <a href="/html/staff-scan.html" id="modeSwitchBtn" class="header-mode-switch-btn header-mode-switch-gate" aria-label="게이트 모드로 전환">
        ${staffModeBtnSvg}
        <span class="mode-btn-label">게이트 모드</span>
      </a>`;
    } else {
      const targetUrl = '/features/user/staff/staffindex.html'; // 스태프 통합 시스템
      modeSwitchBtnHtml = `
      <a href="${targetUrl}" id="modeSwitchBtn" class="header-mode-switch-btn header-mode-switch-staff" aria-label="업주 모드로 전환">
        ${staffModeBtnSvg}
        <span class="mode-btn-label">업주 모드</span>
      </a>`;
    }
  }

  // 모드 전환 버튼 및 헤더 반응형 CSS 인라인 주입 (별도 CSS 파일 불필요)
  if (!document.getElementById('mode-switch-styles')) {
    const style = document.createElement('style');
    style.id = 'mode-switch-styles';
    style.textContent = `
      .header-mode-switch-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 13px;
        border-radius: 20px;
        font-weight: 600;
        font-size: 12.5px;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
        line-height: 1;
      }
      .header-mode-switch-admin {
        background: rgba(255, 42, 122, 0.12);
        color: #FF2A7A;
        border: 1.5px solid rgba(255, 42, 122, 0.35);
      }
      .header-mode-switch-admin:hover {
        background: rgba(255, 42, 122, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(255,42,122,0.2);
      }
      .header-mode-switch-staff {
        background: rgba(42, 193, 188, 0.12);
        color: #2ac1bc;
        border: 1.5px solid rgba(42, 193, 188, 0.35);
      }
      .header-mode-switch-staff:hover {
        background: rgba(42, 193, 188, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(42,193,188,0.2);
      }
      .header-mode-switch-gate {
        background: rgba(139, 92, 246, 0.12);
        color: #8b5cf6;
        border: 1.5px solid rgba(139, 92, 246, 0.35);
      }
      .header-mode-switch-gate:hover {
        background: rgba(139, 92, 246, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 3px 10px rgba(139,92,246,0.2);
      }
      @media (max-width: 768px) {
        .mode-btn-label { display: none; }
        .header-mode-switch-btn { padding: 8px; border-radius: 50%; }
        .desktop-only { display: none !important; }
      }
      @media (min-width: 769px) {
        .mobile-only { display: none !important; }
        /* 데스크톱에서는 header-back-btn 대신 로고와 메뉴를 보여줌 */
        .header-back-btn { display: none !important; }
        /* 데스크톱에서 isDetail인 경우 햄버거 메뉴 강제 표시 */
        .header-hamburger { display: flex !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const detailHideClass = '';

  // 4-2. 통합 헤더 레이아웃 (홈, 서브 페이지, 상세 페이지 공통)
  let rightAction = '';
  if (isMypage) {
    rightAction = `<button class="header-icon-btn ${detailHideClass}" id="btn-logout" aria-label="로그아웃" title="로그아웃">${logoutSvg}</button>`;
  } else {
    const userName = localStorage.getItem('userName') || sessionStorage.getItem('userName') || '회원';
    const userBadgeSvg = `<svg viewBox="0 0 24 24" style="position:absolute; bottom:-2px; right:-2px; width:14px; height:14px; border-radius:50%; background:#fff; border: 2px solid #fff;" fill="#3b82f6"><circle cx="12" cy="12" r="12"/><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="#fff"/></svg>`;
    const savedAvatar = localStorage.getItem('festio_avatar');
    const avatarContent = savedAvatar
      ? `<img src="${savedAvatar}" alt="프로필 이미지" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px; height:20px;"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const avatarCircleHtml = `
      <div id="header-avatar-circle" style="position:relative; width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        ${avatarContent}
        ${userBadgeSvg}
      </div>
    `;

    rightAction = isLoggedIn
      ? `<a href="mypage.html" class="desktop-only" style="display:inline-flex; align-items:center; gap:10px; text-decoration:none; cursor:pointer;" aria-label="마이페이지">
           ${avatarCircleHtml}
           <div style="display:flex; flex-direction:column; justify-content:center;">
             <span style="font-size:0.85rem; color:#4b5563; letter-spacing:-0.3px; line-height:1.4;">반가워요, <b style="font-size:0.95rem; color:#111827; font-weight:700; margin:0 2px;">${userName}</b>님!</span>
             <span style="font-size:0.8rem; color:#4b5563; letter-spacing:-0.3px; line-height:1.4;">오늘 행사를 함께 즐겨볼까요?</span>
           </div>
         </a>
         <a href="mypage.html" class="header-icon-btn mobile-only ${detailHideClass}" aria-label="마이페이지">${mypageSvg}</a>`
      : `<a href="login.html" class="header-text-btn ${detailHideClass}" aria-label="로그인">로그인</a>`;
  }

  const headerClass = isIndex ? 'app-header header-home' : 'app-header';

  // 상세 페이지일 경우에만 표시할 버튼 (데스크톱에선 숨기고 싶다면 CSS 클래스 추가 가능)
  const detailExtraActions = isDetail ? `
    <button class="header-icon-btn mobile-only" id="btn-wish-detail" data-wished="false" aria-label="찜">${wishSvg}</button>
    <button class="header-icon-btn mobile-only" aria-label="공유">${shareSvg}</button>
  ` : '';

  const detailBackBtn = '';

  headerHtml = `
    <header class="${headerClass}" role="banner" id="appHeader">
      <button class="header-hamburger" id="hamburgerBtn" aria-label="전체 메뉴 열기" aria-expanded="false">${hamburgerSvg}</button>
      ${detailBackBtn}
      <a href="index.html" class="header-logo" aria-label="FESTIO 홈"><span class="header-logo-text">FESTIO</span></a>
      ${catNavHtml}
      <div class="header-spacer"></div>
      <div class="header-actions">
        ${modeSwitchBtnHtml}
        ${detailExtraActions}
        <a href="mypage.html" class="header-text-btn ${detailHideClass}" aria-label="MY티켓">${ticketSvg}MY티켓</a>
        <div class="header-search-bar ${detailHideClass}" role="search">${searchSvg}<input type="search" class="header-search-input" id="headerSearch" placeholder="행사명, 아티스트 검색" autocomplete="off" aria-label="검색"></div>
        <div class="hdr-noti-menu" style="position:relative; display:inline-block;">
          <button class="header-icon-btn ${detailHideClass}" id="btnHeaderNotification" aria-label="알림" style="position:relative;">
            ${alarmSvg}
            <span id="notificationBadge" style="display:none; position:absolute; top:2px; right:2px; background:#ef4444; color:white; font-size:10px; font-weight:bold; border-radius:10px; padding:2px 5px; line-height:1; min-width:14px; text-align:center; transform:scale(0.9);">0</span>
          </button>
          <div class="noti-dropdown" id="festioNotiDropdown" style="position:absolute; top:calc(100% + 8px); right:-10px; width:340px; background:var(--bg-card, #fff); border:1px solid var(--border-color, #eee); border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.15); display:none; flex-direction:column; z-index:9999; overflow:hidden;">
            <div class="noti-head" style="padding:16px; border-bottom:1px solid var(--border-color, #eee); display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:bold; font-size:16px; color:var(--text-primary, #000);">알림 <span id="notiHeadCount" style="color:#ef4444; margin-left:4px;">0</span></span>
              <label class="noti-theme-toggle" aria-label="다크 모드 토글">
                <input type="checkbox" id="notiThemeToggle">
                <span class="noti-theme-slider">
                   <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                   <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                </span>
              </label>
            </div>
            <div class="noti-list" id="festioNotiListContainer" style="max-height:300px; overflow-y:auto; padding:0;">
              <!-- 동적 알림 로드 -->
              <div style="padding: 32px 24px; text-align: center; color: var(--text-secondary, #666);">새로운 알림이 없습니다.</div>
            </div>
            <a href="mypage.html" class="noti-foot" style="padding:14px; text-align:center; display:block; background:var(--bg-secondary, #f9fafb); font-size:14px; color:var(--text-primary, #000); text-decoration:none; border-top:1px solid var(--border-color, #eee); font-weight:600;">알림 설정 및 전체보기</a>
          </div>
        </div>
        ${rightAction}
      </div>
    </header>
  `;

  const searchModalHtml = `
  <div class="modal-overlay modal-center" id="modal-mobile-search" role="dialog" aria-modal="true">
    <div class="modal-sheet">
      <div class="modal-header search-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:18px; font-weight:bold; margin:0; color:#000;">통합 검색</h3>
        <button class="modal-close-btn" data-close-modal="modal-mobile-search" aria-label="닫기" style="color: #333; background: #f3f4f6; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="mobile-search-form" style="display: flex; gap: 10px; align-items: center;">
          <div class="mobile-search-input-wrap" style="flex: 1; display: flex; align-items: center; background: rgba(0,0,0,0.05); border-radius: 8px; padding: 0 12px;">
            <svg class="icon search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;color:#4f46e5;">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="search" class="mobile-search-input" placeholder="행사명, 아티스트명 검색" autocomplete="off" style="width: 100%; border: none; background: transparent; outline: none; padding: 12px 8px; font-size: 15px; color: #000;">
          </div>
          <button class="btn btn-primary" style="padding: 10px 16px; border-radius: 8px; font-size: 14px; white-space: nowrap;">검색</button>
        </div>
      </div>
    </div>
  </div>
  `;

  const notificationModalHtml = ``;

  // 6. 생성된 헤더 마크업을 현재 페이지의 DOM에 직접 삽입
  document.write(headerHtml + searchModalHtml + notificationModalHtml);
})();
