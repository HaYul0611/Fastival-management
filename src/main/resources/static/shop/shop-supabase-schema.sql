-- =====================================================================================
-- FESTIO SHOP 전용 Supabase 테이블 생성 SQL 스크립트
-- 주의: 메인 DB와 분리하여 본인의 개인 Supabase 계정의 [SQL Editor]에서 실행하세요.
-- =====================================================================================

-- 1. Shop 전용 유저 프로필 테이블 (포인트, 등급 등 관리)
CREATE TABLE public.shop_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email text UNIQUE NOT NULL,
  user_name text NOT NULL,
  avatar_url text,
  festio_pay_points integer DEFAULT 0,
  total_spent integer DEFAULT 0,
  tier text DEFAULT 'BRONZE', -- BRONZE, SILVER, GOLD, EMERALD, DIAMOND, VIP, SVIP, VVIP
  noti_food_truck boolean DEFAULT true,
  noti_shipping boolean DEFAULT true,
  noti_marketing boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Shop 상품 테이블 (굿즈, 푸드트럭 메뉴)
CREATE TABLE public.shop_products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type text NOT NULL, -- 'GOODS' 또는 'FOOD'
  name text NOT NULL,
  description text,
  price integer NOT NULL,
  stock_quantity integer DEFAULT 0,
  image_url text,
  options jsonb, -- 사이즈, 색상, 소스 옵션 등
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. 장바구니 테이블
CREATE TABLE public.shop_cart (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id) ON DELETE CASCADE,
  quantity integer DEFAULT 1,
  selected_options jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. 주문 내역 테이블 (결제 및 트래킹)
CREATE TABLE public.shop_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number text UNIQUE NOT NULL,
  profile_id uuid REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
  total_amount integer NOT NULL,
  payment_method text NOT NULL, -- 'TOSS_CARD', 'FESTIO_PAY', 'TOSS_VIRTUAL' 등
  delivery_type text NOT NULL, -- 'PICKUP' (현장수령) 또는 'SHIPPING' (일반배송)
  status text NOT NULL DEFAULT 'PAYMENT_COMPLETED', -- PAYMENT_COMPLETED, PREPARING, READY_FOR_PICKUP, COMPLETED, SHIPPING, DELIVERED
  qr_code_url text, -- 픽업용 정적 QR 코드 이미지
  totp_secret VARCHAR(255), -- 동적 QR(TOTP) 스캔을 위한 시크릿 키
  created_at timestamp with time zone DEFAULT now()
);

-- 5. 주문 상세 아이템 테이블
CREATE TABLE public.shop_order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.shop_products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  price_at_purchase integer NOT NULL,
  selected_options jsonb
);

-- 6. 알림(Notification) 테이블
CREATE TABLE public.shop_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid REFERENCES public.shop_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  target_url text, -- 클릭 시 이동할 URL (예: orders.html)
  created_at timestamp with time zone DEFAULT now()
);

-- (선택) 초기 테스트 상품 데이터 인서트
INSERT INTO public.shop_products (type, name, price, stock_quantity) VALUES 
('FOOD', '스모크 바베큐 버거 + 콜라 세트', 12500, 100),
('GOODS', 'FESTIO 2026 OFFICIAL 헤비 후드 집업', 85000, 50);
