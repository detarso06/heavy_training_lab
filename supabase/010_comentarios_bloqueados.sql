-- Comentários de quem não é seu amigo ficam bloqueados (só nome e avatar), com a opção de ver o
-- perfil básico e mandar um pedido de amizade direto, sem o código.
--
-- Exemplo: eu sou amigo da Aninha, a Aninha é amiga da Cynthia. Nós dois comentamos num check-in da Aninha:
-- eu vejo o comentário da Cynthia bloqueado (e ela o meu), e cada um pode pedir amizade ao outro dali.
-- A Aninha, dona do post, é amiga dos dois e vê tudo.

-- ---------------------------------------------------------------------------------------------
-- Comentários: o texto só vai para quem é o próprio autor ou amigo dele.

drop function public.listar_comentarios(uuid);

create function public.listar_comentarios(p_checkin uuid) returns table (
  id uuid,
  usuario uuid,
  nome text,
  avatar text,
  -- Nulo quando bloqueado.
  texto text,
  bloqueado boolean,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    m.usuario,
    p.nome,
    p.avatar,
    case when liberado then m.texto end,
    not liberado,
    m.criado_em
  from public.comentarios m
  join public.perfis p on p.id = m.usuario
  cross join lateral (
    select m.usuario = auth.uid() or public.sao_amigos(m.usuario, auth.uid()) as liberado
  ) l
  where m.checkin = p_checkin and public.pode_ver_checkin(p_checkin)
  order by m.criado_em;
$$;

-- ---------------------------------------------------------------------------------------------
-- Quem eu posso conhecer sem código: alguém que comentou num check-in que eu vejo
-- (ou com quem já tenho pedido/amizade).

create function public.posso_conhecer(alvo uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.amizades
      where auth.uid() in (de, para) and alvo in (de, para)
    )
    or exists (
      select 1 from public.comentarios m
      where m.usuario = alvo and public.pode_ver_checkin(m.checkin)
    );
$$;

-- Perfil básico (nome, avatar, desde quando) e o vínculo comigo:
-- 'amigos', 'enviado' (eu pedi), 'recebido' (a pessoa pediu) ou nulo.
create function public.perfil_basico(p_usuario uuid) returns table (
  id uuid,
  nome text,
  avatar text,
  criado_em timestamptz,
  vinculo text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nome,
    p.avatar,
    p.criado_em,
    (
      select case when a.aceita then 'amigos' when a.de = auth.uid() then 'enviado' else 'recebido' end
      from public.amizades a
      where (a.de = auth.uid() and a.para = p.id) or (a.de = p.id and a.para = auth.uid())
    )
  from public.perfis p
  where p.id = p_usuario and (p.id = auth.uid() or public.posso_conhecer(p.id));
$$;

-- ---------------------------------------------------------------------------------------------
-- Pedido de amizade: a mesma regra para o código e para o pedido direto.

create function public.criar_pedido(alvo public.perfis) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := auth.uid();
  existente public.amizades;
begin
  if eu is null then
    raise exception 'Entre na sua conta primeiro.';
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

create or replace function public.enviar_pedido(p_codigo text) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo public.perfis;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta primeiro.';
  end if;
  select * into alvo from public.perfis where codigo = upper(replace(trim(p_codigo), ' ', ''));
  if alvo.id is null then
    raise exception 'Nenhum atleta com esse código.';
  end if;
  return public.criar_pedido(alvo);
end;
$$;

-- Pedido direto, sem código (a partir de um comentário bloqueado).
create function public.enviar_pedido_para(p_usuario uuid) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo public.perfis;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta primeiro.';
  end if;
  if not public.posso_conhecer(p_usuario) then
    raise exception 'Peça o código de amizade para essa pessoa.';
  end if;
  select * into alvo from public.perfis where id = p_usuario;
  if alvo.id is null then
    raise exception 'Esse atleta não existe mais.';
  end if;
  return public.criar_pedido(alvo);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permissões

revoke execute on function public.criar_pedido(public.perfis) from public, anon, authenticated;

revoke execute on function public.listar_comentarios(uuid) from public, anon;
revoke execute on function public.posso_conhecer(uuid) from public, anon;
revoke execute on function public.perfil_basico(uuid) from public, anon;
revoke execute on function public.enviar_pedido_para(uuid) from public, anon;
grant execute on function public.listar_comentarios(uuid) to authenticated;
grant execute on function public.posso_conhecer(uuid) to authenticated;
grant execute on function public.perfil_basico(uuid) to authenticated;
grant execute on function public.enviar_pedido_para(uuid) to authenticated;
