/**
 * seats-init.js
 * seats.html 전용 초기화 스크립트.
 * ticketMode에 따라 FREE 모드(자유입장권 폼) vs SEAT 모드(동적 JS 좌석 배치도)를 분기합니다.
 * React 앱 의존 없이 완전히 순수 JS로 동작합니다.
 */
import { initPage, renderFreeTicketForm } from '/assets/js/ui.js';
import { DB } from '/assets/js/store.js';

document.addEventListener("DOMContentLoaded", async () => {
  const festivalId = sessionStorage.getItem("currentFestivalId");
  const rootEl = document.getElementById("root");

  // 1. 인증 및 공통 UI 초기화 (사이드바, 헤더 등)
  initPage('seats');

  // 2. ticketMode 조회
  let ticketMode = 'SEAT';
  let festivalName = '행사';
  try {
    const res = await fetch('/api/festival');
    if (res.ok) {
      const festivals = await res.json();
      const target = festivals.find(f => f.id.toString() === (festivalId || '').toString());
      if (target) {
        ticketMode = target.ticketMode || 'SEAT';
        festivalName = target.name || '행사';
      }
    }
  } catch (e) {
    console.error('[seats-init] 축제 정보 조회 실패', e);
  }

  if (ticketMode === 'FREE') {
    // ── FREE 모드: 자유입장권 발권 폼 렌더링 ──
    if (rootEl) {
      rootEl.innerHTML = ''; // React 앱 자리 비우기
      await renderFreeTicketForm(rootEl, festivalId);
    }
  } else {
    // ── SEAT 모드: 동적 좌석 배치도 렌더링 ──
    await renderSeatMap(rootEl, festivalId, festivalName);
  }
});

/**
 * 관리자가 지정한 구역/좌석을 API에서 받아 순수 JS로 렌더링합니다.
 */
async function renderSeatMap(container, festivalId, festivalName) {
  if (!container) return;

  // Custom Stylesheet 주입
  const styleId = 'svg-seating-map-custom-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      .grid-editor-container-viewport {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 12px;
        border: 1px solid #374151;
        background: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .grid-editor-container {
        position: relative;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        aspect-ratio: 1 / 1;
      }
      .grid-bg-overlay {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background-size: 100% 100% !important;
        background-repeat: no-repeat;
        background-position: center center;
        opacity: 0.8;
        z-index: 1;
        pointer-events: none;
      }
      #zoneSvgLayer {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 2;
        pointer-events: auto;
      }
      .zone-polygon {
        cursor: pointer;
      }
      /* 구역 내의 실제 도형 요소(polygon, path, rect, circle)에만 스타일 적용 */
      .zone-polygon:not(g),
      .zone-polygon > polygon,
      .zone-polygon > path,
      .zone-polygon > rect,
      .zone-polygon > circle {
        fill: rgba(59, 130, 246, 0.15);
        stroke: #3b82f6;
        stroke-width: 2;
        transition: all 0.25s ease;
      }
      .zone-polygon:not(g):hover,
      .zone-polygon:hover > polygon,
      .zone-polygon:hover > path,
      .zone-polygon:hover > rect,
      .zone-polygon:hover > circle {
        fill: rgba(59, 130, 246, 0.35);
        stroke-width: 3;
      }
      
      /* seats가 있는 경우 */
      .zone-polygon.zone-has-seats:not(g),
      .zone-polygon.zone-has-seats > polygon,
      .zone-polygon.zone-has-seats > path,
      .zone-polygon.zone-has-seats > rect,
      .zone-polygon.zone-has-seats > circle {
        stroke: #10b981 !important;
        fill: rgba(16, 185, 129, 0.15) !important;
      }
      .zone-polygon.zone-has-seats:not(g):hover,
      .zone-polygon.zone-has-seats:hover > polygon,
      .zone-polygon.zone-has-seats:hover > path,
      .zone-polygon.zone-has-seats:hover > rect,
      .zone-polygon.zone-has-seats:hover > circle {
        fill: rgba(16, 185, 129, 0.3) !important;
      }

      /* 좌석 미설정 구역 */
      .zone-polygon.zone-no-seats:not(g),
      .zone-polygon.zone-no-seats > polygon,
      .zone-polygon.zone-no-seats > path,
      .zone-polygon.zone-no-seats > rect,
      .zone-polygon.zone-no-seats > circle {
        stroke: #6b7280 !important;
        stroke-dasharray: 4 4;
        fill: rgba(107, 114, 128, 0.1) !important;
        opacity: 0.6;
      }

      /* 비활성화 구역 */
      .zone-polygon.zone-disabled:not(g),
      .zone-polygon.zone-disabled > polygon,
      .zone-polygon.zone-disabled > path,
      .zone-polygon.zone-disabled > rect,
      .zone-polygon.zone-disabled > circle {
        fill: rgba(239, 68, 68, 0.1) !important;
        stroke: #ef4444 !important;
        cursor: not-allowed;
      }

      /* active 상태 */
      .zone-polygon.active:not(g),
      .zone-polygon.active > polygon,
      .zone-polygon.active > path,
      .zone-polygon.active > rect,
      .zone-polygon.active > circle {
        fill: rgba(251, 191, 36, 0.2) !important;
        stroke: #fbbf24 !important;
      }

      /* 내부에 포함된 텍스트 및 라벨 패스는 스타일 상속에서 제외하여 원래 폰트/디자인 유지 */
      .zone-polygon text,
      .zone-polygon text path,
      .zone-polygon [class*="text"] path,
      .zone-polygon [id*="text"] path,
      .zone-polygon [id*="label"] path {
        fill: inherit !important;
        stroke: none !important;
        stroke-width: 0 !important;
      }
      .grid-wrapper {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 10;
        display: none;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
        box-sizing: border-box;
        padding: 24px;
        overflow-y: auto;
        background: rgba(15, 23, 42, 0.95);
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
      }
      .grid-wrapper.active {
        display: flex !important;
        opacity: 1;
        pointer-events: auto;
      }
      .stage-guide-bar {
        width: 100%;
        max-width: 400px;
        text-align: center;
        padding: 8px;
        background: #1e293b;
        color: #fff;
        font-weight: bold;
        border-radius: 6px;
        font-size: 13px;
        letter-spacing: 2px;
        margin-bottom: 24px;
        border: 1px solid #334155;
      }
      .btn-zoom-out {
        background: #334155;
        color: #fff;
        border: 1px solid #475569;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn-zoom-out:hover {
        background: #475569;
      }
      .zone-list-panel {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .zone-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        color: #fff;
      }
      .zone-list-item:hover {
        background: #334155;
        border-color: #475569;
      }
      .zone-list-item.active {
        background: rgba(16, 185, 129, 0.15);
        border-color: #10b981;
      }
      .zone-list-item.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      /* Legend UI */
      .legend-container {
        display: flex;
        gap: 16px;
        font-size: 12px;
        padding: 8px 16px;
        flex-shrink: 0;
        color: var(--text-muted);
      }
      .legend-box {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 3px;
        margin-right: 5px;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(styleEl);
  }

  container.innerHTML = `
    <div style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 14px;">
      <div class="animate-pulse">🗺️ 좌석 배치도 및 구역 설정 로드 중...</div>
    </div>
  `;

  // 좌석 및 구역 데이터 로드
  let allSeats = [];
  let zones = [];
  try {
    const seatsUrl = festivalId
      ? `/api/order/seats?festivalId=${festivalId}`
      : '/api/order/seats?zones=A,B,C';
    const seatsRes = await fetch(seatsUrl);
    if (seatsRes.ok) {
      allSeats = await seatsRes.json();
    }

    if (festivalId) {
      const zonesRes = await fetch(`/api/festival/${festivalId}/zones`);
      if (zonesRes.ok) {
        zones = await zonesRes.json();
      }
    }
  } catch (e) {
    console.error('[seats-init] 데이터 로드 실패', e);
  }

  if (allSeats.length === 0) {
    container.innerHTML = `
      <div class="panel-rigid" style="margin: 20px; text-align: center; padding: 60px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">🪑</div>
        <div style="font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 8px;">등록된 좌석이 없습니다</div>
        <div style="font-size: 13px; color: var(--text-muted);">관리자 페이지에서 해당 행사의 구역과 좌석을 먼저 설정해 주세요.</div>
      </div>
    `;
    return;
  }

  // DB.seats 재구성
  DB.seats = {};
  allSeats.forEach(s => {
    DB.seats[s.id] = {
      status: s.isEntered ? 'ENTERED' : (s.isReserved ? 'RESERVED' : 'AVAILABLE'),
      holder: s.isReserved ? (s.holderName || '예약됨') : null,
      seatRow: s.seatRow,
      number: s.number,
      zone: s.zone,
      price: s.price
    };
  });

  // 통계 계산
  const total = allSeats.length;
  const reserved = allSeats.filter(s => s.isReserved || s.isEntered).length;
  const entered = allSeats.filter(s => s.isEntered).length;
  const available = total - reserved;
  const reservedPct = total > 0 ? Math.round((reserved / total) * 100) : 0;

  // 선택된 좌석 목록
  const selectedSeats = [];

  // Main UI 렌더링
  container.innerHTML = `
    <div style="padding: 16px; display: flex; flex-direction: column; gap: 16px; height: 100%; box-sizing: border-box;">

      <!-- 헤더: 행사 이름 + 통계 -->
      <div class="panel-rigid" style="flex-shrink: 0;">
        <div class="panel-body-rigid" style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 16px; font-weight: bold; color: #fff;">🎪 ${festivalName}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">좌석 배치도 — 실시간 현황</div>
          </div>
          <div style="display: flex; gap: 12px; font-size: 13px; font-family: var(--font-mono);">
            <span style="color: #10b981;">● 잔여 ${available}석</span>
            <span style="color: #60a5fa;">● 예약 ${reserved}석</span>
            <span style="color: #f59e0b;">● 입장 ${entered}명</span>
            <span style="color: var(--text-muted);">총 ${total}석 · ${reservedPct}% 예약</span>
          </div>
        </div>
      </div>

      <!-- 메인 2열 레이아웃 -->
      <div style="flex: 1; display: flex; gap: 16px; min-height: 0;">
        
        <!-- 왼쪽: SVG 좌석 배치도 및 좌석 격자판 -->
        <div class="panel-rigid" style="flex: 7; display: flex; flex-direction: column; overflow: hidden; position: relative;">
          <div class="panel-header-rigid" style="display: flex; justify-content: space-between; align-items: center;">
            <span>🗺️ 배치도 시각화 및 좌석 탐색</span>
            <button id="btn-zoom-out" class="btn-zoom-out" style="display: none;">◀ 전체 구역 보기</button>
          </div>
          <div class="panel-body-rigid" style="flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 20px; background: #0f172a; position: relative;">
            <div class="grid-editor-container-viewport">
              <div class="grid-editor-container" id="gridEditorContainer">
                <div class="grid-bg-overlay" id="gridBgOverlay"></div>
                <svg id="zoneSvgLayer" viewBox="0 0 1000 1000">
                  <image id="svgBgImage" x="0" y="0" width="1000" height="1000" preserveAspectRatio="none" />
                  <g id="dynamicZonesLayer"></g>
                </svg>
                <div class="grid-wrapper" id="gridWrapper">
                  <div class="stage-guide-bar">[ STAGE ]</div>
                  <div id="seatsGrid" style="display: flex; flex-direction: column; gap: 6px; align-items: center; width: 100%;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 오른쪽: 구역 목록 사이드바 -->
        <div class="panel-rigid" style="flex: 3; display: flex; flex-direction: column; overflow: hidden;">
          <div class="panel-header-rigid">📋 구역 목록</div>
          <div class="panel-body-rigid" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px;">
            <div id="zone-list-container" class="zone-list-panel">
              <!-- 구역 목록 동적 생성 -->
            </div>
          </div>
        </div>

      </div>

      <!-- 범례 -->
      <div class="legend-container">
        <span><span class="legend-box" style="background:#10b981;"></span>예약 가능</span>
        <span><span class="legend-box" style="background:#3b82f6;"></span>예약 완료</span>
        <span><span class="legend-box" style="background:#f59e0b;"></span>입장 완료</span>
        <span><span class="legend-box" style="background:#fbbf24; border:2px solid #10b981;"></span>선택됨</span>
      </div>

      <!-- 선택 좌석 + 결제 바 -->
      <div id="selected-bar" style="flex-shrink: 0; display: none; background: rgba(16,185,129,0.08); border: 1px solid #10b981; border-radius: 8px; padding: 14px 18px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">선택된 좌석</div>
            <div id="selected-seats-summary" style="font-size: 15px; font-weight: bold; color: #fff;"></div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted);">합산 금액</div>
              <div id="selected-total-price" style="font-size: 22px; font-weight: bold; color: #10b981; font-family: var(--font-mono);">0원</div>
            </div>
            <button id="btn-seat-pay" class="btn btn-rigid btn-green" style="padding: 10px 24px; font-size: 15px; font-weight: bold;">
              결제하기
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // DOM elements 바인딩
  const gridBgOverlay = document.getElementById('gridBgOverlay');
  const zoneSvgLayer = document.getElementById('zoneSvgLayer');
  const svgBgImage = document.getElementById('svgBgImage');
  const dynamicZonesLayer = document.getElementById('dynamicZonesLayer');
  const gridWrapper = document.getElementById('gridWrapper');
  const seatsGrid = document.getElementById('seatsGrid');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const zoneListContainer = document.getElementById('zone-list-container');

  // SVG 배경 및 구역 로드
  const zoneWithBg = zones.find(z => z.mapBgUrl);
  if (zoneWithBg && zoneWithBg.mapBgUrl) {
    await setBgImage(zoneWithBg.mapBgUrl, zoneSvgLayer, svgBgImage);
  }

  // 구역 그리기 및 이벤트 바인딩
  const svgRoot = zoneSvgLayer.querySelector('.inline-imported-svg');
  
  zones.forEach(zone => {
    let bound = false;

    // 1. 인라인 SVG가 있고 해당 구역 ID에 매핑된 엘리먼트가 존재할 경우
    if (svgRoot && zone.svgPoints) {
      const elementId = zone.svgPoints.replace('#', '');
      const targetEl = svgRoot.getElementById(elementId) || svgRoot.querySelector(`[id="${elementId}"]`);
      if (targetEl) {
        targetEl.classList.add('zone-polygon');
        targetEl.style.cursor = 'pointer';

        const hasSeats = allSeats.some(s => s.zone === zone.zoneName);
        targetEl.classList.add(hasSeats ? 'zone-has-seats' : 'zone-no-seats');

        const title = targetEl.querySelector('title') || document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${zone.zoneName} (정원: ${zone.safetyLimit}명)`;
        if (!targetEl.querySelector('title')) {
          targetEl.appendChild(title);
        }

        if (zone.status === 'DISABLED') {
          targetEl.classList.add('zone-disabled');
        } else {
          targetEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectZone(zone);
          });
        }
        bound = true;
      }
    }

    // 2. 매핑되지 않았거나 커스텀 다각형 좌표 형태인 경우 직접 그리기
    if (!bound && zone.svgPoints && (zone.svgPoints.includes(' ') || zone.svgPoints.includes(','))) {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', zone.svgPoints);
      poly.classList.add('zone-polygon');
      poly.style.cursor = 'pointer';

      const hasSeats = allSeats.some(s => s.zone === zone.zoneName);
      poly.classList.add(hasSeats ? 'zone-has-seats' : 'zone-no-seats');

      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${zone.zoneName} (정원: ${zone.safetyLimit}명)`;
      poly.appendChild(title);

      if (zone.status === 'DISABLED') {
        poly.classList.add('zone-disabled');
      } else {
        poly.addEventListener('click', (e) => {
          e.stopPropagation();
          selectZone(zone);
        });
      }

      dynamicZonesLayer.appendChild(poly);
    }

    // 3. 구역 목록 사이드바 아이템 생성
    const hasSeats = allSeats.some(s => s.zone === zone.zoneName);
    const zoneSeats = allSeats.filter(s => s.zone === zone.zoneName);
    const availCount = zoneSeats.filter(s => !s.isReserved && !s.isEntered).length;

    const statusText = zone.status === 'DISABLED' ? '비활성화' : (hasSeats ? `예약가능 ${availCount}/${zoneSeats.length}석` : '좌석 미설정');
    const statusColor = zone.status === 'DISABLED' ? '#ef4444' : (hasSeats ? '#ffffff' : 'var(--text-muted)');
    const statusWeight = hasSeats ? '700' : 'normal';

    const item = document.createElement('div');
    item.className = `zone-list-item ${zone.status === 'DISABLED' ? 'disabled' : ''}`;
    item.dataset.zoneId = zone.id;
    item.innerHTML = `
      <span>🏟️ ${zone.zoneName}</span>
      <span style="font-size: 11px; color: ${statusColor}; font-weight: ${statusWeight};">
        ${statusText}
      </span>
    `;

    if (zone.status !== 'DISABLED') {
      item.addEventListener('click', () => {
        selectZone(zone);
      });
    }

    zoneListContainer.appendChild(item);
  });

  // 구역 선택 핸들러
  function selectZone(zone) {
    // 사이드바 하이라이트
    document.querySelectorAll('.zone-list-item').forEach(el => {
      if (el.dataset.zoneId == zone.id) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // SVG 폴리곤 하이라이트
    if (svgRoot) {
      svgRoot.querySelectorAll('.zone-polygon').forEach(el => {
        const elementId = zone.svgPoints.replace('#', '');
        if (el.getAttribute('id') === elementId) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }

    // dynamicZonesLayer 폴리곤 하이라이트
    dynamicZonesLayer.querySelectorAll('.zone-polygon').forEach(el => {
      if (el.getAttribute('points') === zone.svgPoints) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // 좌석 격자 렌더링
    const zoneSeats = allSeats.filter(s => s.zone === zone.zoneName);

    if (zoneSeats.length === 0) {
      seatsGrid.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">🪑</div>
          <div>이 구역에 등록된 좌석이 없습니다.</div>
        </div>
      `;
    } else {
      // 행(row) 그룹핑
      const rowMap = {};
      zoneSeats.forEach(s => {
        const row = s.seatRow || 'R1';
        if (!rowMap[row]) rowMap[row] = [];
        rowMap[row].push(s);
      });
      const rows = Object.keys(rowMap).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      seatsGrid.innerHTML = rows.map(row => {
        const rowSeats = rowMap[row].sort((a, b) => parseInt(a.number) - parseInt(b.number));
        return `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; width: 100%; justify-content: center;">
            <span style="font-size: 11px; color: var(--text-muted); min-width: 28px; text-align: right; font-family: var(--font-mono); margin-right: 8px;">${row}</span>
            <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
              ${rowSeats.map(s => buildSeatEl(s)).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    gridWrapper.classList.add('active');
    btnZoomOut.style.display = 'block';
  }

  // 줌아웃 (전체 구역 뷰 복귀)
  btnZoomOut.addEventListener('click', () => {
    gridWrapper.classList.remove('active');
    btnZoomOut.style.display = 'none';
    
    // 선택 효과 해제
    document.querySelectorAll('.zone-list-item').forEach(el => el.classList.remove('active'));
    if (svgRoot) {
      svgRoot.querySelectorAll('.zone-polygon').forEach(el => el.classList.remove('active'));
    }
    dynamicZonesLayer.querySelectorAll('.zone-polygon').forEach(el => el.classList.remove('active'));
  });

  // 개별 좌석 요소 HTML
  function buildSeatEl(s) {
    let bg = '#10b981';   // AVAILABLE - 초록
    let cursor = 'pointer';
    let title = `${s.zone} ${s.seatRow}-${s.number} | 예약 가능`;

    const isSelected = selectedSeats.includes(s.id);

    if (s.isEntered) {
      bg = '#f59e0b';     // ENTERED - 주황
      cursor = 'not-allowed';
      title = `${s.zone} ${s.seatRow}-${s.number} | 입장 완료`;
    } else if (s.isReserved) {
      bg = '#3b82f6';     // RESERVED - 파랑
      cursor = 'not-allowed';
      title = `${s.zone} ${s.seatRow}-${s.number} | 예약됨`;
    } else if (isSelected) {
      bg = '#fbbf24';     // SELECTED - 노랑/금
      title = `${s.zone} ${s.seatRow}-${s.number} | 선택됨`;
    }

    const price = s.price ? `${Number(s.price).toLocaleString()}원` : '';

    return `
      <div
        data-seat-id="${s.id}"
        data-price="${s.price || 0}"
        title="${title} ${price}"
        style="
          width: 32px; height: 32px;
          background: ${bg};
          border: ${isSelected ? '2px solid #10b981' : '2px solid transparent'};
          border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: bold; color: #000;
          cursor: ${cursor};
          transition: transform 0.1s, box-shadow 0.1s;
          user-select: none;
          box-sizing: border-box;
        "
        class="seat-element-item"
      >${s.number}</div>
    `;
  }

  // 좌석 클릭 이벤트 위임
  seatsGrid.addEventListener('click', e => {
    const seatEl = e.target.closest('[data-seat-id]');
    if (!seatEl) return;
    const seatId = seatEl.getAttribute('data-seat-id');
    const seatData = DB.seats[seatId];
    if (!seatData || seatData.status !== 'AVAILABLE') return;

    const idx = selectedSeats.indexOf(seatId);
    if (idx === -1) {
      selectedSeats.push(seatId);
      seatEl.style.background = '#fbbf24';
      seatEl.style.borderColor = '#10b981';
    } else {
      selectedSeats.splice(idx, 1);
      seatEl.style.background = '#10b981';
      seatEl.style.borderColor = 'transparent';
    }
    updateSelectedBar(selectedSeats, allSeats);
  });

  // 결제 버튼
  document.getElementById('btn-seat-pay')?.addEventListener('click', () => {
    handleSeatPayment(selectedSeats, allSeats, festivalId, festivalName);
  });
}

// 배경 이미지 설정 헬퍼 함수
async function setBgImage(url, zoneSvgLayer, svgBgImage) {
  zoneSvgLayer.querySelectorAll('.inline-imported-svg').forEach(el => el.remove());

  if (url && url !== 'none') {
    if (url.toLowerCase().includes('.svg')) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('SVG 도면을 불러올 수 없습니다.');
        const svgText = await res.text();

        if (svgBgImage) {
          svgBgImage.removeAttribute('href');
          svgBgImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgRoot = doc.documentElement;
        svgRoot.classList.add('inline-imported-svg');
        svgRoot.setAttribute('width', '100%');
        svgRoot.setAttribute('height', '100%');
        svgRoot.setAttribute('preserveAspectRatio', 'none');
        svgRoot.setAttribute('style', 'position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: auto;');

        // SVG 내부에 임베디드된 인라인 onclick 속성 제거 (ReferenceError: selectZone is not defined 방지)
        svgRoot.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));

        zoneSvgLayer.appendChild(svgRoot);
        return svgRoot;
      } catch (err) {
        console.error('SVG 배경 인라인 로드 실패, 폴백 이미지로 전환:', err);
        loadBgAsImageElement(url, svgBgImage);
      }
    } else {
      loadBgAsImageElement(url, svgBgImage);
    }
  } else {
    if (svgBgImage) {
      svgBgImage.removeAttribute('href');
      svgBgImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
    }
  }
  return null;
}

function loadBgAsImageElement(url, svgBgImage) {
  if (svgBgImage) {
    svgBgImage.setAttribute('href', url);
    svgBgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
  }
}

/** 선택 바 업데이트 */
function updateSelectedBar(selectedSeats, allSeats) {
  const bar = document.getElementById('selected-bar');
  const summary = document.getElementById('selected-seats-summary');
  const totalPriceEl = document.getElementById('selected-total-price');

  if (!bar || !summary || !totalPriceEl) return;

  if (selectedSeats.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'block';

  const selectedData = allSeats.filter(s => selectedSeats.includes(s.id));
  const totalPrice = selectedData.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const seatLabels = selectedData.map(s => `${s.zone} ${s.seatRow}-${s.number}`).join(', ');

  summary.textContent = `${selectedSeats.length}석 선택됨: ${seatLabels}`;
  totalPriceEl.textContent = `${totalPrice.toLocaleString()}원`;
}

/** 좌석 결제 처리 */
async function handleSeatPayment(selectedSeats, allSeats, festivalId, festivalName) {
  if (selectedSeats.length === 0) {
    alert('최소 1개 이상의 좌석을 선택해 주세요.');
    return;
  }

  const selectedData = allSeats.filter(s => selectedSeats.includes(s.id));
  const totalPrice = selectedData.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const seatLabels = selectedData.map(s => `${s.zone} ${s.seatRow}-${s.number}`).join(', ');

  if (typeof IMP === 'undefined') {
    alert('PortOne 결제 라이브러리가 로드되지 않았습니다.');
    return;
  }

  const staffUser = JSON.parse(sessionStorage.getItem('STAFF_CURRENT_USER') || '{}');

  IMP.init('imp81384776');
  IMP.request_pay({
    pg: 'html5_inicis',
    pay_method: 'card',
    merchant_uid: 'merchant_' + Date.now(),
    name: `${festivalName} - 좌석 [${seatLabels}]`,
    amount: totalPrice,
    buyer_email: staffUser.id || 'staff@festio.com',
    buyer_name: staffUser.name || '현장구매자'
  }, async (rsp) => {
    if (!rsp.success) {
      alert('결제 실패: ' + rsp.error_msg);
      return;
    }

    try {
      const token = sessionStorage.getItem('festio_staff_token') || 
                    sessionStorage.getItem('userToken') || 
                    localStorage.getItem('userToken') || 
                    '';
      const res = await fetch('/api/order/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalPrice,
          seats: selectedData.map(s => s.id),
          seatIds: selectedData.map(s => s.id),
          eventNo: festivalId,
          userToken: token
        })
      });

      const data = await res.json();
      if (res.ok && (data.status === 'success' || data.id)) {
        // QR 영수증 출력
        const orderId = data.orderId || data.id;
        const ticketNum = data.ticketNumber || `O${String(orderId).padStart(11, '0')}`;
        const secret = data.qrPayload ? data.qrPayload.replace('SECRET:', '') : orderId;
        const ticketUrl = `${location.origin}/features/user/ticket/view.html?orderId=${orderId}&secret=${secret}`;
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticketUrl)}`;

        const pw = window.open('', '_blank', 'width=400,height=650');
        pw.document.write(`
          <html><head><title>영수증</title>
          <style>body{font-family:'Malgun Gothic',monospace;width:300px;margin:0 auto;padding:20px;text-align:center;background:#fff;color:#000;}
          .divider{border-bottom:1px dashed #000;margin:12px 0;}.title{font-size:20px;font-weight:bold;}</style></head>
          <body>
            <div class="title">FESTIO 영수증 티켓</div>
            <div>[현장결제 완료]</div>
            <div class="divider"></div>
            <div style="text-align:left;font-size:13px;line-height:1.7;">
              <b>주문번호:</b> ORD-${orderId}<br>
              <b>티켓번호:</b> ${ticketNum}<br>
              <b>좌석정보:</b> ${seatLabels}<br>
              <b>결제금액:</b> ${totalPrice.toLocaleString()}원
            </div>
            <div class="divider"></div>
            <img src="${qrSrc}" width="160" height="160" onload="window.print();" />
            <div style="font-size:12px;margin-top:10px;">QR코드를 스캔하면 모바일 티켓이 열립니다.</div>
          </body></html>
        `);
        pw.document.close();

        alert(`✅ 결제 완료!\n좌석: ${seatLabels}\n주문번호: ORD-${orderId}`);
        location.reload();
      } else {
        alert('주문 등록 실패: ' + (data.message || '오류가 발생했습니다.'));
      }
    } catch (err) {
      alert('서버 오류: ' + err.message);
    }
  });
}
