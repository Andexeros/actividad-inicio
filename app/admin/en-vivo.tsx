"use client";

import { useState } from "react";
import { actividad } from "@/config/actividad";
import type { DatosAdmin, IglesiaAdmin, RespuestaAdmin } from "@/lib/admin";
import { entradaActual } from "@/lib/fases";
import { ETIQUETA_FASE } from "@/lib/maquina";
import type { Sesion } from "@/lib/types";

/**
 * Las iglesias lado a lado (en celular, una por vez con pestañas). SOLO LECTURA:
 * cada iglesia maneja sus tiempos desde el panel de su líder; acá solo se mira.
 */
export function EnVivo({ datos }: { datos: DatosAdmin }) {
  const [elegida, setElegida] = useState(datos.iglesias[0]?.id ?? "");
  if (datos.iglesias.length === 0) {
    return <p className="py-20 text-center text-foreground/50">No hay iglesias. Creá una en la pestaña Iglesias.</p>;
  }
  return (
    <>
      <p className="mb-4 text-sm text-foreground/50">
        Vista de solo lectura. Cada iglesia avanza desde su TV (<code>/iglesia</code>).
      </p>
      {/* Selector solo en pantallas chicas */}
      <div className="mb-4 flex gap-1 overflow-x-auto lg:hidden">
        {datos.iglesias.map((ig) => (
          <button
            key={ig.id}
            type="button"
            onClick={() => setElegida(ig.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${
              elegida === ig.id ? "bg-foreground text-background" : "bg-foreground/10 text-foreground/70"
            }`}
          >
            {ig.nombre}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {datos.iglesias.map((ig) => (
          <div key={ig.id} className={elegida === ig.id ? "block" : "hidden lg:block"}>
            <Columna
              iglesia={ig}
              sesion={datos.sesiones.find((s) => s.iglesia_id === ig.id) ?? null}
              respuestas={datos.respuestas.filter((r) => r.iglesia_id === ig.id)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function Columna({
  iglesia,
  sesion,
  respuestas,
}: {
  iglesia: IglesiaAdmin;
  sesion: Sesion | null;
  respuestas: RespuestaAdmin[];
}) {
  const visibles = respuestas.filter((r) => r.visible);
  const entrada = sesion ? entradaActual(sesion) : null;
  const deEstaPregunta =
    sesion?.fase === "fase1_respondiendo"
      ? visibles.filter((r) => r.fase === 1 && r.pregunta === sesion.pregunta_actual).length
      : sesion?.fase === "fase2"
        ? visibles.filter((r) => r.fase === 2).length
        : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-black/20 p-4">
      <header className="flex items-start justify-between gap-2">
        <h2 className="font-display text-3xl tracking-wide text-ladrillo-400">{iglesia.nombre}</h2>
        <div className="flex gap-1 text-xs">
          <a href={`/${iglesia.slug}`} target="_blank" rel="noreferrer" className="rounded-md border border-foreground/20 px-2 py-1 hover:bg-foreground/10">
            TV ↗
          </a>
          <a href={`/${iglesia.slug}/r`} target="_blank" rel="noreferrer" className="rounded-md border border-foreground/20 px-2 py-1 hover:bg-foreground/10">
            Celular ↗
          </a>
        </div>
      </header>

      {!sesion ? (
        <p className="text-sm text-foreground/50">Sin sesión activa.</p>
      ) : (
        <div className="rounded-xl border border-foreground/10 bg-black/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-ladrillo-500/20 px-3 py-1 text-sm font-semibold text-ladrillo-200">
              {ETIQUETA_FASE[sesion.fase]}
            </span>
            <span className={`flex items-center gap-2 text-xs ${entrada ? "text-emerald-300" : "text-foreground/50"}`}>
              <span className={`size-2 rounded-full ${entrada ? "bg-emerald-400" : "bg-foreground/30"}`} />
              {entrada ? "Recibiendo respuestas" : "Entrada cerrada"}
            </span>
          </div>
          {sesion.fase === "fase1_respondiendo" && (
            <p className="mt-3 text-sm leading-snug">
              <span className="text-xs uppercase tracking-[0.2em] text-foreground/50">
                Pregunta {sesion.pregunta_actual + 1} de {actividad.fase1.preguntas.length}
              </span>
              <br />
              {actividad.fase1.preguntas[sesion.pregunta_actual]}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-4 gap-1.5 text-center">
            <Dato titulo="Ahora" valor={deEstaPregunta ?? "—"} />
            <Dato titulo="Fase 1" valor={visibles.filter((r) => r.fase === 1).length} />
            <Dato titulo="Fase 2" valor={visibles.filter((r) => r.fase === 2).length} />
            <Dato titulo="Ocultas" valor={respuestas.length - visibles.length} />
          </dl>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-foreground/50">Respuestas en vivo</h3>
        {respuestas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-foreground/15 p-6 text-center text-sm text-foreground/50">
            Todavía no hay respuestas.
          </p>
        ) : (
          <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto pr-1">
            {respuestas.map((r) => (
              <li
                key={r.id}
                className={`flex items-baseline justify-between gap-2 rounded-lg px-3 py-1.5 ${r.visible ? "bg-foreground/5" : "bg-ladrillo-800/20"}`}
              >
                <span className={`min-w-0 truncate ${r.visible ? "" : "text-foreground/40 line-through"}`}>{r.texto}</span>
                <span className="shrink-0 text-xs text-foreground/40">
                  {r.fase === 1 ? `P${r.pregunta + 1}` : "F2"}
                  {!r.visible && (r.filtrada ? " · filtro" : " · oculta")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-lg bg-foreground/5 py-1.5">
      <dd className="font-display text-2xl tabular-nums leading-none">{valor}</dd>
      <dt className="mt-0.5 text-[10px] text-foreground/50">{titulo}</dt>
    </div>
  );
}
