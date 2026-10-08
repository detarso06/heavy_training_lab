-- Corrige gerar_codigo(): o schema.sql referenciava a variável como "gerar_codigo.codigo", que no PL/pgSQL
-- só vale para parâmetros. Resultado: "missing FROM-clause entry" e todo cadastro falhava.
create or replace function public.gerar_codigo() returns text
language plpgsql
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  novo text;
begin
  loop
    novo := '';
    for i in 1..6 loop
      novo := novo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.perfis p where p.codigo = novo);
  end loop;
  return novo;
end;
$$;

-- "create or replace" mantém as permissões do 002 (ninguém executa direto; criar_perfil roda como dono).
