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
      <input type="search" id="festioGlobalSearch" name="festio_q" placeholder="굿즈, 푸드트럭, 브랜드 검색…" autocomplete="off" aria-label="상품 검색"/>
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
    let notifs = [];
    if (res.ok) {
      notifs = await res.json();
    }

    // [Mock] 추가된 알림 상태(WISH, ORDERED, CANCELLED 등) 시뮬레이션용 데이터 결합
    let mockNotifs = JSON.parse(localStorage.getItem('shopMockNotifications') || '[]');

    // [Mock] 현장 픽업 미수령 독촉 알림 타이머 로직 (테스트 편의상 1분 단위 동작)
    const now = Date.now();
    let hasRemindChanges = false;
    mockNotifs = mockNotifs.map(n => {
      if (n.status === 'READY' && n.pickupTime) {
        const diffMinutes = (now - n.pickupTime) / 60000;
        if (diffMinutes >= 2 && !n.remind2Sent) {
          n.status = 'REMIND_2';
          n.remind2Sent = true;
          hasRemindChanges = true;
          // 토스트로 즉각 알림
          Toast.show({ title: '픽업 리마인드', msg: '따뜻하고 맛있을 때 드실 수 있도록 지금 확인 후 수령 부탁드립니다.', type: 'warning' });
        } else if (diffMinutes >= 1 && diffMinutes < 2 && !n.remind1Sent) {
          n.status = 'REMIND_1';
          n.remind1Sent = true;
          hasRemindChanges = true;
          Toast.show({ title: '픽업 리마인드', msg: '준비된 음식을 아직 기다리고 있어요.', type: 'warning' });
        }
      }
      return n;
    });

    if (hasRemindChanges) {
      localStorage.setItem('shopMockNotifications', JSON.stringify(mockNotifs));
    }

    // API 알림과 Mock 알림 병합
    notifs = [...mockNotifs, ...notifs];
    // 카운트는 안읽은 알림 기준
    let unreadCount = notifs.filter(n => !n.is_read).length;

    const badge = document.getElementById('notiBadgeCount');
    const headCount = document.getElementById('notiHeadCount');
    const listContainer = document.getElementById('notiListContainer');

    if (badge && headCount && listContainer) {
      if (notifs.length > 0) {
        if (unreadCount > 0) {
          badge.style.display = 'flex';
          badge.textContent = unreadCount;
        } else {
          badge.style.display = 'none';
          badge.textContent = '0';
        }
        headCount.textContent = unreadCount;

        const userName = Session.get()?.name || '고객';

        listContainer.innerHTML = notifs.map(n => {
          let title = '';
          let msg = '';
          let iconSvg = '';

          if (n.status === 'WISH') { title = '관심 상품'; msg = `[${n.name}] 관심 상품/가게에 추가되었습니다.`; iconSvg = '💖'; }
          else if (n.status === 'ORDERED') { title = '주문 완료'; msg = `[${n.name}] 상품의 주문/결제가 완료되었습니다.`; iconSvg = '💳'; }
          else if (n.status === 'CANCELLED' || n.status === 'REFUNDED') {
            title = '취소/환불';
            msg = `[${n.name}] 상품 주문이 정상적으로 취소 및 환불 처리되었습니다.`;
            iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
          }
          else if (n.status === 'COOKING') { title = '조리 시작'; msg = `[${n.name}] 조리/포장이 시작되었습니다.`; iconSvg = '👨‍🍳'; }
          else if (n.status === 'PREPARING') { title = '상품 준비 중'; msg = `[${n.name}] 주문하신 상품을 준비하고 있습니다.`; iconSvg = '📦'; }
          else if (n.status === 'READY') { title = '픽업 안내'; msg = `[${n.name}] 주문하신 상품이 준비되었습니다. 수령처에서 픽업해 주세요.`; iconSvg = '🎁'; }
          else if (n.status === 'REMIND_1') { title = '픽업 리마인드'; msg = `${userName}님, 준비된 음식을 아직 기다리고 있어요.`; iconSvg = '⏰'; }
          else if (n.status === 'REMIND_2') { title = '픽업 리마인드'; msg = `${userName}님, 따뜻하고 맛있을 때 드실 수 있도록 지금 확인 후 수령 부탁드립니다.`; iconSvg = '🔥'; }
          else if (n.status === 'SERVED') { title = '수령 완료'; msg = `[${n.name}] 정상 수령 처리되었습니다.`; iconSvg = '✅'; }
          else if (n.status === 'SHIPPING') { title = '배송 시작'; msg = `[${n.name}] 주문하신 상품이 택배사로 인계되었습니다.`; iconSvg = '🚚'; }
          else if (n.status === 'DELIVERED') { title = '배송 완료'; msg = `[${n.name}] 상품 배송이 완료되었습니다.`; iconSvg = '📫'; }
          else { title = '알림'; msg = `[${n.name}] 상태가 변경되었습니다.`; iconSvg = '🔔'; }

          const svgContainer = iconSvg.startsWith('<svg') ? iconSvg : `<span style="font-size:16px;line-height:1;">${iconSvg}</span>`;
          const nId = n.id || n.status;
          const bgColor = n.is_read ? 'transparent' : 'rgba(42, 193, 188, 0.05)';

          return `
            <a href="orders.html" class="noti-item unread" data-id="${nId}" onclick="markShopNotifRead(event, '${nId}')" style="display:flex; gap:10px; align-items:flex-start; background-color:${bgColor};">
              <div style="flex-shrink:0; display:flex; align-items:center; justify-content:center; width:28px; height:28px; background:var(--g100); border-radius:50%;">${svgContainer}</div>
              <div class="noti-text" style="flex:1;">
                <strong style="display:block; font-size:13px; margin-bottom:2px;">${title}</strong>
                <span style="font-size:12px; color:var(--g500); line-height:1.4;">${msg}</span>
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
  } catch (e) { console.error(e); }
}

function refreshCartBadge() {
  const b = document.getElementById('cartBadge');
  if (!b) return;
  const cart = JSON.parse(localStorage.getItem('fs_cart') || '[]');
  const n = cart.reduce((s, i) => s + i.qty, 0);
  b.textContent = n > 99 ? '99+' : n;
  b.style.display = n > 0 ? 'flex' : 'none';
}

window.markShopNotifRead = function (e, id) {
  let mockNotifs = JSON.parse(localStorage.getItem('shopMockNotifications') || '[]');
  let target = mockNotifs.find(n => String(n.id) === String(id) || String(n.status) === String(id));
  if (target) {
    target.is_read = true;
    localStorage.setItem('shopMockNotifications', JSON.stringify(mockNotifs));
  }
  // API 알림도 처리해야 한다면 fetch(/api/order/notifications/markAsRead) 구현 가능
};

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
          <div style="position: relative;">
            <input class="finput" type="password" id="mPw" placeholder="비밀번호" autocomplete="current-password" style="padding-right: 40px;"/>
            <button type="button" id="mPwToggle" aria-label="비밀번호 표시" style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; color: #a8a8a8; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px;">
              <svg id="eyeIconOpen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg id="eyeIconClosed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
          </div>
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

    const pwToggle = document.getElementById('mPwToggle');
    const pwInput = document.getElementById('mPw');
    const eyeOpen = document.getElementById('eyeIconOpen');
    const eyeClosed = document.getElementById('eyeIconClosed');
    if (pwToggle && pwInput) {
      pwToggle.addEventListener('click', () => {
        const isPw = pwInput.type === 'password';
        pwInput.type = isPw ? 'text' : 'password';
        eyeOpen.style.display = isPw ? 'block' : 'none';
        eyeClosed.style.display = isPw ? 'none' : 'block';
      });
    }
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
window.FS = { Session, Toast, LoginModal, renderHeader, refreshCartBadge, requireLogin, startMockAlerts, fetchNotifications, BarcodeUtils };

/* Floating NPC Chatbot */
document.addEventListener('DOMContentLoaded', () => {
  const npcContainer = document.createElement('div');
  npcContainer.className = 'floating-npc-btn';
  npcContainer.onclick = () => {
    window.location.href = '/Festio/index.html';
  };

  npcContainer.innerHTML = `
    <div class="floating-npc-bubble">
      축제 메인으로 돌아갈까요?
    </div>
    <div class="floating-npc-avatar" style="user-select: none;">
      <img src="/assets/img/avatars/chibi_admin.png" alt="FESTIO Admin NPC" draggable="false" style="pointer-events: none; user-select: none;">
    </div>
  `;

  document.body.appendChild(npcContainer);
});
