// Avatar escolhido, compartilhado entre telas (cabeçalho do Início e aba Usuário):
// trocar em um lugar atualiza o outro na hora.
import { useSyncExternalStore } from 'react';

import { repo } from '@/db';
import { obterAvatar, type Avatar } from '@/lib/avatares';

let atual: string | null = null;
let carregou = false;
const ouvintes = new Set<() => void>();

function notificar() {
  for (const f of ouvintes) f();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  if (!carregou) {
    carregou = true;
    repo.obterPerfil().then((p) => {
      atual = p.avatar;
      notificar();
    });
  }
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const ler = () => atual;

export function useAvatarAtual(): Avatar {
  return obterAvatar(useSyncExternalStore(assinar, ler, ler));
}

export async function escolherAvatar(id: string) {
  atual = id;
  notificar();
  await repo.salvarPerfil({ avatar: id });
}
