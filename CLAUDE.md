@AGENTS.md

# App Treino

App pessoal de treino (por enquanto só o dono usa). Comunicação com o usuário em **português**.

## Como rodamos
- Desenvolvimento no navegador: `npx expo start --web --port 8081` → http://localhost:8081, com o DevTools em modo dispositivo (dimensões de iPhone). O usuário tem iPhone; teste real será pelo Expo Go.
- Antes de concluir uma tarefa: `npx tsc --noEmit` e `npx expo lint`.
- GitHub: https://github.com/detarso06/app-treino (privado, branch `main`). A conta também pertence à organização da empresa do usuário — nunca criar nem alterar nada fora de `detarso06/app-treino`.
- O `gh` fica em `C:\Program Files\GitHub CLI\gh.exe` (pode não estar no PATH).

## Arquitetura
- Expo Router com menu lateral (drawer) em `src/app/_layout.tsx`: Início, Usuário, Treinos, Evolução.
- Dados: interface `Repositorio` em `src/db/types.ts`, com duas implementações:
  - `src/db/index.ts` — SQLite (celular), migrações em `MIGRACOES` via `PRAGMA user_version`. Nunca editar uma migração existente; sempre adicionar uma nova.
  - `src/db/index.web.ts` — localStorage (web). Deve se comportar igual à versão SQLite.
- Regras de negócio puras em `src/lib/` (ex.: `rodizio.ts`).

## Regras de negócio já decididas
- **Treino do dia = rodízio semanal.** Reinicia toda segunda 00:00 (horário local). Sugere a primeira ficha (por `ordem`) ainda não concluída na semana, mesmo que o usuário treine fora de ordem (fez A e C → sugere B). Só sessões encerradas contam. No futuro o usuário poderá escolher outra ficha no dia, mas a sugestão segue o rodízio.
- **Última carga**: vem da sessão encerrada mais recente em que o exercício foi feito.
- Exercício com séries registradas não pode ser apagado; apagar ficha mantém o histórico de sessões (com o nome da ficha).

## Funcionalidades pedidas (visão geral)
Montar fichas; iniciar/encerrar sessão; registrar séries (carga/reps) com a última carga salva; timer de descanso; cronômetro da sessão; link para vídeo de execução de cada exercício; resumo ao concluir; informações por série.

## Próximos passos / pendências
- Próximo: aba **Treinos** — criar fichas, ordenar o rodízio, adicionar exercícios (vídeo, séries, reps, descanso). Sugestão: fazer em branch `feature/fichas`.
- Botão "Iniciar sessão de treino" ainda só navega para `/treinos` (tela de sessão não existe).
- Perguntar ao usuário: o que a aba Usuário guarda; o que a Evolução mostra; o que sugerir depois de "Semana concluída".
