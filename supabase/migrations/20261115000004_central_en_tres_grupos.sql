-- Central trabaja en 3 grupos separados, cada uno con su TV, sus respuestas y su muro:
-- /central1, /central2, /central3. La iglesia "central" existente pasa a ser "central1"
-- (conserva su sesión y sus respuestas). Las nuevas reciben su sesión por el trigger.

update public.iglesias
   set slug = 'central1', nombre = 'Central 1'
 where slug = 'central'
   and not exists (select 1 from public.iglesias where slug = 'central1');

insert into public.iglesias (slug, nombre) values
  ('central1', 'Central 1'),
  ('central2', 'Central 2'),
  ('central3', 'Central 3')
on conflict (slug) do nothing;
