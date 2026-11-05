-- =====================================================================
-- RENDÍ · Paso 3 de 4 · Seguridad (quién ve qué) y carpeta de fotos
-- Pegá TODO este archivo en SQL Editor > New query > Run.
--
-- Idea: desde la página solo se puede LEER (y solo lo que te corresponde).
-- Todo lo que escribe pasa por las funciones del paso 2, que controlan las reglas.
-- =====================================================================

-- Todo se crea en el esquema public, sin importar cómo esté configurado el editor
set search_path = public, extensions;

-- ---------- Permisos sobre las tablas
-- Desde octubre de 2026 Supabase ya no da permisos automáticos sobre tablas nuevas:
-- hay que darlos explícitos. La página (rol authenticated) solo LEE; nadie anónimo ve nada.
grant usage on schema public to authenticated, service_role;
revoke all on perfiles, politicas, rendiciones, gastos, gasto_items, lecturas_ia, comentarios, aprobaciones from anon;
revoke insert, update, delete, truncate on perfiles, politicas, rendiciones, gastos, gasto_items, lecturas_ia, comentarios, aprobaciones from authenticated;
grant select on perfiles, politicas, rendiciones, gastos, gasto_items, lecturas_ia, comentarios, aprobaciones to authenticated;
-- La función de IA (leer-ticket) usa el rol service_role para anotar cada lectura
grant select, insert, update on lecturas_ia to service_role;

alter table perfiles      enable row level security;
alter table politicas     enable row level security;
alter table rendiciones   enable row level security;
alter table gastos        enable row level security;
alter table gasto_items   enable row level security;
alter table lecturas_ia   enable row level security;
alter table comentarios   enable row level security;
alter table aprobaciones  enable row level security;

-- Borramos políticas viejas por si corrés este archivo dos veces
drop policy if exists "ver perfiles"      on perfiles;
drop policy if exists "ver politicas"     on politicas;
drop policy if exists "ver rendiciones"   on rendiciones;
drop policy if exists "ver gastos"        on gastos;
drop policy if exists "ver items"         on gasto_items;
drop policy if exists "ver lecturas"      on lecturas_ia;
drop policy if exists "ver comentarios"   on comentarios;
drop policy if exists "ver aprobaciones"  on aprobaciones;

create policy "ver perfiles"     on perfiles     for select to authenticated using (true);
create policy "ver politicas"    on politicas    for select to authenticated using (true);
create policy "ver rendiciones"  on rendiciones  for select to authenticated using (puede_ver_rendicion(id));
create policy "ver gastos"       on gastos       for select to authenticated using (puede_ver_rendicion(rendicion_id));
create policy "ver items"        on gasto_items  for select to authenticated
  using (exists (select 1 from gastos g where g.id = gasto_id and puede_ver_rendicion(g.rendicion_id)));
create policy "ver lecturas"     on lecturas_ia  for select to authenticated using (usuario_id = auth.uid());
create policy "ver comentarios"  on comentarios  for select to authenticated using (puede_ver_rendicion(rendicion_id));
create policy "ver aprobaciones" on aprobaciones for select to authenticated using (puede_ver_rendicion(rendicion_id));
-- No hay políticas de insert/update/delete: sin política, la base no deja escribir directo.

-- ---------- Quién puede ejecutar cada función
-- Funciones internas (empiezan con _): nadie desde la página
revoke execute on function _alertas(bigint)                     from public, anon, authenticated;
revoke execute on function _editable(bigint)                    from public, anon, authenticated;
revoke execute on function _volcar_items(bigint, jsonb)         from public, anon, authenticated;
revoke execute on function _chequear_duplicado_exacto(jsonb, bigint) from public, anon, authenticated;
revoke execute on function _estado_final(bigint)                from public, anon, authenticated;
revoke execute on function _monto_aprobado(bigint)              from public, anon, authenticated;
revoke execute on function _cerrar_etapa_jefe(bigint)           from public, anon, authenticated;

-- Funciones públicas: solo usuarios con login (nunca anónimos)
do $$
declare f text;
begin
  foreach f in array array[
    'mi_rol()', 'puede_ver_usuario(uuid)', 'puede_ver_rendicion(bigint)', 'monto_reembolsable(bigint)',
    'alertas_gasto(bigint)', 'crear_rendicion(text)', 'guardar_gasto(bigint, jsonb, bigint, text)',
    'actualizar_gasto(bigint, jsonb)', 'borrar_gasto(bigint)', 'set_item_personal(bigint, boolean)',
    'set_justificacion(bigint, text)', 'enviar_rendicion(bigint)', 'comentar(bigint, text, bigint)',
    'decidir_gasto(bigint, text, text, bigint[])', 'decidir_finanzas(bigint, boolean, text)',
    'marcar_reembolsada(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- Carpeta privada para las fotos de los tickets
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do update set public = false;

drop policy if exists "rendi subir fotos propias" on storage.objects;
drop policy if exists "rendi ver fotos"           on storage.objects;

-- Cada persona sube solo a su carpeta (la carpeta se llama como su id de usuario)
create policy "rendi subir fotos propias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ve la foto la dueña, su jefe y Finanzas
create policy "rendi ver fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets' and (
         (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.perfiles p
                 where p.id::text = (storage.foldername(name))[1]
                   and (p.jefe_id = auth.uid() or coalesce(public.mi_rol() = 'finanzas', false)))));

-- ---------- Control: si ves esta fila abajo, el archivo corrió COMPLETO.
-- Si dice "Success. No rows returned", NO corrió entero: volvé a pegarlo todo.
select '✓ Archivo 3 de 4 listo: ' || (select count(*) from pg_policies where schemaname = 'public') || ' reglas de acceso y carpeta de fotos ' || case when exists (select 1 from storage.buckets where id = 'tickets') then 'creada' else 'FALTA' end as resultado;
