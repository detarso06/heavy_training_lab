-- "Transferir treinos" entre aparelhos: cópia das rotinas, treinos e exercícios planejados da conta.
-- Só a estrutura dos treinos (séries/reps/descanso planejados). Histórico, cargas e PRs ficam no aparelho.
-- Só o dono lê e grava (nem os amigos veem).
create table public.treinos_salvos (
  usuario uuid primary key default auth.uid() references public.perfis (id) on delete cascade,
  -- [{ nome, descricao, ativa, treinos: [{ nome, descricao, descanso, exercicios: [{ nome, grupoMuscular,
  --   videoUrl, aquecimento, preparatoria, validas, descansoSeg }] }] }]
  rotinas jsonb not null,
  aparelho text,
  atualizado_em timestamptz not null default now()
);

alter table public.treinos_salvos enable row level security;

create policy "treinos_salvos: só o dono" on public.treinos_salvos
  for all to authenticated
  using (usuario = auth.uid())
  with check (usuario = auth.uid());
