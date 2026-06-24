document.addEventListener('DOMContentLoaded', async () => {
  if (!window.ShopDB) {
    alert("DB 클라이언트를 로드할 수 없습니다.");
    return;
  }
  const sb = window.ShopDB.getClient();

  const storeSelect = document.getElementById('storeSelect');
  const dashboardContent = document.getElementById('dashboardContent');
  const pendingOrdersCnt = document.getElementById('pendingOrdersCnt');
  const autoWaitTime = document.getElementById('autoWaitTime');
  const manualTimeInput = document.getElementById('manualTimeInput');
  const manualToggle = document.getElementById('manualToggle');
  const saveBtn = document.getElementById('saveBtn');

  // Load Store List
  const { data: stores, error } = await sb.from('shop_products').select('store_name').not('store_name', 'is', null);
  if (!error && stores) {
    const uniqueStores = [...new Set(stores.map(s => s.store_name))];
    uniqueStores.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      storeSelect.appendChild(option);
    });
  }

  // Store Select Event
  storeSelect.addEventListener('change', async (e) => {
    const storeName = e.target.value;
    if (!storeName) {
      dashboardContent.style.display = 'none';
      return;
    }
    dashboardContent.style.display = 'block';
    await loadStoreData(storeName);
  });

  async function loadStoreData(storeName) {
    // (1) 대기 중 주문 카운트 (Auto Calc)
    const tempPendingCount = Math.floor(Math.random() * 15);
    pendingOrdersCnt.textContent = tempPendingCount;
    autoWaitTime.textContent = (tempPendingCount * 2) + "분";

    // (2) 수동 설정값 불러오기 (shop_store_settings 테이블)
    const { data: settings, error } = await sb.from('shop_store_settings').select('*').eq('store_name', storeName).maybeSingle();

    if (settings) {
      manualTimeInput.value = settings.manual_wait_time || '';
      manualToggle.checked = settings.is_manual_active || false;
    } else {
      manualTimeInput.value = '';
      manualToggle.checked = false;
    }
  }

  // Save Settings
  saveBtn.addEventListener('click', async () => {
    const storeName = storeSelect.value;
    const mTime = manualTimeInput.value ? parseInt(manualTimeInput.value, 10) : null;
    const isActive = manualToggle.checked;

    if (!storeName) return;

    const { error } = await sb.from('shop_store_settings').upsert({
      store_name: storeName,
      manual_wait_time: mTime,
      is_manual_active: isActive,
      updated_at: new Date().toISOString()
    });

    if (error) {
      alert("설정 저장에 실패했습니다: " + error.message);
    } else {
      await sb.from('store_wait_time_logs').insert({
        store_name: storeName,
        new_time: mTime,
        change_reason: 'MANUAL_OVERRIDE',
        changed_by: 'Staff_A'
      });

      alert("성공적으로 저장되었습니다.");
    }
  });
});
