let wsClient = null;

    document.addEventListener("DOMContentLoaded", () => {
      // Mock WebSocket 초기화
      if (window.MockWebSocket) {
        wsClient = new MockWebSocket('ws://localhost:8080/ws');
        wsClient.addEventListener('message', (e) => {
          loadInquiries();
        });
      } else {
        window.addEventListener('storage', (e) => {
          if (e.key === 'mock_ws_message') loadInquiries();
        });
      }

      loadInquiries();

      document.getElementById('submitInquiryBtn').addEventListener('click', function () {
        const title = document.getElementById('inqTitle').value.trim();
        const content = document.getElementById('inqContent').value.trim();
        const category = document.getElementById('inqCategory').options[document.getElementById('inqCategory').selectedIndex].text;

        if (!title || !content) {
          alert("⚠️ 문의 제목과 상세 내용을 입력해 주세요.");
          return;
        }

        const newInq = {
          id: Date.now(),
          author: 'vendor', // 가맹점이 관리자에게
          category: category,
          title: title,
          content: content,
          status: '대기',
          answer: null,
          target: 'admin',
          createdAt: new Date().toISOString()
        };

        if (window.InquiryStore) {
          window.InquiryStore.add('inquiries_to_admin', newInq);
          if (wsClient) {
            wsClient.send({ type: 'NEW_VENDOR_INQUIRY', payload: newInq });
          } else {
            localStorage.setItem('mock_ws_message', JSON.stringify({ type: 'NEW_VENDOR_INQUIRY' }));
            setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);
          }
        }

        alert("💬 문의가 성공적으로 접수되었습니다. 통합 마스터 챗 관제탑에 전달되었으며 답변 시 즉시 푸시 알림이 발송됩니다!");
        document.getElementById('inqTitle').value = "";
        document.getElementById('inqContent').value = "";
        loadInquiries();
      });
    });

    function loadInquiries() {
      if (!window.InquiryStore) return;

      // 고객 -> 업체로 온 문의
      const customerInqs = window.InquiryStore.get('inquiries_customer_to_vendor') || [];
      const sortedCustomerInqs = customerInqs.sort((a, b) => b.id - a.id);

      // 대시보드 통계 계산
      const totalInqs = sortedCustomerInqs.length;
      const unansweredInqs = sortedCustomerInqs.filter(q => q.status !== '답변완료').length;

      const ratedInqs = sortedCustomerInqs.filter(q => q.rating > 0);
      const avgRating = ratedInqs.length > 0
        ? (ratedInqs.reduce((acc, curr) => acc + parseFloat(curr.rating), 0) / ratedInqs.length).toFixed(1)
        : '0.0';

      const complaintsCount = sortedCustomerInqs.filter(q => q.isComplaint).length;

      // 통계 UI 갱신
      document.getElementById('statTotalInquiries').textContent = totalInqs;
      document.getElementById('statUnanswered').textContent = unansweredInqs;
      document.getElementById('statAvgRating').textContent = avgRating;
      document.getElementById('statComplaints').textContent = complaintsCount;

      renderCustomerInquiries(sortedCustomerInqs);

      // 업체 -> 관리자로 보낸 내 문의
      const myInqs = window.InquiryStore.get('inquiries_to_admin') || [];
      renderMyInquiries(myInqs.filter(q => q.author === 'vendor').sort((a, b) => b.id - a.id));
    }


    window.toggleAccordion = function (id) {
      const content = document.getElementById('acc-' + id);
      const arrow = document.getElementById('arrow-' + id);
      if (content.style.display === 'none') {
        content.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
      } else {
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    };

    function renderCustomerInquiries(list) {
      const container = document.getElementById('customerInquiryList');
      document.getElementById('customerInqCount').textContent = list.length;

      if (list.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-muted">아직 수신된 고객 행사 문의가 없습니다.</div>`;
        return;
      }

      container.innerHTML = list.map(q => {
        const ratingStr = q.rating > 0 ? `<span style="color:#ffb400; font-weight:600;">★ ${q.rating}</span>` : `<span class="text-muted" style="font-size:0.8rem;">평가 없음</span>`;
        const helpfulStr = q.helpful ? `<span class="badge bg-primary ms-2" style="font-size:0.7rem;">👍 도움됨</span>` : '';
        const complaintStr = q.isComplaint ? `<span class="badge bg-danger ms-2" style="font-size:0.7rem;">악성 신고</span>` : '';

        return `
        <div class="card mb-3 shadow-sm" style="border-radius:12px; border:1px solid #f1f1f5;">
          <div class="card-header bg-white py-3" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom: none;" onclick="toggleAccordion('cust-${q.id}')">
            <div>
              <h5 class="mb-1 fw-bold text-dark" style="font-size:1.05rem;">${q.title}</h5>
              <div style="font-size:0.8rem; color:var(--text-muted);">
                ${new Date(q.createdAt).toLocaleString()} 
                <span class="ms-2">|</span> 
                <span class="ms-2">고객 만족도: ${ratingStr} ${helpfulStr} ${complaintStr}</span>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${q.status === '답변완료' ? 'bg-success' : 'bg-warning'}">${q.status}</span>
              <svg id="arrow-cust-${q.id}" class="icon text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; transition:transform 0.3s;"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
          
          <div id="acc-cust-${q.id}" style="display:none; padding: 0 1.5rem 1.5rem 1.5rem; border-top:1px solid #f1f1f5; padding-top:1rem;">
            <p class="text-dark fs-6 mb-3">${q.content}</p>
            <div class="d-flex mb-3">
              <div style="width:60px; height:60px; background:#f8fafc; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem; border:1px dashed #cbd5e1;">이미지(0)</div>
            </div>
            
            ${q.answer ? `
              <div class="bg-label-primary p-3 rounded mt-3" style="border-left: 4px solid var(--bs-primary);">
                <strong class="text-primary fs-6 d-block mb-2">나의 답변</strong>
                <span class="text-dark fs-6">${q.answer}</span>
              </div>
            ` : `
              <div class="mt-4 p-3 bg-light rounded" style="border: 1px solid #e2e8f0;">
                <label class="form-label fw-bold text-dark">고객에게 답변 달기</label>
                <textarea id="reply-input-${q.id}" class="form-control mb-2" rows="3" placeholder="친절한 답변을 작성해주세요..."></textarea>
                <div class="d-flex justify-content-between align-items-center">
                  <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="complaint-check-${q.id}">
                    <label class="form-check-label text-danger" for="complaint-check-${q.id}" style="font-size:0.85rem;">악성/컴플레인 문의로 분류 (본사에 통보)</label>
                  </div>
                  <button class="btn btn-primary btn-sm px-4" onclick="sendReply(${q.id}, 'customer')"><i class="bx bx-paper-plane me-1"></i>답변 등록</button>
                </div>
              </div>
            `}
          </div>
        </div>
      `;
      }).join('');
    }

    function renderMyInquiries(list) {
      const container = document.getElementById('myInquiryList');
      if (list.length === 0) {
        container.innerHTML = `<div class="text-center p-4 text-muted">등록한 관리자 문의 내역이 없습니다.</div>`;
        return;
      }

      container.innerHTML = list.map(q => `
        <div class="card mb-3 shadow-sm" style="border-radius:12px; border:1px solid #f1f1f5;">
          <div class="card-header bg-white py-3" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom: none;" onclick="toggleAccordion('my-${q.id}')">
            <div>
              <span class="badge bg-label-secondary mb-1">${q.category || '문의'}</span>
              <h5 class="mb-1 fw-bold text-dark" style="font-size:1.05rem;">${q.title}</h5>
              <div style="font-size:0.8rem; color:var(--text-muted);">
                ${new Date(q.createdAt).toLocaleString()}
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge ${q.status === '답변완료' ? 'bg-success' : 'bg-warning'}">${q.status}</span>
              <svg id="arrow-my-${q.id}" class="icon text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; transition:transform 0.3s;"><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </div>
          
          <div id="acc-my-${q.id}" style="display:none; padding: 0 1.5rem 1.5rem 1.5rem; border-top:1px solid #f1f1f5; padding-top:1rem;">
            <p class="text-dark fs-6 mb-3">${q.content}</p>
            
            ${q.answer ? `
              <div class="bg-label-info p-3 rounded mt-3" style="border-left: 4px solid var(--bs-info);">
                <strong class="text-info fs-6 d-block mb-2">본사 관리자 답변</strong>
                <span class="text-dark fs-6">${q.answer}</span>
              </div>
            ` : `
              <div class="text-muted fs-7 mt-3"><i class="bx bx-time me-1"></i>본사 답변을 기다리고 있습니다.</div>
            `}
          </div>
        </div>
      `).join('');
    }

    window.sendReply = function (id, type) {
      if (type === 'customer') {
        const input = document.getElementById(`reply-input-${id}`);
        const chk = document.getElementById(`complaint-check-${id}`);
        if (!input || !input.value.trim()) {
          alert('답변 내용을 입력해주세요.');
          return;
        }

        const answerText = input.value.trim();
        const isComplaint = chk ? chk.checked : false;

        window.InquiryStore.update('inquiries_customer_to_vendor', id, {
          answer: answerText,
          status: '답변완료',
          isComplaint: isComplaint
        });

        if (wsClient) {
          wsClient.send({ type: 'REPLY_INQUIRY', payload: { id } });
        } else {
          localStorage.setItem('mock_ws_message', JSON.stringify({ type: 'REPLY_INQUIRY' }));
          setTimeout(() => localStorage.removeItem('mock_ws_message'), 50);
        }

        loadInquiries();
      }
    }
  // Custom Category Dropdown Logic
  const inqDropdown = document.getElementById('inqCategoryDropdown');
  const inqSelected = document.getElementById('inqCategorySelected');
  const inqOptions = document.getElementById('inqCategoryOptions');
  const inqText = document.getElementById('inqCategoryText');
  const nativeSelect = document.getElementById('inqCategory');

  if (inqDropdown && inqSelected && inqOptions && nativeSelect) {
    inqSelected.addEventListener('click', () => {
      inqDropdown.classList.toggle('open');
    });

    const options = inqOptions.querySelectorAll('.custom-category-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        inqText.textContent = opt.textContent;
        options.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        nativeSelect.value = opt.getAttribute('data-value');
        inqDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!inqDropdown.contains(e.target)) {
        inqDropdown.classList.remove('open');
      }
    });
  }

