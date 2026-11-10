-- Iglesias iniciales. El trigger iglesias_crear_sesion les crea su sesión activa.
insert into public.iglesias (slug, nombre) values
  ('isla',    'Isla'),
  ('central', 'Central'),
  ('alvear',  'Alvear')
on conflict (slug) do nothing;
