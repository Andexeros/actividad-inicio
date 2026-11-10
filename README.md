# El Muro

Actividad interactiva para jóvenes sobre la **unidad entre congregaciones**. Cada iglesia tiene su TV, sus celulares y su líder; un panel admin ve todo.

Stack: Next.js 16 (App Router, TS) · Tailwind 4 · Supabase (Postgres + Realtime) · Matter.js · Framer Motion · Howler.js · qrcode.react.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/` | — | Landing con links a cada iglesia |
| `/[iglesia]` | Chicos (celular) | Responder (URL del QR) |
| `/[iglesia]/tv` | Pantalla grande | Muro, QR, animaciones |
| `/[iglesia]/host` | Líder (PIN) | Control de fases y moderación |
| `/admin` | Admin (PIN) | Las iglesias en vivo |

## Setup

1. **Node 20+** y `npm install`.
2. **Crear un proyecto en [Supabase](https://supabase.com)** (plan free alcanza).
3. **Correr las migraciones**, en orden, en *SQL Editor → New query* (pegar y ejecutar cada archivo):
   - `supabase/migrations/20261110000001_esquema_inicial.sql`
   - `supabase/migrations/20261110000002_iglesias_iniciales.sql`

   (Con la CLI de Supabase: `supabase link` y `supabase db push`.)
4. **Variables de entorno:** copiá `.env.example` a `.env.local` y completá:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → *Project Settings → API*.
   - `ADMIN_PIN`, `HOST_PIN` → PINs numéricos. Cada iglesia puede tener su propio PIN en `iglesias.host_pin`; si está vacío se usa `HOST_PIN`.
   - `SESSION_SECRET` → cualquier string largo al azar (firma las cookies de host/admin).
5. `npm run dev` y abrí http://localhost:3000.

## Editar textos

Preguntas, frase de reflexión, versículo, tamaño mínimo del muro, etc.: `config/actividad.ts`.

## Modelo de datos

- **iglesias** — `slug`, `nombre`, `host_pin` (el PIN no es legible con la anon key). Al crear una iglesia, un trigger le crea su sesión.
- **sesiones** — una activa por iglesia (índice único parcial). Guarda `fase`, `pregunta_actual`, `entrada_abierta`, la foto del `muro` al construirlo y un `version` que se incrementa en cada cambio para que las pantallas refresquen. "Reiniciar" desactiva la sesión y crea otra; las respuestas viejas quedan.
- **respuestas** — `fase`, `pregunta`, `texto` (1–25 caracteres, sin espacios al borde), `visible`, `filtrada` (oculta por el filtro automático), `dispositivo` (hash anónimo para el rate limit). `iglesia_id` lo completa un trigger desde la sesión.

### Seguridad

- La **anon key solo lee**: iglesias (sin PIN), sesiones y respuestas visibles.
- **Todas las escrituras van por el servidor** con service role: enviar respuesta (con filtro de malas palabras y rate limit), cambiar fase, moderar, reiniciar. Los cambios de host/admin validan el PIN.
- Realtime: `sesiones` y `respuestas` están en la publicación `supabase_realtime`; los clientes se suscriben filtrando por `iglesia_id`.

## Deploy (Vercel)

Importar el repo en Vercel, cargar las mismas variables de entorno y deployar. Dominio: `actividadbiblica.vercel.app`.
