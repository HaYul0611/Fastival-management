const SUPABASE_URL = 'https://cddfyvkilmfrbtcruklw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZGZ5dmtpbG1mcmJ0Y3J1a2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzU5MzksImV4cCI6MjA5NTM1MTkzOX0.YPkPc7wDBWE3NwE_SrUnhQIOofJjTA-N9iPzxdiEFXs';

async function seedMoreUniversities() {
  // 기존 대학축제 데이터 전체 삭제
  console.log('기존 대학축제 데이터 삭제 중...');
  await fetch(`${SUPABASE_URL}/rest/v1/event?category=eq.${encodeURIComponent('대학축제')}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  // 사용자가 직접 이미지 URL을 채워넣을 수 있도록 구조화
  const universities = [
    // --- 서울권 주요 대학 ---
    { name: '연세대학교 아카라카 2025', desc: '연세대학교 노천극장', img: '' /* 연세대학교 아카라카 포스터 URL */ },
    { name: '고려대학교 입실렌티 2025', desc: '고려대학교 녹지운동장', img: '' /* 고려대학교 입실렌티 포스터 URL */ },
    { name: '서울대학교 대동제 2025', desc: '서울대학교 관악캠퍼스', img: '' /* 서울대학교 축제 포스터 URL */ },
    { name: '성균관대학교 대동제 2025', desc: '성균관대학교 인문사회과학캠퍼스', img: '' /* 성균관대학교 축제 포스터 URL */ },
    { name: '서강대학교 대동제 2025', desc: '서강대학교 청년광장', img: '' /* 서강대학교 축제 포스터 URL */ },
    { name: '한양대학교 라치카스 2025', desc: '한양대학교 서울캠퍼스 노천극장', img: '' /* 한양대학교 축제 포스터 URL */ },
    { name: '중앙대학교 루카우스 2025', desc: '중앙대학교 서울캠퍼스 흑석동', img: '' /* 중앙대학교 축제 포스터 URL */ },
    { name: '경희대학교 대동제 2025', desc: '경희대학교 서울캠퍼스 평화의전당', img: '' /* 경희대학교 축제 포스터 URL */ },
    { name: '한국외국어대학교 대동제 2025', desc: '한국외국어대학교 서울캠퍼스 운동장', img: '' /* 한국외국어대학교 축제 포스터 URL */ },
    { name: '서울시립대학교 대동제 2025', desc: '서울시립대학교 대운동장', img: '' /* 서울시립대학교 축제 포스터 URL */ },
    { name: '홍익대학교 대동제 2025', desc: '홍익대학교 서울캠퍼스 대운동장', img: '' /* 홍익대학교 축제 포스터 URL */ },
    { name: '건국대학교 대동제 2025', desc: '건국대학교 서울캠퍼스 노천극장', img: '' /* 건국대학교 축제 포스터 URL */ },
    { name: '동국대학교 대동제 2025', desc: '동국대학교 서울캠퍼스 만해광장', img: '' /* 동국대학교 축제 포스터 URL */ },
    { name: '이화여자대학교 대동제 2025', desc: '이화여자대학교 잔디광장', img: '' /* 이화여자대학교 축제 포스터 URL */ },
    { name: '숙명여자대학교 대동제 2025', desc: '숙명여자대학교 순헌관 앞', img: '' /* 숙명여자대학교 축제 포스터 URL */ },
    // --- 전국 주요 국립/사립 대학 ---
    { name: '부산대학교 대동제 2025', desc: '부산대학교 넉넉한터', img: '' /* 부산대학교 축제 포스터 URL */ },
    { name: '경북대학교 대동제 2025', desc: '경북대학교 대운동장', img: '' /* 경북대학교 축제 포스터 URL */ },
    { name: '전남대학교 대동제 2025', desc: '전남대학교 보조운동장', img: '' /* 전남대학교 축제 포스터 URL */ },
    { name: '충남대학교 대동제 2025', desc: '충남대학교 대운동장', img: '' /* 충남대학교 축제 포스터 URL */ },
    { name: '전북대학교 대동제 2025', desc: '전북대학교 대운동장', img: '' /* 전북대학교 축제 포스터 URL */ },
    { name: '충북대학교 대동제 2025', desc: '충북대학교 소운동장', img: '' /* 충북대학교 축제 포스터 URL */ },
    { name: '강원대학교 대동제 2025', desc: '강원대학교 춘천캠퍼스 대운동장', img: '' /* 강원대학교 축제 포스터 URL */ },
    { name: '제주대학교 대동제 2025', desc: '제주대학교 대운동장', img: '' /* 제주대학교 축제 포스터 URL */ }
  ];

  const now = new Date().toISOString();
  // 5월에 대학축제가 많으므로 5월로 설정
  const eventDate = '2025-05-15';

  const insertData = universities.map(u => ({
    event_name: u.name,
    category: '대학축제',
    venue: u.desc,
    event_date: eventDate,
    description: `${u.name} 메인 무대 행사입니다.`,
    thumbnail_url: u.img,
    start_time: '18:00:00',
    end_time: '23:00:00',
    created_at: now
  }));

  console.log('대학축제 데이터 삽입 중...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/event`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(insertData)
  });

  if (res.ok) {
    console.log(`성공적으로 ${universities.length}개의 전국 대학축제를 등록했습니다!`);
  } else {
    console.error('에러 발생:', await res.text());
  }
}

seedMoreUniversities();
