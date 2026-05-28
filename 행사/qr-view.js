// ============================================================
// src/features/payment/qr-view.js
// 역할: 마이페이지 QR 카드 렌더링
//   - 형태1(일반) / 형태2(노인·아동 동반) 분기
//   - 성인 인증 완료 배지
//   - 3분 QR 타이머 + 자동 갱신
//   - Visual Time Layer (CSS 기반)
//   - FESTIO 스마트 선물하기 (1회 제한)
//   - 전체 취소 (온라인 전체취소만)
//   - Supabase Realtime order_item 동기화
// ============================================================

import {
    supabase,
    requireAuth,
    getCurrentUser,
    getUserProfile,
    generateQRCode,
    getQRExpiredAt,
    isQRExpired,
    maskName,
    isTransferExpired,
    generateTransferToken,
    formatCountdown,
    showModal
} from '../common/supabase-client.js';

// ──────────────────────────────────────
// 상수
// ──────────────────────────────────────
const QR_REFRESH_INTERVAL = 180; // 3분 (초)

// ──────────────────────────────────────
// 상태
// ──────────────────────────────────────
const state = {
    currentUser: null,
    userProfile: null,
    orders: [],            // 주문 그룹 배열
    timerMap: {},          // { orderItemId: { remaining, intervalId } }
    carouselMap: {},       // { orderId: currentIndex }
    pendingCancelOrderId: null,
    pendingGiftItemId: null
};

// ──────────────────────────────────────
// 초기화
// ──────────────────────────────────────
async function init() {
    state.currentUser = await requireAuth(() => {
        window.location.href = '/?login=required';
    });
    if (!state.currentUser) return;

    state.userProfile = await getUserProfile(state.currentUser.id);

    showLoading(true);
    await loadOrders();
    showLoading(false);

    setupRealtimeSubscription();
    setupModalListeners();
}

// ──────────────────────────────────────
// 주문 데이터 로드
// ──────────────────────────────────────
async function loadOrders() {
    // order + order_item + seat_map + festival_zone + festival JOIN
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id,
            payment_status,
            created_at,
            festival:festival_id ( id, name, is_adult_only ),
            order_item (
                id,
                seat_id,
                qr_code_uuid,
                qr_expired_at,
                ticket_type,
                target_vulnerable_name,
                target_vulnerable_birth,
                owner_user_id,
                is_gifted,
                transfer_token,
                transfer_generated_at,
                item_status,
                seat_map:seat_id (
                    seat_row, seat_number,
                    festival_zone:zone_id ( zone_name )
                )
            )
        `)
        .eq('user_id', state.currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        showModal('예매 내역을 불러오지 못했습니다.', 'error');
        return;
    }

    // 소유한 order_item만 필터 (양도로 넘긴 티켓 제외)
    state.orders = (data || []).map(order => ({
        ...order,
        order_item: order.order_item.filter(item => item.owner_user_id === state.currentUser.id)
    })).filter(o => o.order_item.length > 0);

    renderOrderList();
}

// ──────────────────────────────────────
// 주문 목록 렌더링
// ──────────────────────────────────────
function renderOrderList() {
    const container = document.getElementById('qvOrderList');
    const empty = document.getElementById('qvEmpty');
    container.innerHTML = '';

    if (state.orders.length === 0) {
        empty.hidden = false;
        container.hidden = true;
        return;
    }

    empty.hidden = true;
    container.hidden = false;

    state.orders.forEach(order => {
        const section = buildOrderGroup(order);
        container.appendChild(section);
    });
}

// ──────────────────────────────────────
// 주문 그룹 섹션 빌드
// ──────────────────────────────────────
function buildOrderGroup(order) {
    const section = document.createElement('div');
    section.className = 'qv-order-group';
    section.dataset.orderId = order.id;

    const festivalName = order.festival?.name || '행사명 불명';
    const isAllCancellable = order.order_item.every(i =>
        ['ORDERED', 'WRISTBAND_PENDING'].includes(i.item_status)
    );

    // 헤더
    section.innerHTML = `
        <div class="qv-order-group__header">
            <div>
                <h2 class="qv-order-group__event-name">${festivalName}</h2>
                <p class="qv-order-group__meta">주문번호: #${order.id} · ${formatDate(order.created_at)}</p>
            </div>
            <button class="qv-order-group__cancel-btn" data-order-id="${order.id}"
                    type="button" ${!isAllCancellable ? 'disabled' : ''}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                전체 취소
            </button>
        </div>
    `;

    // 취소 버튼 이벤트
    section.querySelector('.qv-order-group__cancel-btn')
        .addEventListener('click', () => openCancelModal(order.id, festivalName));

    // 캐러셀 빌드
    const carousel = buildCarousel(order);
    section.appendChild(carousel);

    return section;
}

// ──────────────────────────────────────
// QR 카드 캐러셀 빌드
// ──────────────────────────────────────
function buildCarousel(order) {
    const wrapper = document.createElement('div');
    wrapper.className = 'qv-carousel';
    wrapper.dataset.orderId = order.id;

    state.carouselMap[order.id] = 0;
    const total = order.order_item.length;

    // 트랙
    const trackWrapper = document.createElement('div');
    trackWrapper.className = 'qv-carousel__track-wrapper';

    const track = document.createElement('div');
    track.className = 'qv-carousel__track';
    track.dataset.orderId = order.id;

    order.order_item.forEach((item, idx) => {
        const card = buildTicketCard(item, idx, total, order.festival);
        track.appendChild(card);
    });

    trackWrapper.appendChild(track);
    wrapper.appendChild(trackWrapper);

    // 네비게이션 버튼 (1매 이상일 때만)
    if (total > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'qv-carousel__nav qv-carousel__nav--prev';
        prevBtn.disabled = true;
        prevBtn.dataset.orderId = order.id;
        prevBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`;
        prevBtn.addEventListener('click', () => carouselNav(order.id, -1));

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'qv-carousel__nav qv-carousel__nav--next';
        nextBtn.dataset.orderId = order.id;
        nextBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
        nextBtn.addEventListener('click', () => carouselNav(order.id, 1));

        wrapper.appendChild(prevBtn);
        wrapper.appendChild(nextBtn);

        // 도트 인디케이터
        const dots = document.createElement('div');
        dots.className = 'qv-carousel__dots';
        dots.dataset.orderId = order.id;
        for (let i = 0; i < total; i++) {
            const dot = document.createElement('div');
            dot.className = `qv-carousel__dot${i === 0 ? ' qv-carousel__dot--active' : ''}`;
            dot.dataset.idx = i;
            dot.addEventListener('click', () => carouselGoto(order.id, i));
            dots.appendChild(dot);
        }
        wrapper.appendChild(dots);
    }

    return wrapper;
}

// ──────────────────────────────────────
// 개별 QR 티켓 카드 빌드 (형태1 / 형태2 분기)
// ──────────────────────────────────────
function buildTicketCard(item, idx, total, festival) {
    const card = document.createElement('div');
    card.className = 'qv-ticket-card';
    card.dataset.itemId = item.id;

    const isVulnerable = item.ticket_type === 'VULNERABLE';
    const isSuspended  = item.item_status === 'SUSPENDED';
    const isEntered    = item.item_status === 'ENTERED';
    const isAdultOnly  = festival?.is_adult_only;
    const seatInfo     = item.seat_map;
    const zoneName     = seatInfo?.festival_zone?.zone_name || '';
    const seatLabel    = seatInfo ? `${seatInfo.seat_row} ${seatInfo.seat_number}번` : '';

    // 배지 빌드
    const badges = [];
    if (isVulnerable && item.target_vulnerable_name) {
        const maskedName = maskName(item.target_vulnerable_name);
        badges.push(`
            <span class="qv-badge qv-badge--vulnerable">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
                노인/아동 인증 대기: ${maskedName}
            </span>
        `);
    }
    if (isAdultOnly && state.userProfile?.is_adult) {
        badges.push(`
            <span class="qv-badge qv-badge--adult">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                성인 인증 완료
            </span>
        `);
    }
    if (isSuspended) {
        badges.push(`
            <span class="qv-badge qv-badge--suspended">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                사용중지 (양도 기간 만료)
            </span>
        `);
    }

    // QR 비활성화 여부 결정
    const qrDisabled = isSuspended || isEntered;

    // 선물하기 버튼 상태 결정
    // 형태2(VULNERABLE) 또는 is_gifted=true 또는 사용중지 → 비활성
    const giftDisabled = isVulnerable || item.is_gifted || isSuspended || isEntered;

    card.innerHTML = `
        <div class="qv-ticket-card__inner">
            <!-- 카드 헤더 -->
            <div class="qv-card-header">
                <div class="qv-card-header__event">${festival?.name || ''}</div>
                <div class="qv-card-header__seat">${zoneName} · ${seatLabel}</div>
            </div>

            <!-- 탭 인디케이터 -->
            <div class="qv-card-nav">
                <span>${idx + 1}번 티켓</span>
                <span>/</span>
                <span class="qv-card-nav__label">${total}매</span>
            </div>

            <!-- 동적 배지 -->
            ${badges.length ? `<div class="qv-badge-row">${badges.join('')}</div>` : ''}

            <!-- QR 이미지 래퍼 -->
            <div class="qv-qr-wrapper ${qrDisabled ? (isSuspended ? 'qv-qr-wrapper--suspended' : '') : ''}"
                 id="qrWrapper_${item.id}">
                <canvas id="qrCanvas_${item.id}"></canvas>
                <div class="qv-qr-wrapper__overlay">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <span>${isSuspended ? '사용중지' : '입장완료'}</span>
                </div>
            </div>

            <!-- 12자리 식별 번호 -->
            <div class="qv-qr-code-str" id="qrStr_${item.id}">
                ${item.qr_code_uuid || '············'}
            </div>

            <!-- 마스킹 이름 -->
            <div class="qv-masked-name">
                ${maskName(state.userProfile?.name || '')}
            </div>

            <!-- 3분 타이머 (비활성 시 숨김) -->
            ${!qrDisabled ? `
            <div class="qv-timer" id="qrTimer_${item.id}">
                <div class="qv-timer__bar-track">
                    <div class="qv-timer__bar-fill" id="timerFill_${item.id}"
                         style="width: 100%"></div>
                </div>
                <div class="qv-timer__label">
                    <span>QR 자동 갱신</span>
                    <span id="timerText_${item.id}">03:00</span>
                </div>
            </div>
            ` : ''}

            <!-- 선물하기 버튼 -->
            <button class="qv-gift-btn" type="button"
                    data-item-id="${item.id}"
                    ${giftDisabled ? 'disabled' : ''}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 12 20 22 4 22 4 12"/>
                    <rect x="2" y="7" width="20" height="5"/>
                    <line x1="12" y1="22" x2="12" y2="7"/>
                    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/>
                    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
                </svg>
                ${item.is_gifted ? '선물 완료 (양도됨)' : isVulnerable ? '스마트 선물하기 (비활성)' : 'FESTIO 스마트 선물하기'}
            </button>
        </div>
    `;

    // 선물하기 버튼 이벤트
    if (!giftDisabled) {
        card.querySelector('.qv-gift-btn')
            .addEventListener('click', () => openGiftModal(item.id));
    }

    // QR 코드 생성 및 타이머 시작
    if (!qrDisabled && item.qr_code_uuid) {
        setTimeout(() => {
            renderQRCode(item.id, item.qr_code_uuid);
            startQRTimer(item.id, item.qr_expired_at);
        }, 0);
    }

    return card;
}

// ──────────────────────────────────────
// QR 코드 Canvas 렌더링
// ──────────────────────────────────────
async function renderQRCode(itemId, qrStr) {
    const canvas = document.getElementById(`qrCanvas_${itemId}`);
    if (!canvas) return;

    // 갱신 애니메이션 트리거
    const wrapper = document.getElementById(`qrWrapper_${itemId}`);
    wrapper?.classList.add('qv-qr-wrapper--refreshing');
    setTimeout(() => wrapper?.classList.remove('qv-qr-wrapper--refreshing'), 500);

    try {
        await QRCode.toCanvas(canvas, qrStr, {
            width: 200,
            margin: 1,
            color: { dark: '#111827', light: '#FFFFFF' }
        });
    } catch (err) {
        console.error('QR 생성 오류:', err);
    }

    // 텍스트 업데이트
    const strEl = document.getElementById(`qrStr_${itemId}`);
    if (strEl) strEl.textContent = qrStr;
}

// ──────────────────────────────────────
// 3분 QR 타이머
// ──────────────────────────────────────
function startQRTimer(itemId, qrExpiredAt) {
    // 기존 타이머 정리
    if (state.timerMap[itemId]?.intervalId) {
        clearInterval(state.timerMap[itemId].intervalId);
    }

    const expiredAt = new Date(qrExpiredAt);
    const totalMs = QR_REFRESH_INTERVAL * 1000;

    function tick() {
        const now = new Date();
        const remaining = Math.max(0, Math.floor((expiredAt - now) / 1000));

        const fillEl = document.getElementById(`timerFill_${itemId}`);
        const textEl = document.getElementById(`timerText_${itemId}`);

        if (!fillEl || !textEl) {
            clearInterval(state.timerMap[itemId]?.intervalId);
            return;
        }

        const pct = (remaining / QR_REFRESH_INTERVAL) * 100;
        fillEl.style.width = `${pct}%`;
        textEl.textContent = formatCountdown(remaining);

        // 색상 변경
        fillEl.className = 'qv-timer__bar-fill';
        if (remaining <= 30) fillEl.classList.add('qv-timer__bar-fill--danger');
        else if (remaining <= 60) fillEl.classList.add('qv-timer__bar-fill--warning');

        if (remaining === 0) {
            clearInterval(state.timerMap[itemId].intervalId);
            refreshQRCode(itemId);
        }
    }

    tick();
    state.timerMap[itemId] = {
        intervalId: setInterval(tick, 1000)
    };
}

// ──────────────────────────────────────
// QR 코드 자동 갱신 (3분 만료 후)
// ──────────────────────────────────────
async function refreshQRCode(itemId) {
    try {
        const newQR = generateQRCode();
        const newExpiredAt = getQRExpiredAt();

        // Supabase 업데이트
        const { error } = await supabase
            .from('order_item')
            .update({ qr_code_uuid: newQR, qr_expired_at: newExpiredAt })
            .eq('id', itemId);

        if (error) throw error;

        // 화면 갱신
        await renderQRCode(itemId, newQR);
        startQRTimer(itemId, newExpiredAt);

    } catch (err) {
        console.error('QR 갱신 오류:', err);
    }
}

// ──────────────────────────────────────
// 캐러셀 네비게이션
// ──────────────────────────────────────
function carouselNav(orderId, direction) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    const total = order.order_item.length;
    const current = state.carouselMap[orderId] || 0;
    const next = Math.max(0, Math.min(total - 1, current + direction));
    carouselGoto(orderId, next);
}

function carouselGoto(orderId, idx) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    const total = order.order_item.length;
    state.carouselMap[orderId] = idx;

    const track = document.querySelector(`.qv-carousel__track[data-order-id="${orderId}"]`);
    if (track) track.style.transform = `translateX(-${idx * 100}%)`;

    // 도트 업데이트
    const dots = document.querySelectorAll(`.qv-carousel__dots[data-order-id="${orderId}"] .qv-carousel__dot`);
    dots.forEach((d, i) => d.classList.toggle('qv-carousel__dot--active', i === idx));

    // 네비 버튼 상태
    const prevBtn = document.querySelector(`.qv-carousel__nav--prev[data-order-id="${orderId}"]`);
    const nextBtn = document.querySelector(`.qv-carousel__nav--next[data-order-id="${orderId}"]`);
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.disabled = idx === total - 1;
}

// ──────────────────────────────────────
// 전체 취소 모달
// ──────────────────────────────────────
function openCancelModal(orderId, eventName) {
    state.pendingCancelOrderId = orderId;
    document.getElementById('cancelOrderInfo').textContent = `${eventName} · 주문번호 #${orderId}`;
    document.getElementById('cancelAllModal').hidden = false;
}

async function confirmCancelAll() {
    const orderId = state.pendingCancelOrderId;
    if (!orderId) return;

    try {
        document.getElementById('cancelAllConfirmBtn').disabled = true;

        // order 전체 CANCELLED
        await supabase
            .from('orders')
            .update({ payment_status: 'CANCELLED' })
            .eq('id', orderId);

        // 모든 order_item REFUNDED
        await supabase
            .from('order_item')
            .update({ item_status: 'REFUNDED' })
            .eq('order_id', orderId);

        // 결제 방식이 FESTIO_PAY였으면 잔액 복구
        const order = state.orders.find(o => o.id === orderId);
        const totalRefund = order?.order_item.reduce((sum, i) => {
            // seat_map.price 합산 (실제 구현 시 order.total_price 사용 권장)
            return sum;
        }, 0) || 0;

        // wallet_history REFUND 기록 (FESTIO_PAY 건 처리는 서버사이드 Function 권장)

        document.getElementById('cancelAllModal').hidden = true;
        showModal('전체 취소가 완료되었습니다.', 'info');
        await loadOrders();

    } catch (err) {
        showModal(`취소 처리 중 오류: ${err.message}`, 'error');
    } finally {
        document.getElementById('cancelAllConfirmBtn').disabled = false;
        state.pendingCancelOrderId = null;
    }
}

// ──────────────────────────────────────
// 선물하기 모달
// ──────────────────────────────────────
async function openGiftModal(itemId) {
    state.pendingGiftItemId = itemId;

    try {
        const token = generateTransferToken();
        const now = new Date().toISOString();

        // Supabase transfer_token 저장
        const { error } = await supabase
            .from('order_item')
            .update({
                transfer_token: token,
                transfer_generated_at: now,
                is_gifted: true
            })
            .eq('id', itemId);

        if (error) throw error;

        const giftLink = `${window.location.origin}/transfer-receive.html?transfer_token=${token}`;
        document.getElementById('giftLinkInput').value = giftLink;

        // 버튼 즉시 비활성화 (1회 제한)
        const giftBtn = document.querySelector(`[data-item-id="${itemId}"].qv-gift-btn`);
        if (giftBtn) {
            giftBtn.disabled = true;
            giftBtn.textContent = '선물 완료 (양도됨)';
        }

        document.getElementById('giftModal').hidden = false;

    } catch (err) {
        showModal(`선물하기 처리 오류: ${err.message}`, 'error');
    }
}

// ──────────────────────────────────────
// Supabase Realtime — order_item 상태 실시간 감지
// ──────────────────────────────────────
function setupRealtimeSubscription() {
    supabase
        .channel('order_item_changes')
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'order_item',
                filter: `owner_user_id=eq.${state.currentUser.id}`
            },
            (payload) => {
                const updated = payload.new;
                // 사용중지 전환 시 QR 즉시 블러 처리
                if (updated.item_status === 'SUSPENDED') {
                    const wrapper = document.getElementById(`qrWrapper_${updated.id}`);
                    wrapper?.classList.add('qv-qr-wrapper--suspended');
                    clearInterval(state.timerMap[updated.id]?.intervalId);
                }
            }
        )
        .subscribe();
}

// ──────────────────────────────────────
// 유틸
// ──────────────────────────────────────
function showLoading(show) {
    document.getElementById('qvLoading').style.display = show ? 'flex' : 'none';
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ──────────────────────────────────────
// 모달 이벤트 리스너
// ──────────────────────────────────────
function setupModalListeners() {
    // 전체 취소 모달
    document.getElementById('cancelAllConfirmBtn')
        .addEventListener('click', confirmCancelAll);
    document.getElementById('cancelAllCloseBtn')
        .addEventListener('click', () => { document.getElementById('cancelAllModal').hidden = true; });
    document.getElementById('cancelAllBackdrop')
        .addEventListener('click', () => { document.getElementById('cancelAllModal').hidden = true; });

    // 선물하기 모달
    document.getElementById('giftModalClose')
        .addEventListener('click', () => { document.getElementById('giftModal').hidden = true; });
    document.getElementById('giftModalBackdrop')
        .addEventListener('click', () => { document.getElementById('giftModal').hidden = true; });

    // 링크 복사
    document.getElementById('giftLinkCopy')
        .addEventListener('click', () => {
            const input = document.getElementById('giftLinkInput');
            navigator.clipboard.writeText(input.value)
                .then(() => showModal('링크가 복사되었습니다.', 'info'))
                .catch(() => { input.select(); document.execCommand('copy'); });
        });
}

// ── 실행
init();
