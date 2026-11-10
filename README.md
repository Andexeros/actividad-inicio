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

## Probar (etapa 2)

Hasta que esté el panel del líder (etapa 3), la fase se cambia por consola:

```bash
npm run fase -- isla fase1 0    # abre la entrada, pregunta 1
npm run fase -- isla fase1 1    # pregunta 2
npm run fase -- isla fase2      # fase 2
npm run fase -- isla cerrar     # cierra la entrada
npm run fase -- isla lobby      # vuelve al inicio
```

- Celular: `http://localhost:3000/isla` · TV mínima: `http://localhost:3000/isla/tv`
- Desde un celular en la misma red: `npm run dev -- -H 0.0.0.0` y entrá con la IP de la compu.
- **Aislamiento entre iglesias:** `npm run probar:aislamiento` abre una conexión Realtime por iglesia, inserta respuestas en paralelo en las 3 y verifica que cada una recibe solo las suyas en menos de 1 s, que las ocultas no llegan y que la anon key no puede escribir. Al final borra las respuestas de prueba.

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
