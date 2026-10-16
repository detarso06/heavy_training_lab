import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Botao, Cartao } from '@/components/ui';
import { repo, type CardioPlanejado, type Serie, type Sessao } from '@/db';
import { minutosDaSessao } from '@/lib/cardio';
import { clubConfigurado } from '@/lib/club';
import { formatarMinutos } from '@/lib/metas';
import { voltarAoInicio } from '@/lib/navegacao';
import { compararEvolucao, formatarDuracao, formatarKg, resumirSeries, type Evolucao } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

interface ExercicioResumo {
  exercicioId: number;
  nome: string;
  series: Serie[];
  evolucao: Evolucao;
}

interface Dados {
  sessao: Sessao;
  series: Serie[];
  exercicios: ExercicioResumo[];
  /** Plano do dia de cardio, se a sessão foi de cardio. */
  cardio: CardioPlanejado | null;
  /** Cardios feitos dentro do treino. */
  cardiosFeitos: { id: number; nome: string; minutos: number }[];
}

type Comparacao = { texto: string; tom: 'subiu' | 'primeira' | 'igual' | 'caiu' };

function comparar(e: Evolucao): Comparacao {
  if (e.cargaMaxAnterior === null || e.volumeAnterior === null) {
    return { texto: 'Primeira vez! Agora você tem uma marca para bater.', tom: 'primeira' };
  }
  if (e.cargaMax > e.cargaMaxAnterior) {
    return { texto: `+${formatarKg(e.cargaMax - e.cargaMaxAnterior)} na carga máxima`, tom: 'subiu' };
  }
  if (e.volume > e.volumeAnterior && e.volumeAnterior > 0) {
    const pct = Math.round(((e.volume - e.volumeAnterior) / e.volumeAnterior) * 100);
    return { texto: `+${pct}% de volume (peso × reps)`, tom: 'subiu' };
  }
  if (e.cargaMax === e.cargaMaxAnterior && e.volume === e.volumeAnterior) {
    return { texto: 'Igual à última vez', tom: 'igual' };
  }
  return { texto: 'Abaixo da última vez. Faz parte, segue o jogo!', tom: 'caiu' };
}

const ICONE_TOM: Record<Comparacao['tom'], ComponentProps<typeof Ionicons>['name']> = {
  subiu: 'trending-up',
  primeira: 'star',
  igual: 'remove',
  caiu: 'trending-down',
};

export default function TelaResumo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessaoId = Number(id);
  const [dados, setDados] = useState<Dados | null | 'nao-encontrada'>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const sessao = await repo.obterSessao(sessaoId);
      if (!sessao) {
        if (ativo) setDados('nao-encontrada');
        return;
      }
      const [series, exercicios, ficha, cardios] = await Promise.all([
        repo.listarSeriesDaSessao(sessaoId),
        repo.listarExercicios(),
        sessao.fichaId === null ? null : repo.obterFicha(sessao.fichaId),
        repo.listarCardiosDaSessao(sessaoId),
      ]);
      const cardiosFeitos = cardios.map((c) => ({
        id: c.id,
        nome: exercicios.find((e) => e.id === c.exercicioId)?.nome ?? 'Cardio',
        minutos: c.minutos,
      }));
      const ids = [...new Set(series.map((s) => s.exercicioId))];
      const resumo = await Promise.all(
        ids.map(async (exercicioId) => {
          const doExercicio = series.filter((s) => s.exercicioId === exercicioId).sort((a, b) => a.numero - b.numero);
          const anteriores = await repo.ultimasSeriesDoExercicio(exercicioId, sessaoId);
          return {
            exercicioId,
            nome: exercicios.find((e) => e.id === exercicioId)?.nome ?? 'Exercício',
            series: doExercicio,
            evolucao: compararEvolucao(doExercicio, anteriores),
          };
        })
      );
      if (ativo) setDados({ sessao, series, exercicios: resumo, cardio: ficha?.cardio ?? null, cardiosFeitos });
    })();
    return () => {
      ativo = false;
    };
  }, [sessaoId]);

  if (dados === null) return <ActivityIndicator style={styles.carregando} />;
  if (dados === 'nao-encontrada') {
    return (
      <View style={styles.conteudo}>
        <Text style={styles.texto}>Treino não encontrado.</Text>
        <Botao titulo="Voltar ao início" onPress={voltarAoInicio} />
      </View>
    );
  }

  const { sessao, series, exercicios, cardio, cardiosFeitos } = dados;
  const minutosCardiosFeitos = cardiosFeitos.reduce((t, c) => t + c.minutos, 0);
  const minutosCardio = minutosDaSessao(sessao);
  const total = resumirSeries(series);
  const comparacoes = exercicios.map((e) => comparar(e.evolucao));
  const evoluiu = comparacoes.filter((c) => c.tom === 'subiu').length;
  const comHistorico = comparacoes.filter((c) => c.tom !== 'primeira').length;

  return (
    <ScrollView contentContainerStyle={styles.conteudo}>
      <View style={styles.topo}>
        <Image
          source={require('@/../assets/images/avatares/avatar-04.png')}
          style={styles.heavyGuy}
          contentFit="cover"
          accessibilityLabel="Heavy Guy piscando"
        />
        <Text style={styles.parabens}>PARABÉNS!</Text>
        <Text style={styles.subtitulo}>
          Você concluiu <Text style={styles.nomeTreino}>{sessao.nome}</Text>
        </Text>
        {cardio && (
          <Text style={styles.manchete}>
            {minutosCardio >= cardio.minutos ? 'Meta de cardio do dia batida 🔥' : 'Cada minuto conta. Bora!'}
          </Text>
        )}
        {comHistorico > 0 && (
          <Text style={styles.manchete}>
            {evoluiu > 0
              ? `Evoluiu em ${evoluiu} de ${comHistorico} ${comHistorico === 1 ? 'exercício' : 'exercícios'} 🔥`
              : 'Treino feito. Na próxima, bora superar!'}
          </Text>
        )}
      </View>

      {cardio ? (
        <View style={styles.grade}>
          <Numero icone="stopwatch-outline" rotulo="Duração" valor={formatarDuracao((sessao.fim ?? sessao.inicio) - sessao.inicio)} />
          <Numero icone="pulse-outline" rotulo="Atividade" valor={cardio.atividade} />
          <Numero icone="flag-outline" rotulo="Planejado" valor={formatarMinutos(cardio.minutos)} />
          <Numero icone="flame-outline" rotulo="Na meta da semana" valor={`+${formatarMinutos(minutosCardio)}`} />
        </View>
      ) : (
        <View style={styles.grade}>
          <Numero icone="stopwatch-outline" rotulo="Duração" valor={formatarDuracao((sessao.fim ?? sessao.inicio) - sessao.inicio)} />
          <Numero icone="layers-outline" rotulo="Séries" valor={String(total.series)} />
          <Numero icone="repeat" rotulo="Repetições" valor={String(total.repeticoes)} />
          <Numero icone="barbell-outline" rotulo="Peso total" valor={formatarKg(total.volume)} />
        </View>
      )}

      {/* Check-in de cardio ainda não existe no Club (ele mostra séries, reps e peso). */}
      {clubConfigurado && !cardio && (
        <Botao
          titulo="Postar no Club"
          icone="people-outline"
          onPress={() => router.push({ pathname: '/treinos/postar/[id]', params: { id: String(sessao.id) } })}
          style={styles.voltar}
        />
      )}
      <Botao
        titulo="Voltar ao início"
        variante={clubConfigurado && !cardio ? 'secundario' : 'primario'}
        icone="home-outline"
        onPress={voltarAoInicio}
        style={styles.voltar}
      />

      {cardiosFeitos.length > 0 && (
        <>
          <Text style={styles.secao}>Cardio</Text>
          {cardiosFeitos.map((c) => (
            <Cartao key={c.id} style={styles.cartao}>
              <View style={styles.evolucao}>
                <Ionicons name="pulse-outline" size={20} color={CORES.dourado} />
                <Text style={styles.nome}>{c.nome}</Text>
              </View>
              <Text style={styles.detalhe}>{formatarMinutos(c.minutos)}</Text>
            </Cartao>
          ))}
          <View style={styles.evolucao}>
            <Ionicons name="flame-outline" size={18} color={CORES.dourado} />
            <Text style={[styles.textoEvolucao, { color: CORES.dourado }]}>
              +{formatarMinutos(minutosCardiosFeitos)} na meta de cardio da semana
            </Text>
          </View>
        </>
      )}

      {!cardio && exercicios.length > 0 && <Text style={styles.secao}>Exercícios</Text>}
      {exercicios.map((e, i) => {
        const r = resumirSeries(e.series);
        const c = comparacoes[i];
        const cor = c.tom === 'subiu' || c.tom === 'primeira' ? CORES.dourado : CORES.textoSuave;
        return (
          <Cartao key={e.exercicioId} style={styles.cartao}>
            <Text style={styles.nome}>{e.nome}</Text>
            <Text style={styles.detalhe}>
              {r.series} {r.series === 1 ? 'série' : 'séries'} · {r.repeticoes} reps · {formatarKg(r.volume)}
            </Text>
            <Text style={styles.series}>
              {e.series.map((s) => `${s.carga.toLocaleString('pt-BR')}×${s.repeticoes}`).join('   ')}
            </Text>
            <View style={styles.evolucao}>
              <Ionicons name={ICONE_TOM[c.tom]} size={18} color={cor} />
              <Text style={[styles.textoEvolucao, { color: cor }]}>{c.texto}</Text>
            </View>
          </Cartao>
        );
      })}
    </ScrollView>
  );
}

function Numero({
  icone,
  rotulo,
  valor,
}: {
  icone: ComponentProps<typeof Ionicons>['name'];
  rotulo: string;
  valor: string;
}) {
  return (
    <Cartao style={styles.numero}>
      <Ionicons name={icone} size={20} color={CORES.dourado} />
      <Text style={styles.valorNumero} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={styles.rotuloNumero}>{rotulo}</Text>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  carregando: { marginTop: 40 },
  conteudo: { padding: 16, gap: 12, paddingBottom: 40 },
  texto: { color: CORES.texto, fontSize: 16 },
  topo: { alignItems: 'center', gap: 6, marginVertical: 8 },
  heavyGuy: { width: 168, height: 168, borderRadius: 84, borderWidth: 4, borderColor: CORES.dourado },
  parabens: { color: CORES.vermelho, fontSize: 40, fontWeight: '900', letterSpacing: 3, marginTop: 8 },
  subtitulo: { color: CORES.textoSuave, fontSize: 16, textAlign: 'center' },
  nomeTreino: { color: CORES.texto, fontWeight: '800' },
  manchete: { color: CORES.dourado, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  numero: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 16 },
  valorNumero: { color: CORES.texto, fontSize: 24, fontWeight: '900' },
  rotuloNumero: { color: CORES.textoSuave, fontSize: 13, fontWeight: '600' },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700', marginTop: 8 },
  cartao: { gap: 4 },
  nome: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 14 },
  series: { color: CORES.texto, fontSize: 14, fontVariant: ['tabular-nums'] },
  evolucao: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  textoEvolucao: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  voltar: { marginTop: 8, paddingVertical: 16 },
});
