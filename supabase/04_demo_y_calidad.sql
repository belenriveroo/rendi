-- =====================================================================
-- RENDÍ · Paso 4 de 4 · Usuarios demo, datos de ejemplo y Control de calidad
--
-- ANTES de correr esto, creá los 3 usuarios en Authentication > Users > Add user:
--   empleada@example.com   ·   jefe@example.com   ·   finanzas@example.com
--   (contraseña: rendi2026 · marcá "Auto Confirm User")
-- Después pegá TODO este archivo en SQL Editor > New query > Run.
-- =====================================================================

-- Todo se crea en el esquema public, sin importar cómo esté configurado el editor
set search_path = public, extensions;

-- ---------- 1. Perfiles de los 3 usuarios demo
do $$
declare v_emp uuid; v_jefe uuid; v_fin uuid;
begin
  select id into v_emp  from auth.users where email = 'empleada@example.com';
  select id into v_jefe from auth.users where email = 'jefe@example.com';
  select id into v_fin  from auth.users where email = 'finanzas@example.com';
  if v_emp is null or v_jefe is null or v_fin is null then
    raise exception 'Faltan usuarios. Creá empleada@example.com, jefe@example.com y finanzas@example.com en Authentication > Users y volvé a correr este archivo.';
  end if;

  insert into perfiles (id, nombre, area, rol, jefe_id) values
    (v_jefe, 'Martín Acosta',   'Comercial', 'jefe',     null),
    (v_fin,  'Lucía Rodríguez', 'Finanzas',  'finanzas', null)
  on conflict (id) do update set nombre = excluded.nombre, area = excluded.area,
                                 rol = excluded.rol, jefe_id = excluded.jefe_id;
  insert into perfiles (id, nombre, area, rol, jefe_id) values
    (v_emp,  'Sofía Pereira',   'Comercial', 'empleado', v_jefe)
  on conflict (id) do update set nombre = excluded.nombre, area = excluded.area,
                                 rol = excluded.rol, jefe_id = excluded.jefe_id;
end $$;

-- ---------- 2. Datos de ejemplo (se pueden reiniciar desde la página)
create or replace function _nuevo_gasto(p_rend bigint, p_emp uuid, p_rut text, p_num text, p_fecha date,
                                        p_comercio text, p_neto numeric, p_iva numeric, p_total numeric,
                                        p_cat text, p_items jsonb, p_estado text default 'pendiente',
                                        p_caso text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; i jsonb;
begin
  insert into gastos (rendicion_id, empleado_id, rut_emisor, serie, numero, fecha, comercio,
                      neto, iva, total, categoria, estado, caso_prueba)
  values (p_rend, p_emp, p_rut, 'A', p_num, p_fecha, p_comercio, p_neto, p_iva, p_total, p_cat, p_estado, p_caso)
  returning id into v_id;
  for i in select * from jsonb_array_elements(p_items) loop
    insert into gasto_items (gasto_id, descripcion, importe, es_alcohol, reembolsable)
    values (v_id, i ->> 0, (i ->> 1)::numeric, coalesce((i ->> 2)::boolean, false), coalesce((i ->> 3)::boolean, true));
  end loop;
  return v_id;
end;
$$;

create or replace function _cargar_demo() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid; v_jefe uuid; r bigint; d date := current_date - 5;
begin
  select id, jefe_id into v_emp, v_jefe from perfiles where rol = 'empleado' and jefe_id is not null order by nombre limit 1;
  if v_emp is null then raise exception 'No hay empleada con jefe asignado. Corré la parte 1 de este archivo.'; end if;

  delete from rendiciones;   -- borra en cascada tickets, líneas, comentarios y aprobaciones

  -- Casos de prueba del panel de Control de calidad (no se ven en las listas normales)
  insert into rendiciones (empleado_id, titulo, estado, es_prueba)
  values (v_emp, 'Casos de prueba', 'borrador', true) returning id into r;
  perform _nuevo_gasto(r, v_emp, '219000000011', '9001', d, 'PRUEBA Café Central', 1000, 100, 1100, 'comidas',
                       '[["Menú ejecutivo",700],["Café y postre",400]]', 'pendiente', 'ok');
  perform _nuevo_gasto(r, v_emp, '219000000011', '9002', d, 'PRUEBA Café Central', 1000, 100, 1100, 'comidas',
                       '[["Menú ejecutivo",700],["Café y postre",400]]', 'pendiente', 'duplicado');
  perform _nuevo_gasto(r, v_emp, '219000000022', '9003', d, 'PRUEBA Parrilla del Puerto', 2000, 200, 2200, 'comidas',
                       '[["Parrillada para 2",2200]]', 'pendiente', 'tope_categoria');
  perform _nuevo_gasto(r, v_emp, '219000000033', '9004', d, 'PRUEBA Taxi Ruta', 800, 300, 1000, 'traslados',
                       '[["Viaje aeropuerto",1000]]', 'pendiente', 'iva');
  perform _nuevo_gasto(r, v_emp, '219000000044', '9005', d, 'PRUEBA Hotel Plaza', 3000, 300, 3300, 'alojamiento',
                       '[["Habitación",2000],["Desayuno",800]]', 'pendiente', 'suma_lineas');
  perform _nuevo_gasto(r, v_emp, '219000000055', '9006', d, 'PRUEBA Bodega Salto', 1000, 100, 1100, 'comidas',
                       '[["Pasta",700],["Copa de vino",400,true]]', 'pendiente', 'alcohol');
  perform _nuevo_gasto(r, v_emp, '219000000066', '9007', current_date - 90, 'PRUEBA Peaje Ruta 3', 500, 110, 610, 'traslados',
                       '[["Peaje",610]]', 'pendiente', 'plazo');

  -- Rendición lista para que el jefe la apruebe en la demo (supera $U 3.000: después va a Finanzas)
  insert into rendiciones (empleado_id, titulo, estado, enviada)
  values (v_emp, 'Viaje a Salto · visita a Distribuidora Ceibo', 'pendiente_jefe', now() - interval '1 day')
  returning id into r;
  perform _nuevo_gasto(r, v_emp, '210000000101', '1201', current_date - 3, 'Parador del Litoral', 1072.73, 107.27, 1180, 'comidas',
                       '[["Milanesa con papas",520],["Ensalada mixta",280],["Copa de vino tannat",380,true,false]]');
  perform _nuevo_gasto(r, v_emp, '210000000202', '3340', current_date - 3, 'Taxi Salto Centro', 532.79, 117.21, 650, 'traslados',
                       '[["Viaje terminal a cliente",650]]');
  perform _nuevo_gasto(r, v_emp, '210000000303', '0877', current_date - 3, 'Hotel Costanera Salto', 3545.45, 354.55, 3900, 'alojamiento',
                       '[["Habitación single, 1 noche",3900]]');

  -- Historial: una rendición ya reembolsada
  insert into rendiciones (empleado_id, titulo, estado, enviada, total_aprobado)
  values (v_emp, 'Visita a Paysandú · setiembre', 'reembolsada', now() - interval '35 days', 1420)
  returning id into r;
  perform _nuevo_gasto(r, v_emp, '210000000404', '5521', current_date - 40, 'Café del Puerto', 1290.91, 129.09, 1420, 'comidas',
                       '[["Almuerzo con cliente",1420]]', 'aprobado');
  insert into aprobaciones (rendicion_id, aprobador_id, etapa, decision, comentario)
  values (r, v_jefe, 'jefe', 'aprobado', null);
end;
$$;

-- Botón "Reiniciar datos demo" de la página
create or replace function reiniciar_demo() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from perfiles where id = auth.uid()) then
    raise exception 'Tenés que entrar con un usuario demo.';
  end if;
  perform _cargar_demo();
end;
$$;

select _cargar_demo();

-- =====================================================================
-- MEJORA · CONTROL DE CALIDAD
-- probar_reglas(): corre las 9 reglas contra casos conocidos y dice si cada una funciona.
-- Las pruebas de aprobación se hacen "como si" fuera el jefe o la empleada y después se
-- deshacen solas: no dejan nada guardado.
-- =====================================================================

-- Simula que el usuario conectado es otra persona (solo dentro de la prueba)
create or replace function _como(u uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function probar_reglas()
returns table (orden int, prueba text, regla text, esperado text, resultado text, ok boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  c        record;
  v_reglas text[];
  v_msgs   text;
  v_emp    uuid;
  v_jefe   uuid;
  v_r      bigint;
  v_r2     bigint;
  v_g      bigint;
  v_i      bigint;
  v_e1     text;
  v_e2     text;
  v_tot    numeric;
  v_ok     boolean;
  v_msg    text;
  v_n      int := 0;
begin
  if auth.uid() is null then raise exception 'Tenés que estar logueado.'; end if;
  select id, jefe_id into v_emp, v_jefe from perfiles where rol = 'empleado' and jefe_id is not null order by nombre limit 1;

  -- A) Las alertas sobre tickets de prueba conocidos
  for c in select g.id, g.caso_prueba, g.comercio
           from gastos g join rendiciones r on r.id = g.rendicion_id
           where r.es_prueba and g.caso_prueba is not null order by g.id loop
    select coalesce(array_agg(a.regla) filter (where a.nivel in ('bad', 'warn')), '{}'),
           string_agg(a.mensaje, ' · ')
      into v_reglas, v_msgs
      from _alertas(c.id) a;
    v_n := v_n + 1;
    orden := v_n; prueba := replace(c.comercio, 'PRUEBA ', ''); regla := c.caso_prueba;
    if c.caso_prueba = 'ok' then
      esperado := 'Ticket correcto: no tiene que dar alertas';
      ok := cardinality(v_reglas) = 0;
    else
      esperado := 'Tiene que disparar la regla ' || c.caso_prueba;
      ok := c.caso_prueba = any(v_reglas);
    end if;
    resultado := coalesce(v_msgs, 'Sin alertas');
    return next;
  end loop;

  if v_emp is null then
    orden := v_n + 1; prueba := 'Configuración'; regla := '-'; esperado := 'Hay empleada y jefe';
    resultado := 'Faltan los usuarios demo'; ok := false; return next; return;
  end if;

  -- B) Duplicado exacto: el mismo e-Ticket no puede entrar dos veces
  begin
    insert into rendiciones (empleado_id, titulo, estado, es_prueba) values (v_emp, 't', 'borrador', true) returning id into v_r;
    insert into gastos (rendicion_id, empleado_id, rut_emisor, serie, numero, fecha, comercio, total, caso_prueba)
    values (v_r, v_emp, '219999999999', 'Z', '1', current_date, 'x', 1, 'tmp');
    begin
      insert into gastos (rendicion_id, empleado_id, rut_emisor, serie, numero, fecha, comercio, total, caso_prueba)
      values (v_r, v_emp, '219999999999', 'Z', '1', current_date, 'x', 1, 'tmp');
      v_ok := false; v_msg := 'La base dejó cargar dos veces el mismo e-Ticket.';
    exception when unique_violation then
      v_ok := true; v_msg := 'La base rechazó el segundo e-Ticket con el mismo RUT, serie y número.';
    end;
    raise exception 'rollback_prueba';
  exception when others then
    if sqlerrm <> 'rollback_prueba' then v_ok := false; v_msg := 'Error inesperado: ' || sqlerrm; end if;
  end;
  v_n := v_n + 1; orden := v_n; prueba := 'Mismo e-Ticket dos veces'; regla := 'duplicado';
  esperado := 'La base no lo deja guardar'; resultado := v_msg; ok := v_ok; return next;

  -- C) Motivo obligatorio: el jefe no puede rechazar sin explicar
  begin
    insert into rendiciones (empleado_id, titulo, estado, es_prueba) values (v_emp, 't', 'pendiente_jefe', true) returning id into v_r;
    v_g := _nuevo_gasto(v_r, v_emp, null, null, current_date, 'x', null, null, 100, 'otros', '[["x",100]]', 'pendiente', 'tmp');
    perform _como(v_jefe);
    begin
      perform decidir_gasto(v_g, 'rechazado', '');
      v_ok := false; v_msg := 'Dejó rechazar sin motivo.';
    exception when others then
      v_ok := sqlerrm ilike '%motivo%'; v_msg := 'La base respondió: ' || sqlerrm;
    end;
    raise exception 'rollback_prueba';
  exception when others then
    if sqlerrm <> 'rollback_prueba' then v_ok := false; v_msg := 'Error inesperado: ' || sqlerrm; end if;
  end;
  v_n := v_n + 1; orden := v_n; prueba := 'Jefe rechaza sin escribir motivo'; regla := 'motivo_obligatorio';
  esperado := 'La base lo frena'; resultado := v_msg; ok := v_ok; return next;

  -- D) Nadie se aprueba sus propios gastos
  begin
    insert into rendiciones (empleado_id, titulo, estado, es_prueba) values (v_emp, 't', 'pendiente_jefe', true) returning id into v_r;
    v_g := _nuevo_gasto(v_r, v_emp, null, null, current_date, 'x', null, null, 100, 'otros', '[["x",100]]', 'pendiente', 'tmp');
    perform _como(v_emp);
    begin
      perform decidir_gasto(v_g, 'aprobado', null);
      v_ok := false; v_msg := 'La empleada pudo aprobarse su propio gasto.';
    exception when others then
      v_ok := sqlerrm ilike '%propios%'; v_msg := 'La base respondió: ' || sqlerrm;
    end;
    raise exception 'rollback_prueba';
  exception when others then
    if sqlerrm <> 'rollback_prueba' then v_ok := false; v_msg := 'Error inesperado: ' || sqlerrm; end if;
  end;
  v_n := v_n + 1; orden := v_n; prueba := 'La empleada intenta aprobarse'; regla := 'autoaprobacion';
  esperado := 'La base lo frena'; resultado := v_msg; ok := v_ok; return next;

  -- E) Doble aprobación: más de $U 3.000 pasa a Finanzas; menos, alcanza con el jefe
  begin
    perform _como(v_jefe);
    insert into rendiciones (empleado_id, titulo, estado, es_prueba) values (v_emp, 't', 'pendiente_jefe', true) returning id into v_r;
    v_g := _nuevo_gasto(v_r, v_emp, null, null, current_date, 'x', null, null, 4000, 'alojamiento', '[["x",4000]]', 'pendiente', 'tmp');
    perform decidir_gasto(v_g, 'aprobado', null);
    select estado into v_e1 from rendiciones where id = v_r;
    insert into rendiciones (empleado_id, titulo, estado, es_prueba) values (v_emp, 't', 'pendiente_jefe', true) returning id into v_r2;
    v_g := _nuevo_gasto(v_r2, v_emp, null, null, current_date, 'x', null, null, 2000, 'alojamiento', '[["x",2000]]', 'pendiente', 'tmp');
    perform decidir_gasto(v_g, 'aprobado', null);
    select estado into v_e2 from rendiciones where id = v_r2;
    v_ok := v_e1 = 'revision_finanzas' and v_e2 = 'aprobada';
    v_msg := format('$U 4.000 quedó en "%s" y $U 2.000 quedó en "%s".', v_e1, v_e2);
    raise exception 'rollback_prueba';
  exception when others then
    if sqlerrm <> 'rollback_prueba' then v_ok := false; v_msg := 'Error inesperado: ' || sqlerrm; end if;
  end;
  v_n := v_n + 1; orden := v_n; prueba := 'Rendiciones de $U 4.000 y $U 2.000'; regla := 'doble_aprobacion';
  esperado := '4.000 va a Finanzas · 2.000 queda aprobada'; resultado := v_msg; ok := v_ok; return next;

  -- F) El reembolso descuenta lo personal y lo que el jefe no reconoce
  begin
    perform _como(v_jefe);
    insert into rendiciones (empleado_id, titulo, estado, es_prueba) values (v_emp, 't', 'pendiente_jefe', true) returning id into v_r;
    v_g := _nuevo_gasto(v_r, v_emp, null, null, current_date, 'x', null, null, 1800, 'alojamiento',
                        '[["Habitación",1000],["Vino",500,true,false],["Minibar",300]]', 'pendiente', 'tmp');
    select id into v_i from gasto_items where gasto_id = v_g and descripcion = 'Minibar';
    perform decidir_gasto(v_g, 'aprobado', 'El minibar no corresponde', array[v_i]);
    select estado, total_aprobado into v_e1, v_tot from rendiciones where id = v_r;
    v_ok := v_tot = 1000 and v_e1 = 'aprobada_parcial';
    v_msg := format('Ticket de $U 1.800: se reembolsan $U %s y la rendición quedó "%s".', v_tot, v_e1);
    raise exception 'rollback_prueba';
  exception when others then
    if sqlerrm <> 'rollback_prueba' then v_ok := false; v_msg := 'Error inesperado: ' || sqlerrm; end if;
  end;
  v_n := v_n + 1; orden := v_n; prueba := 'Ticket con vino personal y minibar no reconocido'; regla := 'monto_reembolsable';
  esperado := 'Se reembolsan $U 1.000 · aprobada parcial'; resultado := v_msg; ok := v_ok; return next;
end;
$$;

-- Qué tan bien lee la IA: compara lo que leyó con lo que la persona terminó guardando
create or replace function metricas_ia()
returns table (lecturas bigint, revisadas bigint, confianza_promedio numeric,
               campos_revisados bigint, campos_corregidos bigint, precision_pct numeric, mas_corregidos text)
language sql stable security definer set search_path = public as $$
  with rev as (select * from lecturas_ia where revisada),
       c   as (select unnest(campos_corregidos) as campo from rev),
       n   as (select count(*) as k from rev)
  select (select count(*) from lecturas_ia),
         (select k from n),
         (select round(avg(confianza) * 100, 1) from lecturas_ia),
         (select k * 8 from n),
         (select count(*) from c),
         case when (select k from n) = 0 then null
              else round(100 - 100.0 * (select count(*) from c) / ((select k from n) * 8), 1) end,
         (select string_agg(campo || ' (' || veces || ')', ', ')
            from (select campo, count(*) as veces from c group by campo order by veces desc limit 3) t)
$$;

revoke execute on function _nuevo_gasto(bigint, uuid, text, text, date, text, numeric, numeric, numeric, text, jsonb, text, text) from public, anon, authenticated;
revoke execute on function _cargar_demo() from public, anon, authenticated;
revoke execute on function _como(uuid) from public, anon, authenticated;
revoke execute on function reiniciar_demo() from public, anon;
revoke execute on function probar_reglas()  from public, anon;
revoke execute on function metricas_ia()    from public, anon;
grant  execute on function reiniciar_demo() to authenticated;
grant  execute on function probar_reglas()  to authenticated;
grant  execute on function metricas_ia()    to authenticated;

-- ---------- Control: si ves esta fila abajo, el archivo corrió COMPLETO.
-- Si dice "Success. No rows returned", NO corrió entero: volvé a pegarlo todo.
select '✓ Archivo 4 de 4 listo: ' || (select count(*) from perfiles) || ' de 3 perfiles y ' || (select count(*) from gastos where caso_prueba is not null) || ' de 7 casos de prueba cargados' as resultado;
