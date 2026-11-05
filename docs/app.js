// =====================================================================
// RENDÍ · la aplicación. No hace falta tocar este archivo.
// Lee y escribe en Supabase; todas las reglas las controla la base.
// =====================================================================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const CFG = window.RENDI_CONFIG || {};
const app = document.getElementById("app");
const configurado = !!CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes("TU-PROYECTO")
  && !!CFG.SUPABASE_KEY && !CFG.SUPABASE_KEY.includes("PEGÁ");
const sb = configurado ? createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY) : null;

const S = { perfil: null, vista: null, rendId: null, revisiones: [], fotos: {} };

// ---------------------------------------------------------------- utilidades
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plata = (n) => n === null || n === undefined || n === "" ? "—"
  : "$U " + Number(n).toLocaleString("es-UY", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const fecha = (f) => f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" }) : "—";
const numero = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); if (!s) return null; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const msg = (e) => (e?.message || String(e)).replace(/^DUPLICADO: /, "Duplicado: ");
const CATEGORIAS = ["comidas", "traslados", "alojamiento", "otros"];

const EST_R = {
  borrador: ["Borrador", "e-info"], pendiente_jefe: ["Pendiente jefe", "e-pend"], devuelta: ["Devuelta para corregir", "e-mal"],
  revision_finanzas: ["Revisión Finanzas", "e-pend"], aprobada: ["Aprobada", "e-ok"], aprobada_parcial: ["Aprobada parcial", "e-ok"],
  rechazada: ["Rechazada", "e-mal"], reembolsada: ["Reembolsada", ""],
};
const EST_G = {
  pendiente: ["Pendiente", "e-pend"], a_corregir: ["A corregir", "e-mal"], aprobado: ["Aprobado", "e-ok"],
  aprobado_parcial: ["Aprobado parcial", "e-ok"], rechazado: ["Rechazado", "e-mal"],
};
const pill = (mapa, e) => { const [t, c] = mapa[e] || [e, ""]; return `<span class="pill ${c}">${esc(t)}</span>`; };

let toastT;
function toast(texto, mal = false) {
  const t = document.getElementById("toast");
  t.textContent = texto; t.className = "toast" + (mal ? " mal" : ""); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), mal ? 6000 : 3500);
}
async function rpc(nombre, args) { const { data, error } = await sb.rpc(nombre, args); if (error) throw error; return data; }
async function q(consulta) { const { data, error } = await consulta; if (error) throw error; return data; }
const reembolsable = (items) => (items || []).filter((i) => i.reembolsable && !i.no_reconocido_por).reduce((s, i) => s + Number(i.importe), 0);

// ---------------------------------------------------------------- arranque
async function arrancar() {
  if (!configurado) return pantallaSinConfigurar();
  const { data } = await sb.auth.getSession();
  if (data.session) await entrarConSesion(); else pantallaLogin();
}

function pantallaSinConfigurar() {
  app.innerHTML = `<div class="entrada"><div class="marca">Rendí<span>.</span></div>
    <div class="card"><h2>Falta un paso</h2>
    <p>Abrí el archivo <b class="mono">config.js</b> y pegá la <b>Project URL</b> y la <b>clave pública</b> de tu proyecto de Supabase.
    Las encontrás en Supabase &gt; Project Settings &gt; API.</p></div></div>`;
}

function pantallaLogin() {
  const demo = CFG.USUARIOS_DEMO || [];
  app.innerHTML = `
  <div class="entrada">
    <header>
      <div class="marca">Rendí<span>.</span></div>
      <p class="tesis">Le sacás foto al ticket, la IA lo carga, el sistema chequea las reglas y Finanzas te reembolsa.</p>
    </header>
    <section class="lista">
      <h2>Elegí con quién entrar</h2>
      <div class="personas">
        ${demo.map((u, i) => `
          <button class="card persona" data-a="entrar" data-i="${i}">
            <span class="rol">${esc(u.rol)}</span><b>${esc(u.nombre)}</b>
            <span class="small muted">${esc(u.hace || "")}</span>
            <span class="xs mono muted">${esc(u.email)} · ${esc(u.clave)}</span>
          </button>`).join("")}
      </div>
    </section>
    <details class="card"><summary>Entrar con otro usuario</summary>
      <form class="campos" data-form="login" style="margin-top:12px">
        <label>Email<input name="email" type="email" autocomplete="username" required></label>
        <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
        <div class="fila"><button class="btn-p">Entrar</button></div>
      </form>
    </details>
    <p class="aviso">Demo de un trabajo de facultad. Las personas y los datos de ejemplo son ficticios: no subas tickets con datos de otras personas.</p>
  </div>`;
}

async function entrar(email, clave) {
  const { error } = await sb.auth.signInWithPassword({ email, password: clave });
  if (error) return toast("No pude entrar: " + error.message, true);
  await entrarConSesion();
}

async function entrarConSesion() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return pantallaLogin();
  S.uid = user.id;
  S.perfil = await q(sb.from("perfiles").select("*").eq("id", user.id).maybeSingle());
  if (!S.perfil) {
    app.innerHTML = `<div class="entrada"><div class="card"><h2>Tu usuario no tiene perfil</h2>
      <p>Corré el archivo <b class="mono">04_demo_y_calidad.sql</b> en Supabase para crear los perfiles.</p>
      <div><button data-a="salir">Salir</button></div></div></div>`;
    return;
  }
  S.vista = tabs()[0][0]; S.rendId = null;
  pintar();
}

function tabs() {
  const r = S.perfil?.rol;
  if (r === "jefe") return [["aprobar", "Por aprobar"], ["equipo", "Mi equipo"], ["calidad", "Control de calidad"]];
  if (r === "finanzas") return [["revision", "Revisión Finanzas"], ["reembolsar", "A reembolsar"], ["totales", "Totales"], ["calidad", "Control de calidad"]];
  return [["mias", "Mis rendiciones"], ["calidad", "Control de calidad"]];
}

// ---------------------------------------------------------------- marco general
async function pintar() {
  guardarBorradores();
  const rolTxt = { empleado: "Empleada", jefe: "Jefe", finanzas: "Finanzas" }[S.perfil.rol];
  app.innerHTML = `
  <div class="wrap">
    <header class="top">
      <div class="marca">Rendí<span>.</span></div>
      <div class="yo"><span><b>${esc(S.perfil.nombre)}</b> · <span class="muted">${esc(rolTxt)}</span></span>
        <button data-a="salir">Salir</button></div>
    </header>
    <nav class="tabs">${tabs().map(([k, t]) => `<button data-a="tab" data-v="${k}" ${!S.rendId && S.vista === k ? 'aria-current="page"' : ""}>${esc(t)}</button>`).join("")}</nav>
    <main id="contenido"><p class="cargando">Cargando…</p></main>
  </div>`;
  const c = document.getElementById("contenido");
  try {
    if (S.rendId) c.innerHTML = await vistaDetalle(S.rendId);
    else c.innerHTML = await ({
      mias: vistaMias, aprobar: vistaPorAprobar, equipo: vistaEquipo, revision: vistaRevision,
      reembolsar: vistaReembolsar, totales: vistaTotales, calidad: vistaCalidad,
    }[S.vista] || vistaMias)();
    if (S.rendId) pintarRevisiones();
  } catch (e) {
    c.innerHTML = `<div class="card"><h2>Algo falló</h2><p class="muted">${esc(msg(e))}</p></div>`;
  }
}

// ---------------------------------------------------------------- listas
async function traerRendiciones() {
  return q(sb.from("rendiciones")
    .select("id,titulo,estado,creada,enviada,total_aprobado,empleado_id,perfiles(nombre),gastos(id,total,estado)")
    .order("creada", { ascending: false }));
}

function listaRendiciones(rs, vacio, mostrarQuien = true) {
  if (!rs.length) return `<div class="vacio">${esc(vacio)}</div>`;
  return `<div class="lista">${rs.map((r) => {
    const n = r.gastos?.length || 0;
    const tot = (r.gastos || []).reduce((s, g) => s + Number(g.total || 0), 0);
    return `<button class="item-lista" data-a="abrir" data-id="${r.id}">
      <span><b>${esc(r.titulo)}</b><br><span class="small muted">
        ${mostrarQuien && r.empleado_id !== S.uid ? esc(r.perfiles?.nombre) + " · " : ""}${n} ticket${n === 1 ? "" : "s"} · ${plata(tot)}
        ${r.total_aprobado !== null && r.total_aprobado !== undefined ? " · a reembolsar " + plata(r.total_aprobado) : ""} · ${fecha(r.enviada || r.creada)}</span></span>
      ${pill(EST_R, r.estado)}
    </button>`;
  }).join("")}</div>`;
}

async function vistaMias() {
  const rs = (await traerRendiciones()).filter((r) => r.empleado_id === S.uid);
  return `<div class="lista">
    <form class="card" data-form="nueva">
      <h2>Nueva rendición</h2>
      <p class="small muted">Agrupá los tickets de un viaje o de una actividad. Después le sacás foto a cada uno.</p>
      <div class="fila"><input name="titulo" placeholder="Ej.: Viaje a Salto · visita a cliente" style="flex:1 1 240px" required>
      <button class="btn-p">Crear</button></div>
    </form>
    <h2>Mis rendiciones</h2>
    ${listaRendiciones(rs, "Todavía no tenés rendiciones. Creá la primera arriba.", false)}
  </div>`;
}

async function vistaPorAprobar() {
  const rs = (await traerRendiciones()).filter((r) => r.estado === "pendiente_jefe" && r.empleado_id !== S.uid);
  return `<div class="lista"><h2>Por aprobar</h2>
    <p class="small muted">Rendiciones de tu equipo que esperan tu decisión. Podés aprobar, pedir corrección o rechazar cada ticket.</p>
    ${listaRendiciones(rs, "No tenés nada pendiente.")}</div>`;
}

async function vistaEquipo() {
  const rs = (await traerRendiciones()).filter((r) => r.empleado_id !== S.uid);
  return `<div class="lista"><h2>Todas las rendiciones de tu equipo</h2>${listaRendiciones(rs, "Tu equipo todavía no envió rendiciones.")}</div>`;
}

async function vistaRevision() {
  const rs = (await traerRendiciones()).filter((r) => r.estado === "revision_finanzas");
  return `<div class="lista"><h2>Revisión Finanzas</h2>
    <p class="small muted">El jefe ya aprobó y lo aprobado supera ${plata(3000)}: falta tu visto bueno.</p>
    ${listaRendiciones(rs, "No hay rendiciones esperando a Finanzas.")}</div>`;
}

async function vistaReembolsar() {
  const rs = await traerRendiciones();
  return `<div class="lista"><h2>A reembolsar</h2>
    ${listaRendiciones(rs.filter((r) => ["aprobada", "aprobada_parcial"].includes(r.estado)), "No hay reembolsos pendientes.")}
    <h2 style="margin-top:12px">Ya reembolsadas</h2>
    ${listaRendiciones(rs.filter((r) => r.estado === "reembolsada"), "Todavía no hay reembolsos.")}</div>`;
}

// ---------------------------------------------------------------- totales (Finanzas)
async function vistaTotales() {
  const gs = await q(sb.from("gastos")
    .select("id,fecha,categoria,estado,comercio,perfiles(nombre),gasto_items(importe,reembolsable,no_reconocido_por),rendiciones(titulo,estado)"));
  const filas = gs.filter((g) => ["aprobado", "aprobado_parcial"].includes(g.estado)
    && ["aprobada", "aprobada_parcial", "reembolsada"].includes(g.rendiciones?.estado))
    .map((g) => ({ persona: g.perfiles?.nombre || "—", categoria: g.categoria, mes: String(g.fecha || "").slice(0, 7) || "sin fecha",
      monto: reembolsable(g.gasto_items), pagado: g.rendiciones.estado === "reembolsada", comercio: g.comercio, rendicion: g.rendiciones.titulo, fecha: g.fecha }));
  S.totales = filas;
  const suma = (arr) => arr.reduce((s, f) => s + f.monto, 0);
  const agrupar = (k) => Object.entries(filas.reduce((a, f) => ((a[f[k]] = (a[f[k]] || 0) + f.monto), a), {})).sort((a, b) => b[1] - a[1]);
  const tabla = (titulo, filasT) => `<div class="card"><h3>${titulo}</h3><div class="tabla-wrap"><table class="t"><tbody>
    ${filasT.length ? filasT.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${plata(v)}</td></tr>`).join("") : `<tr><td class="muted">Sin datos</td></tr>`}
    </tbody></table></div></div>`;
  return `<div class="lista">
    <div class="fila entre"><h2>Totales aprobados</h2><button data-a="csv">Descargar CSV</button></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${plata(suma(filas))}</div><div class="k">Aprobado en total</div></div>
      <div class="kpi"><div class="v">${plata(suma(filas.filter((f) => f.pagado)))}</div><div class="k">Ya reembolsado</div></div>
      <div class="kpi"><div class="v">${plata(suma(filas.filter((f) => !f.pagado)))}</div><div class="k">Pendiente de reembolso</div></div>
    </div>
    <div class="grid2">${tabla("Por persona", agrupar("persona"))}${tabla("Por categoría", agrupar("categoria"))}${tabla("Por mes", agrupar("mes"))}</div>
  </div>`;
}

function descargarCsv() {
  const f = S.totales || [];
  const lineas = [["fecha", "persona", "rendicion", "comercio", "categoria", "monto_reembolsable", "reembolsado"]]
    .concat(f.map((x) => [x.fecha, x.persona, x.rendicion, x.comercio, x.categoria, x.monto, x.pagado ? "si" : "no"]));
  const csv = lineas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
  a.download = "rendi-totales.csv"; a.click();
}

// ---------------------------------------------------------------- MEJORA: Control de calidad
async function vistaCalidad() {
  const [pruebas, met] = await Promise.all([rpc("probar_reglas"), rpc("metricas_ia")]);
  const m = met?.[0] || {};
  const ok = pruebas.filter((p) => p.ok).length;
  const todo = ok === pruebas.length;
  return `<div class="lista">
    <div class="card">
      <div class="fila entre">
        <div><h2>Control de calidad</h2>
        <p class="small muted">Cada vez que abrís esta pantalla, la base corre las reglas contra casos de prueba conocidos
        (un ticket correcto, uno duplicado, uno con IVA mal leído, etc.) y simula aprobaciones para ver que nadie se salte los controles.
        Las pruebas no dejan nada guardado.</p></div>
        <div style="text-align:right"><div class="puntaje ${todo ? "ok" : "mal"}">${ok}/${pruebas.length}</div><div class="xs muted">pruebas que pasan</div></div>
      </div>
      <div class="tabla-wrap"><table class="t">
        <thead><tr><th></th><th>Caso de prueba</th><th>Qué tiene que pasar</th><th>Qué pasó</th></tr></thead>
        <tbody>${pruebas.map((p) => `<tr>
          <td><span class="pill ${p.ok ? "e-ok" : "e-mal"}">${p.ok ? "Pasa" : "Falla"}</span></td>
          <td><b>${esc(p.prueba)}</b><br><span class="xs mono muted">${esc(p.regla)}</span></td>
          <td class="small">${esc(p.esperado)}</td><td class="small muted">${esc(p.resultado)}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="fila"><button data-a="tab" data-v="calidad">Volver a correr las pruebas</button></div>
    </div>
    <div class="card">
      <h2>¿Qué tan bien lee la IA?</h2>
      <p class="small muted">Comparamos lo que leyó la IA con lo que la persona terminó guardando, campo por campo (RUT, serie, número, fecha, comercio, neto, IVA y total).</p>
      ${m.revisadas ? `<div class="kpis">
        <div class="kpi"><div class="v">${m.precision_pct ?? "—"} %</div><div class="k">campos leídos bien</div></div>
        <div class="kpi"><div class="v">${m.revisadas}</div><div class="k">tickets revisados</div></div>
        <div class="kpi"><div class="v">${m.campos_corregidos}/${m.campos_revisados}</div><div class="k">campos que hubo que corregir</div></div>
        <div class="kpi"><div class="v">${m.confianza_promedio ?? "—"} %</div><div class="k">confianza que dice la IA</div></div>
      </div>
      <p class="small">Lo que más se corrige: <b>${esc(m.mas_corregidos || "nada todavía")}</b></p>`
      : `<div class="vacio">Todavía no hay tickets leídos por la IA. Entrá como la empleada y subí una foto.</div>`}
    </div>
    <div class="card">
      <h3>Reiniciar datos de ejemplo</h3>
      <p class="small muted">Borra todas las rendiciones y vuelve a cargar las de ejemplo. Las métricas de la IA se mantienen.</p>
      <div><button class="btn-mal" data-a="reiniciar">Reiniciar datos demo</button></div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- detalle de una rendición
async function urlFoto(path) {
  if (!path) return null;
  if (S.fotos[path]) return S.fotos[path];
  const { data } = await sb.storage.from("tickets").createSignedUrl(path, 3600);
  return (S.fotos[path] = data?.signedUrl || null);
}

async function vistaDetalle(id) {
  const [r, gastos, coms, aprs] = await Promise.all([
    q(sb.from("rendiciones").select("*,perfiles(nombre)").eq("id", id).maybeSingle()),
    q(sb.from("gastos").select("*,gasto_items(*)").eq("rendicion_id", id).order("id")),
    q(sb.from("comentarios").select("*,perfiles(nombre)").eq("rendicion_id", id).order("fecha")),
    q(sb.from("aprobaciones").select("*,perfiles(nombre)").eq("rendicion_id", id).order("fecha")),
  ]);
  if (!r) { S.rendId = null; return `<div class="vacio">No encontré esa rendición o no tenés permiso para verla.</div>`; }
  const alertas = await Promise.all(gastos.map((g) => rpc("alertas_gasto", { p_gasto: g.id })));
  const fotos = await Promise.all(gastos.map((g) => urlFoto(g.foto_path)));
  gastos.forEach((g) => g.gasto_items.sort((a, b) => a.id - b.id));

  const duena = r.empleado_id === S.uid;
  const editable = duena && ["borrador", "devuelta"].includes(r.estado);
  const jefeDecide = S.perfil.rol === "jefe" && r.estado === "pendiente_jefe" && !duena;
  const finDecide = S.perfil.rol === "finanzas" && r.estado === "revision_finanzas";
  const finPaga = S.perfil.rol === "finanzas" && ["aprobada", "aprobada_parcial"].includes(r.estado);
  const totTickets = gastos.reduce((s, g) => s + Number(g.total || 0), 0);
  const aReemb = r.total_aprobado ?? gastos.filter((g) => g.estado !== "rechazado").reduce((s, g) => s + reembolsable(g.gasto_items), 0);
  const rojas = alertas.some((as, i) => ["pendiente", "a_corregir"].includes(gastos[i].estado) && as.some((a) => a.nivel === "bad"));
  S.detalle = { r, gastos };

  return `<div class="lista">
    <div><button class="btn-link" data-a="volver">← Volver</button></div>
    <section class="card">
      <div class="fila entre"><h1>${esc(r.titulo)}</h1>${pill(EST_R, r.estado)}</div>
      <p class="small muted">Rinde <b>${esc(r.perfiles?.nombre)}</b> · creada ${fecha(r.creada)}${r.enviada ? " · enviada " + fecha(r.enviada) : ""}</p>
      <div class="kpis">
        <div class="kpi"><div class="v">${gastos.length}</div><div class="k">tickets</div></div>
        <div class="kpi"><div class="v">${plata(totTickets)}</div><div class="k">total de los tickets</div></div>
        <div class="kpi"><div class="v">${plata(aReemb)}</div><div class="k">${r.total_aprobado !== null ? "aprobado para reembolsar" : "a reembolsar (sin lo personal)"}</div></div>
      </div>
      ${r.estado === "devuelta" && duena ? `<div class="alerta bad"><b>!</b><span>Tu jefe pidió corregir algunos tickets. Mirá los comentarios abajo, corregí y volvé a enviar.</span></div>` : ""}
    </section>

    ${editable ? `<section class="card">
      <div class="subir">
        <h2>Agregar tickets</h2>
        <p class="small muted">Sacale foto (o elegí varias de la galería). La IA lee cada ticket y vos revisás antes de guardar.</p>
        <label class="btn btn-p">Sacar foto o elegir tickets<input type="file" id="archivos" accept="image/*" multiple></label>
        <button class="btn-link" data-a="manual">o cargar un ticket a mano</button>
      </div>
      <div id="revs" class="lista"></div>
      <div class="fila entre">
        <span class="small ${rojas ? "" : "muted"}">${rojas ? "Hay alertas en rojo: corregilas para poder enviar." : gastos.length ? "Todo listo para enviar." : "Agregá al menos un ticket."}</span>
        <button class="btn-p" data-a="enviar" ${!gastos.length || rojas ? "disabled" : ""}>Enviar a mi jefe</button>
      </div>
    </section>` : ""}

    ${gastos.map((g, i) => tarjetaGasto(g, alertas[i], fotos[i], { editable, jefeDecide })).join("")
      || (editable ? "" : `<div class="vacio">Esta rendición no tiene tickets.</div>`)}

    ${finDecide ? `<section class="card">
      <h2>Decisión de Finanzas</h2>
      <p class="small muted">El jefe aprobó ${plata(r.total_aprobado)}. Como supera ${plata(3000)}, necesita tu aprobación.</p>
      <label>Motivo (obligatorio si rechazás)<input id="motivo-fin"></label>
      <div class="fila"><button class="btn-p" data-a="fin" data-ok="1">Aprobar</button><button class="btn-mal" data-a="fin" data-ok="0">Rechazar</button></div>
    </section>` : ""}
    ${finPaga ? `<section class="card"><div class="fila entre">
      <div><h2>Reembolso</h2><p class="small muted">Cuando hagas la transferencia en el banco, marcala como pagada.</p></div>
      <button class="btn-p" data-a="pagar">Marcar como reembolsada · ${plata(r.total_aprobado)}</button></div></section>` : ""}

    <section class="card">
      <h2>Historial y comentarios</h2>
      <div class="hilo">
        ${aprs.map((a) => `<div class="msg"><div class="quien">${esc(a.perfiles?.nombre)} · ${a.etapa === "jefe" ? "Jefe" : "Finanzas"} · ${fecha(a.fecha)}</div>
          Decisión: <b>${esc({ aprobado: "aprobado", parcial: "aprobado parcial", corregir: "pidió corrección", rechazado: "rechazado" }[a.decision])}</b>${a.gasto_id ? ` en el ticket de ${esc(gastos.find((g) => g.id === a.gasto_id)?.comercio || "#" + a.gasto_id)}` : " (toda la rendición)"}</div>`).join("")}
        ${coms.map((c) => `<div class="msg"><div class="quien">${esc(c.perfiles?.nombre)} · ${fecha(c.fecha)}</div>${esc(c.texto)}</div>`).join("")}
        ${!aprs.length && !coms.length ? `<p class="small muted">Todavía no hay movimientos.</p>` : ""}
      </div>
      ${r.estado !== "borrador" || duena ? `<form class="fila" data-form="comentar"><input name="texto" placeholder="Escribí un comentario" style="flex:1 1 220px"><button>Comentar</button></form>` : ""}
    </section>
  </div>`;
}

function tarjetaGasto(g, alertas, foto, { editable, jefeDecide }) {
  const gEditable = editable && ["pendiente", "a_corregir"].includes(g.estado);
  const decide = jefeDecide && g.estado === "pendiente";
  const visibles = alertas.filter((a) => a.nivel !== "ok");
  return `<article class="card">
    <div class="gasto">
      <div class="foto">${foto ? `<a href="${esc(foto)}" target="_blank" rel="noopener"><img src="${esc(foto)}" alt="Foto del ticket de ${esc(g.comercio)}"></a>` : "sin foto"}</div>
      <div class="lista">
        <div class="fila entre"><h3>${esc(g.comercio || "Sin comercio")}</h3>${pill(EST_G, g.estado)}</div>
        <p class="small muted">${fecha(g.fecha)} · ${esc(g.categoria)}${g.rut_emisor ? ` · RUT ${esc(g.rut_emisor)}` : ""}${g.numero ? ` · ${esc(g.serie || "")} ${esc(g.numero)}` : ""}</p>
        <p>Total <b class="num">${plata(g.total)}</b> <span class="small muted">· neto ${plata(g.neto)} · IVA ${plata(g.iva)} · se reembolsa <b>${plata(reembolsable(g.gasto_items))}</b></span></p>
        <div class="alertas">${visibles.length ? visibles.map((a) => `<div class="alerta ${esc(a.nivel)}"><b>${a.nivel === "bad" ? "✕" : a.nivel === "warn" ? "!" : "i"}</b><span>${esc(a.mensaje)}</span></div>`).join("")
          : ["pendiente", "a_corregir"].includes(g.estado) ? `<div class="alerta ok"><b>✓</b><span>Pasa todas las reglas.</span></div>` : ""}</div>
        <table class="lineas"><thead><tr><th>Línea</th><th class="r">Importe</th>${gEditable ? "<th>Personal</th>" : ""}${decide ? "<th>No reconocer</th>" : ""}</tr></thead><tbody>
          ${g.gasto_items.map((i) => `<tr class="${!i.reembolsable || i.no_reconocido_por ? "tachada" : ""}">
            <td class="desc">${esc(i.descripcion)}${i.es_alcohol ? '<span class="tag alc">alcohol</span>' : ""}${!i.reembolsable ? '<span class="tag per">personal</span>' : ""}${i.no_reconocido_por ? `<span class="tag nr" title="${esc(i.motivo_no_reconocido)}">no reconocido</span>` : ""}</td>
            <td class="r num">${plata(i.importe)}</td>
            ${gEditable ? `<td><input type="checkbox" data-a="personal" data-item="${i.id}" ${!i.reembolsable ? "checked" : ""} aria-label="Marcar ${esc(i.descripcion)} como personal"></td>` : ""}
            ${decide ? `<td><input type="checkbox" class="nr-${g.id}" value="${i.id}" aria-label="No reconocer ${esc(i.descripcion)}"></td>` : ""}
          </tr>`).join("") || `<tr><td class="muted" colspan="3">Sin líneas</td></tr>`}
        </tbody></table>
        ${gEditable ? `<label>Justificación (obligatoria si supera el tope)
            <textarea data-just="${g.id}" placeholder="¿Para qué fue este gasto?">${esc(g.justificacion || "")}</textarea></label>
          <div class="fila"><button data-a="just" data-gasto="${g.id}">Guardar justificación</button>
          <button data-a="editar" data-gasto="${g.id}">Corregir datos</button>
          <button class="btn-mal" data-a="borrar" data-gasto="${g.id}">Borrar ticket</button></div>`
          : g.justificacion ? `<p class="small"><b>Justificación:</b> ${esc(g.justificacion)}</p>` : ""}
        ${decide ? `<div class="decidir">
          <label>Motivo (obligatorio para pedir corrección, rechazar o no reconocer una línea)<input id="m-${g.id}"></label>
          <div class="fila"><button class="btn-p" data-a="decidir" data-gasto="${g.id}" data-d="aprobado">Aprobar</button>
          <button data-a="decidir" data-gasto="${g.id}" data-d="corregir">Pedir corrección</button>
          <button class="btn-mal" data-a="decidir" data-gasto="${g.id}" data-d="rechazado">Rechazar</button></div></div>` : ""}
      </div>
    </div>
  </article>`;
}

// ---------------------------------------------------------------- lectura con IA y formulario de revisión
const vacio = () => ({ comercio: "", fecha: "", rut_emisor: "", serie: "", numero: "", categoria: "otros", neto: "", iva: "", total: "", justificacion: "", items: [{ descripcion: "", importe: "" }] });

async function achicar(file) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
  } catch { return file; }
}

async function leerFoto(rev, file) {
  try {
    const blob = await achicar(file);
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${S.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from("tickets").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    rev.path = path;
    const { data, error } = await sb.functions.invoke("leer-ticket", { body: { path } });
    if (error) {
      let m = error.message;
      try { const j = await error.context.json(); m = j.error || m; } catch { /* sin detalle */ }
      throw new Error(m);
    }
    if (data?.error) throw new Error(data.error);
    rev.datos = { ...vacio(), ...data.datos, items: data.datos.items?.length ? data.datos.items : vacio().items };
    rev.lectura_id = data.lectura_id; rev.modelo = data.modelo;
  } catch (e) {
    rev.error = "No se pudo leer automáticamente (" + msg(e) + "). Completalo a mano.";
    rev.datos = rev.datos || vacio();
  }
  rev.estado = "form";
  pintarRev(rev);
}

function subirArchivos(files) {
  for (const file of files) {
    const rev = { key: crypto.randomUUID(), rendId: S.rendId, estado: "leyendo", preview: URL.createObjectURL(file) };
    S.revisiones.push(rev);
    pintarRev(rev);
    leerFoto(rev, file);
  }
}

function pintarRevisiones() { S.revisiones.filter((r) => r.rendId === S.rendId).forEach(pintarRev); }

function pintarRev(rev) {
  const cont = document.getElementById("revs");
  if (!cont || rev.rendId !== S.rendId) return;
  let box = cont.querySelector(`[data-rev="${rev.key}"]`);
  if (!box) { box = document.createElement("div"); box.dataset.rev = rev.key; cont.appendChild(box); }
  box.innerHTML = htmlRev(rev);
  actualizarSuma(box);
}

function filaItem(i = {}) {
  return `<div class="campos it-row" style="grid-template-columns:minmax(0,3fr) minmax(0,1.2fr) auto auto auto;align-items:end">
    <label>Línea<input data-f="descripcion" value="${esc(i.descripcion)}"></label>
    <label>Importe<input data-f="importe" inputmode="decimal" value="${esc(i.importe)}"></label>
    <label class="check"><input type="checkbox" data-f="es_alcohol" ${i.es_alcohol ? "checked" : ""}>alcohol</label>
    <label class="check"><input type="checkbox" data-f="personal" ${i.reembolsable === false ? "checked" : ""}>personal</label>
    <button type="button" class="btn-link" data-a="quitar-linea" aria-label="Quitar línea">✕</button>
  </div>`;
}

function htmlRev(rev) {
  const fotoHtml = rev.preview ? `<div class="foto ${rev.estado === "leyendo" ? "leyendo" : ""}"><img src="${esc(rev.preview)}" alt="Ticket subido"></div>` : `<div class="foto">carga manual</div>`;
  if (rev.estado === "leyendo") {
    return `<div class="card"><div class="gasto">${fotoHtml}<div class="lista"><h3>La IA está leyendo el ticket…</h3>
      <p class="small muted">Busca RUT, serie, número, fecha, comercio, montos, IVA y cada línea.</p></div></div></div>`;
  }
  const d = rev.datos;
  return `<form class="card" data-form="rev" data-key="${rev.key}">
    <div class="gasto">${fotoHtml}
      <div class="lista">
        <div class="fila entre"><h3>${rev.gastoId ? "Corregir ticket" : "Revisá lo que leyó la IA"}</h3>
          ${rev.modelo ? `<span class="xs mono muted">${esc(rev.modelo)}${d.confianza ? ` · confianza ${Math.round(d.confianza * 100)} %` : ""}</span>` : ""}</div>
        ${rev.error ? `<div class="alerta warn"><b>!</b><span>${esc(rev.error)}</span></div>` : ""}
        <div class="campos">
          <label>Comercio<input name="comercio" value="${esc(d.comercio)}" required></label>
          <label>Fecha<input name="fecha" type="date" value="${esc(d.fecha)}" required></label>
          <label>Categoría<select name="categoria">${CATEGORIAS.map((c) => `<option ${d.categoria === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          <label>RUT emisor<input name="rut_emisor" inputmode="numeric" value="${esc(d.rut_emisor)}"></label>
          <label>Serie<input name="serie" value="${esc(d.serie)}"></label>
          <label>Número<input name="numero" value="${esc(d.numero)}"></label>
          <label>Neto (sin IVA)<input name="neto" inputmode="decimal" value="${esc(d.neto)}"></label>
          <label>IVA<input name="iva" inputmode="decimal" value="${esc(d.iva)}"></label>
          <label>Total<input name="total" inputmode="decimal" value="${esc(d.total)}" required></label>
        </div>
        <div class="lista items">${(d.items || []).map(filaItem).join("")}</div>
        <div class="fila entre"><button type="button" class="btn-link" data-a="agregar-linea">+ Agregar línea</button>
          <span class="small suma"></span></div>
        <label>Justificación (si supera el tope)<textarea name="justificacion">${esc(d.justificacion)}</textarea></label>
        <div class="fila"><button class="btn-p">Guardar ticket</button><button type="button" data-a="descartar" data-key="${rev.key}">Descartar</button></div>
      </div>
    </div>
  </form>`;
}

function leerForm(form) {
  const v = (n) => form.querySelector(`[name="${n}"]`)?.value ?? "";
  return {
    comercio: v("comercio").trim(), fecha: v("fecha"), categoria: v("categoria"), rut_emisor: v("rut_emisor").replace(/\D/g, ""),
    serie: v("serie").trim(), numero: v("numero").trim(), neto: numero(v("neto")), iva: numero(v("iva")), total: numero(v("total")),
    justificacion: v("justificacion").trim(),
    items: [...form.querySelectorAll(".it-row")].map((row) => ({
      descripcion: row.querySelector('[data-f="descripcion"]').value.trim(),
      importe: numero(row.querySelector('[data-f="importe"]').value),
      es_alcohol: row.querySelector('[data-f="es_alcohol"]').checked,
      reembolsable: !row.querySelector('[data-f="personal"]').checked,
    })).filter((i) => i.descripcion || i.importe !== null),
  };
}

// Antes de redibujar, guardamos lo que la persona venía escribiendo en los formularios abiertos
function guardarBorradores() {
  document.querySelectorAll('form[data-form="rev"]').forEach((f) => {
    const rev = S.revisiones.find((r) => r.key === f.dataset.key);
    if (rev) rev.datos = { ...rev.datos, ...leerForm(f) };
  });
}

function actualizarSuma(box) {
  const form = box.querySelector('form[data-form="rev"]');
  if (!form) return;
  const d = leerForm(form);
  const suma = d.items.reduce((s, i) => s + (i.importe || 0), 0);
  const el = form.querySelector(".suma");
  const cierra = d.total !== null && Math.abs(suma - d.total) <= 1;
  el.innerHTML = `Las líneas suman <b class="num">${plata(suma)}</b> ${d.total === null ? "" : cierra ? "· coincide con el total ✓" : `· <span style="color:var(--bad)">no coincide con el total</span>`}`;
}

async function guardarRev(form) {
  const rev = S.revisiones.find((r) => r.key === form.dataset.key);
  const datos = leerForm(form);
  const boton = form.querySelector(".btn-p"); boton.disabled = true;
  try {
    if (rev.gastoId) await rpc("actualizar_gasto", { p_gasto: rev.gastoId, p_datos: datos });
    else await rpc("guardar_gasto", { p_rendicion: rev.rendId, p_datos: datos, p_lectura: rev.lectura_id ?? null, p_foto: rev.path ?? null });
    S.revisiones = S.revisiones.filter((r) => r !== rev);
    toast("Ticket guardado");
    pintar();
  } catch (e) { boton.disabled = false; toast(msg(e), true); }
}

// ---------------------------------------------------------------- acciones (clicks y formularios)
async function hacer(fn, ok) {
  try { await fn(); if (ok) toast(ok); await pintar(); } catch (e) { toast(msg(e), true); }
}

const acciones = {
  entrar: (b) => { const u = CFG.USUARIOS_DEMO[Number(b.dataset.i)]; entrar(u.email, u.clave); },
  salir: async () => { await sb.auth.signOut(); Object.assign(S, { perfil: null, rendId: null, revisiones: [], fotos: {} }); pantallaLogin(); },
  tab: (b) => { S.vista = b.dataset.v; S.rendId = null; pintar(); },
  abrir: (b) => { S.rendId = Number(b.dataset.id); pintar(); window.scrollTo(0, 0); },
  volver: () => { S.rendId = null; pintar(); },
  manual: () => { const rev = { key: crypto.randomUUID(), rendId: S.rendId, estado: "form", datos: vacio() }; S.revisiones.push(rev); pintarRev(rev); },
  "agregar-linea": (b) => { b.closest("form").querySelector(".items").insertAdjacentHTML("beforeend", filaItem()); },
  "quitar-linea": (b) => { const f = b.closest("form"); b.closest(".it-row").remove(); actualizarSuma(f.parentElement); },
  descartar: (b) => { S.revisiones = S.revisiones.filter((r) => r.key !== b.dataset.key); b.closest("[data-rev]").remove(); },
  editar: (b) => {
    const g = S.detalle.gastos.find((x) => x.id === Number(b.dataset.gasto));
    const rev = { key: crypto.randomUUID(), rendId: S.rendId, estado: "form", gastoId: g.id, preview: S.fotos[g.foto_path] || null,
      datos: { ...g, items: g.gasto_items.map((i) => ({ descripcion: i.descripcion, importe: i.importe, es_alcohol: i.es_alcohol, reembolsable: i.reembolsable })) } };
    S.revisiones.push(rev); pintarRev(rev);
    document.querySelector(`[data-rev="${rev.key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  borrar: (b) => { if (confirm("¿Borrar este ticket?")) hacer(() => rpc("borrar_gasto", { p_gasto: Number(b.dataset.gasto) }), "Ticket borrado"); },
  just: (b) => {
    const id = Number(b.dataset.gasto);
    hacer(() => rpc("set_justificacion", { p_gasto: id, p_texto: document.querySelector(`[data-just="${id}"]`).value }), "Justificación guardada");
  },
  personal: (b) => hacer(() => rpc("set_item_personal", { p_item: Number(b.dataset.item), p_personal: b.checked })),
  enviar: () => hacer(() => rpc("enviar_rendicion", { p_rend: S.rendId }), "Enviada a tu jefe"),
  decidir: (b) => {
    const id = Number(b.dataset.gasto);
    const motivo = document.getElementById("m-" + id).value;
    const nr = [...document.querySelectorAll(".nr-" + id + ":checked")].map((c) => Number(c.value));
    hacer(() => rpc("decidir_gasto", { p_gasto: id, p_decision: b.dataset.d, p_motivo: motivo, p_no_reconocidos: nr }),
      { aprobado: nr.length ? "Aprobado sin las líneas no reconocidas" : "Ticket aprobado", corregir: "Se pidió corrección", rechazado: "Ticket rechazado" }[b.dataset.d]);
  },
  fin: (b) => hacer(() => rpc("decidir_finanzas", { p_rend: S.rendId, p_aprobar: b.dataset.ok === "1", p_motivo: document.getElementById("motivo-fin").value }),
    b.dataset.ok === "1" ? "Aprobada por Finanzas" : "Rechazada por Finanzas"),
  pagar: () => hacer(() => rpc("marcar_reembolsada", { p_rend: S.rendId }), "Marcada como reembolsada"),
  csv: () => descargarCsv(),
  reiniciar: () => { if (confirm("Se borran todas las rendiciones y se cargan las de ejemplo. ¿Seguimos?")) hacer(() => rpc("reiniciar_demo"), "Datos demo reiniciados"); },
};

app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-a]");
  if (!b || b.type === "checkbox") return;
  e.preventDefault();
  acciones[b.dataset.a]?.(b, e);
});

app.addEventListener("change", (e) => {
  if (e.target.id === "archivos" && e.target.files.length) { subirArchivos([...e.target.files]); e.target.value = ""; }
  const b = e.target.closest('input[type="checkbox"][data-a]');
  if (b) acciones[b.dataset.a]?.(b, e);
  const box = e.target.closest("[data-rev]"); if (box) actualizarSuma(box);
});

app.addEventListener("input", (e) => { const box = e.target.closest("[data-rev]"); if (box) actualizarSuma(box); });

app.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target, tipo = f.dataset.form;
  if (tipo === "login") entrar(f.email.value, f.clave.value);
  if (tipo === "nueva") hacer(async () => { S.rendId = await rpc("crear_rendicion", { p_titulo: f.titulo.value }); }, "Rendición creada");
  if (tipo === "comentar") hacer(() => rpc("comentar", { p_rend: S.rendId, p_texto: f.texto.value, p_gasto: null }), "Comentario agregado");
  if (tipo === "rev") guardarRev(f);
});

arrancar();
