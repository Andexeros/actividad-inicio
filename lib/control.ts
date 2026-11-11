"use server";

/**
 * Control de la actividad desde la TV de cada iglesia: avanzar/retroceder y reiniciar.
 * Sin PIN a propósito (pedido de simplicidad): cualquiera con la dirección de la TV
 * puede avanzarla. Las respuestas siguen pasando por el filtro y el rate limit.
 */

import { estadoDePaso, PASO_MURO, PASOS, pasoActual } from "@/lib/maquina";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { Sesion } from "@/lib/types";

export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string };


function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function sesionActiva(iglesiaId: string): Promise<Sesion | null> {
  const { data, error } = await getServiceSupabase()
    .from("sesiones")
    .select("*")
    .eq("iglesia_id", iglesiaId)
    .eq("activa", true)
    .maybeSingle<Sesion>();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Avanza (+1) o retrocede (-1) un paso de la actividad (ver PASOS en lib/maquina.ts).
 * `versionVista` evita que un doble clic (o dos pantallas a la vez) mueva dos pasos:
 * si la sesión cambió mientras tanto, se rechaza.
 */
export async function moverPaso(
  iglesiaId: string,
  direccion: 1 | -1,
  versionVista: number,
): Promise<Resultado<Sesion>> {
  try {
    const sesion = await sesionActiva(iglesiaId);
    if (!sesion) return fallo("No hay una sesión activa.");
    if (sesion.version !== versionVista) {
      return fallo("La pantalla cambió recién. Mirá en qué paso está y volvé a intentar.");
    }
    const actual = pasoActual(sesion);
    const destino = actual + direccion;
    if (destino < 0) return fallo("Ya estás en el primer paso.");
    if (destino >= PASOS.length) return fallo("Ya estás en el último paso.");

    const db = getServiceSupabase();
    // Al llegar al muro desde la última pregunta, se construye con las respuestas visibles
    if (destino === PASO_MURO && direccion === 1) {
      const { data, error } = await db.rpc("construir_muro", {
        p_sesion: sesion.id,
        p_version: sesion.version,
      });
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Sesion[];
      if (!filas.length) return fallo("La pantalla cambió recién. Volvé a intentar.");
      return { ok: true, datos: filas[0] };
    }

    const cambios: Partial<Sesion> = { ...estadoDePaso(destino), version: sesion.version + 1 };
    // Volver a las preguntas (o al inicio) desarma el muro: al avanzar se arma de nuevo
    if (destino < PASO_MURO) {
      cambios.muro = null;
      cambios.muro_construido_at = null;
    }
    const { data, error } = await db
      .from("sesiones")
      .update(cambios)
      .eq("id", sesion.id)
      .eq("version", sesion.version)
      .select("*")
      .returns<Sesion[]>();
    if (error) throw new Error(error.message);
    if (!data?.length) return fallo("La pantalla cambió recién. Volvé a intentar.");
    return { ok: true, datos: data[0] };
  } catch (e) {
    console.error("moverPaso", e);
    return fallo("No se pudo cambiar de paso. Probá de nuevo.");
  }
}

export async function reiniciarActividad(iglesiaId: string): Promise<Resultado<Sesion>> {
  try {
    const { data, error } = await getServiceSupabase().rpc("reiniciar_sesion", {
      p_iglesia: iglesiaId,
    });
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as Sesion[];
    if (!filas.length) throw new Error("reiniciar_sesion no devolvió la sesión");
    return { ok: true, datos: filas[0] };
  } catch (e) {
    console.error("reiniciarActividad", e);
    return fallo("No se pudo reiniciar.");
  }
}
