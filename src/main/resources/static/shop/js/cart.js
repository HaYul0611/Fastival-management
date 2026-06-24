'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const { renderHeader, requireLogin, Toast, refreshCartBadge } = window.FS;
  renderHeader();
  requireLogin(() => { });

  let items = JSON.parse(localStorage.getItem('fs_cart') || '[]');
  function save() { localStorage.setItem('fs_cart', JSON.stringify(items)); refreshCartBadge() }

  function calc() { return items.filter(i => i.checked !== false).reduce((s, i) => s + i.price * i.qty, 0) }

  function updateSum() {
    const t = calc();
    document.getElementById('sumGoods').textContent = t.toLocaleString() + '원';
    document.getElementById('sumTotal').textContent = t.toLocaleString() + '원';
    document.getElementById('cartCount').textContent = `${items.length}개 상품`;
  }

  function render() {
    const layout = document.getElementById('cartLayout');
    const empty = document.getElementById('cartEmpty');
    const list = document.getElementById('cartList');
    if (!list) return;
    if (!items.length) { layout.style.display = 'none'; empty.style.display = 'flex'; return }
    layout.style.display = 'grid'; empty.style.display = 'none';
    list.innerHTML = items.map((it, i) => {
      const opts = Object.values(it.opts || {}).join(' / ');
      return `<div class="cart-item" data-i="${i}">
        <div><label class="chk-wrap"><input type="checkbox" class="ic" data-i="${i}" ${it.checked !== false ? 'checked' : ''} aria-label="${it.name} 선택"/><span class="chk-box"></span></label></div>
        <div class="ci-img" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="6" y="10" width="20" height="16" rx="3" stroke="#D1D1D1" stroke-width="1.5"/><path d="M10 10V8a6 6 0 0 1 12 0v2" stroke="#D1D1D1" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div style="min-width:0">
          <div class="ci-brand">${it.name}</div>
          <div class="ci-name">${it.name}</div>
          ${opts ? `<div class="ci-opt">${opts}</div>` : ''}
          <div class="ci-qty">
            <button class="ci-qty-btn" data-a="m" data-i="${i}" aria-label="수량 줄이기"><svg width="12" height="2" viewBox="0 0 12 2"><path d="M1 1h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
            <span class="ci-qty-num">${it.qty}</span>
            <button class="ci-qty-btn" data-a="p" data-i="${i}" aria-label="수량 늘리기"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
          </div>
        </div>
        <div class="ci-right">
          <span class="ci-price">${(it.price * it.qty).toLocaleString()}원</span>
          <button class="btn-ci-del" data-i="${i}" aria-label="${it.name} 삭제">삭제</button>
        </div>
      </div>`;
    }).join('');
    updateSum(); bind();
  }

  function bind() {
    document.querySelectorAll('.ci-qty-btn').forEach(b => {
      b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (b.dataset.a === 'p') items[i].qty = Math.min(items[i].qty + 1, 99);
        else items[i].qty = Math.max(items[i].qty - 1, 1);
        save(); render();
      });
    });
    document.querySelectorAll('.btn-ci-del').forEach(b => {
      b.addEventListener('click', () => { items.splice(+b.dataset.i, 1); save(); render(); Toast.show({ title: '삭제했어요', type: 'info', dur: 2000 }) });
    });
    document.querySelectorAll('.ic').forEach(c => {
      c.addEventListener('change', () => { items[+c.dataset.i].checked = c.checked; save(); updateSum() });
    });
  }

  document.getElementById('chkAll').addEventListener('change', e => {
    items.forEach(i => i.checked = e.target.checked); save(); render();
  });
  document.getElementById('btnDelSel').addEventListener('click', () => {
    items = items.filter(i => i.checked === false); save(); render(); Toast.show({ title: '선택 삭제했어요', type: 'info', dur: 2000 });
  });
  document.getElementById('btnOrder').addEventListener('click', () => {
    requireLogin(() => {
      const sel = items.filter(i => i.checked !== false);
      if (!sel.length) { Toast.show({ title: '상품을 선택해주세요', type: 'warning', dur: 2500 }); return }
      /* FESTIO 연동 포인트 */
      sessionStorage.setItem('fs_order', JSON.stringify(sel));
      location.href = 'checkout.html';
    });
  });
  render();

  /* ── 찜한 상품 로드 ── */
  async function loadWishlist() {
    const wishIds = JSON.parse(localStorage.getItem('fs_wish') || '[]');
    const wishSection = document.getElementById('wishSection');
    const wishGrid = document.getElementById('wishGrid');
    if (!wishIds.length) {
      wishSection.style.display = 'none';
      return;
    }

    try {
      const sb = window.ShopDB.getClient();
      const { data: supaProducts, error } = await sb.from('shop_products').select('*');
      if (error || !supaProducts) throw new Error("DB Error");

      const wishedProducts = supaProducts.filter(p => wishIds.includes(p.id)).map(p => {
        return {
          id: p.id,
          brand: p.store_name || (p.type === 'FOOD' ? '푸드트럭' : 'MD 스토어'),
          name: p.name || p.productName,
          price: p.price || 0,
          stock: p.stock !== undefined ? p.stock : 999,
          imageUrl: p.image_url || p.imageUrl || null,
          cat: p.type === 'FOOD' ? 'food' : 'goods'
        };
      });

      if (!wishedProducts.length) {
        wishSection.style.display = 'none';
        return;
      }

      function getPlaceholder(cat) {
        const cfg = {
          food: { path: `<path d="M20 60h60M25 44h50l-5-24H30L25 44z" stroke="#FF6B00" stroke-width="3" stroke-linejoin="round"/><path d="M38 38V24M50 38V24M62 38V24" stroke="#FF6B00" stroke-width="2.5" stroke-linecap="round"/><circle cx="50" cy="68" r="6" stroke="#FF6B00" stroke-width="2.5"/>` },
          goods: { path: `<rect x="22" y="32" width="56" height="46" rx="6" stroke="#FF2D55" stroke-width="3"/><path d="M34 32V25a16 16 0 0 1 32 0v7" stroke="#FF2D55" stroke-width="3" stroke-linecap="round"/><path d="M38 55h24M50 43v24" stroke="#FF2D55" stroke-width="2.5" stroke-linecap="round"/>` },
          collab: { path: `<path d="M50 18l7 21H79L63 52l6 21-19-12-19 12 6-21-16-13h22L50 18z" stroke="#7B2FFF" stroke-width="3" stroke-linejoin="round"/>` }
        };
        const c = cfg[cat] || cfg.goods;
        return `<svg width="80" height="80" viewBox="0 0 100 100" fill="none" aria-hidden="true">${c.path}</svg>`;
      }

      wishSection.style.display = 'block';
      wishGrid.innerHTML = wishedProducts.map(p => {
        const ph = getPlaceholder(p.cat || 'goods');
        const imgHtml = p.imageUrl
          ? `<img src="${p.imageUrl}" class="pcard-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
             <div class="pcard-placeholder" style="display:none; background:#f8f9fa; width:100%; height:100%; align-items:center; justify-content:center;">${ph}</div>`
          : `<div class="pcard-placeholder" style="background:#f8f9fa;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${ph}</div>`;

        return `<article class="pcard${p.stock === 0 ? ' sold' : ''}" tabindex="0" onclick="location.href='shop-detail.html?id=${p.id}'" style="cursor:pointer;">
          <div class="pcard-img-area">
            ${imgHtml}
            ${p.stock === 0 ? `<div class="sold-cover"><span class="sold-label">SOLD OUT</span></div>` : ''}
            <button class="pcard-wish on" data-id="${p.id}" onclick="event.stopPropagation(); window.FS_removeWish(${p.id}, this)">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 14S2 10.2 2 5.8A3.6 3.6 0 0 1 8 3.6 3.6 3.6 0 0 1 14 5.8C14 10.2 8 14 8 14z" stroke="#FF2D55" fill="#FF2D55" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="pcard-body">
            <div class="pcard-brand">${p.brand}</div>
            <h3 class="pcard-name">${p.name}</h3>
            <div class="pcard-foot" style="display:flex; justify-content:space-between; align-items:center;">
              <div class="pcard-price">
                <span class="pcard-price-num">${p.price.toLocaleString()}</span><span class="pcard-price-unit">원</span>
              </div>
              ${p.stock > 0 ? `
              <button class="btn-add-cart-wish" onclick="event.stopPropagation(); window.FS_addWishToCart(${p.id})" style="background:var(--g100); color:var(--black); border:none; padding:6px 12px; border-radius:16px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px; transition:background 0.2s;" onmouseover="this.style.background='var(--g200)'" onmouseout="this.style.background='var(--g100)'">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2h2l2 8.5a2 2 0 0 0 2 1.5h6a2 2 0 0 0 1.9-1.5l1.1-6H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="8" cy="14" r="1.5" fill="currentColor"/>
                  <circle cx="13" cy="14" r="1.5" fill="currentColor"/>
                </svg>
                담기
              </button>` : ''}
            </div>
          </div>
        </article>`;
      }).join('');
    } catch (err) {
      console.error('Failed to load wishlist products:', err);
    }
  }

  window.FS_removeWish = function (id, btn) {
    let wishIds = JSON.parse(localStorage.getItem('fs_wish') || '[]');
    wishIds = wishIds.filter(x => x !== id);
    localStorage.setItem('fs_wish', JSON.stringify(wishIds));
    Toast.show({ title: '찜 해제했어요', type: 'info', dur: 2000 });

    const card = btn.closest('.pcard');
    if (card) card.style.display = 'none';

    if (wishIds.length === 0) {
      document.getElementById('wishSection').style.display = 'none';
    }
  };

  // 장바구니에 담기
  window.FS_addWishToCart = async function (id) {
    try {
      const res = await fetch('/api/stores');
      const stores = await res.json();
      // 해당 상품이 어느 스토어인지 찾는 건 어렵지만 전체 로드 캐시를 쓰는 게 좋으므로 빠르게 다시 로드 (또는 sessionStorage에서 가져오기)
      // 최적화를 위해 여기서도 병렬 로드
      const productPromises = stores.map(store => fetch(`/api/stores/${store.id}/products`).then(r => r.ok ? r.json() : []));
      const nestedLists = await Promise.all(productPromises);
      const allProducts = nestedLists.flat();

      const p = allProducts.find(x => x.id === id);
      if (!p) {
        Toast.show({ title: '상품 정보를 찾을 수 없습니다', type: 'warning' });
        return;
      }

      const item = {
        productId: p.id,
        name: p.productName || p.name,
        price: p.price || 0,
        qty: 1,
        opts: {},
        cat: 'goods' // 임시 카테고리
      };

      const ei = items.findIndex(c => c.productId === item.productId);
      if (ei !== -1) items[ei].qty += 1;
      else items.push(item);

      save();
      render();
      Toast.show({ title: '장바구니에 담았어요', type: 'success', dur: 2000 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      Toast.show({ title: '오류가 발생했습니다', type: 'error' });
    }
  };

  loadWishlist();
});
