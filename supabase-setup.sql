create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('master','kasir')),
  created_at timestamptz not null default now()
);

create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'master'
  );
$$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  unit text not null check (unit in ('PS A','PS B','PS C')),
  penyewa text not null,
  tipe text not null check (tipe in ('Jam','Hari')),
  durasi integer not null check (durasi > 0),
  tv text not null check (tv in ('Ya','Tidak')),
  nominal integer not null check (nominal >= 0),
  foto_path text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;

create policy "profile_read_own_or_master" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_master());

create policy "transaction_read_authenticated" on public.transactions
for select to authenticated
using (true);

create policy "transaction_insert_own" on public.transactions
for insert to authenticated
with check (created_by = auth.uid());

create policy "transaction_update_master" on public.transactions
for update to authenticated
using (public.is_master())
with check (public.is_master());

create policy "transaction_delete_master" on public.transactions
for delete to authenticated
using (public.is_master());

insert into storage.buckets (id, name, public)
values ('bukti-transaksi', 'bukti-transaksi', false)
on conflict (id) do nothing;

create policy "storage_upload_own_folder" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bukti-transaksi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_read_authenticated" on storage.objects
for select to authenticated
using (bucket_id = 'bukti-transaksi');

create policy "storage_delete_master" on storage.objects
for delete to authenticated
using (bucket_id = 'bukti-transaksi' and public.is_master());

-- Setelah membuat akun melalui Authentication > Users, jalankan contoh ini.
-- Ganti alamat email dengan akun Anda sendiri.
-- insert into public.profiles (id, email, full_name, role)
-- select id, email, 'Master Admin', 'master'
-- from auth.users where email = 'admin@contoh.com'
-- on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
--
-- insert into public.profiles (id, email, full_name, role)
-- select id, email, 'Kasir Adan', 'kasir'
-- from auth.users where email = 'adan@contoh.com'
-- on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;
