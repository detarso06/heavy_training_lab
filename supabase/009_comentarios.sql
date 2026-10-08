-- Comentários nos check-ins.
-- Quem pode ver o check-in (o dono e os amigos dele, se ele mostra check-ins) pode ler e comentar.
-- Cada um apaga os próprios comentários; o dono do check-in apaga qualquer comentário do post dele.
-- Apagar o check-in ou a conta leva os comentários junto.

create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  checkin uuid not null references public.checkins (id) on delete cascade,
  usuario uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 500),
  criado_em timestamptz not null default now()
);

create index comentarios_checkin_data on public.comentarios (checkin, criado_em);

create function public.pode_ver_checkin(p_checkin uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.checkins c
    where c.id = p_checkin and public.pode_ver_checkins(c.usuario)
  );
$$;

alter table public.comentarios enable row level security;

create policy "comentarios: quem vê o check-in" on public.comentarios
  for select to authenticated
  using (public.pode_ver_checkin(checkin));

create policy "comentarios: quem vê o check-in comenta" on public.comentarios
  for insert to authenticated
  with check (usuario = auth.uid() and public.pode_ver_checkin(checkin));

create policy "comentarios: o autor ou o dono do check-in apaga" on public.comentarios
  for delete to authenticated
  using (
    usuario = auth.uid()
    or exists (select 1 from public.checkins c where c.id = checkin and c.usuario = auth.uid())
  );

-- Comentário não se edita (apaga e escreve de novo).
revoke update on public.comentarios from authenticated, anon;

-- Comentários do check-in com nome e avatar de quem escreveu. Precisa ser uma função porque quem
-- comentou pode ser amigo do dono do post, mas não de quem está lendo (e aí a tabela perfis não deixa ler).
create function public.listar_comentarios(p_checkin uuid) returns table (
  id uuid,
  usuario uuid,
  nome text,
  avatar text,
  texto text,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.usuario, p.nome, p.avatar, m.texto, m.criado_em
  from public.comentarios m
  join public.perfis p on p.id = m.usuario
  where m.checkin = p_checkin and public.pode_ver_checkin(p_checkin)
  order by m.criado_em;
$$;

revoke execute on function public.pode_ver_checkin(uuid) from public, anon;
revoke execute on function public.listar_comentarios(uuid) from public, anon;
grant execute on function public.pode_ver_checkin(uuid) to authenticated;
grant execute on function public.listar_comentarios(uuid) to authenticated;
