import type { Metadata } from "next";
import { Suspense } from "react";
import { Cargando } from "@/components/cargando";
import { cargarIglesiaYSesion } from "@/lib/iglesias";
import { Tv } from "./tv";

// /[iglesia] es la pantalla grande (TV) de esa iglesia, con Avanzar / Retroceder.
// Los celulares responden en /[iglesia]/r (la dirección del QR).
export const metadata: Metadata = {
  title: "TV · El Muro",
  robots: { index: false, follow: false },
};

async function Contenido({ params }: { params: Promise<{ iglesia: string }> }) {
  const { iglesia: slug } = await params;
  const { iglesia, sesion } = await cargarIglesiaYSesion(slug);
  return <Tv iglesia={iglesia} sesionInicial={sesion} />;
}

export default function Page(props: PageProps<"/[iglesia]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
