const SUPABASE_URL = 'https://cddfyvkilmfrbtcruklw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZGZ5dmtpbG1mcmJ0Y3J1a2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzU5MzksImV4cCI6MjA5NTM1MTkzOX0.YPkPc7wDBWE3NwE_SrUnhQIOofJjTA-N9iPzxdiEFXs';

async function updateImages() {
  const updates = [
    { name: '연세대학교 아카라카 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Yonsei_University_Underwood_Hall.jpg/800px-Yonsei_University_Underwood_Hall.jpg' },
    { name: '고려대학교 입실렌티 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Korea_University_Main_Building_01.jpg/800px-Korea_University_Main_Building_01.jpg' },
    { name: '한양대학교 라치카스 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Hanyang_University_Seoul_Campus_Main_Building.jpg/800px-Hanyang_University_Seoul_Campus_Main_Building.jpg' },
    { name: '성균관대학교 대동제 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Sungkyunkwan_University_Myeongnyundang.jpg/800px-Sungkyunkwan_University_Myeongnyundang.jpg' },
    { name: '경희대학교 대동제 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Kyung_Hee_University_Seoul_Campus_Peace_Hall.jpg/800px-Kyung_Hee_University_Seoul_Campus_Peace_Hall.jpg' },
    { name: '한국외국어대학교 대동제 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Hankuk_University_of_Foreign_Studies_Seoul_Campus_Main_Building.jpg/800px-Hankuk_University_of_Foreign_Studies_Seoul_Campus_Main_Building.jpg' },
    { name: '중앙대학교 루카우스 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Chung-Ang_University_Seoul_Campus.jpg/800px-Chung-Ang_University_Seoul_Campus.jpg' },
    { name: '서울대학교 축제 2025', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Seoul_National_University_Main_Gate.jpg/800px-Seoul_National_University_Main_Gate.jpg' }
  ];

  for (const update of updates) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/event?event_name=eq.${encodeURIComponent(update.name)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ thumbnail_url: update.url })
    });
    console.log(`Updated ${update.name}: ${res.status}`);
  }
}

updateImages();
