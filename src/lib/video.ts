/** Completa o protocolo de links colados sem "https://". */
export function normalizarUrl(url: string) {
  const limpo = url.trim();
  return /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
}

/** Id do vídeo para links do YouTube (watch, youtu.be, shorts, embed); null para outros links. */
export function idDoYoutube(url: string): string | null {
  const m = normalizarUrl(url).match(
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i
  );
  return m ? m[1] : null;
}

export function buscaNoYoutube(nomeExercicio: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${nomeExercicio} execução`)}`;
}
