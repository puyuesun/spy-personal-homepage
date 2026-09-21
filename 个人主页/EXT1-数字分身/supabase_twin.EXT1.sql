-- EXT1 数字分身服务端数据表
-- 仅保存哈希标识、额度和 token 用量，不保存聊天正文、提示词或模型回答。

create table if not exists public.twin_sessions (
  session_hash text primary key,
  verified_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.twin_rate_limits (
  scope text not null check (scope in ('session', 'ip', 'global')),
  key_hash text not null,
  day_key date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, day_key)
);

create table if not exists public.twin_usage (
  month_key text primary key,
  prompt_tokens bigint not null default 0 check (prompt_tokens >= 0),
  completion_tokens bigint not null default 0 check (completion_tokens >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  estimated_cost_cny numeric(12, 4) not null default 0 check (estimated_cost_cny >= 0),
  updated_at timestamptz not null default now()
);

alter table public.twin_sessions enable row level security;
alter table public.twin_rate_limits enable row level security;
alter table public.twin_usage enable row level security;

revoke all on public.twin_sessions from anon, authenticated;
revoke all on public.twin_rate_limits from anon, authenticated;
revoke all on public.twin_usage from anon, authenticated;
grant all on public.twin_sessions to service_role;
grant all on public.twin_rate_limits to service_role;
grant all on public.twin_usage to service_role;

create or replace function public.twin_session_is_verified(p_session_hash text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.twin_sessions
    where session_hash = p_session_hash
      and verified_until > now()
  );
$$;

create or replace function public.twin_verify_session(p_session_hash text, p_minutes integer default 30)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.twin_sessions (session_hash, verified_until)
  values (p_session_hash, now() + make_interval(mins => greatest(5, least(p_minutes, 120))))
  on conflict (session_hash) do update
    set verified_until = excluded.verified_until,
        updated_at = now();
$$;

create or replace function public.twin_get_month_cost(p_month_key text)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce((select estimated_cost_cny from public.twin_usage where month_key = p_month_key), 0);
$$;

create or replace function public.twin_consume_quota(
  p_session_hash text,
  p_ip_hash text,
  p_day date,
  p_session_limit integer default 8,
  p_ip_limit integer default 20,
  p_global_limit integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_count integer;
  v_ip_count integer;
  v_global_count integer;
begin
  -- 轻量清理：每次调用只删除 30 天前的日限额数据。
  delete from public.twin_rate_limits where day_key < p_day - 30;

  insert into public.twin_rate_limits (scope, key_hash, day_key, request_count)
  values ('session', p_session_hash, p_day, 0)
  on conflict do nothing;
  insert into public.twin_rate_limits (scope, key_hash, day_key, request_count)
  values ('ip', p_ip_hash, p_day, 0)
  on conflict do nothing;
  insert into public.twin_rate_limits (scope, key_hash, day_key, request_count)
  values ('global', 'global', p_day, 0)
  on conflict do nothing;

  select request_count into v_session_count
  from public.twin_rate_limits
  where scope = 'session' and key_hash = p_session_hash and day_key = p_day
  for update;
  select request_count into v_ip_count
  from public.twin_rate_limits
  where scope = 'ip' and key_hash = p_ip_hash and day_key = p_day
  for update;
  select request_count into v_global_count
  from public.twin_rate_limits
  where scope = 'global' and key_hash = 'global' and day_key = p_day
  for update;

  if v_session_count >= p_session_limit then
    return jsonb_build_object('allowed', false, 'scope', 'session', 'remaining', 0);
  end if;
  if v_ip_count >= p_ip_limit then
    return jsonb_build_object('allowed', false, 'scope', 'ip', 'remaining', 0);
  end if;
  if v_global_count >= p_global_limit then
    return jsonb_build_object('allowed', false, 'scope', 'global', 'remaining', 0);
  end if;

  update public.twin_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where (scope = 'session' and key_hash = p_session_hash and day_key = p_day)
     or (scope = 'ip' and key_hash = p_ip_hash and day_key = p_day)
     or (scope = 'global' and key_hash = 'global' and day_key = p_day);

  return jsonb_build_object(
    'allowed', true,
    'scope', null,
    'remaining', least(
      p_session_limit - v_session_count - 1,
      p_ip_limit - v_ip_count - 1,
      p_global_limit - v_global_count - 1
    )
  );
end;
$$;

create or replace function public.twin_record_usage(
  p_month_key text,
  p_prompt_tokens bigint,
  p_completion_tokens bigint,
  p_cost_cny numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric;
begin
  insert into public.twin_usage (month_key, prompt_tokens, completion_tokens, request_count, estimated_cost_cny)
  values (p_month_key, greatest(p_prompt_tokens, 0), greatest(p_completion_tokens, 0), 1, greatest(p_cost_cny, 0))
  on conflict (month_key) do update
    set prompt_tokens = public.twin_usage.prompt_tokens + greatest(p_prompt_tokens, 0),
        completion_tokens = public.twin_usage.completion_tokens + greatest(p_completion_tokens, 0),
        request_count = public.twin_usage.request_count + 1,
        estimated_cost_cny = public.twin_usage.estimated_cost_cny + greatest(p_cost_cny, 0),
        updated_at = now();

  select estimated_cost_cny into v_total from public.twin_usage where month_key = p_month_key;
  return coalesce(v_total, 0);
end;
$$;

revoke all on function public.twin_session_is_verified(text) from public, anon, authenticated;
revoke all on function public.twin_verify_session(text, integer) from public, anon, authenticated;
revoke all on function public.twin_get_month_cost(text) from public, anon, authenticated;
revoke all on function public.twin_consume_quota(text, text, date, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.twin_record_usage(text, bigint, bigint, numeric) from public, anon, authenticated;
grant execute on function public.twin_session_is_verified(text) to service_role;
grant execute on function public.twin_verify_session(text, integer) to service_role;
grant execute on function public.twin_get_month_cost(text) to service_role;
grant execute on function public.twin_consume_quota(text, text, date, integer, integer, integer) to service_role;
grant execute on function public.twin_record_usage(text, bigint, bigint, numeric) to service_role;