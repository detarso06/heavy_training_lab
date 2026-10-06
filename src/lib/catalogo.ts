// Catálogo próprio de exercícios, em português, por grupo muscular.
// Se nenhum servir, o usuário cria um exercício com o nome que quiser.
import { repo, type Exercicio } from '@/db';

export interface GrupoCatalogo {
  nome: string;
  exercicios: string[];
}

export const CATALOGO: GrupoCatalogo[] = [
  {
    nome: 'Peito',
    exercicios: [
      'Supino reto com barra',
      'Supino reto com halteres',
      'Supino inclinado com barra',
      'Supino inclinado com halteres',
      'Supino declinado com barra',
      'Supino declinado com halteres',
      'Supino reto no Smith',
      'Supino inclinado no Smith',
      'Supino na máquina',
      'Supino inclinado na máquina',
      'Crucifixo reto com halteres',
      'Crucifixo inclinado com halteres',
      'Voador (peck deck)',
      'Crossover polia alta',
      'Crossover polia média',
      'Crossover polia baixa',
      'Flexão de braço',
      'Flexão de braço inclinada',
      'Mergulho nas paralelas',
      'Pullover com halter',
    ],
  },
  {
    nome: 'Costas',
    exercicios: [
      'Puxada frontal aberta',
      'Puxada frontal com triângulo',
      'Puxada supinada',
      'Puxada alta unilateral',
      'Barra fixa pronada',
      'Barra fixa supinada',
      'Remada curvada com barra',
      'Remada curvada supinada',
      'Remada unilateral com halter (serrote)',
      'Remada baixa com triângulo',
      'Remada baixa pegada aberta',
      'Remada cavalinho',
      'Remada na máquina',
      'Remada articulada',
      'Pulldown com corda',
      'Pullover na polia',
      'Levantamento terra',
      'Rack pull',
      'Hiperextensão lombar',
      'Encolhimento com barra',
    ],
  },
  {
    nome: 'Ombros',
    exercicios: [
      'Desenvolvimento com barra',
      'Desenvolvimento com halteres',
      'Desenvolvimento na máquina',
      'Desenvolvimento no Smith',
      'Desenvolvimento Arnold',
      'Desenvolvimento militar em pé',
      'Elevação lateral com halteres',
      'Elevação lateral no cabo',
      'Elevação lateral na máquina',
      'Elevação lateral inclinada',
      'Elevação frontal com halteres',
      'Elevação frontal com barra',
      'Elevação frontal com anilha',
      'Elevação em Y',
      'Crucifixo inverso com halteres',
      'Crucifixo inverso na máquina',
      'Face pull',
      'Remada alta com barra',
      'Remada alta no cabo',
      'Encolhimento com halteres',
    ],
  },
  {
    nome: 'Bíceps',
    exercicios: [
      'Rosca direta com barra',
      'Rosca direta com barra W',
      'Rosca alternada com halteres',
      'Rosca simultânea com halteres',
      'Rosca martelo',
      'Rosca martelo na corda',
      'Rosca martelo cruzada',
      'Rosca concentrada',
      'Rosca Scott com barra',
      'Rosca Scott com halter',
      'Rosca Scott na máquina',
      'Rosca na polia baixa',
      'Rosca inclinada com halteres',
      'Rosca 21',
      'Rosca spider',
      'Rosca inversa',
      'Rosca Zottman',
      'Rosca bayesiana no cabo',
      'Rosca na máquina',
      'Rosca na polia alta',
    ],
  },
  {
    nome: 'Tríceps',
    exercicios: [
      'Tríceps na polia com barra',
      'Tríceps na polia com corda',
      'Tríceps na polia com barra V',
      'Tríceps unilateral na polia',
      'Tríceps invertido na polia',
      'Tríceps cruzado na polia',
      'Tríceps testa com barra W',
      'Tríceps testa com halteres',
      'Tríceps testa na polia',
      'Tríceps francês com halter',
      'Tríceps francês na polia',
      'Extensão de tríceps com barra acima da cabeça',
      'Tríceps coice com halter',
      'Tríceps coice na polia',
      'Tríceps na máquina',
      'Mergulho no banco',
      'Paralelas para tríceps',
      'Mergulho na máquina',
      'Supino fechado',
      'Flexão diamante',
    ],
  },
  {
    nome: 'Quadríceps',
    exercicios: [
      'Agachamento livre',
      'Agachamento no Smith',
      'Agachamento frontal',
      'Agachamento hack',
      'Agachamento búlgaro',
      'Agachamento sumô',
      'Agachamento goblet',
      'Agachamento pêndulo',
      'Agachamento com cinto (belt squat)',
      'Agachamento com salto',
      'Leg press 45°',
      'Leg press horizontal',
      'Leg press unilateral',
      'Cadeira extensora',
      'Cadeira extensora unilateral',
      'Afundo com halteres',
      'Afundo no Smith',
      'Passada',
      'Subida no banco',
      'Sissy squat',
    ],
  },
  {
    nome: 'Posterior e glúteos',
    exercicios: [
      'Mesa flexora',
      'Cadeira flexora',
      'Flexora em pé unilateral',
      'Stiff com barra',
      'Stiff com halteres',
      'Levantamento terra romeno',
      'Levantamento terra sumô',
      'Bom dia',
      'Flexão nórdica',
      'Elevação pélvica com barra',
      'Elevação pélvica na máquina',
      'Ponte de glúteo',
      'Glúteo na polia',
      'Glúteo na máquina',
      'Hiperextensão para glúteos',
      'Cadeira abdutora',
      'Abdução no cabo',
      'Abdução com elástico',
      'Cadeira adutora',
      'Kettlebell swing',
    ],
  },
  {
    nome: 'Panturrilhas',
    exercicios: [
      'Panturrilha em pé na máquina',
      'Panturrilha sentado',
      'Panturrilha no leg press',
      'Panturrilha no Smith',
      'Panturrilha no hack',
      'Panturrilha unilateral com halter',
      'Panturrilha no degrau',
      'Panturrilha burrinho',
      'Panturrilha em pé com barra',
      'Elevação de dedos (tibial)',
    ],
  },
  {
    nome: 'Abdômen',
    exercicios: [
      'Abdominal supra',
      'Abdominal infra',
      'Abdominal na máquina',
      'Abdominal na polia',
      'Abdominal remador',
      'Abdominal bicicleta',
      'Abdominal oblíquo',
      'Abdominal declinado',
      'Abdominal canivete',
      'Abdominal tesoura',
      'Abdominal com rodinha',
      'Abdominal na bola suíça',
      'Prancha',
      'Prancha lateral',
      'Elevação de pernas deitado',
      'Elevação de pernas na barra fixa',
      'Elevação de joelhos nas paralelas',
      'Rotação russa',
      'Dead bug',
      'Pallof press',
    ],
  },
];

export const GRUPOS = CATALOGO.map((g) => g.nome);

/** Minúsculas e sem acentos, para "supino" achar "Supíno" e vice-versa. */
export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Todas as palavras do termo precisam aparecer no nome (em qualquer ordem). */
export function combina(termo: string, nome: string) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  const alvo = normalizar(nome);
  return palavras.every((p) => alvo.includes(p));
}

/** Nomes do catálogo (normalizados), para separar os exercícios criados pelo usuário. */
export const NOMES_DO_CATALOGO = new Set(CATALOGO.flatMap((g) => g.exercicios.map(normalizar)));

/** Exercício salvo com esse nome, criando-o na primeira vez em que é usado. */
export async function obterOuCriarExercicio(nome: string, grupoMuscular: string | null): Promise<Exercicio> {
  const existentes = await repo.listarExercicios();
  const igual = existentes.find((e) => normalizar(e.nome) === normalizar(nome));
  if (igual) return igual;
  return repo.criarExercicio({ nome: nome.trim(), grupoMuscular, videoUrl: null, observacoes: null });
}
