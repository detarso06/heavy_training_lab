@AGENTS.md

# Heavy Training Lab

App pessoal de treino (por enquanto só o dono usa). Comunicação com o usuário em **português**.
Antigo "App Treino": o repositório no GitHub e a pasta local ainda se chamam `app-treino`, e as chaves de armazenamento (`app-treino:v1`, `treino.db`) foram mantidas para não perder dados.

## Identidade visual
- Mascote **Heavy Guy** (rosto de gorro, suando, com raios dourados). O ícone, o splash e `assets/images/mascote.png` vêm do rosto; os originais estão em `C:\Users\pauli\Downloads` (versão atual do rosto: "Grito Retrô Sob o Gorro.png"; pôsteres "Heavy Guy").
- **Avatar do perfil**: 13 opções em `src/lib/avatares.ts` ("Clássico" = `mascote.png`, padrão, + 12 expressões recortadas da folha de figurinhas, original em Downloads "WhatsApp Image 2026-10-05 at 19.05.15.jpeg", em `assets/images/avatares/`). Escolha salva em `perfil.avatar`; `useAvatarAtual` mantém cabeçalho e aba Usuário sincronizados.
- App sempre escuro. Paleta em `src/lib/tema.ts`: preto, **vermelho** (ação principal), **dourado** (destaques, contadores, botões secundários) e branco creme (texto). Use `CORES`, nunca cores soltas.
- Confirmações (apagar/remover) usam a janela do próprio app, `useConfirmacao` em `src/components/dialogo-confirmacao.tsx`, mostrando o nome do item em destaque. Não usar `Alert`/`window.confirm`.

## Como rodamos
- Desenvolvimento no navegador: `npx expo start --web --port 8081` → http://localhost:8081, com o DevTools em modo dispositivo (dimensões de iPhone). O usuário tem iPhone; teste real será pelo Expo Go.
- Antes de concluir uma tarefa: `npx tsc --noEmit` e `npx expo lint`.
- **Dados de teste**: em modo de desenvolvimento (`__DEV__`), o fim da aba Usuário tem "Preencher com dados de teste" (`src/lib/dados-de-teste.ts`). Apaga rotinas/treinos/histórico e cria 2 rotinas, ~53 treinos em 2 meses com carga subindo e sequência de 23 dias terminando ontem; mantém perfil e catálogo.
- **Publicação (web app)**: `npm run publicar` exporta a versão web (`dist/`) e publica no EAS Hosting (endereço `heavy-training-lab.expo.app`). Precisa de `npx eas-cli@latest login` na conta Expo do usuário. `public/index.html` + `public/manifest.json` + ícones em `public/` fazem o "Adicionar à Tela de Início" funcionar como app. Cada pessoa guarda o próprio histórico no navegador (sem servidor ainda).
- GitHub: https://github.com/detarso06/app-treino (privado, branch `main`). A conta também pertence à organização da empresa do usuário — nunca criar nem alterar nada fora de `detarso06/app-treino`.
- O `gh` fica em `C:\Program Files\GitHub CLI\gh.exe` (pode não estar no PATH).

## Arquitetura
- Expo Router com menu lateral (drawer) em `src/app/_layout.tsx`: Início, Treinos, Evolução, Heavy Club e, fixo no rodapé do menu, **Configurações** (rota `/usuario`, antiga aba Usuário). Treinos e Evolução têm pilha própria (`_layout.tsx` com `BotaoMenu`).
- Dados: interface `Repositorio` em `src/db/types.ts`, com duas implementações:
  - `src/db/index.ts` — SQLite (celular), migrações em `MIGRACOES` via `PRAGMA user_version`. Nunca editar uma migração existente; sempre adicionar uma nova.
  - `src/db/index.web.ts` — localStorage (web). Deve se comportar igual à versão SQLite.
- Regras de negócio puras em `src/lib/` (ex.: `rodizio.ts`).

## Regras de negócio já decididas
- **Rotina → Treino → Exercícios.** O usuário cria rotinas (ex.: "ABC") e, dentro delas, treinos. No código o treino se chama `Ficha`. Só uma rotina fica ativa; a primeira criada já nasce ativa e o rodízio usa os treinos dela.
- **Séries planejadas por tipo**: aquecimento, preparatória e válidas, cada uma com quantidade e repetições (texto livre, ex.: "8-12"), mais descanso por exercício.
- **Catálogo de exercícios**: lista própria em português em `src/lib/catalogo.ts` (9 grupos, ~20 exercícios cada; Panturrilhas tem 10). Sem API: a wger foi abandonada porque os nomes vinham em inglês (sobrou só a coluna `wger_id` sem uso no SQLite). O exercício só é gravado em `exercicios` quando usado num treino (`obterOuCriarExercicio`, sem duplicar pelo nome). Se nenhum servir, o usuário cria um com o nome que quiser ("Personalizado").
- **Treino do dia = rodízio semanal.** Reinicia toda segunda 00:00 (horário local). Sugere a primeira ficha (por `ordem`) ainda não concluída na semana, mesmo que o usuário treine fora de ordem (fez A e C → sugere B). Só sessões encerradas contam. No Início, "Trocar treino" deixa escolher outro treino da rotina para hoje (só para o próximo início de sessão; não é salvo); a sugestão continua seguindo o rodízio.
- **Dia de descanso**: item do rodízio como os treinos (`Ficha.descanso`, botão "Adicionar dia de descanso" na rotina; reordenável, sem exercícios). Quando é a vez dele, o Início mostra "Dia de descanso" e o botão "Descansei hoje", que grava uma sessão já concluída e sem séries: conta como feito na semana e **+1 na sequência**. Depois de marcar: "Treinar mesmo assim" (próximo treino) e "Desfazer descanso". Não aparece na Evolução; no "Trocar treino" só aparece um descanso (o próximo pendente).
- **Sessão de treino** (`src/app/treinos/sessao/[id].tsx`, regras em `src/lib/sessao.ts`): iniciada pelo botão do Início após confirmação (se já houver sessão aberta, o botão vira "Continuar treino"). Mostra **um exercício por vez** (setas ‹ › e "Exercício N de M"; abre no primeiro com série pendente; ao completar um, aparece "Próximo: …"). Cada série planejada vira uma linha com peso e reps editáveis e um ✓ que grava a `Serie` (com `tipo`); tocar de novo no ✓ desfaz; editar uma série já confirmada salva ao sair do campo. Confirmar uma série inicia o timer de descanso do exercício (pausar, reiniciar, +15s, pular). Finalizar exige pelo menos 1 série; com séries pendentes pede confirmação. "Descartar treino" apaga a sessão.
- **Resumo** (`src/app/treinos/resumo/[id].tsx`): Heavy Guy piscando (avatar-04), duração, séries, repetições, peso total (Σ carga × reps, todas as séries) e evolução por exercício vs. a última sessão em que ele foi feito, olhando as séries válidas: primeiro carga máxima, depois volume.
- **Evolução** (`src/app/evolucao/`, regras em `src/lib/evolucao.ts`): filtro de rotina (padrão = a ativa; mostra todas as que o usuário já teve) → lista de treinos → um gráfico de linha por exercício com a **carga máxima das séries válidas** de cada sessão concluída daquele treino (`react-native-svg`). Tocar num ponto mostra a data e cada série válida; "Ver todos os treinos" abre a tabela. Sessões cujo treino foi apagado não aparecem.
- **Última carga**: vem da sessão encerrada mais recente em que o exercício foi feito; na sessão, cada linha é pré-preenchida com a mesma série (mesmo tipo e posição) da última vez, e as reps caem para o primeiro número do alvo planejado.
- Exercício com séries registradas não pode ser apagado; apagar ficha mantém o histórico de sessões (com o nome da ficha).
- **Perfil (Configurações)**: nome, idade, altura, peso atual e as metas — cardio semanal (atividade + minutos) e água diária (ml). O Heavy Guy no canto do cabeçalho do Início abre essa aba.
- **Sequência (painel Início)**: dias seguidos do calendário com pelo menos uma sessão **concluída** (`src/lib/sequencia.ts`). Se hoje ainda não teve treino, a sequência de ontem vale até o fim do dia; um dia inteiro sem treino zera. Decisão: dias do calendário, não 24h corridas (pedido original falava em "24 horas"). Níveis em `nivelDaSequencia`: 0 Frio 🧊, 1+ Aquecendo 🔥, 3+ Pegando fogo 🔥🔥, 7+ Em chamas 🔥🔥🔥, 14+ Imparável ☄️, 30+ Lendário 🌋.
  - Futuro: cada nível terá uma imagem própria do Heavy Guy, e ao zerar a sequência ele volta à imagem inicial.
- **Metas no painel Início**: o usuário arrasta uma barra (`BarraArrastavel`) de 0 até a meta para dizer quanto já fez. O valor é absoluto, não soma. Cardio vale por semana (período = segunda-feira, como o rodízio) e água por dia; cada período fica salvo em `progresso_metas` (histórico para a Evolução).

## Heavy Training Club (comunidade, branch `feature/club`)
- Servidor: **Supabase** (login, Postgres com RLS, fotos no Storage). Banco em `supabase/`: `schema.sql` e depois os arquivos numerados (`002_…`, `003_…`) em ordem, no SQL Editor. Nunca editar um arquivo já aplicado; sempre criar o próximo número. Projeto `heavy-training-club` (ref `sftsxnvztzfjuxqlwrxx`, São Paulo). Cuidado ao revogar EXECUTE de `public`: o papel `supabase_auth_admin` precisa executar o trigger `criar_perfil`. Configuração em `.env.local` (modelo em `.env.example`); sem ela o app funciona e o Club aparece como "não configurado".
- Decisão: **os treinos continuam no aparelho**. O app só publica o social: perfil (nome, avatar, código, privacidade e o "retrato": sequência, rotina atual, PRs escolhidos) e check-ins. Sincronizar o histórico completo fica para depois.
- **Só amigos**: cada perfil tem um **código de amizade** de 6 caracteres. O amigo digita o código ("Adicionar amigo"), a outra pessoa aceita ou recusa. Se os dois se pedirem, vira amizade direto. Ninguém lê perfis de não amigos (pedidos usam as funções `enviar_pedido`/`listar_pedidos`).
- **Privacidade** (Club → Privacidade): check-ins/fotos, sequência, rotina atual e o PR de cada exercício, um a um. O que está desligado nem sai do aparelho (e o RLS confere de novo no servidor).
- **PR** = maior carga numa série válida (empate: mais reps). `src/lib/prs.ts`. PR do dia no check-in = passou do recorde anterior; a primeira vez num exercício não conta.
- **Check-in**: no resumo do treino, "Postar no Heavy Training Club" (foto opcional reduzida para 1080 px JPEG, legenda, números do dia e PRs). Fotos em bucket privado, exibidas por link temporário.
- **Feed**: fim do Início (`FeedClub`), check-ins dos amigos e os seus. Deslogado: convite para entrar.
- Login por e-mail e senha; um e-mail = uma conta. Confirmação de e-mail desligada. Senhas só existem como hash no Supabase (ninguém, nem o dono do projeto, consegue ver).
- **Uma conta só**: a conta do Club é a conta do app (opcional). O mesmo formulário (`FormularioConta`) aparece no Club, no Perfil e em Configurações → Minha conta.
- **Transferir para outro aparelho** (Configurações → Minha conta): "Salvar treinos e perfil na conta" guarda uma cópia (`treinos_salvos`: rotinas, treinos, exercícios planejados e o perfil do app); no outro aparelho, "Trazer para este aparelho" **soma** as rotinas (pula as que já existem com o mesmo nome) e atualiza o perfil. Decisão do usuário: os treinos chegam **zerados** (histórico, cargas, PRs e progresso das metas ficam no aparelho de origem). `src/lib/transferir-treinos.ts`.
- **Esqueci minha senha**: código de 6 dígitos por e-mail (vale 15 min) → senha nova, sem link/deep link (`pedirCodigoDeSenha`/`redefinirSenha`). **Pendente e escondido** (`RECUPERAR_SENHA_LIGADO = false` em `src/components/formulario-conta.tsx`): falta o SMTP próprio (decidido: Gmail com senha de app). O e-mail padrão do Supabase só envia para a equipe do projeto e, no plano grátis, não deixa trocar o modelo; o modelo em português está em `supabase/emails/recuperar-senha.html` para aplicar junto com o SMTP.
- **Excluir conta** (Configurações → Conta): apaga as fotos (Storage), a conta do Club (`apagar_minha_conta`, leva perfil/amizades/PRs/check-ins) e todos os dados do aparelho (treinos, histórico, metas, perfil, avatar). Duas confirmações. Primeiro a nuvem: se falhar, o aparelho fica intacto.
- Privacidade das fotos: o bucket é privado entre usuários, mas o dono do projeto ainda consegue abri-las pelo painel. Deixar inacessível até para o dono = criptografia de ponta a ponta (projeto futuro, ainda não decidido).
- **Sininho** (cabeçalho do Início, ao lado do Heavy Guy): bolinha = pedidos de amizade esperando resposta + check-ins de amigos ainda não vistos (`perfis.notificacoes_vistas_em`, vale em qualquer aparelho). Tela `src/app/notificacoes.tsx` (fora do menu, com voltar): aceitar/recusar pedido ali mesmo; tocar num treino abre o perfil do amigo; abrir a tela marca tudo como visto. Atualiza a cada 30 s (sem push no celular por enquanto).
- Futuro: comentários, curtidas, bloquear/denunciar (exigido pela App Store para conteúdo de usuários).
- Código: `src/lib/supabase.ts` (cliente), `src/lib/club.ts` (API), telas em `src/app/club/` e `src/app/treinos/postar/[id].tsx`.

## Funcionalidades pedidas (visão geral)
Montar fichas; iniciar/encerrar sessão; registrar séries (carga/reps) com a última carga salva; timer de descanso; cronômetro da sessão; link para vídeo de execução de cada exercício; resumo ao concluir; informações por série.

## Próximos passos / pendências
- Aba **Treinos** feita na branch `feature/fichas` (rotinas, treinos, seletor do catálogo, séries por tipo, vídeo).
- Futuro: enviar um treino para outro usuário copiar (modo "personal").
- Perguntar ao usuário: o que sugerir depois de "Semana concluída".
