// ============================================================
// src/features/payment/staff-scan.js
// 역할: HTML5 Camera API QR 스캔 + scan_log INSERT
//       스캔 결과 7종 분기 + 팔찌 발급 + 관리자 잠금 해제
// 스키마: order_item, scan_log, user
// ============================================================

// 간단한 모의 객체 (테스트용)
const supabase = {
    from: (table) => ({
        select: (columns) => ({
            eq: (column, value) => ({
                or: (condition) => ({
                    limit: (count) => Promise.resolve({
                        data: table === 'scan_log' ? [
                            { id: 1, scan_type: 'ENTRANCE', scanned_at: new Date().toISOString(), ticket_id: 'T001' },
                            { id: 2, scan_type: 'PICKUP', scanned_at: new Date().toISOString(), ticket_id: 'T002' }
                        ] : [],
                        error: null
                    }),
                    order: (column, options) => ({
                        limit: (count) => Promise.resolve({
                            data: table === 'scan_log' ? [
                                { id: 1, scan_type: 'ENTRANCE', scanned_at: new Date().toISOString(), ticket_id: 'T001' },
                                { id: 2, scan_type: 'PICKUP', scanned_at: new Date().toISOString(), ticket_id: 'T002' }
                            ] : [],
                            error: null
                        })
                    }),
                    single: () => Promise.resolve({ data: null, error: null })
                }),
                limit: (count) => Promise.resolve({
                    data: table === 'scan_log' ? [
                        { id: 1, scan_type: 'ENTRANCE', scanned_at: new Date().toISOString(), ticket_id: 'T001' },
                        { id: 2, scan_type: 'PICKUP', scanned_at: new Date().toISOString(), ticket_id: 'T002' }
                    ] : [],
                    error: null
                }),
                order: (column, options) => ({
                    limit: (count) => Promise.resolve({
                        data: table === 'scan_log' ? [
                            { id: 1, scan_type: 'ENTRANCE', scanned_at: new Date().toISOString(), ticket_id: 'T001' },
                            { id: 2, scan_type: 'PICKUP', scanned_at: new Date().toISOString(), ticket_id: 'T002' }
                        ] : [],
                        error: null
                    }),
                    single: () => Promise.resolve({ data: null, error: null })
                }),
                single: () => Promise.resolve({ data: null, error: null })
            }),
            or: (condition) => ({
                eq: (column, value) => ({
                    limit: (count) => Promise.resolve({ data: [], error: null }),
                    single: () => Promise.resolve({ data: null, error: null })
                }),
                limit: (count) => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null })
            }),
            limit: (count) => Promise.resolve({ data: [], error: null }),
            order: (column, options) => ({
                limit: (count) => Promise.resolve({ data: [], error: null }),
                single: () => Promise.resolve({ data: null, error: null })
            }),
            single: () => Promise.resolve({ data: null, error: null })
        })
    }),
    channel: (name) => ({
        on: (event, callback) => ({
            subscribe: () => ({ unsubscribe: () => { } })
        })
    })
};

const requireAuth = async () => ({ id: 1, email: 'staff@test.com' });
const getUserProfile = async () => ({ name: '스태프', role: 'ROLE_STAFF' });
const maskName = (name) => name;
const isQRExpired = () => false;

// ── DOM
const ssVideo = document.getElementById('ssVideo');
const ssScanCanvas = document.getElementById('ssScanCanvas');
const ssCameraError = document.getElementById('ssCameraError');
const ssRetryBtn = document.getElementById('ssRetryBtn');
const ssManualBtn = document.getElementById('ssManualBtn');
const ssManualPanel = document.getElementById('ssManualPanel');
const ssManualInput = document.getElementById('ssManualInput');
const ssManualSubmit = document.getElementById('ssManualSubmit');
const ssResultCard = document.getElementById('ssResultCard');
const ssAdminPanel = document.getElementById('ssAdminPanel');
const ssUnlockInput = document.getElementById('ssUnlockInput');
const ssUnlockBtn = document.getElementById('ssUnlockBtn');
const ssUnlockResult = document.getElementById('ssUnlockResult');
const ssLogList = document.getElementById('ssLogList');
const ssLogCount = document.getElementById('ssLogCount');
const ssRoleBadge = document.getElementById('ssRoleBadge');
const ssRoleLabel = document.getElementById('ssRoleLabel');
const ssUserName = document.getElementById('ssUserName');
const btnEntrance = document.getElementById('btnEntrance');
const btnPickup = document.getElementById('btnPickup');
const ssWristbandModal = document.getElementById('ssWristbandModal');
const ssWristbandBody = document.getElementById('ssWristbandBody');
const ssWristbandIssueBtn = document.getElementById('ssWristbandIssueBtn');
const ssWristbandCloseBtn = document.getElementById('ssWristbandCloseBtn');
const ssExceptionModal = document.getElementById('ssExceptionModal');
const ssExceptionBody = document.getElementById('ssExceptionBody');
const ssExceptionApproveBtn = document.getElementById('ssExceptionApproveBtn');
const ssExceptionCancelBtn = document.getElementById('ssExceptionCancelBtn');

// ── 상태
let currentUser = null;
let userProfile = null;
let scanCooldown = false;  // 중복 스캔 방지 (1초)
let logRows = [];
let pendingExceptionItem = null; // 예외 처리 대상 item

// ──────────────────────────────────────
// 스캔 결과 상수 (schema.sql result 컬럼)
// ──────────────────────────────────────
const RESULT = {
    SUCCESS: '성공',
    SUCCESS_EXCEPTION: '성공-스태프예외승인',
    FAIL_DUPLICATE: '실패-중복입장',
    FAIL_EXPIRED: '실패-시간만료',
    FAIL_TOKEN_EXPIRED: '실패-토큰만료',
    FAIL_INVALID: '실패-유효하지않은QR',
    FAIL_REFUNDED: '실패-환불된티켓',
};

// ──────────────────────────────────────
// 초기화
// ──────────────────────────────────────
async function init() {
    currentUser = await requireAuth();
    if (!currentUser) return;
    userProfile = await getUserProfile(currentUser.id);

    // 스태프/관리자만 접근
    const allowedRoles = ['ROLE_STAFF', 'ROLE_FOOD_STAFF', 'ROLE_GATE_STAFF', 'ROLE_GOODS_STAFF', 'ROLE_ADMIN'];
    if (!allowedRoles.includes(userProfile?.role)) {
        alert('스태프 전용 페이지입니다.');
        location.href = '/';
        return;
    }

    // 헤더 업데이트
    const isAdmin = userProfile.role === 'ROLE_ADMIN';
    let roleName = 'STAFF';
    if (userProfile.role === 'ROLE_FOOD_STAFF') roleName = 'FOOD STAFF';
    else if (userProfile.role === 'ROLE_GATE_STAFF') roleName = 'GATE STAFF';
    else if (userProfile.role === 'ROLE_GOODS_STAFF') roleName = 'GOODS STAFF';
    if (ssRoleLabel) ssRoleLabel.textContent = isAdmin ? 'ADMIN' : roleName;
    if (ssRoleBadge && isAdmin) ssRoleBadge.classList.add('ss-header__badge--admin');
    if (ssUserName) ssUserName.textContent = maskName(userProfile.name ?? '');

    // 관리자 패널 노출
    if (ssAdminPanel && isAdmin) ssAdminPanel.hidden = false;

    bindEvents();
    await startCamera();
    loadRecentLogs();
    subscribeRealtime();

    // 오프라인 복구 시 동기화 리스너 등록
    window.addEventListener('online', syncPendingOfflineLogs);
}

// ──────────────────────────────────────
// 카메라
// ──────────────────────────────────────
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 } }
        });
        if (ssVideo) {
            ssVideo.srcObject = stream;
            ssVideo.onplaying = () => {
                const ph = document.getElementById('ssCameraPlaceholder');
                if (ph) ph.style.display = 'none';
            };
        }
        if (ssCameraError) ssCameraError.hidden = true;
        requestAnimationFrame(scanFrame);
    } catch (err) {
        if (ssCameraError) {
            ssCameraError.hidden = false;
            ssCameraError.innerText = "카메라를 시작할 수 없습니다. (권한 차단 또는 카메라 없음)";
        }
        if (ssRetryBtn) ssRetryBtn.style.display = 'inline-block';
        const ph = document.getElementById('ssCameraPlaceholder');
        if (ph) {
            ph.style.display = 'flex';
            const span = ph.querySelector('span');
            if (span) span.innerText = '카메라 오류 (연결 불가)';
        }
    }
}

// jsQR 라이브러리 동적 로드 (CDN)
let jsQR = null;
async function loadJsQR() {
    if (jsQR) return jsQR;
    return new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
        s.onload = () => { jsQR = window.jsQR; resolve(jsQR); };
        document.head.appendChild(s);
    });
}

async function scanFrame() {
    if (!jsQR) await loadJsQR();

    if (ssVideo.readyState === ssVideo.HAVE_ENOUGH_DATA) {
        const ctx = ssScanCanvas.getContext('2d');
        ssScanCanvas.width = ssVideo.videoWidth;
        ssScanCanvas.height = ssVideo.videoHeight;
        ctx.drawImage(ssVideo, 0, 0);

        const imageData = ctx.getImageData(0, 0, ssScanCanvas.width, ssScanCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data && !scanCooldown) {
            await processQR(code.data.trim());
        }
    }
    requestAnimationFrame(scanFrame);
}

// ──────────────────────────────────────
// TOTP 생성 로직 (검증용)
// ──────────────────────────────────────
async function generateTotpCode(hexSecret, epochOffset = 0) {
    if (!hexSecret) hexSecret = 'dummysecret12345';
    let keyBytes;
    try {
        keyBytes = new Uint8Array(hexSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    } catch (e) {
        keyBytes = new TextEncoder().encode(hexSecret);
    }
    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const counterBytes = new Uint8Array(8);
    let temp = Math.floor(Date.now() / 180000) + epochOffset;
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
}

// ──────────────────────────────────────
// QR 처리 핵심 로직
// ──────────────────────────────────────
async function processQR(qrCode) {
    if (scanCooldown) return;
    scanCooldown = true;
    setTimeout(() => { scanCooldown = false; }, 1500);

    // 모의 테스트 분기 (빠른 성공/실패 목업)
    if (qrCode === 'T00000001001') {
        await renderResult({ ticket_type: 'NORMAL', seat: { seat_row: 'A구역', seat_number: '12' } }, RESULT.SUCCESS, qrCode);
        return;
    }
    if (qrCode === 'G00000001005') {
        await renderResult({ ticket_type: 'NORMAL', seat: { seat_row: 'A구역', seat_number: '12' } }, RESULT.FAIL_DUPLICATE, qrCode);
        return;
    }
    if (qrCode === 'F0000000000X') {
        await renderResult(null, RESULT.FAIL_INVALID, qrCode);
        return;
    }

    // 12자리 유효성 체크
    if (!/^[A-Z0-9]{12}$/i.test(qrCode)) {
        await renderResult(null, RESULT.FAIL_INVALID, qrCode);
        return;
    }

    const MASK_DYNAMIC = 90000000000000000n;
    let orderIdNum = null;
    let decodedTotp = null;
    let prefix = qrCode.charAt(0).toUpperCase();

    try {
        const base36 = qrCode.trim().toUpperCase().substring(1);
        let obf = 0n;
        for (let i = 0; i < base36.length; i++) {
            const code = base36.charCodeAt(i);
            let val = 0n;
            if (code >= 48 && code <= 57) val = BigInt(code - 48);
            else if (code >= 65 && code <= 90) val = BigInt(code - 65 + 10);
            else if (code >= 97 && code <= 122) val = BigInt(code - 97 + 10);
            obf = obf * 36n + val;
        }
        const combined = obf ^ MASK_DYNAMIC;
        orderIdNum = Number(combined / 1000000n);
        decodedTotp = Number(combined % 1000000n);
    } catch (e) {
        await renderResult(null, RESULT.FAIL_INVALID, qrCode);
        await insertScanLog(null, RESULT.FAIL_INVALID);
        return;
    }

    let item = null;
    let error = null;

    const isOffline = !navigator.onLine;

    if (prefix === 'T') {
        // 티켓 조회
        if (!isOffline) {
            try {
                const res = await supabase
                    .from('order_item')
                    .select(`
                        id, item_status, qr_code_uuid, qr_expired_at, totp_secret,
                        ticket_type, target_vulnerable_name, target_vulnerable_birth,
                        owner_user_id,
                        order:order_id ( festival_id, payment_status ),
                        seat:seat_id ( seat_row, seat_number )
                    `)
                    .or(`qr_code_uuid.eq.${qrCode.toUpperCase()},id.eq.${orderIdNum}`)
                    .maybeSingle();
                item = res.data;
                error = res.error;
            } catch (e) {
                error = e;
            }
        }
    } else if (prefix === 'F' || prefix === 'G') {
        // FESTIO SHOP 조회
        if (!isOffline) {
            try {
                const res = await supabase
                    .from('shop_orders')
                    .select(`
                        id, order_number, status, payment_method, delivery_type,
                        created_at, total_amount, totp_secret
                    `)
                    .like('order_number', prefix + '%' + orderIdNum + '%')
                    .maybeSingle();

                if (res.data) {
                    item = res.data;
                    item.item_status = item.status;
                    item.ticket_type = 'SHOP';
                    item.order = { payment_status: 'COMPLETED' };
                }
                error = res.error;
            } catch (e) {
                error = e;
            }
        }
    } else {
        await renderResult(null, RESULT.FAIL_INVALID, qrCode);
        await insertScanLog(null, RESULT.FAIL_INVALID);
        return;
    }

    // 통신 장애(오프라인)로 인한 임시 승인 로직 (하이브리드 인증)
    if (isOffline || (error && error.message && error.message.includes('fetch'))) {
        const offlineItem = {
            id: orderIdNum,
            item_status: 'COMPLETED',
            ticket_type: prefix === 'T' ? 'TICKET_OFFLINE' : 'SHOP_OFFLINE',
            name: '통신장애 임시승인'
        };
        await renderResult(offlineItem, RESULT.SUCCESS, qrCode);
        await insertScanLog(orderIdNum, RESULT.SUCCESS);
        if (window.Toast) window.Toast.error('오프라인 상태입니다. 기기 자체 검증으로 임시 승인했습니다.');
        return;
    }

    if (error || !item) {
        // Mock 데이터 우회 로직 (F, G 한정)
        if (!item && (prefix === 'F' || prefix === 'G')) {
            const mockKey = `mock_scanned_${prefix}_${orderIdNum}`;
            if (localStorage.getItem(mockKey)) {
                await renderResult(null, RESULT.FAIL_DUPLICATE, qrCode);
                await insertScanLog(null, RESULT.FAIL_DUPLICATE);
                return;
            } else {
                localStorage.setItem(mockKey, 'true');
                const mockItem = {
                    id: orderIdNum,
                    item_status: 'COMPLETED',
                    ticket_type: 'SHOP_MOCK',
                    name: '임시 상품 (Mock)'
                };
                await renderResult(mockItem, RESULT.SUCCESS, qrCode);
                await insertScanLog(orderIdNum, RESULT.SUCCESS);
                return;
            }
        }

        await renderResult(null, RESULT.FAIL_INVALID, qrCode);
        await insertScanLog(null, RESULT.FAIL_INVALID);
        return;
    }

    if (error || !item) {
        await renderResult(null, RESULT.FAIL_INVALID, qrCode);
        await insertScanLog(null, RESULT.FAIL_INVALID);
        return;
    }

    // TOTP 유효성 검증 (정적 QR 매칭 제외)
    const isStaticMatch = item.qr_code_uuid && item.qr_code_uuid === qrCode.toUpperCase();
    if (!isStaticMatch) {
        const secret = item.totp_secret || 'dummysecret12345';
        const currentTotp = await generateTotpCode(secret, 0);
        const prevTotp = await generateTotpCode(secret, -1);
        const nextTotp = await generateTotpCode(secret, 1);
        const decodedTotpStr = String(decodedTotp).padStart(6, '0');

        if (decodedTotpStr !== currentTotp && decodedTotpStr !== prevTotp && decodedTotpStr !== nextTotp) {
            await renderResult(item, RESULT.FAIL_TOKEN_EXPIRED, qrCode);
            await insertScanLog(item.id, RESULT.FAIL_TOKEN_EXPIRED);
            return;
        }
    }

    // 환불된 티켓
    if (item.item_status === 'REFUNDED' || item.order?.payment_status === 'CANCELLED') {
        await renderResult(item, RESULT.FAIL_REFUNDED, qrCode);
        await insertScanLog(item.id, RESULT.FAIL_REFUNDED);
        return;
    }

    // QR 만료 확인 (정적 QR에 해당)
    if (item.qr_expired_at && isQRExpired(item.qr_expired_at)) {
        await renderResult(item, RESULT.FAIL_TOKEN_EXPIRED, qrCode);
        await insertScanLog(item.id, RESULT.FAIL_TOKEN_EXPIRED);
        return;
    }

    // 통합 자동 스캔 로직 (바코드 타입에 따라 자동 분류)
    if (prefix === 'T') {
        // 티켓 스캔 (입장 처리)
        if (item.item_status === 'ENTERED' || item.item_status === 'PICKED_UP') {
            await renderResult(item, RESULT.FAIL_DUPLICATE, qrCode);
            await insertScanLog(item.id, RESULT.FAIL_DUPLICATE);
            return;
        }

        if (item.item_status === 'SUSPENDED') {
            showExceptionModal(item, qrCode);
            return;
        }

        await supabase
            .from('order_item')
            .update({ item_status: 'ENTERED', updated_at: new Date().toISOString() })
            .eq('id', item.id);

        await renderResult(item, RESULT.SUCCESS, qrCode);
        await insertScanLog(item.id, RESULT.SUCCESS);

        if (item.ticket_type === 'VULNERABLE') {
            showWristbandModal(item);
        }
        return;
    } else if (prefix === 'F' || prefix === 'G') {
        // 굿즈 / F&B 스캔 (수령 처리)
        if (item.status === 'COMPLETED' || item.item_status === 'COMPLETED') {
            await renderResult(item, RESULT.FAIL_DUPLICATE, qrCode);
            await insertScanLog(item.id, RESULT.FAIL_DUPLICATE);
            return;
        }

        await supabase
            .from('shop_orders')
            .update({ status: 'COMPLETED' })
            .eq('id', item.id);

        await renderResult(item, RESULT.SUCCESS, qrCode);
        await insertScanLog(item.id, RESULT.SUCCESS);
    }
}

// ──────────────────────────────────────
// 오프라인 로그 암호화/복호화 (조작 방어)
// ──────────────────────────────────────
async function getCryptoKey(token) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(token), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
    return await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("festio_offline_salt"), iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

async function encryptOfflineLogs(logs, token) {
    const key = await getCryptoKey(token);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(logs)));
    return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}

async function decryptOfflineLogs(encryptedStr, token) {
    try {
        const { iv, data } = JSON.parse(encryptedStr);
        const key = await getCryptoKey(token);
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, new Uint8Array(data));
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
        console.error("오프라인 로그 복호화 실패(조작 의심)", e);
        return [];
    }
}

// ──────────────────────────────────────
// scan_log INSERT
// ──────────────────────────────────────
async function insertScanLog(orderItemId, result) {
    const logData = {
        order_item_id: orderItemId,
        staff_user_id: currentUser.id,
        scan_type: 'AUTO_DETECT',
        result: result,
        scanned_at: new Date().toISOString()
    };

    const token = localStorage.getItem('userToken') || 'default_token';

    if (!navigator.onLine) {
        const raw = localStorage.getItem('pending_scan_logs_v2');
        const pending = raw ? await decryptOfflineLogs(raw, token) : [];
        pending.push(logData);
        localStorage.setItem('pending_scan_logs_v2', await encryptOfflineLogs(pending, token));
        return;
    }

    try {
        await supabase.from('scan_log').insert(logData);
    } catch (e) {
        const raw = localStorage.getItem('pending_scan_logs_v2');
        const pending = raw ? await decryptOfflineLogs(raw, token) : [];
        pending.push(logData);
        localStorage.setItem('pending_scan_logs_v2', await encryptOfflineLogs(pending, token));
    }
}

// ──────────────────────────────────────
// 밀린 오프라인 로그 동기화
// ──────────────────────────────────────
async function syncPendingOfflineLogs() {
    const raw = localStorage.getItem('pending_scan_logs_v2');
    if (!raw) return;

    const token = localStorage.getItem('userToken') || 'default_token';
    const pending = await decryptOfflineLogs(raw, token);
    if (pending.length === 0) {
        localStorage.removeItem('pending_scan_logs_v2'); // 조작된 로그 삭제
        return;
    }

    if (window.Toast) window.Toast.info(`동기화: ${pending.length}건의 스캔 로그 동기화 중...`);

    const failedLogs = [];
    for (const log of pending) {
        const { error } = await supabase.from('scan_log').insert(log);
        if (error) failedLogs.push(log);
    }

    if (failedLogs.length > 0) {
        localStorage.setItem('pending_scan_logs_v2', await encryptOfflineLogs(failedLogs, token));
        if (window.Toast) window.Toast.error(`동기화 일부 실패 (${failedLogs.length}건 남음)`);
    } else {
        localStorage.removeItem('pending_scan_logs_v2');
        if (window.Toast) window.Toast.info('모든 오프라인 로그가 동기화되었습니다.');
    }
}

// ──────────────────────────────────────
// 결과 카드 렌더링
// ──────────────────────────────────────
async function renderResult(item, result, code) {
    const isSuccess = result === RESULT.SUCCESS;
    const isException = result === RESULT.SUCCESS_EXCEPTION;
    const isFail = !isSuccess && !isException;

    const resultLabel = getResultLabel(result);

    let bodyHtml = '';
    if (item) {
        const seatStr = item.seat ? `${item.seat.seat_row} ${item.seat.seat_number}번` : '입장권';
        const typeStr = item.ticket_type === 'VULNERABLE'
            ? `노인/아동 [${maskName(item.target_vulnerable_name ?? '')}]`
            : '일반';

        bodyHtml = `
            <div class="ss-result-card__rows">
                <div class="ss-result-card__row"><span>좌석</span><strong>${seatStr}</strong></div>
                <div class="ss-result-card__row"><span>티켓</span><strong>${typeStr}</strong></div>
                <div class="ss-result-card__row"><span>결과</span><strong>${isSuccess ? '처리 완료' : '처리 불가'}</strong></div>
            </div>`;
    }

    let actionBtn = '';
    const isStaffRole = ['ROLE_STAFF', 'ROLE_FOOD_STAFF', 'ROLE_GATE_STAFF', 'ROLE_GOODS_STAFF'].includes(userProfile?.role);
    if (isFail && result !== RESULT.FAIL_INVALID && result !== RESULT.FAIL_REFUNDED
        && isStaffRole) {
        actionBtn = `
            <button class="ss-result-card__exception-btn" id="ssExceptionBtnInCard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                스태프 예외 승인
            </button>`;
    }

    ssResultCard.className = `ss-result-card ${cardClass}`;
    ssResultCard.hidden = true; // 인라인 결과 카드 오버레이 사용 안함 (중앙 토스트 팝업만 사용)

    // 화면 정중앙 토스트 표시 (Windows Toast 형태)
    showToastOverlay(result, code, item);

    // 로그에 추가
    prependLog({ code, item, result, time: new Date() });
}

function showToastOverlay(result, code, item) {
    const overlay = document.getElementById("scan-validation-screen");
    if (!overlay) return;
    const title = document.getElementById("scan-result-title");
    const msg = document.getElementById("scan-result-msg");
    const tNum = document.getElementById("scan-result-ticket-number");
    const closeBtn = document.getElementById("btn-close-scan-overlay");
    const exceptionBtn = document.getElementById("ssExceptionBtnInToast");

    const resultLabel = getResultLabel(result);
    title.innerText = resultLabel;
    msg.innerText = item?.seat ? `${item.seat.seat_row} ${item.seat.seat_number}번` : (item ? "입장권" : "");
    tNum.innerText = `🎫 ${code ? code.toUpperCase() : '알 수 없음'}`;

    closeBtn.className = "btn btn-rigid";
    overlay.className = "scan-validation-popup";

    if (result === RESULT.SUCCESS || result === RESULT.SUCCESS_EXCEPTION) {
        overlay.classList.add("status-valid");
        closeBtn.classList.add("btn-green");
    } else if (result === RESULT.FAIL_DUPLICATE) {
        overlay.classList.add("status-already");
        closeBtn.classList.add("btn-purple");
    } else {
        overlay.classList.add("status-invalid");
        closeBtn.classList.add("btn-red");
    }

    // 예외 승인 버튼 노출 로직
    const isFail = result.startsWith('실패-');
    const isStaffRole = ['ROLE_STAFF', 'ROLE_FOOD_STAFF', 'ROLE_GATE_STAFF', 'ROLE_GOODS_STAFF'].includes(userProfile?.role);
    if (exceptionBtn) {
        if (isFail && result !== RESULT.FAIL_INVALID && result !== RESULT.FAIL_REFUNDED && isStaffRole) {
            exceptionBtn.style.display = "block";
            exceptionBtn.onclick = () => {
                overlay.style.display = "none";
                if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);
                if (item) showExceptionModal(item, code);
            };
        } else {
            exceptionBtn.style.display = "none";
        }
    }

    overlay.style.display = "block";

    if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);

    // 에러 발생이나 예외 승인이 필요한 경우 토스트가 빨리 사라지지 않도록 시간을 늘림
    const timeoutDuration = (isFail) ? 3000 : 1500;

    window.scanPopupTimeout = setTimeout(() => {
        overlay.style.display = "none";
    }, timeoutDuration);

    closeBtn.onclick = () => {
        overlay.style.display = "none";
        if (window.scanPopupTimeout) clearTimeout(window.scanPopupTimeout);
    };
}

function getResultLabel(result) {
    const map = {
        [RESULT.SUCCESS]: '입장 / 수령 완료',
        [RESULT.SUCCESS_EXCEPTION]: '예외 승인 처리',
        [RESULT.FAIL_DUPLICATE]: '중복 입장 차단',
        [RESULT.FAIL_EXPIRED]: '유효 시간 만료',
        [RESULT.FAIL_TOKEN_EXPIRED]: 'QR 토큰 만료',
        [RESULT.FAIL_INVALID]: '유효하지 않은 QR',
        [RESULT.FAIL_REFUNDED]: '환불된 티켓',
    };
    return map[result] ?? result;
}

// ──────────────────────────────────────
// 팔찌 발급 모달
// ──────────────────────────────────────
function showWristbandModal(item) {
    const name = maskName(item.target_vulnerable_name ?? '대상자');
    const birth = item.target_vulnerable_birth ?? '';
    ssWristbandBody.innerHTML = `
        대상자: <strong>${name}</strong> (${birth})<br>
        노인/아동 팔찌를 발급하고 완료 버튼을 눌러주세요.`;
    ssWristbandModal.hidden = false;

    ssWristbandIssueBtn.onclick = async () => {
        await supabase
            .from('order_item')
            .update({ item_status: 'WRISTBAND_ISSUED', updated_at: new Date().toISOString() })
            .eq('id', item.id);
        ssWristbandModal.hidden = true;
    };
}

// ──────────────────────────────────────
// 스태프 예외 승인 모달
// ──────────────────────────────────────
function showExceptionModal(item, code) {
    pendingExceptionItem = { item, code };
    const seatStr = item.seat ? `${item.seat.seat_row} ${item.seat.seat_number}번` : '입장권';
    ssExceptionBody.innerHTML = `
        <strong>${seatStr}</strong> 티켓이 비정상 상태입니다.<br>
        현장 확인 후 예외 승인으로 입장 처리하시겠습니까?`;
    ssExceptionModal.hidden = false;
}

// ──────────────────────────────────────
// 실시간 스캔 로그 (Supabase Realtime)
// ──────────────────────────────────────
function subscribeRealtime() {
    supabase
        .channel('scan_log_staff')
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'scan_log',
            filter: `staff_user_id=eq.${currentUser.id}`
        }, payload => {
            // 이미 prependLog로 처리하므로 중복 방지
        })
        .subscribe();
}

async function loadRecentLogs() {
    const { data } = await supabase
        .from('scan_log')
        .select(`
            id, scan_type, result, scanned_at,
            order_item:order_item_id ( qr_code_uuid, ticket_type, target_vulnerable_name, seat:seat_id ( seat_row, seat_number ) )
        `)
        .eq('staff_user_id', currentUser.id)
        .order('scanned_at', { ascending: false })
        .limit(20);

    if (!data?.length) return;
    if (ssLogList) ssLogList.innerHTML = '';
    data.forEach(log => {
        appendLogRow({
            code: log.order_item?.qr_code_uuid ?? '알 수 없음',
            item: log.order_item,
            type: log.scan_type,
            result: log.result,
            time: new Date(log.scanned_at)
        });
    });
    if (ssLogCount) ssLogCount.textContent = `${data.length}건`;
}

function prependLog({ code, item, result, time }) {
    logRows.unshift({ code, item, result, time });
    if (ssLogCount) ssLogCount.textContent = `${logRows.length}건`;

    const row = buildLogRow({
        code: code ?? '',
        item: item,
        type: 'AUTO',
        result,
        time
    });
    if (!ssLogList) return; const empty = ssLogList.querySelector('.ss-log-empty');
    if (empty) empty.remove();
    ssLogList.insertBefore(row, ssLogList.firstChild);

    // 로그 추가 후 통계 업데이트
}

function appendLogRow(data) {
    if (ssLogList) ssLogList.appendChild(buildLogRow(data));
}

function buildLogRow({ code, item, type, result, time }) {
    const isSuccess = result === RESULT.SUCCESS;
    const isException = result === RESULT.SUCCESS_EXCEPTION;

    const timeStr = time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const typeStr = type === 'ENTRANCE' ? '입장' : '수령';

    const ticketId = code || "알 수 없음";
    const seatId = (item && item.seat) ? `${item.seat.seat_row} ${item.seat.seat_number}` : "-";
    const customerName = (item && item.target_vulnerable_name) ? item.target_vulnerable_name : "현장 고객";
    const ticketType = (item && item.ticket_type === 'VULNERABLE') ? "우대/취약" : "일반/현장";
    const ticketTypeBadge = (ticketType === '우대/취약') ? "badge-gray" : "badge-blue";

    let colorClass = "badge-red";
    let statusText = getResultLabel(result);
    let rightIndicator = "border-right-red";
    let indicatorClass = "invalid";

    if (isSuccess) {
        colorClass = "badge-green";
        rightIndicator = "border-right-green";
        indicatorClass = "valid";
    } else if (isException) {
        colorClass = "badge-warning";
        rightIndicator = "border-right-yellow";
        indicatorClass = "already_entered";
    } else if (result === RESULT.FAIL_DUPLICATE) {
        colorClass = "badge-purple";
        rightIndicator = "border-right-purple";
        indicatorClass = "duplicate";
    }

    const tr = document.createElement('tr');
    tr.className = rightIndicator;
    tr.innerHTML = `
        <td>${timeStr}</td>
        <td><strong>${ticketId}</strong></td>
        <td><span class="badge badge-gray">${seatId}</span></td>
        <td>${customerName}</td>
        <td><span class="badge ${ticketTypeBadge}">${ticketType}</span></td>
        <td><strong>1개</strong></td>
        <td><span class="badge ${colorClass}">${statusText}</span></td>
        <td class="text-right">
          <span class="indicator-bar ${indicatorClass}"></span>
        </td>
    `;
    return tr;
}

// ──────────────────────────────────────
// 관리자 잠금 해제
// ──────────────────────────────────────
async function handleUnlock() {
    const code = ssUnlockInput.value.trim().toUpperCase();
    if (!code) return;

    ssUnlockBtn.disabled = true;
    ssUnlockResult.hidden = true;

    const { data: item } = await supabase
        .from('order_item')
        .select('id, item_status, transfer_generated_at')
        .eq('qr_code_uuid', code)
        .maybeSingle();

    if (!item) {
        showUnlockResult('QR 코드를 찾을 수 없습니다.', false);
        ssUnlockBtn.disabled = false;
        return;
    }

    if (item.item_status !== 'SUSPENDED') {
        showUnlockResult(`현재 상태: ${item.item_status} (SUSPENDED 상태만 해제 가능)`, false);
        ssUnlockBtn.disabled = false;
        return;
    }

    // SUSPENDED → ORDERED 원복, transfer_generated_at NULL 초기화
    const { error } = await supabase
        .from('order_item')
        .update({
            item_status: 'ORDERED',
            transfer_token: null,
            transfer_generated_at: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

    if (error) {
        showUnlockResult('처리 중 오류가 발생했습니다.', false);
    } else {
        showUnlockResult(`잠금 해제 완료: ${code}`, true);
        ssUnlockInput.value = '';
    }
    ssUnlockBtn.disabled = false;
}

function showUnlockResult(msg, ok) {
    ssUnlockResult.textContent = msg;
    ssUnlockResult.className = `ss-unlock-result ss-unlock-result--${ok ? 'ok' : 'err'}`;
    ssUnlockResult.hidden = false;
}

// ──────────────────────────────────────
// 이벤트 바인딩
// ──────────────────────────────────────
function bindEvents() {
    if (ssRetryBtn) ssRetryBtn.addEventListener('click', startCamera);

    if (ssManualSubmit && ssManualInput) ssManualSubmit.addEventListener('click', () => {
        const v = ssManualInput.value.trim();
        if (v) { processQR(v); ssManualInput.value = ''; }
    });

    if (ssManualInput) ssManualInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && ssManualSubmit) ssManualSubmit.click();
    });

    if (ssUnlockBtn) ssUnlockBtn.addEventListener('click', handleUnlock);
    if (ssUnlockInput) ssUnlockInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleUnlock(); });

    // 팔찌 모달
    if (ssWristbandCloseBtn) ssWristbandCloseBtn.addEventListener('click', () => { ssWristbandModal.hidden = true; });

    // 스캔 기록 검색
    const searchInput = document.getElementById("ssLogSearchInput");
    if (searchInput) {
        searchInput.addEventListener("keyup", (e) => {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll("#ssLogList tr");
            rows.forEach(row => {
                const ticketCell = row.cells[1];
                if (ticketCell) {
                    const text = ticketCell.textContent.toLowerCase();
                    row.style.display = text.includes(term) ? "" : "none";
                }
            });
        });
    }

    // 모의 테스트 스캔
    document.querySelectorAll(".btn-mock-scan").forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute("data-id");
            if (id) processQR(id);
        });
    });
    var el = document.getElementById('ssWristbandBackdrop'); if (el) el.addEventListener('click', () => { ssWristbandModal.hidden = true; });

    // 예외 승인 모달
    if (ssExceptionCancelBtn) ssExceptionCancelBtn.addEventListener('click', () => { ssExceptionModal.hidden = true; pendingExceptionItem = null; });
    var el = document.getElementById('ssExceptionBackdrop'); if (el) el.addEventListener('click', () => {
        ssExceptionModal.hidden = true; pendingExceptionItem = null;
    });

    if (ssExceptionApproveBtn) ssExceptionApproveBtn.addEventListener('click', async () => {
        if (!pendingExceptionItem) return;
        const { item, code } = pendingExceptionItem;

        await supabase
            .from('order_item')
            .update({ item_status: 'ENTERED', updated_at: new Date().toISOString() })
            .eq('id', item.id);

        await insertScanLog(item.id, RESULT.SUCCESS_EXCEPTION);
        await renderResult(item, RESULT.SUCCESS_EXCEPTION, code);

        ssExceptionModal.hidden = true;
        pendingExceptionItem = null;
    });
}

// ──────────────────────────────────────
// SVG 아이콘 헬퍼
// ──────────────────────────────────────
function successSVG() {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`;
}
function warningSVG() {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
}
function failSVG() {
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>`;
}

// ──────────────────────────────────────
// 실행
// ──────────────────────────────────────
init();












