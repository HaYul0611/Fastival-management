/**
 * FESTIO Staff Authority Management JavaScript
 */

let allMembers = [];

// API Authorization Header Helper
function getAuthHeader() {
  const token = localStorage.getItem('userToken') || localStorage.getItem('token') || '';
  const safeToken = /^[\x00-\x7F]*$/.test(token) ? token : encodeURIComponent(token);
  return safeToken ? `Bearer ${safeToken}` : '';
}

// 1. 관리자 권한 검증 및 세션 체크
(function () {
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    if (window.Swal) {
      Swal.fire({
        title: '접근 권한 없음',
        text: '관리자 권한이 필요한 페이지입니다.',
        icon: 'error',
        confirmButtonText: '확인'
      }).then(() => {
        window.location.href = '/Festio/login.html';
      });
    } else {
      alert('관리자만 접근할 수 있는 페이지입니다.');
      window.location.href = '/Festio/login.html';
    }
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const memberTableBody = document.getElementById('memberTableBody');
  const searchInput = document.getElementById('searchInput');
  const roleFilter = document.getElementById('roleFilter');
  const statusFilter = document.getElementById('statusFilter');
  const btnResetFilters = document.getElementById('btnResetFilters');

  // Stats Elements
  const statTotalUsers = document.getElementById('statTotalUsers');
  const statGateStaff = document.getElementById('statGateStaff');
  const statActiveUsers = document.getElementById('statActiveUsers');
  const statBannedUsers = document.getElementById('statBannedUsers');

  // Form Elements
  const registerStaffForm = document.getElementById('registerStaffForm');
  const staffEmail = document.getElementById('staffEmail');
  const staffPassword = document.getElementById('staffPassword');
  const staffName = document.getElementById('staffName');
  const staffPhone = document.getElementById('staffPhone');
  const staffRole = document.getElementById('staffRole');

  // 1. 전체 회원 목록 로드
  await loadMembers();

  // 1-1. 신규 스탭 모달 오픈 시 아이디(이메일), 비밀번호, 이름 자동 생성 로직
  const registerStaffModal = document.getElementById('registerStaffModal');
  if (registerStaffModal) {
    registerStaffModal.addEventListener('show.bs.modal', () => {
      const randNum = Math.floor(1000 + Math.random() * 9000); // 4자리 랜덤 숫자
      const generatedEmail = `gate_staff_${randNum}@festio.com`;
      
      // 8자리 임시 비밀번호 생성 (소문자 + 숫자)
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let generatedPassword = '';
      for (let i = 0; i < 8; i++) {
        generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      staffEmail.value = generatedEmail;
      staffPassword.value = generatedPassword;
      staffName.value = `게이트스탭_${randNum}`;
      staffPhone.value = '';
    });
  }

  async function loadMembers() {
    try {
      const res = await fetch('/api/admin/members', {
        headers: { 'Authorization': getAuthHeader() }
      });
      if (!res.ok) throw new Error('회원 목록 조회 실패');
      const rawData = await res.json();
      // 게이트 스탭 관리 목적이므로 일반 사용자(후보군)와 게이트 스탭만 노출
      allMembers = rawData.filter(m => m.role === 'ROLE_USER' || m.role === 'ROLE_GATE_STAFF');
      
      updateStatistics();
      renderMembersTable(allMembers);
    } catch (err) {
      console.error(err);
      Swal.fire('오류', '회원 목록을 불러오는 데 실패했습니다.', 'error');
    }
  }

  // 2. 통계 요약 갱신
  function updateStatistics() {
    statTotalUsers.textContent = `${allMembers.length}명`;
    
    const gateStaffCount = allMembers.filter(m => m.role === 'ROLE_GATE_STAFF').length;
    statGateStaff.textContent = `${gateStaffCount}명`;

    const activeCount = allMembers.filter(m => m.status === 'ACTIVE').length;
    statActiveUsers.textContent = `${activeCount}명`;

    const bannedCount = allMembers.filter(m => m.status === 'BANNED').length;
    statBannedUsers.textContent = `${bannedCount}명`;
  }

  // 3. 회원 목록 테이블 렌더링
  function renderMembersTable(members) {
    memberTableBody.innerHTML = '';

    if (members.length === 0) {
      memberTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">
            <i class="bx bx-info-circle fs-3 mb-2 d-block text-secondary"></i>
            조건에 부합하는 사용자가 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    members.forEach(member => {
      const tr = document.createElement('tr');

      // 역할에 따른 파스텔 뱃지 분기
      let roleBadgeClass = 'bg-label-user';
      let roleLabel = '일반 사용자';
      
      if (member.role === 'ROLE_GATE_STAFF') {
        roleBadgeClass = 'bg-label-gate-staff';
        roleLabel = '게이트 스탭';
      } else if (member.role === 'ROLE_STAFF') {
        roleBadgeClass = 'bg-label-staff';
        roleLabel = '가맹 점주';
      } else if (member.role === 'ROLE_ADMIN') {
        roleBadgeClass = 'bg-label-admin';
        roleLabel = '관리자';
      }

      // 상태 토글 스위치 활성화 상태
      const isChecked = member.status === 'ACTIVE' ? 'checked' : '';

      tr.innerHTML = `
        <td class="ps-4">
          <div class="d-flex align-items-center">
            <div class="avatar avatar-sm me-2">
              <span class="avatar-initial rounded-circle bg-label-primary fw-bold" style="font-size:0.85rem;">
                ${(member.name || 'U').substring(0, 1).toUpperCase()}
              </span>
            </div>
            <span class="fw-semibold text-dark">${member.name || '미기재'}</span>
          </div>
        </td>
        <td>${member.email}</td>
        <td>${member.phone || '-'}</td>
        <td class="text-center">
          <span class="badge ${roleBadgeClass}">${roleLabel}</span>
        </td>
        <td class="text-center">
          <div class="form-check form-switch d-inline-block">
            <input class="form-check-input status-toggle-switch" type="checkbox" data-id="${member.id}" ${isChecked}>
          </div>
        </td>
        <td class="text-center">
          <button class="btn btn-xs btn-outline-primary fw-bold change-role-btn" data-id="${member.id}" data-role="${member.role}">
            <i class="bx bx-edit-alt me-1"></i>권한 관리
          </button>
        </td>
      `;

      // 이벤트 바인딩: 상태 토글 스위치
      tr.querySelector('.status-toggle-switch').addEventListener('change', async (e) => {
        const userId = e.target.dataset.id;
        const newStatus = e.target.checked ? 'ACTIVE' : 'BANNED';
        await handleStatusChange(userId, newStatus, e.target);
      });

      // 이벤트 바인딩: 권한 관리 버튼 클릭
      tr.querySelector('.change-role-btn').addEventListener('click', () => {
        openRoleSelectionDialog(member.id, member.role, member.name);
      });

      memberTableBody.appendChild(tr);
    });
  }

  // 4. 상태 변경 API 통신 핸들러
  async function handleStatusChange(userId, status, switchEl) {
    try {
      const res = await fetch(`/api/admin/members/${userId}/status?status=${status}`, {
        method: 'PATCH',
        headers: { 'Authorization': getAuthHeader() }
      });
      if (!res.ok) throw new Error('상태 변경 실패');
      
      // 로컬 배열 값 실시간 동기화
      const member = allMembers.find(m => m.id === userId);
      if (member) member.status = status;
      updateStatistics();

      // 성공 토스트 팝업
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `계정이 ${status === 'ACTIVE' ? '활성화' : '정지'}되었습니다.`,
        showConfirmButton: false,
        timer: 1500
      });
    } catch (err) {
      console.error(err);
      // 실패 시 스위치 상태 롤백
      switchEl.checked = !switchEl.checked;
      Swal.fire('오류', '계정 상태 변경에 실패했습니다.', 'error');
    }
  }

  // 5. 권한 역할 변경 SweetAlert2 다이얼로그 오픈
  function openRoleSelectionDialog(userId, currentRole, name) {
    Swal.fire({
      title: `${name}님의 권한 설정`,
      text: '부여할 권한 역할을 아래에서 선택해 주세요.',
      icon: 'question',
      input: 'select',
      inputOptions: {
        'ROLE_USER': '일반 사용자 (ROLE_USER)',
        'ROLE_GATE_STAFF': '입장 게이트 스탭 (ROLE_GATE_STAFF)'
      },
      inputValue: currentRole,
      showCancelButton: true,
      confirmButtonText: '변경 적용',
      cancelButtonText: '취소',
      confirmButtonColor: '#696cff',
      inputValidator: (value) => {
        if (!value) {
          return '하나의 권한을 선택하셔야 합니다.';
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        const newRole = result.value;
        if (newRole === currentRole) return; // 동일하면 스킵

        try {
          Swal.showLoading();
          const res = await fetch(`/api/admin/members/${userId}/role?role=${newRole}`, {
            method: 'PATCH',
            headers: { 'Authorization': getAuthHeader() }
          });
          if (!res.ok) throw new Error('권한 변경 실패');
          
          Swal.close();

          // 로컬 데이터 동기화
          const member = allMembers.find(m => m.id === userId);
          if (member) member.role = newRole;
          updateStatistics();
          applyFilters(); // 필터 적용 렌더링

          Swal.fire({
            title: '권한 변경 성공',
            text: '회원의 권한 역할이 정상 변경되었습니다.',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err) {
          console.error(err);
          Swal.fire('오류', '권한 역할 변경 처리 도중 실패했습니다.', 'error');
        }
      }
    });
  }

  // 6. 실시간 필터 및 검색 적용
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const role = roleFilter.value;
    const status = statusFilter.value;

    const filtered = allMembers.filter(member => {
      const matchQuery = !query || 
        member.email.toLowerCase().includes(query) || 
        (member.name && member.name.toLowerCase().includes(query)) ||
        (member.phone && member.phone.includes(query));

      const matchRole = role === 'ALL' || member.role === role;
      const matchStatus = status === 'ALL' || member.status === status;

      return matchQuery && matchRole && matchStatus;
    });

    renderMembersTable(filtered);
  }

  searchInput.addEventListener('input', applyFilters);
  roleFilter.addEventListener('change', applyFilters);
  statusFilter.addEventListener('change', applyFilters);

  // 필터 리셋
  btnResetFilters.addEventListener('click', () => {
    searchInput.value = '';
    roleFilter.value = 'ALL';
    statusFilter.value = 'ALL';
    renderMembersTable(allMembers);
  });

  // 7. 신규 스탭 생성 요청 제출
  registerStaffForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      email: staffEmail.value,
      password: staffPassword.value,
      name: staffName.value,
      phone: staffPhone.value || null,
      role: staffRole.value
    };

    try {
      Swal.showLoading();
      const res = await fetch('/api/admin/members/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorMsg = await res.text();
        throw new Error(errorMsg || '스탭 생성 실패');
      }

      // 모달 닫기 및 폼 초기화
      const modalEl = document.getElementById('registerStaffModal');
      const bootstrapModal = bootstrap.Modal.getInstance(modalEl);
      if (bootstrapModal) bootstrapModal.hide();
      registerStaffForm.reset();

      Swal.close();

      const copyText = `아이디(이메일): ${payload.email}\n임시 비밀번호: ${payload.password}`;

      await Swal.fire({
        title: '스탭 계정 생성 완료!',
        icon: 'success',
        html: `
          <div class="text-start p-3 bg-light rounded-3 border mb-3" style="font-family: inherit;">
            <p class="mb-2"><strong>아이디 (이메일):</strong> <code class="text-primary fs-6 fw-bold" style="user-select: all;">${payload.email}</code></p>
            <p class="mb-0"><strong>임시 비밀번호:</strong> <code class="text-danger fs-6 fw-bold" style="user-select: all;">${payload.password}</code></p>
          </div>
          <p class="text-muted fs-7 mb-0">아래 버튼을 누르면 계정 정보가 클립보드에 복사됩니다.</p>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bx bx-copy me-1.5"></i>계정 정보 복사',
        cancelButtonText: '닫기',
        confirmButtonColor: '#696cff',
        preConfirm: () => {
          return navigator.clipboard.writeText(copyText)
            .then(() => true)
            .catch(() => false);
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '클립보드에 복사되었습니다!',
            showConfirmButton: false,
            timer: 1500
          });
        }
      });

      // 리스트 다시 로드
      await loadMembers();
    } catch (err) {
      console.error(err);
      Swal.fire('등록 실패', err.message || '스탭 계정 등록 도중 문제가 발생했습니다.', 'error');
    }
  });
});
