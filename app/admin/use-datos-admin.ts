"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cargarAdmin, type DatosAdmin } from "@/lib/admin";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Datos del admin (todas las iglesias, incluidas las respuestas ocultas), siempre al día:
 * se recargan ante cualquier cambio de Realtime en sesiones/respuestas y cada 10 s.
 */
export function useDatosAdmin() {
  const [datos, setDatos] = useState<DatosAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recargar = useCallback(async () => {
    const r = await cargarAdmin();
    if (r.ok) {
      setDatos(r.datos);
      setError(null);
    } else setError(r.error);
  }, []);

  const recargarPronto = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void recargar(), 300);
  }, [recargar]);

  useEffect(() => {
    recargarPronto();
    const supabase = getBrowserSupabase();
    const canal = supabase
      .channel(`admin:${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sesiones" }, recargarPronto)
      .on("postgres_changes", { event: "*", schema: "public", table: "respuestas" }, recargarPronto)
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") recargarPronto();
      });
    const intervalo = setInterval(() => void recargar(), 10_000);
    return () => {
      clearInterval(intervalo);
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(canal);
    };
  }, [recargar, recargarPronto]);

  return { datos, error, recargar, setDatos };
}
