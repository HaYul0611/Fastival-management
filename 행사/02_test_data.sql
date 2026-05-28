-- ============================================================
-- FESTIO: 기능 테스트용 샘플 데이터
-- 01_alter_tables.sql 실행 후 이 파일을 실행하세요
-- ============================================================

-- 1. 테스트 유저 (스태프 + 일반)
INSERT INTO app_user (email, password, name, role, membership_grade, balance)
VALUES
  ('staff@festio.com',  'test1234', '김스태프', 'ROLE_STAFF', 'BRONZE',     0),
  ('admin@festio.com',  'test1234', '이관리자', 'ROLE_ADMIN', 'VIP',         0),
  ('user1@festio.com',  'test1234', '오하율',   'ROLE_USER',  'GOLD',   50000),
  ('user2@festio.com',  'test1234', '김소희',   'ROLE_USER',  'SILVER', 30000)
ON CONFLICT (email) DO NOTHING;

-- 2. 테스트 행사
INSERT INTO festival (name, start_date, end_date, is_active, is_adult_only)
VALUES
  ('2026 FESTIO 대전 여름 페스티벌', '2026-07-25', '2026-07-27', TRUE, FALSE),
  ('2026 FESTIO 성인 나이트 페스티벌', '2026-08-10', '2026-08-10', TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- 3. 구역 (festival_id=1 기준)
INSERT INTO festival_zone (festival_id, zone_name, svg_points, safety_limit, current_crowd_count, density_level, status)
VALUES
  (1, 'VIP 지정석 A구역', '10,10 40,10 40,40 10,40', 200, 45,  '보통', 'NORMAL'),
  (1, '일반 지정석 B구역', '45,10 90,10 90,40 45,40', 300, 120, '보통', 'NORMAL'),
  (1, '스탠딩 자유구역',   '10,45 90,45 90,85 10,85', 500, 280, '혼잡', 'CAUTION')
ON CONFLICT DO NOTHING;

-- 4. 좌석 데이터 (zone_id=1: VIP A구역 20석)
INSERT INTO seat_map (zone_id, seat_row, seat_number, price, status, is_reserved, version)
SELECT
  1,
  CASE WHEN n <= 10 THEN 'A열' ELSE 'B열' END,
  CASE WHEN n <= 10 THEN n ELSE n - 10 END,
  150000,
  CASE WHEN n IN (2,5,7) THEN '결제완료' WHEN n IN (3,8) THEN '가선점' ELSE '빈자리' END,
  CASE WHEN n IN (2,5,7,3,8) THEN TRUE ELSE FALSE END,
  0
FROM generate_series(1, 20) n
ON CONFLICT DO NOTHING;

-- 좌석 데이터 (zone_id=2: 일반 B구역 30석)
INSERT INTO seat_map (zone_id, seat_row, seat_number, price, status, is_reserved, version)
SELECT
  2,
  CASE WHEN n <= 10 THEN 'C열' WHEN n <= 20 THEN 'D열' ELSE 'E열' END,
  CASE WHEN n <= 10 THEN n WHEN n <= 20 THEN n-10 ELSE n-20 END,
  80000,
  CASE WHEN n % 3 = 0 THEN '결제완료' WHEN n % 5 = 0 THEN '가선점' ELSE '빈자리' END,
  CASE WHEN n % 3 = 0 OR n % 5 = 0 THEN TRUE ELSE FALSE END,
  0
FROM generate_series(1, 30) n
ON CONFLICT DO NOTHING;

-- 5. 테스트 주문 + QR 티켓 (user_id=3: 오하율)
INSERT INTO orders (user_id, festival_id, total_price, discount_amount, payment_status)
VALUES (3, 1, 150000, 0, 'PAID')
RETURNING id;

-- 주문 항목 (위 INSERT로 생성된 order id 사용 - 보통 1번)
INSERT INTO order_item (
  order_id, seat_id, quantity,
  qr_code_uuid, qr_expired_at, item_status,
  ticket_type, owner_user_id, is_gifted
)
VALUES (
  1, 4, 1,
  'ABC123DEF456',
  NOW() + INTERVAL '3 minutes',
  'ORDERED',
  'GENERAL', 3, FALSE
);

-- 6. 부스 테스트 데이터
INSERT INTO store (zone_id, name, category, operating_hours, map_x_percent, map_y_percent, is_open)
VALUES
  (3, '춘천닭강정 1호점', 'FOOD',  '11:00~22:00', 25.0, 60.0, TRUE),
  (3, '마라탕 부스',     'FOOD',  '12:00~21:00', 55.0, 65.0, TRUE),
  (3, 'FESTIO 공식 굿즈','GOODS', '10:00~20:00', 75.0, 55.0, TRUE)
ON CONFLICT DO NOTHING;

