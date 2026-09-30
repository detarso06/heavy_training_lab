// Modelos de dados do app. Datas são timestamps em milissegundos (Date.now()).

export type Id = number;

export interface Exercicio {
  id: Id;
  nome: string;
  grupoMuscular: string | null;
  videoUrl: string | null;
  observacoes: string | null;
}

export interface Ficha {
  id: Id;
  nome: string;
  descricao: string | null;
  criadaEm: number;
}

/** Exercício planejado dentro de uma ficha. */
export interface FichaExercicio {
  id: Id;
  fichaId: Id;
  exercicioId: Id;
  ordem: number;
  series: number;
  /** Texto livre para permitir faixas, ex.: "8-12". */
  repeticoes: string;
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
  numero: number;
  carga: number;
  repeticoes: number;
  concluidaEm: number;
}

export type NovoExercicio = Omit<Exercicio, 'id'>;
export type NovaFicha = Pick<Ficha, 'nome' | 'descricao'>;
export type NovoFichaExercicio = Omit<FichaExercicio, 'id' | 'ordem'>;
export type NovaSerie = Omit<Serie, 'id' | 'concluidaEm'>;

/** Operações de dados. Implementada com SQLite (celular) e localStorage (web). */
export interface Repositorio {
  listarExercicios(): Promise<Exercicio[]>;
  criarExercicio(dados: NovoExercicio): Promise<Exercicio>;
  atualizarExercicio(id: Id, dados: Partial<NovoExercicio>): Promise<void>;
  /** Falha se o exercício já tiver séries registradas, para não perder histórico. */
  removerExercicio(id: Id): Promise<void>;

  listarFichas(): Promise<Ficha[]>;
  obterFicha(id: Id): Promise<Ficha | null>;
  criarFicha(dados: NovaFicha): Promise<Ficha>;
  atualizarFicha(id: Id, dados: Partial<NovaFicha>): Promise<void>;
  removerFicha(id: Id): Promise<void>;

  listarExerciciosDaFicha(fichaId: Id): Promise<FichaExercicioDetalhe[]>;
  adicionarExercicioNaFicha(dados: NovoFichaExercicio): Promise<FichaExercicio>;
  atualizarExercicioDaFicha(
    id: Id,
    dados: Partial<Pick<FichaExercicio, 'series' | 'repeticoes' | 'descansoSeg'>>
  ): Promise<void>;
  removerExercicioDaFicha(id: Id): Promise<void>;
  /** Recebe os ids de ficha_exercicios na nova ordem. */
  reordenarFicha(fichaId: Id, idsNaOrdem: Id[]): Promise<void>;

  iniciarSessao(fichaId: Id): Promise<Sessao>;
  encerrarSessao(id: Id): Promise<void>;
  obterSessao(id: Id): Promise<Sessao | null>;
  /** Sessão em andamento (sem fim), se houver. */
  obterSessaoAtiva(): Promise<Sessao | null>;
  listarSessoes(): Promise<Sessao[]>;
  removerSessao(id: Id): Promise<void>;

  registrarSerie(dados: NovaSerie): Promise<Serie>;
  atualizarSerie(id: Id, dados: Partial<Pick<Serie, 'carga' | 'repeticoes'>>): Promise<void>;
  removerSerie(id: Id): Promise<void>;
  listarSeriesDaSessao(sessaoId: Id): Promise<Serie[]>;
  /**
   * Séries do exercício na sessão encerrada mais recente em que ele foi feito.
   * Usado para preencher a carga do último treino.
   */
  ultimasSeriesDoExercicio(exercicioId: Id): Promise<Serie[]>;
}
