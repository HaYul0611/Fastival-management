'use strict';
/* ================================================================
   FESTIO SHOP — shop.js
   목데이터 · 필터링 · 카드 렌더링 · 찜
   ================================================================ */

/* ── 데이터 상태 ────────────────────────────────────────────── */
let PRODUCTS = [];

window.FS_PRODUCTS = PRODUCTS;

/* ── 상태 ───────────────────────────────────────────────────── */
const S = {
  cat: 'all', sort: 'popular', q: '',
  wish: JSON.parse(localStorage.getItem('fs_wish') || '[]')
};

/* ── 필터 ───────────────────────────────────────────────────── */
function filtered() {
  let list = [...PRODUCTS];
  if (S.cat !== 'all') list = list.filter(p => p.cat === S.cat);
  if (S.q) { const q = S.q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) }
  if (S.sort === 'newest') list.sort((a, b) => b.id - a.id);
  else if (S.sort === 'price_asc') list.sort((a, b) => a.price - b.price);
  else if (S.sort === 'price_desc') list.sort((a, b) => b.price - a.price);
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

    <button class="pcard-wish${wished ? ' on' : ''}" data-id="${p.id}"
      aria-label="${wished ? '찜 해제' : '찜하기'}" aria-pressed="${wished}">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 14S2 10.2 2 5.8A3.6 3.6 0 0 1 8 3.6 3.6 3.6 0 0 1 14 5.8C14 10.2 8 14 8 14z"
          stroke="${wished ? '#FF2D55' : '#A8A8A8'}" fill="${wished ? '#FF2D55' : 'none'}"
          stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </button>

    ${p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${p.name}" class="pcard-img">`
      : `<div class="pcard-placeholder">${placeholder(p.cat)}</div>`}

    ${sold ? `<div class="sold-cover" aria-hidden="true"><span class="sold-label">SOLD OUT</span></div>` : ''}
  </div>

  <div class="pcard-body">
    <div class="pcard-brand">
      <span class="pcard-brand-dot ${dotCls}"></span>${p.brand}
    </div>
    <h3 class="pcard-name">${p.name}</h3>
    <div class="pcard-foot">
      <div class="pcard-price">
        ${p.isStorePlaceholder
          ? `<span class="pcard-price-num" style="font-size:13px;color:var(--g400);">상품 준비 중</span>`
          : `<span class="pcard-price-num">${p.price.toLocaleString()}</span><span class="pcard-price-unit">원</span>`
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
  cnt.textContent = `총 ${list.length}개 상품`;
  if (!list.length) { grid.innerHTML = ''; empty.style.display = 'flex'; return }
  empty.style.display = 'none';
  grid.innerHTML = list.map(cardHTML).join('');
  if (sr) sr.textContent = `${list.length}개 상품 표시됨`;
  bindCards();
}

function bindCards() {
  document.querySelectorAll('.pcard:not(.sold)').forEach(c => {
    c.addEventListener('click', e => { if (e.target.closest('.pcard-wish')) return; goto(c.dataset.id) });
    c.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.pcard-wish')) { e.preventDefault(); goto(c.dataset.id) } });
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
  const festivalId = params.get('festivalId') || params.get('eventNo') || sessionStorage.getItem('currentFestivalId') || '11';

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

  // 1. 해당 페스티벌에 입점 승인 완료된 상점 목록 Fetch
  fetch(`/api/stores?festivalId=${festivalId}`)
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

        return fetch(`/api/stores/${store.id}/products`)
          .then(res => res.ok ? res.json() : [])
          .then(products => {
            // 상품이 있으면 상품 카드 목록 반환
            if (products.length > 0) {
              return products.map(p => {
                // 푸드트럭 대기 시간 분석
                let wait = null;
                if (storeCatMapped === 'food') {
                  const waitMatch = (store.notice || '').match(/(\d+)분/);
                  wait = waitMatch ? parseInt(waitMatch[1], 10) : 10;
                }

                // 상품 옵션그룹 파싱
                let opts = [];
                if (p.optionGroupsJson) {
                  try { opts = JSON.parse(p.optionGroupsJson); } catch (e) { opts = []; }
                }

                return {
                  id: p.id,
                  cat: storeCatMapped,
                  brand: store.name,
                  name: p.productName,
                  price: p.price || 0,
                  stock: p.availableStock !== undefined ? p.availableStock : (p.currentStock || 0),
                  wait: wait,
                  opts: opts,
                  imageUrl: p.imageUrl
                };
              });
            }

            // 상품이 없으면 상점 자체를 대표 카드로 표시 (상품 준비 중)
            console.log(`[Shop] Store ${store.name}(id:${store.id}) has no products - showing store placeholder card`);
            let wait = null;
            if (storeCatMapped === 'food') {
              const waitMatch = (store.notice || '').match(/(\d+)분/);
              wait = waitMatch ? parseInt(waitMatch[1], 10) : null;
            }
            return [{
              id: `store_${store.id}`,  // 상점 식별자 (상품 ID와 구분)
              cat: storeCatMapped,
              brand: store.name,
              name: `${store.name} — 상품 준비 중`,
              price: 0,
              stock: 0,
              wait: wait,
              opts: [],
              imageUrl: null,
              isStorePlaceholder: true  // 상점 대표 카드 플래그
            }];
          })
          .catch(err => {
            console.error(`[Shop] Failed to load products for store ${store.id}:`, err);
            return [];
          });
      });

      // 모든 상점의 상품 조회가 끝날 때까지 병렬 대기
      const nestedLists = await Promise.all(productPromises);
      PRODUCTS = nestedLists.flat();
      window.FS_PRODUCTS = PRODUCTS;
      console.log('[Shop] Loaded & formatted products list:', PRODUCTS);

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
      document.querySelectorAll('.cat-btn').forEach(x => {
        x.classList.toggle('on', x.dataset.cat === S.cat);
      });
      render();
    });
  });

  /* 정렬 */
  document.getElementById('sortSel').addEventListener('change', e => { S.sort = e.target.value; render() });

  /* 검색 */
  document.addEventListener('shop:search', e => { S.q = e.detail.q; render() });
});
