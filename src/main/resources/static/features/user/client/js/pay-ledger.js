document.addEventListener('DOMContentLoaded', function () {
  loadLedgerData();
});

function loadLedgerData() {
  fetch('/api/wallet/ledger')
    .then(response => {
      if (!response.ok) {
        throw new Error('네트워크 상태가 좋지 않습니다.');
      }
      return response.json();
    })
    .then(data => {
      // 1. 통계 데이터 업데이트
      document.getElementById('totalIssued').textContent = '₩ ' + (data.totalIssued || 0).toLocaleString();
      document.getElementById('totalIssuedCount').textContent = `이벤트 활성 충전 총액 (${data.totalChargeCount || 0}회)`;
      
      document.getElementById('totalUsed').textContent = '₩ ' + (data.totalUsed || 0).toLocaleString();
      document.getElementById('totalPending').textContent = '₩ ' + (data.totalPending || 0).toLocaleString();

      // 2. 트랜잭션 테이블 업데이트
      const tbody = document.getElementById('transactionTableBody');
      tbody.innerHTML = '';

      const transactions = data.transactions || [];
      if (transactions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-4 text-muted">거래 기록이 없습니다.</td>
          </tr>
        `;
        return;
      }

      transactions.forEach(tx => {
        const tr = document.createElement('tr');
        
        // 거래 유형 뱃지 구성
        let typeBadge = '';
        if (tx.type === 'CHARGE') {
          typeBadge = '<span class="badge bg-label-primary">간편 충전</span>';
        } else if (tx.type === 'PAY') {
          typeBadge = '<span class="badge bg-label-success">페이 결제</span>';
        } else if (tx.type === 'REFUND') {
          typeBadge = '<span class="badge bg-label-warning">페이 환불</span>';
        } else {
          typeBadge = `<span class="badge bg-label-secondary">${tx.type}</span>`;
        }

        // 금액 포맷
        let amountText = '';
        if (tx.amount >= 0) {
          amountText = '<span class="text-primary fw-semibold">+ ₩ ' + tx.amount.toLocaleString() + '</span>';
        } else {
          amountText = '<span class="text-danger fw-semibold">- ₩ ' + Math.abs(tx.amount).toLocaleString() + '</span>';
        }

        // 상태 뱃지 구성
        let statusBadge = '';
        if (tx.type === 'CHARGE') {
          statusBadge = '<span class="badge bg-success">충전 성공</span>';
        } else if (tx.type === 'PAY') {
          statusBadge = '<span class="badge bg-success">승인 완료</span>';
        } else if (tx.type === 'REFUND') {
          statusBadge = '<span class="badge bg-warning">환불 완료</span>';
        } else {
          statusBadge = '<span class="badge bg-secondary">완료</span>';
        }

        tr.innerHTML = `
          <td>${tx.txId}</td>
          <td class="fw-medium">${tx.userName}</td>
          <td>${typeBadge}</td>
          <td>${amountText}</td>
          <td>${tx.description || '-'}</td>
          <td title="${tx.dateTime || ''}">${tx.time}</td>
          <td>${statusBadge}</td>
        `;

        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error('LEDGER LOAD ERROR:', error);
      const tbody = document.getElementById('transactionTableBody');
      tbody.innerHTML = `
        <tr class="table-danger">
          <td colspan="7" class="text-center py-4 text-danger">데이터 로딩에 실패했습니다. (${error.message})</td>
        </tr>
      `;
    });
}
