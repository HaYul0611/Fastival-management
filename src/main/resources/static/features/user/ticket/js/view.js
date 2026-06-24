const urlParams = new URLSearchParams(window.location.search);
const orderId = urlParams.get('orderId');
const hexSecret = urlParams.get('secret');
const userName = urlParams.get('userName');
const userGrade = urlParams.get('grade');

if (userName) {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        // Clean up the string in case it contains old formatted text with badges and newlines
        let cleanName = userName.trim();
        cleanName = cleanName.replace(/^(BRONZE|SILVER|GOLD|EMERALD|DIAMOND|VIP|SVIP|VVIP)\s*/i, '').trim();
        userDisplay.innerText = cleanName;
    }
}
if (userGrade) {
    const gradeText = document.getElementById('grade-text');
    if (gradeText) gradeText.innerText = userGrade.toUpperCase();
}

let qrCodeInstance = null;

const BarcodeUtils = {
    MASK_FIXED: 80000000000000000n,
    MASK_DYNAMIC: 90000000000000000n,
    encodeFixedOrder(prefix, orderId) {
        const obf = BigInt(orderId) ^ this.MASK_FIXED;
        const base36 = obf.toString(36).toUpperCase();
        return prefix + base36.padStart(11, '0');
    },
    encodeDynamicBarcode(prefix, orderId, totp) {
        const combined = BigInt(orderId) * 1000000n + BigInt(totp);
        const obf = combined ^ this.MASK_DYNAMIC;
        const base36 = obf.toString(36).toUpperCase();
        return prefix + base36.padStart(11, '0');
    }
};

async function generateTotp(hexSecret, epochOffset = 0) {
    const keyBytes = new Uint8Array(hexSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );

    const epoch = Math.floor(Date.now() / 180000) + epochOffset;
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
}

let _qrEpochOffset = 0; // Legacy variable, no longer accumulates
let _qrStartTime = Date.now();
let _isManualRefresh = false;

window.refreshTotpManual = function () {
    _isManualRefresh = true;
    refreshTotp();
};

async function refreshTotp() {
    if (!orderId || !hexSecret) {
        document.getElementById('code-display').innerText = "ERROR";
        return;
    }
    try {
        if (_isManualRefresh) {
            _qrEpochOffset += 1; // 사용자가 명시적으로 갱신을 요청했으므로 새로운 코드가 나오도록 오프셋 누적 복구
            _isManualRefresh = false;
            if (window.Toast) window.Toast.info('새로운 코드가 발급되었으며 타이머가 갱신되었습니다.');
        }

        _qrStartTime = Date.now(); // Reset the timer
        const code = await generateTotp(hexSecret, _qrEpochOffset); // 갱신 시 적용된 오프셋 전달

        let fixedOrderId = parseInt(orderId, 10);
        if (isNaN(fixedOrderId)) fixedOrderId = 1;

        const dynamicBarcode = BarcodeUtils.encodeDynamicBarcode('T', fixedOrderId, code);
        const staticBarcode = BarcodeUtils.encodeFixedOrder('T', fixedOrderId);

        const titleEl = document.querySelector('.title');
        if (titleEl) {
            titleEl.innerHTML = `FESTIO TICKET`;
            let orderNoEl = document.getElementById('ticket-order-no');
            if (!orderNoEl) {
                orderNoEl = document.createElement('div');
                orderNoEl.id = 'ticket-order-no';
                orderNoEl.className = 'ticket-order-no';
                orderNoEl.style.fontSize = '1.05rem';
                orderNoEl.style.fontWeight = '700';
                orderNoEl.style.marginBottom = '8px';
                const subtitle = document.querySelector('.subtitle');
                if (subtitle) subtitle.parentNode.insertBefore(orderNoEl, subtitle);
            }
            orderNoEl.textContent = `예매번호: ${staticBarcode}`;
        }

        const codeDisplay = document.getElementById('code-display');
        codeDisplay.style.fontSize = '18px';
        codeDisplay.style.letterSpacing = '3px';
        codeDisplay.style.color = '#888';
        codeDisplay.style.fontWeight = '700';
        codeDisplay.innerHTML = `${dynamicBarcode}`;

        const payload = dynamicBarcode;

        const qrContainer = document.getElementById('qr-code');
        qrContainer.innerHTML = ''; // clear old
        qrCodeInstance = new QRCode(qrContainer, {
            text: payload,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        setTimeout(() => {
            const qrEls = qrContainer.querySelectorAll('canvas, img');
            qrEls.forEach(el => el.removeAttribute('title'));
            qrContainer.removeAttribute('title');
        }, 50);

        updateTimer();
    } catch (e) {
        console.error(e);
    }
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - _qrStartTime) / 1000);
    const remaining = 180 - elapsed;

    if (remaining <= 0) {
        refreshTotp();
        return;
    }

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const timerSecEl = document.getElementById('timer-sec');
    const timerBarEl = document.getElementById('timer-bar');

    timerSecEl.innerText = `0${m}:${s.toString().padStart(2, '0')}`;
    const percentage = (remaining / 180) * 100;
    timerBarEl.style.width = percentage + '%';

    if (remaining < 60) {
        timerSecEl.classList.add('qr-danger-text');
        timerSecEl.style.color = '#ff4d4f';
        timerBarEl.style.background = '#ff4d4f';
    } else {
        timerSecEl.classList.remove('qr-danger-text');
        timerSecEl.style.color = '';
        timerBarEl.style.background = 'linear-gradient(90deg, #00d2ff, #8930F8)';
    }

    // removed old absolute logic
}

// Init
refreshTotp();
setInterval(updateTimer, 1000);
updateTimer();