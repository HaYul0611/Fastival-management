<<<<<<< HEAD
import { useState, useMemo, useEffect } from 'react';
=======
import { useState, useMemo } from 'react';
>>>>>>> e8a1112b93310ad09f5e536736db1d35babdbbfa
import { motion } from 'motion/react';

interface SeatSection {
  id: string;
  name: string;
  path: string;
  color: string;
  capacity?: string;
}

const seatSections: SeatSection[] = [
  {
    id: 'stage',
    name: 'Stage',
    path: 'M 100 50 L 700 50 L 680 120 L 120 120 Z',
    color: '#FFE5E5',
    capacity: '무대'
  },
  {
    id: 'vip',
    name: 'VIP존',
    path: 'M 250 150 L 550 150 L 540 230 L 260 230 Z',
    color: '#FFD4E5',
    capacity: '100석'
  },
  {
    id: 'f1',
    name: 'F1',
    path: 'M 180 250 L 340 250 L 340 340 L 180 340 Z',
    color: '#E5F3FF',
    capacity: '80석'
  },
  {
    id: 'f2',
    name: 'F2',
    path: 'M 360 250 L 440 250 L 440 340 L 360 340 Z',
    color: '#E5F9FF',
    capacity: '50석'
  },
  {
    id: 'f3',
    name: 'F3',
    path: 'M 460 250 L 620 250 L 620 340 L 460 340 Z',
    color: '#E5F3FF',
    capacity: '80석'
  },
  {
    id: 'standing',
    name: '스탠딩존',
    path: 'M 220 360 L 580 360 L 580 500 L 220 500 Z',
    color: '#FFF9E5',
    capacity: '200명'
  },
  {
    id: 'a-left',
    name: 'A존 (좌)',
    path: 'M 100 250 L 160 250 L 160 500 L 100 500 Z',
    color: '#F0E5FF',
    capacity: '60석'
  },
  {
    id: 'a-right',
    name: 'A존 (우)',
    path: 'M 640 250 L 700 250 L 700 500 L 640 500 Z',
    color: '#F0E5FF',
    capacity: '60석'
  },
  {
    id: 'f4-left',
    name: 'F4 (좌)',
    path: 'M 100 520 L 300 520 L 300 610 L 100 610 Z',
    color: '#E5FFE5',
    capacity: '100석'
  },
  {
    id: 'f4-right',
    name: 'F4 (우)',
    path: 'M 500 520 L 700 520 L 700 610 L 500 610 Z',
    color: '#E5FFE5',
    capacity: '100석'
  }
];

export function ConcertHallSeatingMap() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  const handleSectionClick = (sectionId: string) => {
    setSelectedSection(selectedSection === sectionId ? null : sectionId);
  };

  const getSectionInfo = (sectionId: string) => {
    return seatSections.find(section => section.id === sectionId);
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-4 md:gap-8 p-2 md:p-8 bg-gray-50">
      <div className="text-center mt-2 md:mt-0">
        <h1 className="text-2xl md:text-3xl font-black mb-1 md:mb-2 text-gray-800">콘서트홀 좌석 배치도</h1>
        <p className="text-sm md:text-base text-gray-600">구역을 클릭하여 선택하세요</p>
      </div>

<<<<<<< HEAD
      <div className="relative bg-white rounded-2xl shadow-xl px-1 py-4 md:px-2 md:py-6 w-full max-w-5xl flex justify-center">
        <svg
          viewBox="0 0 800 660"
          className="w-full h-auto"
          style={{ maxHeight: '75vh' }}
=======
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-7xl flex justify-center">
        <svg
          viewBox="0 0 800 660"
          className="w-full h-auto"
          style={{ minHeight: '600px', maxHeight: '80vh' }}
>>>>>>> e8a1112b93310ad09f5e536736db1d35babdbbfa
        >
          <defs>
            {/* 그림자 필터 */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2" />
            </filter>
            
            {/* 선택된 구역 글로우 효과 */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 좌석 구역 렌더링 */}
          {seatSections.map((section) => {
            const isSelected = selectedSection === section.id;
            const isHovered = hoveredSection === section.id;
            const isStage = section.id === 'stage';

            return (
              <g key={section.id}>
                <motion.path
                  d={section.path}
                  fill={section.color}
                  stroke={isSelected ? '#1f2937' : isHovered ? '#4b5563' : '#9ca3af'}
                  strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                  filter={isSelected ? 'url(#glow)' : 'url(#shadow)'}
                  style={{ cursor: isStage ? 'default' : 'pointer' }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isHovered && !isStage ? 1.02 : 1,
                  }}
                  transition={{ 
                    duration: 0.2,
                    scale: { type: 'spring', stiffness: 400, damping: 25 }
                  }}
                  onMouseEnter={() => !isStage && setHoveredSection(section.id)}
                  onMouseLeave={() => setHoveredSection(null)}
                  onClick={() => !isStage && handleSectionClick(section.id)}
                  whileHover={!isStage ? { scale: 1.02 } : {}}
                  whileTap={!isStage ? { scale: 0.98 } : {}}
                />
                
                {/* 구역 레이블 */}
                <text
                  x={getTextPosition(section.path).x}
                  y={getTextPosition(section.path).y}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize={section.id === 'stage' ? '24' : '16'}
                  fontWeight={section.id === 'stage' ? 'bold' : '600'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {section.name}
                </text>
                
                {/* 수용인원 표시 */}
                {section.capacity && section.id !== 'stage' && (
                  <text
                    x={getTextPosition(section.path).x}
                    y={getTextPosition(section.path).y + 20}
                    textAnchor="middle"
                    fill="#6b7280"
                    fontSize="12"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {section.capacity}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 상세 좌석 뷰 오버레이 (전체 구역 대응) */}
      {selectedSection && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedSection(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <DetailedSeatGrid 
              section={getSectionInfo(selectedSection)!} 
              onClose={() => setSelectedSection(null)} 
            />
          </motion.div>
        </div>
      )}

      {/* 범례 */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <h4 className="text-sm font-semibold mb-3 text-gray-700">범례</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {seatSections.filter(s => s.id !== 'stage').slice(0, 5).map((section) => (
            <div key={section.id} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-300"
                style={{ backgroundColor: section.color }}
              />
              <span className="text-xs text-gray-600">{section.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// SVG path에서 중심 좌표를 계산하는 헬퍼 함수
function getTextPosition(path: string): { x: number; y: number } {
  // path에서 좌표 추출 (간단한 파싱)
  const coords = path.match(/[\d.]+/g)?.map(Number) || [];
  
  if (coords.length >= 4) {
    const x = (coords[0] + coords[2]) / 2;
    const y = (coords[1] + coords[3]) / 2;
    return { x, y };
  }
  
  return { x: 0, y: 0 };
}

// 상세 좌석표 모달 컴포넌트
function DetailedSeatGrid({ section, onClose }: { section: SeatSection, onClose: () => void }) {
  // 상태 관리: 선택된 좌석들
  const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
  
  // "100석" 등에서 숫자만 추출
  const numSeats = parseInt(section.capacity?.replace(/[^0-9]/g, '') || '0', 10);

<<<<<<< HEAD
  // 서버에서 실제 예매된 좌석 데이터를 가져옵니다.
  const [reservedSeats, setReservedSeats] = useState<Set<number>>(new Set());

  useEffect(() => {
    let dbZone = section.name.replace('존', '').replace(/\s*\(.*?\)/g, '').trim();
    
    // API 호출하여 해당 구역의 예약된 좌석 필터링
    fetch(`/api/order/seats`)
      .then(res => {
        if (!res.ok) throw new Error("Network response was not ok");
        return res.json();
      })
      .then((data: any[]) => {
        const reserved = new Set<number>();
        data.forEach(seat => {
          // dbZone 매칭 ("A-1", "VIP-1" 등)
          if ((seat.isReserved || seat.isEntered) && seat.id && seat.id.startsWith(dbZone + '-')) {
            const numStr = seat.id.split('-')[1];
            if (numStr) {
               reserved.add(parseInt(numStr, 10));
            }
          }
        });
        setReservedSeats(reserved);
      })
      .catch(err => {
        console.error("Failed to fetch real seat data:", err);
      });
  }, [section.name]);
=======
  // 목업용 예매 완료 좌석 (고정된 난수로 한 번만 생성되도록 useMemo 사용)
  const reservedSeats = useMemo(() => {
    const reserved = new Set<number>();
    for (let i = 1; i <= numSeats; i++) {
      if (Math.random() < 0.1) reserved.add(i); // 10% 확률로 예매 완료
    }
    return reserved;
  }, [numSeats]);
>>>>>>> e8a1112b93310ad09f5e536736db1d35babdbbfa

  const toggleSeat = (seat: number) => {
    setSelectedSeats(prev => 
      prev.includes(seat) ? prev.filter(s => s !== seat) : [...prev, seat]
    );
  };
  
  // 스탠딩 존 처리
  if (numSeats === 0 || section.name.includes('스탠딩')) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full flex flex-col h-[500px]">
        <div className="flex items-center justify-between mb-6 border-b pb-4">
           <h3 className="text-3xl font-black text-gray-800">{section.name}</h3>
           <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors">✕</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-xl">
           <div className="text-8xl mb-6">🏃‍♂️</div>
           <h4 className="text-2xl font-bold text-gray-800 mb-2">지정 좌석이 없는 구역입니다</h4>
           <p className="text-gray-500 text-center max-w-md break-keep">
             스탠딩 구역은 별도의 좌석 번호가 없으며, 예매 및 결제가 완료된 순서대로 입장 번호가 자동으로 부여됩니다.
           </p>
           <div className="mt-8 bg-white px-6 py-3 rounded-full border shadow-sm">
             <span className="font-bold text-gray-600">총 수용 인원:</span> <span className="font-black text-blue-600 ml-2">{section.capacity}</span>
           </div>
           <button className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-12 rounded-xl font-black text-xl hover:shadow-lg hover:scale-105 transition-all" onClick={() => alert(`${section.name} 예매 프로세스로 이동`)}>
              스탠딩 입장권 예매
           </button>
        </div>
      </div>
    );
  }

  // 지정석 Grid 처리 (열 개수 자동 계산)
  const cols = Math.ceil(Math.sqrt(numSeats * 1.2)); // 직사각형 폼 유지
  const seats = Array.from({ length: numSeats }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between mb-4 border-b pb-4">
        <div>
          <h3 className="text-2xl font-black text-gray-800 inline-block mr-3">{section.name}</h3>
          <span className="text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full text-sm">지정 좌석</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors">✕</button>
      </div>
      
      {/* 무대 방향 인디케이터 */}
      <div className="flex justify-center mb-8 relative">
        <div className="w-3/4 bg-gradient-to-b from-gray-200 to-gray-50 border border-gray-300 text-center py-3 font-black text-gray-400 rounded-t-3xl tracking-[0.5em] shadow-inner">
           STAGE
        </div>
      </div>

      {/* 좌석 그리드 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <div 
          className="grid gap-2 justify-center mx-auto" 
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, max-content))` }}
        >
          {seats.map(seat => {
            const isReserved = reservedSeats.has(seat);
            const isSelected = selectedSeats.includes(seat);
            
            // 색상 결정
            let seatClass = 'bg-white border-blue-200 text-blue-900 cursor-pointer hover:bg-blue-50 hover:border-blue-500 hover:shadow-md hover:-translate-y-1';
            
            if (isReserved) {
              seatClass = 'bg-red-50 border-red-300 text-red-500 cursor-not-allowed opacity-80'; // 예매완료: 빨간색
            } else if (isSelected) {
              seatClass = 'bg-blue-600 border-blue-700 text-white shadow-lg scale-105'; // 선택됨: 파란색 채워짐
            }

            return (
              <div 
                key={seat}
                className={`w-10 h-10 md:w-12 md:h-12 border-2 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${seatClass}`}
                onClick={() => {
                  if (!isReserved) toggleSeat(seat);
                }}
                title={isReserved ? '예매 완료' : `${section.name} ${seat}번`}
              >
                {seat}
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 고정 예매하기 버튼 영역 (좌석 스크롤과 독립적) */}
      {selectedSeats.length > 0 && (
        <div className="px-6 py-4 flex justify-center border-t border-gray-100 bg-white">
          <motion.button 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl w-full max-w-sm font-bold shadow-md flex items-center justify-center gap-2 hover:bg-blue-700 hover:shadow-lg transition-all"
            onClick={() => {
              // @ts-ignore
              if (window.goToTicketingFromReact) {
                // @ts-ignore
                window.goToTicketingFromReact(section.name, selectedSeats.sort((a,b)=>a-b));
              } else {
                alert(`${section.name} 구역 - [${selectedSeats.sort((a,b)=>a-b).join(', ')}]번 예매 진행`);
              }
            }}
          >
            <span>{selectedSeats.length}개 좌석 예매하기</span>
            <span className="text-blue-200 ml-2">→</span>
          </motion.button>
        </div>
      )}

      {/* 하단 범례 및 정보 */}
      <div className="mt-2 pt-4 border-t flex justify-between items-center bg-gray-50 px-6 py-4 rounded-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-200 rounded-md bg-white"></div>
            <span className="text-sm font-bold text-gray-600">예매 가능</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-700 rounded-md bg-blue-600"></div>
            <span className="text-sm font-bold text-gray-600">선택됨</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-red-300 rounded-md bg-red-50"></div>
            <span className="text-sm font-bold text-gray-600">예매 완료</span>
          </div>
        </div>
        <p className="font-black text-blue-600 text-lg">총 {numSeats}석</p>
      </div>
    </div>
  );
}
