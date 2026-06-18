/* custom_goods.js */

document.addEventListener('DOMContentLoaded', () => {
  // 헤더 렌더링 추가
  if (window.FS && window.FS.renderHeader) {
    window.FS.renderHeader();
  }

  const uploadArea = document.getElementById('cgUploadArea');
  const fileInput = document.getElementById('cgFileInput');
  const previewImage = document.getElementById('cgPreviewImage');
  const resetBtn = document.getElementById('cgResetImageBtn');
  const btnGenerateAi = document.getElementById('btnGenerateAi');

  const step1 = document.getElementById('cgUploadStep');
  const step2 = document.getElementById('cgResultStep');

  const overlay = document.getElementById('cgLoadingOverlay');
  const progressBar = document.getElementById('cgProgressBar');
  const loadingText = document.getElementById('cgLoadingText');

  const resultImage = document.getElementById('cgResultImage');
  const btnRetryAi = document.getElementById('btnRetryAi');
  const btnMakeGoods = document.getElementById('btnMakeGoods');

  let selectedFile = null;

  // 1. 업로드 영역 클릭 시 파일 탐색기 열기
  uploadArea.addEventListener('click', (e) => {
    if (e.target === resetBtn || resetBtn.contains(e.target)) return;
    fileInput.click();
  });

  // 2. 드래그 앤 드롭
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  // 3. 파일 선택
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // 4. 파일 처리 및 미리보기
  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      if (window.Toast) window.Toast.error('이미지 파일만 업로드 가능합니다.');
      else alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewImage.style.display = 'block';
      resetBtn.style.display = 'flex';
      btnGenerateAi.disabled = false;

      // 업로드 아이콘 및 텍스트 숨기기
      uploadArea.querySelectorAll('.cg-upload-icon, .cg-upload-text, .cg-upload-desc').forEach(el => {
        el.style.opacity = '0';
      });
    };
    reader.readAsDataURL(file);
  }

  // 5. 초기화 버튼
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 부모 클릭 이벤트 방지
    selectedFile = null;
    fileInput.value = '';
    previewImage.src = '';
    previewImage.style.display = 'none';
    resetBtn.style.display = 'none';
    btnGenerateAi.disabled = true;

    uploadArea.querySelectorAll('.cg-upload-icon, .cg-upload-text, .cg-upload-desc').forEach(el => {
      el.style.opacity = '1';
    });
  });

  // 6. AI 생성 로직 (Real API)
  btnGenerateAi.addEventListener('click', async () => {
    if (!selectedFile) return;

    // 로딩 시작
    overlay.style.display = 'flex';
    progressBar.style.width = '0%';

    let progress = 0;
    const loadingTexts = [
      "사진의 이목구비 분석 중...",
      "메이플스토리 공식 클라이언트 데이터베이스 대조 중...",
      "캐릭터 장비 및 비율 최적화 중...",
      "2D 픽셀 렌더링 중...",
      "거의 다 되었습니다!"
    ];
    let textIndex = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 5;
      if (progress >= 95) progress = 95; // API 완료 전까지 95% 대기
      progressBar.style.width = `${progress}%`;

      if (progress > 20 && textIndex === 0) { textIndex++; loadingText.innerText = loadingTexts[textIndex]; }
      if (progress > 40 && textIndex === 1) { textIndex++; loadingText.innerText = loadingTexts[textIndex]; }
      if (progress > 60 && textIndex === 2) { textIndex++; loadingText.innerText = loadingTexts[textIndex]; }
      if (progress > 80 && textIndex === 3) { textIndex++; loadingText.innerText = loadingTexts[textIndex]; }
    }, 400);

    try {
      // Hugging Face 무료 추론 API 키 (보안상 GitHub 업로드 방지를 위해 임시 값으로 변경)
      // 로컬 테스트 시 발급받으신 hf_... 키로 다시 변경해주세요!
      const HF_API_KEY = "YOUR_HUGGING_FACE_API_KEY";
      const prompt = `You are converting the subject into an ACTUAL playable MapleStory in-game player character.
This is NOT pixel art, fan art, or a general illustration. The final result must look like Nexon officially released the subject as a MapleStory character.
Body Proportion: Highest Priority. Extremely short, stubby, and compact legs. Head occupies 75% of total height.
Pose: Official MapleStory idle standing pose. Both arms hanging straight downward.
Face: Official MapleStory face preset look, large rounded irises, tiny nose, tiny mouth.
Outfit: Simplify into clean modern official MapleStory equipment.
Style: Nearest-neighbor scaling pixel look, simple shading, limited palette, pure white background #FFFFFF.`;

      // 백엔드 프록시 API 호출 (브라우저 차단 우회)
      const response = await fetch("/api/ai/generate", {
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST",
        body: JSON.stringify({
          prompt: prompt,
          apiKey: HF_API_KEY
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (errorData) {
          if (errorData.error === "DNS_ERROR") {
            throw new Error('백엔드 서버에서도 허깅페이스 서버를 찾을 수 없습니다. (PC 자체 방화벽 차단)');
          } else if (errorData.error && errorData.error.includes('loading')) {
            const waitTime = errorData.estimated_time ? Math.ceil(errorData.estimated_time) : 30;
            throw new Error(`AI 서버가 부팅 중입니다.\n약 ${waitTime}초 뒤에 다시 시도해 주세요.`);
          }
        }
        throw new Error('API 호출에 실패했습니다.');
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      clearInterval(interval);
      progressBar.style.width = '100%';

      setTimeout(() => {
        // 로딩 끝 -> 결과 보여주기
        overlay.style.display = 'none';
        step1.style.display = 'none';
        step2.style.display = 'block';

        // API에서 받아온 이미지 렌더링
        resultImage.src = imageUrl;
      }, 500);

    } catch (error) {
      clearInterval(interval);
      overlay.style.display = 'none';
      console.error(error);

      const isCustomError = error.message.includes('부팅 중');
      let msg = isCustomError ? error.message : 'AI 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        msg = '네트워크 오류가 발생했습니다. (DNS 조회 실패 또는 인터넷 연결 불안정)\\n인터넷 연결 상태나 방화벽/VPN 설정을 확인해주세요.';
      }

      if (window.Toast) window.Toast.error(msg, { duration: 5000 });
      else alert(msg);
    }
  });

  // 7. 다시 만들기
  btnRetryAi.addEventListener('click', () => {
    resetBtn.click();
    step2.style.display = 'none';
    step1.style.display = 'block';
  });

  // 8. 굿즈 제작하기
  btnMakeGoods.addEventListener('click', () => {
    if (window.Toast) window.Toast.success('생성된 AI 아바타로 굿즈 제작 화면으로 이동합니다!');
    else alert('생성된 AI 아바타로 굿즈 제작 화면으로 이동합니다!');
  });
});
