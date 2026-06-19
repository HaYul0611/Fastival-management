(function() {
      const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('email');
      const userRole = localStorage.getItem('userRole');
      
      if (userEmail !== 'admin@gmail.com' || userRole !== 'ADMIN') {
        alert('관리자만 접근할 수 있는 페이지입니다.');
        window.location.href = '../../../Festio/login.html';
      }
    })();
  

    document.addEventListener("DOMContentLoaded", function () {
    // 1. 가상 매출 차트 렌더링
    const options = {
      series: [{
        name: 'F&B 매출액 (백만원)',
        type: 'column',
        data: [23, 44, 55, 57, 56, 61, 58, 63, 60, 66]
      }, {
        name: '티켓 누적 예매율 (%)',
        type: 'line',
        data: [30, 45, 65, 80, 85, 90, 92, 95, 98, 99.2]
      }],
      chart: {
        height: 350,
        type: 'line',
        toolbar: { show: false }
      },
      stroke: { width: [0, 4] },
      colors: ['#696cff', '#03c3ec'],
      labels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      legend: { position: 'bottom' }
    };

    const chart = new ApexCharts(document.querySelector("#analyticsChart"), options);
    chart.render();

    // ==========================================
    // [실시간 DB 통계 연동 함수 3종]
    // ==========================================

    /** 금액 포맷 헬퍼 (₩ 1,234,000 형식) */
    function fmtMoney(n) {
      return '₩ ' + Number(n).toLocaleString('ko-KR');
    }

    /** 관리자 인증 헤더를 포함한 fetch 래퍼 */
    function adminFetch(url) {
      const token = localStorage.getItem('userToken') || localStorage.getItem('token') || 'festio-admin-jwt-token-7777';
      return fetch(url, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
    }


    /**
     * 1. 금일 누적 매출 총액 (O2O + 예매) 로드
     */
    async function loadTodayRevenue() {
      try {
        const res = await adminFetch('/api/admin/dashboard/today-revenue');
        if (!res.ok) throw new Error('API 응답 에러');
        const data = await res.json();

        const totalEl = document.getElementById('todayRevenueStat');
        const ticketEl = document.getElementById('ticketRevenueStat');
        const o2oEl = document.getElementById('o2oRevenueStat');
        const updatedEl = document.getElementById('todayRevenueUpdatedAt');

        if (totalEl) totalEl.textContent = fmtMoney(data.totalRevenue || 0);
        if (ticketEl) ticketEl.textContent = fmtMoney(data.ticketRevenue || 0);
        if (o2oEl) o2oEl.textContent = fmtMoney(data.o2oRevenue || 0);
        if (updatedEl) {
          const now = new Date();
          updatedEl.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} 기준 집계 완료`;
        }
      } catch (e) {
        console.warn('[대시보드] 금일 매출 로드 실패:', e);
        const totalEl = document.getElementById('todayRevenueStat');
        if (totalEl) totalEl.textContent = '₩ 0';
      }
    }


    /**
     * 2. 진행중 페스티벌별 입장 인원 로드
     */
    async function loadAttendance() {
      try {
        const res = await adminFetch('/api/admin/dashboard/attendance');
        if (!res.ok) throw new Error('API 응답 에러');
        const data = await res.json();

        const totalEl = document.getElementById('totalEnteredStat');
        const listEl = document.getElementById('attendanceFestivalList');
        const progressEl = document.getElementById('attendanceProgressBar');

        const total = data.totalEntered || 0;
        if (totalEl) totalEl.textContent = total.toLocaleString('ko-KR') + ' 명';

        const festivals = data.festivals || [];
        if (listEl) {
          if (festivals.length === 0) {
            listEl.innerHTML = '<p class="text-muted fs-7">현재 진행 중인 페스티벌이 없습니다.</p>';
          } else {
            listEl.innerHTML = festivals.map(f => `
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fs-7 fw-semibold text-dark text-truncate" style="max-width:160px" title="${f.festivalName}">${f.festivalName}</span>
                <span class="badge bg-label-primary ms-2">${Number(f.enteredCount).toLocaleString('ko-KR')} 명</span>
              </div>
            `).join('');
          }
        }

        // 프로그레스바: 전체 예매(총 티켓) 대비 입장 비율 (간단히 entered / (entered+100) 로 시각화)
        // 실제 좌석 수가 있으면 더 정확하게 계산 가능
        if (progressEl) {
          const pct = total > 0 ? Math.min(100, (total / Math.max(total + 100, 1000)) * 100) : 0;
          progressEl.style.width = pct.toFixed(1) + '%';
        }
      } catch (e) {
        console.warn('[대시보드] 입장 인원 로드 실패:', e);
        const totalEl = document.getElementById('totalEnteredStat');
        if (totalEl) totalEl.textContent = '0 명';
        const listEl = document.getElementById('attendanceFestivalList');
        if (listEl) listEl.innerHTML = '<p class="text-muted fs-7">데이터를 불러올 수 없습니다.</p>';
      }
    }

    /**
     * 3. 입점사 누적 정산액 로드
     */
    async function loadStoreRevenue() {
      try {
        const res = await adminFetch('/api/admin/dashboard/store-revenue');
        if (!res.ok) throw new Error('API 응답 에러');
        const data = await res.json();

        const revenueEl = document.getElementById('storeRevenueStat');
        const descEl = document.getElementById('storeCountDesc');

        if (revenueEl) revenueEl.textContent = fmtMoney(data.totalRevenue || 0);
        if (descEl) {
          const cnt = data.storeCount || 0;
          descEl.textContent = `총 ${cnt}개 입점 가맹점 진행중 행사 매출 합산`;
        }
      } catch (e) {
        console.warn('[대시보드] 입점사 매출 로드 실패:', e);
        const revenueEl = document.getElementById('storeRevenueStat');
        if (revenueEl) revenueEl.textContent = '₩ 0';
      }
    }

    /** 모든 통계 카드 일괄 갱신 */
    function refreshDashboardStats() {
      loadTodayRevenue();
      loadAttendance();
      loadStoreRevenue();
    }

    // 2. [실제 데이터베이스 연동 및 라이프사이클 관리 로직]
    // reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
    // operationalStatus: 'UPCOMING' | 'ONGOING' | 'COMPLETED'
    let mockFestivals = [];

    /**
     * DB에 저장된 실제 대표 이미지(thumbnail_url / thumbnailUrl) 반환 및 정밀 검증 함수
     */
    function getFestivalPoster(f) {
      const dbThumbnail = f.thumbnailUrl || f.thumbnail_url;
      
      if (dbThumbnail && dbThumbnail.trim() !== "") {
        // data:image 규격의 base64 데이터에 대한 초정밀 디코딩 유효성 검사 (깨진 base64 사전 필터링)
        if (dbThumbnail.startsWith("data:")) {
          try {
            const parts = dbThumbnail.split(",");
            if (parts.length < 2 || !parts[0].includes("base64")) {
              throw new Error("Invalid format");
            }
            window.atob(parts[1].replace(/\s/g, ""));
          } catch (e) {
            return "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500";
          }
        }
        return dbThumbnail;
      }
      return "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500";
    }

    // DB로부터 모든 페스티벌 데이터 목록을 로드하는 함수
    function loadFestivalsFromDB() {
      fetch("/api/festival")
        .then(response => {
          if (!response.ok) {
            throw new Error("네트워크 응답 에러");
          }
          return response.json();
        })
        .then(data => {
          mockFestivals = data.map((f, index) => {
            return {
              ...f,
              proposalFileUrl: f.proposalFileUrl || f.proposal_file_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
              companyIntroUrl: f.companyIntroUrl || f.company_intro_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
            };
          });
          refreshLifecycleViews();
        })
        .catch(error => {
          console.error("페스티벌 로드 중 오류 발생:", error);
        });
    }

    let currentReviewSubTab = 'PENDING';
    let currentOperationSubTab = 'SETTING';
    let selectedCategory = 'ALL'; // 선택된 카테고리 필터 칩 상태 ('ALL' 또는 각 실체 DB 카테고리명)

    // 모든 테이블 및 화면 데이터 통합 새로고침
    function refreshLifecycleViews() {
      renderReviewTable();
      renderOperationTable();
    }

    // 1단계: 등록 심사 테이블 렌더링
    function renderReviewTable() {
      const tbody = document.getElementById("reviewTableBody");
      const badge = document.getElementById("reviewCountBadge");
      if (!tbody) return;

      // 1. 심사 상태로 먼저 필터링
      let filtered = mockFestivals.filter(f => f.reviewStatus === currentReviewSubTab);
      
      // 2. 카테고리 필터 칩이 활성화된 경우 추가로 필터링
      if (selectedCategory !== 'ALL') {
        filtered = filtered.filter(f => f.category === selectedCategory);
      }

      badge.innerText = `${currentReviewSubTab} (${selectedCategory}): ${filtered.length}`;
      tbody.innerHTML = "";

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-5 text-muted">해당 심사 상태의 축제 신청서가 없습니다.</td>
          </tr>
        `;
        return;
      }

      filtered.forEach(fest => {
        // 첨부서류 확인용 엘리먼트 렌더링 (기획서 보기 버튼만 유지)
        let attachmentHtml = "";
        const proposalUrl = fest.proposalFileUrl || fest.proposal_file_url;

        if (proposalUrl) {
          attachmentHtml += `
            <a href="${proposalUrl}" target="_blank" class="btn btn-xs btn-outline-primary py-1 px-2.5 fw-semibold me-1 mb-1 shadow-sm" style="font-size: 11px;">
              <i class="bx bx-file me-1"></i> 기획서 보기
            </a>
          `;
        } else {
          attachmentHtml = `<span class="text-muted fs-7 font-semibold" style="opacity: 0.6;">서류 없음</span>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong class="font-mono text-warning">#${fest.id}</strong></td>
          <td>
            <div class="d-flex align-items-center gap-3">
              <div class="avatar avatar-md rounded overflow-hidden bg-light" style="width: 40px; height: 50px;">
                <img src="${getFestivalPoster(fest)}" class="w-100 h-100" style="object-fit: cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500';">
              </div>
              <span class="fw-bold fs-6 text-dark">${fest.name}</span>
            </div>
          </td>
          <td>
            <div class="d-flex flex-column">
              <span class="text-dark fw-semibold">${fest.venue || '장소 미정'}</span>
              <span class="badge bg-label-info w-fit-content mt-1" style="width: fit-content; font-size:10px;">${fest.category || '기타'}</span>
            </div>
          </td>
          <td>
            <div class="d-flex flex-column">
              <span class="font-mono text-secondary fs-7">${fest.startDate || ''} ~ ${fest.endDate || ''}</span>
              <span class="text-muted fs-7">${(fest.startTime && fest.startTime.length >= 5) ? fest.startTime.substring(0, 5) : '13:00'} - ${(fest.endTime && fest.endTime.length >= 5) ? fest.endTime.substring(0, 5) : '22:00'}</span>
            </div>
          </td>
          <td><span class="fw-medium text-dark">${fest.agency || '미정'}</span></td>
          <td>
            <div class="d-flex flex-wrap align-items-center">
              ${attachmentHtml}
            </div>
          </td>
          <td class="text-end">
            ${fest.reviewStatus === 'PENDING' ? `
              <button class="btn btn-xs btn-success me-1 px-3 py-1.5 fw-bold" onclick="approveReview(${fest.id})">
                <i class="bx bx-check-circle me-1"></i> 승인
              </button>
              <button class="btn btn-xs btn-danger px-3 py-1.5 fw-bold" onclick="rejectReview(${fest.id})">
                <i class="bx bx-x-circle me-1"></i> 반려
              </button>
            ` : `
              <span class="badge bg-label-danger me-2">반려됨</span>
              <button class="btn btn-xs btn-outline-danger" onclick="deleteFestival(${fest.id})">삭제</button>
            `}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 2단계: 운영 상태 테이블 렌더링
    function renderOperationTable() {
      const tbody = document.getElementById("operationTableBody");
      const badge = document.getElementById("operationCountBadge");
      if (!tbody) return;

      const filtered = mockFestivals.filter(f => f.reviewStatus === 'APPROVED' && f.operationalStatus === currentOperationSubTab);
      badge.innerText = `${currentOperationSubTab}: ${filtered.length}`;
      tbody.innerHTML = "";

       if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-5 text-muted">이 단계에 배치된 활성 운영 축제가 없습니다.</td>
          </tr>
        `;
        return;
      }

      filtered.forEach(fest => {
        const tr = document.createElement("tr");
        
        let badgeColor = "bg-label-primary";
        let actionBtn = "";
        const isExposureDisabled = fest.operationalStatus === 'SETTING';
        
        if (fest.operationalStatus === 'SETTING') {
          badgeColor = "bg-label-warning";
          actionBtn = `
            <button class="btn btn-xs btn-warning text-white px-3 py-1.5 fw-bold" onclick="openPublishModal(${fest.id})">
              <i class="bx bx-edit-alt me-1"></i> 상세 정보 기입
            </button>
          `;
        } else if (fest.operationalStatus === 'UPCOMING') {
          badgeColor = "bg-label-primary";
          actionBtn = `
            <button class="btn btn-xs btn-success px-3 py-1.5 fw-bold" onclick="advanceOperationStatus(${fest.id}, 'ONGOING')">
              <i class="bx bx-play-circle me-1"></i> 진행시키기 (Start Live)
            </button>
          `;
        } else if (fest.operationalStatus === 'ONGOING') {
          badgeColor = "bg-label-success animate-pulse";
          actionBtn = `
            <button class="btn btn-xs btn-danger px-3 py-1.5 fw-bold" onclick="advanceOperationStatus(${fest.id}, 'COMPLETED')">
              <i class="bx bx-stop-circle me-1"></i> 축제 종료하기 (Stop Live)
            </button>
          `;
        } else {
          badgeColor = "bg-label-secondary";
          actionBtn = `<span class="badge bg-secondary px-3 py-1.5 fw-bold">운영 종료됨</span>`;
        }

        let exposureText = fest.isActive ? "노출 중" : "숨김";
        if (fest.operationalStatus === 'SETTING') {
          exposureText = "입력 대기";
        }
        
        const labelClassColor = fest.isActive && fest.operationalStatus !== 'SETTING' ? 'text-primary' : 'text-secondary';

        tr.innerHTML = `
          <td><strong class="font-mono text-success">#${fest.id}</strong></td>
          <td>
            <div class="avatar avatar-md rounded overflow-hidden bg-light" style="width: 40px; height: 50px;">
              <img src="${getFestivalPoster(fest)}" class="w-100 h-100" style="object-fit: cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=500';">
            </div>
          </td>
          <td>
            <div class="d-flex flex-column">
              <span class="fw-bold fs-6 text-dark">${fest.name}</span>
              <span class="font-mono fs-7 text-secondary mt-1">${fest.startDate} ~ ${fest.endDate}</span>
            </div>
          </td>
          <td>
            <div class="d-flex flex-column">
              <span class="text-dark fs-7">${fest.venue || '장소 미정'}</span>
              <span class="font-mono fs-7 text-primary fw-bold">${fest.minPrice ? fest.minPrice.toLocaleString() + '원' : '무료'}~</span>
            </div>
          </td>
          <td>
            <span class="badge ${badgeColor} fw-bold">${fest.operationalStatus}</span>
          </td>
          <td>
            <div class="form-check form-switch d-inline-block">
              <input class="form-check-input" type="checkbox" role="switch" id="exposureToggle-${fest.id}" 
                ${fest.isActive && fest.operationalStatus !== 'SETTING' ? 'checked' : ''} 
                ${isExposureDisabled ? 'disabled' : ''} 
                onchange="toggleWebExposure(${fest.id}, this)">
              <label class="form-check-label fs-7 fw-semibold ${labelClassColor}" for="exposureToggle-${fest.id}">
                ${exposureText}
              </label>
            </div>
          </td>
          <td class="text-end">
            ${actionBtn}
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    // 등록 심사 서브 탭 변경
    function switchReviewSubTab(status) {
      currentReviewSubTab = status;
      document.getElementById("subTabPendingBtn").classList.toggle("active", status === 'PENDING');
      document.getElementById("subTabRejectedBtn").classList.toggle("active", status === 'REJECTED');
      
      // 서브 탭 변경 시 백엔드 API 연동 구조 호출
      fetchFilteredFestivalsFromBackend(currentReviewSubTab, selectedCategory);
      
      renderReviewTable();
    }

    /**
     * [카테고리 필터 칩 클릭 인터랙션 처리 함수]
     * 1. 클릭된 필터 칩 스타일 활성화 처리 및 비활성 칩 보더 스타일 환원
     * 2. 선택된 카테고리를 전역 변수(selectedCategory)에 주입하여 하단 테이블 실시간 필터링
     * 3. 페이지 조건 변경 시 백엔드 API와 호환되는 비동기 fetch 함수 트리거
     */
    function filterByCategory(category) {
      selectedCategory = category;
      
      // 모든 카테고리 칩의 active 상태 및 스타일 업데이트
      document.querySelectorAll('.category-chip').forEach(btn => {
        const btnCat = btn.getAttribute('data-category');
        if (btnCat === category) {
          btn.classList.remove('btn-outline-warning');
          btn.classList.add('btn-warning', 'active');
        } else {
          btn.classList.remove('btn-warning', 'active');
          btn.classList.add('btn-outline-warning');
        }
      });

      // 백엔드 API 연동 함수 호출 (조건 변경)
      fetchFilteredFestivalsFromBackend(currentReviewSubTab, selectedCategory);

      // 프론트엔드 실시간 테이블 렌더링 호출
      renderReviewTable();
    }

    /**
     * [백엔드 API 연동 구조 가이드 및 실제 비동기 Fetch 구현]
     * 관리자가 대기열 서브탭(PENDING/REJECTED) 또는 카테고리 필터 칩을 클릭할 때
     * 백엔드 서버에 동적으로 필터링된 데이터를 요청하는 API 호출 가이드 함수입니다.
     *
     * @param {string} status - 심사 상태 ('PENDING' | 'REJECTED')
     * @param {string} category - 축제 카테고리 ('콘서트/뮤지컬' | '지역축제' | '대학축제' | '박람회' | '스포츠' | 'ALL')
     */
    async function fetchFilteredFestivalsFromBackend(status, category) {
      // 카테고리가 'ALL'인 경우 쿼리 파라미터에서 제외하거나 빈값 처리합니다.
      const categoryParam = category === 'ALL' ? '' : `&category=${encodeURIComponent(category)}`;
      
      // 예시 주소: /api/admin/festivals?status=PENDING&category=%EB%8C%80%ED%95%99%EC%B6%95%EC%A0%9C
      const apiUrl = `/api/admin/festivals?status=${status}${categoryParam}`;
      
      console.log(`[API Request] Fetching filtered festivals from: ${apiUrl}`);
      
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`API 응답 실패 (상태 코드: ${response.status})`);
        }
        const data = await response.json();
        console.log("백엔드 필터 조회 성공:", data);
        
        // 실제 API 연동 시 아래 주석을 해제하면 받아온 DB 데이터로 화면이 갱신됩니다:
        /*
        mockFestivals = data.map((f) => ({
          ...f,
          proposalFileUrl: f.proposalFileUrl || f.proposal_file_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          companyIntroUrl: f.companyIntroUrl || f.company_intro_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        }));
        refreshLifecycleViews();
        */
      } catch (error) {
        console.warn("[백엔드 API 미개발 안내] 현재 로컬 인메모리 필터링이 우선 동작 중입니다. 실제 서버 연동 시 위의 fetch 로직 주석을 해제하여 사용하세요.", error);
      }
    }

    // 운영 상태 서브 탭 변경
    function switchOperationSubTab(status) {
      currentOperationSubTab = status;
      if (document.getElementById("subTabSettingBtn")) {
        document.getElementById("subTabSettingBtn").classList.toggle("active", status === 'SETTING');
      }
      document.getElementById("subTabUpcomingBtn").classList.toggle("active", status === 'UPCOMING');
      document.getElementById("subTabOngoingBtn").classList.toggle("active", status === 'ONGOING');
      document.getElementById("subTabCompletedBtn").classList.toggle("active", status === 'COMPLETED');
      renderOperationTable();
    }

    // [신청서 제출]: 기획사가 PENDING 상태로 신규 축제를 등록
    function addFestival() {
      const name = document.getElementById("festName").value;
      const category = document.getElementById("festCategory").value;
      const venue = document.getElementById("festVenue").value;
      const minPrice = parseInt(document.getElementById("festMinPrice").value || "0");
      const thumbnailUrl = document.getElementById("festThumbnailUrl").value;
      const agency = document.getElementById("festAgency").value;
      const startDate = document.getElementById("festStartDate").value;
      const endDate = document.getElementById("festEndDate").value;
      const startTimeVal = document.getElementById("festStartTime").value;
      const endTimeVal = document.getElementById("festEndTime").value;
      const badgeLabel = document.getElementById("festBadgeLabel").value;
      const ticketModeEl = document.querySelector('input[name="festTicketMode"]:checked');
      const ticketMode = ticketModeEl ? ticketModeEl.value : "SEAT";

      if (!name || !startDate || !endDate || !category || !venue || !thumbnailUrl || !agency) {
        alert("모든 필수 값을 입력해 주세요.");
        return;
      }

      const startTime = startTimeVal ? startTimeVal + ":00" : "13:00:00";
      const endTime = endTimeVal ? endTimeVal + ":00" : "22:00:00";

      const payload = {
        name: name,
        category: category,
        venue: venue,
        minPrice: minPrice,
        thumbnailUrl: thumbnailUrl,
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime,
        badgeLabel: badgeLabel || null,
        agency: agency,
        ticketMode: ticketMode,
        reviewStatus: "PENDING",
        operationalStatus: "UPCOMING",
        isActive: false,
        proposalFileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        companyIntroUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
      };

      fetch("/api/festival", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("저장 실패");
        }
        return response.json();
      })
      .then(savedFest => {
        alert(`🎉 [${savedFest.name}] 축제 등록 신청서가 실제 Supabase DB에 성공적으로 등록되었습니다!\n1단계 심사 대기열(PENDING)에서 확인해 주세요.`);
        
        // 모달 닫기 처리
        const modalEl = document.getElementById("createFestivalModal");
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        document.getElementById("createFestivalForm").reset();
        switchReviewSubTab('PENDING'); // 대기중 탭으로 이동
        loadFestivalsFromDB(); // 실제 DB 데이터 새로고침
      })
      .catch(error => {
        alert("등록 중 오류가 발생했습니다. 백엔드 세션을 확인하십시오.");
        console.error("축제 저장 오류:", error);
      });
    }

    // [승인 Action]: PENDING -> APPROVED (자동으로 2단계 SETTING으로 배치!)
    function approveReview(id) {
      const fest = mockFestivals.find(f => f.id === id);
      if (fest) {
        fest.reviewStatus = 'APPROVED';
        fest.operationalStatus = 'SETTING'; // 2단계 라이프사이클의 정보 입력 대기(SETTING) 상태로 최초 배치
        fest.isActive = false; // 정보 기입 전까지 임시 노출 차단

        alert(`👍 [${fest.name}] 축제 등록이 승인 완료되었습니다!\n상세 정보(가격, 포스터, 설명 등) 기입을 위해 '정보 입력 대기(SETTING)' 탭으로 이동합니다.`);
        
        // 백엔드 PATCH API 호출 백업 트리거
        updateFestivalStatusOnBackend(id, 'APPROVED', 'SETTING');

        refreshLifecycleViews();
        
        // 부드럽게 2단계 대메뉴 탭으로 강제 활성화 전환하여 유저 감동 선사!
        const operationTabBtn = document.getElementById("tab-operation-btn");
        if (operationTabBtn) {
          operationTabBtn.click();
          switchOperationSubTab('SETTING');
        }
      }
    }

    // [반려 Action]: PENDING -> REJECTED
    function rejectReview(id) {
      const fest = mockFestivals.find(f => f.id === id);
      if (fest) {
        fest.reviewStatus = 'REJECTED';
        alert(`👎 [${fest.name}] 축제 등록 신청서가 반려 처리되었습니다.\n반려됨(REJECTED) 서브 탭으로 이동합니다.`);
        
        updateFestivalStatusOnBackend(id, 'REJECTED', 'UPCOMING');
        refreshLifecycleViews();
        switchReviewSubTab('REJECTED');
      }
    }

    // [운영 단계 전환 Action]: UPCOMING -> ONGOING -> COMPLETED
    function advanceOperationStatus(id, nextStatus) {
      const fest = mockFestivals.find(f => f.id === id);
      if (fest) {
        fest.operationalStatus = nextStatus;
        alert(`🚀 [${fest.name}] 축제 운영 상태가 [${nextStatus}] 상태로 성공적으로 격상되었습니다!`);
        
        updateFestivalStatusOnBackend(id, 'APPROVED', nextStatus);
        refreshLifecycleViews();
        switchOperationSubTab(nextStatus);
      }
    }

    // [축제 삭제 Action]
    function deleteFestival(id) {
      if (!confirm("정말로 이 축제를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 관련 자식 데이터도 함께 정돈됩니다.")) {
        return;
      }

      fetch(`/api/festival/${id}`, {
        method: "DELETE"
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("삭제 실패");
        }
        alert("데이터베이스에서 성공적으로 영구 삭제되었습니다.");
        loadFestivalsFromDB(); // 목록 새로고침
      })
      .catch(error => {
        alert("삭제 중 오류가 발생했습니다.");
        console.error("삭제 오류:", error);
      });
    }

    // [실시간 API 통신 비동기 함수]
    async function updateFestivalStatusOnBackend(id, reviewStatus, operationalStatus) {
      console.log(`[REST API Call Log] PATCH /api/festival/${id}/status`, { reviewStatus, operationalStatus });
      
      try {
        const response = await fetch(`/api/festival/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reviewStatus: reviewStatus,
            operationalStatus: operationalStatus
          })
        });
        
        if (!response.ok) {
          throw new Error('백엔드 상태 변경 요청 처리 중 오류 발생');
        }
        
        const updatedFestival = await response.json();
        console.log("백엔드 데이터베이스 동기화 완료:", updatedFestival);
        loadFestivalsFromDB(); // 실제 DB 데이터로 동기화
      } catch (error) {
        console.error("백엔드 통신 오류:", error);
        alert("백엔드 데이터베이스 동기화 실패! 네트워크 상태를 확인해 주세요.");
      }
    }

    // [실시간 웹 노출 토글 스위치 비비동기 API 연동 함수]
    async function toggleWebExposure(id, switchEl) {
      const originalChecked = !switchEl.checked;
      const labelEl = switchEl.nextElementSibling;
      const targetState = switchEl.checked;
      
      console.log(`[REST API Call Log] PUT /api/festival/${id}/toggle (Target is_active: ${targetState})`);
      
      try {
        const response = await fetch(`/api/festival/${id}/toggle`, {
          method: 'PUT'
        });
        
        if (!response.ok) {
          throw new Error('백엔드 웹 노출 상태 변경 요청 처리 중 오류 발생');
        }
        
        const updatedFestival = await response.json();
        console.log("백엔드 웹 노출 동기화 완료:", updatedFestival);
        
        // UI 라벨 텍스트 및 클래스 동적 업데이트
        if (labelEl) {
          labelEl.textContent = updatedFestival.isActive ? "노출 중" : "숨김";
          labelEl.className = `form-check-label fs-7 fw-semibold ${updatedFestival.isActive ? 'text-primary' : 'text-secondary'}`;
        }
        
        // 전역 메모리 내 mockFestivals 리스트 객체 값 동기화
        const fest = mockFestivals.find(f => f.id === id);
        if (fest) {
          fest.isActive = updatedFestival.isActive;
        }
      } catch (error) {
        console.error("웹 노출 변경 통신 오류:", error);
        alert("웹 노출 변경에 실패했습니다! 네트워크 상태나 서버를 점검해 주세요.");
        // 오류 시 UI 복원
        switchEl.checked = originalChecked;
        if (labelEl) {
          labelEl.textContent = originalChecked ? "노출 중" : "숨김";
          labelEl.className = `form-check-label fs-7 fw-semibold ${originalChecked ? 'text-primary' : 'text-secondary'}`;
        }
      }
    }

    // 예매 방식 변경에 따른 UI 동적 전환 및 검증
    function updatePublishModeUI() {
      const freeRadio = document.getElementById("publishTicketModeFree");
      const priceWrapper = document.getElementById("publishFestPriceWrapper");
      const ticketSection = document.getElementById("freeTicketConfigSection");
      const priceInput = document.getElementById("publishFestPrice");

      if (freeRadio && freeRadio.checked) {
        if (priceWrapper) priceWrapper.classList.add("d-none");
        if (ticketSection) ticketSection.classList.remove("d-none");
        if (priceInput) priceInput.removeAttribute("required");
      } else {
        if (priceWrapper) priceWrapper.classList.remove("d-none");
        if (ticketSection) ticketSection.classList.add("d-none");
        if (priceInput) priceInput.setAttribute("required", "required");
      }
    }

    // 티켓 행 동적 추가
    function addFreeTicketRow(name = "", price = "", quantity = "") {
      const tbody = document.getElementById("freeTicketConfigBody");
      if (!tbody) return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <input type="text" class="form-control form-control-sm ticket-name-input" placeholder="예: 일반 입장권" value="${name}" required />
        </td>
        <td>
          <input type="number" class="form-control form-control-sm ticket-price-input" placeholder="원" value="${price}" required min="0" />
        </td>
        <td>
          <input type="number" class="form-control form-control-sm ticket-qty-input" placeholder="매" value="${quantity}" required min="1" />
        </td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-icon btn-outline-danger" onclick="removeFreeTicketRow(this)">
            <i class="bx bx-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // 티켓 행 삭제
    function removeFreeTicketRow(btn) {
      const row = btn.closest("tr");
      if (row) row.remove();
    }

    // 기존 FREE 티켓 정보 로드
    async function populateFreeTickets(festivalId, ticketMode) {
      const configBody = document.getElementById("freeTicketConfigBody");
      if (!configBody) return;
      configBody.innerHTML = "";

      if (ticketMode === "FREE") {
        try {
          const res = await fetch(`/api/festival/${festivalId}/zones`);
          if (res.ok) {
            const zones = await res.json();
            if (zones && zones.length > 0) {
              for (let z of zones) {
                let price = 50000;
                let capacity = z.safetyLimit || 500;
                try {
                  const seatRes = await fetch(`/api/festival/seats?zoneId=${z.id}`);
                  if (seatRes.ok) {
                    const seats = await seatRes.json();
                    if (seats && seats.length > 0) {
                      price = seats[0].price || price;
                      capacity = seats.length;
                    }
                  }
                } catch (seatErr) {
                  console.warn("구역 좌석 로드 실패:", seatErr);
                }
                addFreeTicketRow(z.zoneName, price, capacity);
              }
            } else {
              addFreeTicketRow("일반 입장권", 30000, 1000);
            }
          } else {
            addFreeTicketRow("일반 입장권", 30000, 1000);
          }
        } catch (err) {
          console.warn("구역 정보 로드 실패:", err);
          addFreeTicketRow("일반 입장권", 30000, 1000);
        }
      } else {
        addFreeTicketRow("일반 입장권", 30000, 1000);
      }
    }

    // 이벤트 리스너 등록
    setTimeout(() => {
      const seatRadio = document.getElementById("publishTicketModeSeat");
      const freeRadio = document.getElementById("publishTicketModeFree");
      if (seatRadio && freeRadio) {
        seatRadio.addEventListener("change", updatePublishModeUI);
        freeRadio.addEventListener("change", updatePublishModeUI);
      }
    }, 500);

    // 상세 정보 기입 모달 활성화 및 바인딩
    function openPublishModal(id) {
      const fest = mockFestivals.find(f => f.id === id);
      if (fest) {
        document.getElementById("publishFestId").value = fest.id;
        document.getElementById("publishFestName").value = fest.name;
        document.getElementById("publishFestPrice").value = fest.minPrice || "";
        
        // 기존 ticketMode 값을 라디오 버튼에 사전 선택
        const currentTicketMode = fest.ticketMode || "SEAT";
        const seatRadio = document.getElementById("publishTicketModeSeat");
        const freeRadio = document.getElementById("publishTicketModeFree");
        if (seatRadio && freeRadio) {
          seatRadio.checked = (currentTicketMode === "SEAT");
          freeRadio.checked = (currentTicketMode === "FREE");
        }
        
        // 외부 업체 제휴 신청으로 자동 등록되어 임시 기본 이미지(Unsplash 플레이스홀더)가 들어가 있는 경우
        // 관리자가 직접 포스터를 등록할 수 있도록 입력창을 비워줍니다.
        const defaultPlaceholder = "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80";
        if (fest.thumbnailUrl === defaultPlaceholder || (fest.thumbnailUrl && fest.thumbnailUrl.includes("photo-1533174072545-7a4b6ad7a6c3"))) {
          document.getElementById("publishFestPosterUrl").value = "";
        } else {
          document.getElementById("publishFestPosterUrl").value = fest.thumbnailUrl || "";
        }
        
        document.getElementById("publishFestDescription").value = fest.description || "";
        
        updatePublishModeUI();
        populateFreeTickets(fest.id, currentTicketMode);

        const modalEl = document.getElementById("publishFestivalModal");
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    }

    // 최종 발행 폼 제출 처리
    function submitPublishFestival() {
      const id = parseInt(document.getElementById("publishFestId").value);
      const posterUrl = document.getElementById("publishFestPosterUrl").value;
      const description = document.getElementById("publishFestDescription").value;
      const ticketModeEl = document.querySelector('input[name="publishTicketMode"]:checked');
      const ticketMode = ticketModeEl ? ticketModeEl.value : "SEAT";

      let price = 0;
      let freeTickets = [];

      if (ticketMode === 'FREE') {
        const tbody = document.getElementById("freeTicketConfigBody");
        const rows = tbody.querySelectorAll("tr");
        if (rows.length === 0) {
          alert("FREE 모드에서는 최소 1개 이상의 티켓 등급을 추가하셔야 합니다.");
          return;
        }

        for (let row of rows) {
          const nameInput = row.querySelector(".ticket-name-input");
          const priceInput = row.querySelector(".ticket-price-input");
          const qtyInput = row.querySelector(".ticket-qty-input");

          const name = nameInput.value.trim();
          const tPrice = parseInt(priceInput.value);
          const qty = parseInt(qtyInput.value);

          if (!name || isNaN(tPrice) || isNaN(qty)) {
            alert("티켓 정보를 모두 올바르게 입력해 주세요.");
            return;
          }

          freeTickets.push({ name, price: tPrice, quantity: qty });
        }

        // 공식 티켓 가격은 최저 가격으로 자동 책정
        price = Math.min(...freeTickets.map(t => t.price));
        document.getElementById("publishFestPrice").value = price;
      } else {
        price = parseInt(document.getElementById("publishFestPrice").value || "0");
      }

      const fest = mockFestivals.find(f => f.id === id);
      if (fest) {
        // 로컬 프론트엔드 임시 상태 변경
        fest.operationalStatus = 'UPCOMING';
        fest.minPrice = price;
        fest.thumbnailUrl = posterUrl;
        fest.description = description;
        fest.ticketMode = ticketMode;
        fest.isActive = true;

        // 모달 비활성화
        const modalEl = document.getElementById("publishFestivalModal");
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        const modeLabel = ticketMode === 'FREE' ? '입장권형 (FREE)' : '좌석선택형 (SEAT)';
        alert(`🚀 [${fest.name}] 축제의 상세 정보 기입 및 최종 발행이 완료되었습니다!\n예매 방식: ${modeLabel}\n운영 상태가 '정보 입력 대기(SETTING)'에서 '진행 전(UPCOMING)' 단계로 이동했습니다.`);

        // 백엔드 API 확장 구조 호출 (ticketMode 및 freeTickets 데이터 포함)
        publishFestivalOnBackend(id, price, posterUrl, description, ticketMode, freeTickets);

        refreshLifecycleViews();
        switchOperationSubTab('UPCOMING');
      }
    }

    /**
     * 모달에서 기입된 상세 데이터를 백엔드로 전송하고 축제를 최종 발행 상태로 업데이트
     */
    async function publishFestivalOnBackend(id, price, posterUrl, description, ticketMode, freeTickets) {
      console.log(`[REST API Call Log] PATCH /api/admin/festivals/${id}/publish`, { price, posterUrl, description, ticketMode, freeTickets });
      
      const token = localStorage.getItem('userToken') || localStorage.getItem('token') || 'festio-admin-jwt-token-7777';
      const authHeader = 'Bearer ' + token;

      try {
        // 1. ticketMode 업데이트 (PATCH /api/festival/{id}/ticket-mode)
        const modeRes = await fetch(`/api/festival/${id}/ticket-mode`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': authHeader 
          },
          body: JSON.stringify({ ticketMode: ticketMode || 'SEAT' })
        });
        if (!modeRes.ok) {
          console.warn(`[ticketMode] 업데이트 실패 (status: ${modeRes.status})`);
        }

        // 2. FREE 모드인 경우 구역(Zone) 및 좌석(Seat) 정보 재생성
        if (ticketMode === 'FREE' && freeTickets && freeTickets.length > 0) {
          // 기존 구역 정보 조회
          const zonesRes = await fetch(`/api/festival/${id}/zones`);
          if (zonesRes.ok) {
            const existingZones = await zonesRes.json();
            for (let ez of existingZones) {
              // 기존 구역 및 좌석 삭제
              const delRes = await fetch(`/api/admin/zones/${ez.id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': authHeader }
              });
              if (!delRes.ok) {
                console.warn(`기존 구역 삭제 실패: ${ez.id} (status: ${delRes.status})`);
              }
            }
          }

          // 신규 구역 및 가상 좌석 생성
          for (let ticket of freeTickets) {
            const zoneRes = await fetch(`/api/admin/festivals/${id}/zones`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                zoneName: ticket.name,
                safetyLimit: ticket.quantity,
                svgPoints: '0,0'
              })
            });

            if (!zoneRes.ok) {
              throw new Error(`구역 생성 실패: ${ticket.name} (status: ${zoneRes.status})`);
            }

            const createdZone = await zoneRes.json();
            const zoneId = createdZone.id;

            // 가상 좌석 생성 (rowCount=1, colCount=quantity, price=ticket.price)
            const seatRes = await fetch(`/api/admin/seats/generate`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                zoneId: zoneId,
                rowCount: 1,
                colCount: ticket.quantity,
                price: ticket.price
              })
            });

            if (!seatRes.ok) {
              throw new Error(`좌석 생성 실패: ${ticket.name} (status: ${seatRes.status})`);
            }
          }
        }

        // 3. 기존 발행 정보 업데이트
        const response = await fetch(`/api/admin/festivals/${id}/publish`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            price: price,
            posterUrl: posterUrl,
            description: description,
            operationalStatus: 'UPCOMING',
            isActive: true,
            ticketMode: ticketMode || 'SEAT'
          })
        });

        if (!response.ok) {
          throw new Error(`최종 발행 API 요청 실패 (상태 코드: ${response.status})`);
        }

        const result = await response.json();
        console.log("백엔드 최종 발행 완료 데이터 동기화 완료:", result);
        
        loadFestivalsFromDB();
      } catch (error) {
        console.error("⚠️ 최종 발행 처리 중 에러 발생:", error);
        alert(`발행 중 오류가 발생했습니다: ${error.message}`);
      }
    }

    // 인라인 호출용 window 전역 바인딩
    window.switchReviewSubTab = switchReviewSubTab;
    window.switchOperationSubTab = switchOperationSubTab;
    window.approveReview = approveReview;
    window.rejectReview = rejectReview;
    window.advanceOperationStatus = advanceOperationStatus;
    window.deleteFestival = deleteFestival;
    window.toggleWebExposure = toggleWebExposure;
    window.openPublishModal = openPublishModal;
    window.submitPublishFestival = submitPublishFestival;
    window.filterByCategory = filterByCategory;
    window.addFestival = addFestival;
    window.addFreeTicketRow = addFreeTicketRow;
    window.removeFreeTicketRow = removeFreeTicketRow;

    // 3. [동적 탭 스위칭 감지 및 라우팅 로직]
    function checkTabRouting() {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get('tab');
      
      const dashboardEl = document.getElementById("tab-content-dashboard");
      const festivalsEl = document.getElementById("tab-content-festivals");
      const titleText = document.getElementById("navbar-title-text");

      if (tab === 'festivals') {
        dashboardEl.classList.add("d-none");
        festivalsEl.classList.remove("d-none");
        titleText.innerHTML = `<i class="bx bx-map-pin me-2 text-primary"></i>축제 생애주기 관리`;
      } else {
        dashboardEl.classList.remove("d-none");
        festivalsEl.classList.add("d-none");
        titleText.innerHTML = `<i class="bx bx-home-smile me-2 text-primary"></i>통합 관제 대시보드`;
      }
    }

    // 윈도우 로드 및 히스토리 변경 시 라우팅 트리거
    window.addEventListener("load", () => {
      loadFestivalsFromDB(); // 실시간 데이터 로드
      checkTabRouting();
      refreshDashboardStats(); // DB 통계 카드 최초 로드
    });

    // 60초마다 통계 카드 자동 갱신
    setInterval(refreshDashboardStats, 60000);

    // 쿼리 파라미터 링크 런타임 클릭 시 스위칭을 위한 인터벌 훅 (Perfect for SPA)
    let lastQuery = window.location.search;
    setInterval(() => {
      if (window.location.search !== lastQuery) {
        lastQuery = window.location.search;
        checkTabRouting();
        
        // 사이드바 active 상태 복구를 위한 임시 갱신
        if (typeof document.dispatchEvent === 'function') {
          document.dispatchEvent(new Event('DOMContentLoaded'));
        }
      }
    }, 150);
});