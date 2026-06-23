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

async function generateTotp(hexSecret) {
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
}

async function refreshTotp() {
    if (!orderId || !hexSecret) {
        document.getElementById('code-display').innerText = "ERROR";
        return;
    }
    try {
        const code = await generateTotp(hexSecret);

        // Format: T + orderId Base36 5 chars + 6 chars OTP
        const orderIdNum = parseInt(orderId, 10);
        const orderIdBase36 = isNaN(orderIdNum) ? "00000" : orderIdNum.toString(36).padStart(5, '0').toUpperCase();
        const payload = `T${orderIdBase36}${code}`;

        document.getElementById('code-display').innerText = payload;

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
<<<<<<< HEAD
=======

        setTimeout(() => {
            const qrEls = qrContainer.querySelectorAll('canvas, img');
            qrEls.forEach(el => el.removeAttribute('title'));
            qrContainer.removeAttribute('title');
        }, 50);
>>>>>>> e8a1112b93310ad09f5e536736db1d35babdbbfa
    } catch (e) {
        console.error(e);
    }
}

function updateTimer() {
    const currentSeconds = Math.floor(Date.now() / 1000) % 180;
    const remaining = 180 - currentSeconds;

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
<<<<<<< HEAD
    document.getElementById('timer-sec').innerText = `0${m}:${s.toString().padStart(2, '0')}`;
    const percentage = (remaining / 180) * 100;
    document.getElementById('timer-bar').style.width = percentage + '%';
=======
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
        timerSecEl.style.color = '#2D1A54';
        timerBarEl.style.background = 'linear-gradient(90deg, #00d2ff, #8930F8)';
    }
>>>>>>> e8a1112b93310ad09f5e536736db1d35babdbbfa

    if (remaining === 180 || remaining === 179 && currentSeconds === 1) { // Redraw when window resets
        refreshTotp();
    }
}

// Init
refreshTotp();
setInterval(updateTimer, 1000);
updateTimer();