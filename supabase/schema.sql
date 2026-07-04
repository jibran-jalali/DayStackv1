create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name);

  insert into public.user_notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  task_date date not null,
  start_time time not null,
  end_time time not null,
  task_type text not null default 'generic',
  meeting_link text,
  source_task_id uuid,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tasks add column if not exists task_type text not null default 'generic';
alter table public.tasks add column if not exists meeting_link text;
alter table public.tasks add column if not exists source_task_id uuid;

create table if not exists public.task_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  participant_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  summary_date date not null,
  total_tasks integer not null default 0,
  completed_tasks integer not null default 0,
  execution_score integer not null default 0,
  successful_day boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint daily_summaries_total_tasks_non_negative check (total_tasks >= 0),
  constraint daily_summaries_completed_tasks_non_negative check (completed_tasks >= 0),
  constraint daily_summaries_completed_tasks_not_over_total check (completed_tasks <= total_tasks),
  constraint daily_summaries_execution_score_range check (execution_score between 0 and 100),
  constraint daily_summaries_unique_day unique (user_id, summary_date)
);

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default false,
  remind_at_start boolean not null default true,
  remind_5_min_before boolean not null default true,
  remind_overdue boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.profiles (id, full_name)
select
  users.id,
  nullif(users.raw_user_meta_data ->> 'full_name', '')
from auth.users as users
on conflict (id) do update
set full_name = coalesce(public.profiles.full_name, excluded.full_name);

insert into public.user_notification_preferences (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;

create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_type text not null,
  remind_at timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.task_reminders add column if not exists updated_at timestamptz not null default timezone('utc', now());
alter table public.task_reminders add column if not exists sent_at timestamptz;

create table if not exists public.task_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  notification_type text not null default 'task_mention',
  status text not null default 'pending',
  read_at timestamptz,
  accepted_task_id uuid references public.tasks (id) on delete set null,
  task_title text not null,
  task_date date not null,
  start_time time not null,
  end_time time not null,
  task_type text not null,
  meeting_link text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.mark_task_notifications_read(p_notification_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in to update notifications.';
  end if;

  if coalesce(array_length(p_notification_ids, 1), 0) = 0 then
    return 0;
  end if;

  update public.task_notifications
  set read_at = coalesce(read_at, timezone('utc', now()))
  where user_id = (select auth.uid())
    and id = any (p_notification_ids)
    and read_at is null;

  get diagnostics updated_count = row_count;

  return updated_count;
end;
$$;

create or replace function public.accept_task_notification(p_notification_id uuid)
returns table (
  accepted_task_id uuid,
  outcome text,
  task_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  notification_row public.task_notifications%rowtype;
  source_task public.tasks%rowtype;
  cloned_task public.tasks%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to accept a task mention.';
  end if;

  select *
  into notification_row
  from public.task_notifications
  where id = p_notification_id
    and user_id = current_user_id
  for update;

  if not found then
    raise exception 'This notification is no longer available.';
  end if;

  if notification_row.status = 'accepted' and notification_row.accepted_task_id is not null then
    select *
    into cloned_task
    from public.tasks
    where id = notification_row.accepted_task_id
      and user_id = current_user_id;

    if found then
      update public.task_notifications
      set read_at = coalesce(read_at, timezone('utc', now()))
      where id = notification_row.id;

      return query
      select cloned_task.id, 'already_accepted'::text, cloned_task.task_date;
      return;
    end if;
  end if;

  if notification_row.task_id is not null then
    select *
    into cloned_task
    from public.tasks
    where user_id = current_user_id
      and source_task_id = notification_row.task_id
    limit 1;

    if found then
      update public.task_notifications
      set status = 'accepted',
          accepted_task_id = cloned_task.id,
          read_at = coalesce(read_at, timezone('utc', now()))
      where id = notification_row.id;

      return query
      select cloned_task.id, 'already_accepted'::text, cloned_task.task_date;
      return;
    end if;
  end if;

  select *
  into source_task
  from public.tasks
  where id = notification_row.task_id;

  if not found then
    update public.task_notifications
    set status = 'expired',
        read_at = coalesce(read_at, timezone('utc', now()))
    where id = notification_row.id;

    return query
    select null::uuid, 'task_missing'::text, notification_row.task_date;
    return;
  end if;

  insert into public.tasks (
    user_id,
    title,
    task_date,
    start_time,
    end_time,
    task_type,
    meeting_link,
    status,
    source_task_id
  )
  values (
    current_user_id,
    source_task.title,
    source_task.task_date,
    source_task.start_time,
    source_task.end_time,
    source_task.task_type,
    source_task.meeting_link,
    'pending',
    source_task.id
  )
  returning *
  into cloned_task;

  insert into public.task_participants (task_id, participant_id)
  select cloned_task.id, participant_id
  from (
    select source_task.user_id as participant_id
    union
    select task_participants.participant_id
    from public.task_participants
    where task_participants.task_id = source_task.id
  ) as participants
  where participant_id <> current_user_id
  on conflict do nothing;

  update public.task_notifications
  set status = 'accepted',
      accepted_task_id = cloned_task.id,
      read_at = coalesce(read_at, timezone('utc', now()))
  where id = notification_row.id;

  return query
  select cloned_task.id, 'accepted'::text, cloned_task.task_date;
end;
$$;

create or replace function public.admin_account_usage_snapshot(p_user_ids uuid[])
returns table (
  user_id uuid,
  estimated_owned_records bigint
)
language sql
stable
set search_path = public
as $$
  with selected_users as (
    select distinct unnest(coalesce(p_user_ids, '{}'::uuid[])) as user_id
  ),
  usage_rows as (
    select profiles.id as user_id, 1::bigint as owned_records
    from public.profiles
    join selected_users on selected_users.user_id = profiles.id

    union all

    select tasks.user_id, count(*)::bigint as owned_records
    from public.tasks
    join selected_users on selected_users.user_id = tasks.user_id
    group by tasks.user_id

    union all

    select tasks.user_id, count(*)::bigint as owned_records
    from public.task_participants
    join public.tasks on public.tasks.id = task_participants.task_id
    join selected_users on selected_users.user_id = public.tasks.user_id
    group by public.tasks.user_id

    union all

    select daily_summaries.user_id, count(*)::bigint as owned_records
    from public.daily_summaries
    join selected_users on selected_users.user_id = daily_summaries.user_id
    group by daily_summaries.user_id

    union all

    select user_notification_preferences.user_id, count(*)::bigint as owned_records
    from public.user_notification_preferences
    join selected_users on selected_users.user_id = user_notification_preferences.user_id
    group by user_notification_preferences.user_id

    union all

    select task_reminders.user_id, count(*)::bigint as owned_records
    from public.task_reminders
    join selected_users on selected_users.user_id = task_reminders.user_id
    group by task_reminders.user_id

    union all

    select task_notifications.user_id, count(*)::bigint as owned_records
    from public.task_notifications
    join selected_users on selected_users.user_id = task_notifications.user_id
    group by task_notifications.user_id
  )
  select selected_users.user_id, coalesce(sum(usage_rows.owned_records), 0)::bigint as estimated_owned_records
  from selected_users
  left join usage_rows on usage_rows.user_id = selected_users.user_id
  group by selected_users.user_id;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_title_not_blank'
  ) then
    alter table public.tasks
      add constraint tasks_title_not_blank check (char_length(trim(title)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_status_valid'
  ) then
    alter table public.tasks
      add constraint tasks_status_valid check (status in ('pending', 'completed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_task_type_valid'
  ) then
    alter table public.tasks
      add constraint tasks_task_type_valid check (task_type in ('generic', 'meeting', 'blocked'));
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'tasks_task_type_valid'
      and pg_get_constraintdef(oid) not like '%blocked%'
  ) then
    alter table public.tasks drop constraint tasks_task_type_valid;
    alter table public.tasks
      add constraint tasks_task_type_valid check (task_type in ('generic', 'meeting', 'blocked'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_time_range_valid'
  ) then
    alter table public.tasks
      add constraint tasks_time_range_valid check (end_time > start_time);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_reminders_type_valid'
  ) then
    alter table public.task_reminders
      add constraint task_reminders_type_valid check (reminder_type in ('5_minutes_before', 'at_start', 'overdue'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_reminders_status_valid'
  ) then
    alter table public.task_reminders
      add constraint task_reminders_status_valid check (status in ('pending', 'processing', 'sent', 'skipped', 'failed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_notifications_type_valid'
  ) then
    alter table public.task_notifications
      add constraint task_notifications_type_valid check (notification_type in ('task_mention'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_notifications_status_valid'
  ) then
    alter table public.task_notifications
      add constraint task_notifications_status_valid check (status in ('pending', 'accepted', 'dismissed', 'expired'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_notifications_task_type_valid'
  ) then
    alter table public.task_notifications
      add constraint task_notifications_task_type_valid check (task_type in ('generic', 'meeting', 'blocked'));
  end if;
end
$$;

create unique index if not exists task_participants_task_participant_uidx
  on public.task_participants (task_id, participant_id);

create unique index if not exists task_reminders_task_type_time_uidx
  on public.task_reminders (task_id, reminder_type, remind_at);

create index if not exists profiles_full_name_idx
  on public.profiles (full_name);

create index if not exists tasks_user_date_start_idx
  on public.tasks (user_id, task_date, start_time);

create index if not exists tasks_user_date_status_idx
  on public.tasks (user_id, task_date, status);

create index if not exists tasks_user_date_type_idx
  on public.tasks (user_id, task_date, task_type);

create index if not exists task_participants_task_id_idx
  on public.task_participants (task_id);

create index if not exists task_participants_participant_id_idx
  on public.task_participants (participant_id);

create index if not exists daily_summaries_user_date_idx
  on public.daily_summaries (user_id, summary_date desc);

create index if not exists task_reminders_due_idx
  on public.task_reminders (status, remind_at);

create index if not exists task_reminders_user_due_idx
  on public.task_reminders (user_id, status, remind_at);

create unique index if not exists tasks_user_source_task_uidx
  on public.tasks (user_id, source_task_id)
  where source_task_id is not null;

create unique index if not exists task_notifications_task_user_type_uidx
  on public.task_notifications (task_id, user_id, notification_type);

create index if not exists task_notifications_user_created_idx
  on public.task_notifications (user_id, created_at desc);

create index if not exists task_notifications_actor_created_idx
  on public.task_notifications (actor_user_id, created_at desc);

create index if not exists task_notifications_user_unread_idx
  on public.task_notifications (user_id, created_at desc)
  where read_at is null;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_daily_summaries_updated_at on public.daily_summaries;
create trigger set_daily_summaries_updated_at
before update on public.daily_summaries
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_notification_preferences_updated_at on public.user_notification_preferences;
create trigger set_user_notification_preferences_updated_at
before update on public.user_notification_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists set_task_reminders_updated_at on public.task_reminders;
create trigger set_task_reminders_updated_at
before update on public.task_reminders
for each row
execute function public.set_updated_at();

drop trigger if exists set_task_notifications_updated_at on public.task_notifications;
create trigger set_task_notifications_updated_at
before update on public.task_notifications
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_participants enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.task_reminders enable row level security;
alter table public.task_notifications enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
using (auth.role() = 'authenticated');

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks
for delete
using (auth.uid() = user_id);

drop policy if exists "task_participants_select_owner" on public.task_participants;
create policy "task_participants_select_owner"
on public.task_participants
for select
using (
  exists (
    select 1
    from public.tasks
    where public.tasks.id = task_participants.task_id
      and public.tasks.user_id = auth.uid()
  )
);

drop policy if exists "task_participants_insert_owner" on public.task_participants;
create policy "task_participants_insert_owner"
on public.task_participants
for insert
with check (
  exists (
    select 1
    from public.tasks
    where public.tasks.id = task_participants.task_id
      and public.tasks.user_id = auth.uid()
  )
);

drop policy if exists "task_participants_delete_owner" on public.task_participants;
create policy "task_participants_delete_owner"
on public.task_participants
for delete
using (
  exists (
    select 1
    from public.tasks
    where public.tasks.id = task_participants.task_id
      and public.tasks.user_id = auth.uid()
  )
);

drop policy if exists "task_participants_update_owner" on public.task_participants;
create policy "task_participants_update_owner"
on public.task_participants
for update
using (
  exists (
    select 1
    from public.tasks
    where public.tasks.id = task_participants.task_id
      and public.tasks.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tasks
    where public.tasks.id = task_participants.task_id
      and public.tasks.user_id = auth.uid()
  )
);

drop policy if exists "daily_summaries_select_own" on public.daily_summaries;
create policy "daily_summaries_select_own"
on public.daily_summaries
for select
using (auth.uid() = user_id);

drop policy if exists "daily_summaries_insert_own" on public.daily_summaries;
create policy "daily_summaries_insert_own"
on public.daily_summaries
for insert
with check (auth.uid() = user_id);

drop policy if exists "daily_summaries_update_own" on public.daily_summaries;
create policy "daily_summaries_update_own"
on public.daily_summaries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_summaries_delete_own" on public.daily_summaries;
create policy "daily_summaries_delete_own"
on public.daily_summaries
for delete
using (auth.uid() = user_id);

drop policy if exists "notification_preferences_select_own" on public.user_notification_preferences;
create policy "notification_preferences_select_own"
on public.user_notification_preferences
for select
using (auth.uid() = user_id);

drop policy if exists "notification_preferences_insert_own" on public.user_notification_preferences;
create policy "notification_preferences_insert_own"
on public.user_notification_preferences
for insert
with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_update_own" on public.user_notification_preferences;
create policy "notification_preferences_update_own"
on public.user_notification_preferences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_delete_own" on public.user_notification_preferences;
create policy "notification_preferences_delete_own"
on public.user_notification_preferences
for delete
using (auth.uid() = user_id);

drop policy if exists "task_reminders_select_own" on public.task_reminders;
create policy "task_reminders_select_own"
on public.task_reminders
for select
using (auth.uid() = user_id);

drop policy if exists "task_reminders_insert_own" on public.task_reminders;
create policy "task_reminders_insert_own"
on public.task_reminders
for insert
with check (auth.uid() = user_id);

drop policy if exists "task_reminders_update_own" on public.task_reminders;
create policy "task_reminders_update_own"
on public.task_reminders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "task_reminders_delete_own" on public.task_reminders;
create policy "task_reminders_delete_own"
on public.task_reminders
for delete
using (auth.uid() = user_id);

drop policy if exists "task_notifications_select_recipient" on public.task_notifications;
create policy "task_notifications_select_recipient"
on public.task_notifications
for select
using ((select auth.uid()) = user_id);

drop policy if exists "task_notifications_select_actor" on public.task_notifications;
create policy "task_notifications_select_actor"
on public.task_notifications
for select
using ((select auth.uid()) = actor_user_id);

drop policy if exists "task_notifications_insert_actor" on public.task_notifications;
create policy "task_notifications_insert_actor"
on public.task_notifications
for insert
with check (
  (select auth.uid()) = actor_user_id
  and user_id <> actor_user_id
  and notification_type = 'task_mention'
  and exists (
    select 1
    from public.tasks
    where public.tasks.id = task_notifications.task_id
      and public.tasks.user_id = (select auth.uid())
  )
);

drop policy if exists "task_notifications_update_actor" on public.task_notifications;
create policy "task_notifications_update_actor"
on public.task_notifications
for update
using ((select auth.uid()) = actor_user_id)
with check ((select auth.uid()) = actor_user_id);

revoke all on function public.mark_task_notifications_read(uuid[]) from public;
grant execute on function public.mark_task_notifications_read(uuid[]) to authenticated;

revoke all on function public.accept_task_notification(uuid) from public;
grant execute on function public.accept_task_notification(uuid) to authenticated;

revoke all on function public.admin_account_usage_snapshot(uuid[]) from public;
grant execute on function public.admin_account_usage_snapshot(uuid[]) to service_role;
