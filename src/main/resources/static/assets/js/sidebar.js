// SweetAlert2 라이브러리 동적 주입 및 글로벌 alert 몽키 패치
(function () {
    if (!window.Swal) {
        const swalScript = document.createElement("script");
        swalScript.src = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
        document.head.appendChild(swalScript);

        const swalStyle = document.createElement("style");
        swalStyle.innerHTML = `
            .swal2-popup {
                font-family: "Pretendard Variable", "Pretendard", sans-serif !important;
                border-radius: 12px !important;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08) !important;
            }
            .swal2-confirm {
                font-weight: 600 !important;
            }
        `;
        document.head.appendChild(swalStyle);
    }

    const _nativeAlert = window.alert;
    window.alert = function (message) {
        if (window.Swal) {
            Swal.fire({
                text: message,
                icon: 'info',
                confirmButtonText: '확인',
                customClass: {
                    confirmButton: 'btn btn-primary px-4 py-2'
                },
                buttonsStyling: false
            });
        } else {
            console.warn("[Swal fallback] Swal not ready. Message: " + message);
            _nativeAlert(message);
        }
    };
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
            background: rgba(105, 108, 255, 0.3) !important;
            border-radius: 10px !important;
        }
        .layout-menu .menu-inner::-webkit-scrollbar-thumb:hover {
            background: rgba(105, 108, 255, 0.55) !important;
        }
    `;
    document.head.appendChild(sidebarStyle);

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
            text: "축제 마스터 관리",
            icon: "bx bx-map-alt",
            url: "/features/user/admin/dashboard.html?tab=festivals"
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
            text: "GPS 기반 혼잡도 히트맵",
            icon: "bx bx-map-pin",
            url: "/features/festival/admin/crowd-heatmap.html"
        },
        {
            type: "item",
            text: "[관리자] 좌석 배치 편집기",
            icon: "bx bx-cog",
            url: "/features/payment/admin/seat-editor.html"
        },
        {
            type: "item",
            text: "[관리자] 게이트 스탭 권한 관리",
            icon: "bx bx-shield-quarter",
            url: "/features/payment/admin/staff-management.html"
        },
        {
            type: "header",
            text: "소비자 클라이언트 (Client)"
        },
        {
            type: "item",
            text: "[페이] 가상 페이 충전/원장",
            icon: "bx bx-credit-card",
            url: "/features/user/client/pay-ledger.html"
        },
        {
            type: "submenu",
            text: "[문의] 1:1 답변 및 상담",
            icon: "bx bx-help-circle",
            children: [
                {
                    text: "1:1 업체 문의 및 상담",
                    url: "/features/support/client/inquiry-form.html"
                }
            ]
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
            <span class="app-brand-text demo menu-text fw-bold ms-2" style="font-family: 'Space Grotesk', 'Pretendard Variable', sans-serif; font-size: 1.6rem; font-weight: 800; background: linear-gradient(135deg, #6A4DFF, #00E5CC); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: -0.03em;">FESTIO</span>
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
            const hasTabParam = node.url.includes("?tab=festivals");
            const isCurrentTabFestivals = window.location.search.includes("tab=festivals");

            let isActive = false;
            if (path === "/features/user/admin/dashboard.html") {
                if (hasTabParam && isCurrentTabFestivals) {
                    isActive = true;
                } else if (!hasTabParam && !isCurrentTabFestivals && node.url === "/features/user/admin/dashboard.html") {
                    isActive = true;
                }
            } else {
                isActive = path === node.url || (node.url === "/features/user/admin/dashboard.html" && (path === "/" || path === "/html/index.html" || path === "/index.html"));
            }

            html += `
            <li class="menu-item ${isActive ? 'active' : ''}">
                <a href="${node.url}" class="menu-link">
                    <i class="menu-icon tf-icons ${node.icon}"></i>
                    <div class="text-truncate">${node.text}</div>
                </a>
            </li>
            `;
        } else if (node.type === "submenu") {
            let isActiveSubmenu = node.children.some(child => path === child.url);
            html += `
            <li class="menu-item ${isActiveSubmenu ? 'active open' : ''}">
                <a href="javascript:void(0);" class="menu-link menu-toggle">
                    <i class="menu-icon tf-icons ${node.icon}"></i>
                    <div class="text-truncate">${node.text}</div>
                </a>
                <ul class="menu-sub">
            `;
            node.children.forEach(child => {
                let isActiveChild = path === child.url;
                html += `
                    <li class="menu-item ${isActiveChild ? 'active' : ''}">
                        <a href="${child.url}" class="menu-link">
                            <div class="text-truncate">${child.text}</div>
                        </a>
                    </li>
                `;
            });
            html += `
                </ul>
            </li>
            `;
        }
    });

    html += `</ul>`;
    layoutMenu.innerHTML = html;

    // 템플릿의 Menu 및 스크롤 시스템 재초기화 (비동기 DOM 빌드로 인해 깨진 인스턴스 복구)
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

    // 모든 관리자 페이지의 navbar에 'FESTIO 메인' 바로가기 버튼 동적 삽입
    const navbarNav = document.querySelector("#navbar-collapse .navbar-nav");
    if (navbarNav) {
        const hasMainBtn = navbarNav.querySelector('a[href="/Festio/index.html"]');
        if (!hasMainBtn) {
            const dropdownUser = navbarNav.querySelector('.dropdown-user');
            if (dropdownUser) {
                const li = document.createElement('li');
                li.className = 'nav-item me-2';
                li.innerHTML = `
                    <a href="/Festio/index.html" target="_blank"
                      class="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                      style="font-size:0.82rem; font-weight:600; border-radius:20px; padding:5px 14px;"
                      title="FESTIO 사용자 메인 페이지로 이동">
                      <i class="bx bx-home-smile" style="font-size:1rem;"></i>
                      FESTIO 메인
                    </a>
                `;
                navbarNav.insertBefore(li, dropdownUser);
            }
        }
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

// 모바일 환경에서 햄버거 메뉴 및 닫기 버튼(오버레이 포함)이 무조건 동작하도록 이벤트 강제 바인딩
document.addEventListener('click', function(e) {
    const toggleBtn = e.target.closest('.layout-menu-toggle');
    if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        document.documentElement.classList.toggle('layout-menu-expanded');
    }
}, true);
