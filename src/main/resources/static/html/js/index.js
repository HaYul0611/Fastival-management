(function () {
      const userEmail = localStorage.getItem('userEmail') || localStorage.getItem('email');
      const userRole = localStorage.getItem('userRole');

      if (userEmail !== 'admin@gmail.com' || userRole !== 'ADMIN') {
        alert('관리자만 접근할 수 있는 페이지입니다.');
        window.location.href = '../Festio/login.html';
      }
    })();

document.addEventListener('DOMContentLoaded', async () => {
      try {
        await eventApi.getEvents(null, (events) => {
          const tbody = document.getElementById('adminEventTableBody');
          if (!events || events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">등록된 행사가 없습니다.</td></tr>';
            return;
          }
          tbody.innerHTML = events.map(ev => `
              <tr>
                <td>${ev.id || ev.eventNo}</td>
                <td><strong>${ev.name || ev.eventName || ''}</strong></td>
                <td><span class="badge bg-label-primary">${ev.category || '없음'}</span></td>
                <td>${ev.startDate || ''}</td>
                <td>${ev.endDate || ''}</td>
                <td>
                  <button class="btn btn-sm btn-danger" onclick="deleteEvent(${ev.id || ev.eventNo})">삭제</button>
                </td>
              </tr>
            `).join('');
        });
      } catch (error) {
        console.error('Failed to load events:', error);
        document.getElementById('adminEventTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">데이터 로드 실패</td></tr>';
      }
    });

    window.deleteEvent = async function (id) {
      if (confirm('정말 삭제하시겠습니까?')) {
        try {
          const res = await fetch('/api/festival/' + id, { method: 'DELETE' });
          if (res.ok) {
            alert('삭제되었습니다.');
            location.reload();
          } else {
            alert('삭제 실패: ' + res.statusText);
          }
        } catch (e) {
          alert('삭제 중 오류가 발생했습니다.');
        }
      }
    }