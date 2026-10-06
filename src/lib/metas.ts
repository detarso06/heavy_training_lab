// Metas de cardio (semanal, recomeça na segunda como o rodízio) e água (diária).
import { inicioDaSemana } from '@/lib/rodizio';

/** "AAAA-MM-DD" no horário local. */
export function dataLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function periodoDoCardio(hoje: Date) {
  return dataLocal(new Date(inicioDaSemana(hoje)));
}

export function periodoDaAgua(hoje: Date) {
  return dataLocal(hoje);
}

/** 135 → "2h 15min"; 45 → "45 min"; 120 → "2h". */
export function formatarMinutos(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}min`;
}

/** 1500 → "1,5 L". */
export function formatarLitros(ml: number) {
  const litros = ml / 1000;
  return `${litros.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} L`;
}

/** Aceita "1,75" ou "1.75"; vazio ou inválido vira null. */
export function lerNumero(texto: string): number | null {
  const n = Number(texto.trim().replace(',', '.'));
  return texto.trim() && Number.isFinite(n) && n >= 0 ? n : null;
}
