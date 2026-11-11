"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { loginHost, moverPaso } from "@/lib/control";
import { PASOS, pasoActual } from "@/lib/maquina";
import type { Iglesia, Sesion } from "@/lib/types";

/** Flechas del teclado y las teclas que manda un puntero de presentaciones. */
const TECLAS_AVANZAR = new Set(["ArrowRight", "PageDown"]);
const TECLAS_RETROCEDER = new Set(["ArrowLeft", "PageUp"]);

/**
 * Control de la actividad desde la propia TV. Cada iglesia avanza a su ritmo.
 * La primera vez pide el PIN de la iglesia (el mismo del panel del líder).
 *
 * Devuelve dos piezas: `barra` (botones, van en la barra que se esconde sola) y
 * `capas` (pedido de PIN y avisos, que se ven aunque la barra esté escondida).
 */
export function useControlTv({
  iglesia,
  sesion,
  onSesion,
  autorizado,
}: {
  iglesia: Iglesia;
  sesion: Sesion | null;
  onSesion: (s: Sesion) => void;
  autorizado: boolean;
}) {
  const router = useRouter();
  const [pidiendoPin, setPidiendoPin] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const paso = sesion ? pasoActual(sesion) : 0;
  const siguiente = PASOS[paso + 1] ?? null;

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  function mover(direccion: 1 | -1) {
    if (!sesion || pendiente) return;
    startTransition(async () => {
      const r = await moverPaso(iglesia.id, direccion, sesion.version);
      if (r.ok) onSesion(r.datos);
      else {
        setAviso(r.error);
        if (r.error.includes("venció")) router.refresh();
      }
    });
  }

  // Teclado / puntero de presentaciones
  const ultimo = useRef({ mover, autorizado, pidiendoPin });
  useEffect(() => {
    ultimo.current = { mover, autorizado, pidiendoPin };
  });
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      const direccion = TECLAS_AVANZAR.has(e.key) ? 1 : TECLAS_RETROCEDER.has(e.key) ? -1 : 0;
      if (!direccion || e.repeat) return;
      const { mover: hacer, autorizado: ok, pidiendoPin: pin } = ultimo.current;
      if (pin || (e.target as HTMLElement)?.tagName === "INPUT") return;
      e.preventDefault();
      if (!ok) {
        setPidiendoPin(true);
        return;
      }
      hacer(direccion);
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  const barra = !sesion ? null : !autorizado ? (
    <button
      type="button"
      onClick={() => setPidiendoPin(true)}
      className="rounded-xl bg-black/60 px-4 py-2 text-sm text-foreground/80 backdrop-blur hover:bg-black/80"
    >
      🔒 Manejar la actividad desde esta TV
    </button>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => mover(-1)}
        disabled={pendiente || paso === 0}
        className="rounded-xl bg-black/60 px-4 py-3 text-sm text-foreground/80 backdrop-blur hover:bg-black/80 disabled:opacity-40"
      >
        ← Retroceder
      </button>
      <span className="rounded-xl bg-black/60 px-3 py-3 text-xs tabular-nums text-foreground/60 backdrop-blur">
        {PASOS[paso]} · {paso + 1}/{PASOS.length}
      </span>
      <button
        type="button"
        onClick={() => mover(1)}
        disabled={pendiente || !siguiente}
        className="rounded-xl bg-ladrillo-500 px-6 py-3 font-display text-2xl tracking-wider text-ladrillo-50 shadow-[inset_0_-4px_0_var(--color-ladrillo-800)] hover:bg-ladrillo-400 disabled:opacity-50"
      >
        {pendiente ? "…" : siguiente ? `Avanzar: ${siguiente} →` : "Fin"}
      </button>
      <a
        href={`/${iglesia.slug}/host`}
        target="_blank"
        rel="noreferrer"
        title="Ocultar respuestas o reiniciar"
        className="rounded-xl bg-black/60 px-3 py-3 text-sm text-foreground/60 backdrop-blur hover:bg-black/80"
      >
        Panel ↗
      </a>
    </div>
  );

  const capas = (
    <>
      <AnimatePresence>
        {aviso && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="fixed left-1/2 top-4 z-[70] max-w-[80vw] -translate-x-1/2 rounded-xl bg-ladrillo-800/95 px-5 py-3 text-ladrillo-50 shadow-lg"
          >
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>
      {pidiendoPin && (
        <PedirPin
          nombre={iglesia.nombre}
          onCancelar={() => setPidiendoPin(false)}
          onPin={async (pin) => {
            const r = await loginHost(iglesia.id, pin);
            if (!r.ok) return r.error;
            setPidiendoPin(false);
            router.refresh();
            return null;
          }}
        />
      )}
    </>
  );

  return { barra, capas };
}

function PedirPin({
  nombre,
  onCancelar,
  onPin,
}: {
  nombre: string;
  onCancelar: () => void;
  onPin: (pin: string) => Promise<string | null>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onKeyDown={(e) => e.key === "Escape" && onCancelar()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const err = await onPin(pin);
            if (err) {
              setError(err);
              setPin("");
            }
          });
        }}
        className="flex w-[min(90vw,22rem)] flex-col gap-4 rounded-2xl border border-foreground/15 bg-background p-6 text-center"
      >
        <p className="text-sm uppercase tracking-[0.2em] text-foreground/50">Manejar desde esta TV</p>
        <h2 className="font-display text-4xl tracking-wide text-ladrillo-400">{nombre}</h2>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          placeholder="PIN"
          aria-label="PIN de la iglesia"
          className="rounded-xl border-2 border-foreground/15 bg-black/40 px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-ladrillo-400"
        />
        <p className="min-h-5 text-sm text-ladrillo-200" aria-live="polite">
          {error}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-foreground/20 py-3">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pin.length < 4 || pendiente}
            className="flex-1 rounded-xl bg-ladrillo-500 py-3 font-semibold text-ladrillo-50 hover:bg-ladrillo-400 disabled:opacity-50"
          >
            {pendiente ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
