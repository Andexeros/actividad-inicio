import { Cargando } from "@/components/cargando";
import { Suspense } from "react";
import { cargarIglesiaYSesion } from "@/lib/iglesias";
import type { Metadata } from "next";
import { Tv } from "./tv";

export const metadata: Metadata = {
  title: "TV · El Muro",
  robots: { index: false, follow: false },
};

async function Contenido({ params }: { params: Promise<{ iglesia: string }> }) {
  const { iglesia: slug } = await params;
  const { iglesia, sesion } = await cargarIglesiaYSesion(slug);
  return <Tv iglesia={iglesia} sesionInicial={sesion} />;
}

export default function Page(props: PageProps<"/[iglesia]/tv">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
