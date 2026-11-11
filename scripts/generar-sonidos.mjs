// Genera los sonidos de la actividad (síntesis propia, sin licencias de terceros).
// Uso: node scripts/generar-sonidos.mjs  → escribe public/sounds/*.wav
import fs from "node:fs";
import path from "node:path";

const RATE = 44100;
const dir = path.join(process.cwd(), "public", "sounds");
fs.mkdirSync(dir, { recursive: true });

// Ruido determinístico (mismo archivo cada vez)
let semilla = 12345;
const ruido = () => {
  semilla = (semilla * 1664525 + 1013904223) >>> 0;
  return (semilla / 0xffffffff) * 2 - 1;
};

function wav(nombre, segundos, fn) {
  const n = Math.floor(RATE * segundos);
  const datos = new Float32Array(n);
  for (let i = 0; i < n; i++) datos[i] = fn(i / RATE, i);
  // normalizar a -1 dBFS con fade-out final de 10 ms
  const pico = datos.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const fade = Math.floor(RATE * 0.01);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const env = i > n - fade ? (n - i) / fade : 1;
    const v = Math.max(-1, Math.min(1, (datos[i] / pico) * 0.89 * env));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(dir, nombre), buf);
  console.log(`✔ ${nombre} (${segundos}s)`);
}

/** Filtro pasa-bajos de un polo, con estado */
function pasaBajos(corte) {
  const a = Math.exp((-2 * Math.PI * corte) / RATE);
  let y = 0;
  return (x) => (y = (1 - a) * x + a * y);
}

// Ladrillo que apoya: golpe grave y seco + "polvo" corto
{
  const lp = pasaBajos(900);
  let fase = 0;
  wav("ladrillo.wav", 0.32, (t) => {
    const f = 55 + 95 * Math.exp(-t / 0.03);
    fase += (2 * Math.PI * f) / RATE;
    const cuerpo = Math.sin(fase) * Math.exp(-t / 0.075);
    const polvo = lp(ruido()) * Math.exp(-t / 0.03) * 1.6;
    return cuerpo + polvo;
  });
}

// Impacto del proyectil (fase 2): golpe más fuerte con crujido
{
  const lp = pasaBajos(2200);
  let fase = 0;
  wav("impacto.wav", 0.6, (t) => {
    const f = 45 + 160 * Math.exp(-t / 0.04);
    fase += (2 * Math.PI * f) / RATE;
    const cuerpo = Math.sin(fase) * Math.exp(-t / 0.14);
    const crujido = lp(ruido()) * Math.exp(-t / 0.08) * (0.8 + 0.4 * Math.sin(t * 90));
    return cuerpo * 1.2 + crujido;
  });
}

// Derrumbe (fase 2): retumbo largo con muchos golpes
{
  const lp = pasaBajos(500);
  const lp2 = pasaBajos(1800);
  const golpes = Array.from({ length: 40 }, (_, i) => ({
    t: 0.05 + Math.pow(i / 40, 1.3) * 2.6 + ruido() * 0.04,
    f: 60 + Math.abs(ruido()) * 90,
    a: 0.4 + Math.abs(ruido()) * 0.6,
  }));
  wav("derrumbe.wav", 3.8, (t) => {
    let s = lp(ruido()) * 2.2 * Math.min(1, t / 0.05) * Math.exp(-t / 1.4);
    s += lp2(ruido()) * 0.5 * Math.exp(-t / 0.5);
    for (const g of golpes) {
      const d = t - g.t;
      if (d >= 0 && d < 0.3) s += Math.sin(2 * Math.PI * g.f * d) * Math.exp(-d / 0.06) * g.a;
    }
    const boom = Math.sin(2 * Math.PI * (38 + 30 * Math.exp(-t / 0.2)) * t) * Math.exp(-t / 0.6) * 1.4;
    return s + boom;
  });
}
