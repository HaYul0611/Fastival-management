// ============================================================
// src/features/payment/refund.js
// 역할: 환불 신청 (온라인 전체취소 / 현장 부분취소)
// 스키마: order, order_item, wallet_history, user
// ============================================================

import { supabase, TABLE, requireAuth, getUserProfile, maskName } from '../common/supabase-client.js';

// ── DOM
const rfLoading       = document.getElementById('rfLoading');
const rfEmpty         = document.getElementById('rfEmpty');
const rfOrderList     = document.getElementById('rfOrderList');
const rfRefundForm    = document.getElementById('rfRefundForm');
const tabOnline       = document.getElementById('tabOnline');
const tabOnsite       = document.getElementById('tabOnsite');
const panelOnline     = document.getElementById('panelOnline');
const panelOnsite     = document.getElementById('panelOnsite');
const rfSelectedOrder = document.getElementById('rfSelectedOrder');
const rfRefundSummary = document.getElementById('rfRefundSummary');
const rfTicketChecklist = document.getElementById('rfTicketChecklist');
const rfPartialSummary  = document.getElementById('rfPartialSummary');
const rfReasonSelect    = document.getElementById('rfReasonSelect');
const rfOnlineSubmitBtn = document.getElementById('rfOnlineSubmitBtn');
const rfOnsiteSubmitBtn = document.getElementById('rfOnsiteSubmitBtn');
// modals
const rfCancelModal    = document.getElementById('rfCancelModal');
const rfCancelBackdrop = document.getElementById('rfCancelBackdrop');
const rfCancelModalBody= document.getElementById('rfCancelModalBody');
const rfCancelConfirmBtn= document.getElementById('rfCancelConfirmBtn');
const rfCancelCloseBtn  = document.getElementById('rfCancelCloseBtn');
const rfPartialModal   = document.getElementById('rfPartialModal');
const rfPartialBackdrop= document.getElementById('rfPartialBackdrop');
const rfPartialModalBody= document.getElementById('rfPartialModalBody');
const rfPartialConfirmBtn= document.getElementById('rfPartialConfirmBtn');
const rfPartialCloseBtn = document.getElementById('rfPartialCloseBtn');

let currentUser = null;
let userProfile = null;
let selectedOrder = null;
let orders = [];

// ──────────────────────────────────────
// 초기화
// ──────────────────────────────────────
async function init() {
    currentUser = await requireAuth();
    if (!currentUser) return;
    userProfile = await getUserProfile(currentUser.id);

    // 스태프/관리자면 현장 탭 노출
    if (userProfile?.role === 'ROLE_STAFF' || userProfile?.role === 'ROLE_ADMIN') {
        tabOnsite.hidden = false;
    }

    bindEvents();
    await loadOrders();
}

// ──────────────────────────────────────
// 이벤트 바인딩
// ──────────────────────────────────────
function bindEvents() {
    document.getElementById('rfBackBtn').addEventListener('click', () => history.back());

    tabOnline.addEventListener('click', () => switchTab('ONLINE'));
    tabOnsite.addEventListener('click', () => switchTab('ONSITE'));

    rfReasonSelect.addEventListener('change', () => {
        rfOnlineSubmitBtn.disabled = !rfReasonSelect.value;
    });

    rfOnlineSubmitBtn.addEventListener('click', openCancelModal);
    rfOnsiteSubmitBtn.addEventListener('click', openPartialModal);

    rfCancelBackdrop.addEventListener('click', closeCancelModal);
    rfCancelCloseBtn.addEventListener('click', closeCancelModal);
    rfCancelConfirmBtn.addEventListener('click', submitOnlineCancel);

    rfPartialBackdrop.addEventListener('click', closePartialModal);
    rfPartialCloseBtn.addEventListener('click', closePartialModal);
    rfPartialConfirmBtn.addEventListener('click', submitPartialCancel);
}

// ──────────────────────────────────────
// 주문 목록 로드
// ──────────────────────────────────────
async function loadOrders() {
    showLoading(true);

    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, total_price, discount_amount, payment_status, created_at,
            festival:festival_id ( id, name, start_date ),
            order_item (
                id, quantity, item_status, qr_code_uuid,
                ticket_type, target_vulnerable_name,
                seat:seat_id ( seat_row, seat_number, price )
            )
        `)
        .eq('user_id', currentUser.id)
        .in('payment_status', ['PAID'])
        .order('created_at', { ascending: false });

    showLoading(false);

    if (error || !data?.length) {
        rfEmpty.hidden = false;
        return;
    }

    // REFUNDED 상태 아이템이 남아있는 주문 제외 (전체 환불된 주문)
    orders = data.filter(o => {
        const active = o.order_item.filter(i => i.item_status !== 'REFUNDED');
        return active.length > 0;
    });

    if (!orders.length) {
        rfEmpty.hidden = false;
        return;
    }

    rfOrderList.hidden = false;
    renderOrderList();
}

function renderOrderList() {
    rfOrderList.innerHTML = orders.map((o, idx) => {
        const activeItems = o.order_item.filter(i => i.item_status !== 'REFUNDED');
        const total = o.total_price - o.discount_amount;
        const dateStr = new Date(o.created_at).toLocaleDateString('ko-KR');

        return `
        <div class="rf-order-card" data-idx="${idx}" role="button" tabindex="0">
            <div class="rf-order-card__top">
                <div class="rf-order-card__festival">${o.festival?.name ?? '행사 정보 없음'}</div>
                <span class="rf-order-card__badge rf-order-card__badge--paid">결제완료</span>
            </div>
            <div class="rf-order-card__meta">
                <span>${o.festival?.start_date ?? ''}</span>
                <span>티켓 ${activeItems.length}매</span>
                <span>${dateStr} 예매</span>
            </div>
            <div class="rf-order-card__price">
                ${total.toLocaleString()}원 <span>결제</span>
            </div>
            <div class="rf-order-card__items">
                ${activeItems.slice(0, 3).map(i => `
                    <div class="rf-order-card__item-row">
                        <span>${itemLabel(i)}</span>
                        <span>${(i.seat?.price ?? 0).toLocaleString()}원</span>
                    </div>
                `).join('')}
                ${activeItems.length > 3 ? `<div class="rf-order-card__item-row"><span>외 ${activeItems.length - 3}건</span></div>` : ''}
            </div>
        </div>`;
    }).join('');

    rfOrderList.querySelectorAll('.rf-order-card').forEach(card => {
        card.addEventListener('click', () => selectOrder(parseInt(card.dataset.idx)));
        card.addEventListener('keydown', e => { if (e.key === 'Enter') selectOrder(parseInt(card.dataset.idx)); });
    });
}

function itemLabel(item) {
    const seat = item.seat;
    const seatStr = seat ? `${seat.seat_row} ${seat.seat_number}번` : '입장권';
    const type = item.ticket_type === 'VULNERABLE'
        ? `[노인/아동: ${maskName(item.target_vulnerable_name ?? '대상자')}]`
        : '[일반]';
    return `${seatStr} ${type}`;
}

// ──────────────────────────────────────
// 주문 선택
// ──────────────────────────────────────
function selectOrder(idx) {
    selectedOrder = orders[idx];

    rfOrderList.querySelectorAll('.rf-order-card').forEach((c, i) => {
        c.classList.toggle('rf-order-card--selected', i === idx);
    });

    renderRefundForm();
    rfRefundForm.hidden = false;
    rfRefundForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ──────────────────────────────────────
// 환불 폼 렌더링
// ──────────────────────────────────────
function renderRefundForm() {
    const o = selectedOrder;
    const activeItems = o.order_item.filter(i => i.item_status !== 'REFUNDED');
    const total = o.total_price - o.discount_amount;
    const discount = o.discount_amount;

    // 선택된 주문 요약
    rfSelectedOrder.innerHTML = `
        <div class="rf-selected-order__name">${o.festival?.name}</div>
        <div class="rf-selected-order__rows">
            <div class="rf-selected-order__row">
                <span>예매 티켓</span><strong>${activeItems.length}매</strong>
            </div>
            <div class="rf-selected-order__row">
                <span>결제금액</span><strong>${total.toLocaleString()}원</strong>
            </div>
            ${discount > 0 ? `<div class="rf-selected-order__row">
                <span>적용 할인</span><strong>-${discount.toLocaleString()}원</strong>
            </div>` : ''}
        </div>`;

    // 온라인 환불 요약
    rfRefundSummary.innerHTML = `
        <div class="rf-refund-summary__rows">
            <div class="rf-refund-summary__row">
                <span>결제금액</span><span>${total.toLocaleString()}원</span>
            </div>
        </div>
        <div class="rf-refund-summary__total">
            <span>FESTIO Pay 환불 예정</span>
            <span>${total.toLocaleString()}원</span>
        </div>`;

    // 현장 티켓 체크리스트
    renderTicketChecklist(activeItems);

    rfReasonSelect.value = '';
    rfOnlineSubmitBtn.disabled = true;
}

function renderTicketChecklist(items) {
    rfTicketChecklist.innerHTML = items.map(item => {
        const label = itemLabel(item);
        const price = item.seat?.price ?? 0;
        const isEntered = item.item_status === 'ENTERED';
        const tagClass = isEntered ? 'entered' : (item.ticket_type === 'VULNERABLE' ? 'vulnerable' : 'general');
        const tagLabel = isEntered ? '입장완료' : (item.ticket_type === 'VULNERABLE' ? '노인/아동' : '일반');

        return `
        <label class="rf-ticket-check-item ${isEntered ? 'rf-ticket-check-item--entered' : ''}" data-item-id="${item.id}">
            <input type="checkbox" data-item-id="${item.id}" data-price="${price}"
                ${isEntered ? 'disabled' : ''}>
            <div class="rf-ticket-check-item__info">
                <div class="rf-ticket-check-item__name">${label}</div>
                <div class="rf-ticket-check-item__meta">
                    <span class="rf-ticket-check-item__tag rf-ticket-check-item__tag--${tagClass}">${tagLabel}</span>
                    ${isEntered ? ' 입장 후 환불 불가' : ''}
                </div>
            </div>
            <div class="rf-ticket-check-item__price">${price.toLocaleString()}원</div>
        </label>`;
    }).join('');

    rfTicketChecklist.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', updatePartialSummary);
    });
    updatePartialSummary();
}

function updatePartialSummary() {
    const checked = [...rfTicketChecklist.querySelectorAll('input:checked')];
    const totalRefund = checked.reduce((s, cb) => s + parseInt(cb.dataset.price), 0);
    const count = checked.length;

    rfPartialSummary.innerHTML = `
        <div class="rf-refund-summary__rows">
            <div class="rf-refund-summary__row">
                <span>선택 티켓</span><span>${count}매</span>
            </div>
        </div>
        <div class="rf-refund-summary__total">
            <span>즉시 환불 예정</span>
            <span>${totalRefund.toLocaleString()}원</span>
        </div>`;

    rfOnsiteSubmitBtn.disabled = count === 0;
}

// ──────────────────────────────────────
// 탭 전환
// ──────────────────────────────────────
function switchTab(type) {
    const isOnline = type === 'ONLINE';
    tabOnline.classList.toggle('rf-type-tab--active', isOnline);
    tabOnsite.classList.toggle('rf-type-tab--active', !isOnline);
    panelOnline.hidden = !isOnline;
    panelOnsite.hidden = isOnline;
}

// ──────────────────────────────────────
// 모달 열기/닫기
// ──────────────────────────────────────
function openCancelModal() {
    const o = selectedOrder;
    const total = o.total_price - o.discount_amount;
    rfCancelModalBody.innerHTML = `
        <strong>${o.festival?.name}</strong> 주문 전체가 취소되며,
        <strong>${total.toLocaleString()}원</strong>이 FESTIO Pay로 즉시 복구됩니다.`;
    rfCancelModal.hidden = false;
}
function closeCancelModal() { rfCancelModal.hidden = true; }

function openPartialModal() {
    const checked = [...rfTicketChecklist.querySelectorAll('input:checked')];
    const count = checked.length;
    const total = checked.reduce((s, cb) => s + parseInt(cb.dataset.price), 0);
    rfPartialModalBody.innerHTML = `
        선택한 <strong>${count}매</strong>의 티켓이 즉시 환불되며,
        <strong>${total.toLocaleString()}원</strong>이 FESTIO Pay로 복구됩니다.`;
    rfPartialModal.hidden = false;
}
function closePartialModal() { rfPartialModal.hidden = true; }

// ──────────────────────────────────────
// 온라인 전체 취소 처리
// ──────────────────────────────────────
async function submitOnlineCancel() {
    rfCancelConfirmBtn.disabled = true;
    rfCancelConfirmBtn.textContent = '처리 중...';

    try {
        const o = selectedOrder;
        const refundAmount = o.total_price - o.discount_amount;

        // 1. order 전체 CANCELLED
        const { error: orderErr } = await supabase
            .from('orders')
            .update({ payment_status: 'CANCELLED' })
            .eq('id', o.id);
        if (orderErr) throw orderErr;

        // 2. 모든 order_item REFUNDED
        const itemIds = o.order_item.map(i => i.id);
        const { error: itemErr } = await supabase
            .from('order_item')
            .update({ item_status: 'REFUNDED' })
            .in('id', itemIds);
        if (itemErr) throw itemErr;

        // 3. wallet_history REFUND 기록
        const { error: walletErr } = await supabase
            .from('wallet_history')
            .insert({
                user_id: currentUser.id,
                transaction_type: 'REFUND',
                amount: refundAmount,
                description: `${o.festival?.name} 전체 취소 환불`
            });
        if (walletErr) throw walletErr;

        // 4. 유저 잔액 복구
        const { data: profile } = await supabase
            .from('app_user')
            .select('balance')
            .eq('id', currentUser.id)
            .single();

        await supabase
            .from('app_user')
            .update({ balance: (profile?.balance ?? 0) + refundAmount })
            .eq('id', currentUser.id);

        closeCancelModal();
        alert(`환불이 완료되었습니다.\nFESTIO Pay에 ${refundAmount.toLocaleString()}원이 복구되었습니다.`);
        await loadOrders();
        rfRefundForm.hidden = true;
        selectedOrder = null;

    } catch (e) {
        console.error(e);
        alert('환불 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        rfCancelConfirmBtn.disabled = false;
        rfCancelConfirmBtn.textContent = '확인 및 환불 처리';
    }
}

// ──────────────────────────────────────
// 현장 부분 취소 처리
// ──────────────────────────────────────
async function submitPartialCancel() {
    rfPartialConfirmBtn.disabled = true;
    rfPartialConfirmBtn.textContent = '처리 중...';

    try {
        const checked = [...rfTicketChecklist.querySelectorAll('input:checked')];
        const itemIds = checked.map(cb => parseInt(cb.dataset.itemId));
        const refundAmount = checked.reduce((s, cb) => s + parseInt(cb.dataset.price), 0);

        // 1. 선택된 order_item REFUNDED
        const { error: itemErr } = await supabase
            .from('order_item')
            .update({ item_status: 'REFUNDED' })
            .in('id', itemIds);
        if (itemErr) throw itemErr;

        // 2. wallet_history REFUND
        await supabase
            .from('wallet_history')
            .insert({
                user_id: currentUser.id,
                transaction_type: 'REFUND',
                amount: refundAmount,
                description: `${selectedOrder.festival?.name} 부분 취소 환불 (${checked.length}매)`
            });

        // 3. 유저 잔액 복구
        const { data: profile } = await supabase
            .from('app_user')
            .select('balance')
            .eq('id', currentUser.id)
            .single();

        await supabase
            .from('app_user')
            .update({ balance: (profile?.balance ?? 0) + refundAmount })
            .eq('id', currentUser.id);

        // 4. 남은 활성 티켓이 없으면 order도 REFUNDED
        const remaining = selectedOrder.order_item.filter(
            i => !itemIds.includes(i.id) && i.item_status !== 'REFUNDED'
        );
        if (remaining.length === 0) {
            await supabase
                .from('orders')
                .update({ payment_status: 'REFUNDED' })
                .eq('id', selectedOrder.id);
        }

        closePartialModal();
        alert(`부분 환불이 완료되었습니다.\n${refundAmount.toLocaleString()}원이 FESTIO Pay로 복구되었습니다.`);
        await loadOrders();
        rfRefundForm.hidden = true;
        selectedOrder = null;

    } catch (e) {
        console.error(e);
        alert('환불 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        rfPartialConfirmBtn.disabled = false;
        rfPartialConfirmBtn.textContent = '즉시 환불 처리';
    }
}

// ──────────────────────────────────────
// 유틸
// ──────────────────────────────────────
function showLoading(show) {
    rfLoading.hidden = !show;
    if (show) { rfEmpty.hidden = true; rfOrderList.hidden = true; rfRefundForm.hidden = true; }
}

// ──────────────────────────────────────
// 실행
// ──────────────────────────────────────
init();
