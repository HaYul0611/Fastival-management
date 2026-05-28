// ============================================================
// src/features/order/seat-map.js
// 역할: 구역/좌석 실시간 시각화, 4매 제한, 발권 유형 선택,
//       성인 인증 인터셉트, Supabase Realtime 좌석 동기화,
//       결제 성공 후 order_item N건 Bulk Insert
// ============================================================

import {
    supabase,
    getCurrentUser,
    getUserProfile,
    generateQRCode,
    getQRExpiredAt
} from '../common/supabase-client.js?v=2';

let maxTicketModalInst, adultModalInst, loginModalInst;

// ──────────────────────────────────────
// 상수
// ──────────────────────────────────────
const MAX_TICKETS = 4;

// ──────────────────────────────────────
// 상태 관리 (단순 객체)
// ──────────────────────────────────────
const state = {
    festivalId: null,
    festivalData: null,
    currentUser: null,
    userProfile: null,
    selectedZoneId: null,
    selectedSeats: [],        // [{ seat_id, zone_name, seat_row, seat_number, price }]
    ticketTypes: {},          // { seatIndex: { type: 'GENERAL'|'VULNERABLE', name, birth } }
    paymentMethod: 'PG_TEST'
};

// ──────────────────────────────────────
// DOM 요소 캐시
// ──────────────────────────────────────
const DOM = {
    eventTitle:       document.getElementById('eventTitle'),
    eventDate:        document.getElementById('eventDate'),
    adultOnlyBadge:   document.getElementById('adultOnlyBadge'),
    adultVerifyBanner:document.getElementById('adultVerifyBanner'),
    adultBannerMsg:   document.getElementById('adultBannerMsg'),
    adultVerifyBtn:   document.getElementById('adultVerifyBtn'),
    venueMapBg:       document.getElementById('venueMapBg'),
    venueMapSvg:      document.getElementById('venueMapSvg'),
    venuePins:        document.getElementById('venuePins'),
    mapPanel:         document.getElementById('mapPanel'),
    seatPanel:        document.getElementById('seatPanel'),
    seatPanelBack:    document.getElementById('seatPanelBack'),
    seatZoneName:     document.getElementById('seatZoneName'),
    seatGrid:         document.getElementById('seatGrid'),
    selectedCount:    document.getElementById('selectedCount'),
    ticketTypeList:   document.getElementById('ticketTypeList'),
    summaryPrice:     document.getElementById('summaryPrice'),
    summaryDiscount:  document.getElementById('summaryDiscount'),
    summaryTotal:     document.getElementById('summaryTotal'),
    festioPayBalance: document.getElementById('festioPayBalance'),
    bookingBtn:       document.getElementById('bookingBtn'),
    orderPanel:       document.getElementById('orderPanel'),
    orderPanelClose:  document.getElementById('orderPanelClose'),
    headerLoginBtn:   document.getElementById('headerLoginBtn'),
    maxTicketModal:   document.getElementById('maxTicketModal'),
    adultModal:       document.getElementById('adultModal'),
    adultModalTitle:  document.getElementById('adultModalTitle'),
    adultModalBody:   document.getElementById('adultModalBody'),
    adultModalVerifyBtn: document.getElementById('adultModalVerifyBtn'),
    adultModalClose:  document.getElementById('adultModalClose'),
    loginModal:       document.getElementById('loginModal'),
    loginEmail:       document.getElementById('loginEmail'),
    loginPassword:    document.getElementById('loginPassword'),
    loginError:       document.getElementById('loginError'),
    loginSubmitBtn:   document.getElementById('loginSubmitBtn'),
};

// ──────────────────────────────────────
// 드래그 기능 함수
// ──────────────────────────────────────
function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        handle.style.cursor = 'grabbing';
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.right = "auto";
        el.style.bottom = "auto";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        handle.style.cursor = 'grab';
    }
}

// ──────────────────────────────────────
// 초기화 실행
// ──────────────────────────────────────
async function init() {
    // URL 파라미터에서 festival_id 추출 (없으면 1로 기본값 설정하여 테스트 가능하게 함)
    const params = new URLSearchParams(window.location.search);
    state.festivalId = parseInt(params.get('festival_id')) || 1;

    if (!state.festivalId) {
        alert('행사 정보를 찾을 수 없습니다.');
        return;
    }

    // 현재 로그인 유저 로드
    state.currentUser = await getCurrentUser();
    if (state.currentUser) {
        state.userProfile = await getUserProfile(state.currentUser.id);
        updateHeaderBtn(true);
        DOM.festioPayBalance.textContent = `잔액: ${state.userProfile.balance.toLocaleString()}원`;
    } else {
        updateHeaderBtn(false);
    }

    // 부트스트랩 모달 인스턴스 초기화
    maxTicketModalInst = new bootstrap.Modal(document.getElementById('maxTicketModal'));
    adultModalInst = new bootstrap.Modal(document.getElementById('adultModal'));
    loginModalInst = new bootstrap.Modal(document.getElementById('loginModal'));

    await loadFestivalData();
    setupEventListeners();
    setupRealtimeSubscription();
    renderCharts();
    
    // 예매 패널 드래그 기능 활성화
    if (DOM.orderPanel) {
        const header = DOM.orderPanel.querySelector('.card-header');
        if (header) {
            header.style.cursor = 'grab';
            makeDraggable(DOM.orderPanel, header);
        }
    }
}

// ──────────────────────────────────────
// 행사 데이터 로드
// ──────────────────────────────────────
async function loadFestivalData() {
    const { data: festival, error } = await supabase
        .from('festival')
        .select('*')
        .eq('id', state.festivalId)
        .single();

    if (error || !festival) {
        alert('행사 정보를 불러오지 못했습니다.');
        return;
    }

    state.festivalData = festival;

    // UI 반영
    DOM.eventTitle.textContent = festival.name;
    DOM.eventDate.textContent = `${festival.start_date} ~ ${festival.end_date}`;
    if (festival.map_image_url) DOM.venueMapBg.src = festival.map_image_url;

    // 성인 전용 행사 처리
    if (festival.is_adult_only) {
        DOM.adultOnlyBadge.hidden = false;
        checkAdultAccess();
    }

    await loadZones();
}

// ──────────────────────────────────────
// 성인 인증 접근 체크
// ──────────────────────────────────────
function checkAdultAccess() {
    // 비로그인
    if (!state.userProfile) {
        DOM.adultVerifyBanner.hidden = false;
        DOM.adultBannerMsg.textContent = '성인 전용 행사입니다. 로그인 후 본인인증을 완료해야 예매 가능합니다.';
        return;
    }
    // 본인인증 미완료
    if (!state.userProfile.identity_verified) {
        DOM.adultVerifyBanner.hidden = false;
        DOM.adultBannerMsg.textContent = '이 행사는 성인 전용입니다. 예매를 위해 본인인증이 필요합니다.';
        return;
    }
    // 미성년자
    if (!state.userProfile.is_adult) {
        DOM.adultVerifyBanner.hidden = false;
        DOM.adultBannerMsg.textContent = '이 행사는 만 19세 이상만 입장 가능합니다. 예매가 제한됩니다.';
        DOM.adultVerifyBtn.hidden = true;  // 인증해도 안 됨
    }
}

// ──────────────────────────────────────
// 구역(Zone) 로드 및 SVG 렌더링
// ──────────────────────────────────────
async function loadZones() {
    const { data: zones, error } = await supabase
        .from('festival_zone')
        .select('*')
        .eq('festival_id', state.festivalId);

    if (error || !zones) return;

    // 프리미엄 스타디움 SVG 하드코딩 렌더링
    DOM.venueMapSvg.innerHTML = `
      <defs>
        <style>
          .stadium-zone { stroke: #ffffff; stroke-width: 3; cursor: pointer; transition: all 0.3s ease; }
          .stadium-zone:hover { filter: brightness(1.2) drop-shadow(0 0 10px rgba(255,255,255,0.5)); stroke-width: 5; }
          .stadium-zone.sold-out { fill: #e2e8f0; cursor: not-allowed; }
          .zone-text { fill: #ffffff; font-family: 'Public Sans', sans-serif; font-weight: bold; font-size: 20px; pointer-events: none; text-anchor: middle; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
          .zone-subtext { fill: rgba(255,255,255,0.9); font-family: 'Public Sans', sans-serif; font-size: 14px; pointer-events: none; text-anchor: middle; }
        </style>
      </defs>

      <!-- 그라운드 배경 -->
      <path d="M 0,0 L 800,0 L 800,600 L 0,600 Z" fill="transparent" />

      <!-- 외야 (빈 구역) -->
      <path class="stadium-zone sold-out" d="M 100,200 C 100,0 700,0 700,200 L 600,250 C 600,100 200,100 200,250 Z" />
      <text x="400" y="100" class="zone-text" style="fill: #64748b; filter: none;">외야석 (오픈예정)</text>
      
      <!-- 좌측 외야 커플석 -->
      <path id="svg-zone-couple-1" class="stadium-zone" d="M 50,300 C 50,200 100,200 100,200 L 200,250 C 150,280 150,350 150,350 Z" fill="#ffb6c1" />
      <text x="130" y="270" class="zone-text" style="fill: #be185d;">커플석</text>

      <!-- 우측 외야 커플석 -->
      <path id="svg-zone-couple-2" class="stadium-zone" d="M 750,300 C 750,200 700,200 700,200 L 600,250 C 650,280 650,350 650,350 Z" fill="#ffb6c1" />
      <text x="670" y="270" class="zone-text" style="fill: #be185d;">커플석</text>

      <!-- 구역 1: VIP (DB 매핑용) -->
      <path id="svg-zone-0" class="stadium-zone" d="M 300,400 L 500,400 L 550,450 C 450,520 350,520 250,450 Z" fill="#d4af37" />
      <text x="400" y="440" class="zone-text" id="svg-text-0">VIP 구역</text>

      <!-- 구역 2: 일반석 (DB 매핑용) -->
      <path id="svg-zone-1" class="stadium-zone" d="M 200,300 C 300,220 500,220 600,300 L 550,360 C 450,280 350,280 250,360 Z" fill="#28a745" />
      <text x="400" y="290" class="zone-text" id="svg-text-1">일반석 구역</text>
      
      <!-- 구역 3: 스탠딩 (DB 매핑용) -->
      <path id="svg-zone-2" class="stadium-zone" d="M 250,450 C 350,520 450,520 550,450 L 400,600 Z" fill="#3b82f6" />
      <text x="400" y="520" class="zone-text" id="svg-text-2">스탠딩석</text>

      <!-- 홈플레이트 / 다이아몬드 (장식) -->
      <polygon points="400,340 430,370 400,400 370,370" fill="#ffffff" opacity="0.8" style="pointer-events:none;" />
    `;

    // DB 데이터와 SVG 도형 매핑
    zones.forEach((zone, index) => {
        if (index > 2) return; // 데모 SVG는 최대 3구역만 매핑
        
        const pathEl = DOM.venueMapSvg.querySelector('#svg-zone-' + index);
        const textEl = DOM.venueMapSvg.querySelector('#svg-text-' + index);
        
        if (pathEl && textEl) {
            textEl.textContent = zone.zone_name;
            pathEl.setAttribute('data-zone-id', zone.id);
            
            // 밀집도 표시 텍스트 추가
            const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            sub.setAttribute('x', textEl.getAttribute('x'));
            sub.setAttribute('y', parseInt(textEl.getAttribute('y')) + 22);
            sub.setAttribute('class', 'zone-subtext');
            sub.textContent = `[${zone.density_level}]`;
            DOM.venueMapSvg.appendChild(sub);

            // 구역 클릭 시 좌석 화면(Seat View)으로 전환
            pathEl.addEventListener('click', () => onZoneClick(zone));
        }
    });

    // 커플석 클릭 시 데모 처리
    const couple1 = DOM.venueMapSvg.querySelector('#svg-zone-couple-1');
    const couple2 = DOM.venueMapSvg.querySelector('#svg-zone-couple-2');
    const coupleHandler = () => alert('커플석은 현재 준비 중입니다.');
    if (couple1) couple1.addEventListener('click', coupleHandler);
    if (couple2) couple2.addEventListener('click', coupleHandler);

    await loadStorePins();
}

// 부스 핀 렌더링
async function loadStorePins() {
    const { data: stores } = await supabase
        .from('store')
        .select('*')
        .eq('is_open', true);

    if (!stores) return;

    stores.forEach(store => {
        const pin = document.createElement('div');
        pin.className = 'store-pin';
        pin.style.left = `${store.map_x_percent}%`;
        pin.style.top = `${store.map_y_percent}%`;
        pin.setAttribute('data-store-id', store.id);

        const iconColor = store.category === 'FOOD' ? '#F59E0B' : '#8B5CF6';
        pin.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="${iconColor}" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
            <div class="store-pin__label">${store.name}</div>
        `;
        DOM.venuePins.appendChild(pin);
    });
}

// ──────────────────────────────────────
// 구역 클릭 → 좌석 패널 전환
// ──────────────────────────────────────
async function onZoneClick(zone) {
    // 성인 전용 행사 접근 차단 (미성년자 / 미인증)
    if (state.festivalData.is_adult_only) {
        if (!state.currentUser) {
            openLoginModal();
            return;
        }
        if (!state.userProfile.identity_verified) {
            openAdultModal('본인인증 필요', '이 행사는 성인 전용입니다. 예매를 위해 본인인증이 필요합니다.');
            return;
        }
        if (!state.userProfile.is_adult) {
            openAdultModal('미성년자 예매 불가', '이 행사는 만 19세 이상만 예매할 수 있습니다. 미성년자는 타인 명의로 인증하더라도 예매가 제한됩니다.', false);
            return;
        }
    }

    state.selectedZoneId = zone.id;
    DOM.seatZoneName.textContent = zone.zone_name;
    
    // 도면(Map View) 숨기고 좌석(Seat View) 보이기 (2-Depth)
    if (DOM.mapPanel) DOM.mapPanel.hidden = true;
    if (DOM.seatPanel) DOM.seatPanel.hidden = false;
    
    await loadSeats(zone.id);
}

// ──────────────────────────────────────
// 좌석 로드 및 그리드 렌더링
// ──────────────────────────────────────
async function loadSeats(zoneId) {
    DOM.seatGrid.innerHTML = '<p style="padding:20px;color:#6B7280;font-size:13px;">좌석 정보 로딩 중...</p>';

    const { data: seats, error } = await supabase
        .from('seat_map')
        .select('*')
        .eq('zone_id', zoneId)
        .order('seat_row')
        .order('seat_number');

    if (error || !seats) {
        DOM.seatGrid.innerHTML = '<p style="padding:20px;color:#EF4444;font-size:13px;">좌석 정보를 불러오지 못했습니다.</p>';
        return;
    }

    // 열(row) 그룹화
    const rowMap = {};
    seats.forEach(seat => {
        if (!rowMap[seat.seat_row]) rowMap[seat.seat_row] = [];
        rowMap[seat.seat_row].push(seat);
    });

    DOM.seatGrid.innerHTML = '';

    Object.entries(rowMap).forEach(([rowLabel, rowSeats]) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'd-flex justify-content-center mb-1';

        rowSeats.forEach(seat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn p-0 m-1';
            btn.style.width = '25px';
            btn.style.height = '25px';
            btn.style.fontSize = '8px';
            btn.textContent = seat.seat_number;
            btn.dataset.seatId = seat.id;
            btn.dataset.row = seat.seat_row;
            btn.dataset.number = seat.seat_number;
            btn.dataset.price = seat.price;

            const isSelected = state.selectedSeats.some(s => s.seat_id === seat.id);

            if (seat.status === '결제완료' || seat.is_reserved) {
                btn.classList.add('btn-danger');
                btn.disabled = true;
            } else if (seat.status === '가선점') {
                btn.classList.add('btn-warning');
                btn.disabled = true;
            } else if (isSelected) {
                btn.classList.add('btn-primary');
            } else {
                btn.classList.add('btn-success');
            }

            btn.addEventListener('click', () => onSeatClick(seat, btn));
            rowEl.appendChild(btn);
        });

        DOM.seatGrid.appendChild(rowEl);
    });
}

// ──────────────────────────────────────
// 좌석 클릭 (선택/해제)
// ──────────────────────────────────────
function onSeatClick(seat, btn) {
    const existingIndex = state.selectedSeats.findIndex(s => s.seat_id === seat.id);

    if (existingIndex !== -1) {
        // 선택 해제
        state.selectedSeats.splice(existingIndex, 1);
        delete state.ticketTypes[existingIndex];
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
    } else {
        // 4매 초과 체크
        if (state.selectedSeats.length >= MAX_TICKETS) {
            if (maxTicketModalInst) maxTicketModalInst.show();
            return;
        }
        // 선택 추가
        state.selectedSeats.push({
            seat_id: seat.id,
            zone_id: seat.zone_id,
            seat_row: seat.seat_row,
            seat_number: seat.seat_number,
            price: seat.price
        });
        state.ticketTypes[state.selectedSeats.length - 1] = { type: 'GENERAL', name: '', birth: '' };
        btn.classList.remove('btn-success');
        btn.classList.add('btn-primary');
    }

    updateOrderPanel();
}

// ──────────────────────────────────────
// 주문 패널 업데이트 (카운터 + 발권유형 + 금액)
// ──────────────────────────────────────
function updateOrderPanel() {
    const count = state.selectedSeats.length;
    DOM.selectedCount.textContent = count;
    DOM.bookingBtn.disabled = count === 0;

    if (count > 0 && DOM.orderPanel) {
        DOM.orderPanel.style.display = 'block';
    } else if (count === 0 && DOM.orderPanel) {
        DOM.orderPanel.style.display = 'none';
    }

    // 발권 유형 선택 컴포넌트 재렌더링
    renderTicketTypeList();

    // 금액 계산
    const totalPrice = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);
    const grade = state.userProfile?.membership_grade || 'BRONZE';
    const discountRate = { BRONZE: 0, SILVER: 0.03, GOLD: 0.05, VIP: 0.10 }[grade] || 0;
    const discount = Math.floor(totalPrice * discountRate);
    const finalPrice = totalPrice - discount;

    DOM.summaryPrice.textContent = `${totalPrice.toLocaleString()}원`;
    DOM.summaryDiscount.textContent = `-${discount.toLocaleString()}원`;
    DOM.summaryTotal.textContent = `${finalPrice.toLocaleString()}원`;
}

// ──────────────────────────────────────
// 발권 유형 선택 컴포넌트 렌더링
// ──────────────────────────────────────
function renderTicketTypeList() {
    DOM.ticketTypeList.innerHTML = '';

    state.selectedSeats.forEach((seat, idx) => {
        const item = document.createElement('div');
        item.className = 'sm-ticket-type-item';
        item.dataset.ticketIndex = idx;

        const currentType = state.ticketTypes[idx]?.type || 'GENERAL';

        item.innerHTML = `
            <div class="sm-ticket-type-item__seat">${seat.seat_row} ${seat.seat_number}번 · ${seat.price.toLocaleString()}원</div>
            <div class="sm-ticket-type-item__options">
                <label class="sm-ticket-type-option">
                    <input type="radio" name="type_${idx}" value="GENERAL" ${currentType === 'GENERAL' ? 'checked' : ''}>
                    <span>일반 (모바일 발권)</span>
                </label>
                <label class="sm-ticket-type-option">
                    <input type="radio" name="type_${idx}" value="VULNERABLE" ${currentType === 'VULNERABLE' ? 'checked' : ''}>
                    <span>노인/아동 동반 (현장 팔찌)</span>
                </label>
            </div>
            <div class="sm-ticket-type-vulnerable-form" ${currentType === 'VULNERABLE' ? '' : 'hidden'}>
                <input type="text" placeholder="동반자 실명" name="vul_name_${idx}"
                    value="${state.ticketTypes[idx]?.name || ''}">
                <input type="text" placeholder="생년월일 (예: 19450301)" name="vul_birth_${idx}"
                    value="${state.ticketTypes[idx]?.birth || ''}">
            </div>
        `;

        // 라디오 변경 이벤트
        item.querySelectorAll(`input[name="type_${idx}"]`).forEach(radio => {
            radio.addEventListener('change', () => {
                state.ticketTypes[idx] = { ...state.ticketTypes[idx], type: radio.value };
                const vulForm = item.querySelector('.sm-ticket-type-vulnerable-form');
                vulForm.hidden = radio.value !== 'VULNERABLE';
            });
        });

        // 동반자 정보 입력 이벤트
        const nameInput = item.querySelector(`[name="vul_name_${idx}"]`);
        const birthInput = item.querySelector(`[name="vul_birth_${idx}"]`);
        nameInput?.addEventListener('input', e => {
            state.ticketTypes[idx] = { ...state.ticketTypes[idx], name: e.target.value };
        });
        birthInput?.addEventListener('input', e => {
            state.ticketTypes[idx] = { ...state.ticketTypes[idx], birth: e.target.value };
        });

        DOM.ticketTypeList.appendChild(item);
    });
}

// ──────────────────────────────────────
// 결제 처리
// ──────────────────────────────────────
async function handleBooking() {
    // 비로그인 인터셉트
    const user = await getCurrentUser();
    if (!user) {
        openLoginModal();
        return;
    }

    // 성인 전용 최종 검증
    if (state.festivalData.is_adult_only) {
        const profile = await getUserProfile(user.id);
        if (!profile.identity_verified) {
            openAdultModal('본인인증 필요', '예매 전 본인인증을 완료해야 합니다.');
            return;
        }
        if (!profile.is_adult) {
            openAdultModal('미성년자 예매 불가', '이 행사는 만 19세 이상만 예매할 수 있습니다.');
            return;
        }
    }

    // 발권 유형 VULNERABLE 필수 입력 검증
    for (let i = 0; i < state.selectedSeats.length; i++) {
        const type = state.ticketTypes[i];
        if (type?.type === 'VULNERABLE') {
            if (!type.name?.trim() || !type.birth?.trim()) {
                alert(`${i + 1}번 티켓의 동반자 실명과 생년월일을 입력해주세요.`);
                return;
            }
        }
    }

    // 결제 방식 분기
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'PG_TEST';
    const finalPrice = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);

    if (paymentMethod === 'FESTIO_PAY') {
        const profile = await getUserProfile(user.id);
        if (profile.balance < finalPrice) {
            alert(`FESTIO Pay 잔액이 부족합니다.\n현재 잔액: ${profile.balance.toLocaleString()}원`);
            return;
        }
        await processPayment(user, paymentMethod, finalPrice);
    } else {
        // PG_TEST - PortOne 결제창 호출 (테스트 모드)
        triggerPGPayment(user, finalPrice, paymentMethod);
    }
}

// PG 결제 트리거 (PortOne 테스트)
function triggerPGPayment(user, amount, method) {
    // PortOne SDK IMP.request_pay 호출
    if (typeof IMP === 'undefined') {
        // SDK 미로드 시 바로 처리 (개발 테스트)
        processPayment(user, method, amount);
        return;
    }
    IMP.init('imp00000000');
    IMP.request_pay({
        pg: 'html5_inicis',
        pay_method: 'card',
        merchant_uid: `festio_${Date.now()}`,
        name: `${state.festivalData.name} 티켓 ${state.selectedSeats.length}매`,
        amount: amount,
        buyer_email: user.email,
        buyer_name: state.userProfile?.name || ''
    }, async (rsp) => {
        if (rsp.success) {
            await processPayment(user, method, amount);
        } else {
            alert(`결제 실패: ${rsp.error_msg}`);
        }
    });
}

// ──────────────────────────────────────
// 결제 성공 후 Bulk Insert (order + N개 order_item)
// ──────────────────────────────────────
async function processPayment(user, paymentMethod, finalPrice) {
    try {
        DOM.bookingBtn.disabled = true;
        DOM.bookingBtn.textContent = '처리 중...';

        // 1. order 마스터 INSERT
        const totalPrice = state.selectedSeats.reduce((sum, s) => sum + s.price, 0);
        const discountAmount = totalPrice - finalPrice;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: user.id,
                festival_id: state.festivalId,
                total_price: totalPrice,
                discount_amount: discountAmount,
                payment_status: 'PAID'
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 2. seat_map 가선점 UPDATE (낙관적 락 버전 체크)
        for (const seat of state.selectedSeats) {
            const { error: seatError } = await supabase
                .from('seat_map')
                .update({ status: '결제완료', is_reserved: true, version: seat.version + 1 })
                .eq('id', seat.seat_id)
                .eq('version', seat.version);  // 낙관적 락

            if (seatError) throw new Error(`좌석 선점 실패 (${seat.seat_row} ${seat.seat_number}번). 다시 시도해주세요.`);
        }

        // 3. order_item N개 Bulk Insert (각 좌석별 개별 QR 생성)
        const orderItems = state.selectedSeats.map((seat, idx) => {
            const type = state.ticketTypes[idx];
            return {
                order_id: order.id,
                seat_id: seat.seat_id,
                quantity: 1,
                qr_code_uuid: generateQRCode(),     // 12자리 고유 QR 문자열
                qr_expired_at: getQRExpiredAt(),     // 3분 후 만료
                ticket_type: type?.type || 'GENERAL',
                target_vulnerable_name: type?.name || null,
                target_vulnerable_birth: type?.birth || null,
                owner_user_id: user.id,
                is_gifted: false,
                item_status: type?.type === 'VULNERABLE' ? 'WRISTBAND_PENDING' : 'ORDERED'
            };
        });

        const { error: itemsError } = await supabase
            .from('order_item')
            .insert(orderItems);

        if (itemsError) throw itemsError;

        // 4. FESTIO Pay 결제 시 잔액 차감 + wallet_history 기록
        if (paymentMethod === 'FESTIO_PAY') {
            await supabase
                .from('app_user')
                .update({ balance: supabase.rpc('decrement', { x: finalPrice }) })
                .eq('id', user.id);

            await supabase
                .from('wallet_history')
                .insert({
                    user_id: user.id,
                    transaction_type: 'PAY',
                    amount: -finalPrice,
                    description: `${state.festivalData.name} 티켓 ${state.selectedSeats.length}매 결제완료`
                });
        }

        alert(`예매가 완료되었습니다!\n${state.selectedSeats.length}매의 티켓이 발급되었습니다.`);

        // 마이페이지 QR 뷰어로 이동
        setTimeout(() => {
            window.location.href = `qr-view.html?order_id=${order.id}`;
        }, 1500);

    } catch (err) {
        alert(`결제 처리 중 오류가 발생했습니다: ${err.message}`);
        DOM.bookingBtn.disabled = false;
        DOM.bookingBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/>
            </svg>
            예매하기
        `;
    }
}

// ──────────────────────────────────────
// Supabase Realtime — 좌석 상태 실시간 동기화
// ──────────────────────────────────────
function setupRealtimeSubscription() {
    supabase
        .channel('seat_map_changes')
        .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'seat_map' },
            (payload) => {
                // 현재 렌더링된 좌석 버튼 즉시 업데이트
                const updated = payload.new;
                const btn = DOM.seatGrid.querySelector(`[data-seat-id="${updated.id}"]`);
                if (!btn) return;

                btn.className = 'btn p-0 m-1';
                btn.style.width = '25px';
                btn.style.height = '25px';
                btn.style.fontSize = '8px';
                if (updated.status === '결제완료' || updated.is_reserved) {
                    btn.classList.add('btn-danger');
                    btn.disabled = true;
                } else if (updated.status === '가선점') {
                    btn.classList.add('btn-warning');
                    btn.disabled = true;
                } else {
                    const isSelected = state.selectedSeats.some(s => s.seat_id === updated.id);
                    btn.classList.add(isSelected ? 'btn-primary' : 'btn-success');
                    btn.disabled = false;
                }
            }
        )
        .subscribe();
}

// ──────────────────────────────────────
// Chart.js 통계 차트 초기화
// ──────────────────────────────────────
function renderCharts() {
    const genderChartEl = document.getElementById('genderChart');
    if (!genderChartEl) return;

    // 성별 비율 파이차트 (플레이스홀더 데이터)
    new Chart(genderChartEl, {
        type: 'doughnut',
        data: {
            labels: ['여성', '남성', '미응답'],
            datasets: [{
                data: [58, 36, 6],
                backgroundColor: ['#EC4899', '#3B82F6', '#D1D5DB'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            plugins: { legend: { display: false } },
            cutout: '65%'
        }
    });

    // 연령대별 바차트 (플레이스홀더 데이터)
    new Chart(document.getElementById('ageChart'), {
        type: 'bar',
        data: {
            labels: ['10대', '20대', '30대', '40대', '50대+'],
            datasets: [{
                data: [12, 48, 27, 9, 4],
                backgroundColor: '#3B82F6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { display: false }
            }
        }
    });
}

// ──────────────────────────────────────
// 모달 제어 함수
// ──────────────────────────────────────
function openAdultModal(title, body, showVerifyBtn = true) {
    DOM.adultModalTitle.textContent = title;
    DOM.adultModalBody.textContent = body;
    DOM.adultModalVerifyBtn.hidden = !showVerifyBtn;
    if (adultModalInst) adultModalInst.show();
}

function openLoginModal() {
    if (loginModalInst) loginModalInst.show();
}

function updateHeaderBtn(isLoggedIn) {
    if (isLoggedIn) {
        DOM.headerLoginBtn.querySelector('span').textContent = state.userProfile?.name || '마이페이지';
    }
}

// ──────────────────────────────────────
// 이벤트 리스너 등록
// ──────────────────────────────────────
function setupEventListeners() {
    // 예매 버튼
    DOM.bookingBtn.addEventListener('click', handleBooking);

    // 좌석 패널 뒤로가기 (좌석 뷰 -> 도면 뷰 전환)
    DOM.seatPanelBack.addEventListener('click', () => {
        if (DOM.seatPanel) DOM.seatPanel.hidden = true;
        if (DOM.mapPanel) DOM.mapPanel.hidden = false;
        state.selectedZoneId = null;
    });

    if (DOM.orderPanelClose) {
        DOM.orderPanelClose.addEventListener('click', () => {
            if (DOM.orderPanel) DOM.orderPanel.style.display = 'none';
        });
    }

    DOM.adultModalVerifyBtn.addEventListener('click', () => {
        // PortOne 본인인증 호출 (실제 구현 필요)
        if (adultModalInst) adultModalInst.hide();
        alert('PortOne 본인인증 모듈을 연동하세요.');
    });

    // 성인 배너 인증 버튼
    DOM.adultVerifyBtn.addEventListener('click', () => {
        if (!state.currentUser) {
            openLoginModal();
            return;
        }
        alert('PortOne 본인인증 모듈을 연동하세요.');
    });

    DOM.loginSubmitBtn.addEventListener('click', async () => {
        const email = DOM.loginEmail.value.trim();
        const password = DOM.loginPassword.value;
        DOM.loginError.hidden = true;

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            DOM.loginError.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
            DOM.loginError.hidden = false;
            return;
        }

        if (loginModalInst) loginModalInst.hide();
        state.currentUser = await getCurrentUser();
        state.userProfile = await getUserProfile(state.currentUser.id);
        updateHeaderBtn(true);
        DOM.festioPayBalance.textContent = `잔액: ${state.userProfile.balance.toLocaleString()}원`;
        checkAdultAccess();
    });

    // 헤더 로그인 버튼
    if (DOM.headerLoginBtn) {
        DOM.headerLoginBtn.addEventListener('click', () => {
            if (!state.currentUser) openLoginModal();
        });
    }

    // 결제 수단 변경
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', () => {
            state.paymentMethod = radio.value;
        });
    });
}

// ── 실행
init();
