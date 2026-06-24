// Seat Map Renderer & Realtime WebSockets Visualizer
import { DB, publish, saveDB, subscribe } from './store.js';

export function getSeatStats() {
  const stats = {
    total: 36,
    available: 0,
    reserved: 0,
    entered: 0,
    byZone: {
      A: { available: 0, total: 12 },
      B: { available: 0, total: 12 },
      C: { available: 0, total: 12 }
    }
  };

  Object.entries(DB.seats).forEach(([seatId, data]) => {
    const zone = seatId.split("-")[0];
    if (data.status === "AVAILABLE") {
      stats.available++;
      stats.byZone[zone].available++;
    } else if (data.status === "RESERVED") {
      stats.reserved++;
    } else if (data.status === "ENTERED") {
      stats.entered++;
    }
  });

  return stats;
}

export function renderSeatMap(containerId, onSeatClick, targetZone = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let zones = Array.from(new Set(Object.keys(DB.seats).map(id => DB.seats[id].zone))).filter(z => z).sort();
  if (targetZone) {
    // Exact match 우선, 없으면 포함 여부로 유연하게 처리 (브라우저 캐시로 인해 ui.js가 옛날 버전인 경우 대비)
    zones = zones.filter(z => z === targetZone || z.includes(targetZone) || targetZone.includes(z));
  }

  if (targetZone && zones.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 50px; color: var(--text-muted);">해당 구역에는 등록된 좌석이 없습니다.</div>`;
    return;
  }

  let badgesHtml = zones.map(z => `<div class="zone-badge">구역 ${z}</div>`).join('');
  let zonesHtml = zones.map(z => `
    <div class="theater-zone" id="theater-zone-${z.toLowerCase()}" style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px;">
      <div style="text-align:center; color:#ffd65c; font-weight:bold; margin-bottom:10px;">${z}</div>
      <div class="zone-seats-container" id="zone-container-${z.toLowerCase()}" style="display:grid; gap:5px; justify-content:center;"></div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="theater-shell">
      <div class="exit-indicator top-left">◀ 출입구</div>
      <div class="exit-indicator top-right">출입구 ▶</div>
      <div class="theater-stage">무 대 (STAGE)</div>

      <div class="theater-layout-grid" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-top: 30px;">
        ${zonesHtml}
      </div>

      <div class="theater-footer-row">
        <div class="wheelchair-bay left-bay">
          <span class="wc-seat" title="장애인 전용석">♿</span>
          <span class="wc-seat" title="장애인 전용석">♿</span>
        </div>
        <div class="exit-indicator bottom-left">◀ 출입구</div>
        <div class="exit-indicator bottom-right">출입구 ▶</div>
        <div class="wheelchair-bay right-bay">
          <span class="wc-seat" title="장애인 전용석">♿</span>
          <span class="wc-seat" title="장애인 전용석">♿</span>
        </div>
      </div>
    </div>
  `;

  zones.forEach(zone => {
    const zoneContainer = document.getElementById(`zone-container-${zone.toLowerCase()}`);
    if (!zoneContainer) return;

    const zoneSeats = Object.keys(DB.seats)
      .filter(id => {
        const seatZone = DB.seats[id].zone;
        return seatZone === zone || seatZone.includes(zone) || zone.includes(seatZone);
      });

    if (zoneSeats.length === 0) return;

    const rows = [...new Set(zoneSeats.map(id => DB.seats[id].seatRow || ''))]
      .filter(r => r)
      .sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
    
    const maxCol = Math.max(...zoneSeats.map(id => parseInt(DB.seats[id].number) || 1), 1);

    zoneContainer.style.gridTemplateRows = `repeat(${rows.length}, 32px)`;
    zoneContainer.style.gridTemplateColumns = `repeat(${maxCol}, 32px)`;

    zoneSeats.forEach(seatId => {
      const seatData = DB.seats[seatId];
      if (!seatData) return;

      const seatEl = document.createElement("div");
      seatEl.className = `seat seat-${seatData.status.toLowerCase()}`;
      seatEl.setAttribute("data-seat-id", seatId);
      seatEl.id = `seat-node-${seatId}`;
      
      const rowIndex = rows.indexOf(seatData.seatRow) + 1;
      const colIndex = parseInt(seatData.number) || 0;
      
      if (rowIndex > 0) seatEl.style.gridRow = rowIndex.toString();
      if (colIndex > 0) seatEl.style.gridColumn = colIndex.toString();
      
      let displayNum = seatData.number || "";

      seatEl.innerHTML = `
        <span class="seat-number">${displayNum}</span>
        <span class="seat-tooltip">좌석: ${seatData.seatRow} ${displayNum}번<br>${getStatusLabel(seatData.status)}<br>${seatData.holder || '지정 고객 없음'}</span>
      `;

      if (seatData.status === "AVAILABLE") {
        if (onSeatClick) {
          seatEl.style.cursor = "pointer";
          seatEl.addEventListener("click", () => {
            onSeatClick(seatId);
          });
        } else {
          seatEl.style.cursor = "default";
        }
      } else {
        seatEl.style.cursor = "not-allowed";
      }

      zoneContainer.appendChild(seatEl);
    });
  });
}

function getStatusLabel(status) {
  switch (status) {
    case "AVAILABLE": return "이용 가능 (AVAILABLE)";
    case "RESERVED": return "예매 완료 (RESERVED)";
    case "ENTERED": return "입장 완료 (ENTERED)";
    default: return status;
  }
}

// Bind realtime update subscription to the DOM nodes directly
export function setupRealtimeSeatSync() {
  subscribe("seat-change", (data) => {
    const seatEl = document.getElementById(`seat-node-${data.seatId}`);
    if (seatEl) {
      // Clear all classes and add updated class
      seatEl.className = `seat seat-${data.status.toLowerCase()} animate-pulse-telemetry`;
      
      // Update Tooltip
      const tooltip = seatEl.querySelector(".seat-tooltip");
      if (tooltip) {
        tooltip.innerHTML = `${data.seatId}<br>${getStatusLabel(data.status)}<br>${data.seat.holder || '지정 고객 없음'}`;
      }

      // Update pointer/actions
      if (data.status === "AVAILABLE") {
        const clickHandler = window.activeSeatClickHandler;
        seatEl.style.cursor = clickHandler ? "pointer" : "default";
        // To prevent multiple bindings, clone and replace
        const newSeatEl = seatEl.cloneNode(true);
        newSeatEl.style.cursor = clickHandler ? "pointer" : "default";
        if (clickHandler) {
          newSeatEl.addEventListener("click", () => {
            clickHandler(data.seatId);
          });
        }
        seatEl.parentNode.replaceChild(newSeatEl, seatEl);
      } else {
        seatEl.style.cursor = "not-allowed";
        // Remove click event
        const newSeatEl = seatEl.cloneNode(true);
        newSeatEl.style.cursor = "not-allowed";
        seatEl.parentNode.replaceChild(newSeatEl, seatEl);
      }

      // Add a visual flash overlay highlighting the realtime websocket change
      setTimeout(() => {
        const freshNode = document.getElementById(`seat-node-${data.seatId}`);
        if (freshNode) freshNode.classList.remove("animate-pulse-telemetry");
      }, 1500);
    }
  });
}

export function manualReserveSeat(seatId, holderName) {
  if (DB.seats[seatId] && DB.seats[seatId].status === "AVAILABLE") {
    DB.seats[seatId].status = "RESERVED";
    DB.seats[seatId].holder = holderName;
    saveDB();
    publish("seat-change", { seatId, status: "RESERVED", seat: DB.seats[seatId] });
    return true;
  }
  return false;
}

export function releaseSeat(seatId) {
  if (DB.seats[seatId]) {
    DB.seats[seatId].status = "AVAILABLE";
    DB.seats[seatId].holder = null;
    saveDB();
    publish("seat-change", { seatId, status: "AVAILABLE", seat: DB.seats[seatId] });
    return true;
  }
  return false;
}
