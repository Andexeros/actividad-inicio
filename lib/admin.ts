"use server";

/**
 * Acciones del panel /admin. Todas exigen la cookie de admin (ADMIN_PIN).
 * Para controlar fases y moderar se reutilizan las de lib/control.ts, que ya aceptan al admin.
 */

import { cerrarAdmin, esAdmin, esperarPorError, iniciarAdmin } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { Iglesia, Respuesta, Sesion } from "@/lib/types";

export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string };

const SIN_PERMISO = "Tu sesión de admin venció. Volvé a ingresar el PIN.";
const fallo = (error: string): { ok: false; error: string } => ({ ok: false, error });

export type IglesiaAdmin = Iglesia & { host_pin: string | null };
export type RespuestaAdmin = Respuesta;
export type DatosAdmin = {
  iglesias: IglesiaAdmin[];
  sesiones: Sesion[];
  respuestas: RespuestaAdmin[];
};

const RESERVADOS = new Set(["admin", "api", "tv", "host", "_next"]);

export async function loginAdmin(pin: string): Promise<Resultado> {
  try {
    if (!/^[0-9]{4,8}$/.test(pin) || !(await iniciarAdmin(pin))) {
      await esperarPorError();
      return fallo("PIN incorrecto.");
    }
    return { ok: true, datos: undefined };
  } catch (e) {
    console.error("loginAdmin", e);
    return fallo("No se pudo ingresar. Revisá la configuración del servidor.");
  }
}

export async function logoutAdmin(): Promise<void> {
  await cerrarAdmin();
}

/** Iglesias, sesiones activas y TODAS las respuestas de esas sesiones (incluidas las ocultas). */
export async function cargarAdmin(): Promise<Resultado<DatosAdmin>> {
  try {
    if (!(await esAdmin())) return fallo(SIN_PERMISO);
    const db = getServiceSupabase();
    const [ig, se] = await Promise.all([
      db.from("iglesias").select("id, slug, nombre, host_pin, created_at").order("nombre"),
      db.from("sesiones").select("*").eq("activa", true),
    ]);
    if (ig.error) throw new Error(ig.error.message);
    if (se.error) throw new Error(se.error.message);
    const sesiones = (se.data ?? []) as Sesion[];
    let respuestas: RespuestaAdmin[] = [];
    if (sesiones.length) {
      const { data, error } = await db
        .from("respuestas")
        .select("id, sesion_id, iglesia_id, fase, pregunta, texto, visible, filtrada, created_at")
        .in(
          "sesion_id",
          sesiones.map((s) => s.id),
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw new Error(error.message);
      respuestas = (data ?? []) as RespuestaAdmin[];
    }
    return { ok: true, datos: { iglesias: (ig.data ?? []) as IglesiaAdmin[], sesiones, respuestas } };
  } catch (e) {
    console.error("cargarAdmin", e);
    return fallo("No se pudieron cargar los datos.");
  }
}

type DatosIglesia = { slug: string; nombre: string; pin: string };

function validarIglesia(d: DatosIglesia): string | null {
  const slug = d.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(slug)) {
    return "El slug va en minúsculas, sin espacios ni tildes (letras, números y guiones; hasta 30).";
  }
  if (RESERVADOS.has(slug)) return `"${slug}" está reservado. Elegí otro.`;
  const nombre = d.nombre.trim();
  if (nombre.length < 1 || nombre.length > 60) return "El nombre debe tener entre 1 y 60 caracteres.";
  if (d.pin && !/^[0-9]{4,8}$/.test(d.pin.trim())) return "El PIN debe tener entre 4 y 8 números (o quedar vacío).";
  return null;
}

function mensajeDb(e: { code?: string; message: string }): string {
  if (e.code === "23505") return "Ya hay una iglesia con ese slug.";
  return "No se pudo guardar. Revisá los datos.";
}

export async function crearIglesia(d: DatosIglesia): Promise<Resultado<IglesiaAdmin>> {
  try {
    if (!(await esAdmin())) return fallo(SIN_PERMISO);
    const invalido = validarIglesia(d);
    if (invalido) return fallo(invalido);
    const { data, error } = await getServiceSupabase()
      .from("iglesias")
      .insert({ slug: d.slug.trim().toLowerCase(), nombre: d.nombre.trim(), host_pin: d.pin.trim() || null })
      .select("id, slug, nombre, host_pin, created_at")
      .single<IglesiaAdmin>();
    if (error) return fallo(mensajeDb(error));
    return { ok: true, datos: data };
  } catch (e) {
    console.error("crearIglesia", e);
    return fallo("No se pudo crear la iglesia.");
  }
}

export async function editarIglesia(id: string, d: DatosIglesia): Promise<Resultado<IglesiaAdmin>> {
  try {
    if (!(await esAdmin())) return fallo(SIN_PERMISO);
    const invalido = validarIglesia(d);
    if (invalido) return fallo(invalido);
    const { data, error } = await getServiceSupabase()
      .from("iglesias")
      .update({ slug: d.slug.trim().toLowerCase(), nombre: d.nombre.trim(), host_pin: d.pin.trim() || null })
      .eq("id", id)
      .select("id, slug, nombre, host_pin, created_at")
      .single<IglesiaAdmin>();
    if (error) return fallo(mensajeDb(error));
    return { ok: true, datos: data };
  } catch (e) {
    console.error("editarIglesia", e);
    return fallo("No se pudo guardar la iglesia.");
  }
}
