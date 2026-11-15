-- Assistant history and reviewable proposals. Run after the earlier migrations.
alter table public.farms add column if not exists latitude numeric(9,6) check (latitude between -90 and 90);
alter table public.farms add column if not exists longitude numeric(9,6) check (longitude between -180 and 180);
alter table public.farms add column if not exists demo_seeded boolean not null default false;
update public.farms f set demo_seeded = true where exists (
  select 1 from public.expenses e where e.farm_id = f.id and e.note = 'Demo season estimate'
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations(user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(content) between 1 and 30000),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages(conversation_id, created_at);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  detail text not null default '',
  due_on date,
  priority text not null check (priority in ('High','Medium','Low')),
  risk text not null default '',
  estimated_cost numeric(12,2),
  status text not null default 'pending' check (status in ('pending','approved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index ai_proposals_conversation_idx on public.ai_proposals(conversation_id);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_proposals enable row level security;
create policy "users own conversations" on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid()) and public.is_farm_member(farm_id))
  with check (user_id = (select auth.uid()) and public.is_farm_member(farm_id));
create policy "users own messages" on public.ai_messages for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy "users own proposals" on public.ai_proposals for all to authenticated
  using (user_id = (select auth.uid()) and public.is_farm_member(farm_id) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()) and c.farm_id = ai_proposals.farm_id))
  with check (user_id = (select auth.uid()) and public.is_farm_member(farm_id) and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()) and c.farm_id = ai_proposals.farm_id));
grant select, insert, update, delete on public.ai_conversations, public.ai_messages, public.ai_proposals to authenticated;

create or replace function public.approve_ai_proposal(proposal_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare proposal public.ai_proposals%rowtype; task_id uuid;
begin
  select * into proposal from public.ai_proposals where id = proposal_id for update;
  if not found or proposal.user_id <> (select auth.uid()) or not public.is_farm_member(proposal.farm_id) or proposal.status <> 'pending' then
    raise exception 'Proposal is unavailable or already reviewed';
  end if;
  insert into public.farm_tasks (farm_id, title, detail, due_on, priority)
  values (proposal.farm_id, proposal.title, proposal.detail, proposal.due_on, proposal.priority)
  returning id into task_id;
  update public.ai_proposals set status = 'approved', reviewed_at = now() where id = proposal_id;
  return task_id;
end $$;
revoke all on function public.approve_ai_proposal(uuid) from public;
grant execute on function public.approve_ai_proposal(uuid) to authenticated;
