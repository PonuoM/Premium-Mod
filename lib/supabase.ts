import { createClient } from '@supabase/supabase-js';

// ใช้ environment variables เพื่อความปลอดภัย
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://orqyxamgukajopqdxpdg.supabase.co';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycXl4YW1ndWtham9wcWR4cGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5OTk5MjksImV4cCI6MjA3NjU3NTkyOX0.f3S0gkVToR24Ceexjo73Yhzl2awaJAzjY_s7Balj26g';

// สร้าง Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
