import { initPage } from '/assets/js/ui.js';
    

    document.addEventListener("DOMContentLoaded", () => { 
        initPage('qr-list'); 
        
        const loadQRCodes = async () => {
            const container = document.getElementById('qr-list-container');
            container.innerHTML = "<em style='color:#a0aec0;'>데이터를 불러오는 중...</em>";
            try {
                const res = await fetch('/api/order/tickets/qr');
                const data = await res.json();
                
                if (!data || data.length === 0) {
                    container.innerHTML = "<div style='color:#ef4444; padding:20px; border:1px solid #ef4444; border-radius:8px;'>현재 발급된 티켓(QR)이 없습니다.<br>현장 예매를 진행하면 여기에 티켓이 나타납니다.</div>";
                    return;
                }
                
                let html = '<div style="display: flex; gap: 25px; flex-wrap: wrap; background: #0d1117; padding: 20px; border-radius: 12px;">';
                data.forEach(item => {
                    const ticketUrl = window.location.origin + '/features/user/ticket/view.html?orderId=' + item.orderId + '&secret=' + item.secret;
                    const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticketUrl)}`;
                    const isUsed = item.used === "true";
                    const isValidTicket = item.ticketNumber && String(item.ticketNumber).trim() !== "" && String(item.ticketNumber).toLowerCase() !== "null";
                    const ticketNumDisplay = isValidTicket ? item.ticketNumber : "<span style='color:#ef4444;'>유효하지 않은 티켓입니다</span>";
                    
                    const qrSectionHtml = isValidTicket ? `
                            <div style="border-top: 2px dashed #333; padding-top: 15px; text-align: center;">
                                <p style="font-size: 15px; font-weight: bold; margin-bottom: 10px;">스마트폰으로 스캔하세요!</p>
                                <img src="${qrImgUrl}" alt="QR Code" style="width: 160px; height: 160px;">
                                <p style="font-size: 12px; margin-top: 10px; line-height: 1.4; color: #333;">
                                    카메라 앱으로 위 QR코드를 스캔하시면<br>
                                    입장용 움직이는 모바일 티켓이 열립니다.<br><br>
                                    입장 게이트 스태프에게<br>
                                    폰 화면을 보여주세요.
                                </p>
                            </div>
                            
                            <div style="border-top: 2px dashed #333; margin-top: 15px; padding-top: 15px; text-align: center; position: relative; z-index: 20;">
                                <a href="${ticketUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; font-size: 13px; font-weight: bold; border-radius: 4px; font-family: sans-serif;">
                                    모바일 티켓 직접 열기
                                </a>
                            </div>
                    ` : `
                            <div style="border-top: 2px dashed #333; margin-top: 15px; padding-top: 30px; padding-bottom: 20px; text-align: center;">
                                <div style="color: #ef4444; font-size: 18px; font-weight: bold;">⚠️ 발급 오류</div>
                                <p style="color: #ef4444; font-size: 14px; margin-top: 10px;">유효하지 않은 티켓입니다.</p>
                                <div style="margin-top: 20px; position: relative; z-index: 20;">
                                    <a href="${ticketUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; background: #ef4444; color: #fff; text-decoration: none; font-size: 13px; font-weight: bold; border-radius: 4px; font-family: sans-serif;">
                                        테스트용 티켓 강제 열기
                                    </a>
                                </div>
                            </div>
                    `;

                    html += `
                        <div style="background-color: white; color: black; font-family: 'Malgun Gothic', 'Courier New', monospace; padding: 20px; width: 280px; box-shadow: 2px 5px 15px rgba(0,0,0,0.5); position: relative;">
                            <!-- 영수증 지그재그 상단 효과 -->
                            <div style="position: absolute; top: -10px; left: 0; width: 100%; height: 10px; background: linear-gradient(-45deg, transparent 33.33%, white 33.33%, white 66.66%, transparent 66.66%), linear-gradient(45deg, transparent 33.33%, white 33.33%, white 66.66%, transparent 66.66%); background-size: 10px 20px;"></div>
                            
                            <div style="text-align: center; border-bottom: 2px dashed #333; padding-bottom: 15px; margin-bottom: 15px;">
                                <h3 style="margin: 0; font-size: 22px; font-weight: bold; color: black;">FESTIO 영수증 티켓</h3>
                                <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: ${isUsed ? '#ef4444' : 'black'};">[ ${isUsed ? '사용된 티켓' : '현장결제 완료'} ]</p>
                            </div>
                            
                            <div style="font-size: 14px; line-height: 1.6; margin-bottom: 15px; text-align: left;">
                                <strong>주문번호:</strong> ORD-${item.orderId}<br>
                                <strong>좌석정보:</strong> ${item.seats}<br>
                                <strong>티켓번호:</strong> ${ticketNumDisplay}
                            </div>
                            
                            ${qrSectionHtml}
                            
                            <!-- 영수증 지그재그 하단 효과 -->
                            <div style="position: absolute; bottom: -10px; left: 0; width: 100%; height: 10px; background: linear-gradient(-45deg, white 33.33%, transparent 33.33%, transparent 66.66%, white 66.66%), linear-gradient(45deg, white 33.33%, transparent 33.33%, transparent 66.66%, white 66.66%); background-size: 10px 20px;"></div>
                        </div>
                    `;
                });
                html += '</div>';
                container.innerHTML = html;
                
            } catch(e) {
                console.error(e);
                container.innerHTML = "<span style='color:red;'>데이터 로딩 실패</span>";
            }
        };

        const btn = document.getElementById('btn-load-qr');
        btn.addEventListener('click', loadQRCodes);
        
        // 초기 로드
        loadQRCodes();
    });