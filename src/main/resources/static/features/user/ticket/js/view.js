const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('orderId');
        const hexSecret = urlParams.get('secret');

        let qrCodeInstance = null;

        async function generateTotp(hexSecret) {
            const keyBytes = new Uint8Array(hexSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const cryptoKey = await crypto.subtle.importKey(
                "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
            );
            
            const epoch = Math.floor(Date.now() / 30000);
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
                document.getElementById('totp-display').innerText = "ERROR";
                return;
            }
            try {
                const code = await generateTotp(hexSecret);
                document.getElementById('totp-display').innerText = code;
                
                const payload = `TOTP:${orderId}:${code}`;
                
                const qrContainer = document.getElementById('qr-code');
                qrContainer.innerHTML = ''; // clear old
                qrCodeInstance = new QRCode(qrContainer, {
                    text: payload,
                    width: 200,
                    height: 200,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            } catch (e) {
                console.error(e);
            }
        }

        function updateTimer() {
            const currentSeconds = Math.floor(Date.now() / 1000) % 30;
            const remaining = 30 - currentSeconds;
            
            document.getElementById('timer-sec').innerText = remaining;
            const percentage = (remaining / 30) * 100;
            document.getElementById('timer-bar').style.width = percentage + '%';
            
            if (remaining === 30 || remaining === 29 && currentSeconds === 1) { // Redraw when window resets
                refreshTotp();
            }
        }

        // Init
        refreshTotp();
        setInterval(updateTimer, 1000);
        updateTimer();