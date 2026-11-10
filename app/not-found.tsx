import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fondo-calido flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="font-display text-[9rem] leading-none text-ladrillo-500">404</p>
      <h1 className="font-display text-4xl tracking-wide">Acá no hay ningún muro</h1>
      <p className="max-w-xs text-foreground/70">
        Revisá que el nombre de la iglesia esté bien escrito.
      </p>
      <Link
        href="/"
        className="rounded-full bg-ladrillo-500 px-6 py-3 font-semibold text-ladrillo-50 hover:bg-ladrillo-400"
      >
        Ver todas las iglesias
      </Link>
    </main>
  );
}
