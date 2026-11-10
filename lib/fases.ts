import { actividad } from "@/config/actividad";
import type { Sesion } from "@/lib/types";

export type Entrada = { fase: 1 | 2; pregunta: number; texto: string };

/**
 * Qué pregunta acepta respuestas en este momento (o null si la entrada está cerrada).
 * Lo usan el celular y el servidor, para que ambos decidan igual.
 */
export function entradaActual(sesion: Pick<Sesion, "fase" | "pregunta_actual" | "entrada_abierta">): Entrada | null {
  if (!sesion.entrada_abierta) return null;
  if (sesion.fase === "fase1_respondiendo") {
    const texto = actividad.fase1.preguntas[sesion.pregunta_actual];
    return texto ? { fase: 1, pregunta: sesion.pregunta_actual, texto } : null;
  }
  if (sesion.fase === "fase2") {
    return { fase: 2, pregunta: 0, texto: actividad.fase2.pregunta };
  }
  return null;
}

/** Limpia el texto: espacios internos colapsados y bordes recortados. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}
