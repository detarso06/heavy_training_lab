-- Sininho de notificações: até quando o usuário já viu as novidades (check-ins dos amigos).
-- Fica na conta para valer em qualquer aparelho.
alter table public.perfis add column notificacoes_vistas_em timestamptz not null default now();
grant update (notificacoes_vistas_em) on public.perfis to authenticated;
