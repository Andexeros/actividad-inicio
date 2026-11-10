import "server-only";

import { notFound } from "next/navigation";
import { getServerAnonSupabase } from "@/lib/supabase/server";
import type { Iglesia, Sesion } from "@/lib/types";

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

export async function obtenerSesionActiva(iglesiaId: string): Promise<Sesion | null> {
  const { data, error } = await getServerAnonSupabase()
    .from("sesiones")
    .select("*")
    .eq("iglesia_id", iglesiaId)
    .eq("activa", true)
    .maybeSingle<Sesion>();
  if (error) throw new Error(`No se pudo cargar la sesión: ${error.message}`);
  return data;
}

/** Iglesia + sesión activa para una página `/[iglesia]/...`; 404 si el slug no existe. */
export async function cargarIglesiaYSesion(slug: string) {
  const iglesia = await buscarIglesia(slug);
  if (!iglesia) notFound();
  const sesion = await obtenerSesionActiva(iglesia.id);
  return { iglesia, sesion };
}
