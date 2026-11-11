"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/admin";

export function LoginAdmin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await loginAdmin(pin);
      if (r.ok) router.refresh();
      else {
        setError(r.error);
        setPin("");
      }
    });
  }

  return (
    <main className="fondo-calido flex min-h-dvh flex-1 flex-col items-center justify-center px-6">
      <form onSubmit={enviar} className="flex w-full max-w-xs flex-col gap-4 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-foreground/50">El Muro</p>
        <h1 className="font-display text-5xl tracking-wide text-ladrillo-400">Admin</h1>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          placeholder="PIN"
          aria-label="PIN de admin"
          className="rounded-2xl border-2 border-foreground/15 bg-black/40 px-4 py-4 text-center text-3xl tracking-[0.5em] outline-none focus:border-ladrillo-400"
        />
        <button
          type="submit"
          disabled={pin.length < 4 || pendiente}
          className="h-14 rounded-2xl bg-ladrillo-500 font-display text-3xl tracking-wider text-ladrillo-50 hover:bg-ladrillo-400 disabled:bg-ladrillo-800 disabled:text-ladrillo-50/50"
        >
          {pendiente ? "Entrando…" : "Entrar"}
        </button>
        <p className="min-h-6 text-ladrillo-200" aria-live="polite">
          {error}
        </p>
      </form>
    </main>
  );
}
