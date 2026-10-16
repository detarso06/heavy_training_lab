import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CartaoCheckin, CheckinsPorDia } from '@/components/cartao-checkin';
import { Botao } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import {
  clubConfigurado,
  contarComentarios,
  listarCheckins,
  urlsDasFotos,
  useUsuarioClub,
  type Checkin,
} from '@/lib/club';
import { CORES } from '@/lib/tema';

interface Feed {
  checkins: Checkin[];
  fotos: Map<string, string>;
  comentarios: Map<string, number>;
}

/** Fim do Início: feed do Heavy Training Club (check-ins dos amigos e os seus). */
export function FeedClub() {
  const usuario = useUsuarioClub();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      let ativo = true;
      (async () => {
        try {
          const checkins = await listarCheckins({ limite: 15 });
          const [fotos, comentarios] = await Promise.all([
            urlsDasFotos(checkins.flatMap((c) => (c.foto ? [c.foto] : []))),
            contarComentarios(checkins.map((c) => c.id)).catch(() => new Map<string, number>()),
          ]);
          if (!ativo) return;
          setFeed({ checkins, fotos, comentarios });
          setErro(null);
        } catch (e) {
          if (ativo) setErro(mensagemDeErro(e));
        }
      })();
      return () => {
        ativo = false;
      };
    }, [usuario])
  );

  const cabecalho = (
    <View style={styles.marca}>
      <Text style={styles.clubHeavy}>HEAVY</Text>
      <Text style={styles.clubNome}>TRAINING CLUB</Text>
    </View>
  );

  if (!clubConfigurado || !usuario) {
    return (
      <View style={styles.club}>
        {cabecalho}
        <Image
          source={require('@/../assets/images/heavy-club.png')}
          style={styles.clubImagem}
          contentFit="contain"
          accessibilityLabel="Heavy Guy cansado no banco da academia"
        />
        {clubConfigurado && usuario === null && (
          <>
            <Text style={styles.texto}>Adicione seus amigos e acompanhe os treinos uns dos outros.</Text>
            <Botao titulo="Entrar no Club" icone="people-outline" onPress={() => router.navigate('/club')} style={styles.botao} />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.club}>
      {cabecalho}
      {erro && <Text style={styles.erro}>{erro}</Text>}
      {!feed && !erro && <ActivityIndicator style={styles.carregando} />}
      {feed?.checkins.length === 0 && (
        <>
          <Text style={styles.texto}>
            Nenhum check-in ainda. Adicione amigos pelo código e poste seus treinos pelo resumo ao finalizar.
          </Text>
          <Botao titulo="Abrir o Club" icone="people-outline" variante="secundario" onPress={() => router.navigate('/club')} style={styles.botao} />
        </>
      )}
      {feed && (
        <CheckinsPorDia
          checkins={feed.checkins}
          renderizar={(c) => (
            <CartaoCheckin
              key={c.id}
              checkin={c}
              urlFoto={c.foto ? feed.fotos.get(c.foto) : undefined}
              comentarios={feed.comentarios.get(c.id) ?? 0}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  club: { alignItems: 'stretch', marginTop: 28, gap: 12 },
  marca: { alignItems: 'center', gap: 2 },
  clubHeavy: { color: CORES.vermelho, fontSize: 36, fontWeight: '900', letterSpacing: 4, lineHeight: 40 },
  clubNome: { color: CORES.texto, fontSize: 15, fontWeight: '800', letterSpacing: 6 },
  clubImagem: { width: '100%', maxWidth: 360, aspectRatio: 774 / 716, alignSelf: 'center' },
  texto: { color: CORES.textoSuave, fontSize: 15, textAlign: 'center' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  carregando: { marginTop: 12 },
  botao: { alignSelf: 'center' },
});
