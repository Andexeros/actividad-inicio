"use client";

import { useState } from "react";
import { PanelControl } from "@/components/control/panel-control";
import type { DatosAdmin, IglesiaAdmin } from "@/lib/admin";
import { useSesionActiva } from "@/lib/realtime";
import type { Sesion } from "@/lib/types";

/** Las iglesias lado a lado (en celular, una por vez con pestañas), cada una con su control. */
export function EnVivo({ datos }: { datos: DatosAdmin }) {
  const [elegida, setElegida] = useState(datos.iglesias[0]?.id ?? "");
  if (datos.iglesias.length === 0) {
    return <p className="py-20 text-center text-foreground/50">No hay iglesias. Creá una en la pestaña Iglesias.</p>;
  }
  return (
    <>
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
              sesionInicial={datos.sesiones.find((s) => s.iglesia_id === ig.id) ?? null}
              conteo={contar(datos, ig.id)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

function contar(datos: DatosAdmin, iglesiaId: string) {
  const r = datos.respuestas.filter((x) => x.iglesia_id === iglesiaId && x.visible);
  return { f1: r.filter((x) => x.fase === 1).length, f2: r.filter((x) => x.fase === 2).length };
}

function Columna({
  iglesia,
  sesionInicial,
  conteo,
}: {
  iglesia: IglesiaAdmin;
  sesionInicial: Sesion | null;
  conteo: { f1: number; f2: number };
}) {
  const { sesion, setSesion, conexion } = useSesionActiva(iglesia.id, sesionInicial);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-foreground/10 bg-black/20 p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-3xl tracking-wide text-ladrillo-400">{iglesia.nombre}</h2>
          <p className="text-xs text-foreground/50">
            Fase 1: {conteo.f1} · Fase 2: {conteo.f2}
            {conexion === "desconectado" && " · reconectando…"}
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          <a href={`/${iglesia.slug}/tv`} target="_blank" rel="noreferrer" className="rounded-md border border-foreground/20 px-2 py-1 hover:bg-foreground/10">
            TV ↗
          </a>
          <a href={`/${iglesia.slug}`} target="_blank" rel="noreferrer" className="rounded-md border border-foreground/20 px-2 py-1 hover:bg-foreground/10">
            Celular ↗
          </a>
        </div>
      </header>
      <PanelControl iglesia={iglesia} sesion={sesion} onSesion={setSesion} compacto />
    </section>
  );
}
