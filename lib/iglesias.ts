import "server-only";

import { getServerAnonSupabase } from "@/lib/supabase/server";
import type { Iglesia } from "@/lib/types";

export async function listarIglesias(): Promise<Iglesia[]> {
  const { data, error } = await getServerAnonSupabase()
    .from("iglesias")
    .select("id, slug, nombre, created_at")
    .order("nombre");
  if (error) throw new Error(`No se pudieron cargar las iglesias: ${error.message}`);
  return data ?? [];
}

export async function buscarIglesia(slug: string): Promise<Iglesia | null> {
  const normalizado = slug.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(normalizado)) return null;
  const { data, error } = await getServerAnonSupabase()
    .from("iglesias")
    .select("id, slug, nombre, created_at")
    .eq("slug", normalizado)
    .maybeSingle();
  if (error) throw new Error(`No se pudo cargar la iglesia: ${error.message}`);
  return data;
}
