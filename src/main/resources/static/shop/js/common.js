'use strict';
/* ================================================================
   FESTIO SHOP — common.js
   헤더 렌더, 토스트, 로그인 모달, 세션, 비로그인 인터셉터
   ================================================================ */

/* ── 세션 ───────────────────────────────────────────────────── */
const Session = {
  isLoggedIn() { return !!(localStorage.getItem('isLoggedIn') || sessionStorage.getItem('isLoggedIn')) },
  get() {
    if (!this.isLoggedIn()) return null;
    const storage = localStorage.getItem('isLoggedIn') ? localStorage : sessionStorage;
    return { name: storage.getItem('userName'), email: storage.getItem('email'), role: storage.getItem('userRole') };
  },
  logout() {
    ['isLoggedIn', 'userToken', 'userName', 'email', 'userRole', 'userSpecificRole', 'userPhone'].forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  }
};

/* ── 헤더 렌더 ──────────────────────────────────────────────── */
function renderHeader() {
  const el = document.querySelector('.site-header');
  if (!el) return;
  const logged = Session.isLoggedIn();
  const user = Session.get();
  el.innerHTML = `
  <div class="container hdr-inner" style="display:flex; align-items:center;">
    <div style="display:flex; align-items:center; gap:2px;">
      <a href="javascript:history.back()" class="hdr-back-btn" aria-label="뒤로가기" style="display:flex; align-items:center; justify-content:center; width:32px; height:32px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </a>
      <a href="shop.html" class="hdr-logo" aria-label="FESTIO SHOP 홈">
        <div class="hdr-logo-text">
          <span class="hdr-logo-name festio-gradient">FESTIO</span>
          <span class="hdr-logo-sub">SHOP</span>
        </div>
      </a>
    </div>

    <div class="hdr-search">
      <span class="hdr-search-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.6"/>
          <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </span>
      <input type="search" id="festioGlobalSearch" name="festio_q" placeholder="굿즈, 푸드트럭, 브랜드 검색…" autocomplete="new-password" aria-label="상품 검색"/>
    </div>

    <div class="hdr-actions">
      ${logged ? `
      <div class="hdr-noti-menu" style="position:relative;">
        <button class="hdr-icon-btn" id="btnNotiDrop" aria-label="알림">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2a5 5 0 0 0-5 5v3.5l-2 3v1h14v-1l-2-3V7a5 5 0 0 0-5-5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M9 16.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
          <span class="cart-badge" id="notiBadgeCount" style="background:var(--blue); display:none;">0</span>
        </button>
        <div class="noti-dropdown" id="notiDropdown">
          <div class="noti-head">알림 <span class="noti-count" id="notiHeadCount">0</span></div>
          <div class="noti-list" id="notiListContainer">
            <!-- 동적 알림 로드 -->
          </div>
          <a href="mypage.html" class="noti-foot">알림 설정 및 전체보기</a>
        </div>
      </div>` : ''}

      <a href="cart.html" class="hdr-icon-btn" aria-label="장바구니">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M2.5 2.5h2.2l2.6 9.6A2 2 0 0 0 9.2 13.5H17a2 2 0 0 0 1.95-1.57L20.5 6.5H5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="9.5" cy="18" r="1.5" fill="currentColor"/>
          <circle cx="16.5" cy="18" r="1.5" fill="currentColor"/>
        </svg>
        <span class="cart-badge" id="cartBadge" style="display:none">0</span>
      </a>

      ${logged
      ? `<div class="hdr-user-menu" style="position:relative;">
           <button class="hdr-login-btn" id="btnUserDrop" style="display:flex;align-items:center;gap:6px;">
             <img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ccc' d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>" id="hdrAvatar" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" alt="Avatar" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\'><path fill=\\'%23ccc\\' d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">
             <span>${user?.name || '회원'}님 ▾</span>
           </button>
           <div class="user-dropdown" id="userDropdown">
             <a href="mypage.html">마이페이지</a>
             <a href="orders.html">주문/배송조회</a>
             <div class="ud-hr"></div>
             <button id="btnLogout">로그아웃</button>
           </div>
         </div>`
      : `<button class="hdr-login-btn" id="btnOpenLogin">로그인</button>`
    }
    </div>
  </div>`;

  refreshCartBadge();

  const si = document.getElementById('hdrSearch');
  if (si) si.addEventListener('input', e => {
    document.dispatchEvent(new CustomEvent('shop:search', { detail: { q: e.target.value.trim() } }));
  });

  const bLogin = document.getElementById('btnOpenLogin');
  const bUserDrop = document.getElementById('btnUserDrop');
  const drop = document.getElementById('userDropdown');
  const bNotiDrop = document.getElementById('btnNotiDrop');
  const notiDrop = document.getElementById('notiDropdown');
  const bLogout = document.getElementById('btnLogout');

  if (bLogin) bLogin.addEventListener('click', () => LoginModal.open());

  if (bUserDrop && drop) {
    bUserDrop.addEventListener('click', (e) => {
      e.stopPropagation();
      drop.classList.toggle('show');
      if (notiDrop) notiDrop.classList.remove('show');
    });
  }

  if (bNotiDrop && notiDrop) {
    bNotiDrop.addEventListener('click', (e) => {
      e.stopPropagation();
      notiDrop.classList.toggle('show');
      if (drop) drop.classList.remove('show');
    });
  }

  document.addEventListener('click', (e) => {
    if (drop && !e.target.closest('.hdr-user-menu')) drop.classList.remove('show');
    if (notiDrop && !e.target.closest('.hdr-noti-menu')) notiDrop.classList.remove('show');
  });

  if (bLogout) bLogout.addEventListener('click', () => {
    Session.logout();
    location.reload();
  });

  // Supabase 아바타 연동
  if (logged && window.ShopDB) {
    const email = localStorage.getItem('email');
    if (email) {
      window.ShopDB.getProfile(email).then(profile => {
        if (profile && profile.avatar_url) {
          const avt = document.getElementById('hdrAvatar');
          if (avt) avt.src = profile.avatar_url;
        }
      });
    }
  }

  if (logged) {
    fetchNotifications();
    setInterval(fetchNotifications, 10000); // 10초마다 알림 폴링 (DB 반영 실시간 폴링)
  }
}

async function fetchNotifications() {
  if (!Session.isLoggedIn()) return;
  const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
  if (!token) return;

  try {
    const res = await fetch('/api/order/notifications', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    const notifs = await res.json();
    
    const badge = document.getElementById('notiBadgeCount');
    const headCount = document.getElementById('notiHeadCount');
    const listContainer = document.getElementById('notiListContainer');
    
    if (badge && headCount && listContainer) {
      if (notifs.length > 0) {
        badge.style.display = 'flex';
        badge.textContent = notifs.length;
        headCount.textContent = notifs.length;
        
        listContainer.innerHTML = notifs.map(n => {
          let title = '';
          let msg = '';
          if (n.status === 'COOKING') { title = '상품 준비 중'; msg = `[${n.name}] 조리/포장이 시작되었습니다.`; }
          else if (n.status === 'READY') { title = '준비 완료'; msg = `[${n.name}] 준비 완료! 픽업해주세요.`; }
          else if (n.status === 'SERVED') { title = '수령 완료'; msg = `[${n.name}] 정상 수령 처리되었습니다.`; }
          else if (n.status === 'SHIPPED') { title = '배송 출발'; msg = `[${n.name}] 배송이 시작되었습니다.`; }
          else { title = '알림'; msg = `[${n.name}] 상태가 변경되었습니다.`; }
          
          return `
            <a href="orders.html" class="noti-item unread">
              <div class="noti-dot"></div>
              <div class="noti-text">
                <strong>${title}</strong><br/>
                ${msg}
              </div>
            </a>
          `;
        }).join('');
      } else {
        badge.style.display = 'none';
        headCount.textContent = '0';
        listContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #888;">새로운 알림이 없습니다.</div>';
      }
    }
  } catch(e) {}
}

function refreshCartBadge() {
  const b = document.getElementById('cartBadge');
  if (!b) return;
  const cart = JSON.parse(localStorage.getItem('fs_cart') || '[]');
  const n = cart.reduce((s, i) => s + i.qty, 0);
  b.textContent = n > 99 ? '99+' : n;
  b.style.display = n > 0 ? 'flex' : 'none';
}

/* ── 토스트 ─────────────────────────────────────────────────── */
const Toast = (() => {
  let wrap;
  function getWrap() {
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13.5H1.5L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v5M8 5.5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
  };

  function show({ title, msg = '', type = 'info', dur = 4000 }) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.setAttribute('role', 'alert');
    t.innerHTML = `
      <span class="toast-ico" aria-hidden="true">${icons[type] || icons.info}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button class="toast-x" aria-label="닫기">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>`;
    getWrap().appendChild(t);
    t.querySelector('.toast-x').addEventListener('click', () => dismiss(t));
    if (dur > 0) setTimeout(() => dismiss(t), dur);
  }

  function dismiss(t) {
    if (!t.isConnected) return;
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }
  return { show };
})();

/* ── 로그인 모달 ────────────────────────────────────────────── */
const LoginModal = (() => {
  let el, pending = null;

  function build() {
    if (document.getElementById('loginModal')) return;
    el = document.createElement('div');
    el.className = 'modal-bg';
    el.id = 'loginModal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'modalTitle');
    el.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-title" id="modalTitle">로그인</div>
          <div class="modal-sub">FESTIO 계정으로 로그인하세요</div>
        </div>
        <button class="modal-close-btn" id="mClose" aria-label="닫기">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="fgrp">
          <label class="flabel" for="mEmail">이메일</label>
          <input class="finput" type="email" id="mEmail" placeholder="이메일" autocomplete="email"/>
        </div>
        <div class="fgrp">
          <label class="flabel" for="mPw">비밀번호</label>
          <input class="finput" type="password" id="mPw" placeholder="비밀번호" autocomplete="current-password"/>
        </div>
        <div class="ferr" id="mErr" role="alert"></div>
        <button class="btn-blk" id="mSubmit">로그인</button>
        <div class="divider-txt"><span>또는</span></div>
        <a href="login.html" class="btn-outline">회원가입</a>
        <div class="modal-foot"><a href="login.html">비밀번호를 잊으셨나요?</a></div>
      </div>
    </div>`;
    document.body.appendChild(el);

    document.getElementById('mClose').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close() });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('open')) close() });
    document.getElementById('mSubmit').addEventListener('click', submit);
    document.getElementById('mPw').addEventListener('keydown', e => { if (e.key === 'Enter') submit() });
  }

  async function submit() {
    const email = document.getElementById('mEmail').value.trim();
    const pw = document.getElementById('mPw').value;
    const err = document.getElementById('mErr');
    err.textContent = '';
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

        close();
        Toast.show({ title: '로그인 성공', msg: '쇼핑을 계속하세요!', type: 'success' });
        if (typeof pending === 'function') { pending(); pending = null }
        renderHeader();
      } else {
        const errText = await response.text();
        err.textContent = errText || '로그인에 실패했습니다.';
      }
    } catch (error) {
      err.textContent = '로그인 처리 중 예기치 못한 오류가 발생했습니다.';
    }
  }

  function open(cb = null) {
    build(); pending = cb;
    el.classList.add('open');
    setTimeout(() => { const i = document.getElementById('mEmail'); if (i) i.focus() }, 80);
  }
  function close() { if (!el) return; el.classList.remove('open'); pending = null }
  return { open, close };
})();

/* ── 비로그인 인터셉터 ──────────────────────────────────────── */
function requireLogin(cb) {
  if (Session.isLoggedIn()) cb();
  else LoginModal.open(cb);
}

/* ── 목 알림 (WebSocket 연동 포인트) ───────────────────────── */
function startMockAlerts() {
  // DB 연동으로 변경되어 Mock 기능 제거
}

/* ── 전역 노출 ──────────────────────────────────────────────── */
window.FS = { Session, Toast, LoginModal, renderHeader, refreshCartBadge, requireLogin, startMockAlerts, fetchNotifications };
