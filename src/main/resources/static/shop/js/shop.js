'use strict';
/* ================================================================
   FESTIO SHOP — shop.js
   목데이터 · 필터링 · 카드 렌더링 · 찜
   ================================================================ */

/* ── 목 데이터 ──────────────────────────────────────────────── */
const PRODUCTS = [
  /* ── 공식 굿즈 ── */
  {
    id: 1, cat: 'goods', brand: 'FESTIO Official', name: 'FESTIO 2026 로고 후드집업', price: 79000, stock: 12, wait: null,
    opts: [{ label: '색상', vals: ['블랙', '화이트', '차콜그레이'] }, { label: '사이즈', vals: ['S', 'M', 'L', 'XL', '2XL'] }]
  },
  {
    id: 2, cat: 'goods', brand: 'FESTIO Official', name: 'FESTIO 캔버스 토트백 (대)', price: 38000, stock: 5, wait: null,
    opts: [{ label: '색상', vals: ['오트밀', '블랙'] }]
  },
  {
    id: 3, cat: 'goods', brand: 'FESTIO Official', name: 'FESTIO 한정판 키링 세트 (3종)', price: 18000, stock: 0, wait: null,
    opts: [{ label: '종류', vals: ['A세트', 'B세트'] }]
  },
  {
    id: 4, cat: 'goods', brand: 'FESTIO Official', name: 'FESTIO 포토카드 팩 (랜덤 8종)', price: 12000, stock: 80, wait: null,
    opts: []
  },
  {
    id: 5, cat: 'goods', brand: 'FESTIO Official', name: 'FESTIO 홀로그램 스티커 시트', price: 6000, stock: 200, wait: null,
    opts: []
  },
  {
    id: 6, cat: 'goods', brand: 'FESTIO Official', name: 'FESTIO 2026 아크릴 스탠드', price: 15000, stock: 3, wait: null,
    opts: [{ label: '버전', vals: ['A형', 'B형', 'C형', 'D형', 'E형'] }]
  },
  /* ── 아티스트 컬래버 ── */
  {
    id: 7, cat: 'collab', brand: 'DAWN × FESTIO', name: '[DAWN 콜라보] 그래픽 오버핏 티셔츠', price: 59000, stock: 8, wait: null,
    opts: [{ label: '사이즈', vals: ['S', 'M', 'L', 'XL'] }]
  },
  {
    id: 8, cat: 'collab', brand: 'DAWN × FESTIO', name: '[DAWN 콜라보] A2 포스터', price: 22000, stock: 0, wait: null,
    opts: [{ label: '버전', vals: ['Ver.A', 'Ver.B'] }]
  },
  {
    id: 9, cat: 'collab', brand: 'NewJeans × FESTIO', name: '[NJ 콜라보] 에코백', price: 35000, stock: 14, wait: null,
    opts: [{ label: '색상', vals: ['민트', '베이비핑크', '화이트'] }]
  },
  {
    id: 10, cat: 'collab', brand: 'NewJeans × FESTIO', name: '[NJ 콜라보] 엽서 세트 (10종)', price: 9000, stock: 60, wait: null,
    opts: []
  },
  /* ── 푸드트럭 ── */
  {
    id: 11, cat: 'food', brand: '스모크하우스 BBQ 1호차', name: '스모크 바베큐 풀드포크 버거', price: 13000, stock: 99, wait: 10,
    opts: [{ label: '사이드', vals: ['감자튀김', '코울슬로', '생략'] }, { label: '음료', vals: ['콜라', '사이다', '생략'] }]
  },
  {
    id: 12, cat: 'food', brand: '스모크하우스 BBQ 1호차', name: '풀드포크 핫도그 + 치즈', price: 9000, stock: 99, wait: 7,
    opts: [{ label: '소스', vals: ['오리지널BBQ', '스파이시BBQ'] }]
  },
  {
    id: 13, cat: 'food', brand: '타코야끼 본점 2호차', name: '새우 타코 세트 (3개)', price: 8000, stock: 0, wait: 0,
    opts: []
  },
  {
    id: 14, cat: 'food', brand: '타코야끼 본점 2호차', name: '문어 타코야끼 (6개)', price: 7000, stock: 99, wait: 8,
    opts: [{ label: '소스', vals: ['마요네즈', '폰즈', '스파이시마요'] }]
  },
  {
    id: 15, cat: 'food', brand: '그린볼 샐러드 3호차', name: '그레인 파워볼 (선택 단백질)', price: 12000, stock: 20, wait: 5,
    opts: [{ label: '단백질', vals: ['닭가슴살', '연어', '두부'] }, { label: '드레싱', vals: ['시저', '발사믹', '레몬허브'] }]
  },
  {
    id: 16, cat: 'food', brand: '버블티 페스타 4호차', name: '망고 타로 버블티', price: 7500, stock: 99, wait: 3,
    opts: [{ label: '당도', vals: ['25%', '50%', '75%', '100%'] }, { label: '얼음', vals: ['적게', '보통', '많이'] }]
  },
];

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

    <div class="pcard-placeholder">${placeholder(p.cat)}</div>

    ${sold ? `<div class="sold-cover" aria-hidden="true"><span class="sold-label">SOLD OUT</span></div>` : ''}
  </div>

  <div class="pcard-body">
    <div class="pcard-brand">
      <span class="pcard-brand-dot ${dotCls}"></span>${p.brand}
    </div>
    <h3 class="pcard-name">${p.name}</h3>
    <div class="pcard-foot">
      <div class="pcard-price">
        <span class="pcard-price-num">${p.price.toLocaleString()}</span>
        <span class="pcard-price-unit">원</span>
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
  if (catParam) {
    S.cat = catParam;
    document.querySelectorAll('.cat-btn').forEach(x => {
      x.classList.toggle('on', x.dataset.cat === S.cat);
    });
    document.querySelectorAll('.ftag').forEach(x => {
      x.classList.toggle('on', x.dataset.cat === S.cat);
    });
  }

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

  render();
});
