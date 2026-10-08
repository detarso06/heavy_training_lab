-- Por padrão o Postgres deixa qualquer papel executar funções (inclusive visitantes sem login, via /rest/v1/rpc).
-- Aqui cada função fica só com quem precisa dela (avisos do Security Advisor do Supabase).

revoke execute on function public.gerar_codigo() from public, anon, authenticated;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

revoke execute on function public.enviar_pedido(text) from public, anon;
revoke execute on function public.listar_pedidos() from public, anon;
grant execute on function public.enviar_pedido(text) to authenticated;
grant execute on function public.listar_pedidos() to authenticated;

-- Usadas pelas regras de acesso (RLS), que rodam como o usuário logado: ele precisa poder executá-las.
revoke execute on function public.sao_amigos(uuid, uuid) from public, anon;
revoke execute on function public.pode_ver_checkins(uuid) from public, anon;
grant execute on function public.sao_amigos(uuid, uuid) to authenticated;
grant execute on function public.pode_ver_checkins(uuid) to authenticated;
