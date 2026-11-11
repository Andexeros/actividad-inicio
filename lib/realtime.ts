"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { Respuesta, Sesion } from "@/lib/types";

const COLUMNAS_SESION =
  "id, iglesia_id, fase, pregunta_actual, entrada_abierta, activa, muro, muro_construido_at, version, rev_respuestas, created_at, updated_at";
const COLUMNAS_RESPUESTA = "id, sesion_id, iglesia_id, fase, pregunta, texto, visible, filtrada, created_at";

function idCanal(prefijo: string) {
  return `${prefijo}:${Math.random().toString(36).slice(2, 10)}`;
}

export type EstadoConexion = "conectando" | "conectado" | "desconectado";

/**
 * Sesión activa de una iglesia, en vivo.
 * Ante cualquier cambio en `sesiones` de esa iglesia vuelve a leer la activa
 * (así también detecta "reiniciar", que desactiva una y crea otra).
 */
export function useSesionActiva(iglesiaId: string, inicial: Sesion | null) {
  const [sesion, setSesion] = useState<Sesion | null>(inicial);
  const [conexion, setConexion] = useState<EstadoConexion>("conectando");

  const recargar = useCallback(async () => {
    const { data, error } = await getBrowserSupabase()
      .from("sesiones")
      .select(COLUMNAS_SESION)
      .eq("iglesia_id", iglesiaId)
      .eq("activa", true)
      .maybeSingle<Sesion>();
    if (!error) setSesion(data);
  }, [iglesiaId]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let yaConectado = false;
    const canal = supabase
      .channel(idCanal(`sesion:${iglesiaId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sesiones", filter: `iglesia_id=eq.${iglesiaId}` },
        (payload) => {
          const nueva = payload.new as Sesion | undefined;
          // Camino rápido: update de la sesión activa (trae la fila completa)
          if (payload.eventType === "UPDATE" && nueva?.activa && nueva.id) {
            setSesion(nueva);
            return;
          }
          // Insert (reinicio), desactivación, etc. → leer la activa
          void recargar();
        },
      )
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          setConexion("conectado");
          // Al (re)conectar puede haberse perdido algún cambio
          if (yaConectado) void recargar();
          yaConectado = true;
        } else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT" || estado === "CLOSED") {
          setConexion("desconectado");
        }
      });

    const alVolver = () => {
      if (document.visibilityState === "visible") void recargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      void supabase.removeChannel(canal);
    };
  }, [iglesiaId, recargar]);

  return { sesion, setSesion, conexion, recargar };
}

/**
 * Respuestas visibles de una sesión, en vivo (orden de llegada).
 * Se recargan completas cuando cambia `rev` (rev_respuestas de la sesión: moderación, etc.).
 */
export function useRespuestas(iglesiaId: string, sesionId: string | null, rev: number) {
  const [respuestas, setRespuestas] = useState<Respuesta[]>([]);
  /** Sesión cuya carga inicial ya terminó (para distinguir "0 respuestas" de "todavía cargando"). */
  const [cargadasDe, setCargadasDe] = useState<string | null>(null);
  const sesionRef = useRef(sesionId);
  useEffect(() => {
    sesionRef.current = sesionId;
  }, [sesionId]);

  const recargar = useCallback(async () => {
    if (!sesionId) return;
    const { data, error } = await getBrowserSupabase()
      .from("respuestas")
      .select(COLUMNAS_RESPUESTA)
      .eq("sesion_id", sesionId)
      .order("created_at", { ascending: true })
      .limit(2000)
      .returns<Respuesta[]>();
    if (!error && sesionRef.current === sesionId) {
      setRespuestas(data ?? []);
      setCargadasDe(sesionId);
    }
  }, [sesionId]);

  // Carga inicial y cada vez que cambia rev
  useEffect(() => {
    void recargar();
  }, [recargar, rev]);

  useEffect(() => {
    if (!sesionId) return;
    const supabase = getBrowserSupabase();
    let yaConectado = false;
    const canal = supabase
      .channel(idCanal(`respuestas:${iglesiaId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "respuestas", filter: `iglesia_id=eq.${iglesiaId}` },
        (payload) => {
          const fila = payload.new as Respuesta | undefined;
          if (!fila?.id || fila.sesion_id !== sesionRef.current) return;
          setRespuestas((prev) => {
            const sinEsta = prev.filter((r) => r.id !== fila.id);
            if (!fila.visible) return sinEsta;
            if (sinEsta.length === prev.length) return [...prev, fila];
            return prev.map((r) => (r.id === fila.id ? fila : r));
          });
        },
      )
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED") {
          if (yaConectado) void recargar();
          yaConectado = true;
        }
      });
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [iglesiaId, sesionId, recargar]);

  // Al cambiar de sesión (reinicio) no mostramos las respuestas de la anterior
  const actuales = sesionId ? respuestas.filter((r) => r.sesion_id === sesionId) : [];
  return { respuestas: actuales, cargadas: sesionId !== null && cargadasDe === sesionId, recargar };
}
