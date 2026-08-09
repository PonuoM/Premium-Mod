-- 002_profile_settings_singleton.sql
-- แก้บั๊ก: profile_settings สะสมแถวขยะไปแล้ว 15 แถว ทั้งที่ควรมีแถวเดียว
--
-- ต้นเหตุ: components/admin/ProfileSettings.tsx เดิมบันทึกด้วย
--     .from('profile_settings').update(dbData).limit(1)
-- ซึ่งไม่มี .eq() → PostgREST ไม่รู้ว่าจะอัปเดตแถวไหน แล้วโค้ดก็ fallback ไป insert
-- แถวใหม่ทุกครั้งที่กดเซฟ ส่วนตอนอ่านใช้ .limit(1).single() = หยิบแถวมั่ว ๆ มาแถวหนึ่ง
-- อาการที่ผู้ใช้เจอคือ "ตั้งค่าลายน้ำแล้วบางทีไม่ขึ้น / เด้งกลับค่าเก่า"
--
-- แก้โดย: เก็บแถวที่แก้ล่าสุดไว้แถวเดียว บังคับ id เป็นค่าคงที่
-- แล้วใส่ check constraint กันไม่ให้มีแถวที่ 2 เกิดขึ้นได้อีกในระดับฐานข้อมูล
--
-- ⚠️ migration นี้ลบข้อมูล — แต่ลบเฉพาะแถวขยะที่ไม่มีใครอ่านอยู่แล้ว
--    อยากดูก่อนว่าจะเหลือแถวไหน รันบรรทัดนี้ก่อนได้:
--    select * from public.profile_settings order by updated_at desc nulls last, created_at desc;

begin;

-- 1) เก็บเฉพาะแถวที่แก้ล่าสุด ที่เหลือทิ้ง
delete from public.profile_settings
where id not in (
  select id from public.profile_settings
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1
);

-- 2) ถ้าตารางว่าง (ยังไม่เคยตั้งค่า) ให้ใส่แถว default ไว้หนึ่งแถว
insert into public.profile_settings (id, store_name)
select '00000000-0000-0000-0000-000000000001', 'Watch Configurator'
where not exists (select 1 from public.profile_settings);

-- 3) บังคับ id ของแถวที่เหลือให้เป็นค่าคงที่ ฝั่งแอปจะได้อ้างอิงตรง ๆ ด้วย .eq('id', ...)
update public.profile_settings
set id = '00000000-0000-0000-0000-000000000001';

-- 4) กันไม่ให้มีแถวที่ 2 อีก — id เป็น primary key อยู่แล้ว
--    พอบังคับว่า id ต้องเป็นค่านี้เท่านั้น ตารางจึงมีได้สูงสุด 1 แถวโดยอัตโนมัติ
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profile_settings_singleton') then
    alter table public.profile_settings
      add constraint profile_settings_singleton
      check (id = '00000000-0000-0000-0000-000000000001');
  end if;
end $$;

commit;

-- ตรวจผล: ต้องได้ 1 แถว
-- select count(*) from public.profile_settings;
