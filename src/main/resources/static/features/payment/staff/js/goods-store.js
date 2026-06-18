function getAuthHeader() {
        return localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || 'festio-admin-jwt-token-7777';
      }

      const goodsOpenToggle      = document.getElementById('goodsOpenToggle');
      const goodsToggleBoard     = document.getElementById('goodsToggleBoard');
      const businessStatusText    = document.getElementById('businessStatusText');
      const businessStatusSubText = document.getElementById('businessStatusSubText');
      const o2oToggle             = document.getElementById('o2oToggle');
      const ownerNoticeInput      = document.getElementById('ownerNoticeInput');
      const saveNoticeBtn         = document.getElementById('saveNoticeBtn');
      const storeNameEl           = document.getElementById('storeNameEl');
      const storeOperatingHours   = document.getElementById('storeOperatingHours');
      const saveInfoBtn           = document.getElementById('saveInfoBtn');
      const storeDescription      = document.getElementById('storeDescription');
      const storeImageInput       = document.getElementById('storeImageInput');
      const storeImagePreview     = document.getElementById('storeImagePreview');
      const storeImageUrl         = document.getElementById('storeImageUrl');
      const storeImagePlaceholderIcon = document.getElementById('storeImagePlaceholderIcon');
      const storeImageText        = document.getElementById('storeImageText');
      const storeImageSubText     = document.getElementById('storeImageSubText');

      const navUserName           = document.getElementById('navUserName');
      const navUserRole           = document.getElementById('navUserRole');

      document.addEventListener('DOMContentLoaded', () => {
        loadStoreDetails();
        loadNavUserInfo();
      });

      function loadNavUserInfo() {
        const userName = localStorage.getItem('userName') || sessionStorage.getItem('userName') || '굿즈 점주';
        const userEmail = localStorage.getItem('email') || sessionStorage.getItem('email') || '';
        if (navUserName) navUserName.textContent = userName;
        if (navUserRole) navUserRole.textContent = userEmail || '공식 MD 점주 (GOODS STAFF)';
      }

      function loadStoreDetails() {
        fetch('/api/payment/staff/store', {
          headers: { 'Authorization': getAuthHeader() }
        })
        .then(res => {
          if (!res.ok) throw new Error('MD 판매소 정보 로드 실패');
          return res.json();
        })
        .then(store => {
          if (storeNameEl) storeNameEl.textContent = store.name || '공식 굿즈 판매소';
          const isOpen = store.is_open === true || store.is_open === 'true';
          goodsOpenToggle.checked = isOpen;
          updateToggleUI(isOpen);

          if (store.notice) ownerNoticeInput.value = store.notice;
          if (store.operating_hours) storeOperatingHours.value = store.operating_hours;
          if (store.description) storeDescription.value = store.description;
          if (store.image_url) {
            storeImageUrl.value = store.image_url;
            storeImagePreview.src = store.image_url;
            storeImagePreview.style.display = 'block';
            storeImagePlaceholderIcon.style.display = 'none';
            storeImageText.style.display = 'none';
            storeImageSubText.style.display = 'none';
          }
        })
        .catch(err => {
          console.error(err);
        });
      }

      function updateToggleUI(isOpen) {
        if (isOpen) {
          goodsToggleBoard.style.borderColor = '#7F00FF';
          goodsToggleBoard.style.backgroundColor = 'rgba(127, 0, 255, 0.02)';
          businessStatusText.innerText = '🏪 굿즈 주문 및 수령 대기 중';
          businessStatusText.style.color = '#7F00FF';
          businessStatusSubText.innerText = '모바일 앱에 공식 MD 리스트 및 픽업 예약 주문 버튼이 노출되고 있습니다.';
        } else {
          goodsToggleBoard.style.borderColor = '#e0e0e0';
          goodsToggleBoard.style.backgroundColor = '#f8f9fa';
          businessStatusText.innerText = '💤 현장 부스 영업 마감';
          businessStatusText.style.color = '#6c757d';
          businessStatusSubText.innerText = '현재 모바일 앱 주문 및 픽업 접수가 일시 정지되었습니다.';
        }
      }

      goodsOpenToggle.addEventListener('change', function(e) {
        const nextStatus = e.target.checked;
        fetch('/api/payment/staff/store/status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
          },
          body: JSON.stringify({ isOpen: nextStatus })
        })
        .then(res => { if (!res.ok) throw new Error('상태 변경 실패'); return res.json(); })
        .then(data => {
          updateToggleUI(data.isOpen);
          alert(data.isOpen
            ? '🏪 공식 굿즈 부스 영업이 시작되었습니다!'
            : '💤 공식 굿즈 부스 영업이 마감되었습니다.');
        })
        .catch(err => {
          console.error(err);
          goodsOpenToggle.checked = !nextStatus;
        });
      });

      saveNoticeBtn.addEventListener('click', () => {
        const noticeVal = ownerNoticeInput.value.trim();
        if (!noticeVal) { alert('공지 내용을 입력해 주세요.'); return; }

        fetch('/api/payment/staff/store/notice', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
          body: JSON.stringify({ notice: noticeVal })
        })
        .then(res => { if (!res.ok) throw new Error('공지 등록 실패'); return res.json(); })
        .then(data => {
          alert('📢 공식 MD 공지가 등록되었습니다:\n' + data.notice);
        })
        .catch(err => { console.error(err); alert('공지 등록 중 오류가 발생했습니다.'); });
      });

      saveInfoBtn.addEventListener('click', () => {
        const name = storeNameEl.textContent.trim();
        const category = 'GOODS';
        const operatingHours = storeOperatingHours.value.trim();
        const description = storeDescription.value.trim();
        const imageUrl = storeImageUrl.value;

        fetch('/api/payment/staff/store/info', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': getAuthHeader() },
          body: JSON.stringify({ name, category, operatingHours, description, imageUrl })
        })
        .then(res => { if (!res.ok) throw new Error('정보 저장 실패'); return res.json(); })
        .then(data => {
          alert('✅ MD 판매소 정보가 저장되었습니다.');
          loadStoreDetails();
        })
        .catch(err => { console.error(err); alert('정보 저장 중 오류가 발생했습니다.'); });
      });

      if (storeImageInput) {
        storeImageInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (!file) return;

          if (file.size > 5 * 1024 * 1024) {
            alert('⚠️ 이미지 용량은 최대 5MB를 넘을 수 없습니다!');
            storeImageInput.value = '';
            return;
          }

          const reader = new FileReader();
          reader.onload = function(evt) {
            const base64Url = evt.target.result;
            storeImageUrl.value = base64Url;
            storeImagePreview.src = base64Url;
            storeImagePreview.style.display = 'block';
            storeImagePlaceholderIcon.style.display = 'none';
            storeImageText.style.display = 'none';
            storeImageSubText.style.display = 'none';
          };
          reader.readAsDataURL(file);
        });
      }

      o2oToggle.addEventListener('change', function(e) {
        if (e.target.checked) {
          alert('🔔 모바일 굿즈 픽업 예약 접수가 재개되었습니다.');
        } else {
          alert('🔕 모바일 굿즈 픽업 예약 접수가 중지되었습니다.');
        }
      });