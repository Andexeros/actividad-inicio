"use client";

import { useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { actividad } from "@/config/actividad";
import { moderarRespuesta, moverPaso, reiniciarActividad } from "@/lib/control";
import { entradaActual } from "@/lib/fases";
import { ETIQUETA_FASE, PASOS, pasoActual } from "@/lib/maquina";
import type { Iglesia, Sesion } from "@/lib/types";
import { useRespuestasControl } from "./use-respuestas-control";

const TOTAL_PREGUNTAS = actividad.fase1.preguntas.length;

type Props = {
  iglesia: Iglesia;
  sesion: Sesion | null;
  /** Para aplicar al instante la sesión que devuelve el servidor (Realtime llega igual después). */
  onSesion: (s: Sesion) => void;
  /** Versión compacta para el admin (etapa 6). */
  compacto?: boolean;
};

/** Avanzar/Retroceder + moderación + reinicio. Lo usa /[iglesia]/host (el líder). */
export function PanelControl({ iglesia, sesion, onSesion, compacto = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const { respuestas, error: errorLista, recargar, marcarVisible } = useRespuestasControl(
    iglesia.id,
    sesion?.id ?? null,
    sesion?.rev_respuestas ?? 0,
  );

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  if (errorLista?.includes("venció")) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-ladrillo-800/40 p-6 text-center">
        <p>{errorLista}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-ladrillo-500 px-5 py-3 font-semibold text-ladrillo-50 hover:bg-ladrillo-400"
        >
          Volver a ingresar
        </button>
      </div>
    );
  }

  if (!sesion) {
    return <p className="text-foreground/60">No hay sesión activa para esta iglesia.</p>;
  }

  const paso = pasoActual(sesion);
  const siguiente = PASOS[paso + 1] ?? null;
  const entrada = entradaActual(sesion);
  const delaPregunta = entrada
    ? respuestas.filter((r) => r.fase === entrada.fase && r.pregunta === entrada.pregunta)
    : [];
  const ocultas = respuestas.filter((r) => !r.visible).length;

  function mover(direccion: 1 | -1) {
    if (!sesion) return;
    setError(null);
    startTransition(async () => {
      const r = await moverPaso(iglesia.id, direccion, sesion.version);
      if (r.ok) {
        onSesion(r.datos);
        try {
          navigator.vibrate?.(20);
        } catch {}
      } else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Estado */}
      <section className="rounded-2xl border border-foreground/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-ladrillo-500/20 px-3 py-1 text-sm font-semibold text-ladrillo-200">
            {ETIQUETA_FASE[sesion.fase]}
          </span>
          <span
            className={`flex items-center gap-2 text-sm ${sesion.entrada_abierta ? "text-emerald-300" : "text-foreground/50"}`}
          >
            <span
              className={`size-2 rounded-full ${sesion.entrada_abierta ? "bg-emerald-400" : "bg-foreground/30"}`}
            />
            {sesion.entrada_abierta ? "Recibiendo respuestas" : "Entrada cerrada"}
          </span>
        </div>
        <PreguntaActual sesion={sesion} />
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Dato titulo="Esta pregunta" valor={entrada ? delaPregunta.filter((r) => r.visible).length : "—"} />
          <Dato titulo="Total" valor={respuestas.filter((r) => r.visible).length} />
          <Dato titulo="Ocultas" valor={ocultas} />
        </dl>
      </section>

      {/* Acciones */}
      <section className="flex flex-col gap-2">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-foreground/50">
          Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}
        </p>
        <motion.button
          type="button"
          onClick={() => mover(1)}
          disabled={pendiente || !siguiente}
          whileTap={{ scale: 0.97 }}
          className={`${compacto ? "h-14 text-3xl" : "h-20 text-4xl"} rounded-2xl bg-ladrillo-500 font-display tracking-wider text-ladrillo-50 shadow-[inset_0_-6px_0_var(--color-ladrillo-800)] hover:bg-ladrillo-400 disabled:opacity-60`}
        >
          {pendiente ? "…" : siguiente ? `Avanzar: ${siguiente} →` : "Actividad terminada"}
        </motion.button>
        <button
          type="button"
          onClick={() => mover(-1)}
          disabled={pendiente || paso === 0}
          className="rounded-xl border border-foreground/20 px-4 py-3 font-semibold text-foreground/90 hover:bg-foreground/5 disabled:opacity-40"
        >
          ← Retroceder{paso > 0 ? ` a ${PASOS[paso - 1]}` : ""}
        </button>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="rounded-xl bg-ladrillo-800/70 px-4 py-3 text-ladrillo-50"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* Moderación */}
      <ListaModeracion
        respuestas={respuestas}
        sesion={sesion}
        error={errorLista}
        compacto={compacto}
        onModerar={async (id, visible) => {
          marcarVisible(id, visible);
          const r = await moderarRespuesta(iglesia.id, id, visible);
          if (!r.ok) {
            setError(r.error);
            void recargar();
          }
        }}
      />

      {/* Reinicio */}
      <Reiniciar
        onConfirmar={async () => {
          const r = await reiniciarActividad(iglesia.id);
          if (r.ok) onSesion(r.datos);
          else setError(r.error);
        }}
      />
    </div>
  );
}

function PreguntaActual({ sesion }: { sesion: Sesion }) {
  let titulo: string | null = null;
  let texto: string | null = null;
  if (sesion.fase === "fase1_respondiendo") {
    titulo = `Pregunta ${sesion.pregunta_actual + 1} de ${TOTAL_PREGUNTAS}`;
    texto = actividad.fase1.preguntas[sesion.pregunta_actual] ?? null;
  } else if (sesion.fase === "fase2") {
    titulo = "Pregunta de fase 2";
    texto = actividad.fase2.pregunta;
  } else if (sesion.fase === "fase1_muro" || sesion.fase === "entre_fases") {
    titulo = "Muro";
    texto = `${sesion.muro?.length ?? 0} ladrillos con respuesta`;
  }
  if (!texto) return null;
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">{titulo}</p>
      <p className="mt-1 text-lg font-semibold leading-snug">{texto}</p>
    </div>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-xl bg-foreground/5 py-2">
      <dd className="font-display text-4xl tabular-nums leading-none">{valor}</dd>
      <dt className="mt-1 text-xs text-foreground/50">{titulo}</dt>
    </div>
  );
}

type ListaProps = {
  respuestas: ReturnType<typeof useRespuestasControl>["respuestas"];
  sesion: Sesion;
  error: string | null;
  compacto: boolean;
  onModerar: (id: string, visible: boolean) => void;
};

function ListaModeracion({ respuestas, sesion, error, compacto, onModerar }: ListaProps) {
  const entrada = entradaActual(sesion);
  const [filtro, setFiltro] = useState<"pregunta" | "todas" | "ocultas">("todas");
  const lista = respuestas.filter((r) => {
    if (filtro === "ocultas") return !r.visible;
    if (filtro === "pregunta") return entrada ? r.fase === entrada.fase && r.pregunta === entrada.pregunta : false;
    return true;
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm uppercase tracking-[0.2em] text-foreground/50">Respuestas en vivo</h2>
        <div className="flex rounded-lg bg-foreground/5 p-0.5 text-sm">
          {(
            [
              ["todas", "Todas"],
              ["pregunta", "Esta pregunta"],
              ["ocultas", "Ocultas"],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              className={`rounded-md px-2.5 py-1 ${filtro === valor ? "bg-foreground/15 text-foreground" : "text-foreground/60"}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-ladrillo-200">{error}</p>}
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50">
          {filtro === "ocultas" ? "No hay respuestas ocultas." : "Todavía no hay respuestas."}
        </p>
      ) : (
        <ul className={`flex flex-col gap-1.5 overflow-y-auto pr-1 ${compacto ? "max-h-80" : "max-h-[60dvh]"}`}>
          {lista.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${r.visible ? "bg-foreground/5" : "bg-ladrillo-800/30"}`}
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-lg ${r.visible ? "" : "text-foreground/40 line-through"}`}>
                  {r.texto}
                </p>
                <p className="text-xs text-foreground/40">
                  {r.fase === 1 ? `Fase 1 · P${r.pregunta + 1}` : "Fase 2"}
                  {r.filtrada && " · filtro automático"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onModerar(r.id, !r.visible)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                  r.visible
                    ? "border border-foreground/20 text-foreground/80 hover:bg-foreground/10"
                    : "bg-foreground/15 text-foreground hover:bg-foreground/25"
                }`}
              >
                {r.visible ? "Ocultar" : "Mostrar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Reiniciar({ onConfirmar }: { onConfirmar: () => Promise<void> }) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 8000);
    return () => clearTimeout(t);
  }, [confirmando]);

  return (
    <section className="mt-4 border-t border-foreground/10 pt-4">
      {confirmando ? (
        <div className="flex flex-col gap-2 rounded-xl bg-ladrillo-800/40 p-3">
          <p className="text-sm">
            Se empieza de cero (vuelve al inicio con el muro vacío). Las respuestas actuales quedan
            guardadas, pero no se muestran más.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="flex-1 rounded-lg border border-foreground/20 py-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  await onConfirmar();
                  setConfirmando(false);
                })
              }
              className="flex-1 rounded-lg bg-red-700 py-2 font-semibold text-white hover:bg-red-600 disabled:opacity-60"
            >
              {pendiente ? "Reiniciando…" : "Sí, reiniciar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="w-full rounded-lg py-2 text-sm text-foreground/50 hover:text-foreground/80"
        >
          Reiniciar actividad…
        </button>
      )}
    </section>
  );
}
