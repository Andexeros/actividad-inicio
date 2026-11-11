"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { actividad } from "@/config/actividad";
import { guardarEnviadasLocal, idDispositivo, useEnviadasLocal } from "@/lib/dispositivo";
import { entradaActual, limpiarTexto } from "@/lib/fases";
import { usePresencia } from "@/lib/presencia";
import { useSesionActiva } from "@/lib/realtime";
import type { Iglesia, Sesion } from "@/lib/types";
import { enviarRespuesta } from "./actions";

const MAX = actividad.respuestas.maxCaracteres;
const MAX_POR_PREGUNTA = actividad.respuestas.maxPorPregunta;

type Props = { iglesia: Iglesia; sesionInicial: Sesion | null };

export function Celular({ iglesia, sesionInicial }: Props) {
  const { sesion, conexion } = useSesionActiva(iglesia.id, sesionInicial);
  usePresencia(iglesia.id, idDispositivo);
  const entrada = sesion ? entradaActual(sesion) : null;
  const reducir = useReducedMotion() ?? false;

  return (
    <main className="fondo-calido flex min-h-dvh flex-1 flex-col px-5 pb-8 pt-6">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl tracking-wide text-ladrillo-400">
          {actividad.titulo}
        </span>
        <span className="rounded-full border border-foreground/15 px-3 py-1 text-sm text-foreground/70">
          {iglesia.nombre}
        </span>
      </header>

      {conexion === "desconectado" && (
        <p className="mt-3 rounded-lg bg-ladrillo-800/60 px-3 py-2 text-center text-sm text-ladrillo-50">
          Sin conexión en vivo. Reintentando…
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {sesion && entrada ? (
          <motion.div
            key={`${sesion.id}:${entrada.fase}:${entrada.pregunta}`}
            className="flex flex-1 flex-col"
            initial={reducir ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, y: -24 }}
            transition={{ duration: reducir ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Formulario sesion={sesion} entrada={entrada} reducir={reducir} />
          </motion.div>
        ) : (
          <motion.div
            key={estadoEspera(sesion).titulo}
            className="flex flex-1 flex-col items-center justify-center gap-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Espera sesion={sesion} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function estadoEspera(sesion: Sesion | null): { titulo: string; detalle: string; emoji: string } {
  switch (sesion?.fase) {
    case "fase1_muro":
    case "derrumbe":
    case "final":
      return { titulo: "¡Mirá la pantalla!", detalle: "Está pasando algo 👀", emoji: "📺" };
    case "fase1_respondiendo":
    case "fase2":
      return { titulo: "Respuestas cerradas", detalle: "Esperá la próxima pregunta.", emoji: "✋" };
    case "entre_fases":
      return { titulo: "Respuestas cerradas", detalle: "Prestá atención a la clase 🙌", emoji: "🧱" };
    default:
      return { titulo: "Esperando que empiece…", detalle: "Dejá esta pantalla abierta.", emoji: "⏳" };
  }
}

function Espera({ sesion }: { sesion: Sesion | null }) {
  const estado = estadoEspera(sesion);
  return (
    <>
      <span className="text-6xl" aria-hidden>
        {estado.emoji}
      </span>
      <h1 className="font-display text-5xl tracking-wide">{estado.titulo}</h1>
      <p className="text-foreground/60">{estado.detalle}</p>
    </>
  );
}

type FormProps = {
  sesion: Sesion;
  entrada: NonNullable<ReturnType<typeof entradaActual>>;
  reducir: boolean;
};

function Formulario({ sesion, entrada, reducir }: FormProps) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(0); // contador para re-disparar la animación
  const enviadas = useEnviadasLocal(sesion.id, entrada.fase, entrada.pregunta);
  const [pendiente, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!exito) return;
    const t = setTimeout(() => setExito(0), 2200);
    return () => clearTimeout(t);
  }, [exito]);

  const limpio = limpiarTexto(texto);
  const largo = [...texto].length;
  const llegoAlLimite = enviadas >= MAX_POR_PREGUNTA;
  const puedeEnviar = limpio.length > 0 && !pendiente && !llegoAlLimite;
  const mensajeOk = entrada.fase === 1 ? actividad.fase1.mensajeEnviado : actividad.fase2.mensajeEnviado;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setError(null);
    startTransition(async () => {
      let resultado;
      try {
        resultado = await enviarRespuesta({
          iglesiaId: sesion.iglesia_id,
          sesionId: sesion.id,
          fase: entrada.fase,
          pregunta: entrada.pregunta,
          texto: limpio,
          dispositivo: idDispositivo(),
        });
      } catch {
        setError("No pudimos enviar. Revisá tu conexión.");
        return;
      }
      if (resultado.ok) {
        const n = MAX_POR_PREGUNTA - resultado.restantes;
        guardarEnviadasLocal(sesion.id, entrada.fase, entrada.pregunta, n);
        setTexto("");
        setExito((x) => x + 1);
        try {
          navigator.vibrate?.(entrada.fase === 1 ? 40 : [30, 40, 80]);
        } catch {
          // sin vibración
        }
        inputRef.current?.focus();
      } else {
        if (resultado.motivo === "limite") {
          guardarEnviadasLocal(sesion.id, entrada.fase, entrada.pregunta, MAX_POR_PREGUNTA);
        }
        setError(resultado.mensaje);
      }
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-1 flex-col gap-5 pt-8">
      <div>
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-ladrillo-200/80">
          {entrada.fase === 1
            ? `Pregunta ${entrada.pregunta + 1} de ${actividad.fase1.preguntas.length}`
            : "Derribemos el muro"}
        </p>
        <h1 className="text-[1.65rem] font-bold leading-tight text-balance">{entrada.texto}</h1>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="relative">
          <input
            ref={inputRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (error) setError(null);
            }}
            maxLength={MAX}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            placeholder={llegoAlLimite ? "¡Gracias por participar!" : "Escribí una palabra o frase corta"}
            disabled={llegoAlLimite}
            aria-label="Tu respuesta"
            className="w-full rounded-2xl border-2 border-foreground/15 bg-black/40 px-4 pb-4 pt-4 pr-16 text-2xl outline-none transition-colors placeholder:text-base placeholder:text-foreground/35 focus:border-ladrillo-400 disabled:opacity-50"
          />
          <span
            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm tabular-nums ${
              largo >= MAX ? "text-ladrillo-400" : "text-foreground/40"
            }`}
          >
            {largo}/{MAX}
          </span>
        </div>

        <motion.button
          type="submit"
          disabled={!puedeEnviar}
          whileTap={reducir ? undefined : { scale: 0.97, y: 2 }}
          className="h-20 rounded-2xl bg-ladrillo-500 font-display text-4xl tracking-wider text-ladrillo-50 shadow-[inset_0_-6px_0_var(--color-ladrillo-800)] transition-colors hover:bg-ladrillo-400 disabled:bg-ladrillo-800 disabled:text-ladrillo-50/50"
        >
          {pendiente ? "Enviando…" : "Enviar"}
        </motion.button>

        <div className="min-h-12 text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            {exito > 0 ? (
              <motion.p
                key={`ok-${exito}`}
                initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={reducir ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 26 }}
                className="text-lg font-semibold text-luz"
              >
                {mensajeOk}
              </motion.p>
            ) : error ? (
              <motion.p
                key={`err-${error}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-ladrillo-200"
              >
                {error}
              </motion.p>
            ) : enviadas > 0 ? (
              <motion.p
                key="contador"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-foreground/50"
              >
                {llegoAlLimite
                  ? "Llegaste al máximo para esta pregunta."
                  : `Enviaste ${enviadas}. Podés mandar más.`}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}
