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
});

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
