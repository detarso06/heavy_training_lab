// Mapa do corpo (frente e costas) da react-native-body-highlighter: cada músculo fica mais vermelho
// conforme as séries válidas. As cores são nossas (styles.fill), não a escala de cores da biblioteca.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import type { Musculo } from '@/lib/musculos';
import { CORES } from '@/lib/tema';

const SLUG: Record<Musculo, Slug> = {
  peito: 'chest',
  ombros: 'deltoids',
  trapezio: 'trapezius',
  costas: 'upper-back',
  lombar: 'lower-back',
  biceps: 'biceps',
  triceps: 'triceps',
  antebraco: 'forearm',
  abdomen: 'abs',
  obliquos: 'obliques',
  quadriceps: 'quadriceps',
  posterior: 'hamstring',
  gluteos: 'gluteal',
  adutores: 'adductors',
  panturrilhas: 'calves',
  tibial: 'tibialis',
};

/** Partes que não são músculo: a biblioteca tem cores fixas para elas, então pintamos com o fundo. */
const NEUTRAS: Slug[] = ['hair', 'head', 'neck', 'hands', 'feet', 'knees', 'ankles'];

// No web a biblioteca sempre passa onPress ao react-native-svg, que põe props de "responder" no DOM:
// o toque funciona (vira onClick), mas em desenvolvimento o React avisa "Unknown event handler property".
// Na versão publicada e no celular não aparece.

const MUSCULO_DO_SLUG = new Map(Object.entries(SLUG).map(([m, s]) => [s, m as Musculo]));

/** Largura e altura de cada figura na escala 1 (medidas da biblioteca). */
const LARGURA_FIGURA = 200;
const ALTURA_FIGURA = 400;
const ESPACO = 8;

/** Mistura borda → vermelho. Qualquer série já deixa o músculo visivelmente colorido. */
export function corDaIntensidade(intensidade: number) {
  if (intensidade <= 0) return CORES.borda;
  const t = 0.25 + 0.75 * Math.min(1, intensidade);
  const de = [0x2e, 0x28, 0x23];
  const ate = [0xe3, 0x26, 0x2b];
  const [r, g, b] = de.map((c, i) => Math.round(c + (ate[i] - c) * t));
  return `rgb(${r}, ${g}, ${b})`;
}

export function MapaCorpo({
  seriesPorMusculo,
  escala,
  selecionado,
  onSelecionar,
}: {
  seriesPorMusculo: Map<Musculo, number>;
  escala: number;
  selecionado: Musculo | null;
  onSelecionar: (musculo: Musculo) => void;
}) {
  const [largura, setLargura] = useState(0);
  const tamanho = Math.min(1, (largura - ESPACO) / 2 / LARGURA_FIGURA);

  const dados: ExtendedBodyPart[] = [
    ...(Object.keys(SLUG) as Musculo[]).map((m) => ({
      slug: SLUG[m],
      styles: {
        fill: corDaIntensidade((seriesPorMusculo.get(m) ?? 0) / escala),
        stroke: m === selecionado ? CORES.dourado : CORES.fundo,
        strokeWidth: m === selecionado ? 6 : 1.5,
      },
    })),
    ...NEUTRAS.map((slug) => ({ slug, styles: { fill: CORES.fundo } })),
  ];

  const aoTocar = (parte: ExtendedBodyPart) => {
    const musculo = parte.slug && MUSCULO_DO_SLUG.get(parte.slug);
    if (musculo) onSelecionar(musculo);
  };

  return (
    <View style={styles.mapa} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {largura > 0 && (
        <View style={[styles.figuras, { height: ALTURA_FIGURA * tamanho }]}>
          {(['front', 'back'] as const).map((lado) => (
            <Body
              key={lado}
              side={lado}
              data={dados}
              scale={tamanho}
              border={CORES.borda}
              defaultFill={CORES.fundo}
              onBodyPartPress={aoTocar}
            />
          ))}
        </View>
      )}
      <View style={styles.legendas}>
        <Text style={styles.legenda}>Frente</Text>
        <Text style={styles.legenda}>Costas</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapa: { width: '100%', maxWidth: 2 * LARGURA_FIGURA + ESPACO, alignSelf: 'center', gap: 4 },
  figuras: { flexDirection: 'row', justifyContent: 'space-between' },
  legendas: { flexDirection: 'row', justifyContent: 'space-around' },
  legenda: { color: CORES.textoSuave, fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
});
