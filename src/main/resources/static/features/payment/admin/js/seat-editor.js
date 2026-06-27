// 1. 관리자 권한 및 세션 검증
(function () {
  const userRole = localStorage.getItem('userRole');

  if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    if (window.Swal) {
      Swal.fire({
        title: '접근 권한 없음',
        text: '관리자 권한이 필요한 페이지입니다.',
        icon: 'error',
        confirmButtonText: '확인'
      }).then(() => {
        window.location.href = '../../../Festio/login.html';
      });
    } else {
      alert('관리자만 접근할 수 있는 페이지입니다.');
      window.location.href = '../../../Festio/login.html';
    }
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const festivalSelect = document.getElementById('festivalSelect');
  const zoneStatusWrapper = document.getElementById('zoneStatusWrapper');
  const btnToggleZoneStatus = document.getElementById('btnToggleZoneStatus');
  const rowCountInput = document.getElementById('rowCountInput');
  const colCountInput = document.getElementById('colCountInput');
  const defaultGradeSelect = document.getElementById('defaultGradeSelect');
  const btnGenerate = document.getElementById('btnGenerate');

  // range 슬라이더 수치 표시 연동
  const rowCountVal = document.getElementById('rowCountVal');
  const colCountVal = document.getElementById('colCountVal');

  if (rowCountInput && rowCountVal) {
    rowCountInput.addEventListener('input', (e) => {
      if (isLoadingSeats) return;
      rowCountVal.textContent = e.target.value;
      isGeneratingPreview = true;
      previewSeatsGrid();
    });
  }
  if (colCountInput && colCountVal) {
    colCountInput.addEventListener('input', (e) => {
      if (isLoadingSeats) return;
      colCountVal.textContent = e.target.value;
      isGeneratingPreview = true;
      previewSeatsGrid();
    });
  }
  if (defaultGradeSelect) {
    defaultGradeSelect.addEventListener('change', () => {
      if (isGeneratingPreview) {
        previewSeatsGrid();
      }
    });
  }
  const targetZoneLabel = document.getElementById('targetZoneLabel');
  const emptyState = document.getElementById('emptyState');
  const gridEditorContainer = document.getElementById('gridEditorContainer');
  const btnZoomOut = document.getElementById('btnZoomOut');
  const gridWrapper = document.getElementById('gridWrapper');
  const seatsGrid = document.getElementById('seatsGrid');
  const layoutEditorCard = document.getElementById('layoutEditorCard');
  const btnSaveLayout = document.getElementById('btnSaveLayout');
  // 좌석 라벨 개별 수정 DOM 바인딩
  const editSeatRow = document.getElementById('editSeatRow');
  const editSeatNumber = document.getElementById('editSeatNumber');
  const btnSaveSeatLabel = document.getElementById('btnSaveSeatLabel');

  const zoneSvgLayer = document.getElementById('zoneSvgLayer');

  const svgBgImage = document.getElementById('svgBgImage');

  // 구역 좌석 편집기 모달 오픈 함수
  function openSeatEditor(zoneId, zoneName) {
    if (!zoneId) return;
    modalZoneTitle.innerText = zoneName;

    // 구역 배경 이미지가 있다면 모달용 배경 이미지로 설정
    const curZone = currentZones.find(z => z.id == zoneId);
    if (curZone && curZone.mapBgUrl) {
      modalGridBgOverlay.style.backgroundImage = `url('${curZone.mapBgUrl}')`;
    } else {
      modalGridBgOverlay.style.backgroundImage = 'none';
    }

    // zoneId를 activeZoneId로 세팅 및 세션 보관
    zoomState.activeZoneId = zoneId;
    sessionStorage.setItem('selectedZoneId', zoneId);
    updateZoneStatusUI(zoneId);

    if (targetZoneLabel) {
      targetZoneLabel.innerText = zoneName;
      targetZoneLabel.classList.remove('text-muted');
      targetZoneLabel.classList.add('text-primary');
    }

    // 좌석 로딩 후 모달 표출
    loadSeats(zoneId).then(() => {
      seatEditorModal.show();
    });
  }

  // SVG 내부 구역 엘리먼트와 currentZones 데이터 바인딩
  function bindSvgZoneEvents(svgRoot) {
    if (!currentZones || currentZones.length === 0) return;

    currentZones.forEach(zone => {
      if (!zone.svgPoints) return;

      // svgPoints 컬럼에 저장된 ID 값(예: zone-A 또는 #zone-A)을 기준으로 SVG 내부 탐색
      const elementId = zone.svgPoints.replace('#', '');
      const targetEl = svgRoot.getElementById(elementId) || svgRoot.querySelector(`[id="${elementId}"]`);

      if (targetEl) {
        targetEl.classList.add('zone-polygon');
        targetEl.style.cursor = 'pointer';

        // 좌석 배치 여부 클래스 및 툴팁 분기 적용
        if (zone.hasSeats) {
          targetEl.classList.remove('zone-no-seats');
          targetEl.classList.add('zone-has-seats');
        } else {
          targetEl.classList.remove('zone-has-seats');
          targetEl.classList.add('zone-no-seats');
        }

        // 마우스 호버 시 툴팁 추가
        const title = targetEl.querySelector('title') || document.createElementNS('http://www.w3.org/2000/svg', 'title');
        const seatStatusLabel = zone.hasSeats ? ' [좌석 설정 완료]' : ' [좌석 미설정]';
        title.textContent = `${zone.zoneName} (정원: ${zone.safetyLimit}명)${seatStatusLabel}`;
        if (!targetEl.querySelector('title')) {
          targetEl.appendChild(title);
        }

        // 비활성화 구역에 대한 스타일 처리
        if (zone.status === 'DISABLED') {
          targetEl.classList.add('zone-disabled');
          const fillElements = targetEl.querySelectorAll('.zone-fill, path, rect, polygon');
          fillElements.forEach(fe => {
            fe.style.fill = '#8592a3';
            fe.style.opacity = '0.5';
          });
        } else {
          targetEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // 이전 선택 스타일 해제
            svgRoot.querySelectorAll('.zone-polygon.selected, .selected').forEach(el => {
              el.classList.remove('selected');
            });
            targetEl.classList.add('selected');

            // 모달 편집창 띄우기
            openSeatEditor(zone.id, zone.zoneName);
          });
        }
      }
    });
  }

  // 배경 이미지 설정 헬퍼 함수 (SVG의 경우 스크립트 실행 보장을 위해 Inline 로드 처리)
  async function setBgImage(url) {
    // 기존에 주입된 인라인 SVG 및 이미지 요소 클리어
    const oldSvg = zoneSvgLayer.querySelector('.inline-imported-svg');
    if (oldSvg) oldSvg.remove();

    if (url && url !== 'none') {
      // SVG 파일인 경우: 자바스크립트 실행 및 상호작용 보장을 위해 fetch 후 Inline 주입
      if (url.toLowerCase().includes('.svg')) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('SVG 도면을 불러올 수 없습니다.');
          const svgText = await res.text();

          // 기존 이미지 요소 경로 제거
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
          svgRoot.setAttribute('style', 'position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: auto;');

          // zoneSvgLayer에 인라인 SVG 주입
          zoneSvgLayer.appendChild(svgRoot);

          // SVG 내 임베디드 스크립트 복구 및 강제 실행 트리거
          svgRoot.querySelectorAll('script').forEach(oldScript => {
            try {
              const newScript = document.createElementNS('http://www.w3.org/2000/svg', 'script');
              newScript.textContent = oldScript.textContent;
              for (let i = 0; i < oldScript.attributes.length; i++) {
                const attr = oldScript.attributes[i];
                if (attr.name.includes('href')) {
                  newScript.setAttributeNS('http://www.w3.org/1999/xlink', 'href', attr.value);
                  newScript.setAttribute('href', attr.value);
                } else {
                  newScript.setAttribute(attr.name, attr.value);
                }
              }
              oldScript.parentNode.replaceChild(newScript, oldScript);
            } catch (e) {
              console.error('SVG 임베디드 스크립트 실행 실패:', e);
            }
          });

          // 로드된 SVG 내 구역 엘리먼트들에 이벤트 바인딩 실행
          bindSvgZoneEvents(svgRoot);

        } catch (err) {
          console.error('SVG 배경 인라인 로드 실패, 폴백 이미지로 전환:', err);
          loadBgAsImageElement(url);
        }
      } else {
        // PNG/JPG 등의 일반 이미지 파일인 경우
        loadBgAsImageElement(url);
      }
    } else {
      if (svgBgImage) {
        svgBgImage.removeAttribute('href');
        svgBgImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }
    }
  }

  // 비트맵/폴백 로드 헬퍼
  function loadBgAsImageElement(url) {
    if (svgBgImage) {
      svgBgImage.setAttribute('href', url);
      svgBgImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
    }
  }

  // SVG 일괄 가져오기 관련 DOM 바인딩
  const svgImportInput = document.getElementById('svgImportInput');
  const svgParsedListWrapper = document.getElementById('svgParsedListWrapper');
  const svgParsedListTbody = document.getElementById('svgParsedListTbody');
  const btnImportSvgZones = document.getElementById('btnImportSvgZones');
  const btnDeleteAllSvgBg = document.getElementById('btnDeleteAllSvgBg');
  const currentSvgBgStatus = document.getElementById('currentSvgBgStatus');
  const currentSvgBgFilename = document.getElementById('currentSvgBgFilename');

  // 모달 엘리먼트 바인딩
  const seatEditorModalEl = document.getElementById('seatEditorModal');
  const seatEditorModal = new bootstrap.Modal(seatEditorModalEl);
  const modalZoneTitle = document.getElementById('modalZoneTitle');
  const modalGridBgOverlay = document.getElementById('modalGridBgOverlay');
  const modalGridWrapper = document.getElementById('modalGridWrapper');
  const btnModalReset = document.getElementById('btnModalReset');
  const btnModalSaveLayout = document.getElementById('btnModalSaveLayout');

  // 모달 대시보드 통계 엘리먼트 바인딩
  const modalSeatingDashboard = document.getElementById('modalSeatingDashboard');
  const modalDashTotalSeats = document.getElementById('modalDashTotalSeats');
  const modalDashReservedSeats = document.getElementById('modalDashReservedSeats');
  const modalDashAvailableSeats = document.getElementById('modalDashAvailableSeats');
  const modalDashTotalRevenue = document.getElementById('modalDashTotalRevenue');
  const modalSeatingGaugeContainer = document.getElementById('modalSeatingGaugeContainer');
  const modalDashReservedPercent = document.getElementById('modalDashReservedPercent');
  const modalDashReservedProgressBar = document.getElementById('modalDashReservedProgressBar');

  // 등급 설정 영역 DOM 바인딩
  const gradeSettingsContainer = document.getElementById('gradeSettingsContainer');
  const btnAddGrade = document.getElementById('btnAddGrade');

  // 등급 색상 정의 풀 (총 9개까지 지원하며 색상 톤 정의)
  const GRADE_COLORS = [
    { name: '기본(그레이)', class: 'seat-available', border: 'rgba(133, 146, 163, 0.4)', color: '#8592a3', bg: 'rgba(133, 146, 163, 0.08)' },
    { name: '골드(VIP)', class: 'seat-vip', border: 'rgba(255, 171, 0, 0.6)', color: '#ffab00', bg: 'rgba(255, 171, 0, 0.08)' },
    { name: '블루(R)', class: 'seat-r', border: 'rgba(105, 108, 255, 0.6)', color: '#696cff', bg: 'rgba(105, 108, 255, 0.08)' },
    { name: '하늘색(S)', class: 'seat-s', border: 'rgba(3, 195, 236, 0.6)', color: '#03c3ec', bg: 'rgba(3, 195, 236, 0.08)' },
    { name: '초록색', class: 'seat-custom-1', border: 'rgba(113, 221, 55, 0.6)', color: '#71dd37', bg: 'rgba(113, 221, 55, 0.08)' },
    { name: '핑크색', class: 'seat-custom-2', border: 'rgba(255, 62, 29, 0.6)', color: '#ff3e1d', bg: 'rgba(255, 62, 29, 0.08)' },
    { name: '보라색', class: 'seat-custom-3', border: 'rgba(130, 94, 251, 0.6)', color: '#825efb', bg: 'rgba(130, 94, 251, 0.08)' },
    { name: '마젠타', class: 'seat-custom-4', border: 'rgba(233, 30, 99, 0.6)', color: '#e91e63', bg: 'rgba(233, 30, 99, 0.08)' },
    { name: '청록색', class: 'seat-custom-5', border: 'rgba(0, 150, 136, 0.6)', color: '#009688', bg: 'rgba(0, 150, 136, 0.08)' }
  ];

  // Global State
  let seatGrades = JSON.parse(localStorage.getItem('adminSeatGrades')) || [
    { name: '일반석', price: 50000, class: 'seat-available' },
    { name: 'VIP석', price: 150000, class: 'seat-vip' },
    { name: 'R석', price: 120000, class: 'seat-r' },
    { name: 'S석', price: 90000, class: 'seat-s' }
  ];

  let seatsData = [];
  let isDrawing = false;
  let selectedMode = '조회'; // '조회' (정보 조회), '일반석', 'VIP석' 등..
  let originalSeatsState = []; // 되돌리기용 복사본
  let activeCtrlSeatId = null; // 현재 오프캔버스 열람 중인 좌석 ID
  let currentZones = []; // 구역 정보 백업
  let isGeneratingPreview = false; // 가상 미리보기 동작 제어 플래그
  let isLoadingSeats = false; // DB 좌석 데이터 로딩 잠금 플래그

  // 드로잉 및 줌 상태 변수
  let isDrawingMode = false;
  let isDeleteZoneMode = false; // 구역 삭제 모드
  let drawPoints = [];
  let zoomState = { zoomed: false, scale: 1, x: 0, y: 0, activeZoneId: null };

  // 구역 다각형 드래그 상태 관리 변수 추가
  let isDraggingPolygon = false;
  let draggedPolygon = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let originalPointsArray = [];
  let dragHasMoved = false;

  // 앵커 리사이즈 상태 관리 변수 추가
  let isDraggingAnchor = false;
  let activeAnchorIdx = -1;
  let activeEditZoneId = null;





  // SVG 도면 전체 삭제 버튼 (모든 구역의 배경 일괄 제거)
  btnDeleteAllSvgBg.addEventListener('click', async () => {
    const festivalId = festivalSelect.value;
    if (!festivalId) {
      Swal.fire('경고', '페스티벌을 먼저 선택해 주세요.', 'warning');
      return;
    }

    const zonesWithBg = currentZones.filter(z => z.mapBgUrl);
    if (zonesWithBg.length === 0) {
      Swal.fire('알림', '등록된 SVG 배경 도면이 없습니다.', 'info');
      return;
    }

    const confirmResult = await Swal.fire({
      title: 'SVG 도면 삭제',
      html: `현재 페스티벌의 <strong>모든 구역(${zonesWithBg.length}개)</strong>에 등록된 배경 도면을 삭제합니다.<br>
                 <span class="text-danger" style="font-size: 0.85rem;">
                   <i class="bx bx-error me-1"></i>삭제 후에는 새 SVG 파일을 다시 업로드해야 합니다.
                 </span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '<i class="bx bx-trash me-1"></i>삭제 실행',
      cancelButtonText: '취소',
      confirmButtonColor: '#ff3e1d',
      cancelButtonColor: '#8592a3'
    });

    if (!confirmResult.isConfirmed) return;

    try {
      Swal.showLoading();
      let failCount = 0;

      // 배경이 등록된 모든 구역에 대해 DELETE 호출
      for (const zone of zonesWithBg) {
        try {
          const res = await fetch(`/api/admin/zones/${zone.id}/background`, {
            method: 'DELETE',
            headers: { 'Authorization': getAuthHeader() }
          });
          if (res.ok) {
            // 로컬 currentZones 데이터도 즉시 갱신
            const idx = currentZones.findIndex(z => z.id === zone.id);
            if (idx !== -1) currentZones[idx].mapBgUrl = null;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      // 화면 초기화
      setBgImage('none');
      if (gridBgOverlay) gridBgOverlay.style.backgroundImage = 'none';
      if (currentSvgBgStatus) currentSvgBgStatus.style.display = 'none';
      svgImportInput.value = '';
      clearSvgImport();

      if (failCount === 0) {
        Swal.fire({
          title: '삭제 완료',
          text: `${zonesWithBg.length}개 구역의 SVG 배경 도면이 모두 제거되었습니다.\n새 SVG 파일을 업로드하여 교체할 수 있습니다.`,
          icon: 'success'
        });
      } else {
        Swal.fire('부분 완료', `${zonesWithBg.length - failCount}개는 삭제되었으나, ${failCount}개는 실패했습니다.`, 'warning');
      }

    } catch (err) {
      Swal.fire('에러', err.message, 'error');
    }
  });

  // SVG 일괄 가져오기 관련 변수 및 이벤트 핸들러
  let parsedSvgZones = [];

  // SVG 미리보기 레이어 생성
  const svgPreviewLayer = (() => {
    let layer = document.getElementById('svgPreviewLayer');
    if (!layer) {
      layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.setAttribute('id', 'svgPreviewLayer');
      zoneSvgLayer.appendChild(layer);
    }
    return layer;
  })();

  // SVG 파일 선택 이벤트
  svgImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) {
      clearSvgImport();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const svgText = event.target.result;
      parsedSvgZones = parseSvgFile(svgText);

      if (parsedSvgZones.length === 0) {
        Swal.fire('알림', '선택한 SVG 파일에서 유효한 구역(polygon, rect, path)을 찾지 못했습니다.', 'warning');
        clearSvgImport();
        return;
      }

      // 기존의 이미지 백그라운드 대신 인라인 SVG 직접 주입 및 스크립트 실행 활성화
      if (svgBgImage) {
        svgBgImage.removeAttribute('href');
        svgBgImage.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
      }

      // 기존에 삽입되었던 SVG 노드가 있다면 제거
      const oldSvg = zoneSvgLayer.querySelector('.inline-imported-svg');
      if (oldSvg) oldSvg.remove();

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgRoot = doc.documentElement;
      svgRoot.classList.add('inline-imported-svg');
      svgRoot.setAttribute('width', '100%');
      svgRoot.setAttribute('height', '100%');
      svgRoot.setAttribute('style', 'position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: auto; z-index: 1;');

      // zoneSvgLayer의 맨 처음에 삽입하여 구역 다각형들이 위에 올 수 있게 처리
      zoneSvgLayer.insertBefore(svgRoot, zoneSvgLayer.firstChild);

      // SVG 내부 스크립트 복구 및 강제 실행
      svgRoot.querySelectorAll('script').forEach(oldScript => {
        try {
          const newScript = document.createElementNS('http://www.w3.org/2000/svg', 'script');
          newScript.textContent = oldScript.textContent;
          for (let i = 0; i < oldScript.attributes.length; i++) {
            const attr = oldScript.attributes[i];
            if (attr.name.includes('href')) {
              newScript.setAttributeNS('http://www.w3.org/1999/xlink', 'href', attr.value);
              newScript.setAttribute('href', attr.value);
            } else {
              newScript.setAttribute(attr.name, attr.value);
            }
          }
          oldScript.parentNode.replaceChild(newScript, oldScript);
        } catch (e) {
          console.error('SVG 스크립트 실행 실패:', e);
        }
      });

      // 임시 URL 저장 (배포 API용)
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      zoneSvgLayer.dataset.tempImportUrl = svgUrl;

      renderParsedZonesList();
      drawPreviewZones();
      svgParsedListWrapper.style.display = 'block';
    };
    reader.readAsText(file);
  });

  // SVG 파서 함수 (디자인용 불필요 데코레이션 요소 및 아이콘 등 필터링 강화)
  function parseSvgFile(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgRoot = doc.documentElement;

    // 브라우저의 SVG 레이아웃 엔진을 통해 getCTM()을 호출하기 위해 임시로 DOM에 렌더링
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.visibility = 'hidden';
    tempContainer.appendChild(svgRoot);
    document.body.appendChild(tempContainer);

    const zones = [];

    try {
      // 특정 클래스(.zone)나 data-zone 속성이 마킹되어 있는 경우, 마킹된 노드들만 추출
      const hasTaggedZones = svgRoot.querySelector('.zone, [data-zone="true"]') !== null;

      // viewBox 또는 width/height를 활용한 스케일링 설정 (기본값: 1000x1000)
      let viewBox = { x: 0, y: 0, w: 1000, h: 1000 };
      const vbAttr = svgRoot.getAttribute('viewBox');
      if (vbAttr) {
        const parts = vbAttr.split(/[\s,]+/).map(Number);
        if (parts.length === 4) {
          viewBox = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        }
      } else {
        const wAttr = parseFloat(svgRoot.getAttribute('width'));
        const hAttr = parseFloat(svgRoot.getAttribute('height'));
        if (!isNaN(wAttr) && !isNaN(hAttr)) {
          viewBox = { x: 0, y: 0, w: wAttr, h: hAttr };
        } else {
          const bbox = svgRoot.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            viewBox = { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
          }
        }
      }

      // SVG 로컬 좌표 -> 1000x1000 캔버스로 매핑
      function normalizePoint(x, y) {
        const nx = ((x - viewBox.x) / viewBox.w) * 1000;
        const ny = ((y - viewBox.y) / viewBox.h) * 1000;
        return [Math.round(nx), Math.round(ny)];
      }

      function getElementName(el) {
        const zoneGroup = el.closest('.zone, [data-zone="true"]');
        const groupName = zoneGroup ? (zoneGroup.getAttribute('id') || zoneGroup.getAttribute('data-label') || '') : '';
        return groupName || el.getAttribute('id') || el.getAttribute('name') || el.getAttribute('class') || '';
      }

      function getElementId(el) {
        const zoneGroup = el.closest('.zone, [data-zone="true"]');
        const id = zoneGroup ? zoneGroup.getAttribute('id') : el.getAttribute('id');
        return id || '';
      }

      // 1. Polygons 파싱 (transform 반영 및 노이즈 필터링)
      svgRoot.querySelectorAll('polygon').forEach((poly, idx) => {
        if (hasTaggedZones && !poly.closest('.zone, [data-zone="true"]')) return;
        // 클립패스, 정의태그 등 내부 템플릿 요소는 제외
        if (poly.closest('defs, clipPath, mask, linearGradient')) return;

        // 크기 필터링 (너무 작거나 한쪽이라도 화면을 가득 채우는 요소는 제외)
        const bbox = poly.getBBox();
        const targetWidth = (bbox.width / viewBox.w) * 1000;
        const targetHeight = (bbox.height / viewBox.h) * 1000;
        if (targetWidth < 15 || targetHeight < 15) return;
        if (targetWidth > 950 || targetHeight > 950) return;

        const matrix = poly.getCTM();
        const pointsAttr = poly.getAttribute('points');
        if (pointsAttr && matrix) {
          const pairs = pointsAttr.trim().split(/[\s,]+/);
          const transformedPairs = [];
          for (let i = 0; i < pairs.length; i += 2) {
            if (pairs[i] !== undefined && pairs[i + 1] !== undefined) {
              const x = parseFloat(pairs[i]);
              const y = parseFloat(pairs[i + 1]);
              const p = svgRoot.createSVGPoint();
              p.x = x;
              p.y = y;
              const tp = p.matrixTransform(matrix);
              transformedPairs.push(normalizePoint(tp.x, tp.y).join(','));
            }
          }
          // 꼭짓점이 3개 이상 12개 이하인 형태만 구역 다각형으로 필터링
          if (transformedPairs.length >= 3 && transformedPairs.length <= 12) {
            zones.push({
              type: 'polygon',
              name: getElementName(poly) || `구역 ${zones.length + 1}`,
              elementId: getElementId(poly) || `zone-poly-${zones.length + 1}`,
              points: transformedPairs.join(' '),
              safetyLimit: 500
            });
          }
        }
      });

      // 2. Rects 파싱 (transform 반영 및 노이즈 필터링)
      svgRoot.querySelectorAll('rect').forEach((rect, idx) => {
        if (hasTaggedZones && !rect.closest('.zone, [data-zone="true"]')) return;
        if (rect.closest('defs, clipPath, mask, linearGradient')) return;

        const bbox = rect.getBBox();
        const targetWidth = (bbox.width / viewBox.w) * 800;
        const targetHeight = (bbox.height / viewBox.h) * 660;
        if (targetWidth < 15 || targetHeight < 15) return;
        if (targetWidth > 750 || targetHeight > 610) return;

        const matrix = rect.getCTM();
        const x = parseFloat(rect.getAttribute('x')) || 0;
        const y = parseFloat(rect.getAttribute('y')) || 0;
        const w = parseFloat(rect.getAttribute('width')) || 0;
        const h = parseFloat(rect.getAttribute('height')) || 0;
        if (w > 0 && h > 0 && matrix) {
          const corners = [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h }
          ];
          const transformedPairs = corners.map(c => {
            const p = svgRoot.createSVGPoint();
            p.x = c.x;
            p.y = c.y;
            const tp = p.matrixTransform(matrix);
            return normalizePoint(tp.x, tp.y).join(',');
          });
          zones.push({
            type: 'rect',
            name: getElementName(rect) || `구역 ${zones.length + 1}`,
            elementId: getElementId(rect) || `zone-rect-${zones.length + 1}`,
            points: transformedPairs.join(' '),
            safetyLimit: 500
          });
        }
      });

      // 3. Paths 파싱 (getPointAtLength 샘플링 기법 도입으로 곡선/원호 패스 완벽 지원)
      svgRoot.querySelectorAll('path').forEach((path, idx) => {
        if (hasTaggedZones && !path.closest('.zone, [data-zone="true"]')) return;
        if (path.closest('defs, clipPath, mask, linearGradient')) return;

        const d = path.getAttribute('d') || '';
        // 닫히지 않은 라인(z/Z 미포함)이거나getTotalLength가 없으면 구역 배치용 도형이 아니므로 필터링
        if (!d.toLowerCase().includes('z') || !path.getTotalLength) return;

        const bbox = path.getBBox();
        const targetWidth = (bbox.width / viewBox.w) * 800;
        const targetHeight = (bbox.height / viewBox.h) * 660;
        if (targetWidth < 15 || targetHeight < 15) return;
        if (targetWidth > 750 || targetHeight > 610) return;

        const matrix = path.getCTM();
        if (matrix) {
          try {
            const totalLength = path.getTotalLength();
            if (totalLength <= 0) return;

            // 패스의 곡선을 다각형 꼭짓점으로 변환하기 위한 샘플링 (구역 지정을 위해 8개 지점 추출)
            const sampleCount = 8;
            const transformedPairs = [];

            for (let i = 0; i < sampleCount; i++) {
              const distance = (totalLength * i) / sampleCount;
              const pt = path.getPointAtLength(distance);

              const p = svgRoot.createSVGPoint();
              p.x = pt.x;
              p.y = pt.y;
              const tp = p.matrixTransform(matrix);

              transformedPairs.push(normalizePoint(tp.x, tp.y).join(','));
            }

            // 중복 제거
            const uniquePairs = transformedPairs.filter((item, index) => transformedPairs.indexOf(item) === index);

            if (uniquePairs.length >= 3) {
              zones.push({
                type: 'path',
                name: getElementName(path) || `구역 ${zones.length + 1}`,
                elementId: getElementId(path) || `zone-path-${zones.length + 1}`,
                points: uniquePairs.join(' '),
                safetyLimit: 500
              });
            }
          } catch (e) {
            console.error('Path 샘플링 중 에러 발생:', e);
          }
        }
      });
    } catch (err) {
      console.error('SVG 파싱 에러:', err);
    } finally {
      document.body.removeChild(tempContainer);
    }

    return zones;
  }

  // 파싱된 구역 리스트 HTML 렌더링
  function renderParsedZonesList() {
    svgParsedListTbody.innerHTML = '';
    parsedSvgZones.forEach((zone, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
            <td class="text-center align-middle">
              <input type="checkbox" class="form-check-input svg-zone-checkbox" data-index="${idx}" checked>
            </td>
            <td class="align-middle">
              <input type="text" class="form-control form-control-sm svg-zone-name-input" data-index="${idx}" value="${zone.name}">
            </td>
            <td class="align-middle">
              <input type="number" class="form-control form-control-sm svg-zone-limit-input" data-index="${idx}" value="${zone.safetyLimit}" min="1">
            </td>
          `;
      svgParsedListTbody.appendChild(tr);
    });

    // 리스트 변경 시 실시간 동기화
    svgParsedListTbody.querySelectorAll('.svg-zone-name-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        parsedSvgZones[idx].name = e.target.value;
        drawPreviewZones();
      });
    });

    svgParsedListTbody.querySelectorAll('.svg-zone-limit-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        parsedSvgZones[idx].safetyLimit = parseInt(e.target.value) || 500;
      });
    });
  }

  // 파싱된 구역 임시 드로잉 프리뷰
  function drawPreviewZones() {
    svgPreviewLayer.innerHTML = '';

    // 가져오기 프리뷰 화면에서 은은한 하이라이트 제공 (기존의 난잡한 다각형 덧그리기 방지)
    // zoneSvgLayer에 삽입된 원본 SVG 객체 내부를 직접 조작
    const svgDoc = zoneSvgLayer.querySelector('.inline-imported-svg') || zoneSvgLayer.querySelector('svg');
    if (!svgDoc) return;

    // 이전에 적용된 임시 프리뷰 스타일 일괄 초기화
    svgDoc.querySelectorAll('.temp-preview-zone').forEach(el => {
      el.classList.remove('temp-preview-zone');
      el.style.stroke = '';
      el.style.strokeWidth = '';
      el.style.strokeDasharray = '';
      el.style.fill = '';
      el.style.cursor = '';
    });

    parsedSvgZones.forEach((zone, idx) => {
      const checkbox = svgParsedListTbody.querySelector(`.svg-zone-checkbox[data-index="${idx}"]`);
      if (checkbox && !checkbox.checked) return;

      // Element ID로 타겟 요소를 SVG 내부에서 안전하게 탐색
      const elementId = zone.elementId;
      const targetEl = svgDoc.getElementById(elementId) || svgDoc.querySelector(`[id="${elementId}"]`);
      if (targetEl) {
        targetEl.classList.add('temp-preview-zone');
        targetEl.style.transition = 'all 0.3s ease';
        targetEl.style.stroke = '#696cff';
        targetEl.style.strokeWidth = '3px';
        targetEl.style.strokeDasharray = '5,5';
        targetEl.style.fill = 'rgba(105, 108, 255, 0.15)';
        targetEl.style.cursor = 'help';

        // 마우스 툴팁 부착
        const title = targetEl.querySelector('title') || document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `[가져오기 예정] ${zone.name}`;
        if (!targetEl.querySelector('title')) {
          targetEl.appendChild(title);
        }
      }
    });
  }

  // 체크박스 상태 변경 시 프리뷰 업데이트
  svgParsedListTbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('svg-zone-checkbox')) {
      drawPreviewZones();
    }
  });

  // 가져오기 실행 (첫 번째 구역 생성 후 도면 업로드 -> 나머지 구역 배경 자동 공유)
  btnImportSvgZones.addEventListener('click', async () => {
    const festivalId = festivalSelect.value;
    if (!festivalId) {
      Swal.fire('경고', '페스티벌을 먼저 선택해 주세요.', 'warning');
      return;
    }

    const selectedCheckboxes = svgParsedListTbody.querySelectorAll('.svg-zone-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
      Swal.fire('알림', '가져올 구역을 최소 하나 이상 선택해 주세요.', 'warning');
      return;
    }

    const confirmResult = await Swal.fire({
      title: '구역 가져오기 실행',
      text: `선택하신 ${selectedCheckboxes.length}개의 구역을 등록하고, 업로드한 SVG 파일을 좌석 배치도 배경 도면으로 설정하시겠습니까?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '가져오기',
      cancelButtonText: '취소',
      confirmButtonColor: '#696cff'
    });

    if (confirmResult.isConfirmed) {
      try {
        Swal.showLoading();
        let successCount = 0;
        let uploadedBgUrl = null;

        // 1단계: 첫 번째 구역 생성
        const firstCheckbox = selectedCheckboxes[0];
        const firstIdx = parseInt(firstCheckbox.dataset.index);
        const firstZone = parsedSvgZones[firstIdx];

        const firstPayload = {
          festivalId: parseInt(festivalId),
          zoneName: firstZone.name,
          safetyLimit: firstZone.safetyLimit,
          svgPoints: firstZone.elementId || firstZone.points
        };

        const firstRes = await fetch('/api/admin/zones', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
          },
          body: JSON.stringify(firstPayload)
        });

        if (firstRes.ok) {
          successCount++;
          const createdFirstZone = await firstRes.json();

          // 2단계: 첫 번째 구역에 업로드한 SVG 파일을 배경으로 전송
          const file = svgImportInput.files[0];
          if (file) {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch(`/api/admin/zones/${createdFirstZone.id}/background`, {
              method: 'POST',
              headers: {
                'Authorization': getAuthHeader()
              },
              body: formData
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              uploadedBgUrl = uploadData.fileUrl; // 업로드된 SVG 도면 URL
            }
          }
        }

        // 3단계: 나머지 구역 생성 (이 때 획득한 배경 URL을 payload에 포함하여 공유 설정)
        for (let i = 1; i < selectedCheckboxes.length; i++) {
          const cb = selectedCheckboxes[i];
          const idx = parseInt(cb.dataset.index);
          const zone = parsedSvgZones[idx];

          const payload = {
            festivalId: parseInt(festivalId),
            zoneName: zone.name,
            safetyLimit: zone.safetyLimit,
            svgPoints: zone.elementId || zone.points
          };
          if (uploadedBgUrl) {
            payload.mapBgUrl = uploadedBgUrl;
          }

          const res = await fetch('/api/admin/zones', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': getAuthHeader()
            },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            successCount++;
          }
        }

        Swal.fire('가져오기 완료', `${successCount}개의 구역이 성공적으로 생성되었으며, 업로드한 SVG 도면이 배경으로 등록되었습니다.`, 'success');
        clearSvgImport();
        await refreshZones(festivalId);
      } catch (err) {
        Swal.fire('에러', err.message, 'error');
      }
    }
  });

  // 가져오기 완료 및 리셋
  function clearSvgImport() {
    svgImportInput.value = '';
    svgParsedListWrapper.style.display = 'none';
    svgParsedListTbody.innerHTML = '';
    parsedSvgZones = [];
    svgPreviewLayer.innerHTML = '';

    // 임시 SVG Blob URL 해제 및 원래 배경으로 복구
    if (zoneSvgLayer.dataset.tempImportUrl) {
      URL.revokeObjectURL(zoneSvgLayer.dataset.tempImportUrl);
      delete zoneSvgLayer.dataset.tempImportUrl;
    }
    const festivalId = festivalSelect.value;
    if (festivalId) {
      refreshZones(festivalId); // 내부에서 currentSvgBgStatus를 최신 상태로 재동기화
    } else {
      setBgImage('none');
      if (currentSvgBgStatus) currentSvgBgStatus.style.display = 'none';
    }
  }

  // 모달 닫힐 때의 리셋 이벤트 추가 (메인 뷰 선택 상태 및 배경 도면은 유지)
  seatEditorModalEl.addEventListener('hidden.bs.modal', () => {
    modalGridWrapper.innerHTML = '';
    modalGridWrapper.classList.remove('active');
    modalGridBgOverlay.style.backgroundImage = 'none';

    btnModalReset.disabled = true;
    btnModalSaveLayout.disabled = true;
  });

  // 설정 모드 체인지 바인딩 (모달용)
  document.querySelectorAll('input[name="editorMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      selectedMode = e.target.value;
    });
  });

  // Authorization Header Helper
  function getAuthHeader() {
    const token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
    return token ? 'Bearer ' + token : '';
  }

  // 등급 판별 헬퍼 함수
  function getGradeClass(price) {
    const matched = seatGrades.find(g => g.price === Number(price));
    return matched ? matched.class : 'seat-available';
  }

  // 3-1. 등급 단가 설정 UI 렌더러
  function renderGradeSettings() {
    if (!gradeSettingsContainer) return;
    gradeSettingsContainer.innerHTML = '';

    seatGrades.forEach((grade, idx) => {
      const colorMeta = GRADE_COLORS.find(c => c.class === grade.class) || GRADE_COLORS[0];

      const rowDiv = document.createElement('div');
      rowDiv.className = 'row g-2 align-items-center mb-1';

      rowDiv.innerHTML = `
            <div class="col-5">
              <label class="form-label fw-bold mb-1" style="color: ${colorMeta.color};">
                <i class="bx bx-tag me-1"></i>${grade.name}
              </label>
              <input type="text" class="form-control form-control-sm bg-light fw-bold" value="${grade.name}" readonly style="border-color: ${colorMeta.border}; color: ${colorMeta.color};">
            </div>
            <div class="col-5">
              <label class="form-label text-muted mb-1">단가 (₩)</label>
              <input type="number" class="form-control form-control-sm grade-price-input" data-index="${idx}" value="${grade.price}" step="5000" min="0">
            </div>
            <div class="col-2 text-end pt-4">
              <button type="button" class="btn btn-sm btn-icon btn-outline-danger btn-delete-grade" data-index="${idx}" ${seatGrades.length <= 1 ? 'disabled' : ''}>
                <i class="bx bx-trash"></i>
              </button>
            </div>
          `;
      gradeSettingsContainer.appendChild(rowDiv);
    });

    // 가격 실시간 변경 동기화 이벤트 바인딩
    gradeSettingsContainer.querySelectorAll('.grade-price-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index);
        seatGrades[idx].price = Number(e.target.value) || 0;
        localStorage.setItem('adminSeatGrades', JSON.stringify(seatGrades));
      });
    });

    // 등급 삭제 이벤트 바인딩
    gradeSettingsContainer.querySelectorAll('.btn-delete-grade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const deletedGrade = seatGrades[idx];

        Swal.fire({
          title: '등급 삭제',
          text: `[${deletedGrade.name}] 등급을 삭제하시겠습니까? (이 등급으로 배치된 기존 좌석의 레이아웃 단가는 일반석 기준으로 리마운트됩니다.)`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ff3e1d',
          cancelButtonColor: '#8592a3',
          confirmButtonText: '삭제 실행',
          cancelButtonText: '취소'
        }).then(result => {
          if (result.isConfirmed) {
            seatGrades.splice(idx, 1);
            localStorage.setItem('adminSeatGrades', JSON.stringify(seatGrades));

            // 전역 선택 모드 재설정 (일반석 디폴트)
            if (selectedMode === deletedGrade.name) {
              selectedMode = seatGrades[0].name;
            }

            renderGradeSettings();
            syncDefaultGradeDropdown();
            syncModalEditorMode();

            // 모달이 열려 있는 상태라면 좌석 배치도도 재렌더링
            const zoneId = zoomState.activeZoneId;
            if (zoneId && seatsData.length > 0) {
              renderGrid(seatsData);
            }
            Swal.fire('삭제 완료', '해당 등급이 성공적으로 삭제되었습니다.', 'success');
          }
        });
      });
    });
  }

  // 대량 생성용 드롭다운 동기화
  function syncDefaultGradeDropdown() {
    const dropdown = document.getElementById('defaultGradeSelect');
    if (!dropdown) return;

    const currentVal = dropdown.value;
    dropdown.innerHTML = '';

    seatGrades.forEach((grade, idx) => {
      const opt = document.createElement('option');
      opt.value = grade.name;
      opt.textContent = grade.name;
      if (currentVal === grade.name || (!currentVal && idx === 0)) {
        opt.selected = true;
      }
      dropdown.appendChild(opt);
    });
  }

  // 모달 편집 색칠 모드 동적 동기화
  function syncModalEditorMode() {
    const container = document.getElementById('modalEditorModeContainer');
    if (!container) return;
    container.innerHTML = '';

    // A. 정보 조회 모드 (기본 조회 기능 활성화)
    const radioView = document.createElement('input');
    radioView.type = 'radio';
    radioView.className = 'btn-check';
    radioView.name = 'editorMode';
    radioView.id = 'modeSys_조회';
    radioView.value = '조회';
    if (selectedMode === '조회') {
      radioView.checked = true;
    }

    const labelView = document.createElement('label');
    labelView.className = 'btn btn-sm btn-outline-primary';
    labelView.style.borderColor = 'rgba(105, 108, 255, 0.6)';
    labelView.style.color = '#696cff';
    labelView.style.background = radioView.checked ? 'rgba(105, 108, 255, 0.08)' : 'transparent';
    labelView.style.marginRight = '8px';
    labelView.style.marginBottom = '8px';
    labelView.setAttribute('for', 'modeSys_조회');
    labelView.innerHTML = `<i class="bx bx-search-alt me-1"></i>정보 조회`;

    radioView.addEventListener('change', (e) => {
      selectedMode = e.target.value;
      syncModalEditorModeStyles();
    });

    container.appendChild(radioView);
    container.appendChild(labelView);

    // B. 등급석 라디오 렌더링
    seatGrades.forEach((grade, idx) => {
      const colorMeta = GRADE_COLORS.find(c => c.class === grade.class) || GRADE_COLORS[0];

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'btn-check';
      radio.name = 'editorMode';
      radio.id = `modeCustom_${idx}`;
      radio.value = grade.name;

      if (selectedMode === grade.name) {
        radio.checked = true;
      }

      const label = document.createElement('label');
      label.className = `btn btn-sm btn-outline-secondary`;
      label.style.borderColor = colorMeta.border;
      label.style.color = colorMeta.color;
      label.style.background = radio.checked ? colorMeta.bg : 'transparent';
      label.style.marginRight = '8px';
      label.style.marginBottom = '8px';
      label.setAttribute('for', `modeCustom_${idx}`);
      label.innerHTML = `<i class="bx bx-purchase-tag me-1"></i>${grade.name}`;

      radio.addEventListener('change', (e) => {
        selectedMode = e.target.value;
        syncModalEditorModeStyles();
      });

      container.appendChild(radio);
      container.appendChild(label);
    });

    // C. 시스템 모드 (무대, 통로, 보류석) 라디오 렌더링
    const systemModes = [
      { value: '무대', label: '무대 설정', icon: 'bx bx-desktop', border: 'rgba(71, 85, 105, 0.6)', color: '#475569', bg: 'rgba(71, 85, 105, 0.08)' },
      { value: '통로', label: '통로 설정', icon: 'bx bx-directions', border: 'rgba(255, 62, 29, 0.6)', color: '#ff3e1d', bg: 'rgba(255, 62, 29, 0.08)' },
      { value: '보류석', label: '보류석 설정', icon: 'bx bx-lock-alt', border: 'rgba(255, 62, 29, 0.6)', color: '#ff3e1d', bg: 'rgba(255, 62, 29, 0.08)' }
    ];

    systemModes.forEach(mode => {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'btn-check';
      radio.name = 'editorMode';
      radio.id = `modeSys_${mode.value}`;
      radio.value = mode.value;
      if (selectedMode === mode.value) {
        radio.checked = true;
      }

      const label = document.createElement('label');
      label.className = `btn btn-sm btn-outline-secondary`;
      label.style.borderColor = mode.border;
      label.style.color = mode.color;
      label.style.background = radio.checked ? mode.bg : 'transparent';
      label.style.marginRight = '8px';
      label.style.marginBottom = '8px';
      label.setAttribute('for', `modeSys_${mode.value}`);
      label.innerHTML = `<i class="${mode.icon} me-1"></i>${mode.label}`;

      radio.addEventListener('change', (e) => {
        selectedMode = e.target.value;
        syncModalEditorModeStyles();
      });

      container.appendChild(radio);
      container.appendChild(label);
    });
  }

  function syncModalEditorModeStyles() {
    const container = document.getElementById('modalEditorModeContainer');
    if (!container) return;

    container.querySelectorAll('input[name="editorMode"]').forEach(radio => {
      const label = container.querySelector(`label[for="${radio.id}"]`);
      if (!label) return;

      const val = radio.value;
      const isChecked = radio.checked;

      const grade = seatGrades.find(g => g.name === val);
      if (grade) {
        const colorMeta = GRADE_COLORS.find(c => c.class === grade.class) || GRADE_COLORS[0];
        label.style.background = isChecked ? colorMeta.bg : 'transparent';
      } else {
        let bg = 'transparent';
        if (isChecked) {
          if (val === '조회') bg = 'rgba(105, 108, 255, 0.08)';
          else if (val === '무대') bg = 'rgba(71, 85, 105, 0.08)';
          else bg = 'rgba(255, 62, 29, 0.08)';
        }
        label.style.background = bg;
      }
    });
  }

  // 등급 추가 버튼 클릭 이벤트 바인딩
  if (btnAddGrade) {
    btnAddGrade.addEventListener('click', async () => {
      const usedClasses = seatGrades.map(g => g.class);
      // 안 쓴 커스텀 색상을 우선순위로 매칭
      const availableColor = GRADE_COLORS.find(c => !usedClasses.includes(c.class)) || GRADE_COLORS[GRADE_COLORS.length - 1];

      const { value: formValues } = await Swal.fire({
        title: '새로운 티켓 등급 추가',
        html:
          '<div class="mb-3 text-start">' +
          '  <label class="form-label fw-bold" style="color: #566a7f;">등급명 (Grade Name)</label>' +
          '  <input id="swal-grade-name" class="form-control" placeholder="예: A석, B석, Standing">' +
          '</div>' +
          '<div class="mb-3 text-start">' +
          '  <label class="form-label fw-bold" style="color: #566a7f;">기본 가격 (₩)</label>' +
          '  <input type="number" id="swal-grade-price" class="form-control" value="80000" min="0" step="5000">' +
          '</div>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: '등급 추가',
        cancelButtonText: '취소',
        confirmButtonColor: '#696cff',
        cancelButtonColor: '#8592a3',
        preConfirm: () => {
          const name = document.getElementById('swal-grade-name').value.trim();
          const price = parseInt(document.getElementById('swal-grade-price').value, 10) || 0;
          if (!name) {
            Swal.showValidationMessage('등급 이름을 입력해 주세요.');
            return false;
          }
          if (seatGrades.some(g => g.name.toLowerCase() === name.toLowerCase())) {
            Swal.showValidationMessage('이미 동일한 이름의 등급이 존재합니다.');
            return false;
          }
          return { name, price };
        }
      });

      if (formValues) {
        seatGrades.push({
          name: formValues.name,
          price: formValues.price,
          class: availableColor.class
        });
        localStorage.setItem('adminSeatGrades', JSON.stringify(seatGrades));

        renderGradeSettings();
        syncDefaultGradeDropdown();
        syncModalEditorMode();

        // 모달이 열려 있는 상태라면 좌석 배치도도 재렌더링
        const zoneId = zoomState.activeZoneId;
        if (zoneId && seatsData.length > 0) {
          renderGrid(seatsData);
        }

        Swal.fire('성공', `[${formValues.name}] 등급이 추가되었습니다.`, 'success');
      }
    });
  }

  // 1. 페이지 로드 시 백엔드 API (GET /api/admin/festivals) 호출
  async function fetchFestivals() {
    try {
      const res = await fetch('/api/admin/festivals', {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (!res.ok) throw new Error('페스티벌 목록을 가져오지 못했습니다.');
      const festivals = await res.json();

      festivalSelect.innerHTML = '<option value="">-- 페스티벌을 선택하세요 --</option>';
      festivals.forEach(fest => {
        festivalSelect.innerHTML += `<option value="${fest.id}">${fest.name}</option>`;
      });
    } catch (err) {
      Swal.fire('에러', err.message, 'error');
    }
  }

  // 2-1. 구역 목록 새로고침 헬퍼 함수
  async function refreshZones(festivalId, selectZoneId = null) {
    try {
      const res = await fetch(`/api/admin/festivals/${festivalId}/zones`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (!res.ok) throw new Error('구역 목록을 가져오지 못했습니다.');
      const zones = await res.json();

      if (zones.length === 0) {
        currentZones = []; // 백업 초기화
        const dynamicLayer = document.getElementById('dynamicZonesLayer');
        if (dynamicLayer) {
          dynamicLayer.innerHTML = '';
        } else {
          zoneSvgLayer.innerHTML = '';
        }
        return;
      }

      currentZones = zones; // 백업 저장

      // 만약 등록된 구역 중에 배경 도면이 등록된 구역이 있다면 메인 화면 배경 이미지로 설정
      const zoneWithBg = zones.find(z => z.mapBgUrl);
      if (zoneWithBg && zoneWithBg.mapBgUrl) {
        setBgImage(zoneWithBg.mapBgUrl);

        // SVG 도면 상태 패널 표시
        if (currentSvgBgStatus) {
          const urlParts = zoneWithBg.mapBgUrl.split('/');
          const fname = urlParts[urlParts.length - 1];
          currentSvgBgFilename.textContent = fname;
          currentSvgBgStatus.style.display = 'block';
          currentSvgBgStatus.style.background = 'rgba(105, 108, 255, 0.05)';
          currentSvgBgStatus.style.border = '1px solid rgba(105, 108, 255, 0.3)';
        }
      } else {
        setBgImage('none');

        // SVG 도면 상태 패널 숨김
        if (currentSvgBgStatus) {
          currentSvgBgStatus.style.display = 'none';
        }
      }



      // SVG 레이어에 구역 다각형 지도 그리기 연동
      drawZonesOnSvg(zones);

      // 만약 구역을 새로 생성하여 자동 선택시켰을 경우, 좌석 목록도 즉시 리로드 처리
      if (selectZoneId) {
        updateZoneStatusUI(selectZoneId);

        // 대상 구역 레이블 업데이트
        const selectedZone = zones.find(z => z.id == selectZoneId);
        if (selectedZone && targetZoneLabel) {
          targetZoneLabel.innerText = selectedZone.zoneName;
          targetZoneLabel.classList.remove('text-muted');
          targetZoneLabel.classList.add('text-primary');
        }

        await loadSeats(selectZoneId);
      }
    } catch (err) {
      Swal.fire('에러', err.message, 'error');
    }
  }

  // SVG 다각형 구역 렌더링 및 줌인 바인딩
  function drawZonesOnSvg(zones) {
    // 이미 setBgImage 내에서 bindSvgZoneEvents를 호출하여 처리하므로,
    // 여기서는 inline SVG 루트가 존재할 경우 다시 이벤트를 바인딩해주는 역할만 수행합니다.
    const svgRoot = zoneSvgLayer.querySelector('.inline-imported-svg');
    if (svgRoot) {
      bindSvgZoneEvents(svgRoot);
    }
  }

  // 마우스 전역 드래그 감지
  let isMouseDown = false;
  let selectedSeatsMap = new Map();

  document.addEventListener('mousedown', () => {
    isMouseDown = true;
  });
  document.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  // 특정 등급에 따른 가격 획득
  function getPriceForGrade(grade) {
    const matched = seatGrades.find(g => g.name === grade || g.class.includes(grade.toLowerCase()));
    if (matched) return matched.price;
    if (grade === 'VIP') return 150000;
    if (grade === 'R') return 120000;
    if (grade === 'S') return 90000;
    return 50000; // 일반석 디폴트
  }

  // 줌인된 상태에서 좌석 격자 데이터 로드 및 렌더링
  async function loadSeatsForLayout(zoneId) {
    try {
      seatsGrid.innerHTML = '<div class="text-center text-muted py-4"><i class="bx bx-loader-alt bx-spin fs-4"></i> 로딩 중...</div>';
      selectedSeatsMap.clear();

      const res = await fetch(`/api/admin/zones/${zoneId}/seats`, {
        headers: { 'Authorization': getAuthHeader() }
      });
      if (!res.ok) throw new Error('좌석 목록 조회 실패');

      const seats = await res.json();
      seatsGrid.innerHTML = '';

      if (seats.length === 0) {
        seatsGrid.innerHTML = '<div class="text-center text-muted py-4">생성된 좌석이 없습니다.<br>상단 \'좌석 격자판 대량 생성\' 폼에서 먼저 생성해 주세요.</div>';
        return;
      }

      // 행과 열의 최댓값을 구함
      let maxRow = 1;
      let maxCol = 1;
      seats.forEach(s => {
        if (s.seatRow > maxRow) maxRow = s.seatRow;
        if (s.seatNumber > maxCol) maxCol = s.seatNumber;
      });

      // CSS Grid 템플릿 설정
      seatsGrid.style.gridTemplateRows = `repeat(${maxRow}, minmax(36px, 1fr))`;
      seatsGrid.style.gridTemplateColumns = `repeat(${maxCol}, minmax(36px, 1fr))`;

      // 2차원 공간 매핑
      const seatMatrix = Array.from({ length: maxRow }, () => Array(maxCol).fill(null));
      seats.forEach(s => {
        seatMatrix[s.seatRow - 1][s.seatNumber - 1] = s;
      });

      // DOM 셀 렌더링
      for (let r = 0; r < maxRow; r++) {
        for (let c = 0; c < maxCol; c++) {
          const seat = seatMatrix[r][c];
          const cell = document.createElement('div');
          cell.className = 'seat-cell';

          if (!seat) {
            // 빈 데이터 영역은 통로로 처리
            cell.classList.add('seat-corridor');
          } else {
            cell.dataset.seatId = seat.id;
            cell.dataset.rowLabel = seat.rowLabel || `${r + 1}행`;
            cell.dataset.colNum = seat.seatNumber;

            // 상태별 클래스 매핑
            if (seat.status === '무대') {
              cell.classList.add('seat-stage');
              cell.innerHTML = 'STAGE';
            } else if (seat.status === '통로') {
              cell.classList.add('seat-corridor');
            } else if (seat.status === 'PAID' || seat.status === 'RESERVED') {
              cell.classList.add('seat-reserved');
              cell.innerHTML = `<i class="bx bx-lock-alt"></i>`;
              const tooltip = document.createElement('title');
              tooltip.textContent = `판매완료 (${seat.rowLabel}-${seat.seatNumber})`;
              cell.appendChild(tooltip);
            } else {
              // 빈자리 또는 등급별 색상 부여
              const gradeClass = getGradeClass(seat.price);
              cell.classList.add(gradeClass);

              let displayLabel = seat.rowLabel ? `${seat.rowLabel}-${seat.seatNumber}` : `${r + 1}-${c + 1}`;
              cell.innerHTML = `${displayLabel}<span class="seat-price-tag">₩${seat.price.toLocaleString()}</span>`;
            }

            // 드래그/클릭 바인딩
            cell.addEventListener('mousedown', (e) => {
              e.preventDefault();
              const currentMode = document.querySelector('input[name="layoutEditMode"]:checked').value;
              if (currentMode === '조회') {
                if (seat.status !== '무대' && seat.status !== '통로') {
                  showSeatReservationDetails(seat);
                }
              } else {
                applyEditToCell(cell);
              }
            });
            cell.addEventListener('mouseenter', () => {
              const currentMode = document.querySelector('input[name="layoutEditMode"]:checked').value;
              if (currentMode !== '조회' && isMouseDown) {
                applyEditToCell(cell);
              }
            });
          }

          seatsGrid.appendChild(cell);
        }
      }

    } catch (err) {
      seatsGrid.innerHTML = `<div class="text-danger p-3">${err.message}</div>`;
    }
  }

  // 셀 상태 및 등급 실시간 색칠 함수
  function applyEditToCell(cellEl) {
    if (cellEl.classList.contains('seat-reserved')) return; // 판매 완료는 잠금

    const seatId = cellEl.dataset.seatId;
    const currentMode = document.querySelector('input[name="layoutEditMode"]:checked').value;
    if (currentMode === '조회') return; // 조회 모드에서는 색칠 차단

    cellEl.className = 'seat-cell'; // 초기화

    let status = '빈자리';
    let price = getPriceForGrade(currentMode);

    if (currentMode === '무대') {
      cellEl.classList.add('seat-stage');
      cellEl.innerHTML = 'STAGE';
      status = '무대';
    } else if (currentMode === '통로') {
      cellEl.classList.add('seat-corridor');
      cellEl.innerHTML = '';
      status = '통로';
    } else {
      status = '빈자리';
      if (currentMode === 'VIP') {
        cellEl.classList.add('seat-vip');
        cellEl.innerHTML = `VIP<span class="seat-price-tag">₩${price.toLocaleString()}</span>`;
      } else if (currentMode === 'R') {
        cellEl.classList.add('seat-r');
        cellEl.innerHTML = `R<span class="seat-price-tag">₩${price.toLocaleString()}</span>`;
      } else if (currentMode === 'S') {
        cellEl.classList.add('seat-s');
        cellEl.innerHTML = `S<span class="seat-price-tag">₩${price.toLocaleString()}</span>`;
      } else {
        cellEl.classList.add('seat-available');
        cellEl.innerHTML = `${cellEl.dataset.rowLabel}-${cellEl.dataset.colNum}<span class="seat-price-tag">₩${price.toLocaleString()}</span>`;
      }
    }

    selectedSeatsMap.set(seatId, {
      id: parseInt(seatId),
      status: status,
      price: price
    });
  }

  // 레이아웃 저장 버튼 바인딩
  btnSaveLayout.addEventListener('click', async () => {
    if (selectedSeatsMap.size === 0) {
      Swal.fire('알림', '수정된 좌석 데이터가 없습니다.', 'info');
      return;
    }

    const confirmSave = await Swal.fire({
      title: '레이아웃 저장',
      text: `${selectedSeatsMap.size}개 좌석의 변경사항을 영구 저장하시겠습니까?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '저장',
      cancelButtonText: '취소'
    });

    if (confirmSave.isConfirmed) {
      try {
        Swal.showLoading();
        const payload = Array.from(selectedSeatsMap.values());
        const res = await fetch('/api/admin/seats/layout', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('레이아웃 저장 중 오류가 발생했습니다.');

        Swal.fire('성공', '좌석 레이아웃과 등급이 성공적으로 업데이트되었습니다.', 'success');
        selectedSeatsMap.clear();

        // 실시간 재렌더링
        if (zoomState.activeZoneId) {
          await loadSeatsForLayout(zoomState.activeZoneId);
        }
      } catch (err) {
        Swal.fire('에러', err.message, 'error');
      }
    }
  });



  // Figma 기본 배치도 노출 여부 동기화 함수
  function updateFigmaBackgroundVisibility() {
    const festivalId = festivalSelect.value;
    const selectedText = festivalSelect.options[festivalSelect.selectedIndex]?.text || '';
    const figmaBg = document.getElementById('figmaBackground');
    if (figmaBg) {
      if (festivalId && (festivalId === '1' || selectedText.includes('서울 재즈') || selectedText.toLowerCase().includes('jazz'))) {
        figmaBg.style.display = 'block';
      } else {
        figmaBg.style.display = 'none';
      }
    }
  }

  // 2-3. 특정 페스티벌 선택 시 구역 목록 조회
  festivalSelect.addEventListener('change', async (e) => {
    const festivalId = e.target.value;
    updateFigmaBackgroundVisibility();

    if (festivalId) {
      sessionStorage.setItem('selectedFestivalId', festivalId);
    } else {
      sessionStorage.removeItem('selectedFestivalId');
      sessionStorage.removeItem('selectedZoneId');
    }

    // 초기화
    btnGenerate.disabled = true;
    clearGrid();

    if (!festivalId) return;

    await refreshZones(festivalId);
  });

  // 구역 활성화 상태 제어 UI 업데이트
  function updateZoneStatusUI(zoneId) {
    if (!zoneId) {
      if (zoneStatusWrapper) zoneStatusWrapper.style.setProperty('display', 'none', 'important');
      return;
    }
    const zone = currentZones.find(z => z.id == zoneId);
    if (!zone) {
      if (zoneStatusWrapper) zoneStatusWrapper.style.setProperty('display', 'none', 'important');
      return;
    }

    if (zoneStatusWrapper) zoneStatusWrapper.style.setProperty('display', 'flex', 'important');

    if (zone.status === 'DISABLED') {
      btnToggleZoneStatus.className = 'btn btn-xs btn-danger fw-bold';
      btnToggleZoneStatus.innerHTML = '<i class="bx bx-x me-1"></i>미허용 (숨김 중)';
    } else {
      btnToggleZoneStatus.className = 'btn btn-xs btn-success fw-bold';
      btnToggleZoneStatus.innerHTML = '<i class="bx bx-check me-1"></i>허용 (예매 가능)';
    }
  }

  // 구역 활성화 상태 토글 API 연동
  if (btnToggleZoneStatus) {
    btnToggleZoneStatus.addEventListener('click', async () => {
      const zoneId = zoomState.activeZoneId;
      if (!zoneId) return;

      try {
        const res = await fetch(`/api/admin/zones/${zoneId}/toggle-status`, {
          method: 'PUT',
          headers: {
            'Authorization': getAuthHeader()
          }
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || '상태 변경 중 오류가 발생했습니다.');
        }

        const updatedZone = await res.json();

        // 업데이트된 구역 데이터를 currentZones 배열에 반영
        const idx = currentZones.findIndex(z => z.id == zoneId);
        if (idx !== -1) {
          currentZones[idx] = updatedZone;
        }

        // UI 업데이트
        updateZoneStatusUI(zoneId);

        // SVG 구역 다시 그리기 (비활성화 스타일 반영)
        drawZonesOnSvg(currentZones);

        // 다각형의 하이라이트/엑티브 스타일 유지
        const activePolygon = document.querySelector(`.zone-polygon[data-zone-id="${zoneId}"]`);
        if (activePolygon) {
          activePolygon.classList.add('active');
        }

        Swal.fire({
          title: '성공',
          text: `구역 노출 상태가 ${updatedZone.status === 'DISABLED' ? '미허용(숨김)' : '허용(노출)'}으로 변경되었습니다.`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });

      } catch (err) {
        Swal.fire('에러', err.message, 'error');
      }
    });
  }

  // 좌석 목록 로드 API 호출
  async function loadSeats(zoneId) {
    isLoadingSeats = true;
    isGeneratingPreview = false;
    if (zoneId) {
      btnGenerate.disabled = false;
    }
    try {
      const res = await fetch(`/api/admin/seats?zoneId=${zoneId}`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      if (!res.ok) throw new Error('좌석 데이터를 로드하지 못했습니다.');
      seatsData = await res.json();

      // 백업본 저장
      originalSeatsState = JSON.parse(JSON.stringify(seatsData));

      if (seatsData.length === 0) {
        // DB에 좌석이 없으면 Grid Generator 기본값(12열×10행)으로 자동 미리보기 렌더링
        isGeneratingPreview = true;
        previewSeatsGrid();
      } else {
        // DB에 존재하는 실제 행/열 크기를 계산하여 슬라이더 값에 세팅
        let maxRow = 1;
        let maxCol = 1;

        function getRowIndexFromLabel(label) {
          const cleanLabel = (label || "").replace("열", "").trim().toUpperCase();
          let index = 0;
          for (let i = 0; i < cleanLabel.length; i++) {
            index = index * 26 + (cleanLabel.charCodeAt(i) - 64);
          }
          return index;
        }

        seatsData.forEach(s => {
          const rIdx = getRowIndexFromLabel(s.seatRow || "");
          if (rIdx > maxRow) maxRow = rIdx;
          if (s.seatNumber > maxCol) maxCol = s.seatNumber;
        });

        if (rowCountInput && rowCountVal) {
          rowCountInput.value = maxRow;
          rowCountVal.textContent = maxRow;
        }
        if (colCountInput && colCountVal) {
          colCountInput.value = maxCol;
          colCountVal.textContent = maxCol;
        }

        renderGrid(seatsData);
        btnModalReset.disabled = false;
        btnModalSaveLayout.disabled = false;
      }
    } catch (err) {
      Swal.fire('에러', err.message, 'error');
    } finally {
      isLoadingSeats = false;
    }
  }

  // 4. 가변 좌석 격자판 대량 생성 (POST /api/admin/seats/generate)
  btnGenerate.addEventListener('click', async () => {
    const zoneId = zoomState.activeZoneId;
    const rowCount = parseInt(rowCountInput.value);
    const colCount = parseInt(colCountInput.value);

    if (!zoneId) {
      Swal.fire('알림', '구역을 먼저 선택해 주세요.', 'warning');
      return;
    }
    if (isNaN(rowCount) || rowCount <= 0 || rowCount > 50) {
      Swal.fire('알림', '행 크기를 1~50 사이로 입력해 주세요.', 'warning');
      return;
    }
    if (isNaN(colCount) || colCount <= 0 || colCount > 50) {
      Swal.fire('알림', '열 크기를 1~50 사이로 입력해 주세요.', 'warning');
      return;
    }

    // 선택된 기본 등급에 맞추어 단가 설정값을 가져옴
    const gradeName = defaultGradeSelect.value;
    const matched = seatGrades.find(g => g.name === gradeName);
    const price = matched ? matched.price : 50000;

    try {
      Swal.showLoading();
      const res = await fetch('/api/admin/seats/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({ zoneId, rowCount, colCount, price })
      });

      if (!res.ok) throw new Error('좌석판 생성 중 에러가 발생했습니다.');

      Swal.fire({
        title: '완료',
        text: '좌석 격자판이 새로 생성되었습니다.',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false
      });
      await loadSeats(zoneId);
      // 구역 목록 새로고침하여 SVG 테두리 상태 갱신
      const festivalId = festivalSelect.value;
      if (festivalId) {
        await refreshZones(festivalId, zoneId);
      }
    } catch (err) {
      Swal.fire('에러', err.message, 'error');
    }
  });

  // 실시간 가상 좌석 미리보기 생성 함수 (슬라이더 연동용)
  function previewSeatsGrid() {
    const rowCount = parseInt(rowCountInput.value);
    const colCount = parseInt(colCountInput.value);
    const gradeName = defaultGradeSelect.value;
    const matched = seatGrades.find(g => g.name === gradeName);
    const price = matched ? matched.price : 50000;

    const tempSeats = [];

    function getRowLabel(rowNum) {
      let label = "";
      let temp = rowNum;
      while (temp > 0) {
        let m = (temp - 1) % 26;
        label = String.fromCharCode(65 + m) + label;
        temp = Math.floor((temp - 1) / 26);
      }
      return label;
    }

    for (let r = 1; r <= rowCount; r++) {
      const rowLabel = getRowLabel(r);
      for (let c = 1; c <= colCount; c++) {
        tempSeats.push({
          id: `temp-${r}-${c}`,
          seatRow: rowLabel,
          seatNumber: c,
          status: 'AVAILABLE',
          price: price,
          isReserved: false
        });
      }
    }

    seatsData = tempSeats;
    renderGrid(seatsData);

    btnModalReset.disabled = true;
    // 미리보기 상태에서는 Generate Layout 버튼으로 저장 안내
    btnModalSaveLayout.disabled = true;
  }

  // 5. 시각적 격자판(CSS Grid) 실시간 드로잉 렌더러
  function renderGrid(seats) {
    modalGridWrapper.style.display = 'grid';
    modalGridWrapper.classList.add('active');
    modalGridWrapper.innerHTML = '';

    // 행 레이블 고유값 추출 (예: 'A열', 'B열' ...)
    const rows = [...new Set(seats.map(s => s.seatRow || ""))].sort((a, b) => {
      return (a || "").localeCompare(b || "", undefined, { numeric: true, sensitivity: 'base' });
    });

    // 각 행의 최대 열 번호 계산
    const maxCol = Math.max(...seats.map(s => s.seatNumber), 1);

    // Grid 레이아웃 설정 (너비 44px에 맞춰 조정)
    modalGridWrapper.style.gridTemplateColumns = `repeat(${maxCol}, minmax(44px, 1fr))`;

    // [무대 (STAGE)] 바 가이드 맨 위에 배치 (1번 행 전체 열 스팬)
    const stageGuide = document.createElement('div');
    stageGuide.className = 'w-100 bg-primary text-white text-center py-2 fw-bold rounded mb-2 d-flex align-items-center justify-content-center';
    stageGuide.style.gridColumn = `1 / span ${maxCol}`;
    stageGuide.style.gridRow = '1';
    stageGuide.style.fontSize = '0.9rem';
    stageGuide.style.letterSpacing = '1px';
    stageGuide.innerHTML = '<i class="bx bx-cube-alt me-2"></i>무대 (STAGE)';
    modalGridWrapper.appendChild(stageGuide);

    // 좌석 데이터를 행/열 맵으로 정렬
    const seatMap = {};
    seats.forEach(seat => {
      seatMap[`${seat.seatRow}_${seat.seatNumber}`] = seat;
    });

    // Grid Cell 렌더링
    rows.forEach((rowName, rIdx) => {
      const gridRowIndex = rIdx + 2; // 무대가 1번 행을 먹었으므로 2번 행부터 시작
      for (let c = 1; c <= maxCol; c++) {
        const seat = seatMap[`${rowName}_${c}`];
        const cell = document.createElement('div');
        cell.style.gridRow = gridRowIndex.toString();
        cell.style.gridColumn = c.toString();

        if (seat) {
          cell.className = 'seat-cell';
          cell.dataset.id = seat.id;
          cell.dataset.row = seat.seatRow;
          cell.dataset.number = seat.seatNumber;
          cell.dataset.status = seat.status;
          cell.dataset.price = seat.price;

          // 스타일 및 내용 적용
          applyCellClassAndContent(cell, seat.status, seat.price, seat.isReserved, seat.seatRow, seat.seatNumber);

          // Drag & Click Events
          cell.addEventListener('mousedown', (e) => {
            if (selectedMode === '조회') return;
            isDrawing = true;
            updateCellState(cell);
          });

          cell.addEventListener('mouseenter', () => {
            if (selectedMode === '조회') return;
            if (isDrawing) {
              updateCellState(cell);
            }
          });

          // 개별 좌석 클릭 시
          cell.addEventListener('click', () => {
            if (selectedMode === '조회') {
              if (seat.status !== '무대' && seat.status !== '통로') {
                showSeatReservationDetails(seat);
              }
            } else {
              // 조회 모드가 아닌 경우, 단순 클릭으로도 설정된 모드로 채색 적용
              updateCellState(cell);
            }
          });
        } else {
          // 비어 있는 자리 채우기용 (통로 표시)
          cell.className = 'seat-cell seat-corridor';
          cell.innerHTML = '<span>PASS</span>';
        }
        modalGridWrapper.appendChild(cell);
      }
    });

    // 실시간 요약 대시보드 통계 업데이트
    updateDashboardStats(seats);
  }

  // 마우스 업 전역 리스너
  window.addEventListener('mouseup', () => {
    isDrawing = false;
  });

  // 개별 셀 상태 업데이트 로직
  function updateCellState(cell) {
    const seatId = cell.dataset.id;
    if (!seatId) return;

    const seat = seatsData.find(s => s.id == seatId);
    if (!seat) return;

    // 프론트 모드에 따른 상태 및 가격 설정
    const matchedGrade = seatGrades.find(g => g.name === selectedMode);
    if (matchedGrade) {
      seat.status = '빈자리';
      seat.price = matchedGrade.price;
      seat.isReserved = false;
    } else if (selectedMode === '무대') {
      seat.status = '무대';
      seat.price = 0;
      seat.isReserved = true;
    } else if (selectedMode === '통로') {
      seat.status = '통로';
      seat.price = 0;
      seat.isReserved = true;
    } else if (selectedMode === '보류석') {
      seat.status = '보류';
      seat.isReserved = true;
    }

    cell.dataset.status = seat.status;
    cell.dataset.price = seat.price;

    applyCellClassAndContent(cell, seat.status, seat.price, seat.isReserved, seat.seatRow, seat.seatNumber);
  }

  // 상태 및 가격별 CSS & Label 렌더링 통합 헬퍼
  function applyCellClassAndContent(cell, status, price, isReserved, seatRow, seatNumber) {
    cell.classList.remove('seat-available', 'seat-vip', 'seat-r', 'seat-s', 'seat-stage', 'seat-corridor', 'seat-reserved', 'seat-hold');

    if (status === '보류') {
      cell.classList.add('seat-hold');
      cell.innerHTML = `<span>${seatRow.replace('열', '')}-${seatNumber}</span><small class="seat-price-tag"><i class="bx bx-lock-alt"></i> 보류</small>`;
    } else if (isReserved && status !== '무대' && status !== '통로') {
      cell.classList.add('seat-reserved');
      cell.innerHTML = `<span>${seatRow.replace('열', '')}-${seatNumber}</span><small class="seat-price-tag">예매불가</small>`;
    } else if (status === '무대') {
      cell.classList.add('seat-stage');
      cell.innerHTML = '<span>STAGE</span>';
    } else if (status === '통로') {
      cell.classList.add('seat-corridor');
      cell.innerHTML = '<span>PASS</span>';
    } else {
      // 등급별 클래스 맵핑
      const gradeClass = getGradeClass(price);
      cell.classList.add(gradeClass);

      // 가격 단위 (만원) 보기 좋게 변환
      const displayPrice = price >= 10000
        ? `${(price / 10000).toFixed(0)}만`
        : `${price}`;
      cell.innerHTML = `<span>${seatRow.replace('열', '')}-${seatNumber}</span><small class="seat-price-tag">${displayPrice}</small>`;
    }
  }

  // 5-1. 실시간 대시보드 통계 업데이트 함수
  function updateDashboardStats(seats) {
    const dashboard = modalSeatingDashboard;
    const gaugeContainer = modalSeatingGaugeContainer;

    if (!seats || seats.length === 0) {
      if (dashboard) dashboard.style.display = 'none';
      if (gaugeContainer) gaugeContainer.style.display = 'none';
      return;
    }

    // 무대와 통로를 제외한 유효 좌석만 필터링
    const activeSeats = seats.filter(s => s.status !== '무대' && s.status !== '통로');
    const totalSeatsCount = activeSeats.length;

    if (totalSeatsCount === 0) {
      if (dashboard) dashboard.style.display = 'none';
      if (gaugeContainer) gaugeContainer.style.display = 'none';
      return;
    }

    // 예매 완료(isReserved === true)된 좌석 수 집계
    const reservedSeatsCount = activeSeats.filter(s => s.isReserved).length;
    const availableSeatsCount = totalSeatsCount - reservedSeatsCount;

    // 실시간 매출액 계산 (예매 완료된 일반 좌석 가격 합산)
    const totalRevenue = activeSeats
      .filter(s => s.isReserved)
      .reduce((sum, s) => sum + (s.price || 0), 0);

    // 예매율 계산
    const reservedPercent = Math.round((reservedSeatsCount / totalSeatsCount) * 100) || 0;

    // DOM 반영
    modalDashTotalSeats.innerText = totalSeatsCount.toLocaleString() + ' 석';
    modalDashReservedSeats.innerText = reservedSeatsCount.toLocaleString() + ' 석';
    modalDashAvailableSeats.innerText = availableSeatsCount.toLocaleString() + ' 석';
    modalDashTotalRevenue.innerText = '₩' + totalRevenue.toLocaleString();
    modalDashReservedPercent.innerText = reservedPercent + '%';

    const progressBar = modalDashReservedProgressBar;
    progressBar.style.width = reservedPercent + '%';
    progressBar.setAttribute('aria-valuenow', reservedPercent);

    if (dashboard) dashboard.style.display = 'flex';
    if (gaugeContainer) gaugeContainer.style.display = 'block';
  }

  // 5-2. 좌석 예매 상세 조회 및 오프캔버스 표출
  async function showSeatReservationDetails(seat) {
    activeCtrlSeatId = seat.id;

    // 개별 라벨 수정 폼 초기 값 바인딩
    editSeatRow.value = seat.seatRow;
    editSeatNumber.value = seat.seatNumber;

    const offcanvasEl = document.getElementById('offcanvasSeatCtrl');
    const offcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);

    // 기본 요약 타이틀 바인딩
    document.getElementById('ctrlSeatName').innerText = `${seat.seatRow} ${seat.seatNumber}번`;

    let gradeName = '일반석';
    const matched = seatGrades.find(g => g.price === Number(seat.price));
    if (matched) {
      gradeName = matched.name;
    }

    document.getElementById('ctrlSeatGrade').innerText = `${gradeName} (₩${seat.price.toLocaleString()})`;

    const detailsDiv = document.getElementById('ctrlReservationDetails');
    const noResDiv = document.getElementById('ctrlNoReservation');

    // 만약 행정 보류석(Hold)인 경우 API 요청 없이 보류 정보 표시
    if (seat.status === '보류') {
      detailsDiv.style.display = 'block';
      noResDiv.style.display = 'none';
      document.getElementById('ctrlSeatStatus').innerText = '행정 보류 중 (ADMIN_HOLD)';
      document.getElementById('ctrlCustomerName').innerText = '시스템 관리자 (판매 제한)';
      document.getElementById('ctrlCustomerEmail').innerText = 'admin@fastival.com';
      document.getElementById('ctrlCustomerPhone').innerText = 'N/A';
      document.getElementById('ctrlPaymentTime').innerText = '설정 시간 기준';
      document.getElementById('ctrlOrderId').innerText = 'ADMIN_LOCK_HOLD';
      offcanvas.show();
      return;
    }

    // 만약 예약된 자리가 아니면 API 요청 없이 빈자리 정보만 표시
    if (!seat.isReserved) {
      detailsDiv.style.display = 'none';
      noResDiv.style.display = 'block';
      offcanvas.show();
      return;
    }

    try {
      // 로딩 상태 텍스트
      document.getElementById('ctrlSeatStatus').innerText = '조회 중...';
      document.getElementById('ctrlCustomerName').innerText = '...';
      document.getElementById('ctrlCustomerEmail').innerText = '...';
      document.getElementById('ctrlCustomerPhone').innerText = '...';
      document.getElementById('ctrlPaymentTime').innerText = '...';
      document.getElementById('ctrlOrderId').innerText = '...';

      detailsDiv.style.display = 'block';
      noResDiv.style.display = 'none';
      offcanvas.show();

      const res = await fetch(`/api/admin/seats/${seat.id}/reservation`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });

      if (!res.ok) throw new Error('예매 내역을 가져오지 못했습니다.');
      const info = await res.json();

      if (info.status === 'NONE') {
        // 예약됨 상태인데 DB 예매가 매칭되지 않는 경우 (기획사 홀딩석 혹은 오프라인 판매 등)
        document.getElementById('ctrlSeatStatus').innerText = '관리자 선점 / 판매 제한석';
        document.getElementById('ctrlCustomerName').innerText = '시스템 관리자';
        document.getElementById('ctrlCustomerEmail').innerText = 'admin@gmail.com';
        document.getElementById('ctrlCustomerPhone').innerText = 'N/A';
        document.getElementById('ctrlPaymentTime').innerText = '티켓팅 오픈 시점';
        document.getElementById('ctrlOrderId').innerText = 'SYSTEM_HOLD';
      } else {
        document.getElementById('ctrlSeatStatus').innerText = `예약 완료 (${info.status})`;
        document.getElementById('ctrlCustomerName').innerText = info.customerName;
        document.getElementById('ctrlCustomerEmail').innerText = info.customerEmail;
        document.getElementById('ctrlCustomerPhone').innerText = info.customerPhone;
        document.getElementById('ctrlPaymentTime').innerText = info.createdAt;
        document.getElementById('ctrlOrderId').innerText = 'ORD-' + info.orderId;
      }
    } catch (err) {
      console.error(err);
      document.getElementById('ctrlSeatStatus').innerText = '정보 조회 실패';
    }
  }

  // 6. 레이아웃 확정 저장 (PUT /api/admin/seats/layout)
  btnModalSaveLayout.addEventListener('click', async () => {
    const zoneId = zoomState.activeZoneId;
    if (!zoneId || seatsData.length === 0) return;

    // 변경 사항 필터링 (상태 및 단가 모두 업데이트)
    const payload = seatsData.map(s => ({
      id: s.id,
      status: s.status,
      price: s.price
    }));

    try {
      Swal.showLoading();
      const res = await fetch('/api/admin/seats/layout', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('레이아웃을 저장하는 도중 에러가 발생했습니다.');

      Swal.fire('성공', '좌석 레이아웃 배치 정보가 DB에 최종 반영되었습니다.', 'success');
      await loadSeats(zoneId);
      // 구역 목록 새로고침하여 SVG 테두리 상태 갱신
      const festivalId = festivalSelect.value;
      if (festivalId) {
        await refreshZones(festivalId, zoneId);
      }
    } catch (err) {
      Swal.fire('에러', err.message, 'error');
    }
  });

  // 되돌리기
  btnModalReset.addEventListener('click', () => {
    seatsData = JSON.parse(JSON.stringify(originalSeatsState));
    renderGrid(seatsData);
    Swal.fire('초기화', '마지막으로 저장된 상태로 되돌렸습니다.', 'info');
  });

  // 개별 좌석 라벨 변경 저장 처리
  btnSaveSeatLabel.addEventListener('click', async () => {
    if (!activeCtrlSeatId) {
      Swal.fire('경고', '선택된 좌석이 없습니다.', 'warning');
      return;
    }

    const seatRowVal = editSeatRow.value.trim();
    const seatNumVal = parseInt(editSeatNumber.value, 10);

    if (!seatRowVal || seatRowVal.length > 10) {
      Swal.fire('실패', '행 이름은 1~10자 이내로 입력해주세요.', 'error');
      return;
    }
    if (isNaN(seatNumVal) || seatNumVal <= 0) {
      Swal.fire('실패', '올바른 좌석 번호를 입력해주세요 (1 이상의 정수).', 'error');
      return;
    }

    try {
      Swal.showLoading();
      const res = await fetch(`/api/admin/seats/${activeCtrlSeatId}/label`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({ seatRow: seatRowVal, seatNumber: seatNumVal })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || '라벨 변경 도중 서버 에러가 발생했습니다.');
      }

      Swal.fire('성공', '좌석의 행/번호 라벨이 성공적으로 변경되었습니다.', 'success');

      // 오프캔버스 닫기
      const offcanvasEl = document.getElementById('offcanvasSeatCtrl');
      const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
      if (offcanvas) offcanvas.hide();

      // 구역 재조회하여 실시간 리렌더링
      const zoneId = zoomState.activeZoneId;
      if (zoneId) {
        await loadSeats(zoneId);
        if (zoomState.zoomed && zoomState.activeZoneId == zoneId) {
          await loadSeatsForLayout(zoneId);
        }
      }
    } catch (err) {
      Swal.fire('error', err.message, 'error');
    }
  });

  // 공통 UI 핸들러
  function clearGrid() {
    seatsData = [];
    originalSeatsState = [];
    const btnDeleteZone = document.getElementById('btnDeleteZone');
    if (btnDeleteZone) {
      btnDeleteZone.disabled = true;
    }
    if (zoneStatusWrapper) {
      zoneStatusWrapper.style.setProperty('display', 'none', 'important');
    }
    if (seatsGrid) {
      seatsGrid.innerHTML = '';
    }
    showEmptyState('페스티벌과 구역을 선택하거나 좌석 판을 생성해주세요.');
  }

  // showEmptyState
  function showEmptyState(msg) {
    modalGridWrapper.style.display = 'none';
  }

  // 초기 시작 및 자동 복원
  async function initAndRestore() {
    // 동적 등급 설정 렌더링 및 동기화
    renderGradeSettings();
    syncDefaultGradeDropdown();
    syncModalEditorMode();

    await fetchFestivals();

    const savedFestivalId = sessionStorage.getItem('selectedFestivalId');
    const savedZoneId = sessionStorage.getItem('selectedZoneId');

    if (savedFestivalId) {
      festivalSelect.value = savedFestivalId;
      updateFigmaBackgroundVisibility();

      // 구역 목록 조회
      await refreshZones(savedFestivalId);
    }
  }
  // Figma 템플릿 구역 클릭 이벤트 연동
  document.querySelectorAll('.figma-template-zone').forEach(el => {
    el.addEventListener('click', (e) => {
      if (isDrawingMode) return;
      e.stopPropagation();

      const template = el.getAttribute('data-template');
      const zoneNameMap = {
        'vip': 'VIP존',
        'f1': 'F1',
        'f2': 'F2',
        'f3': 'F3',
        'standing': '스탠딩존',
        'a-left': 'A존 (좌)',
        'a-right': 'A존 (우)',
        'f4-left': 'F4 (좌)',
        'f4-right': 'F4 (우)'
      };
      const targetZoneName = zoneNameMap[template];
      if (!targetZoneName) return;

      // 이미 생성된 구역이 있는지 검색
      const existingZone = currentZones.find(z => z.zoneName === targetZoneName);
      if (existingZone) {
        // 이미 존재하면 해당 구역 편집(모달) 오픈
        openSeatEditor(existingZone.id, existingZone.zoneName);
      } else {
        // 존재하지 않으면 신규 추가 모달 오픈
        const festivalId = festivalSelect.value;
        if (!festivalId) {
          Swal.fire('알림', '페스티벌을 먼저 선택해 주세요.', 'warning');
          return;
        }

        // 구역 추가 버튼을 클릭해 새 창 띄우고, select 드롭다운에서 해당 템플릿을 선택하도록 모사
        btnCreateZone.click();

        // SweetAlert2 창이 뜬 직후 dropdown 값을 템플릿으로 변경하고 change 이벤트 발송
        setTimeout(() => {
          const swalSelect = document.getElementById('swal-template-select');
          if (swalSelect) {
            swalSelect.value = template;
            swalSelect.dispatchEvent(new Event('change'));
          }
        }, 100);
      }
    });
  });

  initAndRestore();
});