create table if not exists auth_users (
  id text primary key,
  provider text not null,
  identifier text not null,
  display_name text,
  created_at text not null,
  updated_at text not null,
  unique(provider, identifier)
);

create table if not exists auth_sessions (
  token text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  created_at text not null,
  expires_at text not null
);
