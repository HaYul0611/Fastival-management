'use strict';

/**
 * ═══════════════════════════════════════════════════════
 * [백엔드 API 및 폴백 목(Mock) 데이터 구조 매핑 설계]
 * ═══════════════════════════════════════════════════════
 */
const MOCK_FESTIVALS = [
  { id: 1, name: '2026 워터밤 서울', startDate: '2026-07-05', endDate: '2026-07-07', thumbnailUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500' },
  { id: 2, name: '2026 서울재즈페스티벌', startDate: '2026-05-28', endDate: '2026-05-30', thumbnailUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=500' },
  { id: 3, name: '2026 부산 불꽃축제', startDate: '2026-11-04', endDate: '2026-11-04', thumbnailUrl: 'https://images.unsplash.com/photo-1531685250784-7569952593d2?w=500' },
];

let MOCK_INQUIRIES = [
  { id: 1, festivalId: 1, inquiryType: 'FOODTRUCK', companyName: '마포 닭강정 푸드트럭', managerName: '홍길동', phone: '010-1234-5678', email: 'hong@food.com', content: '워터밤 행사 현장 내 10㎡ 구역에서 닭강정 및 음료 판매를 희망합니다. 사업자등록증 첨부드립니다.', createdAt: '2026-05-26T12:00:00', status: 'PENDING', filePath1: '/uploads/business_license.pdf', filePath2: '/uploads/truck_proposal.pdf' },
  { id: 2, festivalId: 1, inquiryType: 'FOODTRUCK', companyName: '우주선 타코야끼', managerName: '김철수', phone: '010-9876-5432', email: 'kim@tako.com', content: '타코야끼 및 크레페 전문 푸드트럭입니다. 5년 경력 위생 관리 우수 업체입니다.', createdAt: '2026-05-26T14:30:00', status: 'PENDING', filePath1: '/uploads/tako_hygiene_license.pdf' },
  { id: 3, festivalId: 1, inquiryType: 'GOODS', companyName: '페스티벌 썬글라스 & 굿즈', managerName: '이영희', phone: '010-5555-1234', email: 'lee@goods.com', content: 'UV차단 썬글라스, 워터밤 MD 팔찌 등 굿즈 셀러 입점을 희망합니다. 연간 10개 이상 페스티벌 참여 이력 보유.', createdAt: '2026-05-25T09:00:00', status: 'PENDING', filePath1: '/uploads/goods_catalog.pdf' },
  { id: 4, festivalId: 1, inquiryType: 'EVENT', companyName: '스타벅스 팝업', managerName: '박민준', phone: '010-7777-8888', email: 'park@starbucks.com', content: '워터밤 현장 내 스타벅스 팝업 스토어 운영 제안드립니다. 음료 및 MD 판매 병행.', createdAt: '2026-05-24T18:15:00', status: 'APPROVED', filePath1: '/uploads/starbucks_brand_proposal.pdf' },
  { id: 5, festivalId: 2, inquiryType: 'FOODTRUCK', companyName: '재즈밤 버거', managerName: '최재훈', phone: '010-2222-3333', email: 'choi@burger.com', content: '수제버거 전문 푸드트럭. 재즈페스티벌 분위기에 맞는 감성 메뉴 구성 예정.', createdAt: '2026-05-22T10:45:00', status: 'PENDING', filePath1: '/uploads/jazz_burger_menu.pdf' },
  { id: 6, festivalId: 2, inquiryType: 'GOODS', companyName: '비닐레코드 굿즈샵', managerName: '정수빈', phone: '010-4444-5555', email: 'jung@vinyl.com', content: 'LP판 및 재즈 아티스트 관련 굿즈 판매 목적 입점 신청. 음반 전문 MD 경력 8년.', createdAt: '2026-05-21T11:30:00', status: 'REJECTED', filePath1: '/uploads/vinyl_store_license.pdf' },
  { id: 7, festivalId: 3, inquiryType: 'FOODTRUCK', companyName: '야경 포차', managerName: '오수연', phone: '010-6666-7777', email: 'oh@pocha.com', content: '부산 불꽃축제 현장에서 포장마차 콘셉트의 야식 메뉴 운영 희망. 해산물 특화.', createdAt: '2026-05-20T16:00:00', status: 'PENDING', filePath1: '/uploads/pocha_hygiene_certificate.pdf' },
];

let currentFestivalId = null; // 선택된 축제 ID
let currentStatus = 'PENDING'; // 현재 활성화된 심사 상태 탭
let currentDetailId = null;
let activeFestivals = []; // API 또는 로컬 축제 목록 저장 캐시
let cachedInquiries = []; // 현재 축제에 매핑된 신청서 목록 캐시

document.addEventListener('DOMContentLoaded', async () => {
  await loadFestivals(); // 1. 진행 예정 축제 목록 로드
  initTabs(); // 2. 탭 이벤트 구성

  // 모달 제어 이벤트 바인딩
  document.getElementById('detailModalBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
});

/**
 * 1. 진행 예정 축제 목록 조회 API 호출
 * GET /api/admin/festivals?status=UPCOMING
 * 
 * [Request Headers]
 * Accept: application/json
 * 
 * [Response JSON Format]
 * [
 *   {
 *     "id": 1,
 *     "name": "2026 워터밤 서울",
 *     "startDate": "2026-07-05",
 *     "endDate": "2026-07-07",
 *     "posterUrl": "/uploads/poster1.png",
 *     "reviewStatus": "APPROVED",
 *     "operationalStatus": "UPCOMING"
 *   }
 * ]
 */
async function loadFestivals() {
  const gridContainer = document.getElementById('festivalCardGrid');
  try {
    // 404 에러 유발을 막기 위해, 존재하는 API 엔드포인트(/api/festival)를 다이렉트로 조회
    const res = await fetch('/api/festival');
    if (!res.ok) throw new Error('API 로드 에러');
    const allFests = await res.json();

    // UPCOMING 상태인 페스티벌을 위주로 필터링하여 매핑
    activeFestivals = allFests.length > 0
      ? allFests.filter(f => f.operationalStatus === 'UPCOMING' || f.operational_status === 'UPCOMING')
      : MOCK_FESTIVALS;

    // 만약 UPCOMING 데이터가 아예 없다면 전체 목록 제공
    if (allFests.length > 0 && activeFestivals.length === 0) {
      activeFestivals = allFests;
    }
  } catch (err) {
    console.warn('[백엔드 API 연결 불가 - 로컬 목(Mock) 데이터로 구동합니다]', err);
    activeFestivals = MOCK_FESTIVALS;
  }

  renderFestivalGrid();
}

/**
 * DB에 저장된 실제 대표 이미지(thumbnail_url / thumbnailUrl) 반환 함수
 */
function getFestivalPoster(f) {
  // DB에서 반환되는 카멜케이스(thumbnailUrl) 및 스네이크케이스(thumbnail_url) 모두 대응 지원
  const dbThumbnail = f.thumbnailUrl || f.thumbnail_url;

  if (dbThumbnail && dbThumbnail.trim() !== "") {
    // data:image 규격의 base64 데이터에 대한 초정밀 디코딩 유효성 검사 (깨진 base64 사전 필터링)
    if (dbThumbnail.startsWith("data:")) {
      try {
        const parts = dbThumbnail.split(",");
        if (parts.length < 2 || !parts[0].includes("base64")) {
          throw new Error("Invalid format");
        }
        // base64 본문만 추출하여 브라우저 디코더(atob)로 실시간 유효성 테스트
        window.atob(parts[1].replace(/\s/g, ""));
      } catch (e) {
        // 디코딩 실패(손상된 base64) 시 즉각 안전한 Unsplash 플레이스홀더 이미지로 대체
        return "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500";
      }
    }
    return dbThumbnail;
  }

  // 대표 이미지가 비어있는 경우에만 사용되는 기본 플레이스홀더 이미지
  return "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500";
}

/**
 * 2. 가로형 마스터 축제 카드 그리드 동적 렌더링
 */
function renderFestivalGrid() {
  const gridContainer = document.getElementById('festivalCardGrid');
  if (!activeFestivals.length) {
    gridContainer.innerHTML = `
      <div class="text-center py-4 text-muted w-100">
        <i class="bx bx-calendar-x fs-2 d-block mb-1"></i>진행 예정인 축제가 존재하지 않습니다.
      </div>`;
    return;
  }

  gridContainer.innerHTML = activeFestivals.map(f => {
    // 해당 축제에 대한 대기 중(PENDING)인 신청서 건수 계산
    const pendingCount = getInquiryCountForFestival(f.id, 'PENDING');
    const badgeClass = pendingCount > 0 ? 'bg-danger' : 'bg-label-secondary';

    return `
      <div class="col" style="min-width: 320px; cursor: pointer;">
        <div class="card festival-select-card h-100 ${currentFestivalId === f.id ? 'active' : ''}" 
             id="fest-card-${f.id}" onclick="selectFestival(${f.id})">
          <div class="row g-0 h-100">
            <div class="col-4">
              <img src="${getFestivalPoster(f)}" 
                   class="img-fluid rounded-start h-100 object-fit-cover" 
                   style="height: 100%; min-height: 100px; width: 100%; object-fit: cover;" 
                   alt="축제 포스터" 
                   onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500';" />
            </div>
            <div class="col-8">
              <div class="card-body p-3 d-flex flex-column justify-content-between h-100">
                <div>
                  <h6 class="card-title text-dark fw-bold mb-1 text-truncate" title="${f.name}">${f.name}</h6>
                  <p class="card-text text-muted mb-0 fs-7 text-truncate">
                    <i class="bx bx-calendar me-1"></i>${formatDate(f.startDate)} ~ ${formatDate(f.endDate)}
                  </p>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-2">
                  <span class="badge bg-label-info font-mono" style="font-size:10px;">UPCOMING</span>
                  <span class="badge ${badgeClass} rounded-pill px-2" id="grid-badge-${f.id}" style="font-size:11px;">
                    ${pendingCount}건 대기
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 특정 축제에 속한 특정 상태의 신청서 개수 계산
 */
function getInquiryCountForFestival(festivalId, status) {
  // 실제 백엔드가 붙어있을 때는 로컬 캐시 또는 간이 계산용
  return MOCK_INQUIRIES.filter(i => i.festivalId === festivalId && i.status === status).length;
}

/**
 * 3. 축제 카드 클릭 시 액션 제어 함수
 */
async function selectFestival(id) {
  // 1. 기존의 active 클래스 모두 제거 후 클릭 대상 카드만 활성화 테두리 추가
  document.querySelectorAll('.festival-select-card').forEach(card => {
    card.classList.remove('active');
  });

  const selectedCard = document.getElementById(`fest-card-${id}`);
  if (selectedCard) {
    selectedCard.classList.add('active');
  }

  currentFestivalId = id;

  // 2. 하단 데이터 리로드 및 렌더링
  await loadAndRender();
}

/**
 * 4. 특정 축제에 매핑된 입점 신청서 목록 조회 API 호출
 * GET /api/partner/inquiry?status={status}&festivalId={festivalId}
 * 
 * [Request Query Parameters]
 * status: PENDING, APPROVED, REJECTED
 * festivalId: 선택된 축제 ID
 * 
 * [Response JSON Format]
 * [
 *   {
 *     "id": 1,
 *     "inquiryType": "FOODTRUCK", // FOODTRUCK, GOODS, EVENT
 *     "companyName": "마포 닭강정 푸드트럭",
 *     "managerName": "홍길동",
 *     "phone": "010-1234-5678",
 *     "email": "hong@food.com",
 *     "content": "신청 정보 내용...",
 *     "createdAt": "2026-05-26T12:00:00",
 *     "status": "PENDING"
 *   }
 * ]
 */
async function loadAndRender() {
  if (!currentFestivalId) return;

  await Promise.all([
    fetchInquiries('PENDING'),
    fetchInquiries('APPROVED'),
    fetchInquiries('REJECTED'),
  ]);

  updateSummary();
  updateTabCounts();
  renderTable();
}

const statusCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };

async function fetchInquiries(status) {
  let url = `/api/partner/inquiry?status=${status}&festivalId=${currentFestivalId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('신청서 조회 API 오류');
    const data = await res.json();
    statusCounts[status] = data.length;
    if (status === currentStatus) cachedInquiries = data;
  } catch (err) {
    // API 연결 오류 시 Mock 데이터 필터링 매핑 처리
    const filteredMock = MOCK_INQUIRIES.filter(i => i.festivalId === currentFestivalId && i.status === status);
    statusCounts[status] = filteredMock.length;
    if (status === currentStatus) cachedInquiries = filteredMock;
  }
}

/**
 * 5. 통계 요약 카드 및 탭 렌더링 동기화
 */
function updateSummary() {
  document.getElementById('summaryPending').textContent = statusCounts.PENDING + ' 건';
  document.getElementById('summaryApproved').textContent = statusCounts.APPROVED + ' 건';
  document.getElementById('summaryRejected').textContent = statusCounts.REJECTED + ' 건';
}

function updateTabCounts() {
  document.getElementById('tabCountPending').textContent = statusCounts.PENDING;
  document.getElementById('tabCountApproved').textContent = statusCounts.APPROVED;
  document.getElementById('tabCountRejected').textContent = statusCounts.REJECTED;

  // 마스터 카드 대기 건수 배지 정보도 최신 데이터로 보정
  const badge = document.getElementById(`grid-badge-${currentFestivalId}`);
  if (badge) {
    badge.textContent = `${statusCounts.PENDING}건 대기`;
    if (statusCounts.PENDING > 0) {
      badge.className = 'badge bg-danger rounded-pill px-2';
    } else {
      badge.className = 'badge bg-label-secondary rounded-pill px-2';
    }
  }
}

/**
 * 6. 입점 신청 목록 테이블 동적 바인딩
 */
function renderTable() {
  const titleMap = { PENDING: '대기중 신청서', APPROVED: '승인된 신청서', REJECTED: '반려된 신청서' };
  document.getElementById('tableHeadTitle').textContent = titleMap[currentStatus];

  const tbody = document.getElementById('appTableBody');
  if (!currentFestivalId) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" class="text-center text-muted" style="padding: 60px 0;">
          <i class="bx bx-calendar-check text-primary mb-3" style="font-size: 3rem;"></i>
          <p class="mb-0 fs-6">상단의 축제 카드를 선택하시면 입점 신청 내역을 확인할 수 있습니다.</p>
        </td>
      </tr>`;
    return;
  }

  if (!cachedInquiries.length) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7" class="text-center text-muted" style="padding: 60px 0;">
          <i class="bx bx-inbox text-muted mb-3" style="font-size: 3rem;"></i>
          <p class="mb-0 fs-6">해당 축제에 접수된 신청서가 존재하지 않습니다.</p>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = cachedInquiries.map(item => `
    <tr data-id="${item.id}" style="cursor:pointer;">
      <td>${typeBadge(item.inquiryType)}</td>
      <td><strong>${item.companyName}</strong></td>
      <td>${item.managerName}</td>
      <td>${item.phone}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td>${statusBadge(item.status)}</td>
      <td class="text-end pe-3">
        <div class="d-inline-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary detail-btn" data-id="${item.id}">
            <i class="bx bx-show me-1"></i>상세
          </button>
          ${item.status === 'PENDING' ? `
            <button class="btn btn-sm btn-success action-btn" data-id="${item.id}" data-action="APPROVED">승인</button>
            <button class="btn btn-sm btn-danger action-btn" data-id="${item.id}" data-action="REJECTED">반려</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  // 이벤트 연결
  tbody.querySelectorAll('.detail-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openModal(Number(btn.dataset.id)); });
  });
  tbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); changeStatus(Number(btn.dataset.id), btn.dataset.action); });
  });
  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => openModal(Number(row.dataset.id)));
  });
}

/**
 * 7. 입점 신청서 승인 및 반려 비동기 처리 API 호출
 * PUT /api/partner/inquiry/{id}/status
 * 
 * [Request JSON Format]
 * {
 *   "status": "APPROVED" // APPROVED 또는 REJECTED
 * }
 */
async function changeStatus(id, newStatus) {
  // DB에서 넘어오는 ID의 타입(String / Number) 불일치로 인한 조회 실패를 막기 위해 명시적 String 형변환 비교 적용
  const item = cachedInquiries.find(i => String(i.id) === String(id)) || MOCK_INQUIRIES.find(i => String(i.id) === String(id));
  if (!item) {
    console.error('[Error] changeStatus - Inquiry not found for ID:', id);
    Swal.fire({
      icon: 'error',
      title: '조회 실패',
      text: '❌ 해당 입점 신청서 대상을 찾을 수 없습니다. (ID 미매칭)',
      confirmButtonColor: '#696cff'
    });
    return;
  }

  const label = newStatus === 'APPROVED' ? '승인' : '반려';
  const confirmColor = newStatus === 'APPROVED' ? '#71dd37' : '#ff3e1d';

  // SweetAlert2 프리미엄 질문 대화 상자 (동기식 멈춤 없음)
  const result = await Swal.fire({
    title: `최종 [${label}] 처리하시겠습니까?`,
    text: `[${item.companyName}] 업체의 입점 신청을 최종 [${label}] 결정합니다.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: `네, ${label}합니다`,
    cancelButtonText: '취소',
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#8592a3',
    customClass: {
      confirmButton: 'btn btn-primary me-3',
      cancelButton: 'btn btn-outline-secondary'
    },
    buttonsStyling: true
  });

  if (!result.isConfirmed) return;

  // 비동기 처리 중 로딩 인디케이터 활성화
  Swal.fire({
    title: '데이터 갱신 중...',
    text: '백엔드 서버 및 Supabase DB 상태를 동기화하고 있습니다.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const res = await fetch(`/api/partner/inquiry/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`서버 오류 (${res.status}): ${errText || '상태 변경 실패'}`);
    }

    // DB 성공 시 전역 Mock 동기화
    const idx = MOCK_INQUIRIES.findIndex(i => String(i.id) === String(id));
    if (idx !== -1) MOCK_INQUIRIES[idx].status = newStatus;

    // 성공 메시지 팝업 노출
    await Swal.fire({
      icon: 'success',
      title: '처리 성공',
      text: `🎉 [${item.companyName}] ${label} 처리가 성공적으로 완료되었습니다.`,
      confirmButtonColor: '#696cff'
    });
  } catch (err) {
    console.error('승인/반려 처리 실패:', err);
    Swal.fire({
      icon: 'error',
      title: '처리 실패',
      text: `❌ 승인/반려 처리 중 오류가 발생했습니다.\n원인: ${err.message}`,
      confirmButtonColor: '#ff3e1d'
    });
    return; // 에러 발생 시 리로드나 모달 닫기를 수행하지 않아 원인을 유지합니다.
  }

  closeModal();
  await loadAndRender();
  renderFestivalGrid(); // 마스터 카드의 실시간 카운트 배지도 함께 갱신
}

/**
 * 8. 상세 정보 열람 모달 바인딩
 */
function openModal(id) {
  const item = cachedInquiries.find(i => String(i.id) === String(id)) || MOCK_INQUIRIES.find(i => String(i.id) === String(id));
  if (!item) {
    console.error('[Error] openModal - Inquiry not found for ID:', id);
    Swal.fire({
      icon: 'error',
      title: '상세 정보 조회 실패',
      text: '❌ 해당 신청서의 상세 정보를 불러올 수 없습니다. (ID 미매칭)',
      confirmButtonColor: '#ff3e1d'
    });
    return;
  }
  currentDetailId = id;

  // 첨부서류 파일명 및 다운로드 링크 추출
  let fileHtml = "";
  const file1 = item.filePath1 || item.file_path_1;
  const file2 = item.filePath2 || item.file_path_2;

  if (file1 || file2) {
    fileHtml += `
      <div class="detail-row" style="flex-direction:column; margin-top: 14px;">
        <span class="dl" style="margin-bottom:6px;"><i class="bx bx-paperclip me-1"></i>첨부 서류 (제출 서류)</span>
        <div class="d-flex flex-column gap-2 mt-1">`;

    if (file1) {
      const fileName1 = file1.substring(file1.lastIndexOf("/") + 1);
      fileHtml += `
        <a href="${file1}" target="_blank" class="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-between py-2 px-3" style="border-radius: 8px; text-decoration: none;">
          <span class="text-truncate me-2 fw-semibold" style="max-width: 320px; font-size: 13px;"><i class="bx bxs-file-pdf me-2 fs-5 align-middle"></i>${fileName1}</span>
          <span class="badge bg-primary px-2 py-1" style="font-size: 10px;"><i class="bx bx-download me-1"></i>다운로드</span>
        </a>`;
    }

    if (file2) {
      const fileName2 = file2.substring(file2.lastIndexOf("/") + 1);
      fileHtml += `
        <a href="${file2}" target="_blank" class="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-between py-2 px-3" style="border-radius: 8px; text-decoration: none;">
          <span class="text-truncate me-2 fw-semibold" style="max-width: 320px; font-size: 13px;"><i class="bx bxs-file-pdf me-2 fs-5 align-middle"></i>${fileName2}</span>
          <span class="badge bg-primary px-2 py-1" style="font-size: 10px;"><i class="bx bx-download me-1"></i>다운로드</span>
        </a>`;
    }

    fileHtml += `</div></div>`;
  } else {
    fileHtml += `
      <div class="detail-row" style="flex-direction:column; margin-top: 14px;">
        <span class="dl" style="margin-bottom:6px;"><i class="bx bx-paperclip me-1"></i>첨부 서류 (제출 서류)</span>
        <div class="text-muted fs-7 py-1"><i class="bx bx-error-circle me-1 align-middle"></i>제출된 첨부 서류가 없습니다.</div>
      </div>`;
  }

  document.getElementById('modalTitle').textContent = `📋 ${item.companyName} 입점 신청 상세`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-row"><span class="dl">문의 유형</span><span class="dd">${typeBadge(item.inquiryType)}</span></div>
    <div class="detail-row"><span class="dl">업체명</span><span class="dd"><strong>${item.companyName}</strong></span></div>
    <div class="detail-row"><span class="dl">담당자</span><span class="dd">${item.managerName}</span></div>
    <div class="detail-row"><span class="dl">연락처</span><span class="dd">${item.phone}</span></div>
    <div class="detail-row"><span class="dl">이메일</span><span class="dd">${item.email}</span></div>
    <div class="detail-row"><span class="dl">신청일</span><span class="dd">${formatDate(item.createdAt)}</span></div>
    <div class="detail-row"><span class="dl">현재 상태</span><span class="dd">${statusBadge(item.status)}</span></div>
    <div class="detail-row" style="flex-direction:column;">
      <span class="dl" style="margin-bottom:6px;">상세 신청서 내용</span>
      <div class="detail-content-box">${item.content || '기재된 상세 내용이 존재하지 않습니다.'}</div>
    </div>
    ${fileHtml}
  `;

  const actionWrap = document.getElementById('modalActionWrap');
  if (item.status === 'PENDING') {
    actionWrap.innerHTML = `
      <button class="btn btn-danger" id="modalRejectBtn">반려</button>
      <button class="btn btn-success" id="modalApproveBtn">승인</button>
    `;
    document.getElementById('modalApproveBtn').onclick = () => changeStatus(id, 'APPROVED');
    document.getElementById('modalRejectBtn').onclick = () => changeStatus(id, 'REJECTED');
  } else {
    actionWrap.innerHTML = `<button class="btn btn-outline-secondary" id="modalCloseBtn2">닫기</button>`;
    document.getElementById('modalCloseBtn2').onclick = closeModal;
  }

  document.getElementById('detailModalBackdrop').classList.add('show');
}

function closeModal() {
  document.getElementById('detailModalBackdrop').classList.remove('show');
  currentDetailId = null;
}

/**
 * 9. 서브 탭 초기화 및 이벤트 연결
 */
function initTabs() {
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.dataset.status;

      if (currentFestivalId) {
        await fetchInquiries(currentStatus);
        renderTable();
      }
    });
  });
}

/**
 * 유틸리티 헬퍼 함수
 */
function typeBadge(t) {
  if (t === 'FOODTRUCK') return `<span class="badge-type-food">🍔 푸드트럭</span>`;
  if (t === 'GOODS') return `<span class="badge-type-goods">🛍 굿즈/셀러</span>`;
  return `<span class="badge-type-event">🎪 행사/제휴</span>`;
}

function statusBadge(s) {
  if (s === 'PENDING') return `<span class="badge bg-warning text-dark">대기중</span>`;
  if (s === 'APPROVED') return `<span class="badge bg-success">승인됨</span>`;
  return `<span class="badge bg-danger">반려됨</span>`;
}

function formatDate(dtStr) {
  if (!dtStr) return '-';
  return dtStr.substring(0, 10);
}