import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Las variables pueden venir con distintos nombres según cómo se cargaron
 * (a mano con .env.example, o desde la integración Supabase de Vercel).
 * Se usa la primera que exista.
 */
function primera(nombres: string[]): string | undefined {
  for (const n of nombres) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

function requerida(nombres: string[]): string {
  const v = primera(nombres);
  if (!v) throw new Error(`Falta la variable de entorno ${nombres[0]} (ver .env.example)`);
  return v;
}

const URL = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"];
const CLAVE_PUBLICA = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
];
const CLAVE_SERVICIO = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"];

export function supabaseConfigurado(): boolean {
  return Boolean(primera(URL) && primera(CLAVE_PUBLICA));
}

/** Cliente con anon key en el servidor: mismas reglas RLS que el navegador. */
export function getServerAnonSupabase(): SupabaseClient {
  return createClient(requerida(URL), requerida(CLAVE_PUBLICA), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente con service role: saltea RLS. Usar SOLO en Server Actions / Route Handlers
 * después de validar el PIN (o para insertar respuestas con filtro y rate limit).
 */
export function getServiceSupabase(): SupabaseClient {
  return createClient(requerida(URL), requerida(CLAVE_SERVICIO), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
