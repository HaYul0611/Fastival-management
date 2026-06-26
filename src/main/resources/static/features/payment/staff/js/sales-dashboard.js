// 클라이언트 사이드 역할 보안 검증
      const userSpecificRole = localStorage.getItem('userSpecificRole') || sessionStorage.getItem('userSpecificRole');
      if (userSpecificRole !== 'ROLE_FOOD_STAFF' && userSpecificRole !== 'ROLE_GOODS_STAFF') {
        alert('⚠️ 매출 대시보드는 푸드스태프 또는 굿즈스태프 권한이 필요합니다!');
        window.location.replace('/Festio/login.html?error=unauthorized');
      }

      function getAuthHeader() {
        return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
      }

      document.addEventListener('DOMContentLoaded', () => {
        loadSalesStats();
        loadNavUserInfo();
      });

      function loadNavUserInfo() {
        const userName = localStorage.getItem('userName') || sessionStorage.getItem('userName') || '스태프';
        const userEmail = localStorage.getItem('email') || sessionStorage.getItem('email') || '';
        document.getElementById('navUserName').textContent = userName;
        document.getElementById('navUserRole').textContent = userSpecificRole === 'ROLE_GOODS_STAFF' ? '공식 MD 점주 (GOODS STAFF)' : '푸드 부스 점주 (FOOD STAFF)';
      }

      function loadSalesStats() {
        fetch('/api/payment/staff/sales/stats', {
          headers: { 'Authorization': getAuthHeader() }
        })
        .then(res => {
          if (!res.ok) throw new Error('매출 데이터 로드 실패');
          return res.json();
        })
        .then(data => {
          updateSummaryCards(data.summary);
          renderRoleSpecificCharts(data);
          updateSettlementBox(data.summary);
        })
        .catch(err => {
          console.error(err);
          alert('매출 현황 데이터를 불러오는 중 오류가 발생했습니다.');
        });
      }

      function updateSummaryCards(summary) {
        document.getElementById('valTotalRevenue').innerText = '₩' + (summary.totalRevenue || 0).toLocaleString();
        document.getElementById('valTotalOrders').innerText = (summary.totalOrders || 0).toLocaleString() + '건';
        document.getElementById('valAverageOrderValue').innerText = '₩' + (summary.averageOrderValue || 0).toLocaleString();
      }

      function updateSettlementBox(summary) {
        const total = summary.totalRevenue || 0;
        const fee = Math.floor(total * 0.1);
        const payout = total - fee;

        document.getElementById('settleTotalSales').innerText = '₩' + total.toLocaleString();
        document.getElementById('settlePlatformFee').innerText = '₩' + fee.toLocaleString();
        document.getElementById('settlePayout').innerText = '₩' + payout.toLocaleString();
      }

      function renderRoleSpecificCharts(data) {
        const ctx = document.getElementById('salesAnalyticsChart').getContext('2d');
        
        if (userSpecificRole === 'ROLE_FOOD_STAFF') {
          // FOOD STAFF: 시간대별 매출 추이 (Line Chart)
          document.getElementById('chartTitle').innerText = '⏰ 시간대별 매출 추이 분석';
          document.getElementById('storeRoleTag').innerText = '푸드트럭 분석';
          document.getElementById('sidePanelTitle').innerText = '인기 푸드 메뉴 Top 5';

          const labels = data.hourlySales.map(item => `${item.hour}시`);
          const datasetData = data.hourlySales.map(item => item.revenue);

          new Chart(ctx, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: '실시간 매출액 (₩)',
                data: datasetData,
                borderColor: '#0072FF',
                backgroundColor: 'rgba(0, 114, 255, 0.08)',
                fill: true,
                tension: 0.35,
                borderWidth: 3,
                pointBackgroundColor: '#0072FF',
                pointHoverRadius: 8
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) { return value.toLocaleString() + '원'; }
                  }
                }
              }
            }
          });

          // 인기 메뉴 Top 5 리스트 그리기
          renderRankingList(data.topProducts, 'total_quantity', '개 판매');

        } else if (userSpecificRole === 'ROLE_GOODS_STAFF') {
          // GOODS STAFF: 인기 상품 Top 5 가로 막대 차트
          document.getElementById('chartTitle').innerText = '🛍️ 인기 MD 및 굿즈 판매 순위 Top 5';
          document.getElementById('storeRoleTag').innerText = '공식 MD 분석';
          document.getElementById('sidePanelTitle').innerText = '굿즈 옵션 선호도';

          const labels = data.topProducts.map(item => item.product_name);
          const datasetData = data.topProducts.map(item => item.total_quantity);

          new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: '판매 수량 (개)',
                data: datasetData,
                backgroundColor: 'linear-gradient(135deg, #7F00FF 0%, #E100FF 100%)',
                backgroundColor: [
                  'rgba(127, 0, 255, 0.85)',
                  'rgba(155, 48, 255, 0.85)',
                  'rgba(197, 0, 255, 0.85)',
                  'rgba(225, 0, 255, 0.85)',
                  'rgba(240, 100, 255, 0.85)'
                ],
                borderRadius: 8,
                borderWidth: 0
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 }
                }
              }
            }
          });

          // 굿즈용 Pie 차트 활성화 (옵션 선호도)
          document.getElementById('goodsPieContainer').style.display = 'block';
          const pieCtx = document.getElementById('optionsPieChart').getContext('2d');
          
          const optionLabels = data.topOptions.map(o => o.option_name);
          const optionCounts = data.topOptions.map(o => o.option_count);

          if (optionLabels.length === 0) {
            document.getElementById('goodsPieContainer').innerHTML = `<div class="text-center text-muted py-5 fs-7">옵션 선택 판매 내역이 없습니다.</div>`;
          } else {
            new Chart(pieCtx, {
              type: 'doughnut',
              data: {
                labels: optionLabels,
                datasets: [{
                  data: optionCounts,
                  backgroundColor: [
                    '#7F00FF',
                    '#00C6FF',
                    '#1D976C',
                    '#FFB703',
                    '#FB8500'
                  ]
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 10 } }
                  }
                }
              }
            });
          }

          // 리스트 영역에는 매출액 기준 Top 5 상품 렌더링
          renderRankingList(data.topProducts, 'total_revenue', '원 매출', true);
        }
      }

      function renderRankingList(items, keyField, suffix, isCurrency = false) {
        const container = document.getElementById('rankingListContainer');
        container.innerHTML = '';

        if (items.length === 0) {
          container.innerHTML = `<div class="text-center text-muted py-4 fs-7">판매 실적이 존재하지 않습니다.</div>`;
          return;
        }

        items.forEach((item, index) => {
          const val = item[keyField];
          const displayVal = isCurrency ? '₩' + val.toLocaleString() : val.toLocaleString();
          const rankColors = ['bg-danger', 'bg-warning', 'bg-info', 'bg-secondary', 'bg-light text-dark'];
          const badgeColor = rankColors[index] || 'bg-light text-dark';

          const rowHtml = `
            <div class="list-group-item d-flex justify-content-between align-items-center py-3 px-1 border-0 border-bottom">
              <div class="d-flex align-items-center gap-3">
                <span class="badge ${badgeColor} rounded-circle px-2 py-1">${index + 1}</span>
                <span class="fw-bold text-dark text-truncate" style="max-width: 160px;">${item.product_name}</span>
              </div>
              <span class="badge bg-label-secondary fw-semibold">${displayVal}${suffix}</span>
            </div>
          `;
          container.insertAdjacentHTML('beforeend', rowHtml);
        });
      }