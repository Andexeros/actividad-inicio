import { Suspense } from "react";
import { notFound } from "next/navigation";
import { buscarIglesia } from "@/lib/iglesias";

// Etapa 1: solo valida el slug. El formulario de respuesta llega en la etapa 2.
async function Contenido({ params }: { params: Promise<{ iglesia: string }> }) {
  const { iglesia: slug } = await params;
  const iglesia = await buscarIglesia(slug);
  if (!iglesia) notFound();

  return (
    <main className="fondo-calido flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-foreground/50">Iglesia</p>
      <h1 className="font-display text-6xl tracking-wide text-ladrillo-400">{iglesia.nombre}</h1>
      <p className="text-foreground/70">Esperando que empiece…</p>
    </main>
  );
}

export default function Page(props: PageProps<"/[iglesia]">) {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
