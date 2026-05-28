-- ============================================================
-- FESTIO: 기존 DB에 누락된 컬럼 추가 ALTER TABLE
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- order_item: QR/발권 관련 추가 컬럼
ALTER TABLE order_item
  ADD COLUMN IF NOT EXISTS ticket_type         VARCHAR(20)  DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS owner_user_id       BIGINT,
  ADD COLUMN IF NOT EXISTS is_gifted           BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transfer_token      VARCHAR(64),
  ADD COLUMN IF NOT EXISTS transfer_generated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS target_vulnerable_name  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS target_vulnerable_birth DATE;

-- item_status 확장: ENTERED, SUSPENDED, REFUNDED, WRISTBAND_PENDING, WRISTBAND_ISSUED
-- (VARCHAR이므로 CHECK 없이 값 확장 가능)

-- festival: 성인 전용 플래그
ALTER TABLE festival
  ADD COLUMN IF NOT EXISTS is_adult_only BOOLEAN DEFAULT FALSE;

-- app_user: 성인 인증 관련 컬럼
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS identity_verified   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_birth_date DATE,
  ADD COLUMN IF NOT EXISTS is_adult            BOOLEAN DEFAULT FALSE;

-- RLS 비활성화 확인 (개발 테스트용)
ALTER TABLE app_user         DISABLE ROW LEVEL SECURITY;
ALTER TABLE festival         DISABLE ROW LEVEL SECURITY;
ALTER TABLE festival_zone    DISABLE ROW LEVEL SECURITY;
ALTER TABLE seat_map         DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders           DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_item       DISABLE ROW LEVEL SECURITY;
ALTER TABLE scan_log         DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_history   DISABLE ROW LEVEL SECURITY;
ALTER TABLE store            DISABLE ROW LEVEL SECURITY;
ALTER TABLE product          DISABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist         DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupon      DISABLE ROW LEVEL SECURITY;
ALTER TABLE coupon           DISABLE ROW LEVEL SECURITY;
