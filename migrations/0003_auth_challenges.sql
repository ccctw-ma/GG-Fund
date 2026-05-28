create table if not exists auth_challenges (
  id text primary key,
  provider text not null,
  identifier text not null,
  code text not null,
  created_at text not null,
  expires_at text not null,
  consumed_at text
);
