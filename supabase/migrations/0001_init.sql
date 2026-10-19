-- =====================================================================
-- DETAY STOK SAYIM — Başlangıç şeması
-- Supabase SQL Editor'de bir kez çalıştırılır.
-- Kararlar: AI_PROJE_HAFIZASI.md §7
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipler
-- ---------------------------------------------------------------------
create type public.user_role        as enum ('patron', 'yonetici', 'saha');
create type public.operation_mode   as enum ('blank', 'compare');      -- (A) boş sayım / (B) liste karşılaştırmalı
create type public.operation_status as enum ('draft', 'active', 'closed');
create type public.item_condition   as enum ('saglam', 'hurda', 'arizali');

-- ---------------------------------------------------------------------
-- Profiller (auth.users ile 1-1)
-- Saha çalışanları anonim oturumla gelir; ad + telefon join_operation ile yazılır.
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  role        public.user_role not null default 'saha',
  kvkk_accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index profiles_phone_idx on public.profiles(phone);

-- ---------------------------------------------------------------------
-- Müşteri firmalar
-- ---------------------------------------------------------------------
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tax_no     text,
  contact    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Operasyonlar (her sayım ayrı operasyon)
-- ---------------------------------------------------------------------
create sequence public.operation_code_seq;

create table public.operations (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null
              default ('OP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.operation_code_seq')::text, 4, '0')),
  client_id   uuid references public.clients(id) on delete restrict,
  name        text not null,
  mode        public.operation_mode   not null default 'blank',
  status      public.operation_status not null default 'active',
  count_date  date not null default current_date,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

-- ---------------------------------------------------------------------
-- Operasyona özel QR / link — SADECE bağlı olduğu operasyonda geçerli
-- ---------------------------------------------------------------------
create table public.operation_links (
  id           uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  token        text unique not null default encode(gen_random_bytes(9), 'base64'),
  label        text,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  use_count    int not null default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
-- base64 içinde URL'yi bozan karakterleri temizle
create or replace function public.tg_link_token_urlsafe() returns trigger
language plpgsql as $$
begin
  new.token := translate(new.token, '+/=', '-_');
  return new;
end $$;
create trigger link_token_urlsafe before insert on public.operation_links
  for each row execute function public.tg_link_token_urlsafe();

-- ---------------------------------------------------------------------
-- Operasyon üyeleri (hangi saha çalışanı hangi operasyonda)
-- ---------------------------------------------------------------------
create table public.operation_members (
  operation_id uuid not null references public.operations(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id)   on delete cascade,
  link_id      uuid references public.operation_links(id) on delete set null,
  joined_at    timestamptz not null default now(),
  primary key (operation_id, profile_id)
);

-- ---------------------------------------------------------------------
-- Kategoriler: Ürün Cinsi -> Ürün Adı  (+ DİĞER)
-- ---------------------------------------------------------------------
create table public.categories (
  id        uuid primary key default gen_random_uuid(),
  name      text unique not null,
  icon      text,
  sort      int not null default 0,
  is_other  boolean not null default false
);

create table public.product_types (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name        text not null,
  sort        int not null default 0,
  unique (category_id, name)
);

-- ---------------------------------------------------------------------
-- Beklenen liste (Mod B: eski liste yüklenip fire karşılaştırması)
-- ---------------------------------------------------------------------
create table public.expected_items (
  id           uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations(id) on delete cascade,
  barcode      text not null,
  category     text,
  description  text,
  model        text,
  color        text,
  dimensions   text,
  quantity     numeric,
  condition    text,
  assignee     text,
  location     text,
  unique (operation_id, barcode)
);

-- ---------------------------------------------------------------------
-- Sayım kayıtları
-- Zorunlu: barkod + ürün açıklaması + lokasyon. Diğer her şey opsiyonel.
-- Barkod operasyon içinde EŞSİZ.
-- ---------------------------------------------------------------------
create table public.count_items (
  id              uuid primary key default gen_random_uuid(),
  client_uuid     uuid unique,                 -- offline kuyruktan gelen tekrarları engeller
  operation_id    uuid not null references public.operations(id) on delete cascade,
  barcode         text not null check (length(trim(barcode)) > 0),
  description     text not null check (length(trim(description)) > 0),
  location        text not null check (length(trim(location)) > 0),
  category_id     uuid references public.categories(id),
  product_type_id uuid references public.product_types(id),
  model           text,
  color           text,
  dimensions      text,
  quantity        numeric not null default 1 check (quantity > 0),
  condition       public.item_condition,
  condition_note  text,
  assignee        text,                        -- zimmet: kişi veya yer
  photo_path      text,                        -- tek kare fotoğraf
  counted_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id),
  unique (operation_id, barcode)
);
create index count_items_op_idx       on public.count_items(operation_id, created_at desc);
create index count_items_location_idx on public.count_items(operation_id, location);

create or replace function public.tg_touch_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger count_items_touch before update on public.count_items
  for each row execute function public.tg_touch_updated();

-- ---------------------------------------------------------------------
-- Denetim kaydı (kim neyi değiştirdi / sildi)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  actor      uuid,
  old_data   jsonb,
  new_data   jsonb,
  at         timestamptz not null default now()
);

create or replace function public.tg_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log(table_name, row_id, action, actor, old_data, new_data)
  values (tg_table_name,
          coalesce(new.id, old.id),
          tg_op,
          auth.uid(),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger count_items_audit after insert or update or delete on public.count_items
  for each row execute function public.tg_audit();

-- =====================================================================
-- Yardımcı yetki fonksiyonları
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('patron','yonetici'));
$$;

create or replace function public.is_patron() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'patron');
$$;

create or replace function public.is_member(op uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operation_members m
                 join public.operations o on o.id = m.operation_id
                 where m.operation_id = op and m.profile_id = auth.uid() and o.status = 'active');
$$;

-- =====================================================================
-- QR / link ile katılım
-- Saha cihazı önce anonim oturum açar, sonra bunu çağırır.
-- =====================================================================
create or replace function public.peek_operation_link(p_token text)
returns table (operation_id uuid, operation_code text, operation_name text, client_name text, valid boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare l record;
begin
  select ol.*, o.code, o.name as op_name, o.status, c.name as c_name
    into l
    from public.operation_links ol
    join public.operations o on o.id = ol.operation_id
    left join public.clients c on c.id = o.client_id
   where ol.token = p_token;

  if not found then
    return query select null::uuid, null::text, null::text, null::text, false, 'Bağlantı bulunamadı';
    return;
  end if;

  return query select l.operation_id, l.code, l.op_name, l.c_name,
    (l.revoked_at is null and (l.expires_at is null or l.expires_at > now()) and l.status = 'active'),
    case
      when l.revoked_at is not null then 'Bu bağlantı yönetici tarafından iptal edildi'
      when l.expires_at is not null and l.expires_at <= now() then 'Bu bağlantının süresi doldu'
      when l.status <> 'active' then 'Bu operasyon şu an aktif değil'
      else null
    end;
end $$;

create or replace function public.join_operation(p_token text, p_full_name text, p_phone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l   record;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Oturum bulunamadı'; end if;
  if length(trim(coalesce(p_full_name,''))) < 3 then raise exception 'Ad soyad giriniz'; end if;
  if length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) < 10 then raise exception 'Geçerli bir telefon giriniz'; end if;

  select ol.*, o.status into l
    from public.operation_links ol
    join public.operations o on o.id = ol.operation_id
   where ol.token = p_token
   for update of ol;

  if not found                                       then raise exception 'Bağlantı bulunamadı'; end if;
  if l.revoked_at is not null                        then raise exception 'Bu bağlantı iptal edildi'; end if;
  if l.expires_at is not null and l.expires_at <= now() then raise exception 'Bu bağlantının süresi doldu'; end if;
  if l.status <> 'active'                            then raise exception 'Bu operasyon aktif değil'; end if;

  insert into public.profiles(id, full_name, phone, role, kvkk_accepted_at)
  values (uid, trim(p_full_name), regexp_replace(p_phone, '\D', '', 'g'), 'saha', now())
  on conflict (id) do update
     set full_name = excluded.full_name,
         phone     = excluded.phone;

  insert into public.operation_members(operation_id, profile_id, link_id)
  values (l.operation_id, uid, l.id)
  on conflict do nothing;

  update public.operation_links set use_count = use_count + 1 where id = l.id;

  return l.operation_id;
end $$;

grant execute on function public.peek_operation_link(text)            to anon, authenticated;
grant execute on function public.join_operation(text, text, text)     to authenticated;

-- Tekrar okutma uyarısı: bu barkod bu operasyonda kim tarafından, nerede sayıldı?
-- (Saha çalışanı başkalarının profiline doğrudan erişemez; sadece adı döner.)
create or replace function public.lookup_barcode(p_operation uuid, p_barcode text)
returns table (id uuid, counted_by uuid, counted_by_name text, location text, description text, created_at timestamptz, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.counted_by, p.full_name, c.location, c.description, c.created_at, c.counted_by = auth.uid()
    from public.count_items c
    join public.profiles p on p.id = c.counted_by
   where c.operation_id = p_operation
     and c.barcode = trim(p_barcode)
     and (public.is_member(p_operation) or public.is_admin());
$$;
grant execute on function public.lookup_barcode(uuid, text) to authenticated;

-- Lokasyon önerileri (operasyonda daha önce girilmiş lokasyonlar)
create or replace function public.operation_locations(p_operation uuid)
returns table (location text, item_count bigint)
language sql stable security definer set search_path = public as $$
  select c.location, count(*) from public.count_items c
   where c.operation_id = p_operation
     and (public.is_member(p_operation) or public.is_admin())
   group by c.location
   order by max(c.created_at) desc
   limit 50;
$$;
grant execute on function public.operation_locations(uuid) to authenticated;

-- =====================================================================
-- Karşılaştırma görünümü (Mod B): Bulunan / Fire / Fazla
-- =====================================================================
create or replace view public.v_compare with (security_invoker = true) as
select coalesce(e.operation_id, c.operation_id) as operation_id,
       coalesce(e.barcode, c.barcode)           as barcode,
       case
         when e.id is not null and c.id is not null then 'bulunan'
         when e.id is not null and c.id is null     then 'fire'
         else 'fazla'
       end                                       as status,
       e.description as expected_description,
       e.location    as expected_location,
       c.description as counted_description,
       c.location    as counted_location,
       c.id          as count_item_id,
       c.created_at  as counted_at
  from public.expected_items e
  full outer join public.count_items c
    on c.operation_id = e.operation_id and c.barcode = e.barcode
 where coalesce(e.operation_id, c.operation_id) in (select id from public.operations where mode = 'compare');

-- =====================================================================
-- Satır bazlı güvenlik (RLS)
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.clients           enable row level security;
alter table public.operations        enable row level security;
alter table public.operation_links   enable row level security;
alter table public.operation_members enable row level security;
alter table public.categories        enable row level security;
alter table public.product_types     enable row level security;
alter table public.expected_items    enable row level security;
alter table public.count_items       enable row level security;
alter table public.audit_log         enable row level security;

-- profiles
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_patron_all  on public.profiles for all    using (public.is_patron()) with check (public.is_patron());

-- clients / operations / links / members / expected: yönetim tam yetkili
create policy clients_admin    on public.clients           for all using (public.is_admin()) with check (public.is_admin());
create policy ops_admin        on public.operations        for all using (public.is_admin()) with check (public.is_admin());
create policy ops_member_read  on public.operations        for select using (public.is_member(id));
create policy links_admin      on public.operation_links   for all using (public.is_admin()) with check (public.is_admin());
create policy members_admin    on public.operation_members for all using (public.is_admin()) with check (public.is_admin());
create policy members_self     on public.operation_members for select using (profile_id = auth.uid());
create policy expected_admin   on public.expected_items    for all using (public.is_admin()) with check (public.is_admin());
-- saha, Mod B'de okuttuğu barkodun bilgilerini otomatik doldurabilsin
create policy expected_member  on public.expected_items    for select using (public.is_member(operation_id));

-- kategoriler: herkes (oturumlu) okur, yönetim düzenler
create policy cat_read   on public.categories    for select using (auth.uid() is not null);
create policy cat_admin  on public.categories    for all    using (public.is_admin()) with check (public.is_admin());
create policy pt_read    on public.product_types for select using (auth.uid() is not null);
create policy pt_admin   on public.product_types for all    using (public.is_admin()) with check (public.is_admin());

-- sayım kayıtları
create policy items_admin        on public.count_items for all using (public.is_admin()) with check (public.is_admin());
create policy items_member_read  on public.count_items for select using (public.is_member(operation_id));   -- tekrar uyarısı için operasyonu görür
create policy items_member_ins   on public.count_items for insert with check (public.is_member(operation_id) and counted_by = auth.uid());
create policy items_member_upd   on public.count_items for update using (public.is_member(operation_id) and counted_by = auth.uid())
                                                         with check (public.is_member(operation_id) and counted_by = auth.uid());
create policy items_member_del   on public.count_items for delete using (public.is_member(operation_id) and counted_by = auth.uid());

-- denetim: sadece yönetim okur
create policy audit_admin on public.audit_log for select using (public.is_admin());

-- =====================================================================
-- Canlı güncelleme (dashboard)
-- =====================================================================
alter publication supabase_realtime add table public.count_items;

-- =====================================================================
-- Fotoğraf deposu: item-photos/{operation_id}/{barcode}.webp
-- =====================================================================
insert into storage.buckets (id, name, public) values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

create policy photos_admin on storage.objects for all
  using (bucket_id = 'item-photos' and public.is_admin())
  with check (bucket_id = 'item-photos' and public.is_admin());

create policy photos_member_rw on storage.objects for all
  using (bucket_id = 'item-photos' and public.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'item-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

-- =====================================================================
-- Başlangıç kategorileri (sonra panelden düzenlenecek)
-- =====================================================================
insert into public.categories (name, icon, sort, is_other) values
  ('Mobilya',         'armchair',   1, false),
  ('Teknolojik Alet', 'monitor',    2, false),
  ('Beyaz Eşya',      'refrigerator',3, false),
  ('Otomobil',        'car',        4, false),
  ('Tekstil',         'shirt',      5, false),
  ('Diğer',           'circle-help',99, true);

insert into public.product_types (category_id, name, sort)
select c.id, t.name, t.sort from public.categories c
join (values
  ('Mobilya','Masa',1),('Mobilya','Sandalye',2),('Mobilya','Kanepe',3),('Mobilya','Keson',4),
  ('Mobilya','Askılık',5),('Mobilya','Dolap',6),('Mobilya','Saat',7),
  ('Teknolojik Alet','Bilgisayar',1),('Teknolojik Alet','Monitör',2),('Teknolojik Alet','Yazıcı',3),
  ('Teknolojik Alet','Telefon',4),('Teknolojik Alet','Projeksiyon',5),
  ('Beyaz Eşya','Buzdolabı',1),('Beyaz Eşya','Çamaşır Makinesi',2),('Beyaz Eşya','Bulaşık Makinesi',3),
  ('Beyaz Eşya','Klima',4),
  ('Otomobil','Binek Araç',1),('Otomobil','Ticari Araç',2),
  ('Tekstil','Çanta',1),('Tekstil','Perde',2),('Tekstil','Halı',3)
) as t(cat, name, sort) on t.cat = c.name;

-- =====================================================================
-- İLK PATRON: Supabase > Authentication'dan e-posta ile kullanıcı oluşturduktan sonra:
--   insert into public.profiles(id, full_name, role)
--   values ('<auth-user-uuid>', 'Ad Soyad', 'patron');
-- =====================================================================
