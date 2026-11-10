-- El Muro — esquema inicial
-- Tablas: iglesias, sesiones, respuestas. RLS + Realtime.


-- ─────────────────────────────────────────────────────────────
-- iglesias
-- ─────────────────────────────────────────────────────────────
create table public.iglesias (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique
             check (slug ~ '^[a-z0-9][a-z0-9-]{0,29}$'
                    and slug not in ('admin', 'api', 'tv', 'host', '_next')),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 60),
  -- PIN propio del líder (opcional). Si es null se usa la env HOST_PIN.
  host_pin   text check (host_pin is null or host_pin ~ '^[0-9]{4,8}$'),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- sesiones: una activa por iglesia; "reiniciar" desactiva y crea otra
-- ─────────────────────────────────────────────────────────────
create table public.sesiones (
  id                 uuid primary key default gen_random_uuid(),
  iglesia_id         uuid not null references public.iglesias(id) on delete cascade,
  fase               text not null default 'lobby'
                     check (fase in ('lobby', 'fase1_respondiendo', 'fase1_muro',
                                     'entre_fases', 'fase2', 'derrumbe', 'final')),
  pregunta_actual    smallint not null default 0 check (pregunta_actual >= 0),
  entrada_abierta    boolean not null default false,
  activa             boolean not null default true,
  -- Foto de los ladrillos al apretar "Construir el muro": [{ "id": uuid, "texto": text }]
  -- Así el muro queda fijo y la TV lo reconstruye igual al recargar.
  muro               jsonb,
  muro_construido_at timestamptz,
  -- Se incrementa en cada cambio (fase, moderación, etc.) para que TV/host refresquen.
  version            integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index sesiones_una_activa_por_iglesia
  on public.sesiones (iglesia_id) where activa;
create index sesiones_iglesia_idx on public.sesiones (iglesia_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- respuestas
-- ─────────────────────────────────────────────────────────────
create table public.respuestas (
  id          uuid primary key default gen_random_uuid(),
  sesion_id   uuid not null references public.sesiones(id) on delete cascade,
  -- Duplicado a propósito para filtrar Realtime/admin por iglesia.
  -- Lo completa un trigger desde la sesión, así nunca queda inconsistente.
  iglesia_id  uuid not null references public.iglesias(id) on delete cascade,
  fase        smallint not null check (fase in (1, 2)),
  pregunta    smallint not null default 0 check (pregunta >= 0),
  texto       text not null
              check (texto = btrim(texto) and char_length(texto) between 1 and 25),
  visible     boolean not null default true,
  -- true si la ocultó automáticamente el filtro de malas palabras
  filtrada    boolean not null default false,
  -- hash del id anónimo del celular (para el rate limit; no identifica a nadie)
  dispositivo text,
  created_at  timestamptz not null default now()
);

create index respuestas_sesion_idx  on public.respuestas (sesion_id, fase, pregunta, created_at);
create index respuestas_iglesia_idx on public.respuestas (iglesia_id, created_at);
create index respuestas_rate_idx    on public.respuestas (sesion_id, fase, pregunta, dispositivo);

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────

-- respuestas.iglesia_id siempre = sesiones.iglesia_id
create function public.respuestas_completar_iglesia()
returns trigger language plpgsql as $$
begin
  select s.iglesia_id into new.iglesia_id from public.sesiones s where s.id = new.sesion_id;
  return new;
end $$;

create trigger respuestas_completar_iglesia
  before insert or update of sesion_id on public.respuestas
  for each row execute function public.respuestas_completar_iglesia();

-- sesiones.updated_at
create function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger sesiones_updated_at
  before update on public.sesiones
  for each row execute function public.tocar_updated_at();

-- Cada iglesia nueva arranca con una sesión activa en 'lobby'
create function public.iglesia_crear_sesion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.sesiones (iglesia_id) values (new.id);
  return new;
end $$;

create trigger iglesias_crear_sesion
  after insert on public.iglesias
  for each row execute function public.iglesia_crear_sesion();

-- ─────────────────────────────────────────────────────────────
-- Seguridad (RLS)
--   anon / authenticated: solo LECTURA de iglesias (sin PIN), sesiones
--   y respuestas visibles. Todas las escrituras (incluido enviar una
--   respuesta) pasan por el servidor con service role, que aplica el
--   filtro de malas palabras, el rate limit y valida el PIN.
-- ─────────────────────────────────────────────────────────────
alter table public.iglesias   enable row level security;
alter table public.sesiones   enable row level security;
alter table public.respuestas enable row level security;

revoke all on public.iglesias, public.sesiones, public.respuestas from anon, authenticated;

-- iglesias: el PIN no se puede leer (permiso por columna)
grant select (id, slug, nombre, created_at) on public.iglesias to anon, authenticated;
create policy "iglesias lectura publica" on public.iglesias
  for select to anon, authenticated using (true);

grant select on public.sesiones to anon, authenticated;
create policy "sesiones lectura publica" on public.sesiones
  for select to anon, authenticated using (true);

grant select on public.respuestas to anon, authenticated;
create policy "respuestas visibles" on public.respuestas
  for select to anon, authenticated using (visible);

-- ─────────────────────────────────────────────────────────────
-- Realtime (postgres_changes filtrado por iglesia_id)
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.sesiones, public.respuestas;
