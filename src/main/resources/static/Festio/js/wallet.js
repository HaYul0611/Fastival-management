/* ═══════════════════════════════════════════════════════════
   FESTIO Pay (wallet) — 실제 PG 결제 충전 연동
   ═══════════════════════════════════════════════════════════ */

let _walletHistory     = [];
let _walletBalance     = 0;
let _walletFilter      = 'all';
let _walletInitialized = false;

/* ─ 잔액 카드 갱신 ──────────────────────────────────────── */
function renderWalletBalance(balance, userName) {
  _walletBalance = balance;
  const amountEl = document.getElementById('walletBalanceAmount');
  const headerEl = document.getElementById('walletBalanceHeader');
  const nameEl   = document.getElementById('walletUserName');
  if (amountEl) amountEl.textContent = balance.toLocaleString();
  if (headerEl) headerEl.textContent = `잔액 ${balance.toLocaleString()}원`;
  if (nameEl)   nameEl.textContent = userName || (typeof _member !== 'undefined' && _member && _member.name) || '-';
}

/* ─ 거래 내역 렌더링 ────────────────────────────────────── */
function renderWalletHistory() {
  const container = document.getElementById('walletHistoryList');
  if (!container) return;

  const filtered = _walletFilter === 'all'
    ? _walletHistory
    : _walletHistory.filter(h => h.type === _walletFilter);

  if (!filtered.length) {
    container.innerHTML = `
      <div class="mypage-empty" style="padding:40px 0;">
        <p class="mypage-empty-title">거래 내역이 없습니다</p>
        <p class="mypage-empty-desc">충전 또는 결제 내역이 발생하면 이곳에 표시됩니다.</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(h => `
    <div class="wallet-history-item">
      <div style="display:flex;align-items:center;flex:1;min-width:0;">
        <div class="wallet-history-icon ${h.type}">${h.type === 'charge' ? '💰' : '🎫'}</div>
        <div class="wallet-history-info">
          <div class="wallet-history-desc">${h.desc}</div>
          <div class="wallet-history-date">${h.date}</div>
        </div>
      </div>
      <div class="wallet-history-amount ${h.type}">
        ${h.amount > 0 ? '+' : ''}${h.amount.toLocaleString()}원
      </div>
    </div>
  `).join('');
}

/* ─ DB에서 실제 잔액 조회 ──────────────────────────────── */
async function loadWalletBalance() {
  const token = localStorage.getItem('userToken');
  if (!token) return;
  try {
    const res = await fetch('/api/wallet/balance', {
      headers: { 'Authorization': token }
    });
    if (res.ok) {
      const data = await res.json();
      renderWalletBalance(data.balance || 0, data.name);
    }
  } catch (e) {
    console.warn('잔액 조회 실패:', e);
  }
}

/* ─ 포트원 V1 결제 후 서버 검증 및 충전 ─────────────────── */
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
      pg:           'html5_inicis.INIpayTest',
      pay_method:   'card',
      merchant_uid: orderUid,
      name:         `FESTIO Pay 충전 ${amount.toLocaleString()}원`,
      amount:       amount,
      buyer_email:  (member && member.email) || '',
      buyer_name:   (member && member.name)  || '이용자',
      buyer_tel:    (member && member.phone) || '010-0000-0000',
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

/* ─ FESTIO Pay 탭 초기화 ────────────────────────────────── */
async function initWalletTab() {
  await loadWalletBalance();
  renderWalletHistory();

  // 빠른 충전 버튼 선택
  const quickGrid = document.getElementById('quickChargeGrid');
  if (quickGrid) {
    quickGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-charge-btn');
      if (!btn) return;
      quickGrid.querySelectorAll('.quick-charge-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const input = document.getElementById('walletChargeInput');
      if (input) input.value = btn.dataset.amount;
    });
  }

  // 충전 실행 함수
  const doCharge = async () => {
    const input  = document.getElementById('walletChargeInput');
    const amount = parseInt(input ? input.value : '0');

    if (!amount || amount < 1000) {
      if (window.Toast) Toast.warn('최소 1,000원 이상 입력해주세요.');
      return;
    }
    if (amount > 5000000) {
      if (window.Toast) Toast.warn('1회 최대 충전 금액은 500만원입니다.');
      return;
    }

    const confirmBtn = document.getElementById('btnWalletChargeConfirm');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '결제 중...'; }

    try {
      const result = await requestWalletCharge(amount);

      renderWalletBalance(result.newBalance);

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      _walletHistory.unshift({ type: 'charge', desc: '카드 충전', amount, date: dateStr });

      if (input) input.value = '';
      quickGrid?.querySelectorAll('.quick-charge-btn').forEach(b => b.classList.remove('selected'));

      renderWalletHistory();
      if (window.Toast) Toast.success(`✅ ${amount.toLocaleString()}원 충전 완료!\n현재 잔액: ${result.newBalance.toLocaleString()}원`);

    } catch (err) {
      if (window.Toast) Toast.error('❌ ' + (err.message || '충전에 실패했습니다.'));
      console.error('충전 오류:', err);
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '충전'; }
    }
  };

  document.getElementById('btnWalletChargeConfirm')?.addEventListener('click', doCharge);
  document.getElementById('btnWalletCharge')?.addEventListener('click', () => {
    document.getElementById('walletChargeInput')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('walletChargeInput')?.focus();
  });

  // 필터 버튼
  document.getElementById('walletFilterBtns')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.wallet-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.wallet-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _walletFilter = btn.dataset.filter;
    renderWalletHistory();
  });
}

// FESTIO Pay 탭 클릭 시 초기화 (한 번만)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tab="tab-wallet"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!_walletInitialized) {
        _walletInitialized = true;
        initWalletTab();
      }
    });
  });
});
