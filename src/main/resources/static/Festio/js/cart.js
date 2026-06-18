/**
 * Festival O2O Platform — cart.js
 */

'use strict';

let _cartItems = [];
let _selectedPayMethod = 'card';

// 장바구니 데이터 불러오기 (임시 localStorage 또는 API 연동)
async function loadCartData() {
  try {
    const res = await fetch('/api/cart');
    if (res.ok) {
      _cartItems = await res.json();
    } else {
      // Mock data for test
      _cartItems = [
        { id: 1, eventId: "1", zoneName: "VIP구역", quantity: 2, price: 150000, eventName: "K-POP 드림 콘서트 2026", img: "images/events/kpop_poster.jpg" }
      ];
    }
  } catch (e) {
    _cartItems = [
      { id: 1, eventId: "1", zoneName: "VIP구역", quantity: 2, price: 150000, eventName: "K-POP 드림 콘서트 2026", img: "https://ticketimage.interpark.com/Play/image/large/24/24003264_p.gif" }
    ];
  }
  renderCart();
}

function renderCart() {
  const container = $('#cart-list-container');
  if (!container) return;

  if (_cartItems.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"/>
          <circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>장바구니가 비어 있습니다.</p>
      </div>`;
    updateSummary();
    return;
  }

  container.innerHTML = _cartItems.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.img || 'https://via.placeholder.com/100'}" alt="포스터" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.eventName || '행사명'}</div>
        <div class="cart-item-meta">${item.zoneName}</div>
        <div class="cart-item-controls">
          <div class="qty-control">
            <button class="btn-qty-minus" onclick="updateCartQty(${item.id}, -1)">-</button>
            <span>${item.quantity}</span>
            <button class="btn-qty-plus" onclick="updateCartQty(${item.id}, 1)">+</button>
          </div>
          <div class="cart-item-price">${formatKRW(item.price * item.quantity)}</div>
        </div>
      </div>
      <button class="btn-remove-item" onclick="removeCartItem(${item.id})" aria-label="삭제">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('');

  updateSummary();
}

async function updateCartQty(id, delta) {
  const item = _cartItems.find(i => i.id === id);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty < 1) return;

  // API Call
  // await fetch(`/api/cart/${id}?quantity=${newQty}`, { method: 'PUT' });

  item.quantity = newQty;
  renderCart();
}

async function removeCartItem(id) {
  // API Call
  // await fetch(`/api/cart/${id}`, { method: 'DELETE' });

  _cartItems = _cartItems.filter(i => i.id !== id);
  renderCart();
}

function updateSummary() {
  const totalGross = _cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discount = 0; // 쿠폰 로직 적용 시 계산
  const net = totalGross - discount;

  const priceEl = $('#cart-total-price');
  const discountEl = $('#cart-total-discount');
  const finalEl = $('#cart-final-price');

  if (priceEl) priceEl.textContent = formatKRW(totalGross);
  if (discountEl) discountEl.textContent = discount > 0 ? `-${formatKRW(discount)}` : '-0원';
  if (finalEl) finalEl.textContent = formatKRW(net);
}

/* ─ 포트원 V1 결제 후 서버 검증 및 충전 (cart.js 전용 복사본) ─────────────────── */
async function requestWalletCharge(amount) {
  return new Promise((resolve, reject) => {
    if (!window.IMP) {
      reject(new Error('결제 모듈이 로드되지 않았습니다. 페이지를 새로고침 해주세요.'));
      return;
    }

    IMP.init('imp81384776');

    const orderUid = 'festio-wallet-' + Date.now();
    const member = (typeof _member !== 'undefined') ? _member : null;

    IMP.request_pay({
      pg: 'html5_inicis.INIpayTest',
      pay_method: 'card',
      merchant_uid: orderUid,
      name: `FESTIO Pay 충전 ${amount.toLocaleString()}원`,
      amount: amount,
      buyer_email: (member && member.email) || '',
      buyer_name: (member && member.name) || '이용자',
      buyer_tel: (member && member.phone) || '010-0000-0000',
    }, async (rsp) => {
      if (rsp.success) {
        try {
          const token = localStorage.getItem('userToken');
          const res = await fetch('/api/wallet/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ impUid: rsp.imp_uid, amount, userToken: token })
          });

          let data;
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await res.json();
          } else {
            const text = await res.text();
            data = { success: false, message: text };
          }

          if (res.ok && data.success) {
            resolve(data);
          } else {
            reject(new Error(data.message || '서버 충전 처리 실패'));
          }
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(rsp.error_msg || '결제가 취소되었습니다.'));
      }
    });
  });
}

function initCartPayment() {
  on(document, 'click', (e) => {
    const option = e.target.closest('.pay-method-btn');
    if (!option) return;
    $$('.pay-method-btn').forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');
    _selectedPayMethod = option.dataset.method || 'card';

    const festioArea = $('#cart-festiopay-area');
    if (festioArea) {
      if (_selectedPayMethod === 'festiopay') {
        festioArea.classList.remove('hidden');
      } else {
        festioArea.classList.add('hidden');
      }
    }
  });

  // 충전하기 모달 오픈
  on($('#btn-cart-charge-festiopay'), 'click', () => {
    const modal = $('#modal-charge');
    if (modal) {
      modal.style.display = 'flex';
      const input = $('#cartChargeInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      $$('.quick-charge-btn').forEach(b => b.classList.remove('selected'));
    }
  });

  // 빠른 충전 버튼
  const quickGrid = $('#cartQuickChargeGrid');
  if (quickGrid) {
    quickGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-charge-btn');
      if (!btn) return;
      quickGrid.querySelectorAll('.quick-charge-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const input = $('#cartChargeInput');
      if (input) input.value = parseInt(btn.dataset.amount).toLocaleString();
    });
  }

  // 충전 입력 포맷
  const chargeInputObj = $('#cartChargeInput');
  if (chargeInputObj) {
    chargeInputObj.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val) {
        e.target.value = parseInt(val).toLocaleString();
      } else {
        e.target.value = '';
      }
    });
  }

  // 실제 충전 진행
  on($('#btnCartChargeConfirm'), 'click', async () => {
    const input = $('#cartChargeInput');
    const amountStr = input ? input.value : '0';
    const amount = parseInt(amountStr.replace(/,/g, '') || 0);

    if (!amount || amount < 1000) {
      if (window.Toast) Toast.warn('최소 1,000원 이상 입력해주세요.');
      return;
    }
    if (amount > 5000000) {
      if (window.Toast) Toast.warn('1회 최대 충전 금액은 500만원입니다.');
      return;
    }

    const confirmBtn = $('#btnCartChargeConfirm');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '결제 중...'; }

    try {
      const result = await requestWalletCharge(amount);

      // 성공 시 잔액 업데이트
      const balEl = $('#cart-festiopay-balance');
      if (balEl) balEl.textContent = formatKRW(result.newBalance);

      if (window.Toast) Toast.success(`✅ ${amount.toLocaleString()}원 충전 완료!\\n현재 잔액: ${result.newBalance.toLocaleString()}원`);

      const modal = $('#modal-charge');
      if (modal) modal.style.display = 'none';

    } catch (err) {
      if (window.Toast) Toast.error('❌ ' + (err.message || '충전에 실패했습니다.'));
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '충전하기'; }
    }
  });

  on($('#btn-cart-checkout'), 'click', async () => {
    if (_cartItems.length === 0) {
      Toast.warning('장바구니가 비어 있습니다.');
      return;
    }
    const totalGross = _cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (_selectedPayMethod === 'festiopay') {
      const balEl = $('#cart-festiopay-balance');
      let balance = parseInt(balEl ? balEl.textContent.replace(/[^0-9]/g, '') : 0);
      if (balance < totalGross) {
        Toast.warning('잔액이 부족합니다. 충전 후 다시 시도해주세요.');
        return;
      }
      Toast.success('FESTIO Pay로 결제되었습니다.');
      _cartItems = [];
      renderCart();
      return;
    }

    try {
      const tossPayments = TossPayments('test_ck_D5GePWvyJnrK0W0k6q8gLzN97Emo');
      const methodMap = { card: '카드', virtual: '가상계좌' };

      await tossPayments.requestPayment(methodMap[_selectedPayMethod] || '카드', {
        amount: totalGross,
        orderId: 'CART_' + Date.now(),
        orderName: _cartItems.length > 1 ? `${_cartItems[0].eventName} 외 ${_cartItems.length - 1}건` : _cartItems[0].eventName,
        customerName: '홍길동',
        successUrl: `${window.location.origin}/payment-success.html`,
        failUrl: `${window.location.origin}/payment-fail.html`,
      });
    } catch (err) {
      if (err.code !== 'USER_CANCEL') {
        Toast.error(`결제 오류: ${err.message}`);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCartData();
  initCartPayment();
});
