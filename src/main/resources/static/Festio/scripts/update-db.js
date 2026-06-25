const SUPABASE_URL = 'https://cddfyvkilmfrbtcruklw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkZGZ5dmtpbG1mcmJ0Y3J1a2x3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzU5MzksImV4cCI6MjA5NTM1MTkzOX0.YPkPc7wDBWE3NwE_SrUnhQIOofJjTA-N9iPzxdiEFXs';

async function runSql() {
  // RPC 권한이 없을 경우 PostgREST에 의해 차단될 수 있는 SQL을 직접 실행하는 대신, 
  // 지역축제로 다시 삽입한 뒤, 프론트엔드 파싱에서 스포츠로 변경하도록 합니다.
  // 하지만 현재 프론트엔드 파싱은 TourAPI 데이터만 변경합니다.
  // seed.js를 수정하여 지역축제로 삽입하도록 하고, api.js에서 DB 데이터를 가져올 때
  // DB 이벤트에도 스포츠 키워드 필터를 적용할 수 있습니다!
}
