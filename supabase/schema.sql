-- Note Buddy schema. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Safe to re-run.

-- ---------- notes table ----------
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('text', 'image', 'file')),
  content     text,
  file_path   text,
  file_name   text,
  mime        text,
  size        bigint,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notes_user_created_idx on public.notes (user_id, created_at desc);

alter table public.notes enable row level security;

drop policy if exists "notes: read own"   on public.notes;
drop policy if exists "notes: insert own" on public.notes;
drop policy if exists "notes: update own" on public.notes;
drop policy if exists "notes: delete own" on public.notes;

create policy "notes: read own"   on public.notes for select to authenticated using (auth.uid() = user_id);
create policy "notes: insert own" on public.notes for insert to authenticated with check (auth.uid() = user_id);
create policy "notes: update own" on public.notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes: delete own" on public.notes for delete to authenticated using (auth.uid() = user_id);

-- ---------- realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;

-- ---------- storage bucket for images / files ----------
-- Private bucket, 50 MB per file (the Supabase free-tier maximum).
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

-- Files live at  attachments/<user_id>/<uuid>-<filename>
drop policy if exists "attachments: read own"   on storage.objects;
drop policy if exists "attachments: insert own" on storage.objects;
drop policy if exists "attachments: delete own" on storage.objects;

create policy "attachments: read own" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments: insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
