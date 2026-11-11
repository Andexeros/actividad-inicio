"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actividad } from "@/config/actividad";
import { logoutAdmin } from "@/lib/admin";
import { Combinado } from "./combinado";
import { EnVivo } from "./en-vivo";
import { GestionIglesias } from "./iglesias";
import { ListaRespuestas } from "./respuestas";
import { useDatosAdmin } from "./use-datos-admin";

const PESTANAS = [
  ["vivo", "En vivo"],
  ["respuestas", "Respuestas"],
  ["combinado", "Combinado"],
  ["iglesias", "Iglesias"],
] as const;
type Pestana = (typeof PESTANAS)[number][0];

export function Admin() {
  const { datos, error, recargar } = useDatosAdmin();
  const [pestana, setPestana] = useState<Pestana>("vivo");
  const router = useRouter();
  const [saliendo, startTransition] = useTransition();

  return (
    <main className="min-h-dvh flex-1 bg-background">
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <h1 className="font-display text-3xl tracking-wide text-ladrillo-400">
            {actividad.titulo} <span className="text-foreground/50">· Admin</span>
          </h1>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Secciones">
            {PESTANAS.map(([id, nombre]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPestana(id)}
                aria-current={pestana === id ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  pestana === id ? "bg-ladrillo-500 text-ladrillo-50" : "text-foreground/70 hover:bg-foreground/10"
                }`}
              >
                {nombre}
              </button>
            ))}
          </nav>
          <button
            type="button"
            disabled={saliendo}
            onClick={() =>
              startTransition(async () => {
                await logoutAdmin();
                router.refresh();
              })
            }
            className="ml-auto rounded-lg px-3 py-1.5 text-sm text-foreground/60 hover:text-foreground"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-ladrillo-800/50 px-4 py-3">
            <p>{error}</p>
            {error.includes("venció") && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-ladrillo-500 px-3 py-1.5 text-sm font-semibold text-ladrillo-50"
              >
                Volver a ingresar
              </button>
            )}
          </div>
        )}
        {!datos ? (
          <p className="py-20 text-center text-foreground/50">Cargando…</p>
        ) : pestana === "vivo" ? (
          <EnVivo datos={datos} />
        ) : pestana === "respuestas" ? (
          <ListaRespuestas datos={datos} />
        ) : pestana === "combinado" ? (
          <Combinado datos={datos} />
        ) : (
          <GestionIglesias datos={datos} onCambio={recargar} />
        )}
      </div>
    </main>
  );
}
