"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { respuestasParaControl, type RespuestaHost } from "@/lib/control";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Respuestas de la sesión activa INCLUIDAS las ocultas (vía servidor, con PIN).
 * Se recargan cuando:
 *  - llega cualquier cambio de respuestas por Realtime (las visibles),
 *  - cambia `rev` (moderación o respuestas filtradas, que Realtime no muestra),
 *  - cada 15 s por las dudas.
 */
export function useRespuestasControl(iglesiaId: string, sesionId: string | null, rev: number) {
  const [respuestas, setRespuestas] = useState<RespuestaHost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recargar = useCallback(async () => {
    const r = await respuestasParaControl(iglesiaId);
    if (r.ok) {
      setRespuestas(r.datos.respuestas);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [iglesiaId]);

  const recargarPronto = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void recargar(), 250);
  }, [recargar]);

  useEffect(() => {
    // Se programa (no se llama directo) para no encadenar renders dentro del efecto
    recargarPronto();
  }, [recargarPronto, sesionId, rev]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const canal = supabase
      .channel(`control:${iglesiaId}:${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "respuestas", filter: `iglesia_id=eq.${iglesiaId}` },
        recargarPronto,
      )
      .subscribe();
    const intervalo = setInterval(() => void recargar(), 15_000);
    return () => {
      clearInterval(intervalo);
      if (temporizador.current) clearTimeout(temporizador.current);
      void supabase.removeChannel(canal);
    };
  }, [iglesiaId, recargar, recargarPronto]);

  /** Cambio optimista (se confirma con la próxima recarga). */
  const marcarVisible = useCallback((id: string, visible: boolean) => {
    setRespuestas((prev) => prev.map((r) => (r.id === id ? { ...r, visible } : r)));
  }, []);

  const actuales = sesionId ? respuestas.filter((r) => r.sesion_id === sesionId) : [];
  return { respuestas: actuales, error, recargar, marcarVisible };
}
