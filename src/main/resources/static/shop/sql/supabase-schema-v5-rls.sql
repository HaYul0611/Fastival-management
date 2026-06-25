-- FESTIO 3차 고도화: 보안 취약점 패치 (오프라인 QR 로그 조작 방어)

-- 1. scan_log 테이블에 RLS 정책 적용
ALTER TABLE public.scan_log ENABLE ROW LEVEL SECURITY;

-- 2. 스태프는 자신의 staff_user_id로만 로그를 기록할 수 있음 (조작 방어)
CREATE POLICY "Staff can only insert their own scan logs"
ON public.scan_log
FOR INSERT
WITH CHECK (
  auth.uid()::text = staff_user_id::text
  -- (선택) JWT 토큰 내 role 검증
  -- AND (auth.jwt() ->> 'role' IN ('ROLE_STAFF', 'ROLE_GATE_STAFF'))
);

-- 3. 스태프는 본인이 기록한 로그만 조회할 수 있음
CREATE POLICY "Staff can view their own scan logs"
ON public.scan_log
FOR SELECT
USING (
  auth.uid()::text = staff_user_id::text
);
