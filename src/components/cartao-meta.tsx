import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BarraArrastavel } from '@/components/barra-arrastavel';
import { Cartao } from '@/components/ui';
import { CORES } from '@/lib/tema';

interface Props {
  titulo: string;
  subtitulo?: string | null;
  icone: ComponentProps<typeof Ionicons>['name'];
  valor: number;
  /** Nulo enquanto o usuário não definiu a meta. */
  meta: number | null;
  passo: number;
  formatar: (v: number) => string;
  onChange: (v: number) => void;
  onSoltar: (v: number) => void;
  textoSemMeta: string;
}

export function CartaoMeta({
  titulo,
  subtitulo,
  icone,
  valor,
  meta,
  passo,
  formatar,
  onChange,
  onSoltar,
  textoSemMeta,
}: Props) {
  const batida = meta !== null && meta > 0 && valor >= meta;
  const pct = meta ? Math.round((Math.min(valor, meta) / meta) * 100) : 0;

  return (
    <Cartao style={[styles.cartao, batida && { borderColor: CORES.dourado }]}>
      <View style={styles.cabecalho}>
        <Ionicons name={icone} size={22} color={CORES.dourado} />
        <View style={styles.flex}>
          <Text style={styles.titulo}>{titulo}</Text>
          {!!subtitulo && <Text style={styles.subtitulo}>{subtitulo}</Text>}
        </View>
        {meta !== null && <Text style={[styles.pct, batida && { color: CORES.dourado }]}>{pct}%</Text>}
      </View>

      {meta === null ? (
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/usuario')}>
          <Text style={styles.semMeta}>{textoSemMeta}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.valor}>
            {formatar(valor)} <Text style={styles.deMeta}>de {formatar(meta)}</Text>
          </Text>
          <BarraArrastavel
            valor={valor}
            max={meta}
            passo={passo}
            onChange={onChange}
            onSoltar={onSoltar}
            rotulo={titulo}
            formatar={formatar}
          />
          <Text style={[styles.dica, batida && { color: CORES.dourado }]}>
            {batida ? 'Meta batida! Heavy Guy aprova.' : 'Arraste a barra para registrar.'}
          </Text>
        </>
      )}
    </Cartao>
  );
}

const styles = StyleSheet.create({
  // Sem seleção de texto: no navegador, arrastar a barra com o mouse selecionava o cartão.
  cartao: { gap: 8, userSelect: 'none' },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  titulo: { color: CORES.texto, fontSize: 17, fontWeight: '700' },
  subtitulo: { color: CORES.textoSuave, fontSize: 13 },
  pct: { color: CORES.texto, fontSize: 16, fontWeight: '800' },
  valor: { color: CORES.texto, fontSize: 26, fontWeight: '800' },
  deMeta: { color: CORES.textoSuave, fontSize: 16, fontWeight: '600' },
  dica: { color: CORES.textoSuave, fontSize: 13, textAlign: 'center' },
  semMeta: { color: CORES.dourado, fontSize: 15, paddingVertical: 6 },
});
