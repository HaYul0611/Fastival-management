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
let _qrCountdown = 180;
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
    const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || '';
    const response = await fetch('/api/order/fnb', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (response.ok) {
      const fnbOrders = await response.json();
      MOCK_FOOD_ORDERS = fnbOrders.map(f => {
        const productName = f.items && f.items.length > 0 ? f.items[0].name : '푸드 상품';
        const quantity = f.items && f.items.length > 0 ? f.items[0].quantity : 1;

        let statusText = '주문 완료';
        if (f.status === 'RECEIVED') statusText = '주문 접수';
        else if (f.status === 'PREPARING') statusText = '조리 중';
        else if (f.status === 'READY') statusText = '조리 완료 (픽업 대기)';
        else if (f.status === 'PICKED_UP') statusText = '수령 완료';

        return {
          orderItemId: f.id,
          storeName: '춘향이네 야시장',
          productName: productName,
          quantity: quantity,
          selectedOptions: '기본 옵션',
          pickupTimeSlot: f.timestamp ? f.timestamp.split('.')[0] : '실시간 업데이트',
          totalPrice: f.price,
          itemStatus: f.status || 'RECEIVED',
          statusText: statusText,
          qrToken: f.id
        };
      });
      console.log('실제 DB 푸드트럭 주문 조회 완료:', MOCK_FOOD_ORDERS);
    }
  } catch (error) {
    console.error('DB 푸드트럭 주문 로드 실패:', error);
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
  // 등급 배지 및 프로그레스 바 로직 (SHOP 기준 통합)
  const gradeBadge = document.getElementById('profileGrade');
  const nextText = document.getElementById('gradeNextText');
  const gradeBar = document.getElementById('gradeBar');

  const totalSpent = _member.totalPurchaseAmount || 0;
  let nextTier = 'SILVER', nextGoal = 150000;

  if (['VIP', 'SVIP', 'VVIP'].includes(_member.grade)) {
    nextTier = 'SPECIAL';
  } else {
    if (totalSpent >= 10000000) { nextTier = 'MAX'; nextGoal = totalSpent; }
    else if (totalSpent >= 1000000) { nextTier = 'DIAMOND'; nextGoal = 10000000; }
    else if (totalSpent >= 500000) { nextTier = 'EMERALD'; nextGoal = 1000000; }
    else if (totalSpent >= 150000) { nextTier = 'GOLD'; nextGoal = 500000; }
    else { nextTier = 'SILVER'; nextGoal = 150000; }
  }

  if (gradeBadge) {
    // 뱃지 클래스를 소문자 통일 (CSS에서 대응 필요)
    gradeBadge.className = `grade-badge badge-${_member.grade.toLowerCase()}`;
    gradeBadge.innerHTML = `
      <svg class="icon mp-icon-sm" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      ${_member.grade}
    `;
  }

  if (nextTier === 'SPECIAL') {
    if (nextText) nextText.textContent = '특수 등급 계정입니다.';
    if (gradeBar) { gradeBar.style.width = '100%'; gradeBar.style.background = '#8930F8'; }
  } else if (nextTier === 'MAX') {
    if (nextText) nextText.textContent = '최고 등급인 DIAMOND 회원입니다.';
    if (gradeBar) { gradeBar.style.width = '100%'; gradeBar.style.background = '#B9F2FF'; }
  } else {
    let remain = nextGoal - totalSpent;
    if (nextText) nextText.textContent = `${nextTier} 등급까지 ₩${remain.toLocaleString()} 남음`;
    if (gradeBar) {
      let percent = Math.min((totalSpent / nextGoal) * 100, 100);
      gradeBar.style.width = percent + '%';
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
  if (!rawCode) return prefix + '00000000000';
  let clean = String(rawCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (/^[A-Z]/.test(clean)) {
    clean = clean.substring(1);
  }
  clean = prefix + clean;
  if (clean.length > 12) return clean.substring(0, 12);
  return clean.padEnd(12, '0');
}

let MOCK_FOOD_ORDERS = [];

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
  if (statFoods) statFoods.textContent = (typeof MOCK_FOOD_ORDERS !== 'undefined') ? MOCK_FOOD_ORDERS.length : 0;

  const ticketCount = document.getElementById('ticketCount');
  if (ticketCount) ticketCount.textContent = `${MOCK_TICKETS.length + _dbTickets.length + MOCK_FOOD_ORDERS.length}건`;
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
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=goods'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            굿즈 상품
          </div>
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=food'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
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
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=goods'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
            굿즈 상품 바로가기
          </div>
          <div class="custom-dropdown-option" onclick="event.stopPropagation(); window.location.href='/shop/shop.html?category=food'" style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; padding: 10px 16px;">
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
    <div>
      <h3 class="mp-section-title">
        <span class="mp-margin-r-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mp-icon-md"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></span> 푸드트럭 실시간 주문 내역 (${MOCK_FOOD_ORDERS.length}건)
      </h3>
  `;

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
          <div>주문 번호: <strong class="mp-color-success">${formatBarcode(f.orderItemId, 'F')}</strong></div>
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

/* QR 코드 이미지 URL 생성 (외부 라이브러리 불필요) */
function getQrImageUrl(text, size) {
  // 여러 QR API 시도 (순서대로)
  const apis = [
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=4&format=png`,
    `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}`,
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=0&format=png`
  ];
  return apis[0]; // 첫 번째 API 사용
}

/* 히어로 QR 카드에 QR 코드를 생성하는 함수 */
function generateHeroQR(token) {
  if (!token) return;
  const container = document.getElementById('qr-code-container');
  if (!container) {
    console.error('QR 컨테이너를 찾을 수 없음');
    return;
  }
  container.innerHTML = '';
  console.log('QR 생성 시작, 토큰:', token);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(token)}&margin=4&format=png`;

  const img = document.createElement('img');
  img.src = qrUrl;
  img.alt = 'QR Code';
  img.className = 'hero-qr-image';
  img.crossOrigin = 'anonymous';

  img.onload = function () {
    console.log('QR 이미지 로드 성공');
  };

  img.onerror = function () {
    console.error('QR 이미지 로드 실패');
    container.innerHTML = '<div class="qr-error-message">QR 로드 실패</div>';
  };

  container.appendChild(img);
}

/* QR 모달에 QR 코드 생성 */
function generateModalQR(token) {
  const container = document.getElementById('qrModalCanvas');
  if (!container) {
    console.error('모달 QR 컨테이너를 찾을 수 없음');
    return;
  }
  container.innerHTML = '';
  console.log('모달 QR 생성 시작, 토큰:', token);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(token)}&margin=4&format=png`;

  const img = document.createElement('img');
  img.src = qrUrl;
  img.alt = 'QR Code';
  img.className = 'modal-qr-image';
  img.crossOrigin = 'anonymous';

  img.onload = function () {
    console.log('모달 QR 이미지 로드 성공');
  };

  img.onerror = function () {
    console.error('모달 QR 이미지 로드 실패');
    container.innerHTML = '<div class="modal-qr-error-message">QR 로드 실패</div>';
  };

  container.appendChild(img);
}

/* 히어로 QR + 모달 QR 피해 토큰 공유 */
let _currentQrToken = '';

function showTicketQr(token) {
  openQrModalView(token, 'TICKET');
}

function showFoodQr(token) {
  openQrModalView(token, 'FOOD');
}

function openQrModalView(token, type = 'TICKET') {
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
  generateModalQR(qrToken);

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
        window.location.href = `/features/user/ticket/view.html?orderId=${orderId}&secret=${qrToken}&displayCode=${displayCode}&userName=${encodeURIComponent(userNameParam)}`;
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

/* 모달 내 타이머 동기화 */
function syncModalTimer() {
  updateModalTimerBar(_qrCountdown);
  updateModalTimerText(_qrCountdown);
}

function updateModalTimerBar(sec) {
  const modalTimerBar = document.getElementById('qrModalTimerBar');
  if (modalTimerBar) {
    const pct = ((180 - sec) / 180) * 100;
    modalTimerBar.style.width = `${pct}%`;
  }
}

function updateHeroRing(sec) {
  const ring = document.getElementById('heroQrRing');
  if (!ring) return;
  const CIRC = 69.1;
  const offset = CIRC * (1 - sec / 180);
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = sec <= 10 ? '#ff4757' : '#8930F8';
}

function updateModalTimerText(sec) {
  const el = document.getElementById('qrModalTimer');
  if (!el) return;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  el.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  el.style.color = sec <= 10 ? '#ff4757' : '#3b2667';
}

/* 히어로 + 모달 타이머 통합 디스플레이 */
function updateQRTimerDisplay(sec) {
  // 히어로 타이머 텍스트
  const heroTimer = document.getElementById('heroQrTimer');
  if (heroTimer) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    heroTimer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  // qr-timer-text 클래스 (fallback)
  const textEls = document.querySelectorAll('.qr-timer-text');
  textEls.forEach(el => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    el.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  // 히어로 타이머 바 업데이트
  const heroTimerBar = document.getElementById('heroQrTimerBar');
  const timerWrap = document.querySelector('.hero-qr-timer-bar-wrap');
  if (heroTimerBar) {
    const pct = ((180 - sec) / 180) * 100;
    heroTimerBar.style.width = `${pct}%`;
  }
  if (timerWrap) {
    if (sec <= 60) {
      timerWrap.style.background = '#ff4757';
    } else {
      timerWrap.style.background = 'linear-gradient(135deg, #00d2ff 0%, #8930F8 100%)';
    }
  }

  if (heroTimer) {
    if (sec <= 60) {
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

function initHeroQr() {
  // DB 결제 완료 티켓의 secret이 있으면 우선 사용, 없으면 MOCK_TICKETS에 qrToken이 있으면 사용, 없으면 생성
  const dbToken = _dbTickets && _dbTickets[0] && _dbTickets[0].secret;
  const mockToken = MOCK_TICKETS && MOCK_TICKETS[0] && MOCK_TICKETS[0].qrToken;
  const initialToken = dbToken || mockToken || generateQrToken('T');
  _currentQrToken = initialToken;

  console.log('QR 초기화, 토큰:', initialToken);

  // QR 생성 (외부 API 사용)
  generateHeroQR(initialToken);
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

/* 3분 QR 자동 갱신 사이클 */
function startQRRefreshCycle() {
  _qrCountdown = 180;
  updateQRTimerDisplay(180);

  clearInterval(_qrTimer);
  clearInterval(_qrCountTimer);

  _qrTimer = setInterval(() => {
    const newToken = generateQrToken();
    _currentQrToken = newToken;

    // 히어로 QR 갱신
    generateHeroQR(newToken);

    // 모달이 열려 있으면 모달 QR도 갱신
    const overlay = document.getElementById('qrModalOverlay');
    if (overlay && overlay.classList.contains('active')) {
      generateModalQR(newToken);
      const codeEl = document.getElementById('qrModalCode');
      if (codeEl) codeEl.textContent = newToken;
    }

    _qrCountdown = 180;
    if (window.Toast) window.Toast.info('보안을 위해 QR이 자동 갱신되었습니다.');
  }, 180000);

  _qrCountTimer = setInterval(() => {
    _qrCountdown = Math.max(0, _qrCountdown - 1);
    updateQRTimerDisplay(_qrCountdown);
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
      <div class="mp-card-header" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="toggleAccordion(${q.id})">
        <h4 class="mp-inquiry-title" style="font-size:1.1rem; margin:0; font-weight:600; flex:1;">${q.title}</h4>
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="mp-inquiry-date" style="font-size:0.85rem; color:var(--text-muted);">${new Date(q.createdAt).toLocaleString()}</span>
          <span class="mp-badge ${q.status === '답변완료' ? 'status-완료' : 'status-대기'}">${q.status}</span>
          <svg id="arrow-${q.id}" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; transition:transform 0.3s;"><path d="M6 9l6 6 6-6"/></svg>
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
  const selectedRating = isHalf ? baseVal - 0.5 : baseVal;
  const container = document.querySelector(`.inquiry-stars[data-id="${qId}"]`);

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
    <div class="mp-card coupon-card" style="display:flex; justify-content:space-between; align-items:center; position:relative; padding:16px 20px; margin-bottom:12px;">
      <button class="coupon-delete-btn" onclick="deleteCoupon(${c.id})" style="position:absolute; top:-10px; right:-10px; width:26px; height:26px; background:#ff4757; color:white; border:none; border-radius:50%; font-size:12px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(255, 71, 87, 0.4); opacity:0; transition:opacity 0.2s, transform 0.2s; z-index:2;">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      
      <div>
        <p class="mp-coupon-desc" style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">${c.desc}</p>
        <h3 class="mp-coupon-title" style="margin:0 0 6px 0; font-size:1.15rem;">${c.title}</h3>
        <p class="mp-coupon-meta" style="font-size:0.85rem; color:var(--text-secondary); margin:0;">${c.limit}</p>
      </div>
      
      <div style="display:flex; flex-direction:column; align-items:flex-end;">
        <div style="text-align:center; margin-bottom:10px;">
          <svg viewBox="0 0 100 24" style="width:100px; height:24px; margin:0 auto; display:block;">
            <rect x="0" y="0" width="4" height="24" fill="#333"/><rect x="6" y="0" width="2" height="24" fill="#333"/><rect x="12" y="0" width="6" height="24" fill="#333"/><rect x="22" y="0" width="4" height="24" fill="#333"/><rect x="30" y="0" width="2" height="24" fill="#333"/><rect x="36" y="0" width="8" height="24" fill="#333"/><rect x="48" y="0" width="4" height="24" fill="#333"/><rect x="56" y="0" width="2" height="24" fill="#333"/><rect x="62" y="0" width="10" height="24" fill="#333"/><rect x="76" y="0" width="4" height="24" fill="#333"/><rect x="84" y="0" width="2" height="24" fill="#333"/><rect x="90" y="0" width="6" height="24" fill="#333"/><rect x="100" y="0" width="4" height="24" fill="#333"/>
          </svg>
          <p style="font-size:0.75rem; letter-spacing:1px; margin-top:6px; font-family:monospace; color:#333; margin-bottom:0;">${c.code}</p>
        </div>
        <div style="display:flex; flex-direction:row; align-items:center; justify-content:flex-end; gap:8px;">
          <p class="mp-coupon-date" style="font-size:0.8rem; color:var(--text-muted); margin:0;">~${c.date}</p>
        </div>
      </div>
      <span class="mp-coupon-badge" style="position:absolute; top:-10px; left:-10px; padding:6px 10px; background:linear-gradient(135deg, #8930F8 0%, #6b21c5 100%); color:white; border-radius:6px; font-weight:bold; font-size:0.8rem; box-shadow:0 3px 6px rgba(0,0,0,0.2); z-index:2;">보유중</span>
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
          updateReviewStars(isHalf ? baseVal - 0.5 : baseVal, true);
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
        currentRating = isHalf ? baseVal - 0.5 : baseVal;
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
  const btnSave = document.getElementById('btn-save-profile');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const nicknameVal = document.getElementById('profileNickname').value.trim();
      const phoneVal = document.getElementById('profilePhone').value.trim();

      if (!nicknameVal || !phoneVal) {
        if (window.Toast) window.Toast.error('정보를 올바르게 입력해주세요.');
        else alert('정보를 입력해주세요.');
        return;
      }

      const userToken = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      try {
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

    // + 버튼 유지 (최대 10개 미만일 때만)
    const addBtnHtml = selectedFiles.length < 10 ? `
      <div class="add-img-btn" onclick="document.getElementById('inqImages').click()" style="flex-shrink: 0; width: 60px; height: 60px; border: 1px dashed #cbd5e1; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: #f8fafc; transition: all 0.2s;">
        <span style="font-size: 20px; color: #94a3b8; line-height: 1;">+</span>
        <span style="font-size: 0.7rem; color: #94a3b8; margin-top: 2px;" id="inqImageCount">${selectedFiles.length}/10</span>
      </div>
    ` : '';

    const thumbnailsHtml = selectedFiles.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return `
        <div style="flex-shrink: 0; position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" />
          <button type="button" onclick="window.removeInquiryImage(${idx})" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer;">✕</button>
        </div>
      `;
    }).join('');

    imgPreviewContainer.innerHTML = addBtnHtml + thumbnailsHtml;

    // 10개가 꽉 차면 카운트 표시를 업데이트 할 수 없으므로 숨김 버튼을 만들진 않고 렌더링 안 함
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

let _currentQrType = 'TICKET';

function openQrModalView(token, type = 'TICKET') {
  _currentQrType = type;
  let modal = document.getElementById('dynamicQrModal');
  if (!modal) {
    let name = (window._member && window._member.name) ? window._member.name : '';
    if (!name) {
      const profileNameEl = document.getElementById('profileName');
      if (profileNameEl) name = profileNameEl.innerText.replace(/님|반가워요|,|!/g, '').trim();
    }
    if (!name || name === '로딩 중...') name = '회원';

    let masked = name;
    if (name.length > 2) masked = name.substring(0, 1) + '*' + name.substring(2);
    else if (name.length === 2) masked = name.substring(0, 1) + '*';

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
              <div class="qr-canvas-container" style="border-radius: 12px; border: 2px solid #e0d8ff; background: #fff; padding: 8px; position: relative; overflow: hidden; display: flex; justify-content: center; align-items: center; width: 160px; height: 160px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
              <div id="dynamicQrCanvas" style="width: 100%; height: 100%; z-index: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;"></div>
            </div>
            
            <div style="text-align: center;">
                <div style="font-family: 'Inter', sans-serif; font-size: 1.1rem; font-weight: 800; letter-spacing: 1px; color: #111;" id="dynamicQrCode"></div>
                <div style="font-size: 0.85rem; color: #444; margin-top: 6px; font-weight: 600;" id="dynamicQrUserName">${masked}</div>
                <div style="font-size: 0.8rem; color: #888; margin-top: 2px;" id="dynamicQrPurchaseDate">${dateStr} 구매</div>
            </div>
            
            <div style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; max-width: 280px; margin: 4px auto 0;">
              <span id="dynamicQrTimerText" style="font-size: 0.9rem; font-weight: 800; color: #8930F8; display: inline-block; min-width: 42px; text-align: center;">03:00</span>
              <div style="flex: 1; height: 6px; background: #EFEFEF; border-radius: 6px; overflow: hidden; position: relative;">
                <div id="dynamicQrTimerBar" style="position: absolute; left: 0; top: 0; height: 100%; width: 100%; background: linear-gradient(135deg, #00d2ff, #8930F8); transform-origin: left; transition: transform 1s linear, background 0.3s ease;"></div>
              </div>
              <button id="dynamicQrRefresh" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; color: #8930F8; transition: transform 0.2s;" title="새로고침">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              </button>
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
      triggerQrRefresh();
    });
  }

  modal.style.display = 'flex';
  generateDynamicQR('dynamicQrCanvas', token, 140, type); // FIXED: pass 'type' to trigger 45deg tilt!

  let displayCode = token;
  if (type === 'FOOD') {
    const foodOrder = typeof MOCK_FOOD_ORDERS !== 'undefined' ? MOCK_FOOD_ORDERS.find(f => f.qrToken === token) : null;
    if (foodOrder) displayCode = foodOrder.orderItemId;
  } else if (type === 'GOODS') {
    const goodsOrder = typeof MOCK_GOODS_ORDERS !== 'undefined' ? MOCK_GOODS_ORDERS.find(g => g.qrToken === token) : null;
    if (goodsOrder) displayCode = goodsOrder.orderItemId;
  } else {
    const dbTicket = typeof _dbTickets !== 'undefined' ? _dbTickets.find(t => t.secret === token) : null;
    if (dbTicket) {
      displayCode = dbTicket.ticketNumber || ('T' + String(dbTicket.orderId).padStart(11, '0'));
    } else {
      const mockTicket = typeof MOCK_TICKETS !== 'undefined' ? MOCK_TICKETS.find(t => t.qrToken === token) : null;
      if (mockTicket) displayCode = mockTicket.reservationId;
    }
  }
  document.getElementById('dynamicQrCode').textContent = formatBarcode(displayCode, type === 'FOOD' ? 'F' : type === 'GOODS' ? 'G' : 'T');

  const qrCanvas = document.getElementById('dynamicQrCanvas');
  if (qrCanvas) {
    if (type === 'TICKET') {
      qrCanvas.style.cursor = 'pointer';
      qrCanvas.onclick = () => {
        const tkt = typeof _dbTickets !== 'undefined' ? _dbTickets.find(t => t.secret === token) : null;
        const orderId = tkt ? tkt.orderId : 1;
        const userNameEl = document.getElementById('dynamicQrUserName');
        const userNameParam = userNameEl ? userNameEl.textContent : '';
        window.location.href = `/features/user/ticket/view.html?orderId=${orderId}&secret=${token}&displayCode=${displayCode}&userName=${encodeURIComponent(userNameParam)}&grade=${encodeURIComponent(_member ? _member.grade : 'BRONZE')}`;
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
  const img = document.createElement('img');

  // Use margin=0 for heart so it blends directly with the background, 2 for regular.
  const margin = isHeart ? 0 : 2;
  const ts = new Date().getTime();

  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(token)}&margin=${margin}&format=${isHeart ? 'svg' : 'png'}&_=${ts}`;
  img.alt = 'QR Code';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.style.position = 'relative';
  img.style.zIndex = '1';
  img.style.imageRendering = 'pixelated'; // Prevent blurriness when scaled

  if (isHeart) {
    // 사용자 요청사항: 원본 QR을 45도 기울여서 빈 모서리가 하단 뾰족한 부분으로 가고, 
    // 네모 마커 3개가 좌/우/상단(2번 이미지 붉은 형광펜 위치)에 오도록 배치
    // 0.5 스케일 + translateY(9px): 상단 마커는 오목한 곳에 고정(절대 안 움직임)시킨 상태로, 
    // 좌/우 마커만 겉 테두리선에 완벽하게 닿을 때까지 사이즈를 확대시키는 마법의 공식입니다.
    img.style.transform = 'translateY(9px) rotate(45deg) scale(0.5)';

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

  container.appendChild(img);
}

function generateHeroQR(token) {
  if (!token) return;
  generateDynamicQR('qr-code-container', token, 100);
}

function triggerQrRefresh() {
  const prefix = _currentQrType === 'FOOD' ? 'F' : (_currentQrType === 'GOODS' ? 'G' : 'T');
  const newToken = generateQrToken(prefix);
  _currentQrToken = newToken;

  generateHeroQR(newToken);

  const modal = document.getElementById('dynamicQrModal');
  if (modal && modal.style.display !== 'none') {
    generateDynamicQR('dynamicQrCanvas', newToken, 140, _currentQrType);
    const codeEl = document.getElementById('dynamicQrCode');
    if (codeEl) codeEl.textContent = newToken;
  }

  // 완전한 타이머 주기 리셋을 위해 startQRRefreshCycle 호출
  startQRRefreshCycle();
}

let _qrStartTime = 0;
let _qrRafId = null;

function startQRRefreshCycle() {
  _qrCountdown = 180;
  clearInterval(_qrTimer);
  clearInterval(_qrCountTimer);
  if (_qrRafId) cancelAnimationFrame(_qrRafId);

  _qrStartTime = Date.now();

  _qrTimer = setInterval(() => {
    triggerQrRefresh();
    if (window.Toast) window.Toast.info('보안을 위해 QR이 자동 갱신되었습니다');
  }, 180000);

  _qrCountTimer = setInterval(() => {
    _qrCountdown = Math.max(0, Math.ceil((180000 - (Date.now() - _qrStartTime)) / 1000));
    updateModalTimerText(_qrCountdown);
    const bg = _qrCountdown < 60 ? 'linear-gradient(135deg, #ff4d4f, #ff7875)' : 'linear-gradient(135deg, #00d2ff, #8930F8)';
    const bars = [document.getElementById('dynamicQrTimerBar'), document.getElementById('heroQrTimerBar')];
    bars.forEach(bar => { if (bar) bar.style.background = bg; });
  }, 1000);

  function animateBar() {
    const elapsed = Date.now() - _qrStartTime;
    const remaining = Math.max(0, 180000 - elapsed);
    const pct = remaining / 180000;

    const bars = [document.getElementById('dynamicQrTimerBar'), document.getElementById('heroQrTimerBar')];
    bars.forEach(bar => {
      if (bar) bar.style.transform = `scaleX(${pct})`;
    });

    if (remaining > 0) {
      _qrRafId = requestAnimationFrame(animateBar);
    }
  }
  _qrRafId = requestAnimationFrame(animateBar);
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
        triggerQrRefresh();
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
});

