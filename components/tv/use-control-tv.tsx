"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { moverPaso, reiniciarActividad } from "@/lib/control";
import { PASOS, pasoActual } from "@/lib/maquina";
import type { Iglesia, Sesion } from "@/lib/types";

/** Flechas del teclado y las teclas que manda un puntero de presentaciones. */
const TECLAS_AVANZAR = new Set(["ArrowRight", "PageDown"]);
const TECLAS_RETROCEDER = new Set(["ArrowLeft", "PageUp"]);

/**
 * Control de la actividad desde la propia TV: Avanzar / Retroceder (y Reiniciar).
 * Cada iglesia avanza a su ritmo.
 *
 * Devuelve `barra` (botones, van en la barra que se esconde sola) y `capas`
 * (avisos, que se ven aunque la barra esté escondida).
 */
export function useControlTv({
  iglesia,
  sesion,
  onSesion,
}: {
  iglesia: Iglesia;
  sesion: Sesion | null;
  onSesion: (s: Sesion) => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const paso = sesion ? pasoActual(sesion) : 0;
  const siguiente = PASOS[paso + 1] ?? null;

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!confirmarReinicio) return;
    const t = setTimeout(() => setConfirmarReinicio(false), 6000);
    return () => clearTimeout(t);
  }, [confirmarReinicio]);

  function mover(direccion: 1 | -1) {
    if (!sesion || pendiente) return;
    startTransition(async () => {
      const r = await moverPaso(iglesia.id, direccion, sesion.version);
      if (r.ok) onSesion(r.datos);
      else setAviso(r.error);
    });
  }

  function reiniciar() {
    setConfirmarReinicio(false);
    startTransition(async () => {
      const r = await reiniciarActividad(iglesia.id);
      if (r.ok) onSesion(r.datos);
      else setAviso(r.error);
    });
  }

  // Teclado / puntero de presentaciones
  const moverRef = useRef(mover);
  useEffect(() => {
    moverRef.current = mover;
  });
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      const direccion = TECLAS_AVANZAR.has(e.key) ? 1 : TECLAS_RETROCEDER.has(e.key) ? -1 : 0;
      if (!direccion || e.repeat || (e.target as HTMLElement)?.tagName === "INPUT") return;
      e.preventDefault();
      moverRef.current(direccion);
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const botonChico =
    "rounded-lg bg-black/70 px-3 py-1.5 text-xs text-foreground/80 backdrop-blur hover:bg-black/90 disabled:opacity-40";

  const barra = !sesion ? null : (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => mover(-1)} disabled={pendiente || paso === 0} className={botonChico}>
        ← Retroceder
      </button>
      <span className="rounded-lg bg-black/70 px-2.5 py-1.5 text-xs tabular-nums text-foreground/60 backdrop-blur">
        {PASOS[paso]} · {paso + 1}/{PASOS.length}
      </span>
      <button
        type="button"
        onClick={() => mover(1)}
        disabled={pendiente || !siguiente}
        className="rounded-lg bg-ladrillo-500 px-4 py-1 font-display text-xl tracking-wider text-ladrillo-50 shadow-[inset_0_-3px_0_var(--color-ladrillo-800)] hover:bg-ladrillo-400 disabled:opacity-50"
      >
        {pendiente ? "…" : siguiente ? `Avanzar: ${siguiente} →` : "Fin"}
      </button>
      {confirmarReinicio ? (
        <button
          type="button"
          onClick={reiniciar}
          disabled={pendiente}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
        >
          ¿Empezar de cero? Sí
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmarReinicio(true)}
          disabled={pendiente || paso === 0}
          title="Vuelve al inicio con el muro vacío (las respuestas quedan guardadas para el admin)"
          className={botonChico}
        >
          ↺ Reiniciar
        </button>
      )}
    </div>
  );

  const capas = (
    <AnimatePresence>
      {aviso && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="alert"
          className="fixed left-1/2 top-14 z-[70] max-w-[80vw] -translate-x-1/2 rounded-xl bg-ladrillo-800/95 px-5 py-3 text-ladrillo-50 shadow-lg"
        >
          {aviso}
        </motion.p>
      )}
    </AnimatePresence>
  );

  return { barra, capas };
}
