import { Suspense } from "react";
import { cargarIglesiaYSesion } from "@/lib/iglesias";
import { Celular } from "./celular";

async function Contenido({ params }: { params: Promise<{ iglesia: string }> }) {
  const { iglesia: slug } = await params;
  const { iglesia, sesion } = await cargarIglesiaYSesion(slug);
  return <Celular iglesia={iglesia} sesionInicial={sesion} />;
}

export default function Page(props: PageProps<"/[iglesia]">) {
  return (
    <Suspense fallback={<main className="fondo-calido min-h-dvh flex-1" />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
