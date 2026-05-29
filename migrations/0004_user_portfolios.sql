alter table portfolios add column user_id text references auth_users(id) on delete cascade;

create index if not exists idx_portfolios_user_id on portfolios(user_id);
