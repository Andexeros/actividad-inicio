"use client";

import { useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";

const noop = () => () => {};

/**
 * Origen público del sitio. En producción conviene fijar NEXT_PUBLIC_SITE_URL
 * (p. ej. https://actividadbiblica.vercel.app); si no, se usa el de la página.
 */
export function useOrigen(): string {
  return useSyncExternalStore(
    noop,
    () => process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
    () => process.env.NEXT_PUBLIC_SITE_URL || "",
  );
}

export function urlCorta(origen: string, slug: string) {
  return `${origen.replace(/^https?:\/\//, "").replace(/\/$/, "")}/${slug}`;
}

export function QrIglesia({ slug, tamano, conUrl = true }: { slug: string; tamano: string; conUrl?: boolean }) {
  const origen = useOrigen();
  if (!origen) return <div style={{ width: tamano, height: tamano }} />;
  const url = `${origen.replace(/\/$/, "")}/${slug}`;
  return (
    <div className="flex flex-col items-center gap-[0.8vw]">
      <div className="rounded-[1.2vw] bg-white p-[1vw] shadow-[0_0_4vw_rgb(255_196_107/0.25)]">
        <QRCodeSVG
          value={url}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#1a0d07"
          style={{ width: tamano, height: tamano, display: "block" }}
        />
      </div>
      {conUrl && (
        // En una sola línea: la letra se achica si la dirección es larga, para que entre en el ancho del QR
        <p
          className="whitespace-nowrap font-semibold tracking-wide text-foreground"
          style={{ fontSize: `calc(${tamano} * ${Math.min(0.09, 1.9 / urlCorta(origen, slug).length).toFixed(4)})` }}
        >
          {urlCorta(origen, slug)}
        </p>
      )}
    </div>
  );
}
