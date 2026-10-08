// Onde o login do Club fica salvo no celular (recomendação do guia do Expo para Supabase).
import 'expo-sqlite/localStorage/install';

export const armazenamentoDaSessao = globalThis.localStorage;
