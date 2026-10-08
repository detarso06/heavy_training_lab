-- Heavy Training Club: banco no Supabase.
-- Rodar no SQL Editor do projeto (uma vez). Mudanças futuras: novos arquivos em supabase/, nunca editar este
-- depois de aplicado.
--
-- Ideia geral: os treinos continuam no aparelho. O app só publica aqui o que é social:
--   perfis     → nome, avatar, código de amizade, privacidade e o "retrato" (sequência, rotina atual)
--   amizades   → pedidos (aceita = false) e amizades (aceita = true)
--   prs        → maior carga em série válida, só dos exercícios que o usuário escolheu mostrar
--   checkins   → post do treino concluído (números do dia + foto opcional)
-- Regra de ouro: amigos só veem o que o dono deixou visível; o resto nem sai do aparelho.

-- ---------------------------------------------------------------------------------------------
-- Perfis

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default 'Atleta' check (char_length(nome) between 1 and 40),
  avatar text,
  -- Código de amizade (6 caracteres, sem 0/O/1/I para não confundir ao digitar).
  codigo text not null unique,
  criado_em timestamptz not null default now(),

  -- Privacidade: o que os amigos podem ver.
  mostrar_checkins boolean not null default true,
  mostrar_sequencia boolean not null default true,
  mostrar_rotina boolean not null default true,
  -- Exercícios cujo PR aparece para os amigos (pelo nome).
  prs_visiveis text[] not null default '{}',

  -- Retrato publicado pelo app. Fica nulo quando o usuário esconde o dado.
  sequencia int,
  -- Último dia (do calendário do usuário) com treino ou descanso: sem isso a sequência ficaria "congelada".
  sequencia_ate date,
  rotina_atual text,
  atualizado_em timestamptz
);

create function public.gerar_codigo() returns text
language plpgsql
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
begin
  loop
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.perfis p where p.codigo = gerar_codigo.codigo);
  end loop;
  return codigo;
end;
$$;

-- Toda conta nova ganha um perfil com código.
create function public.criar_perfil() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, codigo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), 'Atleta'),
    public.gerar_codigo()
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------------------------------
-- Amizades

create table public.amizades (
  de uuid not null references public.perfis (id) on delete cascade,
  para uuid not null references public.perfis (id) on delete cascade,
  aceita boolean not null default false,
  criada_em timestamptz not null default now(),
  primary key (de, para),
  check (de <> para)
);

-- Um par só pode ter um vínculo, não importa quem pediu.
create unique index amizades_par on public.amizades (least(de, para), greatest(de, para));
create index amizades_para on public.amizades (para);

create function public.sao_amigos(a uuid, b uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.amizades
    where aceita and ((de = a and para = b) or (de = b and para = a))
  );
$$;

-- Pedido de amizade pelo código. Se a outra pessoa já tinha pedido, vira amizade na hora.
create function public.enviar_pedido(p_codigo text) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := auth.uid();
  alvo public.perfis;
  existente public.amizades;
begin
  if eu is null then
    raise exception 'Entre na sua conta primeiro.';
  end if;

  select * into alvo from public.perfis where codigo = upper(replace(trim(p_codigo), ' ', ''));
  if alvo.id is null then
    raise exception 'Nenhum atleta com esse código.';
  end if;
  if alvo.id = eu then
    raise exception 'Esse é o seu próprio código.';
  end if;

  select * into existente from public.amizades
  where (de = eu and para = alvo.id) or (de = alvo.id and para = eu);

  if existente.de is not null then
    if existente.aceita then
      raise exception 'Vocês já são amigos.';
    elsif existente.de = eu then
      raise exception 'Você já enviou um pedido para essa pessoa.';
    else
      update public.amizades set aceita = true where de = alvo.id and para = eu;
      return json_build_object('status', 'aceita', 'nome', alvo.nome, 'avatar', alvo.avatar);
    end if;
  end if;

  insert into public.amizades (de, para) values (eu, alvo.id);
  return json_build_object('status', 'enviado', 'nome', alvo.nome, 'avatar', alvo.avatar);
end;
$$;

-- Pedidos pendentes (recebidos e enviados) com nome e avatar da outra pessoa,
-- que ainda não é amiga e por isso não pode ler a tabela de perfis.
create function public.listar_pedidos() returns table (
  outro uuid,
  nome text,
  avatar text,
  recebido boolean,
  criada_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.avatar, a.para = auth.uid(), a.criada_em
  from public.amizades a
  join public.perfis p on p.id = case when a.de = auth.uid() then a.para else a.de end
  where not a.aceita and auth.uid() in (a.de, a.para)
  order by a.criada_em desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- PRs (maior carga numa série válida)

create table public.prs (
  usuario uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  exercicio text not null,
  carga numeric not null,
  repeticoes int not null,
  feito_em timestamptz not null,
  primary key (usuario, exercicio)
);

-- ---------------------------------------------------------------------------------------------
-- Check-ins (treino concluído postado no Club)

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  usuario uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  treino text not null,
  duracao_seg int not null,
  series int not null,
  repeticoes int not null,
  peso_total numeric not null,
  -- PRs batidos no dia: [{ "exercicio": "Supino reto", "carga": 80, "repeticoes": 6 }]
  prs jsonb not null default '[]',
  -- Caminho da foto no bucket "checkins" ({usuario}/{arquivo}.jpg).
  foto text,
  legenda text check (char_length(legenda) <= 280)
);

create index checkins_usuario_data on public.checkins (usuario, criado_em desc);

create function public.pode_ver_checkins(dono uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select dono = auth.uid()
    or (public.sao_amigos(dono, auth.uid())
        and coalesce((select mostrar_checkins from public.perfis where id = dono), false));
$$;

-- ---------------------------------------------------------------------------------------------
-- Regras de acesso (RLS)

alter table public.perfis enable row level security;
alter table public.amizades enable row level security;
alter table public.prs enable row level security;
alter table public.checkins enable row level security;

create policy "perfis: o próprio e os amigos" on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.sao_amigos(id, auth.uid()));

create policy "perfis: só o próprio edita" on public.perfis
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Código e data de entrada não são editáveis pelo app.
revoke update on public.perfis from authenticated, anon;
grant update (
  nome, avatar, mostrar_checkins, mostrar_sequencia, mostrar_rotina, prs_visiveis,
  sequencia, sequencia_ate, rotina_atual, atualizado_em
) on public.perfis to authenticated;

create policy "amizades: as minhas" on public.amizades
  for select to authenticated
  using (auth.uid() in (de, para));

-- Pedido novo só pela função enviar_pedido (sem insert direto).
create policy "amizades: quem recebeu aceita" on public.amizades
  for update to authenticated
  using (para = auth.uid())
  with check (para = auth.uid() and aceita);

-- Recusar, cancelar o pedido ou desfazer a amizade.
create policy "amizades: qualquer lado desfaz" on public.amizades
  for delete to authenticated
  using (auth.uid() in (de, para));

revoke update on public.amizades from authenticated, anon;
grant update (aceita) on public.amizades to authenticated;

create policy "prs: o próprio e os visíveis aos amigos" on public.prs
  for select to authenticated
  using (
    usuario = auth.uid()
    or (public.sao_amigos(usuario, auth.uid())
        and exercicio = any (select unnest(prs_visiveis) from public.perfis where id = usuario))
  );

create policy "prs: só o próprio grava" on public.prs
  for all to authenticated
  using (usuario = auth.uid())
  with check (usuario = auth.uid());

create policy "checkins: o próprio e os amigos" on public.checkins
  for select to authenticated
  using (public.pode_ver_checkins(usuario));

create policy "checkins: só o próprio posta" on public.checkins
  for insert to authenticated
  with check (usuario = auth.uid());

create policy "checkins: só o próprio apaga" on public.checkins
  for delete to authenticated
  using (usuario = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Fotos dos check-ins (bucket privado, até 1 MB, só JPEG)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkins', 'checkins', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "fotos: enviar na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos: apagar as próprias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "fotos: as próprias e as dos amigos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'checkins'
    and exists (
      select 1 from public.checkins c
      where c.foto = storage.objects.name and public.pode_ver_checkins(c.usuario)
    )
  );
