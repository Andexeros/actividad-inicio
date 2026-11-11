import { Cargando } from "@/components/cargando";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { esAdmin } from "@/lib/auth";
import { Admin } from "./admin";
import { LoginAdmin } from "./login";

export const metadata: Metadata = {
  title: "Admin · El Muro",
  robots: { index: false, follow: false },
};

async function Contenido() {
  await connection();
  return (await esAdmin()) ? <Admin /> : <LoginAdmin />;
}

export default function Page() {
  return (
    <Suspense fallback={<Cargando />}>
      <Contenido />
    </Suspense>
  );
}
