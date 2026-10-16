// No navegador não há notificação agendada: o aviso é só o do próprio timer na tela.
export async function agendarAvisoDescanso(
  _ms: number,
  _conteudo?: { titulo: string; corpo: string }
): Promise<string | null> {
  return null;
}

export async function cancelarAvisoDescanso(_id: string) {}
