"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PanelControl } from "@/components/control/panel-control";
import { logoutHost } from "@/lib/control";
import { useSesionActiva } from "@/lib/realtime";
import type { Iglesia, Sesion } from "@/lib/types";

export function Host({ iglesia, sesionInicial }: { iglesia: Iglesia; sesionInicial: Sesion | null }) {
  const { sesion, setSesion, conexion } = useSesionActiva(iglesia.id, sesionInicial);
  const router = useRouter();
  const [saliendo, startTransition] = useTransition();

  return (
    <main className="fondo-calido flex min-h-dvh flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-10 pt-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/50">Panel del líder</p>
            <h1 className="font-display text-4xl tracking-wide text-ladrillo-400">{iglesia.nombre}</h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/${iglesia.slug}/tv`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5"
            >
              Abrir TV ↗
            </a>
            <button
              type="button"
              disabled={saliendo}
              onClick={() =>
                startTransition(async () => {
                  await logoutHost(iglesia.id);
                  router.refresh();
                })
              }
              className="rounded-lg px-3 py-2 text-sm text-foreground/60 hover:text-foreground"
            >
              Salir
            </button>
          </div>
        </header>

        {conexion === "desconectado" && (
          <p className="rounded-lg bg-ladrillo-800/60 px-3 py-2 text-center text-sm">
            Sin conexión en vivo. Reintentando…
          </p>
        )}

        <PanelControl iglesia={iglesia} sesion={sesion} onSesion={setSesion} />
      </div>
    </main>
  );
}
