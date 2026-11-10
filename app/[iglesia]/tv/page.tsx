import { Suspense } from "react";
import { cargarIglesiaYSesion } from "@/lib/iglesias";
import { Tv } from "./tv";

async function Contenido({ params }: { params: Promise<{ iglesia: string }> }) {
  const { iglesia: slug } = await params;
  const { iglesia, sesion } = await cargarIglesiaYSesion(slug);
  return <Tv iglesia={iglesia} sesionInicial={sesion} />;
}

export default function Page(props: PageProps<"/[iglesia]/tv">) {
  return (
    <Suspense fallback={<main className="fondo-calido min-h-dvh flex-1" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
