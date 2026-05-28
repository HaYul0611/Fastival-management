// ============================================================
// src/features/common/supabase-client.js
// 실제 Supabase 연결 설정 (loqsekbplftdjphzewmx)
// DB 테이블명 기준: docs/schema (app_user, orders, order_item 등)
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://loqsekbplftdjphzewmx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvcXNla2JwbGZ0ZGpwaHpld214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzM5NDYsImV4cCI6MjA5NTM0OTk0Nn0.l6i4VUx6fU0ePN_3RxNb9CJQkpWC-X2HeXb2yGBqDnM';

// ── 싱글톤 클라이언트
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── 테이블명 상수 (docs/schema 기준 100% 일치)
export const TABLE = {
  USER:        'app_user',      // ← user 아님! app_user
  FESTIVAL:    'festival',
  ZONE:        'festival_zone',
  SEAT:        'seat_map',
  STORE:       'store',
  PRODUCT:     'product',
  ORDER:       'orders',        // ← order 아님! orders
  ORDER_ITEM:  'order_item',
  SCAN_LOG:    'scan_log',
  WISHLIST:    'wishlist',
  WALLET:      'wallet_history',
  COUPON:      'coupon',
  USER_COUPON: 'user_coupon',
  SETTLEMENT:  'settlement',
  INQUIRY:     'inquiry',
  REVIEW:      'review',
  BROADCAST:   'emergency_broadcast',
};

// ──────────────────────────────────────
// 인증 유틸
// ──────────────────────────────────────

/** 현재 로그인 세션 반환 (없으면 null) */
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/** 비로그인 시 로그인 페이지로 리디렉트 */
export async function requireAuth(redirectTo = '/src/features/user/client/auth.html') {
  const user = await getCurrentUser();
  if (!user) { location.href = redirectTo; return null; }
  return user;
}

/** app_user 프로필 조회 */
export async function getUserProfile(userId) {
  const { data } = await supabase
    .from(TABLE.USER)
    .select('id, name, email, role, membership_grade, balance, is_adult, identity_verified')
    .eq('id', userId)
    .single();
  return data;
}

// ──────────────────────────────────────
// QR / 발권 유틸
// ──────────────────────────────────────

/** 영문+숫자 12자리 QR 코드 생성 */
export function generateQRCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** 32자리 양도 토큰 생성 */
export function generateTransferToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** QR 만료시간 (현재 + 3분) */
export function getQRExpiredAt() {
  return new Date(Date.now() + 3 * 60 * 1000).toISOString();
}

/** QR 만료 여부 확인 */
export function isQRExpired(qrExpiredAt) {
  return new Date(qrExpiredAt) < new Date();
}

/** 양도 기한(72시간) 만료 여부 확인 */
export function isTransferExpired(transferGeneratedAt) {
  if (!transferGeneratedAt) return false;
  return Date.now() - new Date(transferGeneratedAt).getTime() > 72 * 60 * 60 * 1000;
}

// ──────────────────────────────────────
// 표시 유틸
// ──────────────────────────────────────

/** 이름 마스킹: 오하율 → 오*율 */
export function maskName(name) {
  if (!name || name.length < 2) return name;
  if (name.length === 2) return name[0] + '*';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

/** 카운트다운 포맷: 180 → "3:00" */
export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 생년월일로 성인 여부 확인 */
export function isAdultByBirth(birthDate) {
  if (!birthDate) return false;
  const today = new Date();
  const birth  = new Date(birthDate);
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  return age >= 18;
}

// ──────────────────────────────────────
// 모달 유틸
// ──────────────────────────────────────

/** 공통 모달 표시 */
export function showModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

export function hideModal(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}
