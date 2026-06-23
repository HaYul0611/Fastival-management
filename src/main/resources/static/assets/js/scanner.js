// QR Ticket Scanner & Validation Module
import { DB, publish, saveDB } from './store.js';

let html5Qrcode = null;

export function initializeQRScanner(containerId, onScanSuccess, onScanFailure) {
  if (typeof Html5Qrcode === 'undefined') {
    console.error("Html5Qrcode library is not loaded.");
    return;
  }

  // If already instantiated, stop first
  if (html5Qrcode) {
    html5Qrcode.stop()
      .then(() => {
        html5Qrcode = null;
        startNewScanner(containerId, onScanSuccess, onScanFailure);
      })
      .catch(err => {
        console.log("Error stopping scanner: ", err);
        // Force reset
        html5Qrcode = null;
        startNewScanner(containerId, onScanSuccess, onScanFailure);
      });
  } else {
    startNewScanner(containerId, onScanSuccess, onScanFailure);
  }
}

let isProcessing = false;
let lastScannedText = "";
let lastScannedTime = 0;

function startNewScanner(containerId, onScanSuccess, onScanFailure) {
  html5Qrcode = new Html5Qrcode(containerId);

  html5Qrcode.start(
    { facingMode: "environment" },
    {
      fps: 30,
      qrbox: { width: 250, height: 250 }
    },
    async (decodedText) => {
      // 똑같은 티켓을 3초 이내에 연속으로 중복 스캔하는 것 방지
      if (decodedText === lastScannedText && (Date.now() - lastScannedTime) < 3000) {
        return;
      }

      if (isProcessing) return;
      isProcessing = true;
      lastScannedText = decodedText;
      lastScannedTime = Date.now();

      try {
        const result = await onScanSuccess(decodedText);
        if (result && result.status) {
          playBeep(result.status);
        }
      } catch (e) {
        console.error(e);
      } finally {
        // 즉시 락 해제 (동일 티켓 반복 스캔 방지는 상단의 3초 스로틀링으로 제어)
        isProcessing = false;
      }
    },
    (errorMessage) => {
      // Quietly ignore library scanning errors
    }
  ).catch(err => {
    console.warn("Environment camera failed, falling back to any camera: ", err);

    // 이전에 실패하면서 생성된 에러 UI(X 아이콘 등)를 완전히 초기화
    try { html5Qrcode.clear(); } catch (e) { }
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = "";

    // 완전히 새로운 인스턴스로 웹캠 시도
    html5Qrcode = new Html5Qrcode(containerId);

    // Fallback to user camera (for laptops)
    html5Qrcode.start(
      { facingMode: "user" },
      { fps: 30, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (decodedText === lastScannedText && (Date.now() - lastScannedTime) < 3000) return;
        if (isProcessing) return;
        isProcessing = true;
        lastScannedText = decodedText;
        lastScannedTime = Date.now();
        try {
          const result = await onScanSuccess(decodedText);
          if (result && result.status) playBeep(result.status);
        } catch (e) { console.error(e); } finally {
          isProcessing = false;
        }
      },
      (errorMessage) => { }
    ).catch(fallbackErr => {
      console.error("Camera start completely failed: ", fallbackErr);
      if (onScanFailure) onScanFailure(fallbackErr);
    });
  });
}

export function resumeScanning() {
  isProcessing = false;
}

export function stopQRScanner() {
  if (html5Qrcode) {
    const cleanup = () => {
      try {
        if (typeof html5Qrcode.clear === 'function') {
          html5Qrcode.clear(); // DOM 및 내부 메모리 찌꺼기 강제 정리
        }
      } catch (e) { }
      html5Qrcode = null;
    };

    try {
      // 카메라 상태와 상관없이 stop 시도 후 무조건 정리
      html5Qrcode.stop()
        .then(cleanup)
        .catch((err) => {
          console.warn("카메라 정상 종료 실패, 강제 정리 진행:", err);
          cleanup();
        });
    } catch (err) {
      cleanup();
    }
  }
}

// Play simulated sounds using browser AudioContext
function playBeep(status) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (status === "VALID") {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High double-beep for success
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);

      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.1);
      }, 120);
    } else if (status === "ALREADY_ENTERED") {
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Mid-tone flat beep for warning
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } else {
      oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // Low buzz-tone for error
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    }
  } catch (e) {
    console.log("Audio simulation failed, browser autoplay blocked.", e);
  }
}

// Validates ticket state and performs mutations in the Mock DB or Memory DB
export async function validateTicketState(text) {
  // 스캔된 모든 텍스트는 모의 로직을 거치지 않고 서버로 전송하여 검증 및 로그(scan_log)를 생성합니다.
  try {
    const res = await fetch('/api/order/tickets/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrText: text })
    });
    const data = await res.json();

    let parsedTicketId = text;
    if (text.startsWith("TOTP:")) parsedTicketId = text.split(":")[2];
    else if (text.startsWith("FESTIO:TICKET:")) parsedTicketId = text.split(":")[2];
    else if (text.includes("?orderId=")) {
      const urlParams = new URLSearchParams(text.substring(text.indexOf('?')));
      parsedTicketId = "URL_TICKET_" + (urlParams.get("orderId") || "UNKNOWN");
    }

    const scanLog = {
      timestamp: new Date().toLocaleTimeString(),
      ticketId: parsedTicketId,
      status: data.status,
      statusText: data.status === "VALID" ? "인증 성공 (정상 티켓)" : (data.status === "ALREADY_ENTERED" ? "중복 입장" : "미등록/위조 티켓"),
      color: data.status === "VALID" ? "green" : (data.status === "ALREADY_ENTERED" ? "purple" : "red"),
      seatId: data.seats || "-",
      holder: "현장 고객"
    };

    publish("scan-log", { ticketId: scanLog.ticketId, status: data.status, log: scanLog });
    return { status: data.status, message: data.message, log: scanLog };
  } catch (e) {
    console.error("Scan validation error:", e);
    return { status: "INVALID", message: "서버 통신 오류", log: null };
  }
}

// Exchange Goods or Coffee QR Scanner
export function validateExchangeQR(orderId) {
  const order = DB.orders.find(o => o.id === orderId);

  if (!order) {
    return { success: false, message: "존재하지 않는 주문 번호입니다." };
  }

  if (order.status === "PICKED_UP") {
    return { success: false, message: "이미 수령/픽업이 완료된 상품권/주문입니다." };
  }

  order.status = "PICKED_UP";
  saveDB();

  publish("order-change", { orderId: order.id, status: "PICKED_UP" });
  return { success: true, message: `주문 ${order.id}이 성공적으로 픽업 완료(PICKED UP) 처리되었습니다!`, order };
}
