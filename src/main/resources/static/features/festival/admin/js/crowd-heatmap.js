// Supabase 클라이언트 초기화 (config.js의 변수 사용)
const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const ZONES = [
  { id: 'A', name: '메인무대 (A구역)', cx: 150, cy: 180 },
  { id: 'B', name: '푸드존 (B구역)', cx: 480, cy: 200 },
  { id: 'C', name: '게이트 (C구역)', cx: 320, cy: 350 }
];

let zoneData = {
  A: { count: 0, max: 200 },
  B: { count: 0, max: 150 },
  C: { count: 0, max: 100 }
};

let chartInstance = null;

function renderHeatmap() {
  const svg = document.getElementById('heatmapSvg');
  if (!svg) return;

  let html = '';
  const chartData = [];

  ZONES.forEach(zone => {
    const data = zoneData[zone.id];
    const density = Math.min(100, Math.round((data.count / data.max) * 100));

    let color = '#71dd37'; // 원활
    let bgColor = 'rgba(113, 221, 55, 0.3)';
    let statusText = '원활';
    let densityScore = (density / 100) * 2; // 차트용 (0~5)

    if (density > 80) {
      color = '#ff3e1d'; // 혼잡
      bgColor = 'rgba(255, 62, 29, 0.45)';
      statusText = '극심한 혼잡';
      densityScore = 4 + (density / 100);
    } else if (density > 40) {
      color = '#ffab00'; // 보통
      bgColor = 'rgba(255, 171, 0, 0.35)';
      statusText = '보통';
      densityScore = 2 + (density / 100) * 1.5;
    }

    // 마커 SVG 요소 생성
    html += `
      <circle cx="${zone.cx}" cy="${zone.cy}" r="${70 + (density * 0.3)}" fill="${bgColor}" stroke="${color}" stroke-width="2" />
      <circle cx="${zone.cx - 10}" cy="${zone.cy - 10}" r="${40 + (density * 0.2)}" fill="${bgColor}" />
      <text x="${zone.cx}" y="${zone.cy + 5}" fill="white" font-weight="bold" text-anchor="middle" style="text-shadow: 1px 1px 2px #000;">
        ${zone.id}구역: ${statusText} (${density}%)
      </text>
    `;
    chartData.push(parseFloat(densityScore.toFixed(1)));
  });

  svg.innerHTML = html;
  updateChart(chartData);
}

function updateChart(dataArr) {
  if (!chartInstance) {
    const options = {
      series: [{ name: '실시간 인파 밀도 (명/㎡)', data: dataArr }],
      chart: { height: 250, type: 'radar', toolbar: { show: false } },
      title: { text: '구역별 단위면적당 인파 강도' },
      xaxis: { categories: ['메인광장', '푸드트럭라인', '게이트외곽'] },
      colors: ['#ff3e1d']
    };
    chartInstance = new ApexCharts(document.querySelector("#dangerStatsChart"), options);
    chartInstance.render();
  } else {
    chartInstance.updateSeries([{ data: dataArr }]);
  }
}

// 초기 데이터 로드 및 Realtime 구독
async function initRealtimeMap() {
  // 1. 현재 주문 및 스캔 로그를 기반으로 임의의 초기 집계 생성 (데모용 집계)
  try {
    const { count: orderCount } = await supabaseClient.from('shop_orders').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    const { count: scanCount } = await supabaseClient.from('scan_log').select('*', { count: 'exact', head: true }).gte('scanned_at', new Date(Date.now() - 3600000).toISOString());

    zoneData.B.count = orderCount || 20; // 푸드존은 주문량 기준
    zoneData.C.count = scanCount || 10;  // 게이트는 스캔량 기준
    zoneData.A.count = Math.floor(Math.random() * 150) + 20; // 메인무대는 랜덤

    renderHeatmap();

    // 2. Realtime 구독 (주문이 들어오면 푸드존 혼잡도 증가, 스캔이 들어오면 게이트 혼잡도 증가)
    supabaseClient
      .channel('heatmap_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shop_orders' }, payload => {
        zoneData.B.count += 1;
        renderHeatmap();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scan_log' }, payload => {
        if (payload.new.scan_type === 'ENTRANCE') {
          zoneData.C.count += 1;
        } else {
          zoneData.A.count += 1; // 픽업/기타는 메인존 쪽으로 간주
        }
        renderHeatmap();
      })
      .subscribe();

    // 주기적인 메인 구역 혼잡도 갱신 시뮬레이션
    setInterval(() => {
      zoneData.A.count = Math.max(0, Math.min(200, zoneData.A.count + (Math.floor(Math.random() * 11) - 5)));
      renderHeatmap();
    }, 5000);

  } catch (e) {
    console.error("Map Init Error:", e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeMap();
});