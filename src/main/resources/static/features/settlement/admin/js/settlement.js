document.addEventListener('DOMContentLoaded', function () {
    const festivalSelect = document.getElementById('festivalSelect');
    const totalSalesAmount = document.getElementById('totalSalesAmount');
    const totalCommissionAmount = document.getElementById('totalCommissionAmount');
    const settlementProgressStatus = document.getElementById('settlementProgressStatus');
    const settlementProgressDetail = document.getElementById('settlementProgressDetail');
    const settlementTableBody = document.getElementById('settlementTableBody');
    const btnExportExcel = document.getElementById('btnExportExcel');

    // 모달 DOM 엘리먼트
    const storeDetailsModalEl = document.getElementById('storeDetailsModal');
    const detailModal = storeDetailsModalEl ? new bootstrap.Modal(storeDetailsModalEl) : null;
    const modalStoreName = document.getElementById('modalStoreName');
    const modalTotalSales = document.getElementById('modalTotalSales');
    const modalDetailTableBody = document.getElementById('modalDetailTableBody');

    let currentFestivalName = '';
    
    // 차트 인스턴스 전역 관리 (재렌더링 시 기존 인스턴스 해제용)
    let storeShareChart = null;
    let feeSummaryChart = null;

    // 1. 페스티벌 목록 로드
    fetch('/api/settlement/festivals')
        .then(response => response.json())
        .then(data => {
            festivalSelect.innerHTML = '';
            if (data.length === 0) {
                festivalSelect.innerHTML = '<option value="">등록된 행사가 없습니다.</option>';
                return;
            }

            let ongoingId = null;
            data.forEach(festival => {
                const option = document.createElement('option');
                option.value = festival.id;
                
                // 상태별 라벨 붙이기
                let statusLabel = '';
                if (festival.operationalStatus === 'ONGOING') {
                    statusLabel = ' [진행중]';
                    ongoingId = festival.id; // 진행중인 축제를 기본값으로 선택하기 위해 기록
                } else if (festival.operationalStatus === 'UPCOMING') {
                    statusLabel = ' [예정]';
                } else if (festival.operationalStatus === 'COMPLETED') {
                    statusLabel = ' [종료]';
                }

                option.textContent = festival.name + statusLabel;
                festivalSelect.appendChild(option);
            });

            // 기본 선택: 진행중인 축제가 있으면 그것을 선택하고, 없으면 첫번째 축제 선택
            if (ongoingId) {
                festivalSelect.value = ongoingId;
            } else {
                festivalSelect.value = data[0].id;
            }

            // 첫 데이터 로딩
            loadSettlementData(festivalSelect.value);
        })
        .catch(error => {
            console.error('페스티벌 목록 조회 실패:', error);
            festivalSelect.innerHTML = '<option value="">행사 정보를 불러오지 못했습니다.</option>';
        });

    // 2. 행사 선택 변경 이벤트
    festivalSelect.addEventListener('change', function () {
        loadSettlementData(this.value);
    });

    // 3. 정산 데이터 조회 및 화면 렌더링
    function loadSettlementData(festivalId) {
        if (!festivalId) return;

        // 선택된 페스티벌 이름 캐싱
        currentFestivalName = festivalSelect.options[festivalSelect.selectedIndex].text.replace(/ \[[가-힣]+\]$/, '');

        // [2단계 UX 개선] 로딩 중 스켈레톤 로더(Skeleton Loader) UI 주입
        totalSalesAmount.innerHTML = '<span class="skeleton-loader height-large"></span>';
        totalCommissionAmount.innerHTML = '<span class="skeleton-loader height-large"></span>';
        settlementProgressStatus.innerHTML = '<span class="skeleton-loader height-large"></span>';
        settlementProgressDetail.innerHTML = '<span class="skeleton-loader" style="width: 60%"></span>';

        settlementTableBody.innerHTML = Array(4).fill(0).map(() => `
            <tr class="skeleton-row">
                <td><span class="skeleton-loader" style="width: 80%"></span></td>
                <td><span class="skeleton-loader" style="width: 60%"></span></td>
                <td><span class="skeleton-loader" style="width: 50%"></span></td>
                <td><span class="skeleton-loader" style="width: 50%"></span></td>
                <td><span class="skeleton-loader" style="width: 60%"></span></td>
                <td><span class="skeleton-loader" style="width: 40%"></span></td>
                <td><span class="skeleton-loader" style="width: 30%"></span></td>
                <td><span class="skeleton-loader" style="width: 70%"></span></td>
            </tr>
        `).join('');

        // 기존 차트 소멸 처리
        destroyCharts();

        // 은은한 로딩 전환감을 주기 위해 의도적으로 미세한 딜레이(300ms) 추가 적용
        setTimeout(() => {
            fetch(`/api/settlement/summary?festivalId=${festivalId}`)
                .then(response => response.json())
                .then(data => {
                    // 상단 통계 카드 데이터 반영
                    totalSalesAmount.textContent = '₩ ' + Number(data.totalSales).toLocaleString();
                    totalCommissionAmount.textContent = '₩ ' + Number(data.totalCommission).toLocaleString();
                    settlementProgressStatus.textContent = data.completionRate;
                    
                    const storeCount = data.stores ? data.stores.length : 0;
                    settlementProgressDetail.textContent = `가맹점 ${storeCount}곳의 매출 정산 정보가 반영되었습니다.`;

                    // 테이블 렌더링
                    settlementTableBody.innerHTML = '';
                    if (!data.stores || data.stores.length === 0) {
                        settlementTableBody.innerHTML = `
                            <tr>
                                <td colspan="8" class="text-center py-5 text-muted">해당 행사에 등록된 입점사(가맹점) 정보가 없습니다.</td>
                            </tr>
                        `;
                        renderNoDataCharts();
                        return;
                    }

                    data.stores.forEach(store => {
                        const tr = document.createElement('tr');
                        
                        const storeNameDisplay = store.boothNumber 
                            ? `<strong>${store.storeName}</strong> <small class="text-muted">(${store.boothNumber})</small>`
                            : `<strong>${store.storeName}</strong>`;

                        const salesDisplay = '₩ ' + Number(store.totalSales).toLocaleString();
                        const pgFeeDisplay = '₩ ' + Number(store.pgFee).toLocaleString();
                        const platformFeeDisplay = '₩ ' + Number(store.platformFee).toLocaleString();
                        const settlementAmountDisplay = '₩ ' + Number(store.settlementAmount).toLocaleString();
                        
                        // 상태 배지 설정
                        let badgeClass = 'bg-secondary';
                        if (store.status === '지급완료') {
                            badgeClass = 'bg-success';
                        } else if (store.status === '지급대기') {
                            badgeClass = 'bg-warning';
                        }
                        const badgeDisplay = `<span class="badge ${badgeClass}">${store.status}</span>`;

                        // [3단계 기능 추가] 관리 액션 버튼들 (상세조회 & 지급 승인)
                        const isPayoutDisabled = (store.status === '지급완료' || store.totalSales === 0) ? 'disabled' : '';
                        const isDetailDisabled = (store.totalSales === 0) ? 'disabled' : '';
                        const actionButtons = `
                            <div class="d-flex justify-content-center gap-1">
                                <button class="btn btn-xs btn-outline-secondary btn-detail" 
                                    data-id="${store.storeId}" 
                                    data-name="${store.storeName}" 
                                    data-sales="${store.totalSales}" 
                                    ${isDetailDisabled}>
                                    <i class="bx bx-search-alt"></i> 상세
                                </button>
                                <button class="btn btn-xs btn-primary btn-payout" 
                                    data-id="${store.storeId}" 
                                    data-name="${store.storeName}" 
                                    data-sales="${store.totalSales}"
                                    data-pg="${store.pgFee}"
                                    data-platform="${store.platformFee}"
                                    data-payout="${store.settlementAmount}"
                                    ${isPayoutDisabled}>
                                    <i class="bx bx-check-shield"></i> 지급승인
                                </button>
                            </div>
                        `;

                        tr.innerHTML = `
                            <td>${storeNameDisplay}</td>
                            <td>${salesDisplay}</td>
                            <td>${pgFeeDisplay}</td>
                            <td>${platformFeeDisplay}</td>
                            <td><strong class="text-primary">${settlementAmountDisplay}</strong></td>
                            <td>${store.settlementDate}</td>
                            <td>${badgeDisplay}</td>
                            <td class="text-center">${actionButtons}</td>
                        `;
                        settlementTableBody.appendChild(tr);
                    });

                    // 차트 렌더링 실행
                    renderCharts(data.stores);
                })
                .catch(error => {
                    console.error('정산 데이터 조회 실패:', error);
                    settlementTableBody.innerHTML = `
                        <tr>
                            <td colspan="8" class="text-center py-5 text-danger fw-bold">데이터를 로드하는 도중 오류가 발생했습니다.</td>
                        </tr>
                    `;
                    totalSalesAmount.textContent = '₩ 0';
                    totalCommissionAmount.textContent = '₩ 0';
                    settlementProgressStatus.textContent = '오류';
                    settlementProgressDetail.textContent = '에러 로그를 확인하세요.';
                    renderNoDataCharts();
                });
        }, 300);
    }

    // 4. 테이블 내부 액션 이벤트 위임 (Event Delegation)
    settlementTableBody.addEventListener('click', function (e) {
        // 4-1. 상세 보기 모달 오픈 처리
        const detailBtn = e.target.closest('.btn-detail');
        if (detailBtn) {
            const storeId = detailBtn.getAttribute('data-id');
            const storeName = detailBtn.getAttribute('data-name');
            const totalSales = Number(detailBtn.getAttribute('data-sales'));
            showStoreSalesDetails(storeId, storeName, totalSales);
            return;
        }

        // 4-2. 지급 승인 처리
        const payoutBtn = e.target.closest('.btn-payout');
        if (payoutBtn) {
            const storeId = Number(payoutBtn.getAttribute('data-id'));
            const storeName = payoutBtn.getAttribute('data-name');
            const totalSales = Number(payoutBtn.getAttribute('data-sales'));
            const pgFee = Number(payoutBtn.getAttribute('data-pg'));
            const platformFee = Number(payoutBtn.getAttribute('data-platform'));
            const payoutAmount = Number(payoutBtn.getAttribute('data-payout'));
            
            const festivalId = Number(festivalSelect.value);

            executePayout(storeId, storeName, totalSales, pgFee, platformFee, payoutAmount, festivalId);
        }
    });

    // 4-1-1. 특정 가맹점 매출 드릴다운 상세 모달 데이터 로드 및 노출
    function showStoreSalesDetails(storeId, storeName, totalSales) {
        if (!detailModal) return;

        modalStoreName.textContent = storeName;
        modalTotalSales.textContent = '₩ ' + totalSales.toLocaleString();
        modalDetailTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2">판매 품목 상세 내역을 가져오는 중입니다...</span>
                </td>
            </tr>
        `;

        detailModal.show();

        const festivalId = festivalSelect.value;
        fetch(`/api/settlement/store-details?storeId=${storeId}&festivalId=${festivalId}`)
            .then(res => res.json())
            .then(items => {
                modalDetailTableBody.innerHTML = '';
                if (items.length === 0) {
                    modalDetailTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="text-center py-4 text-muted">결제 완료된 판매 상품 내역이 존재하지 않습니다.</td>
                        </tr>
                    `;
                    return;
                }

                items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${item.productName}</strong></td>
                        <td class="text-end font-numeric">₩ ${item.price.toLocaleString()}</td>
                        <td class="text-center font-numeric fw-bold text-success">${item.totalQuantity.toLocaleString()}개</td>
                        <td class="text-end font-numeric fw-bold text-primary">₩ ${item.totalAmount.toLocaleString()}</td>
                    `;
                    modalDetailTableBody.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('가맹점 상세 내역 조회 실패:', err);
                modalDetailTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-4 text-danger fw-bold">세부 정보를 불러오는 데 실패했습니다.</td>
                    </tr>
                `;
            });
    }

    // 4-2-1. 정산금 지급 승인 실행 API 연동 (SweetAlert2 적용)
    function executePayout(storeId, storeName, totalSales, pgFee, platformFee, payoutAmount, festivalId) {
        if (!window.Swal) {
            const confirmMsg = `[정산 지급 확정]\n\n가맹점: ${storeName}\n최종 정산금: ₩ ${payoutAmount.toLocaleString()}\n\n해당 가맹점의 정산 상태를 '지급완료'로 승인 및 확정하시겠습니까?`;
            if (!confirm(confirmMsg)) return;
            performPayoutRequest(storeId, storeName, totalSales, pgFee, platformFee, payoutAmount, festivalId);
            return;
        }

        Swal.fire({
            title: '정산금 지급 승인',
            html: `가맹점: <strong>${storeName}</strong><br>최종 정산금: <strong class="text-primary">₩ ${payoutAmount.toLocaleString()}</strong><br><br>해당 가맹점의 정산 상태를 <strong>'지급완료'</strong>로 승인하시겠습니까?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '지급 승인',
            cancelButtonText: '취소',
            customClass: {
                confirmButton: 'btn btn-primary px-4 py-2 me-3',
                cancelButton: 'btn btn-label-secondary px-4 py-2'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                performPayoutRequest(storeId, storeName, totalSales, pgFee, platformFee, payoutAmount, festivalId);
            }
        });
    }

    function performPayoutRequest(storeId, storeName, totalSales, pgFee, platformFee, payoutAmount, festivalId) {
        const payload = {
            storeId: storeId,
            festivalId: festivalId,
            totalSales: totalSales,
            commissionFee: (pgFee + platformFee),
            finalPayout: payoutAmount
        };

        fetch('/api/settlement/payout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (window.Swal) {
                    Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2500,
                        timerProgressBar: true
                    }).fire({
                        icon: 'success',
                        title: `${storeName} 정산 승인이 확정되었습니다.`
                    });
                } else {
                    alert(`${storeName} 가맹점의 정산 지급 처리가 확정되었습니다.`);
                }
                loadSettlementData(festivalId);
            } else {
                if (window.Swal) {
                    Swal.fire({
                        title: '지급 승인 실패',
                        text: data.message,
                        icon: 'error',
                        confirmButtonText: '확인',
                        customClass: { confirmButton: 'btn btn-primary px-4 py-2' },
                        buttonsStyling: false
                    });
                } else {
                    alert(`지급 처리 실패: ${data.message}`);
                }
            }
        })
        .catch(err => {
            console.error('지급 승인 API 에러:', err);
            if (window.Swal) {
                Swal.fire({
                    title: '통신 오류',
                    text: '지급 승인 처리 도중 서버 통신 장애가 발생했습니다.',
                    icon: 'error',
                    confirmButtonText: '확인',
                    customClass: { confirmButton: 'btn btn-primary px-4 py-2' },
                    buttonsStyling: false
                });
            } else {
                alert('지급 승인 처리 도중 통신 장애가 발생했습니다.');
            }
        });
    }

    // 5. ApexCharts 연동 및 렌더링 함수
    function renderCharts(stores) {
        // 기존 인스턴스 파괴 보장
        destroyCharts();

        // 5-1. 가맹점 매출 점유율 도넛 차트
        const filteredStores = stores.filter(s => s.totalSales > 0);
        
        let shareOptions;
        if (filteredStores.length === 0) {
            renderNoDataCharts();
            return;
        } else {
            const seriesData = filteredStores.map(s => s.totalSales);
            const labelsData = filteredStores.map(s => s.storeName);

            shareOptions = {
                chart: {
                    type: 'donut',
                    height: 320,
                    fontFamily: 'Pretendard Variable, sans-serif'
                },
                labels: labelsData,
                series: seriesData,
                colors: ['#696cff', '#03c3ec', '#71dd37', '#ff3e1d', '#ffab00', '#233446', '#8592a3'],
                stroke: {
                    show: true,
                    width: 2,
                    colors: ['#ffffff']
                },
                legend: {
                    position: 'bottom',
                    fontSize: '12px',
                    fontFamily: 'Pretendard Variable',
                    labels: {
                        colors: '#566a7f'
                    }
                },
                tooltip: {
                    y: {
                        formatter: function (val) {
                            return '₩ ' + val.toLocaleString();
                        }
                    }
                },
                dataLabels: {
                    enabled: true,
                    formatter: function (val, opts) {
                        return opts.w.config.series[opts.seriesIndex] > 0 ? val.toFixed(1) + '%' : '';
                    }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            size: '65%',
                            labels: {
                                show: true,
                                value: {
                                    fontSize: '18px',
                                    fontWeight: '700',
                                    color: '#566a7f',
                                    formatter: function (val) {
                                        return '₩ ' + Number(val).toLocaleString();
                                    }
                                },
                                total: {
                                    show: true,
                                    label: '총 매출액',
                                    color: '#697a8d',
                                    fontSize: '13px',
                                    formatter: function (w) {
                                        const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                        return '₩ ' + sum.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                }
            };

            storeShareChart = new ApexCharts(document.querySelector('#storeShareChart'), shareOptions);
            storeShareChart.render();
        }

        // 5-2. 수수료 및 정산금 분석 바 차트 (Stack / Grouped Column)
        const topStores = [...stores]
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 7);

        const categories = topStores.map(s => s.storeName);
        const payoutData = topStores.map(s => s.settlementAmount);
        const pgFeeData = topStores.map(s => s.pgFee);
        const platformFeeData = topStores.map(s => s.platformFee);

        const barOptions = {
            chart: {
                type: 'bar',
                height: 320,
                stacked: true,
                toolbar: { show: false },
                fontFamily: 'Pretendard Variable, sans-serif'
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '40%',
                    borderRadius: 4
                },
            },
            dataLabels: {
                enabled: false
            },
            series: [{
                name: '최종 정산금',
                data: payoutData,
                color: '#696cff'
            }, {
                name: 'PG 수수료 (3%)',
                data: pgFeeData,
                color: '#ffb400'
            }, {
                name: '중개 수수료 (5%)',
                data: platformFeeData,
                color: '#ff3e1d'
            }],
            xaxis: {
                categories: categories,
                labels: {
                    style: {
                        colors: '#697a8d',
                        fontSize: '11px'
                    }
                }
            },
            yaxis: {
                labels: {
                    style: {
                        colors: '#697a8d'
                    },
                    formatter: function (val) {
                        return (val / 10000).toLocaleString() + '만';
                    }
                }
            },
            legend: {
                position: 'top',
                horizontalAlign: 'center',
                fontSize: '12px',
                labels: {
                    colors: '#566a7f'
                }
            },
            fill: {
                opacity: 0.9
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return '₩ ' + val.toLocaleString();
                    }
                }
            }
        };

        feeSummaryChart = new ApexCharts(document.querySelector('#feeSummaryChart'), barOptions);
        feeSummaryChart.render();
    }

    // 데이터가 없을 때의 차트 안내 화면 렌더링
    function renderNoDataCharts() {
        document.querySelector('#storeShareChart').innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bx bx-pie-chart-alt-2 fs-1 mb-2"></i>
                <p class="mb-0 fs-7">분석할 매출 정산 데이터가 없습니다.</p>
            </div>
        `;
        document.querySelector('#feeSummaryChart').innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bx bx-bar-chart-alt-2 fs-1 mb-2"></i>
                <p class="mb-0 fs-7">분석할 매출 수수료 데이터가 없습니다.</p>
            </div>
        `;
    }

    // 기존 차트 파괴 안전 장치
    function destroyCharts() {
        if (storeShareChart) {
            storeShareChart.destroy();
            storeShareChart = null;
        }
        if (feeSummaryChart) {
            feeSummaryChart.destroy();
            feeSummaryChart = null;
        }
        document.querySelector('#storeShareChart').innerHTML = '';
        document.querySelector('#feeSummaryChart').innerHTML = '';
    }

    // 6. CSV 다운로드 기능 (UTF-8 BOM 지원)
    btnExportExcel.addEventListener('click', function () {
        const rows = document.querySelectorAll('#settlementTable tr');
        if (rows.length <= 1 || (rows.length === 2 && rows[1].querySelector('td').colSpan > 1)) {
            alert('다운로드할 정산 데이터가 없습니다.');
            return;
        }

        let csvContent = '';
        
        // 헤더 행 처리
        const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.textContent.trim());
        csvContent += headers.join(',') + '\n';

        // 데이터 행 처리
        for (let i = 1; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td');
            if (cells.length === 1 && cells[0].colSpan > 1) continue; // 데이터 없음 메시지 행 제외
            
            const rowData = Array.from(cells).map(cell => {
                let text = cell.textContent.trim();
                text = text.replace(/"/g, '""');
                return `"${text}"`;
            });
            csvContent += rowData.join(',') + '\n';
        }

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const today = new Date().toISOString().slice(0, 10);
        const filename = `정산내역_${currentFestivalName.replace(/[\/\\:\*\?"<>\|]/g, '')}_${today}.csv`;
        
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
});
