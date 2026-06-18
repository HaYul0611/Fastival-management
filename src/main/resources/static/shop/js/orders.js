'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const { Session, Toast, renderHeader } = window.FS;
  renderHeader();

  if (!Session.isLoggedIn()) {
    Toast.error('로그인이 필요합니다.');
    location.href = 'login.html';
    return;
  }

  const email = localStorage.getItem('email');
  if (!email || !window.ShopDB) return;

  let profile = await window.ShopDB.getProfile(email);
  if (!profile) {
    profile = { id: 'mock', user_name: '관리자', tier: 'BRONZE' };
  }

  const listEl = document.getElementById('ordersList');

  // 모달 닫기 이벤트
  const qrModal = document.getElementById('qrModal');
  const qrClose = document.getElementById('qrClose');
  qrClose.addEventListener('click', () => qrModal.classList.remove('show'));
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) qrModal.classList.remove('show');
  });

  const odModal = document.getElementById('orderDetailModal');
  const odClose = document.getElementById('odClose');
  odClose.addEventListener('click', () => odModal.classList.remove('show'));
  odModal.addEventListener('click', (e) => {
    if (e.target === odModal) odModal.classList.remove('show');
  });

  // 주문 전역 변수
  window.currentOrders = [];

  // TOTP 로직
  let totpTimer = null;
  async function generateMockTotp(secret, timeWindow) {
    // 프론트엔드 모의 시연용 (실제는 백엔드와 HMAC-SHA1 일치 필요)
    let hash = 0;
    const str = secret + timeWindow;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(Math.abs(hash) % 1000000).padStart(6, '0');
  }

  let manualOffset = 0;
  window.openQrModal = function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    let secret = order?.totp_secret || 'dummysecret12345';
    manualOffset = 0; // 모달 열때 초기화

    document.getElementById('qrOrderNo').textContent = '주문번호: ' + orderNo;
    qrModal.classList.add('show');

    const refreshTotp = async (isManual = false) => {
      if (isManual) manualOffset++;
      const timeWindow = Math.floor(Date.now() / 180000) + manualOffset; // 3분 단위 + 수동오프셋
      const code = await generateMockTotp(secret, timeWindow);

      document.getElementById('totpCode').textContent = code;

      const qrData = 'TOTP:' + orderNo + ':' + code;
      const qrImage = document.getElementById('qrImage');
      const container = qrImage.parentElement;

      qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(qrData) + '&margin=0&format=svg';
      qrImage.style.transform = 'translateY(11px) rotate(45deg) scale(0.5)';
      qrImage.style.zIndex = '1';
      qrImage.style.position = 'relative';

      const heartSvgDataUrl = "data:image/svg+xml;utf8,<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'><path d='M50 88 C 50 88 5 60 5 30 C 5 5 45 5 50 25 C 55 5 95 5 95 30 C 95 60 50 88 50 88 Z' fill='black' /></svg>";
      container.style.maskImage = `url("${heartSvgDataUrl.replace(/#/g, '%23')}")`;
      container.style.maskSize = "contain";
      container.style.maskRepeat = "no-repeat";
      container.style.maskPosition = "center";
      container.style.webkitMaskImage = `url("${heartSvgDataUrl.replace(/#/g, '%23')}")`;
      container.style.webkitMaskSize = "contain";
      container.style.webkitMaskRepeat = "no-repeat";
      container.style.webkitMaskPosition = "center";
      container.style.position = 'relative';
      container.style.overflow = 'hidden';

      if (!document.getElementById('heartQrBg_' + orderNo)) {
        const bg = document.createElement('div');
        bg.id = 'heartQrBg_' + orderNo;
        bg.style.position = 'absolute';
        bg.style.width = '300%';
        bg.style.height = '300%';
        bg.style.top = '-100%';
        bg.style.left = '-100%';
        bg.style.transform = 'translateY(11px) rotate(45deg) scale(0.5)';
        bg.style.zIndex = '0';
        bg.style.imageRendering = 'pixelated';
        let svg = "<svg xmlns='http://www.w3.org/2000/svg' width='45.71' height='45.71'><rect width='45.71' height='45.71' fill='#fff'/>";
        for (let y = 0; y < 6; y++) {
          for (let x = 0; x < 6; x++) {
            if (Math.random() > 0.4) {
              svg += `<rect x='${x * 7.619}' y='${y * 7.619}' width='7.62' height='7.62' fill='#000'/>`;
            }
          }
        }
        svg += "</svg>";
        bg.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
        bg.style.backgroundRepeat = 'repeat';
        bg.style.backgroundPosition = 'calc(50% + 3.81px) calc(50% + 3.81px)';
        container.insertBefore(bg, qrImage);
      }

      // 남은 시간 초기화 (수동 리셋 시 180초 풀로 시작)
      let timeLeft = isManual ? 180 : 180 - Math.floor((Date.now() % 180000) / 1000);

      const bar = document.getElementById('totpTimerBar');
      const txt = document.getElementById('totpTimeTxt');
      if (totpTimer) clearInterval(totpTimer);

      const updateUI = () => {
        bar.style.width = (timeLeft / 180 * 100) + '%';
        const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        txt.textContent = m + ':' + s;
      };
      updateUI(); // 초기 렌더

      totpTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(totpTimer);
          refreshTotp();
        } else {
          updateUI();
        }
      }, 1000);
    };

    const btnReset = document.getElementById('btnResetTotp');
    if (btnReset) {
      btnReset.onclick = () => {
        // SVG 회전 애니메이션 효과 (선택사항)
        btnReset.style.transition = 'transform 0.3s';
        btnReset.style.transform = `rotate(${manualOffset * 180 + 180}deg)`;
        refreshTotp(true);
      };
    }

    refreshTotp();
  };

  // 상세 모달 열기
  window.openDetailModal = function (orderNo) {
    const order = window.currentOrders.find(o => o.order_number === orderNo);
    if (!order) return;

    const itemsHtml = (order.shop_order_items || []).map(item => `
      <div style="display:flex; justify-content:space-between; padding: 12px 0; border-bottom:1px solid var(--g100);">
        <div>
          <div style="font-weight:700; color:var(--g900);">${item.product_name || '상품명'}</div>
          <div style="font-size:13px; color:var(--g500); margin-top:4px;">수량: ${item.quantity || 1}개</div>
        </div>
        <div style="font-weight:700;">${((item.price_at_purchase || 0) * (item.quantity || 1)).toLocaleString()}원</div>
      </div>
    `).join('');

    const html = `
      <div style="margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">주문번호</span>
          <span style="font-weight:700;">${order.order_number}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">결제일시</span>
          <span style="font-weight:700;">${new Date(order.created_at).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">수령방법</span>
          <span style="font-weight:700;">${order.delivery_type === 'PICKUP' ? '현장수령' : '일반배송'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <span style="color:var(--g500);">결제수단</span>
          <span style="font-weight:700;">${order.payment_method === 'FESTIO_PAY' ? 'FESTIO Pay' : '카드결제'}</span>
        </div>
      </div>
      <h4 style="font-size:16px; font-weight:800; margin-bottom:12px;">주문 상품</h4>
      <div style="margin-bottom:24px; border-top:2px solid var(--g900);">
        ${itemsHtml}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--g50); padding:16px; border-radius:8px; margin-bottom: 20px;">
        <span style="font-size:16px; font-weight:700;">총 결제금액</span>
        <span style="font-size:20px; font-weight:900; color:var(--blue);">${(order.total_amount || 0).toLocaleString()}원</span>
      </div>
      ${['PAID', 'PENDING'].includes(order.status) || !order.status || order.status === 'READY_FOR_PICKUP' ? `
        <div style="display:flex; justify-content:center;">
          <button class="btn-cancel-order" onclick="cancelOrder('${order.order_number}')" style="width:100%; padding:14px; background:var(--white); border:1px solid var(--g300); border-radius:8px; font-weight:700; color:var(--g700); cursor:pointer;">주문 취소</button>
        </div>
      ` : ''}
    `;

    document.getElementById('odContent').innerHTML = html;
    odModal.classList.add('show');
  };

  // 주문 내역 가져오기
  const fetchOrders = async () => {
    const sb = window.ShopDB.getClient();
    let { data: orders, error } = await sb.from('shop_orders').select('*, shop_order_items(*)').eq('profile_id', profile.id).order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      listEl.innerHTML = '<p>주문 내역을 불러오지 못했습니다.</p>';
      return;
    }

    if (!orders || orders.length === 0) {
      // 미리보기용 더미 데이터
      const dummyOrder = {
        order_number: 'F1X9K2M4P5T8',
        created_at: new Date().toISOString(),
        delivery_type: 'PICKUP',
        status: 'READY_FOR_PICKUP',
        payment_method: 'FESTIO_PAY',
        total_amount: 12500,
        totp_secret: 'dummysecret12345',
        shop_order_items: [
          { product_name: '스모크 바베큐 버거 + 콜라 세트', quantity: 1, price_at_purchase: 12500 }
        ]
      };
      window.currentOrders = [dummyOrder];
      listEl.innerHTML = renderOrderCard(dummyOrder);
      return;
    }

    window.currentOrders = orders;
    listEl.innerHTML = orders.map(renderOrderCard).join('');
  };

  // 즉시 실행 (스켈레톤 지연 제거)
  fetchOrders();
});

function renderOrderCard(order) {
  const isPickup = order.delivery_type === 'PICKUP';
  let steps = '';

  if (isPickup) {
    const isDone1 = true;
    const isDone2 = order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED';
    const isDone3 = order.status === 'COMPLETED';

    let movingEmoji = '👨‍🍳';
    let flipClass = '';
    if (isDone3) { movingEmoji = '🛍️'; }
    else if (isDone2) { movingEmoji = '🏃'; flipClass = 'flip'; }
    else if (isDone1) { movingEmoji = '🍳'; }

    steps = `
      <div class="st-line-bg"></div>
      <div class="st-progress-bar"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66 : 33)}%;"><span class="st-truck ${flipClass}">${movingEmoji}</span></div></div>
      <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
      <div class="st-step ${isDone2 ? 'done' : 'active'}"><div class="st-dot"></div><div class="st-label">조리 준비</div></div>
      <div class="st-step ${isDone3 ? 'done' : (isDone2 ? 'active' : '')}"><div class="st-dot"></div><div class="st-label">수령전</div></div>
      <div class="st-step ${isDone3 ? 'active' : ''}"><div class="st-dot"></div><div class="st-label">수령완료</div></div>
    `;
  } else {
    const isDone1 = true;
    const isDone2 = order.status === 'SHIPPING' || order.status === 'DELIVERED';
    const isDone3 = order.status === 'DELIVERED';

    let movingEmoji = '📦';
    let flipClass = '';
    if (isDone3) { movingEmoji = '📫'; }
    else if (isDone2) { movingEmoji = '🚚'; }

    steps = `
      <div class="st-line-bg"></div>
      <div class="st-progress-bar"><div class="st-progress" style="width:${isDone3 ? 100 : (isDone2 ? 66 : 33)}%;"><span class="st-truck ${flipClass}">${movingEmoji}</span></div></div>
      <div class="st-step done"><div class="st-dot"></div><div class="st-label">결제완료</div></div>
      <div class="st-step ${isDone2 ? 'done' : 'active'}"><div class="st-dot"></div><div class="st-label">배송준비</div></div>
      <div class="st-step ${isDone3 ? 'done' : (isDone2 ? 'active' : '')}"><div class="st-dot"></div><div class="st-label">배송중</div></div>
      <div class="st-step ${isDone3 ? 'active' : ''}"><div class="st-dot"></div><div class="st-label">배송완료</div></div>
    `;
  }

  const itemsHtml = (order.shop_order_items || []).map(item => `
    <div class="order-item">
      <div class="oi-img" style="background:#f0f0f0"></div>
      <div class="oi-info">
        <span class="oi-status ${isPickup ? 'pickup' : 'shipping'}">${isPickup ? '푸드트럭 현장수령' : '일반 배송'}</span>
        <div class="oi-name">${item.product_name || '상품'}</div>
        <div class="oi-opt">수량: ${item.quantity || 1}개</div>
        <div class="oi-price">${(item.price_at_purchase || 0).toLocaleString()}원</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="order-card">
      <div class="order-header">
        <div>
          <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
          <span class="order-no">주문번호 ${order.order_number}</span>
        </div>
        <a href="javascript:void(0)" onclick="openDetailModal('${order.order_number}')" class="order-detail-btn">주문상세 보기 &gt;</a>
      </div>
      <div class="order-items">${itemsHtml}</div>
      <div class="status-tracker">${steps}</div>
      <div class="order-actions" style="display:flex; justify-content:${isPickup ? 'space-between' : 'flex-start'}; align-items:center; margin-top:16px;">
        <button class="btn-review" onclick="openReviewModal('${order.order_number}')" style="background:var(--white); border:1px solid var(--g300); padding:10px 16px; border-radius:8px; font-weight:700; color:var(--g800); cursor:pointer;">리뷰 작성</button>
        ${isPickup ? `
        <button class="btn-qr" onclick="openQrModal('${order.order_number}')" style="background:var(--black); color:var(--white); border:none; padding:10px 16px; border-radius:8px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" /><rect x="14" y="18" width="3" height="3" /><rect x="18" y="14" width="3" height="3" />
          </svg> QR 픽업증 보기
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// 주문 취소
window.cancelOrder = function (orderNo) {
  if (confirm(orderNo + ' 주문을 취소하시겠습니까?')) {
    alert('주문이 취소되었습니다.');
    location.reload();
  }
};

// 리뷰 모달 전역 로직
let reviewImages = [];
let currentRating = 0;

window.openReviewModal = function (orderNo) {
  reviewImages = [];
  currentRating = 0;
  updateReviewStars();
  updateReviewScore();
  renderReviewThumbs();
  document.getElementById('rvText').value = '';
  document.getElementById('reviewModal').classList.add('show');
};

window.closeReviewModal = function () {
  document.getElementById('reviewModal').classList.remove('show');
};

window.triggerReviewImageUpload = function () {
  document.getElementById('rvImageInput').click();
};

window.handleReviewImageSelect = function (e) {
  const files = Array.from(e.target.files);
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = ev => {
      reviewImages.push(ev.target.result);
      renderReviewThumbs();
    };
    reader.readAsDataURL(f);
  });
  e.target.value = '';
};

window.removeReviewImage = function (index) {
  reviewImages.splice(index, 1);
  renderReviewThumbs();
};

window.scrollReviewThumbs = function (dir) {
  const container = document.getElementById('rvThumbContainer');
  if (dir === -1) {
    container.scrollBy({ left: -100, behavior: 'smooth' });
  } else {
    container.scrollBy({ left: 100, behavior: 'smooth' });
  }
};

function renderReviewThumbs() {
  const container = document.getElementById('rvThumbContainer');
  if (reviewImages.length === 0) {
    container.innerHTML = '<div style="color:var(--g400); font-size:13px; line-height:60px;">사진을 첨부해주세요.</div>';
    return;
  }
  container.innerHTML = reviewImages.map((src, i) => `
    <div class="rv-thumb-item" style="position:relative; width:60px; height:60px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--g100);">
      <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
      <button onclick="removeReviewImage(${i})" class="rv-thumb-del" style="position:absolute; top:4px; right:4px; background:transparent; border:none; color:#fff; cursor:pointer; width:20px; height:20px; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `).join('');
}

window.setRating = function (val) {
  if (currentRating === val) {
    currentRating = 0; // 토글 (동일한 점수 클릭 시 초기화)
  } else {
    currentRating = val;
  }
  updateReviewStars();
  updateReviewScore();
};

function updateReviewStars() {
  for (let i = 1; i <= 5; i++) {
    const star = document.getElementById('rvStar' + i);
    if (currentRating >= i) {
      star.className = 'rv-star full';
    } else if (currentRating >= i - 0.5) {
      star.className = 'rv-star half';
    } else {
      star.className = 'rv-star rv-empty';
    }
  }
}

function updateReviewScore() {
  document.getElementById('rvScoreTxt').textContent = '(' + (currentRating.toFixed(1)) + ')';
}

window.submitReview = function () {
  if (currentRating === 0) {
    alert('별점을 입력해주세요.');
    return;
  }
  alert('리뷰가 등록되었습니다!');
  closeReviewModal();
};
