import { useState } from 'react';
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
    <div className="w-full h-full flex flex-col items-center justify-center gap-8 p-8 bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl mb-2">콘서트홀 좌석 배치도</h1>
        <p className="text-gray-600">구역을 클릭하여 선택하세요</p>
      </div>

      <div className="relative bg-white rounded-2xl shadow-2xl p-8">
        <svg
          viewBox="0 0 800 660"
          className="w-full max-w-4xl h-auto"
          style={{ minHeight: '500px' }}
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

      {/* 선택된 구역 정보 표시 */}
      {selectedSection && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">
              {getSectionInfo(selectedSection)?.name}
            </h3>
            <button
              onClick={() => setSelectedSection(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: getSectionInfo(selectedSection)?.color }}
              />
              <span className="text-gray-700">
                수용 인원: {getSectionInfo(selectedSection)?.capacity}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              좌석 예약을 원하시면 티켓팅 페이지로 이동하세요.
            </p>
            <button
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => alert(`${getSectionInfo(selectedSection)?.name} 예약하기`)}
            >
              예약하기
            </button>
          </div>
        </motion.div>
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
