-- Private-by-default catalog metadata. PDF bytes live in a private Storage bucket;
-- all reads and writes are mediated by the server-side Netlify function.
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'),
  description text not null default '' check (char_length(description) <= 1200),
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  theme text not null default 'reading-room' check (theme in ('reading-room','linen','midnight')),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_books (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  title text not null check (char_length(title) between 1 and 240),
  author text not null default '' check (char_length(author) <= 240),
  description text not null default '' check (char_length(description) <= 2000),
  tags text[] not null default '{}',
  sort_order integer not null default 0,
  featured boolean not null default false,
  thumbnail_data text not null default '' check (char_length(thumbnail_data) <= 40000),
  share_rights boolean not null default false,
  byte_size bigint not null default 0 check (byte_size >= 0),
  page_count integer check (page_count is null or page_count between 1 and 100000),
  upload_state text not null default 'pending' check (upload_state in ('pending','ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_book_tags_limit check (cardinality(tags) <= 20)
);

create index if not exists collections_public_directory_idx on public.collections (created_at desc) where visibility = 'public';
create index if not exists collections_owner_idx on public.collections (owner_id, created_at desc);
create index if not exists collection_books_order_idx on public.collection_books (collection_id, sort_order, created_at);

create table if not exists public.collection_reports (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  reason text not null check (reason in ('copyright','abuse','misleading','privacy','other')),
  details text not null default '' check (char_length(details) <= 1200),
  state text not null default 'open' check (state in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists collection_reports_open_idx on public.collection_reports (created_at) where state = 'open';

alter table public.collections enable row level security;
alter table public.collection_books enable row level security;
alter table public.collection_reports enable row level security;
revoke all on public.collections, public.collection_books, public.collection_reports from anon, authenticated;
grant all on public.collections, public.collection_books, public.collection_reports to service_role;

-- Create this private Storage bucket before enabling upload endpoints. The API will
-- use short-lived, path-scoped signed upload/read URLs and enforce object quotas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('librarian-collections', 'librarian-collections', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

create or replace function public.create_librarian_collection(
  p_owner_id uuid, p_title text, p_slug text, p_description text, p_visibility text, p_theme text, p_cover_url text
) returns setof public.collections language plpgsql security definer set search_path = '' as $$
declare existing_count bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 1));
  select count(*) into existing_count from public.collections where owner_id = p_owner_id;
  if existing_count >= 12 then return; end if;
  return query insert into public.collections(owner_id,title,slug,description,visibility,theme,cover_url)
    values (p_owner_id,p_title,p_slug,p_description,p_visibility,p_theme,p_cover_url) returning *;
end $$;
revoke all on function public.create_librarian_collection(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_librarian_collection(uuid,text,text,text,text,text,text) to service_role;

-- Admission and reservation happen atomically so concurrent uploads cannot race
-- past collection/file quotas. A pending row reserves bytes until finalized/deleted.
create or replace function public.reserve_librarian_collection_upload(
  p_account_id uuid, p_collection_id uuid, p_book_id uuid, p_storage_path text,
  p_bytes bigint, p_title text, p_author text, p_description text, p_tags text[],
  p_page_count integer, p_thumbnail_data text, p_share_rights boolean
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  used_bytes bigint;
  book_count bigint;
begin
  if p_bytes < 1 or p_bytes > 52428800 or cardinality(p_tags) > 20 or p_page_count < 1 or p_page_count > 100000 or char_length(p_thumbnail_data) > 40000 or p_share_rights is not true then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_account_id::text, 0));
  if not exists (select 1 from public.collections c where c.id = p_collection_id and c.owner_id = p_account_id) then return false; end if;
  select coalesce(sum(b.byte_size), 0), count(*) into used_bytes, book_count
    from public.collection_books b where b.owner_id = p_account_id;
  if book_count >= 100 or used_bytes + p_bytes > 2147483648 then return false; end if;
  insert into public.collection_books(id, collection_id, owner_id, storage_path, byte_size, title, author, description, tags, sort_order, featured, thumbnail_data, share_rights, page_count)
    values (p_book_id, p_collection_id, p_account_id, p_storage_path, p_bytes, p_title, p_author, p_description, p_tags, book_count::integer, false, p_thumbnail_data, true, p_page_count);
  return true;
end $$;
revoke all on function public.reserve_librarian_collection_upload(uuid,uuid,uuid,text,bigint,text,text,text,text[],integer,text,boolean) from public, anon, authenticated;
grant execute on function public.reserve_librarian_collection_upload(uuid,uuid,uuid,text,bigint,text,text,text,text[],integer,text,boolean) to service_role;
