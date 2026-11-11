import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Login del admin (/admin) por PIN, con una cookie firmada (HMAC).
 * La cookie incluye un hash corto del PIN vigente: si se cambia ADMIN_PIN, se cierra la sesión.
 */

const DURACION_S = 60 * 60 * 12; // 12 h
const COOKIE_ADMIN = "elmuro_admin";

type Token = { r: "admin"; p: string; e: number };

/**
 * Clave para firmar la cookie. Si no hay SESSION_SECRET, se deriva de un secreto de Supabase
 * que la integración de Vercel ya carga (así alcanza con cargar solo ADMIN_PIN).
 */
function secreto(): string {
  const base =
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || base.length < 16) {
    throw new Error("Falta SESSION_SECRET (o las claves de Supabase) en las variables de entorno");
  }
  // Derivada: no se usa el secreto de Supabase directamente como clave
  return createHash("sha256").update(`el-muro:cookies:${base}`).digest("base64url");
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

function pinesIguales(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function adminPin(): string | null {
  return process.env.ADMIN_PIN || null;
}

/** Demora fija ante un PIN incorrecto (frena el "probar todos los PIN"). */
export const esperarPorError = () => new Promise((r) => setTimeout(r, 900));

export async function iniciarAdmin(pin: string): Promise<boolean> {
  const vigente = adminPin();
  if (!vigente || !pinesIguales(pin, vigente)) return false;
  (await cookies()).set(COOKIE_ADMIN, crearToken({ r: "admin", p: huellaPin(vigente), e: Math.floor(Date.now() / 1000) + DURACION_S }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_S,
  });
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
