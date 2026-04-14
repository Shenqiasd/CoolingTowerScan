create table if not exists public.project_solution_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_code text not null default 'proposal',
  version_no integer not null,
  snapshot_payload jsonb not null default '{}'::jsonb,
  calculation_summary jsonb not null default '{}'::jsonb,
  gate_errors jsonb not null default '[]'::jsonb,
  created_by text null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists project_solution_snapshots_project_version_idx
  on public.project_solution_snapshots(project_id, version_no);

create index if not exists project_solution_snapshots_project_created_idx
  on public.project_solution_snapshots(project_id, created_at desc);
