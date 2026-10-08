import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

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

/** Post de treino concluído: autor, foto, números do dia e PRs batidos. `onApagar` só nos posts do próprio usuário. */
export function CartaoCheckin({
  checkin,
  urlFoto,
  onApagar,
}: {
  checkin: Checkin;
  urlFoto?: string;
  onApagar?: () => void;
}) {
  return (
    <Cartao style={styles.cartao}>
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
    </Cartao>
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
});
