// Heavy Training Club: contas, amizades por código, retrato do perfil, check-ins e feed.
// Os treinos ficam no aparelho; aqui vai só o que o usuário deixou os amigos verem
// (as regras de acesso estão em supabase/schema.sql).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';

import { repo, type Perfil, type Sessao } from '@/db';
import { dataLocal } from '@/lib/metas';
import { calcularRecordes, carregarHistoricoCompleto, type Recorde } from '@/lib/prs';
import { calcularSequencia } from '@/lib/sequencia';
import { copiarTreinosDoAparelho, NOME_DO_APARELHO, type RotinaCopiada } from '@/lib/transferir-treinos';
import { resumirSeries } from '@/lib/sessao';
import { supabase } from '@/lib/supabase';

export const clubConfigurado = supabase !== null;

function cliente() {
  if (!supabase) throw new Error('O Heavy Training Club ainda não foi configurado neste app.');
  return supabase;
}

const TRADUCOES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/already registered|already been registered/i, 'Já existe uma conta com esse e-mail.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
  [/unable to validate email|invalid email/i, 'Esse e-mail não parece válido.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar.'],
  [/rate limit|too many requests|security purposes/i, 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
  [/token has expired|otp.*(expired|invalid)|invalid.*(otp|token)/i, 'Código inválido ou vencido. Peça um novo.'],
  [/should be different from the old/i, 'A senha nova precisa ser diferente da antiga.'],
  [/failed to fetch|network request failed/i, 'Sem conexão com o Club. Verifique a internet.'],
  [/cannot coerce the result to a single json object/i, 'Esse perfil não está disponível para você.'],
];

/** Lança o erro do Supabase em português (as funções do banco já respondem em português). */
function falhar(erro: { message: string }): never {
  const traducao = TRADUCOES.find(([padrao]) => padrao.test(erro.message));
  throw new Error(traducao ? traducao[1] : erro.message);
}

// ---------------------------------------------------------------------------------------------
// Conta

/** Id do usuário logado no Club (null = deslogado, undefined = ainda carregando). */
export function useUsuarioClub(): string | null | undefined {
  const [usuario, setUsuario] = useState<string | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => setUsuario(sessao?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return usuario;
}

async function meuId() {
  const { data } = await cliente().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Entre na sua conta do Club primeiro.');
  return id;
}

export async function criarConta(nome: string, email: string, senha: string) {
  const { data, error } = await cliente().auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { nome: nome.trim() } },
  });
  if (error) falhar(error);
  if (!data.session) throw new Error('Conta criada! Confirme o e-mail que enviamos e depois entre.');
}

export async function entrar(email: string, senha: string) {
  const { error } = await cliente().auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) falhar(error);
}

/** Esqueci minha senha: manda um código de 6 dígitos para o e-mail (vale 15 minutos). */
export async function pedirCodigoDeSenha(email: string) {
  const { error } = await cliente().auth.resetPasswordForEmail(email.trim());
  if (error) falhar(error);
}

/** Confere o código do e-mail, entra na conta e troca a senha. */
export async function redefinirSenha(email: string, codigo: string, novaSenha: string) {
  const { error } = await cliente().auth.verifyOtp({ email: email.trim(), token: codigo.trim(), type: 'recovery' });
  if (error) falhar(error);
  const troca = await cliente().auth.updateUser({ password: novaSenha });
  if (troca.error) falhar(troca.error);
}

/**
 * Exclui a conta do Club: apaga as fotos (pelo Storage) e depois a conta, que leva junto perfil,
 * amizades, PRs e check-ins (supabase/005_apagar_minha_conta.sql).
 */
export async function excluirConta() {
  const eu = await meuId();
  const pasta = cliente().storage.from('checkins');
  const { data: arquivos, error } = await pasta.list(eu, { limit: 1000 });
  if (error) falhar(error);
  if (arquivos.length > 0) {
    const r = await pasta.remove(arquivos.map((a) => `${eu}/${a.name}`));
    if (r.error) falhar(r.error);
  }
  const { error: erroConta } = await cliente().rpc('apagar_minha_conta');
  if (erroConta) falhar(erroConta);
  // A sessão já não vale no servidor; só limpa a deste aparelho.
  await cliente().auth.signOut({ scope: 'local' });
}

export async function sair() {
  const { error } = await cliente().auth.signOut();
  if (error) falhar(error);
}

// ---------------------------------------------------------------------------------------------
// Perfis

export interface PerfilClub {
  id: string;
  nome: string;
  avatar: string | null;
  codigo: string;
  criadoEm: string;
  mostrarCheckins: boolean;
  mostrarSequencia: boolean;
  mostrarRotina: boolean;
  prsVisiveis: string[];
  sequencia: number | null;
  sequenciaAte: string | null;
  rotinaAtual: string | null;
  /** Até quando o usuário já viu as novidades do sininho. */
  notificacoesVistasEm: string;
}

interface LinhaPerfil {
  id: string;
  nome: string;
  avatar: string | null;
  codigo: string;
  criado_em: string;
  mostrar_checkins: boolean;
  mostrar_sequencia: boolean;
  mostrar_rotina: boolean;
  prs_visiveis: string[];
  sequencia: number | null;
  sequencia_ate: string | null;
  rotina_atual: string | null;
  notificacoes_vistas_em: string;
}

function paraPerfil(l: LinhaPerfil): PerfilClub {
  return {
    id: l.id,
    nome: l.nome,
    avatar: l.avatar,
    codigo: l.codigo,
    criadoEm: l.criado_em,
    mostrarCheckins: l.mostrar_checkins,
    mostrarSequencia: l.mostrar_sequencia,
    mostrarRotina: l.mostrar_rotina,
    prsVisiveis: l.prs_visiveis,
    sequencia: l.sequencia,
    sequenciaAte: l.sequencia_ate,
    rotinaAtual: l.rotina_atual,
    notificacoesVistasEm: l.notificacoes_vistas_em,
  };
}

export async function obterPerfil(id?: string): Promise<PerfilClub> {
  const alvo = id ?? (await meuId());
  const { data, error } = await cliente().from('perfis').select('*').eq('id', alvo).single<LinhaPerfil>();
  if (error) falhar(error);
  return paraPerfil(data);
}

export type Privacidade = Pick<PerfilClub, 'mostrarCheckins' | 'mostrarSequencia' | 'mostrarRotina' | 'prsVisiveis'>;

export async function atualizarMeuPerfil(dados: Partial<Pick<PerfilClub, 'nome' | 'avatar'> & Privacidade>) {
  const colunas: Record<string, unknown> = {
    nome: dados.nome,
    avatar: dados.avatar,
    mostrar_checkins: dados.mostrarCheckins,
    mostrar_sequencia: dados.mostrarSequencia,
    mostrar_rotina: dados.mostrarRotina,
    prs_visiveis: dados.prsVisiveis,
  };
  const presentes = Object.fromEntries(Object.entries(colunas).filter(([, v]) => v !== undefined));
  const { error } = await cliente().from('perfis').update(presentes).eq('id', await meuId());
  if (error) falhar(error);
}

/**
 * Sequência como os amigos devem ver: o valor publicado só vale se o último treino foi hoje ou ontem
 * (mesma regra de src/lib/sequencia.ts); senão já zerou.
 */
export function sequenciaVigente(perfil: Pick<PerfilClub, 'sequencia' | 'sequenciaAte'>, agora = new Date()) {
  if (perfil.sequencia === null || !perfil.sequenciaAte) return null;
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  return perfil.sequenciaAte >= dataLocal(ontem) ? perfil.sequencia : 0;
}

/**
 * Publica o retrato do perfil a partir dos dados do aparelho: avatar, sequência, rotina atual e os PRs
 * dos exercícios escolhidos. O que estiver escondido vai como vazio (e os PRs escondidos são apagados).
 */
export async function publicarRetrato() {
  const eu = await meuId();
  const perfil = await obterPerfil(eu);
  const [{ sessoes, series, nomes }, rotina, local] = await Promise.all([
    carregarHistoricoCompleto(),
    repo.obterRotinaAtiva(),
    repo.obterPerfil(),
  ]);

  const concluidas = sessoes.filter((s) => s.fim !== null);
  const ultima = concluidas.reduce<number | null>((m, s) => Math.max(m ?? 0, s.fim!), null);
  const { error } = await cliente()
    .from('perfis')
    .update({
      avatar: local.avatar,
      sequencia: perfil.mostrarSequencia ? calcularSequencia(sessoes, new Date()).dias : null,
      sequencia_ate: perfil.mostrarSequencia && ultima !== null ? dataLocal(new Date(ultima)) : null,
      rotina_atual: perfil.mostrarRotina ? (rotina?.nome ?? null) : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', eu);
  if (error) falhar(error);

  const visiveis = calcularRecordes(sessoes, series, nomes).filter((r) => perfil.prsVisiveis.includes(r.exercicio));
  const apagar = await cliente().from('prs').delete().eq('usuario', eu);
  if (apagar.error) falhar(apagar.error);
  if (visiveis.length > 0) {
    const { error: erroPrs } = await cliente()
      .from('prs')
      .insert(
        visiveis.map((r) => ({
          usuario: eu,
          exercicio: r.exercicio,
          carga: r.carga,
          repeticoes: r.repeticoes,
          feito_em: new Date(r.feitoEm).toISOString(),
        }))
      );
    if (erroPrs) falhar(erroPrs);
  }
}

export interface PrPublico {
  exercicio: string;
  carga: number;
  repeticoes: number;
  feitoEm: string;
}

export async function listarPrs(usuario: string): Promise<PrPublico[]> {
  const { data, error } = await cliente()
    .from('prs')
    .select('exercicio, carga, repeticoes, feito_em')
    .eq('usuario', usuario)
    .order('exercicio');
  if (error) falhar(error);
  return data.map((p) => ({ exercicio: p.exercicio, carga: Number(p.carga), repeticoes: p.repeticoes, feitoEm: p.feito_em }));
}

// ---------------------------------------------------------------------------------------------
// Amizades

export async function enviarPedido(codigo: string): Promise<{ status: 'enviado' | 'aceita'; nome: string }> {
  const { data, error } = await cliente().rpc('enviar_pedido', { p_codigo: codigo });
  if (error) falhar(error);
  return data as { status: 'enviado' | 'aceita'; nome: string };
}

/** Pedido direto, sem código: para quem comentou num check-in que eu vejo (supabase/010). */
export async function enviarPedidoPara(usuario: string): Promise<{ status: 'enviado' | 'aceita'; nome: string }> {
  const { data, error } = await cliente().rpc('enviar_pedido_para', { p_usuario: usuario });
  if (error) falhar(error);
  return data as { status: 'enviado' | 'aceita'; nome: string };
}

export type Vinculo = 'amigos' | 'enviado' | 'recebido' | null;

export interface PerfilBasico {
  id: string;
  nome: string;
  avatar: string | null;
  criadoEm: string;
  vinculo: Vinculo;
}

/**
 * Nome, avatar e vínculo comigo de alguém que ainda pode não ser amigo (ex.: quem comentou num check-in
 * de um amigo em comum). Null se não houver nenhum caminho até essa pessoa.
 */
export async function obterPerfilBasico(usuario: string): Promise<PerfilBasico | null> {
  const { data, error } = await cliente().rpc('perfil_basico', { p_usuario: usuario });
  if (error) falhar(error);
  const linha = (data as { id: string; nome: string; avatar: string | null; criado_em: string; vinculo: Vinculo }[])[0];
  return linha
    ? { id: linha.id, nome: linha.nome, avatar: linha.avatar, criadoEm: linha.criado_em, vinculo: linha.vinculo }
    : null;
}

export interface Pedido {
  outro: string;
  nome: string;
  avatar: string | null;
  /** true = a outra pessoa pediu; false = eu pedi e estou esperando. */
  recebido: boolean;
}

export async function listarPedidos(): Promise<Pedido[]> {
  const { data, error } = await cliente().rpc('listar_pedidos');
  if (error) falhar(error);
  return data as Pedido[];
}

export async function aceitarPedido(outro: string) {
  const { error } = await cliente()
    .from('amizades')
    .update({ aceita: true })
    .eq('de', outro)
    .eq('para', await meuId());
  if (error) falhar(error);
}

/** Recusa um pedido recebido, cancela um enviado ou desfaz a amizade. */
export async function desfazerVinculo(outro: string) {
  const eu = await meuId();
  const { error } = await cliente()
    .from('amizades')
    .delete()
    .or(`and(de.eq.${eu},para.eq.${outro}),and(de.eq.${outro},para.eq.${eu})`);
  if (error) falhar(error);
}

export async function listarAmigos(): Promise<PerfilClub[]> {
  const eu = await meuId();
  const { data, error } = await cliente().from('amizades').select('de, para').eq('aceita', true);
  if (error) falhar(error);
  const ids = data.map((a) => (a.de === eu ? a.para : a.de));
  if (ids.length === 0) return [];
  const perfis = await cliente().from('perfis').select('*').in('id', ids).order('nome').returns<LinhaPerfil[]>();
  if (perfis.error) falhar(perfis.error);
  return perfis.data.map(paraPerfil);
}

// ---------------------------------------------------------------------------------------------
// Check-ins e feed

export interface PrDoDia {
  exercicio: string;
  carga: number;
  repeticoes: number;
}

export interface Checkin {
  id: string;
  usuario: string;
  autor: { nome: string; avatar: string | null };
  criadoEm: string;
  treino: string;
  duracaoSeg: number;
  series: number;
  repeticoes: number;
  pesoTotal: number;
  prs: PrDoDia[];
  /** Caminho no bucket; use urlsDasFotos para exibir. */
  foto: string | null;
  legenda: string | null;
}

/** Reduz a foto para no máximo 1080 px de largura em JPEG (~200 KB) antes de enviar. */
async function prepararFoto(uri: string, largura: number) {
  const contexto = ImageManipulator.manipulate(uri);
  if (largura > 1080) contexto.resize({ width: 1080 });
  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  const binario = atob(salva.base64!);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export async function postarCheckin(dados: {
  sessao: Sessao;
  prs: Recorde[];
  foto: { uri: string; largura: number } | null;
  legenda: string;
}) {
  const eu = await meuId();
  const series = await repo.listarSeriesDaSessao(dados.sessao.id);
  const total = resumirSeries(series);

  let caminho: string | null = null;
  if (dados.foto) {
    const bytes = await prepararFoto(dados.foto.uri, dados.foto.largura);
    caminho = `${eu}/${Date.now()}.jpg`;
    const { error } = await cliente().storage.from('checkins').upload(caminho, bytes, { contentType: 'image/jpeg' });
    if (error) falhar(error);
  }

  const { error } = await cliente()
    .from('checkins')
    .insert({
      usuario: eu,
      treino: dados.sessao.nome,
      duracao_seg: Math.round(((dados.sessao.fim ?? Date.now()) - dados.sessao.inicio) / 1000),
      series: total.series,
      repeticoes: total.repeticoes,
      peso_total: total.volume,
      prs: dados.prs.map((r) => ({ exercicio: r.exercicio, carga: r.carga, repeticoes: r.repeticoes })),
      foto: caminho,
      legenda: dados.legenda.trim() || null,
    });
  if (error) {
    if (caminho) await cliente().storage.from('checkins').remove([caminho]);
    falhar(error);
  }
  // Aproveita para deixar sequência e PRs do perfil em dia.
  await publicarRetrato().catch(() => {});
}

interface LinhaCheckin {
  id: string;
  usuario: string;
  criado_em: string;
  treino: string;
  duracao_seg: number;
  series: number;
  repeticoes: number;
  peso_total: number;
  prs: PrDoDia[];
  foto: string | null;
  legenda: string | null;
  perfis: { nome: string; avatar: string | null } | null;
}

/** Check-ins visíveis (meus e dos amigos), mais recentes primeiro. `usuario` filtra por uma pessoa. */
export async function listarCheckins(opcoes: { usuario?: string; limite?: number } = {}): Promise<Checkin[]> {
  let consulta = cliente()
    .from('checkins')
    .select('*, perfis(nome, avatar)')
    .order('criado_em', { ascending: false })
    .limit(opcoes.limite ?? 20);
  if (opcoes.usuario) consulta = consulta.eq('usuario', opcoes.usuario);
  const { data, error } = await consulta.returns<LinhaCheckin[]>();
  if (error) falhar(error);
  return data.map(paraCheckin);
}

/** Um check-in pelo id (null se apagado ou se o dono deixou de mostrar). */
export async function obterCheckin(id: string): Promise<Checkin | null> {
  const { data, error } = await cliente()
    .from('checkins')
    .select('*, perfis(nome, avatar)')
    .eq('id', id)
    .maybeSingle<LinhaCheckin>();
  if (error) falhar(error);
  return data ? paraCheckin(data) : null;
}

function paraCheckin(c: LinhaCheckin): Checkin {
  return {
    id: c.id,
    usuario: c.usuario,
    autor: c.perfis ?? { nome: 'Atleta', avatar: null },
    criadoEm: c.criado_em,
    treino: c.treino,
    duracaoSeg: c.duracao_seg,
    series: c.series,
    repeticoes: c.repeticoes,
    pesoTotal: Number(c.peso_total),
    prs: c.prs,
    foto: c.foto,
    legenda: c.legenda,
  };
}

/** Links temporários (1 hora) para exibir as fotos do bucket privado. */
export async function urlsDasFotos(caminhos: string[]): Promise<Map<string, string>> {
  if (caminhos.length === 0) return new Map();
  const { data, error } = await cliente().storage.from('checkins').createSignedUrls(caminhos, 3600);
  if (error) falhar(error);
  return new Map(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}

export async function apagarCheckin(checkin: Checkin) {
  const { error } = await cliente().from('checkins').delete().eq('id', checkin.id);
  if (error) falhar(error);
  if (checkin.foto) await cliente().storage.from('checkins').remove([checkin.foto]);
}

// ---------------------------------------------------------------------------------------------
// Comentários nos check-ins (supabase/009_comentarios.sql)

export const LIMITE_COMENTARIO = 500;

export interface Comentario {
  id: string;
  usuario: string;
  autor: { nome: string; avatar: string | null };
  /** Nulo quando bloqueado: quem escreveu não é seu amigo (o servidor nem manda o texto). */
  texto: string | null;
  bloqueado: boolean;
  criadoEm: string;
}

/** Mais antigos primeiro (como numa conversa). */
export async function listarComentarios(checkin: string): Promise<Comentario[]> {
  const { data, error } = await cliente().rpc('listar_comentarios', { p_checkin: checkin });
  if (error) falhar(error);
  return (
    data as {
      id: string;
      usuario: string;
      nome: string;
      avatar: string | null;
      texto: string | null;
      bloqueado?: boolean;
      criado_em: string;
    }[]
  ).map((c) => ({
    id: c.id,
    usuario: c.usuario,
    autor: { nome: c.nome, avatar: c.avatar },
    texto: c.texto,
    bloqueado: c.bloqueado ?? false,
    criadoEm: c.criado_em,
  }));
}

export async function comentar(checkin: string, texto: string) {
  const limpo = texto.trim();
  if (!limpo) throw new Error('Escreva alguma coisa antes de enviar.');
  const { error } = await cliente()
    .from('comentarios')
    .insert({ checkin, usuario: await meuId(), texto: limpo.slice(0, LIMITE_COMENTARIO) });
  if (error) falhar(error);
}

export async function apagarComentario(id: string) {
  const { error } = await cliente().from('comentarios').delete().eq('id', id);
  if (error) falhar(error);
}

/** Quantos comentários cada check-in tem (para os cartões do feed). */
export async function contarComentarios(checkins: string[]): Promise<Map<string, number>> {
  const contagem = new Map<string, number>();
  if (checkins.length === 0) return contagem;
  const { data, error } = await cliente().from('comentarios').select('checkin').in('checkin', checkins);
  if (error) falhar(error);
  for (const { checkin } of data) contagem.set(checkin, (contagem.get(checkin) ?? 0) + 1);
  return contagem;
}

// ---------------------------------------------------------------------------------------------
// Notificações (sininho): pedidos de amizade recebidos e check-ins novos dos amigos

export interface ComentarioRecebido {
  id: string;
  checkin: string;
  treino: string;
  autor: { nome: string; avatar: string | null };
  texto: string;
  criadoEm: string;
}

export interface Notificacoes {
  pedidos: Pedido[];
  /** Check-ins recentes dos amigos (os novos têm criadoEm > vistasEm). */
  checkins: Checkin[];
  /** Comentários dos outros nos meus check-ins (quem comenta no meu post é sempre meu amigo). */
  comentarios: ComentarioRecebido[];
  vistasEm: string;
}

interface LinhaComentarioRecebido {
  id: string;
  checkin: string;
  texto: string;
  criado_em: string;
  perfis: { nome: string; avatar: string | null } | null;
  checkins: { treino: string } | null;
}

async function listarComentariosRecebidos(eu: string, limite: number): Promise<ComentarioRecebido[]> {
  const { data, error } = await cliente()
    .from('comentarios')
    .select('id, checkin, texto, criado_em, perfis(nome, avatar), checkins!inner(usuario, treino)')
    .eq('checkins.usuario', eu)
    .neq('usuario', eu)
    .order('criado_em', { ascending: false })
    .limit(limite)
    .returns<LinhaComentarioRecebido[]>();
  if (error) falhar(error);
  return data.map((c) => ({
    id: c.id,
    checkin: c.checkin,
    treino: c.checkins?.treino ?? 'Treino',
    autor: c.perfis ?? { nome: 'Atleta', avatar: null },
    texto: c.texto,
    criadoEm: c.criado_em,
  }));
}

export async function listarNotificacoes(): Promise<Notificacoes> {
  const eu = await meuId();
  const [perfil, pedidos, checkins, comentarios] = await Promise.all([
    obterPerfil(eu),
    listarPedidos(),
    listarCheckins({ limite: 30 }),
    // Sem a tabela de comentários (supabase/009 ainda não aplicado), o resto do sininho segue funcionando.
    listarComentariosRecebidos(eu, 30).catch(() => []),
  ]);
  return {
    pedidos: pedidos.filter((p) => p.recebido),
    checkins: checkins.filter((c) => c.usuario !== eu),
    comentarios,
    vistasEm: perfil.notificacoesVistasEm,
  };
}

/**
 * Número da bolinha do sininho: pedidos esperando resposta + check-ins de amigos e comentários nos meus
 * check-ins ainda não vistos.
 */
export async function contarNovidades(): Promise<number> {
  const eu = await meuId();
  const [perfil, pedidos] = await Promise.all([obterPerfil(eu), listarPedidos()]);
  const [checkins, comentarios] = await Promise.all([
    cliente()
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .neq('usuario', eu)
      .gt('criado_em', perfil.notificacoesVistasEm),
    cliente()
      .from('comentarios')
      .select('id, checkins!inner(usuario)', { count: 'exact', head: true })
      .eq('checkins.usuario', eu)
      .neq('usuario', eu)
      .gt('criado_em', perfil.notificacoesVistasEm),
  ]);
  if (checkins.error) falhar(checkins.error);
  // Erro nos comentários (ex.: supabase/009 ainda não aplicado) só deixa de contá-los.
  return pedidos.filter((p) => p.recebido).length + (checkins.count ?? 0) + (comentarios.count ?? 0);
}

export async function marcarNotificacoesVistas() {
  const { error } = await cliente()
    .from('perfis')
    .update({ notificacoes_vistas_em: new Date().toISOString() })
    .eq('id', await meuId());
  if (error) falhar(error);
}

// ---------------------------------------------------------------------------------------------
// Conta: e-mail e treinos salvos (para transferir para outro aparelho)

export async function obterEmailDaConta(): Promise<string | null> {
  const { data } = await cliente().auth.getSession();
  return data.session?.user.email ?? null;
}

export interface TreinosSalvos {
  rotinas: RotinaCopiada[];
  /** Perfil do app (nome, idade, altura, peso, metas, avatar); nulo em cópias antigas. */
  perfil: Perfil | null;
  aparelho: string | null;
  atualizadoEm: string;
}

export async function obterTreinosSalvos(): Promise<TreinosSalvos | null> {
  const { data, error } = await cliente()
    .from('treinos_salvos')
    .select('rotinas, perfil, aparelho, atualizado_em')
    .eq('usuario', await meuId())
    .maybeSingle();
  if (error) falhar(error);
  return data
    ? { rotinas: data.rotinas, perfil: data.perfil, aparelho: data.aparelho, atualizadoEm: data.atualizado_em }
    : null;
}

/** Guarda na conta a cópia das rotinas e do perfil deste aparelho (substitui a cópia anterior). */
export async function salvarTreinosNaConta(): Promise<TreinosSalvos> {
  const [rotinas, perfil] = await Promise.all([copiarTreinosDoAparelho(), repo.obterPerfil()]);
  const salvos = { rotinas, perfil, aparelho: NOME_DO_APARELHO, atualizadoEm: new Date().toISOString() };
  const { error } = await cliente().from('treinos_salvos').upsert({
    usuario: await meuId(),
    rotinas: salvos.rotinas,
    perfil: salvos.perfil,
    aparelho: salvos.aparelho,
    atualizado_em: salvos.atualizadoEm,
  });
  if (error) falhar(error);
  return salvos;
}
