// Toss Payments checkout simulator & transaction cancellation module
import { DB, publish, saveDB } from './store.js';

export function calculateTicketPrice(seatId, seasonId, rateId) {
  const seat = DB.seats[seatId];
  const basePrice = (seat && seat.price) ? seat.price : 0;
  
  // 만약 좌석에 고유 가격이 설정되어 있다면 그 가격을 우선적으로 사용합니다.
  if (basePrice > 0) {
    return basePrice;
  }
  
  // 좌석 고유 가격이 없는 경우 예전 모의 데이터 방식 유지
  const season = DB.options.seasons.find(s => s.id === seasonId) || DB.options.seasons[0];
  const rate = DB.options.rates.find(r => r.id === rateId) || DB.options.rates[0];
  
  return Math.round(season.basePrice * rate.multiplier);
}

// Launches simulated Toss Payments modal window
export function requestTossPayment({ title, amount, metadata, onSuccess, onCancel }) {
  // Create simulated Toss Payment Modal dynamically on the DOM
  const tossModal = document.createElement("div");
  tossModal.id = "toss-payments-modal";
  tossModal.className = "toss-modal-overlay";
  
  tossModal.innerHTML = `
    <div class="toss-modal-container">
      <div class="toss-header">
        <img src="https://static.toss.im/assets/homepage/toss_logo_blue.png" alt="Toss Payments" class="toss-logo" style="height: 20px;">
        <span class="toss-title">결제창 (Simulated SDK)</span>
      </div>
      <div class="toss-body">
        <div class="toss-summary">
          <div class="toss-item-name">${title}</div>
          <div class="toss-amount">${amount.toLocaleString()}원</div>
        </div>
        
        <div class="toss-card-visual">
          <div class="toss-card-chip"></div>
          <div class="toss-card-number">•••• •••• •••• 1234</div>
          <div class="toss-card-holder">스태프 테스트 신용카드</div>
        </div>
        
        <div class="toss-warning">
          ※ 본 창은 토스페이먼츠 승인 API를 검증하기 위한 프론트엔드 모의 결제창입니다. 실제 금액은 청구되지 않습니다.
        </div>
        
        <div class="toss-action-inputs">
          <label>카드 승인 번호 (임의 생성됨)</label>
          <input type="text" id="toss-approval-code" value="TOSS-${Math.floor(100000 + Math.random() * 900000)}" readonly class="toss-input-rigid">
        </div>
      </div>
      <div class="toss-footer">
        <button id="toss-cancel-btn" class="btn btn-rigid btn-red">결제 취소</button>
        <button id="toss-approve-btn" class="btn btn-rigid btn-green">IC 카드 삽입 (승인 요청)</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(tossModal);
  
  // Handlers
  document.getElementById("toss-cancel-btn").onclick = () => {
    tossModal.remove();
    if (onCancel) onCancel("USER_CANCEL");
  };
  
  document.getElementById("toss-approve-btn").onclick = () => {
    const btn = document.getElementById("toss-approve-btn");
    btn.innerHTML = `<span class="spinner"></span> 승인 처리 중...`;
    btn.disabled = true;
    
    // Simulate Toss API delay (1.5 seconds)
    setTimeout(() => {
      const approvalCode = document.getElementById("toss-approval-code").value;
      tossModal.remove();
      
      // Process successful payment in DB
      const transactionId = `TX-${Date.now().toString().slice(-6)}`;
      
      onSuccess({
        transactionId,
        approvalCode,
        timestamp: new Date().toLocaleTimeString(),
        amount
      });
    }, 1500);
  };
}

// Request Refund (creates a refund request pending status)
export function requestRefund(orderId) {
  const order = DB.orders.find(o => o.id === orderId);
  if (order) {
    order.status = "REFUND_REQUESTED";
    saveDB();
    publish("order-change", { orderId, status: "REFUND_REQUESTED" });
    return { success: true, order };
  }
  return { success: false, error: "주문을 찾을 수 없습니다." };
}

// Accept Refund & Trigger Toss Cancel API Simulation
export function acceptRefund(orderId, onSuccess) {
  const order = DB.orders.find(o => o.id === orderId);
  if (!order) {
    return { success: false, error: "주문을 찾을 수 없습니다." };
  }
  
  if (order.status !== "REFUND_REQUESTED") {
    return { success: false, error: "환불 요청 상태가 아닙니다." };
  }
  
  // Simulate Toss Cancellation API callback delay (1 second)
  setTimeout(() => {
    // 1. Update Order status
    order.status = "REFUNDED";
    
    // 2. Restore seat map to AVAILABLE if it was a ticket booking
    if (order.type === "TICKET" && order.metadata && order.metadata.seatId) {
      const seatId = order.metadata.seatId;
      if (DB.seats[seatId]) {
        DB.seats[seatId].status = "AVAILABLE";
        DB.seats[seatId].holder = null;
        publish("seat-change", { seatId, status: "AVAILABLE", seat: DB.seats[seatId] });
      }
      
      // Mark matching ticket unused/removed
      const ticket = DB.tickets.find(t => t.seat === seatId);
      if (ticket) {
        ticket.used = false;
      }
    }
    
    // 3. Restore inventory if it was a goods order
    if (order.type === "GOODS" && order.items) {
      order.items.forEach(item => {
        const goodsItem = DB.goods.find(g => g.name === item.name);
        if (goodsItem) {
          goodsItem.currentStock += item.quantity; // Restore inventory
          publish("inventory-change", {
            id: goodsItem.id,
            name: goodsItem.name,
            stock: goodsItem.currentStock,
            available: goodsItem.currentStock - goodsItem.preAllocated
          });
        }
      });
    }
    
    saveDB();
    publish("order-change", { orderId, status: "REFUNDED" });
    
    if (onSuccess) onSuccess(order);
  }, 1000);
  
  return { success: true, message: "Toss 결제 취소 API 요청이 발송되었습니다." };
}
