create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  project text not null,
  destination text not null,
  vision text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_requests enable row level security;

drop policy if exists "public can submit contact requests" on public.contact_requests;
create policy "public can submit contact requests"
on public.contact_requests
for insert
to anon, authenticated
with check (true);
