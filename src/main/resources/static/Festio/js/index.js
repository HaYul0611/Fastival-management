/**
 * Festival O2O — index.js
 * 메인 페이지: 포스터 그리드, 카테고리 필터, 히어로 슬라이더
 * 호버 오버레이, 위시리스트, 타임세일
 */
'use strict';

window._isIndexPage = true;

let _events = [];
let _wishlist = [];
let _currentCat = sessionStorage.getItem('idx_cat') || 'all';
let _currentSub = sessionStorage.getItem('idx_sub') || 'all';
let _currentSort = 'latest';
let _searchQuery = '';
let _page = 1;
const PAGE_SIZE = window.innerWidth >= 1280 ? 24 : window.innerWidth >= 1024 ? 20 : 12;

let _heroTimer = null;
let _heroIdx = 0;
let _heroSlides = [];

const MOBILE_CATS = [
  { key: 'all', label: '전체' },
  { key: 'concert', label: '콘서트' },
  { key: 'musical', label: '뮤지컬' },
  { key: 'play', label: '연극' },
  { key: 'classic', label: '클래식/무용' },
  { key: 'exhibition', label: '전시/스포츠' },
  { key: 'family', label: '가족/어린이' },
  { key: 'local', label: '지역축제' },
  { key: 'univ', label: '대학축제' },
  { key: 'expo', label: '박람회' },
];

/* ═══ 데이터 로드 ════════════════════════════════════════════ */
async function loadData() {
  const [wishData] = await Promise.all([
    wishlistApi.getWishlist().catch(() => []),
  ]);
  _wishlist = wishData || [];

  const onProgress = (partial) => {
    _events = partial || [];
    renderPosterGrid();
    buildHeroSlides();
    renderTimesale();
    renderWhatsHot();
    renderTicketOpenAndUnivFest();
  };

  await eventApi.getEvents(null, onProgress).catch(console.error);
}

/* ═══ 히어로 슬라이더 ════════════════════════════════════════ */
function buildHeroSlides() {
  const hot = _events.filter(e => e.isHot || e.is_hot).slice(0, 5);
  const rest = _events.filter(e => !(e.isHot || e.is_hot)).slice(0, 7);
  let picks = [...hot, ...rest];

  if (picks.length < 12) {
    const ongoing = _events.filter(e => !picks.includes(e) && (e.category === '콘서트' || e.category === '뮤지컬' || e.category === '콘서트/뮤지컬' || e.category === '연극'))
      .sort((a, b) => (b.viewCount || b.view_count || 0) - (a.viewCount || a.view_count || 0));
    picks = [...picks, ...ongoing];
  }
  picks = picks.slice(0, 12);

  while (picks.length > 0 && picks.length < 12) {
    picks = picks.concat(picks);
  }
  picks = picks.slice(0, 12);

  _heroSlides = picks.map(ev => {
    const rawDate = ev.eventDate || ev.startDate || ev.start_date || '';
    const parts = rawDate.split('-');
    const dateStr = parts.length >= 3 ? `${parseInt(parts[1])}월 ${parseInt(parts[2].slice(0, 2))}일` : rawDate;
    return {
      eventNo: ev.eventNo || ev.id,
      title: ev.eventName || ev.name,
      category: ev.category,
      date: dateStr,
      venue: ev.venue,
      badge: ev.badgeLabel || ev.badge_label || (ev.isHot || ev.is_hot ? 'HOT' : '추천'),
      thumbnailUrl: ev.thumbnailUrl || ev.thumbnail_url || 'https://source.unsplash.com/random/800x600?concert',
    };
  });
  renderHeroSlides();
}

function renderHeroSlides() {
  const slider = document.getElementById('heroSlider');
  const dotsWrap = document.getElementById('heroIndicators');
  if (!slider || !_heroSlides.length) return;

  slider.innerHTML = _heroSlides.map((s, i) => `
    <div class="hero-slide" data-event-no="${s.eventNo}">
      <div class="hero-slide-bg">
        ${s.thumbnailUrl ? `<img src="${s.thumbnailUrl}" alt="" loading="${i === 0 ? 'eager' : 'lazy'}">` : ''}
      </div>
      <div class="hero-slide-container">
        <div class="hero-slide-poster">
          ${s.thumbnailUrl ? `<img src="${s.thumbnailUrl}" alt="${s.title}" loading="${i === 0 ? 'eager' : 'lazy'}">` : ''}
        </div>
        <div class="hero-slide-content">
          <span class="hero-slide-cat">${s.category || ''}</span>
          <h2 class="hero-slide-title">${s.title}</h2>
          <div class="hero-slide-meta">
            <span>
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;display:inline-block"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${s.date}
            </span>
            <span>${s.venue}</span>
          </div>
          <span class="hero-slide-badge">${s.badge}</span>
        </div>
      </div>
    </div>`).join('');

  if (dotsWrap) {
    const numsLayer = `<div class="hero-nums-layer">` + _heroSlides.map((s, i) => {
      const numStr = String(i + 1).padStart(2, '0');
      return `<div class="hero-dot ${i === 0 ? 'active' : ''}" data-dot="${i}">
        <span class="hero-dot-num">${numStr}</span>
      </div>`;
    }).join('') + `</div>`;

    const postersLayer = `<div class="hero-posters-layer">` + _heroSlides.map((s, i) => {
      return `<div class="hero-dot-poster ${i === 0 ? 'active' : ''}" data-dot="${i}">
        <div class="hero-dot-bg" style="--bg-img: url('${s.thumbnailUrl || ''}')"></div>
      </div>`;
    }).join('') + `</div>`;

    dotsWrap.innerHTML = numsLayer + postersLayer;

    on(dotsWrap, 'click', e => {
      const dot = e.target.closest('[data-dot]');
      if (dot) goHero(parseInt(dot.dataset.dot));
    });
  }

  on(slider, 'click', e => {
    const slide = e.target.closest('.hero-slide');
    if (slide) location.href = `detail.html?eventNo=${slide.dataset.eventNo}`;
  });

  const prevBtn = document.getElementById('heroPrevBtn');
  const nextBtn = document.getElementById('heroNextBtn');

  function startHeroTimer() {
    clearInterval(_heroTimer);
    _heroTimer = setInterval(() => goHero(_heroIdx + 1), 4500);
  }

  function stopHeroTimer() {
    clearInterval(_heroTimer);
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      stopHeroTimer();
      goHero(_heroIdx - 1);
      startHeroTimer();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      stopHeroTimer();
      goHero(_heroIdx + 1);
      startHeroTimer();
    };
  }

  if (dotsWrap) {
    on(dotsWrap, 'mouseenter', stopHeroTimer);
    on(dotsWrap, 'mouseleave', startHeroTimer);
  }
  on(slider, 'mouseenter', stopHeroTimer);
  on(slider, 'mouseleave', startHeroTimer);

  startHeroTimer();
}

function goHero(idx) {
  const slider = document.getElementById('heroSlider');
  const dots = $$('[data-dot]');
  if (!slider || !_heroSlides.length) return;
  _heroIdx = ((idx % _heroSlides.length) + _heroSlides.length) % _heroSlides.length;
  slider.style.transform = `translateX(-${_heroIdx * 100}%)`;
  dots.forEach(d => {
    const dotIdx = parseInt(d.dataset.dot);
    d.classList.toggle('active', dotIdx === _heroIdx);
  });
}

/* ═══ WHAT'S HOT 섹션 ════════════════════════════════════════ */
function renderWhatsHot() {
  const grid = document.getElementById('whatsHotGrid');
  if (!grid) return;

  // Priority keywords for WHAT'S HOT
  const hotKeywords = ['k-pop', '아이돌', '내한', '뮤지컬', '오페라'];
  const getScore = (ev) => {
    let score = (ev.viewCount || ev.views || 0);
    const title = (ev.eventName || ev.name || '').toLowerCase();
    const cat = (ev.category || '').toLowerCase();
    if (hotKeywords.some(k => title.includes(k) || cat.includes(k))) {
      score += 1000000;
    }
    return score;
  };

  let popularEvents = [..._events].sort((a, b) => getScore(b) - getScore(a)).slice(0, 7);

  if (popularEvents.length < 7) {
    const fallback = _events.filter(e => !popularEvents.includes(e) && calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) !== '종료');
    popularEvents = popularEvents.concat(fallback.slice(0, 7 - popularEvents.length));
  }
  if (popularEvents.length < 7 && _events.length > 0) {
    while (popularEvents.length < 7) {
      popularEvents = popularEvents.concat(_events.slice(0, 7 - popularEvents.length));
    }
  }

  if (popularEvents.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">데이터가 부족합니다.</div>';
    return;
  }

  const html = popularEvents.map((ev, index) => {
    const isLarge = index === 0;
    const badgeText = ev.badgeLabel || (isLarge ? '단독' : '단독'); // matching image

    // Large item has title/desc below the image
    const infoHtml = isLarge ? `
      <div class="whats-hot-info">
        <div class="whats-hot-item-title">${ev.eventName || ev.name}</div>
        <div class="whats-hot-item-desc">${ev.startDate || ev.eventDate || '2026. 07. 16.'} ${ev.venue || 'FESTIO LIVE HALL'} / <span>단독판매</span></div>
      </div>
    ` : '';

    const price = ev.minPrice !== undefined ? ev.minPrice : (ev.price !== undefined ? ev.price : 30000);
    const priceText = price === 0 ? '무료' : price.toLocaleString() + '원';
    const viewsText = (ev.viewCount !== undefined ? ev.viewCount : (ev.views || 2100)).toLocaleString();

    const ddayStr = ev.dday || calcDday(ev.startDate || ev.eventDate, ev.endDate || ev.eventEndDate) || '';
    const isNewHtml = (ev.isNew && ddayStr !== '종료') ? '<span class="ob-new">신규</span>' : '';
    const ddayHtml = ddayStr ? `<span class="ob-dday">${ddayStr}</span>` : '';
    const formattedDate = ev.startDate ? formatDate(ev.startDate) : (ev.eventDate ? formatDate(ev.eventDate) : '-');

    return `
      <a href="detail.html?eventNo=${ev.eventNo || ev.id}" class="whats-hot-item ${isLarge ? 'large' : ''}" id="whats-hot-${ev.eventNo || ev.id}">
        <div class="whats-hot-img-wrap">
          <div class="whats-hot-img-inner" style="position:relative; width:100%; height:100%; overflow:hidden; border-radius:8px;">
            <img src="${ev.thumbnailUrl || ''}" alt="${ev.eventName || ev.name}" class="whats-hot-img">
            
            <div class="whats-hot-overlay" style="border-radius:8px;">
              <h3 class="overlay-title">${(ev.eventName || ev.name || '').replace('HOT', '<span style="color:red">HOT</span>')}</h3>
              <div class="overlay-badges">
                ${isNewHtml}
                ${ddayHtml}
              </div>
              <div class="overlay-date">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                ${formattedDate}
              </div>
              <div class="overlay-price">${priceText}</div>
              <div class="overlay-views">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                조회 ${viewsText}
              </div>
            </div>
          </div>
          <div class="whats-hot-badge">${badgeText}</div>
        </div>
        ${infoHtml}
      </a>
    `;
  }).join('');

  grid.innerHTML = html;
}

/* ═══ 카테고리 탭바 (모바일) ════════════════════════════════ */

window.applyCategory = function (cat, sub) {
  _currentCat = cat;
  _currentSub = sub || 'all';
  _page = 1;

  // URL 파라미터 업데이트
  const url = new URL(location.href);
  url.searchParams.set('cat', cat);
  if (sub !== 'all' && sub) url.searchParams.set('sub', sub);
  else url.searchParams.delete('sub');
  window.history.replaceState({}, '', url);

  renderMobileCatTabbar();

  // common.js에 정의된 함수 호출
  if (typeof renderDesktopSubnav === 'function') {
    renderDesktopSubnav(cat, _currentSub);
  } else if (window.renderDesktopSubnav) {
    window.renderDesktopSubnav(cat, _currentSub);
  }

  // 데이터 다시 불러오기
  loadData();
};

function renderMobileCatTabbar() {
  const container = document.getElementById('catTabbar');
  if (!container) return;
  container.innerHTML = MOBILE_CATS.map(c => `
    <button class="cat-tabbar-item ${c.key === _currentCat ? 'active' : ''}" data-cat="${c.key}">
      ${c.label}
    </button>`).join('');
  on(container, 'click', e => {
    const item = e.target.closest('.cat-tabbar-item');
    if (!item) return;
    const cat = item.dataset.cat;
    if (cat === _currentCat) return;
    window.applyCategory(cat, 'all');
  });
}

/* ═══ 포스터 그리드 렌더링 ══════════════════════════════════ */
function getFilteredEvents() {
  let items = _events.slice();

  // 카테고리 필터
  if (_currentCat && _currentCat !== 'all') {
    const catMap = {
      concert: ['콘서트/뮤지컬', '콘서트'],
      musical: ['뮤지컬', '콘서트/뮤지컬'],
      play: ['연극'],
      classic: ['클래식/무용', '클래식'],
      exhibition: ['전시/스포츠', '전시', '스포츠', '체험/행사'],
      family: ['가족/어린이', '아동/가족'],
      local: ['지역축제'],
      univ: ['대학축제'],
      expo: ['박람회'],
    };
    const targets = catMap[_currentCat] || [];
    if (targets.length) {
      items = items.filter(e => targets.some(t => (e.category || '').includes(t)));
    }
  }

  // 검색 필터
  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    items = items.filter(e =>
      (e.eventName || e.name || '').toLowerCase().includes(q) ||
      (e.venue || '').toLowerCase().includes(q)
    );
  }

  const getStatus = (e) => {
    const dday = calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate);
    if (dday === '종료') return 3; // 종료
    if (dday.includes('진행중') || dday === '오늘종료' || dday === 'D-DAY') return 1; // 진행 중
    return 2; // 진행 예정 (D-x)
  };

  const ongoing = items.filter(e => getStatus(e) === 1);
  const upcoming = items.filter(e => getStatus(e) === 2);
  const ended = items.filter(e => getStatus(e) === 3);

  // 정렬
  const sort = (arr) => {
    if (_currentSort === 'popular') return [...arr].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    if (_currentSort === 'date') return [...arr].sort((a, b) => new Date(a.eventDate || a.startDate) - new Date(b.eventDate || b.startDate));
    return arr; // latest (API 순서)
  };

  return [...sort(ongoing), ...sort(upcoming), ...sort(ended)];
}

function renderPosterGrid() {
  const grid = document.getElementById('posterGrid');
  if (!grid) return;

  const filtered = getFilteredEvents();
  const paginated = filtered.slice(0, _page * PAGE_SIZE);

  // 결과 카운트 업데이트
  const countEl = document.getElementById('resultCount');
  if (countEl) countEl.textContent = filtered.length.toLocaleString();

  // 더보기 버튼
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  if (loadMoreWrap) {
    loadMoreWrap.style.display = paginated.length < filtered.length ? 'flex' : 'none';
  }

  if (!paginated.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p class="empty-state-title">조건에 맞는 행사가 없습니다.</p>
        <p class="empty-state-desc">다른 카테고리를 선택하거나 검색어를 바꿔보세요.</p>
      </div>`;
    return;
  }

  grid.innerHTML = paginated.map((ev, i) => buildPosterCard(ev, i)).join('');

  // 위시 버튼 이벤트
  on(grid, 'click', e => {
    const wishBtn = e.target.closest('.poster-wish-btn');
    if (wishBtn) { e.stopPropagation(); handleWish(wishBtn); return; }
    const card = e.target.closest('.poster-card');
    if (card) {
      const no = card.dataset.eventNo;
      const ev = _events.find(e => String(e.eventNo || e.id) === String(no));
      if (ev) {
        RecentViewed.add({
          eventNo: no,
          name: ev.eventName || ev.name,
          thumbnailUrl: ev.thumbnailUrl,
        });
      }
      location.href = `detail.html?eventNo=${no}`;
    }
  });
}

function buildPosterCard(ev, idx) {
  const no = ev.eventNo || ev.id;
  const name = ev.eventName || ev.name || '-';
  const date = ev.eventDate || ev.startDate;
  const endDate = ev.eventEndDate || ev.endDate;
  const price = ev.minPrice || 0;
  const isHot = ev.isHot || ev.is_hot;
  const badge = ev.badgeLabel || ev.badge_label || (isHot ? 'HOT' : null);
  const isAdult = ev.isAdultOnly || false;
  const isWished = _wishlist.includes(no);
  const thumb = ev.thumbnailUrl;
  const dday = calcDday(date, endDate);
  const views = ev.viewCount || 0;

  const badgeHTML = badge ? `
    <span class="overlay-badge ${isHot ? 'hot' : badge === '타임세일' ? 'sale' : ''}">
      ${badge}
    </span>` : '';

  const ddayHTML = dday !== '종료' ? `<span class="overlay-badge">${dday}</span>` : '';

  const discountHTML = price > 0 ? `
    <div class="overlay-price-row">
      <span class="overlay-price">${formatKRW(price)}</span>
      ${isHot ? `<span class="overlay-orig-price">${formatKRW(Math.round(price * 1.25))}</span>
                 <span class="overlay-discount">20%</span>` : ''}
    </div>` : `<div class="overlay-price-row"><span class="overlay-price">무료</span></div>`;

  const eventTag = isHot ? `<div class="overlay-event-tag">HOT DEAL 진행중</div>` : '';

  return `
    <div class="poster-card" data-event-no="${no}" tabindex="0" role="button" aria-label="${name}">
      <div class="poster-img-wrap">
        ${thumb
      ? `<img src="${thumb}" alt="${name}" loading="lazy">`
      : `<div class="poster-placeholder">
               <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
             </div>`}
        ${isAdult ? `<span class="poster-adult-badge">19+</span>` : ''}
        <button class="poster-wish-btn ${isWished ? 'active' : ''}" data-event-no="${no}" data-wished="${isWished}" aria-label="${isWished ? '찜 해제' : '찜 추가'}">
          <svg class="icon" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
        <!-- 호버 오버레이 (데스크톱) -->
        <div class="poster-hover-overlay" aria-hidden="true">
          <div class="overlay-title">${name}</div>
          <div class="overlay-badges">${badgeHTML}${ddayHTML}</div>
          <div class="overlay-date">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${date ? formatDate(date) : '-'}
          </div>
          ${discountHTML}
          ${eventTag}
          ${views > 0 ? `
          <div class="overlay-review">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            조회 ${views.toLocaleString()}
          </div>` : ''}
        </div>
      </div>
      <!-- 모바일 카드 하단 정보 -->
      <div class="poster-info">
        <div class="poster-info-badges">
          ${badge ? `<span class="badge ${isHot ? 'badge-hot' : 'badge-dday'}">${badge}</span>` : ''}
          ${dday !== '종료' && !badge ? `<span class="badge badge-dday">${dday}</span>` : ''}
        </div>
        <p class="poster-info-title">${name}</p>
        <p class="poster-info-date">${date ? formatDate(date) : '-'}</p>
        <p class="poster-info-price">${formatKRW(price)}</p>
      </div>
    </div>`;
}

/* ═══ 위시 토글 ═════════════════════════════════════════════ */
async function handleWish(btn) {
  if (btn.dataset.loading === 'true') return;

  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    Toast.info('로그인이 필요합니다.');
    setTimeout(() => { window.location.href = 'login.html'; }, 1000);
    return;
  }

  btn.dataset.loading = 'true';
  const no = parseInt(btn.dataset.eventNo);
  const isWished = btn.dataset.wished === 'true';
  const newWish = !isWished;

  btn.dataset.wished = String(newWish);
  btn.classList.toggle('active', newWish);
  const icon = btn.querySelector('.icon');
  if (icon) icon.setAttribute('fill', newWish ? 'currentColor' : 'none');

  try {
    await wishlistApi.toggleWishlist(no, isWished);
    if (newWish) {
      _wishlist.push(no);
      Toast.success('찜 목록에 추가되었습니다.');
    }
    else { _wishlist = _wishlist.filter(n => n !== no); Toast.info('찜 목록에서 제거되었습니다.'); }
  } catch {
    btn.dataset.wished = String(isWished);
    btn.classList.toggle('active', isWished);
    if (icon) icon.setAttribute('fill', isWished ? 'currentColor' : 'none');
    Toast.error('오류가 발생했습니다.');
  } finally {
    btn.dataset.loading = 'false';
  }
}

/* ═══ 타임세일 ══════════════════════════════════════════════ */
function renderTimesale() {
  const container = document.getElementById('timesaleCards');
  if (!container) return;
  const active = _events
    .filter(e => calcDday(e.eventDate || e.startDate, e.eventEndDate || e.endDate) !== '종료')
    .slice(0, 6);
  if (!active.length) { container.innerHTML = ''; return; }

  container.innerHTML = active.map(ev => {
    const no = ev.eventNo || ev.id;
    const name = ev.eventName || ev.name;
    const price = ev.minPrice || ev.price || 0;
    const thumb = ev.thumbnailUrl || ev.thumbnail_url;
    return `
      <a href="detail.html?eventNo=${no}" class="timesale-card">
        <div class="timesale-card-img">
          ${thumb ? `<img src="${thumb}" alt="${name}" loading="lazy">` : `<div class="timesale-card-img-placeholder"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>`}
        </div>
        <div class="timesale-card-body">
          <div class="timesale-card-title">${name}</div>
          <div class="timesale-price-row">
            ${price > 0 ? `
              <span class="timesale-price">${formatKRW(price)}</span>
              <span class="timesale-orig">${formatKRW(Math.round(price * 1.25))}</span>
              <span class="timesale-pct">20%↓</span>
            ` : `<span class="timesale-price">무료</span>`}
          </div>
        </div>
      </a>`;
  }).join('');

  // 스크롤 버튼 이벤트 바인딩
  const prevBtn = document.querySelector('.timesale-nav.prev');
  const nextBtn = document.querySelector('.timesale-nav.next');
  if (prevBtn && nextBtn) {
    prevBtn.onclick = () => container.scrollBy({ left: -250, behavior: 'smooth' });
    nextBtn.onclick = () => container.scrollBy({ left: 250, behavior: 'smooth' });
  }
}

function initCountdown() {
  function pad(n) { return n < 10 ? '0' + n : n; }
  const tick = () => {
    const now = new Date();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const diff = end - now;
    if (diff <= 0) return;
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);
    const hEl = $('.countdown-hours');
    const mEl = $('.countdown-minutes');
    const sEl = $('.countdown-seconds');
    if (hEl) hEl.textContent = pad(h);
    if (mEl) mEl.textContent = pad(m);
    if (sEl) sEl.textContent = pad(s);
  };
  tick();
  setInterval(tick, 1000);
}

/* ═══ 티켓오픈/대학축제 ════════════════════════════════════ */
function renderTicketOpenAndUnivFest() {
  const ticketOpenGrid = document.getElementById('ticketOpenGrid');
  const univFestGrid = document.getElementById('univFestGrid');

  // KOPIS & TourAPI (현재일 기준 개봉 예정이 빠른 순)
  if (ticketOpenGrid) {
    // 1. 기존 DOM 초기화 (스켈레톤 등)
    ticketOpenGrid.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    let ticketEvents = _events.filter(e => {
      const d = (e.eventDate || e.startDate || e.start_date || '').replace(/-/g, '.');
      const badge = e.badgeLabel || e.badge_label;
      return (badge === 'KOPIS' || badge === 'TourAPI') && d >= todayStr;
    }).sort((a, b) => {
      const dA = (a.eventDate || a.startDate || a.start_date || '').replace(/-/g, '.');
      const dB = (b.eventDate || b.startDate || b.start_date || '').replace(/-/g, '.');
      return dA.localeCompare(dB);
    });

    ticketEvents = ticketEvents.slice(0, 5);

    // 데이터가 5개 미만일 경우 예비로 KOPIS/TourAPI 전체 중 추가
    if (ticketEvents.length < 5) {
      const fallback = _events.filter(e => {
        const badge = e.badgeLabel || e.badge_label;
        return (badge === 'KOPIS' || badge === 'TourAPI') && !ticketEvents.includes(e);
      });
      ticketEvents = [...ticketEvents, ...fallback].slice(0, 5);
    }

    // 그래도 데이터가 없을 때는 인기 있는 행사로 대체
    if (ticketEvents.length === 0) {
      const popularFallback = _events.filter(e => calcDday(e.eventDate || e.startDate || e.start_date, e.eventEndDate || e.endDate || e.end_date) !== '종료')
        .sort((a, b) => (b.viewCount || b.view_count || 0) - (a.viewCount || a.view_count || 0))
        .slice(0, 5);
      ticketEvents = popularFallback;
    }

    if (ticketEvents.length > 0) {
      ticketOpenGrid.innerHTML = ticketEvents.map((ev, i) => {
        const no = ev.eventNo || ev.id;
        const name = ev.eventName || ev.name;
        const thumb = ev.thumbnailUrl || ev.thumbnail_url;
        const date = ev.eventDate || ev.startDate || ev.start_date;
        // 단독/선예매 등 뱃지 교차 배정 (원래 KOPIS/TourAPI지만 티켓오픈 느낌을 주기 위함)
        const badgeText = i % 2 === 0 ? '단독' : '선예매';
        const badgeClass = i % 2 === 0 ? 'red' : 'orange';
        const badge = `<div class="ticket-badge ${badgeClass}">${badgeText}</div>`;

        const dday = calcDday(date, ev.eventEndDate || ev.endDate);
        const todayOverlay = dday === 'D-DAY' ? `<div class="ticket-today-overlay"><span class="today-text">Today</span></div>` : '';

        return `
          <a href="detail.html?eventNo=${no}" class="ticket-open-item">
            <div class="ticket-img-wrap">
              ${thumb ? `<img src="${thumb}" alt="${name}" class="ticket-cover">` : `<div class="ticket-cover" style="background:var(--bg-elevated)"></div>`}
              ${badge}
              ${todayOverlay}
            </div>
            <div class="ticket-info">
              <h4 class="ticket-title">${name}</h4>
              <p class="ticket-date">${date}</p>
            </div>
          </a>
        `;
      }).join("");
    } else {
      ticketOpenGrid.innerHTML = `<div class="empty-state">티켓 오픈 예정인 행사가 없습니다.</div>`;
    }
  }
}

function initLoadMore() {
  const loadMoreBtn = document.getElementById('btnLoadMore'); // FIXED ID
  if (!loadMoreBtn) return;

  loadMoreBtn.addEventListener('click', () => {
    if (window.innerWidth >= 1024) {
      location.href = `list.html?cat=${_currentCat}`;
    }
  });

  window.addEventListener('scroll', () => {
    if (window.innerWidth < 1024) {
      loadMoreBtn.style.display = 'none';
      const wrap = document.getElementById('loadMoreWrap');
      if (!wrap || wrap.style.display === 'none') return;

      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        if (!window._isFetchingMore) {
          window._isFetchingMore = true;
          _page++;
          renderPosterGrid();
          setTimeout(() => { window._isFetchingMore = false; }, 500);
        }
      }
    } else {
      loadMoreBtn.style.display = '';
    }
  }, { passive: true });
}

/* ═══ URL 파라미터 읽기 ════════════════════════════════════ */
function readUrlParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('cat')) _currentCat = p.get('cat');
  if (p.get('sub')) _currentSub = p.get('sub');
}

/* ═══ DOMContentLoaded ══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  readUrlParams();
  renderMobileCatTabbar();
  renderDesktopSubnav(_currentCat, _currentSub);
  initCountdown();
  initLoadMore();

  // 스켈레톤
  const grid = document.getElementById('posterGrid');
  if (grid) {
    const cols = window.innerWidth >= 1280 ? 6 : window.innerWidth >= 1024 ? 5 : 2;
    grid.innerHTML = Array.from({ length: cols * 2 }, () => `
      <div class="poster-card">
        <div class="poster-img-wrap" style="aspect-ratio:3/4">
          <div class="skeleton" style="position:absolute;inset:0;border-radius:var(--radius-md)"></div>
        </div>
        <div class="poster-info">
          <div class="skeleton" style="height:14px;margin-bottom:6px;border-radius:4px"></div>
          <div class="skeleton" style="height:12px;width:70%;border-radius:4px"></div>
        </div>
      </div>`).join('');
  }

  await loadData();
  if (_currentCat !== 'all') {
    $$('.header-cat-item').forEach(t => t.classList.toggle('active', t.dataset.cat === _currentCat));
  }

  // 비즈니스 제휴 플로팅 팝업 옵저버 및 열기 로직 추가
  const partnerSection = document.querySelector('.partner-section');
  const floatingPopup = document.getElementById('partnerFloatingPopup');
  const btnScrollToPartner = document.getElementById('btnScrollToPartner');
  let isPartnerFormOpen = false;

  if (partnerSection && floatingPopup) {
    floatingPopup.classList.remove('show'); // 초기 상태 숨김

    // 1. 스크롤 300px 이상 내렸을 때 팝업 노출 및 크기 축소 로직
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;

      // 제휴폼이 열려있지 않으면 스크롤 내렸을 때만 노출
      if (!isPartnerFormOpen) {
        if (scrollY > 300) {
          floatingPopup.classList.add('show');
          floatingPopup.classList.add('scrolled');
        } else {
          floatingPopup.classList.remove('show');
          floatingPopup.classList.remove('scrolled');
        }
      } else {
        floatingPopup.classList.remove('show');
        floatingPopup.classList.remove('scrolled');
      }

      // 플로팅 위아래 스크롤 버튼 노출
      const scrollBtns = document.getElementById('floatingScrollBtns');
      if (scrollBtns) {
        if (scrollY > 300) {
          scrollBtns.classList.add('show');
        } else {
          scrollBtns.classList.remove('show');
        }
      }
    }, { passive: true });

    // 2. 플로팅 팝업 클릭 시 제휴폼 영역 열고 스무스 스크롤 이동
    floatingPopup.addEventListener('click', () => {
      isPartnerFormOpen = true;
      floatingPopup.classList.remove('show'); // 팝업 즉시 숨김

      // 제휴폼 펼치기
      partnerSection.classList.add('open');

      // 애니메이션이 약간 진행된 후 스크롤 이동하여 자연스럽게 포커스 맞춤 (데스크톱만)
      setTimeout(() => {
        if (window.innerWidth >= 1024) {
          partnerSection.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 100);
    });

    // 모바일 등에서 닫기 버튼 처리
    const partnerCloseBtn = document.getElementById('partnerCloseBtn');
    if (partnerCloseBtn) {
      partnerCloseBtn.addEventListener('click', () => {
        partnerSection.classList.remove('open');
        isPartnerFormOpen = false;
        // 팝업 버튼 다시 노출
        if (window.scrollY < 300) {
          floatingPopup.classList.add('show');
        } else {
          floatingPopup.classList.add('show', 'scrolled');
        }
      });
    }

    // Removed duplicate partner popup click listener here
  }

  // 상하단 스크롤 버튼 이벤트 추가
  const btnScrollUp = document.getElementById('btnScrollUp');
  const btnScrollDown = document.getElementById('btnScrollDown');
  if (btnScrollUp) {
    btnScrollUp.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (btnScrollDown) {
    btnScrollDown.addEventListener('click', () => {
      const timesaleSection = document.querySelector('.timesale-section') || document.querySelector('.ticket-section');
      if (timesaleSection) {
        timesaleSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    });
  }
});
