import type { Fase, Sesion } from "./types";

/**
 * Máquina de estados de la actividad. Pura (sin base de datos) para poder probarla
 * y para que host y admin muestren exactamente los mismos botones.
 *
 * lobby ─abrir─▶ fase1_respondiendo (P1 → P2 → P3, abrir/cerrar entrada)
 *       ─construir─▶ fase1_muro ─clase─▶ entre_fases ─fase 2─▶ fase2
 *       ─derribar─▶ derrumbe ─final─▶ final
 */

export type Accion =
  | "abrir_entrada"
  | "siguiente_pregunta"
  | "cerrar_entrada"
  | "reabrir_entrada"
  | "construir_muro"
  | "empezar_clase"
  | "pasar_fase2"
  | "derribar"
  | "pantalla_final";

export const ETIQUETA_ACCION: Record<Accion, string> = {
  abrir_entrada: "Abrir entrada",
  siguiente_pregunta: "Siguiente pregunta",
  cerrar_entrada: "Cerrar respuestas",
  reabrir_entrada: "Reabrir respuestas",
  construir_muro: "Construir el muro",
  empezar_clase: "Dar la clase",
  pasar_fase2: "Pasar a fase 2",
  derribar: "Derribar",
  pantalla_final: "Pantalla final",
};

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

export function accionesDisponibles(
  s: EstadoSesion,
  totalPreguntas: number,
): { principal: Accion | null; secundarias: Accion[] } {
  const hayOtraPregunta = s.pregunta_actual < totalPreguntas - 1;
  switch (s.fase) {
    case "lobby":
      return { principal: "abrir_entrada", secundarias: [] };
    case "fase1_respondiendo":
      if (s.entrada_abierta) {
        return hayOtraPregunta
          ? { principal: "siguiente_pregunta", secundarias: ["cerrar_entrada"] }
          : { principal: "cerrar_entrada", secundarias: [] };
      }
      return {
        principal: "construir_muro",
        secundarias: hayOtraPregunta ? ["siguiente_pregunta", "reabrir_entrada"] : ["reabrir_entrada"],
      };
    case "fase1_muro":
      return { principal: "empezar_clase", secundarias: ["pasar_fase2"] };
    case "entre_fases":
      return { principal: "pasar_fase2", secundarias: [] };
    case "fase2":
      return {
        principal: "derribar",
        secundarias: [s.entrada_abierta ? "cerrar_entrada" : "reabrir_entrada"],
      };
    case "derrumbe":
      return { principal: "pantalla_final", secundarias: [] };
    case "final":
      return { principal: null, secundarias: [] };
  }
}

export function accionPermitida(s: EstadoSesion, accion: Accion, totalPreguntas: number): boolean {
  const { principal, secundarias } = accionesDisponibles(s, totalPreguntas);
  return principal === accion || secundarias.includes(accion);
}

/**
 * Cambios a aplicar en la sesión. `construir_muro` además necesita la foto del muro,
 * que se arma en la base (función construir_muro).
 */
export function cambiosDeAccion(s: EstadoSesion, accion: Accion): Partial<EstadoSesion> {
  switch (accion) {
    case "abrir_entrada":
      return { fase: "fase1_respondiendo", pregunta_actual: 0, entrada_abierta: true };
    case "siguiente_pregunta":
      return { pregunta_actual: s.pregunta_actual + 1, entrada_abierta: true };
    case "cerrar_entrada":
      return { entrada_abierta: false };
    case "reabrir_entrada":
      return { entrada_abierta: true };
    case "construir_muro":
      return { fase: "fase1_muro", entrada_abierta: false };
    case "empezar_clase":
      return { fase: "entre_fases", entrada_abierta: false };
    case "pasar_fase2":
      return { fase: "fase2", pregunta_actual: 0, entrada_abierta: true };
    case "derribar":
      return { fase: "derrumbe", entrada_abierta: false };
    case "pantalla_final":
      return { fase: "final", entrada_abierta: false };
  }
}
