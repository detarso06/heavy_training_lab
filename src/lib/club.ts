// Heavy Training Club: contas, amizades por código, retrato do perfil, check-ins e feed.
// Os treinos ficam no aparelho; aqui vai só o que o usuário deixou os amigos verem
// (as regras de acesso estão em supabase/schema.sql).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';

import { repo, type Sessao } from '@/db';
import { dataLocal } from '@/lib/metas';
import { calcularRecordes, carregarHistoricoCompleto, type Recorde } from '@/lib/prs';
import { calcularSequencia } from '@/lib/sequencia';
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
  [/rate limit|too many requests/i, 'Muitas tentativas seguidas. Espere um pouco e tente de novo.'],
  [/failed to fetch|network request failed/i, 'Sem conexão com o Club. Verifique a internet.'],
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
  return data.map((c) => ({
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
  }));
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
