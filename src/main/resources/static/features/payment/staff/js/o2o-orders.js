const userSpecificRole = localStorage.getItem('userSpecificRole') || sessionStorage.getItem('userSpecificRole') || 'ROLE_FOOD_STAFF';

            // DOM Elements and Counters
            var newOrdersCount = document.getElementById('newOrdersCount');
            var prepOrdersCount = document.getElementById('prepOrdersCount');
            var readyOrdersCount = document.getElementById('readyOrdersCount');
            var newOrdersCol = document.getElementById('newOrdersCol');
            var prepOrdersCol = document.getElementById('prepOrdersCol');
            var readyOrdersCol = document.getElementById('readyOrdersCol');

            // Helper: Update Header Counts
            function updateCounters() {
              newOrdersCount.innerText = newOrdersCol.querySelectorAll('.order-card').length;
              prepOrdersCount.innerText = prepOrdersCol.querySelectorAll('.order-card').length;
              readyOrdersCount.innerText = readyOrdersCol.querySelectorAll('.order-card').length;
            }

            // 1. DING-DONG! Baemin style notification popup simulation after 3 seconds
            // 데모용 1회성 하드코딩 팝업은 혼선을 주므로 비활성화 처리합니다.

            // Token Getter
            function getAuthHeader() {
              return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
            }

            // DOM Elements and Counters
            var newOrdersCount = document.getElementById('newOrdersCount');
            var prepOrdersCount = document.getElementById('prepOrdersCount');
            var readyOrdersCount = document.getElementById('readyOrdersCount');
            var newOrdersCol = document.getElementById('newOrdersCol');
            var prepOrdersCol = document.getElementById('prepOrdersCol');
            var readyOrdersCol = document.getElementById('readyOrdersCol');

            let activeOrdersCache = [];

            document.addEventListener('DOMContentLoaded', () => {
              // 최초 조회 후 3초마다 폴링으로 실시간 주문 감지
              loadOrders();
              setInterval(loadOrders, 3000);
            });

            function loadOrders() {
              fetch('/api/payment/staff/orders', {
                headers: {
                  'Authorization': getAuthHeader()
                }
              })
                .then(res => {
                  if (!res.ok) throw new Error("주문 목록 로드 실패");
                  return res.json();
                })
                .then(orders => {
                  // 딩동! 알림 로직 (이전 캐시 대비 새로운 ORDERED 주문이 들어왔는지 감지)
                  const currentOrderedIds = orders.filter(o => o.status === 'ORDERED').map(o => o.id);
                  const cachedOrderedIds = activeOrdersCache.filter(o => o.status === 'ORDERED').map(o => o.id);

                  const newItemsDetected = currentOrderedIds.filter(id => !cachedOrderedIds.includes(id));
                  if (newItemsDetected.length > 0) {
                    playDingDongAlert(newItemsDetected.length);
                  }

                  activeOrdersCache = orders;
                  renderKanban(orders);
                })
                .catch(err => console.error("주문 로드 에러:", err));
            }

            function playDingDongAlert(count) {
              // 팝업 알림 생성 (오른쪽 하단 고정형 및 확인 버튼 포함)
              const popup = document.createElement('div');
              popup.style.position = 'fixed';
              popup.style.bottom = '24px';
              popup.style.right = '24px';
              popup.style.zIndex = '9999';
              popup.style.width = '360px';
              popup.className = 'card border border-primary shadow-lg animate__animated animate__bounceInUp';
              popup.innerHTML = `
      <div class="card-body p-4 text-white" style="background-color: #696cff; border-radius: 8px; box-shadow: 0 8px 30px rgba(105, 108, 255, 0.25);">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="m-0 fw-bold text-white"><i class="bx bx-volume-full me-2"></i>신규 스마트 오더</h5>
          <button type="button" class="btn-close btn-close-white" onclick="this.closest('.card').remove()"></button>
        </div>
        <p class="mb-3 fs-6 fw-bold">📢 딩동! 실시간 신규 주문 ${count}건이 들어왔습니다!</p>
        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-white text-primary fw-bold px-3 py-1.5" onclick="this.closest('.card').remove();" style="background-color: #ffffff; border: none; border-radius: 4px;">
            확인 및 닫기
          </button>
        </div>
      </div>
    `;
              document.body.appendChild(popup);
              // 자동으로 사라지는 타이머를 완전히 제거하여 가맹주가 [확인] 버튼을 클릭해 닫을 때까지 유지

              // 사운드 알림
              try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                osc.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
              } catch (e) { }
            }

            function renderKanban(orders) {
              // 3개 컬럼 내용물 초기화
              newOrdersCol.innerHTML = "";
              prepOrdersCol.innerHTML = "";
              readyOrdersCol.innerHTML = "";

              orders.forEach(order => {
                const itemsHtml = order.items.map(it => {
                  let optHtml = '';
                  if (it.options) {
                    const isGoods = userSpecificRole === 'ROLE_GOODS_STAFF';
                    if (isGoods) {
                      optHtml = `<div class="mt-2 text-danger fw-bold" style="font-size: 1.15rem; color: #ff3e1d !important;">[옵션: ${it.options}]</div>`;
                    } else {
                      optHtml = `<div class="text-muted small" style="font-size: 0.85rem;">(옵션: ${it.options})</div>`;
                    }
                  }
                  return `<div>${it.name} ${it.quantity}개${optHtml}</div>`;
                }).join('');

                const priceText = (order.price || 0).toLocaleString();
                const timestamp = order.timestamp ? order.timestamp.substring(11, 16) : '';

                const cardHtml = `
        <div class="card border border-2 rounded-3 p-4 mb-4 shadow-sm bg-white order-card animate__animated animate__fadeIn" id="card-${order.id}">
          <div class="d-flex justify-content-between mb-3">
            <strong class="${order.status === 'ORDERED' ? 'text-primary' : (order.status === 'COOKING' ? 'text-warning' : 'text-success')} fs-6">
              #O2O-${order.id}
            </strong>
            <span class="text-muted fw-bold"><i class="bx bx-time me-1"></i>${timestamp}</span>
          </div>
          <h5 class="mb-2 fw-bold text-dark">${itemsHtml}</h5>
          <p class="text-muted fs-7 mb-3"><i class="bx bx-user me-1 text-info"></i>${order.customer} | ₩ ${priceText}</p>
          
          <div class="action-area mt-3">
            ${renderActionButtons(order)}
          </div>
        </div>
      `;

                if (order.status === 'ORDERED') {
                  newOrdersCol.insertAdjacentHTML('beforeend', cardHtml);
                } else if (order.status === 'COOKING') {
                  prepOrdersCol.insertAdjacentHTML('beforeend', cardHtml);
                } else if (order.status === 'READY') {
                  readyOrdersCol.insertAdjacentHTML('beforeend', cardHtml);
                }
              });

              updateCounters();
            }

            function renderActionButtons(order) {
              const isGoods = userSpecificRole === 'ROLE_GOODS_STAFF';
              if (order.status === 'ORDERED') {
                const itemsText = order.items.map(it => `${it.name} ${it.quantity}개`).join(', ');
                if (isGoods) {
                  return `
                    <button class="btn btn-primary btn-lg w-100 py-3 fw-bold shadow-sm" style="min-height: 52px; font-size: 1.05rem;" onclick="updateStatus(${order.id}, 'COOKING', null, '${itemsText}')">
                      <i class="bx bx-check me-2 fs-5"></i>주문 확인(수락)
                    </button>
                  `;
                } else {
                  return `
                    <small class="text-muted d-block mb-2 fw-bold text-center">조리 예상 소요 시간을 누르면 즉시 수락됩니다.</small>
                    <div class="d-flex gap-1 justify-content-between flex-wrap">
                      <button class="btn btn-outline-primary btn-sm py-2 px-3 fw-bold flex-grow-1" onclick="updateStatus(${order.id}, 'COOKING', 10, '${itemsText}')">10분</button>
                      <button class="btn btn-outline-primary btn-sm py-2 px-3 fw-bold flex-grow-1" onclick="updateStatus(${order.id}, 'COOKING', 15, '${itemsText}')">15분</button>
                      <button class="btn btn-outline-primary btn-sm py-2 px-3 fw-bold flex-grow-1" onclick="updateStatus(${order.id}, 'COOKING', 20, '${itemsText}')">20분</button>
                      <button class="btn btn-outline-primary btn-sm py-2 px-3 fw-bold flex-grow-1" onclick="updateStatus(${order.id}, 'COOKING', 30, '${itemsText}')">30분</button>
                    </div>
                  `;
                }
              } else if (order.status === 'COOKING') {
                const itemsText = order.items.map(it => `${it.name} ${it.quantity}개`).join(', ');
                if (isGoods) {
                  return `
                    <button class="btn btn-warning btn-lg w-100 py-3 fw-bold shadow-sm ready-btn text-dark" style="min-height: 52px; font-size: 1.05rem;" onclick="updateStatus(${order.id}, 'READY', null, '${itemsText}')">
                      <i class="bx bx-package me-2 fs-5"></i>포장 완료(픽업 요청)
                    </button>
                  `;
                } else {
                  return `
                    <button class="btn btn-warning btn-lg w-100 py-3 fw-bold shadow-sm ready-btn text-dark" style="min-height: 52px; font-size: 1.05rem;" onclick="updateStatus(${order.id}, 'READY', null, '${itemsText}')">
                      <i class="bx bx-bell me-2 fs-5"></i>조리 완료 (픽업 알림 전송)
                    </button>
                  `;
                }
              } else if (order.status === 'READY') {
                return `
                  <button class="btn btn-success btn-lg w-100 py-3 fw-bold shadow-sm complete-btn text-white" style="min-height: 52px; font-size: 1.05rem;" onclick="updateStatus(${order.id}, 'SERVED', null, '')">
                    <i class="bx bx-package me-2 fs-5"></i>수령 완료 (전달 완료)
                  </button>
                `;
              }
              return '';
            }

            function updateStatus(orderId, nextStatus, cookingTime, orderName) {
              const isGoods = userSpecificRole === 'ROLE_GOODS_STAFF';
              fetch(`/api/payment/staff/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': getAuthHeader()
                },
                body: JSON.stringify({ status: nextStatus })
              })
                .then(res => {
                  if (!res.ok) throw new Error("주문 처리 오류");
                  return res.json();
                })
                .then(data => {
                  if (nextStatus === 'COOKING') {
                    if (isGoods) {
                      alert(`📦 [${orderName}] 주문을 확인(수락)하였습니다.`);
                    } else {
                      alert(`👨‍🍳 [${orderName}] 주문을 수락하였습니다.\n예상 조리시간: ${cookingTime}분 | 실시간 안내 발송 완료.`);
                    }
                  } else if (nextStatus === 'READY') {
                    if (isGoods) {
                      alert(`🔔 [${orderName}] 포장이 완료되어 픽업 알림이 전송되었습니다.`);
                    } else {
                      alert(`🔔 [${orderName}] 조리가 완료되어 대외 픽업 안내가 실시간 송출되었습니다.`);
                    }
                  } else if (nextStatus === 'SERVED') {
                    alert(`✅ 주문 수령 완료 처리가 성공적으로 접수되었습니다. 정산 집계에 자동 산입됩니다.`);
                  }
                  loadOrders(); // 리로딩
                })
                .catch(err => {
                  console.error(err);
                  alert("❌ 주문 상태 업데이트에 실패했습니다. 권한을 확인해주세요.");
                });
            }