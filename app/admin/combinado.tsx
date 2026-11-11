"use client";

import { useMemo, useState } from "react";
import { NubePalabras } from "@/components/nube-palabras";
import { actividad } from "@/config/actividad";
import type { DatosAdmin } from "@/lib/admin";
import { contarPalabras } from "@/lib/nube";

/** Nube y ranking juntando todas las iglesias (solo respuestas visibles), por fase. */
export function Combinado({ datos }: { datos: DatosAdmin }) {
  const [fase, setFase] = useState<1 | 2>(1);
  const textos = useMemo(
    () => datos.respuestas.filter((r) => r.visible && r.fase === fase).map((r) => r.texto),
    [datos.respuestas, fase],
  );
  const ranking = useMemo(() => contarPalabras(textos).slice(0, 20), [textos]);
  const max = ranking[0]?.n ?? 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-foreground/5 p-0.5">
          {([1, 2] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFase(f)}
              className={`rounded-md px-4 py-1.5 text-sm font-semibold ${fase === f ? "bg-ladrillo-500 text-ladrillo-50" : "text-foreground/70"}`}
            >
              Fase {f}
            </button>
          ))}
        </div>
        <p className="text-sm text-foreground/60">
          {textos.length} respuestas visibles de {datos.iglesias.length} iglesias
        </p>
      </div>
      <p className="text-sm text-foreground/50">
        {fase === 1 ? "Lo que nos separa (las 3 preguntas de la fase 1)" : actividad.fase2.pregunta}
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="relative h-[55vh] min-h-80 rounded-2xl border border-foreground/10 bg-black/30 p-4">
          <NubePalabras key={fase} textos={textos} tamMax={64} />
        </section>
        <section className="rounded-2xl border border-foreground/10 bg-black/30 p-4">
          <h2 className="mb-3 text-sm uppercase tracking-[0.2em] text-foreground/50">Palabras más repetidas</h2>
          {ranking.length === 0 ? (
            <p className="text-sm text-foreground/50">Todavía no hay respuestas.</p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {ranking.map((p, k) => (
                <li key={p.texto} className="flex items-center gap-2 text-sm">
                  <span className="w-5 shrink-0 text-right text-xs text-foreground/40">{k + 1}</span>
                  <div className="relative flex-1 overflow-hidden rounded-md bg-foreground/5">
                    <div className="absolute inset-y-0 left-0 bg-ladrillo-500/40" style={{ width: `${(p.n / max) * 100}%` }} />
                    <span className="relative block truncate px-2 py-1">{p.texto}</span>
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-foreground/70">{p.n}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
