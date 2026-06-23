'use strict';

// FESTIO SHOP 전용 Supabase 클라이언트
const SHOP_SUPABASE_URL = 'https://omqrarpixrcyzhmjgkuv.supabase.co';
const SHOP_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tcXJhcnBpeHJjeXpobWpna3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NjAwOTYsImV4cCI6MjA5NzIzNjA5Nn0.CXh6JzXeezDcwRasIZvfsNWjX4dcJSaUM85Qygv90pE';

window.ShopDB = (function () {
  let _client = null;

  /**
   * @description FESTIO SHOP 전용 Supabase 클라이언트 객체를 반환합니다.
   * 싱글톤 패턴을 사용하여 한 번만 초기화됩니다.
   * @returns {Object} Supabase client
   */
  function getClient() {
    if (!_client && window.supabase) {
      _client = window.supabase.createClient(SHOP_SUPABASE_URL, SHOP_SUPABASE_KEY);
    }
    return _client;
  }

  // 간단한 API 래퍼
  return {
    getClient,
    async getProfile(email) {
      const sb = getClient();
      if (!sb) return null;
      const { data, error } = await sb.from('shop_profiles').select('*').eq('user_email', email).maybeSingle();
      if (error) { console.error('Supabase getProfile Error:', error); return null; }

      if (!data) {
        // 프로필이 없으면 자동 생성
        let userName = '회원';
        if (window.FS && window.FS.Session) {
          const u = window.FS.Session.get();
          if (u && u.name) userName = u.name;
        } else {
          // localStorage fallback
          const users = JSON.parse(localStorage.getItem('fs_users') || '[]');
          const user = users.find(u => u.email === email);
          if (user) userName = user.name;
        }

        const newProfile = {
          user_email: email,
          user_name: userName,
          tier: 'BRONZE',
          festio_pay_points: 0,
          total_spent: 0
        };
        const { data: created, error: err2 } = await sb.from('shop_profiles').insert([newProfile]).select().single();
        if (err2) { console.error('Create Profile Error:', err2); return null; }
        return created;
      }
      return data;
    },
    async createProfile(profileData) {
      const sb = getClient();
      if (!sb) return null;
      const { data, error } = await sb.from('shop_profiles').insert([profileData]).select().single();
      if (error) { console.error('Supabase createProfile Error:', error); return null; }
      return data;
    },
    async updateProfile(id, updates) {
      const sb = getClient();
      if (!sb) return null;
      const { data, error } = await sb.from('shop_profiles').update(updates).eq('id', id).select().single();
      if (error) { console.error('Supabase updateProfile Error:', error); return null; }
      return data;
    },
    async getNotifications(profileId) {
      const sb = getClient();
      if (!sb) return [];
      const { data, error } = await sb.from('shop_notifications').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).limit(5);
      if (error) { console.error('Supabase getNoti Error:', error); return []; }
      return data;
    },
    async getWalletHistory(email) {
      const sb = getClient();
      if (!sb) return [];
      const { data, error } = await sb.from('shop_wallet_history').select('*').eq('user_email', email).order('created_at', { ascending: false });
      if (error) {
        // 테이블이 없을 경우 로컬 스토리지 폴백
        return JSON.parse(localStorage.getItem('shopWalletHistory_' + email) || '[]');
      }
      return data;
    },
    async addWalletHistory(historyObj) {
      const sb = getClient();
      if (!sb) return null;
      const { data, error } = await sb.from('shop_wallet_history').insert([historyObj]).select().single();
      if (error) {
        // 테이블이 없을 경우 로컬 스토리지 폴백
        let localHist = JSON.parse(localStorage.getItem('shopWalletHistory_' + historyObj.user_email) || '[]');
        localHist.unshift(historyObj);
        localStorage.setItem('shopWalletHistory_' + historyObj.user_email, JSON.stringify(localHist));
        return historyObj;
      }
      return data;
    }
  };
})();
