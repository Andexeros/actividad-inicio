"use server";

/**
 * Acciones de control (host y admin). Todas validan el PIN vía cookie antes de
 * tocar la base con service role.
 */

import { actividad } from "@/config/actividad";
import { cerrarHost, esperarPorError, iniciarHost, puedeControlar } from "@/lib/auth";
import { accionPermitida, cambiosDeAccion, type Accion } from "@/lib/maquina";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { Respuesta, Sesion } from "@/lib/types";

export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string };

const TOTAL_PREGUNTAS = actividad.fase1.preguntas.length;
const SIN_PERMISO = "Tu sesión de líder venció. Volvé a ingresar el PIN.";

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

export async function loginHost(iglesiaId: string, pin: string): Promise<Resultado> {
  try {
    if (!/^[0-9]{4,8}$/.test(pin) || !(await iniciarHost(iglesiaId, pin))) {
      await esperarPorError();
      return fallo("PIN incorrecto.");
    }
    return { ok: true, datos: undefined };
  } catch (e) {
    console.error("loginHost", e);
    return fallo("No se pudo ingresar. Revisá la configuración del servidor.");
  }
}

export async function logoutHost(iglesiaId: string): Promise<void> {
  await cerrarHost(iglesiaId);
}

/**
 * Ejecuta un botón de la máquina de estados. `versionVista` evita que dos líderes
 * (o host + admin) apliquen la misma acción dos veces: si la sesión cambió, se rechaza.
 */
export async function ejecutarAccion(
  iglesiaId: string,
  accion: Accion,
  versionVista: number,
): Promise<Resultado<Sesion>> {
  try {
    if (!(await puedeControlar(iglesiaId))) return fallo(SIN_PERMISO);
    const sesion = await sesionActiva(iglesiaId);
    if (!sesion) return fallo("No hay una sesión activa.");
    if (sesion.version !== versionVista) {
      return fallo("La pantalla cambió mientras tanto (¿otro líder?). Revisá y volvé a intentar.");
    }
    if (!accionPermitida(sesion, accion, TOTAL_PREGUNTAS)) {
      return fallo("Esa acción no corresponde en esta fase.");
    }

    const db = getServiceSupabase();
    if (accion === "construir_muro") {
      const { data, error } = await db.rpc("construir_muro", {
        p_sesion: sesion.id,
        p_version: sesion.version,
      });
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as Sesion[];
      if (!filas.length) return fallo("La pantalla cambió mientras tanto. Volvé a intentar.");
      return { ok: true, datos: filas[0] };
    }

    const { data, error } = await db
      .from("sesiones")
      .update({ ...cambiosDeAccion(sesion, accion), version: sesion.version + 1 })
      .eq("id", sesion.id)
      .eq("version", sesion.version)
      .select("*")
      .returns<Sesion[]>();
    if (error) throw new Error(error.message);
    if (!data?.length) return fallo("La pantalla cambió mientras tanto. Volvé a intentar.");
    return { ok: true, datos: data[0] };
  } catch (e) {
    console.error("ejecutarAccion", e);
    return fallo("No se pudo aplicar el cambio. Probá de nuevo.");
  }
}

export type RespuestaHost = Respuesta;

/** Todas las respuestas (incluidas las ocultas) de la sesión activa. */
export async function respuestasParaControl(
  iglesiaId: string,
): Promise<Resultado<{ sesionId: string | null; respuestas: RespuestaHost[] }>> {
  try {
    if (!(await puedeControlar(iglesiaId))) return fallo(SIN_PERMISO);
    const sesion = await sesionActiva(iglesiaId);
    if (!sesion) return { ok: true, datos: { sesionId: null, respuestas: [] } };
    const { data, error } = await getServiceSupabase()
      .from("respuestas")
      .select("id, sesion_id, iglesia_id, fase, pregunta, texto, visible, filtrada, created_at")
      .eq("sesion_id", sesion.id)
      .order("created_at", { ascending: false })
      .limit(2000)
      .returns<RespuestaHost[]>();
    if (error) throw new Error(error.message);
    return { ok: true, datos: { sesionId: sesion.id, respuestas: data ?? [] } };
  } catch (e) {
    console.error("respuestasParaControl", e);
    return fallo("No se pudieron cargar las respuestas.");
  }
}

export async function moderarRespuesta(
  iglesiaId: string,
  respuestaId: string,
  visible: boolean,
): Promise<Resultado> {
  try {
    if (!(await puedeControlar(iglesiaId))) return fallo(SIN_PERMISO);
    const db = getServiceSupabase();
    const { data, error } = await db
      .from("respuestas")
      .update({ visible })
      .eq("id", respuestaId)
      .eq("iglesia_id", iglesiaId)
      .select("sesion_id")
      .returns<{ sesion_id: string }[]>();
    if (error) throw new Error(error.message);
    if (!data?.length) return fallo("No se encontró la respuesta.");
    // Avisa a la TV que vuelva a leer (Realtime no le avisa cuando una fila se oculta)
    await db.rpc("tocar_sesion", { p_sesion: data[0].sesion_id });
    return { ok: true, datos: undefined };
  } catch (e) {
    console.error("moderarRespuesta", e);
    return fallo("No se pudo cambiar la respuesta.");
  }
}

export async function reiniciarActividad(iglesiaId: string): Promise<Resultado<Sesion>> {
  try {
    if (!(await puedeControlar(iglesiaId))) return fallo(SIN_PERMISO);
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
