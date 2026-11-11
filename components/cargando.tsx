/** Pantalla de carga mínima: tres ladrillos que laten (sin JS, solo CSS). */
export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <main className="fondo-calido flex min-h-dvh flex-1 flex-col items-center justify-center gap-4" aria-busy="true">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((k) => (
          <span
            key={k}
            className="h-4 w-8 animate-pulse rounded-sm bg-ladrillo-500 motion-reduce:animate-none"
            style={{ animationDelay: `${k * 180}ms` }}
          />
        ))}
      </div>
      <p className="text-sm text-foreground/50">{texto}</p>
    </main>
  );
}
