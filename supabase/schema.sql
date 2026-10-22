create table if not exists public.perguntas (
  id text primary key,
  pergunta text not null,
  opcoes jsonb not null,
  correta integer not null check (correta between 0 and 3),
  created_at timestamptz not null default now(),
  constraint perguntas_quatro_opcoes check (jsonb_array_length(opcoes) = 4)
);

alter table public.perguntas enable row level security;

grant select on public.perguntas to anon, authenticated;
grant insert, update, delete on public.perguntas to authenticated;

drop policy if exists "Perguntas visiveis para todos" on public.perguntas;
drop policy if exists "Administrador pode adicionar perguntas" on public.perguntas;
drop policy if exists "Administrador pode editar perguntas" on public.perguntas;
drop policy if exists "Administrador pode excluir perguntas" on public.perguntas;

create policy "Perguntas visiveis para todos"
  on public.perguntas
  for select
  to anon, authenticated
  using (true);

create policy "Administrador pode adicionar perguntas"
  on public.perguntas
  for insert
  to authenticated
  with check (lower(auth.jwt() ->> 'email') = lower('admin@gmail.com'));

create policy "Administrador pode editar perguntas"
  on public.perguntas
  for update
  to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('admin@gmail.com'))
  with check (lower(auth.jwt() ->> 'email') = lower('admin@gmail.com'));

create policy "Administrador pode excluir perguntas"
  on public.perguntas
  for delete
  to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('admin@gmail.com'));

create table if not exists public.pontuacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 20),
  pontos integer not null check (pontos >= 0),
  created_at timestamptz not null default now()
);

alter table public.pontuacoes enable row level security;

grant select, insert on public.pontuacoes to anon, authenticated;
grant delete on public.pontuacoes to authenticated;

drop policy if exists "Ranking visivel para todos" on public.pontuacoes;
drop policy if exists "Jogadores podem enviar pontuacoes" on public.pontuacoes;
drop policy if exists "Administrador pode limpar pontuacoes" on public.pontuacoes;

create policy "Ranking visivel para todos"
  on public.pontuacoes
  for select
  to anon, authenticated
  using (true);

create policy "Jogadores podem enviar pontuacoes"
  on public.pontuacoes
  for insert
  to anon, authenticated
  with check (char_length(btrim(nome)) between 1 and 20 and pontos >= 0);

create policy "Administrador pode limpar pontuacoes"
  on public.pontuacoes
  for delete
  to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('admin@gmail.com'));

create or replace view public.ranking_publico
with (security_invoker = true)
as
select distinct on (lower(btrim(nome)))
  id,
  nome,
  pontos,
  created_at
from public.pontuacoes
order by lower(btrim(nome)), pontos desc, created_at asc;

grant select on public.ranking_publico to anon, authenticated;
