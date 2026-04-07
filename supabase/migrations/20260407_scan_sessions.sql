-- scan_sessions: 一次扫描任务（无需企业关联）
create table if not exists scan_sessions (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('area', 'address')),
  label text,
  zoom_level int not null default 18,
  total_count int default 0,
  created_at timestamptz default now()
);

-- scan_screenshots: 每张截图记录
create table if not exists scan_screenshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references scan_sessions(id) on delete cascade,
  enterprise_id uuid references enterprises(id) on delete set null,
  filename text not null,
  storage_url text,
  lng double precision,
  lat double precision,
  row_idx int,
  col_idx int,
  address_label text,
  created_at timestamptz default now()
);

-- RLS
alter table scan_sessions enable row level security;
alter table scan_screenshots enable row level security;

create policy "allow all scan_sessions" on scan_sessions for all using (true) with check (true);
create policy "allow all scan_screenshots" on scan_screenshots for all using (true) with check (true);
