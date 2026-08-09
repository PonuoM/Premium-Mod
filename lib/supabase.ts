import { createClient } from '@supabase/supabase-js';

// publishable key เป็น public key โดยการออกแบบ — มันถูกฝังอยู่ในไฟล์ JS ที่ deploy อยู่แล้ว
// ใครกด F12 ก็เห็น สิ่งที่กันข้อมูลจริง ๆ คือ RLS policy ในฐานข้อมูล ไม่ใช่การซ่อน key นี้
// (ดู supabase/migrations/003_enable_rls.sql)
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://orqyxamgukajopqdxpdg.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WkmmmZZdCWimzdR-EBkT_Q_c_pZ8cmh';

// profile_settings ตั้งใจให้มีแถวเดียว (บังคับด้วย check constraint ใน migration 002)
// อ้างอิงด้วย id คงที่แทนการ .limit(1) ซึ่งเคยทำให้หยิบแถวมั่วมาแสดง
export const PROFILE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,    // จำ session ไว้ใน localStorage จะได้ไม่ต้องล็อกอินใหม่ทุกครั้ง
    autoRefreshToken: true,
    detectSessionInUrl: false, // ใช้ email/password ล้วน ไม่มี OAuth redirect
  },
});
