import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase/server";

/**
 * Autenticación por PIN con cookies firmadas (HMAC con SESSION_SECRET).
 * - Host: una cookie por iglesia. Incluye un hash corto del PIN vigente, así que
 *   cambiar el PIN de una iglesia cierra las sesiones abiertas de sus líderes.
 * - Admin: una cookie; también puede controlar cualquier iglesia.
 */

const DURACION_S = 60 * 60 * 12; // 12 h
const COOKIE_ADMIN = "elmuro_admin";
const cookieHost = (iglesiaId: string) => `elmuro_host_${iglesiaId.replace(/-/g, "")}`;

type Token = { r: "host" | "admin"; i?: string; p: string; e: number };

function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Falta SESSION_SECRET (mínimo 16 caracteres) en las variables de entorno");
  }
  return s;
}

function firmar(datos: string): string {
  return createHmac("sha256", secreto()).update(datos).digest("base64url");
}

function huellaPin(pin: string): string {
  return createHash("sha256").update(`pin:${pin}`).digest("base64url").slice(0, 10);
}

function crearToken(token: Token): string {
  const datos = Buffer.from(JSON.stringify(token)).toString("base64url");
  return `${datos}.${firmar(datos)}`;
}

function leerToken(valor: string | undefined): Token | null {
  if (!valor) return null;
  const [datos, firma] = valor.split(".");
  if (!datos || !firma) return null;
  const esperada = Buffer.from(firmar(datos));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const token = JSON.parse(Buffer.from(datos, "base64url").toString()) as Token;
    return token.e > Date.now() / 1000 ? token : null;
  } catch {
    return null;
  }
}

export function pinesIguales(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** PIN vigente del líder de una iglesia: el propio o el global HOST_PIN. */
export async function pinDeIglesia(iglesiaId: string): Promise<string | null> {
  const { data, error } = await getServiceSupabase()
    .from("iglesias")
    .select("host_pin")
    .eq("id", iglesiaId)
    .maybeSingle<{ host_pin: string | null }>();
  if (error) throw new Error(error.message);
  return data?.host_pin || process.env.HOST_PIN || null;
}

function adminPin(): string | null {
  return process.env.ADMIN_PIN || null;
}

const opcionesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACION_S,
};

const expiracion = () => Math.floor(Date.now() / 1000) + DURACION_S;

/** Demora fija ante un PIN incorrecto (frena el "probar todos los PIN"). */
export const esperarPorError = () => new Promise((r) => setTimeout(r, 900));

export async function iniciarHost(iglesiaId: string, pin: string): Promise<boolean> {
  const vigente = await pinDeIglesia(iglesiaId);
  if (!vigente || !pinesIguales(pin, vigente)) return false;
  (await cookies()).set(
    cookieHost(iglesiaId),
    crearToken({ r: "host", i: iglesiaId, p: huellaPin(vigente), e: expiracion() }),
    opcionesCookie,
  );
  return true;
}

export async function cerrarHost(iglesiaId: string) {
  (await cookies()).delete(cookieHost(iglesiaId));
}

export async function iniciarAdmin(pin: string): Promise<boolean> {
  const vigente = adminPin();
  if (!vigente || !pinesIguales(pin, vigente)) return false;
  (await cookies()).set(
    COOKIE_ADMIN,
    crearToken({ r: "admin", p: huellaPin(vigente), e: expiracion() }),
    opcionesCookie,
  );
  return true;
}

export async function cerrarAdmin() {
  (await cookies()).delete(COOKIE_ADMIN);
}

export async function esAdmin(): Promise<boolean> {
  const token = leerToken((await cookies()).get(COOKIE_ADMIN)?.value);
  const vigente = adminPin();
  return Boolean(token && token.r === "admin" && vigente && token.p === huellaPin(vigente));
}

/** ¿Puede controlar esta iglesia? (líder con su PIN vigente, o admin) */
export async function puedeControlar(iglesiaId: string): Promise<boolean> {
  if (await esAdmin()) return true;
  const token = leerToken((await cookies()).get(cookieHost(iglesiaId))?.value);
  if (!token || token.r !== "host" || token.i !== iglesiaId) return false;
  const vigente = await pinDeIglesia(iglesiaId);
  return Boolean(vigente && token.p === huellaPin(vigente));
}
