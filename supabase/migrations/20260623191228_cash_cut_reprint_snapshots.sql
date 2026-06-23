-- Persist full cash cut snapshots for faithful reprints.

alter table public.cash_cuts
  add column if not exists opening_fund numeric default 0,
  add column if not exists snapshot_version integer default 0,
  add column if not exists cash_cut_snapshot jsonb default '{}'::jsonb;

create index if not exists idx_cash_cuts_user_end_time
on public.cash_cuts(user_id, end_time desc);

create index if not exists idx_cash_cuts_snapshot_version
on public.cash_cuts(snapshot_version);
