document.addEventListener('DOMContentLoaded', () => {
  // 인증 헤더 헬퍼
  function getAuthHeader() {
    return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
  }

  // DOM Elements
  const storeNameBadge = document.getElementById('storeNameBadge');
  const salesLogBody = document.getElementById('salesLogBody');
  const statusFilter = document.getElementById('statusFilter');
  const orderSearchInput = document.getElementById('orderSearchInput');
  const refreshBtn = document.getElementById('refreshBtn');

  let allOrders = [];

  // 텍스트 정제 헬퍼 (({}) 또는 ({})"> 또는 빈 객체 문자열 제거)
  function cleanText(text) {
    if (!text) return '';
    let cleaned = text.toString();
    // 1) ({})"> 제거
    cleaned = cleaned.replace(/\(\{\}\)"\>/g, '');
    // 2) ({}) 제거
    cleaned = cleaned.replace(/\(\{\}\)/g, '');
    // 3) 만약 문자열이 '{}' 이거나 '[]' 이면 공백 처리
    if (cleaned.trim() === '{}' || cleaned.trim() === '[]') {
      return '';
    }
    return cleaned.trim();
  }

  // 1. 가맹점 정보 조회
  function loadStoreInfo() {
    fetch('/api/payment/staff/store', {
      headers: { 'Authorization': getAuthHeader() }
    })
    .then(res => res.json())
    .then(store => {
      if (store && store.name) {
        storeNameBadge.textContent = '🏪 ' + store.name;
      }
    })
    .catch(err => {
      console.error('점포 정보 로드 실패:', err);
      storeNameBadge.textContent = '🏪 가맹점 정보 없음';
    });
  }

  // 2. 판매 내역 조회
  function loadSalesHistory() {
    fetch('/api/payment/staff/orders', {
      headers: { 'Authorization': getAuthHeader() }
    })
    .then(res => {
      if (!res.ok) throw new Error("판매 내역을 로드하지 못했습니다.");
      return res.json();
    })
    .then(orders => {
      allOrders = orders;
      renderSalesTable();
    })
    .catch(err => {
      console.error(err);
      salesLogBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-danger">
            <i class="bx bx-error fs-2 mb-2"></i>
            <h6 class="fw-bold">판매 기록 로드 실패: ${err.message}</h6>
          </td>
        </tr>
      `;
    });
  }

  // 3. 주문 취소 및 환불 처리
  window.triggerRefund = function (orderId, orderCode) {
    if (!confirm(`⚠️ [${orderCode}] 해당 주문을 취소하고 환불 처리하시겠습니까?\n이 작업은 되돌릴 수 없으며, 고객 및 Supabase의 주문 상태도 취소(CANCELLED)로 변경됩니다.`)) {
      return;
    }

    fetch(`/api/payment/staff/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      }
    })
    .then(res => {
      if (!res.ok) throw new Error("환불 처리 오류");
      return res.json();
    })
    .then(data => {
      alert(`✅ 주문 취소 및 환불 처리가 완료되었습니다.\n(취소 건: ${orderCode})`);
      loadSalesHistory(); // 내역 리로드
    })
    .catch(err => {
      console.error(err);
      alert("❌ 환불 처리에 실패했습니다. 권한을 확인해주세요.");
    });
  };

  // 3.5. 주문 상세 보기 모달 표시
  window.showOrderDetail = function (orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;

    // 모달 DOM 바인딩
    document.getElementById('modalOrderId').textContent = order.id;
    document.getElementById('modalOrderCode').textContent = order.orderCode;
    
    const formattedDate = order.timestamp ? order.timestamp.replace('T', ' ').substring(0, 19) : '-';
    document.getElementById('modalOrderDate').textContent = formattedDate;
    document.getElementById('modalCustomer').textContent = order.customer || '스마트오더 고객';
    
    // 상품 이름 정보 빌드 (텍스트 클리닝 적용)
    const itemsText = order.items.map(it => {
      const cleanedName = cleanText(it.name);
      const cleanedOpts = cleanText(it.options);
      const optText = cleanedOpts ? ` (${cleanedOpts})` : '';
      return `${cleanedName} ${it.quantity}개${optText}`;
    }).join(', ');
    
    document.getElementById('modalProductInfo').textContent = itemsText;
    
    // 임시 결제수단 및 수령방식 매핑
    document.getElementById('modalPayMethod').textContent = 'FESTIO PAY';
    document.getElementById('modalDeliveryType').textContent = '현장 수령 (PICKUP)';
    
    const formattedPrice = (order.price || 0).toLocaleString();
    document.getElementById('modalTotalPrice').textContent = `₩ ${formattedPrice}`;
    
    // 상태 매핑
    const statusEl = document.getElementById('modalStatus');
    statusEl.textContent = order.status;
    statusEl.className = 'badge';
    
    if (order.status === 'COOKING') {
      statusEl.classList.add('bg-label-warning');
      statusEl.textContent = '준비 중';
    } else if (order.status === 'READY') {
      statusEl.classList.add('bg-label-success');
      statusEl.textContent = '수령 대기';
    } else if (order.status === 'SERVED' || order.status === 'COMPLETED') {
      statusEl.classList.add('bg-label-secondary');
      statusEl.textContent = '인도 완료';
    } else if (order.status === 'CANCELLED') {
      statusEl.classList.add('bg-label-danger');
      statusEl.textContent = '취소/환불됨';
    } else {
      statusEl.classList.add('bg-label-primary');
      statusEl.textContent = '접수 대기';
    }

    // 모달 내 환불 버튼 제어
    const refundBtn = document.getElementById('modalRefundBtn');
    if (order.status === 'CANCELLED') {
      refundBtn.style.display = 'none';
    } else {
      refundBtn.style.display = 'block';
      refundBtn.onclick = () => {
        // 모달 닫기
        const modalEl = document.getElementById('paymentDetailModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
        triggerRefund(order.id, order.orderCode);
      };
    }

    // 모달 출력
    const modalEl = document.getElementById('paymentDetailModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  };

  // 4. 테이블 렌더링 및 필터 적용
  function renderSalesTable() {
    const filterVal = statusFilter.value;
    const searchVal = orderSearchInput.value.trim().toLowerCase();

    // 필터링 적용
    const filtered = allOrders.filter(order => {
      // 1) 상태 필터
      if (filterVal !== 'ALL') {
        if (order.status !== filterVal) return false;
      }
      // 2) 주문번호 검색
      if (searchVal) {
        const idStr = String(order.id);
        const codeStr = String(order.orderCode).toLowerCase();
        if (!idStr.includes(searchVal) && !codeStr.includes(searchVal)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      salesLogBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">
            <i class="bx bx-receipt fs-2 mb-2"></i>
            <h6 class="fw-bold">해당 조건에 맞는 판매 기록이 없습니다.</h6>
          </td>
        </tr>
      `;
      return;
    }

    salesLogBody.innerHTML = filtered.map(order => {
      // 상태 배지 매핑
      let badgeClass = 'bg-label-primary';
      let statusText = '접수 대기';

      if (order.status === 'COOKING') {
        badgeClass = 'bg-label-warning';
        statusText = '준비 중';
      } else if (order.status === 'READY') {
        badgeClass = 'bg-label-success';
        statusText = '수령 대기';
      } else if (order.status === 'SERVED' || order.status === 'COMPLETED') {
        badgeClass = 'bg-label-secondary';
        statusText = '인도 완료';
      } else if (order.status === 'CANCELLED') {
        badgeClass = 'bg-label-danger';
        statusText = '취소/환불됨';
      }

      // 상품 이름 정보 (정제 적용)
      const itemsText = order.items.map(it => {
        const cleanedName = cleanText(it.name);
        const cleanedOpts = cleanText(it.options);
        const optText = cleanedOpts ? ` <span class="text-muted small">(${cleanedOpts})</span>` : '';
        return `${cleanedName} ${it.quantity}개${optText}`;
      }).join(', ');

      const formattedPrice = (order.price || 0).toLocaleString();
      const formattedDate = order.timestamp ? order.timestamp.replace('T', ' ').substring(0, 19) : '-';

      // 액션 버튼 설계
      let actionBtn = '';
      if (order.status === 'CANCELLED') {
        actionBtn = `<span class="text-danger fw-bold small"><i class="bx bx-x-circle me-1"></i>취소 완료</span>`;
      } else {
        actionBtn = `
          <button class="btn btn-sm btn-danger fw-bold" onclick="triggerRefund(${order.id}, '${order.orderCode}')">
            <i class="bx bx-undo me-1"></i>취소/환불
          </button>
        `;
      }

      return `
        <tr style="cursor: pointer;" onclick="showOrderDetail(${order.id})">
          <td><strong class="text-dark">${order.id}</strong></td>
          <td class="small text-muted">${formattedDate}</td>
          <td><div class="fw-bold text-dark text-truncate" style="max-width: 350px;" title="${itemsText}">${itemsText}</div></td>
          <td><strong class="text-info">₩ ${formattedPrice}</strong></td>
          <td><span class="badge ${badgeClass} badge-state">${statusText}</span></td>
          <td class="text-center" onclick="event.stopPropagation();">
            ${actionBtn}
          </td>
        </tr>
      `;
    }).join('');
  }

  // 5. 이벤트 리스너 바인딩
  statusFilter.addEventListener('change', renderSalesTable);
  orderSearchInput.addEventListener('input', renderSalesTable);
  refreshBtn.addEventListener('click', loadSalesHistory);

  // 실행 및 실시간 5초 폴링 감지
  loadStoreInfo();
  loadSalesHistory();
  setInterval(loadSalesHistory, 5000);
});