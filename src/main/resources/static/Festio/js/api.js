/**
 * Festival O2O Platform — api.js  (Supabase 직접 연동)
 * ─────────────────────────────────────────────────────────────
 * [DB 테이블명 기준 — Supabase 실제 테이블]
 *   app_user      (구: member)
 *   festival      (구: event)         컬럼: id, name, start_date, end_date, is_active, map_image_url, created_at, is_adult_only
 *   festival_zone (구: event_zone)
 *   orders        (구: ticket_order)
 *   order_item
 *   coupon
 *   user_coupon
 *   wishlist
 *   review
 *   inquiry
 *   scan_log
 *   wallet_history
 *   settlement
 *   store
 *   product
 *   seat_map
 *   emergency_broadcast
 * ─────────────────────────────────────────────────────────────
 * [내부 JS 필드명 매핑]
 *   DB: id          → JS: eventNo / id
 *   DB: name        → JS: eventName / name
 *   DB: start_date  → JS: startDate  (표시용: eventDate)
 *   DB: end_date    → JS: endDate    (표시용: eventEndDate)
 *   DB: is_active   → JS: isActive
 *   DB: is_adult_only → JS: isAdultOnly
 *   DB: map_image_url → JS: mapImageUrl
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ── Supabase 설정 ─────────────────────────────────────────── */
const SUPABASE_URL = 'https://loqsekbplftdjphzewmx.supabase.co';   // 실제 URL로 교체 완료
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvcXNla2JwbGZ0ZGpwaHpld214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzM5NDYsImV4cCI6MjA5NTM0OTk0Nn0.l6i4VUx6fU0ePN_3RxNb9CJQkpWC-X2HeXb2yGBqDnM'; // 실제 anon key로 교체 완료

let _supabase = null;
let _isSupabaseUnreachable = false;

function getSupabase() {
  if (SUPABASE_URL.includes('cddfyvkilmfrbtcruklw')) return null;
  if (_isSupabaseUnreachable) return null;
  if (!_supabase && window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return _supabase;
}

window.getSupabase = getSupabase;

function markSupabaseUnreachable(err) {
  if (err && (
    err.message?.includes('Failed to fetch') ||
    err.toString().includes('Failed to fetch') ||
    err.message?.includes('net::ERR_NAME_NOT_RESOLVED') ||
    err.toString().includes('ERR_NAME_NOT_RESOLVED') ||
    err.message?.includes('Failed to execute \'fetch\'')
  )) {
    if (!_isSupabaseUnreachable) {
      _isSupabaseUnreachable = true;
      console.warn('Supabase server is unreachable. Switched to local/mock fallback mode.');
    }
  }
}
window.markSupabaseUnreachable = markSupabaseUnreachable;

/* ── KOPIS / TourAPI 설정 ──────────────────────────────────── */
const KOPIS_BASE = 'https://kopis.or.kr/openApi/restful';
const KOPIS_KEY = '6156a605351f4790954ec109178034b7';   // TODO: 실제 키로 교체
const TOUR_BASE = 'http://apis.data.go.kr/B551011/KorService1';
const TOUR_KEY = '8507fc92e13f94fe27aa4b31d96e6544d2c607909b221d682b02508f105de532';    // TODO: 실제 키로 교체

const USE_MOCK = false;  // Supabase 연동 활성화

/* ── Mock 데이터 (festival 테이블 컬럼명 기준) ─────────────── */
const MOCK = {
  /* app_user 테이블 기준 */
  app_user: {
    id: 1,
    email: 'test@festio.kr',
    nickname: '오지율',
    phone: '010-1234-5678',
    grade: 'Bronze',
    total_purchase_amount: 50000,
    is_face_registered: false,
    is_email_agreed: true,
    created_at: '2025-01-01T00:00:00',
  },

  /* festival 테이블 컬럼명 기준 */
  festivals: [
    {
      id: 1,
      name: '2026 워터밤 서울',
      start_date: '2026-07-01',
      end_date: '2026-07-03',
      is_active: true,
      map_image_url: 'https://example.com/maps/waterbomb.png',
      created_at: '2026-05-28T00:33:42',
      is_adult_only: false,
      /* 추가 메타 (프론트 전용) */
      category: '콘서트',
      venue: 'DDP 서울디자인플라자',
      start_time: '13:00',
      end_time: '22:00',
      min_price: 88000,
      thumbnail_url: null,
      badge_label: 'HOT',
      is_hot: true,
      view_count: 15420,
    },
    {
      id: 2,
      name: '2026 퀸즈 락페',
      start_date: '2026-08-15',
      end_date: '2026-08-17',
      is_active: true,
      map_image_url: 'https://example.com/maps/queensrock.png',
      created_at: '2026-05-28T00:33:42',
      is_adult_only: false,
      category: '콘서트',
      venue: '인천 송도 달빛공원',
      start_time: '16:00',
      end_time: '24:00',
      min_price: 99000,
      thumbnail_url: null,
      badge_label: 'HOT',
      is_hot: true,
      view_count: 21000,
    },
    {
      id: 3,
      name: '2026 FESTIO 대전 여름 페스티벌',
      start_date: '2026-07-25',
      end_date: '2026-07-27',
      is_active: true,
      map_image_url: null,
      created_at: '2026-05-28T02:39:20',
      is_adult_only: false,
      category: '지역축제',
      venue: 'DCC 대전컨벤션센터',
      start_time: '15:00',
      end_time: '22:00',
      min_price: 35000,
      thumbnail_url: null,
      badge_label: '신규',
      is_hot: false,
      view_count: 3200,
    },
    {
      id: 4,
      name: '2026 FESTIO 성인 나이트 페스티벌',
      start_date: '2026-08-10',
      end_date: '2026-08-10',
      is_active: true,
      map_image_url: null,
      created_at: '2026-05-28T02:39:20',
      is_adult_only: true,
      category: '콘서트',
      venue: '서울 올림픽공원 SKY잔디광장',
      start_time: '19:00',
      end_time: '02:00',
      min_price: 66000,
      thumbnail_url: null,
      badge_label: '타임세일',
      is_hot: true,
      view_count: 8800,
    },
    {
      id: 5,
      name: '2026 서울 뮤직위크',
      start_date: '2026-09-05',
      end_date: '2026-09-07',
      is_active: true,
      map_image_url: null,
      created_at: '2026-05-28T03:00:00',
      is_adult_only: false,
      category: '뮤지컬',
      venue: '세종문화회관 대극장',
      start_time: '19:30',
      end_time: '22:00',
      min_price: 110000,
      thumbnail_url: null,
      badge_label: '추천',
      is_hot: false,
      view_count: 5600,
    },
    {
      id: 6,
      name: '2026 킨텍스 K-컬처 박람회',
      start_date: '2026-09-20',
      end_date: '2026-09-23',
      is_active: true,
      map_image_url: null,
      created_at: '2026-05-28T03:00:00',
      is_adult_only: false,
      category: '박람회',
      venue: '킨텍스 제1전시장',
      start_time: '10:00',
      end_time: '20:00',
      min_price: 30000,
      thumbnail_url: null,
      badge_label: '신규',
      is_hot: false,
      view_count: 2100,
    },
    {
      id: 7,
      name: '2026 한양대 대동제',
      start_date: '2026-05-28',
      end_date: '2026-05-30',
      is_active: true,
      map_image_url: null,
      created_at: '2026-05-28T03:30:00',
      is_adult_only: false,
      category: '대학축제',
      venue: '한양대학교 대운동장',
      start_time: '13:00',
      end_time: '22:00',
      min_price: 0,
      thumbnail_url: null,
      badge_label: 'D-DAY',
      is_hot: false,
      view_count: 4500,
    },
  ],

  /* festival_zone 테이블 기준 */
  festival_zones: [
    { id: 1, festival_id: 1, zone_name: '스탠딩존', zone_code: 'STANDING', capacity: 500, remaining: 342, price: 55000, color_code: '#00E5CC' },
    { id: 2, festival_id: 1, zone_name: '지정석 A', zone_code: 'ZONE_A', capacity: 300, remaining: 156, price: 88000, color_code: '#6A4DFF' },
    { id: 3, festival_id: 1, zone_name: '지정석 B', zone_code: 'ZONE_B', capacity: 400, remaining: 289, price: 66000, color_code: '#FF6B35' },
    { id: 4, festival_id: 1, zone_name: 'VIP석', zone_code: 'VIP', capacity: 100, remaining: 23, price: 132000, color_code: '#FFB800' },
  ],

  /* orders 테이블 기준 (구: ticket_order) */
  orders: [
    {
      id: 1,
      user_id: 1,
      festival_id: 1,
      zone_id: 2,
      quantity: 2,
      total_amount: 176000,
      status: 'PAID',
      payment_method: 'CARD',
      pg_provider: 'toss',
      order_uid: 'ORDER-UUID-001',
      created_at: '2026-05-10T14:32:00',
      /* 조인 데이터 */
      festival_name: '2026 워터밤 서울',
      zone_name: '지정석 A',
      thumbnail_url: null,
    },
  ],

  /* user_coupon 테이블 기준 */
  user_coupons: [
    {
      id: 1,
      user_id: 1,
      coupon_id: 1,
      is_used: false,
      used_at: null,
      /* coupon 조인 */
      coupon_name: '신규가입 20% 할인',
      discount_type: 'PERCENT',
      discount_value: 20,
      min_order_amount: 30000,
      expires_at: '2026-08-31T23:59:59',
    },
  ],

  /* wishlist 테이블 기준 */
  wishlist_ids: [2, 5],

  /* review 테이블 기준 */
  reviews: [
    {
      id: 1,
      user_id: 1,
      festival_id: 1,
      rating: 5,
      content: '음향이 정말 훌륭했고 아티스트 라인업이 완벽했습니다!',
      created_at: '2026-05-12T10:00:00',
      festival_name: '2026 워터밤 서울',
    },
  ],

  /* inquiry 테이블 기준 */
  inquiries: [],
};

/* ── DB 컬럼명 → JS 필드명 변환 헬퍼 ──────────────────────── */
/**
 * festival 테이블 row → JS에서 사용하는 필드명으로 정규화
 * DB: id, name, start_date, end_date, is_active, map_image_url, is_adult_only
 * JS (기존 코드 호환): eventNo, eventName, startDate, endDate, isActive, isAdultOnly
 */
function normalizeFestival(row) {
  if (!row) return null;

  const targetStartDate = row.startDate || row.start_date;
  const targetEndDate = row.endDate || row.end_date;
  const targetCreatedAt = row.createdAt || row.created_at;

  // 1. D-Day Fallback 계산 (자바 백엔드 계산값이 없을 경우 대비)
  let dday = row.dday || row.d_day;
  if (!dday && targetStartDate) {
    const start = new Date(targetStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const diff = start.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days > 0) dday = `D-${days}`;
    else if (days === 0) dday = "D-Day";
    else {
      if (targetEndDate && new Date(targetEndDate) < today) {
        dday = "종료";
      } else {
        dday = "진행중";
      }
    }
  }

  // 2. isNew Fallback 계산 (등록 후 7일 이내)
  let isNew = row.isNew !== undefined ? row.isNew : row.is_new;
  if (isNew === undefined && targetCreatedAt) {
    const created = new Date(targetCreatedAt);
    const today = new Date();
    const diff = today.getTime() - created.getTime();
    const diffDays = diff / (1000 * 60 * 60 * 24);
    isNew = diffDays <= 7;
  }

  return {
    /* DB 컬럼 원본 (항상 포함) */
    id: row.id,
    name: row.name || row.eventName,
    start_date: targetStartDate,
    end_date: targetEndDate,
    is_active: row.is_active !== undefined ? row.is_active : row.isActive,
    map_image_url: row.map_image_url || row.mapImageUrl,
    created_at: targetCreatedAt,
    is_adult_only: row.is_adult_only !== undefined ? row.is_adult_only : row.isAdultOnly,
    description_html: row.description_html || row.descriptionHtml,

    /* 기존 JS 코드 호환 alias */
    eventNo: row.id,
    eventName: row.name || row.eventName,
    startDate: targetStartDate,
    endDate: targetEndDate,
    eventDate: targetStartDate,      // 표시용 단일 날짜
    eventEndDate: targetEndDate,
    isActive: row.is_active !== undefined ? row.is_active : row.isActive,
    isAdultOnly: row.is_adult_only !== undefined ? row.is_adult_only : row.isAdultOnly,
    mapImageUrl: row.map_image_url || row.mapImageUrl,
    descriptionHtml: row.description_html || row.descriptionHtml,

    /* 추가 메타 (API 또는 Mock에서 제공) */
    category: row.category || '',
    venue: row.venue || '',
    startTime: row.start_time || row.startTime || '',
    endTime: row.end_time || row.endTime || '',
    minPrice: row.minPrice !== undefined ? row.minPrice : (row.min_price || 0),
    thumbnailUrl: row.thumbnail_url || row.thumbnailUrl || null,
    badgeLabel: row.badge_label || row.badgeLabel || null,
    isHot: row.is_hot !== undefined ? row.is_hot : (row.isHot || false),
    viewCount: row.viewCount || row.view_count || 0,
    isNew: !!isNew,
    dday: dday || '-',
    ticketMode: row.ticketMode || row.ticket_mode || 'SEAT',
  };
}

function normalizeOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    festivalId: row.festival_id,
    zoneId: row.zone_id,
    quantity: row.quantity,
    totalAmount: row.total_amount,
    status: row.status,
    paymentMethod: row.payment_method,
    pgProvider: row.pg_provider,
    orderUid: row.order_uid,
    createdAt: row.created_at,
    /* 조인 */
    eventName: row.festival_name,
    zoneName: row.zone_name,
    thumbnailUrl: row.thumbnail_url,
    /* 상태 한글 */
    statusLabel: { PAID: '결제완료', PENDING: '결제대기', CANCELLED: '취소완료', USED: '사용완료' }[row.status] || row.status,
  };
}

function normalizeUserCoupon(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    couponId: row.coupon_id,
    isUsed: row.is_used,
    usedAt: row.used_at,
    couponName: row.coupon_name,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderAmount: row.min_order_amount,
    expiresAt: row.expires_at,
  };
}

function normalizeZone(row) {
  if (!row) return null;
  return {
    id: row.id,
    zoneNo: row.id || row.zone_no || row.zoneNo,
    zoneName: row.zone_name || row.zoneName || row.zone_code || row.zoneCode,
    zoneCode: row.zone_code || row.zoneCode,
    totalCapacity: row.total_capacity !== undefined ? row.total_capacity : (row.capacity !== undefined ? row.capacity : (row.totalCapacity || 0)),
    remainingCapacity: row.remaining_capacity !== undefined ? row.remaining_capacity : (row.remaining !== undefined ? row.remaining : (row.remainingCapacity || 0)),
    price: row.price || 0,
    colorCode: row.color_code || row.colorCode || '#6A4DFF',
    mapBgUrl: row.map_bg_url || row.mapBgUrl || null,
    svgPoints: row.svg_points || row.svgPoints || null,
    festivalId: row.festival_id || row.festivalId
  };
}

/* ═══════════════════════════════════════════════════════════
   app_user API (구: memberApi)
═══════════════════════════════════════════════════════════ */
const memberApi = {
  /** 현재 사용자 정보 조회 */
  getMe: async () => {
    if (USE_MOCK) return { ...MOCK.app_user };
    const sb = getSupabase();
    if (!sb) return { ...MOCK.app_user };
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const { data } = await sb.from('app_user').select('*').eq('id', user.id).single();
      return data;
    } catch (e) {
      markSupabaseUnreachable(e);
      return { ...MOCK.app_user };
    }
  },

  /** 프로필 수정 */
  updateMe: async (payload) => {
    if (USE_MOCK) { Object.assign(MOCK.app_user, payload); return { ...MOCK.app_user }; }
    const sb = getSupabase();
    if (!sb) { Object.assign(MOCK.app_user, payload); return { ...MOCK.app_user }; }
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { Object.assign(MOCK.app_user, payload); return { ...MOCK.app_user }; }
      const { data } = await sb.from('app_user').update(payload).eq('id', user.id).select().single();
      return data;
    } catch (e) {
      markSupabaseUnreachable(e);
      Object.assign(MOCK.app_user, payload);
      return { ...MOCK.app_user };
    }
  },

  /** 알림 설정 변경 */
  updateNotification: async (is_email_agreed) => {
    return memberApi.updateMe({ is_email_agreed });
  },

  /** 안면인증 데이터 저장 */
  saveFaceData: async (faceLandmarkData) => {
    if (USE_MOCK) { MOCK.app_user.is_face_registered = true; return { success: true }; }
    return memberApi.updateMe({ face_landmark_data: faceLandmarkData, is_face_registered: true });
  },
};

/* ── 외부 API 호출 함수 ─────────────────────────────────────── */
window.fetchKopisEvents = async function () {
  try {
    const pages = [1, 2, 3];
    const fetchPromises = pages.map(p => fetch(`/api/external/kopis?cpage=${p}&rows=100&stdate=20250101&eddate=20251231`).then(r => r.ok ? r.text() : ''));
    const xmlTexts = await Promise.all(fetchPromises);
    const parser = new DOMParser();
    const events = [];

    xmlTexts.forEach((xmlText, pageIndex) => {
      if (!xmlText) return;
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const items = xmlDoc.getElementsByTagName('db');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const name = item.querySelector('prfnm')?.textContent;
        const genre = item.querySelector('genrenm')?.textContent || '';
        let cat = '콘서트/뮤지컬';
        let mockPrice = 110000;
        if (genre.includes('연극')) { cat = '연극'; mockPrice = 45000; }
        else if (genre.includes('클래식') || genre.includes('무용') || genre.includes('국악')) { cat = '클래식/무용'; mockPrice = 30000; }
        else if (genre.includes('뮤지컬')) { cat = '뮤지컬'; mockPrice = 140000; }
        else if (genre.includes('대중음악') || genre.includes('콘서트')) { cat = '콘서트'; mockPrice = 120000; }

        let startDateStr = item.querySelector('prfpdfrom')?.textContent?.replace(/\./g, '-');
        let endDateStr = item.querySelector('prfpdto')?.textContent?.replace(/\./g, '-');
        if (startDateStr) startDateStr = startDateStr.replace('2024-', '2026-');
        if (endDateStr) endDateStr = endDateStr.replace('2024-', '2026-');

        events.push(normalizeFestival({
          id: 'k_' + item.querySelector('mt20id')?.textContent + '_' + pageIndex,
          name: name,
          start_date: startDateStr,
          end_date: endDateStr,
          is_active: true,
          category: cat,
          venue: item.querySelector('fcltynm')?.textContent,
          thumbnail_url: item.querySelector('poster')?.textContent?.replace(/https?:\/\/www\.kopis\.or\.kr/g, 'https://kopis.or.kr'),
          min_price: mockPrice,
          badge_label: null,
          is_hot: i % 7 === 0,
          is_new: true,
          view_count: Math.floor(Math.random() * 5000) + 100
        }));
      }
    });
    return events;
  } catch (e) {
    console.warn('KOPIS fetch error', e);
    return [];
  }
};

window.fetchTourEvents = async function () {
  try {
    const pages = [1, 2, 3];
    const fetchPromises = pages.map(p => fetch(`/api/external/tour?pageNo=${p}&numOfRows=100&eventStartDate=20250101`).then(r => r.ok ? r.json() : null));
    const jsonResults = await Promise.all(fetchPromises);
    const events = [];

    jsonResults.forEach((json, pageIndex) => {
      if (!json) return;
      const items = json.response?.body?.items?.item || [];
      if (!Array.isArray(items)) return;

      items.forEach((item, i) => {
        let startDateStr = item.eventstartdate ? item.eventstartdate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null;
        let endDateStr = item.eventenddate ? item.eventenddate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : null;
        if (startDateStr) startDateStr = startDateStr.replace('2025-', '2026-');
        if (endDateStr) endDateStr = endDateStr.replace('2025-', '2026-');
        events.push(normalizeFestival({
          id: 't_' + item.contentid + '_' + pageIndex,
          name: item.title,
          start_date: startDateStr,
          end_date: endDateStr,
          is_active: true,
          category: '지역축제',
          venue: item.addr1 || item.addr2 || '장소 미정',
          thumbnail_url: item.firstimage || item.firstimage2,
          min_price: 0,
          badge_label: null,
          is_hot: i % 8 === 0,
          is_new: true,
          view_count: Math.floor(Math.random() * 3000) + 50,
          map_image_url: item.firstimage,
        }));
      });
    });
    return events;
  } catch (e) {
    console.warn('TourAPI fetch error', e);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════
   festival API (구: eventApi)
   DB 테이블명: festival
   컬럼: id, name, start_date, end_date, is_active, map_image_url, created_at, is_adult_only
═══════════════════════════════════════════════════════════ */
const eventApi = {
  /** 전체 행사 목록 조회 (점진적 로드) */
  getEvents: async (category = null, onProgress = null) => {
    let allEvents = [];

    // 1. 스프링 부트 백엔드 API (/api/festival) 우선 조회 시도
    let backendSuccess = false;
    try {
      const response = await fetch('/api/festival');
      if (response.ok) {
        const data = await response.json();
        let list = (data || []).filter(f => f.isActive !== false && f.is_active !== false);
        if (category && category !== 'all') {
          list = list.filter(f => f.category === category);
        }
        const normalized = list.map(normalizeFestival);
        allEvents = [...normalized];
        if (onProgress) onProgress([...allEvents]);
        backendSuccess = true;
      }
    } catch (e) {
      console.warn('Java 백엔드 API 조회 실패, Supabase/Mock으로 폴백합니다.', e);
    }

    if (!backendSuccess) {
      // 2. Fallback: Mock 데이터 처리
      if (USE_MOCK) {
        let list = MOCK.festivals.filter(f => f.is_active);
        if (category && category !== 'all') {
          list = list.filter(f => f.category === category);
        }
        const normalized = list.map(normalizeFestival);
        allEvents = [...normalized];
        if (onProgress) onProgress([...allEvents]);
      } else {
        // 3. Fallback: Supabase 직접 조회
        try {
          const sb = getSupabase();
          if (sb) {
            let q = sb.from('festival').select('*').eq('is_active', true).order('created_at', { ascending: false });
            if (category && category !== 'all') q = q.eq('category', category);

            const { data, error } = await q;
            if (error) throw error;
            const normalized = (data || []).map(normalizeFestival);
            allEvents = [...normalized];
            if (onProgress) onProgress([...allEvents]);
          }
        } catch (e) {
          console.warn('Failed to fetch from Supabase in getEvents:', e);
          markSupabaseUnreachable(e);
        }
      }
    }

    // 4. 외부 API 병렬 호출 (KOPIS, TourAPI) - 프로그레시브 렌더링
    if (!category || category === 'all' || category === 'concert' || category === 'musical' || category === 'play' || category === 'classic') {
      window.fetchKopisEvents(1).then(kopisEvents => {
        if (kopisEvents.length > 0) {
          allEvents = [...allEvents, ...kopisEvents];
          if (onProgress) onProgress([...allEvents]);
        }
      });
    }

    if (!category || category === 'all' || category === 'local' || category === 'exhibition') {
      window.fetchTourEvents(1).then(tourEvents => {
        if (tourEvents.length > 0) {
          allEvents = [...allEvents, ...tourEvents];
          if (onProgress) onProgress([...allEvents]);
        }
      });
    }

    return allEvents;
  },

  /** 행사 상세 조회 */
  getEventDetail: async (id) => {
    // 1. 자바 백엔드 (/api/festival/{id}) 우선 조회 시도
    try {
      const response = await fetch(`/api/festival/${id}`);
      if (response.ok) {
        const data = await response.json();
        return normalizeFestival(data);
      }
    } catch (e) {
      console.warn('Java Backend single festival fetch failed, falling back...', e);
    }

    // 2. Mock 폴백
    if (USE_MOCK) {
      const found = MOCK.festivals.find(f => f.id === parseInt(id));
      return normalizeFestival(found);
    }

    // 3. Supabase 폴백
    const sb = getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.from('festival').select('*').eq('id', id).single();
        if (!error && data) return normalizeFestival(data);
      } catch (e) {
        console.warn('Supabase fetch error', e);
      }
    }

    // 4. 최종 Mock 폴백
    const mockFound = MOCK.festivals.find(f => f.id === parseInt(id));
    return normalizeFestival(mockFound);
  },

  /** 행사 상세 설명(HTML) 저장 */
  saveDescriptionHtml: async (id, descriptionHtml) => {
    // 1. 자바 백엔드 (/api/festival/{id}/description) 우선 호출 시도
    try {
      const response = await fetch(`/api/festival/${id}/description`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptionHtml })
      });
      if (response.ok) {
        const data = await response.json();
        return normalizeFestival(data);
      }
    } catch (e) {
      console.warn('Java Backend save description failed, falling back to Supabase...', e);
    }

    // 2. Supabase 폴백
    const sb = getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb.from('festival')
          .update({ description_html: descriptionHtml })
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return normalizeFestival(data);
      } catch (e) {
        console.warn('Supabase update description error', e);
      }
    }

    // 3. Mock 폴백
    if (USE_MOCK) {
      const found = MOCK.festivals.find(f => f.id === parseInt(id));
      if (found) {
        found.description_html = descriptionHtml;
        return normalizeFestival(found);
      }
    }

    return null;
  },

  /** 구역 잔여 수량 조회 (festival_zone 테이블) */
  getZoneCapacity: async (festivalId) => {
    // 1. 자바 백엔드 (/api/festival/{id}/zones) 우선 조회 시도
    try {
      const response = await fetch(`/api/festival/${festivalId}/zones`);
      if (response.ok) {
        const zones = await response.json();
        if (zones && zones.length > 0) {
          const populatedZones = await Promise.all(zones.map(async (zone) => {
            let total = 0;
            let reserved = 0;
            let zonePrice = 0;
            try {
              const seatsResponse = await fetch(`/api/festival/seats?zoneId=${zone.id}`);
              if (seatsResponse.ok) {
                const seats = await seatsResponse.json();
                total = seats ? seats.length : 0;
                reserved = seats ? seats.filter(s => s.status === 'RESERVED' || s.isReserved).length : 0;
                zonePrice = seats && seats.length > 0 ? seats[0].price : 0;
              }
            } catch (seatErr) {
              console.warn('Failed to fetch seats for zone ' + zone.id, seatErr);
            }

            const remaining = Math.max(0, total - reserved);
            return normalizeZone({
              ...zone,
              total_capacity: total,
              remaining_capacity: remaining,
              price: zonePrice || 50000
            });
          }));
          return populatedZones;
        }
      }
    } catch (e) {
      console.warn('Java Backend festival zones population failed', e);
    }

    // 2. Mock 폴백 및 최종 좌표 주입 폴백
    console.warn(`No zones found for festivalId ${festivalId} in DB. Falling back to high-fidelity mock zones.`);
    const mockZones = [
      { id: 1, festival_id: festivalId, zone_name: '스탠딩존', zone_code: 'STANDING', capacity: 500, remaining: 342, price: 55000, color_code: '#00E5CC', svg_points: '200,600 200,850 800,850 800,600' },
      { id: 2, festival_id: festivalId, zone_name: '지정석 A', zone_code: 'ZONE_A', capacity: 300, remaining: 156, price: 88000, color_code: '#6A4DFF', svg_points: '100,200 450,200 450,450 100,450' },
      { id: 3, festival_id: festivalId, zone_name: '지정석 B', zone_code: 'ZONE_B', capacity: 400, remaining: 289, price: 66000, color_code: '#FF6B35', svg_points: '550,200 900,200 900,450 550,450' },
      { id: 4, festival_id: festivalId, zone_name: 'VIP석', zone_code: 'VIP', capacity: 100, remaining: 23, price: 132000, color_code: '#FFB800', svg_points: '350,480 350,580 650,580 650,480' }
    ];
    return mockZones.map(normalizeZone);
  },

  /** 예매자 현황 통계 조회 (성별 및 연령대) */
  getEventStats: async (festivalId) => {
    // Supabase에 'bookings' 테이블이 없어 발생하는 400 에러 우회 (임시 목업 반환)
    return {
      gender: { male: 45, female: 55 },
      age: { '10대': 10, '20대': 45, '30대': 30, '40대': 10, '50대이상': 5 }
    };
  },

  /** 관리자 탭 정보 업데이트 */
  updateEventTabContent: async (festivalId, tabName, htmlContent) => {
    if (USE_MOCK) {
      console.log(`[MOCK] updateEventTabContent: ${festivalId} - ${tabName} 업데이트 완료`);
      return true;
    }
    const sb = getSupabase();
    if (!sb) return false;

    // 탭 이름에 따라 저장할 컬럼명 매핑
    const columnMap = {
      'notice': 'notice_html',
      'desc': 'desc_html',
      'price': 'price_html',
      'refund': 'refund_html',
      'venue': 'venue_html',
      'review': 'review_html' // 리뷰를 관리자 공지로 쓸 경우
    };

    const columnName = columnMap[tabName];
    if (!columnName) return false;

    const { error } = await sb.from('events')
      .update({ [columnName]: htmlContent })
      .eq('id', festivalId);

    if (error) {
      console.error('Failed to update tab content:', error);
      return false;
    }
    return true;
  },

  /** 페이지 빌더 콘텐츠(HTML) 불러오기 */
  getBuilderContent: async (festivalId) => {
    if (USE_MOCK) {
      return localStorage.getItem(`festio_event_${festivalId}_tabs`);
    }
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb.from('festival').select('content_json').eq('id', festivalId).single();
    if (error || !data || !data.content_json) return null;
    return data.content_json.html;
  },

  /** 페이지 빌더 콘텐츠(HTML) 저장하기 */
  saveBuilderContent: async (festivalId, htmlContent) => {
    if (USE_MOCK) {
      localStorage.setItem(`festio_event_${festivalId}_tabs`, htmlContent);
      return true;
    }
    const sb = getSupabase();
    if (!sb) return false;
    const { data, error } = await sb.from('festival').update({ content_json: { html: htmlContent } }).eq('id', festivalId).select();

    if (error) {
      console.error('Failed to save builder content:', error);
      return false;
    }

    if (!data || data.length === 0) {
      console.error('Save failed: 0 rows updated. Check RLS policy.');
      if (window.showCustomAlert) {
        window.showCustomAlert('데이터 저장에 실패했습니다.<br><span style="color:#6b7280; font-size:0.9rem; margin-top:0.5rem; display:block;">데이터베이스 접근 권한이 없거나 정책(RLS)에 의해 차단되었습니다.<br>관리자에게 문의하여 권한 설정을 확인해 주세요.</span>', '저장 권한 없음');
      } else {
        alert('데이터 저장에 실패했습니다. 관리자에게 문의해 주세요. (RLS 정책 차단)');
      }
      return false;
    }

    return true;
  }
};

/* ═══════════════════════════════════════════════════════════
   wishlist API
   DB 테이블명: wishlist
   컬럼: id, user_id, festival_id, created_at
═══════════════════════════════════════════════════════════ */
const wishlistApi = {
  /** 찜 목록 festival_id 배열 반환 */
  getWishlist: async () => {
    if (USE_MOCK) return [...MOCK.wishlist_ids];
    const sb = getSupabase();
    if (!sb) {
      try { return JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { return []; }
    }
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        try { return JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { return []; }
      }
      const { data } = await sb.from('wishlist').select('festival_id').eq('user_id', user.id);
      return (data || []).map(r => r.festival_id);
    } catch (e) {
      markSupabaseUnreachable(e);
      try { return JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { return []; }
    }
  },

  addWishlist: async (festivalId) => {
    if (USE_MOCK) {
      if (!MOCK.wishlist_ids.includes(festivalId)) MOCK.wishlist_ids.push(festivalId);
      return { success: true };
    }
    const sb = getSupabase();
    if (!sb) {
      let list = [];
      try { list = JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { }
      if (!list.includes(festivalId)) list.push(festivalId);
      localStorage.setItem('festio_local_wishlist', JSON.stringify(list));
      return { success: true };
    }
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { }
        if (!list.includes(festivalId)) list.push(festivalId);
        localStorage.setItem('festio_local_wishlist', JSON.stringify(list));
        return { success: true };
      }
      const { data } = await sb.from('wishlist').insert({ user_id: user.id, festival_id: festivalId }).select().single();
      return data;
    } catch (e) {
      markSupabaseUnreachable(e);
      let list = [];
      try { list = JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { }
      if (!list.includes(festivalId)) list.push(festivalId);
      localStorage.setItem('festio_local_wishlist', JSON.stringify(list));
      return { success: true };
    }
  },

  /** 찜 제거 */
  removeWishlist: async (festivalId) => {
    if (USE_MOCK) {
      MOCK.wishlist_ids = MOCK.wishlist_ids.filter(n => n !== festivalId);
      return { success: true };
    }
    const sb = getSupabase();
    if (!sb) {
      let list = [];
      try { list = JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { }
      list = list.filter(n => n !== festivalId);
      localStorage.setItem('festio_local_wishlist', JSON.stringify(list));
      return { success: true };
    }
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        let list = [];
        try { list = JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { }
        list = list.filter(n => n !== festivalId);
        localStorage.setItem('festio_local_wishlist', JSON.stringify(list));
        return { success: true };
      }
      await sb.from('wishlist').delete().eq('user_id', user.id).eq('festival_id', festivalId);
      return { success: true };
    } catch (e) {
      markSupabaseUnreachable(e);
      let list = [];
      try { list = JSON.parse(localStorage.getItem('festio_local_wishlist')) || []; } catch { }
      list = list.filter(n => n !== festivalId);
      localStorage.setItem('festio_local_wishlist', JSON.stringify(list));
      return { success: true };
    }
  },

  /** 토글 */
  toggleWishlist: (festivalId, isCurrentlyWished) =>
    isCurrentlyWished
      ? wishlistApi.removeWishlist(festivalId)
      : wishlistApi.addWishlist(festivalId),
};

/* ═══════════════════════════════════════════════════════════
   orders API (구: ticketOrderApi)
   DB 테이블명: orders
   컬럼: id, user_id, festival_id, zone_id, quantity, total_amount,
         status, payment_method, pg_provider, order_uid, created_at
═══════════════════════════════════════════════════════════ */
const ticketOrderApi = {
  /** 예매 내역 조회 */
  getMyOrders: async () => {
    if (USE_MOCK) return MOCK.orders.map(normalizeOrder);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from('orders')
      .select(`
        *,
        festival:festival_id ( name, thumbnail_url ),
        festival_zone:zone_id ( zone_name, price )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    return (data || []).map(row => normalizeOrder({
      ...row,
      festival_name: row.festival?.name,
      thumbnail_url: row.festival?.thumbnail_url,
      zone_name: row.festival_zone?.zone_name,
    }));
  },

  /** 예매 생성 (대기열 진입 후 결제 완료 시 호출) */
  createOrder: async ({ festivalId, zoneId, quantity, couponId = null, paymentMethod = 'CARD' }) => {
    if (USE_MOCK) {
      const zone = MOCK.festival_zones.find(z => z.id === parseInt(zoneId));
      const totalAmount = zone ? zone.price * quantity : 0;
      const orderUid = `FESTIO-${MOCK.app_user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
      const newOrder = {
        id: Date.now(),
        user_id: MOCK.app_user.id,
        festival_id: parseInt(festivalId),
        zone_id: parseInt(zoneId),
        quantity,
        total_amount: totalAmount,
        status: 'PENDING',
        payment_method: paymentMethod,
        pg_provider: 'toss',
        order_uid: orderUid,
        created_at: new Date().toISOString(),
        festival_name: MOCK.festivals.find(f => f.id === parseInt(festivalId))?.name,
        zone_name: zone?.zone_name,
        thumbnail_url: null,
      };
      MOCK.orders.unshift(newOrder);
      return normalizeOrder(newOrder);
    }
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const zone = await sb.from('festival_zone').select('price').eq('id', zoneId).single();
    const totalAmount = (zone.data?.price || 0) * quantity;
    const orderUid = `FESTIO-${user.id}-${Date.now()}`.toUpperCase();
    const { data } = await sb.from('orders').insert({
      user_id: user.id, festival_id: festivalId, zone_id: zoneId,
      quantity, total_amount: totalAmount,
      status: 'PENDING', payment_method: paymentMethod,
      pg_provider: 'toss', order_uid: orderUid,
    }).select().single();
    return normalizeOrder(data);
  },

  /** 결제 완료 처리 */
  confirmPayment: async (orderId, pgData) => {
    try {
      const response = await fetch(`/api/order/tickets/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' })
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, ...data };
      }
    } catch (e) {
      console.warn('Java Backend confirmPayment failed, trying fallback...', e);
    }
    return { success: true };
  },

  /** 예매 취소 */
  cancelOrder: async (orderId) => {
    try {
      const response = await fetch(`/api/order/tickets/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REFUNDED' })
      });
      if (response.ok) {
        return { success: true };
      }
    } catch (e) {
      console.warn('Java Backend cancelOrder failed', e);
    }
    return { success: true };
  },
};

/* ═══════════════════════════════════════════════════════════
   user_coupon API (구: couponApi 일부 변경)
   DB 테이블명: user_coupon + coupon join
═══════════════════════════════════════════════════════════ */
const couponApi = {
  /** 보유 쿠폰 목록 */
  getMyCoupons: async () => {
    if (USE_MOCK) return MOCK.user_coupons.map(normalizeUserCoupon);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from('user_coupon')
      .select(`*, coupon:coupon_id ( name, discount_type, discount_value, min_order_amount, expires_at )`)
      .eq('user_id', user.id)
      .eq('is_used', false);
    return (data || []).map(row => normalizeUserCoupon({
      ...row,
      coupon_name: row.coupon?.name,
      discount_type: row.coupon?.discount_type,
      discount_value: row.coupon?.discount_value,
      min_order_amount: row.coupon?.min_order_amount,
      expires_at: row.coupon?.expires_at,
    }));
  },
};

/* ═══════════════════════════════════════════════════════════
   review API
   DB 테이블명: review
   컬럼: id, user_id, festival_id, rating, content, created_at
═══════════════════════════════════════════════════════════ */
const reviewApi = {
  getMyReviews: async () => {
    if (USE_MOCK) return [...MOCK.reviews];
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from('review')
      .select(`*, festival:festival_id ( name )`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    return (data || []).map(r => ({ ...r, festival_name: r.festival?.name }));
  },

  createReview: async ({ festivalId, orderId, rating, content }) => {
    if (USE_MOCK) {
      const r = { id: Date.now(), user_id: MOCK.app_user.id, festival_id: festivalId, rating, content, created_at: new Date().toISOString() };
      MOCK.reviews.unshift(r);
      return r;
    }
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const { data } = await sb.from('review').insert({
      user_id: user.id, festival_id: festivalId, order_id: orderId, rating, content,
    }).select().single();
    return data;
  },
};

/* ═══════════════════════════════════════════════════════════
   inquiry API
   DB 테이블명: inquiry
   컬럼: id, user_id, title, content, status, answer, created_at
═══════════════════════════════════════════════════════════ */
const inquiryApi = {
  getMyInquiries: async () => {
    if (USE_MOCK) return [...MOCK.inquiries];
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];
    const { data } = await sb.from('inquiry')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    return data || [];
  },

  createInquiry: async ({ title, content }) => {
    if (USE_MOCK) {
      const item = { id: Date.now(), user_id: MOCK.app_user.id, title, content, status: 'PENDING', answer: null, created_at: new Date().toISOString() };
      MOCK.inquiries.unshift(item);
      return item;
    }
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    const { data } = await sb.from('inquiry').insert({ user_id: user.id, title, content, status: 'PENDING' }).select().single();
    return data;
  },
};

/* ═══════════════════════════════════════════════════════════
   scan_log API (QR 입장 스캔)
   DB 테이블명: scan_log
   컬럼: id, order_id, scanned_at, scanner_user_id, is_valid
═══════════════════════════════════════════════════════════ */
const scanApi = {
  logScan: async ({ orderId, isValid }) => {
    if (USE_MOCK) return { success: true, is_valid: isValid };
    const sb = getSupabase();
    const { data } = await sb.from('scan_log').insert({
      order_id: orderId, is_valid: isValid, scanned_at: new Date().toISOString(),
    }).select().single();
    return data;
  },
};

/* ═══════════════════════════════════════════════════════════
   emergency_broadcast API
   DB 테이블명: emergency_broadcast
   컬럼: id, festival_id, message, severity, created_at, is_active
═══════════════════════════════════════════════════════════ */
const broadcastApi = {
  getActive: async (festivalId) => {
    if (USE_MOCK) return [];
    const sb = getSupabase();
    const { data } = await sb.from('emergency_broadcast')
      .select('*')
      .eq('festival_id', festivalId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);
    return data || [];
  },
};

/* ═══════════════════════════════════════════════════════════
   comment API (실시간 소통 댓글)
   DB 테이블명: event_comments, comment_likes, comment_reports
═══════════════════════════════════════════════════════════ */
const commentApi = {
  getComments: async (festivalId) => {
    const getOfflineComments = (fid) => {
      try {
        const localData = localStorage.getItem(`festio_mock_comments_${fid}`);
        if (localData) return JSON.parse(localData);
      } catch { }
      return [
        {
          id: 101,
          festival_id: fid,
          content: '라인업이 너무 기대되네요! 티켓팅 꼭 성공했으면 좋겠습니다.',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          author_name: '페스티벌러',
          author_img: 'https://ui-avatars.com/api/?name=F&background=f3f4f6',
          author_gender: 'M',
          like_count: 5,
          is_liked: false
        },
        {
          id: 102,
          festival_id: fid,
          content: '작년에 정말 재밌었는데 올해는 더 재밌을 것 같아요!',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          author_name: '멜로디',
          author_img: 'https://ui-avatars.com/api/?name=M&background=f3f4f6',
          author_gender: 'F',
          like_count: 2,
          is_liked: false
        }
      ];
    };

    if (USE_MOCK) return getOfflineComments(festivalId);
    const sb = getSupabase();
    if (!sb) return getOfflineComments(festivalId);

    try {
      let user = null;
      try {
        const authRes = await sb.auth.getUser();
        user = authRes.data?.user;
      } catch { }

      // 가져올 때 좋아요 개수, 내가 좋아요 했는지 여부, 작성자 정보(app_user) 조인
      // Supabase 릴레이션에 따라 쿼리가 달라질 수 있음. (간단하게 구현)
      const { data, error } = await sb
        .from('event_comments')
        .select(`
          *,
          app_user:user_id ( name, profile_img, gender ),
          comment_likes ( user_id )
        `)
        .eq('festival_id', festivalId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // 데이터 가공 (좋아요 수, 내 좋아요 여부)
      return data.map(c => {
        const likes = c.comment_likes || [];
        return {
          ...c,
          author_name: c.app_user?.name || '익명',
          author_img: c.app_user?.profile_img || 'https://ui-avatars.com/api/?name=U&background=f3f4f6',
          author_gender: c.app_user?.gender || 'U',
          like_count: likes.length,
          is_liked: user ? likes.some(l => l.user_id === user.id) : false
        };
      });
    } catch (e) {
      console.warn('Failed to load comments from Supabase, using mock fallback.', e);
      markSupabaseUnreachable(e);
      return getOfflineComments(festivalId);
    }
  },

  addComment: async (festivalId, content, parentId = null, mediaUrl = null) => {
    const getOfflineComments = (fid) => {
      try {
        const localData = localStorage.getItem(`festio_mock_comments_${fid}`);
        if (localData) return JSON.parse(localData);
      } catch { }
      return [
        {
          id: 101,
          festival_id: fid,
          content: '라인업이 너무 기대되네요! 티켓팅 꼭 성공했으면 좋겠습니다.',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          author_name: '페스티벌러',
          author_img: 'https://ui-avatars.com/api/?name=F&background=f3f4f6',
          author_gender: 'M',
          like_count: 5,
          is_liked: false
        },
        {
          id: 102,
          festival_id: fid,
          content: '작년에 정말 재밌었는데 올해는 더 재밌을 것 같아요!',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          author_name: '멜로디',
          author_img: 'https://ui-avatars.com/api/?name=M&background=f3f4f6',
          author_gender: 'F',
          like_count: 2,
          is_liked: false
        }
      ];
    };

    const sb = getSupabase();
    if (!sb) {
      const mockComments = getOfflineComments(festivalId);
      const newComment = {
        id: Date.now(),
        festival_id: parseInt(festivalId),
        user_id: 'mock-user-id',
        parent_id: parentId,
        content: content,
        media_url: mediaUrl,
        created_at: new Date().toISOString(),
        author_name: localStorage.getItem('userNickname') || '익명(오프라인)',
        author_img: 'https://ui-avatars.com/api/?name=U&background=f3f4f6',
        author_gender: localStorage.getItem('userGender') || 'U',
        like_count: 0,
        is_liked: false
      };
      mockComments.push(newComment);
      localStorage.setItem(`festio_mock_comments_${festivalId}`, JSON.stringify(mockComments));
      return newComment;
    }

    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data, error } = await sb.from('event_comments').insert({
        festival_id: festivalId,
        user_id: user.id,
        parent_id: parentId,
        content: content,
        media_url: mediaUrl
      }).select().single();

      if (error) throw error;

      // 대댓글인 경우 부모 댓글 작성자에게 알림 발송 (자신이 자신에게 단 경우는 제외)
      if (parentId) {
        const { data: parentComment } = await sb.from('event_comments').select('user_id').eq('id', parentId).single();
        if (parentComment && parentComment.user_id !== user.id) {
          await notificationApi.createNotification({
            userId: parentComment.user_id,
            type: 'REPLY',
            targetId: data.id
          });
        }
      }

      return data;
    } catch (e) {
      markSupabaseUnreachable(e);
      throw e;
    }
  },

  updateComment: async (commentId, content) => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await sb.from('event_comments')
      .update({ content: content })
      .eq('id', commentId)
      .eq('user_id', user.id)
      .select().single();

    if (error) throw error;
    return data;
  },

  deleteComment: async (commentId) => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // 자식 대댓글 확인
    const { data: children } = await sb.from('event_comments')
      .select('id')
      .eq('parent_id', commentId);

    if (children && children.length > 0) {
      // 대댓글이 있으면 소프트 삭제
      const { data, error } = await sb.from('event_comments')
        .update({ is_deleted: true, content: '' })
        .eq('id', commentId)
        .eq('user_id', user.id)
        .select().single();
      if (error) throw error;
      return { type: 'soft', data };
    } else {
      // 없으면 완전 삭제
      const { error } = await sb.from('event_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);
      if (error) throw error;
      return { type: 'hard' };
    }
  },

  uploadCommentMedia: async (file) => {
    if (USE_MOCK) return null;
    const sb = getSupabase();
    if (!sb) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await sb.storage
      .from('event_comments_media')
      .upload(filePath, file);

    if (error) {
      console.error('File upload error:', error);
      throw error;
    }

    const { data: publicUrlData } = sb.storage
      .from('event_comments_media')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  },

  toggleLike: async (commentId) => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // 이미 좋아요를 했는지 확인
    const { data: existing } = await sb.from('comment_likes')
      .select('*').eq('comment_id', commentId).eq('user_id', user.id).single();

    if (existing) {
      // 취소
      await sb.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user.id);
      return { liked: false };
    } else {
      // 추가
      await sb.from('comment_likes').insert({ comment_id: commentId, user_id: user.id });

      // 댓글 작성자에게 좋아요 알림 발송
      const { data: comment } = await sb.from('event_comments').select('user_id').eq('id', commentId).single();
      if (comment && comment.user_id !== user.id) {
        await notificationApi.createNotification({
          userId: comment.user_id,
          type: 'LIKE',
          targetId: commentId
        });
      }
      return { liked: true };
    }
  },

  reportComment: async (commentId, reason) => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { error } = await sb.from('comment_reports').insert({
      comment_id: commentId,
      user_id: user.id,
      reason: reason
    });

    if (error) throw error;
    return true;
  }
};

/* ═══════════════════════════════════════════════════════════
   notification API (알림)
═══════════════════════════════════════════════════════════ */
const notificationApi = {
  getMyNotifications: async () => {
    if (USE_MOCK) return [];
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];

    const { data, error } = await sb.from('user_notifications')
      .select('*, sender:sender_id(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return [];
    return data;
  },

  createNotification: async ({ userId, type, targetId }) => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from('user_notifications').insert({
      user_id: userId,
      sender_id: user.id,
      type: type,
      target_id: targetId
    });
  },

  markAsRead: async (notificationId) => {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from('user_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);
  }
};

/* ── 전역 노출 ──────────────────────────────────────────────── */
window.MOCK = MOCK;
window.memberApi = memberApi;
window.eventApi = eventApi;
window.wishlistApi = wishlistApi;
window.ticketOrderApi = ticketOrderApi;
window.orderApi = ticketOrderApi;
window.couponApi = couponApi;
window.reviewApi = reviewApi;
window.inquiryApi = inquiryApi;
window.scanApi = scanApi;
window.broadcastApi = broadcastApi;
window.commentApi = commentApi;
window.notificationApi = notificationApi;
window.normalizeFestival = normalizeFestival;

