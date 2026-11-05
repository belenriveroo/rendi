-- =====================================================================
-- RENDÍ · Paso 1 de 4 · Tablas
-- Pegá TODO este archivo en Supabase > SQL Editor > New query > Run.
-- =====================================================================

-- Todo se crea en el esquema public, sin importar cómo esté configurado el editor
set search_path = public, extensions;

-- Quién es quién: un perfil por cada usuario que entra con login
create table if not exists perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null,
  area      text,
  rol       text not null check (rol in ('empleado', 'jefe', 'finanzas')),
  jefe_id   uuid references perfiles(id)
);

-- Topes por categoría de gasto (en pesos uruguayos)
create table if not exists politicas (
  categoria         text primary key,
  tope_comprobante  numeric not null
);

insert into politicas (categoria, tope_comprobante) values
  ('comidas',      1500),
  ('traslados',    2500),
  ('alojamiento',  4500),
  ('otros',        1000)
on conflict (categoria) do update set tope_comprobante = excluded.tope_comprobante;

-- Una rendición agrupa varios tickets (por ejemplo, un viaje)
create table if not exists rendiciones (
  id              bigint generated always as identity primary key,
  empleado_id     uuid not null references perfiles(id) default auth.uid(),
  titulo          text not null,
  estado          text not null default 'borrador' check (estado in (
                    'borrador', 'pendiente_jefe', 'devuelta', 'revision_finanzas',
                    'aprobada', 'aprobada_parcial', 'rechazada', 'reembolsada')),
  total_aprobado  numeric,
  es_prueba       boolean not null default false,  -- casos del panel de Control de calidad
  creada          timestamptz not null default now(),
  enviada         timestamptz
);

-- Cada ticket (comprobante)
create table if not exists gastos (
  id             bigint generated always as identity primary key,
  rendicion_id   bigint not null references rendiciones(id) on delete cascade,
  empleado_id    uuid not null references perfiles(id),
  rut_emisor     text,
  serie          text,
  numero         text,
  fecha          date,
  comercio       text,
  neto           numeric,
  iva            numeric,
  total          numeric,
  categoria      text not null default 'otros' references politicas(categoria),
  justificacion  text,
  estado         text not null default 'pendiente' check (estado in (
                   'pendiente', 'a_corregir', 'aprobado', 'aprobado_parcial', 'rechazado')),
  foto_path      text,
  caso_prueba    text,  -- qué regla tiene que disparar este caso de prueba
  creado         timestamptz not null default now()
);

-- Regla "duplicados" a nivel de base: el mismo e-Ticket no entra dos veces, ni tocando el código
create unique index if not exists gasto_unico
  on gastos (rut_emisor, serie, numero)
  where rut_emisor is not null and numero is not null;

-- Las líneas de cada ticket
create table if not exists gasto_items (
  id                    bigint generated always as identity primary key,
  gasto_id              bigint not null references gastos(id) on delete cascade,
  descripcion           text not null,
  importe               numeric not null,
  reembolsable          boolean not null default true,   -- false = la empleada lo marcó como personal
  es_alcohol            boolean not null default false,  -- lo marca la IA
  no_reconocido_por     uuid references perfiles(id),
  motivo_no_reconocido  text
);

-- Lo que respondió la IA y qué corrigió la persona (sirve para medir qué tan bien lee)
create table if not exists lecturas_ia (
  id                 bigint generated always as identity primary key,
  usuario_id         uuid not null references perfiles(id),
  gasto_id           bigint references gastos(id) on delete set null,
  json_crudo         jsonb not null,
  confianza          numeric,
  modelo             text,
  campos_corregidos  text[] not null default '{}',
  revisada           boolean not null default false,  -- la persona ya revisó y guardó lo que leyó la IA
  creado             timestamptz not null default now()
);

-- Hilo de comentarios de cada rendición
create table if not exists comentarios (
  id            bigint generated always as identity primary key,
  rendicion_id  bigint not null references rendiciones(id) on delete cascade,
  gasto_id      bigint references gastos(id) on delete cascade,
  autor_id      uuid not null references perfiles(id) default auth.uid(),
  texto         text not null,
  tipo          text not null default 'respuesta' check (tipo in ('corregir', 'rechazo', 'respuesta', 'ajuste', 'aprobacion')),
  fecha         timestamptz not null default now()
);

-- Registro de cada decisión de jefe o Finanzas
create table if not exists aprobaciones (
  id            bigint generated always as identity primary key,
  rendicion_id  bigint not null references rendiciones(id) on delete cascade,
  gasto_id      bigint references gastos(id) on delete cascade,
  aprobador_id  uuid not null references perfiles(id) default auth.uid(),
  etapa         text not null check (etapa in ('jefe', 'finanzas')),
  decision      text not null check (decision in ('aprobado', 'parcial', 'corregir', 'rechazado')),
  comentario    text,
  fecha         timestamptz not null default now()
);

create index if not exists gastos_rendicion on gastos (rendicion_id);
create index if not exists items_gasto on gasto_items (gasto_id);
create index if not exists lecturas_usuario on lecturas_ia (usuario_id, creado);

-- ---------- Control: si ves esta fila abajo, el archivo corrió COMPLETO.
-- Si dice "Success. No rows returned", NO corrió entero: volvé a pegarlo todo.
select '✓ Archivo 1 de 4 listo: ' || count(*) || ' de 8 tablas creadas' as resultado from pg_tables where schemaname = 'public' and tablename in ('perfiles','politicas','rendiciones','gastos','gasto_items','lecturas_ia','comentarios','aprobaciones');
