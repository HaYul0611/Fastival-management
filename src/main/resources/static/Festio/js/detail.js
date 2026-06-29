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
let _freeTicketQty = {};

/* ── Toss Payments 설정 ─────────────────────────────────────── */
const TOSS_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo';

/* ── URL 파라미터 ─────────────────────────────────────────────
   사용 예시: detail.html?eventNo=1
─────────────────────────────────────────────────────────── */
function getEventNo() {
  const params = new URLSearchParams(window.location.search);
  const eventNo = parseInt(params.get('eventNo')) || 1;
  sessionStorage.setItem('currentFestivalId', eventNo);
  return eventNo;
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

  // 최근 본 상품 기록
  if (window.RecentViewed) {
    window.RecentViewed.add({
      eventNo: getEventNo(),
      name: detail.eventName,
      thumbnailUrl: detail.thumbnailUrl || detail.thumbnail_url
    });
  }

  // 장소 탭 지도 및 링크 동기화
  const tabVenue = document.getElementById('tab-venue');
  if (tabVenue) {
    const inner = tabVenue.querySelector('.tab-content-inner');
    let address = detail.venue || '등록된 주소가 없습니다.';

    if (inner) {
      const savedCustomAddressEl = inner.querySelector('#savedCustomAddress');
      if (savedCustomAddressEl && savedCustomAddressEl.textContent.trim()) {
        address = savedCustomAddressEl.innerHTML.replace(/<br>/gi, '\\n'); // 원래 포맷으로 복원
        detail.venue = address;
        _eventDetail.venue = address;
      }

      const formattedAddress = address.replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(' (지번:', '<br>(지번:');

      // 0. Extract transit text
      let transitContentHtml = '<p>대중교통 정보가 없습니다.</p>';
      const firstTransit = inner.querySelector('#transitContent');
      if (firstTransit) {
        transitContentHtml = firstTransit.innerHTML;
      }

      // 옛날 데이터(카카오맵 네이버지도 구글 길찾기) 문자열 레벨 청소
      let cleanTransit = transitContentHtml;
      cleanTransit = cleanTransit.replace(/<[^>]*>카카오맵<\/[^>]*>/gi, '');
      cleanTransit = cleanTransit.replace(/<[^>]*>네이버지도<\/[^>]*>/gi, '');
      cleanTransit = cleanTransit.replace(/<[^>]*>구글\s*길찾기<\/[^>]*>/gi, '');
      cleanTransit = cleanTransit.replace(/카카오맵|네이버지도|구글\s*길찾기/gi, '');
      if (!cleanTransit.replace(/<[^>]*>/g, '').trim()) {
        cleanTransit = '<p>대중교통 정보가 없습니다.</p>';
      }
      transitContentHtml = cleanTransit;

      // 장소 탭 내부는 무조건 동적으로 재생성되므로 기존 찌꺼기(인천 등) 완벽히 초기화
      inner.innerHTML = '';

      // 1. Map Update (Recreate cleanly at the top)
      let mapWrap = document.createElement('div');
      mapWrap.className = 'venue-map-wrap';
      mapWrap.style.height = '400px';
      mapWrap.style.width = '100%';
      mapWrap.style.background = '#e9ecef';
      mapWrap.style.borderRadius = '8px';
      mapWrap.style.overflow = 'hidden';
      mapWrap.style.marginBottom = '2rem';
      inner.insertBefore(mapWrap, inner.firstChild);

      let googleMapFrame = document.createElement('iframe');
      googleMapFrame.id = 'googleMap';
      googleMapFrame.style.border = '0';
      googleMapFrame.style.display = 'block';
      googleMapFrame.style.width = '100%';
      googleMapFrame.style.height = '100%';
      googleMapFrame.setAttribute('loading', 'lazy');

      // 구글맵 렌더링을 페이지 로드 1.5초 뒤로 지연시켜 초기 체감 속도 극대화
      setTimeout(() => {
        googleMapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(address.split(' 상세:')[0])}&output=embed`;
      }, 1500);

      mapWrap.appendChild(googleMapFrame);

      // [TODO] 카카오맵 API 연동 시 아래 코드를 사용 (현재는 인증키 문제로 구글맵 유지)
      /*
      let kakaoMapDiv = document.createElement('div');
      kakaoMapDiv.id = 'kakaoMapContainer';
      kakaoMapDiv.style.width = '100%';
      kakaoMapDiv.style.height = '100%';
      kakaoMapDiv.style.display = 'none'; // 구글맵 대체 시 display: block
      mapWrap.appendChild(kakaoMapDiv);
      
      if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
        let geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(address.split(' 상세:')[0], function(result, status) {
          if (status === kakao.maps.services.Status.OK) {
            let coords = new kakao.maps.LatLng(result[0].y, result[0].x);
            let mapOption = { center: coords, level: 3 };
            let map = new kakao.maps.Map(kakaoMapDiv, mapOption);
            let marker = new kakao.maps.Marker({ map: map, position: coords });
          }
        });
      }
      */

      // 2. Text Address Update
      let addressWrap = document.createElement('div');
      addressWrap.id = 'venueAddressWrap';
      addressWrap.style.marginBottom = '2rem';
      addressWrap.innerHTML = `<h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 0; margin-bottom: 12px; line-height: 1.4;">${formattedAddress}</h4>`;
      mapWrap.after(addressWrap);

      // 3. Transit Editor Sync Area Update
      let transitInfoArea = document.createElement('div');
      transitInfoArea.id = 'transitInfoArea';
      transitInfoArea.className = 'venue-transit-info';
      transitInfoArea.style.padding = '1.5rem';
      transitInfoArea.style.background = 'var(--bg-surface1)';
      transitInfoArea.style.borderRadius = '8px';
      transitInfoArea.style.marginBottom = '2rem';
      addressWrap.after(transitInfoArea);

      transitInfoArea.innerHTML = `
        <h4 style="margin-top:0; margin-bottom:1rem; font-size:1.1rem; color:var(--text-main);">대중교통 안내</h4>
        <div id="transitContent" style="color:var(--text-sub); line-height:1.6;">${transitContentHtml}</div>
      `;

      // 4. Directions Links Wrap
      let linksWrap = inner.querySelector('#directionsLinksWrap');
      if (!linksWrap) {
        linksWrap = document.createElement('div');
        linksWrap.id = 'directionsLinksWrap';
        transitInfoArea.after(linksWrap);
      }
      linksWrap.innerHTML = `
        <div style="margin-top: 1.5rem;">
          <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 0; margin-bottom: 12px; line-height: 1.4;">길찾기</h4>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <a href="https://map.kakao.com/link/search/${encodeURIComponent(address.split(' (지번:')[0].split('\\n')[0].split('\n')[0].split(' 상세:')[0])}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #FEE500; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 3c-5.523 0-10 3.514-10 7.85 0 2.804 1.83 5.253 4.606 6.647l-1.18 4.34c-.05.18.17.33.32.22l5.12-3.41c.37.04.74.06 1.13.06 5.523 0 10-3.514 10-7.85C22 6.514 17.523 3 12 3z"/></svg>카카오맵
            </a>
            <a href="https://map.naver.com/v5/search/${encodeURIComponent(address.split(' (지번:')[0].split('\\n')[0].split('\n')[0].split(' 상세:')[0])}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #03C75A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.084 12.637L8.03 2.127C7.625 1.597 7.026 1.334 6.386 1.334H2v21.332h5.922V11.233l8.053 10.51C16.42 22.316 17.02 22.58 17.658 22.58H22V1.248h-5.916v11.389z"/></svg>네이버지도
            </a>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.split(' (지번:')[0].split('\\n')[0].split('\n')[0].split(' 상세:')[0])}&travelmode=transit" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #4285F4; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>구글 길찾기
            </a>
          </div>
        </div>
      `;
    }
  }

  // ticketMode에 따른 레이아웃 분기 및 우측 예매 바 최적화
  const layoutEl = document.querySelector('.detail-layout');
  const ctaZoneName = document.getElementById('ctaZoneName');
  const ctaTotal = document.getElementById('ctaTotal');
  const btnBook = document.getElementById('btn-book');

  if (layoutEl) {
    if (detail.ticketMode === 'FREE') {
      layoutEl.classList.add('free-mode');

      // 우측 CTA 바 텍스트 최적화
      if (ctaZoneName) ctaZoneName.textContent = '일반 입장권 (자유석)';

      // 가격 범위 계산
      if (ctaTotal && detail.zones && detail.zones.length > 0) {
        const prices = detail.zones.map(z => z.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        if (minPrice === maxPrice) {
          ctaTotal.textContent = `￦ ${minPrice.toLocaleString()}원`;
        } else {
          ctaTotal.textContent = `￦ ${minPrice.toLocaleString()}원 ~`;
        }
      } else if (ctaTotal) {
        ctaTotal.textContent = '￦ -원';
      }

      if (btnBook) {
        btnBook.innerHTML = `
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
            <path d="M14 4h6v6" />
            <path d="M10 14L20 4" />
          </svg>
          입장권 예매하기
        `;
      }

      // 안내 카드 삽입 (이미 없으면 추가)
      const bookingCta = document.getElementById('bookingCta');
      if (bookingCta && !document.getElementById('freeModeNoticeCard')) {
        const noticeCard = document.createElement('div');
        noticeCard.id = 'freeModeNoticeCard';
        noticeCard.className = 'free-mode-notice-card';
        noticeCard.innerHTML = `
          <strong>📢 안내사항</strong>
          <p style="margin: 4px 0 0 0;">본 행사는 별도의 지정석이 없으며, 입장권을 구매하여 선착순으로 입장하는 자유석 행사입니다.</p>
        `;
        bookingCta.insertBefore(noticeCard, bookingCta.firstChild);
      }
    } else {
      layoutEl.classList.remove('free-mode');
      const noticeCard = document.getElementById('freeModeNoticeCard');
      if (noticeCard) noticeCard.remove();
    }
  }
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
async function initVenueMap(zones) {
  const svg = document.getElementById('venueSvgLayer');
  const bgOverlay = document.getElementById('venueBgOverlay');
  const legendContainer = document.getElementById('zoneLegendContainer');

  if (!svg || !zones || !Array.isArray(zones)) return;

  // 1. 기존 SVG 내용물 클리어
  svg.innerHTML = '';

  // 2. 동적 배경 도면 주입 (관리자가 저장한 배경 도면이 있을 때 SVG <image> 추가)
  const zoneWithBg = zones.find(z => z.mapBgUrl);
  if (zoneWithBg && zoneWithBg.mapBgUrl) {
    if (zoneWithBg.mapBgUrl.toLowerCase().includes('.svg')) {
      try {
        const response = await fetch(zoneWithBg.mapBgUrl);
        if (!response.ok) throw new Error('SVG 도면을 불러올 수 없습니다.');
        const svgText = await response.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgRoot = doc.documentElement;

        // 컨테이너 크기에 정합
        svgRoot.setAttribute('width', '100%');
        svgRoot.setAttribute('height', '100%');
        svgRoot.setAttribute('style', 'pointer-events: auto;');

        // 인라인 SVG 주입
        svg.appendChild(svgRoot);

        // SVG 내부에 임베디드된 <script> 태그 실행 비활성화 (전역 namespace 오염 및 selectZone 오버라이드 차단)
        /*
        svgRoot.querySelectorAll('script').forEach(oldScript => {
          try {
            const newScript = document.createElementNS('http://www.w3.org/2000/svg', 'script');
            newScript.textContent = oldScript.textContent;
            
            // 모든 기존 속성 및 href/xlink:href 네임스페이스 전사
            for (let i = 0; i < oldScript.attributes.length; i++) {
              const attr = oldScript.attributes[i];
              if (attr.name.includes('href')) {
                newScript.setAttributeNS('http://www.w3.org/1999/xlink', 'href', attr.value);
                newScript.setAttribute('href', attr.value);
              } else {
                newScript.setAttribute(attr.name, attr.value);
              }
            }
            
            // SVG DOM 내부에서 교체하여 실행 트리거
            oldScript.parentNode.replaceChild(newScript, oldScript);
          } catch (e) {
            console.error('SVG 임베디드 스크립트 실행 실패:', e);
          }
        });
        */

        // SVG 내의 구역 인터랙션 바인딩
        zones.forEach(zone => {
          if (!zone.svgPoints) return;

          // svgPoints 컬럼에 저장된 ID 값(예: zone-3F-L2)을 기준으로 SVG 내부 탐색
          const elementId = zone.svgPoints.replace('#', '');
          const targetEl = svgRoot.getElementById(elementId) || svgRoot.querySelector(`[id="${elementId}"]`);

          if (targetEl) {
            targetEl.setAttribute('data-zone-no', zone.zoneNo);
            targetEl.classList.add('zone-polygon');
            targetEl.style.cursor = 'pointer';

            // 마우스 호버 시 툴팁 추가
            const title = targetEl.querySelector('title') || document.createElementNS('http://www.w3.org/2000/svg', 'title');
            title.textContent = `${zone.zoneName} (잔여: ${zone.remainingCapacity}석 / 총: ${zone.totalCapacity}석)`;
            if (!targetEl.querySelector('title')) {
              targetEl.appendChild(title);
            }

            // 매진 시 비활성화 스타일 처리
            if (zone.remainingCapacity === 0) {
              targetEl.classList.add('sold-out');
              targetEl.setAttribute('aria-disabled', 'true');
              // 매진 시 자식 도형 색상 보정
              const fillElements = targetEl.querySelectorAll('.zone-fill, path, rect, polygon');
              fillElements.forEach(fe => {
                fe.style.fill = '#8592a3';
                fe.style.opacity = '0.5';
              });
            } else {
              targetEl.addEventListener('click', () => {
                // 이전 선택 스타일 해제
                svgRoot.querySelectorAll('.zone-polygon.selected, .selected').forEach(el => {
                  el.classList.remove('selected');
                });
                targetEl.classList.add('selected');
                selectZone(zone.zoneNo, zone, targetEl);
              });
            }
          }
        });
      } catch (err) {
        console.error('인라인 SVG 렌더링 실패, 폴백 복구:', err);
        renderFallbackImage(svg, zoneWithBg.mapBgUrl, zones);
      }
    } else {
      renderFallbackImage(svg, zoneWithBg.mapBgUrl, zones);
    }
  }
}

// 비트맵/폴백용 렌더러 함수 분리
function renderFallbackImage(svg, imgUrl, zones) {
  const bgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  bgImage.setAttribute('id', 'svgBgImage');
  bgImage.setAttribute('x', '0');
  bgImage.setAttribute('y', '0');
  bgImage.setAttribute('width', '800');
  bgImage.setAttribute('height', '660');
  bgImage.setAttribute('preserveAspectRatio', 'none');
  bgImage.setAttribute('style', 'opacity: 0.85; pointer-events: none;');
  bgImage.setAttribute('href', imgUrl);
  bgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imgUrl);
  svg.appendChild(bgImage);

  // 다각형 덧그리기
  zones.forEach(zone => {
    if (!zone.svgPoints) return;

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', zone.svgPoints);
    polygon.setAttribute('class', 'zone-polygon');
    polygon.setAttribute('data-zone-no', zone.zoneNo);

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${zone.zoneName} (잔여: ${zone.remainingCapacity}석 / 총: ${zone.totalCapacity}석)`;
    polygon.appendChild(title);

    if (zone.remainingCapacity === 0) {
      polygon.classList.add('sold-out');
      polygon.setAttribute('aria-disabled', 'true');
    } else {
      polygon.addEventListener('click', () => selectZone(zone.zoneNo, zone, polygon));
    }

    svg.appendChild(polygon);
  });
}

// 기존 범례 탐색을 지원하도록 임시 함수 래핑 처리
function continueVenueMapLegend(zones) {

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
  if (!zone && typeof _eventDetail !== 'undefined' && _eventDetail?.zones) {
    zone = _eventDetail.zones.find(z => Number(z.zoneNo) === Number(zoneNo));
  }

  if (!zone) {
    console.warn(`[selectZone] 구역 정보를 찾을 수 없습니다. zoneNo: ${zoneNo}`);
    if (window.Toast) {
      Toast.warning('구역 정보를 불러올 수 없습니다. 일치하는 데이터가 있는지 확인해 주세요.');
    }
    return;
  }

  _selectedZoneNo = zoneNo;
  _selectedZone = zone;

  // SVG 선택 강조
  $$('.zone-polygon').forEach(el => {
    if (el && el.classList) el.classList.remove('selected');
  });
  $$('.figma-template-zone').forEach(el => {
    if (el && el.classList) el.classList.remove('selected');
  });

  if (svgEl) {
    if (svgEl.classList) {
      svgEl.classList.add('selected');
    } else if (typeof svgEl.addClass === 'function') {
      svgEl.addClass('selected');
    }
  }

  // 범례 선택 강조
  $$('.zone-legend-item').forEach(li => {
    if (li && li.classList) li.classList.remove('active');
  });

  const legendItem = $(`.zone-legend-item[data-zone-no="${zoneNo}"]`);
  if (legendItem) {
    if (legendItem.classList) {
      legendItem.classList.add('active');
    } else if (typeof legendItem.addClass === 'function') {
      legendItem.addClass('active');
    }
  }

  // 구역 정보 패널 업데이트
  updateZoneInfoPanel(zone);

  // 수량 초기화 & 좌석 선택 모달 오픈 (ticket_mode에 따라 분기)
  _quantity = 1;
  _selectedSeats = [];
  updateQtyDisplay();
  updateCtaBar(zone);

  // ticket_mode 분기: SEAT → 기존 좌석 선택 모달, FREE → 입장권 선택 모달
  const ticketMode = _eventDetail?.ticketMode || 'SEAT';
  if (ticketMode === 'FREE') {
    openFreeTicketModal(zoneNo, zone);
  } else {
    openSeatSelectionModal(zoneNo, zone);
  }
}

function updateQtyDisplay() {
  const el = $('.qty-value');
  if (el) el.textContent = _quantity;
}

function updateZoneInfoPanel(zone) {
  const panel = document.querySelector('.zone-info-panel');
  if (!panel) return;

  if (panel.classList) {
    panel.classList.add('visible');
  } else if (typeof panel.addClass === 'function') {
    panel.addClass('visible');
  }

  const name = panel.querySelector('.zone-info-name');
  const soldRem = panel.querySelector('.zone-info-stat-value.remaining');
  const priceEl = panel.querySelector('.zone-info-stat-value.price');
  const capBar = panel.querySelector('.capacity-bar-fill');

  const zoneNameStr = zone.zoneName || zone.zoneCode || '구역';
  if (name) name.textContent = zoneNameStr;
  if (soldRem) soldRem.textContent = `${zone.remainingCapacity || 0}석`;
  if (priceEl) priceEl.textContent = formatKRW(zone.price);

  if (capBar) {
    const total = zone.totalCapacity || 1;
    const remaining = zone.remainingCapacity || 0;
    const pct = Math.round(remaining / total * 100);
    capBar.style.width = `${pct}%`;
    capBar.className = `capacity-bar-fill ${zone.zoneType === 'VIP' ? 'zone-vip' : zoneNameStr.includes('A') ? 'zone-a' : zoneNameStr.includes('B') ? 'zone-b' : 'standing'}`;
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
        const priceText = typeof formatKRW === 'function' ? formatKRW(s.price) : `${(s.price || 0).toLocaleString()}원`;
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
   FREE 입장권 선택 모달 (ticket_mode === 'FREE')
   - 워터밤 등 좌석 없는 행사용 입장권 선택 UI
   ═══════════════════════════════════════════════════════════ */
function openFreeTicketModal(zoneNo, selectedZone) {
  // 기존 모달이 있으면 제거
  const existingModal = document.getElementById('modal-free-ticket');
  if (existingModal) existingModal.remove();

  // 해당 페스티벌의 모든 구역(zone)을 등급 목록으로 사용
  const zones = _eventDetail?.zones || [];
  const eventName = _eventDetail?.eventName || '페스티벌';
  const eventNo = getEventNo();

  // 선택된 수량 상태
  const ticketQty = {};
  zones.forEach(z => { ticketQty[z.zoneNo] = 0; });

  // 모달 HTML 생성
  const modal = document.createElement('div');
  modal.id = 'modal-free-ticket';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(17, 24, 39, 0.6); z-index: 9999;
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(8px); opacity: 0; transition: opacity 0.3s ease;
  `;

  const zonesHtml = zones.map(z => {
    const isSoldOut = (z.remainingCapacity || 0) === 0;
    const priceText = typeof formatKRW === 'function' ? formatKRW(z.price) : `${(z.price || 0).toLocaleString()}원`;
    const gradeLabel = z.zoneType === 'VIP' ? '🌟 VIP 입장권' : `🎟️ ${z.zoneName}`;
    return `
      <div class="free-ticket-grade-row" data-zone-no="${z.zoneNo}" style="
        display: flex; align-items: center; justify-content: space-between;
        padding: 1rem 1.2rem; background: var(--bg-surface1, #f8f9fa);
        border-radius: 10px; border: 1px solid var(--border-default, #dee2e6);
        margin-bottom: 0.75rem; ${isSoldOut ? 'opacity:0.5;' : ''}
      ">
        <div>
          <p style="margin:0; font-weight:700; color:var(--text-main,#1f2937); font-size:1rem;">${gradeLabel}</p>
          <p style="margin:4px 0 0; font-size:0.85rem; color:var(--text-muted,#6b7280);">
            ${isSoldOut ? '매진' : `잔여 ${z.remainingCapacity}매`} | 1인당 ${priceText}
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <button class="free-qty-btn free-qty-minus" data-zone="${z.zoneNo}" ${isSoldOut ? 'disabled' : ''}
            style="width:32px; height:32px; border-radius:50%; border:2px solid var(--color-primary,#696cff);
            background:transparent; color:var(--color-primary,#696cff); font-size:1.2rem; font-weight:700;
            cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">−</button>
          <span class="free-qty-value" data-zone="${z.zoneNo}"
            style="min-width:24px; text-align:center; font-weight:700; font-size:1.1rem; color:var(--text-main,#1f2937);">0</span>
          <button class="free-qty-btn free-qty-plus" data-zone="${z.zoneNo}" ${isSoldOut ? 'disabled' : ''}
            style="width:32px; height:32px; border-radius:50%; border:2px solid var(--color-primary,#696cff);
            background:var(--color-primary,#696cff); color:#fff; font-size:1.2rem; font-weight:700;
            cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">+</button>
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="
      background: var(--bg-surface0, #ffffff); border-radius: 20px; padding: 0;
      width: 90%; max-width: 520px; max-height: 85vh; overflow: hidden;
      box-shadow: 0 24px 48px rgba(0,0,0,0.2); display: flex; flex-direction: column;
      transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    ">
      <!-- 모달 헤더 -->
      <div style="background: linear-gradient(135deg, #696cff 0%, #03c3ec 100%); padding: 1.5rem 1.8rem; position: relative;">
        <h3 style="margin:0; color:#fff; font-size:1.2rem; font-weight:700;">🎟️ 입장권 선택</h3>
        <p style="margin:4px 0 0; color:rgba(255,255,255,0.8); font-size:0.9rem;">${eventName}</p>
        <button id="btn-close-free-modal" style="
          position:absolute; top:1.2rem; right:1.2rem;
          background:rgba(255,255,255,0.2); border:none; color:#fff;
          width:32px; height:32px; border-radius:50%; cursor:pointer;
          font-size:1.1rem; display:flex; align-items:center; justify-content:center;
        ">✕</button>
      </div>

      <!-- 등급 목록 -->
      <div style="flex:1; overflow-y:auto; padding: 1.5rem 1.8rem;">
        <p style="margin:0 0 1rem; font-size:0.9rem; color:var(--text-muted,#6b7280);">
          원하는 등급과 수량을 선택하세요. (최대 4매)
        </p>
        <div id="free-ticket-grades">${zonesHtml}</div>
      </div>

      <!-- 합계 및 결제 버튼 -->
      <div style="padding: 1.2rem 1.8rem; border-top: 1px solid var(--border-default,#dee2e6); background:var(--bg-surface1,#f8f9fa);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <span style="font-size:1rem; font-weight:700; color:var(--text-main,#1f2937);">총 결제 금액</span>
          <span id="free-ticket-total" style="font-size:1.3rem; font-weight:800; color:var(--color-primary,#696cff);">₩ 0</span>
        </div>
        <button id="btn-free-ticket-pay" style="
          width:100%; padding:1rem; background: linear-gradient(135deg, #696cff 0%, #03c3ec 100%);
          color:#fff; border:none; border-radius:12px; font-size:1.1rem; font-weight:700;
          cursor:pointer; transition:all 0.3s; opacity:0.5; pointer-events:none;
          box-shadow: 0 4px 16px rgba(105,108,255,0.4);
        " disabled>
          결제하기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 애니메이션 트리거
  requestAnimationFrame(() => {
    modal.style.opacity = '1';
    modal.querySelector('div').style.transform = 'scale(1)';
  });

  // 닫기 버튼
  modal.querySelector('#btn-close-free-modal').addEventListener('click', () => {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 300);
    }
  });

  // 합계 업데이트 함수
  function updateFreeTotal() {
    let totalQty = 0;
    let totalPrice = 0;
    zones.forEach(z => {
      const qty = ticketQty[z.zoneNo] || 0;
      totalQty += qty;
      totalPrice += qty * (z.price || 0);
    });

    const totalEl = modal.querySelector('#free-ticket-total');
    if (totalEl) totalEl.textContent = `₩ ${totalPrice.toLocaleString()}`;

    const payBtn = modal.querySelector('#btn-free-ticket-pay');
    if (payBtn) {
      if (totalQty > 0) {
        payBtn.disabled = false;
        payBtn.style.opacity = '1';
        payBtn.style.pointerEvents = 'auto';
        payBtn.textContent = `결제하기 (${totalQty}매 · ₩ ${totalPrice.toLocaleString()})`;
      } else {
        payBtn.disabled = true;
        payBtn.style.opacity = '0.5';
        payBtn.style.pointerEvents = 'none';
        payBtn.textContent = '결제하기';
      }
    }
  }

  // 수량 버튼 이벤트
  modal.querySelectorAll('.free-qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const zNo = parseInt(btn.dataset.zone);
      if (ticketQty[zNo] > 0) {
        ticketQty[zNo]--;
        const valEl = modal.querySelector(`.free-qty-value[data-zone="${zNo}"]`);
        if (valEl) valEl.textContent = ticketQty[zNo];
        updateFreeTotal();
      }
    });
  });

  modal.querySelectorAll('.free-qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const zNo = parseInt(btn.dataset.zone);
      const totalQty = Object.values(ticketQty).reduce((a, b) => a + b, 0);
      if (totalQty >= 4) {
        if (window.Toast) Toast.warning('최대 4매까지만 선택 가능합니다.');
        return;
      }
      const z = zones.find(z => z.zoneNo === zNo);
      if (z && ticketQty[zNo] < (z.remainingCapacity || 0)) {
        ticketQty[zNo]++;
        const valEl = modal.querySelector(`.free-qty-value[data-zone="${zNo}"]`);
        if (valEl) valEl.textContent = ticketQty[zNo];
        updateFreeTotal();
      }
    });
  });

  // 결제하기 버튼 클릭 → 결제 수단 선택 모달로 진입
  modal.querySelector('#btn-free-ticket-pay').addEventListener('click', () => {
    const token = localStorage.getItem('userToken') || localStorage.getItem('token');
    if (!token) {
      if (window.Toast) Toast.warning('로그인이 필요합니다.');
      return;
    }

    // 전역 수량 객체 및 총 수량 동기화
    _freeTicketQty = { ...ticketQty };
    _quantity = Object.values(ticketQty).reduce((a, b) => a + b, 0);

    // 모달 닫기
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);

    // 결제 수단 모달 오픈
    enterPaymentModal();
  });
}

/* ═══════════════════════════════════════════════════════════
   사용자 좌석 선택 모달 및 인터랙션 제어
   ═══════════════════════════════════════════════════════════ */
function openSeatSelectionModal(zoneNo, zone) {
  if (!zone) {
    console.error('[openSeatSelectionModal] Zone 객체가 유효하지 않습니다.');
    return;
  }
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
      if (!g || !g.name) return;
      const cls = g.class || 'seat-available';
      const colors = colorMap[cls] || colorMap['seat-available'] || { bg: 'rgba(133, 146, 163, 0.08)', border: 'rgba(133, 146, 163, 0.4)' };
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

  // 모달 내부 슬라이딩 스텝1 초기화
  const sliderWrapper = document.getElementById('seatSliderWrapper');
  if (sliderWrapper) sliderWrapper.style.transform = 'translateX(0)';

  const modalMiniMap = document.getElementById('modalMiniMap');
  const venueSvgLayer = document.getElementById('venueSvgLayer');
  if (modalMiniMap && venueSvgLayer) {
    modalMiniMap.innerHTML = venueSvgLayer.innerHTML;
    // 하이라이트 애니메이션 적용
    const poly = modalMiniMap.querySelector(`[data-zone-no="${zoneNo}"]`);
    if (poly) {
      poly.classList.add('zone-highlighted');
    }
  }

  const modalSelectedZoneName = document.getElementById('modalSelectedZoneName');
  if (modalSelectedZoneName) modalSelectedZoneName.textContent = zone.zoneName || '선택 구역';

  // 인원 수 다중 리스트 초기화 (성인 1, 나머지 0)
  document.querySelectorAll('.ticket-qty-value').forEach(el => {
    if (el.dataset.type === 'adult') el.textContent = '1';
    else el.textContent = '0';
  });
  document.getElementById('btnNextToSeatGrid').dataset.zoneNo = zoneNo;

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

      // 모달 그리드 레이아웃 동적 셋팅 (행 개수에 무대 가이드 행 +1 추가 - 50px 사각형 포맷)
      seatArea.style.gridTemplateRows = `repeat(${rows.length + 1}, 50px)`;
      seatArea.style.gridTemplateColumns = `repeat(${maxCol}, 50px)`;

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
    const maxAllowed = window._currentModalQty || 4;
    if (_selectedSeats.length >= maxAllowed) {
      if (window.Toast) Toast.warning(`선택한 인원수(${maxAllowed}석)만큼만 선택 가능합니다.`);
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

  // 비활성화 상태 업데이트
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
  const totalWait = 30;   // 초 (시뮬레이션 총 시간)

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

  let zone = null;
  if (_eventDetail?.ticketMode === 'FREE') {
    const firstSelectedZoneNo = Object.keys(_freeTicketQty).find(k => _freeTicketQty[k] > 0);
    const targetNo = firstSelectedZoneNo ? parseInt(firstSelectedZoneNo) : (_eventDetail?.zones[0]?.zoneNo);
    zone = _eventDetail?.zones.find(z => z.zoneNo === targetNo);
  } else {
    zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  }

  if (!zone) { Toast.warning('구역을 선택해 주세요.'); return; }

  if (_eventDetail?.ticketMode !== 'FREE' && _selectedSeats.length === 0) {
    Toast.warning('선택한 좌석이 없습니다.');
    return;
  }

  const user = Auth.get();
  const customerName = user?.nickname || user?.name || 'FESTIO 게스트';

  // 1. 서버에 주문 생성 → orderNo & orderUid 발급
  let seatIds = [];
  let seatLabels = [];
  let gross = 0;
  let zoneName = '';

  if (_eventDetail?.ticketMode === 'FREE') {
    const zones = _eventDetail?.zones || [];
    zones.forEach(z => {
      const qty = _freeTicketQty[z.zoneNo] || 0;
      if (qty > 0) {
        for (let i = 0; i < qty; i++) {
          seatLabels.push(z.zoneName);
          gross += z.price;
        }
      }
    });
    const selectedZones = zones.filter(z => (_freeTicketQty[z.zoneNo] || 0) > 0);
    zoneName = selectedZones.map(z => z.zoneName).join(', ');
  } else {
    seatIds = _selectedSeats.map(s => s.id);
    seatLabels = _selectedSeats.map(s => {
      const rowClean = (s.seatRow || '').replace(/열$/, '');
      return `${rowClean}열${s.seatNumber}번`;
    });
    gross = _selectedSeats.reduce((sum, s) => sum + s.price, 0);
    zoneName = zone?.zoneName || '';
  }

  const discount = _appliedCoupon?.discountAmount || 0;
  const netAmount = gross - discount;

  const orderPayload = {
    totalPrice: netAmount,
    seats: seatLabels,      // 주문 설명용 텍스트 레이블
    seatIds: seatIds,       // DB PK 배열 - 구역별 정확한 좌석 예약용
    eventNo: getEventNo(),
    eventName: _eventDetail?.eventName || '',
    zoneName: zoneName,
    userToken: localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || ''
  };

  Modal.close('modal-payment');
  Toast.info('주문을 생성하는 중...');

  let orderRes;
  try {
    const rawToken = localStorage.getItem('userToken') || localStorage.getItem('token') || '';
    const safeToken = /^[\x00-\x7F]*$/.test(rawToken) ? rawToken : encodeURIComponent(rawToken);
    const res = await fetch('/api/order/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeToken}`
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
    Toast.info('결제 승인 처리 중...');
    try {
      await orderApi.confirmPayment(_orderNo, {
        pgProvider: 'festiopay',
        pgTid: 'FST-PAY-' + Date.now()
      });
      Toast.success('FESTIO Pay로 결제되었습니다.');
      Modal.closeAll();
      showBookingSuccess();
    } catch (e) {
      console.error(e);
      Toast.error('결제 승인 처리 중 오류가 발생했습니다.');
    }
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

    const seatDisplay = _eventDetail?.ticketMode === 'FREE'
      ? seatLabels.join(', ')
      : _selectedSeats.map(s => {
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

    const seatDisplay = _eventDetail?.ticketMode === 'FREE'
      ? seatLabels.join(', ')
      : _selectedSeats.map(s => {
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

  let zone = null;
  if (_eventDetail?.ticketMode === 'FREE') {
    const firstSelectedZoneNo = Object.keys(_freeTicketQty).find(k => _freeTicketQty[k] > 0);
    const targetNo = firstSelectedZoneNo ? parseInt(firstSelectedZoneNo) : (_eventDetail?.zones[0]?.zoneNo);
    zone = _eventDetail?.zones.find(z => z.zoneNo === targetNo);
  } else {
    zone = _eventDetail?.zones.find(z => z.zoneNo === _selectedZoneNo);
  }

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
  let gross = 0;
  let zoneText = '';

  if (_eventDetail?.ticketMode === 'FREE') {
    const zones = _eventDetail?.zones || [];
    const textParts = [];
    zones.forEach(z => {
      const qty = _freeTicketQty[z.zoneNo] || 0;
      if (qty > 0) {
        gross += z.price * qty;
        textParts.push(`${z.zoneName} × ${qty}매`);
      }
    });
    zoneText = textParts.join(', ');
  } else {
    gross = _selectedSeats.length > 0
      ? _selectedSeats.reduce((sum, s) => sum + s.price, 0)
      : zone.price * _quantity;
    const seatLabels = _selectedSeats.map(s => `${s.seatRow}-${s.seatNumber}`).join(', ');
    zoneText = _selectedSeats.length > 0
      ? `${zone.zoneName} (${seatLabels}) × ${_quantity}매`
      : `${zone.zoneName} × ${_quantity}매`;
  }

  const discount = _appliedCoupon?.discountAmount || 0;
  const net = gross - discount;

  const rows = {
    '[data-payment="event-name"]': _eventDetail?.eventName || '',
    '[data-payment="zone"]': zoneText,
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
    if (!Auth.isLoggedIn()) {
      Toast.warning('로그인이 필요한 서비스입니다. 로그인 페이지로 이동합니다.');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 1500);
      return;
    }
    if (_eventDetail?.ticketMode === 'FREE') {
      openFreeTicketModal(null, null);
      return;
    }
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

  // 모달 외부 클릭 시 닫기
  on(document, 'click', (e) => {
    if (e.target.id === 'modal-select-seats') {
      Modal.close('modal-select-seats');
    }
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
        // 실시간 지갑 잔액 조회 및 반영
        const balEl = $('#festiopay-balance');
        if (balEl) {
          const token = localStorage.getItem('userToken');
          if (token) {
            fetch('/api/wallet/balance', { headers: { 'Authorization': token } })
              .then(res => {
                if (!res.ok) throw new Error('잔액 조회 실패');
                return res.json();
              })
              .then(data => {
                // html에 " 원"이 이미 명시되어 있으므로 localestring 숫자로 바인딩
                balEl.textContent = (data.balance || 0).toLocaleString();
              })
              .catch(err => {
                console.error('FESTIO Pay 잔액 조회 실패', err);
                balEl.textContent = '0';
              });
          } else {
            balEl.textContent = '0';
          }
        }
      } else {
        festioArea.classList.add('hidden');
      }
    }
  });

  on($('#btn-charge-festiopay'), 'click', async () => {
    const amountStr = prompt('충전할 금액을 입력하세요 (최소 1,000원):', '50000');
    if (amountStr === null) return;
    const amount = parseInt(amountStr.replace(/[^0-9]/g, '') || 0);

    if (!amount || amount < 1000) {
      Toast.warn('최소 1,000원 이상 입력해주세요.');
      return;
    }

    const token = localStorage.getItem('userToken');
    if (!token) {
      Toast.warn('로그인이 필요합니다.');
      return;
    }

    try {
      const res = await fetch('/api/wallet/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          impUid: 'imp_mock_' + Date.now(),
          amount: amount,
          userToken: token
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          Toast.success(`✅ ${amount.toLocaleString()}원 충전 완료!\n현재 잔액: ${data.newBalance.toLocaleString()}원`);
          const balEl = $('#festiopay-balance');
          if (balEl) balEl.textContent = data.newBalance.toLocaleString();
        } else {
          Toast.error('충전 실패: ' + (data.message || '알 수 없는 오류'));
        }
      } else {
        const txt = await res.text();
        Toast.error('충전 오류: ' + txt);
      }
    } catch (err) {
      console.error(err);
      Toast.error('충전 통신 실패');
    }
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
   커스텀 확인 모달 로직
═══════════════════════════════════════════════════════════ */
let pendingDeleteAction = null;

function showDeleteConfirm(onConfirm) {
  pendingDeleteAction = onConfirm;
  let modal = document.getElementById('dynamicDeleteConfirmModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dynamicDeleteConfirmModal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(17, 24, 39, 0.4); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px); opacity: 0; transition: opacity 0.3s ease;
    `;
    modal.innerHTML = `
      <div style="background: #ffffff; border-radius: 20px; padding: 2rem; width: 340px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 1.5rem; text-align: center; transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
          <div style="width: 54px; height: 54px; border-radius: 50%; background: #fee2e2; display: flex; align-items: center; justify-content: center; color: #ef4444; margin-bottom: 0.5rem;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <h3 style="margin: 0; font-size: 1.3rem; font-weight: 700; color: #111827; letter-spacing: -0.03em;">섹션을 삭제할까요?</h3>
          <p style="margin: 0; font-size: 0.95rem; color: #6b7280; line-height: 1.5; letter-spacing: -0.02em;">삭제된 섹션과 내용은 다시 복구할 수 없습니다.<br>정말로 삭제하시겠습니까?</p>
        </div>
        <div style="display: flex; gap: 0.8rem; margin-top: 0.5rem;">
          <button id="dynBtnDeleteCancel" style="flex: 1; padding: 0.85rem; background: #f3f4f6; color: #4b5563; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">취소</button>
          <button id="dynBtnDeleteConfirm" style="flex: 1; padding: 0.85rem; background: #ef4444; color: #ffffff; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(239,68,68,0.25);">삭제</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector('#dynBtnDeleteCancel');
    const confirmBtn = modal.querySelector('#dynBtnDeleteConfirm');

    cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = '#e5e7eb');
    cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = '#f3f4f6');
    confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = '#dc2626');
    confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = '#ef4444');

    const closeModal = () => {
      modal.style.opacity = '0';
      modal.querySelector('div').style.transform = 'scale(0.95)';
      setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    cancelBtn.addEventListener('click', () => {
      closeModal();
      pendingDeleteAction = null;
    });

    confirmBtn.addEventListener('click', () => {
      closeModal();
      if (pendingDeleteAction) {
        pendingDeleteAction();
        pendingDeleteAction = null;
      }
    });
  }

  modal.style.display = 'flex';
  // 애니메이션을 위해 DOM 리플로우 트리거
  void modal.offsetWidth;
  modal.style.opacity = '1';
  modal.querySelector('div').style.transform = 'scale(1)';
}

/* ═══════════════════════════════════════════════════════════
   DOMContentLoaded — 진입점
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  const btnDeleteCancel = document.getElementById('btnDeleteCancel');
  const btnDeleteConfirm = document.getElementById('btnDeleteConfirm');
  const deleteModal = document.getElementById('deleteConfirmModal');

  if (btnDeleteCancel && deleteModal) {
    btnDeleteCancel.addEventListener('click', () => {
      deleteModal.style.display = 'none';
      pendingDeleteAction = null;
    });
  }
  if (btnDeleteConfirm && deleteModal) {
    btnDeleteConfirm.addEventListener('click', () => {
      deleteModal.style.display = 'none';
      if (pendingDeleteAction) {
        pendingDeleteAction();
        pendingDeleteAction = null;
      }
    });
  }

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
    let rawHtml = detail.descriptionHtml || localStorage.getItem(`festio_event_${eventNo}_tabs`);
    if (rawHtml) {
      // 렌더링 전(Pre-clean) 장소 탭 좀비 데이터 완벽 제거 (깜빡임 방지)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = rawHtml;

      const tabVenue = tempDiv.querySelector('#tab-venue');
      if (tabVenue) {
        const inner = tabVenue.querySelector('.tab-content-inner');
        if (inner) {
          let transitContentHtml = '<p>대중교통 정보가 없습니다.</p>';
          const tc = inner.querySelector('#transitContent');
          if (tc) { transitContentHtml = tc.innerHTML; }

          let cleanTransit = transitContentHtml;
          cleanTransit = cleanTransit.replace(/<[^>]*>카카오맵<\/[^>]*>/gi, '');
          cleanTransit = cleanTransit.replace(/<[^>]*>네이버지도<\/[^>]*>/gi, '');
          cleanTransit = cleanTransit.replace(/<[^>]*>구글\s*길찾기<\/[^>]*>/gi, '');
          cleanTransit = cleanTransit.replace(/카카오맵|네이버지도|구글\s*길찾기/gi, '');
          if (!cleanTransit.replace(/<[^>]*>/g, '').trim()) {
            cleanTransit = '<p>대중교통 정보가 없습니다.</p>';
          }

          let customAddress = '';
          const savedAddrEl = inner.querySelector('#venueAddressWrap h4');
          if (savedAddrEl) {
            // \\n을 다시 원래 줄바꿈으로 복원 (필요시)
            customAddress = savedAddrEl.innerHTML.replace(/<br>/gi, '\\n');
          }

          // 장소 탭 내용을 완전히 리셋하고 오직 대중교통 텍스트만 안전하게 남겨둠 (하드코딩 찌꺼기 완벽 증발)
          inner.innerHTML = `<div id="transitContent" style="display:none;">${cleanTransit}</div>`;
          if (customAddress) {
            inner.innerHTML += `<div id="savedCustomAddress" style="display:none;">${customAddress}</div>`;
          }
        }
      }

      // 리뷰 탭 등 동적으로 생성된 댓글 영역이 빌더 저장 시 함께 저장된 경우 제거하여 항상 새롭게 초기화 (깜빡임/오류메시지 캐싱 방지)
      const dynamicComments = tempDiv.querySelector('#dynamic-comments-section');
      if (dynamicComments) {
        dynamicComments.remove();
      }

      // 구버전 빌더 데이터 호환성 처리: tabs-header-wrapper가 없는 경우 동적으로 감싸서 sticky 기능 복원
      const oldTabsHeader = tempDiv.querySelector('.detail-tabs-header');
      if (oldTabsHeader && !oldTabsHeader.closest('.tabs-header-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tabs-header-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        oldTabsHeader.parentNode.insertBefore(wrapper, oldTabsHeader);
        wrapper.appendChild(oldTabsHeader);
      }

      // Supabase 데이터 내 잘못 저장된 깨진 stylesheet link 태그 제거 (불필요한 네트워크 에러 방지)
      const strayLinks = tempDiv.querySelectorAll('link[rel="stylesheet"]');
      strayLinks.forEach(link => link.remove());

      tabsSection.innerHTML = tempDiv.innerHTML;
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
      const deleteBtn = e.target.closest('.tab-delete-btn');
      if (deleteBtn && isEditMode) {
        e.stopPropagation();
        const btn = deleteBtn.closest('.detail-tab-btn');
        let targetId = btn.dataset.target || (btn.dataset.tab ? 'tab-' + btn.dataset.tab : null);
        if (!targetId) return;

        const accordionItem = document.querySelector(`.builder-accordion-item[data-target-id="${targetId}"]`);
        if (accordionItem) {
          const accDeleteBtn = accordionItem.querySelector('.btn-delete-section');
          if (accDeleteBtn) accDeleteBtn.click();
        } else {
          showDeleteConfirm(() => {
            btn.remove();
            const content = document.getElementById(targetId);
            if (content) content.remove();
          });
        }
        return;
      }

      const btn = e.target.closest('.detail-tab-btn');
      if (!btn) return;

      let targetId = btn.dataset.target;
      if (!targetId && btn.dataset.tab) {
        targetId = 'tab-' + btn.dataset.tab;
      }
      if (!targetId) return;

      if (isEditMode) {
        document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');

        // 사이드바 아코디언 동기화
        document.querySelectorAll('.builder-accordion-item').forEach(item => {
          item.classList.remove('active');
          if (item.dataset.targetId === targetId) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      } else {
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          const header = document.querySelector('.tabs-header-wrapper');
          const headerHeight = header ? header.offsetHeight : 0;
          const globalHeaderH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80;
          const offsetTop = targetContent.getBoundingClientRect().top + window.scrollY - headerHeight - globalHeaderH - 20;
          window.scrollTo({ top: offsetTop, behavior: 'smooth' });
        }
      }
    });
  }

  // 스크롤 스파이 로직 (뷰 모드 전용)
  window.addEventListener('scroll', () => {
    if (isEditMode) return;

    const tabsSection = document.getElementById('detailTabsSection');
    if (!tabsSection || tabsSection.classList.contains('edit-mode')) return;

    const contents = tabsSection.querySelectorAll('.detail-tab-content');
    if (!contents || contents.length === 0) return;

    const header = document.querySelector('.tabs-header-wrapper');
    const headerHeight = header ? header.offsetHeight : 0;
    const globalHeaderH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 80;
    const offset = headerHeight + globalHeaderH + 150; // 감지 임계값

    let currentId = null;

    contents.forEach(content => {
      const rect = content.getBoundingClientRect();
      if (rect.top <= offset && rect.bottom > offset) {
        currentId = content.id;
      }
    });

    if (currentId) {
      document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        let targetId = btn.dataset.target;
        if (!targetId && btn.dataset.tab) targetId = 'tab-' + btn.dataset.tab;

        if (targetId === currentId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
  });

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

let originalTabsHtml = '';

function toggleEditMode(enable) {
  isEditMode = enable;
  const detailTabsSection = document.getElementById('detailTabsSection');
  const body = document.body;
  const editBadge = document.getElementById('editBadge');
  const btnSave = document.getElementById('btnSaveAllEdits');

  if (enable) {
    if (detailTabsSection) originalTabsHtml = detailTabsSection.innerHTML;
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
      // initMainAreaEditors는 사이드바로 이동됨
    } else {
      document.querySelector('.builder-tabs-wrapper').classList.add('edit-builder-layout');
    }
  } else {
    body.classList.remove('edit-mode');
    if (editBadge) editBadge.style.display = 'none';
    if (btnSave) btnSave.style.display = 'none';
    const wrapper = document.querySelector('.builder-tabs-wrapper');
    if (wrapper) {
      // 롤백 처리 시 detailTabsSection 내용을 복구하기 전 래퍼에서 먼저 분리
      wrapper.parentNode.insertBefore(detailTabsSection, wrapper);
      wrapper.remove();
    }
    // 롤백 처리 (저장 없이 종료 시 원본으로 복구)
    if (detailTabsSection && originalTabsHtml) {
      detailTabsSection.innerHTML = originalTabsHtml;
    }
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
        } else if (block.classList.contains('map-block') || block.classList.contains('list-block') || block.classList.contains('notice-block')) {
          const previewHtml = block.querySelector('.gallery-preview-container').innerHTML;
          combinedHtml += previewHtml;
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
    <div class="builder-sidebar-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem; padding-bottom: 0;">
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
      showDeleteConfirm(() => {
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
      });
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

  // 1번 수정사항: 편집 모드 진입 시 첫 번째 아코디언 자동 클릭 (탭 컨텐츠 노출)
  setTimeout(() => {
    const firstAccordionHeader = listWrap.querySelector('.builder-accordion-header');
    if (firstAccordionHeader) {
      firstAccordionHeader.click();
    }
  }, 100);
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
        const container = tabBtn.closest('.detail-tabs-header');
        if (container) {
          const scrollLeft = tabBtn.offsetLeft - (container.clientWidth / 2) + (tabBtn.clientWidth / 2);
          container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        } else {
          tabBtn.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
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
    if (tabBtn) {
      const textSpan = tabBtn.querySelector('.tab-title-text');
      if (textSpan) textSpan.textContent = nameEl.textContent;
      else tabBtn.textContent = nameEl.textContent;
    }
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

    showDeleteConfirm(() => {
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
    });
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

const customFonts = [
  'noto-sans', 'nanum-gothic', 'nanum-myeongjo', 'noto-serif',
  'jua', 'dongle', 'gowun-dodum', 'hahmlet', 'gamja-flower', 'black-han-sans',
  'gowun-batang', 'do-hyeon', 'poor-story', 'song-myung', 'yeon-sung',
  'roboto', 'open-sans', 'lato', 'montserrat', 'oswald', 'source-code-pro',
  'playfair-display', 'poppins', 'merriweather'
];
if (typeof Quill !== 'undefined') {
  const Font = Quill.import('formats/font');
  Font.whitelist = [false, ...customFonts];
  Quill.register(Font, true);
}

const quillToolbarOptions = [
  [{ 'font': [false, ...customFonts] }, { 'size': [] }],
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

    // 장소 탭은 사이드바의 makeVenueEditor에서 처리됨. 추가 주입 필요 없음
    if (tab.id === 'tab-venue') {
      const editorWrap = inner.querySelector('.venue-editor-wrap');
      if (editorWrap) return; // Already has editor
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
    block.style.overflow = 'visible';

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
        bounds: document.getElementById('builderSidebar'), // Use sidebar as bounds for correct tooltip positioning
        modules: { toolbar: quillToolbarOptions }
      });
      quillEditors[tab.id + '_' + Date.now()] = quill;

      const toolbar = quill.getModule('toolbar');
      toolbar.addHandler('link', function (value) {
        if (value) {
          let range = this.quill.getSelection();
          if (range == null || range.length === 0) {
            const cursorPosition = range ? range.index : this.quill.getLength();
            this.quill.insertText(cursorPosition, '구경하기', 'user');
            this.quill.setSelection(cursorPosition, '구경하기'.length);
            range = this.quill.getSelection();
          }
          const preview = this.quill.getText(range);
          this.quill.theme.tooltip.edit('link', preview);
          this.quill.theme.tooltip.linkRange = range;
        } else {
          this.quill.format('link', false);
        }
      });

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
      <div style="margin-bottom:1rem; position:relative;" class="gallery-custom-dropdown">
        <input type="hidden" class="gallery-layout-select" value="grid">
        <div class="custom-select-trigger" tabindex="0" style="width:100%; border-radius:10px; border:1.5px solid #d1d5db; padding:12px 40px 12px 14px; font-size:0.88rem; font-weight:600; color:#334155; background:#fff; cursor:pointer; position:relative; display:flex; justify-content:space-between; align-items:center; transition:border-color 0.2s, box-shadow 0.2s;">
          <span class="custom-select-label">Grid (기본 격자)</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="custom-select-options" style="display:none; position:absolute; top:100%; left:0; right:0; margin-top:4px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.1); z-index:1000; max-height:240px; overflow-y:auto;">
          <div class="custom-option selected" data-value="grid" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Grid (기본 격자)</div>
          <div class="custom-option" data-value="masonry" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Masonry (핀터레스트 스타일)</div>
          <div class="custom-option" data-value="mosaic" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Mosaic (모자이크형)</div>
          <div class="custom-option" data-value="carousel" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Carousel (캐러셀)</div>
          <div class="custom-option" data-value="filmstrip" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Filmstrip (필름 스트립)</div>
          <div class="custom-option" data-value="polaroid" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Polaroid (폴라로이드)</div>
          <div class="custom-option" data-value="collage" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Collage (콜라주)</div>
          <div class="custom-option" data-value="fullwidth" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer; border-bottom:1px solid #f1f5f9;">Full Width (전체 너비)</div>
          <div class="custom-option" data-value="tiled" style="padding:10px 14px; font-size:0.88rem; color:#334155; cursor:pointer;">Tiled (타일형)</div>
        </div>
      </div>
      <div style="margin-bottom:1rem; font-weight:700; color:var(--text-main); font-size:0.9rem;">이미지</div>
      <label class="gallery-upload-area" style="display:block; border:1px dashed #d1d5db; border-radius:12px; padding:2rem; text-align:center; cursor:pointer; background:#f9fafb; transition:all 0.2s;">
        <input type="file" multiple accept="image/*" class="gallery-upload-input" style="display:none;">
        <div style="width:40px; height:40px; background:#fff; border-radius:50%; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.5rem; color:#9ca3af;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </div>
        <div style="color:#6b7280; font-size:0.9rem; font-weight:600;">이미지 선택</div>
      </label>
      <div class="uploaded-image-grid" style="display:flex; gap:10px; margin-top:1rem; overflow-x:auto; padding-bottom:8px; flex-wrap:nowrap;"></div>
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

    // 커스텀 드롭다운 이벤트 처리
    const customDropdown = block.querySelector('.gallery-custom-dropdown');
    const triggerBtn = customDropdown.querySelector('.custom-select-trigger');
    const optionsMenu = customDropdown.querySelector('.custom-select-options');
    const labelSpan = customDropdown.querySelector('.custom-select-label');
    const optionItems = customDropdown.querySelectorAll('.custom-option');

    triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = optionsMenu.style.display === 'block';
      document.querySelectorAll('.custom-select-options').forEach(menu => menu.style.display = 'none');
      optionsMenu.style.display = isExpanded ? 'none' : 'block';
      triggerBtn.style.borderColor = isExpanded ? '#d1d5db' : '#6366f1';
    });

    optionItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = item.getAttribute('data-value');
        const text = item.textContent;

        layoutSelect.value = value;
        labelSpan.textContent = text;

        optionItems.forEach(opt => opt.classList.remove('selected'));
        item.classList.add('selected');

        optionsMenu.style.display = 'none';
        triggerBtn.style.borderColor = '#d1d5db';
        triggerUpdate();
      });
    });

    document.addEventListener('click', (e) => {
      if (!customDropdown.contains(e.target)) {
        optionsMenu.style.display = 'none';
        triggerBtn.style.borderColor = '#d1d5db';
      }
    });

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
          imgWrap.style.width = '80px';
          imgWrap.style.height = '80px';
          imgWrap.style.flexShrink = '0';
          imgWrap.style.borderRadius = '8px';
          imgWrap.style.overflow = 'hidden';
          imgWrap.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';

          imgWrap.innerHTML = `
            <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-remove-img" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.55); color:#fff; border:none; border-radius:6px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; line-height:1;">✕</button>
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
      if (savedGalleryData.layout) {
        layoutSelect.value = savedGalleryData.layout;
        const matchedItem = Array.from(optionItems).find(opt => opt.getAttribute('data-value') === savedGalleryData.layout);
        if (matchedItem) {
          labelSpan.textContent = matchedItem.textContent;
          optionItems.forEach(opt => opt.classList.remove('selected'));
          matchedItem.classList.add('selected');
        }
      }
      if (savedGalleryData.images) {
        savedGalleryData.images.forEach(src => {
          const imgWrap = document.createElement('div');
          imgWrap.className = 'uploaded-image-item';
          imgWrap.style.position = 'relative';
          imgWrap.style.width = '80px';
          imgWrap.style.height = '80px';
          imgWrap.style.flexShrink = '0';
          imgWrap.style.borderRadius = '8px';
          imgWrap.style.overflow = 'hidden';
          imgWrap.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          imgWrap.innerHTML = `
            <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
            <button class="btn-remove-img" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.55); color:#fff; border:none; border-radius:6px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; line-height:1;">✕</button>
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
        } else if (child.classList.contains('view-gallery-block')) {
          let layout = 'grid';
          const innerHtml = child.innerHTML;
          if (innerHtml.includes('scroll-snap-type')) layout = 'slider';
          else if (innerHtml.includes('transform:rotate')) layout = 'polaroid';
          else if (innerHtml.includes('flex-direction:column')) layout = 'carousel';
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
  } else if (layout === 'filmstrip') {
    html = '<div class="gallery-filmstrip">';
    images.forEach(src => { html += `<div class="gallery-filmstrip-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'polaroid') {
    html = '<div class="gallery-polaroid-new">';
    images.forEach(src => { html += `<div class="gallery-polaroid-new-item"><div class="polaroid-img-wrap"><img src="${src}" alt="갤러리 이미지"></div></div>`; });
    html += '</div>';
  } else if (layout === 'collage') {
    html = '<div class="gallery-collage">';
    images.forEach(src => { html += `<div class="gallery-collage-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'fullwidth') {
    html = '<div class="gallery-fullwidth">';
    images.forEach(src => { html += `<div class="gallery-fullwidth-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
    html += '</div>';
  } else if (layout === 'tiled') {
    html = '<div class="gallery-tiled">';
    images.forEach(src => { html += `<div class="gallery-tiled-item"><img src="${src}" alt="갤러리 이미지"></div>`; });
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
    newBtn.innerHTML = `
      <span class="tab-title-text">${title}</span>
      <span class="tab-delete-btn" title="탭 삭제">&times;</span>
    `;
    tabsHeader.appendChild(newBtn);

    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.detail-tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.detail-tab-content').forEach(content => content.classList.remove('active'));
      newBtn.classList.add('active');
      const targetContent = document.getElementById(newId);
      if (targetContent) targetContent.classList.add('active');
    });

    // 자동 포커스 및 스크롤
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

  const listWrap = document.getElementById('builderAccordionList');
  const items = listWrap.querySelectorAll('.builder-accordion-item');
  addAccordionItem(listWrap, title, newId, items.length, newContent);

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

      // 저장 성공 시 롤백 방지를 위해 백업본 갱신
      originalTabsHtml = htmlContent;

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

  const addressEl = inner.querySelector('#venueAddressWrap h4') || inner.querySelector('.venue-address-text');
  let currentAddress = '';
  if (addressEl) {
    currentAddress = addressEl.innerHTML.replace(/<br\s*[\/]?>/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  const currentTransit = inner.querySelector('#transitContent')?.innerHTML || '';

  const addressParts = currentAddress === '등록된 주소가 없습니다.' ? ['', ''] : currentAddress.split(' 상세: ');
  const baseAddress = addressParts[0] || '';
  const detailAddress = addressParts[1] || '';

  const editorHtml = `
    <div class="venue-editor-wrap" style="background: var(--bg-surface1); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px dashed var(--border-default);">
      <div style="margin-bottom: 1.5rem;">
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">기본 오시는 길 (검색)</label>
        <div style="display:flex; gap: 0.5rem; flex-direction:row; align-items:center; margin-bottom: 0.5rem;">
          <input type="text" id="venueEditAddress" class="form-control" style="flex:1; border-radius:8px; padding: 12px 16px; background: #f9fafb; cursor: not-allowed;" placeholder="주소 검색 버튼을 이용해주세요" autocomplete="new-password" value="${baseAddress}" readonly>
          <button type="button" class="btn btn-outline" id="btnSearchAddressApi" style="border-radius:8px; white-space:nowrap; padding: 12px 16px;">주소 검색</button>
        </div>
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">상세 주소 (직접 입력)</label>
        <input type="text" id="venueEditDetailAddress" class="form-control" style="width:100%; border-radius:8px; padding: 12px 16px;" placeholder="예: 지하 1층, 3문 앞 등" value="${detailAddress}">
      </div>
      <div style="margin-bottom: 1.5rem;">
        <label style="display:block; font-weight: 700; margin-bottom: 0.5rem; color:var(--text-main);">대중교통 안내</label>
        <div style="border-radius:8px; border: 1px solid var(--border-default); background: #fff; position:relative;">
          <style>
            #venueEditTransit .ql-editor { border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
            #venueEditTransitToolbar { border-top-left-radius: 8px; border-top-right-radius: 8px; }
            /* 드롭다운 리스트 박스 둥근 모서리 및 스크롤바 튀어나옴 방지 */
            .ql-picker-options { border-radius: 8px; overflow: hidden !important; }
          </style>
          <div id="venueEditTransitToolbar"></div>
          <div id="venueEditTransit" style="min-height: 150px;">${currentTransit === '대중교통 정보가 등록되지 않았습니다.' ? '' : currentTransit}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <button type="button" class="btn btn-primary" id="btnUpdateVenueMap" style="border-radius:8px; padding: 12px 24px; font-weight:600; width:100%;">지도 및 안내 업데이트</button>
      </div>
    </div>
  `;
  sidebarContainer.innerHTML = editorHtml;

  // 오시는 길 정보를 위한 Quill 에디터 초기화
  const transitQuill = new Quill('#venueEditTransit', {
    theme: 'snow',
    bounds: document.getElementById('builderSidebar'), // Use sidebar as bounds for correct tooltip positioning
    modules: {
      toolbar: typeof quillToolbarOptions !== 'undefined' ? quillToolbarOptions : [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'clean']
      ]
    }
  });

  const transitToolbar = transitQuill.getModule('toolbar');
  transitToolbar.addHandler('link', function (value) {
    if (value) {
      let range = this.quill.getSelection();
      if (range == null || range.length === 0) {
        const cursorPosition = range ? range.index : this.quill.getLength();
        this.quill.insertText(cursorPosition, '구경하기', 'user');
        this.quill.setSelection(cursorPosition, '구경하기'.length);
        range = this.quill.getSelection();
      }
      const preview = this.quill.getText(range);
      this.quill.theme.tooltip.edit('link', preview);
      this.quill.theme.tooltip.linkRange = range;
    } else {
      this.quill.format('link', false);
    }
  });

  // 3번 수정사항: 대중교통 퀄 에디터 실시간 동기화 바인딩
  transitQuill.on('text-change', () => {
    const transitContent = sidebarContainer.querySelector('#venueEditTransit .ql-editor');
    const mainViewTransit = document.getElementById('transitContent');
    if (mainViewTransit && transitContent) {
      mainViewTransit.innerHTML = transitContent.innerHTML;
    }
  });

  const btnUpdate = sidebarContainer.querySelector('#btnUpdateVenueMap');
  const addressInput = sidebarContainer.querySelector('#venueEditAddress');
  const detailAddressInput = sidebarContainer.querySelector('#venueEditDetailAddress');
  const btnSearchAddress = sidebarContainer.querySelector('#btnSearchAddressApi');

  // 다음 주소 API 연동
  btnSearchAddress.addEventListener('click', () => {
    if (typeof daum !== 'undefined' && daum.Postcode) {
      new daum.Postcode({
        oncomplete: function (data) {
          // 검색된 기본 주소(도로명 주소 + 지번 주소) 조합
          let addr = data.roadAddress;
          if (data.jibunAddress) {
            addr += ` (지번: ${data.jibunAddress})`;
          } else if (data.autoJibunAddress) {
            addr += ` (지번: ${data.autoJibunAddress})`;
          }
          addressInput.value = addr;
          updateVenueTextPreview();
        }
      }).open();
    } else {
      Toast.error('주소 검색 API를 불러올 수 없습니다.');
    }
  });

  const updateVenueTextPreview = () => {
    const baseAddr = addressInput.value.trim();
    const detailAddr = detailAddressInput.value.trim();
    const address = baseAddr + (detailAddr ? ` 상세: ${detailAddr}` : '');

    let transit = transitQuill.root.innerHTML.trim();
    if (transit === '<p><br></p>') transit = '';

    // 백그라운드 변수에도 저장
    _eventDetail.venue = address;

    const addressWrap = inner.querySelector('#venueAddressWrap');
    const transitContentEl = inner.querySelector('#transitContent');

    if (addressWrap) {
      const formattedAddress = address.replace(/\\n/g, '<br>').replace(/\n/g, '<br>').replace(' (지번:', '<br>(지번:');
      addressWrap.innerHTML = `<h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 0; margin-bottom: 12px; line-height: 1.4;">${formattedAddress || '등록된 주소가 없습니다.'}</h4>`;
    }
    if (transitContentEl) transitContentEl.innerHTML = transit || '대중교통 정보가 등록되지 않았습니다.';
  };

  detailAddressInput.addEventListener('input', updateVenueTextPreview);
  addressInput.addEventListener('input', updateVenueTextPreview);
  transitQuill.on('text-change', updateVenueTextPreview);

  btnUpdate.addEventListener('click', () => {
    const baseAddr = addressInput.value.trim();
    const detailAddr = detailAddressInput.value.trim();
    const address = baseAddr + (detailAddr ? ` 상세: ${detailAddr}` : '');
    updateVenueTextPreview();

    const googleMapFrame = inner.querySelector('#googleMap');
    if (googleMapFrame && baseAddr) {
      googleMapFrame.src = `https://maps.google.com/maps?q=${encodeURIComponent(baseAddr.split(' (지번:')[0])}&output=embed`;
    }

    let linksWrap = inner.querySelector('#directionsLinksWrap');
    if (!linksWrap) {
      linksWrap = document.createElement('div');
      linksWrap.id = 'directionsLinksWrap';
      inner.appendChild(linksWrap);
    }

    if (address) {
      linksWrap.innerHTML = `
        <div style="margin-top: 1.5rem;">
          <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 0; margin-bottom: 12px; line-height: 1.4;">길찾기</h4>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <a href="https://map.kakao.com/link/search/${encodeURIComponent(address.split(' (지번:')[0].split('\\n')[0].split('\n')[0])}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #FEE500; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 3c-5.523 0-10 3.514-10 7.85 0 2.804 1.83 5.253 4.606 6.647l-1.18 4.34c-.05.18.17.33.32.22l5.12-3.41c.37.04.74.06 1.13.06 5.523 0 10-3.514 10-7.85C22 6.514 17.523 3 12 3z"/></svg>카카오맵
            </a>
            <a href="https://map.naver.com/v5/search/${encodeURIComponent(address.split(' (지번:')[0].split('\\n')[0].split('\n')[0])}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #03C75A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M16.084 12.637L8.03 2.127C7.625 1.597 7.026 1.334 6.386 1.334H2v21.332h5.922V11.233l8.053 10.51C16.42 22.316 17.02 22.58 17.658 22.58H22V1.248h-5.916v11.389z"/></svg>네이버지도
            </a>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.split(' (지번:')[0].split('\\n')[0].split('\n')[0])}&travelmode=transit" target="_blank" style="display:inline-flex; align-items:center; gap:6px; padding: 10px 16px; background: #4285F4; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>구글 길찾기
            </a>
          </div>
        </div>
      `;
    } else {
      linksWrap.innerHTML = '';
    }

    Toast.success('오시는 길 정보가 라이브 화면에 업데이트되었습니다.');
  });
}

// 좌석 선택 모달 내 슬라이딩 및 다중 인원 조절 이벤트
document.addEventListener('DOMContentLoaded', () => {
  const btnNext = document.getElementById('btnNextToSeatGrid');
  const btnPrev = document.getElementById('btnPrevToStep1');
  const sliderWrapper = document.getElementById('seatSliderWrapper');
  const btnConfirmSeats = document.getElementById('btn-confirm-seats');

  // [+] [-] 다중 권종 수량 조절 이벤트
  document.querySelectorAll('.btn-ticket-minus, .btn-ticket-plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.target.dataset.type;
      const isPlus = e.target.classList.contains('btn-ticket-plus');
      const valSpan = document.querySelector(`.ticket-qty-value[data-type="${type}"]`);
      if (!valSpan) return;

      let val = parseInt(valSpan.textContent || '0');

      // 총 인원수가 4명을 넘지 않도록 검증
      if (isPlus) {
        let currentTotal = 0;
        document.querySelectorAll('.ticket-qty-value').forEach(el => currentTotal += parseInt(el.textContent || '0'));
        if (currentTotal < 4) {
          if (val < 4) val++;
        } else {
          if (window.Toast) Toast.warn('최대 4명까지만 선택 가능합니다.');
          return;
        }
      } else {
        if (val > 0) val--;
      }
      valSpan.textContent = val;
    });
  });

  if (btnNext && sliderWrapper) {
    btnNext.addEventListener('click', () => {
      let totalQty = 0;
      const types = {};

      document.querySelectorAll('.ticket-qty-value').forEach(el => {
        const type = el.dataset.type;
        const count = parseInt(el.textContent || '0');
        types[type] = count;
        totalQty += count;
      });

      if (totalQty < 1) {
        if (window.Toast) Toast.warn('인원수를 최소 1명 이상 선택해주세요.');
        return;
      }

      window._currentModalQty = totalQty;
      window._currentModalTicketTypes = types; // {adult: 2, teen: 1, child: 0}

      // Step 2로 슬라이드
      sliderWrapper.style.transform = 'translateX(-50%)';
    });
  }

  if (btnPrev && sliderWrapper) {
    btnPrev.addEventListener('click', () => {
      sliderWrapper.style.transform = 'translateX(0)';
    });
  }

  if (btnConfirmSeats) {
    btnConfirmSeats.addEventListener('click', () => {
      if (!window._selectedSeats || window._selectedSeats.length === 0) return;
      if (window._selectedSeats.length !== window._currentModalQty) {
        if (window.Toast) Toast.warn(`선택한 인원수(${window._currentModalQty}명)와 동일한 수의 좌석을 선택해주세요.`);
        return;
      }

      // 1. 우측 예매 확인 영역에 권종/인원 설정 반영 (다중 권종 렌더링)
      const ticketSelectionList = document.getElementById('ticketSelectionList');
      if (ticketSelectionList) {
        ticketSelectionList.innerHTML = '';
        const typeMap = { adult: '성인', teen: '청소년', child: '어린이/아동' };

        let html = '';
        Object.entries(window._currentModalTicketTypes).forEach(([type, count]) => {
          if (count > 0) {
            html += `
              <div class="qty-selector-wrap" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 8px; background: var(--bg-surface1); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-default);">
                <span style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">${typeMap[type]}</span>
                <span style="font-weight: 700; color: var(--color-primary);">${count}명</span>
              </div>
            `;
          }
        });
        ticketSelectionList.innerHTML = html;
      }

      // 2. 우측 예매 확인 영역에 선택한 구역 이름 반영
      const ctaZoneName = document.getElementById('ctaZoneName');
      const modalSelectedZoneName = document.getElementById('modalSelectedZoneName');
      if (ctaZoneName && modalSelectedZoneName) {
        ctaZoneName.textContent = modalSelectedZoneName.textContent;
      }

      // 3. 우측 좌석 목록 및 합계 금액 연동
      const selectedSeatsList = document.getElementById('selectedSeatsList');
      const selectedCountBadge = document.getElementById('selectedCountBadge');
      const ctaTotal = document.getElementById('ctaTotal');

      if (selectedSeatsList) {
        selectedSeatsList.innerHTML = window._selectedSeats.map(s => {
          const badgeClass = s.cls === 'seat-vip' ? 'vip' : s.cls === 'seat-r' ? 'r' : s.cls === 'seat-s' ? 's' : 'available';
          return `
            <li class="seat-list-item">
              <div class="seat-info-left">
                <span class="seat-badge ${badgeClass}">${s.grade}</span>
                <span class="seat-text">${s.label}</span>
              </div>
              <span class="seat-price-text">${s.price.toLocaleString()}원</span>
            </li>
          `;
        }).join('');
      }

      if (selectedCountBadge) {
        selectedCountBadge.textContent = `${window._selectedSeats.length}석`;
      }

      if (ctaTotal) {
        const total = window._selectedSeats.reduce((sum, s) => sum + s.price, 0);
        ctaTotal.textContent = `￦ ${total.toLocaleString()}원`;
      }

      // 4. 모달 닫기
      if (window.Modal) Modal.close('modal-select-seats');
    });
  }

  /* ────────────────────────────────────────────────────────
     커스텀 SVG 툴팁 적용 (마우스 포인터 따라다니는 박스)
  ──────────────────────────────────────────────────────── */
  const tooltip = document.getElementById('custom-svg-tooltip');

  // 전체 화면(또는 도면 컨테이너)에서 mousemove 이벤트를 잡을 수도 있지만, 
  // 동적으로 생성되는 #userGridBgOverlay 또는 .zone-polygon 등에 이벤트 위임 처리
  document.addEventListener('mouseover', (e) => {
    const polygon = e.target.closest('[data-zone-no]');
    // SVG 요소 중 data-zone-no를 가진 요소일 경우
    if (polygon) {
      const titleEl = polygon.querySelector('title');
      if (titleEl && tooltip) {
        // 기존 title 속성의 기본 툴팁이 뜨지 않도록 처리
        if (!polygon.dataset.tooltipText) {
          polygon.dataset.tooltipText = titleEl.textContent;
          titleEl.textContent = ''; // 브라우저 기본 툴팁 방지
        }
        tooltip.textContent = polygon.dataset.tooltipText;
        tooltip.style.display = 'block';
      } else if (polygon.dataset.tooltipText && tooltip) {
        tooltip.textContent = polygon.dataset.tooltipText;
        tooltip.style.display = 'block';
      }
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltip && tooltip.style.display === 'block') {
      tooltip.style.left = (e.pageX + 15) + 'px';
      tooltip.style.top = (e.pageY + 15) + 'px';
    }
  });

  document.addEventListener('mouseout', (e) => {
    const polygon = e.target.closest('[data-zone-no]');
    if (polygon) {
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    }
  });

  // 모달 닫힐 때 선택된 구역 시각적 상태 초기화
  document.addEventListener('modalClose', (e) => {
    if (e.target && e.target.id === 'modal-select-seats') {
      document.querySelectorAll('#venueSvgLayer .zone-polygon.selected').forEach(el => {
        el.classList.remove('selected');
      });
      // 미니맵에 복사되었던 중복 SVG 요소 제거 (ID 중복으로 인한 호버 렌더링 버벅임/충돌 방지)
      const miniMap = document.getElementById('modalMiniMap');
      if (miniMap) miniMap.innerHTML = '';
    }
  });
});
