import { StyleSheet, Text, View } from 'react-native';

import { Cartao } from '@/components/ui';
import { nivelDaSequencia, type Sequencia } from '@/lib/sequencia';
import { CORES } from '@/lib/tema';

export function CartaoSequencia({ sequencia }: { sequencia: Sequencia }) {
  const { dias, treinouHoje } = sequencia;
  const { nivel, icones, titulo } = nivelDaSequencia(dias);
  // O fogo cresce com o nível; com vários ícones, cada um diminui um pouco para caber.
  const tamanho = (34 + Math.min(nivel, 5) * 4) * ([1, 0.8, 0.66][icones.length - 1] ?? 0.6);

  let mensagem = 'Conclua um treino hoje para começar sua sequência.';
  if (dias > 0 && treinouHoje) mensagem = 'Treino de hoje feito. Volte amanhã para manter a sequência!';
  else if (dias > 0) mensagem = 'Treine hoje para não perder a sequência!';

  return (
    <Cartao style={[styles.cartao, dias > 0 && { borderColor: treinouHoje ? CORES.dourado : CORES.vermelho }]}>
      <View style={styles.linha}>
        <View style={styles.icones}>
          {icones.map((icone, i) => (
            <Text
              key={i}
              style={{ fontSize: tamanho, lineHeight: tamanho * 1.25, marginLeft: i === 0 ? 0 : -tamanho * 0.45 }}>
              {icone}
            </Text>
          ))}
        </View>
        <View>
          <Text style={styles.rotulo}>Sequência</Text>
          <Text style={styles.dias}>
            {dias} {dias === 1 ? 'dia' : 'dias'}
          </Text>
          <Text style={[styles.titulo, { color: dias > 0 ? CORES.dourado : CORES.textoSuave }]}>{titulo}</Text>
        </View>
      </View>

      <Text style={styles.mensagem}>{mensagem}</Text>
    </Cartao>
  );
}

const styles = StyleSheet.create({
  cartao: { gap: 12 },
  // Fogo + texto formam um bloco centralizado no cartão.
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  icones: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  rotulo: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  dias: { color: CORES.texto, fontSize: 32, fontWeight: '900', lineHeight: 38 },
  titulo: { fontSize: 15, fontWeight: '700' },
  mensagem: { color: CORES.textoSuave, fontSize: 14, textAlign: 'center' },
});
