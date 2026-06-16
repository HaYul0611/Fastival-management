/**
 * Festival O2O Platform — detail.js
 * ─────────────────────────────────────────────────────────────
 * 상세/예매 화면:
 * - URL 파라미터에서 eventNo 읽기
 * - 행사 상세 정보 렌더링
 * - SVG 도면 구역 선택 & 잔여 수량 실시간 차감 반영
 * - Chart.js 예매자 성별/연령 통계 차트
 * - 대기열 시뮬레이션 (프로그레스 바 + 카운터)
 * - Toss Payments v1 Sandbox 결제 연동
 *   - clientKey: test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── 상태 ─────────────────────────────────────────────────── */
let _eventDetail = null;
let _selectedZoneNo = null;
let _quantity = 1;
let _appliedCoupon = null;
let _orderNo = null;
let _orderUid = null;
let _queueTimer = null;
let _queueCount = 0;
let _selectedPayMethod = 'card';
let _selectedSeats = [];
let _selectedZone = null;

/* ── Toss Payments 설정 ─────────────────────────────────────── */
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo';

/* ── URL 파라미터 ─────────────────────────────────────────────
   사용 예시: detail.html?eventNo=1
─────────────────────────────────────────────────────────── */
function getEventNo() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('eventNo')) || 1;
}

/* ═══════════════════════════════════════════════════════════
   행사 상세 렌더링
═══════════════════════════════════════════════════════════ */
function getCategoryBadgeClass(category) {
  switch (category) {
    case '콘서트': return 'badge-primary';
    case '뮤지컬': return 'badge-secondary';
    case '연극': return 'badge-success';
    case '클래식': return 'badge-info';
    case '전시': return 'badge-warning';
    default: return 'badge-dark';
  }
}

function renderEventDetail(detail) {
  const catBadgeClass = getCategoryBadgeClass(detail.category);

  // 제목
  const titleEl = $('.event-main-title');
  if (titleEl) titleEl.textContent = detail.eventName;

  // 카테고리 배지
  const catRow = $('.event-category-row');
  if (catRow) {
    catRow.innerHTML = `
      <span class="badge ${catBadgeClass}">${detail.category}</span>
      ${detail.badgeLabel ? `<span class="badge ${detail.badgeLabel === 'HOT' ? 'badge-hot' : 'badge-sale'}">${detail.badgeLabel}</span>` : ''}`;
  }

  // 메타 정보 (날짜, 시간, 장소)
  const metaDate = $('.event-meta-date');
  const metaTime = $('.event-meta-time');
  const metaVenue = $('.event-meta-venue');
  if (metaDate) metaDate.textContent = formatDate(detail.eventDate, true);
  if (metaTime) metaTime.textContent = `${detail.startTime} ~ ${detail.endTime}`;
  if (metaVenue) metaVenue.textContent = detail.venue;

  // 페이지 타이틀
  document.title = `${detail.eventName} | Festival O2O`;

  // 포스터 이미지 동기화
  const posterWrap = document.getElementById('detailPosterWrap');
  if (posterWrap) {
    // mapImageUrl 제거, 오직 썸네일(포스터)만 사용
    const posterUrl = detail.thumbnailUrl || detail.thumbnail_url;
    if (posterUrl) {
      posterWrap.innerHTML = `<img src="${posterUrl}" alt="${detail.eventName} 포스터" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-lg);">`;
      posterWrap.style.background = 'none';
    }
  }

  // 좌석 배치도 동기화 (구역 선택 영역 배경 이미지 제거)
  /*
  const mapUrl = detail.mapImageUrl || detail.map_image_url;
  if (mapUrl) {
    const bgOverlay = document.getElementById('venueBgOverlay');
    if (bgOverlay) {
      bgOverlay.style.backgroundImage = `url('${mapUrl}')`;
    }
  }
  */
}

function getFigmaTemplateSelector(zoneName) {
  if (!zoneName) return null;
  const name = zoneName.toLowerCase().replace(/\s+/g, '');
  if (name.includes('vip')) return 'vip';
  if (name.includes('f1')) return 'f1';
  if (name.includes('f2')) return 'f2';
  if (name.includes('f3')) return 'f3';
  if (name.includes('스탠딩')) return 'standing';
  if (name.includes('a존(좌)') || name.includes('a존좌') || name.includes('aleft')) return 'a-left';
  if (name.includes('a존(우)') || name.includes('a존우') || name.includes('aright')) return 'a-right';
  if (name.includes('f4(좌)') || name.includes('f4좌') || name.includes('f4left')) return 'f4-left';
  if (name.includes('f4(우)') || name.includes('f4우') || name.includes('f4right')) return 'f4-right';
  return null;
}

/* ═══════════════════════════════════════════════════════════
   SVG 도면 구역 선택
   — DCC (대전컨벤션센터) 스타일 벡터 플로어맵
═══════════════════════════════════════════════════════════ */
function initVenueMap(zones) {
  const svg = document.getElementById('venueSvgLayer');
  const bgOverlay = document.getElementById('venueBgOverlay');
  const legendContainer = document.getElementById('zoneLegendContainer');

  if (!svg || !zones || !Array.isArray(zones)) return;

  // 1. 기존 SVG 내용물 클리어
  svg.innerHTML = '';

  // 2. 동적 배경 도면 주입 (관리자가 저장한 배경 도면이 있을 때 SVG <image> 추가)
  const zoneWithBg = zones.find(z => z.mapBgUrl);
  if (zoneWithBg && zoneWithBg.mapBgUrl) {
    const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    bgImage.setAttribute('id', 'svgBgImage');
    bgImage.setAttribute('x', '0');
    bgImage.setAttribute('y', '0');
    bgImage.setAttribute('width', '800');
    bgImage.setAttribute('height', '660');
    bgImage.setAttribute('preserveAspectRatio', 'none');
    bgImage.setAttribute('style', 'opacity: 0.85; pointer-events: none;');
    bgImage.setAttribute('href', zoneWithBg.mapBgUrl);
    bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', zoneWithBg.mapBgUrl);
    svg.appendChild(bgImage);
  }

  // 3. 관리자가 지정한 구역 다각형(polygon)을 100% 동적 렌더링
  zones.forEach(zone => {
    if (!zone.svgPoints) return;

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', zone.svgPoints);
    polygon.setAttribute('class', 'zone-polygon');
    polygon.setAttribute('data-zone-no', zone.zoneNo);

    // 마우스 호버 시 툴팁 추가
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${zone.zoneName} (잔여: ${zone.remainingCapacity}석 / 총: ${zone.totalCapacity}석)`;
    polygon.appendChild(title);

    // 매진 시 비활성화 스타일 처리
    if (zone.remainingCapacity === 0) {
      polygon.classList.add('sold-out');
      polygon.setAttribute('aria-disabled', 'true');
    } else {
      polygon.addEventListener('click', () => selectZone(zone.zoneNo, zone, polygon));
    }

    svg.appendChild(polygon);
  });

  // 3. 범례 목록 동적 생성
  if (legendContainer) {
    legendContainer.innerHTML = '';
    zones.forEach(zone => {
      const isSoldOut = zone.remainingCapacity === 0;
      const dotClass = zone.zoneType === 'VIP' ? 'zone-vip' : zone.zoneName.includes('A') ? 'zone-a' : zone.zoneName.includes('B') ? 'zone-b' : 'standing';

      const legendItem = document.createElement('div');
      legendItem.className = `zone-legend-item ${dotClass} ${isSoldOut ? 'sold-out' : ''}`;
      legendItem.dataset.zoneNo = zone.zoneNo;
      legendItem.setAttribute('role', 'button');
      legendItem.setAttribute('tabindex', '0');
      
      // 가격 포맷
      const priceText = formatKRW(zone.price);

      legendItem.innerHTML = `
        <div class="zone-dot ${dotClass}"></div>
        <div class="flex-1">
          <p class="zone-legend-name" style="margin:0; font-weight:600; color:var(--text-main);">${zone.zoneName}</p>
          <p class="zone-legend-rem" style="margin:2px 0 0; font-size:0.8rem; color:var(--text-muted);">${isSoldOut ? '매진' : `잔여 ${zone.remainingCapacity}석`}</p>
        </div>
        <span class="zone-legend-price" style="font-weight:700; color:var(--color-primary);">${priceText}</span>
      `;

      if (!isSoldOut) {
        legendItem.addEventListener('click', () => {
          let targetEl = svg.querySelector(`.figma-template-zone[data-zone-no="${zone.zoneNo}"]`);
          if (!targetEl) {
            targetEl = svg.querySelector(`.zone-polygon[data-zone-no="${zone.zoneNo}"]`);
          }
          if (targetEl) selectZone(zone.zoneNo, zone, targetEl);
        });
      }

      legendContainer.appendChild(legendItem);
    });
  }
}

function selectZone(zoneNo, zone, svgEl) {
  _selectedZoneNo = zoneNo;
  _selectedZone = zone;

  // SVG 선택 강조
  $$('.zone-polygon').forEach(el => el.classList.remove('selected'));
  $$('.figma-template-zone').forEach(el => el.classList.remove('selected'));
  if (svgEl) svgEl.classList.add('selected');

  // 범례 선택 강조
  $$('.zone-legend-item').forEach(li => li.classList.remove('active'));
  const legendItem = $(`.zone-legend-item[data-zone-no="${zoneNo}"]`);
  if (legendItem) legendItem.classList.add('active');

  // 구역 정보 패널 업데이트
  updateZoneInfoPanel(zone);

  // 수량 초기화 & 좌석 선택 모달 오픈
  _quantity = 1;
  _selectedSeats = [];
  updateQtyDisplay();
  updateCtaBar(zone);
  openSeatSelectionModal(zoneNo, zone);
}

function updateQtyDisplay() {
  const el = $('.qty-value');
  if (el) el.textContent = _quantity;
}

function updateZoneInfoPanel(zone) {
  const panel = $('.zone-info-panel');
  if (!panel) return;
  panel.classList.add('visible');

  const name = panel.querySelector('.zone-info-name');
  const soldRem = panel.querySelector('.zone-info-stat-value.remaining');
  const priceEl = panel.querySelector('.zone-info-stat-value.price');
  const capBar = panel.querySelector('.capacity-bar-fill');

  if (name) name.textContent = zone.zoneName;
  if (soldRem) soldRem.textContent = `${zone.remainingCapacity}석`;
  if (priceEl) priceEl.textContent = formatKRW(zone.price);

  if (capBar) {
    const pct = Math.round(zone.remainingCapacity / zone.totalCapacity * 100);
    capBar.style.width = `${pct}%`;
    capBar.className = `capacity-bar-fill ${zone.zoneType === 'VIP' ? 'zone-vip' : zone.zoneName.includes('A') ? 'zone-a' : zone.zoneName.includes('B') ? 'zone-b' : 'standing'}`;
  }
}

function updateCtaBar(zone) {
  if (!zone) return;

  // 구역명 업데이트
  const zoneNameEl = document.getElementById('ctaZoneName');
  if (zoneNameEl) zoneNameEl.textContent = zone.zoneName;

  // 선택한 좌석 목록 렌더링
  const seatsList = document.getElementById('selectedSeatsList');
  const countBadge = document.getElementById('selectedCountBadge');

  if (seatsList) {
    if (_selectedSeats.length === 0) {
      seatsList.innerHTML = '<li class="seats-placeholder">좌석을 선택해 주세요.</li>';
    } else {
      seatsList.innerHTML = _selectedSeats.map(s => {
        const rowClean = (s.seatRow || '').replace(/열$/, '');
        const priceText = typeof formatKRW === 'function' ? formatKRW(s.price) : `${(s.price||0).toLocaleString()}원`;
        return `<li class="seat-list-item">
          <span class="seat-list-label">${rowClean}열 ${s.seatNumber}번</span>
          <span class="seat-list-price">${priceText}</span>
        </li>`;
      }).join('');
    }
  }

  if (countBadge) countBadge.textContent = `${_selectedSeats.length}석`;

  // 총액 계산 및 업데이트
  const gross = _selectedSeats.length > 0
    ? _selectedSeats.reduce((sum, s) => sum + s.price, 0)
    : zone.price * _quantity;
  const discount = _appliedCoupon ? _appliedCoupon.discountAmount : 0;
  const net = gross - discount;

  const totalEl = document.getElementById('ctaTotal');
  if (totalEl) totalEl.textContent = formatKRW(net);
}

/* ═══════════════════════════════════════════════════════════
   사용자 좌석 선택 모달 및 인터랙션 제어
   ═══════════════════════════════════════════════════════════ */
function openSeatSelectionModal(zoneNo, zone) {
  const modalTitle = document.getElementById('seat-modal-title');
  if (modalTitle) modalTitle.textContent = `${zone.zoneName} 좌석 선택`;

  const container = document.getElementById('user-seat-container');
  const wrapper = document.getElementById('userGridWrapper');
  const loading = document.getElementById('user-seat-loading');
  const seatArea = document.getElementById('userGridSeatArea');
  const bgOverlay = document.getElementById('userGridBgOverlay');
  const confirmBtn = document.getElementById('btn-confirm-seats');

  console.log('[SeatModal] Opening modal for zone:', zoneNo, zone);

  // 0. 동적 등급 데이터 및 범례 동적 구성
  const userSeatGrades = JSON.parse(localStorage.getItem('adminSeatGrades')) || [
    { name: '일반석', price: 50000, class: 'seat-available' },
    { name: 'VIP석', price: 150000, class: 'seat-vip' },
    { name: 'R석', price: 120000, class: 'seat-r' },
    { name: 'S석', price: 90000, class: 'seat-s' }
  ];

  const colorMap = {
    'seat-vip': { bg: 'rgba(255, 171, 0, 0.2)', border: 'rgba(255, 171, 0, 0.6)' },
    'seat-r': { bg: 'rgba(105, 108, 255, 0.2)', border: 'rgba(105, 108, 255, 0.6)' },
    'seat-s': { bg: 'rgba(3, 195, 236, 0.2)', border: 'rgba(3, 195, 236, 0.6)' },
    'seat-available': { bg: 'rgba(133, 146, 163, 0.08)', border: 'rgba(133, 146, 163, 0.4)' },
    'seat-custom-1': { bg: 'rgba(113, 221, 55, 0.2)', border: 'rgba(113, 221, 55, 0.6)' },
    'seat-custom-2': { bg: 'rgba(255, 62, 29, 0.2)', border: 'rgba(255, 62, 29, 0.6)' },
    'seat-custom-3': { bg: 'rgba(130, 94, 251, 0.2)', border: 'rgba(130, 94, 251, 0.6)' },
    'seat-custom-4': { bg: 'rgba(233, 30, 99, 0.2)', border: 'rgba(233, 30, 99, 0.6)' },
    'seat-custom-5': { bg: 'rgba(0, 150, 136, 0.2)', border: 'rgba(0, 150, 136, 0.6)' }
  };

  const legendContainer = document.getElementById('userSeatLegendContainer');
  if (legendContainer) {
    legendContainer.innerHTML = '';
    
    // 등록된 각 등급에 맞는 범례 아이템 추가
    userSeatGrades.forEach(g => {
      const colors = colorMap[g.class] || colorMap['seat-available'];
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.gap = '5px';
      div.style.color = 'var(--text-secondary)';
      div.innerHTML = `<span style="width: 12px; height: 12px; border-radius: 3px; background: ${colors.bg}; border: 1px solid ${colors.border};"></span> ${g.name}`;
      legendContainer.appendChild(div);
    });

    // 고정 범례 추가: 선택됨 & 예매완료
    const selectDiv = document.createElement('div');
    selectDiv.style.display = 'flex';
    selectDiv.style.alignItems = 'center';
    selectDiv.style.gap = '5px';
    selectDiv.style.color = 'var(--text-secondary)';
    selectDiv.innerHTML = `<span style="width: 12px; height: 12px; border-radius: 3px; background: #FF9F43; border: 1px solid #FF8F13;"></span> 선택됨`;
    legendContainer.appendChild(selectDiv);

    const reservedDiv = document.createElement('div');
    reservedDiv.style.display = 'flex';
    reservedDiv.style.alignItems = 'center';
    reservedDiv.style.gap = '5px';
    reservedDiv.style.color = 'var(--text-secondary)';
    reservedDiv.innerHTML = `<span style="width: 12px; height: 12px; border-radius: 3px; background: rgba(75, 75, 90, 0.3); border: 1px solid rgba(75, 75, 90, 0.6);"></span> 예매완료`;
    legendContainer.appendChild(reservedDiv);
  }

  // 초기 상태 리셋
  wrapper.style.display = 'none';
  loading.style.display = 'block';
  seatArea.innerHTML = '';
  bgOverlay.style.backgroundImage = 'none';
  confirmBtn.disabled = true;
  _selectedSeats = [];
  updateSelectedSeatsSummary();

  // 모달 열기
  Modal.open('modal-select-seats');

  // 좌석 API 호출
  fetch(`/api/festival/seats?zoneId=${zoneNo}`)
    .then(res => {
      if (!res.ok) throw new Error('좌석 데이터를 불러오는데 실패했습니다.');
      return res.json();
    })
    .then(seats => {
      console.log('[SeatModal] Received seats data from API:', seats);
      loading.style.display = 'none';
      wrapper.style.display = 'block';

      if (!seats || seats.length === 0) {
        seatArea.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">등록된 좌석이 없습니다.</div>';
        return;
      }

      // 배경 이미지는 띄우지 않음 (디자인 정돈)
      bgOverlay.style.backgroundImage = 'none';

      // 격자 크기 산정 및 타입 안전 방어
      const rows = [...new Set(seats.map(s => s.seatRow || ''))]
        .filter(r => r)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      
      const maxCol = Math.max(...seats.map(s => parseInt(s.seatNumber, 10) || 1), 1);
      
      console.log('[SeatModal] Calculated layout - rows:', rows, 'maxCol:', maxCol);

      // 모달 그리드 레이아웃 동적 셋팅 (행 개수에 무대 가이드 행 +1 추가 - 32px 사각형 포맷)
      seatArea.style.gridTemplateRows = `repeat(${rows.length + 1}, 32px)`;
      seatArea.style.gridTemplateColumns = `repeat(${maxCol}, 32px)`;

      // [무대 (STAGE)] 가이드를 맨 위에 배치 (1번 행 전체 열 스팬)
      const stageGuide = document.createElement('div');
      stageGuide.className = 'stage-guide';
      stageGuide.style.gridColumn = `1 / span ${maxCol}`;
      stageGuide.style.gridRow = '1';
      stageGuide.innerText = 'STAGE (무대)';
      seatArea.appendChild(stageGuide);

      // 좌석 맵 빌드
      const seatMap = {};
      seats.forEach(s => {
        if (s.seatRow && s.seatNumber !== undefined) {
          seatMap[`${s.seatRow}_${s.seatNumber}`] = s;
        }
      });

      // 좌석 셀 생성 및 배치 (무대가 1번 행을 차지하므로, 실제 좌석은 2번 행부터 시작)
      rows.forEach((r, rIdx) => {
        const gridRowIdx = rIdx + 2;
        for (let c = 1; c <= maxCol; c++) {
          const seat = seatMap[`${r}_${c}`];
          const cell = document.createElement('div');
          cell.style.gridRow = gridRowIdx.toString();
          cell.style.gridColumn = c.toString();
          cell.className = 'seat-cell';

          if (seat) {
            cell.dataset.id = seat.id;
            cell.dataset.row = seat.seatRow;
            cell.dataset.number = seat.seatNumber;
            cell.dataset.price = seat.price;
            cell.dataset.grade = seat.status; // VIP, R, S, 등등

            // 마우스 호버 시 띄울 커스텀 툴팁 세팅 & 브라우저 네이티브 title 지정
            const isSold = seat.isReserved || seat.status === 'RESERVED' || seat.status === 'HOLD' || seat.status === '예매완료';
            const priceText = typeof formatKRW === 'function' ? formatKRW(seat.price) : `${(seat.price || 0).toLocaleString()}원`;
            const rowClean = (seat.seatRow || '').replace(/열$/, '');
            const tooltipValue = isSold 
              ? `${rowClean}열 ${seat.seatNumber}번 (예매완료)` 
              : `${rowClean}열 ${seat.seatNumber}번 (${priceText})`;
            
            cell.dataset.tooltip = tooltipValue;
            cell.title = tooltipValue; // overflow: auto 환경에서도 잘리지 않도록 브라우저 툴팁 지원

            // 라벨 표시 (사각형 내부에는 숫자만 노출)
            const labelSpan = document.createElement('span');
            labelSpan.innerText = seat.seatNumber;
            cell.appendChild(labelSpan);

            // 가격 표시
            const priceSpan = document.createElement('span');
            priceSpan.className = 'seat-price-tag';
            priceSpan.innerText = `${(seat.price || 0) / 1000}k`;
            cell.appendChild(priceSpan);

            // 상태 클래스 분기
            if (seat.isReserved || seat.status === 'RESERVED' || seat.status === 'HOLD' || seat.status === '예매완료') {
              cell.classList.add('seat-reserved');
              const reservedSpan = document.createElement('span');
              reservedSpan.className = 'seat-price-tag';
              reservedSpan.innerText = '예매완료';
              if (priceSpan.parentNode) {
                priceSpan.replaceWith(reservedSpan);
              }
            } else {
              // 1. 무대 및 통로 처리
              if (seat.status === 'STAGE' || seat.status === '무대') {
                cell.classList.add('seat-stage');
              } else if (seat.status === 'CORRIDOR' || seat.status === '통로') {
                cell.classList.add('seat-corridor');
              } else {
                // 2. 가격(price)에 기반한 동적 등급 매칭
                const matchedGrade = userSeatGrades.find(g => Number(g.price) === Number(seat.price));
                if (matchedGrade) {
                  cell.classList.add(matchedGrade.class);
                } else {
                  // 3. 레거시 문자열 기반 백업 매칭
                  if (seat.status === 'VIP' || seat.status === 'VIP석') cell.classList.add('seat-vip');
                  else if (seat.status === 'R' || seat.status === 'R석') cell.classList.add('seat-r');
                  else if (seat.status === 'S' || seat.status === 'S석') cell.classList.add('seat-s');
                  else cell.classList.add('seat-available');
                }
              }

              // 일반 좌석인 경우 클릭 리스너 바인딩 (무대, 통로 제외)
              if (seat.status !== 'STAGE' && seat.status !== '무대' && seat.status !== 'CORRIDOR' && seat.status !== '통로') {
                cell.addEventListener('click', () => toggleSeatSelection(cell, seat));
              }
            }
          } else {
            cell.classList.add('seat-corridor');
          }
          seatArea.appendChild(cell);
        }
      });
    })
    .catch(err => {
      console.error('[SeatModal] Error rendering seats modal:', err);
      loading.style.display = 'none';
      seatArea.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff4d4f; padding: 40px;">${err.message}</div>`;
    });
}

function toggleSeatSelection(cell, seat) {
  const index = _selectedSeats.findIndex(s => s.id === seat.id);
  if (index > -1) {
    // 선택 해제
    _selectedSeats.splice(index, 1);
    cell.classList.remove('selected');
  } else {
    // 선택
    if (_selectedSeats.length >= 4) {
      Toast.warning('최대 4석까지 선택 가능합니다.');
      return;
    }
    _selectedSeats.push(seat);
    cell.classList.add('selected');
  }

  updateSelectedSeatsSummary();

  // 우측 사이드바 실시간 동기화
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  if (zone) updateCtaBar(zone);
}

function updateSelectedSeatsSummary() {
  const displayEl = document.getElementById('selected-seats-display');
  const priceEl = document.getElementById('selected-seats-price');
  const confirmBtn = document.getElementById('btn-confirm-seats');

  if (_selectedSeats.length === 0) {
    if (displayEl) displayEl.textContent = '좌석을 선택해 주세요.';
    if (priceEl) priceEl.textContent = '0원';
    if (confirmBtn) confirmBtn.disabled = true;
  } else {
    const labels = _selectedSeats.map(s => {
      const rowClean = (s.seatRow || '').replace(/열$/, '');
      return `${rowClean}열 ${s.seatNumber}번`;
    }).join(', ');
    const totalPrice = _selectedSeats.reduce((sum, s) => sum + s.price, 0);

    if (displayEl) displayEl.textContent = labels;
    if (priceEl) priceEl.textContent = formatKRW(totalPrice);
    if (confirmBtn) confirmBtn.disabled = false;
  }
}


/* ═══════════════════════════════════════════════════════════
   수량 선택
═══════════════════════════════════════════════════════════ */
function initQtySelector() {
  const container = document.getElementById('ticketSelectionList');
  const btnAdd = document.getElementById('btnAddTicketType');

  if (btnAdd && container) {
    btnAdd.addEventListener('click', () => {
      if (container.children.length >= 4) {
        alert('권종은 최대 4개까지 추가할 수 있습니다.');
        return;
      }
      const clone = container.children[0].cloneNode(true);

      const delBtn = clone.querySelector('.btn-delete-ticket');
      if (delBtn) delBtn.style.visibility = 'visible';

      const valEl = clone.querySelector('.qty-value');
      if (valEl) valEl.textContent = '1';

      container.appendChild(clone);
      bindTicketRowEvents(clone);
      updateTotalQtyFromRows();
    });
  }

  if (container && container.children.length > 0) {
    bindTicketRowEvents(container.children[0]);
  }
}

function bindTicketRowEvents(row) {
  const minus = row.querySelector('.qty-btn-minus');
  const plus = row.querySelector('.qty-btn-plus');
  const valEl = row.querySelector('.qty-value');
  const delBtn = row.querySelector('.btn-delete-ticket');

  const dropdownOpts = row.querySelectorAll('.custom-dropdown-option');
  const textSpan = row.querySelector('.ticketTypeText');
  const dropdownSelected = row.querySelector('.custom-dropdown-selected');
  const dropdownParent = dropdownSelected?.parentElement;

  if (dropdownOpts && textSpan && dropdownParent) {
    dropdownOpts.forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownOpts.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        textSpan.textContent = opt.textContent;
        dropdownParent.classList.remove('open');
      });
    });
  }

  if (minus) {
    minus.addEventListener('click', () => {
      let q = parseInt(valEl.textContent) || 1;
      if (q > 1) {
        valEl.textContent = q - 1;
        updateTotalQtyFromRows();
      }
    });
  }
  if (plus) {
    plus.addEventListener('click', () => {
      let q = parseInt(valEl.textContent) || 1;
      const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
      const max = zone ? Math.min(4, zone.remainingCapacity) : 4;
      if (q < max) {
        valEl.textContent = q + 1;
        updateTotalQtyFromRows();
      }
    });
  }
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      const container = document.getElementById('ticketSelectionList');
      if (container && container.children.length > 1) {
        row.remove();
        updateTotalQtyFromRows();
      }
    });
  }
}

function updateTotalQtyFromRows() {
  const container = document.getElementById('ticketSelectionList');
  if (!container) return;
  let total = 0;
  container.querySelectorAll('.qty-value').forEach(el => {
    total += parseInt(el.textContent) || 1;
  });
  _quantity = total;

  // Update disabled states
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  const max = zone ? Math.min(4, zone.remainingCapacity) : 4;

  container.querySelectorAll('.qty-selector-wrap').forEach(row => {
    const q = parseInt(row.querySelector('.qty-value').textContent) || 1;
    const m = row.querySelector('.qty-btn-minus');
    const p = row.querySelector('.qty-btn-plus');
    if (m) m.disabled = (q <= 1);
    if (p) p.disabled = (q >= max);
  });

  if (zone) updateCtaBar(zone);
}

/* ═══════════════════════════════════════════════════════════
   Chart.js — 예매자 현황 통계 차트
═══════════════════════════════════════════════════════════ */
function initStatsCharts(stats) {
  if (!window.Chart || !stats) return;

  const chartDefaults = {
    plugins: { legend: { display: false } },
    animation: { duration: 800, easing: 'easeInOutQuart' },
  };

  // 성별 도넛 차트
  const genderCtx = document.getElementById('chart-gender');
  if (genderCtx) {
    window.genderChart = new Chart(genderCtx, {
      type: 'doughnut',
      data: {
        labels: ['남성', '여성'],
        datasets: [{
          data: [stats.gender?.male || 0, stats.gender?.female || 0],
          backgroundColor: ['#8B5CF6', '#F43F5E'],
          borderColor: '#ffffff',
          borderWidth: 4,
          hoverBorderWidth: 4,
          hoverOffset: 4,
        }],
      },
      options: {
        ...chartDefaults,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}%`,
            },
          },
        },
      },
    });
  }

  // 연령대 바 차트
  const ageCtx = document.getElementById('chart-age');
  if (ageCtx) {
    new Chart(ageCtx, {
      type: 'bar',
      data: {
        labels: ['10대', '20대', '30대', '40대', '50대+'],
        datasets: [{
          label: '예매 비율',
          data: [stats.age?.['10대'] || 0, stats.age?.['20대'] || 0, stats.age?.['30대'] || 0, stats.age?.['40대'] || 0, stats.age?.['50대이상'] || 0],
          backgroundColor: [
            'rgba(0,229,204,0.7)', 'rgba(106,77,255,0.7)', 'rgba(255,59,110,0.7)',
            'rgba(255,184,0,0.7)', 'rgba(59,130,246,0.7)',
          ],
          borderColor: ['#00E5CC', '#6A4DFF', '#FF3B6E', '#FFB800', '#3B82F6'],
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        ...chartDefaults,
        indexAxis: 'x',
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090B8', font: { size: 10, family: 'Pretendard Variable' } } },
          y: { min: 0, max: 100, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9090B8', font: { size: 10, family: 'Pretendard Variable' }, callback: v => `${v}%` } },
        },
        plugins: {
          ...chartDefaults.plugins,
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.parsed.y}%` },
          },
        },
      },
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   대기열 시뮬레이션
═══════════════════════════════════════════════════════════ */
function startQueueSimulation() {
  _queueCount = Math.floor(Math.random() * 400) + 150;
  const totalEntry = _queueCount;
  const myEntry = Math.floor(Math.random() * 80) + 10;
  let elapsed = 0;
  const totalWait = 30;   // seconds (시뮬레이션 총 시간)

  const countEl = $('.queue-count');
  const progFill = $('.queue-progress-fill');
  const progPct = $('.queue-progress-pct');
  const waitEl = $('.queue-estimated-time');
  const myNumEl = $('.queue-my-number');

  if (myNumEl) myNumEl.textContent = myEntry;

  _queueTimer = setInterval(() => {
    elapsed++;
    const progress = Math.min(100, Math.round(elapsed / totalWait * 100));
    const decrease = Math.floor((totalEntry - myEntry) * (elapsed / totalWait));
    const current = Math.max(myEntry, totalEntry - decrease);
    const remaining = Math.max(0, current - myEntry);
    const waitMin = Math.max(0, Math.ceil((remaining * 3) / 60));

    if (countEl) countEl.innerHTML = `${remaining.toLocaleString()}<span>명 앞</span>`;
    if (progFill) progFill.style.width = `${progress}%`;
    if (progPct) progPct.textContent = `${progress}%`;
    if (waitEl) waitEl.textContent = waitMin > 0
      ? `예상 대기 시간: 약 ${waitMin}분`
      : `잠시 후 입장됩니다...`;

    if (elapsed >= totalWait) {
      clearInterval(_queueTimer);
      enterPaymentModal();
    }
  }, 1000);
}

function cancelQueue() {
  clearInterval(_queueTimer);
  Modal.close('modal-queue');
}

/* ═══════════════════════════════════════════════════════════
   Toss Payments v1 Sandbox 결제 연동
   SDK: https://js.tosspayments.com/v1/payment
   Test Client Key: test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo
═══════════════════════════════════════════════════════════ */
async function initiateTossPayment() {
  if (!window.TossPayments) {
    Toast.error('결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  if (!zone) { Toast.warning('구역을 선택해 주세요.'); return; }

  if (_selectedSeats.length === 0) {
    Toast.warning('선택한 좌석이 없습니다.');
    return;
  }

  const user = Auth.get();
  const customerName = user?.nickname || user?.name || 'FESTIO 게스트';

  // 1. 서버에 주문 생성 → orderNo & orderUid 발급
  // seatIds: DB PK 배열 (정확한 구역별 좌석 특정용)
  const seatIds = _selectedSeats.map(s => s.id);
  // seatLabels: 주문 설명용 레이블 (orders.seat_ids 저장)
  const seatLabels = _selectedSeats.map(s => {
    const rowClean = (s.seatRow || '').replace(/열$/, '');
    return `${rowClean}열${s.seatNumber}번`;
  });
  const gross = _selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const discount = _appliedCoupon?.discountAmount || 0;
  const netAmount = gross - discount;

  const orderPayload = {
    totalPrice: netAmount,
    seats: seatLabels,      // 주문 설명용 텍스트 레이블
    seatIds: seatIds,       // DB PK 배열 - 구역별 정확한 좌석 예약용
    eventNo: getEventNo(),
    eventName: _eventDetail?.eventName || '',
    zoneName: zone?.zoneName || '',
    userToken: localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || ''
  };

  Modal.close('modal-payment');
  Toast.info('주문을 생성하는 중...');

  let orderRes;
  try {
    const res = await fetch('/api/order/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });
    if (!res.ok) throw new Error('API 응답 실패');
    orderRes = await res.json();
  } catch (e) {
    console.error(e);
    Toast.error('주문 생성에 실패했습니다.');
    return;
  }

  _orderNo = orderRes.orderId;
  _orderUid = orderRes.ticketNumber;

  // FESTIO Pay 결제 시뮬레이션
  if (_selectedPayMethod === 'festiopay') {
    const balEl = $('#festiopay-balance');
    let balance = parseInt(balEl ? balEl.textContent.replace(/[^0-9]/g, '') : 0);
    if (balance < netAmount) {
      Toast.warning('잔액이 부족합니다. 충전 후 다시 시도해주세요.');
      return;
    }
    // 결제 성공 처리
    Toast.success('FESTIO Pay로 결제되었습니다.');
    Modal.closeAll();
    showBookingSuccess();
    return;
  }

  // 2. Portone V1 카드 결제 요청
  if (_selectedPayMethod === 'card') {
    if (!window.IMP) {
      Toast.error('포트원 결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const { IMP } = window;
    IMP.init("imp81384776"); // 사용자의 가맹점 식별코드

    const seatDisplay = _selectedSeats.map(s => {
      const rowClean = (s.seatRow || '').replace(/열$/, '');
      return `${rowClean}열 ${s.seatNumber}번`;
    }).join(', ');

    IMP.request_pay({
      pg: "html5_inicis.INIpayTest", // 이니시스 테스트 상점 ID (INIpayTest)
      pay_method: "card",
      merchant_uid: _orderUid,
      name: `${_eventDetail?.eventName || '티켓'} - ${seatDisplay}`,
      amount: netAmount,
      buyer_email: user?.email || "",
      buyer_name: customerName,
      buyer_tel: user?.phone || "010-0000-0000"
    }, async function (rsp) {
      if (rsp.success) {
        Toast.success('결제가 완료되었습니다! 티켓을 발급 중입니다...', 4000);
        // 주문 확인 및 승인
        try {
          await orderApi.confirmPayment(_orderNo, {
            pgProvider: 'portone',
            pgTid: rsp.imp_uid,
            orderUid: rsp.merchant_uid,
          });
        } catch (confirmErr) {
          console.error(confirmErr);
        }
        Modal.closeAll();
        showBookingSuccess();
      } else {
        Toast.error(`결제 실패: ${rsp.error_msg}`);
        // 결제 실패 혹은 취소 시 데이터베이스 주문 취소 및 좌석 반환 처리
        try {
          await fetch(`/api/order/tickets/${_orderNo}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'REFUNDED' })
          });
        } catch (cancelErr) {
          console.error('[Order Cancel Error]', cancelErr);
        }
      }
    });
    return;
  }

  // 3. Toss Payments 결제 요청 (가상계좌)
  try {
    const tossPayments = TossPayments(TOSS_CLIENT_KEY);

    const seatDisplay = _selectedSeats.map(s => {
      const rowClean = (s.seatRow || '').replace(/열$/, '');
      return `${rowClean}열 ${s.seatNumber}번`;
    }).join(', ');

    await tossPayments.requestPayment('가상계좌', {
      amount: netAmount,
      orderId: _orderUid,
      orderName: `${_eventDetail?.eventName || '티켓'} - ${seatDisplay}`,
      customerName: customerName,
      successUrl: `${window.location.origin}/Festio/detail.html?eventNo=${getEventNo()}&paymentKey={PAYMENT_KEY}&orderId={ORDER_ID}&amount={AMOUNT}`,
      failUrl: `${window.location.origin}/Festio/detail.html?eventNo=${getEventNo()}&paymentFail=true`,
    });

  } catch (err) {
    if (err.code === 'USER_CANCEL') {
      Toast.info('결제를 취소했습니다.');
    } else {
      console.error('[Toss Payments Error]', err);
      Toast.error(`결제 오류: ${err.message}`);
    }
  }
}

/**
 * 결제 성공 콜백 처리 (payment-success.html에서 호출하거나
 * successUrl redirect 후 이 페이지에서 확인)
 */
async function handlePaymentSuccess(paymentKey, orderId) {
  const confirmRes = await orderApi.confirmPayment(_orderNo, {
    pgProvider: 'toss',
    pgTid: paymentKey,
    orderUid: orderId,
  });

  if (confirmRes?.success) {
    Modal.closeAll();
    showBookingSuccess();
    Toast.success('예매가 완료되었습니다!', 5000);
  } else {
    Toast.error('결제 확인 중 오류가 발생했습니다. 고객센터로 문의해 주세요.');
  }
}

function showBookingSuccess() {
  const main = $('main');
  if (!main) return;
  const successEl = document.createElement('div');
  successEl.className = 'booking-success';
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  successEl.innerHTML = `
    <div class="booking-success-icon">
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <h2 class="booking-success-title">예매 완료!</h2>
    <p class="booking-success-desc">
      ${_eventDetail?.eventName}<br>
      ${zone?.zoneName || ''} · ${_quantity}매<br>
      마이페이지에서 QR 티켓을 확인하세요.
    </p>
    <a href="mypage.html" class="btn btn-primary btn-full">QR 티켓 확인하기</a>`;
  main.appendChild(successEl);
  successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ═══════════════════════════════════════════════════════════
   결제 모달 진입
═══════════════════════════════════════════════════════════ */
function enterPaymentModal() {
  Modal.close('modal-queue');
  const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  if (!zone) return;

  // 기본 결제 수단으로 카드(Portone) 선택 및 버튼 텍스트 설정
  _selectedPayMethod = 'card';
  $$('.pay-method-btn').forEach(o => o.classList.remove('selected'));
  const cardBtn = $('.pay-method-btn[data-method="card"]');
  if (cardBtn) cardBtn.classList.add('selected');
  
  const payBtnText = $('#btn-pay-text');
  if (payBtnText) payBtnText.textContent = 'Portone으로 결제';

  const festioArea = $('#festiopay-area');
  if (festioArea) festioArea.classList.add('hidden');

  updatePaymentSummary(zone);
  Modal.open('modal-payment');
}

function updatePaymentSummary(zone) {
  const gross = _selectedSeats.length > 0
    ? _selectedSeats.reduce((sum, s) => sum + s.price, 0)
    : zone.price * _quantity;
  const discount = _appliedCoupon?.discountAmount || 0;
  const net = gross - discount;
  const seatLabels = _selectedSeats.map(s => `${s.seatRow}-${s.seatNumber}`).join(', ');

  const rows = {
    '[data-payment="event-name"]': _eventDetail?.eventName || '',
    '[data-payment="zone"]': _selectedSeats.length > 0 ? `${zone.zoneName} (${seatLabels}) × ${_quantity}매` : `${zone.zoneName} × ${_quantity}매`,
    '[data-payment="subtotal"]': formatKRW(gross),
    '[data-payment="discount"]': discount > 0 ? `-${formatKRW(discount)}` : '-',
    '[data-payment="total"]': formatKRW(net),
  };

  Object.entries(rows).forEach(([sel, val]) => {
    const el = $(sel);
    if (el) el.textContent = val;
  });
}

/* ═══════════════════════════════════════════════════════════
   예매 버튼 클릭 → 대기열 진입
═══════════════════════════════════════════════════════════ */
function initBookingBtn() {
  on($('#btn-book'), 'click', () => {
    if (!_selectedZoneNo) {
      Toast.warning('구역을 먼저 선택해 주세요.');
      return;
    }
    if (_selectedSeats.length === 0) {
      Toast.warning('좌석을 선택해 주세요.');
      const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
      if (zone) openSeatSelectionModal(_selectedZoneNo, zone);
      return;
    }
    // 테스트를 위해 대기열을 건너뛰고 바로 결제창 진입
    enterPaymentModal();
  });

  on($('#btn-cancel-queue'), 'click', () => {
    cancelQueue();
  });

  on($('#btn-pay'), 'click', () => {
    initiateTossPayment();
  });

  on($('#btn-payment-cancel'), 'click', () => {
    Modal.close('modal-payment');
  });

  // 좌석 선택 완료 버튼 리스너 추가
  on($('#btn-confirm-seats'), 'click', () => {
    if (_selectedSeats.length === 0) return;

    _quantity = _selectedSeats.length;
    updateQtyDisplay();

    // 수량 변경 버튼들 비활성화 처리 (좌석을 직접 고정시켰기 때문)
    const minus = $('.qty-btn-minus');
    const plus = $('.qty-btn-plus');
    if (minus) minus.disabled = true;
    if (plus) plus.disabled = true;

    // 구역 라벨 및 가격 정보 동기화
    const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
    if (zone) {
      updateCtaBar(zone);
    }

    Modal.close('modal-select-seats');
    Toast.success(`${_quantity}개의 좌석을 선택했습니다.`);
  });
}

/* ─── 결제 방법 선택 ─────────────────────────────────────────── */
function initPaymentMethodSelect() {
  on(document, 'click', (e) => {
    const option = e.target.closest('.pay-method-btn');
    if (!option) return;
    $$('.pay-method-btn').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    _selectedPayMethod = option.dataset.method || 'card';

    // 결제 버튼 텍스트 변경
    const payBtnText = $('#btn-pay-text');
    if (payBtnText) {
      if (_selectedPayMethod === 'card') payBtnText.textContent = 'Portone으로 결제';
      else if (_selectedPayMethod === 'virtual') payBtnText.textContent = 'Toss로 결제 (가상계좌)';
      else if (_selectedPayMethod === 'festiopay') payBtnText.textContent = 'FESTIO Pay로 결제';
    }

    const festioArea = $('#festiopay-area');
    if (festioArea) {
      if (_selectedPayMethod === 'festiopay') {
        festioArea.classList.remove('hidden');
        // 임시 잔액 표시
        const balEl = $('#festiopay-balance');
        if (balEl) balEl.textContent = formatKRW(50000); // 5만 원 임시 설정
      } else {
        festioArea.classList.add('hidden');
      }
    }
  });

  on($('#btn-charge-festiopay'), 'click', () => {
    Toast.success('50,000 포인트가 충전되었습니다.');
    const balEl = $('#festiopay-balance');
    if (balEl) balEl.textContent = formatKRW(100000); // 잔액 증가 시뮬레이션
  });
}

/* ─── 쿠폰 적용 ─────────────────────────────────────────────── */
function initCouponApply() {
  on($('#btn-apply-coupon'), 'click', async () => {
    const input = $('#coupon-input');
    const code = input?.value?.trim();
    if (!code) { Toast.warning('쿠폰 코드를 입력해 주세요.'); return; }

    const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
    if (!zone) return;

    // 단순 시뮬레이션 로직 (입력값이 'FESTIO2026'이면 10% 할인)
    let discountAmount = 0;
    const gross = zone.price * _quantity;
    if (code === 'FESTIO2026') {
      discountAmount = Math.floor(gross * 0.1); // 10% 할인
    } else {
      Toast.warning('유효하지 않은 쿠폰 코드입니다.');
      return;
    }

    _appliedCoupon = { couponNo: code, discountAmount: discountAmount };

    const appliedBox = $('#coupon-applied-info');
    const applyRow = $('#coupon-apply-row');
    if (appliedBox) {
      appliedBox.classList.remove('hidden');
      const amountEl = appliedBox.querySelector('.coupon-applied-amt');
      if (amountEl) amountEl.textContent = `-${formatKRW(discountAmount)}`;
    }
    if (applyRow) applyRow.classList.add('hidden');

    updatePaymentSummary(zone);
    Toast.success('쿠폰이 적용되었습니다.');
  });

  on($('#btn-remove-coupon'), 'click', () => {
    _appliedCoupon = null;
    const appliedBox = $('#coupon-applied-info');
    const applyRow = $('#coupon-apply-row');
    if (appliedBox) appliedBox.classList.add('hidden');
    if (applyRow) applyRow.classList.remove('hidden');
    const input = $('#coupon-input');
    if (input) input.value = '';

    const zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
    if (zone) updatePaymentSummary(zone);
    Toast.info('쿠폰이 제거되었습니다.');
  });
}

/* ─── 쿠폰 select 옵션 로드 ─────────────────────────────────── */
async function loadCouponsForPayment() {
  const select = $('#coupon-select');
  if (!select) return;
  const coupons = await couponApi.getMyCoupons();
  const valid = (coupons || []).filter(c => !c.isUsed);
  if (!valid.length) {
    select.innerHTML = '<option value="">사용 가능한 쿠폰이 없습니다</option>';
    return;
  }
  select.innerHTML = `<option value="">쿠폰 선택</option>` + valid.map(c =>
    `<option value="${c.couponNo}">${c.couponName} (${c.discountType === 'PERCENT' ? `${c.discountValue}%` : formatKRW(c.discountValue)} 할인)</option>`
  ).join('');
}

/* ═══════════════════════════════════════════════════════════
   URL 파라미터 확인 — Toss 결제 성공/실패 콜백
   successUrl redirect 시 ?paymentKey=...&orderId=...&amount=...
   failUrl redirect 시 ?paymentFail=true
═══════════════════════════════════════════════════════════ */
function checkPaymentCallback() {
  const params = new URLSearchParams(window.location.search);
  const paymentKey = params.get('paymentKey');
  const orderId = params.get('orderId');
  const paymentFail = params.get('paymentFail');

  if (paymentFail === 'true') {
    Toast.error('결제가 취소되거나 실패했습니다. 다시 시도해 주세요.');
    window.history.replaceState({}, '', window.location.pathname + `?eventNo=${getEventNo()}`);
    return;
  }

  if (paymentKey && orderId) {
    // Toss 성공 리다이렉트: 주문 직접 완료 처리 (서버 confirm 없이 UI만 갱신)
    Toast.success('결제가 완료되었습니다! 티켓을 발급 중입니다...', 4000);
    setTimeout(() => showBookingSuccess(), 1000);
    window.history.replaceState({}, '', window.location.pathname + `?eventNo=${getEventNo()}`);
  }
}


/* ═══════════════════════════════════════════════════════════
   DOMContentLoaded — 진입점
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  checkPaymentCallback();

  const eventNo = getEventNo();
  const detail = await eventApi.getEventDetail(eventNo);
  if (!detail) {
    Toast.error('행사 정보를 불러올 수 없습니다.');
    return;
  }

  // 사용자 편집 데이터 불러오기 (우선순위: DB > localStorage)
  const tabsSection = document.getElementById('detailTabsSection');
  if (tabsSection) {
    if (detail.descriptionHtml) {
      tabsSection.innerHTML = detail.descriptionHtml;
    } else {
      const savedTabs = localStorage.getItem(`festio_event_${eventNo}_tabs`);
      if (savedTabs) {
        tabsSection.innerHTML = savedTabs;
      }
    }
  }

  // 추가 데이터 동기 로드
  detail.zones = await eventApi.getZoneCapacity(eventNo);
  detail.stats = await eventApi.getEventStats(eventNo);

  _eventDetail = detail;

  renderEventDetail(detail);
  initVenueMap(detail.zones);
  initQtySelector();
  initStatsCharts(detail.stats);
  initBookingBtn();
  initPaymentMethodSelect();
  initCouponApply();
  loadCouponsForPayment();

  // 탭 클릭 이벤트 로직 (편집 모드가 아닐 때 탭 전환 및 스크롤)
  const tabsHeader = document.querySelector('.detail-tabs-header');
  if (tabsHeader) {
    tabsHeader.addEventListener('click', (e) => {
      const btn = e.target.closest('.detail-tab-btn');
      if (!btn) return;

      let targetId = btn.dataset.target;
      if (!targetId && btn.dataset.tab) {
        targetId = 'tab-' + btn.dataset.tab;
      }
      if (!targetId) return;

      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
        if (!isEditMode) {
          const header = document.querySelector('.detail-tabs-header');
          const headerHeight = header ? header.offsetHeight : 0;
          const globalHeaderH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80;
          const offsetTop = targetContent.getBoundingClientRect().top + window.scrollY - headerHeight - globalHeaderH - 20;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      }
    });
  }

  // 위시리스트 버튼
  on($('#btn-wish-detail'), 'click', async (e) => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Toast.info('로그인이 필요합니다.');
      setTimeout(() => { window.location.href = 'login.html'; }, 1000);
      return;
    }
    const btn = e.currentTarget;
    const isWished = btn.dataset.wished === 'true';
    await wishlistApi.toggleWishlist(detail.eventNo, isWished);
    const newWished = !isWished;
    btn.dataset.wished = String(newWished);
    btn.classList.toggle('active', newWished);
    const icon = btn.querySelector('.icon');
    if (icon) icon.setAttribute('fill', newWished ? 'currentColor' : 'none');
    Toast.show(newWished ? '찜 목록에 추가했습니다.' : '찜 목록에서 제거했습니다.', newWished ? 'success' : 'info');
  });
});


/* ═══════════════════════════════════════════════════════════
   편집 모드 (Edit Mode)
═══════════════════════════════════════════════════════════ */
let isEditMode = false;
const quillEditors = {};

function toggleEditMode(enable) {
  isEditMode = enable;
  const detailTabsSection = document.getElementById('detailTabsSection');
  const body = document.body;
  const editBadge = document.getElementById('editBadge');
  const btnSave = document.getElementById('btnSaveAllEdits');

  if (enable) {
    body.classList.add('edit-mode');
    if (editBadge) editBadge.style.display = 'inline-flex';
    if (btnSave) btnSave.style.display = 'inline-flex';

    if (!document.querySelector('.builder-tabs-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'builder-tabs-wrapper edit-builder-layout';
      detailTabsSection.parentNode.insertBefore(wrapper, detailTabsSection);
      wrapper.appendChild(detailTabsSection);

      const builderSidebar = document.createElement('aside');
      builderSidebar.className = 'builder-sidebar';
      builderSidebar.id = 'builderSidebar';
      wrapper.insertBefore(builderSidebar, detailTabsSection);

      initBuilderSidebar(builderSidebar, detailTabsSection);
      // initMainAreaEditors moved to sidebar
    } else {
      document.querySelector('.builder-tabs-wrapper').classList.add('edit-builder-layout');
    }
  } else {
    body.classList.remove('edit-mode');
    if (editBadge) editBadge.style.display = 'none';
    if (btnSave) btnSave.style.display = 'none';
    const wrapper = document.querySelector('.builder-tabs-wrapper');
    if (wrapper) {
      wrapper.classList.remove('edit-builder-layout');
    }
    // 에디터 비활성화 및 내용 반영
    // Editors are now in sidebar, right area already has live preview HTML
  }
}


function destroyMainAreaEditors(tabsSection) {
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  tabs.forEach(tab => {
    const inner = tab.querySelector('.tab-content-inner');
    if (!inner) return;

    if (tab.id === 'tab-venue') {
      const editorWrap = inner.querySelector('.venue-editor-wrap');
      if (editorWrap) {
        editorWrap.remove();
      }
      return;
    }

    const wrap = inner.querySelector('.block-editor-wrap');
    if (wrap) {
      const blocksContainer = wrap.querySelector('.blocks-container');
      const blocks = blocksContainer.querySelectorAll('.editor-block');
      let combinedHtml = '';
      blocks.forEach(block => {
        if (block.classList.contains('text-block')) {
          const quillWrap = block.querySelector('.quill-main-editor');
          const editorContent = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
          combinedHtml += `<div class="view-text-block" style="margin-bottom:1rem;">${editorContent}</div>`;
        } else if (block.classList.contains('gallery-block')) {
          const previewHtml = block.querySelector('.gallery-preview-container').innerHTML;
          combinedHtml += `<div class="view-gallery-block" style="margin-bottom:1rem;">${previewHtml}</div>`;
        }
      });
      inner.innerHTML = combinedHtml;

      Object.keys(quillEditors).forEach(k => {
        if (k.startsWith(tab.id + '_')) delete quillEditors[k];
      });
    } else {
      const quillWrap = inner.querySelector('.quill-main-editor');
      if (quillWrap) {
        const html = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
        inner.innerHTML = html;
        delete quillEditors[tab.id];
      }
    }
  });
}

function initBuilderSidebar(sidebar, tabsSection) {
  sidebar.innerHTML = `
    <div class="builder-sidebar-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
      <div>
        <h3 style="margin:0; font-size:1.1rem;">섹션 구성</h3>
        <p style="font-size:0.75rem; color:var(--text-muted); margin:0.5rem 0 0 0;">드래그하여 순서를 변경하거나 섹션을 관리하세요.</p>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <button class="btn btn-sm" id="btnResetLayout" style="padding: 0.3rem 0.5rem; font-size:0.8rem; color:#6b7280; background:transparent; border:none; box-shadow:none;">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:2px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> 초기화
        </button>
        <button class="btn btn-primary btn-sm" id="btnAddSectionTop" style="border-radius:50%; width:36px; height:36px; padding:0; display:flex; align-items:center; justify-content:center; background:#3B82F6; border:none; box-shadow:0 4px 12px rgba(59,130,246,0.4); font-size:1.6rem; font-weight:600;">+</button>
      </div>
    </div>
    <div class="builder-accordion-list" id="builderAccordionList"></div>
  `;


  const btnReset = sidebar.querySelector('#btnResetLayout');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('모든 섹션을 삭제하고 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
        const listWrap = sidebar.querySelector('#builderAccordionList');
        if (listWrap) listWrap.innerHTML = '';

        const tabsSection = document.getElementById('detailTabsSection');
        if (tabsSection) {
          const contents = tabsSection.querySelectorAll('.detail-tab-content');
          contents.forEach(c => c.remove());
        }

        const tabsHeader = document.querySelector('.detail-tabs-header');
        if (tabsHeader) {
          const btns = tabsHeader.querySelectorAll('.detail-tab-btn');
          btns.forEach(b => b.remove());
        }
        Toast.success('모든 섹션이 초기화되었습니다. 새 섹션을 추가해 주세요.');
      }
    });
  }

  const listWrap = sidebar.querySelector('#builderAccordionList');
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  const tabBtns = document.querySelectorAll('.detail-tab-btn');

  tabs.forEach((tab, index) => {
    const targetId = tab.id;
    const tabId = targetId.replace('tab-', '');
    const btn = Array.from(tabBtns).find(b => b.dataset.tab === tabId || b.dataset.target === targetId);
    const title = btn ? btn.textContent.trim() : '새 섹션';
    addAccordionItem(listWrap, title, targetId, index, tab);
  });

  if (typeof Sortable !== 'undefined') {
    Sortable.create(listWrap, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function (evt) {
        syncTabsOrder(listWrap, tabsSection);
      }
    });
  }

  sidebar.querySelector('#btnAddSectionTop').addEventListener('click', () => handleAddSection());
}

function addAccordionItem(listWrap, title, id, index, tabElement) {
  const bodyHtml = `
    <div style="margin-bottom: 1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
        <span style="font-size:0.85rem; font-weight:700; color:var(--text-main);">섹션 타이틀</span>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <span style="font-size:0.75rem; color:var(--text-muted);">텍스트 정렬</span>
          <div class="align-toggle-group" style="display:flex; background:var(--bg-surface2); border-radius:6px; overflow:hidden; border:1px solid var(--border-default);">
            <button class="btn-align active" data-align="left" style="padding:4px 10px; border:none; background:transparent; cursor:pointer;" onclick="changeSectionAlign('${id}', 'left', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 6H3"/><path d="M15 12H3"/><path d="M17 18H3"/></svg>
            </button>
            <button class="btn-align" data-align="center" style="padding:4px 10px; border:none; background:transparent; cursor:pointer;" onclick="changeSectionAlign('${id}', 'center', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 6H3"/><path d="M19 12H5"/><path d="M21 18H3"/></svg>
            </button>
            <button class="btn-align" data-align="right" style="padding:4px 10px; border:none; background:transparent; cursor:pointer;" onclick="changeSectionAlign('${id}', 'right', this)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="18" x2="7" y2="18"></line></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const item = document.createElement('div');
  item.className = 'builder-accordion-item';
  item.dataset.targetId = id;
  item.innerHTML = `
    <div class="builder-accordion-header">
      <div class="builder-accordion-title">
        <span class="drag-handle" title="드래그하여 순서 변경">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#a1a1aa;"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </span>
        <span class="accordion-index" style="color:#3B82F6; font-weight:800; font-size:13px; margin-right:4px;">${index}</span>
        <span class="accordion-name" contenteditable="true" style="font-size:14px; color:#1f2937;">${title}</span>
      </div>
      <div style="display:flex; gap:0.2rem; align-items:center;">
        <button class="btn-delete-section" title="삭제" style="padding:6px; border-radius:6px; transition:background 0.2s;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <span class="accordion-toggle" style="padding:4px; color:#9ca3af; transition:transform 0.2s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </div>
    </div>
    <div class="builder-accordion-body">
      ${bodyHtml}
    </div>
  `;
  listWrap.appendChild(item);

  const header = item.querySelector('.builder-accordion-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.drag-handle') || e.target.closest('.btn-delete-section') || e.target.hasAttribute('contenteditable')) return;

    const isActive = item.classList.contains('active');
    listWrap.querySelectorAll('.builder-accordion-item').forEach(i => {
      i.classList.remove('active');
      const toggle = i.querySelector('.accordion-toggle svg');
      if (toggle) toggle.style.transform = 'rotate(0deg)';
    });

    if (!isActive) {
      item.classList.add('active');
      const toggle = item.querySelector('.accordion-toggle svg');
      if (toggle) toggle.style.transform = 'rotate(180deg)';
      const targetId = item.dataset.targetId;
      const targetTab = document.getElementById(targetId);
      if (targetTab) {
        document.querySelectorAll('.detail-tab-content').forEach(t => t.classList.remove('active'));
        targetTab.classList.add('active');
      }
      const tabId = targetId.replace('tab-', '');
      document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) {
        tabBtn.classList.add('active');
        tabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });

  const nameEl = item.querySelector('.accordion-name');
  nameEl.addEventListener('input', () => {
    const targetId = item.dataset.targetId;
    const targetTab = document.getElementById(targetId);
    if (targetTab) {
      const h2 = targetTab.querySelector('.tab-title');
      if (h2) h2.textContent = nameEl.textContent;
    }
    const tabId = targetId.replace('tab-', '');
    const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
    if (tabBtn) tabBtn.textContent = nameEl.textContent;
  });

  const bodyWrap = item.querySelector('.builder-accordion-body');
  if (tabElement) {
    if (id === 'tab-venue') {
      if (typeof makeVenueEditor === 'function') makeVenueEditor(tabElement, bodyWrap);
    } else {
      makeBlockEditor(tabElement, bodyWrap);
    }
  }

  item.querySelector('.btn-delete-section').addEventListener('click', (e) => {
    e.stopPropagation();

    if (confirm('이 섹션을 삭제하시겠습니까?')) {
      const targetId = item.dataset.targetId;
      const targetTab = document.getElementById(targetId);
      if (targetTab) targetTab.remove();

      const tabId = targetId.replace('tab-', '');
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) tabBtn.remove();

      item.remove();
      
      const listWrap = document.getElementById('builderAccordionList');
      const tabsSection = document.getElementById('detailTabsSection');
      if (listWrap && tabsSection) {
        syncTabsOrder(listWrap, tabsSection);
        
        // 즉시 DB 저장 연동
        const wasEditMode = isEditMode;
        if (wasEditMode) {
          destroyMainAreaEditors(tabsSection);
        }
        
        const htmlContent = tabsSection.innerHTML;
        const eventNo = getEventNo();
        
        eventApi.saveDescriptionHtml(eventNo, htmlContent)
          .then(result => {
            if (result) {
              localStorage.setItem(`festio_event_${eventNo}_tabs`, htmlContent);
              Toast.success('✅ 섹션이 삭제되고 DB에 성공적으로 반영되었습니다.');
            } else {
              localStorage.setItem(`festio_event_${eventNo}_tabs`, htmlContent);
              Toast.warn('⚠️ DB 저장 실패로 브라우저에 임시 반영되었습니다.');
            }
          })
          .catch(err => {
            localStorage.setItem(`festio_event_${eventNo}_tabs`, htmlContent);
            console.error('saveDescriptionHtml error during delete:', err);
          })
          .finally(() => {
            if (wasEditMode) {
              initMainAreaEditors(tabsSection);
            }
          });
      }
    }
  });

  const fileInput = item.querySelector('.gallery-upload-input');
  const previewGrid = item.querySelector('.uploaded-image-grid');
  if (fileInput && previewGrid) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const currentImgCount = previewGrid.querySelectorAll('.uploaded-image-item').length;
      if (currentImgCount + files.length > 20) {
        Toast.warning(`최대 20장까지만 업로드할 수 있습니다. (현재 ${currentImgCount}장)`);
        fileInput.value = '';
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const imgItem = document.createElement('div');
          imgItem.className = 'uploaded-image-item';
          imgItem.style.cssText = 'position:relative; flex-shrink:0; width:80px; height:80px; border-radius:10px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.06); border:1px solid #e5e7eb;';
          imgItem.innerHTML = `
            <img src="${ev.target.result}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-delete-image" style="position:absolute; top:4px; right:4px; width:20px; height:20px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(4px);">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          `;

          imgItem.querySelector('.btn-delete-image').addEventListener('click', () => {
            imgItem.remove();
            updateGalleryPreview(id);
          });

          previewGrid.appendChild(imgItem);
        };
        reader.readAsDataURL(file);
      });

      setTimeout(() => updateGalleryPreview(id), 100);
      fileInput.value = '';
    });
  }

  window.changeGalleryLayout = function (id, value, text, optionEl) {
    const dropdown = optionEl.closest('.gallery-layout-dropdown');
    dropdown.querySelector('.galleryLayoutText').textContent = text;
    dropdown.querySelector('.gallery-layout-select').value = value;
    dropdown.querySelectorAll('.custom-dropdown-option').forEach(el => el.classList.remove('active'));
    optionEl.classList.add('active');
    dropdown.classList.remove('open');
    updateGalleryPreview(id);
  };

  window.changeSectionAlign = function (id, align, btn) {
    const parent = btn.closest('.align-toggle-group');
    parent.querySelectorAll('.btn-align').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    const targetTab = document.getElementById(id);
    if (targetTab) {
      const titleEl = targetTab.querySelector('.tab-title');
      if (titleEl) titleEl.style.textAlign = align;
    }
  };
}

function syncTabsOrder(listWrap, tabsSection) {
  const items = listWrap.querySelectorAll('.builder-accordion-item');
  const tabsHeader = document.querySelector('.detail-tabs-header');
  items.forEach((it, idx) => {
    it.querySelector('.accordion-index').textContent = idx;
    const targetId = it.dataset.targetId;
    const tabContent = document.getElementById(targetId);
    if (tabContent) {
      tabsSection.appendChild(tabContent);
    }
    if (tabsHeader) {
      const tabId = targetId.replace('tab-', '');
      const tabBtn = document.querySelector(`.detail-tab-btn[data-tab="${tabId}"], .detail-tab-btn[data-target="${targetId}"]`);
      if (tabBtn) tabsHeader.appendChild(tabBtn);
    }
  });
}

function updateGalleryPreview(targetId) {
  const accordionItem = document.querySelector(`.builder-accordion-item[data-target-id="${targetId}"]`);
  const targetTab = document.getElementById(targetId);
  if (!accordionItem || !targetTab) return;

  const inner = targetTab.querySelector('.tab-content-inner');
  if (!inner) return;

  const layout = accordionItem.querySelector('.gallery-layout-select')?.value || 'grid';
  const imgElements = accordionItem.querySelectorAll('.uploaded-image-grid img');
  const images = Array.from(imgElements).map(img => img.src);

  if (images.length === 0) {
    inner.innerHTML = '<div style="padding:3rem; text-align:center; color:var(--text-muted); background:var(--bg-surface1); border-radius:12px; border:1px dashed var(--border-default);">등록된 이미지가 없습니다. 좌측에서 이미지를 첨부해주세요.</div>';
    return;
  }

  let html = '';
  if (layout === 'grid') {
    html = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:1rem;">';
    images.forEach(src => {
      html += `<div style="aspect-ratio:1; border-radius:12px; overflow:hidden;"><img src="${src}" style="width:100%; height:100%; object-fit:cover;"></div>`;
    });
    html += '</div>';
  } else if (layout === 'slider') {
    html = '<div style="display:flex; overflow-x:auto; gap:1rem; padding-bottom:1rem; scroll-snap-type:x mandatory;">';
    images.forEach(src => {
      html += `<div style="flex:0 0 80%; scroll-snap-align:center; border-radius:12px; overflow:hidden;"><img src="${src}" style="width:100%; height:auto; object-fit:contain; max-height:400px; background:#f0f0f0;"></div>`;
    });
    html += '</div>';
  } else if (layout === 'polaroid') {
    html = '<div style="display:flex; flex-wrap:wrap; gap:1.5rem; justify-content:center;">';
    images.forEach(src => {
      html += `
        <div style="background:#fff; padding:10px 10px 30px; box-shadow:0 4px 12px rgba(0,0,0,0.1); border-radius:4px; width:220px; transform:rotate(${Math.floor(Math.random() * 10 - 5)}deg);">
          <img src="${src}" style="width:100%; aspect-ratio:1; object-fit:cover; border:1px solid #eee;">
        </div>
      `;
    });
    html += '</div>';
  } else if (layout === 'carousel') {
    html = '<div style="display:flex; flex-direction:column; gap:1rem; align-items:center;">';
    images.forEach(src => {
      html += `<div style="width:100%; max-width:600px; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);"><img src="${src}" style="width:100%; height:auto; object-fit:contain; display:block;"></div>`;
    });
    html += '</div>';
  }

  inner.innerHTML = html;
}

const quillToolbarOptions = [
  [{ 'font': [] }, { 'size': [] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'script': 'sub' }, { 'script': 'super' }],
  [{ 'header': 1 }, { 'header': 2 }, 'blockquote', 'code-block'],
  [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
  [{ 'direction': 'rtl' }, { 'align': [] }],
  ['link', 'image', 'video'],
  ['clean']
];


function initMainAreaEditors(tabsSection) {
  const tabs = tabsSection.querySelectorAll('.detail-tab-content');
  tabs.forEach(tab => {
    const inner = tab.querySelector('.tab-content-inner');
    if (!inner) return;

    if (tab.id === 'tab-venue') {
      if (inner.querySelector('.venue-editor-wrap')) return;

      const currentAddress = inner.querySelector('.venue-address-text')?.textContent || '';
      const currentTransit = inner.querySelector('#transitContent')?.innerHTML || '';

      const editorHtml = `
        <div class="venue-editor-wrap" style="background: var(--bg-surface1); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px dashed var(--border-default);">
          <div style="margin-bottom: 1rem;">
            <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">행사 장소 주소</label>
            <div style="display:flex; gap: 0.5rem;">
              <input type="text" id="venueEditAddress" class="form-control" style="flex: 1; border-radius:8px;" placeholder="예: 서울특별시 강남구 테헤란로 123" value="${currentAddress === '장소 정보가 없습니다.' ? '' : currentAddress}">
              <button type="button" class="btn btn-primary" id="btnUpdateVenueMap" style="border-radius:8px;">지도 반영</button>
            </div>
          </div>
          <div>
            <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">대중교통 안내</label>
            <textarea id="venueEditTransit" class="form-control" style="width:100%; min-height: 100px; resize: vertical; border-radius:8px;" placeholder="지하철, 버스 등 교통편 안내를 입력하세요">${currentTransit === '대중교통 정보가 없습니다.' ? '' : currentTransit}</textarea>
          </div>
        </div>
      `;
      inner.insertAdjacentHTML('afterbegin', editorHtml);

      const btnUpdate = inner.querySelector('#btnUpdateVenueMap');
      const addressInput = inner.querySelector('#venueEditAddress');
      const transitInput = inner.querySelector('#venueEditTransit');

      btnUpdate.addEventListener('click', () => {
        const address = addressInput.value.trim();
        const transit = transitInput.value.trim();

        const addressTextEl = inner.querySelector('.venue-address-text');
        const transitContentEl = inner.querySelector('#transitContent');
        const googleMapFrame = inner.querySelector('#googleMap');

        if (addressTextEl) addressTextEl.textContent = address || '장소 정보가 없습니다.';
        if (transitContentEl) transitContentEl.innerHTML = transit.replace(/\n/g, '<br>') || '대중교통 정보가 없습니다.';

        if (googleMapFrame && address) {
          googleMapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
        }

        let linksWrap = inner.querySelector('#directionsLinksWrap');
        if (!linksWrap) {
          linksWrap = document.createElement('div');
          linksWrap.id = 'directionsLinksWrap';
          inner.appendChild(linksWrap);
        }

        if (address) {
          linksWrap.innerHTML = `
            <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <a href="https://map.kakao.com/link/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #FEE500; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 3c-5.523 0-10 3.514-10 7.85 0 2.804 1.83 5.253 4.606 6.647l-1.18 4.34c-.05.18.17.33.32.22l5.12-3.41c.37.04.74.06 1.13.06 5.523 0 10-3.514 10-7.85C22 6.514 17.523 3 12 3z"/></svg>카카오맵</a>
              <a href="https://map.naver.com/v5/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #03C75A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.084 12.637L8.03 2.127C7.625 1.597 7.026 1.334 6.386 1.334H2v21.332h5.922V11.233l8.053 10.51C16.42 22.316 17.02 22.58 17.658 22.58H22V1.248h-5.916v11.389z"/></svg>네이버지도</a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=transit" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #4285F4; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>구글맵 길찾기</a>
            </div>
          `;
        } else {
          linksWrap.innerHTML = '';
        }

        Toast.success('장소 및 지도가 반영되었습니다.');
      });

      return;
    }

    if (inner.querySelector('.block-editor-wrap')) return;

    makeBlockEditor(tab, inner);
  });
}

function syncLivePreview(tab, blocksContainer) {
  const inner = tab.querySelector('.tab-content-inner');
  if (!inner) return;

  let combinedHtml = '';
  const blocks = blocksContainer.querySelectorAll('.editor-block');
  if (blocks.length === 0) {
    inner.innerHTML = '<p class="tab-empty-text">등록된 내용이 없습니다.</p>';
    return;
  }

  blocks.forEach(block => {
    if (block.classList.contains('text-block')) {
      const quillWrap = block.querySelector('.quill-main-editor');
      if (quillWrap) {
        const editorContent = quillWrap.querySelector('.ql-editor') ? quillWrap.querySelector('.ql-editor').innerHTML : quillWrap.innerHTML;
        combinedHtml += `<div class="view-text-block" style="margin-bottom:1rem;">${editorContent}</div>`;
      }
    } else if (block.classList.contains('gallery-block')) {
      const previewContainer = block.querySelector('.gallery-preview-container');
      if (previewContainer) {
        combinedHtml += previewContainer.innerHTML;
      }
    }
  });
  inner.innerHTML = combinedHtml;
}

function makeBlockEditor(tab, sidebarContainer) {
  const inner = tab.querySelector('.tab-content-inner');
  let html = '';
  if (inner) {
    html = inner.innerHTML;
  }

  const wrap = document.createElement('div');
  wrap.className = 'block-editor-wrap';

  const blocksContainer = document.createElement('div');
  blocksContainer.className = 'blocks-container';
  blocksContainer.style.display = 'flex';
  blocksContainer.style.flexDirection = 'column';
  blocksContainer.style.gap = '1.5rem';
  wrap.appendChild(blocksContainer);

  const addActions = document.createElement('div');
  addActions.className = 'block-add-actions';
  addActions.style.display = 'flex';
  addActions.style.flexWrap = 'wrap';
  addActions.style.gap = '8px';
  addActions.style.padding = '16px 0';
  addActions.style.justifyContent = 'center';
  addActions.innerHTML = `
    <button class="btn btn-add-text-block" style="background:#fff; border:1px solid #e5e7eb; padding:8px 16px; border-radius:30px; font-weight:600; font-size:0.85rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 텍스트 블록</button>
    <button class="btn btn-add-gallery-block" style="background:#fff; border:1px solid #e5e7eb; padding:8px 16px; border-radius:30px; font-weight:600; font-size:0.85rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 갤러리</button>
    <button class="btn btn-add-map-block" style="background:#fff; border:1px solid #e5e7eb; padding:8px 16px; border-radius:30px; font-weight:600; font-size:0.85rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 지도 영역</button>
    <button class="btn btn-add-list-block" style="background:#fff; border:1px solid #e5e7eb; padding:8px 16px; border-radius:30px; font-weight:600; font-size:0.85rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 타임라인/리스트</button>
    <button class="btn btn-add-notice-block" style="background:#fff; border:1px solid #e5e7eb; padding:8px 16px; border-radius:30px; font-weight:600; font-size:0.85rem; color:#4b5563; box-shadow:0 2px 4px rgba(0,0,0,0.02); cursor:pointer; transition:all 0.2s;">+ 공지 배너</button>
  `;
  wrap.appendChild(addActions);
  sidebarContainer.appendChild(wrap);

  const createBlockWrapper = (typeLabel, iconSvg, blockClass) => {
    const block = document.createElement('div');
    block.className = `editor-block ${blockClass}`;
    block.style.position = 'relative';
    block.style.border = '1px solid #e5e7eb';
    block.style.borderRadius = '12px';
    block.style.padding = '40px 0 0 0';
    block.style.background = '#fff';
    block.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
    block.style.overflow = 'hidden';

    const controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.top = '0';
    controls.style.left = '0';
    controls.style.right = '0';
    controls.style.height = '40px';
    controls.style.background = '#f9fafb';
    controls.style.borderBottom = '1px solid #e5e7eb';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.justifyContent = 'space-between';
    controls.style.padding = '0 12px';

    controls.innerHTML = `
      <div style="font-size:0.75rem; font-weight:700; color:#6b7280; display:flex; align-items:center; gap:4px;">
         ${iconSvg} ${typeLabel}
      </div>
      <div style="display:flex; gap:4px;">
        <button class="btn-block-up" style="cursor:pointer; background:#fff; border:1px solid #d1d5db; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#4b5563; transition:background 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg></button>
        <button class="btn-block-down" style="cursor:pointer; background:#fff; border:1px solid #d1d5db; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#4b5563; transition:background 0.2s;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
        <button class="btn-block-del" style="cursor:pointer; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; color:#ef4444; transition:background 0.2s; margin-left:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
    `;
    block.appendChild(controls);
    return block;
  };

  const bindBlockControls = (block) => {
    block.querySelector('.btn-block-up').addEventListener('click', () => {
      const prev = block.previousElementSibling;
      if (prev) blocksContainer.insertBefore(block, prev);
      syncLivePreview(tab, blocksContainer);
    });
    block.querySelector('.btn-block-down').addEventListener('click', () => {
      const next = block.nextElementSibling;
      if (next) blocksContainer.insertBefore(next, block);
      syncLivePreview(tab, blocksContainer);
    });
    block.querySelector('.btn-block-del').addEventListener('click', () => {
      block.remove();
      syncLivePreview(tab, blocksContainer);
    });
  };

  const addTextBlock = (content = '') => {
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>`;
    const block = createBlockWrapper('텍스트 블록', icon, 'text-block');

    const quillWrap = document.createElement('div');
    quillWrap.className = 'quill-main-editor';
    quillWrap.style.minHeight = '150px';
    quillWrap.innerHTML = content;
    block.appendChild(quillWrap);

    blocksContainer.appendChild(block);
    bindBlockControls(block);

    if (typeof Quill !== 'undefined') {
      const quill = new Quill(quillWrap, {
        theme: 'snow',
        modules: { toolbar: quillToolbarOptions }
      });
      quillEditors[tab.id + '_' + Date.now()] = quill;

      quill.on('text-change', () => {
        syncLivePreview(tab, blocksContainer);
      });
    }

    syncLivePreview(tab, blocksContainer);
  };

  const addGalleryBlock = (savedGalleryData = null) => {
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    const block = createBlockWrapper('갤러리 영역', icon, 'gallery-block');

    const uploadWrap = document.createElement('div');
    uploadWrap.style.padding = '1.5rem';
    uploadWrap.innerHTML = `
      <div style="margin-bottom:1rem;">
        <select class="form-control gallery-layout-select" style="width:100%; border-radius:8px;">
          <option value="grid">Grid (기본 격자)</option>
          <option value="masonry">Masonry (핀터레스트 스타일)</option>
          <option value="mosaic">Mosaic (모자이크형)</option>
          <option value="carousel">Carousel (캐러셀)</option>
        </select>
      </div>
      <div style="margin-bottom:1rem; font-weight:700; color:var(--text-main); font-size:0.9rem;">이미지</div>
      <label class="gallery-upload-area" style="display:block; border:1px dashed #d1d5db; border-radius:12px; padding:2rem; text-align:center; cursor:pointer; background:#f9fafb; transition:all 0.2s;">
        <input type="file" multiple accept="image/*" class="gallery-upload-input" style="display:none;">
        <div style="width:40px; height:40px; background:#fff; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.5rem; color:#9ca3af;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </div>
        <div style="color:#6b7280; font-size:0.9rem; font-weight:600;">이미지 선택</div>
      </label>
      <div class="uploaded-image-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(80px, 1fr)); gap:10px; margin-top:1rem;"></div>
      <div class="gallery-preview-container" style="display:none;"></div>
    `;
    block.appendChild(uploadWrap);
    blocksContainer.appendChild(block);
    bindBlockControls(block);

    const fileInput = block.querySelector('.gallery-upload-input');
    const previewGrid = block.querySelector('.uploaded-image-grid');
    const layoutSelect = block.querySelector('.gallery-layout-select');

    const triggerUpdate = () => {
      updateGalleryPreview(tab.id);
      syncLivePreview(tab, blocksContainer);
    };

    layoutSelect.addEventListener('change', triggerUpdate);

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const currentImgCount = previewGrid.querySelectorAll('.uploaded-image-item').length;
      if (currentImgCount + files.length > 20) {
        Toast.warning(`최대 20장까지만 업로드할 수 있습니다. (현재 ${currentImgCount}장)`);
        fileInput.value = '';
        return;
      }

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'uploaded-image-item';
          imgWrap.style.position = 'relative';
          imgWrap.style.aspectRatio = '1';
          imgWrap.style.borderRadius = '8px';
          imgWrap.style.overflow = 'hidden';
          imgWrap.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

          imgWrap.innerHTML = `
            <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-remove-img" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;">✕</button>
          `;

          imgWrap.querySelector('.btn-remove-img').addEventListener('click', () => {
            imgWrap.remove();
            triggerUpdate();
          });

          previewGrid.appendChild(imgWrap);
          triggerUpdate();
        };
        reader.readAsDataURL(file);
      });
      fileInput.value = '';
    });

    if (savedGalleryData) {
      if (savedGalleryData.layout) layoutSelect.value = savedGalleryData.layout;
      if (savedGalleryData.images) {
        savedGalleryData.images.forEach(src => {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'uploaded-image-item';
          imgWrap.style.position = 'relative';
          imgWrap.style.aspectRatio = '1';
          imgWrap.style.borderRadius = '8px';
          imgWrap.style.overflow = 'hidden';
          imgWrap.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          imgWrap.innerHTML = `
            <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-remove-img" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px;">✕</button>
          `;
          imgWrap.querySelector('.btn-remove-img').addEventListener('click', () => {
            imgWrap.remove();
            triggerUpdate();
          });
          previewGrid.appendChild(imgWrap);
        });
      }
    }

    triggerUpdate();
  };

  const addMapBlock = (savedMapData = null) => {
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const block = createBlockWrapper('지도 영역', icon, 'map-block');

    const address = savedMapData?.address || '';
    const mapIframe = savedMapData?.iframe || '';
    const desc = savedMapData?.desc || '';

    const contentWrap = document.createElement('div');
    contentWrap.style.padding = '1.5rem';
    contentWrap.innerHTML = `
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:4px;">장소명 / 주소</label>
        <input type="text" class="form-control map-address-input" style="width:100%; border-radius:8px; border:1px solid #d1d5db; padding:8px; font-size:0.85rem;" placeholder="예: 서울 송파구 올림픽로 25" value="${address}">
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:4px;">지도 HTML (공유 iframe 소스)</label>
        <textarea class="form-control map-iframe-input" style="width:100%; border-radius:8px; border:1px solid #d1d5db; padding:8px; height:80px; font-family:monospace; font-size:0.8rem;" placeholder="<iframe src='...' ...></iframe>">${mapIframe}</textarea>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:4px;">위치 부가 설명</label>
        <input type="text" class="form-control map-desc-input" style="width:100%; border-radius:8px; border:1px solid #d1d5db; padding:8px; font-size:0.85rem;" placeholder="예: 올림픽공원 평화의광장 정문 앞" value="${desc}">
      </div>
      <div class="gallery-preview-container" style="display:none;"></div>
    `;
    block.appendChild(contentWrap);
    blocksContainer.appendChild(block);
    bindBlockControls(block);

    const triggerUpdate = () => {
      updateMapPreview(block);
      syncLivePreview(tab, blocksContainer);
    };

    contentWrap.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('input', triggerUpdate);
    });

    triggerUpdate();
  };

  const updateMapPreview = (block) => {
    const address = block.querySelector('.map-address-input').value;
    const iframe = block.querySelector('.map-iframe-input').value;
    const desc = block.querySelector('.map-desc-input').value;
    const preview = block.querySelector('.gallery-preview-container');

    let html = `
      <div class="view-map-block" style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <div style="width:32px; height:32px; background:#eff6ff; color:#3b82f6; border-radius:50%; display:flex; align-items:center; justify-content:center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div>
            <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:#1f2937;">${address || '장소 위치 안내'}</h4>
            ${desc ? `<p style="margin:2px 0 0; font-size:0.8rem; color:#6b7280;">${desc}</p>` : ''}
          </div>
        </div>
        ${iframe ? `
          <div class="map-iframe-container" style="border-radius:8px; overflow:hidden; border:1px solid #f3f4f6; aspect-ratio:16/9; max-height:280px; width:100%;">
            ${iframe}
          </div>
        ` : `
          <div style="height:120px; background:#f3f4f6; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#9ca3af; font-size:0.85rem;">
            지도가 등록되지 않았습니다.
          </div>
        `}
      </div>
    `;
    preview.innerHTML = html;
  };

  const addListBlock = (savedListData = null) => {
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;
    const block = createBlockWrapper('타임라인 / 리스트', icon, 'list-block');

    const contentWrap = document.createElement('div');
    contentWrap.style.padding = '1.5rem';
    contentWrap.innerHTML = `
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:4px;">리스트 스타일</label>
        <select class="form-control list-style-select" style="width:100%; border-radius:8px; border:1px solid #d1d5db; padding:8px;">
          <option value="timeline">Timeline (타임라인/시간표)</option>
          <option value="bullet">Bullet (요약 정리형)</option>
          <option value="card">Card (카드 나열형)</option>
        </select>
      </div>
      <div style="margin-bottom:1rem; font-weight:700; color:var(--text-main); font-size:0.9rem;">리스트 항목</div>
      <div class="list-items-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:1rem;"></div>
      <button class="btn btn-add-row-item" style="width:100%; background:#eff6ff; border:1px dashed #bfdbfe; padding:8px; border-radius:8px; color:#1d4ed8; font-weight:600; font-size:0.8rem; cursor:pointer;">+ 항목 추가</button>
      <div class="gallery-preview-container" style="display:none;"></div>
    `;
    block.appendChild(contentWrap);
    blocksContainer.appendChild(block);
    bindBlockControls(block);

    const itemsContainer = contentWrap.querySelector('.list-items-container');
    const styleSelect = contentWrap.querySelector('.list-style-select');

    const triggerUpdate = () => {
      updateListPreview(block);
      syncLivePreview(tab, blocksContainer);
    };

    const addRow = (title = '', desc = '') => {
      const row = document.createElement('div');
      row.className = 'list-row-item';
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.alignItems = 'center';
      row.innerHTML = `
        <input type="text" class="form-control row-title" style="flex:1; border-radius:6px; border:1px solid #d1d5db; padding:6px; font-size:0.8rem;" placeholder="시간/대분류" value="${title}">
        <input type="text" class="form-control row-desc" style="flex:2; border-radius:6px; border:1px solid #d1d5db; padding:6px; font-size:0.8rem;" placeholder="내용" value="${desc}">
        <button class="btn-remove-row" style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; color:#ef4444; cursor:pointer;">✕</button>
      `;

      row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
        triggerUpdate();
      });

      row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', triggerUpdate);
      });

      itemsContainer.appendChild(row);
      triggerUpdate();
    };

    contentWrap.querySelector('.btn-add-row-item').addEventListener('click', () => addRow());
    styleSelect.addEventListener('change', triggerUpdate);

    if (savedListData && savedListData.items) {
      styleSelect.value = savedListData.style || 'timeline';
      savedListData.items.forEach(item => addRow(item.title, item.desc));
    } else {
      addRow('14:00', '페스티벌 게이트 오픈');
      addRow('16:00', '1부 스페셜 콘서트');
    }
  };

  const updateListPreview = (block) => {
    const style = block.querySelector('.list-style-select').value;
    const rows = block.querySelectorAll('.list-row-item');
    const preview = block.querySelector('.gallery-preview-container');

    let html = '';
    if (rows.length === 0) {
      preview.innerHTML = `<div style="padding:1rem; text-align:center; color:#9ca3af; font-size:0.8rem;">등록된 항목이 없습니다.</div>`;
      return;
    }

    if (style === 'timeline') {
      html = `<div class="view-timeline" style="padding:1rem; border-left:2px solid #e5e7eb; margin:0.5rem 0 1.5rem 1rem; display:flex; flex-direction:column; gap:1.25rem;">`;
      rows.forEach(row => {
        const title = row.querySelector('.row-title').value;
        const desc = row.querySelector('.row-desc').value;
        html += `
          <div class="timeline-item" style="position:relative; padding-left:1rem;">
            <div class="timeline-dot" style="position:absolute; left:-21px; top:4px; width:10px; height:10px; border-radius:50%; background:#3b82f6; border:2px solid #fff; box-shadow:0 0 0 2px #eff6ff;"></div>
            <strong style="display:block; font-size:0.85rem; color:#2563eb; margin-bottom:2px;">${title || '대기'}</strong>
            <span style="font-size:0.9rem; color:#4b5563;">${desc || '미입력'}</span>
          </div>
        `;
      });
      html += `</div>`;
    } else if (style === 'bullet') {
      html = `<ul class="view-bullet-list" style="margin:0.5rem 0 1.5rem 1rem; padding-left:1.25rem; display:flex; flex-direction:column; gap:8px;">`;
      rows.forEach(row => {
        const title = row.querySelector('.row-title').value;
        const desc = row.querySelector('.row-desc').value;
        html += `
          <li style="color:#4b5563; font-size:0.9rem; line-height:1.4;">
            <strong style="color:#1f2937;">${title ? title + ' : ' : ''}</strong>${desc || '미입력'}
          </li>
        `;
      });
      html += `</ul>`;
    } else if (style === 'card') {
      html = `<div class="view-card-list" style="display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:1.5rem;">`;
      rows.forEach(row => {
        const title = row.querySelector('.row-title').value;
        const desc = row.querySelector('.row-desc').value;
        html += `
          <div style="background:#f9fafb; border:1px solid #f3f4f6; border-radius:8px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.85rem; font-weight:700; color:#3b82f6; background:#eff6ff; padding:2px 8px; border-radius:4px;">${title || '시간'}</span>
            <span style="font-size:0.9rem; font-weight:500; color:#374151; flex:1; text-align:right; margin-left:1rem;">${desc || '내용'}</span>
          </div>
        `;
      });
      html += `</div>`;
    }

    preview.innerHTML = html;
  };

  const addNoticeBlock = (savedNoticeData = null) => {
    const icon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const block = createBlockWrapper('공지 배너', icon, 'notice-block');

    const content = savedNoticeData?.content || '';
    const type = savedNoticeData?.type || 'warning';

    const contentWrap = document.createElement('div');
    contentWrap.style.padding = '1.5rem';
    contentWrap.innerHTML = `
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:4px;">배너 테마</label>
        <select class="form-control notice-type-select" style="width:100%; border-radius:8px; border:1px solid #d1d5db; padding:8px;">
          <option value="warning">⚠️ 경고 (주황색)</option>
          <option value="info">ℹ️ 정보 (파란색)</option>
          <option value="success">✅ 확인 (초록색)</option>
        </select>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:4px;">공지 문구</label>
        <textarea class="form-control notice-text-input" style="width:100%; border-radius:8px; border:1px solid #d1d5db; padding:8px; height:80px; font-size:0.85rem;" placeholder="예: 우천 시에도 정상 진행됩니다.">${content}</textarea>
      </div>
      <div class="gallery-preview-container" style="display:none;"></div>
    `;
    block.appendChild(contentWrap);
    blocksContainer.appendChild(block);
    bindBlockControls(block);

    const typeSelect = contentWrap.querySelector('.notice-type-select');
    const textInput = contentWrap.querySelector('.notice-text-input');

    if (savedNoticeData) {
      typeSelect.value = type;
    }

    const triggerUpdate = () => {
      updateNoticePreview(block);
      syncLivePreview(tab, blocksContainer);
    };

    typeSelect.addEventListener('change', triggerUpdate);
    textInput.addEventListener('input', triggerUpdate);

    triggerUpdate();
  };

  const updateNoticePreview = (block) => {
    const type = block.querySelector('.notice-type-select').value;
    const text = block.querySelector('.notice-text-input').value || '공지 내용을 입력하세요.';
    const preview = block.querySelector('.gallery-preview-container');

    const styles = {
      warning: { bg: '#fffbeb', border: '#fef3c7', text: '#b45309', icon: '⚠️' },
      info: { bg: '#eff6ff', border: '#dbeafe', text: '#1d4ed8', icon: 'ℹ️' },
      success: { bg: '#f0fdf4', border: '#dcfce7', text: '#15803d', icon: '✅' }
    };

    const currentStyle = styles[type] || styles.warning;

    let html = `
      <div class="view-notice-block" style="background:${currentStyle.bg}; border:1px solid ${currentStyle.border}; border-radius:8px; padding:12px 16px; display:flex; gap:10px; align-items:flex-start; margin-bottom:1.5rem;">
        <span style="font-size:1.1rem; line-height:1.2;">${currentStyle.icon}</span>
        <span style="font-size:0.875rem; color:${currentStyle.text}; font-weight:600; line-height:1.4; white-space:pre-wrap;">${text}</span>
      </div>
    `;
    preview.innerHTML = html;
  };

  addActions.querySelector('.btn-add-text-block').addEventListener('click', () => addTextBlock('<p><br></p>'));
  addActions.querySelector('.btn-add-gallery-block').addEventListener('click', () => addGalleryBlock());
  addActions.querySelector('.btn-add-map-block').addEventListener('click', () => addMapBlock());
  addActions.querySelector('.btn-add-list-block').addEventListener('click', () => addListBlock());
  addActions.querySelector('.btn-add-notice-block').addEventListener('click', () => addNoticeBlock());

  if (html.trim() && !html.includes('등록된 상세 설명 이미지가 제공되지 않았습니다.') && !html.includes('등록된 공지사항이 없습니다.')) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const children = Array.from(temp.children);
    if (children.length > 0) {
      children.forEach(child => {
        if (child.classList.contains('view-text-block')) {
          addTextBlock(child.innerHTML);
        } else if (child.classList.contains('view-map-block')) {
          const address = child.querySelector('h4') ? child.querySelector('h4').textContent.trim() : '';
          const pEl = child.querySelector('p');
          const desc = pEl ? pEl.textContent.trim() : '';
          const iframeContainer = child.querySelector('.map-iframe-container');
          const iframe = iframeContainer ? iframeContainer.innerHTML.trim() : '';
          addMapBlock({ address, iframe, desc });
        } else if (child.classList.contains('view-timeline') || child.classList.contains('view-bullet-list') || child.classList.contains('view-card-list')) {
          let style = 'timeline';
          const items = [];
          if (child.classList.contains('view-timeline')) {
            style = 'timeline';
            child.querySelectorAll('.timeline-item').forEach(item => {
              const strong = item.querySelector('strong');
              const span = item.querySelector('span');
              items.push({
                title: strong ? strong.textContent.trim() : '',
                desc: span ? span.textContent.trim() : ''
              });
            });
          } else if (child.classList.contains('view-bullet-list')) {
            style = 'bullet';
            child.querySelectorAll('li').forEach(item => {
              const strong = item.querySelector('strong');
              const title = strong ? strong.textContent.replace(/\s*:\s*$/, '').trim() : '';
              let desc = item.textContent;
              if (strong) desc = desc.replace(strong.textContent, '');
              items.push({ title, desc: desc.trim() });
            });
          } else if (child.classList.contains('view-card-list')) {
            style = 'card';
            Array.from(child.children).forEach(item => {
              const titleSpan = item.querySelector('span:first-child');
              const descSpan = item.querySelector('span:last-child');
              items.push({
                title: titleSpan ? titleSpan.textContent.trim() : '',
                desc: descSpan ? descSpan.textContent.trim() : ''
              });
            });
          }
          addListBlock({ style, items });
        } else if (child.classList.contains('view-notice-block')) {
          const contentSpan = child.querySelector('span:last-child');
          const content = contentSpan ? contentSpan.textContent.trim() : '';
          let type = 'warning';
          const bg = child.style.backgroundColor;
          if (bg.includes('rgb(239, 246, 255)') || bg.includes('#eff6ff')) type = 'info';
          else if (bg.includes('rgb(240, 253, 244)') || bg.includes('#f0fdf4')) type = 'success';
          addNoticeBlock({ content, type });
        } else if (child.classList.contains('gallery-grid') || child.classList.contains('gallery-masonry') || child.classList.contains('gallery-mosaic') || child.classList.contains('gallery-slider') || child.classList.contains('gallery-coverflow')) {
          let layout = 'grid';
          if (child.classList.contains('gallery-masonry')) layout = 'masonry';
          else if (child.classList.contains('gallery-mosaic')) layout = 'mosaic';
          else if (child.classList.contains('gallery-slider')) layout = 'carousel';
          else if (child.classList.contains('gallery-coverflow')) layout = 'coverflow';
          const images = Array.from(child.querySelectorAll('img')).map(img => img.src);
          addGalleryBlock({ layout, images });
        } else {
          addTextBlock(child.outerHTML);
        }
      });
    } else {
      addTextBlock(html);
    }
  } else {
    addTextBlock('<p>내용을 입력하세요.</p>');
  }

  syncLivePreview(tab, blocksContainer);
}

window.updateGalleryPreviewOrig = window.updateGalleryPreview;
window.updateGalleryPreview = function (targetId) {
  const accordionItem = document.querySelector(`.builder-accordion-item[data-target-id="${targetId}"]`);
  if (!accordionItem) return;

  const block = accordionItem.querySelector('.gallery-block');
  if (!block) return;

  const inner = block.querySelector('.gallery-preview-container');
  if (!inner) return;

  const layout = block.querySelector('.gallery-layout-select')?.value || 'grid';
  const imgElements = block.querySelectorAll('.uploaded-image-grid img');
  const images = Array.from(imgElements).map(img => img.src);

  if (images.length === 0) {
    inner.innerHTML = '<div style="padding:2rem; border:1px dashed #d1d5db; border-radius:12px; background:#f9fafb; color:#9ca3af; font-size:0.85rem; text-align:center;">등록된 이미지가 없습니다.</div>';
    return;
  }

  let html = '';
  if (layout === 'grid') {
    html = '<div class="gallery-grid">';
    images.forEach(src => { html += `<div class="gallery-grid-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'masonry') {
    html = '<div class="gallery-masonry">';
    images.forEach(src => { html += `<div class="gallery-masonry-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'mosaic') {
    html = `<div class="gallery-mosaic layout-${Math.min(images.length, 5)}">`;
    images.forEach((src, idx) => { html += `<div class="gallery-mosaic-item item-${idx + 1}"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'coverflow') {
    html = '<div class="gallery-coverflow">';
    images.forEach(src => { html += `<div class="gallery-coverflow-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'slider' || layout === 'carousel') {
    html = '<div class="gallery-slider">';
    images.forEach(src => { html += `<div class="gallery-slider-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  }

  inner.innerHTML = html;
}

function handleAddSection(customTitle) {
  const title = customTitle || '새 섹션';
  const sectionType = 'text';

  const newId = 'tab-custom-' + Date.now();
  const tabsSection = document.getElementById('detailTabsSection');

  const tabsHeader = document.querySelector('.detail-tabs-header');
  if (tabsHeader) {
    const newBtn = document.createElement('button');
    newBtn.className = 'detail-tab-btn';
    newBtn.dataset.target = newId;
    newBtn.textContent = title;
    tabsHeader.appendChild(newBtn);

    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
      newBtn.classList.add('active');
      const targetContent = document.getElementById(newId);
      if (targetContent) targetContent.classList.add('active');
    });

    // Auto focus and scroll
    setTimeout(() => {
      newBtn.click();
      tabsHeader.scrollLeft = tabsHeader.scrollWidth;
    }, 10);
  }

  const newContent = document.createElement('div');
  newContent.className = 'detail-tab-content';
  newContent.id = newId;
  newContent.innerHTML = `
    <h2 class="tab-title">${title}</h2>
    <div class="tab-content-inner"></div>
  `;
  tabsSection.appendChild(newContent);

  const inner = newContent.querySelector('.tab-content-inner');
  makeBlockEditor(newContent, inner);

  const listWrap = document.getElementById('builderAccordionList');
  const items = listWrap.querySelectorAll('.builder-accordion-item');
  addAccordionItem(listWrap, title, newId, items.length);

  const newItem = listWrap.lastElementChild;
  newItem.querySelector('.builder-accordion-header').click();
}

document.addEventListener('DOMContentLoaded', () => {
  // 관리자 권한 확인 (여기서는 데모용으로 항상 표시)
  
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' || sessionStorage.getItem('isLoggedIn') === 'true' || !!localStorage.getItem('userToken') || !!sessionStorage.getItem('userToken');
  const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'CLIENT';
  const globalEdit = document.getElementById('globalEditControls');
  if (globalEdit && isLoggedIn && userRole === 'ADMIN') {
    globalEdit.style.display = 'flex';
  }


  const switchBtn = document.getElementById('btnToggleEditModeSwitch');
  if (switchBtn) {
    switchBtn.addEventListener('change', (e) => {
      toggleEditMode(e.target.checked);
    });
  }

  const btnSave = document.getElementById('btnSaveAllEdits');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const tabsSection = document.getElementById('detailTabsSection');
      if (!tabsSection) return;

      // 현재 에디터 상태를 HTML에 반영 (비활성화)
      const wasEditMode = isEditMode;
      if (wasEditMode) {
        destroyMainAreaEditors(tabsSection);
      }

      const htmlContent = tabsSection.innerHTML;
      const eventNo = getEventNo();

      // 1. DB에 저장 시도 (서버 → Supabase 폴백 순으로 api.js가 처리)
      btnSave.disabled = true;
      btnSave.textContent = '저장 중...';
      try {
        const result = await eventApi.saveDescriptionHtml(eventNo, htmlContent);
        if (result) {
          // 2. localStorage에도 백업 저장 (오프라인 대비)
          localStorage.setItem(`festio_event_${eventNo}_tabs`, htmlContent);
          Toast.success('✅ 이벤트 상세 내용이 DB에 저장되었습니다.');
        } else {
          // DB 저장 실패 → localStorage에만 저장
          localStorage.setItem(`festio_event_${eventNo}_tabs`, htmlContent);
          Toast.warn('⚠️ DB 저장에 실패하여 브라우저에 임시 저장되었습니다.');
        }
      } catch (err) {
        localStorage.setItem(`festio_event_${eventNo}_tabs`, htmlContent);
        Toast.warn('⚠️ DB 저장에 실패하여 브라우저에 임시 저장되었습니다.');
        console.error('saveDescriptionHtml error:', err);
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = '저장';
      }

      // 편집 모드였다면 에디터 다시 활성화
      if (wasEditMode) {
        initMainAreaEditors(tabsSection);
      }
    });
  }

  // 커스텀 권종 선택 드롭다운 로직
  const ticketDropdown = document.getElementById('ticketTypeDropdown');
  const ticketSelected = document.getElementById('ticketTypeSelected');
  const ticketOptions = document.getElementById('ticketTypeOptions');
  const ticketText = document.getElementById('ticketTypeText');
  const nativeSelect = document.getElementById('ticketTypeSelect');

  if (ticketDropdown && ticketSelected && ticketOptions && nativeSelect) {
    ticketSelected.addEventListener('click', () => {
      ticketDropdown.classList.toggle('open');
    });

    const options = ticketOptions.querySelectorAll('.custom-dropdown-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        ticketText.textContent = opt.textContent;
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        nativeSelect.value = opt.getAttribute('data-value');
        ticketDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!ticketDropdown.contains(e.target)) {
        ticketDropdown.classList.remove('open');
      }
    });
  }

  // 상/하 스크롤 FAB 버튼 로직
  const fabWrap = document.querySelector('.scroll-fab-wrap');
  const fabUp = document.getElementById('fab-up');
  const fabDown = document.getElementById('fab-down');
  const footer = document.querySelector('footer') || document.querySelector('.site-footer');

  if (fabWrap) {
    window.addEventListener('scroll', () => {
      // 보이기/숨기기
      if (window.scrollY > 300) {
        fabWrap.classList.add('visible');
      } else {
        fabWrap.classList.remove('visible');
      }

      // 푸터 침범 방지
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        if (footerRect.top < windowHeight) {
          fabWrap.style.bottom = (windowHeight - footerRect.top + 20) + 'px';
        } else {
          fabWrap.style.bottom = '120px';
        }
      }
    });
  }

  if (fabUp) {
    fabUp.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (fabDown) {
    fabDown.addEventListener('click', () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }
});

window.toggleChartDataset = function (index) {
  if (window.genderChart) {
    const meta = window.genderChart.getDatasetMeta(0);
    meta.data[index].hidden = !meta.data[index].hidden;
    window.genderChart.update();
    const legendEl = index === 0 ? document.getElementById('legend-male') : document.getElementById('legend-female');
    if (legendEl) {
      legendEl.style.opacity = meta.data[index].hidden ? '0.3' : '1';
    }
  }
};



function makeVenueEditor(tab, sidebarContainer) {
  const inner = tab.querySelector('.tab-content-inner');
  if (!inner) return;

  const currentAddress = inner.querySelector('.venue-address-text')?.textContent || '';
  const currentTransit = inner.querySelector('#transitContent')?.innerHTML || '';

  const editorHtml = `
    <div class="venue-editor-wrap" style="background: var(--bg-surface1); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px dashed var(--border-default);">
      <div style="margin-bottom: 1rem;">
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">오시는 길 주소</label>
        <div style="display:flex; gap: 0.5rem; flex-direction:column;">
          <input type="text" id="venueEditAddress" class="form-control" style="width: 100%; border-radius:8px;" placeholder="예: 올림픽공원 체조경기장" value="${currentAddress === '등록된 주소가 없습니다.' ? '' : currentAddress}">
          <button type="button" class="btn btn-primary" id="btnUpdateVenueMap" style="border-radius:8px; width:100%;">지도 및 안내 업데이트</button>
        </div>
      </div>
      <div>
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">대중교통 안내</label>
        <textarea id="venueEditTransit" class="form-control" style="width:100%; min-height: 100px; resize: vertical; border-radius:8px;" placeholder="지하철, 버스 등 교통 안내를 입력하세요">${currentTransit === '대중교통 정보가 등록되지 않았습니다.' ? '' : currentTransit.replace(/<br>/g, '\n')}</textarea>
      </div>
    </div>
  `;
  sidebarContainer.innerHTML = editorHtml;

  const btnUpdate = sidebarContainer.querySelector('#btnUpdateVenueMap');
  const addressInput = sidebarContainer.querySelector('#venueEditAddress');
  const transitInput = sidebarContainer.querySelector('#venueEditTransit');

  btnUpdate.addEventListener('click', () => {
    const address = addressInput.value.trim();
    const transit = transitInput.value.trim();

    const addressTextEl = inner.querySelector('.venue-address-text');
    const transitContentEl = inner.querySelector('#transitContent');
    const googleMapFrame = inner.querySelector('#googleMap');

    if (addressTextEl) addressTextEl.textContent = address || '등록된 주소가 없습니다.';
    if (transitContentEl) transitContentEl.innerHTML = transit.replace(/\n/g, '<br>') || '대중교통 정보가 등록되지 않았습니다.';

    if (googleMapFrame && address) {
      googleMapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    }

    let linksWrap = inner.querySelector('#directionsLinksWrap');
    if (!linksWrap) {
      linksWrap = document.createElement('div');
      linksWrap.id = 'directionsLinksWrap';
      inner.appendChild(linksWrap);
    }

    if (address) {
      linksWrap.innerHTML = `
        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <a href="https://map.kakao.com/link/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #FEE500; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 3c-5.523 0-10 3.514-10 7.85 0 2.804 1.83 5.253 4.606 6.647l-1.18 4.34c-.05.18.17.33.32.22l5.12-3.41c.37.04.74.06 1.13.06 5.523 0 10-3.514 10-7.85C22 6.514 17.523 3 12 3z"/></svg>카카오맵</a>
          <a href="https://map.naver.com/v5/search/${encodeURIComponent(address)}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #03C75A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.084 12.637L8.03 2.127C7.625 1.597 7.026 1.334 6.386 1.334H2v21.332h5.922V11.233l8.053 10.51C16.42 22.316 17.02 22.58 17.658 22.58H22V1.248h-5.916v11.389z"/></svg>네이버지도</a>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=transit" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #4285F4; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;"><svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>구글 길찾기</a>
        </div>
      `;
    } else {
      linksWrap.innerHTML = '';
    }

    Toast.success('오시는 길 정보가 라이브 화면에 업데이트되었습니다.');
  });
}
