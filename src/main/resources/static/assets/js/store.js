// In-Memory Database & Realtime PubSub Event Engine (Simulating Supabase/WebSockets)

// Initial Data
const initialDB = {
  activeCheckpoint: {
    event: "FESTIO",
    tenant: "스태프 시스템"
  },
  staffs: [
    { id: "staffA", pw: "staff111", name: "게이트 스태프 A" },
    { id: "staffB", pw: "staff222", name: "매표소 스태프 B" },
    { id: "staffC", pw: "staff333", name: "F&B 스태프 C" },
    { id: "staffD", pw: "staff444", name: "굿즈 스태프 D" }
  ],
  seats: {},
  goods: [],
  food: [],
  tickets: [],
  orders: [],
  notifications: [],
  options: {
    rates: [
      { id: "r1", name: "성인 (Adult)", multiplier: 1.0 },
      { id: "r2", name: "소아 (Child - 만 12세 이하)", multiplier: 0.7 },
      { id: "r3", name: "유아 (Infant - 만 36개월 이하)", multiplier: 0.3 }
    ],
    seasons: [
      { id: "s1", name: "평수기 평일 (Standard)", basePrice: 15000, active: true },
      { id: "s2", name: "성수기/주말 (Peak)", basePrice: 22000, active: false }
    ]
  },
  websocketSimulation: false
};

// Initialize seating grid: 3 zones (A, B, C) with 12 seats each
const zones = ["A", "B", "C"];
zones.forEach(zone => {
  for (let i = 1; i <= 12; i++) {
    const seatId = `${zone}-${i}`;
    // Pre-populate some reserved seats
    let status = "AVAILABLE";
    let holder = null;
    if (seatId === "A-5" || seatId === "A-6" || seatId === "B-12" || seatId === "B-15") {
      status = "RESERVED";
      holder = "예약완료 (입장대기)";
    } else if (seatId === "C-3" || seatId === "C-10") {
      status = "ENTERED";
      holder = "입장완료";
    }
    initialDB.seats[seatId] = {
      status,
      price: 15000,
      holder
    };
  }
});

// Load DB from localStorage if exists, else load initial
let localDB = localStorage.getItem("STAFF_PROJECT_DB");
export const DB = localDB ? JSON.parse(localDB) : initialDB;

// Force override staffs list to apply the new 4 roles immediately
DB.staffs = initialDB.staffs;

// Cleanup deprecated food fields
if (!DB.food) DB.food = [];
DB.food.forEach(f => {
  delete f.currentStock;
  delete f.preAllocated;
});
saveDB();

// Save helper
export function saveDB() {
  localStorage.setItem("STAFF_PROJECT_DB", JSON.stringify(DB));
}

// PubSub System (Realtime Event Bus)
const listeners = {};

export function subscribe(event, callback) {
  if (!listeners[event]) {
    listeners[event] = [];
  }
  listeners[event].push(callback);
}

export function publish(event, data) {
  if (listeners[event]) {
    listeners[event].forEach(callback => callback(data));
  }
  // Also push a system notification in DB for live telemetry logs
  if (event !== "notification") {
    let logMsg = "";
    if (event === "seat-change") {
      logMsg = `[좌석 상태 변경] 좌석 ${data.seatId} -> ${data.status}`;
    } else if (event === "scan-log") {
      let korStatus = data.status;
      if (korStatus === "INVALID" || korStatus === "FAIL_INVALID") korStatus = "유효하지 않음";
      if (korStatus === "VALID") korStatus = "정상입장";
      if (korStatus === "ALREADY_ENTERED") korStatus = "중복스캔";
      logMsg = `[QR 스캔] 티켓 ${data.ticketId} : 결과 [${korStatus}]`;
    } else if (event === "payment-complete") {
      logMsg = `[결제 완료] ${data.customer} / ${data.amount.toLocaleString()}원 승인`;
    } else if (event === "inventory-change") {
      logMsg = `[재고 갱신] ${data.name}: 재고 ${data.stock}개 (가용: ${data.available})`;
    } else if (event === "food-soldout") {
      logMsg = `[메뉴 소진] ${data.name} 상태 변경 -> ${data.outOfStock ? '재료소진' : '판매중'}`;
    } else if (event === "order-change") {
      logMsg = `[주문 상태 변경] 주문 ${data.orderId} -> ${data.status}`;
    }

    if (logMsg) {
      addNotification("TELEMETRY", logMsg);
    }
  }
  saveDB();
}

export function addNotification(type, message) {
  const newNotif = {
    id: Date.now(),
    type,
    message,
    timestamp: new Date().toLocaleTimeString()
  };
  DB.notifications.unshift(newNotif);
  if (DB.notifications.length > 50) {
    DB.notifications.pop();
  }
  saveDB();
  // Notify bell icon listeners
  if (listeners["notification"]) {
    listeners["notification"].forEach(callback => callback(newNotif));
  }
}

