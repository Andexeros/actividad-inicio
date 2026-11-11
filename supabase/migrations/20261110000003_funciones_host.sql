-- Funciones atómicas que usa el servidor (service role) para el panel host/admin.
-- Ninguna se puede ejecutar con la anon key.

-- Contador aparte para cambios en las respuestas (moderación, filtradas):
-- avisa a TV/host que relean, sin invalidar el "version" que protege los botones de fase.
alter table public.sesiones add column rev_respuestas integer not null default 0;

create function public.tocar_sesion(p_sesion uuid)
returns void language sql security definer set search_path = public as $$
  update public.sesiones set rev_respuestas = rev_respuestas + 1 where id = p_sesion;
$$;

-- "Construir el muro": guarda la foto de las respuestas visibles de fase 1 y cambia de fase,
-- solo si nadie cambió la sesión mientras tanto (p_version).
create function public.construir_muro(p_sesion uuid, p_version integer)
returns setof public.sesiones language sql security definer set search_path = public as $$
  update public.sesiones s
     set fase = 'fase1_muro',
         entrada_abierta = false,
         muro = coalesce((
           select jsonb_agg(jsonb_build_object('id', r.id, 'texto', r.texto) order by r.created_at, r.id)
             from public.respuestas r
            where r.sesion_id = s.id and r.fase = 1 and r.visible
         ), '[]'::jsonb),
         muro_construido_at = now(),
         version = s.version + 1
   where s.id = p_sesion
     and s.version = p_version
     and s.activa
     and s.fase = 'fase1_respondiendo'
  returning s.*;
$$;

-- "Reiniciar actividad": desactiva la sesión activa y crea una nueva en 'lobby'.
-- Las respuestas viejas quedan guardadas con su sesión.
create function public.reiniciar_sesion(p_iglesia uuid)
returns setof public.sesiones language plpgsql security definer set search_path = public as $$
begin
  update public.sesiones set activa = false, entrada_abierta = false
   where iglesia_id = p_iglesia and activa;
  return query insert into public.sesiones (iglesia_id) values (p_iglesia) returning *;
end $$;

revoke execute on function public.tocar_sesion(uuid) from public, anon, authenticated;
revoke execute on function public.construir_muro(uuid, integer) from public, anon, authenticated;
revoke execute on function public.reiniciar_sesion(uuid) from public, anon, authenticated;
grant execute on function public.tocar_sesion(uuid) to service_role;
grant execute on function public.construir_muro(uuid, integer) to service_role;
grant execute on function public.reiniciar_sesion(uuid) to service_role;

-- Las funciones del trigger tampoco deben poder llamarse sueltas
revoke execute on function public.iglesia_crear_sesion() from public, anon, authenticated;
