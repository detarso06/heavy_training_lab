import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Botao, Campo } from '@/components/ui';
import { repo } from '@/db';
import { mensagemDeErro } from '@/lib/avisos';
import { criarConta, entrar, pedirCodigoDeSenha, redefinirSenha } from '@/lib/club';
import { CORES } from '@/lib/tema';

// "Esqueci minha senha" fica escondido até o envio de e-mails (SMTP do Gmail) ser configurado no Supabase:
// sem ele o código não chega para ninguém de fora da equipe do projeto.
const RECUPERAR_SENHA_LIGADO = false;

/** Entrar, criar conta ou recuperar a senha (Club, Perfil e Configurações usam o mesmo). */
export function FormularioConta() {
  const [criando, setCriando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [nome, setNome] = useState('');
  // Ao criar conta, já sugere o nome do perfil do aparelho.
  useEffect(() => {
    repo.obterPerfil().then((p) => setNome((atual) => atual || p.nome || ''));
  }, []);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = !!email.trim() && senha.length > 0 && (!criando || !!nome.trim());

  const enviar = async () => {
    if (!podeEnviar || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      if (criando) await criarConta(nome, email, senha);
      else await entrar(email, senha);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  if (recuperando) return <RecuperarSenha emailInicial={email} onVoltar={() => setRecuperando(false)} />;

  return (
    <View style={styles.formulario}>
      <Text style={styles.secao}>{criando ? 'Criar conta' : 'Entrar'}</Text>
      {criando && (
        <Campo placeholder="Seu nome" value={nome} onChangeText={setNome} maxLength={40} autoComplete="name" />
      )}
      <Campo
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo
        placeholder={criando ? 'Senha (mínimo 6 caracteres)' : 'Senha'}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete={criando ? 'new-password' : 'current-password'}
        onSubmitEditing={enviar}
      />
      {erro && <Text style={styles.erro}>{erro}</Text>}
      <Botao
        titulo={enviando ? 'Aguarde…' : criando ? 'Criar conta' : 'Entrar'}
        onPress={enviar}
        desabilitado={!podeEnviar || enviando}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setCriando(!criando);
          setErro(null);
        }}
        style={styles.alternar}>
        <Text style={styles.link}>{criando ? 'Já tenho conta: entrar' : 'Não tenho conta: criar agora'}</Text>
      </Pressable>
      {RECUPERAR_SENHA_LIGADO && !criando && (
        <Pressable accessibilityRole="button" onPress={() => setRecuperando(true)} style={styles.alternar}>
          <Text style={styles.linkSuave}>Esqueci minha senha</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Esqueci minha senha: código de 6 dígitos por e-mail e senha nova (entra na conta ao final). */
function RecuperarSenha({ emailInicial, onVoltar }: { emailInicial: string; onVoltar: () => void }) {
  const [email, setEmail] = useState(emailInicial);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const executar = async (acao: () => Promise<void>) => {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const pedirCodigo = () =>
    executar(async () => {
      await pedirCodigoDeSenha(email);
      setCodigoEnviado(true);
    });

  // Ao dar certo a pessoa já entra na conta e a tela do Club troca sozinha.
  const trocarSenha = () => executar(() => redefinirSenha(email, codigo, senha));

  return (
    <View style={styles.formulario}>
      <Text style={styles.secao}>Criar uma senha nova</Text>
      {!codigoEnviado ? (
        <>
          <Text style={styles.textoEsquerda}>Digite o e-mail da sua conta. Vamos mandar um código de 6 dígitos.</Text>
          <Campo
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onSubmitEditing={pedirCodigo}
          />
          {erro && <Text style={styles.erro}>{erro}</Text>}
          <Botao
            titulo={enviando ? 'Enviando…' : 'Enviar código'}
            icone="mail-outline"
            onPress={pedirCodigo}
            desabilitado={!email.trim() || enviando}
          />
        </>
      ) : (
        <>
          <Text style={styles.textoEsquerda}>
            Se existir uma conta com <Text style={styles.destaque}>{email.trim()}</Text>, o código chega em instantes.
            Confira também o spam.
          </Text>
          <Campo
            placeholder="Código de 6 dígitos"
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
          />
          <Campo
            placeholder="Senha nova (mínimo 6 caracteres)"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoComplete="new-password"
            onSubmitEditing={trocarSenha}
          />
          {erro && <Text style={styles.erro}>{erro}</Text>}
          <Botao
            titulo={enviando ? 'Aguarde…' : 'Salvar senha nova'}
            icone="key-outline"
            onPress={trocarSenha}
            desabilitado={codigo.length !== 6 || senha.length < 6 || enviando}
          />
          <Pressable accessibilityRole="button" onPress={pedirCodigo} style={styles.alternar}>
            <Text style={styles.link}>Mandar outro código</Text>
          </Pressable>
        </>
      )}
      <Pressable accessibilityRole="button" onPress={onVoltar} style={styles.alternar}>
        <Text style={styles.linkSuave}>Voltar para entrar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  formulario: { gap: 12 },
  secao: { color: CORES.texto, fontSize: 20, fontWeight: '700' },
  erro: { color: CORES.vermelho, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  alternar: { alignItems: 'center', paddingVertical: 8 },
  link: { color: CORES.dourado, fontSize: 15, fontWeight: '700' },
  linkSuave: { color: CORES.textoSuave, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  textoEsquerda: { color: CORES.textoSuave, fontSize: 15 },
  destaque: { color: CORES.texto, fontWeight: '700' },
});
