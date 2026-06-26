// ===================================================
// [클라이언트 사이드 인가 가드] 스탭 포털 접근 제어
// ===================================================
// Spring Security는 서버 세션 기반으로 동작하지만, 이 프로젝트는
// localStorage JWT 토큰 방식을 사용하기 때문에 Spring Security로는
// HTML 정적 파일을 보호할 수 없습니다.
// 따라서 페이지 레벨 접근 제어는 JavaScript에서 수행합니다.
(function staffAuthGuard() {
    const userRole = localStorage.getItem('userRole') || sessionStorage.getItem('userRole');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' 
                    || sessionStorage.getItem('isLoggedIn') === 'true'
                    || !!localStorage.getItem('userToken')
                    || !!sessionStorage.getItem('userToken');
    
    const isAllowed = isLoggedIn && (userRole === 'STAFF' || userRole === 'ADMIN');
    
    if (!isAllowed) {
        // 미인증 또는 권한 없는 사용자 → 로그인 페이지로 안전하게 리다이렉트
        window.location.replace('/Festio/login.html?error=unauthorized');
    }
})();

document.addEventListener("DOMContentLoaded", function () {
    const layoutMenu = document.getElementById("layout-menu");
    if (!layoutMenu) return;

    // 사이드바 스크롤 허용 및 프리미엄 스크롤바 디자인을 위한 동적 스타일 주입
    const sidebarStyle = document.createElement("style");
    sidebarStyle.innerHTML = `
        .layout-menu .menu-inner {
            height: calc(100vh - 85px) !important;
            overflow-y: auto !important;
        }
        /* 유려한 프리미엄 스크롤바 디자인 */
        .layout-menu .menu-inner::-webkit-scrollbar {
            width: 5px !important;
        }
        .layout-menu .menu-inner::-webkit-scrollbar-track {
            background: transparent !important;
        }
        .layout-menu .menu-inner::-webkit-scrollbar-thumb {
            background: rgba(0, 229, 204, 0.3) !important; /* 스탭 포털 시그니처 민트색 테마 */
            border-radius: 10px !important;
        }
        .layout-menu .menu-inner::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 229, 204, 0.55) !important;
        }
    `;
    document.head.appendChild(sidebarStyle);

    // 현재 URL 경로 분석
    const path = window.location.pathname;

    const userSpecificRole = localStorage.getItem('userSpecificRole') || sessionStorage.getItem('userSpecificRole');
    const isGoodsStaff = userSpecificRole === 'ROLE_GOODS_STAFF';

    // 스탭 및 점주 전용 초정밀 라우터 매핑
    const menuTree = isGoodsStaff ? [
        {
            type: "header",
            text: "굿즈 매니지먼트 (Goods)"
        },
        {
            type: "item",
            text: "굿즈 판매소 설정",
            icon: "bx bx-store-alt",
            url: "/features/payment/staff/goods-store.html"
        },
        {
            type: "item",
            text: "MD 및 굿즈 등록",
            icon: "bx bx-list-plus",
            url: "/features/payment/staff/goods-menu.html"
        },
        {
            type: "item",
            text: "옵션별 재고 관리",
            icon: "bx bx-package",
            url: "/features/payment/staff/goods-inventory.html"
        },
        {
            type: "item",
            text: "실시간 주문 및 픽업",
            icon: "bx bx-receipt",
            url: "/features/payment/staff/goods-orders.html"
        },
        {
            type: "item",
            text: "판매 기록 및 환불 관리",
            icon: "bx bx-history",
            url: "/features/payment/staff/refund.html"
        },
        {
            type: "item",
            text: "실시간 매출 대시보드",
            icon: "bx bx-line-chart",
            url: "/features/payment/staff/sales-dashboard.html"
        }
    ] : [
        {
            type: "header",
            text: "스태프 매니지먼트 (Staff)"
        },
        {
            type: "item",
            text: "점포 설정 및 영업 관리",
            icon: "bx bx-store-alt",
            url: "/features/payment/staff/store-management.html"
        },
        {
            type: "item",
            text: "메뉴 및 옵션 마스터 등록",
            icon: "bx bx-list-plus",
            url: "/features/payment/staff/menu-registration.html"
        },
        {
            type: "item",
            text: "실시간 재고 및 품절 제어",
            icon: "bx bx-package",
            url: "/features/payment/staff/inventory-control.html"
        },
        {
            type: "item",
            text: "O2O 실시간 주문 수락",
            icon: "bx bx-receipt",
            url: "/features/payment/staff/o2o-orders.html"
        },
        {
            type: "item",
            text: "판매 기록 및 환불 관리",
            icon: "bx bx-history",
            url: "/features/payment/staff/refund.html"
        },
        {
            type: "item",
            text: "실시간 매출 대시보드",
            icon: "bx bx-line-chart",
            url: "/features/payment/staff/sales-dashboard.html"
        }
    ];

    const homeUrl = isGoodsStaff ? "/features/payment/staff/goods-store.html" : "/features/payment/staff/store-management.html";

    let html = `
    <div class="app-brand demo" style="background: #11142d !important;">
        <a href="${homeUrl}" class="app-brand-link">
            <span class="app-brand-logo demo">
                <span class="text-info">
                    <svg width="25" viewBox="0 0 25 42" version="1.1" xmlns="http://www.w3.org/2000/svg">
                        <g id="Brand-Logo" fill="currentColor">
                            <path d="M40.7918663,15.3583651 L30.3978817,22.4417426 C27.566865,24.6940889 26.6202147,27.4788597 27.5579009,30.7960551 C27.6899885,31.2305145 28.0956289,32.7872135 30.1235708,34.2293357 C30.8146334,34.7207684 32.3236933,35.3834223 34.6507505,36.2172976 L34.5977322,36.2525164 L29.6346877,39.5493413 C27.4454523,41.3002124 27.0884952,43.5083815 28.5638165,46.1738486 C29.8377041,47.8170431 32.2085022,48.2640127 34.0918013,47.5391577 C35.347334,47.0559211 38.4559176,45.0011079 43.4175519,41.3747182 C45.0338572,39.4997857 45.6973423,37.4544883 45.4080071,35.2388261 C44.963753,32.5346866 43.1776345,30.5799961 40.0496516,29.3747546 L37.9194936,28.4715819 L45.6192054,22.984237 L40.7918663,15.3583651 Z"></path>
                        </g>
                    </svg>
                </span>
            </span>
            <span class="app-brand-text demo menu-text fw-bold ms-2" style="font-family: 'Space Grotesk', 'Pretendard Variable', sans-serif; font-size: 1.4rem; font-weight: 800; background: linear-gradient(135deg, #00E5CC, #0099FF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.03em;">STAFF PORTAL</span>
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
            const isActive = path === node.url;
            
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

    // 템플릿의 Menu 및 스크롤 시스템 재초기화
    if (typeof Menu !== 'undefined') {
        try {
            if (window.Helpers && window.Helpers.mainMenu && typeof window.Helpers.mainMenu.destroy === 'function') {
                window.Helpers.mainMenu.destroy();
            }
            
            const menuInstance = new Menu(layoutMenu, {
                orientation: 'vertical',
                closeChildren: false
            });
            
            if (window.Helpers) {
                window.Helpers.scrollToActive(false);
                window.Helpers.mainMenu = menuInstance;
            }
        } catch (e) {
            console.error("Menu re-initialization failed, falling back to manual scroll:", e);
            fallbackScroll(layoutMenu);
        }
    } else {
        fallbackScroll(layoutMenu);
    }
});

// 폴백 수동 스크롤 적용 함수
function fallbackScroll(layoutMenu) {
    const menuInner = layoutMenu.querySelector('.menu-inner');
    if (menuInner) {
        if (typeof PerfectScrollbar !== 'undefined') {
            try {
                new PerfectScrollbar(menuInner, {
                    wheelPropagation: false,
                    wheelSpeed: 0.8
                });
            } catch (e) {
                menuInner.style.overflowY = 'auto';
            }
        } else {
            menuInner.style.overflowY = 'auto';
        }
    }
}
