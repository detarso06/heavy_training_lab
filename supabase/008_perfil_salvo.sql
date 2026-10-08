-- A transferência para outro aparelho também leva o perfil do app (nome, idade, altura, peso, metas e avatar).
alter table public.treinos_salvos add column perfil jsonb;
