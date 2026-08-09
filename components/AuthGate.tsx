import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import UserIcon from './icons/UserIcon';

interface AuthGateProps {
  children: React.ReactNode;
  onCancel: () => void;
}

/**
 * Supabase Auth บังคับให้ identifier เป็นรูปแบบอีเมล พิมพ์ "admin" เฉย ๆ ไม่ผ่าน
 * แต่แอดมินร้านคุ้นกับการพิมพ์ชื่อผู้ใช้สั้น ๆ มากกว่า จึงเติมโดเมนนี้ให้อัตโนมัติ
 * เมื่อกรอกมาโดยไม่มี "@" — ใครกรอกอีเมลเต็มมาก็ยังใช้ได้ตามปกติ
 *
 * ใช้ .local ซึ่งเป็นโดเมนสงวน ส่งเมลไปไม่ถึงใครแน่นอน จึงไม่มีทางหลุดไปหาคนอื่น
 * ผลที่ตามมา: รีเซ็ตรหัสผ่านทางอีเมลไม่ได้ ต้องตั้งใหม่จาก Supabase Dashboard
 */
const USERNAME_DOMAIN = 'premium-mod.local';

const toEmail = (input: string): string => {
  const value = input.trim();
  return value.includes('@') ? value : `${value}@${USERNAME_DOMAIN}`;
};

/**
 * ล็อกหน้า Admin ไว้หลัง Supabase Auth
 *
 * ก่อนหน้านี้หน้า Admin เปิดให้ใครก็เข้าได้ แค่กดปุ่ม "Admin" มุมขวาบน
 * ซึ่งไม่มีปัญหาตอนที่ RLS ยังปิด (เพราะยังไงก็เขียน DB ได้อยู่ดี) แต่พอเปิด RLS แล้ว
 * สิทธิ์เขียนผูกกับ role `authenticated` = ต้องมี session จริงถึงจะทำอะไรได้
 */
const AuthGate: React.FC<AuthGateProps> = ({ children, onCancel }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .catch(() => {
        // อ่าน session ไม่ได้ = ถือว่ายังไม่ล็อกอิน ให้ตกไปที่ฟอร์ม
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    // token หมดอายุแล้ว refresh ไม่ผ่าน หรือ logout จากอีกแท็บ → เด้งกลับมาหน้าล็อกอินเอง
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: toEmail(email),
        password,
      });
      if (signInError) throw signInError;
      setPassword('');
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('Invalid login credentials')) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (message.includes('Failed to fetch')) {
        setError('เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาลองใหม่อีกครั้ง');
      } else {
        setError(message || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } finally {
      setSubmitting(false);
    }
  }, [email, password]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] text-gray-500">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <UserIcon className="h-6 w-6 text-gray-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">แอดมินพาเนล</h1>
          <p className="text-sm text-gray-500 mt-1">กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูล</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
            <input
              id="admin-email"
              // type="text" ไม่ใช่ "email": เบราว์เซอร์จะได้ไม่เด้ง "โปรดใส่ @" ตอนพิมพ์ชื่อผู้ใช้สั้น ๆ
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin"
              autoComplete="username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4A383] focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4A383] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#C4A383] text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
          >
            กลับไปหน้าเลือกนาฬิกา
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthGate;
