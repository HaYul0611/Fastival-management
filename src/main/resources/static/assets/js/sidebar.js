document.addEventListener("DOMContentLoaded", function () {
    const layoutMenu = document.getElementById("layout-menu");
    if (!layoutMenu) return;

    // 현재 URL 경로 분석
    const path = window.location.pathname;

    // 메뉴 항목 정의 (역할 및 세부 도메인별 초정밀 라우터 매핑)
    const menuTree = [
        {
            type: "header",
            text: "통합 최고 관리자 (Admin)"
        },
        {
            type: "item",
            text: "통합 관제 대시보드",
            icon: "bx bx-home-smile",
            url: "/features/user/admin/dashboard.html"
        },
        {
            type: "item",
            text: "입점 신청 승인",
            icon: "bx bx-list-check",
            url: "/features/user/admin/store-applications.html"
        },
        {
            type: "item",
            text: "입점 가맹점 목록",
            icon: "bx bx-store",
            url: "/features/user/admin/store-list.html"
        },
        {
            type: "item",
            text: "페스티벌 / 구역 셋업",
            icon: "bx bx-map-alt",
            url: "/features/festival/admin/festival-setup.html"
        },
        {
            type: "item",
            text: "회원 및 등급 관리",
            icon: "bx bx-user",
            url: "/features/user/admin/member-management.html"
        },
        {
            type: "item",
            text: "1:1 답변 및 상담",
            icon: "bx bx-support",
            url: "/features/support/admin/customer-center.html"
        },
        {
            type: "item",
            text: "가맹점 정산 관리",
            icon: "bx bx-calculator",
            url: "/features/settlement/admin/settlement.html"
        },
        {
            type: "item",
            text: "긴급 재난 방송",
            icon: "bx bx-error-alt",
            url: "/features/festival/admin/emergency-broadcast.html"
        },
        {
            type: "item",
            text: "GPS 기반 혼잡도 히트맵",
            icon: "bx bx-map-pin",
            url: "/features/festival/admin/crowd-heatmap.html"
        },
        {
            type: "header",
            text: "소비자 클라이언트 (Client)"
        },
        {
            type: "item",
            text: "[티켓] 실시간 좌석 예매",
            icon: "bx bx-grid-alt",
            url: "/features/payment/client/seat-map.html"
        },
        {
            type: "item",
            text: "[주문] F&B 모바일 주문",
            icon: "bx bx-phone",
            url: "/features/order/client/order-food.html"
        },
        {
            type: "item",
            text: "[인증] 로그인 및 본인인증",
            icon: "bx bx-lock-open-alt",
            url: "/features/user/client/auth.html"
        },
        {
            type: "item",
            text: "[보관] 장바구니 및 관심",
            icon: "bx bx-cart",
            url: "/features/user/client/cart-wishlist.html"
        },
        {
            type: "item",
            text: "[페이] 가상 페이 충전/원장",
            icon: "bx bx-credit-card",
            url: "/features/user/client/pay-ledger.html"
        },
        {
            type: "item",
            text: "[문의] 1:1 고객 문의 접수",
            icon: "bx bx-help-circle",
            url: "/features/support/client/inquiry-form.html"
        },
        {
            type: "header",
            text: "현장 스태프 (Staff)"
        },
        {
            type: "item",
            text: "온/오프라인 예매/환불",
            icon: "bx bx-desktop",
            url: "/features/payment/staff/ticket-desk.html"
        },
        {
            type: "item",
            text: "QR 게이트 출입 관제",
            icon: "bx bx-log-in-circle",
            url: "/features/payment/staff/qr-gate-log.html"
        },
        {
            type: "header",
            text: "입점사 사장님 (Owner)"
        },
        {
            type: "item",
            text: "점포 설정 및 영업 관리",
            icon: "bx bx-store-alt",
            url: "/features/order/owner/store-management.html"
        },
        {
            type: "item",
            text: "메뉴 및 옵션 마스터 등록",
            icon: "bx bx-list-plus",
            url: "/features/order/owner/menu-registration.html"
        },
        {
            type: "item",
            text: "실시간 재고 및 품절 제어",
            icon: "bx bx-package",
            url: "/features/order/owner/inventory-control.html"
        },
        {
            type: "item",
            text: "O2O 실시간 주문 수락",
            icon: "bx bx-receipt",
            url: "/features/order/owner/o2o-orders.html"
        }
    ];

    let html = `
    <div class="app-brand demo">
        <a href="/features/user/admin/dashboard.html" class="app-brand-link">
            <span class="app-brand-logo demo">
                <span class="text-primary">
                    <svg width="25" viewBox="0 0 25 42" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                        <g id="g-app-brand" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                            <g id="Brand-Logo" transform="translate(-27.000000, -15.000000)" fill="currentColor">
                                <path d="M40.7918663,15.3583651 L30.3978817,22.4417426 C27.566865,24.6940889 26.6202147,27.4788597 27.5579009,30.7960551 C27.6899885,31.2305145 28.0956289,32.7872135 30.1235708,34.2293357 C30.8146334,34.7207684 32.3236933,35.3834223 34.6507505,36.2172976 L34.5977322,36.2525164 L29.6346877,39.5493413 C27.4454523,41.3002124 27.0884952,43.5083815 28.5638165,46.1738486 C29.8377041,47.8170431 32.2085022,48.2640127 34.0918013,47.5391577 C35.347334,47.0559211 38.4559176,45.0011079 43.4175519,41.3747182 C45.0338572,39.4997857 45.6973423,37.4544883 45.4080071,35.2388261 C44.963753,32.5346866 43.1776345,30.5799961 40.0496516,29.3747546 L37.9194936,28.4715819 L45.6192054,22.984237 L40.7918663,15.3583651 Z"></path>
                            </g>
                        </g>
                    </svg>
                </span>
            </span>
            <span class="app-brand-text demo menu-text fw-bold ms-2 festio-logo-text">FESTIO</span>
        </a>
        <a href="javascript:void(0);" class="layout-menu-toggle menu-link text-large ms-auto d-block d-xl-none">
            <i class="bx bx-chevron-left bx-sm align-middle"></i>
        </a>
    </div>
    <div class="menu-inner-shadow"></div>
    <ul class="menu-inner py-1">
    `;

    menuTree.forEach(node => {
        if (node.type === "header") {
            html += `
            <li class="menu-header small text-uppercase">
                <span class="menu-header-text">${node.text}</span>
            </li>
            `;
        } else if (node.type === "item") {
            const isActive = path === node.url || (node.url === "/features/user/admin/dashboard.html" && (path === "/" || path === "/html/index.html" || path === "/index.html"));
            html += `
            <li class="menu-item ${isActive ? 'active' : ''}">
                <a href="${node.url}" class="menu-link">
                    <i class="menu-icon tf-icons ${node.icon}"></i>
                    <div class="text-truncate">${node.text}</div>
                </a>
            </li>
            `;
        }
    });

    html += `</ul>`;
    layoutMenu.innerHTML = html;

    // 동적 생성 후 PerfectScrollbar가 유실되어 스크롤이 안 되는 현상 방지 (CSS 스크롤 강제 적용)
    layoutMenu.style.overflowY = 'auto';
    layoutMenu.style.overflowX = 'hidden';

    // 둔탁한 네이티브 스크롤바가 탭 배경색을 파먹는 현상 방지 (얇고 투명한 스크롤바로 커스텀)
    if (!document.getElementById('sidebar-scroll-style')) {
        const style = document.createElement('style');
        style.id = 'sidebar-scroll-style';
        style.innerHTML = `
            #layout-menu::-webkit-scrollbar { width: 4px; }
            #layout-menu::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
            #layout-menu::-webkit-scrollbar-track { background: transparent; }
            #layout-menu { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.15) transparent; }
        `;
        document.head.appendChild(style);
    }
});
