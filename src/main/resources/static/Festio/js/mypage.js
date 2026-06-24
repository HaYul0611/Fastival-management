/**
 * Festival O2O Platform — mypage.js
 * ─────────────────────────────────────────────────────────────
 * 마이페이지 고도화:
 * - 인증 가드 (비로그인 사용자 login.html 리다이렉션)
 * - 사용자 정보 동적 바인딩 (localStorage 연동)
 * - JPA DB 명세 (reservation, order_item)를 준수한 티켓 및 푸드트럭 주문 내역 바인딩
 * - 안면 인증 등록 (face-api.js 구조 유지 및 Mock 보완)
 * - 실시간 동적 QR 코드 생성 및 30초/3분 단위 만료 갱신 주기
 * - 1:1 문의 등록 및 조회 기능 동적화
 * - 로그아웃 처리
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── 상태 관리 ───────────────────────────────────────────────── */
let _member = null;
let _dbTickets = [];       // 실제 DB 결제 완료 티켓 목록
let _qrTimer = null;       // setInterval ID (3분 갱신)
let _qrCountdown = 30;
let _qrCountTimer = null;   // 1초 카운트다운
let _currentOrderNo = 1;
let _isFaceDetected = false;
let _faceApiLoaded = false;
let _videoStream = null;
let _faceDetectLoop = null;

/* QR SVG 원 둘레 (r=11) */
const QR_CIRC = 2 * Math.PI * 11; // ≈ 69.1

/* 실제 DB 결제 티켓 조회 API 연동 */
async function fetchTickets() {
  try {
    const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || '';
    const response = await fetch('/api/order/tickets/qr', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (response.ok) {
      _dbTickets = await response.json();
      console.log('실제 DB 티켓 조회 완료:', _dbTickets);
    }
  } catch (error) {
    console.error('DB 티켓 로드 실패:', error);
  }
}

/* 실제 DB 푸드트럭 주문 조회 API 연동 */
async function fetchFoodOrders() {
  try {
    const sb = window.ShopDB ? window.ShopDB.getClient() : (window.getSupabase ? window.getSupabase() : null);
    if (!sb) {
      console.warn('Supabase client not initialized.');
      return;
    }

    const email = (window.FS && window.FS.Session) ? window.FS.Session.get()?.email : localStorage.getItem('userEmail');
    if (!email) return;

    // 프로필 ID 조회
    const { data: profile } = await sb.from('shop_profiles').select('id').eq('user_email', email).maybeSingle();
    if (!profile) return;

    // 푸시 알림 구독 (실시간 알림 수신)
    if (sb.subscribeToNotifications) {
      sb.subscribeToNotifications(profile.id);
    }

    // 푸드트럭 주문 조회 (F로 시작)
    const { data: fnbOrders, error } = await sb.from('shop_orders').select(`
      *,
      shop_order_items ( product_name, quantity, price_at_purchase )
    `).eq('profile_id', profile.id).like('order_number', 'F%').order('created_at', { ascending: false });

    if (error) throw error;

    if (fnbOrders) {
      MOCK_FOOD_ORDERS = fnbOrders.map(f => {
        const item = f.shop_order_items && f.shop_order_items.length > 0 ? f.shop_order_items[0] : {};
        const productName = item.product_name || '푸드 상품';
        const quantity = item.quantity || 1;

        let statusText = '주문 완료';
        if (f.status === 'RECEIVED') statusText = '주문 접수';
        else if (f.status === 'PREPARING') statusText = '조리 중';
        else if (f.status === 'READY_FOR_PICKUP') statusText = '조리 완료 (픽업 대기)';
        else if (f.status === 'COMPLETED') statusText = '수령 완료';

        return {
          orderItemId: f.order_number,
          storeName: '푸드트럭',
          productName: productName,
          quantity: quantity,
          selectedOptions: '기본 옵션',
          pickupTimeSlot: new Date(f.created_at).toLocaleString(),
          totalPrice: f.total_amount,
          itemStatus: f.status || 'RECEIVED',
          statusText: statusText,
          qrToken: f.order_number,
          totpSecret: f.totp_secret
        };
      });
      console.log('실제 Supabase DB 푸드트럭 주문 조회 완료:', MOCK_FOOD_ORDERS);
    }
  } catch (error) {
    console.error('Supabase DB 푸드트럭 주문 로드 실패:', error);
  } finally {
    try {
      const localFood = JSON.parse(localStorage.getItem('LOCAL_MOCK_FOOD')) || [];
      // 중복 제거 후 합치기
      const existingIds = MOCK_FOOD_ORDERS.map(o => o.orderItemId);
      const uniqueLocal = localFood.filter(l => !existingIds.includes(l.orderItemId));
      MOCK_FOOD_ORDERS = MOCK_FOOD_ORDERS.concat(uniqueLocal);
    } catch (e) { }
  }
}

/* 실제 DB 굿즈 구매 내역 조회 API 연동 */
let MOCK_GOODS_ORDERS = [
  { id: 1, orderItemId: 'G12345', storeName: '공식 굿즈샵', productName: '응원봉', quantity: 2, deliveryType: '현장 수령', totalPrice: 30000, pickupTimeSlot: '26.06.04 14:30', itemStatus: 'READY', statusText: '준비 완료', qrToken: 'mock_goods_token_1' }
];
async function fetchGoodsOrders() {
  try {
    const sb = window.ShopDB ? window.ShopDB.getClient() : (window.getSupabase ? window.getSupabase() : null);
    if (!sb) return;

    const email = (window.FS && window.FS.Session) ? window.FS.Session.get()?.email : localStorage.getItem('userEmail');
    if (!email) return;

    const { data: profile } = await sb.from('shop_profiles').select('id').eq('user_email', email).maybeSingle();
    if (!profile) return;

    // 굿즈 주문 조회 (G로 시작)
    const { data: shopOrders, error } = await sb.from('shop_orders').select(`
      *,
      shop_order_items ( product_name, quantity, price_at_purchase )
    `).eq('profile_id', profile.id).like('order_number', 'G%').order('created_at', { ascending: false });

    if (error) throw error;

    if (shopOrders) {
      MOCK_GOODS_ORDERS = shopOrders.map(o => {
        const item = o.shop_order_items && o.shop_order_items.length > 0 ? o.shop_order_items[0] : {};
        const productName = item.product_name || '굿즈 상품';
        const quantity = item.quantity || 1;

        let statusText = '결제완료';
        if (o.status === 'SHIPPING') statusText = '배송중';
        else if (o.status === 'DELIVERED') statusText = '배송완료';
        else if (o.status === 'READY_FOR_PICKUP') statusText = '수령 대기';
        else if (o.status === 'COMPLETED') statusText = '수령 완료';

        return {
          orderItemId: o.order_number,
          storeName: 'FESTIO MD',
          productName: productName,
          quantity: quantity,
          selectedOptions: '단일 상품',
          pickupTimeSlot: new Date(o.created_at).toLocaleString(),
          totalPrice: o.total_amount,
          itemStatus: o.status || 'PAYMENT_COMPLETED',
          statusText: statusText,
          qrToken: o.order_number,
          deliveryType: o.delivery_type === 'PICKUP' ? '현장수령' : '일반배송',
          totpSecret: o.totp_secret
        };
      });
      console.log('실제 Supabase DB 굿즈 주문 조회 완료:', MOCK_GOODS_ORDERS);
    }
  } catch (error) {
    console.error('Supabase DB 굿즈 주문 로드 실패:', error);
  } finally {
    try {
      const localGoods = JSON.parse(localStorage.getItem('LOCAL_MOCK_GOODS')) || [];
      MOCK_GOODS_ORDERS = MOCK_GOODS_ORDERS.concat(localGoods);
    } catch (e) { }
  }
}

/* ═══════════════════════════════════════════════════════════
   1. 인증 가드 & 로컬스토리지 연동 초기화
   ═══════════════════════════════════════════════════════════ */
function checkAuth() {
  const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
  if (!userToken) {
    alert('로그인이 필요한 서비스입니다.');
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

async function loadUserInfo() {
  const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
  if (!userToken) return;

  try {
    const encodedToken = encodeURI(userToken);
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': encodedToken
      }
    });

    if (response.ok) {
      const user = await response.json();
      _member = {
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        grade: user.membershipGrade || 'BRONZE',
        totalPurchaseAmount: user.balance || 0,
        isFaceRegistered: user.faceVector !== null && user.faceVector !== undefined,
        balance: user.balance || 0
      };

      // LocalStorage 캐시 동기화
      localStorage.setItem('userName', user.name);
      localStorage.setItem('userPhone', user.phone || '');
      localStorage.setItem('email', user.email);
    } else {
      fallbackLocalUserInfo();
    }
  } catch (error) {
    console.error('사용자 정보 로드 에러:', error);
    fallbackLocalUserInfo();
  }
}

function fallbackLocalUserInfo() {
  const userName = localStorage.getItem('userName') || '축제이용자';
  const userRole = localStorage.getItem('userRole') || 'CLIENT';
  let userEmail = localStorage.getItem('email') || 'user@festio.kr';
  if (userEmail.includes('토스')) userEmail = userEmail.replace(/토스/g, 'toss');
  const userPhone = localStorage.getItem('userPhone') || '';

  _member = {
    name: userName,
    email: userEmail,
    role: userRole,
    phone: userPhone,
    grade: userRole === 'ADMIN' ? 'VIP' : 'BRONZE',
    totalPurchaseAmount: userRole === 'ADMIN' ? 750000 : 50000,
    isFaceRegistered: localStorage.getItem('isFaceRegistered') === 'true',
    balance: parseInt(localStorage.getItem('balance') || '35000')
  };
}

/* ═══════════════════════════════════════════════════════════
   2. 프로필 & 등급 동적 바인딩
   ═══════════════════════════════════════════════════════════ */
function getGradeSvgIcon(grade) {
  const g = (grade || 'BRONZE').toUpperCase();
  if (['VIP', 'SVIP', 'SSVIP'].includes(g)) {
    return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`;
  }
  switch (g) {
    case 'BRONZE': return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    case 'SILVER': return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11"/></svg>`;
    case 'GOLD': return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    case 'EMERALD': return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>`;
    case 'DIAMOND': return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 22 22 7 12 2"/></svg>`;
    default: return `<svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  }
}

function renderProfile() {
  if (!_member) return;

  // 상단 환영 메시지 및 이메일
  const nameEl = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  if (nameEl) nameEl.textContent = _member.name;
  if (emailEl) emailEl.textContent = _member.email;

  // 아바타 웰컴 캐릭터 지정
  const avatar = document.getElementById('profileAvatar');
  if (avatar) {
    // Keep the SVG if it exists, or update just the text
    // We'll leave the design SVG untouched if possible, or gracefully inject
  }

  // 안면 인증 배지 상태 업데이트
  const faceBadge = avatar ? avatar.querySelector('.profile-avatar-face-badge') : null;
  if (faceBadge) {
    faceBadge.classList.toggle('inactive', !_member.isFaceRegistered);
  }

  // 등급 배지 설정
  const gradeBadge = document.getElementById('profileGrade');
  const nextText = document.getElementById('gradeNextText');
  const gradeBar = document.getElementById('gradeBar');

  const totalSpent = _member.totalPurchaseAmount || 0;
  let nextTier = 'SILVER', nextGoal = 150000;

  if (['VIP', 'SVIP', 'SSVIP'].includes(_member.grade.toUpperCase())) {
    nextTier = 'SPECIAL';
  } else {
    if (totalSpent >= 10000000) { nextTier = 'MAX'; nextGoal = totalSpent; }
    else if (totalSpent >= 1000000) { nextTier = 'DIAMOND'; nextGoal = 10000000; }
    else if (totalSpent >= 500000) { nextTier = 'EMERALD'; nextGoal = 1000000; }
    else if (totalSpent >= 150000) { nextTier = 'GOLD'; nextGoal = 500000; }
    else { nextTier = 'SILVER'; nextGoal = 150000; }
  }

  if (gradeBadge) {
    gradeBadge.className = `grade-badge badge-${_member.grade.toLowerCase()}`;
    gradeBadge.innerHTML = `
      ${getGradeSvgIcon(_member.grade)}
      ${_member.grade}
    `;
  }

  // 등급 모달 업데이트 로직
  const gradeModalIconWrap = document.getElementById('gradeModalIconWrap');
  const gradeModalTitle = document.getElementById('gradeModalTitle');
  const gradeModalRemain = document.getElementById('gradeModalRemain');
  const gradeModalTotal = document.getElementById('gradeModalTotal');
  const gradeModalBar = document.getElementById('gradeModalBar');
  const gradeModalCurrentLabel = document.getElementById('gradeModalCurrentLabel');
  const gradeModalNextLabel = document.getElementById('gradeModalNextLabel');

  if (gradeModalIconWrap) {
    gradeModalIconWrap.innerHTML = getGradeSvgIcon(_member.grade);
    // Remove "icon mp-icon-sm" class and set dimensions for the modal
    const svg = gradeModalIconWrap.querySelector('svg');
    if (svg) {
      svg.removeAttribute('class');
      svg.setAttribute('width', '28');
      svg.setAttribute('height', '28');

      let iconColor = '#cd7f32'; // BRONZE
      const g = (_member.grade || 'BRONZE').toUpperCase();
      if (g === 'SILVER') iconColor = '#94a3b8';
      else if (g === 'GOLD') iconColor = '#fbbf24';
      else if (g === 'EMERALD') iconColor = '#10b981';
      else if (g === 'DIAMOND') iconColor = '#3b82f6';
      else if (['VIP', 'SVIP', 'SSVIP'].includes(g)) iconColor = '#8b5cf6';

      if (svg.getAttribute('fill') === 'currentColor') {
        svg.setAttribute('fill', iconColor);
      } else {
        svg.setAttribute('stroke', iconColor);
      }
    }
  }
  if (gradeModalTitle) gradeModalTitle.textContent = `현재 등급: ${_member.grade}`;
  if (gradeModalTotal) gradeModalTotal.textContent = `총 사용: ₩${totalSpent.toLocaleString()}`;
  if (gradeModalCurrentLabel) gradeModalCurrentLabel.textContent = _member.grade;
  if (gradeModalNextLabel) gradeModalNextLabel.textContent = nextTier === 'SPECIAL' || nextTier === 'MAX' ? '-' : nextTier;

  if (nextTier === 'SPECIAL') {
    if (nextText) nextText.textContent = '특수 등급 계정입니다.';
    if (gradeBar) { gradeBar.style.width = '100%'; gradeBar.style.background = '#8930F8'; }
  } else if (nextTier === 'MAX') {
    if (nextText) nextText.textContent = '최고 등급인 DIAMOND 회원입니다.';
    if (gradeBar) { gradeBar.style.width = '100%'; gradeBar.style.background = '#B9F2FF'; }
  } else {
    let remain = nextGoal - totalSpent;
    if (nextText) nextText.textContent = `${nextTier} 등급까지 ₩${remain.toLocaleString()} 남음`;
    if (gradeModalRemain) gradeModalRemain.textContent = `${nextTier} 등급까지 ₩${remain.toLocaleString()} 남음`;

    let percent = Math.min((totalSpent / nextGoal) * 100, 100);
    if (gradeBar) {
      gradeBar.style.width = percent + '%';
    }
    if (gradeModalBar) {
      gradeModalBar.style.width = percent + '%';
    }
  }

  // 프로필 편집 폼 채우기
  const nicknameInput = document.getElementById('profileNickname');
  const phoneInput = document.getElementById('profilePhone');
  const emailInput = document.getElementById('profileEmail2');
  const avatarName = document.getElementById('profileAvatarName');
  const avatarGrade = document.getElementById('profileAvatarGrade');

  if (nicknameInput) nicknameInput.value = _member.name;
  if (phoneInput) phoneInput.value = _member.phone;
  if (emailInput) emailInput.value = _member.email;
  if (avatarName) avatarName.textContent = _member.name;
  if (avatarGrade) avatarGrade.textContent = _member.role === 'ADMIN' ? '관리자 회원' : '일반 회원';
}

/* ═══════════════════════════════════════════════════════════
   3. DB 명세 준수 - 가상 예매(reservation) / 푸드트럭 주문(order_item) 바인딩
   ═══════════════════════════════════════════════════════════ */
// MOCK 데이터 정의
const MOCK_TICKETS = [];

// --- FORMAT BARCODE ---
function formatBarcode(rawCode, prefix) {
  if (!rawCode) return BarcodeUtils.encodeFixedOrder(prefix, 0);
  let numStr = String(rawCode).replace(/[^0-9]/g, '');
  let numId = parseInt(numStr, 10);
  if (isNaN(numId) || numId === 0) {
    let hash = 0;
    for (let i = 0; i < String(rawCode).length; i++) {
      hash = ((hash << 5) - hash) + String(rawCode).charCodeAt(i);
      hash |= 0;
    }
    numId = Math.abs(hash);
  }
  return BarcodeUtils.encodeFixedOrder(prefix, numId);
}

let MOCK_FOOD_ORDERS = [
  { id: 1, orderItemId: 'F12345', storeName: '나비 분식', productName: '떡볶이 세트', quantity: 1, selectedOptions: '순대 추가', totalPrice: 12000, pickupTimeSlot: '26.06.04 14:30', itemStatus: 'READY', statusText: '조리 완료', qrToken: 'mock_food_token_1' }
];

// 통계 렌더링
function renderStats() {
  const statTickets = document.getElementById('statTickets');
  const statWishlists = document.getElementById('statWishlists');
  const statCoupons = document.getElementById('statCoupons');
  const statReviews = document.getElementById('statReviews');
  const statFoods = document.getElementById('statFoods');

  if (statTickets) statTickets.textContent = MOCK_TICKETS.length + _dbTickets.length;

  // 찜 목록 - 실제 데이터 사용 (renderWishGrid에서 업데이트됨)
  if (statWishlists) statWishlists.textContent = '0';

  // 쿠폰 - 목데이터 사용
  if (statCoupons) statCoupons.textContent = (typeof MOCK_COUPONS !== 'undefined') ? MOCK_COUPONS.length : 0;

  // 리뷰 - 목데이터 사용
  if (statReviews) statReviews.textContent = (typeof MOCK_REVIEWS !== 'undefined') ? MOCK_REVIEWS.length : 0;

  // 푸드/굿즈 - 주문 내역 개수 사용
  if (statFoods) statFoods.textContent = ((typeof MOCK_FOOD_ORDERS !== 'undefined' ? MOCK_FOOD_ORDERS.length : 0) + (typeof MOCK_GOODS_ORDERS !== 'undefined' ? MOCK_GOODS_ORDERS.length : 0));

  const ticketCount = document.getElementById('ticketCount');
  if (ticketCount) ticketCount.textContent = `${MOCK_TICKETS.length + _dbTickets.length + MOCK_FOOD_ORDERS.length + MOCK_GOODS_ORDERS.length}건`;
}

// 예매 내역 & 푸드트럭 픽업 내역 통합 렌더링
function renderReservationList() {
  const ticketListContainer = document.getElementById('ticketList');
  if (!ticketListContainer) return;

  let htmlContent = '';

  const totalTicketCount = MOCK_TICKETS.length + _dbTickets.length;

  // 1. 축제 티켓 예매 섹션
  htmlContent += `
    <div class="mp-margin-b-24">
      <h3 class="mp-section-title">
        <span class="mp-margin-r-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-md"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></svg></span> 축제 티켓 예매 내역 (${totalTicketCount}건)
      </h3>
  `;

  // 실제 DB 결제 티켓 렌더링
  _dbTickets.forEach(t => {
    const isUsed = t.used === 'true';
    const isCanceled = t.paymentStatus === 'CANCELED' || t.status === 'CANCELED';
    let statusText = isUsed ? '입장완료' : '예매완료';
    let statusClass = isUsed ? 'status-입장' : 'status-완료';
    if (isCanceled) {
      statusText = '입장취소';
      statusClass = 'status-취소';
    }
    const quantity = t.seats ? t.seats.split(',').length : 1;
    const formattedDate = t.eventDate ? t.eventDate.replace(/-/g, '.') : '추후 공지';

    const kebabMenuStr = `
      <div class="custom-ticket-dropdown mypage-more-dropdown" tabindex="0" onclick="this.classList.toggle('open')" onblur="setTimeout(()=>this.classList.remove('open'), 200)" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; color: var(--text-muted);"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        <div class="custom-dropdown-options" style="right: -8px; left: auto; top: calc(100% + 4px); min-width: 150px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; border: 1px solid var(--border-default); background: #fff;">
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=goods&festivalId=${t.festival_id || t.festivalId || 10}'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            굿즈 상품
          </div>
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=food&festivalId=${t.festival_id || t.festivalId || 10}'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            F&B
          </div>
        </div>
      </div>
    `;

    htmlContent += `
      <div class="mp-card" style="overflow: visible;">
        <span class="mp-badge mp-badge-protruding ${statusClass}">${statusText}</span>
        <div class="mp-card-header">
          <p class="mp-card-title">${t.eventName}</p>
          ${kebabMenuStr}
        </div>
        <div class="mp-card-meta">
          <div>예매 번호: <strong class="mp-color-primary">${formatBarcode(t.ticketNumber || String(t.orderId), 'T')}</strong></div>
          <div>관람 일시: ${formattedDate}</div>
          <div>좌석 정보: ${t.seats || '자율석'} · 수량: ${quantity}매</div>
          <div>결제 일시: ${t.createdAt ? t.createdAt.split(' ')[0] : ''}</div>
        </div>
        <div class="mp-card-footer">
          <span class="mp-card-price">₩${(t.totalPrice || 0).toLocaleString()}</span>
          ${!isUsed ? `<button class="btn btn-sm btn-outline mp-btn-sm" onclick="showTicketQr('${t.secret}')">입장 QR 확인</button>` : ''}
        </div>
      </div>
    `;
  });

  // 기존 MOCK 티켓 렌더링
  MOCK_TICKETS.forEach(t => {
    const statusClass = t.itemStatus === '예매완료' ? 'status-완료' : 'status-입장';
    const kebabMenuStr = `
      <div class="custom-ticket-dropdown mypage-more-dropdown" tabindex="0" onclick="this.classList.toggle('open')" onblur="setTimeout(()=>this.classList.remove('open'), 200)" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; color: var(--text-muted);"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        <div class="custom-dropdown-options" style="right: -8px; left: auto; top: calc(100% + 4px); min-width: 150px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px; border: 1px solid var(--border-default); background: #fff;">
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=goods&festivalId=${t.eventNo || t.festivalId || 10}'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            굿즈 상품 바로가기
          </div>
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=food&festivalId=${t.eventNo || t.festivalId || 10}'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            F&B 바로가기
          </div>
        </div>
      </div>
    `;

    htmlContent += `
      <div class="mp-card" style="overflow: visible;">
        <span class="mp-badge mp-badge-protruding ${statusClass}">${t.itemStatus}</span>
        <div class="mp-card-header">
          <p class="mp-card-title">${t.eventName}</p>
          ${kebabMenuStr}
        </div>
        <div class="mp-card-meta">
          <div>예매 번호: <strong class="mp-color-primary">${formatBarcode(t.reservationId, 'T')}</strong></div>
          <div>관람 일시: ${t.eventDate}</div>
          <div>구역명: ${t.zoneName} · 수량: ${t.quantity}매</div>
        </div>
        <div class="mp-card-footer">
          <span class="mp-card-price">₩${t.totalPrice.toLocaleString()}</span>
          ${t.itemStatus === '예매완료' ? `<button class="btn btn-sm btn-outline mp-btn-sm" onclick="showTicketQr('${t.qrToken}')">입장 QR 확인</button>` : ''}
        </div>
      </div>
    `;
  });

  htmlContent += `</div>`;

  // 2. 푸드트럭 주문 내역 섹션
  htmlContent += `
    <div style="margin-top: 48px;">
      <h3 class="mp-section-title">
        <span class="mp-margin-r-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-md"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span> F&B 이용 내역 (${MOCK_FOOD_ORDERS.length}건)
      </h3>
  `;

  if (MOCK_FOOD_ORDERS.length === 0) {
    htmlContent += `<div style="padding: 40px 20px; text-align: center; color: #a0a0b2; background-color: #f8f8fa; border-radius: 12px; font-size: 0.95rem;">이용 내역이 없습니다.</div>`;
  } else {
    MOCK_FOOD_ORDERS.forEach(f => {
      let statusLabelClass = 'status-대기';
      if (f.itemStatus === 'PREPARING') statusLabelClass = 'status-대기';
      else if (f.itemStatus === 'READY') statusLabelClass = 'status-완료';
      else if (f.itemStatus === 'PICKED_UP') statusLabelClass = 'status-입장';

      htmlContent += `
      <div class="mp-card">
        <div class="mp-card-header">
          <p class="mp-card-title">${f.storeName}</p>
          <span class="mp-badge ${statusLabelClass}">${f.statusText}</span>
        </div>
        <div class="mp-card-meta">
          <div>주문 번호: <strong class="mp-color-success barcode-text" style="font-weight: 700; font-family: 'Roboto Mono', monospace; letter-spacing: 1px;">${formatBarcode(f.orderItemId, 'F')}</strong></div>
          <div>상품명: ${f.productName} · 수량: ${f.quantity}개</div>
          <div>옵션: ${f.selectedOptions}</div>
          <div class="mp-color-success mp-weight-500" style="display: flex; align-items: center; gap: 6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-sm" style="flex-shrink: 0;"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2 2"></path><path d="M12 2v2"></path><path d="M18 4l-1 1"></path></svg> <span>${f.pickupTimeSlot}</span></div>
        </div>
        <div class="mp-card-footer">
          <span class="mp-card-price">₩${f.totalPrice.toLocaleString()}</span>
          ${f.itemStatus !== 'PICKED_UP' ? `<button class="btn btn-sm btn-outline mp-btn-sm mp-btn-outline-success" onclick="showFoodQr('${f.qrToken}')">픽업 QR 확인</button>` : ''}
        </div>
      </div>
    `;
    });

  }

  htmlContent += `</div>`;

  // 3. 굿즈 구매 내역 섹션
  htmlContent += `
    <div style="margin-top: 48px;">
      <h3 class="mp-section-title">
        <span class="mp-margin-r-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-md"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg></span> 굿즈 구매 내역 (${MOCK_GOODS_ORDERS.length}건)
      </h3>
  `;

  if (MOCK_GOODS_ORDERS.length === 0) {
    htmlContent += `<div style="padding: 40px 20px; text-align: center; color: #a0a0b2; background-color: #f8f8fa; border-radius: 12px; font-size: 0.95rem;">구매 내역이 없습니다.</div>`;
  } else {
    MOCK_GOODS_ORDERS.forEach(g => {
      let statusLabelClass = 'status-대기';
      if (g.itemStatus === 'READY_FOR_PICKUP' || g.itemStatus === 'SHIPPING') statusLabelClass = 'status-완료';
      else if (g.itemStatus === 'COMPLETED' || g.itemStatus === 'DELIVERED') statusLabelClass = 'status-입장';

      htmlContent += `
      <div class="mp-card" style="border-left:4px solid #F5A623;">
        <div class="mp-card-header">
          <p class="mp-card-title">${g.storeName}</p>
          <span class="mp-badge ${statusLabelClass}">${g.statusText}</span>
        </div>
        <div class="mp-card-meta">
          <div>주문 번호: <strong style="color:#F5A623; font-weight: 700; font-family: 'Roboto Mono', monospace; letter-spacing: 1px;" class="barcode-text">${formatBarcode(g.orderItemId, 'G')}</strong></div>
          <div>상품명: ${g.productName} · 수량: ${g.quantity}개</div>
          <div>수령방법: ${g.deliveryType}</div>
          <div style="color:#8888a8; display: flex; align-items: center; gap: 6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-sm" style="flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> <span>${g.pickupTimeSlot}</span></div>
        </div>
        <div class="mp-card-footer">
          <span class="mp-card-price">₩${g.totalPrice.toLocaleString()}</span>
          ${(g.deliveryType === '현장수령' && g.itemStatus !== 'COMPLETED') ? `<button class="btn btn-sm btn-outline mp-btn-sm" style="color:#F5A623; border-color:#F5A623;" onclick="window.location.href='/shop/orders.html'">상세/QR 보기</button>` : ''}
        </div>
      </div>
    `;
    });

  } // else 닫기
  htmlContent += `</div>`;

  ticketListContainer.innerHTML = htmlContent;
}

// 쿠폰, 리뷰, 찜목록, 문의 렌더링
async function renderOtherLists() {
  // 쿠폰함 렌더링 호출
  renderCouponList();

  // 리뷰 목록 렌더링
  renderMyReviewList();
  const reviewEventList = document.getElementById('reviewEventList');
  if (reviewEventList) {
    reviewEventList.innerHTML = `
            <div class="mp-card review-card" style="cursor:pointer; border:1px solid #e8e8e8; border-radius:16px; padding:24px; transition:all 0.2s; display:flex; align-items:center; gap:8px; margin-bottom:16px;" onmouseover="this.style.borderColor='#a286fa';this.style.backgroundColor='#f8f7ff'" onmouseout="if(!this.classList.contains('selected')) {this.style.borderColor='#e8e8e8';this.style.backgroundColor='transparent'}" onclick="this.classList.add('selected');" data-event-name="2026 워터밤 서울">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#1a1a2e;">2026 워터밤 서울</h4>
        <p style="margin:0; font-size:0.9rem; color:#8888a8;">(2026.07.01 관람)</p>
      </div>
            <div class="mp-card review-card" style="cursor:pointer; border:1px solid #e8e8e8; border-radius:16px; padding:24px; transition:all 0.2s; display:flex; align-items:center; gap:8px; margin-bottom:16px;" onmouseover="this.style.borderColor='#a286fa';this.style.backgroundColor='#f8f7ff'" onmouseout="if(!this.classList.contains('selected')) {this.style.borderColor='#e8e8e8';this.style.backgroundColor='transparent'}" onclick="this.classList.add('selected');" data-event-name="2026 퀸즈 락 페스티벌">
        <h4 style="margin:0; font-size:1.1rem; font-weight:700; color:#1a1a2e;">2026 퀸즈 락 페스티벌</h4>
        <p style="margin:0; font-size:0.9rem; color:#8888a8;">(2026.08.15 관람)</p>
      </div>
    `;
  }

  // 찜 목록 — 비동기 렌더 (api.js 사용)
  await renderWishGrid();
}

/* ── 찜 목록 렌더 ───────────────────────────────────── */
async function renderWishGrid() {
  const wishGrid = document.getElementById('wishGrid');
  const wishCount = document.getElementById('wishCount');
  if (!wishGrid) return;

  wishGrid.innerHTML = `<div class="wish-loading">불러오는 중...</div>`;

  try {
    const ids = await wishlistApi.getWishlist();
    const allEvents = await eventApi.getEvents(null);

    const wished = allEvents.filter(ev => ids.includes(ev.eventNo || ev.id));

    if (wishCount) wishCount.textContent = `${wished.length}개`;

    // 통계도 업데이트
    const statWishlists = document.getElementById('statWishlists');
    if (statWishlists) statWishlists.textContent = wished.length;

    if (!wished.length) {
      wishGrid.innerHTML = `
        <div class="mypage-empty mp-grid-col-all">
          <div class="empty-icon-wrap">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
          <p class="mypage-empty-title">찜한 상품이 없습니다</p>
          <p class="mypage-empty-desc">관심있는 행사에서 하트 아이콘을 눌러 찜 목록에 추가해보세요!</p>
        </div>`;
      return;
    }

    wishGrid.innerHTML = wished.map(ev => {
      const no = ev.eventNo || ev.id;
      const name = ev.eventName || ev.name || '-';
      const price = ev.minPrice || 0;
      const thumb = ev.thumbnailUrl;
      const date = ev.eventDate || ev.startDate;
      const priceText = price > 0 ? `₩${price.toLocaleString()}` : '무료';

      return `
        <div class="wish-poster-card" data-event-no="${no}">
          <div class="wish-poster-img-wrap">
            ${thumb
          ? `<img src="${thumb}" alt="${name}" loading="lazy">`
          : `<div class="wish-poster-placeholder">
                   <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                 </div>`}
            <div class="wish-item-actions">
              <button class="wish-action-btn wish-add-cart-btn" data-event-no="${no}" data-event-name="${name}" data-price="${price}" aria-label="장바구니 담기">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              </button>
              <button class="wish-action-btn wish-remove-btn" data-event-no="${no}" aria-label="삭제">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="wish-poster-info">
            <p class="wish-poster-name">${name}</p>
            ${date ? `<p class="wish-poster-date">${date}</p>` : ''}
            <p class="wish-poster-price">${priceText}</p>
          </div>
        </div>`;
    }).join('');

    // 카드 클릭 → 상세페이지 / 장바구니 담기 / 찜 해제 버튼
    wishGrid.addEventListener('click', async (e) => {
      const addCartBtn = e.target.closest('.wish-add-cart-btn');
      if (addCartBtn) {
        e.stopPropagation();
        const no = parseInt(addCartBtn.dataset.eventNo);
        // API Call to add cart
        if (window.Toast) Toast.success('장바구니에 담았습니다.');
        return;
      }
      const removeBtn = e.target.closest('.wish-remove-btn');
      if (removeBtn) {
        e.stopPropagation();
        const no = parseInt(removeBtn.dataset.eventNo);
        try {
          await wishlistApi.removeWishlist(no);
          if (window.Toast) Toast.info('찜 목록에서 제거했습니다.');
          await renderWishGrid(); // 다시 렌더
        } catch {
          if (window.Toast) Toast.error('오류가 발생했습니다.');
        }
        return;
      }
      const card = e.target.closest('.wish-poster-card');
      if (card) {
        window.location.href = `detail.html?eventNo=${card.dataset.eventNo}`;
      }
    }, { once: true });

  } catch (err) {
    console.error('찜 목록 로드 실패:', err);
    wishGrid.innerHTML = `<div class="mypage-empty mp-grid-col-all"><p class="mypage-empty-title">데이터를 불러올 수 없습니다.</p></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   4. 실시간 동적 QR 제어 (히어로 상시노출 + 3분 자동 갱신 + 모달 크게보기)
   ═══════════════════════════════════════════════════════════ */

/* QR 코드 및 TOTP 처리 (qrcode.min.js 사용) */
async function generateTotp(hexSecret) {
  if (!hexSecret || !/^[0-9a-fA-F]+$/.test(hexSecret)) return "000000";
  try {
    const keyBytes = new Uint8Array(hexSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const epoch = Math.floor(Date.now() / 180000);
    const counterBytes = new Uint8Array(8);
    let temp = epoch;
    for (let i = 7; i >= 0; i--) {
      counterBytes[i] = temp & 0xFF;
      temp = Math.floor(temp / 256);
    }
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
    const hash = new Uint8Array(signature);
    const offset = hash[hash.length - 1] & 0x0F;
    const binary = ((hash[offset] & 0x7F) << 24) |
      ((hash[offset + 1] & 0xFF) << 16) |
      ((hash[offset + 2] & 0xFF) << 8) |
      (hash[offset + 3] & 0xFF);
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  } catch (e) {
    return "000000";
  }
}

async function generateHeroQR(token) {
  if (!token) return;
  const container = document.getElementById('qr-code-container');
  if (!container) return;
  container.innerHTML = '';

  let payload = token;
  const dbTicket = _dbTickets && _dbTickets.find(t => t.secret === token);
  if (dbTicket) {
    const otp = await generateTotp(token);
    const orderIdNum = parseInt(dbTicket.orderId, 10);
    const orderIdBase36 = isNaN(orderIdNum) ? "00000" : orderIdNum.toString(36).padStart(5, '0').toUpperCase();
    payload = `T${orderIdBase36}${otp}`;

    // Update the hero QR text dynamically
    const scanTextEl = document.querySelector('.hero-qr-scan-text');
    if (scanTextEl) {
      scanTextEl.textContent = payload;
    }
  }

  new QRCode(container, {
    text: payload,
    width: 140,
    height: 140,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const qrEls = container.querySelectorAll('canvas, img');
    qrEls.forEach(el => el.removeAttribute('title'));
    container.removeAttribute('title');
  }, 50);
}

async function generateModalQR(token, type = 'TICKET') {
  const container = document.getElementById('qrModalCanvas');
  if (!container) return;
  container.innerHTML = '';

  let payload = token;
  if (type === 'TICKET') {
    const dbTicket = _dbTickets && _dbTickets.find(t => t.secret === token);
    if (dbTicket) {
      const otp = await generateTotp(token);
      const orderIdNum = parseInt(dbTicket.orderId, 10);
      if (typeof BarcodeUtils !== 'undefined') {
        payload = BarcodeUtils.encodeDynamicBarcode('T', isNaN(orderIdNum) ? 1 : orderIdNum, otp);
      } else {
        const orderIdBase36 = isNaN(orderIdNum) ? "00000" : orderIdNum.toString(36).padStart(5, '0').toUpperCase();
        payload = `T${orderIdBase36}${otp}`;
      }

      const codeEl = document.getElementById('qrModalCode');
      if (codeEl) codeEl.textContent = payload;
    }
  }

  new QRCode(container, {
    text: payload,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const qrEls = container.querySelectorAll('canvas, img');
    qrEls.forEach(el => el.removeAttribute('title'));
    container.removeAttribute('title');
  }, 50);
}

/* 히어로 QR + 모달 QR 피해 토큰 공유 */
let _currentQrToken = '';

function showTicketQr(token) {
  openQrModalView(token, 'TICKET');
}

function showFoodQr(token) {
  openQrModalView(token, 'FOOD');
}

async function openQrModalView(token, type = 'TICKET') {
  _currentActiveSecret = token;
  const dbTkt = typeof _dbTickets !== 'undefined' ? _dbTickets.find(t => t.secret === token) : null;
  _currentActiveOrderId = dbTkt ? dbTkt.orderId : '999';
  console.log('openQrModalView 호출됨, 토큰:', token, '타입:', type);
  const overlay = document.getElementById('qrModalOverlay');
  if (!overlay) {
    console.error('qrModalOverlay 요소를 찾을 수 없음');
    return;
  }

  // 토큰 기본값
  const qrToken = token || _currentQrToken || 'FEST-NEW-XYZ123';
  console.log('사용할 QR 토큰:', qrToken);

  let finalTitle = '페스티벌 예매 티켓';
  let dateText = '2026.07.01 13:00';

  let displayCode = qrToken;
  if (type === 'FOOD') {
    let baseEventName = (window.MOCK_TICKETS && MOCK_TICKETS[0])
      ? (MOCK_TICKETS[0].eventName || '2026 워터밤 서울')
      : '2026 워터밤 서울';
    const foodOrder = MOCK_FOOD_ORDERS.find(f => f.qrToken === token);
    if (foodOrder) {
      finalTitle = `${baseEventName} - ${foodOrder.storeName}`;
      displayCode = foodOrder.orderItemId;
    }
  } else {
    // TICKET인 경우: 실제 DB 티켓 먼저 찾기
    const dbTicket = _dbTickets.find(t => t.secret === qrToken);
    if (dbTicket) {
      finalTitle = dbTicket.eventName;
      dateText = dbTicket.eventDate ? dbTicket.eventDate.replace(/-/g, '.') : '';
      // ticketNumber가 있으면 사용, 없으면 orderId 기반 12자리 생성
      displayCode = dbTicket.ticketNumber || ('T' + String(dbTicket.orderId).padStart(11, '0'));
    } else {
      const mockTicket = MOCK_TICKETS.find(t => t.qrToken === qrToken);
      if (mockTicket) {
        finalTitle = mockTicket.eventName;
        dateText = mockTicket.eventDate;
        displayCode = mockTicket.reservationId;
      }
    }
  }

  const titleEl = document.getElementById('qrModalTitleFull');
  if (titleEl) {
    titleEl.innerHTML = `<span id="qrModalEventName">${finalTitle}</span>`;
  }

  // 사용 이력 세팅
  const historyList = document.getElementById('qrModalHistoryList');
  if (historyList) {
    if (type === 'FOOD') {
      const foodOrder = MOCK_FOOD_ORDERS.find(f => f.qrToken === token);
      if (foodOrder) {
        historyList.innerHTML = `
          <div class="qr-history-item" onclick="openReceiptModal('${foodOrder.orderItemId}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:12px 16px; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <span style="color:#64748b; font-size:0.9rem;">${foodOrder.itemStatus === 'PICKED_UP' ? '푸드트럭 사용 완료' : '푸드트럭 주문 내역'}</span>
            <span style="color:#64748b; font-size:0.9rem;">${foodOrder.pickupTimeSlot.replace(' (수령 완료)', '').replace(' (픽업 예정)', '')} <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align:middle; margin-left:4px;"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
          </div>
        `;
      } else {
        historyList.innerHTML = '<div style="padding:16px; text-align:center; color:#94a3b8; font-size:0.9rem;">사용 이력이 없습니다.</div>';
      }
    } else {
      const dbTicket = _dbTickets.find(t => t.secret === qrToken);
      const isEntered = dbTicket ? dbTicket.used === 'true' : false;
      historyList.innerHTML = `
        <div class="qr-history-item" style="display:flex; justify-content:space-between; padding:12px 16px;">
          <span style="color:#64748b; font-size:0.9rem;">${isEntered ? '입장 완료' : '예매 완료 (미입장)'}</span>
          <span style="color:#64748b; font-size:0.9rem;">${dateText}</span>
        </div>
      `;
    }
  }

  // QR 코드 텍스트
  const codeEl = document.getElementById('qrModalCode');
  if (codeEl) codeEl.textContent = displayCode;

  // 마스킹 이름
  const userName = (_member && _member.name) ? _member.name : (localStorage.getItem('userName') || '이용자');
  const masked = maskUserName(userName);
  const userEl = document.getElementById('qrModalUser');
  if (userEl) userEl.textContent = masked;

  // QR 이미지 생성
  generateModalQR(qrToken, type);

  // 티켓 전용 페이지 이동
  const canvasContainer = document.getElementById('qrModalCanvas');
  if (canvasContainer) {
    if (type === 'TICKET') {
      canvasContainer.style.cursor = 'pointer';
      canvasContainer.onclick = () => {
        const tkt = _dbTickets.find(t => t.secret === qrToken);
        const orderId = tkt ? tkt.orderId : 1;
        const userEl = document.getElementById('qrModalUser');
        const userNameParam = userEl ? userEl.textContent : '';
        // Extract only the name without badge text (assuming badge text is "BRONZE", "SILVER" etc and separated by spaces)
        let finalName = userNameParam.trim();
        // Remove known badge texts if they exist at the start
        finalName = finalName.replace(/^(BRONZE|SILVER|GOLD|EMERALD|DIAMOND|VIP|SVIP|VVIP)\s*/i, '').trim();
        window.location.href = `/features/user/ticket/view.html?orderId=${orderId}&secret=${qrToken}&displayCode=${displayCode}&userName=${encodeURIComponent(finalName)}`;
      };
    } else {
      canvasContainer.style.cursor = 'default';
      canvasContainer.onclick = null;
    }
  }

  // 타이머 동기화
  syncModalTimer();

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  console.log('모달 active 클래스 추가됨');
}

window.openReceiptModal = function (orderId) {
  let order = typeof MOCK_FOOD_ORDERS !== 'undefined' ? MOCK_FOOD_ORDERS.find(o => o.orderItemId === orderId) : null;
  // 무조건 모달이 뜨도록 fallback 데이터 제공
  if (!order) {
    order = {
      storeName: '춘향이네 야시장 (Food Truck #3)',
      productName: '오코노미야끼 & 야끼소바 세트',
      quantity: 2,
      selectedOptions: '치즈 토핑 추가, 아주 매운맛',
      totalPrice: 24000,
      pickupTimeSlot: '26.06.04 14:30'
    };
  }

  let existingModal = document.getElementById('dynamicReceiptModal');
  if (existingModal) existingModal.remove();

  const approvalNum = Math.floor(Math.random() * 90000000 + 10000000);
  const timeSlotStr = order.pickupTimeSlot.replace(' (수령 완료)', '').replace(' (픽업 예정)', '');

  const html = `
    <div id="dynamicReceiptModal" class="qr-modal-overlay active" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.65); z-index:999999; display:flex; align-items:center; justify-content:center;">
      <div class="qr-modal-card" style="background:#fff; border-radius:24px; width:340px; max-width:90vw; overflow:hidden; padding:0; box-shadow:0 24px 60px rgba(0,0,0,0.3); animation:qrSlideUp 0.3s ease;">
        <div style="background:#f8fafc; padding:20px; text-align:center; border-bottom:1px dashed #cbd5e1;">
          <h3 style="margin:0; font-size:1.2rem; font-weight:700; color:#1e293b;">${order.storeName}</h3>
          <p style="margin:4px 0 0; font-size:0.85rem; color:#64748b;">모바일 간이 영수증</p>
        </div>
        <div style="padding:24px 20px;">
          <div style="margin-bottom:16px; border-bottom:1px solid #f1f5f9; padding-bottom:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.95rem;">
              <span>${order.productName}</span>
              <span>${order.quantity}개</span>
            </div>
            <div style="color:#64748b; font-size:0.85rem;">옵션: ${order.selectedOptions || '기본'}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
            <span style="font-weight:600; color:#334155;">총 결제 금액</span>
            <span style="font-weight:700; font-size:1.1rem; color:#8930F8;">₩${order.totalPrice.toLocaleString()}</span>
          </div>
          <div style="background:#f8fafc; padding:16px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
              <span style="color:#64748b;">결제 일시</span>
              <span style="color:#334155; font-weight:500;">${timeSlotStr}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.85rem;">
              <span style="color:#64748b;">결제 수단</span>
              <span style="color:#334155; font-weight:500;">FESTIO Pay</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
              <span style="color:#64748b;">승인 번호</span>
              <span style="color:#334155; font-weight:500;">${approvalNum}</span>
            </div>
          </div>
        </div>
        <div style="padding:16px 20px; text-align:center; background:#f8fafc; border-top:1px solid #f1f5f9;">
          <button onclick="closeReceiptModal()" class="btn btn-outline" style="width:100%; padding:12px; border-radius:8px; font-weight:600;">닫기</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow = 'hidden';

  // 오버레이(바깥) 영역 클릭 시 닫기
  const receiptOverlay = document.getElementById('dynamicReceiptModal');
  if (receiptOverlay) {
    receiptOverlay.addEventListener('click', (e) => {
      if (e.target === receiptOverlay) {
        closeReceiptModal();
      }
    });
  }
};

window.closeReceiptModal = function () {
  const receiptModal = document.getElementById('dynamicReceiptModal');
  if (receiptModal) receiptModal.remove();

  // QR 모달이 아직 열려 있으면 overflow: hidden 유지, 아니면 복원
  const qrOverlay = document.getElementById('qrModalOverlay');
  const dynamicQrModal = document.getElementById('dynamicQrModal');
  const anyModalStillOpen =
    (qrOverlay && qrOverlay.classList.contains('active')) ||
    (dynamicQrModal && dynamicQrModal.style.display !== 'none');

  if (!anyModalStillOpen) {
    document.body.style.overflow = '';
  }
};

window.toggleQrAccordion = function () {
  const body = document.getElementById('qrModalHistoryBody');
  const icon = document.getElementById('qrModalHistoryIcon');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    body.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
};

window.toggleActivityAccordion = function () {
  const body = document.getElementById('activityAccordionBody');
  const icon = document.getElementById('activityAccordionIcon');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    body.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(0deg)';
  }
};

window.openGradeModal = function () {
  const modal = document.getElementById('gradeModalOverlay');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeGradeModal = function () {
  const modal = document.getElementById('gradeModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

function closeQrModalView() {
  const overlay = document.getElementById('qrModalOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

/* 마스킹 이름 변환 */
function maskUserName(name) {
  if (!name || name.length < 2) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

function syncModalTimer() {
  const elapsed = Math.floor((Date.now() - (_qrStartTime || Date.now())) / 1000);
  const remaining = 180 - elapsed;
  updateModalTimerBar(remaining);
  updateModalTimerText(remaining);
}

function updateModalTimerBar(sec) {
  const modalTimerBar = document.getElementById('qrModalTimerBar');
  const dynamicQrTimerBar = document.getElementById('dynamicQrTimerBar');
  const pct = (sec / 180) * 100;
  if (modalTimerBar) {
    modalTimerBar.style.width = `${pct}%`;
  }
  // dynamicQrTimerBar is animated exclusively by animateBar() via scaleX
}

function updateHeroRing(sec) {
  const ring = document.getElementById('heroQrRing');
  if (!ring) return;
  const CIRC = 69.1;
  const offset = CIRC * (1 - sec / 180);
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = sec <= 5 ? '#ff4757' : '#8930F8';
}
function updateModalTimerText(sec) {
  const el = document.getElementById('qrModalTimer');
  const dynamicEl = document.getElementById('dynamicQrTimerText');
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const timeStr = `0${m}:${s.toString().padStart(2, '0')}`;
  const color = sec <= 5 ? '#ff4757' : '#2D1A54';

  if (el) {
    el.textContent = timeStr;
    el.style.color = color;
  }
  if (dynamicEl) {
    dynamicEl.textContent = timeStr;
    dynamicEl.style.color = color;
  }
}

/* 히어로 + 모달 타이머 통합 디스플레이 */
function updateQRTimerDisplay(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const timeStr = `0${m}:${s.toString().padStart(2, '0')}`;

  // 히어로 타이머 텍스트
  const heroTimer = document.getElementById('heroQrTimer');
  if (heroTimer) {
    heroTimer.textContent = timeStr;
  }
  // qr-timer-text 클래스 (fallback)
  const textEls = document.querySelectorAll('.qr-timer-text');
  textEls.forEach(el => {
    el.textContent = timeStr;
  });

  // heroQrTimerBar is animated exclusively by animateBar() via scaleX

  if (heroTimer) {
    if (sec <= 5) {
      heroTimer.classList.add('timer-shake');
    } else {
      heroTimer.classList.remove('timer-shake');
      heroTimer.style.color = '#555';
    }
  }

  // 모달 내부도 동기화
  updateModalTimerBar(sec);
  updateModalTimerText(sec);
}

/* 히어로 QR 초기화 + 이벤트 바인딩 */
/* 12자리 대문자+숫자 QR 토큰 생성 (staff-scan-v2.js 호환 형식) */
function generateQrToken(prefix = 'T') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = prefix;
  const remainingLength = 12 - prefix.length;
  for (let i = 0; i < remainingLength; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function initHeroQr() {
  // DB 결제 완료 티켓의 secret이 있으면 우선 사용, 없으면 MOCK_TICKETS에 qrToken이 있으면 사용, 없으면 생성
  const dbTicket = _dbTickets && _dbTickets[0];
  const dbToken = dbTicket && dbTicket.secret;
  const mockToken = MOCK_TICKETS && MOCK_TICKETS[0] && MOCK_TICKETS[0].qrToken;
  const initialToken = dbToken || mockToken || generateQrToken('T');
  _currentQrToken = initialToken; // This stores the secret
  _currentActiveSecret = initialToken;
  _currentActiveOrderId = dbTicket ? dbTicket.orderId : '999';

  let displayToken = initialToken;
  if (dbToken) {
    const totpCode = await generateTotpCode(initialToken);
    const orderIdNum = parseInt(_currentActiveOrderId, 10);
    const orderIdBase36 = isNaN(orderIdNum) ? "00000" : orderIdNum.toString(36).padStart(5, '0').toUpperCase();
    displayToken = `T${orderIdBase36}${totpCode}`;
  }

  console.log('QR 초기화, 토큰:', displayToken);

  // QR 생성 (외부 API 사용 대신 로컬 사용)
  generateHeroQR(displayToken);
  startQRRefreshCycle();

  // 우측 QR 카드 클릭 → 모달
  const heroCard = document.getElementById('heroQrCard');
  if (heroCard) {
    heroCard.addEventListener('click', () => openQrModalView(_currentQrToken));
  }

  // 좌측 QR 이미지 클릭 → 모달
  const qrContainer = document.getElementById('qr-code-container');
  if (qrContainer) {
    qrContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('QR 컨테이너 클릭됨, 모달 열기');
      openQrModalView(_currentQrToken);
    });
  } else {
    console.error('QR 컨테이너를 찾을 수 없음');
  }
}

/* QR 모달 닫기 버튼 + 오버레이 클릭 */
function initQrModal() {
  const closeBtn = document.getElementById('qrModalCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeQrModalView);

  const overlay = document.getElementById('qrModalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeQrModalView();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQrModalView();
  });
}

/* 30초 QR 자동 갱신 사이클 (TOTP 동기화) */
function startQRRefreshCycle() {
  clearInterval(_qrTimer);
  clearInterval(_qrCountTimer);

  _qrCountTimer = setInterval(() => {
    const currentSeconds = Math.floor(Date.now() / 1000) % 30;
    const remaining = 30 - currentSeconds;

    updateQRTimerDisplay(remaining);

    // Refresh QR codes precisely when remaining hits 30 (or when it resets)
    if (remaining === 30 || (remaining === 29 && currentSeconds === 1)) {
      // 히어로 QR 갱신
      generateHeroQR(_currentQrToken);

      // 모달이 열려 있으면 모달 QR도 갱신
      const overlay = document.getElementById('qrModalOverlay');
      if (overlay && overlay.classList.contains('active')) {
        generateModalQR(_currentQrToken, _currentQrToken.includes('F') ? 'FOOD' : 'TICKET');
      }
    }
  }, 1000);
}

/* 사이드 메뉴 sticky - 푸터 접촉 시 멈춰 */
function initSideSticky() {
  const sideEl = document.getElementById('mypageLeft');
  if (!sideEl) return;

  function adjustSticky() {
    if (window.innerWidth < 1024) return;

    const footer = document.querySelector('.app-footer, footer, .page-footer');
    if (!footer) return;

    const footerTop = footer.getBoundingClientRect().top;
    const windowH = window.innerHeight;
    const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h') || '60', 10);
    const topOffset = headerH + 16;

    if (footerTop < windowH) {
      // 푸터가 띹앞 들어온 경우: 절대위치로 제한
      const layoutRect = document.getElementById('mypageLayout')?.getBoundingClientRect();
      if (layoutRect) {
        const maxBottom = footerTop - 8;
        const sideRect = sideEl.getBoundingClientRect();
        if (sideRect.bottom > maxBottom) {
          const newTop = maxBottom - sideRect.height;
          sideEl.style.top = Math.max(topOffset, newTop) + 'px';
        } else {
          sideEl.style.top = topOffset + 'px';
        }
      }
    } else {
      sideEl.style.top = topOffset + 'px';
    }
  }

  window.addEventListener('scroll', adjustSticky, { passive: true });
  window.addEventListener('resize', adjustSticky, { passive: true });
  adjustSticky();
}

/* ═══════════════════════════════════════════════════════════
   5. 1:1 문의 dynamic CRUD 모크업
   ═══════════════════════════════════════════════════════════ */
const MOCK_INQUIRIES = [
  {
    id: 1,
    title: '입장 대기 시간 및 안면 검문 관련 문의',
    content: '안면 인식을 등록하고 가면 실물 신분증을 아예 안 들고 가도 티켓 부스 입장이 가능한가요?',
    status: '답변완료',
    answer: '안녕하세요, FESTIO 운영센터입니다. 사전에 안면 등록을 완료하신 경우, 대기 시간 없이 초고속 게이트를 통해 신분증 확인 없이 입장이 가능하십니다. 다만 비상 상황을 대비해 모바일 신분증 등을 지참하시는 것을 추천드립니다.',
    createdAt: '2026-05-29T10:00:00'
  }
];

function renderInquiryList() {
  const inquiryList = document.getElementById('inquiryList');
  if (!inquiryList) return;
  if (MOCK_INQUIRIES.length === 0) {
    inquiryList.innerHTML = `<div class="mypage-empty"><p class="mypage-empty-title">내역이 없습니다</p></div>`;
    return;
  }
  inquiryList.innerHTML = MOCK_INQUIRIES.map(q => {
    const isHelpful = q.helpful || false;
    const rating = q.rating || 0;
    let ratingText = '';
    if (rating > 0) {
      if (rating <= 1) ratingText = '매우 불만족';
      else if (rating <= 2) ratingText = '불만족';
      else if (rating <= 3) ratingText = '보통';
      else if (rating <= 4) ratingText = '만족';
      else ratingText = '매우 만족';
    }

    return `
    <div class="mp-card" style="margin-bottom:16px;">
      <div class="mp-card-header" style="cursor:pointer; display:flex; flex-direction:column; gap:8px;" onclick="toggleAccordion(${q.id})">
        <div style="display:flex; justify-content:flex-start; align-items:center; gap:8px; margin-bottom: 4px;">
          <span class="mp-badge ${q.status === '답변완료' ? 'status-완료' : 'status-대기'}">${q.status}</span>
          <span class="mp-inquiry-date" style="font-size:0.85rem; color:var(--text-muted);">${new Date(q.createdAt).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 class="mp-inquiry-title" style="font-size:1.1rem; margin:0; font-weight:600; flex:1; word-break:keep-all;">${q.title}</h4>
          <svg id="arrow-${q.id}" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; transition:transform 0.3s; flex-shrink:0; margin-left:12px;"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </div>
      <div id="acc-${q.id}" style="display:none; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-subtle);">
        <p class="mp-inquiry-preview" style="color:var(--text-secondary); margin-bottom:16px;">${q.content}</p>
        ${q.answer ? `<div class="mp-inquiry-answer" style="background:#f8fafc; padding:16px; border-radius:8px; border-left:4px solid var(--color-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.05);"><p style="font-weight:bold; margin-bottom:8px; color:var(--text-primary);">운영센터 답변</p><p style="margin:0; color:var(--text-secondary);">${q.answer}</p></div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
          ${q.answer ? `<div style="display:flex; gap:12px; align-items:center;">
              <span style="font-size:0.85rem; color:var(--text-muted);">이 답변이 도움이 되셨나요?</span>
              <button class="btn btn-sm btn-outline ${isHelpful ? 'active' : ''}" onclick="window.toggleInquiryHelpful(${q.id}, this)" style="padding:4px 10px; font-size:0.8rem; display:flex; align-items:center; gap:4px; transition: all 0.2s; ${isHelpful ? 'background:var(--color-primary); color:white; border-color:var(--color-primary);' : ''}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${isHelpful ? 'white' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                좋아요
              </button>
              <div style="display:flex; gap:2px; align-items:center;" class="inquiry-stars" data-id="${q.id}" data-rating="${rating}">
                ${[1, 2, 3, 4, 5].map(i => `<svg width="20" height="20" viewBox="0 0 24 24" fill="${i <= Math.floor(rating) ? '#ffb400' : (i === Math.ceil(rating) && !Number.isInteger(rating) ? 'url(#half-star-grad)' : 'none')}" stroke="#ffb400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="cursor:pointer;" onmousemove="hoverInquiryStar(event, this, ${i}, ${q.id})" onmouseleave="resetInquiryStar(${q.id})" onclick="setInquiryStar(event, this, ${i}, ${q.id})"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`).join('')}
                <span class="rating-text" style="margin-left: 6px; font-size: 0.85rem; font-weight: bold; color: ${rating > 0 ? 'var(--color-primary)' : 'var(--text-muted)'};">${ratingText} <span class="rating-score" style="color:#ffb400;">(${Number(rating).toFixed(1)})</span></span>
              </div>
            </div>` : '<div></div>'}
          <button class="btn btn-sm" onclick="deleteInquiry(${q.id})" style="padding:4px 10px; font-size:0.8rem; background:#ffebee; color:#d32f2f; border:none; border-radius:4px;">삭제</button>
        </div>
      </div>
    </div>
    `;
  }).join('');
}

window.hoverInquiryStar = function (e, svg, baseVal, qId) {
  const rect = svg.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const isHalf = clickX < rect.width / 2;
  const hoverVal = isHalf ? baseVal - 0.5 : baseVal;
  updateInquiryStars(qId, hoverVal);
};

window.resetInquiryStar = function (qId) {
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);
  if (!container) return;
  const selectedRating = parseFloat(container.dataset.rating || '0');
  updateInquiryStars(qId, selectedRating);
};

window.setInquiryStar = function (e, svg, baseVal, qId) {
  const rect = svg.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const isHalf = clickX < rect.width / 2;
  const rating = isHalf ? baseVal - 0.5 : baseVal;
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);

  let currentRating = 0;
  if (container) {
    currentRating = parseFloat(container.dataset.rating || 0);
  }

  let selectedRating = rating;
  if (currentRating === rating) {
    selectedRating = 0;
  }

  if (container) {
    container.dataset.rating = selectedRating;
    // 상태 저장 로직 추가
    const targetQ = MOCK_INQUIRIES.find(q => q.id === qId);
    if (targetQ) {
      targetQ.rating = selectedRating;
      // Store 에 업데이트
      const storeKey = targetQ.target === 'vendor' ? 'inquiries_customer_to_vendor' : 'inquiries_to_admin';
      if (window.InquiryStore) window.InquiryStore.update(storeKey, qId, { rating: selectedRating });
      if (window.wsClient) {
        window.wsClient.send({ type: 'UPDATE_EVALUATION', payload: { id: qId, rating: selectedRating } });
      } else {
        localStorage.setItem('mock_ws_message', JSON.stringify({ type: 'UPDATE_EVALUATION' }));
        setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);
      }
    }
    updateInquiryStars(qId, selectedRating);

    // 상태 텍스트 갱신
    let ratingText = '';
    if (selectedRating <= 1) ratingText = '매우 불만족';
    else if (selectedRating <= 2) ratingText = '불만족';
    else if (selectedRating <= 3) ratingText = '보통';
    else if (selectedRating <= 4) ratingText = '만족';
    else ratingText = '매우 만족';

    const textSpan = container.querySelector('.rating-text');
    if (textSpan) {
      textSpan.innerHTML = `${ratingText} <span class="rating-score" style="color:#ffb400;">(${selectedRating.toFixed(1)})</span>`;
      textSpan.style.color = 'var(--color-primary)';
    }
  }
};

window.toggleInquiryHelpful = function (qId, btnEl) {
  const targetQ = MOCK_INQUIRIES.find(q => q.id === qId);
  if (!targetQ) return;
  targetQ.helpful = !targetQ.helpful;

  // Store 에 업데이트
  const storeKey = targetQ.target === 'vendor' ? 'inquiries_customer_to_vendor' : 'inquiries_to_admin';
  if (window.InquiryStore) window.InquiryStore.update(storeKey, qId, { helpful: targetQ.helpful });

  if (window.wsClient) {
    window.wsClient.send({ type: 'UPDATE_EVALUATION', payload: { id: qId, helpful: targetQ.helpful } });
  } else {
    localStorage.setItem('mock_ws_message', JSON.stringify({ type: 'UPDATE_EVALUATION' }));
    setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);
  }

  // UI 갱신 (빠른 반응성을 위해 직접 변경 혹은 render)
  if (targetQ.helpful) {
    btnEl.style.background = 'var(--color-primary)';
    btnEl.style.color = 'white';
    btnEl.style.borderColor = 'var(--color-primary)';
    btnEl.querySelector('svg').setAttribute('fill', 'white');
  } else {
    btnEl.style.background = 'transparent';
    btnEl.style.color = 'var(--text-primary)';
    btnEl.style.borderColor = 'var(--border-subtle)';
    btnEl.querySelector('svg').setAttribute('fill', 'none');
  }
};

window.updateInquiryStars = function (qId, val) {
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);
  if (!container) return;
  const svgs = container.querySelectorAll('svg');
  svgs.forEach((svg, idx) => {
    const sVal = idx + 1;
    if (sVal <= Math.floor(val)) {
      svg.setAttribute('fill', '#ffb400');
    } else if (sVal === Math.ceil(val) && !Number.isInteger(val)) {
      svg.setAttribute('fill', 'url(#half-star-grad)');
    } else {
      svg.setAttribute('fill', 'none');
    }
  });
};

window.toggleAccordion = function (id) {
  const content = document.getElementById('acc-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (content.style.display === 'none') {
    content.style.display = 'block';
    arrow.style.transform = 'rotate(180deg)';
  } else {
    content.style.display = 'none';
    arrow.style.transform = 'rotate(0deg)';
  }
};
window.deleteInquiry = function (id) {
  if (!confirm('문의 내역을 삭제하시겠습니까?')) return;
  const idx = MOCK_INQUIRIES.findIndex(q => q.id === id);
  if (idx > -1) MOCK_INQUIRIES.splice(idx, 1);
  if (window.Toast) window.Toast.success('삭제되었습니다.');
  renderInquiryList();
};



let MOCK_COUPONS = [
  { id: 1, code: 'C1B2C3D4E5F6', title: '20% 할인 쿠폰', desc: 'FESTIO 회원 웰컴 쿠폰', limit: '최소 ₩30,000 이상 결제 시 사용 가능', date: '2026.08.31', status: 'active' }
];
function renderCouponList() {
  const couponList = document.getElementById('couponList');
  const couponCount = document.getElementById('couponCount');
  if (!couponList) return;
  const activeCoupons = MOCK_COUPONS.filter(c => c.status === 'active');
  if (couponCount) couponCount.textContent = `보유 ${activeCoupons.length}개`;
  if (activeCoupons.length === 0) {
    couponList.innerHTML = `<div class="mypage-empty"><p class="mypage-empty-title">보유 쿠폰이 없습니다</p></div>`;
    return;
  }
  couponList.innerHTML = activeCoupons.map(c => `
    <div class="mp-card coupon-card" style="display:flex; justify-content:space-between; align-items:center; position:relative; padding:16px 20px; margin-bottom:12px; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04); background:#fff;">
      <img src="/Festio/images/festivals/메이플_단풍잎.png" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:100px; height:100px; opacity:0.12; pointer-events:none; object-fit:contain;" alt="단풍잎 워터마크" />
      <button class="coupon-delete-btn" onclick="deleteCoupon(${c.id})" style="position:absolute; top:-10px; right:-10px; width:26px; height:26px; background:#ff4757; color:white; border:none; border-radius:50%; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(255, 71, 87, 0.4); opacity:0; transition:opacity 0.2s, transform 0.2s; z-index:2;">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      
      <div>
        <p class="mp-coupon-desc" style="font-size:0.8rem; color:#64748b; margin-bottom:4px; font-weight:600;">${c.desc}</p>
        <h3 class="mp-coupon-title" style="margin:0 0 6px 0; font-size:1.15rem; color:#1e293b; font-weight:800;">${c.title}</h3>
        <p class="mp-coupon-meta" style="font-size:0.85rem; color:#64748b; margin:0;">${c.limit}</p>
      </div>
      
      <div style="display:flex; flex-direction:column; align-items:flex-end;">
        <div style="text-align:center; margin-bottom:10px;">
          <svg viewBox="0 0 100 24" style="width:100px; height:24px; margin:0 auto; display:block;">
            <rect x="0" y="0" width="4" height="24" fill="#111"/><rect x="6" y="0" width="2" height="24" fill="#111"/><rect x="12" y="0" width="6" height="24" fill="#111"/><rect x="22" y="0" width="4" height="24" fill="#111"/><rect x="30" y="0" width="2" height="24" fill="#111"/><rect x="36" y="0" width="8" height="24" fill="#111"/><rect x="48" y="0" width="4" height="24" fill="#111"/><rect x="56" y="0" width="2" height="24" fill="#111"/><rect x="62" y="0" width="10" height="24" fill="#111"/><rect x="76" y="0" width="4" height="24" fill="#111"/><rect x="84" y="0" width="2" height="24" fill="#111"/><rect x="90" y="0" width="6" height="24" fill="#111"/><rect x="100" y="0" width="4" height="24" fill="#111"/>
          </svg>
          <p style="font-size:0.75rem; letter-spacing:1px; margin-top:6px; font-family:monospace; color:#475569; margin-bottom:0; font-weight:700;">${c.code}</p>
        </div>
        <div style="display:flex; flex-direction:row; align-items:center; justify-content:flex-end; gap:8px;">
          <p class="mp-coupon-date" style="font-size:0.8rem; color:#94a3b8; margin:0; font-weight:600;">~${c.date}</p>
        </div>
      </div>
      <span class="mp-coupon-badge" style="position:absolute; top:-10px; left:-10px; padding:6px 12px; background:#1e293b; color:white; border-radius:8px; font-weight:bold; font-size:0.75rem; box-shadow:0 3px 6px rgba(0,0,0,0.1); z-index:2;">보유중</span>
    </div>
  `).join('');
}
window.deleteCoupon = function (id) {
  const c = MOCK_COUPONS.find(c => c.id === id);
  if (c) c.status = 'deleted'; // 미사용 삭제 처리
  if (window.Toast) window.Toast.success('미사용 상태로 삭제 처리되었습니다.');
  else alert('미사용 상태로 삭제 처리되었습니다.');
  renderCouponList();
  renderStats();
};

function initCouponForm() {
  const btnRegister = document.getElementById('btn-register-coupon');
  if (btnRegister) {
    btnRegister.addEventListener('click', () => {
      const input = document.getElementById('couponInput');
      const inputCode = input.value.trim();
      if (!inputCode) { alert('쿠폰 번호를 입력해주세요.'); return; }

      let newCode = 'C' + Math.random().toString(36).substr(2, 11).toUpperCase();
      if (newCode.length < 12) newCode = newCode.padEnd(12, '0');

      MOCK_COUPONS.unshift({ id: Date.now(), code: newCode, title: `${inputCode} 할인 쿠폰`, desc: '입력 등록 쿠폰', limit: '최소 결제금액 제한 없음', date: '2026.12.31', status: 'active' });
      input.value = '';
      if (window.Toast) window.Toast.success('쿠폰이 성공적으로 등록되었습니다.');
      else alert('등록되었습니다.');
      renderCouponList();
      renderStats();
    });
  }
}


let MOCK_REVIEWS = [
  { id: 1, eventName: '2026 워터밤 서울', rating: 5, content: '라인업이 진짜 미쳤습니다!! 음향도 빵빵하고 내년에도 꼭 또 오고 싶어요!', date: '2026.05.29' }
];
let currentEditReviewId = null;

function renderMyReviewList() {
  const list = document.getElementById('myReviewList');
  if (!list) return;
  if (MOCK_REVIEWS.length === 0) {
    list.innerHTML = '<div class="mypage-empty"><p class="mypage-empty-title">작성한 리뷰가 없습니다</p></div>';
    return;
  }
  list.innerHTML = MOCK_REVIEWS.map(r => {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= r.rating) starsHtml += '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
      else if (i === Math.ceil(r.rating) && !Number.isInteger(r.rating)) starsHtml += `<svg viewBox="0 0 24 24" width="20" height="20"><defs><linearGradient id="halfG-${r.id}-${i}"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="#ddd"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#halfG-${r.id}-${i})"/></svg>`;
      else starsHtml += '<svg viewBox="0 0 24 24" width="20" height="20" fill="#ddd"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }

    return `
    <div class="mp-card" id="review-card-${r.id}" style="position:relative;">
      <button onclick="deleteReview(${r.id})" style="position:absolute; top:16px; right:16px; background:none; border:none; padding:4px; cursor:pointer; color:var(--text-muted); display:flex; align-items:center;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div class="mp-flex-between mp-margin-b-8" style="align-items:flex-start; margin-right:24px;">
        <h4 class="mp-card-title">${r.eventName}</h4>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="mp-inquiry-date" style="font-size:0.8rem; color:var(--text-muted);">작성일: ${r.date}</span>
          </div>
        </div>
      </div>
      <div class="review-content-wrapper" id="review-content-${r.id}">
        <p class="mp-card-meta mp-margin-b-8">${r.content}</p>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px;">
          <div class="mp-review-rating" style="color:#ffb400; font-weight:bold; display:flex; align-items:center; gap:4px;">
            <div style="display:flex; gap:2px; color:#ffb400;">${starsHtml}</div>
            <span style="margin-left:4px;">(${Number(r.rating).toFixed(1)})</span>
          </div>
          <button class="btn btn-sm btn-outline" onclick="enableInlineEdit(${r.id})" style="padding:4px 12px; font-size:0.8rem; border-radius:8px;">수정</button>
        </div>
      </div>
      <div class="review-edit-wrapper hidden" id="review-edit-${r.id}">
        <textarea class="form-input textarea-resize-y" id="edit-content-${r.id}" rows="3" style="width:100%; margin-bottom:12px; padding:12px; border-radius:12px; border:1px solid #d1d5db; background:#fafafa; transition:border-color 0.2s;">${r.content}</textarea>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="star-rating" id="edit-rating-${r.id}" data-selected-rating="${r.rating}" style="display:flex; gap:4px;">
              ${[1, 2, 3, 4, 5].map(star => `
                <button class="star-btn ${star <= r.rating ? 'active' : (star === Math.ceil(r.rating) && !Number.isInteger(r.rating) ? 'half' : '')}" data-star="${star}" style="background:none; border:none; padding:0; width:24px; height:24px; cursor:pointer; color:${star <= Math.ceil(r.rating) ? '#ffb400' : '#ddd'};">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              `).join('')}
            </div>
            <span id="edit-rating-score-${r.id}" style="color:#ffb400; font-weight:bold; font-size:0.95rem;">(${Number(r.rating).toFixed(1)})</span>
          </div>
          
          <div style="display:flex; gap:8px;">
            <button class="btn btn-primary" onclick="saveInlineEdit(${r.id})" style="padding:4px 12px; border-radius:6px; font-weight:600; font-size:0.75rem; background:linear-gradient(135deg, #8930F8 0%, #6b21c5 100%); color:white; border:none; box-shadow:0 4px 12px rgba(137,48,248,0.3);">저장</button>
            <button class="btn btn-outline" onclick="cancelInlineEdit(${r.id})" style="padding:4px 12px; border-radius:6px; font-weight:600; font-size:0.75rem; color:#8930F8; border:1px solid #8930F8; background:transparent;">취소</button>
          </div>
        </div>
      </div>
    </div>
    `;
  }).join('');
}
let reviewToDelete = null;

window.deleteReview = function (id) {
  reviewToDelete = id;
  const overlay = document.getElementById('deleteConfirmOverlay');
  if (overlay) {
    overlay.classList.add('active');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnCancel = document.getElementById('btnCancelDelete');
  const btnConfirm = document.getElementById('btnConfirmDelete');
  const overlay = document.getElementById('deleteConfirmOverlay');

  if (btnCancel && overlay) {
    btnCancel.addEventListener('click', () => {
      reviewToDelete = null;
      overlay.classList.remove('active');
    });
  }

  if (btnConfirm && overlay) {
    btnConfirm.addEventListener('click', () => {
      if (reviewToDelete !== null) {
        MOCK_REVIEWS = MOCK_REVIEWS.filter(r => r.id !== reviewToDelete);
        if (window.Toast) window.Toast.success('리뷰가 삭제되었습니다.');
        renderMyReviewList();
        reviewToDelete = null;
        overlay.classList.remove('active');
      }
    });
  }
});

window.enableInlineEdit = function (id) {
  const contentWrapper = document.getElementById(`review-content-${id}`);
  const editWrapper = document.getElementById(`review-edit-${id}`);
  if (contentWrapper && editWrapper) {
    contentWrapper.classList.add('hidden');
    editWrapper.classList.remove('hidden');

    // Bind star events for half-rating
    const ratingWrapper = document.getElementById(`edit-rating-${id}`);
    if (ratingWrapper && !ratingWrapper.dataset.bound) {
      ratingWrapper.dataset.bound = 'true';
      const review = MOCK_REVIEWS.find(r => r.id === id);
      ratingWrapper.dataset.selectedRating = review ? review.rating : 5;
      const stars = ratingWrapper.querySelectorAll('.star-btn');

      const updateReviewStars = (rating, save = false) => {
        if (save) ratingWrapper.dataset.selectedRating = rating;
        stars.forEach(s => {
          const sVal = parseInt(s.dataset.star);
          s.classList.remove('active', 'half');
          const svg = s.querySelector('svg');
          if (sVal <= Math.floor(rating)) {
            s.classList.add('active');
            svg.setAttribute('fill', '#ffb400');
            svg.style.color = '#ffb400';
          } else if (sVal === Math.ceil(rating) && !Number.isInteger(rating)) {
            s.classList.add('half');
            svg.setAttribute('fill', 'url(#half-star-grad)');
            svg.style.color = '#ffb400';
          } else {
            svg.setAttribute('fill', '#ddd');
            svg.style.color = '#ddd';
          }
        });
        const scoreSpan = document.getElementById(`edit-rating-score-${id}`);
        if (scoreSpan) scoreSpan.textContent = `(${rating.toFixed(1)})`;
      };

      stars.forEach(star => {
        star.addEventListener('mousemove', (e) => {
          const rect = star.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const isHalf = clickX < rect.width / 2;
          const baseVal = parseInt(star.dataset.star);
          updateReviewStars(isHalf ? baseVal - 0.5 : baseVal, false);
        });
        star.addEventListener('click', (e) => {
          e.preventDefault();
          const rect = star.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const isHalf = clickX < rect.width / 2;
          const baseVal = parseInt(star.dataset.star);
          const val = isHalf ? baseVal - 0.5 : baseVal;
          let currentVal = parseFloat(ratingWrapper.dataset.selectedRating || 0);
          if (currentVal === val) {
            updateReviewStars(0, true);
          } else {
            updateReviewStars(val, true);
          }
        });
      });

      ratingWrapper.addEventListener('mouseleave', () => {
        updateReviewStars(parseFloat(ratingWrapper.dataset.selectedRating), false);
      });
    }
  }
};

window.cancelInlineEdit = function (id) {
  const contentWrapper = document.getElementById(`review-content-${id}`);
  const editWrapper = document.getElementById(`review-edit-${id}`);
  if (contentWrapper && editWrapper) {
    contentWrapper.classList.remove('hidden');
    editWrapper.classList.add('hidden');
  }
};

window.saveInlineEdit = function (id) {
  const content = document.getElementById(`edit-content-${id}`).value;
  const ratingWrapper = document.getElementById(`edit-rating-${id}`);
  const rating = ratingWrapper ? parseFloat(ratingWrapper.dataset.selectedRating) : 5;
  const review = MOCK_REVIEWS.find(r => r.id === id);
  if (review && content) {
    review.content = content;
    review.rating = rating;
    if (window.Toast) window.Toast.success('리뷰가 수정되었습니다.');
    renderMyReviewList();
  }
};

window.setEditRating = function (id, star) {
  // Now handled by enableInlineEdit event binding
};

window.editReview = function (id) {
  if (window.setModalReviewEdit) {
    window.setModalReviewEdit(id);
  }
};

let reviewFiles = [];

function initReviewForm() {
  const btnOpenModal = document.getElementById('btn-open-review-modal');
  const modalReview = document.getElementById('modal-review');
  const eventSelectContainer = document.getElementById('reviewEventSelectContainer');
  const starContainer = document.getElementById('reviewStarContainer');
  const btnSubmitReview = document.getElementById('btn-submit-review');
  const reviewContent = document.getElementById('reviewContent');
  const reviewImagesInput = document.getElementById('reviewImages');
  const reviewImagePreviewContainer = document.getElementById('reviewImagePreviewContainer');
  const reviewImageCount = document.getElementById('reviewImageCount');
  let selectedEventNo = null;
  let selectedEventName = '';
  let currentRating = 5;

  const updateStarUI = (rating) => {
    if (!starContainer) return;
    const starBtns = starContainer.querySelectorAll('.review-star-btn');
    starBtns.forEach(btn => {
      const val = parseInt(btn.dataset.index);
      const svg = btn.querySelector('svg');
      if (!svg) return;
      svg.classList.remove('filled', 'half-filled');
      if (val <= Math.floor(rating)) {
        svg.classList.add('filled');
      } else if (val === Math.ceil(rating) && !Number.isInteger(rating)) {
        svg.classList.add('half-filled');
      }
    });

    const scoreSpan = document.getElementById('reviewStarScore');
    if (scoreSpan) {
      scoreSpan.textContent = rating.toFixed(1);
    }
  };

  if (btnOpenModal && modalReview) {
    btnOpenModal.addEventListener('click', () => {
      // 입장 완료된 행사 목록 가져오기
      const attendedTickets = MOCK_TICKETS.filter(t => t.itemStatus === '입장완료' || t.itemStatus === '입장');

      if (attendedTickets.length === 0) {
        if (window.Toast) window.Toast.error('리뷰를 작성할 수 있는 행사가 없습니다.');
        else alert('리뷰를 작성할 수 있는 행사가 없습니다.');
        return;
      }

      // 행사 리스트 렌더링
      if (eventSelectContainer) {
        eventSelectContainer.innerHTML = attendedTickets.map((t, idx) => `
          <div class="review-event-list-item" data-event-no="${t.reservationId}" data-event-name="${t.eventName}">
            <img class="review-event-poster" src="https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=100&h=140" alt="poster">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div style="font-weight:700; font-size:0.95rem; color:#111;">${t.eventName}</div>
              <div style="font-size:0.8rem; color:#666;">관람일: ${t.eventDate}</div>
            </div>
          </div>
        `).join('');

        // 행사 선택 이벤트
        const listItems = eventSelectContainer.querySelectorAll('.review-event-list-item');
        listItems.forEach(item => {
          item.addEventListener('click', () => {
            listItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedEventNo = item.dataset.eventNo;
            selectedEventName = item.dataset.eventName;
          });
        });
      }

      // 초기화
      selectedEventNo = null;
      selectedEventName = '';
      currentEditReviewId = null;
      currentRating = 5;
      reviewContent.value = '';
      reviewFiles = [];
      updateReviewImagePreviews();
      updateStarUI(5);
      if (btnSubmitReview) btnSubmitReview.textContent = '리뷰 등록';

      modalReview.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  window.setModalReviewEdit = function (id) {
    const review = MOCK_REVIEWS.find(r => r.id === id);
    if (!review) return;

    selectedEventNo = review.id;
    selectedEventName = review.eventName;
    currentEditReviewId = id;
    currentRating = review.rating || 5;

    reviewContent.value = review.content;
    updateStarUI(currentRating);
    reviewFiles = [];
    updateReviewImagePreviews();

    if (btnSubmitReview) {
      btnSubmitReview.textContent = '리뷰 수정';
    }

    if (modalReview) {
      modalReview.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };


  // 별점 클릭 및 마우스 오버 이벤트
  if (starContainer) {
    const starBtns = starContainer.querySelectorAll('.review-star-btn');

    starBtns.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const isHalf = clickX < rect.width / 2;
        const baseVal = parseInt(btn.dataset.index);
        updateStarUI(isHalf ? baseVal - 0.5 : baseVal);
      });

      btn.addEventListener('click', (e) => {
        const rect = btn.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const isHalf = clickX < rect.width / 2;
        const baseVal = parseInt(btn.dataset.index);
        const val = isHalf ? baseVal - 0.5 : baseVal;
        if (currentRating === val) {
          currentRating = 0;
        } else {
          currentRating = val;
        }
        updateStarUI(currentRating);
      });
    });

    starContainer.addEventListener('mouseleave', () => {
      updateStarUI(currentRating);
    });
  }

  // 사진 첨부 이벤트
  if (reviewImagesInput) {
    reviewImagesInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (reviewFiles.length + files.length > 10) {
        if (window.Toast) window.Toast.error('사진은 최대 10장까지 첨부 가능합니다.');
        else alert('사진은 최대 10장까지 첨부 가능합니다.');
        return;
      }
      reviewFiles = reviewFiles.concat(files).slice(0, 10);
      updateReviewImagePreviews();
      e.target.value = '';
    });
  }

  function updateReviewImagePreviews() {
    if (!reviewImagePreviewContainer || !reviewImageCount) return;
    reviewImageCount.textContent = `${reviewFiles.length}/10`;
    reviewImagePreviewContainer.innerHTML = '';

    reviewFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'review-photo-thumb-container';
        thumbDiv.innerHTML = `
          <img src="${e.target.result}" class="review-photo-thumb" alt="thumbnail">
          <button class="review-photo-del" onclick="removeReviewImage(${index})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
        reviewImagePreviewContainer.appendChild(thumbDiv);
      };
      reader.readAsDataURL(file);
    });
  }

  window.removeReviewImage = function (index) {
    reviewFiles.splice(index, 1);
    updateReviewImagePreviews();
  };

  // 사진 스크롤 기능
  const photoScrollLeftBtn = document.getElementById('btn-photo-scroll-left');
  const photoScrollRightBtn = document.getElementById('btn-photo-scroll-right');
  const photoWrapper = document.getElementById('reviewPhotoWrapper');

  if (photoScrollLeftBtn && photoWrapper) {
    photoScrollLeftBtn.addEventListener('click', (e) => {
      e.preventDefault();
      photoWrapper.scrollBy({ left: -200, behavior: 'smooth' });
    });
  }
  if (photoScrollRightBtn && photoWrapper) {
    photoScrollRightBtn.addEventListener('click', (e) => {
      e.preventDefault();
      photoWrapper.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  // 모달 닫기
  document.querySelectorAll('[data-close-modal="modal-review"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (modalReview) modalReview.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // 리뷰 등록 완료 이벤트
  if (btnSubmitReview) {
    btnSubmitReview.addEventListener('click', () => {
      if (!selectedEventNo && !currentEditReviewId) {
        if (window.Toast) window.Toast.error('리뷰를 작성할 행사를 선택해주세요.');
        else alert('리뷰를 작성할 행사를 선택해주세요.');
        return;
      }

      const content = reviewContent.value.trim();
      if (content.length < 10) {
        if (window.Toast) window.Toast.error('리뷰 내용은 최소 10자 이상 작성해주세요.');
        else alert('리뷰 내용은 최소 10자 이상 작성해주세요.');
        return;
      }

      const hasPhoto = reviewFiles.length > 0;
      const msg = hasPhoto ? "사진 리뷰(1,500원) 7일 뒤 적립예정" : "일반 리뷰(300원) 7일 뒤 적립예정";

      if (currentEditReviewId) {
        const r = MOCK_REVIEWS.find(r => r.id === currentEditReviewId);
        if (r) { r.content = content; r.rating = currentRating; }
        if (window.Toast) window.Toast.success(msg + ' | 리뷰가 수정되었습니다.');
      } else {
        MOCK_REVIEWS.unshift({ id: Date.now(), eventName: selectedEventName, rating: currentRating, content: content, date: new Date().toLocaleDateString() });
        if (window.Toast) window.Toast.success(msg + ' | 리뷰가 등록되었습니다.');
      }

      renderMyReviewList();
      if (modalReview) modalReview.classList.remove('active');
      document.body.style.overflow = '';
    });
  }
}

// Duplicate editReview removed

/* ═══════════════════════════════════════════════════════════
   6. 프로필 정보 변경 저장 기능 구현
   ═══════════════════════════════════════════════════════════ */
function initProfileEditSave() {
  const profileNewPw = document.getElementById('profileNewPw');
  const strengthContainer = document.getElementById('profilePwStrengthContainer');
  const fills = strengthContainer ? strengthContainer.querySelectorAll('.pw-strength-fill') : [];
  const pwGuideList = document.getElementById('profilePwGuide');
  const guide1 = document.getElementById('profilePwGuide1');
  const guide2 = document.getElementById('profilePwGuide2');

  let isPasswordValid = false;

  if (profileNewPw && strengthContainer) {
    if (pwGuideList) pwGuideList.style.display = 'none';

    profileNewPw.addEventListener('focus', function () {
      if (!this.value && pwGuideList) pwGuideList.style.display = 'flex';
    });

    profileNewPw.addEventListener('input', function () {
      const val = this.value;
      if (!val) {
        strengthContainer.style.display = 'none';
        if (pwGuideList) pwGuideList.style.display = 'none';
        if (guide1) guide1.style.color = '#9ca3af';
        if (guide2) guide2.style.color = '#9ca3af';
        isPasswordValid = false;
        return;
      }
      strengthContainer.style.display = 'block';
      let score = 0;

      // 조건 1: 8자 이상
      const c1 = val.length >= 8;
      if (guide1) guide1.style.color = c1 ? '#10B981' : '#9ca3af';
      if (c1) score++;

      // 조건 2: 영문, 숫자, 특수문자 중 2가지 이상 (이 로직은 기본적으로 영문/숫자/특수문자 체크)
      const hasLetter = /[a-zA-Z]/.test(val);
      const hasNumber = /[0-9]/.test(val);
      const hasSpecial = /[^a-zA-Z0-9]/.test(val);
      const c2Count = (hasLetter ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
      const c2 = c2Count >= 2;

      if (guide2) guide2.style.color = c2 ? '#10B981' : '#9ca3af';
      if (c2) score++;

      fills.forEach(f => f.style.background = '#e5e7eb');
      if (score === 0) {
        fills[0].style.background = '#FF2D55';
        if (pwGuideList) pwGuideList.style.display = 'flex';
        isPasswordValid = false;
      } else if (score === 1) {
        fills[0].style.background = '#F59E0B';
        fills[1].style.background = '#F59E0B';
        if (pwGuideList) pwGuideList.style.display = 'flex';
        isPasswordValid = false;
      } else if (score >= 2) {
        fills[0].style.background = '#10B981';
        fills[1].style.background = '#10B981';
        fills[2].style.background = '#10B981';
        if (pwGuideList) pwGuideList.style.display = 'none';
        isPasswordValid = true;
      }
    });
  }

  const btnSave = document.getElementById('btn-save-profile');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const nicknameVal = document.getElementById('profileNickname').value.trim();
      const phoneVal = document.getElementById('profilePhone').value.trim();
      const currentPwVal = document.getElementById('profileCurrentPw').value;
      const newPwVal = document.getElementById('profileNewPw').value;
      const confirmPwVal = document.getElementById('profileConfirmPw').value;

      if (!nicknameVal || !phoneVal) {
        if (window.Toast) window.Toast.error('닉네임과 연락처를 입력해주세요.');
        else alert('닉네임과 연락처를 입력해주세요.');
        return;
      }

      const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      try {
        // 프로필 정보 업데이트 (닉네임, 연락처)
        const response = await fetch('/api/auth/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': userToken
          },
          body: JSON.stringify({
            name: nicknameVal,
            phone: phoneVal
          })
        });

        if (!response.ok) {
          throw new Error('프로필 업데이트에 실패했습니다.');
        }

        // 비밀번호 변경 요청이 있는 경우
        if (currentPwVal || newPwVal || confirmPwVal) {
          if (!currentPwVal) {
            if (window.Toast) window.Toast.error('현재 비밀번호를 입력해주세요.');
            else alert('현재 비밀번호를 입력해주세요.');
            return;
          }
          if (!isPasswordValid) {
            if (window.Toast) window.Toast.error('새 비밀번호 규칙을 확인해주세요.');
            else alert('새 비밀번호 규칙을 확인해주세요.');
            return;
          }
          if (newPwVal !== confirmPwVal) {
            if (window.Toast) window.Toast.error('새 비밀번호가 일치하지 않습니다.');
            else alert('새 비밀번호가 일치하지 않습니다.');
            return;
          }

          const pwResponse = await fetch('/api/auth/updatePassword', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': userToken
            },
            body: JSON.stringify({
              currentPassword: currentPwVal,
              newPassword: newPwVal
            })
          });

          if (!pwResponse.ok) {
            const errorData = await pwResponse.text();
            throw new Error(errorData || '비밀번호 변경에 실패했습니다.');
          }

          document.getElementById('profileCurrentPw').value = '';
          document.getElementById('profileNewPw').value = '';
          document.getElementById('profileConfirmPw').value = '';
          if (strengthContainer) strengthContainer.style.display = 'none';
        }

        if (window.Toast) window.Toast.success('성공적으로 저장되었습니다.');
        else alert('성공적으로 저장되었습니다.');

        if (response.ok) {
          const updated = await response.json();
          localStorage.setItem('userName', updated.name);
          localStorage.setItem('userPhone', updated.phone || '');

          await loadUserInfo();
          renderProfile();

          if (window.Toast) window.Toast.success('프로필 변경사항이 DB에 안전하게 저장되었습니다!');
          else alert('저장되었습니다.');
        } else {
          const errMsg = await response.text();
          if (window.Toast) window.Toast.error(errMsg || '저장에 실패했습니다.');
          else alert(errMsg || '저장에 실패했습니다.');
        }
      } catch (error) {
        console.error('프로필 저장 에러:', error);
        if (window.Toast) window.Toast.error('서버 통신 실패로 변경사항을 저장하지 못했습니다.');
      }
    });
  }
}

function initProfileFeatures() {
  const btnChangeAva = document.getElementById('btn-change-avatar');
  const btnDelAva = document.getElementById('btn-delete-avatar');
  const fileInput = document.getElementById('profileImageInput');

  // 파일 선택 시 이미지 미리보기 + 히어로 아바타 동기화
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgUrl = ev.target.result;
        applyAvatarImage(imgUrl);
      };
      reader.readAsDataURL(file);
    });
  }

  // '사진 변경' 버튼 → 파일 선택 창 열기
  if (btnChangeAva) {
    btnChangeAva.addEventListener('click', () => {
      if (fileInput) fileInput.click();
    });
  }

  // '기본 이미지' 버튼 → SVG 기본 아바타로 복원
  if (btnDelAva) {
    btnDelAva.addEventListener('click', () => {
      resetAvatarToDefault();
      alert('기본 이미지로 변경되었습니다.');
    });
  }

  // 초기화 시 저장된 아바타 로드
  const savedAvatar = localStorage.getItem('festio_avatar');
  if (savedAvatar) {
    applyAvatarImage(savedAvatar);
  }
}

/* 아바타 이미지 적용 (프로필 편집 + 히어로 동기화) */
function applyAvatarImage(imgUrl) {
  // 1. 프로필 편집 아바타
  const editAvatar = document.getElementById('profileAvatarEdit');
  if (editAvatar) {
    const svg = editAvatar.querySelector('#profileAvatarSvg');
    if (svg) svg.style.display = 'none';
    let img = editAvatar.querySelector('.avatar-uploaded-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'avatar-uploaded-img';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;position:absolute;top:0;left:0;z-index:1;';
      editAvatar.insertBefore(img, editAvatar.firstChild);
    }
    img.src = imgUrl;
  }

  // 2. 히어로 메인 아바타
  const heroAvatar = document.getElementById('profileAvatar');
  if (heroAvatar) {
    const heroSvg = heroAvatar.querySelector('#profileAvatarSvgHero');
    if (heroSvg) heroSvg.style.display = 'none';
    let heroImg = heroAvatar.querySelector('.avatar-uploaded-img');
    if (!heroImg) {
      heroImg = document.createElement('img');
      heroImg.className = 'avatar-uploaded-img';
      heroImg.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      heroAvatar.insertBefore(heroImg, heroAvatar.firstChild);
    }
    heroImg.src = imgUrl;
  }

  // 3. 네비게이션 헤더 아바타 동기화
  const headerAvatarCircle = document.getElementById('header-avatar-circle');
  if (headerAvatarCircle) {
    const defaultSvg = headerAvatarCircle.querySelector('svg:not([fill="#3b82f6"])');
    if (defaultSvg) defaultSvg.style.display = 'none';

    let headerImg = headerAvatarCircle.querySelector('img');
    if (!headerImg) {
      headerImg = document.createElement('img');
      headerImg.alt = '프로필 이미지';
      headerImg.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:50%;';
      headerAvatarCircle.insertBefore(headerImg, headerAvatarCircle.firstChild);
    }
    headerImg.src = imgUrl;
    headerImg.style.display = '';
  }

  // 영속화 저장
  localStorage.setItem('festio_avatar', imgUrl);
}

/* 기본 아바타(SVG)로 복원 */
function resetAvatarToDefault() {
  // 프로필 편집
  const editAvatar = document.getElementById('profileAvatarEdit');
  if (editAvatar) {
    const img = editAvatar.querySelector('.avatar-uploaded-img');
    if (img) img.remove();
    const svg = editAvatar.querySelector('#profileAvatarSvg');
    if (svg) svg.style.display = '';
  }

  // 히어로
  const heroAvatar = document.getElementById('profileAvatar');
  if (heroAvatar) {
    const img = heroAvatar.querySelector('.avatar-uploaded-img');
    if (img) img.remove();
    const heroSvg = heroAvatar.querySelector('#profileAvatarSvgHero');
    if (heroSvg) heroSvg.style.display = '';
  }

  // 네비게이션 헤더 복원
  const headerAvatarCircle = document.getElementById('header-avatar-circle');
  if (headerAvatarCircle) {
    const img = headerAvatarCircle.querySelector('img');
    if (img) img.remove();
    const defaultSvg = headerAvatarCircle.querySelector('svg:not([fill="#3b82f6"])');
    if (defaultSvg) defaultSvg.style.display = '';
  }

  // 파일 input 초기화
  const fileInput = document.getElementById('profileImageInput');
  if (fileInput) fileInput.value = '';

  // 영속화 삭제
  localStorage.removeItem('festio_avatar');
}

/* ═══════════════════════════════════════════════════════════
   7. 탭 전환 리스너 바인딩
   ═══════════════════════════════════════════════════════════ */
function initTabs() {
  const tabs = document.querySelectorAll('.mypage-sidenav-item, .mypage-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabId = tab.dataset.tab;
      if (!tabId) return;

      document.querySelectorAll('.mypage-sidenav-item, .mypage-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(t => t.classList.add('active'));
      const activePane = document.getElementById(tabId);
      if (activePane) activePane.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   8. 로그아웃 리스너 통합 구현 (common.js에서 글로벌 처리됨)
   ═══════════════════════════════════════════════════════════ */
function initLogout() {
  // common.js에서 처리됨
}

/* ═══════════════════════════════════════════════════════════
   9. 안면 인식 (face-api.js) 통합 제어
   ═══════════════════════════════════════════════════════════ */
function startFaceCamera() {
  const video = document.getElementById('face-video');
  if (!video) return;

  _isFaceDetected = true;
  if (window.Toast) window.Toast.info('카메라 스트림을 준비 중입니다...');

  setTimeout(() => {
    if (window.Toast) window.Toast.success('안면 인식이 활성화되었습니다. 중앙을 봐주세요.');
    const statusText = document.querySelector('.face-detection-status');
    if (statusText) {
      statusText.textContent = '얼굴 인식 완료! 등록 버튼을 눌러주세요.';
      statusText.className = 'face-detection-status detected';
    }
    const registerBtn = document.getElementById('btn-face-register');
    if (registerBtn) registerBtn.disabled = false;
  }, 1000);
}

function initFaceModal() {
  const btnOpenFace = document.getElementById('profileAvatar');
  if (btnOpenFace) {
    btnOpenFace.addEventListener('click', () => {
      alert('안면 인식 인증 기능은 로컬 환경에서 테스트 모드로 실행됩니다.');
      localStorage.setItem('isFaceRegistered', 'true');
      _member.isFaceRegistered = true;
      renderProfile();
      if (window.Toast) window.Toast.success('안면 인증 정보가 동적으로 등록되었습니다!');
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   10. 초기 로드 리스너 (DOMContentLoaded)
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAuth()) return;

  await loadUserInfo();
  await fetchTickets(); // DB 실제 티켓 로드 추가!
  await fetchFoodOrders(); // DB 실제 푸드트럭 주문 로드 추가!
  await fetchGoodsOrders(); // DB 실제 굿즈 주문 로드 추가!
  renderProfile();

  renderStats();
  renderReservationList();
  initReviewForm();
  await renderOtherLists();
  renderInquiryList();

  // initTabs(); 위쪽이나 적당한 곳에 initInquiryForm을 활성화합니다.
  initTabs();
  initInquiryForm();
  initCouponForm();
  initProfileEditSave();
  initProfileFeatures();
  initLogout();
  initFaceModal();

  // URL 해시(#tab-wishlist 등)로 특정 탭 자동 활성화
  const hashTab = window.location.hash.replace('#', '');
  if (hashTab) {
    const targetTab = document.getElementById(hashTab);
    if (targetTab) {
      document.querySelectorAll('.mypage-sidenav-item, .mypage-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelectorAll(`[data-tab="${hashTab}"]`).forEach(t => t.classList.add('active'));
      targetTab.classList.add('active');
      targetTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  initHeroQr();
  initQrModal();
  initSideSticky();

  // Mock WS 이벤트 리스너 추가 (답변 등록 실시간 갱신용)
  if (window.MockWebSocket) {
    window.wsClient = new MockWebSocket('ws://localhost:8080/ws');
    window.wsClient.addEventListener('message', (e) => {
      // 문의가 업데이트되면 리스트 갱신 (간단히 localStorage에서 다시 불러와서 렌더링)
      loadInquiriesFromStore();
    });
  } else {
    // mock-realtime.js가 없을 경우 폴백
    window.addEventListener('storage', (e) => {
      if (e.key === 'mock_ws_message') loadInquiriesFromStore();
    });
  }
  // 초기 스토어 로드
  loadInquiriesFromStore();
});

// Store 연동
function loadInquiriesFromStore() {
  if (!window.InquiryStore) return;
  // 고객이 남긴 모든 문의를 합쳐서 렌더링 (vendor용 + admin용)
  const vendorInq = window.InquiryStore.get('inquiries_customer_to_vendor') || [];
  const adminInq = window.InquiryStore.get('inquiries_to_admin') || [];

  // 내 문의만 가져온다고 가정 (모든 문의 병합)
  const allMyInq = [...vendorInq, ...adminInq].filter(q => q.author === 'me').sort((a, b) => b.id - a.id);

  // MOCK_INQUIRIES에 덮어쓰기
  if (allMyInq.length > 0) {
    MOCK_INQUIRIES.length = 0;
    allMyInq.forEach(q => MOCK_INQUIRIES.push(q));
  }
  renderInquiryList();
}

function initInquiryForm() {
  const btnNewInquiry = document.getElementById('btn-new-inquiry');
  const modalInquiry = document.getElementById('modal-inquiry');
  const btnSubmitInquiry = document.getElementById('btn-submit-inquiry');
  const inqImagesInput = document.getElementById('inqImages');
  const inqImageCount = document.getElementById('inqImageCount');

  if (btnNewInquiry && modalInquiry) {
    btnNewInquiry.addEventListener('click', () => {
      modalInquiry.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  // 모달 닫기 이벤트
  document.querySelectorAll('[data-close-modal="modal-inquiry"]').forEach(btn => {
    btn.addEventListener('click', () => {
      modalInquiry.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  let selectedFiles = []; // 선택된 파일 관리를 위한 배열

  // 썸네일 캐러셀 스크롤 버튼 로직
  const imgPreviewContainer = document.getElementById('inqImagePreviewContainer');
  const btnScrollLeft = document.getElementById('btn-scroll-left');
  const btnScrollRight = document.getElementById('btn-scroll-right');

  const updateScrollButtons = () => {
    if (!imgPreviewContainer) return;
    if (!btnScrollLeft || !btnScrollRight) return;

    if (imgPreviewContainer.scrollWidth > imgPreviewContainer.clientWidth) {
      btnScrollLeft.style.display = 'flex';
      btnScrollRight.style.display = 'flex';
    } else {
      btnScrollLeft.style.display = 'none';
      btnScrollRight.style.display = 'none';
    }
  };

  if (btnScrollLeft && btnScrollRight && imgPreviewContainer) {
    btnScrollLeft.addEventListener('click', (e) => {
      e.preventDefault();
      imgPreviewContainer.scrollBy({ left: -100, behavior: 'smooth' });
    });
    btnScrollRight.addEventListener('click', (e) => {
      e.preventDefault();
      imgPreviewContainer.scrollBy({ left: 100, behavior: 'smooth' });
    });
    window.addEventListener('resize', updateScrollButtons);
  }

  // 썸네일 렌더링 로직
  const renderThumbnails = () => {
    if (!imgPreviewContainer) return;

    // 대형 버튼 카운트 업데이트
    const mainCountEl = document.getElementById('inqImageCount');
    if (mainCountEl) {
      mainCountEl.innerText = `${selectedFiles.length}/10`;
    }

    const carouselEl = document.getElementById('inqImageCarousel');
    if (carouselEl) {
      carouselEl.style.display = selectedFiles.length > 0 ? 'flex' : 'none';
    }

    const thumbnailsHtml = selectedFiles.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="thumb-item" onmouseenter="this.querySelector('.remove-thumbnail-btn').style.opacity='1'" onmouseleave="this.querySelector('.remove-thumbnail-btn').style.opacity='0'" style="flex-shrink: 0; position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" />
          <button class="remove-thumbnail-btn" type="button" onclick="window.removeInquiryImage(${idx})" style="position: absolute; top: 2px; right: 2px; background: transparent; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.2s;">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.8));"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
    }).join('');

    imgPreviewContainer.innerHTML = thumbnailsHtml;

    updateScrollButtons();
  };

  window.removeInquiryImage = function (idx) {
    selectedFiles.splice(idx, 1);

    // DataTransfer 객체로 input file 갱신 (실제 폼 전송 시 필요)
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    inqImagesInput.files = dt.files;

    renderThumbnails();
  };

  // 이미지 업로드 로직 (배열 누적)
  if (inqImagesInput) {
    inqImagesInput.addEventListener('change', function () {
      const newFiles = Array.from(this.files);
      if (selectedFiles.length + newFiles.length > 10) {
        alert('이미지는 최대 10개까지만 업로드 가능합니다.');
        // 취소된 파일은 추가하지 않음
      } else {
        selectedFiles = selectedFiles.concat(newFiles);
      }

      // 최신 input state 반영
      const dt = new DataTransfer();
      selectedFiles.forEach(file => dt.items.add(file));
      inqImagesInput.files = dt.files;

      renderThumbnails();
    });
  }

  if (btnSubmitInquiry) {
    btnSubmitInquiry.addEventListener('click', () => {
      const target = document.getElementById('inqTarget').value;
      const title = document.getElementById('inqTitle').value.trim();
      const content = document.getElementById('inqContent').value.trim();

      if (!title || !content) {
        alert('제목과 내용을 모두 입력해주세요.');
        return;
      }

      const newInq = {
        id: Date.now(),
        author: 'me',
        title: title,
        content: content,
        status: '대기',
        answer: null,
        target: target,
        createdAt: new Date().toISOString()
      };

      if (window.InquiryStore) {
        const storeKey = target === 'vendor' ? 'inquiries_customer_to_vendor' : 'inquiries_to_admin';
        window.InquiryStore.add(storeKey, newInq);

        // Mock WebSocket 브로드캐스트
        if (window.wsClient) {
          window.wsClient.send({ type: 'NEW_INQUIRY', payload: newInq });
        } else {
          localStorage.setItem('mock_ws_message', JSON.stringify({ type: 'NEW_INQUIRY' }));
          setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);
        }
      }

      if (window.Toast) window.Toast.success('문의가 성공적으로 접수되었습니다.');
      else alert('문의가 접수되었습니다.');

      // 폼 초기화 및 닫기
      document.getElementById('inqTitle').value = '';
      document.getElementById('inqContent').value = '';
      if (inqImagesInput) inqImagesInput.value = '';
      if (inqImageCount) inqImageCount.textContent = '선택된 파일 없음';

      modalInquiry.classList.remove('active');
      document.body.style.overflow = '';

      loadInquiriesFromStore();
    });
  }
}

window.deleteInquiry = function (id) {
  if (!confirm('문의 내역을 삭제하시겠습니까?')) return;
  // 스토어에서 삭제 로직 추가 필요할 수 있음
  const idx = MOCK_INQUIRIES.findIndex(q => q.id === id);
  if (idx !== -1) MOCK_INQUIRIES.splice(idx, 1);
  renderInquiryList();
  if (window.Toast) window.Toast.success('삭제되었습니다.');
};

setTimeout(() => {
  const profileBtn = document.getElementById('btn-profile-update') || document.querySelector('.btn-profile-update');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('프로필이 성공적으로 업데이트되었습니다.');
    });
  }
}, 1000);


// --- OVERRIDES FOR DYNAMIC QR ---

function generateQrToken() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  let token = '';
  // 영어 6자 + 숫자 6자를 번갈아 섞어 생성
  for (let i = 0; i < 12; i++) {
    if (i % 2 === 0) {
      token += letters.charAt(Math.floor(Math.random() * letters.length));
    } else {
      token += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
  }
  // 최종 셔플
  token = token.split('').sort(() => 0.5 - Math.random()).join('');
  return token;
}

async function generateTotpCode(hexSecret, epochOffset = 0) {
  if (!hexSecret || hexSecret.length % 2 !== 0) return '000000';
  const keyBytes = new Uint8Array(hexSecret.length / 2);
  for (let i = 0; i < hexSecret.length; i += 2) {
    keyBytes[i / 2] = parseInt(hexSecret.substring(i, i + 2), 16);
  }
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    let timeWindow = Math.floor(Date.now() / 180000) + epochOffset;
    const data = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
      data[i] = timeWindow & 0xff;
      timeWindow = Math.floor(timeWindow / 256);
    }
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const hash = new Uint8Array(signature);
    const offset = hash[hash.length - 1] & 0x0f;
    const binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  } catch (e) {
    console.error(e);
    return '000000';
  }
}

let _currentQrType = 'TICKET';
let _currentActiveSecret = '';
let _currentActiveOrderId = '';

async function openQrModalView(token, type = 'TICKET') {
  _currentActiveSecret = token;
  const dbTkt = typeof _dbTickets !== 'undefined' ? _dbTickets.find(t => t.secret === token) : null;
  _currentActiveOrderId = dbTkt ? dbTkt.orderId : '999';
  _currentQrType = type;
  let name = (window._member && window._member.name) ? window._member.name : '';
  if (!name) {
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) name = profileNameEl.innerText.replace(/님|반가워요|,|!/g, '').trim();
  }
  if (!name || name === '로딩 중...') name = '회원';

  let masked = name;
  if (name.length > 2) masked = name.substring(0, 1) + '*' + name.substring(2);
  else if (name.length === 2) masked = name.substring(0, 1) + '*';

  let modal = document.getElementById('dynamicQrModal');
  if (!modal) {

    const mockData = (window.MOCK_TICKETS && window.MOCK_TICKETS[0]) ? window.MOCK_TICKETS[0] : null;
    const eventName = mockData ? mockData.eventName : '2026 워터밤 서울';
    let dateStr = '';
    if (mockData && mockData.reservationId) {
      const match = mockData.reservationId.match(/RES-(\d{4})(\d{2})(\d{2})/);
      if (match) dateStr = `${match[1]}.${match[2]}.${match[3]}`;
    }
    if (!dateStr) {
      const today = new Date();
      dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    }

    const modalHTML = `
      <div id="dynamicQrModal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.65); z-index: 10000; display: flex; align-items: center; justify-content: center;">
        <div style="position: relative; background: transparent; border-radius: 28px; width: 340px; max-width: calc(100vw - 40px); box-shadow: 0 24px 60px rgba(0,0,0,0.3); overflow: hidden; animation: qrSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 14px; background: linear-gradient(135deg, #334155 0%, #0f172a 100%); border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div id="dynamicQrTitle" style="font-size: 1.05rem; font-weight: 700; color: #fff;">나의 티켓 QR - ${eventName}</div>
            <button id="dynamicQrClose" class="modal-close-btn" aria-label="닫기">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div style="background: #fff;">
            <div style="display: flex; flex-direction: column; align-items: center; padding: 28px 24px 24px; gap: 16px;">
              <div style="font-size: 0.9rem; font-weight: 700; color: #000; margin-bottom: -4px;">예매번호: <span id="dynamicQrStaticId" style="color: #000;"></span></div>
              <div class="qr-canvas-container" style="border-radius: 12px; border: 2px solid #e0d8ff; background: #fff; padding: 8px; position: relative; overflow: hidden; display: flex; justify-content: center; align-items: center; width: 160px; height: 160px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
              <div id="dynamicQrCanvas" style="width: 100%; height: 100%; z-index: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;"></div>
            </div>
            
            <div style="text-align: center;">
                <div style="font-family: 'Roboto Mono', 'Courier New', monospace; font-size: 0.95rem; font-weight: 700; letter-spacing: 3px; color: #888; margin-bottom: 8px;" id="dynamicQrCode"></div>
                <div style="font-size: 0.85rem; color: #444; margin-top: 6px; font-weight: 600; display: flex; align-items: center; justify-content: center;" id="dynamicQrUserName">
                  <span class="badge badge-${(window._member ? window._member.grade : 'BRONZE').toLowerCase()}" style="margin-right: 6px;">
                    ${window._member ? window._member.grade : 'BRONZE'}
                  </span>
                  ${masked}
                </div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 2px;" id="dynamicQrPurchaseDate">${dateStr} 구매</div>
            </div>
            
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 180px; margin: 4px auto 0;">
              <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="flex: 1; height: 6px; background: #EFEFEF; border-radius: 6px; overflow: hidden; position: relative;">
                  <div id="dynamicQrTimerBar" style="position: absolute; left: 0; top: 0; height: 100%; width: 100%; background: #8930F8; transform-origin: left; transition: transform 1s linear, background 0.3s ease;"></div>
                </div>
                <button id="dynamicQrRefresh" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; color: #8930F8; transition: transform 0.2s; flex-shrink: 0;" title="새로고침">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                </button>
              </div>
              <span id="dynamicQrTimerText" style="font-size: 0.9rem; font-weight: 800; color: #2D1A54; display: block; text-align: center;">03:00</span>
            </div>

            <div class="qr-accordion">
              <div class="qr-accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
                <span>사용 이력 조회</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <div class="qr-accordion-body">
                <div class="qr-history-item"><span>입장 완료 (게이트 A)</span><span>26.06.04 14:30</span></div>
                <div class="qr-history-item"><span>MD 부스 인증</span><span>26.06.04 15:15</span></div>
                <div class="qr-history-item"><span>재입장 완료</span><span>26.06.04 18:00</span></div>
              </div>
            </div>

            <p style="font-size: 0.7rem; color: #aaa; margin: 0;">3분마다 자동 갱신됩니다</p>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('dynamicQrModal');

    document.getElementById('dynamicQrClose').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    document.getElementById('dynamicQrRefresh').addEventListener('click', () => {
      triggerQrRefresh(true);
    });
  }

  modal.style.display = 'flex';
  let initialTokenForQR = token; // Dynamic QR token
  let fixedOrderId = parseInt(_currentActiveOrderId, 10);
  if (isNaN(fixedOrderId)) fixedOrderId = 1;
  let staticCodeText = '';
  const prefix = type === 'FOOD' ? 'F' : (type === 'GOODS' ? 'G' : 'T');

  if (type === 'TICKET') {
    staticCodeText = BarcodeUtils.encodeFixedOrder(prefix, fixedOrderId);
  } else if (type === 'FOOD') {
    const foodOrder = typeof MOCK_FOOD_ORDERS !== 'undefined' ? MOCK_FOOD_ORDERS.find(f => f.qrToken === token) : null;
    if (foodOrder) fixedOrderId = parseInt(String(foodOrder.id || foodOrder.orderItemId).replace(/[^0-9]/g, '')) || 1;
    staticCodeText = BarcodeUtils.encodeFixedOrder(prefix, fixedOrderId);
  } else if (type === 'GOODS') {
    const goodsOrder = typeof MOCK_GOODS_ORDERS !== 'undefined' ? MOCK_GOODS_ORDERS.find(g => g.qrToken === token) : null;
    if (goodsOrder) fixedOrderId = parseInt(String(goodsOrder.id || goodsOrder.orderItemId).replace(/[^0-9]/g, '')) || 1;
    staticCodeText = BarcodeUtils.encodeFixedOrder(prefix, fixedOrderId);
  }

  if (_currentActiveSecret) {
    let pureTotpCode = await generateTotpCode(_currentActiveSecret, _qrEpochOffset);
    initialTokenForQR = BarcodeUtils.encodeDynamicBarcode(prefix, fixedOrderId, pureTotpCode);
  } else {
    initialTokenForQR = BarcodeUtils.encodeDynamicBarcode(prefix, fixedOrderId, Math.floor(100000 + Math.random() * 900000));
  }

  generateDynamicQR('dynamicQrCanvas', initialTokenForQR, 140, type);

  document.getElementById('dynamicQrStaticId').textContent = staticCodeText;
  document.getElementById('dynamicQrCode').textContent = initialTokenForQR;

  const qrCanvas = document.getElementById('dynamicQrCanvas');
  if (qrCanvas) {
    if (type === 'TICKET') {
      qrCanvas.style.cursor = 'pointer';
      qrCanvas.onclick = () => {
        const tkt = typeof _dbTickets !== 'undefined' ? _dbTickets.find(t => t.secret === token) : null;
        const orderId = tkt ? tkt.orderId : 1;
        window.location.href = `/features/user/ticket/view.html?orderId=${orderId}&secret=${token}&displayCode=${staticCodeText}&userName=${encodeURIComponent(masked)}&grade=${encodeURIComponent(_member ? _member.grade : 'BRONZE')}`;
      };
    } else {
      qrCanvas.style.cursor = 'default';
      qrCanvas.onclick = null;
    }
  }

  const qrTitle = document.getElementById('dynamicQrTitle');
  if (qrTitle) {
    if (type === 'FOOD' || type === 'GOODS') {
      const mockData = (window.MOCK_TICKETS && window.MOCK_TICKETS[0]) ? window.MOCK_TICKETS[0] : null;
      const eventName = mockData ? mockData.eventName : '2026 워터밤 서울';
      qrTitle.textContent = `${eventName} - 춘향이네 야시장`;
    } else {
      const mockData = (window.MOCK_TICKETS && window.MOCK_TICKETS[0]) ? window.MOCK_TICKETS[0] : null;
      const eventName = mockData ? mockData.eventName : '2026 워터밤 서울';
      qrTitle.textContent = `나의 티켓 QR - ${eventName}`;
    }
  }

  const accBody = modal.querySelector('.qr-accordion-body');
  if (accBody) {
    if (type === 'FOOD') {
      const foodOrder = typeof MOCK_FOOD_ORDERS !== 'undefined' ? MOCK_FOOD_ORDERS.find(f => f.qrToken === token) : null;
      const orderId = foodOrder ? foodOrder.orderItemId : 'ORD-20260601-F01';
      accBody.innerHTML = `
        <div class="qr-history-item" onclick="openReceiptModal('${orderId}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:12px 16px; transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
           <span style="color:#64748b; font-size:0.9rem;">푸드트럭 사용 완료</span>
           <span style="display:flex; align-items:center; color:#64748b; font-size:0.9rem; white-space:nowrap;">26.06.04 14:30 <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="margin-left:4px; margin-top:1px;"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
        </div>
      `;
    } else if (type === 'GOODS') {
      accBody.innerHTML = `
        <div class="qr-history-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
          <span style="color:#64748b; font-size:0.9rem;">굿즈 수령 완료</span>
          <span style="color:#64748b; font-size:0.9rem;">26.06.04 16:30</span>
        </div>
      `;
    } else {
      accBody.innerHTML = `
        <div class="qr-history-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
          <span style="color:#64748b; font-size:0.9rem;">입장 완료 (게이트 A)</span>
          <span style="color:#64748b; font-size:0.9rem;">26.06.04 14:30</span>
        </div>
        <div class="qr-history-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
          <span style="color:#64748b; font-size:0.9rem;">MD 부스 인증</span>
          <span style="color:#64748b; font-size:0.9rem;">26.06.04 15:15</span>
        </div>
        <div class="qr-history-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px;">
          <span style="color:#64748b; font-size:0.9rem;">재입장 완료</span>
          <span style="color:#64748b; font-size:0.9rem;">26.06.04 18:00</span>
        </div>
      `;
    }
  }

  if (type === 'FOOD' || type === 'GOODS') {
    const heartSvgDataUrl = "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><path d='M50 88 C 50 88 5 60 5 30 C 5 5 45 5 50 25 C 55 5 95 5 95 30 C 95 60 50 88 50 88 Z' fill='black' /></svg>";
    qrCanvas.style.maskImage = `url("${heartSvgDataUrl.replace(/#/g, '%23')}")`;
    qrCanvas.style.maskSize = "contain";
    qrCanvas.style.maskRepeat = "no-repeat";
    qrCanvas.style.maskPosition = "center";
    qrCanvas.style.webkitMaskImage = `url("${heartSvgDataUrl.replace(/#/g, '%23')}")`;
    qrCanvas.style.webkitMaskSize = "contain";
    qrCanvas.style.webkitMaskRepeat = "no-repeat";
    qrCanvas.style.webkitMaskPosition = "center";
  } else {
    qrCanvas.style.maskImage = "none";
    qrCanvas.style.webkitMaskImage = "none";
  }
  updateModalTimerText(_qrCountdown);
  updateModalTimerBar(_qrCountdown);
}

function generateDynamicQR(containerId, token, size, type = 'TICKET') {
  if (!token) return;
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="qr-scan-line"></div>';

  const isHeart = type === 'FOOD' || type === 'GOODS';

  const qrContainer = document.createElement('div');
  qrContainer.style.width = '100%';
  qrContainer.style.height = '100%';
  qrContainer.style.position = 'relative';
  qrContainer.style.zIndex = '1';
  qrContainer.style.display = 'flex';
  qrContainer.style.alignItems = 'center';
  qrContainer.style.justifyContent = 'center';

  new QRCode(qrContainer, {
    text: token,
    width: size,
    height: size,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const qrEls = qrContainer.querySelectorAll('canvas, img');
    qrEls.forEach(el => {
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.objectFit = 'cover';
      el.style.imageRendering = 'pixelated';
      el.removeAttribute('title');
      if (isHeart) {
        el.style.transform = 'translateY(9px) rotate(45deg) scale(0.5)';
      }
    });
    qrContainer.removeAttribute('title');
    container.removeAttribute('title');
  }, 10);

  if (isHeart) {

    // 마스크는 컨테이너 쪽에 씌워야 기울어진 이미지를 하트모양으로 예쁘게 깎아냄
    container.classList.add('qr-heart-mask-container');

    // 하트의 남는 여백(상단 등)을 QR 느낌으로 완벽히 채우기 위해, 
    // 실제 QR 코드와 완벽하게 동일한 회전각과 비율을 가진 가짜 배경 레이어를 추가합니다.
    const bg = document.createElement('div');
    bg.style.position = 'absolute';
    bg.style.width = '300%';
    bg.style.height = '300%';
    bg.style.top = '-100%';
    bg.style.left = '-100%';
    bg.style.transform = 'translateY(9px) rotate(45deg) scale(0.5)';
    bg.style.zIndex = '0';
    bg.style.imageRendering = 'pixelated'; // Prevent background blurriness

    // QR 모듈 1개 크기 계산 (160px / 21모듈 = 약 7.619px)
    let svg = "<svg xmlns='http://www.w3.org/2000/svg' width='45.71' height='45.71'><rect width='45.71' height='45.71' fill='#fff'/>";
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        if (Math.random() > 0.4) {
          svg += `<rect x='${x * 7.619}' y='${y * 7.619}' width='7.62' height='7.62' fill='#000'/>`;
        }
      }
    }
    svg += "</svg>";
    bg.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    bg.style.backgroundRepeat = 'repeat';
    // 진짜 QR과 픽셀 격자가 완벽하게 맞아떨어지도록 중앙 오프셋 적용 (7.619 / 2 = 3.81px)
    bg.style.backgroundPosition = 'calc(50% + 3.81px) calc(50% + 3.81px)';

    container.appendChild(bg);
  } else {
    container.classList.remove('qr-heart-mask-container');
  }

  container.appendChild(qrContainer);
}

function generateHeroQR(token) {
  if (!token) return;
  generateDynamicQR('qr-code-container', token, 100);
}

let _qrEpochOffset = 0; // Legacy variable, no longer accumulates

async function triggerQrRefresh(isManual = false) {
    if (isManual) {
        _qrEpochOffset += 1;
    }
    const prefix = _currentQrType === 'FOOD' ? 'F' : (_currentQrType === 'GOODS' ? 'G' : 'T');
  let newToken = '';
  let fixedOrderId = parseInt(_currentActiveOrderId, 10);
  if (isNaN(fixedOrderId)) fixedOrderId = 1;

  if (_currentActiveSecret) {
    const totpCode = await generateTotpCode(_currentActiveSecret, _qrEpochOffset); // offset 없이 현재 시간 기준
    newToken = BarcodeUtils.encodeDynamicBarcode(prefix, fixedOrderId, totpCode);
  } else {
    // mock fallback
    newToken = BarcodeUtils.encodeDynamicBarcode(prefix, fixedOrderId, Math.floor(100000 + Math.random() * 900000));
    _currentQrToken = newToken;
  }

  generateHeroQR(newToken);

  const modal = document.getElementById('dynamicQrModal');
  if (modal && modal.style.display !== 'none') {
    generateDynamicQR('dynamicQrCanvas', newToken, 140, _currentQrType);
    const codeEl = document.getElementById('dynamicQrCode');
    if (codeEl) codeEl.textContent = newToken;
  }
  startQRRefreshCycle();
}

let _qrStartTime = 0;
let _qrRafId = null;

function startQRRefreshCycle() {
  _qrCountdown = 180;
  if (typeof _qrTimer !== 'undefined') clearInterval(_qrTimer);
  if (typeof _qrCountTimer !== 'undefined') clearInterval(_qrCountTimer);
  if (_qrRafId) cancelAnimationFrame(_qrRafId);

  _qrStartTime = Date.now();

  const tick = () => {
    const elapsed = Math.floor((Date.now() - _qrStartTime) / 1000);
    const remaining = 180 - elapsed;

    if (remaining <= 0) {
      triggerQrRefresh(false);
      if (window.Toast) window.Toast.info('보안을 위해 QR이 자동 갱신되었습니다');
      return;
    }

    _qrCountdown = remaining;
    updateQRTimerDisplay(remaining);

    const bg = remaining < 60 ? '#ff4d4f' : 'linear-gradient(90deg, #00d2ff, #8930F8)';
    const pct = (remaining / 180) * 100;

    const bars = [document.getElementById('dynamicQrTimerBar'), document.getElementById('heroQrTimerBar')];
    bars.forEach(bar => {
      if (bar) {
        bar.style.background = bg;
        bar.style.width = `${pct}%`;
      }
    });
  };

  tick();
  _qrCountTimer = setInterval(tick, 1000);
}

function updateModalTimerText(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const timeText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  const els = [document.getElementById('dynamicQrTimerText'), document.getElementById('heroQrTimer')];
  els.forEach(el => {
    if (el) {
      el.textContent = timeText;
      if (sec < 60) {
        el.classList.add('qr-danger-text');
        el.style.color = '#ff4d4f';
      } else {
        el.classList.remove('qr-danger-text');
        el.style.color = '#2D1A54';
      }
    }
  });
}

function updateModalTimerBar(sec) {
  // 사용되지 않음 (animateBar에서 처리)
}

// Modify Hero Card DOM structure on load to match modal completely
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const heroRefresh = document.getElementById('heroQrRefreshBtn');
    if (heroRefresh) {
      heroRefresh.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerQrRefresh(true);
        if (window.Toast) window.Toast.info('새로운 코드가 발급되었으며 타이머가 갱신되었습니다.');
      });
    }
    if (typeof _currentQrToken !== 'undefined') {
      generateHeroQR(_currentQrToken);
    }
  }, 200);
});

// 전역 모달 닫기 로직 (ESC 키 및 배경 영역 클릭)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // 영수증 모달 우선 닫기
    const receiptModal = document.getElementById('dynamicReceiptModal');
    if (receiptModal) {
      closeReceiptModal();
      return;
    }
    // 동적 QR 모달 닫기
    const dynamicQrModal = document.getElementById('dynamicQrModal');
    if (dynamicQrModal && dynamicQrModal.style.display !== 'none') {
      dynamicQrModal.style.display = 'none';
    }
    // 기타 모든 모달 닫기
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
    // 모든 모달이 닫혔으므로 overflow 복원
    document.body.style.overflow = '';
  }
});

document.addEventListener('click', (e) => {
  // 영수증 모달 배경 클릭 시 닫기
  const receiptModal = document.getElementById('dynamicReceiptModal');
  if (receiptModal && e.target === receiptModal) {
    closeReceiptModal();
    return;
  }

  // 동적 QR 모달 배경 클릭 시 닫기
  const dynamicQrModal = document.getElementById('dynamicQrModal');
  if (dynamicQrModal && dynamicQrModal.style.display !== 'none') {
    if (e.target === dynamicQrModal) {
      dynamicQrModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // 기타 모든 모달 배경 클릭 시 닫기
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    // 다른 활성 모달이 없으면 overflow 복원
    const remaining = document.querySelectorAll('.modal-overlay.active');
    if (remaining.length === 0) {
      document.body.style.overflow = '';
    }
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const statTickets = document.getElementById('hero-stat-tickets');
  if (statTickets) statTickets.addEventListener('click', () => document.querySelector('[data-tab="tab-tickets"]')?.click());

  const statWishlists = document.getElementById('hero-stat-wishlists');
  if (statWishlists) statWishlists.addEventListener('click', () => document.querySelector('[data-tab="tab-wishlist"]')?.click());

  const statCoupons = document.getElementById('hero-stat-coupons');
  if (statCoupons) statCoupons.addEventListener('click', () => document.querySelector('[data-tab="tab-coupons"]')?.click());

  const statReviews = document.getElementById('hero-stat-reviews');
  if (statReviews) statReviews.addEventListener('click', () => document.querySelector('[data-tab="tab-reviews"]')?.click());

  const statFoods = document.getElementById('hero-stat-foods');
  if (statFoods) statFoods.addEventListener('click', () => document.querySelector('[data-tab="tab-tickets"]')?.click());

  const heroQrCard = document.getElementById('heroQrCard');
  if (heroQrCard) {
    heroQrCard.addEventListener('click', (e) => {
      // openQrModalView�� ������ ������ ȣ��
      if (typeof window.openQrModalView === 'function') {
        window.openQrModalView('', 'TICKET');
      } else {
        const qrCanvas = document.getElementById('qrModalCanvas');
        if (qrCanvas) {
          const overlay = document.getElementById('qrModalOverlay');
          if (overlay) overlay.classList.add('active');
        }
      }
    });
  }

  const heroGradeBadge = document.getElementById('hero-grade-badge');
  if (heroGradeBadge) {
    heroGradeBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.openGradeModal === 'function') window.openGradeModal();
    });
  }

  const activityAccordion = document.getElementById('hero-activity-accordion');
  if (activityAccordion) {
    activityAccordion.addEventListener('click', () => {
      if (typeof window.toggleActivityAccordion === 'function') window.toggleActivityAccordion();
    });
  }

  // 비밀번호 표시 토글 로직 추가
  document.querySelectorAll('.btn-pw-toggle').forEach(btn => {
    btn.addEventListener('click', function () {
      const input = this.parentElement.querySelector('input');
      if (!input) return;
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      this.style.color = type === 'text' ? '#FF2D55' : '#9ca3af';
    });
  });
});





