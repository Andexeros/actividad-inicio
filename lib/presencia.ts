"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Supabase Presence por iglesia.
 * - Celular: `usePresencia(id, () => idDispositivo())` → se anota como conectado.
 * - TV: `usePresencia(id)` → solo cuenta (no se anota).
 */
export function usePresencia(iglesiaId: string, clave?: () => string): number {
  const [conectados, setConectados] = useState(0);
  const anotarse = Boolean(clave);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const key = clave ? clave() : `tv-${Math.random().toString(36).slice(2)}`;
    const canal = supabase.channel(`presencia:${iglesiaId}`, { config: { presence: { key } } });
    canal
      .on("presence", { event: "sync" }, () => {
        setConectados(Object.keys(canal.presenceState()).length);
      })
      .subscribe(async (estado) => {
        if (estado === "SUBSCRIBED" && anotarse) {
          await canal.track({ desde: Date.now() });
        }
      });
    return () => {
      void supabase.removeChannel(canal);
    };
    // `clave` es estable por dispositivo; no la ponemos como dependencia a propósito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iglesiaId, anotarse]);

  return conectados;
}
