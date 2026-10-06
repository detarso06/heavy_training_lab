// Rostos do Heavy Guy que o usuário pode escolher como foto de perfil.
// Os recortes vêm da folha de figurinhas (assets/images/avatares/avatar-NN.png).
import type { ImageSourcePropType } from 'react-native';

export interface Avatar {
  id: string;
  nome: string;
  imagem: ImageSourcePropType;
}

export const AVATAR_PADRAO = 'classico';

export const AVATARES: Avatar[] = [
  { id: AVATAR_PADRAO, nome: 'Clássico', imagem: require('@/../assets/images/mascote.png') },
  { id: 'esforco', nome: 'Esforço', imagem: require('@/../assets/images/avatares/avatar-01.png') },
  { id: 'gargalhada', nome: 'Gargalhada', imagem: require('@/../assets/images/avatares/avatar-02.png') },
  { id: 'bravo', nome: 'Bravo', imagem: require('@/../assets/images/avatares/avatar-03.png') },
  { id: 'piscadinha', nome: 'Piscadinha', imagem: require('@/../assets/images/avatares/avatar-04.png') },
  { id: 'exausto', nome: 'Exausto', imagem: require('@/../assets/images/avatares/avatar-05.png') },
  { id: 'assustado', nome: 'Assustado', imagem: require('@/../assets/images/avatares/avatar-06.png') },
  { id: 'malandro', nome: 'Malandro', imagem: require('@/../assets/images/avatares/avatar-07.png') },
  { id: 'cansado', nome: 'Cansado', imagem: require('@/../assets/images/avatares/avatar-08.png') },
  { id: 'zoeiro', nome: 'Zoeiro', imagem: require('@/../assets/images/avatares/avatar-09.png') },
  { id: 'desconfiado', nome: 'Desconfiado', imagem: require('@/../assets/images/avatares/avatar-10.png') },
  { id: 'determinado', nome: 'Determinado', imagem: require('@/../assets/images/avatares/avatar-11.png') },
  { id: 'sonolento', nome: 'Sonolento', imagem: require('@/../assets/images/avatares/avatar-12.png') },
];

export function obterAvatar(id: string | null | undefined): Avatar {
  return AVATARES.find((a) => a.id === id) ?? AVATARES[0];
}
