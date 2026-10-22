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

create policy "Perguntas visiveis para todos"
  on public.perguntas
  for select
  to anon, authenticated
  using (true);

create policy "Administrador pode adicionar perguntas"
  on public.perguntas
  for insert
  to authenticated
  with check (lower(auth.jwt() ->> 'email') = lower('SUBSTITUA_PELO_EMAIL_ADMIN'));

create policy "Administrador pode editar perguntas"
  on public.perguntas
  for update
  to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('SUBSTITUA_PELO_EMAIL_ADMIN'))
  with check (lower(auth.jwt() ->> 'email') = lower('SUBSTITUA_PELO_EMAIL_ADMIN'));

create policy "Administrador pode excluir perguntas"
  on public.perguntas
  for delete
  to authenticated
  using (lower(auth.jwt() ->> 'email') = lower('SUBSTITUA_PELO_EMAIL_ADMIN'));
