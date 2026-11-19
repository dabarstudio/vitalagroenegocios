-- Jornada do Cliente + NPS (Vital) — 19/11/2026
create table if not exists public.jor_marcos (
  id uuid primary key default gen_random_uuid(), empresa text not null, ordem numeric not null default 0, icone text default '⭐',
  titulo text not null, descricao text, status text not null default 'proximo' check (status in ('feito','agora','proximo')),
  data date, concluido_em timestamptz, pede_nps boolean not null default true, criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create index if not exists jor_marcos_emp on public.jor_marcos (public.norm(empresa), ordem);
create table if not exists public.nps_respostas (
  id uuid primary key default gen_random_uuid(), empresa text not null, user_id uuid not null default auth.uid(), nome text,
  nota int not null check (nota between 0 and 10), comentario text, motivo text not null check (motivo in ('marco','trimestral')),
  marco uuid references public.jor_marcos(id) on delete set null, em timestamptz not null default now());
create index if not exists nps_resp_emp on public.nps_respostas (public.norm(empresa), em desc);
create unique index if not exists nps_um_por_marco on public.nps_respostas (user_id, marco) where marco is not null;
create or replace function public.jor_toca() returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.atualizado_em := now();
  if new.status = 'feito' and (tg_op = 'INSERT' or old.status is distinct from 'feito') then new.concluido_em := coalesce(new.concluido_em, now()); end if;
  if new.status <> 'feito' then new.concluido_em := null; end if;
  return new;
end $$;
drop trigger if exists jor_toca on public.jor_marcos;
create trigger jor_toca before insert or update on public.jor_marcos for each row execute function public.jor_toca();
alter table public.jor_marcos enable row level security;
alter table public.nps_respostas enable row level security;
drop policy if exists jor_ler on public.jor_marcos;
create policy jor_ler on public.jor_marcos for select using (public.is_time() or public.ve_empresa_cliente(empresa));
drop policy if exists jor_time on public.jor_marcos;
create policy jor_time on public.jor_marcos for all using (public.is_time()) with check (public.is_time());
drop policy if exists nps_inserir on public.nps_respostas;
create policy nps_inserir on public.nps_respostas for insert with check (user_id = auth.uid() and public.ve_empresa_cliente(empresa));
drop policy if exists nps_ler on public.nps_respostas;
create policy nps_ler on public.nps_respostas for select using (user_id = auth.uid() or public.is_socio());
drop policy if exists nps_socio on public.nps_respostas;
create policy nps_socio on public.nps_respostas for delete using (public.is_socio());
create or replace function public.nps_pendente(emp text)
returns table (motivo text, marco uuid, titulo text)
language sql stable security definer set search_path to 'public' as $$
  with m as (
    select j.id, j.titulo from jor_marcos j
    where norm(j.empresa) = norm(emp) and j.status = 'feito' and j.pede_nps
      and j.concluido_em > now() - interval '45 days'
      and not exists (select 1 from nps_respostas r where r.marco = j.id and r.user_id = auth.uid())
    order by j.concluido_em desc limit 1),
  t as (
    select 'trimestral'::text as motivo, null::uuid as marco, null::text as titulo
    where not exists (select 1 from nps_respostas r where r.user_id = auth.uid() and norm(r.empresa) = norm(emp) and r.em > now() - interval '90 days')
      and exists (select 1 from jor_marcos j where norm(j.empresa) = norm(emp) and j.criado_em < now() - interval '30 days'))
  select 'marco', id, titulo from m where public.ve_empresa_cliente(emp)
  union all
  select * from t where public.ve_empresa_cliente(emp) and not exists (select 1 from m)
  limit 1
$$;
grant execute on function public.nps_pendente(text) to authenticated;
