-- =====================================================================
-- RENDÍ · Paso 2 de 4 · Reglas del negocio
-- Todas las reglas viven acá, en la base. La página solo muestra lo que
-- la base responde: aunque alguien toque el navegador, no puede saltárselas.
-- Pegá TODO este archivo en SQL Editor > New query > Run.
-- =====================================================================

-- Todo se crea en el esquema public, sin importar cómo esté configurado el editor
set search_path = public, extensions;

-- ---------- Parámetros de la política de gastos (cambialos acá si querés)
create or replace function umbral_finanzas() returns numeric language sql immutable as $$ select 3000::numeric $$;
create or replace function tope_mensual()    returns numeric language sql immutable as $$ select 12000::numeric $$;
create or replace function plazo_dias()      returns int     language sql immutable as $$ select 60 $$;

-- ---------- Ayudas
create or replace function mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid()
$$;

-- ¿El usuario conectado puede ver las cosas de la persona u?
create or replace function puede_ver_usuario(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select u = auth.uid()
      or exists (select 1 from perfiles p where p.id = u and p.jefe_id = auth.uid())
      or coalesce(mi_rol() = 'finanzas', false)
$$;

-- ¿El usuario conectado puede ver esta rendición?
create or replace function puede_ver_rendicion(p_rend bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from rendiciones r
    where r.id = p_rend and not r.es_prueba and (
          r.empleado_id = auth.uid()
       or (r.estado <> 'borrador'
           and exists (select 1 from perfiles p where p.id = r.empleado_id and p.jefe_id = auth.uid()))
       or (coalesce(mi_rol() = 'finanzas', false)
           and r.estado in ('revision_finanzas', 'aprobada', 'aprobada_parcial', 'reembolsada'))
    )
  )
$$;

-- Lo que se reembolsa de un ticket: líneas no personales y reconocidas por el jefe
create or replace function monto_reembolsable(p_gasto bigint) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(importe), 0) from gasto_items
  where gasto_id = p_gasto and reembolsable and no_reconocido_por is null
$$;

-- ¿La empleada todavía puede tocar esta rendición?
create or replace function _editable(p_rend bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from rendiciones
                 where id = p_rend and empleado_id = auth.uid()
                   and estado in ('borrador', 'devuelta') and not es_prueba)
$$;

-- =====================================================================
-- LAS REGLAS: devuelve las alertas de un ticket
--   nivel 'bad'  = bloquea el envío (rojo)
--   nivel 'warn' = avisa pero deja enviar (amarillo)
--   nivel 'info' = solo informa
-- =====================================================================
create or replace function _alertas(p_gasto bigint)
returns table (regla text, nivel text, mensaje text)
language plpgsql stable security definer set search_path = public as $$
declare
  g        gastos;
  v_suma   numeric;
  v_reemb  numeric;
  v_tope   numeric;
  v_mes    numeric;
  v_tasa   numeric;
begin
  select * into g from gastos where id = p_gasto;
  if not found then return; end if;

  select coalesce(sum(importe), 0) into v_suma from gasto_items where gasto_id = p_gasto;
  v_reemb := monto_reembolsable(p_gasto);

  -- Datos mínimos
  if g.total is null or g.fecha is null or coalesce(trim(g.comercio), '') = '' then
    regla := 'datos'; nivel := 'bad';
    mensaje := 'Faltan datos básicos del ticket (comercio, fecha o total).';
    return next;
  end if;

  -- Regla: suma de líneas
  if g.total is not null and abs(v_suma - g.total) > 1 then
    regla := 'suma_lineas'; nivel := 'bad';
    mensaje := format('Las líneas suman $U %s y el total del ticket es $U %s. Puede que la IA haya leído mal una línea.',
                      round(v_suma, 2), round(g.total, 2));
    return next;
  end if;

  -- Regla: IVA consistente
  if g.neto is not null and g.iva is not null and g.total is not null then
    if abs(g.neto + g.iva - g.total) > 1 then
      regla := 'iva'; nivel := 'bad';
      mensaje := format('Neto ($U %s) + IVA ($U %s) no da el total ($U %s).',
                        round(g.neto, 2), round(g.iva, 2), round(g.total, 2));
      return next;
    elsif g.neto > 0 and g.iva > 0 then
      v_tasa := g.iva / g.neto;
      if abs(v_tasa - 0.22) > 0.01 and abs(v_tasa - 0.10) > 0.01 then
        regla := 'iva'; nivel := 'warn';
        mensaje := format('La tasa de IVA da %s %% (esperábamos 22 %% o 10 %%). Puede ser un error de lectura o un ticket con tasas mezcladas.',
                          round(v_tasa * 100, 1));
        return next;
      end if;
    end if;
  end if;

  -- Regla: duplicados (mismo comercio, fecha y total que otro ticket cargado ANTES)
  -- El duplicado exacto de e-Ticket (RUT + serie + número) ya lo frena el índice único.
  if g.comercio is not null and g.fecha is not null and g.total is not null then
    if exists (
      select 1 from gastos o
      where o.id < g.id
        and o.estado <> 'rechazado'
        and lower(trim(o.comercio)) = lower(trim(g.comercio))
        and o.fecha = g.fecha and o.total = g.total
        and (o.caso_prueba is null) = (g.caso_prueba is null)
    ) then
      regla := 'duplicado'; nivel := 'bad';
      mensaje := 'Ya hay un ticket del mismo comercio, con la misma fecha y el mismo total. Parece duplicado.';
      return next;
    end if;
  end if;

  -- Regla: lo que no se reembolsa (alcohol)
  if exists (select 1 from gasto_items
             where gasto_id = p_gasto and es_alcohol and reembolsable and no_reconocido_por is null) then
    regla := 'alcohol'; nivel := 'bad';
    mensaje := 'Hay bebidas alcohólicas. No se reembolsan: marcalas como personales.';
    return next;
  end if;

  -- Regla: tope por categoría (sobre las líneas reembolsables)
  select tope_comprobante into v_tope from politicas where categoria = g.categoria;
  if v_tope is not null and v_reemb > v_tope then
    if coalesce(trim(g.justificacion), '') = '' then
      regla := 'tope_categoria'; nivel := 'bad';
      mensaje := format('Supera el tope de $U %s para %s. Escribí una justificación para poder enviarlo.', v_tope, g.categoria);
    else
      regla := 'tope_categoria'; nivel := 'info';
      mensaje := format('Supera el tope de $U %s para %s. Justificación: %s', v_tope, g.categoria, g.justificacion);
    end if;
    return next;
  end if;

  -- Regla: plazo de rendición
  if g.fecha is not null and g.fecha > current_date then
    regla := 'fecha'; nivel := 'bad';
    mensaje := 'La fecha del ticket es futura. Revisá la lectura.';
    return next;
  elsif g.fecha is not null and g.fecha < current_date - plazo_dias() then
    regla := 'plazo'; nivel := 'warn';
    mensaje := format('El ticket tiene más de %s días: está fuera de plazo.', plazo_dias());
    return next;
  end if;

  -- Regla: tope mensual por persona
  if g.fecha is not null then
    select coalesce(sum(monto_reembolsable(o.id)), 0) into v_mes
    from gastos o
    where o.empleado_id = g.empleado_id
      and o.estado <> 'rechazado'
      and date_trunc('month', o.fecha) = date_trunc('month', g.fecha)
      and (o.caso_prueba is null) = (g.caso_prueba is null);
    if v_mes > tope_mensual() then
      regla := 'tope_mensual'; nivel := 'warn';
      mensaje := format('En ese mes ya lleva $U %s rendidos y el tope mensual es $U %s.', round(v_mes, 2), tope_mensual());
      return next;
    end if;
  end if;
end;
$$;

-- Versión que puede llamar la página: solo si podés ver ese ticket
create or replace function alertas_gasto(p_gasto bigint)
returns table (regla text, nivel text, mensaje text)
language sql stable security definer set search_path = public as $$
  select a.* from gastos g, lateral _alertas(g.id) a
  where g.id = p_gasto and puede_ver_rendicion(g.rendicion_id)
$$;

-- =====================================================================
-- ACCIONES DE LA EMPLEADA
-- =====================================================================
create or replace function crear_rendicion(p_titulo text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Ponele un nombre a la rendición (por ejemplo: Viaje a Salto).'; end if;
  if not exists (select 1 from perfiles where id = auth.uid() and jefe_id is not null) then
    raise exception 'Tu usuario no tiene un jefe asignado, así que no puede rendir gastos.';
  end if;
  insert into rendiciones (empleado_id, titulo) values (auth.uid(), trim(p_titulo)) returning id into v_id;
  return v_id;
end;
$$;

-- Carga los datos del ticket en las columnas (sirve para alta y para edición)
create or replace function _volcar_items(p_gasto bigint, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare i jsonb;
begin
  delete from gasto_items where gasto_id = p_gasto;
  for i in select * from jsonb_array_elements(coalesce(p_datos -> 'items', '[]'::jsonb)) loop
    if coalesce(trim(i ->> 'descripcion'), '') <> '' and nullif(i ->> 'importe', '') is not null then
      insert into gasto_items (gasto_id, descripcion, importe, es_alcohol, reembolsable)
      values (p_gasto, trim(i ->> 'descripcion'), (i ->> 'importe')::numeric,
              coalesce((i ->> 'es_alcohol')::boolean, false),
              coalesce((i ->> 'reembolsable')::boolean, true));
    end if;
  end loop;
end;
$$;

create or replace function _categoria_valida(c text) returns text
language sql stable set search_path = public as $$
  select coalesce((select categoria from politicas where categoria = lower(trim(c))), 'otros')
$$;

create or replace function _chequear_duplicado_exacto(p_datos jsonb, p_excluir bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_rend bigint;
begin
  select rendicion_id into v_rend from gastos
  where rut_emisor = nullif(trim(p_datos ->> 'rut_emisor'), '')
    and serie is not distinct from nullif(trim(p_datos ->> 'serie'), '')
    and numero = nullif(trim(p_datos ->> 'numero'), '')
    and id <> coalesce(p_excluir, -1)
  limit 1;
  if v_rend is not null then
    raise exception 'DUPLICADO: este e-Ticket (mismo RUT, serie y número) ya fue rendido en la rendición #%.', v_rend;
  end if;
end;
$$;

create or replace function guardar_gasto(p_rendicion bigint, p_datos jsonb,
                                         p_lectura bigint default null, p_foto text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_id      bigint;
  v_lectura jsonb;
  v_corr    text[] := '{}';
  k         text;
  a         text;
  b         text;
begin
  if not _editable(p_rendicion) then
    raise exception 'Esta rendición ya no se puede modificar.';
  end if;
  if p_foto is not null and p_foto not like auth.uid()::text || '/%' then
    raise exception 'La foto no es tuya.';
  end if;
  perform _chequear_duplicado_exacto(p_datos, null);

  insert into gastos (rendicion_id, empleado_id, rut_emisor, serie, numero, fecha, comercio,
                      neto, iva, total, categoria, justificacion, foto_path)
  values (p_rendicion, auth.uid(),
          nullif(trim(p_datos ->> 'rut_emisor'), ''),
          nullif(trim(p_datos ->> 'serie'), ''),
          nullif(trim(p_datos ->> 'numero'), ''),
          nullif(p_datos ->> 'fecha', '')::date,
          nullif(trim(p_datos ->> 'comercio'), ''),
          nullif(p_datos ->> 'neto', '')::numeric,
          nullif(p_datos ->> 'iva', '')::numeric,
          nullif(p_datos ->> 'total', '')::numeric,
          _categoria_valida(p_datos ->> 'categoria'),
          nullif(trim(p_datos ->> 'justificacion'), ''),
          p_foto)
  returning id into v_id;

  perform _volcar_items(v_id, p_datos);

  -- Comparamos lo que leyó la IA con lo que guardó la persona: así medimos la precisión
  if p_lectura is not null then
    select json_crudo into v_lectura from lecturas_ia where id = p_lectura and usuario_id = auth.uid();
    if v_lectura is not null then
      foreach k in array array['rut_emisor', 'serie', 'numero', 'fecha', 'comercio', 'neto', 'iva', 'total'] loop
        a := nullif(lower(trim(v_lectura ->> k)), '');
        b := nullif(lower(trim(p_datos ->> k)), '');
        if k in ('neto', 'iva', 'total') then
          begin
            if a::numeric is distinct from b::numeric then v_corr := v_corr || k; end if;
          exception when others then
            if a is distinct from b then v_corr := v_corr || k; end if;
          end;
        elsif a is distinct from b then
          v_corr := v_corr || k;
        end if;
      end loop;
      update lecturas_ia set gasto_id = v_id, campos_corregidos = v_corr, revisada = true where id = p_lectura;
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function actualizar_gasto(p_gasto bigint, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare g gastos;
begin
  select * into g from gastos where id = p_gasto;
  if not found or not _editable(g.rendicion_id) or g.estado not in ('pendiente', 'a_corregir') then
    raise exception 'Este ticket ya no se puede modificar.';
  end if;
  perform _chequear_duplicado_exacto(p_datos, p_gasto);
  update gastos set
    rut_emisor    = nullif(trim(p_datos ->> 'rut_emisor'), ''),
    serie         = nullif(trim(p_datos ->> 'serie'), ''),
    numero        = nullif(trim(p_datos ->> 'numero'), ''),
    fecha         = nullif(p_datos ->> 'fecha', '')::date,
    comercio      = nullif(trim(p_datos ->> 'comercio'), ''),
    neto          = nullif(p_datos ->> 'neto', '')::numeric,
    iva           = nullif(p_datos ->> 'iva', '')::numeric,
    total         = nullif(p_datos ->> 'total', '')::numeric,
    categoria     = _categoria_valida(p_datos ->> 'categoria'),
    justificacion = nullif(trim(p_datos ->> 'justificacion'), '')
  where id = p_gasto;
  perform _volcar_items(p_gasto, p_datos);
end;
$$;

create or replace function borrar_gasto(p_gasto bigint) returns void
language plpgsql security definer set search_path = public as $$
declare g gastos;
begin
  select * into g from gastos where id = p_gasto;
  if not found or not _editable(g.rendicion_id) or g.estado not in ('pendiente', 'a_corregir') then
    raise exception 'Este ticket ya no se puede borrar.';
  end if;
  delete from gastos where id = p_gasto;
end;
$$;

create or replace function set_item_personal(p_item bigint, p_personal boolean) returns void
language plpgsql security definer set search_path = public as $$
declare g gastos;
begin
  select gs.* into g from gastos gs join gasto_items i on i.gasto_id = gs.id where i.id = p_item;
  if not found or not _editable(g.rendicion_id) or g.estado not in ('pendiente', 'a_corregir') then
    raise exception 'Esta línea ya no se puede modificar.';
  end if;
  update gasto_items set reembolsable = not p_personal where id = p_item;
end;
$$;

create or replace function set_justificacion(p_gasto bigint, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare g gastos;
begin
  select * into g from gastos where id = p_gasto;
  if not found or not _editable(g.rendicion_id) or g.estado not in ('pendiente', 'a_corregir') then
    raise exception 'Este ticket ya no se puede modificar.';
  end if;
  update gastos set justificacion = nullif(trim(p_texto), '') where id = p_gasto;
end;
$$;

create or replace function enviar_rendicion(p_rend bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _editable(p_rend) then raise exception 'Esta rendición no se puede enviar.'; end if;
  if not exists (select 1 from gastos where rendicion_id = p_rend and estado in ('pendiente', 'a_corregir')) then
    raise exception 'No hay tickets para enviar.';
  end if;
  if exists (select 1 from gastos g, lateral _alertas(g.id) a
             where g.rendicion_id = p_rend and g.estado in ('pendiente', 'a_corregir') and a.nivel = 'bad') then
    raise exception 'Hay alertas en rojo sin resolver. Corregilas antes de enviar.';
  end if;
  update gastos set estado = 'pendiente' where rendicion_id = p_rend and estado = 'a_corregir';
  update rendiciones set estado = 'pendiente_jefe', enviada = now() where id = p_rend;
end;
$$;

create or replace function comentar(p_rend bigint, p_texto text, p_gasto bigint default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not puede_ver_rendicion(p_rend) then raise exception 'No podés comentar en esta rendición.'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'El comentario está vacío.'; end if;
  insert into comentarios (rendicion_id, gasto_id, autor_id, texto, tipo)
  values (p_rend, p_gasto, auth.uid(), trim(p_texto), 'respuesta');
end;
$$;

-- =====================================================================
-- ACCIONES DEL JEFE Y DE FINANZAS
-- =====================================================================

-- Estado final según lo que se aprobó
create or replace function _estado_final(p_rend bigint) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from gastos where rendicion_id = p_rend and estado in ('aprobado', 'aprobado_parcial'))
      then 'rechazada'
    when exists (select 1 from gastos where rendicion_id = p_rend and estado in ('rechazado', 'aprobado_parcial'))
      then 'aprobada_parcial'
    else 'aprobada'
  end
$$;

create or replace function _monto_aprobado(p_rend bigint) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(monto_reembolsable(id)), 0) from gastos
  where rendicion_id = p_rend and estado in ('aprobado', 'aprobado_parcial')
$$;

-- Cuando el jefe decidió todos los tickets, la rendición avanza sola
create or replace function _cerrar_etapa_jefe(p_rend bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_monto numeric; v_final text;
begin
  if exists (select 1 from gastos where rendicion_id = p_rend and estado = 'pendiente') then return; end if;
  if exists (select 1 from gastos where rendicion_id = p_rend and estado = 'a_corregir') then
    update rendiciones set estado = 'devuelta' where id = p_rend;
    return;
  end if;
  v_monto := _monto_aprobado(p_rend);
  v_final := _estado_final(p_rend);
  -- Regla: doble aprobación
  if v_final <> 'rechazada' and v_monto > umbral_finanzas() then
    update rendiciones set estado = 'revision_finanzas', total_aprobado = v_monto where id = p_rend;
  else
    update rendiciones set estado = v_final, total_aprobado = v_monto where id = p_rend;
  end if;
end;
$$;

create or replace function decidir_gasto(p_gasto bigint, p_decision text, p_motivo text default null,
                                         p_no_reconocidos bigint[] default '{}')
returns void
language plpgsql security definer set search_path = public as $$
declare
  g          gastos;
  v_rest     text;
  v_motivo   text := nullif(trim(p_motivo), '');
  v_parcial  boolean := coalesce(array_length(p_no_reconocidos, 1), 0) > 0;
  v_estado   text;
begin
  select * into g from gastos where id = p_gasto;
  if not found then raise exception 'No existe ese ticket.'; end if;

  -- Regla: nadie se aprueba sus propios gastos
  if g.empleado_id = auth.uid() then raise exception 'No podés aprobar tus propios gastos.'; end if;
  if not exists (select 1 from perfiles where id = g.empleado_id and jefe_id = auth.uid()) then
    raise exception 'Solo el jefe de esta persona puede decidir sobre sus tickets.';
  end if;

  select estado into v_rest from rendiciones where id = g.rendicion_id;
  if v_rest <> 'pendiente_jefe' or g.estado <> 'pendiente' then
    raise exception 'Este ticket no está esperando tu decisión.';
  end if;
  if p_decision not in ('aprobado', 'corregir', 'rechazado') then
    raise exception 'Decisión desconocida.';
  end if;

  -- Regla: motivo obligatorio
  if p_decision <> 'aprobado' and v_motivo is null then
    raise exception 'Escribí el motivo: la empleada tiene que saber por qué.';
  end if;
  if v_parcial and v_motivo is null then
    raise exception 'Para no reconocer una línea tenés que escribir el motivo.';
  end if;

  if p_decision = 'aprobado' and v_parcial then
    update gasto_items set no_reconocido_por = auth.uid(), motivo_no_reconocido = v_motivo
    where gasto_id = p_gasto and id = any(p_no_reconocidos);
    v_estado := 'aprobado_parcial';
  else
    v_estado := case p_decision when 'aprobado' then 'aprobado' when 'corregir' then 'a_corregir' else 'rechazado' end;
  end if;

  update gastos set estado = v_estado where id = p_gasto;

  insert into aprobaciones (rendicion_id, gasto_id, aprobador_id, etapa, decision, comentario)
  values (g.rendicion_id, p_gasto, auth.uid(), 'jefe',
          case when v_estado = 'aprobado_parcial' then 'parcial' else p_decision end, v_motivo);

  if v_motivo is not null then
    insert into comentarios (rendicion_id, gasto_id, autor_id, texto, tipo)
    values (g.rendicion_id, p_gasto, auth.uid(), v_motivo,
            case when p_decision = 'corregir' then 'corregir'
                 when p_decision = 'rechazado' then 'rechazo'
                 when v_parcial then 'ajuste'
                 else 'aprobacion' end);
  end if;

  perform _cerrar_etapa_jefe(g.rendicion_id);
end;
$$;

create or replace function decidir_finanzas(p_rend bigint, p_aprobar boolean, p_motivo text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare r rendiciones; v_motivo text := nullif(trim(p_motivo), '');
begin
  if coalesce(mi_rol(), '') <> 'finanzas' then raise exception 'Solo Finanzas puede hacer esto.'; end if;
  select * into r from rendiciones where id = p_rend;
  if not found or r.estado <> 'revision_finanzas' then raise exception 'Esta rendición no está en revisión de Finanzas.'; end if;
  if r.empleado_id = auth.uid() then raise exception 'No podés aprobar tus propios gastos.'; end if;
  if not p_aprobar and v_motivo is null then raise exception 'Escribí el motivo del rechazo.'; end if;

  if p_aprobar then
    update rendiciones set estado = _estado_final(p_rend) where id = p_rend;
  else
    update rendiciones set estado = 'rechazada', total_aprobado = 0 where id = p_rend;
  end if;

  insert into aprobaciones (rendicion_id, aprobador_id, etapa, decision, comentario)
  values (p_rend, auth.uid(), 'finanzas', case when p_aprobar then 'aprobado' else 'rechazado' end, v_motivo);
  if v_motivo is not null then
    insert into comentarios (rendicion_id, autor_id, texto, tipo)
    values (p_rend, auth.uid(), v_motivo, case when p_aprobar then 'aprobacion' else 'rechazo' end);
  end if;
end;
$$;

create or replace function marcar_reembolsada(p_rend bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(mi_rol(), '') <> 'finanzas' then raise exception 'Solo Finanzas puede hacer esto.'; end if;
  update rendiciones set estado = 'reembolsada'
  where id = p_rend and estado in ('aprobada', 'aprobada_parcial');
  if not found then raise exception 'Esta rendición no está lista para reembolsar.'; end if;
end;
$$;

-- ---------- Control: si ves esta fila abajo, el archivo corrió COMPLETO.
-- Si dice "Success. No rows returned", NO corrió entero: volvé a pegarlo todo.
select '✓ Archivo 2 de 4 listo: ' || count(*) || ' de 27 funciones creadas' as resultado from pg_proc where pronamespace = 'public'::regnamespace and proname in ('umbral_finanzas','tope_mensual','plazo_dias','mi_rol','puede_ver_usuario','puede_ver_rendicion','monto_reembolsable','_editable','_alertas','alertas_gasto','crear_rendicion','_volcar_items','_categoria_valida','_chequear_duplicado_exacto','guardar_gasto','actualizar_gasto','borrar_gasto','set_item_personal','set_justificacion','enviar_rendicion','comentar','_estado_final','_monto_aprobado','_cerrar_etapa_jefe','decidir_gasto','decidir_finanzas','marcar_reembolsada');
