// Transferir treinos entre aparelhos: as rotinas, os treinos e os exercícios planejados vão para a conta
// e voltam em outro aparelho, junto com o perfil. Os treinos chegam "zerados": histórico, cargas, PRs e
// progresso das metas ficam no aparelho de origem (decisão do usuário).
import { Platform } from 'react-native';

import { repo, type Perfil, type PlanoSeries } from '@/db';
import { escolherAvatar } from '@/lib/avatar-atual';
import { normalizar, obterOuCriarExercicio } from '@/lib/catalogo';

export interface ExercicioCopiado {
  nome: string;
  grupoMuscular: string | null;
  videoUrl: string | null;
  aquecimento: PlanoSeries;
  preparatoria: PlanoSeries;
  validas: PlanoSeries;
  descansoSeg: number;
}

export interface TreinoCopiado {
  nome: string;
  descricao: string | null;
  descanso: boolean;
  exercicios: ExercicioCopiado[];
}

export interface RotinaCopiada {
  nome: string;
  descricao: string | null;
  ativa: boolean;
  treinos: TreinoCopiado[];
}

export const NOME_DO_APARELHO = Platform.OS === 'web' ? 'navegador' : Platform.OS === 'ios' ? 'iPhone' : 'Android';

/** Rotinas deste aparelho, com treinos na ordem do rodízio e exercícios na ordem da ficha. */
export async function copiarTreinosDoAparelho(): Promise<RotinaCopiada[]> {
  const rotinas = await repo.listarRotinas();
  return Promise.all(
    rotinas.map(async (r) => ({
      nome: r.nome,
      descricao: r.descricao,
      ativa: r.ativa,
      treinos: await Promise.all(
        (await repo.listarFichas(r.id)).map(async (f) => ({
          nome: f.nome,
          descricao: f.descricao,
          descanso: f.descanso,
          exercicios: (await repo.listarExerciciosDaFicha(f.id)).map((fe) => ({
            nome: fe.exercicio.nome,
            grupoMuscular: fe.exercicio.grupoMuscular,
            videoUrl: fe.exercicio.videoUrl,
            aquecimento: fe.aquecimento,
            preparatoria: fe.preparatoria,
            validas: fe.validas,
            descansoSeg: fe.descansoSeg,
          })),
        }))
      ),
    }))
  );
}

/**
 * Soma as rotinas copiadas às deste aparelho, sem apagar nada. Rotina com o mesmo nome de uma que já
 * existe aqui é pulada (para não duplicar ao transferir duas vezes).
 */
export async function adicionarTreinosNoAparelho(copia: RotinaCopiada[]) {
  const locais = await repo.listarRotinas();
  const nomesLocais = new Set(locais.map((r) => normalizar(r.nome)));
  const adicionadas: string[] = [];
  const puladas: string[] = [];

  for (const r of copia) {
    if (nomesLocais.has(normalizar(r.nome))) {
      puladas.push(r.nome);
      continue;
    }
    const rotina = await repo.criarRotina({ nome: r.nome, descricao: r.descricao });
    for (const t of r.treinos) {
      const ficha = await repo.criarFicha({ rotinaId: rotina.id, nome: t.nome, descricao: t.descricao, descanso: t.descanso });
      for (const e of t.exercicios) {
        const exercicio = await obterOuCriarExercicio(e.nome, e.grupoMuscular);
        if (!exercicio.videoUrl && e.videoUrl) await repo.atualizarExercicio(exercicio.id, { videoUrl: e.videoUrl });
        await repo.adicionarExercicioNaFicha({
          fichaId: ficha.id,
          exercicioId: exercicio.id,
          aquecimento: e.aquecimento,
          preparatoria: e.preparatoria,
          validas: e.validas,
          descansoSeg: e.descansoSeg,
        });
      }
    }
    // Aparelho sem rotinas: a que era a ativa na conta continua ativa aqui.
    if (locais.length === 0 && r.ativa) await repo.ativarRotina(rotina.id);
    adicionadas.push(r.nome);
  }
  return { adicionadas, puladas };
}

/** Traz o perfil salvo na conta (o que estiver preenchido lá substitui o deste aparelho). */
export async function aplicarPerfilNoAparelho(perfil: Perfil) {
  const { avatar, ...dados } = perfil;
  const preenchidos = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== null && v !== undefined));
  await repo.salvarPerfil(preenchidos);
  if (avatar) await escolherAvatar(avatar);
}
