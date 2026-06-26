/**
 * @file bottomNav.js
 * @description 모바일 및 소형 화면에서 사용되는 하단 네비게이션(Bottom Navigation) 컴포넌트입니다.
 * 현재 접속 중인 페이지의 URL을 분석하여, 해당하는 하단 메뉴 아이템에 'active' 클래스를
 * 자동으로 부여해 활성화 상태를 표시합니다.
 */
(function () {
  // 1. 현재 접속한 페이지 URL 경로 확인 및 활성화 대상 판별
  const path = window.location.pathname;
  const isHome = path.endsWith('index.html') || path.endsWith('/');
  const isList = path.endsWith('list.html') || path.endsWith('detail.html') || path.endsWith('guide.html');
  const isMypage = path.endsWith('mypage.html');

  // 2. 공통으로 사용되는 네비게이션 아이콘(SVG) 정의
  const homeSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>`;
  const listSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>`;
  const searchSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>`;
  const wishSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>`;
  const mypageSvg = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>`;

  // 3. 하단 네비게이션 마크업 생성
  // 페이지 상태(isHome, isList, isMypage)에 따라 삼항 연산자를 사용해 'active' 클래스를 동적으로 주입합니다.
  const navHtml = `
    <nav class="bottom-nav" aria-label="하단 메뉴">
      <a href="index.html" class="bottom-nav-item ${isHome ? 'active' : ''}" aria-label="홈">
        ${homeSvg}<span>홈</span>
      </a>
      <a href="list.html" class="bottom-nav-item ${isList ? 'active' : ''}" aria-label="전체행사">
        ${listSvg}<span>전체행사</span>
      </a>
      <button class="bottom-nav-item mobile-search-btn" aria-label="검색">
        ${searchSvg}<span>검색</span>
      </button>
      <a href="mypage.html#tab-wishlist" class="bottom-nav-item ${window.location.hash === '#tab-wishlist' ? 'active' : ''}" aria-label="찜">
        ${wishSvg}<span>찜</span>
      </a>
      <a href="mypage.html" class="bottom-nav-item ${isMypage && window.location.hash !== '#tab-wishlist' ? 'active' : ''}" aria-label="마이페이지">
        ${mypageSvg}<span>마이</span>
      </a>
    </nav>
  `;

  // 4. 생성된 네비게이션 마크업을 현재 페이지의 DOM에 직접 삽입
  document.write(navHtml);
})();
