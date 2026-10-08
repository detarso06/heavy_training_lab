-- "Excluir conta" (Configurações): o usuário logado apaga a própria conta. Perfil, amizades, PRs e
-- check-ins saem junto (on delete cascade). As fotos o app apaga antes pelo Storage (o Supabase não
-- deixa apagar arquivos por SQL), já que a política "fotos: apagar as próprias" permite.
create function public.apagar_minha_conta() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta primeiro.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.apagar_minha_conta() from public, anon;
grant execute on function public.apagar_minha_conta() to authenticated;
