'use strict';
/* ================================================================
   FESTIO SHOP — shop-detail.js
   상품 로드·갤러리·옵션·수량·합산·인터셉터
   ================================================================ */

/* ── SVG 플레이스홀더 (상세용 큰 사이즈) ────────────────────── */
function bigPlaceholder(cat) {
  const m = {
    food: {
      svg: `<svg width="140" height="140" viewBox="0 0 140 140" fill="none">
        <circle cx="70" cy="70" r="60" fill="rgba(255,107,0,.07)"/>
        <path d="M35 96h70M42 62h56l-7-30H49L42 62z" stroke="#FF6B00" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M56 52V34M70 52V34M84 52V34" stroke="#FF6B00" stroke-width="3" stroke-linecap="round"/>
        <circle cx="70" cy="108" r="8" stroke="#FF6B00" stroke-width="3"/>
      </svg>`},
    goods: {
      svg: `<svg width="140" height="140" viewBox="0 0 140 140" fill="none">
        <circle cx="70" cy="70" r="60" fill="rgba(255,45,85,.07)"/>
        <rect x="32" y="48" width="76" height="62" rx="8" stroke="#FF2D55" stroke-width="3.5"/>
        <path d="M48 48V38a22 22 0 0 1 44 0v10" stroke="#FF2D55" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M54 79h32M70 63v32" stroke="#FF2D55" stroke-width="3" stroke-linecap="round"/>
      </svg>`},
    collab: {
      svg: `<svg width="140" height="140" viewBox="0 0 140 140" fill="none">
        <circle cx="70" cy="70" r="60" fill="rgba(123,47,255,.07)"/>
        <path d="M70 24l10 30h32L90 72l11 30-31-17-31 17 11-30L28 54h32L70 24z" stroke="#7B2FFF" stroke-width="3.5" stroke-linejoin="round"/>
      </svg>`},
  };
  return (m[cat] || m.goods).svg;
}

function smallPlaceholder(cat) {
  const m = {
    food: `<svg width="36" height="36" viewBox="0 0 40 40" fill="none"><path d="M8 28h24M11 18h18l-2-9H13L11 18z" stroke="#FF6B00" stroke-width="2" stroke-linejoin="round"/><path d="M16 15V8M20 15V8M24 15V8" stroke="#FF6B00" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    goods: `<svg width="36" height="36" viewBox="0 0 40 40" fill="none"><rect x="8" y="13" width="24" height="19" rx="3" stroke="#FF2D55" stroke-width="2"/><path d="M14 13V10a6 6 0 0 1 12 0v3" stroke="#FF2D55" stroke-width="2" stroke-linecap="round"/></svg>`,
    collab: `<svg width="36" height="36" viewBox="0 0 40 40" fill="none"><path d="M20 7l3 9h9.5L25 21.5l3 9L20 26l-8 4.5 3-9L7.5 16H17L20 7z" stroke="#7B2FFF" stroke-width="2" stroke-linejoin="round"/></svg>`,
  };
  return m[cat] || m.goods;
}

/* ── 상태 ───────────────────────────────────────────────────── */
const DS = {
  product: null, qty: 1, unitPrice: 0,
  wish: JSON.parse(localStorage.getItem('fs_wish') || '[]')
};

/* ── 로드 ───────────────────────────────────────────────────── */
function load() {
  const id = new URLSearchParams(location.search).get('id');

  if (!window.FS_PRODUCTS || window.FS_PRODUCTS.length === 0) {
    // shop.js에서 데이터 로딩이 끝날 때까지 100ms 대기
    setTimeout(load, 100);
    return;
  }

  const p = window.FS_PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) {
    document.getElementById('detailWrap').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <p>상품을 찾을 수 없어요</p>
        <span><a href="shop.html" style="color:var(--black);text-decoration:underline">목록으로 돌아가기</a></span>
      </div>`;
    return;
  }
  DS.product = p; DS.unitPrice = p.price; DS.qty = 1;
  document.title = `${p.name} — FESTIO SHOP`;
  renderDetail(p);

  // 연관 상품 (이 상점의 다른 상품) 표시
  if (p.storeId) {
    renderRelatedProducts(p.storeId, p.id);
  }
}

function renderRelatedProducts(storeId, currentProductId) {
  const related = window.FS_PRODUCTS.filter(x => x.storeId === storeId && x.id !== currentProductId).slice(0, 4);
  const grid = document.getElementById('relatedProductsGrid');
  if (!grid) return;

  if (related.length === 0) {
    grid.parentElement.style.display = 'none';
    return;
  }

  grid.innerHTML = related.map(rp => {
    const sold = rp.stock === 0;
    const badges = [];
    if (!sold && rp.cat === 'food' && rp.wait > 0) badges.push(`<span class="badge badge-wait">대기 ${rp.wait}분</span>`);
    if (!sold && rp.stock > 0 && rp.stock <= 5) badges.push(`<span class="badge badge-low">잔여 ${rp.stock}개</span>`);

    return `
      <article class="pcard${sold ? ' sold' : ''}" data-id="${rp.id}" tabindex="0" onclick="location.href='shop-detail.html?id=${rp.id}'" style="cursor:pointer">
        <div class="pcard-img-area">
          ${badges.length ? `<div class="pcard-badges">${badges.join('')}</div>` : ''}
          ${(function () {
        let mockImg = '';
        if (rp.cat === 'food') {
          const foodImgs = [
            'https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg', 'https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg',
            'https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg', 'https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg'
          ];
          mockImg = foodImgs[rp.id % foodImgs.length];
        } else {
          const goodsImgs = [
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ATZ_14TH_PC.jpg', 'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ADB_VC_PC.png',
            'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/HTW_3RD_PC.png', 'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/QWER_PC_0527.png'
          ];
          mockImg = goodsImgs[rp.id % goodsImgs.length];
        }
        return rp.imageUrl
          ? `<img src="${rp.imageUrl}" class="pcard-img" alt="${rp.name}" onerror="if(this.src !== '${mockImg}') { this.src='${mockImg}'; } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }">
                 <div class="pcard-placeholder" style="display:none; align-items:center; justify-content:center; width:100%; height:100%;">${smallPlaceholder(rp.cat)}</div>`
          : `<img src="${mockImg}" class="pcard-img" alt="${rp.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="pcard-placeholder" style="display:none; align-items:center; justify-content:center; width:100%; height:100%;">${smallPlaceholder(rp.cat)}</div>`;
      })()}
          ${sold ? `<div class="sold-cover"><span class="sold-label">SOLD OUT</span></div>` : ''}
        </div>
        <div class="pcard-body">
          <div class="pcard-brand">${rp.brand}</div>
          <h3 class="pcard-name">${rp.name}</h3>
          <div class="pcard-foot">
            <div class="pcard-price">
              <span class="pcard-price-num">${rp.price.toLocaleString()}</span><span class="pcard-price-unit">원</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderDetail(p) {
  const sold = p.stock === 0;
  document.getElementById('bcCur').textContent = p.name;
  document.getElementById('detBrand').textContent = p.brand;
  document.getElementById('detName').textContent = p.name;
  document.getElementById('detPrice').textContent = p.price.toLocaleString();
  if (sold) document.querySelector('.det-info').classList.add('det-sold');

  /* 배지 */
  const bl = [];
  if (sold) bl.push(`<span class="badge badge-sold">품절</span>`);
  else if (p.stock <= 5) bl.push(`<span class="badge badge-low">잔여 ${p.stock}개</span>`);
  else bl.push(`<span class="badge badge-ok">구매 가능</span>`);
  if (p.cat === 'food' && p.wait > 0) bl.push(`<span class="badge badge-wait">대기 ${p.wait}분</span>`);
  document.getElementById('detBadges').innerHTML = bl.join('');

  /* 갤러리 */
  const main = document.getElementById('galMain');
  main.className = `gal-main gal-main-cat-${p.cat}`;

  // 메인 이미지 렌더링
  let mockMainImg = '';
  if (p.cat === 'food') {
    const foodImgs = [
      'https://www.themealdb.com/images/media/meals/8rfd4q1764112993.jpg', 'https://www.themealdb.com/images/media/meals/13fg4j1764441982.jpg',
      'https://www.themealdb.com/images/media/meals/jgl9qq1764437635.jpg', 'https://www.themealdb.com/images/media/meals/kgfh3q1763075438.jpg'
    ];
    mockMainImg = foodImgs[p.id % foodImgs.length];
  } else {
    const goodsImgs = [
      'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ATZ_14TH_PC.jpg', 'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/ADB_VC_PC.png',
      'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/HTW_3RD_PC.png', 'https://shopkpop.cafe24.com/web/upload/weskin14/kr/main/QWER_PC_0527.png'
    ];
    mockMainImg = goodsImgs[p.id % goodsImgs.length];
  }

  const renderImgSrc = p.imageUrl || mockMainImg;

  if (renderImgSrc) {
    document.getElementById('galPlaceholder').style.display = 'none';
    const mainImg = document.createElement('img');
    mainImg.src = renderImgSrc;
    mainImg.className = 'gal-main-img';
    mainImg.style.width = '100%';
    mainImg.style.height = '100%';
    mainImg.style.objectFit = 'contain';
    mainImg.style.backgroundColor = 'var(--white)';
    mainImg.id = 'actualMainImg';

    // 에러 발생 시 플레이스홀더 렌더링
    mainImg.onerror = function () {
      if (this.src !== mockMainImg) {
        this.src = mockMainImg;
      } else {
        this.style.display = 'none';
        const ph = document.getElementById('galPlaceholder');
        ph.style.display = 'flex';
        ph.innerHTML = bigPlaceholder(p.cat);
      }
    };

    main.appendChild(mainImg);
  } else {
    document.getElementById('galPlaceholder').innerHTML = bigPlaceholder(p.cat);
  }

  // 썸네일 렌더링 (실무에서는 p.images 배열을 순회하지만 현재는 단일 이미지만 있으므로 첫번째 칸에만 실제 이미지 적용)
  const thumbs = document.getElementById('galThumbs');
  thumbs.innerHTML = Array.from({ length: 4 }, (_, i) => {
    let thumbContent = `<div style="display:flex; width:100%; height:100%; align-items:center; justify-content:center;">${smallPlaceholder(p.cat)}</div>`;
    if (i === 0 && renderImgSrc) {
      thumbContent = `<img src="${renderImgSrc}" style="width:100%; height:100%; object-fit:contain; border-radius:4px; background-color:var(--white);" onerror="if(this.src !== '${mockMainImg}') { this.src='${mockMainImg}'; } else { this.style.display='none'; this.nextElementSibling.style.display='flex'; }">
      <div style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">${smallPlaceholder(p.cat)}</div>`;
    }
    return `
      <div class="gal-thumb${i === 0 ? ' on' : ''}" role="listitem" tabindex="0"
        data-i="${i}" aria-label="이미지 ${i + 1}">
        ${thumbContent}
      </div>`;
  }).join('');

  thumbs.querySelectorAll('.gal-thumb').forEach((t, idx) => {
    const act = () => {
      thumbs.querySelectorAll('.gal-thumb').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      // 실제 여러 이미지 배열이 있다면 메인 이미지를 교체하는 로직 추가
    };
    t.addEventListener('click', act);
    t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } });
  });

  /* 옵션 */
  const optsEl = document.getElementById('detOpts');
  if (!p.opts || !p.opts.length) { optsEl.style.display = 'none' }
  else {
    optsEl.innerHTML = p.opts.map((o, i) => `
      <div class="opt-grp">
        <label class="opt-lbl" for="opt${i}">${o.label}</label>
        <select class="opt-sel" id="opt${i}" aria-label="${o.label} 선택">
          <option value="" disabled selected>${o.label} 선택</option>
          ${o.vals.map(v => `<option value="${v}">${v}</option>`).join('')}
        </select>
      </div>`).join('');
  }

  /* 합산 */
  updateTotal();
  /* 수량 */
  if (sold) {
    document.getElementById('qtyMinus').disabled = true;
    document.getElementById('qtyPlus').disabled = true;
  }

  /* 탭 */
  renderTabs(p.cat);
  /* 찜 */
  updateWishBtn();
}

function updateTotal() {
  const t = DS.unitPrice * DS.qty;
  const el = document.getElementById('totalNum');
  if (el) el.textContent = t.toLocaleString();
}

/* ── 수량 ───────────────────────────────────────────────────── */
function bindQty() {
  const max = Math.min(DS.product?.stock || 1, 99);
  const numEl = document.getElementById('qtyNum');
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  minus.disabled = true;
  plus.disabled = max <= 1;

  minus.addEventListener('click', () => {
    if (DS.qty <= 1) return; DS.qty--;
    numEl.textContent = DS.qty; minus.disabled = DS.qty <= 1; plus.disabled = false; updateTotal();
  });
  plus.addEventListener('click', () => {
    if (DS.qty >= max) return; DS.qty++;
    numEl.textContent = DS.qty; plus.disabled = DS.qty >= max; minus.disabled = false; updateTotal();
  });
}

/* ── 탭 ─────────────────────────────────────────────────────── */
function renderTabs(cat) {
  const tabs = cat === 'food'
    ? [{ k: 'menu', l: '메뉴 정보' }, { k: 'nutrition', l: '영양 정보' }, { k: 'guide', l: '이용 안내' }, { k: 'review', l: '리뷰' }]
    : [{ k: 'product', l: '상품 정보' }, { k: 'delivery', l: '배송 안내' }, { k: 'refund', l: '교환·환불' }, { k: 'review', l: '리뷰' }];

  document.getElementById('detTabs').innerHTML = tabs.map((t, i) =>
    `<button class="det-tab${i === 0 ? ' on' : ''}" data-k="${t.k}" role="tab" aria-selected="${i === 0}">${t.l}</button>`).join('');

  document.getElementById('detTabContent').innerHTML = tabs.map((t, i) =>
    `<section class="tab-pane${i === 0 ? ' on' : ''}" id="pane_${t.k}" role="tabpanel">${tabContent(t.k)}</section>`).join('');

  document.querySelectorAll('.det-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.det-tab').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-selected', 'false') });
      document.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); b.setAttribute('aria-selected', 'true');
      const pane = document.getElementById(`pane_${b.dataset.k}`); if (pane) pane.classList.add('on');
    });
  });
}

function tabContent(k) {
  const c = {
    product: `<table class="info-tbl"><tbody>
      <tr><th>소재</th><td>면 100% (USA Cotton)</td></tr>
      <tr><th>제조국</th><td>대한민국</td></tr>
      <tr><th>세탁</th><td>손세탁 또는 울 코스 세탁</td></tr>
      <tr><th>사이즈</th><td>S / M / L / XL — 사이즈 가이드 별도 문의</td></tr>
    </tbody></table>`,
    delivery: `<table class="info-tbl"><tbody>
      <tr><th>수령 방법</th><td>행사장 내 FESTIO 굿즈 부스 현장 수령</td></tr>
      <tr><th>수령 기간</th><td>행사 당일 ~ 종료일</td></tr>
      <tr><th>배송비</th><td>현장 수령 무료</td></tr>
      <tr><th>유의사항</th><td>행사 종료 후 미수령 시 별도 문의</td></tr>
    </tbody></table>`,
    refund: `<p class="tab-p">한정판 굿즈 특성상 단순 변심 교환·환불은 불가합니다.</p>
    <p class="tab-p" style="margin-top:10px">불량품은 수령 후 24시간 이내 FESTIO 고객센터로 문의해주세요.</p>
    <table class="info-tbl" style="margin-top:16px"><tbody>
      <tr><th>불량 교환</th><td>수령 24시간 이내 접수</td></tr>
      <tr><th>환불 불가</th><td>단순 변심, 사이즈 오인</td></tr>
      <tr><th>고객센터</th><td>FESTIO 앱 내 1:1 문의</td></tr>
    </tbody></table>`,
    menu: `<table class="info-tbl"><tbody>
      <tr><th>알레르기</th><td>밀, 대두, 돼지고기 함유 (상세 문의 가능)</td></tr>
      <tr><th>용량</th><td>1인분 기준</td></tr>
      <tr><th>조리시간</th><td>주문 접수 후 5~15분</td></tr>
    </tbody></table>`,
    nutrition: `<table class="info-tbl"><tbody>
      <tr><th>열량</th><td>약 550 kcal</td></tr>
      <tr><th>단백질</th><td>28g</td></tr>
      <tr><th>지방</th><td>22g</td></tr>
      <tr><th>탄수화물</th><td>58g</td></tr>
      <tr><th>나트륨</th><td>820mg</td></tr>
    </tbody></table>
    <p class="tab-p" style="margin-top:12px;font-size:12px;color:var(--g400)">※ 수치는 평균값이며 실제와 다소 차이 있을 수 있습니다.</p>`,
    guide: `<table class="info-tbl"><tbody>
      <tr><th>주문 방식</th><td>앱 선주문 후 현장 수령</td></tr>
      <tr><th>수령 방법</th><td>주문번호 또는 QR 코드 제시</td></tr>
      <tr><th>취소</th><td>조리 시작 전까지만 가능</td></tr>
      <tr><th>문의</th><td>해당 트럭 앞 스태프 문의</td></tr>
    </tbody></table>`,
    review: `<div class="review-area" style="padding-top:20px;">
      <h3 style="font-size:18px; font-weight:800; margin-bottom:16px;">사용자 리뷰</h3>
      <div style="display:flex; flex-direction:column; gap:24px;">
        <!-- 리뷰 1 -->
        <div class="review-item" style="border-bottom:1px solid var(--g100); padding-bottom:16px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <div style="font-weight:700; color:var(--g900);">김페스티</div>
            <div style="color:var(--g400); font-size:13px;">2026. 6. 18.</div>
          </div>
          <div style="display:flex; align-items:center; gap:4px; margin-bottom:12px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
            <span style="font-size:14px; font-weight:700; color:var(--g700);">5.0</span>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            <div style="width:80px; height:80px; border-radius:8px; background:var(--g100); overflow:hidden;">
              <img src="https://placehold.co/80x80/eee/ccc?text=QR" style="width:100%; height:100%; object-fit:cover; opacity: 0.3;">
            </div>
          </div>
          <p style="font-size:14px; line-height:1.6; color:var(--g800); margin-bottom:16px;">
            생각했던 것보다 퀄리티가 정말 좋아요! 만족스럽습니다.
          </p>
          <div class="review-actions" style="display:flex; gap:16px;">
            <button onclick="toggleLike(this)" style="display:flex; align-items:center; gap:4px; border:none; background:transparent; cursor:pointer; color:var(--g500); font-size:13px; font-weight:700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
              <span>도움돼요 (12)</span>
            </button>
            <button onclick="toggleReply(this)" style="display:flex; align-items:center; gap:4px; border:none; background:transparent; cursor:pointer; color:var(--g500); font-size:13px; font-weight:700;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
              <span>답글 1개</span>
            </button>
          </div>
          <!-- 답글 영역 -->
          <div class="review-replies" style="display:none; margin-top:16px; padding:12px; background:var(--g50); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <div style="font-weight:700; color:var(--g900); font-size:13px;">판매자</div>
              <div style="color:var(--g400); font-size:12px;">2026. 6. 18.</div>
            </div>
            <p style="font-size:13px; color:var(--g700); line-height:1.5;">만족하셨다니 다행입니다! 소중한 리뷰 감사합니다.</p>
          </div>
        </div>
      </div>
    </div>`
  };
  return c[k] || '';
}

/* ── 찜 ─────────────────────────────────────────────────────── */
function updateWishBtn() {
  const id = DS.product?.id; if (!id) return;
  const on = DS.wish.includes(id);
  const btn = document.getElementById('btnWish');
  const txt = document.getElementById('wishText');
  if (!btn) return;
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on);
  if (txt) txt.textContent = on ? '찜 해제' : '찜하기';
  const path = btn.querySelector('path');
  if (path) { path.setAttribute('fill', on ? 'var(--red)' : 'none'); path.setAttribute('stroke', on ? 'var(--red)' : 'currentColor') }
}

function bindWish() {
  document.getElementById('btnWish').addEventListener('click', () => {
    const id = DS.product?.id; if (!id) return;
    const i = DS.wish.indexOf(id);
    if (i === -1) { DS.wish.push(id); window.FS.Toast.show({ title: '찜 목록에 추가했어요', type: 'success', dur: 2000 }) }
    else { DS.wish.splice(i, 1); window.FS.Toast.show({ title: '찜 해제했어요', type: 'info', dur: 2000 }) }
    localStorage.setItem('fs_wish', JSON.stringify(DS.wish));
    updateWishBtn();
  });
}

/* ── 옵션 검증 ──────────────────────────────────────────────── */
function getOpts() {
  const sels = document.querySelectorAll('.opt-sel');
  const r = {};
  for (const s of sels) {
    if (!s.value) {
      window.FS.Toast.show({ title: '옵션을 선택해주세요', msg: '모든 옵션을 선택해야 합니다.', type: 'warning' });
      return null;
    }
    r[s.id] = s.value;
  }
  return r;
}

/* ── 액션 버튼 ──────────────────────────────────────────────── */
function bindActions() {
  document.getElementById('btnCart').addEventListener('click', () => {
    window.FS.requireLogin(() => {
      const opts = getOpts(); if (opts === null) return;
      const item = { productId: DS.product.id, name: DS.product.name, price: DS.unitPrice, qty: DS.qty, opts, cat: DS.product.cat };
      /* ── FESTIO 연동 포인트: festio.cart.add(item) ── */
      const cart = JSON.parse(localStorage.getItem('fs_cart') || '[]');
      const ei = cart.findIndex(c => c.productId === item.productId);
      if (ei !== -1) cart[ei].qty += item.qty; else cart.push(item);
      localStorage.setItem('fs_cart', JSON.stringify(cart));
      window.FS.refreshCartBadge();
      window.FS.Toast.show({ title: '장바구니에 담았어요', msg: `${item.name} ${item.qty}개`, type: 'success' });
    });
  });

  document.getElementById('btnBuy').addEventListener('click', () => {
    window.FS.requireLogin(() => {
      const opts = getOpts(); if (opts === null) return;
      const item = { productId: DS.product.id, name: DS.product.name, price: DS.unitPrice, qty: DS.qty, opts, cat: DS.product.cat };
      /* ── FESTIO 연동 포인트: festio.order.buyNow(item) ── */
      sessionStorage.setItem('fs_buynow', JSON.stringify(item));
      location.href = 'checkout.html?mode=buynow';
    });
  });
}

/* ── DOMContentLoaded ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  window.FS.renderHeader();
  load();
  bindQty();
  bindWish();
  bindActions();
});

/* ── 리뷰 소통 액션 ───────────────────────────────────────── */
window.toggleLike = function (btn) {
  const isLiked = btn.classList.contains('liked');
  const span = btn.querySelector('span');
  const svg = btn.querySelector('svg');
  if (isLiked) {
    btn.classList.remove('liked');
    svg.setAttribute('fill', 'none');
    span.textContent = '도움돼요 (12)';
  } else {
    btn.classList.add('liked');
    svg.setAttribute('fill', 'currentColor');
    span.textContent = '도움돼요 (13)';
  }
};

window.toggleReply = function (btn) {
  const replies = btn.closest('.review-item').querySelector('.review-replies');
  if (replies.style.display === 'none') {
    replies.style.display = 'block';
  } else {
    replies.style.display = 'none';
  }
};
