import { crearRng, type MuroLayout } from "./layout";

/**
 * Qué ladrillos tira cada golpe de la fase 2. Determinístico: con el mismo muro y la misma
 * semilla, el golpe N siempre tira los mismos ladrillos. Así, al recargar la TV con N
 * respuestas de fase 2, se reconstruye exactamente el mismo muro agujereado.
 *
 * Solo se tiran ladrillos "expuestos" (sin ladrillos encima): el muro se va desgastando
 * desde arriba y nunca quedan ladrillos flotando.
 */
export function crearPlanGolpes(layout: MuroLayout, semilla: number) {
  const ls = layout.ladrillos;
  const rng = crearRng(semilla ^ 0x9e3779b9);
  const quedan = new Set(ls.map((_, k) => k));

  const solapan = (a: number, b: number) =>
    Math.abs(ls[a].x - ls[b].x) < (ls[a].w + ls[b].w) / 2 - 1;

  // Para cada ladrillo: los de la fila de arriba que lo pisan, y sus vecinos de fila
  const arriba: number[][] = ls.map(() => []);
  const vecinos: number[][] = ls.map(() => []);
  ls.forEach((a, i) => {
    ls.forEach((b, j) => {
      if (i === j) return;
      if (b.fila === a.fila + 1 && solapan(i, j)) arriba[i].push(j);
      if (b.fila === a.fila && Math.abs(a.x - b.x) <= (a.w + b.w) / 2 + 1) vecinos[i].push(j);
    });
  });

  const centro = layout.izquierda + layout.ancho / 2;
  const expuesto = (k: number) => quedan.has(k) && arriba[k].every((j) => !quedan.has(j));

  /** Índices de los ladrillos que tira el próximo golpe (vacío si ya no quedan). */
  function siguiente(): number[] {
    const candidatos = [...quedan].filter(expuesto);
    if (candidatos.length === 0) return [];
    // Preferencia suave por el centro del muro (donde mira la gente), con azar
    const pesos = candidatos.map((k) => {
      const d = Math.abs(ls[k].x - centro) / (layout.ancho / 2);
      return 0.35 + (1 - Math.min(1, d)) + rng() * 0.8;
    });
    let mejor = 0;
    for (let k = 1; k < candidatos.length; k++) if (pesos[k] > pesos[mejor]) mejor = k;
    const primero = candidatos[mejor];
    quedan.delete(primero);
    const tirados = [primero];

    if (rng() < 0.55) {
      const otros = vecinos[primero].filter(expuesto);
      if (otros.length) {
        const segundo = otros[Math.floor(rng() * otros.length)];
        quedan.delete(segundo);
        tirados.push(segundo);
      }
    }
    return tirados;
  }

  return { siguiente, quedan: () => quedan.size };
}
