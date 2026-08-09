-- 003_enable_rls.sql
-- ปิดรูโหว่: ทุกตารางยังไม่ได้เปิด RLS
--
-- Supabase ให้ browser ยิงเข้า database ตรง ๆ ไม่มี backend คั่นกลาง
-- ตัวเดียวที่กั้นระหว่างคนนอกกับข้อมูลคือ RLS — ซึ่งยังปิดอยู่
-- publishable key ฝังอยู่ในไฟล์ JS บน GitHub Pages ใครกด F12 ก็ copy ไปได้
--
-- หลังรันไฟล์นี้: คนทั่วไปอ่านอย่างเดียว, แก้ไขได้เฉพาะคนที่ล็อกอินแล้ว
--
-- ⚠️ ต้องรันหลัง deploy เว็บที่มีหน้า login แล้วเท่านั้น ไม่งั้นหน้า Admin จะแก้อะไรไม่ได้
-- ⚠️ ต้องปิด public signup ด้วย (Authentication > Sign In / Providers)
--    ไม่งั้นใครก็สมัครเองแล้วได้ role authenticated = เขียนได้
--
-- ────────────────────────────────────────────────────────────
-- บทเรียนจากการรันจริง — ทำไมข้อ 2 ถึงสำคัญที่สุดในไฟล์นี้
--
-- รอบแรกไฟล์นี้ทำแค่ enable RLS + สร้าง policy ของตัวเอง ผลคือ SQL Editor
-- ขึ้น Success และ pg_tables ก็รายงาน rowsecurity = true ครบทุกตาราง
-- แต่ยิง INSERT จากภายนอกด้วย publishable key กลับได้ HTTP 201 — สร้างแถวได้จริง
--
-- สาเหตุ: ฐานข้อมูลนี้มี policy ค้างอยู่ 39 ตัว (จากที่ควรมี 10) สะสมจากการ
-- กดสร้างผ่านหน้า Dashboard หลายรอบ ในจำนวนนั้นมีตัวที่อนุญาตให้ anon เขียนได้
-- ตลอดเวลาที่ผ่านมามันไม่มีผลเพราะ RLS ปิดอยู่ — policy ถูกนิยามไว้เฉย ๆ ไม่ทำงาน
-- พอเปิด RLS ปุ๊บ มันตื่นขึ้นมาทำงานทันที
--
-- ∴ rowsecurity = true อย่างเดียวเชื่อไม่ได้ ต้องกวาด policy ที่ไม่ได้ตั้งใจออกด้วย
--   และต้องยืนยันด้วยการยิงจริงจากภายนอกเสมอ ไม่ใช่ดูแค่ค่าใน catalog
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- 1. เปิด RLS
-- ============================================================

alter table public.skus             enable row level security;
alter table public.part_groups      enable row level security;
alter table public.subcategories    enable row level security;
alter table public.assets           enable row level security;
alter table public.profile_settings enable row level security;

-- ============================================================
-- 2. กวาด policy ที่ไม่ได้ตั้งใจให้มีออกให้หมด
-- ============================================================
-- ลบทุกตัวที่ไม่ใช่ 2 ชื่อที่ไฟล์นี้เป็นคนสร้าง เพราะเราถือว่าไฟล์นี้เป็น
-- แหล่งความจริงเดียวของสิทธิ์เข้าถึง — ตัวไหนไม่ได้อยู่ในนี้คือไม่ควรมี
-- (drop policy ลบแค่กฎ ไม่แตะข้อมูลสักแถว)

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('skus','part_groups','subcategories','assets','profile_settings')
      and policyname not in ('public_read','authenticated_write')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'ลบ policy ที่ไม่ได้ตั้งใจ: % บน %', p.policyname, p.tablename;
  end loop;
end $$;

-- ============================================================
-- 3. Policy ของตาราง — อ่านได้ทุกคน เขียนต้องล็อกอิน
-- ============================================================

drop policy if exists "public_read"         on public.skus;
drop policy if exists "authenticated_write" on public.skus;
create policy "public_read"         on public.skus for select to anon, authenticated using (true);
create policy "authenticated_write" on public.skus for all    to authenticated       using (true) with check (true);

drop policy if exists "public_read"         on public.part_groups;
drop policy if exists "authenticated_write" on public.part_groups;
create policy "public_read"         on public.part_groups for select to anon, authenticated using (true);
create policy "authenticated_write" on public.part_groups for all    to authenticated       using (true) with check (true);

drop policy if exists "public_read"         on public.subcategories;
drop policy if exists "authenticated_write" on public.subcategories;
create policy "public_read"         on public.subcategories for select to anon, authenticated using (true);
create policy "authenticated_write" on public.subcategories for all    to authenticated       using (true) with check (true);

drop policy if exists "public_read"         on public.assets;
drop policy if exists "authenticated_write" on public.assets;
create policy "public_read"         on public.assets for select to anon, authenticated using (true);
create policy "authenticated_write" on public.assets for all    to authenticated       using (true) with check (true);

drop policy if exists "public_read"         on public.profile_settings;
drop policy if exists "authenticated_write" on public.profile_settings;
create policy "public_read"         on public.profile_settings for select to anon, authenticated using (true);
create policy "authenticated_write" on public.profile_settings for all    to authenticated       using (true) with check (true);

-- ============================================================
-- 4. Storage (bucket: watch-assets) — ไม่ต้องทำอะไร
-- ============================================================
-- storage.objects เปิด RLS มาตั้งแต่ต้นและมี policy ที่ถูกต้องอยู่แล้ว
-- ยืนยันด้วยการยิงจริง: อัปโหลดด้วย publishable key ได้ 403
-- "new row violates row-level security policy" ตั้งแต่ก่อนแตะไฟล์นี้
--
-- ร่างแรกของไฟล์นี้เคยมีท่อน drop/create policy บน storage.objects ด้วย
-- ตัดออกแล้วเพราะ (ก) ไม่จำเป็น ของเดิมถูกอยู่แล้ว (ข) ตารางนั้นเจ้าของคือ
-- supabase_storage_admin ถ้าสิทธิ์ไม่พอจะพังแล้วลากทั้งไฟล์ rollback ไปด้วย

-- ============================================================
-- 5. ตรวจผล — ต้องได้ 10 แถวพอดี (5 ตาราง x 2 policy)
-- ============================================================

select
  t.tablename,
  t.rowsecurity as rls_enabled,
  p.policyname,
  p.roles::text as roles,
  p.cmd
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
  and t.tablename in ('skus','part_groups','subcategories','assets','profile_settings')
order by t.tablename, p.policyname;

-- ตรวจซ้ำจากภายนอกด้วย ไม่ใช่ดูแค่ผลข้างบน:
--   curl -X POST "https://<ref>.supabase.co/rest/v1/skus" \
--        -H "apikey: <publishable key>" -H "Content-Type: application/json" \
--        -d '{"id":"__rls_probe__","name":"probe"}'
--   ต้องได้ 401 code 42501 — ถ้าได้ 201 แปลว่ายังโหว่อยู่
