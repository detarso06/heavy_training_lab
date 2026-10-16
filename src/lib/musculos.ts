// Músculos do mapa do corpo e quanto cada exercício do catálogo trabalha cada um.
// Contagem fracionada: 1 série para o músculo principal e 0,5 para os auxiliares
// (ex.: supino reto = peito 1, tríceps 0,5, ombros 0,5).
import type { Exercicio } from '@/db';
import { normalizar } from '@/lib/catalogo';

export type Musculo =
  | 'peito'
  | 'ombros'
  | 'trapezio'
  | 'costas'
  | 'lombar'
  | 'biceps'
  | 'triceps'
  | 'antebraco'
  | 'abdomen'
  | 'obliquos'
  | 'quadriceps'
  | 'posterior'
  | 'gluteos'
  | 'adutores'
  | 'panturrilhas'
  | 'tibial';

/** Na ordem do corpo, de cima para baixo. */
export const MUSCULOS: Musculo[] = [
  'peito',
  'ombros',
  'trapezio',
  'costas',
  'lombar',
  'biceps',
  'triceps',
  'antebraco',
  'abdomen',
  'obliquos',
  'quadriceps',
  'posterior',
  'gluteos',
  'adutores',
  'panturrilhas',
  'tibial',
];

export const NOME_MUSCULO: Record<Musculo, string> = {
  peito: 'Peito',
  ombros: 'Ombros',
  trapezio: 'Trapézio',
  costas: 'Costas',
  lombar: 'Lombar',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebraco: 'Antebraço',
  abdomen: 'Abdômen',
  obliquos: 'Oblíquos',
  quadriceps: 'Quadríceps',
  posterior: 'Posterior de coxa',
  gluteos: 'Glúteos',
  adutores: 'Adutores',
  panturrilhas: 'Panturrilhas',
  tibial: 'Tibial',
};

/** Áreas para filtrar o relatório. */
export type Area = 'peito' | 'costas' | 'ombros' | 'bracos' | 'pernas' | 'core';

export const AREAS: { area: Area; nome: string; musculos: Musculo[] }[] = [
  { area: 'peito', nome: 'Peito', musculos: ['peito'] },
  { area: 'costas', nome: 'Costas', musculos: ['costas', 'trapezio', 'lombar'] },
  { area: 'ombros', nome: 'Ombros', musculos: ['ombros'] },
  { area: 'bracos', nome: 'Braços', musculos: ['biceps', 'triceps', 'antebraco'] },
  {
    area: 'pernas',
    nome: 'Pernas',
    musculos: ['quadriceps', 'posterior', 'gluteos', 'adutores', 'panturrilhas', 'tibial'],
  },
  { area: 'core', nome: 'Core', musculos: ['abdomen', 'obliquos'] },
];

export const AREA_DO_MUSCULO = Object.fromEntries(
  AREAS.flatMap((a) => a.musculos.map((m) => [m, a.area]))
) as Record<Musculo, Area>;

export type Trabalho = Partial<Record<Musculo, number>>;

const SUPINO: Trabalho = { peito: 1, triceps: 0.5, ombros: 0.5 };
/** Crucifixos e crossovers: o deltoide anterior ajuda a fechar os braços. */
const CRUCIFIXO: Trabalho = { peito: 1, ombros: 0.5 };
/** Flexões: o abdômen segura o corpo em prancha. */
const FLEXAO: Trabalho = { ...SUPINO, abdomen: 0.5 };
/** Puxar de cima: bíceps dobra o cotovelo e o antebraço segura a pegada. */
const PUXADA: Trabalho = { costas: 1, biceps: 0.5, antebraco: 0.5 };
/** Remar: além de bíceps e pegada, trapézio e deltoide posterior puxam as escápulas e os braços para trás. */
const REMADA: Trabalho = { costas: 1, biceps: 0.5, antebraco: 0.5, trapezio: 0.5, ombros: 0.5 };
/** Braço estendido (pulldown com corda, pullover na polia): a cabeça longa do tríceps estende o ombro junto. */
const BRACO_ESTENDIDO: Trabalho = { costas: 1, triceps: 0.5 };
/** Empurrar acima da cabeça: o trapézio superior gira as escápulas. */
const DESENVOLVIMENTO: Trabalho = { ombros: 1, triceps: 0.5, trapezio: 0.5 };
const ELEVACAO_LATERAL: Trabalho = { ombros: 1, trapezio: 0.5 };
const ELEVACAO_FRONTAL: Trabalho = { ombros: 1, peito: 0.5 };
const CRUCIFIXO_INVERSO: Trabalho = { ombros: 1, trapezio: 0.5, costas: 0.5 };
const REMADA_ALTA: Trabalho = { ombros: 1, trapezio: 1, biceps: 0.5, antebraco: 0.5 };
const ENCOLHIMENTO: Trabalho = { trapezio: 1, antebraco: 0.5 };
/** Roscas: o antebraço (braquiorradial e flexores) sempre ajuda. */
const ROSCA: Trabalho = { biceps: 1, antebraco: 0.5 };
/** Pegada neutra ou pronada: o braquiorradial vira alvo junto com o bíceps. */
const ROSCA_MARTELO: Trabalho = { biceps: 1, antebraco: 1 };
const TRICEPS: Trabalho = { triceps: 1 };
const MERGULHO_TRICEPS: Trabalho = { triceps: 1, peito: 0.5, ombros: 0.5 };
/** Agachamentos e leg press: glúteos e adutores estendem o quadril junto. */
const AGACHAMENTO: Trabalho = { quadriceps: 1, gluteos: 0.5, adutores: 0.5 };
/** Agachamento com barra livre: a lombar segura o tronco. */
const AGACHAMENTO_LIVRE: Trabalho = { ...AGACHAMENTO, lombar: 0.5 };
/** Flexoras: a panturrilha (gastrocnêmio) também dobra o joelho. */
const FLEXORA: Trabalho = { posterior: 1, panturrilhas: 0.5 };
/** Stiff, terra romeno: lombar segura o tronco e o antebraço segura a carga. */
const STIFF: Trabalho = { posterior: 1, gluteos: 0.5, lombar: 0.5, antebraco: 0.5 };
const GLUTEO: Trabalho = { gluteos: 1, posterior: 0.5 };
const PANTURRILHA: Trabalho = { panturrilhas: 1 };
/** Abdominais de flexão do tronco: os oblíquos ajudam. */
const ABDOMINAL: Trabalho = { abdomen: 1, obliquos: 0.5 };
const OBLIQUO: Trabalho = { obliquos: 1, abdomen: 0.5 };

/** Exercícios do catálogo (mesmos nomes de `CATALOGO`). */
const DO_CATALOGO: Record<string, Trabalho> = {
  // Peito
  'Supino reto com barra': SUPINO,
  'Supino reto com halteres': SUPINO,
  'Supino inclinado com barra': SUPINO,
  'Supino inclinado com halteres': SUPINO,
  'Supino declinado com barra': SUPINO,
  'Supino declinado com halteres': SUPINO,
  'Supino reto no Smith': SUPINO,
  'Supino inclinado no Smith': SUPINO,
  'Supino na máquina': SUPINO,
  'Supino inclinado na máquina': SUPINO,
  'Crucifixo reto com halteres': CRUCIFIXO,
  'Crucifixo inclinado com halteres': CRUCIFIXO,
  'Voador (peck deck)': CRUCIFIXO,
  'Crossover polia alta': CRUCIFIXO,
  'Crossover polia média': CRUCIFIXO,
  'Crossover polia baixa': CRUCIFIXO,
  'Flexão de braço': FLEXAO,
  'Flexão de braço inclinada': FLEXAO,
  'Mergulho nas paralelas': SUPINO,
  'Pullover com halter': { peito: 1, costas: 0.5, triceps: 0.5 },

  // Costas
  'Puxada frontal aberta': PUXADA,
  'Puxada frontal com triângulo': PUXADA,
  'Puxada supinada': PUXADA,
  'Puxada alta unilateral': PUXADA,
  'Barra fixa pronada': PUXADA,
  'Barra fixa supinada': PUXADA,
  'Remada curvada com barra': { ...REMADA, lombar: 0.5 },
  'Remada curvada supinada': { ...REMADA, lombar: 0.5 },
  'Remada unilateral com halter (serrote)': REMADA,
  'Remada baixa com triângulo': REMADA,
  'Remada baixa pegada aberta': REMADA,
  'Remada cavalinho': REMADA,
  'Remada na máquina': REMADA,
  'Remada articulada': REMADA,
  'Pulldown com corda': BRACO_ESTENDIDO,
  'Pullover na polia': BRACO_ESTENDIDO,
  'Levantamento terra': {
    lombar: 1,
    gluteos: 1,
    posterior: 0.5,
    quadriceps: 0.5,
    costas: 0.5,
    trapezio: 0.5,
    antebraco: 0.5,
  },
  'Rack pull': { lombar: 1, trapezio: 1, gluteos: 0.5, costas: 0.5, antebraco: 0.5 },
  'Hiperextensão lombar': { lombar: 1, gluteos: 0.5, posterior: 0.5 },
  'Encolhimento com barra': ENCOLHIMENTO,

  // Ombros
  'Desenvolvimento com barra': DESENVOLVIMENTO,
  'Desenvolvimento com halteres': DESENVOLVIMENTO,
  'Desenvolvimento na máquina': DESENVOLVIMENTO,
  'Desenvolvimento no Smith': DESENVOLVIMENTO,
  'Desenvolvimento Arnold': DESENVOLVIMENTO,
  'Desenvolvimento militar em pé': { ...DESENVOLVIMENTO, abdomen: 0.5 },
  'Elevação lateral com halteres': ELEVACAO_LATERAL,
  'Elevação lateral no cabo': ELEVACAO_LATERAL,
  'Elevação lateral na máquina': ELEVACAO_LATERAL,
  'Elevação lateral inclinada': ELEVACAO_LATERAL,
  'Elevação frontal com halteres': ELEVACAO_FRONTAL,
  'Elevação frontal com barra': ELEVACAO_FRONTAL,
  'Elevação frontal com anilha': ELEVACAO_FRONTAL,
  'Elevação em Y': ELEVACAO_LATERAL,
  'Crucifixo inverso com halteres': CRUCIFIXO_INVERSO,
  'Crucifixo inverso na máquina': CRUCIFIXO_INVERSO,
  'Face pull': CRUCIFIXO_INVERSO,
  'Remada alta com barra': REMADA_ALTA,
  'Remada alta no cabo': REMADA_ALTA,
  'Encolhimento com halteres': ENCOLHIMENTO,

  // Bíceps
  'Rosca direta com barra': ROSCA,
  'Rosca direta com barra W': ROSCA,
  'Rosca alternada com halteres': ROSCA,
  'Rosca simultânea com halteres': ROSCA,
  'Rosca martelo': ROSCA_MARTELO,
  'Rosca martelo na corda': ROSCA_MARTELO,
  'Rosca martelo cruzada': ROSCA_MARTELO,
  'Rosca concentrada': ROSCA,
  'Rosca Scott com barra': ROSCA,
  'Rosca Scott com halter': ROSCA,
  'Rosca Scott na máquina': ROSCA,
  'Rosca na polia baixa': ROSCA,
  'Rosca inclinada com halteres': ROSCA,
  'Rosca 21': ROSCA,
  'Rosca spider': ROSCA,
  'Rosca inversa': { antebraco: 1, biceps: 0.5 },
  'Rosca Zottman': ROSCA_MARTELO,
  'Rosca bayesiana no cabo': ROSCA,
  'Rosca na máquina': ROSCA,
  'Rosca na polia alta': ROSCA,

  // Tríceps
  'Tríceps na polia com barra': TRICEPS,
  'Tríceps na polia com corda': TRICEPS,
  'Tríceps na polia com barra V': TRICEPS,
  'Tríceps unilateral na polia': TRICEPS,
  'Tríceps invertido na polia': TRICEPS,
  'Tríceps cruzado na polia': TRICEPS,
  'Tríceps testa com barra W': TRICEPS,
  'Tríceps testa com halteres': TRICEPS,
  'Tríceps testa na polia': TRICEPS,
  'Tríceps francês com halter': TRICEPS,
  'Tríceps francês na polia': TRICEPS,
  'Extensão de tríceps com barra acima da cabeça': TRICEPS,
  'Tríceps coice com halter': TRICEPS,
  'Tríceps coice na polia': TRICEPS,
  'Tríceps na máquina': TRICEPS,
  'Mergulho no banco': MERGULHO_TRICEPS,
  'Paralelas para tríceps': MERGULHO_TRICEPS,
  'Mergulho na máquina': MERGULHO_TRICEPS,
  'Supino fechado': MERGULHO_TRICEPS,
  'Flexão diamante': { ...MERGULHO_TRICEPS, abdomen: 0.5 },

  // Quadríceps
  'Agachamento livre': AGACHAMENTO_LIVRE,
  'Agachamento no Smith': AGACHAMENTO,
  'Agachamento frontal': { ...AGACHAMENTO_LIVRE, abdomen: 0.5 },
  'Agachamento hack': AGACHAMENTO,
  'Agachamento búlgaro': AGACHAMENTO,
  'Agachamento sumô': { quadriceps: 1, adutores: 1, gluteos: 0.5 },
  'Agachamento goblet': { ...AGACHAMENTO, abdomen: 0.5 },
  'Agachamento pêndulo': AGACHAMENTO,
  'Agachamento com cinto (belt squat)': AGACHAMENTO,
  'Agachamento com salto': { ...AGACHAMENTO, panturrilhas: 0.5 },
  'Leg press 45°': AGACHAMENTO,
  'Leg press horizontal': AGACHAMENTO,
  'Leg press unilateral': AGACHAMENTO,
  'Cadeira extensora': { quadriceps: 1 },
  'Cadeira extensora unilateral': { quadriceps: 1 },
  'Afundo com halteres': AGACHAMENTO,
  'Afundo no Smith': AGACHAMENTO,
  Passada: AGACHAMENTO,
  'Subida no banco': AGACHAMENTO,
  'Sissy squat': { quadriceps: 1 },

  // Posterior e glúteos
  'Mesa flexora': FLEXORA,
  'Cadeira flexora': FLEXORA,
  'Flexora em pé unilateral': FLEXORA,
  'Stiff com barra': STIFF,
  'Stiff com halteres': STIFF,
  'Levantamento terra romeno': STIFF,
  'Levantamento terra sumô': {
    gluteos: 1,
    posterior: 0.5,
    quadriceps: 0.5,
    adutores: 0.5,
    lombar: 0.5,
    trapezio: 0.5,
    antebraco: 0.5,
  },
  'Bom dia': { posterior: 1, gluteos: 0.5, lombar: 0.5 },
  'Flexão nórdica': FLEXORA,
  'Elevação pélvica com barra': GLUTEO,
  'Elevação pélvica na máquina': GLUTEO,
  'Ponte de glúteo': GLUTEO,
  'Glúteo na polia': GLUTEO,
  'Glúteo na máquina': GLUTEO,
  'Hiperextensão para glúteos': { gluteos: 1, posterior: 0.5, lombar: 0.5 },
  // O desenho não separa o glúteo médio (abdutores), então a abdução conta para os glúteos.
  'Cadeira abdutora': { gluteos: 1 },
  'Abdução no cabo': { gluteos: 1 },
  'Abdução com elástico': { gluteos: 1 },
  'Cadeira adutora': { adutores: 1 },
  'Kettlebell swing': { gluteos: 1, posterior: 0.5, lombar: 0.5, antebraco: 0.5 },

  // Panturrilhas
  'Panturrilha em pé na máquina': PANTURRILHA,
  'Panturrilha sentado': PANTURRILHA,
  'Panturrilha no leg press': PANTURRILHA,
  'Panturrilha no Smith': PANTURRILHA,
  'Panturrilha no hack': PANTURRILHA,
  'Panturrilha unilateral com halter': { panturrilhas: 1, antebraco: 0.5 },
  'Panturrilha no degrau': PANTURRILHA,
  'Panturrilha burrinho': PANTURRILHA,
  'Panturrilha em pé com barra': PANTURRILHA,
  'Elevação de dedos (tibial)': { tibial: 1 },

  // Abdômen
  'Abdominal supra': ABDOMINAL,
  'Abdominal infra': ABDOMINAL,
  'Abdominal na máquina': ABDOMINAL,
  'Abdominal na polia': ABDOMINAL,
  'Abdominal remador': ABDOMINAL,
  'Abdominal bicicleta': { abdomen: 1, obliquos: 1 },
  'Abdominal oblíquo': OBLIQUO,
  'Abdominal declinado': ABDOMINAL,
  'Abdominal canivete': ABDOMINAL,
  'Abdominal tesoura': ABDOMINAL,
  'Abdominal com rodinha': { ...ABDOMINAL, costas: 0.5 },
  'Abdominal na bola suíça': ABDOMINAL,
  Prancha: { ...ABDOMINAL, ombros: 0.5 },
  'Prancha lateral': OBLIQUO,
  'Elevação de pernas deitado': ABDOMINAL,
  'Elevação de pernas na barra fixa': { ...ABDOMINAL, antebraco: 0.5 },
  'Elevação de joelhos nas paralelas': ABDOMINAL,
  'Rotação russa': OBLIQUO,
  'Dead bug': ABDOMINAL,
  'Pallof press': OBLIQUO,
};

const POR_NOME = new Map(Object.entries(DO_CATALOGO).map(([nome, t]) => [normalizar(nome), t]));

/** Exercício criado pelo usuário: conta 1 série para o(s) músculo(s) do grupo escolhido. */
const POR_GRUPO: Record<string, Trabalho> = {
  Peito: { peito: 1 },
  Costas: { costas: 1 },
  Ombros: { ombros: 1 },
  Bíceps: { biceps: 1 },
  Tríceps: { triceps: 1 },
  Quadríceps: { quadriceps: 1 },
  'Posterior e glúteos': { posterior: 1, gluteos: 1 },
  Panturrilhas: { panturrilhas: 1 },
  Abdômen: { abdomen: 1 },
};

/** Quanto uma série válida do exercício conta para cada músculo; nulo se não dá para saber. */
export function trabalhoDoExercicio(exercicio: Pick<Exercicio, 'nome' | 'grupoMuscular'>): Trabalho | null {
  return (
    POR_NOME.get(normalizar(exercicio.nome)) ??
    (exercicio.grupoMuscular ? POR_GRUPO[exercicio.grupoMuscular] : undefined) ??
    null
  );
}

// Divisões: em alguns músculos a escolha do exercício muda a parte mais trabalhada (ex.: supino
// inclinado foca o peito superior). Mesmo esquema da contagem: 1 para a região principal e 0,5 para as
// auxiliares; na hora de contar, as séries do músculo são repartidas nessa proporção.

export type Regiao =
  | 'peito-superior'
  | 'peito-medio'
  | 'peito-inferior'
  | 'ombro-anterior'
  | 'ombro-lateral'
  | 'ombro-posterior'
  | 'costas-dorsal'
  | 'costas-meio'
  | 'triceps-longa'
  | 'triceps-lateral';

/** `nome` aparece dentro do cartão do músculo; `completo`, sozinho (ex.: no aviso de foco). */
export const DIVISOES: { musculo: Musculo; regioes: { regiao: Regiao; nome: string; completo: string }[] }[] = [
  {
    musculo: 'peito',
    regioes: [
      { regiao: 'peito-superior', nome: 'Superior', completo: 'Peito superior' },
      { regiao: 'peito-medio', nome: 'Médio', completo: 'Peito médio' },
      { regiao: 'peito-inferior', nome: 'Inferior', completo: 'Peito inferior' },
    ],
  },
  {
    musculo: 'ombros',
    regioes: [
      { regiao: 'ombro-anterior', nome: 'Anterior', completo: 'Deltoide anterior' },
      { regiao: 'ombro-lateral', nome: 'Lateral', completo: 'Deltoide lateral' },
      { regiao: 'ombro-posterior', nome: 'Posterior', completo: 'Deltoide posterior' },
    ],
  },
  {
    musculo: 'costas',
    regioes: [
      { regiao: 'costas-dorsal', nome: 'Dorsal (largura)', completo: 'Dorsal (largura das costas)' },
      { regiao: 'costas-meio', nome: 'Meio (espessura)', completo: 'Meio das costas (espessura)' },
    ],
  },
  {
    musculo: 'triceps',
    regioes: [
      { regiao: 'triceps-longa', nome: 'Cabeça longa', completo: 'Cabeça longa do tríceps' },
      { regiao: 'triceps-lateral', nome: 'Lateral e medial', completo: 'Cabeças lateral e medial do tríceps' },
    ],
  },
];

/**
 * Movimento que treina cada região. Num treino só de empurrar não faz sentido cobrar deltoide posterior
 * (vem das remadas, no dia de puxar), e vice-versa.
 */
export type Familia = 'empurrar' | 'puxar';

export const FAMILIA_DA_REGIAO: Record<Regiao, Familia> = {
  'peito-superior': 'empurrar',
  'peito-medio': 'empurrar',
  'peito-inferior': 'empurrar',
  'ombro-anterior': 'empurrar',
  'ombro-lateral': 'empurrar',
  'ombro-posterior': 'puxar',
  'costas-dorsal': 'puxar',
  'costas-meio': 'puxar',
  'triceps-longa': 'empurrar',
  'triceps-lateral': 'empurrar',
};

export const MUSCULO_DA_REGIAO = Object.fromEntries(
  DIVISOES.flatMap((d) => d.regioes.map((r) => [r.regiao, d.musculo]))
) as Record<Regiao, Musculo>;

type Foco = Partial<Record<Regiao, number>>;

const PEITO_MEDIO: Foco = { 'peito-medio': 1, 'peito-superior': 0.5, 'peito-inferior': 0.5 };
const PEITO_SUPERIOR: Foco = { 'peito-superior': 1, 'peito-medio': 0.5 };
const PEITO_INFERIOR: Foco = { 'peito-inferior': 1, 'peito-medio': 0.5 };
const ANTERIOR: Foco = { 'ombro-anterior': 1 };
const LATERAL: Foco = { 'ombro-lateral': 1 };
const POSTERIOR: Foco = { 'ombro-posterior': 1 };
const DORSAL: Foco = { 'costas-dorsal': 1, 'costas-meio': 0.5 };
const MEIO: Foco = { 'costas-meio': 1, 'costas-dorsal': 0.5 };
const TRICEPS_LONGA: Foco = { 'triceps-longa': 1 };
const TRICEPS_TESTA: Foco = { 'triceps-longa': 1, 'triceps-lateral': 0.5 };
const TRICEPS_POLIA: Foco = { 'triceps-lateral': 1, 'triceps-longa': 0.5 };
/** Empurrar composto (supino, flexão, mergulho): o tríceps trabalha mais pelas cabeças lateral e medial. */
const TRICEPS_COMPOSTO: Foco = { 'triceps-lateral': 1 };

/** Exercícios do catálogo que trabalham algum músculo com divisões. */
const REGIOES_DO_CATALOGO: Record<string, Foco> = {
  // Peito
  'Supino reto com barra': { ...PEITO_MEDIO, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino reto com halteres': { ...PEITO_MEDIO, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino inclinado com barra': { ...PEITO_SUPERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino inclinado com halteres': { ...PEITO_SUPERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino declinado com barra': { ...PEITO_INFERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino declinado com halteres': { ...PEITO_INFERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino reto no Smith': { ...PEITO_MEDIO, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino inclinado no Smith': { ...PEITO_SUPERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino na máquina': { ...PEITO_MEDIO, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Supino inclinado na máquina': { ...PEITO_SUPERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Crucifixo reto com halteres': { 'peito-medio': 1, ...ANTERIOR },
  'Crucifixo inclinado com halteres': { 'peito-superior': 1, ...ANTERIOR },
  'Voador (peck deck)': { 'peito-medio': 1, ...ANTERIOR },
  // O cabo vem de cima para baixo na polia alta (inferior) e de baixo para cima na baixa (superior).
  'Crossover polia alta': { ...PEITO_INFERIOR, ...ANTERIOR },
  'Crossover polia média': { 'peito-medio': 1, ...ANTERIOR },
  'Crossover polia baixa': { ...PEITO_SUPERIOR, ...ANTERIOR },
  'Flexão de braço': { ...PEITO_MEDIO, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Flexão de braço inclinada': { ...PEITO_INFERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Mergulho nas paralelas': { ...PEITO_INFERIOR, ...ANTERIOR, ...TRICEPS_COMPOSTO },
  'Pullover com halter': { 'peito-medio': 1, 'costas-dorsal': 1, ...TRICEPS_LONGA },

  // Costas
  'Puxada frontal aberta': DORSAL,
  'Puxada frontal com triângulo': DORSAL,
  'Puxada supinada': DORSAL,
  'Puxada alta unilateral': DORSAL,
  'Barra fixa pronada': DORSAL,
  'Barra fixa supinada': DORSAL,
  'Remada curvada com barra': { ...MEIO, ...POSTERIOR },
  'Remada curvada supinada': { ...MEIO, ...POSTERIOR },
  'Remada unilateral com halter (serrote)': { ...DORSAL, ...POSTERIOR },
  'Remada baixa com triângulo': { ...MEIO, ...POSTERIOR },
  'Remada baixa pegada aberta': { ...MEIO, ...POSTERIOR },
  'Remada cavalinho': { ...MEIO, ...POSTERIOR },
  'Remada na máquina': { ...MEIO, ...POSTERIOR },
  'Remada articulada': { ...MEIO, ...POSTERIOR },
  'Pulldown com corda': { 'costas-dorsal': 1, ...TRICEPS_LONGA },
  'Pullover na polia': { 'costas-dorsal': 1, ...TRICEPS_LONGA },
  'Rack pull': { 'costas-meio': 1 },

  // Ombros
  'Desenvolvimento com barra': { 'ombro-anterior': 1, 'ombro-lateral': 0.5, ...TRICEPS_COMPOSTO },
  'Desenvolvimento com halteres': { 'ombro-anterior': 1, 'ombro-lateral': 0.5, ...TRICEPS_COMPOSTO },
  'Desenvolvimento na máquina': { 'ombro-anterior': 1, 'ombro-lateral': 0.5, ...TRICEPS_COMPOSTO },
  'Desenvolvimento no Smith': { 'ombro-anterior': 1, 'ombro-lateral': 0.5, ...TRICEPS_COMPOSTO },
  'Desenvolvimento Arnold': { 'ombro-anterior': 1, 'ombro-lateral': 0.5, ...TRICEPS_COMPOSTO },
  'Desenvolvimento militar em pé': { 'ombro-anterior': 1, 'ombro-lateral': 0.5, ...TRICEPS_COMPOSTO },
  'Elevação lateral com halteres': LATERAL,
  'Elevação lateral no cabo': LATERAL,
  'Elevação lateral na máquina': LATERAL,
  'Elevação lateral inclinada': LATERAL,
  'Elevação frontal com halteres': { ...ANTERIOR, 'peito-superior': 1 },
  'Elevação frontal com barra': { ...ANTERIOR, 'peito-superior': 1 },
  'Elevação frontal com anilha': { ...ANTERIOR, 'peito-superior': 1 },
  'Elevação em Y': { 'ombro-lateral': 1, 'ombro-posterior': 0.5 },
  'Crucifixo inverso com halteres': { ...POSTERIOR, 'costas-meio': 1 },
  'Crucifixo inverso na máquina': { ...POSTERIOR, 'costas-meio': 1 },
  'Face pull': { ...POSTERIOR, 'costas-meio': 1 },
  'Remada alta com barra': LATERAL,
  'Remada alta no cabo': LATERAL,

  // Tríceps
  'Tríceps na polia com barra': TRICEPS_POLIA,
  'Tríceps na polia com corda': TRICEPS_POLIA,
  'Tríceps na polia com barra V': TRICEPS_POLIA,
  'Tríceps unilateral na polia': TRICEPS_POLIA,
  'Tríceps invertido na polia': TRICEPS_POLIA,
  'Tríceps cruzado na polia': TRICEPS_POLIA,
  'Tríceps testa com barra W': TRICEPS_TESTA,
  'Tríceps testa com halteres': TRICEPS_TESTA,
  'Tríceps testa na polia': TRICEPS_TESTA,
  'Tríceps francês com halter': TRICEPS_LONGA,
  'Tríceps francês na polia': TRICEPS_LONGA,
  'Extensão de tríceps com barra acima da cabeça': TRICEPS_LONGA,
  'Tríceps coice com halter': TRICEPS_POLIA,
  'Tríceps coice na polia': TRICEPS_POLIA,
  'Tríceps na máquina': TRICEPS_POLIA,
  'Mergulho no banco': { ...TRICEPS_COMPOSTO, ...PEITO_INFERIOR, ...ANTERIOR },
  'Paralelas para tríceps': { ...TRICEPS_COMPOSTO, ...PEITO_INFERIOR, ...ANTERIOR },
  'Mergulho na máquina': { ...TRICEPS_COMPOSTO, ...PEITO_INFERIOR, ...ANTERIOR },
  'Supino fechado': { ...TRICEPS_COMPOSTO, 'peito-medio': 1, ...ANTERIOR },
  'Flexão diamante': { ...TRICEPS_COMPOSTO, 'peito-medio': 1, ...ANTERIOR },

  // Exercícios de outras áreas que ajudam um músculo com divisões
  'Levantamento terra': { 'costas-meio': 1 },
  'Abdominal com rodinha': { 'costas-dorsal': 1 },
  Prancha: ANTERIOR,
};

const REGIOES_POR_NOME = new Map(Object.entries(REGIOES_DO_CATALOGO).map(([nome, f]) => [normalizar(nome), f]));

/**
 * Séries que uma série válida do exercício dá para cada região. As séries do músculo são repartidas
 * entre as regiões na proporção dos pesos, então as regiões somam o mesmo que o músculo
 * (supino reto: peito 1 = médio 0,5 + superior 0,25 + inferior 0,25).
 * Exercício personalizado não tem região (não dá para saber o ângulo).
 */
export function regioesDoExercicio(exercicio: Pick<Exercicio, 'nome' | 'grupoMuscular'>): Foco {
  const foco = REGIOES_POR_NOME.get(normalizar(exercicio.nome));
  const trabalho = trabalhoDoExercicio(exercicio);
  if (!foco || !trabalho) return {};
  const pesos = Object.entries(foco) as [Regiao, number][];
  const resultado: Foco = {};
  for (const [regiao, peso] of pesos) {
    const musculo = MUSCULO_DA_REGIAO[regiao];
    const doMusculo = trabalho[musculo] ?? 0;
    const somaNoMusculo = pesos.filter(([r]) => MUSCULO_DA_REGIAO[r] === musculo).reduce((t, [, p]) => t + p, 0);
    if (doMusculo > 0) resultado[regiao] = (peso / somaNoMusculo) * doMusculo;
  }
  return resultado;
}

/**
 * Exercícios do catálogo que têm a região como foco principal e o músculo como alvo principal. Os mais
 * isolados vêm primeiro (ex.: tríceps francês antes do testa para a cabeça longa).
 */
export function exerciciosParaRegiao(regiao: Regiao, limite = 3): string[] {
  const musculo = MUSCULO_DA_REGIAO[regiao];
  /** Parte do trabalho no músculo que cai na região (1 = só ela). */
  const pureza = (foco: Foco) => {
    const doMusculo = (Object.entries(foco) as [Regiao, number][]).filter(([r]) => MUSCULO_DA_REGIAO[r] === musculo);
    return foco[regiao]! / doMusculo.reduce((t, [, peso]) => t + peso, 0);
  };
  return Object.entries(REGIOES_DO_CATALOGO)
    .filter(([nome, foco]) => foco[regiao] === 1 && DO_CATALOGO[nome]?.[musculo] === 1)
    .sort(([, a], [, b]) => pureza(b) - pureza(a))
    .slice(0, limite)
    .map(([nome]) => nome);
}

/**
 * Famílias de movimento do exercício: as das regiões que ele tem como foco principal (peso 1).
 * Supino = empurrar; remada e crucifixo inverso = puxar; rosca e exercícios de perna = nenhuma.
 */
export function familiasDoExercicio(exercicio: Pick<Exercicio, 'nome'>): Familia[] {
  const foco = REGIOES_POR_NOME.get(normalizar(exercicio.nome)) ?? {};
  const principais = (Object.entries(foco) as [Regiao, number][]).filter(([, peso]) => peso === 1);
  return [...new Set(principais.map(([regiao]) => FAMILIA_DA_REGIAO[regiao]))];
}

/** Sugestões quando o músculo inteiro precisa de foco: exercícios do catálogo escolhidos a dedo. */
const SUGESTOES: Record<Musculo, string[]> = {
  peito: ['Supino reto com halteres', 'Supino inclinado com halteres', 'Crossover polia média'],
  ombros: ['Desenvolvimento com halteres', 'Elevação lateral com halteres', 'Crucifixo inverso na máquina'],
  trapezio: ['Encolhimento com halteres', 'Encolhimento com barra', 'Face pull'],
  costas: ['Puxada frontal aberta', 'Remada baixa com triângulo', 'Remada unilateral com halter (serrote)'],
  lombar: ['Hiperextensão lombar', 'Levantamento terra', 'Bom dia'],
  biceps: ['Rosca direta com barra', 'Rosca inclinada com halteres', 'Rosca Scott com halter'],
  triceps: ['Tríceps na polia com corda', 'Tríceps francês com halter', 'Tríceps testa com barra W'],
  antebraco: ['Rosca inversa', 'Rosca martelo', 'Rosca Zottman'],
  abdomen: ['Abdominal na polia', 'Elevação de pernas na barra fixa', 'Abdominal com rodinha'],
  obliquos: ['Pallof press', 'Prancha lateral', 'Rotação russa'],
  quadriceps: ['Agachamento livre', 'Leg press 45°', 'Cadeira extensora'],
  posterior: ['Stiff com barra', 'Mesa flexora', 'Cadeira flexora'],
  gluteos: ['Elevação pélvica com barra', 'Agachamento búlgaro', 'Cadeira abdutora'],
  adutores: ['Cadeira adutora', 'Agachamento sumô'],
  panturrilhas: ['Panturrilha em pé na máquina', 'Panturrilha sentado'],
  tibial: ['Elevação de dedos (tibial)'],
};

export function exerciciosParaMusculo(musculo: Musculo): string[] {
  return SUGESTOES[musculo];
}
