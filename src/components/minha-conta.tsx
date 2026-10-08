import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useConfirmacao } from '@/components/dialogo-confirmacao';
import { FormularioConta } from '@/components/formulario-conta';
import { Botao, Cartao } from '@/components/ui';
import { mensagemDeErro } from '@/lib/avisos';
import {
  clubConfigurado,
  obterEmailDaConta,
  obterTreinosSalvos,
  salvarTreinosNaConta,
  useUsuarioClub,
  type TreinosSalvos,
} from '@/lib/club';
import { adicionarTreinosNoAparelho, aplicarPerfilNoAparelho } from '@/lib/transferir-treinos';
import { CORES } from '@/lib/tema';

function descrever(s: TreinosSalvos) {
  const quando = new Date(s.atualizadoEm).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const treinos = s.rotinas.reduce((n, r) => n + r.treinos.filter((t) => !t.descanso).length, 0);
  const rotinas = s.rotinas.length === 1 ? '1 rotina' : `${s.rotinas.length} rotinas`;
  return `${rotinas}, ${treinos === 1 ? '1 treino' : `${treinos} treinos`} · salva em ${quando}${s.aparelho ? ` (${s.aparelho})` : ''}`;
}

/**
 * Configurações → Minha conta: a conta do app (a mesma do Heavy Club) e a transferência de treinos
 * e perfil entre aparelhos. `onDadosTrazidos` recarrega a tela depois de trazer o perfil.
 */
export function MinhaConta({ onDadosTrazidos }: { onDadosTrazidos: () => void }) {
  const usuario = useUsuarioClub();

  if (!clubConfigurado) return null;
  if (usuario === undefined) return <ActivityIndicator />;
  if (usuario === null) {
    return (
      <Cartao style={styles.cartao}>
        <Text style={styles.texto}>
          Com uma conta você entra no Heavy Club e leva seus treinos e seu perfil para outro aparelho.
        </Text>
        <FormularioConta />
      </Cartao>
    );
  }
  return <Conectado key={usuario} onDadosTrazidos={onDadosTrazidos} />;
}

function Conectado({ onDadosTrazidos }: { onDadosTrazidos: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<TreinosSalvos | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tom: 'ok' | 'erro' } | null>(null);
  const { confirmar, dialogo } = useConfirmacao();

  useEffect(() => {
    let ativo = true;
    Promise.all([obterEmailDaConta(), obterTreinosSalvos()])
      .then(([e, s]) => {
        if (!ativo) return;
        setEmail(e);
        setSalvos(s);
      })
      .catch((e) => ativo && setAviso({ texto: mensagemDeErro(e), tom: 'erro' }));
    return () => {
      ativo = false;
    };
  }, []);

  const executar = async (acao: () => Promise<string>) => {
    setOcupado(true);
    setAviso(null);
    try {
      setAviso({ texto: await acao(), tom: 'ok' });
    } catch (e) {
      setAviso({ texto: mensagemDeErro(e), tom: 'erro' });
    } finally {
      setOcupado(false);
    }
  };

  const salvar = async () => {
    if (salvos) {
      const ok = await confirmar({
        titulo: 'Substituir a cópia da conta?',
        destaque: descrever(salvos),
        mensagem: 'A cópia salva na conta vai ser trocada pelos treinos e pelo perfil deste aparelho.',
        textoConfirmar: 'Substituir',
        icone: 'cloud-upload-outline',
      });
      if (!ok) return;
    }
    executar(async () => {
      const novos = await salvarTreinosNaConta();
      setSalvos(novos);
      return 'Treinos e perfil salvos na conta.';
    });
  };

  const trazer = async () => {
    if (!salvos) return;
    const ok = await confirmar({
      titulo: 'Trazer para este aparelho?',
      destaque: descrever(salvos),
      mensagem:
        'As rotinas da conta são somadas às deste aparelho (as que já existem com o mesmo nome ficam como estão), e o perfil é atualizado. Os treinos chegam sem histórico.',
      textoConfirmar: 'Trazer',
      icone: 'cloud-download-outline',
    });
    if (!ok) return;
    executar(async () => {
      const { adicionadas, puladas } = await adicionarTreinosNoAparelho(salvos.rotinas);
      if (salvos.perfil) await aplicarPerfilNoAparelho(salvos.perfil);
      onDadosTrazidos();
      const partes = [
        adicionadas.length > 0 ? `Rotinas trazidas: ${adicionadas.join(', ')}.` : 'Nenhuma rotina nova.',
        puladas.length > 0 ? `Já existiam aqui: ${puladas.join(', ')}.` : '',
        salvos.perfil ? 'Perfil atualizado.' : '',
      ];
      return partes.filter(Boolean).join(' ');
    });
  };

  return (
    <Cartao style={styles.cartao}>
      {dialogo}
      <View style={styles.linha}>
        <Ionicons name="person-circle-outline" size={22} color={CORES.dourado} />
        <Text style={styles.texto}>
          Conectado como <Text style={styles.destaque}>{email ?? '…'}</Text>
        </Text>
      </View>

      <Text style={styles.titulo}>Treinos e perfil em outro aparelho</Text>
      <Text style={styles.texto}>
        Salve aqui e, no outro aparelho, entre na mesma conta e toque em “Trazer para este aparelho”. Vão as
        rotinas, os treinos (sem histórico, cargas e PRs) e o perfil.
      </Text>
      {salvos === undefined ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.info}>{salvos ? `Na conta: ${descrever(salvos)}` : 'Nenhuma cópia salva na conta ainda.'}</Text>
      )}

      <Botao
        titulo={ocupado ? 'Aguarde…' : 'Salvar treinos e perfil na conta'}
        variante="secundario"
        icone="cloud-upload-outline"
        onPress={salvar}
        desabilitado={ocupado || salvos === undefined}
      />
      {salvos && (
        <Botao
          titulo="Trazer para este aparelho"
          icone="cloud-download-outline"
          onPress={trazer}
          desabilitado={ocupado}
        />
      )}
      {aviso && <Text style={aviso.tom === 'ok' ? styles.ok : styles.erro}>{aviso.texto}</Text>}
    </Cartao>
  );
}

const styles = StyleSheet.create({
  cartao: { gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { color: CORES.texto, fontSize: 16, fontWeight: '700', marginTop: 6 },
  texto: { color: CORES.textoSuave, fontSize: 14, flexShrink: 1 },
  destaque: { color: CORES.texto, fontWeight: '700' },
  info: { color: CORES.dourado, fontSize: 14, fontWeight: '600' },
  ok: { color: CORES.dourado, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  erro: { color: CORES.vermelho, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
