// ============================================================
// src/features/order/onsite-booking.js
// 역할: 현장 스태프 전용 예매 4단계 플로우
//       구매자 확인 → 좌석 선택 → 발권 유형 → 결제
// 스키마: user, festival, festival_zone, seat_map, order, order_item,
//         wallet_history, user_coupon, coupon
// ============================================================

// 간단한 모의 객체 (테스트용)
const supabase = {
    from: (table) => {
        console.log(`[Supabase Mock] Querying table: ${table}`);
        return {
            select: (columns) => ({
                eq: (column, value) => {
                    console.log(`[Supabase Mock] Filter: ${column} = ${value}`);
                    return {
                        or: (condition) => ({
                            limit: (count) => {
                                console.log(`[Supabase Mock] Limit: ${count}`);
                                return Promise.resolve({
                                    data: table === 'user' ? [
                                        { id: 1, name: '테스트 사용자', email: 'test@test.com', balance: 100000, membership_grade: 'GOLD', role: 'ROLE_USER' },
                                        { id: 2, name: '김철수', email: 'kim@test.com', balance: 50000, membership_grade: 'SILVER', role: 'ROLE_USER' }
                                    ] : [],
                                    error: null
                                });
                            },
                            single: () => Promise.resolve({ data: null, error: null })
                        }),
                        limit: (count) => {
                            console.log(`[Supabase Mock] Limit: ${count}`);
                            return Promise.resolve({
                                data: table === 'user' ? [
                                    { id: 1, name: '테스트 사용자', email: 'test@test.com', balance: 100000, membership_grade: 'GOLD', role: 'ROLE_USER' },
                                    { id: 2, name: '김철수', email: 'kim@test.com', balance: 50000, membership_grade: 'SILVER', role: 'ROLE_USER' }
                                ] : [],
                                error: null
                            });
                        },
                        order: (column, options) => ({
                            single: () => Promise.resolve({ data: null, error: null })
                        }),
                        single: () => Promise.resolve({ data: null, error: null })
                    };
                },
                or: (condition) => ({
                    eq: (column, value) => ({
                        limit: (count) => Promise.resolve({
                            data: table === 'user' ? [
                                { id: 1, name: '테스트 사용자', email: 'test@test.com', balance: 100000, membership_grade: 'GOLD', role: 'ROLE_USER' }
                            ] : [],
                            error: null
                        }),
                        single: () => Promise.resolve({ data: null, error: null })
                    }),
                    limit: (count) => Promise.resolve({ data: [], error: null }),
                    single: () => Promise.resolve({ data: null, error: null })
                }),
                limit: (count) => Promise.resolve({ data: [], error: null }),
                order: (column, options) => ({
                    single: () => Promise.resolve({ data: null, error: null })
                }),
                single: () => Promise.resolve({ data: null, error: null })
            })
        };
    }
};

const requireAuth = async () => ({ id: 1, email: 'staff@test.com' });
const getUserProfile = async () => ({ name: '스태프', role: 'ROLE_STAFF' });
const maskName = (name) => name;
const generateQRCode = () => 'QR-' + Math.random().toString(36).substr(2, 9).toUpperCase();
const getQRExpiredAt = () => new Date(Date.now() + 86400000).toISOString();

// ── DOM: 스텝
const obStep1 = document.getElementById('obStep1');
const obStep2 = document.getElementById('obStep2');
const obStep3 = document.getElementById('obStep3');
const obStep4 = document.getElementById('obStep4');

// ── DOM: Step1 (구매자)
const obUserSearch = document.getElementById('obUserSearch');
const obUserSearchBtn = document.getElementById('obUserSearchBtn');
const obUserResults = document.getElementById('obUserResults');
const obSelectedUser = document.getElementById('obSelectedUser');
const obSelectedUserName = document.getElementById('obSelectedUserName');
const obSelectedUserMeta = document.getElementById('obSelectedUserMeta');
const obClearUser = document.getElementById('obClearUser');

// ── DOM: Step2 (행사/좌석)
const obFestivalList = document.getElementById('obFestivalList');
const obSeatPicker = document.getElementById('obSeatPicker');
const obFestivalTag = document.getElementById('obFestivalTag');
const obChangeFestival = document.getElementById('obChangeFestival');
const obZoneFilter = document.getElementById('obZoneFilter');
const obSeatGrid = document.getElementById('obSeatGrid');
const obSeatLoading = document.getElementById('obSeatLoading');

// ── DOM: Step3 (발권 유형)
const obTicketTypes = document.getElementById('obTicketTypes');
const obTypeGeneral = document.getElementById('obTypeGeneral');
const obTypeVulnerable = document.getElementById('obTypeVulnerable');
const obVulnerableForm = document.getElementById('obVulnerableForm');
const obVulnerableName = document.getElementById('obVulnerableName');
const obVulnerableBirth = document.getElementById('obVulnerableBirth');

// ── DOM: Step4 (결제)
const obPaymentPanel = document.getElementById('obPaymentPanel');
const obOrderSummary = document.getElementById('obOrderSummary');
const obPriceTotal = document.getElementById('obPriceTotal');
const obCouponSelect = document.getElementById('obCouponSelect');
const obPayBalance = document.getElementById('obPayBalance');
const obPayBtn = document.getElementById('obPayBtn');
const obStaffName = document.getElementById('obStaffName');

// ── DOM: 모달
const obSuccessModal = document.getElementById('obSuccessModal');
const obSuccessBody = document.getElementById('obSuccessBody');
const obSuccessNewBtn = document.getElementById('obSuccessNewBtn');
const obSuccessScanBtn = document.getElementById('obSuccessScanBtn');
const obBalanceModal = document.getElementById('obBalanceModal');
const obBalanceBackdrop = document.getElementById('obBalanceBackdrop');
const obBalanceBody = document.getElementById('obBalanceBody');
const obSwitchToCash = document.getElementById('obSwitchToCash');
const obBalanceClose = document.getElementById('obBalanceClose');

// ── 상태
let currentStaff = null;
let selectedBuyer = null;     // { id, name, email, balance, membership_grade }
let selectedFestival = null;
let selectedSeat = null;     // { id, seat_row, seat_number, price, zone_id }
let ticketType = 'GENERAL';
let zones = [];
let seats = [];
let selectedZoneId = null;

// ──────────────────────────────────────
// 초기화
// ──────────────────────────────────────
async function init() {
    try {
        currentStaff = await requireAuth();
        if (!currentStaff) return;
        const profile = await getUserProfile(currentStaff.id);

        const allowedRoles = ['ROLE_STAFF', 'ROLE_FOOD_STAFF', 'ROLE_GATE_STAFF', 'ROLE_GOODS_STAFF', 'ROLE_ADMIN'];
        if (!allowedRoles.includes(profile?.role)) {
            alert('스태프 전용 페이지입니다.');
            location.href = '/';
            return;
        }

        if (obStaffName) obStaffName.textContent = maskName(profile.name ?? '');
        bindEvents();
        activateStep(1);
    } catch (error) {
        console.error('초기화 오류:', error);
        alert('페이지 초기화 중 오류가 발생했습니다.');
    }
}

// ──────────────────────────────────────
// 스텝 활성화
// ──────────────────────────────────────
function activateStep(stepNum) {
    [obStep1, obStep2, obStep3, obStep4].forEach((el, i) => {
        if (el) {
            el.classList.toggle('ob-step--active', i + 1 <= stepNum);
            el.classList.toggle('ob-step--locked', i + 1 > stepNum);
        }
    });
}

// ──────────────────────────────────────
// 1단계: 구매자 검색
// ──────────────────────────────────────
async function searchUser() {
    const q = obUserSearch.value.trim();
    if (!q) return;

    obUserResults.hidden = false;
    obUserResults.innerHTML = '<div style="font-size:13px;color:#6B7280;padding:8px">검색 중...</div>';

    const { data, error } = await supabase
        .from('user')
        .select('id, name, email, balance, membership_grade, role')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .eq('role', 'ROLE_USER')
        .limit(5);

    if (error || !data?.length) {
        obUserResults.innerHTML = '<div style="font-size:13px;color:#6B7280;padding:8px">검색 결과가 없습니다.</div>';
        return;
    }

    obUserResults.innerHTML = data.map(u => `
        <div class="ob-user-result-item" data-id="${u.id}"
             data-name="${u.name}" data-email="${u.email}"
             data-balance="${u.balance}" data-grade="${u.membership_grade}">
            <div class="ob-user-result-item__avatar">${u.name?.[0] ?? '?'}</div>
            <div class="ob-user-result-item__info">
                <div class="ob-user-result-item__name">${u.name}</div>
                <div class="ob-user-result-item__email">${u.email}</div>
            </div>
            <span class="ob-user-result-item__grade">${u.membership_grade}</span>
        </div>
    `).join('');

    obUserResults.querySelectorAll('.ob-user-result-item').forEach(el => {
        el.addEventListener('click', () => selectBuyer({
            id: parseInt(el.dataset.id),
            name: el.dataset.name,
            email: el.dataset.email,
            balance: parseInt(el.dataset.balance),
            membership_grade: el.dataset.grade
        }));
    });
}

function selectBuyer(buyer) {
    selectedBuyer = buyer;
    obUserResults.hidden = true;
    obUserSearch.value = '';
    obSelectedUserName.textContent = buyer.name;
    obSelectedUserMeta.textContent = `${buyer.email} | ${buyer.membership_grade} | 잔액 ${buyer.balance.toLocaleString()}원`;
    obSelectedUser.hidden = false;
    activateStep(2);
    loadFestivals();
}

function clearBuyer() {
    selectedBuyer = null;
    obSelectedUser.hidden = true;
    obFestivalList.hidden = true;
    obSeatPicker.hidden = true;
    obTicketTypes.hidden = true;
    obPaymentPanel.hidden = true;
    selectedFestival = null;
    selectedSeat = null;
    activateStep(1);
}

// ──────────────────────────────────────
// 2단계: 행사 선택
// ──────────────────────────────────────
async function loadFestivals() {
    const { data } = await supabase
        .from('festival')
        .select('id, name, start_date, end_date')
        .eq('is_active', true)
        .order('start_date', { ascending: true });

    if (!data?.length) {
        obFestivalList.innerHTML = '<p style="font-size:13px;color:#9CA3AF">진행 중인 행사가 없습니다.</p>';
        obFestivalList.hidden = false;
        return;
    }

    obFestivalList.innerHTML = data.map(f => `
        <div class="ob-festival-item" data-id="${f.id}" data-name="${f.name}"
             data-start="${f.start_date}" data-end="${f.end_date}">
            <div>
                <div class="ob-festival-item__name">${f.name}</div>
                <div class="ob-festival-item__dates">${f.start_date} ~ ${f.end_date}</div>
            </div>
            <div class="ob-festival-item__arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        </div>
    `).join('');

    obFestivalList.querySelectorAll('.ob-festival-item').forEach(el => {
        el.addEventListener('click', () => selectFestival({
            id: parseInt(el.dataset.id),
            name: el.dataset.name,
        }));
    });
    obFestivalList.hidden = false;
}

async function selectFestival(festival) {
    selectedFestival = festival;
    obFestivalList.hidden = true;
    obFestivalTag.textContent = festival.name;
    obSeatPicker.hidden = false;
    activateStep(2);
    await loadZonesAndSeats();
}

async function loadZonesAndSeats() {
    obSeatLoading.style.display = 'flex';
    obSeatGrid.innerHTML = '';
    obSeatGrid.appendChild(obSeatLoading);

    const { data: zoneData } = await supabase
        .from('festival_zone')
        .select('id, zone_name')
        .eq('festival_id', selectedFestival.id);

    zones = zoneData ?? [];
    selectedZoneId = zones[0]?.id ?? null;

    renderZoneFilter();
    await loadSeats();
}

function renderZoneFilter() {
    obZoneFilter.innerHTML = zones.map(z => `
        <button class="ob-zone-chip ${z.id === selectedZoneId ? 'ob-zone-chip--active' : ''}"
            data-id="${z.id}" type="button">${z.zone_name}</button>
    `).join('');

    obZoneFilter.querySelectorAll('.ob-zone-chip').forEach(btn => {
        btn.addEventListener('click', async () => {
            selectedZoneId = parseInt(btn.dataset.id);
            selectedSeat = null;
            renderZoneFilter();
            await loadSeats();
            updateStep3();
        });
    });
}

async function loadSeats() {
    if (!selectedZoneId) return;
    obSeatLoading.style.display = 'flex';

    const { data } = await supabase
        .from('seat_map')
        .select('id, seat_row, seat_number, price, status, is_reserved')
        .eq('zone_id', selectedZoneId)
        .order('seat_row')
        .order('seat_number');

    seats = data ?? [];
    renderSeatGrid();
}

function renderSeatGrid() {
    obSeatLoading.style.display = 'none';

    if (!seats.length) {
        obSeatGrid.innerHTML = '<p style="font-size:13px;color:#9CA3AF;padding:12px">이 구역에 좌석 정보가 없습니다.</p>';
        return;
    }

    obSeatGrid.innerHTML = seats.map(seat => {
        const isTaken = seat.is_reserved || seat.status !== '빈자리';
        const isSelected = selectedSeat?.id === seat.id;
        const cls = isTaken ? 'ob-seat--taken' : isSelected ? 'ob-seat--selected' : 'ob-seat--empty';
        return `<div class="ob-seat ${cls}" data-id="${seat.id}"
            title="${seat.seat_row} ${seat.seat_number}번 (${(seat.price ?? 0).toLocaleString()}원)">
            ${seat.seat_number}
        </div>`;
    }).join('');

    obSeatGrid.querySelectorAll('.ob-seat:not(.ob-seat--taken)').forEach(el => {
        el.addEventListener('click', () => {
            const seat = seats.find(s => s.id === parseInt(el.dataset.id));
            if (!seat) return;
            selectedSeat = seat;
            renderSeatGrid();
            updateStep3();
        });
    });
}

// ──────────────────────────────────────
// 3단계: 발권 유형
// ──────────────────────────────────────
function updateStep3() {
    if (!selectedSeat) return;
    activateStep(3);
    obTicketTypes.hidden = false;
    updateStep4();
}

function setTicketType(type) {
    ticketType = type;
    obTypeGeneral.classList.toggle('ob-ticket-type-btn--active', type === 'GENERAL');
    obTypeVulnerable.classList.toggle('ob-ticket-type-btn--active', type === 'VULNERABLE');
    obVulnerableForm.hidden = type === 'GENERAL';
    updateStep4();
}

// ──────────────────────────────────────
// 4단계: 결제 렌더링
// ──────────────────────────────────────
async function updateStep4() {
    if (!selectedSeat || !selectedBuyer || !selectedFestival) return;

    activateStep(4);
    obPaymentPanel.hidden = false;

    // 잔액 표시
    const { data: freshUser } = await supabase
        .from('user')
        .select('balance')
        .eq('id', selectedBuyer.id)
        .single();
    const balance = freshUser?.balance ?? selectedBuyer.balance;
    obPayBalance.textContent = `잔액: ${balance.toLocaleString()}원`;

    // 보유 쿠폰 로드
    await loadCoupons();

    renderOrderSummary(balance);
    renderPriceTotal();
    obPayBtn.disabled = false;
}

async function loadCoupons() {
    const { data } = await supabase
        .from('user_coupon')
        .select(`id, coupon:coupon_id ( id, title, discount_type, discount_value, min_order_price )`)
        .eq('user_id', selectedBuyer.id)
        .eq('is_used', false);

    obCouponSelect.innerHTML = '<option value="">사용 안 함</option>';
    (data ?? []).forEach(uc => {
        const c = uc.coupon;
        if (!c) return;
        const label = c.discount_type === 'FIXED'
            ? `${c.title} (-${c.discount_value.toLocaleString()}원)`
            : `${c.title} (-${c.discount_value}%)`;
        const opt = document.createElement('option');
        opt.value = uc.id;
        opt.dataset.type = c.discount_type;
        opt.dataset.value = c.discount_value;
        opt.dataset.couponId = c.id;
        opt.textContent = label;
        obCouponSelect.appendChild(opt);
    });
}

function calcDiscount() {
    const sel = obCouponSelect.options[obCouponSelect.selectedIndex];
    if (!sel?.dataset.type) return 0;
    const price = selectedSeat?.price ?? 0;
    if (sel.dataset.type === 'FIXED') return parseInt(sel.dataset.value);
    return Math.floor(price * parseInt(sel.dataset.value) / 100);
}

function renderOrderSummary(balance) {
    const typeStr = ticketType === 'VULNERABLE' ? '노인/아동 팔찌 발권' : '일반 모바일 발권';
    obOrderSummary.innerHTML = `
        <div class="ob-order-summary__row">
            <span>행사</span><strong>${selectedFestival.name}</strong>
        </div>
        <div class="ob-order-summary__row">
            <span>좌석</span><strong>${selectedSeat.seat_row} ${selectedSeat.seat_number}번</strong>
        </div>
        <div class="ob-order-summary__row">
            <span>유형</span><strong>${typeStr}</strong>
        </div>
        <div class="ob-order-summary__row">
            <span>구매자</span><strong>${selectedBuyer.name}</strong>
        </div>`;
}

function renderPriceTotal() {
    const price = selectedSeat?.price ?? 0;
    const discount = calcDiscount();
    const total = Math.max(0, price - discount);

    obPriceTotal.innerHTML = `
        <div class="ob-price-total__row">
            <span>티켓 가격</span><span>${price.toLocaleString()}원</span>
        </div>
        ${discount > 0 ? `<div class="ob-price-total__row">
            <span>쿠폰 할인</span><span>-${discount.toLocaleString()}원</span>
        </div>` : ''}
        <div class="ob-price-total__total">
            <span>최종 결제 금액</span><span>${total.toLocaleString()}원</span>
        </div>`;
}

// ──────────────────────────────────────
// 4단계: 결제 실행
// ──────────────────────────────────────
async function submitPayment() {
    obPayBtn.disabled = true;
    obPayBtn.textContent = '처리 중...';

    try {
        const price = selectedSeat?.price ?? 0;
        const discount = calcDiscount();
        const total = Math.max(0, price - discount);
        const payMethod = document.querySelector('input[name=payMethod]:checked')?.value ?? 'FESTIO_PAY';

        // 페스티오 페이 결제 시 잔액 확인
        if (payMethod === 'FESTIO_PAY') {
            const { data: freshUser } = await supabase
                .from('user')
                .select('balance')
                .eq('id', selectedBuyer.id)
                .single();
            if ((freshUser?.balance ?? 0) < total) {
                obBalanceBody.innerHTML = `현재 잔액: <strong>${(freshUser?.balance ?? 0).toLocaleString()}원</strong><br>
                    필요 금액: <strong>${total.toLocaleString()}원</strong>`;
                obBalanceModal.hidden = false;
                return;
            }
        }

        // 우대/취약 계층 필수 항목 검증
        if (ticketType === 'VULNERABLE') {
            const name = obVulnerableName.value.trim();
            const birth = obVulnerableBirth.value;
            if (!name || !birth) {
                alert('동반자 실명과 생년월일을 입력해주세요.');
                return;
            }
        }

        // 좌석 선점 (낙관적 락 version 확인)
        const { data: seatNow } = await supabase
            .from('seat_map')
            .select('id, status, is_reserved, version')
            .eq('id', selectedSeat.id)
            .single();

        if (!seatNow || seatNow.is_reserved || seatNow.status !== '빈자리') {
            alert('선택한 좌석이 방금 다른 분에게 예매되었습니다. 좌석을 다시 선택해주세요.');
            await loadSeats();
            selectedSeat = null;
            renderSeatGrid();
            return;
        }

        // 좌석 상태 → 결제완료
        await supabase
            .from('seat_map')
            .update({ status: '결제완료', is_reserved: true, version: seatNow.version + 1 })
            .eq('id', selectedSeat.id)
            .eq('version', seatNow.version);

        // 주문 정보 저장
        const { data: newOrder, error: orderErr } = await supabase
            .from('order')
            .insert({
                user_id: selectedBuyer.id,
                festival_id: selectedFestival.id,
                total_price: price,
                discount_amount: discount,
                payment_status: 'PAID'
            })
            .select('id')
            .single();
        if (orderErr) throw orderErr;

        // 주문 상세 및 QR코드 저장
        const qrUUID = generateQRCode();
        const vulName = obVulnerableName.value.trim() || null;
        const vulBirth = obVulnerableBirth.value || null;

        const { error: itemErr } = await supabase
            .from('order_item')
            .insert({
                order_id: newOrder.id,
                seat_id: selectedSeat.id,
                quantity: 1,
                qr_code_uuid: qrUUID,
                qr_expired_at: getQRExpiredAt(),
                item_status: ticketType === 'VULNERABLE' ? 'WRISTBAND_PENDING' : 'ORDERED',
                ticket_type: ticketType,
                target_vulnerable_name: vulName,
                target_vulnerable_birth: vulBirth,
                owner_user_id: selectedBuyer.id,
                is_gifted: false
            });
        if (itemErr) throw itemErr;

        // 페스티오 페이 잔액 차감
        if (payMethod === 'FESTIO_PAY') {
            const { data: freshUser } = await supabase
                .from('user').select('balance').eq('id', selectedBuyer.id).single();
            await supabase
                .from('user')
                .update({ balance: (freshUser?.balance ?? 0) - total })
                .eq('id', selectedBuyer.id);

            await supabase
                .from('wallet_history')
                .insert({
                    user_id: selectedBuyer.id,
                    transaction_type: 'PAY',
                    amount: -total,
                    description: `${selectedFestival.name} 현장 예매`
                });
        }

        // 쿠폰 사용 처리
        const selectedCouponUCId = obCouponSelect.value;
        if (selectedCouponUCId) {
            await supabase
                .from('user_coupon')
                .update({ is_used: true, used_at: new Date().toISOString() })
                .eq('id', selectedCouponUCId);
        }

        // 성공 모달
        obSuccessBody.innerHTML = `
            <strong>${selectedBuyer.name}</strong>님의 현장 예매가 완료되었습니다.<br>
            ${selectedFestival.name}<br>
            <strong>${selectedSeat.seat_row} ${selectedSeat.seat_number}번</strong> | ${qrUUID}<br>
            ${ticketType === 'VULNERABLE' ? '팔찌 발급 대기 중입니다.' : 'QR 티켓이 발급되었습니다.'}`;
        obSuccessModal.hidden = false;

    } catch (e) {
        console.error(e);
        alert('예매 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        obPayBtn.disabled = false;
        obPayBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg> 현장 예매 완료`;
    }
}

// ──────────────────────────────────────
// 초기화 (새 예매)
// ──────────────────────────────────────
function resetAll() {
    selectedBuyer = null;
    selectedFestival = null;
    selectedSeat = null;
    ticketType = 'GENERAL';
    obUserSearch.value = '';
    obSelectedUser.hidden = true;
    obFestivalList.hidden = true;
    obSeatPicker.hidden = true;
    obTicketTypes.hidden = true;
    obPaymentPanel.hidden = true;
    obVulnerableForm.hidden = true;
    obVulnerableName.value = '';
    obVulnerableBirth.value = '';
    obTypeGeneral.classList.add('ob-ticket-type-btn--active');
    obTypeVulnerable.classList.remove('ob-ticket-type-btn--active');
    activateStep(1);
    obSuccessModal.hidden = true;
}

// ──────────────────────────────────────
// 이벤트 바인딩
// ──────────────────────────────────────
function bindEvents() {
    obUserSearchBtn.addEventListener('click', searchUser);
    obUserSearch.addEventListener('keydown', e => { if (e.key === 'Enter') searchUser(); });
    obClearUser.addEventListener('click', clearBuyer);

    obChangeFestival.addEventListener('click', () => {
        obSeatPicker.hidden = true;
        obTicketTypes.hidden = true;
        obPaymentPanel.hidden = true;
        selectedFestival = null; selectedSeat = null;
        obFestivalList.hidden = false;
        activateStep(2);
    });

    obTypeGeneral.addEventListener('click', () => setTicketType('GENERAL'));
    obTypeVulnerable.addEventListener('click', () => setTicketType('VULNERABLE'));

    obVulnerableName.addEventListener('input', renderPriceTotal);
    obCouponSelect.addEventListener('change', () => { renderPriceTotal(); });

    obPayBtn.addEventListener('click', submitPayment);

    // 성공 모달
    obSuccessNewBtn.addEventListener('click', resetAll);
    obSuccessScanBtn.addEventListener('click', () => {
        location.href = '../payment/staff-scan.html';
    });

    // 잔액 부족 모달
    obBalanceBackdrop.addEventListener('click', () => { obBalanceModal.hidden = true; obPayBtn.disabled = false; });
    obBalanceClose.addEventListener('click', () => { obBalanceModal.hidden = true; obPayBtn.disabled = false; });
    obSwitchToCash.addEventListener('click', () => {
        document.querySelector('input[name=payMethod][value=CASH]').checked = true;
        obBalanceModal.hidden = false;
        obPayBtn.disabled = false;
        submitPayment();
    });
}

// ──────────────────────────────────────
// 실행
// ──────────────────────────────────────
init();
