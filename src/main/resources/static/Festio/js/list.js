/* js/list.js */

const CATEGORIES = {
  'concert': { label: '콘서트', bg: 'linear-gradient(135deg, #1a1b26, #3b3d58)', subs: [{ k: 'all', v: '전체보기' }, { k: 'domestic', v: '국내뮤지션' }, { k: 'overseas', v: '해외뮤지션' }, { k: 'festival', v: '페스티벌' }] },
  'musical': { label: '뮤지컬', bg: 'linear-gradient(135deg, #2b1021, #5c2041)', subs: [{ k: 'all', v: '전체보기' }, { k: 'original', v: '오리지널' }, { k: 'license', v: '라이선스' }, { k: 'creative', v: '창작' }] },
  'play': { label: '연극', bg: 'linear-gradient(135deg, #10212b, #20415c)', subs: [{ k: 'all', v: '전체보기' }, { k: 'drama', v: '정극' }, { k: 'comedy', v: '코미디' }, { k: 'thriller', v: '스릴러' }] },
  'classic': { label: '클래식/무용', bg: 'linear-gradient(135deg, #2b2b10, #5c5c20)', subs: [{ k: 'all', v: '전체보기' }, { k: 'classic', v: '클래식' }, { k: 'ballet', v: '발레/무용' }, { k: 'gukak', v: '국악' }] },
  'exhibition': { label: '전시/스포츠', bg: 'linear-gradient(135deg, #102b1c, #205c3b)', subs: [{ k: 'all', v: '전체보기' }, { k: 'exhibition', v: '전시' }, { k: 'experience', v: '체험/행사' }, { k: 'sports', v: '스포츠' }] },
  'family': { label: '가족/어린이', bg: 'linear-gradient(135deg, #2b1a10, #5c3520)', subs: [{ k: 'all', v: '전체보기' }, { k: 'musical', v: '가족뮤지컬' }, { k: 'play', v: '가족연극' }, { k: 'experience', v: '체험' }] },
  'local': { label: '지역축제', bg: 'linear-gradient(135deg, #1c102b, #3b205c)', subs: [{ k: 'all', v: '전체보기' }, { k: 'seoul', v: '수도권' }, { k: 'gangwon', v: '강원권' }, { k: 'chungcheong', v: '충청권' }, { k: 'gyeongsang', v: '경상권' }, { k: 'jeolla', v: '전라권' }, { k: 'jeju', v: '제주권' }] },
  'univ': { label: '대학축제', bg: 'linear-gradient(135deg, #2b2010, #5c4420)', subs: [{ k: 'all', v: '전체보기' }, { k: 'spring', v: '봄축제' }, { k: 'fall', v: '가을축제' }] },
  'expo': { label: '박람회', bg: 'linear-gradient(135deg, #101010, #333333)', subs: [{ k: 'all', v: '전체보기' }, { k: 'tech', v: 'IT/테크' }, { k: 'living', v: '리빙/라이프' }, { k: 'food', v: '식품' }, { k: 'job', v: '취업/창업' }] }
};

let _events = [];
let _currentCat = 'all';
let _currentSub = 'all';
let _currentSort = 'popular';
let _wishlist = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 카테고리를 위한 쿼리 문자열 파싱
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('category');
  if (catParam && CATEGORIES[catParam]) {
    _currentCat = catParam;
  } else {
    _currentCat = 'concert'; // 기본값
  }

  const subParam = urlParams.get('sub') || 'all';

  const btnSearch = $('#btn-header-search');
  if (btnSearch) {
    on(btnSearch, 'click', () => alert('검색 기능은 준비 중입니다.'));
  }

  const btnBack = $('#btn-back');
  if (btnBack) {
    on(btnBack, 'click', () => history.back());
  }

  const alertReadyBtns = $$('.alert-ready');
  alertReadyBtns.forEach(btn => {
    on(btn, 'click', (e) => {
      e.preventDefault();
      alert('준비 중입니다.');
    });
  });

  // 로딩 스켈레톤
  const grid = $('.bento-grid');
  if (grid) {
    grid.innerHTML = Array.from({ length: 8 }, (_, i) => `
      <div class="bento-card">
        <div class="skeleton" style="position:absolute;inset:0;border-radius:0;"></div>
      </div>`).join('');
  }

  renderCategoryTabs();

  try {
    const wishData = await wishlistApi.getWishlist();
    _wishlist = wishData ? wishData.map(w => w.event_no) : [];

    await eventApi.getEvents('all', (partialEvents) => {
      _events = partialEvents;
      renderBentoGrid();
    });
  } catch (err) {
    console.error("Data load error:", err);
    if (grid) grid.innerHTML = `<div style="padding:2rem;text-align:center;color:#666;">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
  }
});

function renderCategoryTabs() {
  const container = $('#category-visual-header');
  if (!container) return;

  const catData = CATEGORIES[_currentCat];
  if (!catData) return;

  const urlParams = new URLSearchParams(window.location.search);
  const currentSub = urlParams.get('sub') || 'all';

  const searchKeyword = urlParams.get('search');

  if (searchKeyword) {
    container.innerHTML = `
      <div class="category-banner" style="background: linear-gradient(135deg, #1f1f1f, #333333);">
        <h1 class="category-banner-title">"${searchKeyword}" 검색 결과</h1>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="category-banner" style="background: ${catData.bg};">
      <h1 class="category-banner-title">${catData.label}</h1>
    </div>
    <div class="category-lnb-wrap">
      <div class="category-lnb">
        ${catData.subs.map(s => `
          <div class="category-lnb-item ${s.k === currentSub ? 'active' : ''}" data-sub="${s.k}">
            ${s.v}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 서브 카테고리 클릭 이벤트
  $$('.category-lnb-item').forEach(item => {
    on(item, 'click', (e) => {
      const sub = e.target.dataset.sub;
      if (sub === currentSub) return;

      const url = new URL(window.location);
      url.searchParams.set('sub', sub);
      window.history.pushState({}, '', url);

      renderCategoryTabs();
      renderBentoGrid();
    });
  });
}

function renderBentoGrid() {
  const grid = $('.poster-grid');
  if (!grid) return;

  const catMap = {
    'concert': ['콘서트', '콘서트/뮤지컬'],
    'musical': ['뮤지컬', '콘서트/뮤지컬'],
    'play': ['연극'],
    'classic': ['클래식/무용'],
    'exhibition': ['전시', '스포츠', '박람회'],
    'family': ['가족', '어린이'],
    'local': ['지역축제'],
    'univ': ['대학축제'],
    'expo': ['박람회']
  };

  let items = _events;
  if (_currentCat !== 'all') {
    const allowedCats = catMap[_currentCat] || [];
    if (allowedCats.length > 0) {
      items = items.filter(ev => allowedCats.some(c => ev.category && ev.category.includes(c)));
    }
  }
  // URL에서 sub 및 search 갱신
  const urlParams = new URLSearchParams(window.location.search);
  const searchKeyword = urlParams.get('search');

  if (searchKeyword) {
    const kw = searchKeyword.toLowerCase();
    items = items.filter(ev => {
      const name = (ev.eventName || ev.name || '').toLowerCase();
      const cat = (ev.category || '').toLowerCase();
      const venue = (ev.venue || '').toLowerCase();
      return name.includes(kw) || cat.includes(kw) || venue.includes(kw);
    });
  }

  _currentSub = urlParams.get('sub') || 'all';

  if (_currentSub !== 'all') {
    const subData = CATEGORIES[_currentCat]?.subs.find(s => s.k === _currentSub);
    if (subData) {
      const kw = subData.v.replace('보기', '').replace('전체', '').trim();
      if (kw) {
        items = items.filter(ev => {
          const cat = ev.category || '';
          const name = ev.eventName || ev.name || '';
          const venue = ev.venue || '';

          if (cat.includes(kw) || name.includes(kw)) return true;

          if (kw === '국내뮤지션') return !name.includes('내한');
          if (kw === '해외뮤지션' || kw === '오리지널') return name.includes('내한');
          if (kw === '페스티벌') return name.includes('페스티벌') || name.includes('워터밤') || name.includes('페프');
          if (kw === '라이선스') return name.includes('라이선스') || name.includes('한국어');
          if (kw === '창작') return !name.includes('내한') && !name.includes('라이선스');
          if (kw === '수도권') return venue.includes('서울') || venue.includes('경기') || venue.includes('인천');
          if (kw === '강원권') return venue.includes('강원');
          if (kw === '충청권') return venue.includes('대전') || venue.includes('세종') || venue.includes('충청');
          if (kw === '경상권') return venue.includes('부산') || venue.includes('대구') || venue.includes('울산') || venue.includes('경상');
          if (kw === '전라권') return venue.includes('광주') || venue.includes('전라');
          if (kw === '제주권') return venue.includes('제주');
          if (kw === '봄축제') return name.includes('봄') || name.includes('스프링') || cat.includes('봄');
          if (kw === '가을축제') return name.includes('가을') || name.includes('어텀') || cat.includes('가을');

          return false;
        });
      }
    }
  }

  // 1. 종료된 행사 하단으로
  const active = items.filter(e => calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) !== '종료');
  const ended = items.filter(e => calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) === '종료');

  // 2. 정렬 로직
  const sort = (arr) => {
    if (_currentSort === 'popular') return [...arr].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    if (_currentSort === 'new') return [...arr].sort((a, b) => new Date(b.eventDate || b.startDate) - new Date(a.eventDate || a.startDate));
    if (_currentSort === 'closing') {
      return [...arr].sort((a, b) => {
        const da = new Date(a.eventEndDate || a.endDate);
        const db = new Date(b.eventEndDate || b.endDate);
        return da - db;
      });
    }
    if (_currentSort === 'name') return [...arr].sort((a, b) => (a.eventName || a.name || '').localeCompare(b.eventName || b.name || ''));
    return arr;
  };

  items = [...sort(active), ...ended];

  const totalCountEl = document.getElementById('totalCount');
  if (totalCountEl) totalCountEl.textContent = items.length.toLocaleString();

  if (items.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 4rem 1rem; text-align: center; color: #888;">
        해당 카테고리의 행사 정보가 없습니다.
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(ev => {
    const no = ev.eventNo || ev.id;
    const name = ev.eventName || ev.name || '-';
    const date = ev.eventDate || ev.startDate;
    const endDate = ev.eventEndDate || ev.endDate;
    const price = ev.minPrice || ev.min_price || ev.price || 0;
    const isHot = ev.isHot || ev.is_hot;
    const badge = ev.badgeLabel || ev.badge_label || (isHot ? 'HOT' : null);
    const isAdult = ev.isAdultOnly || false;
    const isWished = _wishlist.includes(no);
    const thumb = ev.thumbnailUrl || ev.thumbnail_url;
    const dday = calcDday(date, endDate);
    const views = ev.viewCount || 0;

    const badgeHTML = badge ? `
      <span class="overlay-badge ${isHot ? 'hot' : badge === '타임세일' ? 'sale' : ''}">
        ${badge}
      </span>` : '';

    const ddayHTML = dday !== '종료' ? `<span class="overlay-badge">${dday}</span>` : '';

    return `
      <div class="poster-card" data-event-no="${no}" tabindex="0" role="button" aria-label="${name}">
        <div class="poster-img-wrap">
          ${thumb
        ? `<img src="${thumb}" alt="${name}" loading="lazy" onload="if(this.naturalWidth >= this.naturalHeight) this.closest('.poster-card').style.display='none';">`
        : `<div class="poster-placeholder">
                 <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
               </div>`}
          ${isAdult ? `<span class="poster-adult-badge">19+</span>` : ''}
          <button class="poster-wish-btn ${isWished ? 'active' : ''}" data-event-no="${no}" data-wished="${isWished}" aria-label="${isWished ? '찜 해제' : '찜 추가'}">
            <svg class="icon" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
          <div class="poster-hover-overlay" aria-hidden="true">
            <div class="overlay-title">${name}</div>
            <div class="overlay-badges">${badgeHTML}${ddayHTML}</div>
            <div class="overlay-date">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${date ? formatDateKo(date) : '-'}
            </div>
            <div class="overlay-price-row">
              <span class="overlay-price">${price > 0 ? formatKRW(price) : '무료'}</span>
            </div>
          </div>
        </div>
        <div class="poster-info">
          <div class="poster-info-badges">
            ${badge ? `<span class="badge ${isHot ? 'badge-hot' : 'badge-dday'}">${badge}</span>` : ''}
            ${dday !== '종료' && !badge ? `<span class="badge badge-dday">${dday}</span>` : ''}
          </div>
          <p class="poster-info-title">${name}</p>
          <p class="poster-info-date">${date ? formatDateKo(date) : '-'}</p>
          <p class="poster-info-price">${price > 0 ? formatKRW(price) : '무료'}</p>
        </div>
      </div>
    `;
  }).join('');

  on(grid, 'click', (e) => {
    const wishBtn = e.target.closest('.poster-wish-btn');
    if (wishBtn) {
      e.stopPropagation();
      toggleWish(wishBtn);
      return;
    }
    const card = e.target.closest('.poster-card');
    if (card) {
      window.location.href = `detail.html?eventNo=${card.dataset.eventNo}`;
    }
  });

  // 정렬 탭 이벤트 (초기화 방지를 위해 딱 한번만 바인딩되도록 위임하거나 상단에서 처리)
}

document.addEventListener('DOMContentLoaded', () => {
  const sortTabs = document.querySelector('.sort-tabs');
  if (sortTabs) {
    sortTabs.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        document.querySelectorAll('.sort-tab').forEach(b => {
          b.classList.remove('active');
          b.style.color = 'var(--text-secondary)';
          b.style.fontWeight = 'normal';
        });
        e.target.classList.add('active');
        e.target.style.color = 'var(--text-main)';
        e.target.style.fontWeight = 'bold';
        _currentSort = e.target.dataset.sort;
        renderBentoGrid();
      }
    });
  }
});

async function toggleWish(btn) {
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    if (window.Toast) Toast.info('로그인이 필요합니다.');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  const eventNo = parseInt(btn.dataset.eventNo);
  const isActive = btn.classList.contains('active');

  if (isActive) {
    const success = await wishlistApi.removeWishlist(eventNo);
    if (success) {
      btn.classList.remove('active');
      if (window.Toast) Toast.info('찜 목록에서 제거했습니다.');
    }
  } else {
    const success = await wishlistApi.addWishlist(eventNo);
    if (success) {
      btn.classList.add('active');
      if (window.Toast) Toast.success('찜 목록에 추가했습니다. 마이페이지로 이동합니다.');
      setTimeout(() => { window.location.href = 'mypage.html#tab-wishlist'; }, 900);
    }
  }
}
