// Modelos de dados do app. Datas são timestamps em milissegundos (Date.now()).
//
// Hierarquia: Rotina → Ficha (chamada de "treino" na interface) → exercícios planejados.
// Só uma rotina fica ativa por vez; o rodízio semanal usa as fichas dela.

export type Id = number;

export interface Exercicio {
  id: Id;
  nome: string;
  grupoMuscular: string | null;
  videoUrl: string | null;
  observacoes: string | null;
}

export interface Rotina {
  id: Id;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  criadaEm: number;
}

export interface Ficha {
  id: Id;
  rotinaId: Id;
  nome: string;
  descricao: string | null;
  /** Posição no rodízio semanal dentro da rotina (0 = primeira). */
  ordem: number;
  criadaEm: number;
}

export type TipoSerie = 'aquecimento' | 'preparatoria' | 'validas';

export interface PlanoSeries {
  series: number;
  /** Texto livre para permitir faixas, ex.: "8-12". */
  repeticoes: string;
}

/** Exercício planejado dentro de uma ficha. */
export interface FichaExercicio {
  id: Id;
  fichaId: Id;
  exercicioId: Id;
  ordem: number;
  aquecimento: PlanoSeries;
  preparatoria: PlanoSeries;
  validas: PlanoSeries;
  descansoSeg: number;
}

export interface FichaExercicioDetalhe extends FichaExercicio {
  exercicio: Exercicio;
}

export interface Sessao {
  id: Id;
  /** Nulo se a ficha foi apagada depois. */
  fichaId: Id | null;
  /** Nome da ficha no momento do treino, para o histórico. */
  nome: string;
  inicio: number;
  /** Nulo enquanto a sessão está em andamento. */
  fim: number | null;
}

/** Série efetivamente executada durante uma sessão. */
export interface Serie {
  id: Id;
  sessaoId: Id;
  exercicioId: Id;
  /** Posição da série dentro do exercício no treino (1, 2, 3...), contando todos os tipos. */
  numero: number;
  tipo: TipoSerie;
  carga: number;
  repeticoes: number;
  concluidaEm: number;
}

/** Dados do usuário (registro único). Campos nulos = ainda não preenchidos. */
export interface Perfil {
  nome: string | null;
  idade: number | null;
  alturaCm: number | null;
  pesoKg: number | null;
  /** Atividade de cardio da meta, ex.: "Escada". */
  cardioAtividade: string | null;
  metaCardioMin: number | null;
  metaAguaMl: number | null;
  /** Id do rosto do Heavy Guy escolhido (ver src/lib/avatares.ts). */
  avatar: string | null;
}

/** Cardio é acumulado por semana; água, por dia. */
export type TipoMeta = 'cardio' | 'agua';

export type NovoExercicio = Omit<Exercicio, 'id'>;
export type NovaRotina = Pick<Rotina, 'nome' | 'descricao'>;
export type NovaFicha = Pick<Ficha, 'rotinaId' | 'nome' | 'descricao'>;
export type NovoFichaExercicio = Omit<FichaExercicio, 'id' | 'ordem'>;
export type NovaSerie = Omit<Serie, 'id' | 'concluidaEm'>;

/** Operações de dados. Implementada com SQLite (celular) e localStorage (web). */
export interface Repositorio {
  listarExercicios(): Promise<Exercicio[]>;
  criarExercicio(dados: NovoExercicio): Promise<Exercicio>;
  atualizarExercicio(id: Id, dados: Partial<NovoExercicio>): Promise<void>;
  /** Falha se o exercício já tiver séries registradas, para não perder histórico. */
  removerExercicio(id: Id): Promise<void>;

  /** Mais antigas primeiro. */
  listarRotinas(): Promise<Rotina[]>;
  obterRotina(id: Id): Promise<Rotina | null>;
  obterRotinaAtiva(): Promise<Rotina | null>;
  /** A primeira rotina criada já nasce ativa. */
  criarRotina(dados: NovaRotina): Promise<Rotina>;
  atualizarRotina(id: Id, dados: Partial<NovaRotina>): Promise<void>;
  /** Desativa as demais. */
  ativarRotina(id: Id): Promise<void>;
  /** Apaga as fichas dela; o histórico de sessões continua. Se era a ativa, ativa outra. */
  removerRotina(id: Id): Promise<void>;

  /** Fichas da rotina na ordem do rodízio. */
  listarFichas(rotinaId: Id): Promise<Ficha[]>;
  obterFicha(id: Id): Promise<Ficha | null>;
  criarFicha(dados: NovaFicha): Promise<Ficha>;
  atualizarFicha(id: Id, dados: Partial<Pick<Ficha, 'nome' | 'descricao'>>): Promise<void>;
  removerFicha(id: Id): Promise<void>;
  /** Recebe os ids das fichas na nova ordem do rodízio. */
  reordenarFichas(idsNaOrdem: Id[]): Promise<void>;

  listarExerciciosDaFicha(fichaId: Id): Promise<FichaExercicioDetalhe[]>;
  adicionarExercicioNaFicha(dados: NovoFichaExercicio): Promise<FichaExercicio>;
  atualizarExercicioDaFicha(
    id: Id,
    dados: Partial<Pick<FichaExercicio, TipoSerie | 'descansoSeg'>>
  ): Promise<void>;
  removerExercicioDaFicha(id: Id): Promise<void>;
  /** Recebe os ids de ficha_exercicios na nova ordem. */
  reordenarFicha(fichaId: Id, idsNaOrdem: Id[]): Promise<void>;

  iniciarSessao(fichaId: Id): Promise<Sessao>;
  encerrarSessao(id: Id): Promise<void>;
  obterSessao(id: Id): Promise<Sessao | null>;
  /** Sessão em andamento (sem fim), se houver. */
  obterSessaoAtiva(): Promise<Sessao | null>;
  /** Mais recentes primeiro. `desde` filtra por início >= timestamp. */
  listarSessoes(desde?: number): Promise<Sessao[]>;
  removerSessao(id: Id): Promise<void>;

  registrarSerie(dados: NovaSerie): Promise<Serie>;
  atualizarSerie(id: Id, dados: Partial<Pick<Serie, 'carga' | 'repeticoes'>>): Promise<void>;
  removerSerie(id: Id): Promise<void>;
  listarSeriesDaSessao(sessaoId: Id): Promise<Serie[]>;
  /**
   * Séries do exercício na sessão encerrada mais recente em que ele foi feito.
   * Usado para preencher a carga do último treino e comparar a evolução no resumo
   * (`ignorarSessaoId` deixa de fora a sessão que acabou de terminar).
   */
  ultimasSeriesDoExercicio(exercicioId: Id, ignorarSessaoId?: Id): Promise<Serie[]>;


  /** Grava uma sessão já concluída, com data no passado (dados de teste, importação). */
  importarSessao(dados: {
    fichaId: Id | null;
    nome: string;
    inicio: number;
    fim: number;
    series: Omit<Serie, 'id' | 'sessaoId'>[];
  }): Promise<Sessao>;
  /** Apaga exercícios, rotinas, treinos, sessões, séries e progresso das metas. Mantém o perfil. */
  apagarDadosDeTreino(): Promise<void>;

  obterPerfil(): Promise<Perfil>;
  salvarPerfil(dados: Partial<Perfil>): Promise<void>;
  /**
   * Quanto já foi feito da meta no período (cardio em minutos, água em ml).
   * `periodo` é a data "AAAA-MM-DD" da segunda-feira (cardio) ou do dia (água); 0 se nada registrado.
   */
  obterProgresso(tipo: TipoMeta, periodo: string): Promise<number>;
  salvarProgresso(tipo: TipoMeta, periodo: string, valor: number): Promise<void>;
}
