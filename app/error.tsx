"use client";

import { useEffect } from "react";

/** Error inesperado en cualquier pantalla: mensaje claro y botón para reintentar. */
export default function ErrorPagina({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="fondo-calido flex min-h-dvh flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="text-6xl" aria-hidden>
        🧱
      </span>
      <h1 className="font-display text-5xl tracking-wide text-ladrillo-400">Se cayó un ladrillo</h1>
      <p className="max-w-sm text-foreground/70">
        Algo falló al cargar esta pantalla. Revisá la conexión a internet y probá de nuevo.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-ladrillo-500 px-6 py-3 font-semibold text-ladrillo-50 hover:bg-ladrillo-400"
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border border-foreground/20 px-6 py-3 font-semibold hover:bg-foreground/10"
        >
          Recargar la página
        </button>
      </div>
    </main>
  );
}
