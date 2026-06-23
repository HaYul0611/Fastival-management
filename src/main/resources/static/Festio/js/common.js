/**
 * Festival O2O — common.js
 * 사이드패널, 드롭다운, 토스트, 모달, 인증, 유틸리티
 */
'use strict';

/* ── DOM 유틸 ──────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
function off(el, evt, fn) { if (el) el.removeEventListener(evt, fn); }

// Global listener to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const openDropdowns = $$('.open.custom-ticket-dropdown, .open.gallery-layout-dropdown, .open.mypage-more-dropdown, .cat-dropdown');
  openDropdowns.forEach(dropdown => {
    // Some dropdowns like cat-dropdown use display:none, others use .open class
    if (dropdown.classList.contains('cat-dropdown')) {
      const parentNav = dropdown.closest('.nav-item');
      if (parentNav && !parentNav.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    } else {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    }
  });
});

/* ── 포맷 헬퍼 ─────────────────────────────────────────────── */
function formatKRW(amount) {
  if (!amount || amount === 0) return '무료';
  return Number(amount).toLocaleString('ko-KR') + '원';
}
function formatDate(iso, withDay = false) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const base = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  return withDay ? `${base} (${days[d.getDay()]})` : base;
}
function formatDateKo(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function maskName(name) {
  if (!name || name.length < 2) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}
function calcDday(start, end) {
  if (!start) return '종료';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const s = new Date(start);
  if (isNaN(s)) return '종료';
  s.setHours(0, 0, 0, 0);

  if (end) {
    const e = new Date(end);
    if (!isNaN(e)) {
      e.setHours(0, 0, 0, 0);
      if (today >= s && today <= e) {
        const diff = Math.round((e - today) / 86400000);
        return diff === 0 ? '오늘종료' : `진행중(D-${diff})`;
      }
      if (today > e) return '종료';
    }
  }
  const diff = Math.round((s - today) / 86400000);
  if (diff < 0) return '종료';
  if (diff === 0) return 'D-DAY';
  return `D-${diff}`;
}

const GRADE_INFO = {
  Bronze: { next: 'Silver', nextAmount: 100000, color: 'var(--grade-bronze)' },
  Silver: { next: 'Gold', nextAmount: 300000, color: 'var(--grade-silver)' },
  Gold: { next: 'VIP', nextAmount: 700000, color: 'var(--grade-gold)' },
  VIP: { next: 'VVIP', nextAmount: 1500000, color: 'var(--grade-vip)' },
  VVIP: { next: null, nextAmount: null, color: 'var(--grade-vvip)' },
};
function getGradeClass(grade) { return `grade-${(grade || 'bronze').toLowerCase()}`; }
function getGradeProgress(grade, total) {
  const info = GRADE_INFO[grade];
  if (!info || !info.nextAmount) return 100;
  const prev = { Bronze: 0, Silver: 100000, Gold: 300000, VIP: 700000, VVIP: 1500000 };
  return Math.min(100, Math.round((total - prev[grade]) / (info.nextAmount - prev[grade]) * 100));
}

/* ── 카테고리 매핑 ─────────────────────────────────────────── */
const CAT_LABEL = {
  concert: '콘서트', musical: '뮤지컬', play: '연극',
  classic: '클래식/무용', exhibition: '전시/스포츠',
  family: '가족/어린이', local: '지역축제',
  univ: '대학축제', expo: '박람회', all: '전체',
};
const CAT_SUBNAV = {
  concert: ['전체보기', '국내뮤지션', '해외뮤지션', '페스티벌'],
  musical: [],
  play: [],
  classic: ['전체보기', '클래식', '발레/무용', '국악'],
  exhibition: ['전체보기', '전시', '체험/행사', '스포츠'],
  family: [],
  local: [],
  univ: [],
  expo: [],
  all: [],
};

/* ── 인증 상태 ─────────────────────────────────────────────── */
const Auth = {
  KEY: 'festio_user',
  save(d) { try { sessionStorage.setItem(this.KEY, JSON.stringify(d)); } catch (e) { } },
  get() { try { return JSON.parse(sessionStorage.getItem(this.KEY)); } catch (e) { return null; } },
  isLoggedIn() {
    return !!this.get() || localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true' || !!localStorage.getItem('userToken');
  },
  clear() { sessionStorage.removeItem(this.KEY); },
  seedMock() {
    if (!this.isLoggedIn() && window.MOCK_DATA) this.save(window.MOCK_DATA?.member || null);
  },
};

/* ── 최근 본 상품 ──────────────────────────────────────────── */
const RecentViewed = {
  KEY: 'festio_recent',
  MAX: 10,
  get() {
    try {
      let rawList = JSON.parse(localStorage.getItem(this.KEY)) || [];
      let uniqueMap = new Map();
      rawList.forEach(item => {
        let key = String(item.eventNo);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item);
        } else if (!uniqueMap.get(key).thumbnailUrl && item.thumbnailUrl) {
          uniqueMap.set(key, item); // 썸네일 있는 데이터 우선
        }
      });
      let uniqueList = Array.from(uniqueMap.values());

      // 썸네일 없는 과거 캐시 데이터 복구 시도
      let changed = false;
      uniqueList = uniqueList.map(item => {
        if (!item.thumbnailUrl && window._events) {
          const ev = window._events.find(e => String(e.eventNo || e.id) === String(item.eventNo));
          if (ev && (ev.thumbnailUrl || ev.thumbnail_url)) {
            item.thumbnailUrl = ev.thumbnailUrl || ev.thumbnail_url;
            changed = true;
          }
        }
        return item;
      });

      if (rawList.length !== uniqueList.length || changed) {
        localStorage.setItem(this.KEY, JSON.stringify(uniqueList));
      }
      return uniqueList;
    } catch { return []; }
  },
  add(item) {
    try {
      let list = this.get().filter(i => String(i.eventNo) !== String(item.eventNo));
      list.unshift(item);
      list = list.slice(0, this.MAX);
      localStorage.setItem(this.KEY, JSON.stringify(list));
    } catch { }
  },
  render() {
    const track = document.querySelector('.recent-track-override');
    if (!track) return;
    const list = this.get();
    if (!list.length) {
      track.innerHTML = `
      <div class="recent-item recent-item-override">
        <div class="recent-poster-wrap recent-poster-pad">
          <div class="recent-empty-poster">
            <span class="recent-empty-text">최근 본 상품이<br>없습니다.</span>
          </div>
        </div>
      </div>`;
      return;
    }
    const total = list.length;
    track.innerHTML = list.map((item, index) => `
      <div class="recent-item recent-item-override">
        <div class="recent-poster-wrap recent-poster-pad recent-poster-link" data-event-no="${item.eventNo}">
          ${item.thumbnailUrl
        ? `<img src="${item.thumbnailUrl}" alt="${item.name}" class="recent-poster-img recent-poster-full">`
        : `<div class="recent-poster-placeholder"></div>`}
        </div>
        <div class="recent-page-indicator"><strong class="recent-page-num">${index + 1}</strong> / ${total}</div>
      </div>
    `).join('');

    // 이벤트 위임으로 카드 클릭 처리 (onclick 인라인 제거)
    track.querySelectorAll('.recent-poster-link').forEach(el => {
      el.addEventListener('click', () => {
        location.href = `detail.html?eventNo=${el.dataset.eventNo}`;
      });
    });
  },
};

/* ══ 사이드 패널 ══════════════════════════════════════════════ */
const SidePanel = {
  _open: false,
  open() {
    const panel = document.getElementById('sidePanel');
    const overlay = document.getElementById('sideOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (!panel || !overlay) return;
    panel.classList.add('active');
    overlay.classList.add('active');
    btn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    this._open = true;
    RecentViewed.render();
  },
  close() {
    const panel = document.getElementById('sidePanel');
    const overlay = document.getElementById('sideOverlay');
    const btn = document.getElementById('hamburgerBtn');
    if (!panel || !overlay) return;
    panel.classList.remove('active');
    overlay.classList.remove('active');
    btn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    this._open = false;
  },
  toggle() { this._open ? this.close() : this.open(); },
};

function initSidePanel() {
  on(document.getElementById('hamburgerBtn'), 'click', () => SidePanel.toggle());
  on(document.getElementById('sideClose'), 'click', () => SidePanel.close());
  on(document.getElementById('sideOverlay'), 'click', () => SidePanel.close());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && SidePanel._open) SidePanel.close();
  });

  // 사이드 서브메뉴 드롭다운
  on(document.getElementById('sidePanel'), 'click', e => {
    const catItem = e.target.closest('.side-cat-item[data-submenu]');
    if (catItem) {
      const submenuId = catItem.dataset.submenu;
      const submenu = document.getElementById(submenuId);
      if (!submenu) return;
      const isOpen = submenu.classList.contains('open');
      // 모두 닫기
      $$('.side-submenu.open').forEach(sm => sm.classList.remove('open'));
      $$('.side-cat-item.open').forEach(ci => ci.classList.remove('open'));
      if (!isOpen) {
        submenu.classList.add('open');
        catItem.classList.add('open');
      }
      return;
    }

    // 카테고리 선택 (서브아이템 포함)
    const subitem = e.target.closest('.side-subitem[data-cat]');
    const catOnly = e.target.closest('.side-cat-item:not([data-submenu])[data-cat]');
    const target = subitem || catOnly;
    if (target) {
      const cat = target.dataset.cat;
      const sub = target.dataset.sub || 'all';
      SidePanel.close();
      navigateCat(cat, sub);
    }
  });
}

/* ── 헤더 카테고리 드롭다운 (데스크톱) ─────────────────────── */
function initHeaderCatDropdowns() {
  const navItems = $$('.header-cat-item');
  navItems.forEach(item => {
    on(item, 'click', () => {
      const isOpen = item.classList.contains('open');
      navItems.forEach(i => i.classList.remove('open'));
      if (!isOpen && item.querySelector('.cat-dropdown')) {
        item.classList.add('open');
      } else if (!item.querySelector('.cat-dropdown')) {
        const cat = item.dataset.cat;
        navigateCat(cat, 'all');
      }
    });
    const dropdown = item.querySelector('.cat-dropdown');
    if (dropdown) {
      on(dropdown, 'click', e => {
        const di = e.target.closest('.cat-dropdown-item');
        if (di) {
          navItems.forEach(i => i.classList.remove('open'));

          // Force hide dropdown to break CSS :hover state
          dropdown.style.display = 'none';
          setTimeout(() => { dropdown.style.display = ''; }, 50);

          navigateCat(di.dataset.cat, di.dataset.sub || 'all');
        }
      });
    }
  });
  // 외부 클릭으로 닫기
  document.addEventListener('click', e => {
    if (!e.target.closest('.header-cat-item')) {
      navItems.forEach(i => i.classList.remove('open'));
    }
  });
}

/* ── 카테고리 라우팅 ────────────────────────────────────────── */
function navigateCat(cat, sub) {
  window.location.href = `list.html?category=${cat}&sub=${sub || 'all'}`;
}

/* ── 정렬 버튼 ─────────────────────────────────────────────── */
function initSortButtons() {
  on(document, 'click', e => {
    const btn = e.target.closest('[data-sort]');
    if (!btn) return;
    const group = btn.closest('.results-sort, .desktop-subnav-right');
    if (!group) return;
    group.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (typeof window.applySort === 'function') window.applySort(btn.dataset.sort);
  });
}

/* ── 데스크톱 서브탭 렌더링 ─────────────────────────────────── */
function renderDesktopSubnav(cat, activeSub) {
  const container = document.getElementById('subnavItems');
  if (!container) return;
  const subs = CAT_SUBNAV[cat] || [];
  if (!subs.length) { container.innerHTML = ''; return; }
  container.innerHTML = subs.map((sub, i) => {
    const subKey = sub === '전체보기' ? 'all' : sub;
    const isActive = (activeSub === subKey) || (i === 0 && (!activeSub || activeSub === 'all'));
    return `<button class="desktop-subnav-item ${isActive ? 'active' : ''}" data-sub="${subKey}">${sub}</button>`;
  }).join('');
  on(container, 'click', e => {
    const item = e.target.closest('.desktop-subnav-item');
    if (!item) return;
    container.querySelectorAll('.desktop-subnav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    if (typeof window.applySubCategory === 'function') window.applySubCategory(item.dataset.sub);
  });
}

/* ── 모달 시스템 ────────────────────────────────────────────── */
const Modal = {
  _stack: [],
  open(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active');
    this._stack.push(id);
    document.body.style.overflow = 'hidden';
    on(el, 'click', e => { if (e.target === el) this.close(id); });
  },
  close(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active');
    this._stack = this._stack.filter(i => i !== id);
    if (!this._stack.length) document.body.style.overflow = '';
    el.dispatchEvent(new CustomEvent('modalClose', { bubbles: true }));
  },
  closeAll() {
    this._stack.forEach(id => document.getElementById(id)?.classList.remove('active'));
    this._stack = [];
    document.body.style.overflow = '';
  },
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && Modal._stack.length) Modal.close(Modal._stack.at(-1));
});

/* ── [data-close-modal] 공통 닫기 ──────────────────────────── */
function initModalCloseBtns() {
  on(document, 'click', e => {
    const btn = e.target.closest('[data-close-modal]');
    if (!btn) return;
    const id = btn.dataset.closeModal;
    if (id) Modal.close(id);
    else { const ov = btn.closest('.modal-overlay'); if (ov) Modal.close(ov.id); }
  });
}

/* ── 토스트 ────────────────────────────────────────────────── */
const Toast = {
  _el: null, _active: 0, MAX: 3,
  _icon(type) {
    const icons = {
      success: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg class="icon toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };
    return icons[type] || icons.info;
  },
  _container() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'toast-container';
      this._el.setAttribute('aria-live', 'polite');
      document.body.appendChild(this._el);
    }
    return this._el;
  },
  show(msg, type = 'info', dur = 3200) {
    if (this._active >= this.MAX) return;
    const c = this._container();
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `${this._icon(type)}<span class="toast-message">${msg}</span>`;
    c.appendChild(t);
    this._active++;
    const rm = () => {
      t.classList.add('toast-exit');
      setTimeout(() => { t.remove(); this._active = Math.max(0, this._active - 1); }, 300);
    };
    setTimeout(rm, dur);
    on(t, 'click', rm);
  },
  success: (m, d) => Toast.show(m, 'success', d),
  error: (m, d) => Toast.show(m, 'error', d),
  warning: (m, d) => Toast.show(m, 'warning', d),
  info: (m, d) => Toast.show(m, 'info', d),
};

/* ── 하단 네비 active ───────────────────────────────────────── */
function initBottomNav() {
  const path = window.location.pathname;
  const file = path.split('/').pop() || 'index.html';
  const map = { 'index.html': 0, '': 0, 'list.html': 1, 'detail.html': 2, 'mypage.html': 4 };
  const idx = map[file] ?? -1;
  $$('.bottom-nav-item').forEach((item, i) => {
    item.classList.toggle('active', i === idx);
  });
}

function initMobileSearch() {
  const headerSearchBtns = $$('.mobile-search-btn');
  const input = document.getElementById('mobileSearchInput');
  const searchBtnExecute = document.getElementById('btn-mobile-search-execute');

  headerSearchBtns.forEach(btn => {
    on(btn, 'click', () => {
      Modal.open('modal-mobile-search');
      setTimeout(() => input?.focus(), 100);
    });
  });

  const performSearch = (val) => {
    if (val && val.trim() !== '') {
      Modal.close('modal-mobile-search');
      window.location.href = `list.html?search=${encodeURIComponent(val.trim())}`;
    }
  };

  if (input) {
    on(input, 'keydown', (e) => {
      if (e.key === 'Enter') performSearch(input.value);
    });
  }
  if (searchBtnExecute) {
    on(searchBtnExecute, 'click', () => performSearch(input.value));
  }

  const headerInput = document.getElementById('headerSearch');
  if (headerInput) {
    on(headerInput, 'keydown', (e) => {
      if (e.key === 'Enter') performSearch(headerInput.value);
    });
  }
}

/* ── back button ────────────────────────────────────────────── */
function initBackButton() {
  const btn = $('.header-back-btn');
  if (!btn) return;
  on(btn, 'click', () => window.history.length > 1 ? window.history.back() : location.href = 'index.html');
}

/* ── 데스크톱 검색바 토글 ───────────────────────────────────── */
function initDesktopSearchToggle() {
  const searchBar = $('.header-search-bar');
  if (!searchBar) return;

  on(searchBar, 'click', e => {
    if (!searchBar.classList.contains('active')) {
      e.preventDefault();
      searchBar.classList.add('active');
      const input = searchBar.querySelector('.header-search-input');
      if (input) setTimeout(() => input.focus(), 100);
    }
  });

  document.addEventListener('click', e => {
    if (searchBar.classList.contains('active') && !searchBar.contains(e.target)) {
      searchBar.classList.remove('active');
    }
  });
}

/* ── 헤더 스크롤 색상 ───────────────────────────────────────── */
function initHeaderScroll() {
  const header = $('.app-header');
  if (!header) return;

  // 최초 로드 시 적용
  if (window.scrollY > 50) header.classList.add('scrolled');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
}

/* ── DOMContentLoaded ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Auth.seedMock();
  initSidePanel();
  initHeaderCatDropdowns();
  initSortButtons();
  initModalCloseBtns();
  initBottomNav();
  initMobileSearch();
  initBackButton();
  initDesktopSearchToggle();
  initHeaderScroll();

  // 글로벌 로그아웃 이벤트 (이벤트 위임)
  document.addEventListener('click', (e) => {
    const logoutBtn = e.target.closest('#btn-logout, #sideLogoutBtn');
    if (logoutBtn) {
      e.preventDefault();

      localStorage.removeItem('userToken');
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      localStorage.removeItem('email');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userPhone');
      localStorage.removeItem('balance');
      localStorage.removeItem('isFaceRegistered');

      if (window.Auth) {
        window.Auth.clear();
      }

      alert('로그아웃 되었습니다.');
      window.location.href = 'index.html';
    }
  });

  initFestioNotifications();
});

/* ── FESTIO 알림 시스템 ─────────────────────────────────────── */
function initFestioNotifications() {
  const btnHeaderNotification = document.getElementById('btnHeaderNotification');
  const festioNotiDropdown = document.getElementById('festioNotiDropdown');
  if (btnHeaderNotification && festioNotiDropdown) {
    on(btnHeaderNotification, 'click', (e) => {
      e.stopPropagation();
      festioNotiDropdown.style.display = festioNotiDropdown.style.display === 'flex' ? 'none' : 'flex';
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.hdr-noti-menu')) {
        festioNotiDropdown.style.display = 'none';
      }
    });
  }

  const notiThemeToggle = document.getElementById('notiThemeToggle');
  const notiModalSheet = document.getElementById('festioNotiDropdown');
  if (notiThemeToggle && notiModalSheet) {
    notiThemeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        notiModalSheet.classList.add('dark-mode');
      } else {
        notiModalSheet.classList.remove('dark-mode');
      }
    });
  }

  const btnNotiReadAll = document.getElementById('btnNotiReadAll');
  if (btnNotiReadAll) {
    btnNotiReadAll.addEventListener('click', () => {
      const listContainer = document.getElementById('festioNotiListContainer');
      if (listContainer) {
        listContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--g500);">새로운 알림이 없습니다.</div>';
      }
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
      }
      const headCount = document.getElementById('notiHeadCount');
      if (headCount) headCount.textContent = '0';

      localStorage.removeItem('festioMockNotifications');
      Toast.success('모든 알림을 읽음 처리했습니다.');

      const festioNotiDropdown = document.getElementById('festioNotiDropdown');
      if (festioNotiDropdown) festioNotiDropdown.style.display = 'none';
    });
  }

  if (Auth.isLoggedIn()) {
    fetchFestioNotifications();
    setInterval(fetchFestioNotifications, 10000);

    // 알림 활성화 초기 토스트 및 목업 시뮬레이션
    const isNotiEnabled = localStorage.getItem('notiEnabled') === 'true';
    if (isNotiEnabled) {
      const toastShown = sessionStorage.getItem('notiEnabledToastShown_Festio');
      if (!toastShown) {
        setTimeout(() => Toast.info('알림이 활성화되어 있습니다.'), 500);
        sessionStorage.setItem('notiEnabledToastShown_Festio', 'true');
      }

      // 알림 대기 테스트를 위한 가상 타이머 (15초마다 발생)
      setInterval(() => {
        if (localStorage.getItem('notiEnabled') === 'true') {
          Toast.info('새로운 행사 소식이 도착했습니다!');
          const badge = document.getElementById('notificationBadge');
          if (badge) {
            badge.style.display = 'block';
            badge.textContent = parseInt(badge.textContent || '0') + 1;
          }
        }
      }, 15000);
    }
  }
}

function fetchFestioNotifications() {
  const listContainer = document.getElementById('festioNotiListContainer');
  const badge = document.getElementById('notificationBadge');
  if (!listContainer || !badge) return;

  // 실제로는 API 호출을 통해 알림 데이터를 가져옵니다.
  // 여기서는 로컬 스토리지 또는 목업 데이터를 시뮬레이션합니다.
  let notifs = JSON.parse(localStorage.getItem('festioMockNotifications') || '[]');

  if (notifs.length === 0) {
    // 테스트용 임시 알림 생성
    notifs = [
      { id: 1, type: 'WISH', title: '관심 행사', msg: '선택하신 행사가 찜 목록에 추가되었습니다.' },
      { id: 2, type: 'PAID', title: '결제 완료', msg: '행사 티켓의 결제 및 예매가 성공적으로 완료되었습니다.' },
      { id: 3, type: 'GRADE_UP', title: '등급 혜택', msg: '축하합니다! 멤버십 등급이 상승했습니다. 🎉' }
    ];
    localStorage.setItem('festioMockNotifications', JSON.stringify(notifs));
  }

  const headCount = document.getElementById('notiHeadCount');

  if (notifs.length > 0) {
    badge.style.display = 'block';
    badge.textContent = notifs.length;
    if (headCount) headCount.textContent = notifs.length;

    listContainer.innerHTML = notifs.map((n, idx) => {
      let iconSvg = '';
      if (n.type === 'WISH') iconSvg = '<svg viewBox="0 0 24 24" fill="#6a4dff" style="width:20px;height:20px;"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>';
      else if (n.type === 'PAID' || n.type === 'ORDER') iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#6a4dff" stroke-width="2" style="width:20px;height:20px;"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
      else if (n.type === 'GRADE_UP' || n.type === 'GRADE') iconSvg = '<span style="font-size:18px;">🎉</span>';
      else if (n.type === 'QNA_ANSWERED') iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#6a4dff" stroke-width="2" style="width:20px;height:20px;"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>';
      else if (n.type === 'CHECK_IN') iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#6a4dff" stroke-width="2" style="width:20px;height:20px;"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      else iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

      return `
        <div class="noti-item" style="display:flex; gap:12px; padding:16px; border-bottom:1px solid var(--border-color); align-items:flex-start; animation-delay:${idx * 0.08}s;">
          <div class="noti-icon-wrap" style="flex-shrink:0; width:36px; height:36px; border-radius:50%; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; transition: transform 0.2s;">
            ${iconSvg}
          </div>
          <div class="noti-content">
            <strong style="display:block; font-size:14px; margin-bottom:4px; color:var(--text-primary);">${n.title}</strong>
            <p style="margin:0; font-size:13px; color:var(--text-secondary); line-height:1.4;">${n.msg}</p>
          </div>
        </div>
      `;
    }).join('');
  } else {
    badge.style.display = 'none';
    badge.textContent = '0';
    listContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary);">새로운 알림이 없습니다.</div>';
  }
}

/* ── 12자리 암호화 바코드 유틸리티 ──────────────────────────── */
const BarcodeUtils = {
  MASK_FIXED: 80000000000000000n, // 11자리 난수 보장을 위한 53비트 마스크
  MASK_DYNAMIC: 90000000000000000n,

  // 고정 12자리 번호 생성 (분류코드 + 암호화된 orderId)
  encodeFixedOrder(prefix, orderId) {
    const obf = BigInt(orderId) ^ this.MASK_FIXED;
    const base36 = obf.toString(36).toUpperCase();
    return prefix + base36.padStart(11, '0');
  },

  decodeFixedOrder(fixedStr) {
    const base36 = fixedStr.substring(1);
    let obf = 0n;
    for (let i = 0; i < base36.length; i++) {
      const code = base36.charCodeAt(i);
      let val = 0n;
      if (code >= 48 && code <= 57) val = BigInt(code - 48);
      else if (code >= 65 && code <= 90) val = BigInt(code - 65 + 10);
      else if (code >= 97 && code <= 122) val = BigInt(code - 97 + 10);
      obf = obf * 36n + val;
    }
    const orderId = obf ^ this.MASK_FIXED;
    return Number(orderId);
  },

  // 동적 12자리 바코드 생성 (분류코드 + orderId와 TOTP가 결합된 암호)
  encodeDynamicBarcode(prefix, orderId, totp) {
    const combined = BigInt(orderId) * 1000000n + BigInt(totp);
    const obf = combined ^ this.MASK_DYNAMIC;
    const base36 = obf.toString(36).toUpperCase();
    return prefix + base36.padStart(11, '0');
  },

  decodeDynamicBarcode(dynamicStr) {
    const base36 = dynamicStr.substring(1);
    let obf = 0n;
    for (let i = 0; i < base36.length; i++) {
      const code = base36.charCodeAt(i);
      let val = 0n;
      if (code >= 48 && code <= 57) val = BigInt(code - 48);
      else if (code >= 65 && code <= 90) val = BigInt(code - 65 + 10);
      else if (code >= 97 && code <= 122) val = BigInt(code - 97 + 10);
      obf = obf * 36n + val;
    }
    const combined = obf ^ this.MASK_DYNAMIC;
    const orderId = Number(combined / 1000000n);
    const totp = Number(combined % 1000000n);
    return { orderId, totp };
  }
};

/* ── 전역 노출 ──────────────────────────────────────────────── */
window.$ = $; window.$$ = $$; window.on = on; window.off = off;
window.formatKRW = formatKRW;
window.formatDate = formatDate;
window.formatDateKo = formatDateKo;
window.maskName = maskName;
window.calcDday = calcDday;
window.GRADE_INFO = GRADE_INFO;
window.getGradeClass = getGradeClass;
window.getGradeProgress = getGradeProgress;
window.CAT_LABEL = CAT_LABEL;
window.CAT_SUBNAV = CAT_SUBNAV;
window.Modal = Modal;
window.Toast = Toast;
window.Auth = Auth;
window.RecentViewed = RecentViewed;
window.SidePanel = SidePanel;
window.renderDesktopSubnav = renderDesktopSubnav;
