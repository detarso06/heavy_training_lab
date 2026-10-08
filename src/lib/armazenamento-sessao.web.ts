// No navegador o localStorage já existe (e o expo-sqlite não é usado no web).
export const armazenamentoDaSessao = globalThis.localStorage;
