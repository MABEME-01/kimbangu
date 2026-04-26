
-- Roles enum
create type public.app_role as enum ('admin', 'uploader', 'user');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  upload_status text not null default 'none', -- none | pending | approved | rejected
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Categories enum
create type public.music_category as enum (
  'alegria','adoracao','louvor','suplicas','morte','casamento','alertas','generativas'
);

-- Tracks (PDFs + metadata)
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.music_category not null,
  pdf_path text not null,
  audio_path text,
  image_paths text[] not null default '{}',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.tracks enable row level security;

-- Profiles policies
create policy "Profiles viewable by self or admin"
  on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins update any profile"
  on public.profiles for update
  using (public.has_role(auth.uid(), 'admin'));

create policy "Insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- user_roles policies
create policy "Roles viewable by self or admin"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Tracks policies (anyone can read, even anonymous)
create policy "Tracks readable by everyone"
  on public.tracks for select
  using (true);

create policy "Uploaders and admins can insert"
  on public.tracks for insert
  with check (
    public.has_role(auth.uid(), 'uploader') or public.has_role(auth.uid(), 'admin')
  );

create policy "Owner or admin can update"
  on public.tracks for update
  using (uploaded_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Owner or admin can delete"
  on public.tracks for delete
  using (uploaded_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile + assign roles on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));

  -- always grant base 'user' role
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;

  -- auto-grant admin to the configured admin email
  if new.email = 'manobv511@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
    update public.profiles set upload_status = 'approved' where id = new.id;
    insert into public.user_roles (user_id, role) values (new.id, 'uploader')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('pdfs','pdfs', true),
  ('audios','audios', true),
  ('images','images', true)
on conflict (id) do nothing;

-- Storage policies: public read, uploader/admin write
create policy "Public read pdfs" on storage.objects for select using (bucket_id = 'pdfs');
create policy "Public read audios" on storage.objects for select using (bucket_id = 'audios');
create policy "Public read images" on storage.objects for select using (bucket_id = 'images');

create policy "Uploaders write pdfs" on storage.objects for insert
  with check (bucket_id = 'pdfs' and (public.has_role(auth.uid(),'uploader') or public.has_role(auth.uid(),'admin')));
create policy "Uploaders write audios" on storage.objects for insert
  with check (bucket_id = 'audios' and (public.has_role(auth.uid(),'uploader') or public.has_role(auth.uid(),'admin')));
create policy "Uploaders write images" on storage.objects for insert
  with check (bucket_id = 'images' and (public.has_role(auth.uid(),'uploader') or public.has_role(auth.uid(),'admin')));

create policy "Owner or admin delete pdfs" on storage.objects for delete
  using (bucket_id = 'pdfs' and (owner = auth.uid() or public.has_role(auth.uid(),'admin')));
create policy "Owner or admin delete audios" on storage.objects for delete
  using (bucket_id = 'audios' and (owner = auth.uid() or public.has_role(auth.uid(),'admin')));
create policy "Owner or admin delete images" on storage.objects for delete
  using (bucket_id = 'images' and (owner = auth.uid() or public.has_role(auth.uid(),'admin')));
