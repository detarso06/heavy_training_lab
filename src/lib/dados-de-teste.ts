// Gera um histórico de exemplo para testar o app (só em desenvolvimento):
// rotina antiga "ABC", rotina atual "Push Pull Legs", ~2 meses de treinos com carga subindo,
// sequência de 23 dias terminando ontem e progresso de cardio/água.
import { repo, type Id, type Serie, type TipoSerie } from '@/db';
import { dataLocal, periodoDaAgua, periodoDoCardio } from '@/lib/metas';

interface Modelo {
  nome: string;
  grupo: string;
  /** Carga das séries válidas quando o histórico começa a ficar "atual". */
  base: number;
  /** Quanto a carga sobe a cada evolução. */
  passo: number;
  reps: string;
  descanso: number;
  aquecimento?: boolean;
  preparatoria?: boolean;
}

const EXERCICIOS: Record<string, Modelo> = {
  supino: { nome: 'Supino reto com barra', grupo: 'Peito', base: 60, passo: 2.5, reps: '6-10', descanso: 150, aquecimento: true, preparatoria: true },
  supinoInclinado: { nome: 'Supino inclinado com halteres', grupo: 'Peito', base: 22, passo: 2, reps: '8-12', descanso: 120 },
  crucifixo: { nome: 'Voador (peck deck)', grupo: 'Peito', base: 40, passo: 5, reps: '10-15', descanso: 90 },
  desenvolvimento: { nome: 'Desenvolvimento com halteres', grupo: 'Ombros', base: 18, passo: 2, reps: '8-12', descanso: 120, aquecimento: true },
  elevacao: { nome: 'Elevação lateral com halteres', grupo: 'Ombros', base: 8, passo: 1, reps: '12-15', descanso: 60 },
  triceps: { nome: 'Tríceps na polia com corda', grupo: 'Tríceps', base: 25, passo: 2.5, reps: '10-12', descanso: 60 },
  puxada: { nome: 'Puxada frontal aberta', grupo: 'Costas', base: 55, passo: 2.5, reps: '8-12', descanso: 120, aquecimento: true },
  remada: { nome: 'Remada curvada com barra', grupo: 'Costas', base: 50, passo: 2.5, reps: '6-10', descanso: 150, aquecimento: true, preparatoria: true },
  remadaBaixa: { nome: 'Remada baixa com triângulo', grupo: 'Costas', base: 50, passo: 5, reps: '10-12', descanso: 90 },
  facePull: { nome: 'Face pull', grupo: 'Ombros', base: 20, passo: 2.5, reps: '12-15', descanso: 60 },
  rosca: { nome: 'Rosca direta com barra', grupo: 'Bíceps', base: 25, passo: 2.5, reps: '8-12', descanso: 90 },
  martelo: { nome: 'Rosca martelo', grupo: 'Bíceps', base: 12, passo: 1, reps: '10-12', descanso: 60 },
  agachamento: { nome: 'Agachamento livre', grupo: 'Quadríceps', base: 80, passo: 5, reps: '5-8', descanso: 180, aquecimento: true, preparatoria: true },
  legPress: { nome: 'Leg press 45°', grupo: 'Quadríceps', base: 160, passo: 10, reps: '8-12', descanso: 150, aquecimento: true },
  extensora: { nome: 'Cadeira extensora', grupo: 'Quadríceps', base: 45, passo: 5, reps: '10-15', descanso: 90 },
  flexora: { nome: 'Mesa flexora', grupo: 'Posterior e glúteos', base: 40, passo: 5, reps: '10-12', descanso: 90 },
  stiff: { nome: 'Stiff com barra', grupo: 'Posterior e glúteos', base: 60, passo: 5, reps: '8-10', descanso: 120 },
  panturrilha: { nome: 'Panturrilha em pé na máquina', grupo: 'Panturrilhas', base: 60, passo: 5, reps: '12-15', descanso: 60 },
};

const ROTINA_ANTIGA: Record<string, string[]> = {
  'Treino A - Peito e tríceps': ['supino', 'crucifixo', 'triceps'],
  'Treino B - Costas e bíceps': ['puxada', 'remadaBaixa', 'rosca'],
  'Treino C - Pernas e ombros': ['agachamento', 'legPress', 'elevacao'],
};

const ROTINA_ATUAL: Record<string, string[]> = {
  Push: ['supino', 'supinoInclinado', 'crucifixo', 'desenvolvimento', 'elevacao', 'triceps'],
  Pull: ['puxada', 'remada', 'remadaBaixa', 'facePull', 'rosca', 'martelo'],
  Legs: ['agachamento', 'legPress', 'extensora', 'flexora', 'stiff', 'panturrilha'],
};

/** Dias atrás (contando de hoje) em que houve treino em cada rotina. */
function diasDeTreino() {
  const antiga: number[] = [];
  for (let d = 84; d >= 47; d -= d % 2 === 0 ? 2 : 3) antiga.push(d);
  const atual: number[] = [];
  for (let d = 45; d >= 25; d -= 2) atual.push(d); // dia sim, dia não
  for (let d = 23; d >= 1; d--) atual.push(d); // dia 24 sem treino: a sequência começa no 23 e vai até ontem
  return { antiga, atual };
}

const arredondar = (kg: number) => Math.max(0, Math.round(kg * 2) / 2);

function faixa(reps: string): [number, number] {
  const [lo, hi] = reps.split('-').map(Number);
  return [lo, hi ?? lo];
}

function noDia(diasAtras: number, hora: number, minuto: number) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, minuto, 0, 0);
  return d.getTime();
}

export async function preencherComDadosDeTeste() {
  await repo.apagarDadosDeTreino();

  const ids: Record<string, Id> = {};
  for (const [chave, m] of Object.entries(EXERCICIOS)) {
    const e = await repo.criarExercicio({ nome: m.nome, grupoMuscular: m.grupo, videoUrl: null, observacoes: null });
    ids[chave] = e.id;
  }

  const criarRotina = async (nome: string, treinos: Record<string, string[]>) => {
    const rotina = await repo.criarRotina({ nome, descricao: null });
    const fichas: { id: Id; nome: string; exercicios: string[] }[] = [];
    for (const [nomeTreino, exercicios] of Object.entries(treinos)) {
      const ficha = await repo.criarFicha({ rotinaId: rotina.id, nome: nomeTreino, descricao: null });
      for (const chave of exercicios) {
        const m = EXERCICIOS[chave];
        await repo.adicionarExercicioNaFicha({
          fichaId: ficha.id,
          exercicioId: ids[chave],
          aquecimento: { series: m.aquecimento ? 1 : 0, repeticoes: '12' },
          preparatoria: { series: m.preparatoria ? 1 : 0, repeticoes: '4' },
          validas: { series: 3, repeticoes: m.reps },
          descansoSeg: m.descanso,
        });
      }
      fichas.push({ id: ficha.id, nome: nomeTreino, exercicios });
    }
    return { rotina, fichas };
  };

  const antiga = await criarRotina('ABC', ROTINA_ANTIGA);
  const atual = await criarRotina('Push Pull Legs', ROTINA_ATUAL);
  await repo.ativarRotina(atual.rotina.id);

  // Quantas vezes cada exercício já foi feito: a carga sobe a cada 2 vezes.
  const vezes: Record<string, number> = {};
  const dias = diasDeTreino();

  const treinar = async (ficha: { id: Id; nome: string; exercicios: string[] }, diasAtras: number) => {
    const inicio = noDia(diasAtras, 18, (diasAtras % 3) * 20);
    let relogio = inicio + 4 * 60000;
    const series: Omit<Serie, 'id' | 'sessaoId'>[] = [];
    for (const chave of ficha.exercicios) {
      const m = EXERCICIOS[chave];
      const k = vezes[chave] ?? 0;
      vezes[chave] = k + 1;
      // Começa 4 evoluções abaixo da base e sobe; a cada 7 vezes repete a carga (semana mais leve).
      const evolucoes = Math.floor(k / 2) - Math.floor(k / 7);
      const carga = arredondar(m.base + m.passo * (evolucoes - 4));
      const [lo, hi] = faixa(m.reps);
      let numero = 0;
      const registrar = (tipo: TipoSerie, kg: number, reps: number) => {
        relogio += m.descanso * 1000 + 45000;
        series.push({ exercicioId: ids[chave], numero: ++numero, tipo, carga: arredondar(kg), repeticoes: reps, concluidaEm: relogio });
      };
      if (m.aquecimento) registrar('aquecimento', carga * 0.5, 12);
      if (m.preparatoria) registrar('preparatoria', carga * 0.8, 4);
      for (let s = 0; s < 3; s++) registrar('validas', carga, Math.max(lo, hi - (k % 3) - s));
    }
    await repo.importarSessao({ fichaId: ficha.id, nome: ficha.nome, inicio, fim: relogio + 3 * 60000, series });
  };

  for (const [i, d] of dias.antiga.entries()) await treinar(antiga.fichas[i % antiga.fichas.length], d);
  for (const [i, d] of dias.atual.entries()) await treinar(atual.fichas[i % atual.fichas.length], d);

  // Perfil: só completa o que estiver vazio (nome, avatar e medidas do usuário ficam).
  const perfil = await repo.obterPerfil();
  await repo.salvarPerfil({
    idade: perfil.idade ?? 30,
    alturaCm: perfil.alturaCm ?? 178,
    pesoKg: perfil.pesoKg ?? 82,
    cardioAtividade: perfil.cardioAtividade ?? 'Escada',
    metaCardioMin: perfil.metaCardioMin ?? 150,
    metaAguaMl: perfil.metaAguaMl ?? 3000,
  });

  // Metas: semanas anteriores de cardio, últimos 14 dias de água, e um pouco já feito hoje.
  const hoje = new Date();
  const cardioSemanas = [120, 150, 90, 165, 150, 135];
  for (const [i, minutos] of cardioSemanas.entries()) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - 7 * (i + 1));
    await repo.salvarProgresso('cardio', periodoDoCardio(d), minutos);
  }
  await repo.salvarProgresso('cardio', periodoDoCardio(hoje), 40);
  const agua = [2800, 3000, 2500, 3100, 2200, 3000, 2700, 3000, 2600, 2900, 3200, 2400, 3000, 2800];
  for (const [i, ml] of agua.entries()) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (i + 1));
    await repo.salvarProgresso('agua', dataLocal(d), ml);
  }
  await repo.salvarProgresso('agua', periodoDaAgua(hoje), 1200);
}
