'use strict';
/* ================================================================
   FESTIO SHOP — shop.js
   목데이터 · 필터링 · 카드 렌더링 · 찜
   ================================================================ */

/* ── 데이터 상태 ────────────────────────────────────────────── */
let STORES = [];
let ALL_PRODUCTS = [];

window.FS_PRODUCTS = ALL_PRODUCTS;

/* ── 상태 ───────────────────────────────────────────────────── */
const S = {
  cat: 'all', sort: 'popular', q: '',
  wish: JSON.parse(localStorage.getItem('fs_wish') || '[]'),
  selectedStoreId: null,
  currentPage: 1,
  itemsPerPage: 16
};

/* ── 필터 ───────────────────────────────────────────────────── */
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

/* ── 카드 HTML ──────────────────────────────────────────────── */
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
      const pid = parseInt(p.id.toString().replace('store_', '')) || 1;
      let mockImg = '';

      if (p.cat === 'food') {
        if (p.isStoreCard) {
          const storeImgs = [
            '/shop/img/stores/food/0.jpg',
            '/shop/img/stores/food/1.jpg',
            '/shop/img/stores/food/2.jpg',
            '/shop/img/stores/food/3.jpg',
            '/shop/img/stores/food/4.jpg',
            '/shop/img/stores/food/5.jpg',
            '/shop/img/stores/food/6.jpg',
            '/shop/img/stores/food/7.jpg',
            '/shop/img/stores/food/8.jpg',
            '/shop/img/stores/food/9.jpg'
          ];
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

      const fallbackUrl = p.cat === 'food'
        ? (p.isStoreCard ? '/shop/img/stores/food/0.jpg' : 'https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg')
        : (p.isStoreCard ? '/shop/img/stores/goods/gen_0.png' : '/shop/img/poster1.png');

      return p.imageUrl
        ? `<img src="${p.imageUrl}" alt="${p.name}" class="pcard-img" onerror="if(!this.dataset.failed){this.dataset.failed=true;this.src='${mockImg}';}else{this.src='${fallbackUrl}';}">`
        : `<img src="${mockImg}" alt="${p.name}" class="pcard-img" onerror="if(!this.dataset.failed){this.dataset.failed=true;this.src='${fallbackUrl}';}">`;
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

  if (!isDesktop || totalPages <= 1) {
    wrapper.innerHTML = '';
    return;
  }

  // Prev Button
  const prevDisabled = S.currentPage === 1 ? 'disabled' : '';
  let html = `
    <div style="display: flex; gap: 8px; justify-content: center;">
      <button class="btn btn-outline-primary page-btn" ${prevDisabled} onclick="window.FS_goToPage(${S.currentPage - 1})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
}

window.FS_goToPage = function (page) {
  S.currentPage = page;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.FS_changePerPage = function (size) {
  S.itemsPerPage = parseInt(size, 10);
  S.currentPage = 1;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.FS_goBackToStores = function () {
  S.selectedStoreId = null;
  S.currentPage = 1;
  render();
};

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

  // 1. 입점 승인 완료된 상점 목록 Fetch
  let fetchUrl = '/api/stores';
  if (festivalId) {
    fetchUrl += `?festivalId=${festivalId}`;
  }

  fetch(fetchUrl)
    .then(res => {
      if (!res.ok) throw new Error('입점 상점 정보를 불러올 수 없습니다.');
      return res.json();
    })
    .then(async stores => {
      console.log('[Shop] Loaded stores for festival:', festivalId, stores);

      if (stores.length === 0) {
        if (grid) {
          grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--g500); padding: 60px 0; font-size: 15px; font-weight: 600;">이 축제에 입점된 상점이 없습니다.</div>';
        }
        return;
      }

      STORES = [];
      ALL_PRODUCTS = [];

      // 2. 각 상점별 상품 목록 병렬 Fetch 수행
      const productPromises = stores.map(store => {
        // 카테고리 매핑 규칙
        let storeCatMapped = 'goods';
        const storeCat = (store.category || '').toLowerCase();
        if (storeCat === 'food' || storeCat === 'drink') {
          storeCatMapped = 'food';
        } else if (storeCat === 'collab') {
          storeCatMapped = 'collab';
        }

        let wait = null;
        if (storeCatMapped === 'food') {
          const waitMatch = (store.notice || '').match(/(\d+)분/);
          wait = waitMatch ? parseInt(waitMatch[1], 10) : 10;
        }

        // 상점 자체를 STORES에 추가
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
          imageUrl: store.imageUrl || store.image_url || null,
          isStoreCard: true
        });

        return fetch(`/api/stores/${store.id}/products`)
          .then(res => res.ok ? res.json() : [])
          .then(products => {
            // 상품이 있으면 상품 목록 반환
            if (products.length > 0) {
              return products.map(p => {
                // 상품 옵션그룹 파싱
                let opts = [];
                if (p.optionGroupsJson) {
                  try { opts = JSON.parse(p.optionGroupsJson); } catch (e) { opts = []; }
                }

                return {
                  id: p.id,
                  storeId: store.id,
                  cat: storeCatMapped,
                  brand: store.name,
                  name: p.productName || p.name,
                  price: p.price || 0,
                  stock: p.availableStock !== undefined ? p.availableStock : (p.currentStock || 0),
                  wait: wait,
                  opts: opts,
                  imageUrl: p.imageUrl || p.image_url || null
                };
              });
            }
            return [];
          })
          .catch(err => {
            console.error(`[Shop] Failed to load products for store ${store.id}:`, err);
            return [];
          });
      });

      // 모든 상점의 상품 조회가 끝날 때까지 병렬 대기
      const nestedLists = await Promise.all(productPromises);
      ALL_PRODUCTS = nestedLists.flat();
      window.FS_PRODUCTS = ALL_PRODUCTS;
      console.log('[Shop] Loaded & formatted products list:', ALL_PRODUCTS);

      // 대시보드 통계 숫자 동기화
      const statStore = document.getElementById('stat-store-cnt');
      const statProduct = document.getElementById('stat-product-cnt');
      const statFood = document.getElementById('stat-food-cnt');

      if (statStore) statStore.textContent = STORES.length;
      if (statProduct) statProduct.textContent = ALL_PRODUCTS.length;
      if (statFood) statFood.textContent = STORES.filter(s => s.cat === 'food').length;

      // 화면 렌더링
      render();
    })
    .catch(err => {
      console.error('[Shop] Failed to fetch data from database:', err);
      if (grid) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ff4d4f; padding: 40px; font-weight: 600;">데이터 로딩 실패: ${err.message}</div>`;
      }
    });

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
});
