// =====================================================================
// RENDÍ · la aplicación (después de iniciar sesión). No hace falta tocar este archivo.
// Todas las reglas las controla la base; acá solo se muestran y se piden.
// =====================================================================
import { sb, CFG, configurado, esc, icono, alternarTema } from "./sb.js";

// El link de "olvidé mi contraseña" llega con #...type=recovery: lo leemos antes de que Supabase limpie la dirección
const llegoPorRecuperacion = location.hash.includes("type=recovery");
const app = document.getElementById("app");
const S = { perfil: null, uid: null, email: "", fotos: {}, avatares: {}, revisiones: [], rends: [],
  recuperar: llegoPorRecuperacion, abiertos: new Set(["rendiciones", "equipo"]), detalle: null, totales: [] };

// ---------------------------------------------------------------- utilidades
const $ = (s, r = document) => r.querySelector(s);
const plata = (n) => n === null || n === undefined || n === "" ? "—"
  : "$U " + Number(n).toLocaleString("es-UY", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const fecha = (f) => f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" }) : "—";
const numero = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); if (!s) return null; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const msg = (e) => (e?.message || String(e)).replace(/^DUPLICADO: /, "Duplicado: ");
const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const reembolsable = (items) => (items || []).filter((i) => i.reembolsable && !i.es_alcohol && !i.no_reconocido_por).reduce((s, i) => s + Number(i.importe), 0);
const mesActual = new Date().toISOString().slice(0, 7);
const CATEGORIAS = { comidas: "Comidas", traslados: "Traslados", alojamiento: "Alojamiento", otros: "Otros" };
const CAMPOS = { rut_emisor: "RUT", serie: "Serie", numero: "Número", fecha: "Fecha", comercio: "Comercio", neto: "Neto", iva: "IVA", total: "Total",
  nro_operacion: "N.º de operación", tipo_comprobante: "Tipo de comprobante" };
const TIPOS = { cfe: "e-Ticket o e-Factura", pago: "Comprobante de pago (POS)" };
const MEDIOS = ["Mercado Pago", "OCA", "Handy", "Getnet", "VISA", "Mastercard", "BROU", "Itaú", "Santander", "Scotiabank"];
const REGLAS = { datos: "Datos incompletos", fecha: "Fecha", suma_lineas: "Suma de líneas", iva: "IVA", duplicado: "Posible duplicado",
  alcohol: "Alcohol", tope_categoria: "Tope por categoría", plazo: "Fuera de plazo", tope_mensual: "Tope mensual",
  ia_confianza: "Lectura dudosa", corregido: "Corregido a mano", sin_cfe: "Sin e-Ticket" };

const EST_R = {
  borrador: ["Borrador", "e-info"], pendiente_jefe: ["Pendiente jefe", "e-pend"], devuelta: ["Devuelta para corregir", "e-mal"],
  revision_finanzas: ["Revisión Finanzas", "e-pend"], aprobada: ["Aprobada", "e-ok"], aprobada_parcial: ["Aprobada parcial", "e-ok"],
  rechazada: ["Rechazada", "e-mal"], reembolsada: ["Reembolsada", ""],
};
const EST_G = { pendiente: ["Pendiente", "e-pend"], a_corregir: ["A corregir", "e-mal"], aprobado: ["Aprobado", "e-ok"],
  aprobado_parcial: ["Aprobado parcial", "e-ok"], rechazado: ["Rechazado", "e-mal"] };
const pill = (mapa, e) => { const [t, c] = mapa[e] || [e, ""]; return `<span class="pill ${c}">${esc(t)}</span>`; };

// Grupos de estados para "Mis rendiciones" y "Rendiciones del equipo"
const GRUPOS = { todas: null, borrador: ["borrador"], pendiente: ["pendiente_jefe", "revision_finanzas"], devuelta: ["devuelta"],
  aprobada: ["aprobada", "aprobada_parcial"], reembolsada: ["reembolsada"], rechazada: ["rechazada"] };
const GRUPO_TXT = { todas: "Todas", borrador: "Borradores", pendiente: "Pendientes", devuelta: "Devueltas",
  aprobada: "Aprobadas", reembolsada: "Reembolsadas", rechazada: "Rechazadas" };
const enGrupo = (r, g) => !GRUPOS[g] || GRUPOS[g].includes(r.estado);

let toastT;
function toast(texto, mal = false) {
  const t = document.getElementById("toast");
  t.textContent = texto; t.className = "toast" + (mal ? " mal" : ""); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), mal ? 6500 : 3500);
}
async function rpc(nombre, args) { const { data, error } = await sb.rpc(nombre, args); if (error) throw error; return data; }
async function q(consulta) { const { data, error } = await consulta; if (error) throw error; return data; }

// Diálogo de confirmación propio (en vez del confirm() del navegador)
function confirmar(texto, { ok = "Confirmar", peligro = false } = {}) {
  return new Promise((res) => {
    const d = $("#confirmar");
    d.querySelector("p").textContent = texto;
    const b = d.querySelector("[data-si]");
    b.textContent = ok; b.className = peligro ? "btn-mal" : "btn-p";
    d.onclose = () => res(d.returnValue === "si");
    d.returnValue = ""; d.showModal();
  });
}

// ---------------------------------------------------------------- fotos (facturas y avatares)
async function firmar(bucket, paths, cache) {
  const faltan = [...new Set(paths.filter((p) => p && !cache[p]))];
  if (!faltan.length) return;
  const { data } = await sb.storage.from(bucket).createSignedUrls(faltan, 3600);
  (data || []).forEach((d) => { if (d.signedUrl) cache[d.path] = d.signedUrl; });
}
async function hidratarFotos(root = document) {
  const tickets = [...root.querySelectorAll("img[data-foto]")];
  const avatares = [...root.querySelectorAll("img[data-avatar]")];
  await Promise.all([
    firmar("tickets", tickets.map((i) => i.dataset.foto), S.fotos),
    firmar("avatars", avatares.map((i) => i.dataset.avatar), S.avatares),
  ]);
  tickets.forEach((i) => { const u = S.fotos[i.dataset.foto]; if (u) i.src = u; else i.closest(".mini, .foto")?.classList.add("sin"); });
  avatares.forEach((i) => { const u = S.avatares[i.dataset.avatar]; if (u) { i.src = u; i.hidden = false; i.nextElementSibling?.remove(); } });
}
const avatar = (nombre, path, cls = "") => `<span class="avatar ${cls}">${path ? `<img data-avatar="${esc(path)}" alt="" hidden>` : ""}<span>${esc(iniciales(nombre))}</span></span>`;
const fotoTicket = (path, alt) => path
  ? `<button type="button" class="foto" data-ver="${esc(path)}" aria-label="Ver la factura de ${esc(alt)} en grande"><img data-foto="${esc(path)}" alt="Factura de ${esc(alt)}"><span class="lupa">${icono("zoomin")} Ver factura</span></button>`
  : `<div class="foto">Sin foto</div>`;

// Visor a pantalla completa: zoom, rotar, abrir original
const visor = { zoom: 1, giro: 0 };
async function abrirVisor(path, titulo) {
  await firmar("tickets", [path], S.fotos);
  const d = $("#visor"), img = d.querySelector("img");
  Object.assign(visor, { zoom: 1, giro: 0 });
  img.src = S.fotos[path] || ""; img.alt = "Factura " + (titulo || "");
  d.querySelector(".titulo").textContent = titulo || "Factura";
  d.querySelector("[data-original]").href = S.fotos[path] || "#";
  aplicarVisor(); d.showModal();
}
function aplicarVisor() { $("#visor img").style.transform = `scale(${visor.zoom}) rotate(${visor.giro}deg)`; }

// ---------------------------------------------------------------- arranque
async function arrancar() {
  if (!configurado) {
    app.innerHTML = `<div class="l-wrap" style="padding:60px 20px"><div class="card"><h1>Falta un paso</h1>
      <p>Abrí <b class="mono">config.js</b> y pegá la Project URL y la clave pública de Supabase.</p></div></div>`;
    return;
  }
  sb.auth.onAuthStateChange((evento) => { if (evento === "PASSWORD_RECOVERY") { S.recuperar = true; if (S.perfil) render(); } });
  const { data } = await sb.auth.getSession();
  if (!data.session) { location.replace("index.html#entrar"); return; }
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { location.replace("index.html#entrar"); return; }
  S.uid = user.id; S.email = user.email;
  await cargarPerfil();
  if (!S.perfil) {
    app.innerHTML = `<div class="l-wrap" style="padding:60px 20px"><div class="card"><h1>Tu usuario no tiene perfil</h1>
      <p>Corré <b class="mono">04_demo_y_calidad.sql</b> en Supabase para crear los perfiles.</p>
      <div><button data-a="salir">Cerrar sesión</button></div></div></div>`;
    return;
  }
  montarShell();
  if (!location.hash.startsWith("#/")) location.replace("#/inicio");
  render();
}
async function cargarPerfil() { S.perfil = await q(sb.from("perfiles").select("*").eq("id", S.uid).maybeSingle()); }

function ruta() { const p = location.hash.replace(/^#\/?/, "").split("/"); return [p[0] || "inicio", p[1] || null]; }

// ---------------------------------------------------------------- marco: menú lateral, barra de arriba, navegación de celular
function montarShell() {
  app.innerHTML = `
  <a class="saltar" href="#contenido">Saltar al contenido</a>
  <div class="shell" id="shell">
    <aside class="side" id="side" aria-label="Menú principal">
      <a class="marca" href="#/inicio">R<span class="largo">endí</span><span>.</span></a>
      <nav id="nav"></nav>
      <div class="pie-side"><button class="nav-item solo-compu" data-a="plegar" aria-label="Plegar o desplegar el menú">${icono("menu")}<span class="txt">Plegar menú</span></button></div>
    </aside>
    <div class="velo" data-a="cerrar-menu"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn-icono solo-movil" data-a="abrir-menu" aria-label="Abrir el menú">${icono("menu")}</button>
        <h1 id="titulo"></h1>
        <button class="btn-icono" data-a="tema" aria-label="Cambiar entre modo claro y oscuro" id="btn-tema"></button>
        <div class="menu-cuenta">
          <button class="cuenta-btn" data-a="cuenta" aria-haspopup="true" aria-expanded="false" id="btn-cuenta"></button>
          <div class="desplegable" id="desplegable" hidden></div>
        </div>
      </header>
      <main class="contenido" id="contenido" tabindex="-1"></main>
    </div>
    <nav class="abajo" id="abajo" aria-label="Accesos rápidos"></nav>
  </div>
  <button class="arriba" data-a="arriba" aria-label="Volver arriba">${icono("up")}</button>
  <dialog class="visor" id="visor" aria-label="Factura">
    <div class="barra"><span class="titulo"></span>
      <button data-v="menos" aria-label="Alejar">${icono("zoomout")}</button>
      <button data-v="mas" aria-label="Acercar">${icono("zoomin")}</button>
      <button data-v="girar" aria-label="Girar">${icono("rotate")}</button>
      <a data-original target="_blank" rel="noopener" aria-label="Abrir la imagen original">${icono("download")}</a>
      <button data-v="cerrar" aria-label="Cerrar">${icono("close")}</button></div>
    <div class="lienzo"><img alt=""></div>
  </dialog>
  <dialog class="dialogo" id="confirmar"><form method="dialog" class="lista"><p></p>
    <div class="fila" style="justify-content:flex-end"><button value="no">Cancelar</button><button value="si" data-si>Confirmar</button></div></form></dialog>`;
  pintarCuenta(); pintarTema();
  const v = $("#visor");
  v.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) { if (e.target.classList.contains("lienzo")) v.close(); return; }
    if (b.dataset.v === "mas") visor.zoom = Math.min(4, visor.zoom + 0.5);
    if (b.dataset.v === "menos") visor.zoom = Math.max(0.5, visor.zoom - 0.5);
    if (b.dataset.v === "girar") visor.giro = (visor.giro + 90) % 360;
    if (b.dataset.v === "cerrar") return v.close();
    aplicarVisor();
  });
  addEventListener("scroll", () => $(".arriba")?.classList.toggle("ver", scrollY > Math.min(400, innerHeight * 0.5)), { passive: true });
}

function pintarTema() {
  const oscuro = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  $("#btn-tema").innerHTML = icono(oscuro ? "sun" : "moon");
}
function pintarCuenta() {
  const p = S.perfil, rol = { empleado: "Empleada", jefe: "Jefe", finanzas: "Finanzas" }[p.rol];
  $("#btn-cuenta").innerHTML = `${avatar(p.nombre, p.foto_path)}<span class="solo-compu small"><b>${esc(p.nombre.split(" ")[0])}</b></span>${icono("down")}`;
  $("#desplegable").innerHTML = `
    <div class="quien"><b>${esc(p.nombre)}</b><div class="xs muted">${esc(rol)} · ${esc(S.email)}</div></div>
    <a href="#/perfil" data-a="cerrar-cuenta">${icono("user")} Mi perfil</a>
    <a href="#/perfil" data-a="cerrar-cuenta">${icono("key")} Cambiar contraseña</a>
    <button data-a="salir">${icono("logout")} Cerrar sesión</button>`;
  hidratarFotos($("#btn-cuenta"));
}

function menu() {
  const r = S.perfil.rol, mias = S.rends.filter((x) => x.empleado_id === S.uid), otras = S.rends.filter((x) => x.empleado_id !== S.uid);
  const sub = (base, lista) => Object.keys(GRUPOS).map((k) => ({ ruta: `${base}/${k}`, txt: GRUPO_TXT[k], n: lista.filter((x) => enGrupo(x, k)).length }));
  if (r === "jefe") return [
    { ruta: "inicio", txt: "Inicio", ico: "home" },
    { grupo: "Aprobar" },
    { ruta: "aprobar", txt: "Por aprobar", ico: "inbox", n: otras.filter((x) => x.estado === "pendiente_jefe").length, alerta: true },
    { ruta: "equipo", txt: "Mi equipo", ico: "users", sub: sub("equipo", otras) },
    { grupo: "Calidad" },
    { ruta: "calidad", txt: "Control de calidad", ico: "shield" },
  ];
  if (r === "finanzas") return [
    { ruta: "inicio", txt: "Inicio", ico: "home" },
    { grupo: "Finanzas" },
    { ruta: "revision", txt: "Revisión Finanzas", ico: "inbox", n: S.rends.filter((x) => x.estado === "revision_finanzas").length, alerta: true },
    { ruta: "reembolsar", txt: "A reembolsar", ico: "wallet", n: S.rends.filter((x) => ["aprobada", "aprobada_parcial"].includes(x.estado)).length, alerta: true },
    { ruta: "historial", txt: "Historial", ico: "history" },
    { ruta: "totales", txt: "Totales", ico: "chart" },
    { grupo: "Calidad" },
    { ruta: "calidad", txt: "Control de calidad", ico: "shield" },
  ];
  return [
    { ruta: "inicio", txt: "Inicio", ico: "home" },
    { ruta: "nueva", txt: "Nueva rendición", ico: "plus" },
    { ruta: "rendiciones", txt: "Mis rendiciones", ico: "receipt", sub: sub("rendiciones", mias) },
    { grupo: "Calidad" },
    { ruta: "calidad", txt: "Control de calidad", ico: "shield" },
  ];
}

function pintarNav(base, arg) {
  const actual = arg ? `${base}/${arg}` : base;
  const items = menu();
  $("#nav").innerHTML = items.map((it) => {
    if (it.grupo) return `<div class="grupo">${esc(it.grupo)}</div>`;
    const cuenta = it.n ? `<span class="cuenta ${it.alerta ? "urgente" : ""}">${it.n}</span>` : "";
    if (it.sub) {
      const abierto = S.abiertos.has(it.ruta) || base === it.ruta;
      return `<button class="nav-item" data-a="toggle" data-k="${it.ruta}" aria-expanded="${abierto}" ${base === it.ruta ? 'aria-current="page"' : ""}>${icono(it.ico)}<span class="txt">${esc(it.txt)}</span>${icono("chevron", "ico flecha")}</button>
        <div class="sub" ${abierto ? "" : "hidden"}>${it.sub.map((s) => `<a class="nav-item" href="#/${s.ruta}" ${actual === s.ruta ? 'aria-current="page"' : ""}><span class="txt">${esc(s.txt)}</span>${s.n ? `<span class="cuenta">${s.n}</span>` : ""}</a>`).join("")}</div>`;
    }
    return `<a class="nav-item" href="#/${it.ruta}" ${base === it.ruta ? 'aria-current="page"' : ""} title="${esc(it.txt)}">${icono(it.ico)}<span class="txt">${esc(it.txt)}</span>${cuenta}</a>`;
  }).join("");
  // Barra de abajo en el celular: los 3 primeros accesos + el menú completo
  const rapidos = items.filter((i) => i.ruta).slice(0, 3);
  $("#abajo").innerHTML = rapidos.map((i) => `<a href="#/${i.sub ? i.ruta + "/todas" : i.ruta}" ${base === i.ruta ? 'aria-current="page"' : ""}>${icono(i.ico)}<span>${esc(i.txt.replace("Mi equipo", "Equipo").replace("Mis rendiciones", "Rendiciones").replace("Nueva rendición", "Nueva").replace("Revisión Finanzas", "Revisión"))}</span></a>`).join("")
    + `<button data-a="abrir-menu">${icono("menu")}<span>Más</span></button>`;
}

const TITULOS = { inicio: "Inicio", nueva: "Nueva rendición", rendiciones: "Mis rendiciones", aprobar: "Por aprobar",
  equipo: "Rendiciones del equipo", revision: "Revisión Finanzas", reembolsar: "A reembolsar", historial: "Historial",
  totales: "Totales", calidad: "Control de calidad", perfil: "Mi perfil", r: "Rendición" };

async function cargarRends() {
  S.rends = await q(sb.from("rendiciones")
    .select("id,titulo,estado,creada,enviada,total_aprobado,empleado_id,perfiles(nombre,foto_path),gastos(id,total,estado,foto_path)")
    .order("creada", { ascending: false }));
}

let renderando = 0;
async function render() {
  const yo = ++renderando;
  guardarBorradores();
  const [base, arg] = ruta();
  const c = $("#contenido");
  c.innerHTML = `<div class="esqueleto"><span></span><span></span><span></span></div>`;
  $("#shell").classList.remove("abierto");
  $("#desplegable").hidden = true;
  try {
    await cargarRends();
    if (yo !== renderando) return;
    pintarNav(base, arg);
    const titulo = S.recuperar ? "Nueva contraseña" : (TITULOS[base] || "Rendí");
    const migas = base === "r" ? `<span class="migas">Rendiciones ›</span>` : (arg && GRUPO_TXT[arg] ? `<span class="migas">${esc(TITULOS[base])} ›</span>` : "");
    $("#titulo").innerHTML = migas + esc(base !== "r" && arg && GRUPO_TXT[arg] ? GRUPO_TXT[arg] : titulo);
    document.title = `${$("#titulo").textContent.replace("›", "·")} · Rendí`;
    const vista = S.recuperar ? vistaRecuperar : (VISTAS[base] || vistaInicio);
    const html = await vista(arg);
    if (yo !== renderando) return;
    c.innerHTML = html;
    if (base === "r") pintarRevisiones();
    marcarTablas(c);
    hidratarFotos(c);
  } catch (e) {
    c.innerHTML = `<div class="card"><h2>Algo falló</h2><p class="muted">${esc(msg(e))}</p><div><button data-a="recargar">Reintentar</button></div></div>`;
  }
}
addEventListener("hashchange", () => { if (S.perfil) { render(); scrollTo(0, 0); } });

// Sombra a la derecha en las tablas que se pueden deslizar (celular)
function marcarTablas(root) {
  root.querySelectorAll(".tabla-wrap").forEach((w) => {
    const ver = () => w.classList.toggle("desborda", w.scrollWidth > w.clientWidth + 4 && w.scrollLeft + w.clientWidth < w.scrollWidth - 4);
    ver(); w.addEventListener("scroll", ver, { passive: true });
  });
}

// ---------------------------------------------------------------- listas
function filaRend(r, mostrarQuien = true) {
  const n = r.gastos?.length || 0, tot = (r.gastos || []).reduce((s, g) => s + Number(g.total || 0), 0);
  const fotos = (r.gastos || []).filter((g) => g.foto_path);
  const texto = `${r.titulo} ${r.perfiles?.nombre || ""} ${EST_R[r.estado]?.[0] || ""}`.toLowerCase();
  return `<a class="fila-r" href="#/r/${r.id}" data-texto="${esc(texto)}">
    <span class="mini">${fotos.length ? `<img data-foto="${esc(fotos[0].foto_path)}" alt="">${fotos.length > 1 ? `<span class="mas">+${fotos.length - 1}</span>` : ""}` : icono("receipt")}</span>
    <span><b>${esc(r.titulo)}</b><span class="meta">${mostrarQuien && r.empleado_id !== S.uid ? esc(r.perfiles?.nombre) + " · " : ""}${n} ticket${n === 1 ? "" : "s"} · ${plata(tot)}${r.total_aprobado != null ? " · a reembolsar " + plata(r.total_aprobado) : ""} · ${fecha(r.enviada || r.creada)}</span></span>
    <span class="lado">${pill(EST_R, r.estado)}${icono("chevron")}</span>
  </a>`;
}
function listaRends(rs, vacio, { mostrarQuien = true, buscar = true, accion = "" } = {}) {
  if (!rs.length) return `<div class="vacio">${icono("receipt")}<p>${esc(vacio)}</p>${accion}</div>`;
  return `${buscar && rs.length > 3 ? `<div class="buscar">${icono("search")}<input type="search" data-filtro placeholder="Buscar por nombre, persona o estado" aria-label="Buscar rendiciones"></div>` : ""}
    <div class="filas">${rs.map((r) => filaRend(r, mostrarQuien)).join("")}</div>`;
}
function chipsGrupo(base, lista, actual) {
  return `<div class="chips" role="tablist" aria-label="Filtrar por estado">${Object.keys(GRUPOS).map((k) => {
    const n = lista.filter((x) => enGrupo(x, k)).length;
    return `<a class="chip btn" role="tab" href="#/${base}/${k}" aria-pressed="${k === actual}" aria-selected="${k === actual}">${esc(GRUPO_TXT[k])} <span class="muted">${n}</span></a>`;
  }).join("")}</div>`;
}

async function vistaRendiciones(g = "todas") {
  const mias = S.rends.filter((r) => r.empleado_id === S.uid);
  const grupo = GRUPOS[g] !== undefined ? g : "todas";
  return `<div class="lista">${chipsGrupo("rendiciones", mias, grupo)}
    ${listaRends(mias.filter((r) => enGrupo(r, grupo)), grupo === "todas" ? "Todavía no tenés rendiciones." : `No tenés rendiciones ${GRUPO_TXT[grupo].toLowerCase()}.`,
      { mostrarQuien: false, accion: `<a class="btn-p" href="#/nueva">${icono("plus")} Nueva rendición</a>` })}</div>`;
}
async function vistaEquipo(g = "todas") {
  const otras = S.rends.filter((r) => r.empleado_id !== S.uid);
  const grupo = GRUPOS[g] !== undefined ? g : "todas";
  return `<div class="lista">${chipsGrupo("equipo", otras, grupo)}${listaRends(otras.filter((r) => enGrupo(r, grupo)), "No hay rendiciones en este estado.")}</div>`;
}
async function vistaAprobar() {
  const rs = S.rends.filter((r) => r.estado === "pendiente_jefe" && r.empleado_id !== S.uid);
  return `<div class="lista"><p class="muted">Rendiciones de tu equipo que esperan tu decisión. Revisá cada ticket contra su foto antes de aprobar.</p>
    ${listaRends(rs, "No tenés nada pendiente. ¡Al día!")}</div>`;
}
async function vistaRevision() {
  return `<div class="lista"><p class="muted">El jefe ya aprobó y lo aprobado supera ${plata(3000)}: falta tu visto bueno.</p>
    ${listaRends(S.rends.filter((r) => r.estado === "revision_finanzas"), "No hay rendiciones esperando a Finanzas.")}</div>`;
}
async function vistaReembolsar() {
  return `<div class="lista"><p class="muted">Aprobadas y listas para pagar. Cuando hagas la transferencia, marcalas como reembolsadas.</p>
    ${listaRends(S.rends.filter((r) => ["aprobada", "aprobada_parcial"].includes(r.estado)), "No hay reembolsos pendientes.")}</div>`;
}
async function vistaHistorial() {
  return `<div class="lista">${listaRends(S.rends.filter((r) => ["reembolsada", "rechazada"].includes(r.estado)), "Todavía no hay reembolsos.")}</div>`;
}

// ---------------------------------------------------------------- inicio por rol
async function vistaInicio() {
  const p = S.perfil, nombre = esc(p.nombre.split(" ")[0]);
  const kpi = (v, k, href, atencion = false) => `<a class="kpi ${atencion ? "atencion" : ""}" href="${href}"><span class="v">${v}</span><span class="k">${esc(k)}</span></a>`;
  if (p.rol === "jefe") {
    const otras = S.rends.filter((r) => r.empleado_id !== S.uid), pend = otras.filter((r) => r.estado === "pendiente_jefe");
    const monto = pend.reduce((s, r) => s + (r.gastos || []).filter((g) => g.estado === "pendiente").reduce((a, g) => a + Number(g.total || 0), 0), 0);
    return `<div class="lista"><div><h2>Hola, ${nombre}</h2><p class="muted">${pend.length ? `Tenés ${pend.length} rendición${pend.length === 1 ? "" : "es"} esperando tu aprobación.` : "No tenés nada pendiente de aprobar."}</p></div>
      <div class="kpis">${kpi(pend.length, "Por aprobar", "#/aprobar", pend.length > 0)}${kpi(plata(monto), "Monto por aprobar", "#/aprobar")}
        ${kpi(otras.filter((r) => r.estado === "revision_finanzas").length, "En Finanzas", "#/equipo/pendiente")}
        ${kpi(otras.filter((r) => ["aprobada", "aprobada_parcial", "reembolsada"].includes(r.estado)).length, "Aprobadas", "#/equipo/aprobada")}</div>
      <div class="fila entre"><h2>Esperan tu aprobación</h2><a class="btn-link" href="#/aprobar">Ver todas ›</a></div>
      ${listaRends(pend.slice(0, 5), "No hay nada esperando.", { buscar: false })}</div>`;
  }
  if (p.rol === "finanzas") {
    const rev = S.rends.filter((r) => r.estado === "revision_finanzas"), pagar = S.rends.filter((r) => ["aprobada", "aprobada_parcial"].includes(r.estado));
    const pagadoMes = S.rends.filter((r) => r.estado === "reembolsada" && String(r.enviada || r.creada).slice(0, 7) === mesActual).reduce((s, r) => s + Number(r.total_aprobado || 0), 0);
    return `<div class="lista"><div><h2>Hola, ${nombre}</h2><p class="muted">${rev.length} en revisión · ${pagar.length} listas para reembolsar.</p></div>
      <div class="kpis">${kpi(rev.length, "En revisión", "#/revision", rev.length > 0)}${kpi(pagar.length, "A reembolsar", "#/reembolsar", pagar.length > 0)}
        ${kpi(plata(pagar.reduce((s, r) => s + Number(r.total_aprobado || 0), 0)), "Monto a reembolsar", "#/reembolsar")}${kpi(plata(pagadoMes), "Reembolsado este mes", "#/historial")}</div>
      <div class="grid2"><div class="lista"><div class="fila entre"><h2>En revisión</h2><a class="btn-link" href="#/revision">Ver todas ›</a></div>${listaRends(rev.slice(0, 4), "Nada en revisión.", { buscar: false })}</div>
        <div class="lista"><div class="fila entre"><h2>A reembolsar</h2><a class="btn-link" href="#/reembolsar">Ver todas ›</a></div>${listaRends(pagar.slice(0, 4), "Nada para pagar.", { buscar: false })}</div></div></div>`;
  }
  const mias = S.rends.filter((r) => r.empleado_id === S.uid);
  const cant = (g) => mias.filter((r) => enGrupo(r, g)).length;
  const reemb = mias.filter((r) => r.estado === "reembolsada").reduce((s, r) => s + Number(r.total_aprobado || 0), 0);
  const devueltas = cant("devuelta"), borr = cant("borrador");
  const aviso = devueltas ? `Tu jefe te devolvió ${devueltas} rendición${devueltas === 1 ? "" : "es"} para corregir.` : borr ? `Tenés ${borr} borrador${borr === 1 ? "" : "es"} sin enviar.` : "Todo al día.";
  return `<div class="lista"><div class="fila entre"><div><h2>Hola, ${nombre}</h2><p class="muted">${aviso}</p></div><a class="btn-p" href="#/nueva">${icono("plus")} Nueva rendición</a></div>
    <div class="kpis">${kpi(borr, "Borradores", "#/rendiciones/borrador")}${kpi(cant("pendiente"), "Pendientes", "#/rendiciones/pendiente")}
      ${kpi(devueltas, "Devueltas", "#/rendiciones/devuelta", devueltas > 0)}${kpi(plata(reemb), "Te reembolsaron", "#/rendiciones/reembolsada")}</div>
    <div class="fila entre"><h2>Últimas rendiciones</h2><a class="btn-link" href="#/rendiciones/todas">Ver todas ›</a></div>
    ${listaRends(mias.slice(0, 5), "Todavía no tenés rendiciones.", { mostrarQuien: false, buscar: false, accion: `<a class="btn-p" href="#/nueva">${icono("plus")} Crear la primera</a>` })}</div>`;
}

async function vistaNueva() {
  if (S.perfil.rol !== "empleado" && !S.perfil.jefe_id) return `<div class="vacio"><p>Tu usuario no rinde gastos.</p></div>`;
  return `<form class="card" data-form="nueva" style="max-width:640px">
    <h2>¿Qué vas a rendir?</h2>
    <p class="muted small">Agrupá en una rendición los tickets de un viaje o de una actividad. En el paso siguiente les sacás foto.</p>
    <label>Nombre de la rendición<input name="titulo" placeholder="Ej.: Viaje a Salto · visita a cliente" required maxlength="120"></label>
    <div class="fila"><button class="btn-p btn-grande">Crear y agregar tickets</button></div>
  </form>`;
}

// ---------------------------------------------------------------- perfil y contraseña
async function vistaPerfil() {
  const p = S.perfil, rol = { empleado: "Empleada", jefe: "Jefe", finanzas: "Finanzas" }[p.rol];
  return `<div class="grid2" style="align-items:start">
    <form class="card" data-form="perfil">
      <h2>Mis datos</h2>
      <div class="fila">${avatar(p.nombre, p.foto_path, "xl")}
        <label class="btn" style="display:inline-flex;cursor:pointer">${icono("camera")} Cambiar foto<input type="file" id="foto-perfil" accept="image/*" hidden></label></div>
      <label>Nombre<input name="nombre" value="${esc(p.nombre)}" required></label>
      <label>Email<input value="${esc(S.email)}" disabled></label>
      <label>Rol<input value="${esc(rol)} · ${esc(p.area || "")}" disabled></label>
      <div><button class="btn-p">Guardar cambios</button></div>
    </form>
    <div class="lista">
      <form class="card" data-form="clave">
        <h2>Cambiar contraseña</h2>
        <label>Contraseña nueva<input name="c1" type="password" autocomplete="new-password" minlength="6" required></label>
        <label>Repetila<input name="c2" type="password" autocomplete="new-password" minlength="6" required></label>
        <div><button class="btn-p">Cambiar contraseña</button></div>
      </form>
      <div class="card"><h2>Sesión</h2><p class="small muted">Cerrás la sesión en este dispositivo.</p><div><button class="btn-mal" data-a="salir">${icono("logout")} Cerrar sesión</button></div></div>
    </div></div>`;
}
async function vistaRecuperar() {
  return `<form class="card" data-form="recuperar" style="max-width:520px">
    <h2>Elegí tu contraseña nueva</h2>
    <p class="small muted">Llegaste desde el link del email. Escribí la contraseña nueva dos veces.</p>
    <label>Contraseña nueva<input name="c1" type="password" autocomplete="new-password" minlength="6" required></label>
    <label>Repetila<input name="c2" type="password" autocomplete="new-password" minlength="6" required></label>
    <div><button class="btn-p">Guardar y entrar</button></div></form>`;
}
async function subirAvatar(file) {
  const blob = await achicar(file, 512);
  const path = `${S.uid}/avatar-${Date.now()}.jpg`;
  const up = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  await rpc("actualizar_perfil", { p_nombre: null, p_foto: path });
  await cargarPerfil(); pintarCuenta();
}

// ---------------------------------------------------------------- totales (Finanzas)
async function vistaTotales() {
  const gs = await q(sb.from("gastos")
    .select("id,fecha,categoria,estado,comercio,tipo_comprobante,perfiles(nombre),gasto_items(importe,reembolsable,es_alcohol,no_reconocido_por),rendiciones(titulo,estado)"));
  const filas = gs.filter((g) => ["aprobado", "aprobado_parcial"].includes(g.estado) && ["aprobada", "aprobada_parcial", "reembolsada"].includes(g.rendiciones?.estado))
    .map((g) => ({ persona: g.perfiles?.nombre || "—", categoria: CATEGORIAS[g.categoria] || g.categoria, mes: String(g.fecha || "").slice(0, 7) || "sin fecha",
      monto: reembolsable(g.gasto_items), pagado: g.rendiciones.estado === "reembolsada", comercio: g.comercio, rendicion: g.rendiciones.titulo, fecha: g.fecha,
      comprobante: g.tipo_comprobante === "pago" ? "pago POS (sin e-Ticket)" : "e-Ticket / e-Factura" }));
  S.totales = filas;
  const suma = (a) => a.reduce((s, f) => s + f.monto, 0);
  const agrupar = (k) => Object.entries(filas.reduce((a, f) => ((a[f[k]] = (a[f[k]] || 0) + f.monto), a), {})).sort((a, b) => b[1] - a[1]);
  const tabla = (t, fs) => `<div class="card"><h3>${t}</h3><div class="tabla-wrap"><table class="t"><tbody>
    ${fs.length ? fs.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${plata(v)}</td></tr>`).join("") : `<tr><td class="muted">Sin datos</td></tr>`}</tbody></table></div></div>`;
  return `<div class="lista"><div class="fila entre"><p class="muted">Lo aprobado, sin lo personal ni lo que el jefe no reconoció.</p><button data-a="csv">${icono("download")} Descargar CSV</button></div>
    <div class="kpis"><div class="kpi"><span class="v">${plata(suma(filas))}</span><span class="k">Aprobado en total</span></div>
      <div class="kpi"><span class="v">${plata(suma(filas.filter((f) => f.pagado)))}</span><span class="k">Ya reembolsado</span></div>
      <div class="kpi"><span class="v">${plata(suma(filas.filter((f) => !f.pagado)))}</span><span class="k">Pendiente de reembolso</span></div></div>
    <div class="grid2">${tabla("Por persona", agrupar("persona"))}${tabla("Por categoría", agrupar("categoria"))}${tabla("Por mes", agrupar("mes"))}</div></div>`;
}
function descargarCsv() {
  const f = S.totales || [];
  const lineas = [["fecha", "persona", "rendicion", "comercio", "comprobante", "categoria", "monto_reembolsable", "reembolsado"]]
    .concat(f.map((x) => [x.fecha, x.persona, x.rendicion, x.comercio, x.comprobante, x.categoria, x.monto, x.pagado ? "si" : "no"]));
  const csv = lineas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = "rendi-totales.csv"; a.click();
}

// ---------------------------------------------------------------- Control de calidad
async function vistaCalidad() {
  const [pruebas, met] = await Promise.all([rpc("probar_reglas"), rpc("metricas_ia")]);
  const m = met?.[0] || {}, ok = pruebas.filter((p) => p.ok).length, todo = ok === pruebas.length;
  return `<div class="lista">
    <div class="card"><div class="fila entre"><div style="max-width:70ch"><h2>Las reglas, probadas en vivo</h2>
      <p class="small muted">Cada vez que abrís esta pantalla, la base corre las reglas contra casos de prueba conocidos y simula aprobaciones para ver que nadie se salte los controles. No deja nada guardado.</p></div>
      <div style="text-align:right"><div class="puntaje ${todo ? "ok" : "mal"}">${ok}/${pruebas.length}</div><div class="xs muted">pruebas que pasan</div></div></div>
      <div class="tabla-wrap"><table class="t"><thead><tr><th></th><th>Caso de prueba</th><th>Qué tiene que pasar</th><th>Qué pasó</th></tr></thead>
      <tbody>${pruebas.map((p) => `<tr><td><span class="pill ${p.ok ? "e-ok" : "e-mal"}">${p.ok ? "Pasa" : "Falla"}</span></td>
        <td><b>${esc(p.prueba)}</b><br><span class="xs muted">${esc(REGLAS[p.regla] || p.regla.replace(/_/g, " "))}</span></td>
        <td class="small">${esc(p.esperado)}</td><td class="small muted">${esc(p.resultado)}</td></tr>`).join("")}</tbody></table></div>
      <div><button data-a="recargar">Volver a correr las pruebas</button></div></div>
    <div class="card"><h2>¿Qué tan bien lee la IA?</h2>
      <p class="small muted">Compara lo que leyó la IA con lo que la persona terminó guardando, en 8 campos: RUT, serie, número, fecha, comercio, neto, IVA y total.</p>
      ${m.revisadas ? `<div class="kpis"><div class="kpi"><span class="v">${m.precision_pct ?? "—"} %</span><span class="k">Campos leídos bien</span></div>
        <div class="kpi"><span class="v">${m.revisadas}</span><span class="k">Tickets revisados</span></div>
        <div class="kpi"><span class="v">${m.campos_corregidos}/${m.campos_revisados}</span><span class="k">Campos corregidos a mano</span></div>
        <div class="kpi"><span class="v">${m.confianza_promedio ?? "—"} %</span><span class="k">Confianza que declara la IA</span></div></div>
        <p class="small">Lo que más se corrige: <b>${esc(m.mas_corregidos || "nada todavía")}</b></p>`
        : `<div class="vacio"><p>Todavía no hay tickets leídos por la IA.</p></div>`}</div>
    <div class="card"><h3>Reiniciar datos de ejemplo</h3><p class="small muted">Borra todas las rendiciones y vuelve a cargar las de ejemplo. Las métricas de la IA se mantienen.</p>
      <div><button class="btn-mal" data-a="reiniciar">Reiniciar datos demo</button></div></div></div>`;
}

// ---------------------------------------------------------------- detalle de una rendición
function lineaDeTiempo(r, aprs) {
  const pasaFin = r.estado === "revision_finanzas" || aprs.some((a) => a.etapa === "finanzas") || Number(r.total_aprobado || 0) > 3000;
  const pasos = ["Borrador", "Jefe", ...(pasaFin ? ["Finanzas"] : []), "Aprobada", "Reembolsada"];
  let idx = 0, mal = false, etiqueta = null;
  switch (r.estado) {
    case "devuelta": idx = 0; mal = true; etiqueta = "Devuelta"; break;
    case "pendiente_jefe": idx = 1; break;
    case "revision_finanzas": idx = 2; break;
    case "aprobada": case "aprobada_parcial": idx = pasos.indexOf("Aprobada"); break;
    case "reembolsada": idx = pasos.length; break;
    case "rechazada": idx = aprs.some((a) => a.etapa === "finanzas" && a.decision === "rechazado") ? 2 : 1; mal = true; etiqueta = "Rechazada"; break;
  }
  return `<ol class="tiempo" aria-label="Estado de la rendición">${pasos.map((p, i) => {
    const cls = i < idx ? "hecho" : i === idx ? (mal ? "actual mal" : "actual") : "";
    return `<li class="${cls}" ${i === idx ? 'aria-current="step"' : ""}><span class="punto">${i < idx ? "✓" : i + 1}</span>${esc(i === idx && etiqueta ? etiqueta : p)}</li>`;
  }).join("")}</ol>`;
}
const claseAlerta = (a) => a.nivel === "bad" ? "bad" : a.nivel === "justify" ? (a.justificada ? "justified" : "need") : a.nivel;
const NIVEL_TXT = { bad: "Bloquea", need: "Justificar", justified: "Justificado", warn: "Atención", info: "Info", ok: "OK" };

async function vistaDetalle(id) {
  const rid = Number(id);
  const [r, gastos, coms, aprs] = await Promise.all([
    q(sb.from("rendiciones").select("*,perfiles(nombre,foto_path)").eq("id", rid).maybeSingle()),
    q(sb.from("gastos").select("*,gasto_items(*)").eq("rendicion_id", rid).order("id")),
    q(sb.from("comentarios").select("*,perfiles(nombre,foto_path)").eq("rendicion_id", rid).order("fecha")),
    q(sb.from("aprobaciones").select("*,perfiles(nombre)").eq("rendicion_id", rid).order("fecha")),
  ]);
  if (!r) return `<div class="vacio"><p>No encontré esa rendición o no tenés permiso para verla.</p><a class="btn" href="#/inicio">Volver al inicio</a></div>`;
  const [alertas, lecturas] = await Promise.all([
    Promise.all(gastos.map((g) => rpc("alertas_gasto", { p_gasto: g.id }))),
    Promise.all(gastos.map((g) => rpc("lectura_de_gasto", { p_gasto: g.id }).then((x) => x?.[0] || null).catch(() => null))),
  ]);
  gastos.forEach((g) => g.gasto_items.sort((a, b) => a.id - b.id));
  S.rendId = rid; S.detalle = { r, gastos };

  const duena = r.empleado_id === S.uid;
  const editable = duena && ["borrador", "devuelta"].includes(r.estado);
  const jefeDecide = S.perfil.rol === "jefe" && r.estado === "pendiente_jefe" && !duena;
  const finDecide = S.perfil.rol === "finanzas" && r.estado === "revision_finanzas";
  const finPaga = S.perfil.rol === "finanzas" && ["aprobada", "aprobada_parcial"].includes(r.estado);
  const revisor = !duena;
  const abiertos = (i) => ["pendiente", "a_corregir"].includes(gastos[i].estado);
  const totTickets = gastos.reduce((s, g) => s + Number(g.total || 0), 0);
  const aReemb = r.total_aprobado ?? gastos.filter((g) => g.estado !== "rechazado").reduce((s, g) => s + reembolsable(g.gasto_items), 0);

  // Resumen para mirar de un vistazo
  const nBloq = alertas.filter((as, i) => abiertos(i) && as.some((a) => a.nivel === "bad")).length;
  const nFalta = alertas.filter((as, i) => abiertos(i) && as.some((a) => a.nivel === "justify" && !a.justificada)).length;
  const nJust = alertas.filter((as) => as.some((a) => a.nivel === "justify" && a.justificada)).length;
  const nCorr = lecturas.filter((l) => l?.campos_corregidos?.length).length;
  const nDuda = lecturas.filter((l) => l && l.confianza != null && Number(l.confianza) < 0.7).length;
  const nSinFoto = gastos.filter((g) => !g.foto_path).length;
  const chips = [
    `<span class="etq">${gastos.length} ticket${gastos.length === 1 ? "" : "s"}</span>`,
    nBloq ? `<span class="etq mal">${nBloq} bloquea${nBloq === 1 ? "" : "n"} el envío</span>` : "",
    nFalta ? `<span class="etq mal">${nFalta} necesita${nFalta === 1 ? "" : "n"} justificación</span>` : "",
    nJust ? `<span class="etq info">${nJust} con excepción justificada</span>` : "",
    nCorr ? `<span class="etq warn">${nCorr} corregido${nCorr === 1 ? "" : "s"} a mano</span>` : "",
    nDuda ? `<span class="etq warn">${nDuda} con lectura dudosa</span>` : "",
    nSinFoto ? `<span class="etq warn">${nSinFoto} sin foto</span>` : "",
  ].join("");
  const motivoEnvio = !gastos.length ? "Agregá al menos un ticket." : nBloq ? "Hay datos que bloquean el envío: corregilos." : nFalta ? "Escribí la justificación en los tickets marcados." : "Todo listo para enviar.";

  return `<div class="lista">
    <section class="card">
      <div class="fila entre"><div><h2>${esc(r.titulo)}</h2>
        <p class="small muted" style="margin-top:4px">Rinde <b>${esc(r.perfiles?.nombre)}</b> · creada ${fecha(r.creada)}${r.enviada ? " · enviada " + fecha(r.enviada) : ""}</p></div>${pill(EST_R, r.estado)}</div>
      ${lineaDeTiempo(r, aprs)}
      <div class="kpis"><div class="kpi"><span class="v">${plata(totTickets)}</span><span class="k">Total de los tickets</span></div>
        <div class="kpi"><span class="v">${plata(aReemb)}</span><span class="k">${r.total_aprobado != null ? "Aprobado para reembolsar" : "A reembolsar (sin lo personal)"}</span></div></div>
      <div class="chips">${chips}</div>
      ${r.estado === "devuelta" && duena ? `<div class="alerta need"><span class="nivel">Devuelta</span><span>Tu jefe pidió corregir algunos tickets. Mirá los comentarios abajo, corregí y volvé a enviar.</span></div>` : ""}
      ${revisor && gastos.length ? `<p class="verificar">${icono("eye")}<span>Las reglas revisan que los números cierren entre sí, no que coincidan con el papel. <b>Compará cada ticket con su foto</b>, sobre todo los marcados en amarillo.</span></p>` : ""}
    </section>

    ${editable ? `<section class="card">
      <div class="subir"><h2>Agregar tickets</h2>
        <p class="small muted">Sacale foto o elegí varias de la galería. La IA lee cada ticket y vos revisás antes de guardar.</p>
        <label class="btn-p btn-grande" style="cursor:pointer">${icono("camera")} Sacar foto o elegir tickets<input type="file" id="archivos" accept="image/*" multiple></label>
        <button class="btn-link" data-a="manual">o cargar un ticket a mano</button></div>
      <div id="revs" class="lista"></div>
      <div class="fila entre"><span class="small ${nBloq || nFalta ? "error" : "muted"}">${motivoEnvio}</span>
        <button class="btn-p" data-a="enviar" ${!gastos.length || nBloq || nFalta ? "disabled" : ""}>Enviar a mi jefe</button></div>
    </section>` : ""}

    ${gastos.map((g, i) => tarjetaGasto(g, alertas[i], lecturas[i], { editable, jefeDecide, revisor })).join("")
      || (editable ? "" : `<div class="vacio"><p>Esta rendición no tiene tickets.</p></div>`)}

    ${finDecide ? `<section class="card"><h2>Decisión de Finanzas</h2>
      <p class="small muted">El jefe aprobó ${plata(r.total_aprobado)}. Como supera ${plata(3000)}, necesita tu aprobación.</p>
      <label>Motivo (obligatorio si rechazás)<input id="motivo-fin"></label>
      <div class="fila"><button class="btn-p" data-a="fin" data-ok="1">Aprobar</button><button class="btn-mal" data-a="fin" data-ok="0">Rechazar</button></div></section>` : ""}
    ${finPaga ? `<section class="card"><div class="fila entre"><div><h2>Reembolso</h2><p class="small muted">Cuando hagas la transferencia en el banco, marcala como pagada.</p></div>
      <button class="btn-p" data-a="pagar">Marcar como reembolsada · ${plata(r.total_aprobado)}</button></div></section>` : ""}

    <section class="card"><h2>Historial y comentarios</h2><div class="hilo">
      ${aprs.map((a) => `<div class="msg"><div class="quien">${esc(a.perfiles?.nombre)} · ${a.etapa === "jefe" ? "Jefe" : "Finanzas"} · ${fecha(a.fecha)}</div>
        Decisión: <b>${esc({ aprobado: "aprobado", parcial: "aprobado parcial", corregir: "pidió corrección", rechazado: "rechazado" }[a.decision])}</b>${a.gasto_id ? ` en el ticket de ${esc(gastos.find((g) => g.id === a.gasto_id)?.comercio || "#" + a.gasto_id)}` : " (toda la rendición)"}</div>`).join("")}
      ${coms.map((c) => `<div class="msg"><div class="quien">${esc(c.perfiles?.nombre)} · ${fecha(c.fecha)}</div>${esc(c.texto)}</div>`).join("")}
      ${!aprs.length && !coms.length ? `<p class="small muted">Todavía no hay movimientos.</p>` : ""}</div>
      ${r.estado !== "borrador" || duena ? `<form class="fila" data-form="comentar"><input name="texto" placeholder="Escribí un comentario" style="flex:1 1 220px" aria-label="Comentario"><button>Comentar</button></form>` : ""}
    </section></div>`;
}

function tarjetaGasto(g, alertas, lectura, { editable, jefeDecide, revisor }) {
  const gEditable = editable && ["pendiente", "a_corregir"].includes(g.estado);
  const decide = jefeDecide && g.estado === "pendiente";
  const corr = new Set(lectura?.campos_corregidos || []);
  const leido = lectura?.leido || {};
  const valor = (k) => ["neto", "iva", "total"].includes(k) ? plata(g[k]) : k === "fecha" ? fecha(g.fecha) : esc(g[k] ?? "—");
  const antes = (k) => { const v = leido[k]; return v == null || v === "" ? "vacío" : k === "tipo_comprobante" ? esc(TIPOS[v] || v) : ["neto", "iva", "total"].includes(k) ? plata(v) : k === "fecha" ? fecha(v) : esc(v); };
  const dato = (k, etiqueta, html) => `<div><dt>${etiqueta}</dt><dd class="${corr.has(k) ? "corregido" : ""}">${html ?? valor(k)}${corr.has(k) ? `<span class="antes">Corregido a mano · la IA leyó: ${antes(k)}</span>` : ""}</dd></div>`;
  const nAlertas = alertas.length;
  const alertasHtml = nAlertas ? alertas.map((a) => {
    const c = claseAlerta(a);
    return `<div class="alerta ${c}"><span class="nivel">${NIVEL_TXT[c]}</span><span><b>${esc(REGLAS[a.regla] || a.regla)}.</b> ${esc(a.mensaje)}</span>
      ${c === "justified" && g.justificacion ? `<span class="just">Justificación: “${esc(g.justificacion)}”</span>` : ""}</div>`;
  }).join("") : (["pendiente", "a_corregir"].includes(g.estado) || revisor
    ? `<div class="alerta ok"><span class="nivel">OK</span><span>Sin alertas automáticas${revisor ? " · verificá los datos contra la foto" : ""}.</span></div>` : "");
  const necesita = alertas.some((a) => a.nivel === "justify" && !a.justificada);
  return `<article class="card" id="g-${g.id}">
    <div class="gasto">${fotoTicket(g.foto_path, g.comercio)}
      <div class="lista">
        <div class="fila entre"><h3>${esc(g.comercio || "Sin comercio")}</h3><div class="fila">${g.tipo_comprobante === "pago" ? `<span class="etq warn">Sin e-Ticket</span>` : ""}${lectura?.confianza != null ? `<span class="etq ${Number(lectura.confianza) < 0.7 ? "warn" : ""}">IA ${Math.round(lectura.confianza * 100)} %</span>` : `<span class="etq">Carga manual</span>`}${pill(EST_G, g.estado)}</div></div>
        <dl class="datos">${dato("fecha", "Fecha")}${dato("categoria", "Categoría", esc(CATEGORIAS[g.categoria] || g.categoria))}
          ${g.tipo_comprobante === "pago"
            ? `${dato("tipo_comprobante", "Comprobante", esc("Pago con POS" + (g.medio_pago ? " · " + g.medio_pago : "")))}${dato("nro_operacion", "N.º de operación")}${dato("total", "Total")}`
            : `${dato("rut_emisor", "RUT")}${dato("numero", "Serie y número", esc(`${g.serie || ""} ${g.numero || "—"}`.trim()))}${dato("neto", "Neto")}${dato("iva", "IVA")}${dato("total", "Total")}`}
          <div><dt>Se reembolsa</dt><dd><b>${plata(reembolsable(g.gasto_items))}</b></dd></div></dl>
        <div class="alertas">${alertasHtml}</div>
        <div class="tabla-wrap"><table class="lineas"><thead><tr><th>Línea</th><th class="r">Importe</th>${gEditable ? '<th class="c">Personal</th>' : ""}${decide ? '<th class="c">No reconocer</th>' : ""}</tr></thead><tbody>
          ${g.gasto_items.map((i) => `<tr class="${!i.reembolsable || i.es_alcohol || i.no_reconocido_por ? "tachada" : ""}">
            <td class="desc">${esc(i.descripcion)}${i.es_alcohol ? '<span class="tag alc">Alcohol · no se reembolsa</span>' : !i.reembolsable ? '<span class="tag per">Personal</span>' : ""}${i.no_reconocido_por ? `<span class="tag nr" title="${esc(i.motivo_no_reconocido)}">No reconocido</span>` : ""}</td>
            <td class="r num">${plata(i.importe)}</td>
            ${gEditable ? `<td class="c"><input type="checkbox" data-a="personal" data-item="${i.id}" ${!i.reembolsable || i.es_alcohol ? "checked" : ""} ${i.es_alcohol ? 'disabled title="El alcohol nunca se reembolsa"' : ""} aria-label="Marcar ${esc(i.descripcion)} como personal"></td>` : ""}
            ${decide ? `<td class="c">${i.es_alcohol ? "—" : `<input type="checkbox" class="nr-${g.id}" value="${i.id}" aria-label="No reconocer ${esc(i.descripcion)}">`}</td>` : ""}
          </tr>`).join("") || `<tr><td class="muted" colspan="3">Sin líneas</td></tr>`}</tbody></table></div>
        ${gEditable ? `<label>Justificación${necesita ? ' <b class="error">· necesaria para enviar</b>' : " (opcional)"}
            <textarea data-just="${g.id}" placeholder="${g.tipo_comprobante === "pago" ? "¿Por qué no hay e-Ticket? Ej.: el taxi solo da el comprobante del POS" : "¿Por qué se pasa del tope o no cierra? Ej.: cena con el cliente de Ceibo"}">${esc(g.justificacion || "")}</textarea></label>
          <div class="fila"><button data-a="just" data-gasto="${g.id}">Guardar justificación</button><button data-a="editar" data-gasto="${g.id}">Corregir datos</button>
            <button class="btn-mal" data-a="borrar" data-gasto="${g.id}">Borrar ticket</button></div>`
          : g.justificacion && !alertas.some((a) => claseAlerta(a) === "justified") ? `<p class="small"><b>Justificación:</b> ${esc(g.justificacion)}</p>` : ""}
        ${decide ? `<div class="decidir">
          <label>Motivo (obligatorio para pedir corrección, rechazar o no reconocer una línea)<input id="m-${g.id}"></label>
          <div class="fila"><button class="btn-p" data-a="decidir" data-gasto="${g.id}" data-d="aprobado">Aprobar</button>
            <button data-a="decidir" data-gasto="${g.id}" data-d="corregir">Pedir corrección</button>
            <button class="btn-mal" data-a="decidir" data-gasto="${g.id}" data-d="rechazado">Rechazar</button></div></div>` : ""}
      </div></div></article>`;
}

// ---------------------------------------------------------------- lectura con IA y formulario de revisión
const vacio = () => ({ tipo_comprobante: "cfe", medio_pago: "", nro_operacion: "", comercio: "", fecha: "", rut_emisor: "", serie: "", numero: "", categoria: "otros", neto: "", iva: "", total: "", justificacion: "", items: [{ descripcion: "", importe: "" }] });
async function achicar(file, lado = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
  } catch { return file; }
}
// Llama a la función de IA. Si se corta la conexión (señal del celular, la función tardó demasiado), reintenta una vez sola.
const SIN_CONEXION = "Se cortó la conexión con el lector de tickets (puede ser la señal del celular o que la IA tardó demasiado)";
async function invocarLector(path) {
  for (let intento = 1; intento <= 2; intento++) {
    const espera = new Promise((_, no) => setTimeout(() => no(new Error("tiempo")), 75_000));
    let r;
    try { r = await Promise.race([sb.functions.invoke("leer-ticket", { body: { path } }), espera]); }
    catch { r = { error: { name: "FunctionsFetchError", message: "tiempo" } }; }
    const { data, error } = r;
    if (!error) { if (data?.error) throw new Error(data.error); return data; }
    const deRed = error.name === "FunctionsFetchError" || error.name === "FunctionsRelayError" || /failed to send|fetch|tiempo/i.test(error.message || "");
    if (deRed) { if (intento === 1) { await new Promise((ok) => setTimeout(ok, 2000)); continue; } throw new Error(SIN_CONEXION); }
    let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch { /* sin detalle */ }
    throw new Error(m);
  }
}
async function leerConIA(rev) {
  try {
    const data = await invocarLector(rev.path);
    rev.datos = { ...vacio(), ...data.datos, items: data.datos.items?.length ? data.datos.items : vacio().items };
    rev.lectura_id = data.lectura_id; rev.modelo = data.modelo; rev.error = null;
  } catch (e) {
    rev.error = "No se pudo leer automáticamente: " + msg(e) + ". Tocá «Reintentar lectura» o completalo a mano.";
    rev.datos = rev.datos || vacio();
  }
  rev.estado = "form"; pintarRev(rev);
}
async function leerFoto(rev, file) {
  try {
    const blob = await achicar(file);
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${S.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from("tickets").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    rev.path = path;
  } catch (e) {
    rev.error = "No se pudo subir la foto (" + msg(e) + "). Revisá la conexión y volvé a elegirla, o completalo a mano.";
    rev.datos = rev.datos || vacio(); rev.estado = "form"; pintarRev(rev); return;
  }
  await leerConIA(rev);
}
function subirArchivos(files) {
  for (const file of files) {
    const rev = { key: crypto.randomUUID(), rendId: S.rendId, estado: "leyendo", preview: URL.createObjectURL(file) };
    S.revisiones.push(rev); pintarRev(rev); leerFoto(rev, file);
  }
}
function pintarRevisiones() { S.revisiones.filter((r) => r.rendId === S.rendId).forEach(pintarRev); }
function pintarRev(rev) {
  const cont = $("#revs");
  if (!cont || rev.rendId !== S.rendId) return;
  let box = cont.querySelector(`[data-rev="${rev.key}"]`);
  if (!box) { box = document.createElement("div"); box.dataset.rev = rev.key; cont.appendChild(box); }
  box.innerHTML = htmlRev(rev); actualizarSuma(box);
}
function filaItem(i = {}) {
  const alc = !!i.es_alcohol;
  return `<div class="campos it-row">
    <label>Línea<input data-f="descripcion" value="${esc(i.descripcion)}"></label>
    <label>Importe<input data-f="importe" inputmode="decimal" value="${esc(i.importe)}"></label>
    <label class="check"><input type="checkbox" data-f="es_alcohol" ${alc ? "checked" : ""}>Alcohol</label>
    <label class="check" title="${alc ? "El alcohol nunca se reembolsa" : ""}"><input type="checkbox" data-f="personal" ${alc || i.reembolsable === false ? "checked" : ""} ${alc ? "disabled" : ""}>Personal</label>
    <button type="button" class="btn-link" data-a="quitar-linea" aria-label="Quitar línea">${icono("close")}</button>
  </div>`;
}
function htmlRev(rev) {
  const fotoHtml = rev.preview ? `<button type="button" class="foto ${rev.estado === "leyendo" ? "leyendo" : ""}" data-ver-local="${esc(rev.preview)}" aria-label="Ver la foto en grande"><img src="${esc(rev.preview)}" alt="Ticket subido"><span class="lupa">${icono("zoomin")} Ver</span></button>` : `<div class="foto">Carga manual</div>`;
  if (rev.estado === "leyendo") return `<div class="card"><div class="gasto">${fotoHtml}<div class="lista"><h3>La IA está leyendo el ticket…</h3><p class="small muted">Busca RUT, serie, número, fecha, comercio, montos, IVA y cada línea.</p></div></div></div>`;
  const d = rev.datos;
  return `<form class="card" data-form="rev" data-key="${rev.key}" data-tipo="${d.tipo_comprobante === "pago" ? "pago" : "cfe"}">
    <datalist id="medios-pago">${MEDIOS.map((m) => `<option value="${m}">`).join("")}</datalist><div class="gasto">${fotoHtml}<div class="lista">
    <div class="fila entre"><h3>${rev.gastoId ? "Corregir ticket" : "Revisá lo que leyó la IA"}</h3>${rev.modelo ? `<span class="xs muted">${esc(rev.modelo)}${d.confianza ? ` · confianza ${Math.round(d.confianza * 100)} %` : ""}</span>` : ""}</div>
    ${rev.error ? `<div class="alerta warn"><span class="nivel">Atención</span><span>${esc(rev.error)}</span></div>
      ${rev.path && !rev.gastoId ? `<div><button type="button" data-a="reintentar" data-key="${rev.key}">${icono("refresh")} Reintentar lectura</button></div>` : ""}` : ""}
    <fieldset class="tipo-comp"><legend>Tipo de comprobante</legend>
      ${Object.entries(TIPOS).map(([v, t]) => `<label class="opcion"><input type="radio" name="tipo_comprobante" value="${v}" ${(d.tipo_comprobante || "cfe") === v ? "checked" : ""}>${t}</label>`).join("")}
    </fieldset>
    <p class="alerta info solo-pago"><span class="nivel">POS</span><span>Un comprobante de pago no es un e-Ticket: no tiene RUT ni IVA. Se puede rendir, pero vas a tener que explicar por qué no hay e-Ticket. Si podés, pedíselo al comercio.</span></p>
    <div class="campos">
      <label>Comercio<input name="comercio" value="${esc(d.comercio)}" required></label>
      <label>Fecha<input name="fecha" type="date" value="${esc(d.fecha)}" required></label>
      <label>Categoría<select name="categoria">${Object.entries(CATEGORIAS).map(([v, t]) => `<option value="${v}" ${d.categoria === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="solo-pago">Medio de pago<input name="medio_pago" list="medios-pago" value="${esc(d.medio_pago)}" placeholder="Mercado Pago, OCA…"></label>
      <label class="solo-pago">N.º de operación<input name="nro_operacion" inputmode="numeric" value="${esc(d.nro_operacion)}"></label>
      <label class="solo-cfe">RUT emisor<input name="rut_emisor" inputmode="numeric" value="${esc(d.rut_emisor)}"></label>
      <label class="solo-cfe">Serie<input name="serie" value="${esc(d.serie)}"></label>
      <label class="solo-cfe">Número<input name="numero" value="${esc(d.numero)}"></label>
      <label class="solo-cfe">Neto (sin IVA)<input name="neto" inputmode="decimal" value="${esc(d.neto)}"></label>
      <label class="solo-cfe">IVA<input name="iva" inputmode="decimal" value="${esc(d.iva)}"></label>
      <label>Total<input name="total" inputmode="decimal" value="${esc(d.total)}" required></label>
    </div>
    <div class="lista items">${(d.items || []).map(filaItem).join("")}</div>
    <div class="fila entre"><button type="button" class="btn-link" data-a="agregar-linea">+ Agregar línea</button><span class="small suma"></span></div>
    <label>Justificación (si se pasa del tope, algo no cierra o no hay e-Ticket)<textarea name="justificacion">${esc(d.justificacion)}</textarea></label>
    <div class="fila"><button class="btn-p">Guardar ticket</button><button type="button" data-a="descartar" data-key="${rev.key}">Descartar</button></div>
  </div></div></form>`;
}
function leerForm(form) {
  const v = (n) => form.querySelector(`[name="${n}"]`)?.value ?? "";
  const pago = form.querySelector('[name="tipo_comprobante"]:checked')?.value === "pago";
  return {
    tipo_comprobante: pago ? "pago" : "cfe", medio_pago: pago ? v("medio_pago").trim() : "", nro_operacion: pago ? v("nro_operacion").replace(/[^\dA-Za-z-]/g, "") : "",
    comercio: v("comercio").trim(), fecha: v("fecha"), categoria: v("categoria"), rut_emisor: pago ? "" : v("rut_emisor").replace(/\D/g, ""),
    serie: pago ? "" : v("serie").trim(), numero: pago ? "" : v("numero").trim(), neto: pago ? null : numero(v("neto")), iva: pago ? null : numero(v("iva")), total: numero(v("total")),
    justificacion: v("justificacion").trim(),
    items: [...form.querySelectorAll(".it-row")].map((row) => {
      const alc = row.querySelector('[data-f="es_alcohol"]').checked;
      return { descripcion: row.querySelector('[data-f="descripcion"]').value.trim(), importe: numero(row.querySelector('[data-f="importe"]').value),
        es_alcohol: alc, reembolsable: !alc && !row.querySelector('[data-f="personal"]').checked };
    }).filter((i) => i.descripcion || i.importe !== null),
  };
}
function guardarBorradores() {
  document.querySelectorAll('form[data-form="rev"]').forEach((f) => {
    const rev = S.revisiones.find((r) => r.key === f.dataset.key);
    if (rev) rev.datos = { ...rev.datos, ...leerForm(f) };
  });
}
function actualizarSuma(box) {
  const form = box.querySelector('form[data-form="rev"]');
  if (!form) return;
  const d = leerForm(form), suma = d.items.reduce((s, i) => s + (i.importe || 0), 0);
  const cierra = d.total !== null && Math.abs(suma - d.total) <= 1;
  form.querySelector(".suma").innerHTML = `Las líneas suman <b class="num">${plata(suma)}</b> ${d.total === null ? "" : cierra ? "· coincide con el total ✓" : `· <span class="error">no coincide con el total</span>`}`;
}
async function guardarRev(form) {
  const rev = S.revisiones.find((r) => r.key === form.dataset.key);
  const datos = leerForm(form), boton = form.querySelector(".btn-p"); boton.disabled = true;
  try {
    if (rev.gastoId) await rpc("actualizar_gasto", { p_gasto: rev.gastoId, p_datos: datos });
    else await rpc("guardar_gasto", { p_rendicion: rev.rendId, p_datos: datos, p_lectura: rev.lectura_id ?? null, p_foto: rev.path ?? null });
    S.revisiones = S.revisiones.filter((r) => r !== rev);
    toast("Ticket guardado"); render();
  } catch (e) { boton.disabled = false; toast(msg(e), true); }
}

// ---------------------------------------------------------------- acciones
async function hacer(fn, ok) { try { await fn(); if (ok) toast(ok); await render(); } catch (e) { toast(msg(e), true); } }

const acciones = {
  salir: async () => { await sb.auth.signOut(); location.replace("index.html"); },
  recargar: () => render(),
  tema: () => { alternarTema(); pintarTema(); },
  cuenta: (b) => { const d = $("#desplegable"); d.hidden = !d.hidden; b.setAttribute("aria-expanded", String(!d.hidden)); },
  "cerrar-cuenta": () => { $("#desplegable").hidden = true; },
  "abrir-menu": () => $("#shell").classList.add("abierto"),
  "cerrar-menu": () => $("#shell").classList.remove("abierto"),
  plegar: () => $("#shell").classList.toggle("plegado"),
  toggle: (b) => { const k = b.dataset.k; S.abiertos.has(k) ? S.abiertos.delete(k) : S.abiertos.add(k);
    b.setAttribute("aria-expanded", String(S.abiertos.has(k))); b.nextElementSibling.hidden = !S.abiertos.has(k); },
  arriba: () => { scrollTo({ top: 0, behavior: "smooth" }); $("#contenido").focus({ preventScroll: true }); },
  manual: () => { const rev = { key: crypto.randomUUID(), rendId: S.rendId, estado: "form", datos: vacio() }; S.revisiones.push(rev); pintarRev(rev); },
  "agregar-linea": (b) => b.closest("form").querySelector(".items").insertAdjacentHTML("beforeend", filaItem()),
  "quitar-linea": (b) => { const box = b.closest("[data-rev]"); b.closest(".it-row").remove(); actualizarSuma(box); },
  reintentar: (b) => {
    const rev = S.revisiones.find((r) => r.key === b.dataset.key); if (!rev) return;
    rev.estado = "leyendo"; rev.error = null; pintarRev(rev); leerConIA(rev);
  },
  descartar: (b) => { S.revisiones = S.revisiones.filter((r) => r.key !== b.dataset.key); b.closest("[data-rev]").remove(); },
  editar: (b) => {
    const g = S.detalle.gastos.find((x) => x.id === Number(b.dataset.gasto));
    const rev = { key: crypto.randomUUID(), rendId: S.rendId, estado: "form", gastoId: g.id, preview: S.fotos[g.foto_path] || null,
      datos: { ...g, items: g.gasto_items.map((i) => ({ descripcion: i.descripcion, importe: i.importe, es_alcohol: i.es_alcohol, reembolsable: i.reembolsable })) } };
    S.revisiones.push(rev); pintarRev(rev);
    $(`[data-rev="${rev.key}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  borrar: async (b) => { if (await confirmar("¿Borrar este ticket? La foto queda guardada, pero el ticket sale de la rendición.", { ok: "Borrar ticket", peligro: true }))
    hacer(() => rpc("borrar_gasto", { p_gasto: Number(b.dataset.gasto) }), "Ticket borrado"); },
  just: (b) => { const id = Number(b.dataset.gasto);
    hacer(() => rpc("set_justificacion", { p_gasto: id, p_texto: $(`[data-just="${id}"]`).value }), "Justificación guardada"); },
  personal: (b) => hacer(() => rpc("set_item_personal", { p_item: Number(b.dataset.item), p_personal: b.checked })),
  enviar: async () => { if (await confirmar("¿Enviar la rendición a tu jefe? Mientras la revisa no la vas a poder modificar.", { ok: "Enviar" }))
    hacer(() => rpc("enviar_rendicion", { p_rend: S.rendId }), "Enviada a tu jefe"); },
  decidir: (b) => {
    const id = Number(b.dataset.gasto), motivo = $("#m-" + id).value;
    const nr = [...document.querySelectorAll(".nr-" + id + ":checked")].map((c) => Number(c.value));
    hacer(() => rpc("decidir_gasto", { p_gasto: id, p_decision: b.dataset.d, p_motivo: motivo, p_no_reconocidos: nr }),
      { aprobado: nr.length ? "Aprobado sin las líneas no reconocidas" : "Ticket aprobado", corregir: "Se pidió corrección", rechazado: "Ticket rechazado" }[b.dataset.d]);
  },
  fin: (b) => hacer(() => rpc("decidir_finanzas", { p_rend: S.rendId, p_aprobar: b.dataset.ok === "1", p_motivo: $("#motivo-fin").value }),
    b.dataset.ok === "1" ? "Aprobada por Finanzas" : "Rechazada por Finanzas"),
  pagar: async () => { if (await confirmar("¿Ya hiciste la transferencia? La rendición queda como reembolsada.", { ok: "Sí, marcar reembolsada" }))
    hacer(() => rpc("marcar_reembolsada", { p_rend: S.rendId }), "Marcada como reembolsada"); },
  csv: () => descargarCsv(),
  reiniciar: async () => { if (await confirmar("Se borran todas las rendiciones y se cargan las de ejemplo. ¿Seguimos?", { ok: "Reiniciar", peligro: true }))
    hacer(() => rpc("reiniciar_demo"), "Datos demo reiniciados"); },
};

app.addEventListener("click", (e) => {
  const ver = e.target.closest("[data-ver]");
  if (ver) { e.preventDefault(); return abrirVisor(ver.dataset.ver, ver.closest("article")?.querySelector("h3")?.textContent); }
  const local = e.target.closest("[data-ver-local]");
  if (local) { e.preventDefault(); const d = $("#visor"); d.querySelector("img").src = local.dataset.verLocal; d.querySelector(".titulo").textContent = "Ticket subido"; d.querySelector("[data-original]").href = local.dataset.verLocal; Object.assign(visor, { zoom: 1, giro: 0 }); aplicarVisor(); return d.showModal(); }
  if (!e.target.closest(".menu-cuenta")) { const d = $("#desplegable"); if (d && !d.hidden) d.hidden = true; }
  const b = e.target.closest("[data-a]");
  if (!b || b.type === "checkbox") return;
  if (b.tagName !== "A") e.preventDefault();
  acciones[b.dataset.a]?.(b, e);
});
app.addEventListener("change", (e) => {
  if (e.target.id === "archivos" && e.target.files.length) { subirArchivos([...e.target.files]); e.target.value = ""; }
  if (e.target.id === "foto-perfil" && e.target.files[0]) {
    subirAvatar(e.target.files[0]).then(() => { toast("Foto actualizada"); render(); }).catch((err) => toast(msg(err), true));
  }
  if (e.target.matches('[name="tipo_comprobante"]')) {
    const form = e.target.closest("form"); form.dataset.tipo = e.target.value;
    if (e.target.value === "pago" && form.querySelector('[name="categoria"]').value === "otros" && /taxi|uber|cabify|remise/i.test(form.querySelector('[name="comercio"]').value))
      form.querySelector('[name="categoria"]').value = "traslados";
  }
  if (e.target.matches('[data-f="es_alcohol"]')) {
    const per = e.target.closest(".it-row").querySelector('[data-f="personal"]');
    per.checked = e.target.checked || per.checked; per.disabled = e.target.checked;
  }
  const b = e.target.closest('input[type="checkbox"][data-a]');
  if (b) acciones[b.dataset.a]?.(b, e);
  const box = e.target.closest("[data-rev]"); if (box) actualizarSuma(box);
});
app.addEventListener("input", (e) => {
  if (e.target.matches("[data-filtro]")) {
    const t = e.target.value.toLowerCase().trim();
    e.target.closest(".lista, main").querySelectorAll(".fila-r").forEach((f) => (f.hidden = t && !f.dataset.texto.includes(t)));
  }
  const box = e.target.closest("[data-rev]"); if (box) actualizarSuma(box);
});
app.addEventListener("keydown", (e) => { if (e.key === "Escape") { $("#shell")?.classList.remove("abierto"); const d = $("#desplegable"); if (d) d.hidden = true; } });
app.addEventListener("submit", async (e) => {
  if (e.target.method === "dialog") return;   // los diálogos de confirmación se cierran solos
  e.preventDefault();
  const f = e.target, tipo = f.dataset.form;
  if (tipo === "nueva") hacer(async () => { const id = await rpc("crear_rendicion", { p_titulo: f.titulo.value }); location.hash = `#/r/${id}`; }, "Rendición creada");
  if (tipo === "comentar") hacer(() => rpc("comentar", { p_rend: S.rendId, p_texto: f.texto.value, p_gasto: null }), "Comentario agregado");
  if (tipo === "rev") guardarRev(f);
  if (tipo === "perfil") hacer(async () => { await rpc("actualizar_perfil", { p_nombre: f.nombre.value, p_foto: null }); await cargarPerfil(); pintarCuenta(); }, "Datos guardados");
  if (tipo === "clave" || tipo === "recuperar") {
    if (f.c1.value.length < 6) return toast("La contraseña tiene que tener al menos 6 caracteres.", true);
    if (f.c1.value !== f.c2.value) return toast("Las dos contraseñas no coinciden.", true);
    const { error } = await sb.auth.updateUser({ password: f.c1.value });
    if (error) return toast(error.message, true);
    f.reset(); S.recuperar = false; toast("Contraseña actualizada");
    if (tipo === "recuperar") { history.replaceState(null, "", "#/inicio"); render(); }
  }
});

const VISTAS = { inicio: vistaInicio, nueva: vistaNueva, rendiciones: vistaRendiciones, aprobar: vistaAprobar, equipo: vistaEquipo,
  revision: vistaRevision, reembolsar: vistaReembolsar, historial: vistaHistorial, totales: vistaTotales, calidad: vistaCalidad,
  perfil: vistaPerfil, r: vistaDetalle };

arrancar();
