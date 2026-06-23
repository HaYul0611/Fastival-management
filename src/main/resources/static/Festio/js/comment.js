/**
 * @file comment.js
 * @description 상세 페이지의 실시간 소통 댓글 및 예매자 후기를 통합 렌더링하고,
 * 좋아요, 대댓글, 신고, 실시간 알림 기능을 관리하는 모듈입니다.
 */

window.initCommentUI = function () {
  let tabReviewContainer = document.getElementById('tab-review');

  // id="tab-review"가 없으면, 탭 버튼 이름으로 유추하여 찾기 (관리자 페이지 동적 탭 대응)
  if (!tabReviewContainer) {
    const tabButtons = document.querySelectorAll('.detail-tab-btn');
    let reviewBtn = null;
    tabButtons.forEach(btn => {
      if (btn.innerText.includes('리뷰') || btn.innerText.includes('후기')) {
        reviewBtn = btn;
      }
    });
    if (reviewBtn && reviewBtn.dataset.target) {
      tabReviewContainer = document.getElementById(reviewBtn.dataset.target);
    }
  }

  if (!tabReviewContainer) return;

  // SVG 아바타 생성 헬퍼
  function getAvatarSVG(gender) {
    if (gender === 'M') {
      return `<svg viewBox="0 0 24 24" style="width:100%; height:100%; background:#e0f2fe; border-radius:50%;"><circle cx="12" cy="8" r="4" fill="#0284c7"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="#0284c7"/></svg>`;
    } else if (gender === 'F') {
      return `<svg viewBox="0 0 24 24" style="width:100%; height:100%; background:#fce7f3; border-radius:50%;"><circle cx="12" cy="8" r="4" fill="#be185d"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="#be185d"/><path d="M9 10c0 2 1.5 5 3 5s3-3 3-5" fill="#be185d"/></svg>`;
    } else {
      return `<svg viewBox="0 0 24 24" style="width:100%; height:100%; background:#f3f4f6; border-radius:50%;"><circle cx="12" cy="8" r="4" fill="#9ca3af"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="#9ca3af"/></svg>`;
    }
  }

  // 탭 내부의 기본 빈 텍스트 영역 숨김 처리는 .tab-empty-text 에만 적용해야 함.
  // .tab-content-inner 전체를 숨기면 페이지 빌더 실시간 동기화가 보이지 않는 문제가 발생함.
  const innerContent = tabReviewContainer.querySelector('.tab-content-inner');
  // if (innerContent) {
  //   innerContent.style.display = 'none';
  // }

  // 이미 초기화된 경우 중복 방지
  if (document.getElementById('dynamic-comments-section')) return;

  // 기존의 정적인 내용을 덮어쓰지 않고 아래에 새로운 UI 컨테이너를 생성하여 삽입합니다.
  const commentsWrapper = document.createElement('div');
  commentsWrapper.id = 'dynamic-comments-section';
  commentsWrapper.dataset.ignoreSave = "true"; // 페이지 빌더 저장 시 무시하도록 표시
  commentsWrapper.innerHTML = `
    <!-- 댓글 입력 영역 -->
    <div class="comment-input-wrap" style="margin-bottom:2rem; padding:1.5rem; background:#f9fafb; border-radius:12px; border:1px solid #e5e7eb;">
      <div style="display:flex; gap:1rem; align-items:flex-start;">
        <div class="comment-avatar" id="myProfileAvatarWrap" style="width:40px; height:40px; flex-shrink:0;">
          <!-- 스크립트로 SVG 또는 기본 이미지 삽입됨 -->
        </div>
        <div style="flex:1; min-width:0;">
          <textarea id="commentContent" rows="3" placeholder="행사에 대한 기대감이나 후기를 자유롭게 남겨보세요! (로그인 후 이용 가능)" style="width:100%; border:1px solid #d1d5db; border-radius:8px; padding:0.8rem; font-size:0.95rem; resize:none; outline:none; transition:border-color 0.2s;"></textarea>
          
          <div id="mediaPreviewContainer" style="display:none; margin-top:0.5rem; gap:0.5rem; flex-wrap:nowrap; overflow-x:auto; padding-bottom:0.5rem;">
            <!-- 다중 미리보기 아이템들이 여기에 추가됩니다. -->
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.8rem;">
            <label for="commentMediaFile" style="cursor:pointer; display:flex; align-items:center; gap:0.5rem; color:#6b7280; font-size:0.9rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              사진/동영상 첨부
            </label>
            <input type="file" id="commentMediaFile" accept="image/*,video/*" multiple style="display:none;">
            
            <button id="btnSubmitComment" style="background:#1f2937; color:white; border:none; border-radius:8px; padding:0.6rem 1.2rem; font-weight:600; cursor:pointer; transition:background 0.2s;">댓글 남기기</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 댓글 리스트 영역 -->
    <div id="commentListContainer" style="display:flex; flex-direction:column; gap:1.5rem;">
      <div style="text-align:center; padding:3rem 0; color:#9ca3af;">댓글을 불러오는 중입니다...</div>
    </div>
  `;

  tabReviewContainer.appendChild(commentsWrapper);

  // 기존 빈 텍스트("아직 등록된 리뷰가 없습니다.") 숨김 처리
  const emptyText = tabReviewContainer.querySelector('.tab-empty-text');
  if (emptyText) emptyText.style.display = 'none';

  // 상태 관리
  let currentFestivalId = new URLSearchParams(window.location.search).get('eventNo') || new URLSearchParams(window.location.search).get('id');
  let allComments = [];
  let allReviews = [];

  // 로그인 체크 (UI용)
  const isLoggedIn = !!localStorage.getItem('userToken') || !!sessionStorage.getItem('userToken') || localStorage.getItem('isLoggedIn') === 'true';
  const commentInput = document.getElementById('commentContent');
  const btnSubmit = document.getElementById('btnSubmitComment');
  const myProfileAvatarWrap = document.getElementById('myProfileAvatarWrap');

  const commentMediaFile = document.getElementById('commentMediaFile');
  const mediaPreviewContainer = document.getElementById('mediaPreviewContainer');

  let selectedFiles = [];

  if (!isLoggedIn) {
    commentInput.disabled = true;
    commentInput.placeholder = "로그인 후 댓글을 남겨보세요.";
    btnSubmit.style.background = "#9ca3af";
    btnSubmit.style.cursor = "not-allowed";
    btnSubmit.disabled = true;
    if (commentMediaFile) commentMediaFile.disabled = true;
    if (myProfileAvatarWrap) {
      myProfileAvatarWrap.style.width = '40px';
      myProfileAvatarWrap.style.height = '40px';
      myProfileAvatarWrap.innerHTML = getAvatarSVG('U');
    }
  } else {
    const myGender = localStorage.getItem('userGender') || 'U';
    const savedAvatar = localStorage.getItem('festio_avatar');
    if (myProfileAvatarWrap) {
      myProfileAvatarWrap.style.width = '40px';
      myProfileAvatarWrap.style.height = '40px';
      if (savedAvatar) {
        myProfileAvatarWrap.innerHTML = `<img src="${savedAvatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      } else {
        myProfileAvatarWrap.innerHTML = getAvatarSVG(myGender);
      }
    }
  }

  // 첨부파일 이벤트
  if (commentMediaFile) {
    commentMediaFile.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      files.forEach(file => {
        // 용량 검증 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('첨부 파일은 개별 10MB를 초과할 수 없습니다.');
          return;
        }
        selectedFiles.push(file);
      });

      renderMediaPreviews();
      commentMediaFile.value = '';
    });
  }

  function renderMediaPreviews() {
    mediaPreviewContainer.innerHTML = '';
    if (selectedFiles.length === 0) {
      mediaPreviewContainer.style.display = 'none';
      return;
    }
    mediaPreviewContainer.style.display = 'flex';

    selectedFiles.forEach((file, index) => {
      const fileUrl = URL.createObjectURL(file);
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.width = '120px';
      wrapper.style.height = '120px';
      wrapper.style.flexShrink = '0';

      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = fileUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        wrapper.appendChild(img);
      } else if (file.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.src = fileUrl;
        vid.style.width = '100%';
        vid.style.height = '100%';
        vid.style.objectFit = 'cover';
        vid.style.borderRadius = '8px';
        wrapper.appendChild(vid);
      }

      const btnRemove = document.createElement('button');
      btnRemove.innerHTML = '&times;';
      btnRemove.style.position = 'absolute';
      btnRemove.style.top = '4px';
      btnRemove.style.right = '4px';
      btnRemove.style.background = '#4b5563';
      btnRemove.style.color = 'white';
      btnRemove.style.border = 'none';
      btnRemove.style.borderRadius = '50%';
      btnRemove.style.width = '20px';
      btnRemove.style.height = '20px';
      btnRemove.style.fontSize = '12px';
      btnRemove.style.cursor = 'pointer';
      btnRemove.style.display = 'none';

      wrapper.addEventListener('mouseenter', () => btnRemove.style.display = 'block');
      wrapper.addEventListener('mouseleave', () => btnRemove.style.display = 'none');

      btnRemove.onclick = () => {
        selectedFiles.splice(index, 1);
        renderMediaPreviews();
      };

      wrapper.appendChild(btnRemove);
      mediaPreviewContainer.appendChild(wrapper);
    });
  }

  // 초기 렌더링 호출
  if (currentFestivalId) {
    loadAllCommentsAndReviews(currentFestivalId);
    setupRealtimeSubscription(currentFestivalId);
  }

  // 댓글 등록 이벤트
  btnSubmit.addEventListener('click', async () => {
    if (!isLoggedIn) return window.Toast.info('로그인이 필요합니다.');
    const content = commentInput.value.trim();
    if (!content && selectedFiles.length === 0) return window.Toast.warning('내용을 입력하거나 파일을 첨부해주세요.');

    try {
      btnSubmit.disabled = true;
      btnSubmit.innerText = '등록 중...';

      let mediaUrlStr = null;
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(f => window.commentApi.uploadCommentMedia(f));
        const mediaUrls = await Promise.all(uploadPromises);
        mediaUrlStr = mediaUrls.join(',');
      }

      await window.commentApi.addComment(currentFestivalId, content, null, mediaUrlStr);

      commentInput.value = '';
      selectedFiles = [];
      if (commentMediaFile) commentMediaFile.value = '';
      renderMediaPreviews();

      loadAllCommentsAndReviews(currentFestivalId);
      window.Toast.success('댓글이 등록되었습니다.');
    } catch (err) {
      console.error(err);
      window.Toast.error('댓글 등록에 실패했습니다: ' + (err.message || err.toString()));
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerText = '댓글 남기기';
    }
  });

  // 현재 로그인한 사용자 정보 캐싱
  let currentUser = null;

  // 데이터 로드
  async function loadAllCommentsAndReviews(festivalId) {
    try {
      const sb = window.getSupabase();
      if (sb) {
        try {
          const authRes = await sb.auth.getUser();
          if (authRes && authRes.data && authRes.data.user) {
            currentUser = authRes.data.user;
          }
        } catch (authErr) {
          console.warn('Failed to fetch auth user in loadAllCommentsAndReviews:', authErr);
        }
      }
      // API 병렬 호출 (리뷰는 MOCK 데이터가 올 수 있음)
      const [comments, reviews] = await Promise.all([
        window.commentApi.getComments(festivalId),
        window.reviewApi ? getFestivalReviews(festivalId) : []
      ]);
      allComments = comments || [];
      allReviews = reviews || [];
      renderList();
    } catch (e) {
      console.error(e);
      document.getElementById('commentListContainer').innerHTML = `<div style="text-align:center; padding:2rem; color:#ef4444;">데이터를 불러오는 데 실패했습니다.</div>`;
    }
  }

  async function getFestivalReviews(festivalId) {
    if (window.USE_MOCK) return window.MOCK.reviews.filter(r => r.festival_id == festivalId);
    const sb = window.getSupabase();
    if (!sb) return (window.MOCK?.reviews || []).filter(r => r.festival_id == festivalId);
    try {
      const { data, error } = await sb.from('review').select('*, app_user:user_id(name)').eq('festival_id', festivalId);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Failed to fetch reviews from Supabase. Falling back to mock data.', e);
      if (window.markSupabaseUnreachable) {
        window.markSupabaseUnreachable(e);
      }
      return (window.MOCK?.reviews || []).filter(r => r.festival_id == festivalId);
    }
  }

  // 리스트 렌더링
  function renderList() {
    const container = document.getElementById('commentListContainer');
    if (!container) return;
    container.innerHTML = '';

    // 예매자 후기(Reviews) 변환
    const reviewItems = allReviews.map(r => ({
      isReview: true,
      id: 'rev_' + r.id,
      author_name: r.app_user?.name || '예매자',
      content: r.content,
      rating: r.rating,
      created_at: r.created_at,
    }));

    // 소통 댓글(Comments) 변환 - 부모 자식 구조 트리화
    const parentComments = allComments.filter(c => !c.parent_id);
    const childComments = allComments.filter(c => c.parent_id);

    parentComments.forEach(p => {
      p.replies = childComments.filter(c => c.parent_id === p.id);
    });

    // 리뷰와 최상위 댓글 합치기 및 시간순 정렬
    let combined = [...reviewItems, ...parentComments];
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (combined.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:3rem 0; color:#6b7280; background:#f9fafb; border-radius:12px;">아직 등록된 후기나 댓글이 없습니다. 첫 번째로 남겨보세요!</div>`;
      return;
    }

    combined.forEach(item => {
      if (item.isReview) {
        container.appendChild(createReviewElement(item));
      } else {
        container.appendChild(createCommentElement(item));
      }
    });
  }

  // 예매자 리뷰 렌더링
  function createReviewElement(review) {
    const div = document.createElement('div');
    div.className = 'comment-item review-verified';
    div.style.padding = '1.2rem';
    div.style.background = '#ffffff';
    div.style.border = '1px solid #e5e7eb';
    div.style.borderRadius = '12px';
    div.style.marginBottom = '1rem';

    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += `<svg width="16" height="16" viewBox="0 0 24 24" fill="${i < review.rating ? '#fbbf24' : '#e5e7eb'}" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }

    const dateStr = new Date(review.created_at).toLocaleDateString('ko-KR');

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
        <div style="display:flex; align-items:center; gap:0.8rem;">
          <div style="width:40px; height:40px; border-radius:50%; background:#f3f4f6; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#9ca3af;">R</div>
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-weight:700; color:#1f2937;">${review.author_name}</span>
              <span style="background:#e0e7ff; color:#4338ca; font-size:0.75rem; padding:0.2rem 0.5rem; border-radius:10px; font-weight:600; display:flex; align-items:center; gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>예매자 인증</span>
            </div>
            <div style="color:#9ca3af; font-size:0.85rem; margin-top:2px;">${dateStr}</div>
          </div>
        </div>
        <div style="display:flex; gap:2px;">${stars}</div>
      </div>
      <div style="color:#374151; font-size:1rem; line-height:1.5;">${escapeHtml(review.content)}</div>
    `;
    return div;
  }

  // 실시간 댓글 렌더링
  function createCommentElement(comment, isReply = false) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.id = comment.id;

    const currentUser = window.FS && window.FS.Session ? window.FS.Session.get() : null;
    const isMyComment = currentUser && currentUser.id === comment.user_id;
    let avatarHtml = '';

    if (isMyComment) {
      const savedAvatar = localStorage.getItem('festio_avatar');
      const myGender = localStorage.getItem('userGender') || 'U';
      if (savedAvatar) {
        avatarHtml = `<img src="${savedAvatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      } else {
        avatarHtml = getAvatarSVG(myGender);
      }
    } else {
      const authorGender = comment.author_gender || 'U';
      if (comment.author_avatar) {
        avatarHtml = `<img src="${comment.author_avatar}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      } else {
        avatarHtml = getAvatarSVG(authorGender);
      }
    }

    // 대댓글 스타일 처리
    if (isReply) {
      div.style.marginLeft = '3rem';
      div.style.marginTop = '1rem';
      div.style.paddingLeft = '1rem';
      div.style.borderLeft = '2px solid #e5e7eb';
    } else {
      div.style.padding = '1.2rem 0';
      div.style.borderBottom = '1px solid #f3f4f6';
    }

    const dateStr = formatTimeAgo(new Date(comment.created_at));
    const likeIconColor = comment.is_liked ? '#ef4444' : 'currentColor';
    const likeFill = comment.is_liked ? '#ef4444' : 'none';

    let contentHtml = escapeHtml(comment.content);
    if (comment.is_deleted) {
      contentHtml = `<span style="color:#9ca3af; font-style:italic;">삭제된 댓글입니다.</span>`;
    }

    let mediaHtml = '';
    if (comment.media_url && !comment.is_deleted) {
      const urls = comment.media_url.split(',');
      mediaHtml = '<div style="margin-top:0.8rem; display:flex; gap:0.5rem; flex-wrap:nowrap; overflow-x:auto; padding-bottom:0.5rem;">';
      urls.forEach(url => {
        const isVideo = url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video');
        if (isVideo) {
          mediaHtml += `<div style="width:120px; height:120px; flex-shrink:0;"><video src="${url}" controls style="width:100%; height:100%; object-fit:cover; border-radius:8px;"></video></div>`;
        } else {
          mediaHtml += `<div style="width:120px; height:120px; flex-shrink:0;"><img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;"></div>`;
        }
      });
      mediaHtml += '</div>';
    }

    // 본인 작성 댓글인 경우 호버용 액션 버튼 추가
    let actionButtonsHtml = '';
    if (currentUser && currentUser.id === comment.user_id && !comment.is_deleted && !comment.isReview) {
      actionButtonsHtml = `
        <div class="comment-actions" style="display:none; gap:0.5rem; font-size:0.8rem; color:#6b7280; margin-left:auto; align-items:center;">
          <button class="btn-edit-comment" data-id="${comment.id}" style="background:none; border:none; cursor:pointer; color:inherit; padding:0; text-decoration:underline;">수정</button>
          <button class="btn-delete-comment" data-id="${comment.id}" style="background:none; border:none; cursor:pointer; color:inherit; padding:0; text-decoration:underline;">삭제</button>
        </div>
      `;
    }

    div.innerHTML = `
      <div style="display:flex; gap:1rem; width:100%;">
        <div style="width:40px; height:40px; flex-shrink:0;">${avatarHtml}</div>
        <div style="flex:1; min-width:0; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-weight:600; color:#111827;">${comment.author_name}</span>
              <span style="color:#9ca3af; font-size:0.85rem;">${dateStr}</span>
            </div>
            ${actionButtonsHtml}
          </div>
          
          <div class="comment-content-area" data-id="${comment.id}" style="color:#374151; font-size:0.95rem; line-height:1.5; word-break:break-all;">
            ${contentHtml}
            ${mediaHtml}
          </div>
          
          <div class="comment-edit-area" data-id="${comment.id}" style="display:none; margin-top:0.5rem;">
            <textarea class="edit-input" rows="2" style="width:100%; border:1px solid #d1d5db; border-radius:6px; padding:0.6rem; font-size:0.9rem; resize:none; outline:none; margin-bottom:0.5rem;">${comment.content || ''}</textarea>
            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
              <button class="btn-cancel-edit" data-id="${comment.id}" style="background:#f3f4f6; color:#4b5563; border:none; border-radius:6px; padding:0.4rem 0.8rem; font-weight:500; cursor:pointer;">취소</button>
              <button class="btn-save-edit" data-id="${comment.id}" style="background:#1f2937; color:white; border:none; border-radius:6px; padding:0.4rem 0.8rem; font-weight:500; cursor:pointer;">저장</button>
            </div>
          </div>

          
          ${!comment.is_deleted ? `
          <div style="display:flex; gap:1rem; align-items:center;">
            <button class="btn-like" data-id="${comment.id}" style="display:flex; align-items:center; gap:0.3rem; background:none; border:none; cursor:pointer; color:#6b7280; font-size:0.85rem; padding:0; transition:color 0.2s;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${likeFill}" stroke="${likeIconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:all 0.2s;"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"></path></svg>
              <span>${comment.like_count}</span>
            </button>
            ${!isReply ? `<button class="btn-reply" data-id="${comment.id}" style="display:flex; align-items:center; gap:0.3rem; background:none; border:none; cursor:pointer; color:#6b7280; font-size:0.85rem; padding:0;">대댓글 달기</button>` : ''}
            <button class="btn-report" data-id="${comment.id}" style="display:flex; align-items:center; gap:0.3rem; background:none; border:none; cursor:pointer; color:#9ca3af; font-size:0.85rem; padding:0; margin-left:auto;">신고</button>
          </div>
          ` : ''}
          
          <!-- 대댓글 입력 폼 (기본 숨김) -->
          <div class="reply-form-container" id="reply-form-${comment.id}" style="display:none; margin-top:1rem; padding:1rem; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
            <div style="display:flex; gap:0.8rem;">
              <textarea class="reply-input" rows="2" placeholder="대댓글을 입력하세요..." style="flex:1; border:1px solid #d1d5db; border-radius:6px; padding:0.6rem; font-size:0.9rem; resize:none; outline:none;"></textarea>
              <button class="btn-submit-reply" data-parent-id="${comment.id}" style="background:#4b5563; color:white; border:none; border-radius:6px; padding:0 1rem; font-weight:600; cursor:pointer;">등록</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 대댓글이 있는 경우 재귀적 렌더링
    if (comment.replies && comment.replies.length > 0) {
      const repliesContainer = document.createElement('div');
      repliesContainer.className = 'replies-container';
      comment.replies.forEach(reply => {
        repliesContainer.appendChild(createCommentElement(reply, true));
      });
      div.appendChild(repliesContainer);
    }

    // 이벤트 리스너 부착
    attachCommentEvents(div, comment.id);

    return div;
  }

  function attachCommentEvents(el, commentId) {
    const actions = el.querySelector('.comment-actions');
    if (actions) {
      el.addEventListener('mouseenter', () => actions.style.display = 'flex');
      el.addEventListener('mouseleave', () => actions.style.display = 'none');
    }

    const btnEdit = el.querySelector(`.btn-edit-comment[data-id="${commentId}"]`);
    const btnDelete = el.querySelector(`.btn-delete-comment[data-id="${commentId}"]`);
    const btnCancelEdit = el.querySelector(`.btn-cancel-edit[data-id="${commentId}"]`);
    const btnSaveEdit = el.querySelector(`.btn-save-edit[data-id="${commentId}"]`);
    const contentArea = el.querySelector(`.comment-content-area[data-id="${commentId}"]`);
    const editArea = el.querySelector(`.comment-edit-area[data-id="${commentId}"]`);
    const editInput = el.querySelector(`.comment-edit-area[data-id="${commentId}"] .edit-input`);

    if (btnEdit) {
      btnEdit.addEventListener('click', () => {
        contentArea.style.display = 'none';
        editArea.style.display = 'block';
        editInput.focus();
      });
    }

    if (btnCancelEdit) {
      btnCancelEdit.addEventListener('click', () => {
        editArea.style.display = 'none';
        contentArea.style.display = 'block';
      });
    }

    if (btnSaveEdit) {
      btnSaveEdit.addEventListener('click', async () => {
        const newContent = editInput.value.trim();
        if (!newContent) return window.Toast.warning('내용을 입력해주세요.');
        btnSaveEdit.innerText = '저장 중...';
        btnSaveEdit.disabled = true;
        try {
          await window.commentApi.updateComment(commentId, newContent);
          window.Toast.success('수정되었습니다.');
          loadAllCommentsAndReviews(currentFestivalId);
        } catch (err) {
          console.error(err);
          window.Toast.error('수정에 실패했습니다: ' + (err.message || err.toString()));
          btnSaveEdit.innerText = '저장';
          btnSaveEdit.disabled = false;
        }
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (!confirm('정말 이 댓글을 삭제하시겠습니까?')) return;
        try {
          await window.commentApi.deleteComment(commentId);
          window.Toast.success('댓글이 삭제되었습니다.');
          loadAllCommentsAndReviews(currentFestivalId);
        } catch (err) {
          console.error(err);
          window.Toast.error('삭제에 실패했습니다: ' + (err.message || err.toString()));
        }
      });
    }

    const btnLike = el.querySelector(`.btn-like[data-id="${commentId}"]`);
    if (btnLike) {
      btnLike.addEventListener('click', async () => {
        if (!isLoggedIn) return window.Toast.info('로그인이 필요합니다.');
        try {
          await window.commentApi.toggleLike(commentId);
          loadAllCommentsAndReviews(currentFestivalId);
        } catch (err) {
          console.error(err);
          window.Toast.error('좋아요 처리에 실패했습니다: ' + (err.message || err.toString()));
        }
      });
    }

    const btnReply = el.querySelector(`.btn-reply[data-id="${commentId}"]`);
    if (btnReply) {
      btnReply.addEventListener('click', () => {
        if (!isLoggedIn) return alert('로그인이 필요합니다.');
        const form = document.getElementById(`reply-form-${commentId}`);
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
    }

    const btnSubmitReply = el.querySelector(`.btn-submit-reply[data-parent-id="${commentId}"]`);
    if (btnSubmitReply) {
      btnSubmitReply.addEventListener('click', async () => {
        const input = el.querySelector('.reply-input');
        const content = input.value.trim();
        if (!content) return alert('내용을 입력하세요.');
        try {
          btnSubmitReply.disabled = true;
          await window.commentApi.addComment(currentFestivalId, content, commentId);
          input.value = '';
          document.getElementById(`reply-form-${commentId}`).style.display = 'none';
          loadAllCommentsAndReviews(currentFestivalId);
        } catch (e) {
          console.error(e);
          alert('대댓글 등록 실패');
        } finally {
          btnSubmitReply.disabled = false;
        }
      });
    }

    const btnReport = el.querySelector(`.btn-report[data-id="${commentId}"]`);
    if (btnReport) {
      btnReport.addEventListener('click', () => {
        if (!isLoggedIn) return alert('로그인이 필요합니다.');
        showReportModal(commentId);
      });
    }
  }

  // 신고 모달 표시 (detail.html에 모달 마크업 필요)
  function showReportModal(commentId) {
    let modal = document.getElementById('reportCommentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'reportCommentModal';
      modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10001; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
      modal.innerHTML = `
        <div style="background:#fff; width:340px; border-radius:16px; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
          <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#111827;">댓글 신고하기</h3>
          <p style="margin:0; font-size:0.9rem; color:#6b7280;">신고 사유를 선택해주세요. 관리자 검토 후 조치됩니다.</p>
          <select id="reportReasonSelect" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid #d1d5db; outline:none; font-size:0.95rem;">
            <option value="스팸/홍보">스팸/홍보성 내용</option>
            <option value="욕설/비방">욕설/비방</option>
            <option value="음란물">음란물</option>
            <option value="개인정보노출">개인정보 노출</option>
            <option value="기타">기타 부적절한 내용</option>
          </select>
          <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
            <button id="btnCancelReport" style="flex:1; background:#f3f4f6; border:none; padding:0.7rem; border-radius:8px; color:#4b5563; font-weight:600; cursor:pointer;">취소</button>
            <button id="btnSubmitReport" style="flex:1; background:#ef4444; border:none; padding:0.7rem; border-radius:8px; color:#fff; font-weight:600; cursor:pointer;">신고 접수</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';

    const btnCancel = modal.querySelector('#btnCancelReport');
    const btnSubmit = modal.querySelector('#btnSubmitReport');

    btnCancel.onclick = () => { modal.style.display = 'none'; };
    btnSubmit.onclick = async () => {
      const reason = modal.querySelector('#reportReasonSelect').value;
      try {
        await window.commentApi.reportComment(commentId, reason);
        alert('신고가 접수되었습니다.');
        modal.style.display = 'none';
      } catch (e) {
        console.error(e);
        alert('신고 접수에 실패했습니다.');
      }
    };
  }

  // 실시간 통신 (Realtime) 셋업
  function setupRealtimeSubscription(festivalId) {
    if (window.USE_MOCK) return;
    const sb = window.getSupabase();
    if (!sb) return;

    try {
      sb.channel('public:event_comments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'event_comments', filter: `festival_id=eq.${festivalId}` }, payload => {
          loadAllCommentsAndReviews(festivalId);
        })
        .subscribe();

      sb.auth.getUser().then(res => {
        if (res && res.data && res.data.user) {
          sb.channel('public:user_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${res.data.user.id}` }, payload => {
              updateNotificationBadge();
            })
            .subscribe();
        }
      }).catch(e => {
        console.warn('Supabase realtime auth check failed:', e);
      });
    } catch (err) {
      console.warn('Supabase realtime subscription failed:', err);
    }
  }

  // 알림 배지 카운트 갱신
  async function updateNotificationBadge() {
    if (!isLoggedIn) return;
    try {
      const notifs = await window.notificationApi.getMyNotifications();
      const unreadCount = notifs.filter(n => !n.is_read).length;
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        if (unreadCount > 0) {
          badge.style.display = 'block';
          badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) { console.error(e); }
  }

  // 유틸: XSS 방지
  function escapeHtml(unsafe) {
    return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/g, "<br>");
  }

  // 유틸: 시간 포맷
  function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    return date.toLocaleDateString('ko-KR');
  }

  // 전역 노출 (알림 배지 업데이트를 다른 곳에서도 호출할 수 있도록)
  window.updateNotificationBadge = updateNotificationBadge;
};

// 페이지 최초 로드 시 알림 버튼 클릭 이벤트 설정 및 배지 초기화
document.addEventListener('DOMContentLoaded', () => {
  const btnNotif = document.getElementById('btnHeaderNotification');
  if (btnNotif) {
    btnNotif.addEventListener('click', async () => {
      // 이미 열려있으면 닫기
      let dropdown = document.getElementById('notificationDropdown');
      if (dropdown) {
        dropdown.remove();
        return;
      }

      // 알림 드롭다운 생성
      dropdown = document.createElement('div');
      dropdown.id = 'notificationDropdown';
      dropdown.style.cssText = 'position:absolute; top:45px; right:0; width:300px; background:#fff; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.1); border:1px solid #e5e7eb; z-index:9999; display:flex; flex-direction:column; overflow:hidden; max-height:400px;';

      dropdown.innerHTML = `
        <div style="padding:1rem; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
          <h4 style="margin:0; font-weight:700; color:#111827;">알림</h4>
        </div>
        <div id="notificationList" style="overflow-y:auto; flex:1;">
          <div style="padding:2rem; text-align:center; color:#9ca3af; font-size:0.9rem;">로딩 중...</div>
        </div>
      `;
      btnNotif.appendChild(dropdown);

      // 빈 공간 클릭 시 드롭다운 닫기
      setTimeout(() => {
        const closeDropdown = (e) => {
          if (!btnNotif.contains(e.target)) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
          }
        };
        document.addEventListener('click', closeDropdown);
      }, 10);

      // 데이터 패치
      try {
        const notifs = await window.notificationApi.getMyNotifications();
        const listContainer = dropdown.querySelector('#notificationList');
        listContainer.innerHTML = '';

        if (!notifs || notifs.length === 0) {
          listContainer.innerHTML = '<div style="padding:2rem; text-align:center; color:#9ca3af; font-size:0.9rem;">새로운 알림이 없습니다.</div>';
          return;
        }

        for (const n of notifs) {
          const item = document.createElement('div');
          item.style.cssText = `padding:1rem; border-bottom:1px solid #f3f4f6; cursor:pointer; background:${n.is_read ? '#fff' : '#f0fdf4'}; transition:background 0.2s;`;

          let msg = '';
          if (n.type === 'REPLY') msg = `<b>${n.sender?.name || '누군가'}</b>님이 대댓글을 남겼습니다.`;
          else if (n.type === 'LIKE') msg = `<b>${n.sender?.name || '누군가'}</b>님이 회원님의 댓글을 좋아합니다.`;

          const dateStr = new Date(n.created_at).toLocaleDateString();
          item.innerHTML = `
            <div style="font-size:0.9rem; color:#374151; margin-bottom:0.3rem;">${msg}</div>
            <div style="font-size:0.75rem; color:#9ca3af;">${dateStr}</div>
          `;

          item.addEventListener('click', async (e) => {
            e.stopPropagation(); // 드롭다운 닫히지 않도록
            if (!n.is_read) {
              await window.notificationApi.markAsRead(n.id);
              item.style.background = '#fff';
              n.is_read = true;
              if (typeof window.updateNotificationBadge === 'function') {
                window.updateNotificationBadge();
              }
            }
          });

          listContainer.appendChild(item);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // 페이지 로드 시 알림 초기화
  if (typeof window.updateNotificationBadge === 'function') {
    window.updateNotificationBadge();
  }

  // 편집 모드 시 댓글 영역을 숨기는 CSS 동적 삽입
  if (!document.getElementById('comment-edit-mode-style')) {
    const style = document.createElement('style');
    style.id = 'comment-edit-mode-style';
    style.textContent = `
      body.edit-mode #dynamic-comments-section {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // 리뷰 탭이 페이지 빌더를 통해 동적으로 삭제/추가되는 것을 감지하여 UI를 재초기화
  const observer = new MutationObserver(() => {
    let hasTabReview = document.getElementById('tab-review');
    if (!hasTabReview) {
      const tabBtns = document.querySelectorAll('.detail-tab-btn');
      for (const btn of tabBtns) {
        if (btn.textContent.includes('리뷰') || btn.textContent.includes('후기')) {
          const targetId = btn.dataset.target;
          if (targetId) {
            hasTabReview = document.getElementById(targetId);
            break;
          }
        }
      }
    }

    const hasComments = document.getElementById('dynamic-comments-section');
    if (hasTabReview && !hasComments && typeof window.initCommentUI === 'function') {
      window.initCommentUI();
    }
  });

  const detailTabsSection = document.getElementById('detailTabsSection') || document.body;
  observer.observe(detailTabsSection, { childList: true, subtree: true });
});
