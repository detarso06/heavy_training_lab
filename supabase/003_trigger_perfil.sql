-- O 002 tirou o EXECUTE de criar_perfil() de "public", e com isso também do papel interno que cria
-- os usuários (supabase_auth_admin): todo cadastro falhava com "Database error saving new user".
grant execute on function public.criar_perfil() to supabase_auth_admin;
