-- Jornada do Cliente: documentos por etapa + "Documentos da empresa" + autoatendimento (25/11/2026)
alter table public.ent_arquivos add column if not exists marco uuid references public.jor_marcos(id) on delete set null;
alter table public.ent_arquivos add column if not exists fixo boolean not null default false;
create index if not exists ent_arq_marco on public.ent_arquivos (marco);

create table if not exists public.aut_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  user_id uuid not null default auth.uid(),
  item text not null,
  acao text not null check (acao in ('achou','link','faltou','whatsapp','evitou_whats')),
  em timestamptz not null default now());
create index if not exists aut_eventos_emp on public.aut_eventos (public.norm(empresa), em desc);
alter table public.aut_eventos enable row level security;
drop policy if exists aut_inserir on public.aut_eventos;
create policy aut_inserir on public.aut_eventos for insert with check (user_id = auth.uid() and public.ve_empresa_cliente(empresa));
drop policy if exists aut_ler on public.aut_eventos;
create policy aut_ler on public.aut_eventos for select using (public.is_time() or public.is_socio());
