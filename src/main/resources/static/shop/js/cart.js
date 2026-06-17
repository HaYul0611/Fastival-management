'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  const {renderHeader,requireLogin,Toast,refreshCartBadge}=window.FS;
  renderHeader();
  requireLogin(()=>{});

  let items=JSON.parse(localStorage.getItem('fs_cart')||'[]');
  function save(){localStorage.setItem('fs_cart',JSON.stringify(items));refreshCartBadge()}

  function calc(){return items.filter(i=>i.checked!==false).reduce((s,i)=>s+i.price*i.qty,0)}

  function updateSum(){
    const t=calc();
    document.getElementById('sumGoods').textContent=t.toLocaleString()+'원';
    document.getElementById('sumTotal').textContent=t.toLocaleString()+'원';
    document.getElementById('cartCount').textContent=`${items.length}개 상품`;
  }

  function render(){
    const layout=document.getElementById('cartLayout');
    const empty=document.getElementById('cartEmpty');
    const list=document.getElementById('cartList');
    if(!list)return;
    if(!items.length){layout.style.display='none';empty.style.display='flex';return}
    layout.style.display='grid';empty.style.display='none';
    list.innerHTML=items.map((it,i)=>{
      const opts=Object.values(it.opts||{}).join(' / ');
      return`<div class="cart-item" data-i="${i}">
        <div><label class="chk-wrap"><input type="checkbox" class="ic" data-i="${i}" ${it.checked!==false?'checked':''} aria-label="${it.name} 선택"/><span class="chk-box"></span></label></div>
        <div class="ci-img" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="6" y="10" width="20" height="16" rx="3" stroke="#D1D1D1" stroke-width="1.5"/><path d="M10 10V8a6 6 0 0 1 12 0v2" stroke="#D1D1D1" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div style="min-width:0">
          <div class="ci-brand">${it.name}</div>
          <div class="ci-name">${it.name}</div>
          ${opts?`<div class="ci-opt">${opts}</div>`:''}
          <div class="ci-qty">
            <button class="ci-qty-btn" data-a="m" data-i="${i}" aria-label="수량 줄이기"><svg width="12" height="2" viewBox="0 0 12 2"><path d="M1 1h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
            <span class="ci-qty-num">${it.qty}</span>
            <button class="ci-qty-btn" data-a="p" data-i="${i}" aria-label="수량 늘리기"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
          </div>
        </div>
        <div class="ci-right">
          <span class="ci-price">${(it.price*it.qty).toLocaleString()}원</span>
          <button class="btn-ci-del" data-i="${i}" aria-label="${it.name} 삭제">삭제</button>
        </div>
      </div>`;
    }).join('');
    updateSum();bind();
  }

  function bind(){
    document.querySelectorAll('.ci-qty-btn').forEach(b=>{
      b.addEventListener('click',()=>{
        const i=+b.dataset.i;
        if(b.dataset.a==='p') items[i].qty=Math.min(items[i].qty+1,99);
        else items[i].qty=Math.max(items[i].qty-1,1);
        save();render();
      });
    });
    document.querySelectorAll('.btn-ci-del').forEach(b=>{
      b.addEventListener('click',()=>{items.splice(+b.dataset.i,1);save();render();Toast.show({title:'삭제했어요',type:'info',dur:2000})});
    });
    document.querySelectorAll('.ic').forEach(c=>{
      c.addEventListener('change',()=>{items[+c.dataset.i].checked=c.checked;save();updateSum()});
    });
  }

  document.getElementById('chkAll').addEventListener('change',e=>{
    items.forEach(i=>i.checked=e.target.checked);save();render();
  });
  document.getElementById('btnDelSel').addEventListener('click',()=>{
    items=items.filter(i=>i.checked===false);save();render();Toast.show({title:'선택 삭제했어요',type:'info',dur:2000});
  });
  document.getElementById('btnOrder').addEventListener('click',()=>{
    requireLogin(()=>{
      const sel=items.filter(i=>i.checked!==false);
      if(!sel.length){Toast.show({title:'상품을 선택해주세요',type:'warning',dur:2500});return}
      /* FESTIO 연동 포인트 */
      sessionStorage.setItem('fs_order',JSON.stringify(sel));
      location.href='checkout.html';
    });
  });
  render();
});
