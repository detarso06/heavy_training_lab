import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BotaoIcone, Cartao } from '@/components/ui';
import { obterAvatar } from '@/lib/avatares';
import type { Checkin } from '@/lib/club';
import { formatarDuracao, formatarKg } from '@/lib/sessao';
import { CORES } from '@/lib/tema';

/** "agora", "há 5 min", "há 3 h", "ontem", "12/10". */
export function quandoFoi(iso: string, agora = Date.now()) {
  const ms = agora - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return 'ontem';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function AvatarClub({ avatar, tamanho = 40 }: { avatar: string | null; tamanho?: number }) {
  return (
    <Image
      source={obterAvatar(avatar).imagem}
      style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderWidth: 2, borderColor: CORES.dourado }}
      contentFit="cover"
    />
  );
}

/** `de`: tela de onde o post foi aberto, para o "voltar" levar de volta para lá. */
export function abrirCheckin(id: string, de?: string) {
  router.push({ pathname: '/club/checkin/[id]', params: de ? { id, de } : { id } });
}

/** "Hoje", "Ontem" ou "sábado, 10/10" (com o ano, se não for o atual). */
export function tituloDoDia(iso: string, agora = new Date()) {
  const data = new Date(iso);
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (data.toDateString() === agora.toDateString()) return 'Hoje';
  if (data.toDateString() === ontem.toDateString()) return 'Ontem';
  const semana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dia = data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(data.getFullYear() === agora.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `${semana}, ${dia}`;
}

/** Lista de check-ins separada por dia (mais recentes primeiro, como vêm do servidor). */
export function CheckinsPorDia({
  checkins,
  renderizar,
}: {
  checkins: Checkin[];
  renderizar: (checkin: Checkin) => ReactNode;
}) {
  const grupos: { dia: string; itens: Checkin[] }[] = [];
  for (const c of checkins) {
    const dia = new Date(c.criadoEm).toDateString();
    const grupo = grupos.at(-1);
    if (grupo?.dia === dia) grupo.itens.push(c);
    else grupos.push({ dia, itens: [c] });
  }
  return grupos.map((g) => (
    <Fragment key={g.dia}>
      <Text style={styles.tituloDia} accessibilityRole="header">
        {tituloDoDia(g.itens[0].criadoEm)}
      </Text>
      {g.itens.map(renderizar)}
    </Fragment>
  ));
}

/**
 * Post de treino concluído: autor, foto, números do dia e PRs batidos. `onApagar` só nos posts do próprio usuário.
 * Com `comentarios` (feed, perfis), o cartão abre o post com os comentários ao ser tocado.
 */
export function CartaoCheckin({
  checkin,
  urlFoto,
  onApagar,
  comentarios,
}: {
  checkin: Checkin;
  urlFoto?: string;
  onApagar?: () => void;
  comentarios?: number;
}) {
  const pathname = usePathname();
  const cartao = (pressionado = false) => (
    <Cartao style={[styles.cartao, { opacity: pressionado ? 0.8 : 1 }]}>
      <View style={styles.autor}>
        <AvatarClub avatar={checkin.autor.avatar} />
        <View style={styles.flex}>
          <Text style={styles.nome}>{checkin.autor.nome}</Text>
          <Text style={styles.detalhe}>
            {checkin.treino} · {quandoFoi(checkin.criadoEm)}
          </Text>
        </View>
        {onApagar && <BotaoIcone icone="trash-outline" rotulo="Apagar check-in" cor={CORES.vermelho} onPress={onApagar} />}
      </View>

      {checkin.foto && (
        <View style={styles.moldura}>
          {urlFoto ? (
            <Image source={{ uri: urlFoto }} style={styles.foto} contentFit="cover" accessibilityLabel="Foto do treino" />
          ) : (
            <View style={styles.foto} />
          )}
        </View>
      )}

      {!!checkin.legenda && <Text style={styles.legenda}>{checkin.legenda}</Text>}

      <View style={styles.numeros}>
        <Numero icone="stopwatch-outline" valor={formatarDuracao(checkin.duracaoSeg * 1000)} />
        <Numero icone="layers-outline" valor={`${checkin.series} séries`} />
        <Numero icone="barbell-outline" valor={formatarKg(checkin.pesoTotal)} />
      </View>

      {checkin.prs.map((pr) => (
        <View key={pr.exercicio} style={styles.pr}>
          <Ionicons name="trophy" size={16} color={CORES.dourado} />
          <Text style={styles.textoPr}>
            PR em {pr.exercicio}: {formatarKg(pr.carga)} × {pr.repeticoes}
          </Text>
        </View>
      ))}

      {comentarios !== undefined && (
        <View style={styles.rodape}>
          <Ionicons name="chatbubble-outline" size={18} color={CORES.textoSuave} />
          <Text style={styles.textoRodape}>
            {comentarios === 0 ? 'Comentar' : comentarios === 1 ? '1 comentário' : `${comentarios} comentários`}
          </Text>
        </View>
      )}
    </Cartao>
  );

  if (comentarios === undefined) return cartao();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir o treino de ${checkin.autor.nome}`}
      onPress={() => abrirCheckin(checkin.id, pathname)}>
      {({ pressed }) => cartao(pressed)}
    </Pressable>
  );
}

function Numero({ icone, valor }: { icone: 'stopwatch-outline' | 'layers-outline' | 'barbell-outline'; valor: string }) {
  return (
    <View style={styles.numero}>
      <Ionicons name={icone} size={16} color={CORES.dourado} />
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tituloDia: {
    color: CORES.textoSuave,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  cartao: { gap: 10 },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  nome: { color: CORES.texto, fontSize: 16, fontWeight: '700' },
  detalhe: { color: CORES.textoSuave, fontSize: 13 },
  moldura: { borderRadius: 10, overflow: 'hidden', backgroundColor: CORES.fundo },
  foto: { width: '100%', aspectRatio: 4 / 5 },
  legenda: { color: CORES.texto, fontSize: 15 },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  numero: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valor: { color: CORES.texto, fontSize: 14, fontWeight: '600' },
  pr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  textoPr: { color: CORES.dourado, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CORES.borda,
    paddingTop: 10,
  },
  textoRodape: { color: CORES.textoSuave, fontSize: 14, fontWeight: '600' },
});
