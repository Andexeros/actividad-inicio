"use server";

import { createHash } from "node:crypto";
import { actividad } from "@/config/actividad";
import { entradaActual, limpiarTexto } from "@/lib/fases";
import { tieneMalasPalabras } from "@/lib/filtro";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { Sesion } from "@/lib/types";

export type ResultadoEnvio =
  | { ok: true; restantes: number }
  | {
      ok: false;
      motivo: "cerrado" | "cambio" | "limite" | "invalido" | "error";
      mensaje: string;
    };

type Envio = {
  iglesiaId: string;
  sesionId: string;
  fase: number;
  pregunta: number;
  texto: string;
  dispositivo: string;
};

/**
 * Si las respuestas visibles de fase 2 llegaron a `respuestasParaDerribar`, pasa a "derrumbe".
 * El update es condicional (fase = 'fase2'): si dos celulares llegan juntos, cambia una sola vez.
 */
async function derribarSiLlego(sesionId: string) {
  const db = getServiceSupabase();
  const { count, error } = await db
    .from("respuestas")
    .select("id", { count: "exact", head: true })
    .eq("sesion_id", sesionId)
    .eq("fase", 2)
    .eq("visible", true);
  if (error || (count ?? 0) < actividad.fase2.respuestasParaDerribar) return;
  const { data: actual } = await db.from("sesiones").select("version").eq("id", sesionId).single<{ version: number }>();
  if (!actual) return;
  await db
    .from("sesiones")
    .update({ fase: "derrumbe", entrada_abierta: false, version: actual.version + 1 })
    .eq("id", sesionId)
    .eq("fase", "fase2");
}

function hashDispositivo(id: string): string {
  return createHash("sha256")
    .update(`${process.env.SESSION_SECRET ?? ""}:${id}`)
    .digest("hex")
    .slice(0, 32);
}

export async function enviarRespuesta(envio: Envio): Promise<ResultadoEnvio> {
  try {
    return await procesarEnvio(envio);
  } catch (e) {
    console.error("enviarRespuesta", e);
    return { ok: false, motivo: "error", mensaje: "No pudimos enviar. Probá de nuevo." };
  }
}

async function procesarEnvio(envio: Envio): Promise<ResultadoEnvio> {
  const texto = limpiarTexto(String(envio.texto ?? ""));
  const max = actividad.respuestas.maxCaracteres;
  if (texto.length === 0) {
    return { ok: false, motivo: "invalido", mensaje: "Escribí algo antes de enviar." };
  }
  if ([...texto].length > max) {
    return { ok: false, motivo: "invalido", mensaje: `Máximo ${max} caracteres.` };
  }
  if (typeof envio.dispositivo !== "string" || !/^[a-zA-Z0-9-]{8,64}$/.test(envio.dispositivo)) {
    return { ok: false, motivo: "invalido", mensaje: "Recargá la página e intentá de nuevo." };
  }

  const db = getServiceSupabase();

  const { data: sesion, error: errorSesion } = await db
    .from("sesiones")
    .select("id, iglesia_id, fase, pregunta_actual, entrada_abierta")
    .eq("iglesia_id", envio.iglesiaId)
    .eq("activa", true)
    .maybeSingle<Pick<Sesion, "id" | "iglesia_id" | "fase" | "pregunta_actual" | "entrada_abierta">>();

  if (errorSesion) {
    console.error("enviarRespuesta: sesión", errorSesion);
    return { ok: false, motivo: "error", mensaje: "No pudimos enviar. Probá de nuevo." };
  }
  const entrada = sesion ? entradaActual(sesion) : null;
  if (!sesion || !entrada) {
    return { ok: false, motivo: "cerrado", mensaje: "Las respuestas están cerradas." };
  }
  // El líder avanzó de pregunta (o reinició) justo mientras escribías
  if (sesion.id !== envio.sesionId || entrada.fase !== envio.fase || entrada.pregunta !== envio.pregunta) {
    return { ok: false, motivo: "cambio", mensaje: "La pregunta cambió. Mirá la nueva 👀" };
  }

  const dispositivo = hashDispositivo(envio.dispositivo);
  const maxPorPregunta = actividad.respuestas.maxPorPregunta;

  const { count, error: errorCount } = await db
    .from("respuestas")
    .select("id", { count: "exact", head: true })
    .eq("sesion_id", sesion.id)
    .eq("fase", entrada.fase)
    .eq("pregunta", entrada.pregunta)
    .eq("dispositivo", dispositivo);
  if (errorCount) {
    console.error("enviarRespuesta: count", errorCount);
    return { ok: false, motivo: "error", mensaje: "No pudimos enviar. Probá de nuevo." };
  }
  const enviadas = count ?? 0;
  if (enviadas >= maxPorPregunta) {
    return {
      ok: false,
      motivo: "limite",
      mensaje: `Ya mandaste ${maxPorPregunta} respuestas para esta pregunta. ¡Gracias!`,
    };
  }

  const filtrada = tieneMalasPalabras(texto);
  const { error: errorInsert } = await db.from("respuestas").insert({
    sesion_id: sesion.id,
    iglesia_id: sesion.iglesia_id,
    fase: entrada.fase,
    pregunta: entrada.pregunta,
    texto,
    visible: !filtrada,
    filtrada,
    dispositivo,
  });
  if (errorInsert) {
    console.error("enviarRespuesta: insert", errorInsert);
    return { ok: false, motivo: "error", mensaje: "No pudimos enviar. Probá de nuevo." };
  }

  // Las filtradas no llegan por Realtime (la anon key no las ve): avisamos al panel del líder
  if (filtrada) await db.rpc("tocar_sesion", { p_sesion: sesion.id });

  // Fase 2: al llegar al 100% de fuerza, el muro se derrumba solo
  if (entrada.fase === 2 && !filtrada) await derribarSiLlego(sesion.id);

  // Aunque se haya filtrado, respondemos OK: no le damos pistas a quien prueba el filtro.
  return { ok: true, restantes: maxPorPregunta - enviadas - 1 };
}
