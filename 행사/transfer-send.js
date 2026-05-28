// ============================================================
// src/features/payment/transfer-send.js
// 역할: 스마트 선물하기 토큰 생성 + 공유 링크 발행 + is_gifted 처리
// 참고: qr-view.js에서 import하여 사용하는 유틸 모듈
// 스키마: order_item (transfer_token, transfer_generated_at, is_gifted)
// ============================================================

import { supabase, generateTransferToken } from '../common/supabase-client.js';

/**
 * 선물하기 토큰 생성 및 공유 링크 반환
 * @param {number} orderItemId - 선물할 order_item.id
 * @returns {{ shareUrl: string } | { error: string }}
 */
export async function initiateTransfer(orderItemId) {
    // 1. 기존 상태 확인
    const { data: item, error: fetchErr } = await supabase
        .from('order_item')
        .select('id, is_gifted, ticket_type, item_status, transfer_token')
        .eq('id', orderItemId)
        .single();

    if (fetchErr || !item) return { error: '티켓 정보를 불러올 수 없습니다.' };

    // VULNERABLE 티켓 → 선물하기 불가
    if (item.ticket_type === 'VULNERABLE') {
        return { error: '노인/아동 동반 티켓은 선물하기가 불가합니다.' };
    }

    // 이미 선물하기 완료
    if (item.is_gifted) {
        return { error: '이미 선물하기가 완료된 티켓입니다.' };
    }

    // REFUNDED / ENTERED → 불가
    if (['REFUNDED', 'ENTERED', 'SUSPENDED'].includes(item.item_status)) {
        return { error: `현재 상태(${item.item_status})에서는 선물하기가 불가합니다.` };
    }

    // 기존 활성 토큰 재사용 (72시간 이내)
    if (item.transfer_token) {
        const shareUrl = buildShareUrl(item.transfer_token);
        return { shareUrl, token: item.transfer_token };
    }

    // 2. 새 토큰 생성
    const token = generateTransferToken();
    const now   = new Date().toISOString();

    const { error: updateErr } = await supabase
        .from('order_item')
        .update({
            transfer_token:        token,
            transfer_generated_at: now,
            is_gifted:             true,
            updated_at:            now
        })
        .eq('id', orderItemId);

    if (updateErr) return { error: '선물하기 처리 중 오류가 발생했습니다.' };

    return { shareUrl: buildShareUrl(token), token };
}

/**
 * 진행 중인 선물하기 취소 (is_gifted → FALSE, 토큰 초기화)
 * 수신자가 아직 수락하지 않은 경우에만 가능
 * @param {number} orderItemId
 */
export async function cancelTransfer(orderItemId) {
    const { data: item } = await supabase
        .from('order_item')
        .select('owner_user_id, is_gifted, transfer_token')
        .eq('id', orderItemId)
        .single();

    if (!item?.is_gifted) return { error: '진행 중인 선물하기가 없습니다.' };

    const { error } = await supabase
        .from('order_item')
        .update({
            is_gifted:             false,
            transfer_token:        null,
            transfer_generated_at: null,
            updated_at:            new Date().toISOString()
        })
        .eq('id', orderItemId);

    if (error) return { error: '취소 처리 중 오류가 발생했습니다.' };
    return { success: true };
}

/**
 * 공유 URL 생성
 */
function buildShareUrl(token) {
    const base = window.location.origin;
    return `${base}/src/features/payment/transfer-receive.html?transfer_token=${token}`;
}

/**
 * 클립보드 + Web Share API 분기 공유
 * @param {string} shareUrl
 * @param {string} festivalName
 */
export async function shareTransferLink(shareUrl, festivalName = 'FESTIO 티켓') {
    const title = `[FESTIO] ${festivalName} 티켓 선물`;
    const text  = `FESTIO 티켓을 선물받으셨습니다. 72시간 내에 수락해주세요.`;

    if (navigator.share) {
        try {
            await navigator.share({ title, text, url: shareUrl });
            return { shared: true };
        } catch (e) {
            if (e.name !== 'AbortError') {
                // Share 실패 시 클립보드 복사로 폴백
            }
        }
    }

    // 클립보드 복사 폴백
    try {
        await navigator.clipboard.writeText(shareUrl);
        return { copied: true };
    } catch {
        return { fallback: shareUrl };
    }
}
