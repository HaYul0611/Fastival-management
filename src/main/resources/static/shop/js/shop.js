'use strict';
/* ================================================================
   FESTIO SHOP — shop.js
   목데이터 · 필터링 · 카드 렌더링 · 찜
   ================================================================ */

/* ── 데이터 상태 ────────────────────────────────────────────── */
let STORES = [];
let ALL_PRODUCTS = [];

window.FS_PRODUCTS = ALL_PRODUCTS;

function getShopPlaceholder(cat) {
  let color = '#ccc';
  let icon = '<circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 30 L50 20 M50 70 L50 80 M30 50 L20 50 M70 50 L80 50" stroke="currentColor" stroke-width="4"/>';
  if (cat === 'food') {
    color = '#ff9800';
    icon = '<path d="M35 60 A15 15 0 0 1 65 60 Z" fill="currentColor"/><path d="M40 45 Q50 30 60 45" fill="none" stroke="currentColor" stroke-width="4"/>';
  } else if (cat === 'collab') {
    color = '#9c27b0';
    icon = '<polygon points="50,30 60,70 30,45 70,45 40,70" fill="currentColor"/>';
  } else {
    color = '#4caf50';
    icon = '<rect x="35" y="35" width="30" height="30" rx="4" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="50" r="5" fill="currentColor"/>';
  }
  return `<svg viewBox="0 0 100 100" width="40%" height="40%" style="color:${color}; opacity:0.5; max-width:64px;">${icon}</svg>`;
}

/* ── 상태 ───────────────────────────────────────────────────── */
const S = {
  cat: 'all', sort: 'popular', q: '',
  wish: JSON.parse(localStorage.getItem('fs_wish') || '[]'),
  selectedStoreId: null,
  currentPage: 1,
  itemsPerPage: 16
};

/* ── 필터 ───────────────────────────────────────────────────── */

/**
 * @description 현재 선택된 필터(카테고리, 검색어, 상점)와 정렬 방식에 따라 목록을 필터링 및 정렬하여 반환합니다.
 * @returns {Array} 필터링 및 정렬된 상품 또는 상점 데이터 배열
 */
function filtered() {
  let list = [];
  if (!S.selectedStoreId) {
    list = [...STORES];
  } else {
    list = ALL_PRODUCTS.filter(p => p.storeId === S.selectedStoreId);
  }

  if (S.cat !== 'all') list = list.filter(p => p.cat === S.cat);
  if (S.q) { const q = S.q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) }

  if (S.selectedStoreId) {
    if (S.sort === 'newest') list.sort((a, b) => b.id - a.id);
    else if (S.sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (S.sort === 'price_desc') list.sort((a, b) => b.price - a.price);
  }
  return list;
}

/* ── SVG 플레이스홀더 ────────────────────────────────────────── */
function placeholder(cat) {
  const cfg = {
    food: {
      color: '#FF6B00', bg: '#FF6B00',
      path: `<path d="M20 60h60M25 44h50l-5-24H30L25 44z" stroke="#FF6B00" stroke-width="3" stroke-linejoin="round"/>
            <path d="M38 38V24M50 38V24M62 38V24" stroke="#FF6B00" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="50" cy="68" r="6" stroke="#FF6B00" stroke-width="2.5"/>`},
    goods: {
      color: '#FF2D55', bg: '#FF2D55',
      path: `<rect x="22" y="32" width="56" height="46" rx="6" stroke="#FF2D55" stroke-width="3"/>
            <path d="M34 32V25a16 16 0 0 1 32 0v7" stroke="#FF2D55" stroke-width="3" stroke-linecap="round"/>
            <path d="M38 55h24M50 43v24" stroke="#FF2D55" stroke-width="2.5" stroke-linecap="round"/>`},
    collab: {
      color: '#7B2FFF', bg: '#7B2FFF',
      path: `<path d="M50 18l7 21H79L63 52l6 21-19-12-19 12 6-21-16-13h22L50 18z" stroke="#7B2FFF" stroke-width="3" stroke-linejoin="round"/>`
    },
  };
  const c = cfg[cat] || cfg.goods;
  return `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true">${c.path}</svg>`;
}

/* ================================================================
   UI 컴포넌트 (UI Components)
   ================================================================ */

/**
 * @description 단일 상품 또는 상점 객체를 받아 HTML 카드 요소 문자열을 생성합니다.
 * @param {Object} p - 렌더링할 상품/상점 객체
 * @returns {string} 카드 UI HTML 문자열
 */
function cardHTML(p) {
  const sold = p.stock === 0;
  const low = !sold && p.stock > 0 && p.stock <= 5;
  const wished = S.wish.includes(p.id);
  const dotCls = { food: 'dot-food', goods: 'dot-goods', collab: 'dot-collab' }[p.cat] || 'dot-goods';
  const bgCls = { food: 'cat-food', goods: 'cat-goods', collab: 'cat-collab' }[p.cat] || '';

  /* 배지 */
  const badges = [];
  if (!sold && p.cat === 'food' && p.wait > 0) badges.push(`<span class="badge badge-wait">대기 ${p.wait}분</span>`);
  if (low) badges.push(`<span class="badge badge-low">잔여 ${p.stock}개</span>`);
  if (p.id <= 3 && !sold) badges.push(`<span class="badge badge-new">NEW</span>`);

  /* 재고 뱃지 */
  let stock = '';
  if (sold) stock = `<span class="badge badge-sold">품절</span>`;
  else if (low) stock = `<span class="badge badge-low">잔여 ${p.stock}개</span>`;
  else if (p.cat === 'food' && p.wait > 0) stock = `<span class="badge badge-wait">대기 ${p.wait}분</span>`;
  else stock = `<span class="badge badge-ok">구매 가능</span>`;

  return `
<article class="pcard${sold ? ' sold' : ''}" data-id="${p.id}" tabindex="${sold ? -1 : 0}"
  role="article" aria-label="${p.name}${sold ? ', 품절' : ''}">

  <div class="pcard-img-area ${bgCls}">
    ${badges.length ? `<div class="pcard-badges">${badges.join('')}</div>` : ''}

    ${!p.isStoreCard ? `
    <button class="pcard-wish${wished ? ' on' : ''}" data-id="${p.id}"
      aria-label="${wished ? '찜 해제' : '찜하기'}" aria-pressed="${wished}">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 14S2 10.2 2 5.8A3.6 3.6 0 0 1 8 3.6 3.6 3.6 0 0 1 14 5.8C14 10.2 8 14 8 14z"
          stroke="${wished ? '#FF2D55' : '#A8A8A8'}" fill="${wished ? '#FF2D55' : 'none'}"
          stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>
    ` : ''}

    ${(function () {
      const strId = String(p.id || p.name || '').replace('store_', '');
      let pid = parseInt(strId, 10);
      if (isNaN(pid)) {
        let hash = 0;
        for (let i = 0; i < strId.length; i++) hash = strId.charCodeAt(i) + ((hash << 5) - hash);
        pid = Math.abs(hash) || 1;
      }
      let mockImg = '';

      if (p.cat === 'food') {
        if (p.isStoreCard) {
          const validIndices = [9, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49];
          const storeImgs = validIndices.map(i => `/shop/img/stores/food/gen_${i}.jpg`);
          mockImg = storeImgs[pid % storeImgs.length];
        } else {
          const foodImgs = [
            'https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg',
            'https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg',
            'https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg',
            'https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg',
            'https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg',
            'https://www.themealdb.com/images/media/meals/m0p0j81765568742.jpg',
            'https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg',
            'https://www.themealdb.com/images/media/meals/wrssvt1511556563.jpg',
            'https://www.themealdb.com/images/media/meals/pkopc31683207947.jpg',
            'https://www.themealdb.com/images/media/meals/z0ageb1583189517.jpg',
            'https://www.themealdb.com/images/media/meals/vtqxtu1511784197.jpg',
            'https://www.themealdb.com/images/media/meals/ursuup1487348423.jpg',
            'https://www.themealdb.com/images/media/meals/41cxjh1683207682.jpg',
            'https://www.themealdb.com/images/media/meals/uyqrrv1511553350.jpg',
            'https://www.themealdb.com/images/media/meals/dxpc7j1764370714.jpg',
            'https://www.themealdb.com/images/media/meals/1529444830.jpg',
            'https://www.themealdb.com/images/media/meals/t2b8bn1779737789.jpg',
            'https://www.themealdb.com/images/media/meals/1nalo51765188375.jpg',
            'https://www.themealdb.com/images/media/meals/cgl60b1683206581.jpg',
            'https://www.themealdb.com/images/media/meals/pbzcrx1763765096.jpg',
            'https://www.themealdb.com/images/media/meals/vdwloy1713225718.jpg',
            'https://www.themealdb.com/images/media/meals/020z181619788503.jpg',
            'https://www.themealdb.com/images/media/meals/9ya6o71780262651.jpg',
            'https://www.themealdb.com/images/media/meals/sypxpx1515365095.jpg',
            'https://www.themealdb.com/images/media/meals/sbx7n71587673021.jpg',
            'https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg',
            'https://www.themealdb.com/images/media/meals/uuuspp1511297945.jpg',
            'https://www.themealdb.com/images/media/meals/syqypv1486981727.jpg',
            'https://www.themealdb.com/images/media/meals/wruvqv1511880994.jpg',
            'https://www.themealdb.com/images/media/meals/1529446352.jpg',
            'https://www.themealdb.com/images/media/meals/qxytrx1511304021.jpg',
            'https://www.themealdb.com/images/media/meals/qtuwxu1468233098.jpg',
            'https://www.themealdb.com/images/media/meals/qrqywr1503066605.jpg',
            'https://www.themealdb.com/images/media/meals/wuyd2h1765655837.jpg',
            'https://www.themealdb.com/images/media/meals/xrrtss1511555269.jpg',
            'https://www.themealdb.com/images/media/meals/wyxwsp1486979827.jpg',
            'https://www.themealdb.com/images/media/meals/tyywsw1505930373.jpg',
            'https://www.themealdb.com/images/media/meals/hob03q1780264260.jpg',
            'https://www.themealdb.com/images/media/meals/er4d081765186828.jpg',
            'https://www.themealdb.com/images/media/meals/qpxvuq1511798906.jpg'
          ];
          mockImg = foodImgs[pid % foodImgs.length];
        }
      } else {
        if (p.isStoreCard) {
          const goodsStoreImgs = [
            '/shop/img/stores/goods/gen_0.png',
            '/shop/img/stores/goods/gen_1.png',
            '/shop/img/stores/goods/gen_2.png',
            '/shop/img/stores/goods/gen_3.png',
            '/shop/img/stores/goods/gen_4.png',
            '/shop/img/stores/goods/gen_5.png',
            '/shop/img/stores/goods/gen_6.png',
            '/shop/img/stores/goods/gen_7.png',
            '/shop/img/stores/goods/gen_8.png',
            '/shop/img/stores/goods/gen_9.png'
          ];
          mockImg = goodsStoreImgs[pid % goodsStoreImgs.length];
        } else {
          const goodsImgs = [
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ATZ_14TH_PC.jpg',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ADB_VC_PC.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/HTW_3RD_PC.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/QWER_PC_0527.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/hzwav_pc.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/evven_pc.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ald1ols_pc.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/A2B_PC.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/HTW_PC.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/XIKERS_7TH_PC_F.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/WOODZ_2ND_PC.jpg',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/QWER_PC.jpg',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/H2H_260317_PC.jpg',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/LJS_NEW_PC.jpg',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/MIYEON_LD4_PC.png',
            'https://dokidokigoods.co.kr/web/product/medium/202606/bffa43558cb7e84a3361e4a75b786a3d.png',
            'https://dokidokigoods.co.kr/web/product/medium/202606/9bae5a6662d312f1af7df7dc1b87c811.png',
            'https://dokidokigoods.co.kr/web/product/medium/202606/d8f3fe91bf40ca88c82735dfba2553eb.png',
            'https://dokidokigoods.co.kr/web/product/medium/202606/90962947887dcc67632c06a2e1c9bfc3.png',
            'https://dokidokigoods.co.kr/web/product/medium/202606/1de798c15be2ac32aaf84d8bba71294a.png',
            'https://dokidokigoods.co.kr/web/product/medium/202606/a677f69c9ac28fa7068e5894c3ef93d8.png',
            'https://dokidokigoods.co.kr/web/product/medium/202404/288d18d67410c1f248e0e2764a9297f1.jpg',
            'https://dokidokigoods.co.kr/web/product/big/202606/50bc807823ee1081cdfbeaff7abbd7f8.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/d5fcbc07c5112d5bd2c1b911b684f3ae.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/8554744a9f66f780be4fdb09a0cf2fd8.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/ccbd726fa9fc5fbe93052125b7073244.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/d9014728ae5cbd5cacb2ffa1a965819b.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/ac6b65b316e5222683771ec6f8ac7c25.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/061a8af2169e5203772d34b94729680f.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/70bcd81b4414ffd901a5d844c6fb4e7c.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/1e21d49da08367eb8396ec8f537dbefa.png',
            'https://dokidokigoods.co.kr/web/product/big/202606/89eda58119cfa62779fa639da8bbfe04.png'
          ];
          mockImg = goodsImgs[pid % goodsImgs.length];
        }
      }

      const phSvg = getShopPlaceholder(p.cat);
      const fallbackHtml = `<div class="pcard-placeholder" style="display:none; width:100%; height:100%; align-items:center; justify-content:center; background:#f8f9fa;">${phSvg}</div>`;

      return p.imageUrl
        ? `<img src="${p.imageUrl}" alt="${p.name}" class="pcard-img" onerror="if(this.src !== '${mockImg}') { this.src='${mockImg}'; } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }">${fallbackHtml}`
        : `<img src="${mockImg}" alt="${p.name}" class="pcard-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">${fallbackHtml}`;
    })()}

    ${sold ? `<div class="sold-cover" aria-hidden="true"><span class="sold-label">SOLD OUT</span></div>` : ''}
  </div>

  <div class="pcard-body">
    <div class="pcard-brand">
      <span class="pcard-brand-dot ${dotCls}"></span>${p.brand}
    </div>
    <h3 class="pcard-name">${p.name}</h3>
    <div class="pcard-foot">
      <div class="pcard-price">
        ${p.isStoreCard
      ? `<span class="pcard-price-num" style="font-size:14px;color:var(--g500);">상점 보기</span>`
      : (p.isStorePlaceholder
        ? `<span class="pcard-price-num" style="font-size:13px;color:var(--g400);">상품 준비 중</span>`
        : `<span class="pcard-price-num">${p.price.toLocaleString()}</span><span class="pcard-price-unit">원</span>`)
    }
      </div>
      <div class="pcard-meta">${stock}</div>
    </div>
  </div>

</article>`;
}

/* ── 렌더 ───────────────────────────────────────────────────── */
/* ================================================================
   UI 렌더링 (UI Rendering)
   ================================================================ */

/**
 * @description 상태 객체(S)를 기준으로 필터링된 상품 목록과 화면 UI를 다시 렌더링합니다.
 */
function render() {
  const grid = document.getElementById('prodGrid');
  const empty = document.getElementById('gridEmpty');
  const cnt = document.getElementById('gridCount');
  const sr = document.getElementById('srMsg');
  const list = filtered();
  if (cnt) cnt.textContent = !S.selectedStoreId ? `총 ${list.length}개 상점` : `총 ${list.length}개 상품`;
  if (!grid || !empty) return;
  if (!list.length) { grid.innerHTML = ''; empty.style.display = 'flex'; return }
  empty.style.display = 'none';

  let html = '';
  if (S.selectedStoreId) {
    const store = STORES.find(s => s.storeId === S.selectedStoreId);
    html += `
      <div style="grid-column: 1/-1; margin-bottom: 15px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px;">
        <button class="btn btn-outline-primary" style="border-radius: 20px; padding: 6px 16px; font-weight: 600;" onclick="window.FS_goBackToStores()">← 상점 목록으로 돌아가기</button>
        <h4 style="margin-top: 5px; font-weight: 800;">${store ? store.name : ''}의 상품</h4>
      </div>
    `;
  }

  // 데스크톱일 경우 페이지네이션 적용
  let renderList = list;
  let totalPages = 1;
  const isDesktop = window.innerWidth > 768;

  if (isDesktop) {
    totalPages = Math.ceil(list.length / S.itemsPerPage);
    if (S.currentPage > totalPages && totalPages > 0) S.currentPage = totalPages;
    const startIdx = (S.currentPage - 1) * S.itemsPerPage;
    renderList = list.slice(startIdx, startIdx + S.itemsPerPage);
  }

  grid.innerHTML = html + renderList.map(cardHTML).join('');
  if (sr) sr.textContent = `${list.length}개 항목 표시됨`;
  bindCards();

  renderPagination(totalPages, isDesktop);
}

/**
 * @description 하단 페이지네이션 숫자 버튼 및 이전/다음 이동 버튼을 렌더링합니다.
 * @param {number} totalPages - 계산된 전체 페이지 개수
 * @param {boolean} isDesktop - 데스크톱 모드 여부
 */
function renderPagination(totalPages, isDesktop) {
  let wrapper = document.getElementById('shopPaginationWrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'shopPaginationWrapper';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.position = 'relative';
    wrapper.style.marginTop = '40px';
    wrapper.style.marginBottom = '20px';
    document.getElementById('prodGrid').parentNode.appendChild(wrapper);
  }

  if (!isDesktop) {
    wrapper.innerHTML = '';
    return;
  }

  // Prev Button
  const prevDisabled = S.currentPage === 1 ? 'disabled' : '';
  let html = `
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button class="btn btn-outline-primary page-btn" ${prevDisabled} onclick="window.FS_goToPage(${S.currentPage - 1})">
        &lt;
      </button>
  `;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="btn ${i === S.currentPage ? 'btn-primary' : 'btn-outline-primary'} page-btn" onclick="window.FS_goToPage(${i})">${i}</button>`;
  }

  // Next Button
  const nextDisabled = S.currentPage === totalPages ? 'disabled' : '';
  html += `
      <button class="btn btn-outline-primary page-btn" ${nextDisabled} onclick="window.FS_goToPage(${S.currentPage + 1})">
        &gt;
      </button>
    </div>
    
    <div style="position: absolute; right: 0;">
      <select class="form-select page-size-select" onchange="window.FS_changePerPage(this.value)">
        <option value="16" ${S.itemsPerPage === 16 ? 'selected' : ''}>16개씩 보기</option>
        <option value="32" ${S.itemsPerPage === 32 ? 'selected' : ''}>32개씩 보기</option>
        <option value="48" ${S.itemsPerPage === 48 ? 'selected' : ''}>48개씩 보기</option>
      </select>
    </div>
  `;

  wrapper.innerHTML = html;
  if (window.FS_convertSelectToCustom) window.FS_convertSelectToCustom();
}

/* ================================================================
   전역 상태 및 이벤트 핸들러 (Event Handlers)
   ================================================================ */

/**
 * @description 지정된 페이지 번호로 이동하고 화면을 맨 위로 올립니다.
 * @param {number} page - 이동할 페이지 숫자
 */
window.FS_goToPage = function (page) {
  S.currentPage = page;
  render();
  const filterBar = document.querySelector('.filter-bar');
  if (filterBar) {
    const y = filterBar.getBoundingClientRect().top + window.scrollY - 64; // 64 is the sticky header height
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.FS_changePerPage = function (size) {
  S.itemsPerPage = parseInt(size, 10);
  S.currentPage = 1;
  render();
  const filterBar = document.querySelector('.filter-bar');
  if (filterBar) {
    const y = filterBar.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.FS_goBackToStores = function () {
  S.selectedStoreId = null;
  S.currentPage = 1;
  render();
};

/**
 * @description 렌더링된 각 카드(.pcard) 요소에 상품 상세페이지 이동 또는 찜 이벤트 리스너를 바인딩합니다.
 */
function bindCards() {
  document.querySelectorAll('.pcard:not(.sold)').forEach(c => {
    c.addEventListener('click', e => {
      if (e.target.closest('.pcard-wish')) return;
      const id = c.dataset.id;
      if (id && id.toString().startsWith('store_')) {
        const sId = parseInt(id.replace('store_', ''), 10);
        S.selectedStoreId = sId;
        render();
      } else {
        goto(id);
      }
    });
    c.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.pcard-wish')) {
        e.preventDefault();
        const id = c.dataset.id;
        if (id && id.toString().startsWith('store_')) {
          const sId = parseInt(id.replace('store_', ''), 10);
          S.selectedStoreId = sId;
          render();
        } else {
          goto(id);
        }
      }
    });
  });
  document.querySelectorAll('.pcard-wish').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); toggleWish(parseInt(b.dataset.id)) });
  });
}

function goto(id) { window.location.href = `shop-detail.html?id=${id}` }

/* ── 찜 ─────────────────────────────────────────────────────── */
/**
 * @description 상품 찜하기 토글 로직. 로컬 스토리지 및 UI를 업데이트합니다.
 * @param {number|string} id - 상품 ID
 */
function toggleWish(id) {
  const i = S.wish.indexOf(id);
  if (i === -1) { S.wish.push(id); window.FS.Toast.show({ title: '찜 목록에 추가했어요', type: 'success', dur: 2000 }) }
  else { S.wish.splice(i, 1); window.FS.Toast.show({ title: '찜 목록에서 제거했어요', type: 'info', dur: 2000 }) }
  localStorage.setItem('fs_wish', JSON.stringify(S.wish));
  /* 해당 카드만 아이콘 교체 */
  document.querySelectorAll(`.pcard-wish[data-id="${id}"]`).forEach(b => {
    const on = S.wish.includes(id);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-label', on ? '찜 해제' : '찜하기');
    const path = b.querySelector('path');
    if (path) { path.setAttribute('stroke', on ? '#FF2D55' : '#A8A8A8'); path.setAttribute('fill', on ? '#FF2D55' : 'none') }
  });
}

/* ── 이벤트 ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  window.FS.renderHeader();
  window.FS.startMockAlerts();

  /* ====================
     이벤트 바인딩 (캐시 return 전 등록)
     ==================== */
  /* 카테고리 탭 (cat-strip) */
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      S.cat = b.dataset.cat;
      S.selectedStoreId = null; // 카테고리 탭을 누르면 상점 목록으로 이동
      S.currentPage = 1;
      /* 필터 태그도 동기화 */
      document.querySelectorAll('.ftag').forEach(x => {
        x.classList.toggle('on', x.dataset.cat === S.cat);
      });
      render();
    });
  });

  /* 필터 태그 */
  document.querySelectorAll('.ftag').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.ftag').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      S.cat = b.dataset.cat;
      S.selectedStoreId = null; // 필터 탭을 누르면 상점 목록으로 이동
      S.currentPage = 1;
      document.querySelectorAll('.cat-btn').forEach(x => {
        x.classList.toggle('on', x.dataset.cat === S.cat);
      });
      render();
    });
  });

  /* 정렬 */
  const sortSel = document.getElementById('sortSel');
  if (sortSel) sortSel.addEventListener('change', e => { S.sort = e.target.value; render() });

  /* 검색 */
  document.addEventListener('shop:search', e => { S.q = e.detail.q; render() });

  if (window.FS_convertSelectToCustom) window.FS_convertSelectToCustom();

  /* URL 파라미터로 카테고리 초기화 */
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get('category');
  let festivalId = params.get('festivalId') || params.get('eventNo') || sessionStorage.getItem('currentFestivalId');
  if (festivalId) {
    sessionStorage.setItem('currentFestivalId', festivalId);
  }

  // festivalId가 있는 경우 — 해당 축제의 모든 입점 업체를 보여주기 위해 'all' 필터로 설정
  // festivalId 없이 category만 있는 경우 — category 필터 적용
  if (festivalId && (params.get('festivalId') || params.get('eventNo'))) {
    S.cat = 'all';
    document.querySelectorAll('.cat-btn').forEach(x => {
      x.classList.toggle('on', x.dataset.cat === 'all');
    });
    document.querySelectorAll('.ftag').forEach(x => {
      x.classList.toggle('on', x.dataset.cat === 'all');
    });
  } else if (catParam) {
    S.cat = catParam;
    document.querySelectorAll('.cat-btn').forEach(x => {
      x.classList.toggle('on', x.dataset.cat === S.cat);
    });
    document.querySelectorAll('.ftag').forEach(x => {
      x.classList.toggle('on', x.dataset.cat === S.cat);
    });
  }

  // 로딩 인디케이터 렌더링
  const grid = document.getElementById('prodGrid');
  if (grid) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--g500); padding: 60px 0; font-size: 15px; font-weight: 600;">입점 상점 및 상품 목록을 불러오는 중...</div>';
  }

  // 캐싱된 데이터 확인 (shop-detail 등 진입 시 속도 개선)
  const cachedProducts = sessionStorage.getItem('fs_cached_products_v3');
  const cachedStores = sessionStorage.getItem('fs_cached_stores_v3');
  if (cachedProducts && cachedStores && sessionStorage.getItem('fs_cached_fid_v3') === String(festivalId)) {
    try {
      ALL_PRODUCTS = JSON.parse(cachedProducts);
      STORES = JSON.parse(cachedStores);
      window.FS_PRODUCTS = ALL_PRODUCTS;

      const statStore = document.getElementById('stat-store-cnt');
      const statProduct = document.getElementById('stat-product-cnt');
      const statFood = document.getElementById('stat-food-cnt');
      if (statStore) statStore.textContent = STORES.length;
      if (statProduct) statProduct.textContent = ALL_PRODUCTS.length;
      if (statFood) statFood.textContent = STORES.filter(s => s.cat === 'food').length;

      render();
      return;
    } catch (e) {
      console.error('Cache parsing error:', e);
    }
  }

  // 1. Fetch Supabase products
  const sb = window.ShopDB.getClient();
  const pSupabase = sb ? sb.from('shop_products').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null });

  // 1-1. Fetch Store Settings for Hybrid Wait Time
  const pStoreSettings = sb ? sb.from('shop_store_settings').select('*').then(res => res).catch(() => ({ data: null, error: 'Table missing' })) : Promise.resolve({ data: null, error: null });

  // 2. Fetch API stores (mock data)
  let fetchUrl = '/api/stores';
  if (festivalId) fetchUrl += `?festivalId=${festivalId}`;

  const pApiStores = fetch(fetchUrl)
    .then(res => res.ok ? res.json() : [])
    .catch(() => []);

  Promise.all([pSupabase, pStoreSettings, pApiStores])
    .then(async ([supabaseRes, settingsRes, apiStores]) => {
      const { data: supaProducts, error } = supabaseRes;
      if (error) console.error('[Shop] Supabase fetch error:', error);

      const storeSettingsMap = new Map();
      if (settingsRes && settingsRes.data) {
        settingsRes.data.forEach(s => storeSettingsMap.set(s.store_name, s));
      }

      STORES = [];
      ALL_PRODUCTS = [];

      // ============================================
      // 1. Process Supabase data
      // ============================================
      const storeMap = new Map();
      const foodTruckImages = [
        '/assets/img/stores/간식차.jpg', '/assets/img/stores/꼬치트럭.jpg', '/assets/img/stores/떡볶이.jpg',
        '/assets/img/stores/반려견 푸드.jpg', '/assets/img/stores/부스1.jpg', '/assets/img/stores/분식점.jpg',
        '/assets/img/stores/빙수차.png', '/assets/img/stores/식음료차.jpg', '/assets/img/stores/원할머니.jpg',
        '/assets/img/stores/음료 차.jpg', '/assets/img/stores/잇츠 월드.png', '/assets/img/stores/치킨트럭.jpeg',
        '/assets/img/stores/카페차.png', '/assets/img/stores/커피차.jpg', '/assets/img/stores/타코야끼.jpg',
        '/assets/img/stores/한국의 집.jpg', '/assets/img/stores/핫도그차.jpg', '/assets/img/stores/햄버거 차.jpg'
      ];
      const goodsImgs = [
        '/shop/img/stores/goods/gen_0.png', '/shop/img/stores/goods/gen_1.png', '/shop/img/stores/goods/gen_2.png',
        '/shop/img/stores/goods/gen_3.png', '/shop/img/stores/goods/gen_4.png'
      ];

      // 간단한 문자열 해시 함수 (UUID를 숫자로 변환)
      const hashCode = (s) => Math.abs(s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0));

      if (supaProducts && supaProducts.length > 0) {
        supaProducts.forEach(p => {
          let catMapped = p.type === 'FOOD' ? 'food' : 'goods';
          if (p.name && (p.name.includes('버거') || p.name.includes('감자') || p.name.includes('치즈') || p.name.includes('메뉴'))) {
            catMapped = 'food';
          }
          const storeName = p.store_name || (catMapped === 'food' ? '푸드트럭' : 'FESTIO MD');
          if (!storeMap.has(storeName)) {
            storeMap.set(storeName, { id: p.id, name: storeName, type: p.type, catMapped: catMapped });
          }
        });

        storeMap.forEach((storeObj, storeName) => {
          const catMapped = storeObj.catMapped;
          let finalImg = '';
          if (catMapped === 'food') {
            // 키워드 기반 스마트 이미지 매칭
            if (storeName.includes('반려견') || storeName.includes('개') || storeName.includes('아미오')) {
              finalImg = '/assets/img/stores/반려견 푸드.jpg';
            } else if (storeName.includes('버거')) {
              finalImg = '/assets/img/stores/햄버거 차.jpg';
            } else if (storeName.includes('치킨') || storeName.includes('닭')) {
              finalImg = '/assets/img/stores/치킨트럭.jpeg';
            } else if (storeName.includes('떡볶이') || storeName.includes('분식')) {
              finalImg = '/assets/img/stores/떡볶이.jpg';
            } else if (storeName.includes('커피') || storeName.includes('카페') || storeName.includes('음료') || storeName.includes('에이드') || storeName.includes('칵테일')) {
              finalImg = '/assets/img/stores/커피차.jpg';
            } else if (storeName.includes('꼬치')) {
              finalImg = '/assets/img/stores/꼬치트럭.jpg';
            } else if (storeName.includes('핫도그')) {
              finalImg = '/assets/img/stores/핫도그차.jpg';
            } else if (storeName.includes('타코야끼')) {
              finalImg = '/assets/img/stores/타코야끼.jpg';
            } else if (storeName.includes('빙수')) {
              finalImg = '/assets/img/stores/빙수차.png';
            } else {
              // 안전한 기본 푸드트럭 이미지들 (반려견 제외)
              const safeFoodImgs = [
                '/assets/img/stores/간식차.jpg', '/assets/img/stores/부스1.jpg', '/assets/img/stores/식음료차.jpg',
                '/assets/img/stores/원할머니.jpg', '/assets/img/stores/잇츠 월드.png', '/assets/img/stores/한국의 집.jpg'
              ];
              finalImg = safeFoodImgs[hashCode(storeName) % safeFoodImgs.length];
            }
          } else {
            finalImg = goodsImgs[hashCode(storeName) % goodsImgs.length];
          }

          let waitTime = null;
          if (catMapped === 'food') {
            const setting = storeSettingsMap.get(storeName);
            if (setting && setting.is_manual_active && setting.manual_wait_time !== null) {
              waitTime = setting.manual_wait_time; // B안 (수동)
            } else {
              waitTime = 5 + (hashCode(storeObj.id.toString()) % 6) * 5; // A안 (자동 임시)
            }
          }

          STORES.push({
            id: `store_${storeObj.id}`,
            storeId: storeObj.id,
            cat: catMapped,
            brand: catMapped === 'food' ? '푸드트럭' : 'MD 스토어',
            name: storeName,
            price: 0,
            stock: 999,
            wait: waitTime,
            opts: [],
            imageUrl: finalImg,
            isStoreCard: true
          });
        });

        const supabaseAllProducts = supaProducts.map(p => {
          let catMapped = p.type === 'FOOD' ? 'food' : 'goods';
          if (p.name && (p.name.includes('버거') || p.name.includes('감자') || p.name.includes('치즈') || p.name.includes('메뉴'))) {
            catMapped = 'food';
          }
          const storeName = p.store_name || (catMapped === 'food' ? '푸드트럭' : 'FESTIO MD');
          const parentStore = storeMap.get(storeName);
          let waitTime = null;
          if (catMapped === 'food') {
            const setting = storeSettingsMap.get(parentStore ? parentStore.name : p.store_name);
            if (setting && setting.is_manual_active && setting.manual_wait_time !== null) {
              waitTime = setting.manual_wait_time; // B안 (수동)
            } else {
              waitTime = 5 + (hashCode(parentStore ? parentStore.id.toString() : p.id.toString()) % 6) * 5; // A안 (자동 임시)
            }
          }

          let imgUrl = p.image_url || null;
          if (imgUrl && (imgUrl.includes('/Festio/images/') || imgUrl.includes('goods_vinyl') || imgUrl.includes('/assets/img/products/'))) {
            const numId = hashCode(p.id.toString());
            if (catMapped === 'food') {
              const foodImgs = [
                'https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg',
                'https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg',
                'https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg',
                'https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg',
                'https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg',
                'https://www.themealdb.com/images/media/meals/m0p0j81765568742.jpg',
                'https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg',
                'https://www.themealdb.com/images/media/meals/wrssvt1511556563.jpg'
              ];
              imgUrl = foodImgs[numId % foodImgs.length];
            } else {
              const fallbackGoods = [
                'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ATZ_14TH_PC.jpg',
                'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ADB_VC_PC.png',
                'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/HTW_3RD_PC.png',
                'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/QWER_PC_0527.png',
                'https://dokidokigoods.co.kr/web/product/medium/202606/bffa43558cb7e84a3361e4a75b786a3d.png',
                'https://dokidokigoods.co.kr/web/product/medium/202606/9bae5a6662d312f1af7df7dc1b87c811.png'
              ];
              imgUrl = fallbackGoods[numId % fallbackGoods.length];
            }
          }

          return {
            id: p.id,
            storeId: parentStore ? parentStore.id : p.id,
            cat: catMapped,
            brand: p.store_name || (catMapped === 'food' ? '푸드트럭' : 'MD 스토어'),
            name: p.name,
            price: p.price || 0,
            stock: p.stock_quantity !== undefined ? p.stock_quantity : 999,
            wait: waitTime,
            opts: [],
            imageUrl: imgUrl
          };
        });
        ALL_PRODUCTS = ALL_PRODUCTS.concat(supabaseAllProducts);
      }

      // ============================================
      // 2. Process API (Mock) data
      // ============================================
      if (apiStores && apiStores.length > 0) {
        const productPromises = apiStores.map(store => {
          let storeCatMapped = 'goods';
          const storeCat = (store.category || '').toLowerCase();
          if (storeCat === 'food' || storeCat === 'drink') storeCatMapped = 'food';
          else if (storeCat === 'collab') storeCatMapped = 'collab';

          let wait = null;
          if (storeCatMapped === 'food') {
            const waitMatch = (store.notice || '').match(/(\d+)분/);
            wait = waitMatch ? parseInt(waitMatch[1], 10) : (5 + ((store.id || 0) % 6) * 5);
          }

          let finalStoreImg = store.imageUrl || store.image_url || null;
          if (storeCatMapped === 'food') {
            finalStoreImg = foodTruckImages[(store.id || 0) % foodTruckImages.length];
          } else {
            // goods/collab fallback to prevent 404
            finalStoreImg = goodsImgs[(store.id || 0) % goodsImgs.length];
          }

          STORES.push({
            id: `store_${store.id}`,
            storeId: store.id,
            cat: storeCatMapped,
            brand: storeCatMapped === 'food' ? '푸드트럭' : 'MD 스토어',
            name: store.name,
            price: 0,
            stock: 999,
            wait: wait,
            opts: [],
            imageUrl: finalStoreImg,
            isStoreCard: true
          });

          return fetch(`/api/stores/${store.id}/products`)
            .then(res => res.ok ? res.json() : [])
            .then(products => {
              if (products.length > 0) {
                return products.map((p, i) => {
                  let opts = [];
                  if (p.optionGroupsJson) {
                    try { opts = JSON.parse(p.optionGroupsJson); } catch (e) { opts = []; }
                  }

                  let imgUrl = p.imageUrl || p.image_url || null;
                  if (imgUrl && (imgUrl.includes('/Festio/images/') || imgUrl.includes('goods_vinyl') || imgUrl.includes('/assets/img/products/'))) {
                    let strId = String(p.id || p.productName || p.name || '');
                    let numId = hashCode(strId) || 1;
                    if (storeCatMapped === 'food' || strId.includes('버거') || strId.includes('감자') || strId.includes('치즈') || strId.includes('메뉴')) {
                      const foodImgs = [
                        'https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg',
                        'https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg',
                        'https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg',
                        'https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg',
                        'https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg',
                        'https://www.themealdb.com/images/media/meals/m0p0j81765568742.jpg',
                        'https://www.themealdb.com/images/media/meals/sytuqu1511553755.jpg',
                        'https://www.themealdb.com/images/media/meals/wrssvt1511556563.jpg'
                      ];
                      imgUrl = foodImgs[numId % foodImgs.length];
                    } else {
                      const fallbackGoods = [
                        'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ATZ_14TH_PC.jpg',
                        'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ADB_VC_PC.png',
                        'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/HTW_3RD_PC.png',
                        'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/QWER_PC_0527.png',
                        'https://dokidokigoods.co.kr/web/product/medium/202606/bffa43558cb7e84a3361e4a75b786a3d.png',
                        'https://dokidokigoods.co.kr/web/product/medium/202606/9bae5a6662d312f1af7df7dc1b87c811.png'
                      ];
                      imgUrl = fallbackGoods[numId % fallbackGoods.length];
                    }
                  }

                  return {
                    id: p.id || `mock_${store.id}_${i}`,
                    storeId: store.id,
                    cat: storeCatMapped,
                    brand: store.name,
                    name: p.productName || p.name,
                    price: p.price || 0,
                    stock: p.availableStock !== undefined ? p.availableStock : (p.currentStock || 0),
                    wait: wait,
                    opts: opts,
                    imageUrl: imgUrl
                  };
                });
              }
              return [];
            })
            .catch(() => []);
        });

        const nestedLists = await Promise.all(productPromises);
        ALL_PRODUCTS = ALL_PRODUCTS.concat(nestedLists.flat());
      }

      window.FS_PRODUCTS = ALL_PRODUCTS;

      try {
        sessionStorage.setItem('fs_cached_products_v3', JSON.stringify(ALL_PRODUCTS));
        sessionStorage.setItem('fs_cached_stores_v3', JSON.stringify(STORES));
        sessionStorage.setItem('fs_cached_fid_v3', String(festivalId));
      } catch (e) {
        console.warn('Failed to cache products', e);
      }

      console.log('[Shop] Combined products list (Supabase + API):', ALL_PRODUCTS);

      if (ALL_PRODUCTS.length === 0 && STORES.length === 0) {
        if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--g500); padding: 60px 0; font-size: 15px; font-weight: 600;">입점된 상점 또는 상품이 없습니다.</div>';
        return;
      }

      const statStore = document.getElementById('stat-store-cnt');
      const statProduct = document.getElementById('stat-product-cnt');
      const statFood = document.getElementById('stat-food-cnt');
      if (statStore) statStore.textContent = STORES.length;
      if (statProduct) statProduct.textContent = ALL_PRODUCTS.length;
      if (statFood) statFood.textContent = STORES.filter(s => s.cat === 'food').length;

      render();
    })
    .catch(err => {
      console.error('[Shop] Failed to fetch data from database or API:', err);
      if (grid) grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff4d4f; padding: 40px; font-weight: 600;">데이터 로딩 실패: ${err.message}</div>`;
    });
});

/* ================================================================
   유틸리티 및 초기화 (Utilities & Init)
   ================================================================ */

/**
 * @description 투박한 기본 HTML <select> 태그를 찾아서 세련된 커스텀 드롭다운 UI로 자동 변환합니다.
 */
window.FS_convertSelectToCustom = function () {
  document.querySelectorAll('select.sort-sel, select.page-size-select').forEach(select => {
    if (select.dataset.customized) return;
    select.dataset.customized = "true";
    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    const selectedOption = select.options[select.selectedIndex];
    trigger.textContent = selectedOption ? selectedOption.textContent : '';

    const optionsList = document.createElement('ul');
    optionsList.className = 'custom-select-options';

    Array.from(select.options).forEach((option, idx) => {
      const li = document.createElement('li');
      li.className = 'custom-option';
      if (idx === select.selectedIndex) li.classList.add('selected');
      li.textContent = option.textContent;
      li.addEventListener('click', () => {
        select.selectedIndex = idx;
        trigger.textContent = option.textContent;
        optionsList.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
        li.classList.add('selected');
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change'));
      });
      optionsList.appendChild(li);
    });

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select-wrapper').forEach(w => {
        if (w !== wrapper) w.classList.remove('open');
      });
      wrapper.classList.toggle('open');
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(optionsList);
    select.parentNode.insertBefore(wrapper, select.nextSibling);
  });
};

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select-wrapper').forEach(w => w.classList.remove('open'));
});
