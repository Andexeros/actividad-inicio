"use client";

import { AnimatePresence, motion } from "framer-motion";
import { actividad } from "@/config/actividad";
import { entradaActual } from "@/lib/fases";
import { useRespuestas, useSesionActiva } from "@/lib/realtime";
import type { Iglesia, Sesion } from "@/lib/types";

/**
 * TV mínima (etapa 2): lista en vivo de las respuestas de ESTA iglesia.
 * En la etapa 4 se reemplaza por el muro.
 */
export function Tv({ iglesia, sesionInicial }: { iglesia: Iglesia; sesionInicial: Sesion | null }) {
  const { sesion, conexion } = useSesionActiva(iglesia.id, sesionInicial);
  const { respuestas } = useRespuestas(iglesia.id, sesion?.id ?? null, sesion?.rev_respuestas ?? 0);
  const entrada = sesion ? entradaActual(sesion) : null;
  const delaPregunta = entrada
    ? respuestas.filter((r) => r.fase === entrada.fase && r.pregunta === entrada.pregunta)
    : [];

  return (
    <main className="fondo-calido flex min-h-dvh flex-1 flex-col gap-8 p-10">
      <header className="flex items-baseline justify-between gap-6">
        <h1 className="font-display text-7xl tracking-wide text-ladrillo-400">
          {actividad.titulo} · {iglesia.nombre}
        </h1>
        <div className="flex items-center gap-3 text-xl text-foreground/60">
          <span
            className={`size-3 rounded-full ${conexion === "conectado" ? "bg-emerald-400" : "bg-ladrillo-400 animate-pulse"}`}
            aria-hidden
          />
          {sesion?.fase ?? "sin sesión"}
          {sesion?.entrada_abierta ? " · entrada abierta" : " · entrada cerrada"}
        </div>
      </header>

      {entrada && (
        <section className="flex items-end justify-between gap-10">
          <p className="max-w-5xl text-5xl font-bold leading-tight text-balance">{entrada.texto}</p>
          <div className="text-right">
            <motion.p
              key={delaPregunta.length}
              initial={{ scale: 1.25, color: "#ffc46b" }}
              animate={{ scale: 1, color: "#f5ede6" }}
              className="font-display text-9xl leading-none tabular-nums"
            >
              {delaPregunta.length}
            </motion.p>
            <p className="text-xl text-foreground/60">respuestas</p>
          </div>
        </section>
      )}

      <section className="flex-1">
        <h2 className="mb-4 text-lg uppercase tracking-[0.2em] text-foreground/50">
          Todas las respuestas de esta sesión ({respuestas.length})
        </h2>
        <ul className="flex flex-wrap gap-3">
          <AnimatePresence initial={false}>
            {[...respuestas].reverse().map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rounded-md bg-ladrillo-500 px-4 py-2 text-2xl font-semibold text-ladrillo-50 shadow-[inset_0_-4px_0_var(--color-ladrillo-800)]"
              >
                {r.texto}
                <span className="ml-2 text-sm font-normal text-ladrillo-50/60">
                  F{r.fase}·P{r.pregunta + 1}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>
    </main>
  );
}
