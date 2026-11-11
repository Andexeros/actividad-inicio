import type { Fase, Sesion } from "./types";

/**
 * Fases de la actividad y su recorrido como pasos lineales (Avanzar / Retroceder).
 * Pura (sin base de datos) para que TV y panel del líder decidan igual.
 */

export const ETIQUETA_FASE: Record<Fase, string> = {
  lobby: "Inicio",
  fase1_respondiendo: "Fase 1 · Respondiendo",
  fase1_muro: "Fase 1 · Muro construido",
  entre_fases: "Clase (entre fases)",
  fase2: "Fase 2 · Derribando",
  derrumbe: "Derrumbe",
  final: "Final",
};

type EstadoSesion = Pick<Sesion, "fase" | "pregunta_actual" | "entrada_abierta">;

// ───────────────────────── Pasos lineales (Avanzar / Retroceder) ─────────────────────────
//
// La actividad como una línea de pasos. Cada iglesia avanza o retrocede a su ritmo.
// Abrir/cerrar la entrada es automático: las preguntas y la fase 2 reciben respuestas.

export const PASOS = [
  "Inicio",
  "Pregunta 1",
  "Pregunta 2",
  "Pregunta 3",
  "Muro",
  "Clase",
  "Fase 2",
  "Derrumbe",
  "Final",
] as const;

/** Índice del paso del muro (al llegar se construye con las respuestas visibles). */
export const PASO_MURO = 4;

/** En qué paso está una sesión. */
export function pasoActual(s: EstadoSesion): number {
  switch (s.fase) {
    case "lobby":
      return 0;
    case "fase1_respondiendo":
      return 1 + Math.min(s.pregunta_actual, 2);
    case "fase1_muro":
      return 4;
    case "entre_fases":
      return 5;
    case "fase2":
      return 6;
    case "derrumbe":
      return 7;
    case "final":
      return 8;
  }
}

/** Estado de la sesión para un paso (el muro del paso 4 se arma aparte, en la base). */
export function estadoDePaso(paso: number): EstadoSesion {
  if (paso >= 1 && paso <= 3) return { fase: "fase1_respondiendo", pregunta_actual: paso - 1, entrada_abierta: true };
  const tabla: Record<number, EstadoSesion> = {
    0: { fase: "lobby", pregunta_actual: 0, entrada_abierta: false },
    4: { fase: "fase1_muro", pregunta_actual: 2, entrada_abierta: false },
    5: { fase: "entre_fases", pregunta_actual: 0, entrada_abierta: false },
    6: { fase: "fase2", pregunta_actual: 0, entrada_abierta: true },
    7: { fase: "derrumbe", pregunta_actual: 0, entrada_abierta: false },
    8: { fase: "final", pregunta_actual: 0, entrada_abierta: false },
  };
  return tabla[paso];
}
