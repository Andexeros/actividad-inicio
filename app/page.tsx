import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { actividad } from "@/config/actividad";
import { listarIglesias } from "@/lib/iglesias";
import { supabaseConfigurado } from "@/lib/supabase/server";

async function ListaIglesias() {
  await connection();
  if (!supabaseConfigurado()) {
    return (
      <p className="text-ladrillo-200">
        Falta configurar Supabase. Copiá <code>.env.example</code> a <code>.env.local</code>.
      </p>
    );
  }
  const iglesias = await listarIglesias();
  if (iglesias.length === 0) {
    return <p className="text-foreground/60">Todavía no hay iglesias cargadas.</p>;
  }
  return (
    <ul className="grid w-full gap-3">
      {iglesias.map((iglesia) => (
        <li key={iglesia.id}>
          <Link
            href={`/${iglesia.slug}`}
            className="block rounded-2xl bg-ladrillo-500 px-6 py-5 text-center font-display text-4xl tracking-wide text-ladrillo-50 shadow-[inset_0_-6px_0_var(--color-ladrillo-800)] transition-transform active:translate-y-0.5 hover:bg-ladrillo-400"
          >
            {iglesia.nombre}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="fondo-calido flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        <header className="text-center">
          <h1 className="font-display text-8xl leading-none tracking-wide text-ladrillo-400">
            {actividad.titulo}
          </h1>
          <p className="mt-3 text-foreground/70">{actividad.subtitulo}</p>
        </header>
        <section className="flex w-full flex-col items-center gap-4">
          <h2 className="text-sm uppercase tracking-[0.2em] text-foreground/50">
            Elegí tu iglesia
          </h2>
          <Suspense fallback={<p className="text-foreground/50">Cargando…</p>}>
            <ListaIglesias />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
