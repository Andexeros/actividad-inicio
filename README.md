# El Muro

Actividad interactiva para jóvenes sobre la **unidad entre congregaciones**. Cada iglesia tiene su TV y la maneja a su ritmo; los chicos responden desde el celular; un admin mira todo.

Stack: Next.js 16 (App Router, TS) · Tailwind 4 · Supabase (Postgres + Realtime) · Matter.js · Framer Motion · Howler.js · qrcode.react.

## Direcciones

| Dirección | Quién | Qué |
|---|---|---|
| `/` | — | Lista de iglesias (lleva al celular de cada una) |
| `/isla` | Pantalla grande | **La TV**: muro, QR, animaciones y los botones **Avanzar / Retroceder** |
| `/isla/r` | Chicos (celular) | Responder. Es la dirección del QR |
| `/admin` | Admin (PIN) | Mirar las iglesias en vivo, todas las respuestas, CSV |

(Lo mismo con `central`, `alvear` o cualquier iglesia nueva. La vieja `/isla/tv` redirige a `/isla`.)

## Cómo se usa

1. Abrir la TV de la iglesia (`/isla`) en la notebook conectada a la tele. Tocar **Pantalla completa** y **Activar sonido** (los navegadores no dejan sonar nada hasta un clic).
2. Los chicos escanean el QR → `/isla/r`.
3. Avanzar con el botón **Avanzar →** (abajo; aparece al mover el mouse), con la flecha **→** o con un **puntero de presentaciones** (AvPág). Para volver: **← Retroceder**, flecha **←** o RePág.

La actividad es una línea de 9 pasos:

**Inicio → Pregunta 1 → Pregunta 2 → Pregunta 3 → Muro → Clase → Fase 2 → Derrumbe → Final**

- Las preguntas y la Fase 2 reciben respuestas; el resto no (se abre y cierra solo).
- Al avanzar de Pregunta 3 a **Muro** se construye el muro con las respuestas (la foto queda guardada).
- **Retroceder** deshace el último paso: de Muro a Pregunta 3 se vuelve a abrir y al avanzar se arma de nuevo; de Derrumbe a Fase 2 el muro vuelve quieto, con sus agujeros.
- En la Fase 2, cada respuesta es un proyectil que tira ladrillos; al llegar al 100% de fuerza (`fase2.respuestasParaDerribar`, 30) pasa solo a Derrumbe.
- **↺ Reiniciar** (con confirmación): vuelve al inicio con el muro vacío. Las respuestas quedan guardadas para el admin.
- Recargar la TV en cualquier momento recupera el estado exacto, sin repetir animaciones.
- La pantalla no se apaga sola mientras la TV está abierta.

Cada iglesia es independiente: avanzar una no afecta a las otras. No hay PIN para avanzar (pedido de simplicidad): cualquiera que abra la dirección de la TV puede avanzarla.

## Admin (`/admin`)

Se entra con el PIN de admin (12 h): `ADMIN_PIN` si está cargado en Vercel, o **1234** por defecto (conviene cambiarlo cargando `ADMIN_PIN`). Mira las iglesias, no las maneja:

- **En vivo:** las iglesias lado a lado (en celular, con pestañas): paso, pregunta, si recibe respuestas, cantidades y respuestas en vivo.
- **Respuestas:** filtros por iglesia, fase, pregunta y visibilidad, búsqueda, y **Exportar CSV** (todo o por iglesia, incluye actividades anteriores; abre bien en Excel en español).
- **Borrar:** 🗑 en cada respuesta (pide confirmar), y **Empezar de cero** al final de Respuestas: borra para siempre todas las respuestas de una iglesia o de todas y deja la TV en Inicio con el muro vacío (hay que escribir BORRAR).
- **Combinado:** nube y ranking de palabras de todas las iglesias, por fase.
- **Iglesias:** crear y editar nombre y slug (cambiar el slug cambia la dirección y el QR).

Las malas palabras se ocultan solas (filtro en `lib/filtro.ts`) y nunca llegan a la TV.

## Setup

1. `npm install` (Node 20+).
2. Proyecto en Supabase (en Vercel: integración Supabase, región São Paulo).
3. Migraciones: `npm run migrar` (usa `POSTGRES_URL_NON_POOLING` de `.env.local` y verifica la conexión con `supabase/prod-ca-2021.crt`), o pegar en orden los 3 archivos de `supabase/migrations/` en el SQL Editor.
4. `.env.local` (ver `.env.example`): las claves de Supabase y `ADMIN_PIN`.
5. `npm run dev` → http://localhost:3000

### Variables en Vercel

La integración de Supabase ya carga las claves. `ADMIN_PIN` es opcional: si no está, el PIN de admin es **1234**. Opcionales: `SESSION_SECRET` (si no está, se deriva de una clave de Supabase) y `NEXT_PUBLIC_SITE_URL` (si no está, el QR usa la dirección de la página). El servidor corre en São Paulo (`vercel.json`), igual que la base.

## Comandos

- `npm run chequeo` — revisa variables, migraciones, que cada iglesia esté en Inicio y la seguridad. Solo lee.
- `npm run fase -- isla lobby` — pone una iglesia en Inicio desde la consola (también `fase1 0..2`, `fase2`, `cerrar`).
- `npm run probar:aislamiento` — prueba que cada iglesia recibe solo sus respuestas por Realtime en < 1 s.
- `npm run sonidos` — regenera `public/sounds/*.wav` (síntesis propia, sin licencias).

## Editar textos

Preguntas, frase de reflexión, versículo, mínimo de ladrillos, respuestas para derribar: `config/actividad.ts`. Los 9 pasos asumen 3 preguntas en la fase 1.

## Detalles técnicos

- **Datos:** `iglesias` (slug, nombre), `sesiones` (una activa por iglesia: fase, pregunta, entrada, foto del muro, `version` contra dobles clics, `rev_respuestas` para refrescar) y `respuestas` (texto ≤ 25, visible, filtrada, hash anónimo del celular para limitar a 10 por pregunta).
- **Seguridad:** la anon key solo lee (sesiones, iglesias y respuestas visibles). Todas las escrituras pasan por el servidor.
- **Muro:** layout determinístico; los ladrillos se dibujan una vez como imagen. Medido: 168 ladrillos a 0,14 ms por cuadro; derrumbe de 162 ladrillos a 0,85 ms promedio (límite para 60 fps: 16,7 ms). Los golpes de la fase 2 tiran siempre los mismos ladrillos (`lib/muro/golpes.ts`), así la TV se reconstruye igual al recargar.

Ver también **`CHECKLIST.md`** (deploy y día del evento).
