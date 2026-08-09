-- 003_enable_rls.sql
-- ปิดรูโหว่: ตอนนี้ทุกตารางยังไม่ได้เปิด RLS
--
-- Supabase ให้ browser ยิงเข้า database ตรง ๆ ไม่มี backend คั่นกลาง
-- ตัวเดียวที่กั้นระหว่างคนนอกกับข้อมูลคือ RLS — ซึ่งยังปิดอยู่
-- publishable key ฝังอยู่ในไฟล์ JS บน GitHub Pages ใครกด F12 ก็ copy ไปได้
-- แล้วยิง DELETE ลบข้อมูลทั้งตารางได้ทันที (ยืนยันแล้วด้วยการ probe:
-- insert เปล่า ๆ ได้ error 23502 not-null ไม่ใช่ 42501 RLS = ทะลุ RLS เข้าไปถึงชั้น constraint)
--
-- หลังรันไฟล์นี้: คนทั่วไป "อ่านอย่างเดียว", แก้ไขได้เฉพาะคนที่ล็อกอินแล้ว
--
-- ⚠️⚠️ ต้องรันไฟล์นี้ "หลัง" deploy เว็บเวอร์ชันที่มีหน้า login แล้วเท่านั้น
--       ถ้ารันก่อน หน้า Admin จะใช้งานไม่ได้ทันที (อัปโหลด/แก้/ลบ อะไรไม่ได้เลย)
--       เพราะมันยังยิงด้วย key ของผู้ใช้ทั่วไปอยู่
--
-- ⚠️ ต้องปิด public signup ด้วย ไม่งั้นใครก็สมัครเองแล้วกลายเป็น authenticated ได้
--    Dashboard > Authentication > Sign In / Providers > ปิด "Allow new users to sign up"

begin;

-- ============================================================
-- เปิด RLS ทุกตาราง
-- ============================================================
-- หมายเหตุ: พอเปิดแล้วยังไม่มี policy = ปฏิเสธทุกอย่าง (deny by default)
-- policy ด้านล่างจึงต้องอยู่ใน transaction เดียวกัน ไม่งั้นเว็บจะดับระหว่างทาง

alter table public.skus             enable row level security;
alter table public.part_groups      enable row level security;
alter table public.subcategories    enable row level security;
alter table public.assets           enable row level security;
alter table public.profile_settings enable row level security;

-- ============================================================
-- Policy ของตารางในสคีมา public
-- ============================================================
-- รูปแบบเดียวกันทุกตาราง: ใครก็อ่านได้ (เว็บเป็น catalog สาธารณะ)
-- แต่ insert/update/delete ต้องล็อกอินก่อน

do $$
declare
  t text;
begin
  foreach t in array array['skus','part_groups','subcategories','assets','profile_settings']
  loop
    -- ลบ policy ชื่อเดียวกันของรอบก่อน เพื่อให้ไฟล์นี้รันซ้ำได้
    execute format('drop policy if exists "public_read" on public.%I', t);
    execute format('drop policy if exists "authenticated_write" on public.%I', t);

    execute format($p$
      create policy "public_read" on public.%I
        for select
        to anon, authenticated
        using (true)
    $p$, t);

    execute format($p$
      create policy "authenticated_write" on public.%I
        for all
        to authenticated
        using (true)
        with check (true)
    $p$, t);
  end loop;
end $$;

commit;

-- ============================================================
-- Policy ของ Storage (bucket: watch-assets)
-- ============================================================
-- storage.objects เปิด RLS มาตั้งแต่ต้นอยู่แล้ว แต่ตอนนี้ต้องมี policy
-- ที่อนุญาตให้ anon เขียนได้ค้างอยู่ (เพราะหน้า Admin อัปโหลดได้โดยไม่ต้องล็อกอิน)
-- จึงต้องกวาดของเดิมที่เกี่ยวกับ bucket นี้ทิ้งก่อน แล้วสร้างชุดใหม่

do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and (coalesce(qual, '') like '%watch-assets%'
        or coalesce(with_check, '') like '%watch-assets%')
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'ลบ policy เดิม: %', p.policyname;
  end loop;
end $$;

-- อ่านรูปได้ทุกคน (bucket เป็น public อยู่แล้ว หน้าเว็บโหลดรูปผ่าน public URL)
create policy "watch_assets_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'watch-assets');

-- อัปโหลด / แก้ไข / ลบ ต้องล็อกอินก่อน
create policy "watch_assets_auth_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'watch-assets');

create policy "watch_assets_auth_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'watch-assets')
  with check (bucket_id = 'watch-assets');

create policy "watch_assets_auth_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'watch-assets');

-- ============================================================
-- ตรวจผลหลังรัน
-- ============================================================
-- 1) ทุกตารางต้องขึ้น rowsecurity = true
--    select tablename, rowsecurity from pg_tables
--    where schemaname='public' and tablename in
--      ('skus','part_groups','subcategories','assets','profile_settings');
--
-- 2) ทดสอบจาก terminal ว่าคนนอกเขียนไม่ได้แล้ว — ต้องได้ 401/403 code 42501
--    (ถ้ายังได้ 23502 หรือ 204 แปลว่า RLS ยังไม่มีผล)
--    curl -X DELETE "https://<ref>.supabase.co/rest/v1/skus?id=eq.__nope__" \
--         -H "apikey: <publishable key>"
