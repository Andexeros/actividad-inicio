import { Cargando } from "@/components/cargando";
import type { Metadata } from "next";
import { Suspense } from "react";
import { puedeControlar } from "@/lib/auth";
import { cargarIglesiaYSesion } from "@/lib/iglesias";
import { Host } from "./host";
import { LoginPin } from "./login";

export const metadata: Metadata = {
  title: "Panel del líder · El Muro",
  robots: { index: false, follow: false },
};

async function Contenido({ params }: { params: Promise<{ iglesia: string }> }) {
  const { iglesia: slug } = await params;
  const { iglesia, sesion } = await cargarIglesiaYSesion(slug);
  if (!(await puedeControlar(iglesia.id))) {
    return <LoginPin iglesia={iglesia} />;
  }
  return <Host iglesia={iglesia} sesionInicial={sesion} />;
}

export default function Page(props: PageProps<"/[iglesia]/host">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido params={props.params} />
    </Suspense>
  );
}
