/**
 * @file appFooter.js
 * @description 전역 하단 푸터(Footer) 컴포넌트입니다. (퀸즈스마일 스타일 고도화)
 * 흰색 배경의 3열 그리드 구조로 완전히 재설계되었으며, 반응형 레이아웃을 지원합니다.
 */
(function () {

  /* ──────────────────────────────────────────────────────────────
   * SVG 아이콘 정의
   * ────────────────────────────────────────────────────────────── */
  const phoneSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;display:inline-block;vertical-align:middle;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

  const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;display:inline-block;vertical-align:middle;"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;

  const instaSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;

  const youtubeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px;"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.4a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none"/></svg>`;

  /* ──────────────────────────────────────────────────────────────
   * 인라인 CSS (미디어 쿼리 반응형 포함)
   * ────────────────────────────────────────────────────────────── */
  const footerStyle = `
    <style>
      /* 모바일(768px 미만)에서 푸터 숨김 */
      @media (max-width: 767px) {
        .app-footer { display: none !important; }
      }

      /* ── 푸터 전체 래퍼 ── */
      .app-footer {
        background-color: #ffffff;
        border-top: 1px solid #eaeaea;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        flex-shrink: 0;
      }

      /* ── 상단 링크 메뉴 바 ── */
      .ft-top-bar {
        border-bottom: 1px solid #eaeaea;
      }
      .ft-top-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 46px;
        gap: 16px;
      }
      .ft-top-links {
        display: flex;
        align-items: center;
        gap: 20px;
        list-style: none;
        margin: 0;
        padding: 0;
        flex-wrap: wrap;
      }
      .ft-top-links a {
        text-decoration: none;
        color: #555555;
        font-size: 12.5px;
        transition: color 0.2s;
        white-space: nowrap;
      }
      .ft-top-links a:hover { color: #111; }
      .ft-top-links a.bold { font-weight: 700; color: #333; }

      .ft-family-site select {
        padding: 5px 28px 5px 10px;
        border: 1px solid #d4d4d4;
        border-radius: 3px;
        color: #666;
        font-size: 12px;
        background: #fff;
        outline: none;
        cursor: pointer;
        transition: border-color 0.2s;
        white-space: nowrap;
      }
      .ft-family-site select:hover { border-color: #999; }

      /* ── 메인 본문 영역 ── */
      .ft-main-wrap {
        padding: 36px 0 32px;
      }
      .ft-main-inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
        display: flex;
        gap: 0;
        align-items: flex-start;
      }

      /* 1열: 회사 정보 */
      .ft-col-company {
        flex: 1 1 0;
        padding-right: 40px;
        min-width: 0;
      }
      .ft-logo-text {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -1.5px;
        color: #333333;
        font-family: 'Arial Black', sans-serif;
        line-height: 1;
        margin-bottom: 14px;
        display: block;
      }
      .ft-corp-name {
        font-size: 13px;
        font-weight: 700;
        color: #444;
        margin-bottom: 8px;
      }
      .ft-corp-info {
        font-size: 11.5px;
        color: #777777;
        line-height: 1.85;
        margin: 0 0 12px;
      }
      .ft-corp-info a {
        color: #555;
        text-decoration: none;
      }
      .ft-corp-info a:hover { color: #111; text-decoration: underline; }
      .ft-copyright {
        font-size: 11px;
        color: #aaaaaa;
        line-height: 1.6;
        margin: 0;
      }

      /* 구분선 공통 */
      .ft-divider {
        display: none;
        width: 1px;
        align-self: stretch;
        background: #eaeaea;
        flex-shrink: 0;
      }

      /* 2열: 고객센터 */
      .ft-col-cs {
        flex: 0 0 230px;
        padding: 0 36px;
        min-width: 0;
      }

      /* 3열: 1:1 문의 + SNS */
      .ft-col-contact {
        flex: 0 0 220px;
        padding-left: 36px;
        min-width: 0;
      }

      .ft-section-label {
        font-size: 11px;
        font-weight: 700;
        color: #aaa;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      .ft-section-title {
        font-size: 14px;
        font-weight: 700;
        color: #222;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .ft-section-title .ft-title-underbar {
        display: block;
        width: 24px;
        height: 2px;
        background: #e96d2b;
        border-radius: 2px;
        margin-top: 3px;
      }
      .ft-phone-num {
        font-size: 22px;
        font-weight: 800;
        color: #222;
        letter-spacing: -0.5px;
        margin: 0 0 8px;
        line-height: 1.2;
      }
      .ft-cs-time {
        font-size: 12px;
        color: #666;
        line-height: 1.8;
        margin: 0 0 4px;
      }
      .ft-cs-note {
        font-size: 11px;
        color: #aaa;
        line-height: 1.6;
        margin: 0;
      }

      /* 1:1 문의 버튼 */
      .ft-btn-inquiry {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 14px;
        padding: 9px 18px;
        background: #fff;
        border: 1.5px solid #333;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        color: #222;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
      }
      .ft-btn-inquiry:hover {
        background: #222;
        color: #fff;
      }

      .ft-inquiry-notice {
        font-size: 11.5px;
        color: #888;
        line-height: 1.6;
        margin: 0 0 16px;
      }
      .ft-inquiry-notice strong {
        color: #e96d2b;
        font-weight: 700;
      }

      /* SNS 아이콘 */
      .ft-sns-wrap {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }
      .ft-sns-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 1.5px solid #d4d4d4;
        background: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
        text-decoration: none;
        transition: border-color 0.2s, color 0.2s, background 0.2s;
        cursor: pointer;
      }
      .ft-sns-btn:hover {
        border-color: #333;
        color: #111;
        background: #f5f5f5;
      }

      /* ── 반응형: 태블릿 ── */
      @media (max-width: 1024px) {
        .ft-col-cs { flex: 0 0 200px; padding: 0 24px; }
        .ft-col-contact { flex: 0 0 190px; padding-left: 24px; }
        .ft-col-company { padding-right: 24px; }
      }

      /* ── 반응형: 세로 1열 전환 (768px~) ── */
      @media (max-width: 900px) and (min-width: 768px) {
        .ft-main-inner {
          flex-direction: column;
          gap: 28px;
        }
        .ft-divider { width: 100%; height: 1px; align-self: auto; }
        .ft-col-company { padding-right: 0; flex: none; width: 100%; }
        .ft-col-cs { flex: none; width: 100%; padding: 0; }
        .ft-col-contact { flex: none; width: 100%; padding-left: 0; }
      }
    </style>
  `;

  /* ──────────────────────────────────────────────────────────────
   * HTML 구조
   * ────────────────────────────────────────────────────────────── */
  const footerHtml = `
    ${footerStyle}
    <footer class="app-footer">

      <!-- ① 상단 링크 메뉴 바 -->
      <div class="ft-top-bar">
        <div class="ft-top-inner">
          <ul class="ft-top-links">
            <li><a href="#">회사소개</a></li>
            <li><a href="terms.html">이용약관</a></li>
            <li><a href="privacy.html" class="bold">개인정보처리방침</a></li>
            <li><a href="#" id="btn-youth-policy">청소년보호정책</a></li>
            <li><a href="guide.html">이용안내</a></li>
            <li><a href="guide.html?tab=tab-partner">티켓판매안내</a></li>
          </ul>
          <div class="ft-family-site">
            <select>
              <option>Family Site</option>
              <option>FESTIO 블로그</option>
              <option>FESTIO 파트너스</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ② 메인 3열 그리드 -->
      <div class="ft-main-wrap">
        <div class="ft-main-inner">

          <!-- 1열: 회사 정보 -->
          <div class="ft-col-company">
            <span class="ft-logo-text">FESTIO</span>
            <p class="ft-corp-name">FESTIO(주)</p>
            <p class="ft-corp-info">
              공동대표 : 강진원, 오하율<br>
              이메일 : FESTIO@festio.com<br>
              주소 : 서울특별시 마포구 월드컵북로 123 (상암동, 페스티오빌딩)<br>
              사업자등록번호 : 123-45-67890<br>
              통신판매업신고 : 제2026-서울마포-1234호<br>
              <a href="#">사업자 정보확인 &gt;</a><br>
              호스팅 서비스사업자 : FESTIO(주)
            </p>
            <p class="ft-copyright">
              Copyright &copy; FESTIO Corp. All Rights Reserved.
            </p>
          </div>

          <!-- 구분선 -->
          <div class="ft-divider"></div>

          <!-- 2열: 고객센터 -->
          <div class="ft-col-cs">
            <p class="ft-section-label">Customer Service</p>
            <div class="ft-section-title">
              ${phoneSvg}&nbsp;고객센터
            </div>
            <p class="ft-phone-num">1588-0000</p>
            <p class="ft-cs-time">
              평일 09:00 ~ 18:00<br>
              토요일 09:00 ~ 17:00
            </p>
            <p class="ft-cs-note">점심시간 12:00~13:00<br>일요일 · 공휴일 휴무</p>
          </div>

          <!-- 구분선 -->
          <div class="ft-divider"></div>

          <!-- 3열: 1:1 문의 + SNS -->
          <div class="ft-col-contact">
            <p class="ft-section-label">1:1 Inquiry</p>
            <a href="mypage.html#tab-inquiries" class="ft-btn-inquiry">
              ${editSvg} 1:1 문의하기
            </a>
            <p class="ft-inquiry-notice">
              오후 5시 이후 접수된 문의는<br>
              당일 답변이 어려울 수 있습니다.<br>
              <strong>FAQ를 먼저 확인해보세요!</strong>
            </p>
            <div class="ft-sns-wrap">
              <a href="#" class="ft-sns-btn" aria-label="인스타그램">${instaSvg}</a>
              <a href="#" class="ft-sns-btn" aria-label="유튜브">${youtubeSvg}</a>
            </div>
          </div>

        </div>
      </div>
    </footer>

    <!-- 청소년보호정책 모달 -->
    <div class="modal-overlay modal-center" id="youth-policy-modal" style="background:rgba(0,0,0,0.5);">
      <div class="modal-sheet" style="background:#ffffff !important;border:1px solid #ddd;max-width:800px;width:90%;opacity:1;">
        <div class="modal-header">
          <h2 class="modal-title" style="text-align:center;width:100%;font-size:22px;">FESTIO 청소년보호정책</h2>
          <button class="modal-close-btn" id="btn-close-youth-policy">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body" style="padding:30px;">
          <p style="margin-bottom:10px;font-size:14px;color:#555;">① FESTIO 주식회사(이하 회사)는 불건전한 유해매체물로부터 청소년을 보호하기 위하여, [청소년보호법], [정보통신망 이용촉진 및 정보보호등에 관한 법률] 등에 근거하여 청소년보호책임자를 지정하고 청소년보호정책을 시행하고 있습니다.</p>
          <p style="margin-bottom:30px;font-size:14px;color:#555;">② 회사는 정보통신윤리위원회 심의규정 및 청소년유해매체물 기준에 따라, 19세 미만의 청소년들이 유해매체물에 접근할 수 없도록 방지하고 있습니다.</p>
          <h3 style="font-size:16px;font-weight:bold;margin-bottom:15px;color:#333;">제1조 유해정보에 대한 청소년접근제한 및 관리조치</h3>
          <p style="margin-bottom:10px;font-size:14px;color:#555;">① 회사는 청소년이 불법, 유해한 매체물 유통 등으로 인한 피해를 입지 않도록 청소년 유해매체물에 대하여 별도의 성인인증 장치를 적용하며, 청소년 유해정보가 노출되지 않도록 예방합니다.</p>
          <p style="margin-bottom:30px;font-size:14px;color:#555;">② 회사는 게시물을 포함하여 회사가 제공하는 서비스의 금칙어 및 청소년 보호와 관련된 모니터링을 실시하며 주기적으로 관리하고 있습니다.</p>
          <h3 style="font-size:16px;font-weight:bold;margin-bottom:15px;color:#333;">제2조 유해정보로부터의 청소년보호를 위한 업무 담당자 교육</h3>
          <p style="margin-bottom:30px;font-size:14px;color:#555;">회사는 정보통신업무 종사자를 대상으로 청소년 보호와 관련된 법령 및 제재기준, 유해정보 발견시 대처방법, 위반사항 처리에 대한 보고절차 등을 교육하고 있습니다.</p>
          <h3 style="font-size:16px;font-weight:bold;margin-bottom:15px;color:#333;">제3조 유해정보로 인한 피해상담 및 고충처리</h3>
          <p style="margin-bottom:10px;font-size:14px;color:#555;">① 회사는 청소년 유해매체물의 유통으로 인한 피해신고 및 처리를 위하여 신고센터를 통한 신고를 접수 받고 있습니다.</p>
          <p style="margin-bottom:10px;font-size:14px;color:#555;">② 청소년 유해매체물 신고센터 메일주소는 '청소년보호정책'에 명시되어 언제든지 확인 할 수 있습니다.</p>
          <p style="margin-bottom:30px;font-size:14px;color:#555;">③ 청소년 유해매체물로 확인되는 경우 매체물 등록자에게 경고조치 또는 위법성을 검토하여 삭제 등의 조치를 취합니다.</p>
          <h3 style="font-size:16px;font-weight:bold;margin-bottom:15px;color:#333;">제4조 청소년보호 책임 및 담당자</h3>
          <p style="margin-bottom:15px;font-size:14px;color:#555;">FESTIO 주식회사는 청소년들이 정신적·신체적으로 유해한 환경으로부터 보호받을 수 있도록 최선의 노력을 다하고 있습니다.</p>
          <table style="width:100%;border-collapse:collapse;border-top:2px solid #ddd;border-bottom:1px solid #ddd;margin-bottom:20px;">
            <colgroup><col style="width:30%;"><col style="width:70%;"></colgroup>
            <tbody>
              <tr>
                <th style="background:#f9f9f9;padding:15px;font-size:14px;color:#333;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">청소년 보호책임자</th>
                <td style="padding:15px;font-size:14px;color:#555;border-bottom:1px solid #eee;">
                  <ul style="list-style:none;padding:0;margin:0;line-height:1.8;">
                    <li>· 성 명 : 강진원</li>
                    <li>· 소속부서 : 플랫폼본부</li>
                    <li>· 직 위 : 팀장</li>
                    <li>· 전화번호 : 1588-0000</li>
                    <li>· 이 메 일 : teensafe@festio.com</li>
                  </ul>
                </td>
              </tr>
              <tr>
                <th style="background:#f9f9f9;padding:15px;font-size:14px;color:#333;text-align:center;font-weight:bold;">청소년 보호담당자</th>
                <td style="padding:15px;font-size:14px;color:#555;">
                  <ul style="list-style:none;padding:0;margin:0;line-height:1.8;">
                    <li>· 성 명 : 오하율</li>
                    <li>· 소속부서 : 플랫폼본부</li>
                    <li>· 전화번호 : 1588-0000</li>
                    <li>· 이 메 일 : teensafe@festio.com</li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  `;

  document.write(footerHtml);

  // 청소년보호정책 모달 이벤트 처리
  window.addEventListener('DOMContentLoaded', function () {
    const btnYouthPolicy = document.getElementById('btn-youth-policy');
    const modalYouthPolicy = document.getElementById('youth-policy-modal');
    const btnCloseYouth = document.getElementById('btn-close-youth-policy');

    if (btnYouthPolicy && modalYouthPolicy && btnCloseYouth) {
      btnYouthPolicy.addEventListener('click', function (e) {
        e.preventDefault();
        modalYouthPolicy.classList.add('active');
      });
      btnCloseYouth.addEventListener('click', function () {
        modalYouthPolicy.classList.remove('active');
      });
      // 배경 클릭 시 닫기
      modalYouthPolicy.addEventListener('click', function (e) {
        if (e.target === modalYouthPolicy) {
          modalYouthPolicy.classList.remove('active');
        }
      });
    }

  });
})();
