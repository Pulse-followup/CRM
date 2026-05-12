-- FAZA 2C — Products / Process Templates / Template Steps foundation

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  title text not null,
  category text,
  description text,
  price numeric default 0,
  currency text default 'RSD',
  delivery_time_label text,
  image_data_url text,
  client_scope text default 'all' check (client_scope in ('all', 'selected')),
  template_id uuid,
  source_template_id uuid,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.product_clients (
  product_id uuid not null references public.products(id) on delete cascade,
  client_id uuid not null,
  created_at timestamptz default now(),
  primary key (product_id, client_id)
);

create table if not exists public.process_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  title text not null,
  type text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.process_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates(id) on delete cascade,
  title text not null,
  required_role text,
  estimated_minutes integer default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.products
add column if not exists source_template_id uuid;

alter table public.projects
add column if not exists source_type text default 'manual',
add column if not exists source_product_id uuid,
add column if not exists source_template_id uuid;

alter table public.tasks
add column if not exists source_type text default 'manual',
add column if not exists source_product_id uuid,
add column if not exists source_template_id uuid,
add column if not exists source_template_step_id uuid,
add column if not exists required_role text,
add column if not exists file_link text;
