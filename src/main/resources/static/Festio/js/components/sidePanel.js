/**
 * @file sidePanel.js
 * @description 모든 페이지에서 공통으로 사용되는 좌측/우측 햄버거 메뉴(Side Panel) 마크업을 동적으로 삽입하는 컴포넌트입니다.
 * 하드코딩된 HTML 중복을 제거하기 위해 자바스크립트를 통해 DOM에 렌더링됩니다.
 */
const SIDE_PANEL_HTML = `
  <!-- ══ 사이드 오버레이 ═══════════════════════════════════════ -->
  <div class="side-overlay" id="sideOverlay" aria-hidden="true"></div>

  <!-- ══ 사이드 패널 ═══════════════════════════════════════════ -->
  <nav class="side-panel" id="sidePanel" aria-label="전체 메뉴">
    <div class="side-panel-header">
      <a href="index.html" class="side-panel-logo">FESTIO</a>
      <button class="side-close-btn" id="sideClose" aria-label="메뉴 닫기">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <!-- 카테고리 섹션 -->
    <div class="side-section">
      <!-- 콘서트 -->
      <button class="side-cat-item" data-submenu="sub-concert" data-cat="concert">
        콘서트
        <svg class="icon side-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="side-submenu" id="sub-concert">
        <button class="side-subitem" data-cat="concert" data-sub="all">전체보기</button>
        <button class="side-subitem" data-cat="concert" data-sub="domestic">국내뮤지션</button>
        <button class="side-subitem" data-cat="concert" data-sub="overseas">해외뮤지션</button>
        <button class="side-subitem" data-cat="concert" data-sub="festival">페스티벌</button>
      </div>

      <!-- 뮤지컬 -->
      <button class="side-cat-item" data-cat="musical">뮤지컬</button>

      <!-- 연극 -->
      <button class="side-cat-item" data-cat="play">연극</button>

      <!-- 클래식/무용 -->
      <button class="side-cat-item" data-submenu="sub-classic" data-cat="classic">
        클래식/무용
        <svg class="icon side-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="side-submenu" id="sub-classic">
        <button class="side-subitem" data-cat="classic" data-sub="all">전체보기</button>
        <button class="side-subitem" data-cat="classic" data-sub="classic">클래식</button>
        <button class="side-subitem" data-cat="classic" data-sub="ballet">발레/무용</button>
        <button class="side-subitem" data-cat="classic" data-sub="gukak">국악</button>
      </div>

      <!-- 전시/스포츠 -->
      <button class="side-cat-item" data-submenu="sub-exhibition" data-cat="exhibition">
        전시/스포츠
        <svg class="icon side-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="side-submenu" id="sub-exhibition">
        <button class="side-subitem" data-cat="exhibition" data-sub="all">전체보기</button>
        <button class="side-subitem" data-cat="exhibition" data-sub="exhibition">전시</button>
        <button class="side-subitem" data-cat="exhibition" data-sub="experience">체험/행사</button>
        <button class="side-subitem" data-cat="exhibition" data-sub="sports">스포츠</button>
      </div>

      <!-- 가족/어린이 -->
      <button class="side-cat-item" data-cat="family">가족/어린이</button>

      <!-- 지역축제 -->
      <button class="side-cat-item" data-cat="local">지역축제</button>

      <!-- 대학축제 -->
      <button class="side-cat-item" data-cat="univ">대학축제</button>

      <!-- 박람회 -->
      <button class="side-cat-item" data-cat="expo">박람회</button>
    </div>

    <!-- 정보 섹션 -->
    <div class="side-section">
      <button class="side-cat-item side-guide-btn" data-submenu="sub-guide">
        <div class="side-guide-btn-inner">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span class="text-nowrap">이용안내</span>
        </div>
        <svg class="icon side-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="side-submenu" id="sub-guide">
        <a href="guide.html?tab=tab-book" class="side-subitem">예매방법</a>
        <a href="guide.html?tab=tab-pay" class="side-subitem">결제방법</a>
        <a href="guide.html?tab=tab-fee" class="side-subitem">수수료</a>
        <a href="guide.html?tab=tab-cancel" class="side-subitem">취소/환불</a>
        <a href="guide.html?tab=tab-receive" class="side-subitem">티켓수령</a>
        <a href="guide.html?tab=tab-faq" class="side-subitem">FAQ</a>
        <a href="guide.html?tab=tab-partner" class="side-subitem">티켓판매/제휴문의</a>
      </div>
      <button class="side-link-item" onclick="if(window.Toast) window.Toast.info('추후 이벤트 업데이트 예정입니다.'); else alert('추후 이벤트 업데이트 예정입니다.');">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        이벤트
      </button>
    </div>

    <!-- MY 섹션 -->
    <div class="side-section">
      <div class="side-section-title">MY</div>
      <button class="side-cat-item" data-submenu="sub-my">
        MY티켓
        <svg class="icon side-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div class="side-submenu" id="sub-my">
        <a href="mypage.html" class="side-subitem">예매확인/취소</a>
      </div>
      <a href="mypage.html#tab-inquiries" class="side-link-item">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        1:1 문의하기
      </a>
    </div>

    <!-- 바로가기 섹션 -->
    <div class="side-section">
      <div class="side-section-title">바로가기</div>
      <a href="mypage.html#tab-wishlist" class="side-link-item" id="sideWishlistBtn">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <path
            d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
        찜
      </a>
      <a href="cart.html" class="side-link-item">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 01-8 0" />
        </svg>
        장바구니
      </a>
    </div>

    <!-- 최근 본 상품 -->
    <div class="side-section side-section-recent">
      <div class="side-section-title">최근 본 상품</div>

      <div class="recent-carousel-container">
        <div class="recent-carousel recent-carousel-wrap">
          <button class="recent-prev recent-btn">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div class="recent-carousel-content recent-carousel-inner">
            <div class="recent-carousel-track recent-track-override">
            </div>
          </div>

          <button class="recent-next recent-btn">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
    </div>
    </div>
  </nav>
`;
document.write(SIDE_PANEL_HTML);