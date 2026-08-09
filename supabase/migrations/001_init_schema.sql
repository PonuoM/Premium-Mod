-- 001_init_schema.sql
-- โครงสร้างฐานข้อมูลของ Premium Mod Watch Customizer
--
-- ไฟล์นี้ถอดมาจาก schema จริงบน production (project orqyxamgukajopqdxpdg)
-- และเขียนแบบ idempotent ทั้งหมด → รันบน DB ที่มีข้อมูลอยู่แล้วจะไม่มีอะไรเปลี่ยน
-- ประโยชน์คือใช้สร้าง project ใหม่จากศูนย์ได้ในคำสั่งเดียว ถ้าวันหนึ่งข้อมูลหาย
--
-- วิธีรัน: Supabase Dashboard > SQL Editor > วางทั้งไฟล์ > Run

-- ============================================================
-- ตาราง
-- ============================================================

-- รุ่นนาฬิกา เช่น daytona, nautilus (id เป็น slug ที่ผู้ใช้ตั้งเอง ไม่ใช่ uuid)
create table if not exists public.skus (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

-- กลุ่มชิ้นส่วน เช่น dial, hands — z_index คุมลำดับการซ้อนภาพตอน render
create table if not exists public.part_groups (
  key        text primary key,
  name_th    text not null,
  name_en    text not null,
  sort_order integer not null default 0,
  z_index    integer not null default 0
);

-- หมวดย่อยของชิ้นส่วนในแต่ละรุ่น เช่น dial ของ daytona แบ่งเป็นหลายแบบ
create table if not exists public.subcategories (
  id         uuid primary key default gen_random_uuid(),
  sku_id     text not null,
  group_key  text not null,
  name       text not null,
  sort_order integer not null default 0,
  image_url  text,
  created_at timestamptz not null default now()
);

-- ไฟล์ภาพชิ้นส่วนแต่ละชิ้น (url ชี้ไป storage bucket watch-assets)
create table if not exists public.assets (
  id              uuid primary key default gen_random_uuid(),
  sku_id          text not null,
  group_key       text not null,
  subcategory_id  uuid,
  subcategory     text,          -- คอลัมน์เก่าก่อนแยกเป็นตาราง subcategories, ปัจจุบันเป็น null ทั้งหมด
  label           text not null,
  url             text not null,
  sort            integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ตั้งค่าร้าน + ลายน้ำ — ตารางนี้ตั้งใจให้มีแถวเดียว (บังคับใน 002)
create table if not exists public.profile_settings (
  id                  uuid primary key default gen_random_uuid(),
  store_name          text not null default 'Watch Configurator',
  watermark_type      text not null default 'none',
  watermark_url       text,
  watermark_opacity   real not null default 0.5,   -- เก็บเป็น 0-1 แต่ UI แสดง 0-100
  watermark_size      integer not null default 100,
  watermark_position  text not null default 'bottom-right',
  show_filter_buttons boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- Foreign keys
-- ============================================================
-- แยกออกมาจาก create table เพราะบน DB เดิมอาจมี constraint พวกนี้อยู่แล้ว
-- ถ้ามีแล้วจะข้าม ถ้ายังไม่มีจะเพิ่มให้

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subcategories_sku_id_fkey') then
    alter table public.subcategories
      add constraint subcategories_sku_id_fkey
      foreign key (sku_id) references public.skus(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'subcategories_group_key_fkey') then
    alter table public.subcategories
      add constraint subcategories_group_key_fkey
      foreign key (group_key) references public.part_groups(key) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'assets_sku_id_fkey') then
    alter table public.assets
      add constraint assets_sku_id_fkey
      foreign key (sku_id) references public.skus(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'assets_group_key_fkey') then
    alter table public.assets
      add constraint assets_group_key_fkey
      foreign key (group_key) references public.part_groups(key) on delete cascade;
  end if;

  -- ตั้งเป็น set null ไม่ใช่ cascade: ลบ subcategory แล้วรูปควรอยู่ต่อ ไม่ใช่หายตามไปด้วย
  if not exists (select 1 from pg_constraint where conname = 'assets_subcategory_id_fkey') then
    alter table public.assets
      add constraint assets_subcategory_id_fkey
      foreign key (subcategory_id) references public.subcategories(id) on delete set null;
  end if;
end $$;

-- ============================================================
-- Index
-- ============================================================
-- ทุก query ของแอปกรองด้วย sku_id เป็นหลัก (assets มี 1,000+ แถวแล้ว)

create index if not exists assets_sku_id_idx           on public.assets (sku_id);
create index if not exists assets_sku_group_idx        on public.assets (sku_id, group_key);
create index if not exists assets_subcategory_id_idx   on public.assets (subcategory_id);
create index if not exists subcategories_sku_id_idx    on public.subcategories (sku_id);
create index if not exists subcategories_sku_group_idx on public.subcategories (sku_id, group_key);

-- ============================================================
-- View: assets_with_subcategory
-- ============================================================
-- แอปฝั่ง configurator อ่าน view นี้ตัวเดียวจบ ไม่ต้อง join เองในโค้ด
-- security_invoker = on สำคัญมาก: view ปกติจะรันด้วยสิทธิ์เจ้าของ = ทะลุ RLS
-- ตั้งค่านี้เพื่อให้ RLS ของตารางต้นทางมีผลกับคนที่ query view ด้วย

-- ตั้งใจใช้ CREATE ... IF NOT EXISTS แทน CREATE OR REPLACE:
-- ถ้า view บน production นิยามต่างจากนี้แม้แต่นิดเดียว (เช่น left join แทน join)
-- การ replace ทับจะเปลี่ยนพฤติกรรมของเว็บที่ใช้งานอยู่ทันทีโดยไม่มีใครรู้ตัว
do $$
begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'assets_with_subcategory') then
    raise notice 'view assets_with_subcategory มีอยู่แล้ว — ข้าม (ไม่ทับของเดิม)';
  else
    execute $v$
      create view public.assets_with_subcategory as
      select
        a.id,
        a.sku_id,
        s.name        as sku_name,
        a.group_key,
        pg.name_th    as group_name_th,
        pg.name_en    as group_name_en,
        pg.z_index,
        a.subcategory_id,
        sc.name       as subcategory_name,
        sc.image_url  as subcategory_image_url,
        sc.sort_order as subcategory_sort,
        a.label,
        a.url,
        a.sort,
        a.created_at
      from public.assets a
      join public.skus s         on s.id   = a.sku_id
      join public.part_groups pg on pg.key = a.group_key
      left join public.subcategories sc on sc.id = a.subcategory_id
    $v$;
  end if;
end $$;

-- security_invoker = on สำคัญมาก: view ปกติรันด้วยสิทธิ์เจ้าของ = ทะลุ RLS ของตารางต้นทาง
-- ตั้งค่านี้เพื่อให้ policy ใน 003 มีผลกับคนที่ query ผ่าน view ด้วย
do $$
begin
  alter view public.assets_with_subcategory set (security_invoker = on);
exception
  when others then
    raise notice 'ข้าม security_invoker (ต้องใช้ Postgres 15+): %', sqlerrm;
end $$;

-- ============================================================
-- Storage bucket
-- ============================================================
-- เก็บรูปชิ้นส่วนทั้งหมด + ลายน้ำ; public = true เพราะหน้าเว็บโหลดรูปตรงจาก public URL

insert into storage.buckets (id, name, public)
values ('watch-assets', 'watch-assets', true)
on conflict (id) do nothing;

-- ============================================================
-- ข้อมูลตั้งต้น: กลุ่มชิ้นส่วน 10 กลุ่ม (ลำดับ z_index = ลำดับการซ้อนภาพ)
-- ============================================================

insert into public.part_groups (key, name_th, name_en, sort_order, z_index) values
  ('bracelet', 'สายนาฬิกา',    'Bracelet',    1,  1),
  ('dial',     'หน้าปัด',       'Dial',        2,  2),
  ('gmt',      'GMT',          'GMT',         3,  3),
  ('hands',    'เข็ม',          'Hands',       4,  4),
  ('second',   'เข็มวินาที',     'Second Hand', 5,  5),
  ('crystal',  'กระจกหน้าปัด',   'Crystal',     6,  6),
  ('inner',    'กรอบใน',        'Inner Ring',  7,  7),
  ('case',     'ตัวเรือน',       'Case',        8,  8),
  ('outer',    'กรอบนอก',       'Outer Bezel', 9,  9),
  ('movement', 'เครื่อง',        'Movement',    10, 10)
on conflict (key) do nothing;
