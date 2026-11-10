// =====================================================================
// RENDÍ · la aplicación (después de iniciar sesión). No hace falta tocar este archivo.
// Todas las reglas las controla la base; acá solo se muestran y se piden.
// =====================================================================
import { sb, CFG, configurado, esc, icono, alternarTema } from "./sb.js";
import { activarIdioma, idiomaDe, idiomaActivo, t } from "./i18n.js";

// El link de "olvidé mi contraseña" llega con #...type=recovery: lo leemos antes de que Supabase limpie la dirección
const llegoPorRecuperacion = location.hash.includes("type=recovery");
const app = document.getElementById("app");
const S = { perfil: null, uid: null, email: "", fotos: {}, avatares: {}, revisiones: [], rends: [],
  recuperar: llegoPorRecuperacion, abiertos: new Set(["rendiciones", "equipo"]), detalle: null, totales: [],
  monedas: {}, equipo: 0, pendientesAlta: 0, exportar: null };

// ---------------------------------------------------------------- utilidades
const $ = (s, r = document) => r.querySelector(s);
const plata = (n) => n === null || n === undefined || n === "" ? "—"
  : "$U " + Number(n).toLocaleString("es-UY", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
// Montos en cualquier moneda: R$ 120 · AR$ 20.000 · CLP$ 25.000 · US$ 50
const SIMBOLO = { UYU: "$U", USD: "US$", BRL: "R$", ARS: "AR$", CLP: "CLP$" };
const dinero = (n, mon = "UYU") => n === null || n === undefined || n === "" ? "—" : mon === "UYU" || !mon ? plata(n)
  : (S.monedas[mon]?.simbolo || SIMBOLO[mon] || mon) + " " + Number(n).toLocaleString("es-UY", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
const tasa = (mon) => Number(S.monedas[mon]?.tasa_uyu || 1);
// Total de varios tickets: en su moneda si son todos iguales; si se mezclan, el equivalente en pesos uruguayos
function totalTickets(gs, campo = (g) => Number(g.total || 0)) {
  const mons = [...new Set(gs.map((g) => g.moneda || "UYU"))];
  if (mons.length <= 1) return dinero(gs.reduce((s, g) => s + campo(g), 0), mons[0] || "UYU");
  return "≈ " + plata(gs.reduce((s, g) => s + campo(g) * Number(g.tasa_uyu || tasa(g.moneda)), 0));
}
const fecha = (f) => f ? new Date(String(f).length === 10 ? f + "T12:00:00" : f).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" }) : "—";
const numero = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); if (!s) return null; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : null; };
const msg = (e) => (e?.message || String(e)).replace(/^DUPLICADO: /, "Duplicado: ");
const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const reembolsable = (items) => (items || []).filter((i) => i.reembolsable && !i.es_alcohol && !i.no_reconocido_por).reduce((s, i) => s + Number(i.importe), 0);
const mesActual = new Date().toISOString().slice(0, 7);
const CATEGORIAS = { comidas: "Comidas", traslados: "Traslados", alojamiento: "Alojamiento", otros: "Otros" };
const CAMPOS = { rut_emisor: "RUT", serie: "Serie", numero: "Número", fecha: "Fecha", comercio: "Comercio", neto: "Neto", iva: "IVA", total: "Total",
  nro_operacion: "N.º de operación", tipo_comprobante: "Tipo de comprobante" };
// Cada país tiene sus comprobantes: el formulario cambia según dónde trabaja la persona
const PAISES = {
  UY: { nombre: "Uruguay", moneda: "UYU", id: "RUT emisor", tipos: { cfe: "e-Ticket o e-Factura", pago: "Comprobante de pago (POS o Prex)" } },
  AR: { nombre: "Argentina", moneda: "ARS", id: "CUIT", tipos: { cfe: "Factura o ticket fiscal", pago: "Comprobante de pago (Prex, Mercado Pago, POS)" } },
  BR: { nombre: "Brasil", moneda: "BRL", id: "CNPJ", tipos: { cfe: "Nota fiscal", pix: "Comprovante Pix", pago: "Comprobante del POS" } },
  CL: { nombre: "Chile", moneda: "CLP", id: "RUT emisor", tipos: { cfe: "Boleta o factura", pago: "Comprobante de pago (POS)" } },
  US: { nombre: "Estados Unidos", moneda: "USD", id: "Tax ID", tipos: { cfe: "Receipt o invoice", pago: "Comprobante de tarjeta" } },
};
const paisDeMoneda = (m) => Object.keys(PAISES).find((k) => PAISES[k].moneda === m) || "UY";
const TIPOS = { cfe: "Comprobante fiscal", pago: "Comprobante de pago", pix: "Comprovante Pix" };
const MEDIOS = ["Mercado Pago", "OCA", "Handy", "Prex", "Getnet", "Transbank", "VISA", "Mastercard", "BROU", "Itaú", "Santander", "Scotiabank"];
const ROLES = { empleado: "Empleado/a", jefe: "Jefe", finanzas: "Finanzas", admin: "Administración" };
const REGLAS = { datos: "Datos incompletos", fecha: "Fecha", suma_lineas: "Suma de líneas", iva: "IVA", duplicado: "Posible duplicado",
  alcohol: "Alcohol", tope_categoria: "Tope por categoría", plazo: "Fuera de plazo", tope_mensual: "Tope mensual",
  ia_confianza: "Lectura dudosa", corregido: "Corregido a mano", sin_cfe: "Sin comprobante fiscal", duplicado_pix: "Pix repetido",
  duplicado_pago: "Pago repetido", motivo_obligatorio: "Motivo obligatorio" };

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
  activarIdioma(idiomaDe(S.perfil));
  if (!S.perfil) {
    app.innerHTML = `<div class="l-wrap" style="padding:60px 20px"><div class="card"><h1>Tu usuario no tiene perfil</h1>
      <p>Corré <b class="mono">04_demo_y_calidad.sql</b> en Supabase para crear los perfiles.</p>
      <div><button data-a="salir">Cerrar sesión</button></div></div></div>`;
    return;
  }
  if (S.perfil.estado_cuenta && S.perfil.estado_cuenta !== "activa") {
    const pend = S.perfil.estado_cuenta === "pendiente";
    app.innerHTML = `<div class="l-wrap" style="padding:60px 20px"><div class="card" style="max-width:560px;margin:auto">
      <h1>${pend ? "Tu cuenta está pendiente de aprobación" : "Tu solicitud no fue aprobada"}</h1>
      <p>${pend ? `Hola, ${esc(S.perfil.nombre)}. Ya recibimos tu registro con <b>${esc(S.email)}</b>. El administrador tiene que aprobarlo y asignarte tu rol y tu jefe. Cuando lo haga, entrá de nuevo.`
        : "El administrador no aprobó esta cuenta. Si creés que es un error, hablá con el área de Administración de tu empresa."}</p>
      <div><button data-a="salir">Cerrar sesión</button></div></div></div>`;
    return;
  }
  const [mons, equipo] = await Promise.all([
    q(sb.from("monedas").select("*").order("orden")).catch(() => []),
    q(sb.from("perfiles").select("id").eq("jefe_id", S.uid)).catch(() => []),
  ]);
  S.monedas = Object.fromEntries((mons || []).map((m) => [m.codigo, m]));
  S.equipo = (equipo || []).length;
  montarShell();
  if (!location.hash.startsWith("#/")) location.replace("#/inicio");
  render();
}
async function cargarPerfil() { S.perfil = await q(sb.from("perfiles").select("*").eq("id", S.uid).maybeSingle()); }
const esAdmin = () => S.perfil.rol === "admin";
const esFinanzas = () => ["finanzas", "admin"].includes(S.perfil.rol);

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
  const p = S.perfil, rol = ROLES[p.rol] || p.rol;
  $("#btn-cuenta").innerHTML = `${avatar(p.nombre, p.foto_path)}<span class="solo-compu small"><b>${esc(p.nombre.split(" ")[0])}</b></span>${icono("down")}`;
  $("#desplegable").innerHTML = `
    <div class="quien"><b>${esc(p.nombre)}</b><div class="xs muted">${esc(rol)} · ${esc(S.email)}</div></div>
    <a href="#/perfil" data-a="cerrar-cuenta">${icono("user")} Mi perfil</a>
    <a href="#/perfil" data-a="cerrar-cuenta">${icono("key")} Cambiar contraseña</a>
    <button data-a="salir">${icono("logout")} Cerrar sesión</button>`;
  hidratarFotos($("#btn-cuenta"));
}

function menu() {
  const mias = S.rends.filter((x) => x.empleado_id === S.uid), otras = S.rends.filter((x) => x.empleado_id !== S.uid);
  const delEquipo = otras.filter((x) => x.perfiles?.jefe_id === S.uid);
  const sub = (base, lista, sin = []) => Object.keys(GRUPOS).filter((k) => !sin.includes(k)).map((k) => ({ ruta: `${base}/${k}`, txt: GRUPO_TXT[k], n: lista.filter((x) => enGrupo(x, k)).length }));
  const items = [{ ruta: "inicio", txt: "Inicio", ico: "home" }];
  // Quien tiene equipo ve primero lo que tiene que aprobar
  const aprobar = S.equipo || delEquipo.length ? [{ grupo: "Aprobar" },
    { ruta: "aprobar", txt: "Por aprobar", ico: "inbox", n: delEquipo.filter((x) => x.estado === "pendiente_jefe").length, alerta: true },
    { ruta: "equipo", txt: "Mi equipo", ico: "users", sub: sub("equipo", delEquipo, ["borrador"]) }] : [];
  const finanzas = esFinanzas() ? [{ grupo: "Finanzas" },
    { ruta: "revision", txt: "Revisión Finanzas", ico: "inbox", n: otras.filter((x) => x.estado === "revision_finanzas").length, alerta: true },
    { ruta: "reembolsar", txt: "A reembolsar", ico: "wallet", n: otras.filter((x) => ["aprobada", "aprobada_parcial"].includes(x.estado)).length, alerta: true },
    { ruta: "historial", txt: "Historial", ico: "history" },
    { ruta: "totales", txt: "Totales", ico: "chart" }] : [];
  const admin = esAdmin() ? [{ grupo: "Administración" },
    { ruta: "usuarios", txt: "Usuarios", ico: "users", n: S.pendientesAlta, alerta: true },
    { ruta: "todas", txt: "Todas las rendiciones", ico: "receipt" },
    { ruta: "config", txt: "Monedas y topes", ico: "settings" }] : S.perfil.rol === "finanzas" ? [{ ruta: "config", txt: "Monedas y topes", ico: "settings" }] : [];
  // Todos los que tienen cuenta activa pueden rendir sus propios gastos
  const mios = [{ grupo: "Mis gastos" }, { ruta: "nueva", txt: "Nueva rendición", ico: "plus" },
    { ruta: "rendiciones", txt: "Mis rendiciones", ico: "receipt", sub: sub("rendiciones", mias) }];
  const orden = S.perfil.rol === "empleado" ? [...mios, ...aprobar] : [...aprobar, ...finanzas, ...admin, ...mios];
  if (S.perfil.rol === "empleado") orden.push(...finanzas, ...admin);
  return [...items, ...orden, { grupo: "Calidad" }, { ruta: "calidad", txt: "Control de calidad", ico: "shield" }];
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
  const rapidos = items.filter((i) => i.ruta).slice(0, 3);   // en el celular, los 3 primeros accesos
  $("#abajo").innerHTML = rapidos.map((i) => `<a href="#/${i.sub ? i.ruta + "/todas" : i.ruta}" ${base === i.ruta ? 'aria-current="page"' : ""}>${icono(i.ico)}<span>${esc(i.txt.replace("Mi equipo", "Equipo").replace("Mis rendiciones", "Rendiciones").replace("Nueva rendición", "Nueva").replace("Revisión Finanzas", "Revisión"))}</span></a>`).join("")
    + `<button data-a="abrir-menu">${icono("menu")}<span>Más</span></button>`;
}

const TITULOS = { inicio: "Inicio", nueva: "Nueva rendición", rendiciones: "Mis rendiciones", aprobar: "Por aprobar",
  equipo: "Rendiciones del equipo", revision: "Revisión Finanzas", reembolsar: "A reembolsar", historial: "Historial",
  totales: "Totales", calidad: "Control de calidad", perfil: "Mi perfil", r: "Rendición", usuarios: "Usuarios",
  todas: "Todas las rendiciones", config: "Monedas y topes" };

async function cargarRends() {
  S.rends = await q(sb.from("rendiciones")
    .select("id,titulo,estado,creada,enviada,total_aprobado,empleado_id,es_prueba,pago_fecha,pago_confirmado,perfiles!empleado_id(nombre,foto_path,jefe_id),gastos(id,total,estado,foto_path,moneda,tasa_uyu)")
    .order("creada", { ascending: false }));
  if (esAdmin()) S.pendientesAlta = (await q(sb.from("perfiles").select("id").eq("estado_cuenta", "pendiente")).catch(() => [])).length;
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
    const soloAdmin = ["usuarios", "todas"].includes(base) && !esAdmin(), soloFin = ["revision", "reembolsar", "historial", "totales", "config"].includes(base) && !esFinanzas();
    const vista = S.recuperar ? vistaRecuperar : soloAdmin || soloFin ? vistaInicio : (VISTAS[base] || vistaInicio);
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
  const gs = r.gastos || [], n = gs.length;
  const fotos = gs.filter((g) => g.foto_path);
  const extranjera = gs.some((g) => g.moneda && g.moneda !== "UYU");
  const texto = `${r.titulo} ${r.perfiles?.nombre || ""} ${EST_R[r.estado]?.[0] || ""}`.toLowerCase();
  const pagado = r.estado === "reembolsada" && r.pago_fecha ? ` · pagado ${fecha(r.pago_fecha)}${r.pago_confirmado ? " · recibido ✓" : ""}` : "";
  const fila = `<a class="fila-r" href="#/r/${r.id}" data-texto="${esc(texto)}">
    <span class="mini">${fotos.length ? `<img data-foto="${esc(fotos[0].foto_path)}" alt="">${fotos.length > 1 ? `<span class="mas">+${fotos.length - 1}</span>` : ""}` : icono("receipt")}</span>
    <span><b>${esc(r.titulo)}</b><span class="meta">${mostrarQuien && r.empleado_id !== S.uid ? esc(r.perfiles?.nombre) + " · " : ""}${n} ticket${n === 1 ? "" : "s"} · ${totalTickets(gs)}${r.total_aprobado != null ? ` · a reembolsar ${extranjera ? "≈ " : ""}${plata(r.total_aprobado)}` : ""} · ${fecha(r.enviada || r.creada)}${pagado}</span></span>
    <span class="lado">${pill(EST_R, r.estado)}${icono("chevron")}</span>
  </a>`;
  if (!borrable(r)) return `<div class="fila-wrap">${fila}</div>`;
  // Borrador propio: se puede eliminar deslizando (celular), con el tachito (compu) o seleccionando varios
  return `<div class="fila-wrap borrable" data-rend="${r.id}" data-texto="${esc(texto)}">
    <label class="sel" title="Seleccionar"><input type="checkbox" data-sel="${r.id}" aria-label="Seleccionar ${esc(r.titulo)}"></label>
    <button type="button" class="borrar-atras" data-a="borrar-rend" data-id="${r.id}" data-titulo="${esc(r.titulo)}" tabindex="-1">${icono("trash")}<span>Eliminar</span></button>
    <button type="button" class="borrar-hover" data-a="borrar-rend" data-id="${r.id}" data-titulo="${esc(r.titulo)}" aria-label="Eliminar ${esc(r.titulo)}" title="Eliminar borrador">${icono("trash")}</button>
    ${fila}</div>`;
}
const borrable = (r) => r.empleado_id === S.uid && r.estado === "borrador" && !r.es_prueba;
function listaRends(rs, vacio, { mostrarQuien = true, buscar = true, accion = "", seleccionable = false } = {}) {
  if (!rs.length) return `<div class="vacio">${icono("receipt")}<p>${esc(vacio)}</p>${accion}</div>`;
  const nBorr = rs.filter(borrable).length;
  const barra = seleccionable && nBorr ? `<div class="barra-sel">
      <button type="button" class="btn sel-off" data-a="modo-sel">${icono("check")} Seleccionar borradores</button>
      <label class="sel-on"><input type="checkbox" data-sel-todo> Seleccionar todo <span class="muted">(${nBorr})</span></label>
      <span class="sel-on muted small" data-sel-cuenta>0 seleccionados</span>
      <span class="sel-on fila"><button type="button" class="btn-mal" data-a="borrar-sel" disabled>${icono("trash")} Eliminar</button>
        <button type="button" class="btn" data-a="cancelar-sel">Cancelar</button></span>
    </div>` : "";
  return `${buscar && rs.length > 3 ? `<div class="buscar">${icono("search")}<input type="search" data-filtro placeholder="Buscar por nombre, persona o estado" aria-label="Buscar rendiciones"></div>` : ""}
    ${barra}<div class="filas">${rs.map((r) => filaRend(r, mostrarQuien)).join("")}</div>
    ${nBorr ? `<p class="xs muted pista-desliza">Deslizá un borrador hacia la izquierda para eliminarlo.</p>` : ""}`;
}
function chipsGrupo(base, lista, actual, sin = []) {
  return `<div class="chips" role="tablist" aria-label="Filtrar por estado">${Object.keys(GRUPOS).filter((k) => !sin.includes(k)).map((k) => {
    const n = lista.filter((x) => enGrupo(x, k)).length;
    return `<a class="chip btn" role="tab" href="#/${base}/${k}" aria-pressed="${k === actual}" aria-selected="${k === actual}">${esc(GRUPO_TXT[k])} <span class="muted">${n}</span></a>`;
  }).join("")}</div>`;
}
// Descargar lo que se está viendo: Excel, CSV o PDF. Cada persona descarga solo lo que puede ver.
function botonDescargar(titulo, rs) {
  S.exportar = { titulo, ids: rs.map((r) => r.id) };
  if (!rs.length) return "";
  return `<details class="descargar"><summary class="btn">${icono("download")} Descargar</summary><div class="menu-desc" role="menu">
    <button type="button" data-a="exportar" data-f="xlsx" role="menuitem">Excel (.xlsx)</button>
    <button type="button" data-a="exportar" data-f="pdf" role="menuitem">PDF</button>
    <button type="button" data-a="exportar" data-f="csv" role="menuitem">CSV</button></div></details>`;
}
const cabecera = (izq, rs, titulo) => `<div class="fila entre cabecera">${izq}${botonDescargar(titulo, rs)}</div>`;

const misRends = () => S.rends.filter((r) => r.empleado_id === S.uid);
const delEquipo = () => S.rends.filter((r) => r.empleado_id !== S.uid && r.perfiles?.jefe_id === S.uid);
const deOtros = () => S.rends.filter((r) => r.empleado_id !== S.uid);

async function vistaRendiciones(g = "todas") {
  const mias = misRends();
  const grupo = GRUPOS[g] !== undefined ? g : "todas";
  const lista = mias.filter((r) => enGrupo(r, grupo));
  return `<div class="lista">${cabecera(chipsGrupo("rendiciones", mias, grupo), lista, "Mis rendiciones · " + GRUPO_TXT[grupo])}
    ${listaRends(lista, grupo === "todas" ? "Todavía no tenés rendiciones." : `No tenés rendiciones ${GRUPO_TXT[grupo].toLowerCase()}.`,
      { mostrarQuien: false, seleccionable: true, accion: `<a class="btn-p" href="#/nueva">${icono("plus")} Nueva rendición</a>` })}</div>`;
}
// El jefe ve lo que su equipo ya le envió: los borradores son privados de cada persona hasta que los envía
async function vistaEquipo(g = "todas") {
  const otras = delEquipo();
  const grupo = GRUPOS[g] !== undefined && g !== "borrador" ? g : "todas";
  const lista = otras.filter((r) => enGrupo(r, grupo));
  return `<div class="lista">${cabecera(chipsGrupo("equipo", otras, grupo, ["borrador"]), lista, "Mi equipo · " + GRUPO_TXT[grupo])}
    <p class="xs muted">Ves lo que tu equipo ya envió. Los borradores son privados hasta que cada persona los envía.</p>
    ${listaRends(lista, "No hay rendiciones en este estado.")}</div>`;
}
async function vistaTodas(g = "todas") {
  const todas = deOtros().concat(misRends());
  const grupo = GRUPOS[g] !== undefined ? g : "todas";
  const lista = todas.filter((r) => enGrupo(r, grupo)).sort((a, b) => String(b.creada).localeCompare(String(a.creada)));
  return `<div class="lista">${cabecera(chipsGrupo("todas", todas, grupo), lista, "Todas las rendiciones · " + GRUPO_TXT[grupo])}
    <p class="xs muted">Como administración ves las rendiciones de todas las personas, en cualquier estado.</p>
    ${listaRends(lista, "No hay rendiciones en este estado.")}</div>`;
}
async function vistaAprobar() {
  const rs = delEquipo().filter((r) => r.estado === "pendiente_jefe");
  return `<div class="lista"><p class="muted">Rendiciones de tu equipo que esperan tu decisión. Revisá cada ticket contra su foto antes de aprobar.</p>
    ${listaRends(rs, "No tenés nada pendiente. ¡Al día!")}</div>`;
}
async function vistaRevision() {
  const rs = deOtros().filter((r) => r.estado === "revision_finanzas");
  return `<div class="lista"><p class="muted">Necesitan tu visto bueno antes de pagarse: lo que el jefe aprobó por más de ${plata(3000)}, y lo que rinden personas sin jefe (por ejemplo, Dirección).</p>
    ${listaRends(rs, "No hay rendiciones esperando a Finanzas.")}</div>`;
}
async function vistaReembolsar() {
  const rs = deOtros().filter((r) => ["aprobada", "aprobada_parcial"].includes(r.estado));
  return `<div class="lista">${cabecera(`<p class="muted" style="max-width:72ch">Todo lo aprobado, <b>de cualquier monto</b>: lo de hasta ${plata(3000)} llega acá apenas lo aprueba el jefe; lo de más, después de tu visto bueno. Al pagar, registrá la fecha, el medio y el n.º de comprobante de la transferencia.</p>`, rs, "A reembolsar")}
    ${listaRends(rs, "No hay reembolsos pendientes.")}</div>`;
}
async function vistaHistorial() {
  const rs = deOtros().filter((r) => ["reembolsada", "rechazada"].includes(r.estado));
  return `<div class="lista">${cabecera(`<p class="muted">Pagadas y rechazadas. En cada pagada figura cuándo se pagó y si la persona confirmó que lo recibió.</p>`, rs, "Historial")}
    ${listaRends(rs, "Todavía no hay reembolsos.")}</div>`;
}

// ---------------------------------------------------------------- inicio por rol
const kpi = (v, k, href, atencion = false) => `<a class="kpi ${atencion ? "atencion" : ""}" href="${href}"><span class="v">${v}</span><span class="k">${esc(k)}</span></a>`;
const sumaAprobado = (rs) => rs.reduce((s, r) => s + Number(r.total_aprobado || 0), 0);
async function vistaInicio() {
  const p = S.perfil, nombre = esc(p.nombre.split(" ")[0]);
  const mias = misRends(), borr = mias.filter((r) => r.estado === "borrador").length;
  const misGastos = `<p class="small muted">Tus propios gastos: ${mias.length} rendición${mias.length === 1 ? "" : "es"}${borr ? `, ${borr} en borrador` : ""} · <a href="#/nueva">Nueva rendición</a> · <a href="#/rendiciones/todas">Ver las mías</a></p>`;
  if (esAdmin()) {
    const otras = deOtros(), curso = otras.filter((r) => ["pendiente_jefe", "revision_finanzas"].includes(r.estado));
    const pagar = otras.filter((r) => ["aprobada", "aprobada_parcial"].includes(r.estado));
    const mes = otras.filter((r) => r.estado === "reembolsada" && String(r.pago_fecha || "").slice(0, 7) === mesActual);
    const equipo = delEquipo().filter((r) => r.estado === "pendiente_jefe");
    return `<div class="lista"><div><h2>Hola, ${nombre}</h2><p class="muted">Ves todo: ${S.pendientesAlta ? `<b>${S.pendientesAlta} registro${S.pendientesAlta === 1 ? "" : "s"} esperan tu aprobación</b>` : "no hay registros pendientes"}${equipo.length ? ` · ${equipo.length} rendición${equipo.length === 1 ? "" : "es"} de tu equipo para aprobar` : ""}.</p>${misGastos}</div>
      <div class="kpis">${kpi(S.pendientesAlta, "Registros por aprobar", "#/usuarios", S.pendientesAlta > 0)}${kpi(curso.length, "Rendiciones en curso", "#/todas/pendiente")}
        ${kpi(plata(sumaAprobado(pagar)), "Aprobado sin pagar", "#/reembolsar")}${kpi(plata(sumaAprobado(mes)), "Pagado este mes", "#/historial")}</div>
      ${equipo.length ? `<div class="fila entre"><h2>Tu equipo espera tu aprobación</h2><a class="btn-link" href="#/aprobar">Ver todas ›</a></div>${listaRends(equipo.slice(0, 3), "", { buscar: false })}` : ""}
      <div class="fila entre"><h2>Últimas rendiciones de la empresa</h2><a class="btn-link" href="#/todas/todas">Ver todas ›</a></div>
      ${listaRends(otras.slice(0, 5), "Todavía no hay rendiciones.", { buscar: false })}</div>`;
  }
  if (p.rol === "finanzas") {
    const otras = deOtros(), rev = otras.filter((r) => r.estado === "revision_finanzas"), pagar = otras.filter((r) => ["aprobada", "aprobada_parcial"].includes(r.estado));
    const pagadoMes = otras.filter((r) => r.estado === "reembolsada" && String(r.pago_fecha || "").slice(0, 7) === mesActual);
    const sinConfirmar = otras.filter((r) => r.estado === "reembolsada" && !r.pago_confirmado).length;
    return `<div class="lista"><div><h2>Hola, ${nombre}</h2><p class="muted">${rev.length} para firmar · ${pagar.length} para pagar${sinConfirmar ? ` · ${sinConfirmar} pagada${sinConfirmar === 1 ? "" : "s"} sin confirmar por la persona` : ""}.</p>${misGastos}</div>
      <div class="kpis">${kpi(rev.length, "Para firmar (más de $U 3.000)", "#/revision", rev.length > 0)}${kpi(pagar.length, "Para pagar (cualquier monto)", "#/reembolsar", pagar.length > 0)}
        ${kpi(plata(sumaAprobado(pagar)), "Monto a reembolsar", "#/reembolsar")}${kpi(plata(sumaAprobado(pagadoMes)), "Pagado este mes", "#/historial")}</div>
      <div class="grid2"><div class="lista"><div class="fila entre"><h2>Para firmar</h2><a class="btn-link" href="#/revision">Ver todas ›</a></div>${listaRends(rev.slice(0, 4), "Nada para firmar.", { buscar: false })}</div>
        <div class="lista"><div class="fila entre"><h2>Para pagar</h2><a class="btn-link" href="#/reembolsar">Ver todas ›</a></div>${listaRends(pagar.slice(0, 4), "Nada para pagar.", { buscar: false })}</div></div></div>`;
  }
  if (S.equipo || delEquipo().length) {
    const otras = delEquipo(), pend = otras.filter((r) => r.estado === "pendiente_jefe");
    const monto = pend.reduce((s, r) => s + (r.gastos || []).filter((g) => g.estado === "pendiente").reduce((a, g) => a + Number(g.total || 0) * Number(g.tasa_uyu || 1), 0), 0);
    return `<div class="lista"><div><h2>Hola, ${nombre}</h2><p class="muted">${pend.length ? `Tenés ${pend.length} rendición${pend.length === 1 ? "" : "es"} esperando tu aprobación.` : "No tenés nada pendiente de aprobar."}</p>${misGastos}</div>
      <div class="kpis">${kpi(pend.length, "Por aprobar", "#/aprobar", pend.length > 0)}${kpi(plata(monto), "Monto por aprobar", "#/aprobar")}
        ${kpi(otras.filter((r) => r.estado === "revision_finanzas").length, "En Finanzas", "#/equipo/pendiente")}
        ${kpi(otras.filter((r) => ["aprobada", "aprobada_parcial", "reembolsada"].includes(r.estado)).length, "Aprobadas", "#/equipo/aprobada")}</div>
      <div class="fila entre"><h2>Esperan tu aprobación</h2><a class="btn-link" href="#/aprobar">Ver todas ›</a></div>
      ${listaRends(pend.slice(0, 5), "No hay nada esperando.", { buscar: false })}</div>`;
  }
  const cant = (g) => mias.filter((r) => enGrupo(r, g)).length;
  const reemb = sumaAprobado(mias.filter((r) => r.estado === "reembolsada"));
  const porConfirmar = mias.filter((r) => r.estado === "reembolsada" && !r.pago_confirmado).length;
  const devueltas = cant("devuelta");
  const aviso = devueltas ? `Tu jefe te devolvió ${devueltas} rendición${devueltas === 1 ? "" : "es"} para corregir.`
    : porConfirmar ? `Finanzas te pagó ${porConfirmar} rendición${porConfirmar === 1 ? "" : "es"}: confirmá que lo recibiste.`
    : borr ? `Tenés ${borr} borrador${borr === 1 ? "" : "es"} sin enviar.` : "Todo al día.";
  const pais = PAISES[p.pais] && p.pais !== "UY" ? ` · Rendís en ${esc(PAISES[p.pais].nombre)} (${esc(p.moneda)})` : "";
  return `<div class="lista"><div class="fila entre"><div><h2>Hola, ${nombre}</h2><p class="muted">${aviso}${pais}</p></div><a class="btn-p" href="#/nueva">${icono("plus")} Nueva rendición</a></div>
    <div class="kpis">${kpi(borr, "Borradores", "#/rendiciones/borrador")}${kpi(cant("pendiente"), "Pendientes", "#/rendiciones/pendiente")}
      ${kpi(devueltas, "Devueltas", "#/rendiciones/devuelta", devueltas > 0)}${kpi(plata(reemb), "Te reembolsaron", "#/rendiciones/reembolsada", porConfirmar > 0)}</div>
    <div class="fila entre"><h2>Últimas rendiciones</h2><a class="btn-link" href="#/rendiciones/todas">Ver todas ›</a></div>
    ${listaRends(mias.slice(0, 5), "Todavía no tenés rendiciones.", { mostrarQuien: false, buscar: false, accion: `<a class="btn-p" href="#/nueva">${icono("plus")} Crear la primera</a>` })}</div>`;
}

async function vistaNueva() {
  const destino = S.perfil.jefe_id ? "tu jefe" : "Finanzas (no tenés jefe asignado)";
  return `<form class="card" data-form="nueva" style="max-width:640px">
    <h2>¿Qué vas a rendir?</h2>
    <p class="muted small">Agrupá en una rendición los tickets de un viaje o de una actividad. En el paso siguiente les sacás foto. Cuando la envíes, va a ${destino}.</p>
    <label>Nombre de la rendición<input name="titulo" placeholder="Ej.: Viaje a Salto · visita a cliente" required maxlength="120"></label>
    <div class="fila"><button class="btn-p btn-grande">Crear y agregar tickets</button></div>
  </form>`;
}

// ---------------------------------------------------------------- perfil y contraseña
async function vistaPerfil() {
  const p = S.perfil, rol = ROLES[p.rol] || p.rol;
  return `<div class="grid2" style="align-items:start">
    <form class="card" data-form="perfil">
      <h2>Mis datos</h2>
      <div class="fila">${avatar(p.nombre, p.foto_path, "xl")}
        <label class="btn" style="display:inline-flex;cursor:pointer">${icono("camera")} Cambiar foto<input type="file" id="foto-perfil" accept="image/*" hidden></label></div>
      <label>Nombre<input name="nombre" value="${esc(p.nombre)}" required></label>
      <label>Email<input value="${esc(S.email)}" disabled></label>
      <label>Rol<input value="${esc(rol)} · ${esc(p.area || "")}" disabled></label>
      <label>País y moneda<input value="${esc(PAISES[p.pais]?.nombre || p.pais || "Uruguay")} · ${esc(p.moneda || "UYU")}" disabled></label>
      <p class="xs muted">El rol, el jefe y el país los asigna el administrador.</p>
      <label>Idioma<select id="idioma" data-sin-traducir><option value="es" ${idiomaActivo() === "es" ? "selected" : ""}>Español</option><option value="pt" ${idiomaActivo() === "pt" ? "selected" : ""}>Português</option></select></label>
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

// ---------------------------------------------------------------- totales (Finanzas y administración)
async function vistaTotales() {
  const gs = await q(sb.from("gastos")
    .select("id,fecha,categoria,estado,comercio,moneda,tasa_uyu,perfiles(nombre),gasto_items(importe,reembolsable,es_alcohol,no_reconocido_por),rendiciones(id,titulo,estado)"));
  const filas = gs.filter((g) => ["aprobado", "aprobado_parcial"].includes(g.estado) && ["aprobada", "aprobada_parcial", "reembolsada"].includes(g.rendiciones?.estado))
    .map((g) => ({ persona: g.perfiles?.nombre || "—", categoria: CATEGORIAS[g.categoria] || g.categoria, mes: String(g.fecha || "").slice(0, 7) || "sin fecha",
      moneda: g.moneda || "UYU", monto: reembolsable(g.gasto_items) * Number(g.tasa_uyu || 1), pagado: g.rendiciones.estado === "reembolsada", rend: g.rendiciones.id }));
  const suma = (a) => a.reduce((s, f) => s + f.monto, 0);
  const agrupar = (k) => Object.entries(filas.reduce((a, f) => ((a[f[k]] = (a[f[k]] || 0) + f.monto), a), {})).sort((a, b) => b[1] - a[1]);
  const tabla = (t, fs) => `<div class="card"><h3>${t}</h3><div class="tabla-wrap"><table class="t"><tbody>
    ${fs.length ? fs.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r num">${plata(v)}</td></tr>`).join("") : `<tr><td class="muted">Sin datos</td></tr>`}</tbody></table></div></div>`;
  const rs = [...new Set(filas.map((f) => f.rend))].map((id) => ({ id }));
  return `<div class="lista">${cabecera(`<p class="muted">Lo aprobado, sin lo personal ni lo que el jefe no reconoció. Todo en pesos uruguayos (lo de otras monedas, con la tasa del día en que se cargó).</p>`, rs, "Totales aprobados")}
    <div class="kpis"><div class="kpi"><span class="v">${plata(suma(filas))}</span><span class="k">Aprobado en total</span></div>
      <div class="kpi"><span class="v">${plata(suma(filas.filter((f) => f.pagado)))}</span><span class="k">Ya reembolsado</span></div>
      <div class="kpi"><span class="v">${plata(suma(filas.filter((f) => !f.pagado)))}</span><span class="k">Pendiente de reembolso</span></div></div>
    <div class="grid2">${tabla("Por persona", agrupar("persona"))}${tabla("Por categoría", agrupar("categoria"))}${tabla("Por mes", agrupar("mes"))}${tabla("Por moneda original", agrupar("moneda"))}</div></div>`;
}

// ---------------------------------------------------------------- descargas: CSV, Excel y PDF
const LIB = { xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm", jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm",
  autotable: "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm" };
async function filasParaDescargar(ids) {
  const gs = [];
  for (let i = 0; i < ids.length; i += 80) {
    gs.push(...await q(sb.from("gastos").select("id,fecha,comercio,categoria,estado,tipo_comprobante,medio_pago,nro_operacion,rut_emisor,serie,numero,total,moneda,tasa_uyu,perfiles(nombre),gasto_items(importe,reembolsable,es_alcohol,no_reconocido_por),rendiciones(titulo,estado,pago_fecha)")
      .in("rendicion_id", ids.slice(i, i + 80)).order("fecha")));
  }
  return gs.map((g) => {
    const reemb = reembolsable(g.gasto_items);
    return { "Fecha": g.fecha || "", "Persona": g.perfiles?.nombre || "", "Rendición": g.rendiciones?.titulo || "",
      "Estado rendición": EST_R[g.rendiciones?.estado]?.[0] || "", "Comercio": g.comercio || "",
      "Comprobante": g.tipo_comprobante === "pix" ? "Pix" : g.tipo_comprobante === "pago" ? `Pago ${g.medio_pago || ""}`.trim() : "Fiscal",
      "N.º": g.tipo_comprobante === "cfe" ? `${g.serie || ""} ${g.numero || ""}`.trim() : g.nro_operacion || "",
      "Categoría": CATEGORIAS[g.categoria] || g.categoria, "Moneda": g.moneda || "UYU", "Total": Number(g.total || 0),
      "Se reembolsa": reemb, "Equivale en $U": Math.round(reemb * Number(g.tasa_uyu || 1) * 100) / 100,
      "Estado ticket": EST_G[g.estado]?.[0] || g.estado, "Pagado el": g.rendiciones?.pago_fecha || "" };
  });
}
async function exportar(formato) {
  const x = S.exportar; if (!x?.ids?.length) return toast("No hay nada para descargar.", true);
  toast("Preparando la descarga…");
  const filasEs = await filasParaDescargar(x.ids);
  if (!filasEs.length) return toast("Esas rendiciones no tienen tickets.", true);
  // Columnas y estados en el idioma de quien descarga (los datos cargados quedan como están)
  const TRADUCIBLES = ["Estado rendición", "Comprobante", "Categoría", "Estado ticket"];
  const filas = filasEs.map((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [t(k), TRADUCIBLES.includes(k) ? t(v) : v])));
  const K = { mon: t("Moneda"), eq: t("Equivale en $U"), re: t("Se reembolsa"), tot: t("Total") };
  const local = idiomaActivo() === "pt" ? "pt-BR" : "es-UY";
  const nombre = "rendi-" + x.titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cols = Object.keys(filas[0]);
  const bajar = (blob, ext) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${nombre}.${ext}`; a.click(); };
  const totalU = filas.reduce((s, f) => s + f[K.eq], 0);
  if (formato === "csv") {
    const csv = [cols].concat(filas.map((f) => cols.map((c) => f[c]))).map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    return bajar(new Blob(["﻿" + csv], { type: "text/csv" }), "csv");
  }
  if (formato === "xlsx") {
    const m = await import(LIB.xlsx), X = m.utils ? m : m.default;
    const hoja = X.utils.json_to_sheet(filas);
    X.utils.sheet_add_aoa(hoja, [[], ["", "", "", "", "", "", "", "", "", "", t("Total en $U"), totalU]], { origin: -1 });
    hoja["!cols"] = cols.map((c) => ({ wch: Math.max(10, c.length + 2, ...filas.map((f) => String(f[c]).length + 1).slice(0, 200)) }));
    const libro = X.utils.book_new(); X.utils.book_append_sheet(libro, hoja, t("Gastos"));
    return X.writeFile(libro, `${nombre}.xlsx`);
  }
  let jsPDF, autoTable;
  try {
    const [p, at] = await Promise.all([import(LIB.jspdf), import(LIB.autotable)]);
    jsPDF = p.jsPDF || p.default?.jsPDF || p.default; autoTable = at.default || at.autoTable;
  } catch {
    // Si no carga la librería (sin conexión al CDN), se abre una versión para imprimir y "Guardar como PDF"
    const w = open("", "_blank");
    if (!w) return toast("Permití las ventanas emergentes para descargar el PDF.", true);
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(x.titulo)}</title><style>body{font:12px Arial;margin:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px;text-align:left}th{background:#e2f2ec}</style>
      <h2>Rendí · ${esc(t(x.titulo))}</h2><p>${t("Descargado por")} ${esc(S.perfil.nombre)} · ${new Date().toLocaleString(local)}</p>
      <table><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${filas.map((f) => `<tr>${cols.map((c) => `<td>${esc(f[c])}</td>`).join("")}</tr>`).join("")}</table>
      <p><b>${t("Total en $U")}: ${plata(totalU)}</b></p>`);
    w.document.close(); w.focus(); w.print(); return;
  }
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(15); doc.text(`Rendí · ${t(x.titulo)}`, 36, 40);
  doc.setFontSize(9); doc.setTextColor(110); doc.text(`${t("Descargado por")} ${S.perfil.nombre} · ${new Date().toLocaleString(local)} · ${t(`${filas.length} tickets`)}`, 36, 56);
  const porMoneda = Object.entries(filas.reduce((a, f) => ((a[f[K.mon]] = (a[f[K.mon]] || 0) + f[K.re]), a), {}))
    .map(([m, v]) => dinero(v, m)).join(" · ");
  const pdfCols = ["Fecha", "Persona", "Rendición", "Comercio", "Comprobante", "Categoría", "Total", "Se reembolsa", "Equivale en $U", "Estado ticket"].map(t);
  autoTable(doc, { startY: 70, head: [pdfCols], styles: { fontSize: 7.5, cellPadding: 3 }, headStyles: { fillColor: [11, 122, 94] },
    body: filas.map((f) => pdfCols.map((c) => [K.tot, K.re].includes(c) ? dinero(f[c], f[K.mon]) : c === K.eq ? plata(f[c]) : String(f[c]))),
    foot: [["", "", "", "", "", "", "", porMoneda, plata(totalU), ""]], footStyles: { fillColor: [226, 242, 236], textColor: 20 } });
  doc.save(`${nombre}.pdf`);
}

// ---------------------------------------------------------------- administración: usuarios
async function vistaUsuarios() {
  const us = await rpc("admin_usuarios");
  const activos = us.filter((u) => u.estado_cuenta === "activa");
  const sel = (nombre, opciones, actual) => `<select name="${nombre}">${opciones.map(([v, t]) => `<option value="${esc(v)}" ${String(actual ?? "") === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  const tarjeta = (u) => `<form class="card usuario ${u.estado_cuenta}" data-form="usuario" data-id="${u.id}">
    <div class="fila entre"><div><h3>${esc(u.nombre)}</h3><p class="xs muted">${esc(u.email)} · registrado ${fecha(u.creado)}${u.ultimo_ingreso ? " · último ingreso " + fecha(u.ultimo_ingreso) : ""}</p></div>
      ${u.estado_cuenta === "pendiente" ? `<span class="pill e-pend">Pendiente</span>` : u.estado_cuenta === "rechazada" ? `<span class="pill e-mal">Rechazada</span>` : `<span class="pill e-ok">Activa</span>`}</div>
    ${u.estado_cuenta === "pendiente" && /@(gmail|hotmail|outlook|live|yahoo|icloud)\./i.test(u.email) ? `<p class="alerta warn"><span class="nivel">Ojo</span><span>Se registró con un correo personal, no corporativo.</span></p>` : ""}
    <div class="campos">
      <label>Rol${sel("rol", Object.entries(ROLES), u.rol)}</label>
      <label>Jefe${sel("jefe", [["", "Sin jefe (va directo a Finanzas)"], ...activos.filter((a) => a.id !== u.id).map((a) => [a.id, `${a.nombre} · ${ROLES[a.rol] || a.rol}`])], u.jefe_id)}</label>
      <label>País${sel("pais", Object.entries(PAISES).map(([k, v]) => [k, `${v.nombre} (${v.moneda})`]), u.pais)}</label>
      <label>Área<input name="area" value="${esc(u.area || "")}"></label>
      <label>Estado${sel("estado", [["activa", "Activa"], ["pendiente", "Pendiente"], ["rechazada", "Rechazada"]], u.estado_cuenta)}</label>
    </div>
    <div class="fila">${u.estado_cuenta === "pendiente" ? `<button class="btn-p" name="accion" value="aprobar">Aprobar con estos datos</button><button class="btn-mal" name="accion" value="rechazar">Rechazar</button>`
      : `<button class="btn-p" name="accion" value="guardar">Guardar cambios</button>`}</div></form>`;
  const pend = us.filter((u) => u.estado_cuenta === "pendiente");
  return `<div class="lista"><p class="muted">Quien se registra queda pendiente hasta que lo apruebes. Al aprobarlo elegís su rol, su jefe y su país (define la moneda y los comprobantes que puede cargar).</p>
    ${pend.length ? `<h2>Solicitudes pendientes (${pend.length})</h2>${pend.map(tarjeta).join("")}` : `<div class="vacio"><p>No hay solicitudes pendientes.</p></div>`}
    <h2>Usuarios (${us.length - pend.length})</h2>
    <div class="buscar">${icono("search")}<input type="search" data-filtro-usuarios placeholder="Buscar por nombre, email o rol" aria-label="Buscar usuarios"></div>
    <div class="lista" id="usuarios">${us.filter((u) => u.estado_cuenta !== "pendiente").map(tarjeta).join("")}</div></div>`;
}

// ---------------------------------------------------------------- monedas y topes (Finanzas y administración)
async function vistaConfig() {
  const [mons, pols] = await Promise.all([q(sb.from("monedas").select("*").order("orden")), q(sb.from("politicas").select("*"))]);
  return `<div class="grid2" style="align-items:start">
    <div class="card"><h2>Monedas</h2><p class="small muted">Cuántos pesos uruguayos vale cada moneda. Se usa para comparar con los topes y para los totales. Cada ticket guarda la tasa del día en que se cargó.</p>
      ${mons.map((m) => `<form class="fila" data-form="tasa" data-codigo="${m.codigo}"><label style="flex:1 1 160px">${esc(m.nombre)} (${esc(m.simbolo)})
        <input name="tasa" inputmode="decimal" value="${esc(String(m.tasa_uyu).replace(".", ","))}" ${m.codigo === "UYU" ? "disabled" : ""}></label>
        ${m.codigo === "UYU" ? `<span class="xs muted">Moneda base</span>` : `<button>Guardar</button>`}</form>`).join("")}
      <p class="xs muted">Las tasas que vienen cargadas son aproximadas: actualizalas con la cotización del día.</p></div>
    <div class="card"><h2>Topes por ticket</h2><p class="small muted">En pesos uruguayos. Si un ticket (pasado a pesos) supera el tope de su categoría, hay que justificarlo.</p>
      ${pols.map((t) => `<form class="fila" data-form="tope" data-cat="${t.categoria}"><label style="flex:1 1 160px">${esc(CATEGORIAS[t.categoria] || t.categoria)}
        <input name="tope" inputmode="decimal" value="${esc(t.tope_comprobante)}"></label><button>Guardar</button></form>`).join("")}</div></div>`;
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
  const sinJefe = !r.perfiles?.jefe_id;
  const pasaFin = sinJefe || r.estado === "revision_finanzas" || aprs.some((a) => a.etapa === "finanzas") || Number(r.total_aprobado || 0) > 3000;
  const pasos = ["Borrador", ...(sinJefe ? [] : ["Jefe"]), ...(pasaFin ? ["Finanzas"] : []), "Aprobada", "Reembolsada"];
  let idx = 0, mal = false, etiqueta = null;
  switch (r.estado) {
    case "devuelta": idx = 0; mal = true; etiqueta = "Devuelta"; break;
    case "pendiente_jefe": idx = 1; break;
    case "revision_finanzas": idx = pasos.indexOf("Finanzas"); break;
    case "aprobada": case "aprobada_parcial": idx = pasos.indexOf("Aprobada"); break;
    case "reembolsada": idx = pasos.length; break;
    case "rechazada": idx = aprs.some((a) => a.etapa === "finanzas" && a.decision === "rechazado") ? pasos.indexOf("Finanzas") : 1; mal = true; etiqueta = "Rechazada"; break;
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
    q(sb.from("rendiciones").select("*,perfiles!empleado_id(nombre,foto_path,jefe_id,pais,moneda),pagador:perfiles!pagado_por(nombre)").eq("id", rid).maybeSingle()),
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
  const jefeDecide = r.estado === "pendiente_jefe" && !duena && r.perfiles?.jefe_id === S.uid;
  const finDecide = esFinanzas() && r.estado === "revision_finanzas" && !duena;
  const finPaga = esFinanzas() && ["aprobada", "aprobada_parcial"].includes(r.estado) && !duena;
  const sinJefe = !r.perfiles?.jefe_id;
  const revisor = !duena;
  const abiertos = (i) => ["pendiente", "a_corregir"].includes(gastos[i].estado);
  const vivos = gastos.filter((g) => g.estado !== "rechazado");
  const unaMoneda = new Set(gastos.map((g) => g.moneda || "UYU")).size <= 1, mon = gastos[0]?.moneda || "UYU";
  const montoOriginal = vivos.filter((g) => ["aprobado", "aprobado_parcial"].includes(g.estado)).reduce((s, g) => s + reembolsable(g.gasto_items), 0);
  const esperadoPago = { UYU: Number(r.total_aprobado || 0), ...(unaMoneda && mon !== "UYU" ? { [mon]: montoOriginal } : {}) };
  const aReemb = r.total_aprobado != null
    ? (unaMoneda && mon !== "UYU" ? dinero(vivos.filter((g) => ["aprobado", "aprobado_parcial"].includes(g.estado)).reduce((s, g) => s + reembolsable(g.gasto_items), 0), mon) + ` <span class="xs muted">≈ ${plata(r.total_aprobado)}</span>` : plata(r.total_aprobado))
    : totalTickets(vivos, (g) => reembolsable(g.gasto_items));

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
      <div class="kpis"><div class="kpi"><span class="v">${totalTickets(gastos)}</span><span class="k">Total de los tickets</span></div>
        <div class="kpi"><span class="v">${aReemb}</span><span class="k">${r.total_aprobado != null ? "Aprobado para reembolsar" : "A reembolsar (sin lo personal)"}</span></div></div>
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
        <span class="fila">${borrable(r) ? `<button class="btn-link peligro" data-a="borrar-rend" data-id="${r.id}" data-titulo="${esc(r.titulo)}" data-volver="1">${icono("trash")} Eliminar borrador</button>` : ""}
        <button class="btn-p" data-a="enviar" data-destino="${sinJefe ? "Finanzas" : "tu jefe"}" ${!gastos.length || nBloq || nFalta ? "disabled" : ""}>Enviar a ${sinJefe ? "Finanzas" : "mi jefe"}</button></span></div>
    </section>` : ""}

    ${gastos.map((g, i) => tarjetaGasto(g, alertas[i], lecturas[i], { editable, jefeDecide, revisor })).join("")
      || (editable ? "" : `<div class="vacio"><p>Esta rendición no tiene tickets.</p></div>`)}

    ${finDecide ? `<section class="card"><h2>Decisión de Finanzas</h2>
      <p class="small muted">${sinJefe ? `${esc(r.perfiles?.nombre)} no tiene jefe asignado: sus gastos los aprobás vos, todos juntos.` : `El jefe aprobó ${plata(r.total_aprobado)}. Como supera ${plata(3000)}, necesita tu aprobación.`}</p>
      <label>Motivo (obligatorio si rechazás)<input id="motivo-fin"></label>
      <div class="fila"><button class="btn-p" data-a="fin" data-ok="1">Aprobar</button><button class="btn-mal" data-a="fin" data-ok="0">Rechazar</button></div></section>` : ""}
    ${finPaga ? `<form class="card" data-form="pago" data-esperado='${esc(JSON.stringify(esperadoPago))}' data-quien="${esc(r.perfiles?.nombre || "")}"><h2>Registrar el reembolso · ${aReemb}</h2>
      <p class="small muted">Primero hacé la transferencia en el banco. Después subí la foto o captura del comprobante: la IA completa fecha, medio y número, y chequea el monto. La persona ve estos datos y confirma que la recibió.</p>
      <label class="subir-pago">${icono("camera")} Foto o captura del comprobante (opcional)<input name="archivo" type="file" accept="image/*"></label>
      <div class="lectura-pago" aria-live="polite"></div>
      <div class="campos"><label>Fecha del pago<input name="fecha" type="date" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}" required></label>
        <label>Medio<input name="medio" list="medios-reembolso" placeholder="Transferencia BROU" required></label>
        <label>N.º de comprobante de la transferencia<input name="referencia" required placeholder="Ej.: TRF-0045821"></label></div>
      <datalist id="medios-reembolso">${["Transferencia BROU", "Transferencia Itaú", "Transferencia Santander", "Transferencia Scotiabank", "Transferencia BBVA", "Pix", "Transferencia bancaria (Argentina)", "Transferencia bancaria (Chile)", "Efectivo"].map((m) => `<option value="${m}">`).join("")}</datalist>
      <div><button class="btn-p">Marcar como reembolsada</button></div></form>` : ""}
    ${r.estado === "reembolsada" ? `<section class="card pago"><h2>Reembolso pagado</h2>
      ${r.pago_fecha ? `<dl class="datos"><div><dt>Fecha</dt><dd>${fecha(r.pago_fecha)}</dd></div><div><dt>Medio</dt><dd>${esc(r.pago_medio)}</dd></div>
        <div><dt>N.º de comprobante</dt><dd>${esc(r.pago_referencia)}</dd></div><div><dt>Registró</dt><dd>${esc(r.pagador?.nombre || "Finanzas")}</dd></div>
        <div><dt>Monto</dt><dd><b>${aReemb}</b></dd></div></dl>
        ${r.pago_comprobante ? `<div><button class="btn" data-ver="${esc(r.pago_comprobante)}">${icono("eye")} Ver comprobante de la transferencia</button></div>` : ""}`
        : `<p class="small muted">Se marcó como pagada antes de que la app pidiera los datos del pago.</p>`}
      ${r.pago_confirmado ? `<p class="alerta ok"><span class="nivel">Recibido</span><span>${esc(r.perfiles?.nombre)} confirmó que lo recibió el ${fecha(r.pago_confirmado)}.</span></p>`
        : duena ? `<div class="fila entre"><span class="small">¿Ya te llegó la plata? Confirmalo para cerrar la rendición.</span><button class="btn-p" data-a="recibido">Confirmar que lo recibí</button></div>`
        : `<p class="alerta warn"><span class="nivel">Sin confirmar</span><span>${esc(r.perfiles?.nombre)} todavía no confirmó que recibió el pago.</span></p>`}</section>` : ""}

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
  const mon = g.moneda || "UYU", pais = PAISES[paisDeMoneda(mon)];
  const valor = (k) => ["neto", "iva", "total"].includes(k) ? dinero(g[k], mon) : k === "fecha" ? fecha(g.fecha) : esc(g[k] ?? "—");
  const antes = (k) => { const v = leido[k]; return v == null || v === "" ? "vacío" : k === "tipo_comprobante" ? esc(TIPOS[v] || v) : ["neto", "iva", "total"].includes(k) ? dinero(v, leido.moneda || mon) : k === "fecha" ? fecha(v) : esc(v); };
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
        <div class="fila entre"><h3>${esc(g.comercio || "Sin comercio")}</h3><div class="fila">${mon !== "UYU" ? `<span class="etq info">${esc(mon)}</span>` : ""}${g.tipo_comprobante === "pix" ? `<span class="etq warn">Pix</span>` : g.tipo_comprobante === "pago" ? `<span class="etq warn">Sin comprobante fiscal</span>` : ""}${lectura?.confianza != null ? `<span class="etq ${Number(lectura.confianza) < 0.7 ? "warn" : ""}">IA ${Math.round(lectura.confianza * 100)} %</span>` : `<span class="etq">Carga manual</span>`}${pill(EST_G, g.estado)}</div></div>
        <dl class="datos">${dato("fecha", "Fecha")}${dato("categoria", "Categoría", esc(CATEGORIAS[g.categoria] || g.categoria))}
          ${g.tipo_comprobante === "pix"
            ? `${dato("tipo_comprobante", "Comprobante", "Comprovante Pix")}${dato("nro_operacion", "ID de la transacción")}${dato("total", "Total")}`
            : g.tipo_comprobante === "pago"
            ? `${dato("tipo_comprobante", "Comprobante", esc("Pago" + (g.medio_pago ? " · " + g.medio_pago : "")))}${dato("nro_operacion", "N.º de operación")}${g.iva != null ? dato("iva", "IVA") : ""}${dato("total", "Total")}`
            : `${dato("rut_emisor", pais.id.replace(" emisor", ""))}${dato("numero", "Serie y número", esc(`${g.serie || ""} ${g.numero || "—"}`.trim()))}${dato("neto", "Neto")}${dato("iva", "IVA")}${dato("total", "Total")}`}
          <div><dt>Se reembolsa</dt><dd><b>${dinero(reembolsable(g.gasto_items), mon)}</b>${mon !== "UYU" ? `<span class="antes">≈ ${plata(reembolsable(g.gasto_items) * Number(g.tasa_uyu || 1))}</span>` : ""}</dd></div></dl>
        <div class="alertas">${alertasHtml}</div>
        <div class="tabla-wrap"><table class="lineas"><thead><tr><th>Línea</th><th class="r">Importe</th>${gEditable ? '<th class="c">Personal</th>' : ""}${decide ? '<th class="c">No reconocer</th>' : ""}</tr></thead><tbody>
          ${g.gasto_items.map((i) => `<tr class="${!i.reembolsable || i.es_alcohol || i.no_reconocido_por ? "tachada" : ""}">
            <td class="desc">${esc(i.descripcion)}${i.es_alcohol ? '<span class="tag alc">Alcohol · no se reembolsa</span>' : !i.reembolsable ? '<span class="tag per">Personal</span>' : ""}${i.no_reconocido_por ? `<span class="tag nr" title="${esc(i.motivo_no_reconocido)}">No reconocido</span>` : ""}</td>
            <td class="r num">${dinero(i.importe, mon)}</td>
            ${gEditable ? `<td class="c"><input type="checkbox" data-a="personal" data-item="${i.id}" ${!i.reembolsable || i.es_alcohol ? "checked" : ""} ${i.es_alcohol ? 'disabled title="El alcohol nunca se reembolsa"' : ""} aria-label="Marcar ${esc(i.descripcion)} como personal"></td>` : ""}
            ${decide ? `<td class="c">${i.es_alcohol ? "—" : `<input type="checkbox" class="nr-${g.id}" value="${i.id}" aria-label="No reconocer ${esc(i.descripcion)}">`}</td>` : ""}
          </tr>`).join("") || `<tr><td class="muted" colspan="3">Sin líneas</td></tr>`}</tbody></table></div>
        ${gEditable ? `<label>Justificación${necesita ? ' <b class="error">· necesaria para enviar</b>' : " (opcional)"}
            <textarea data-just="${g.id}" placeholder="${g.tipo_comprobante === "pix" ? "¿Por qué no hay nota fiscal? Ej.: pagué por Pix y el local no la emitió" : g.tipo_comprobante === "pago" ? "¿Por qué no hay comprobante fiscal? Ej.: el taxi solo da el comprobante del POS" : "¿Por qué se pasa del tope o no cierra? Ej.: cena con el cliente de Ceibo"}">${esc(g.justificacion || "")}</textarea></label>
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
const vacio = () => ({ tipo_comprobante: "cfe", moneda: S.perfil?.moneda || "UYU", medio_pago: "", nro_operacion: "", comercio: "", fecha: "", rut_emisor: "", serie: "", numero: "", categoria: "otros", neto: "", iva: "", total: "", justificacion: "", items: [{ descripcion: "", importe: "" }] });
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
async function invocarLector(path, modo) {
  for (let intento = 1; intento <= 2; intento++) {
    const espera = new Promise((_, no) => setTimeout(() => no(new Error("tiempo")), 75_000));
    let r;
    try { r = await Promise.race([sb.functions.invoke("leer-ticket", { body: modo ? { path, modo } : { path } }), espera]); }
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
// Finanzas sube el comprobante de la transferencia: se guarda y la IA completa el formulario de pago
async function leerTransferencia(f, file) {
  const caja = f.querySelector(".lectura-pago");
  caja.innerHTML = `<p class="alerta info"><span class="nivel">IA</span><span>Leyendo el comprobante…</span></p>`;
  delete f.dataset.path;
  try {
    const blob = await achicar(file);
    const path = `${S.uid}/pago-${S.rendId}-${Date.now()}.jpg`;
    const up = await sb.storage.from("tickets").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    f.dataset.path = path;
    const { datos: d } = await invocarLector(path, "transferencia");
    if (d.fecha && d.fecha <= f.fecha.max) f.fecha.value = d.fecha;
    if (d.medio) f.medio.value = d.medio;
    if (d.referencia) f.referencia.value = d.referencia;
    const esp = JSON.parse(f.dataset.esperado || "{}");
    const avisos = [];
    if (d.monto != null) {
      const mon = d.moneda || (Object.keys(esp).length === 1 ? "UYU" : Object.keys(esp).find((k) => k !== "UYU"));
      if (esp[mon] == null) avisos.push(["warn", "Moneda", `El comprobante es por ${dinero(d.monto, mon)} y la rendición no está en esa moneda. Revisá el monto.`]);
      else if (Math.abs(d.monto - esp[mon]) > Math.max(1, esp[mon] * 0.01)) avisos.push(["need", "Monto", `El comprobante dice ${dinero(d.monto, mon)} y lo aprobado es ${dinero(esp[mon], mon)}. Revisá antes de marcarla.`]);
      else avisos.push(["ok", "Monto", `${dinero(d.monto, mon)}: coincide con lo aprobado.`]);
    } else avisos.push(["warn", "Monto", "No se pudo leer el monto: revisalo en el comprobante."]);
    if (d.destinatario) {
      const norm = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const quien = norm(f.dataset.quien || ""), dest = norm(d.destinatario);
      const coincide = quien.split(/\s+/).filter((p) => p.length > 2).some((p) => dest.includes(p));
      avisos.push(coincide ? ["ok", "Destinatario", `${d.destinatario}.`] : ["need", "Destinatario", `Figura ${d.destinatario}, no ${f.dataset.quien}. ¿Es la cuenta correcta?`]);
    }
    if (!d.referencia) avisos.push(["warn", "N.º", "No se encontró el número de comprobante: completalo a mano."]);
    caja.innerHTML = `<p class="small muted">${icono("sparkle")} Datos leídos por la IA: revisalos antes de marcar como reembolsada.</p>` +
      avisos.map(([n, k, t]) => `<p class="alerta ${n}"><span class="nivel">${esc(k)}</span><span>${esc(t)}</span></p>`).join("");
  } catch (e) {
    caja.innerHTML = f.dataset.path
      ? `<p class="alerta warn"><span class="nivel">IA</span><span>La foto quedó guardada pero no se pudo leer (${esc(msg(e))}). Completá los datos a mano.</span></p>`
      : `<p class="alerta bad"><span class="nivel">Foto</span><span>No se pudo subir la foto (${esc(msg(e))}).</span></p>`;
  }
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
  // En el celular: descripción arriba; importe y "Quitar" en la misma fila; Alcohol y Personal abajo
  return `<div class="it-row">
    <label class="it-desc">Línea<input data-f="descripcion" value="${esc(i.descripcion)}"></label>
    <label class="it-imp">Importe<input data-f="importe" inputmode="decimal" value="${esc(i.importe)}"></label>
    <button type="button" class="it-quitar" data-a="quitar-linea" aria-label="Quitar esta línea" title="Quitar línea">${icono("trash")}<span>Quitar</span></button>
    <div class="it-marcas"><label class="check"><input type="checkbox" data-f="es_alcohol" ${alc ? "checked" : ""}>Alcohol</label>
      <label class="check" title="${alc ? "El alcohol nunca se reembolsa" : ""}"><input type="checkbox" data-f="personal" ${alc || i.reembolsable === false ? "checked" : ""} ${alc ? "disabled" : ""}>Personal</label></div>
  </div>`;
}
function htmlRev(rev) {
  const fotoHtml = rev.preview ? `<button type="button" class="foto ${rev.estado === "leyendo" ? "leyendo" : ""}" data-ver-local="${esc(rev.preview)}" aria-label="Ver la foto en grande"><img src="${esc(rev.preview)}" alt="Ticket subido"><span class="lupa">${icono("zoomin")} Ver</span></button>` : `<div class="foto">Carga manual</div>`;
  if (rev.estado === "leyendo") return `<div class="card"><div class="gasto">${fotoHtml}<div class="lista"><h3>La IA está leyendo el ticket…</h3><p class="small muted">Busca el tipo de comprobante, la moneda, el número de empresa, la fecha, el comercio, los montos, el IVA y cada línea.</p></div></div></div>`;
  const d = rev.datos;
  const pais = PAISES[S.perfil.pais] || PAISES.UY;
  const tipos = { ...pais.tipos, ...(d.tipo_comprobante === "pix" && !pais.tipos.pix ? { pix: TIPOS.pix } : {}) };
  const tipo = tipos[d.tipo_comprobante] ? d.tipo_comprobante : "cfe";
  const mon = d.moneda || S.perfil.moneda || "UYU";
  return `<form class="card" data-form="rev" data-key="${rev.key}" data-tipo="${tipo}">
    <datalist id="medios-pago">${MEDIOS.map((m) => `<option value="${m}">`).join("")}</datalist><div class="gasto">${fotoHtml}<div class="lista">
    <div class="fila entre"><h3>${rev.gastoId ? "Corregir ticket" : "Revisá lo que leyó la IA"}</h3>${rev.modelo ? `<span class="xs muted">${esc(rev.modelo)}${d.confianza ? ` · confianza ${Math.round(d.confianza * 100)} %` : ""}</span>` : ""}</div>
    ${rev.error ? `<div class="alerta warn"><span class="nivel">Atención</span><span>${esc(rev.error)}</span></div>
      ${rev.path && !rev.gastoId ? `<div><button type="button" data-a="reintentar" data-key="${rev.key}">${icono("refresh")} Reintentar lectura</button></div>` : ""}` : ""}
    <fieldset class="tipo-comp"><legend>Tipo de comprobante</legend>
      ${Object.entries(tipos).map(([v, t]) => `<label class="opcion"><input type="radio" name="tipo_comprobante" value="${v}" ${tipo === v ? "checked" : ""}>${t}</label>`).join("")}
    </fieldset>
    <p class="alerta info solo-pagos"><span class="nivel">Pago</span><span>Un comprobante de pago (POS, Prex, Mercado Pago) no es un comprobante fiscal. Se puede rendir, pero vas a tener que explicar por qué no hay ${S.perfil.pais === "UY" ? "e-Ticket" : "factura"}. Si podés, pedíselo al comercio.</span></p>
    <p class="alerta info solo-pix"><span class="nivel">Pix</span><span>El comprovante Pix prueba que pagaste, pero no es una nota fiscal. Se puede rendir explicando por qué no hay nota fiscal.</span></p>
    <div class="campos">
      <label>Comercio<input name="comercio" value="${esc(d.comercio)}" required></label>
      <label>Fecha<input name="fecha" type="date" value="${esc(d.fecha)}" required></label>
      <label>Categoría<select name="categoria">${Object.entries(CATEGORIAS).map(([v, t]) => `<option value="${v}" ${d.categoria === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label>Moneda<select name="moneda">${(Object.keys(S.monedas).length ? Object.values(S.monedas) : Object.entries(SIMBOLO).map(([codigo, simbolo]) => ({ codigo, simbolo, nombre: codigo })))
        .map((m) => `<option value="${m.codigo}" ${mon === m.codigo ? "selected" : ""}>${esc(m.simbolo)} · ${esc(m.nombre)}</option>`).join("")}</select></label>
      <label class="solo-pagos">Medio de pago<input name="medio_pago" list="medios-pago" value="${esc(d.medio_pago)}" placeholder="Mercado Pago, Prex, OCA…"></label>
      <label class="no-cfe"><span class="solo-pagos">N.º de operación</span><span class="solo-pix">ID de la transacción</span><input name="nro_operacion" value="${esc(d.nro_operacion)}"></label>
      <label class="solo-cfe">${esc(pais.id)}<input name="rut_emisor" value="${esc(d.rut_emisor)}"></label>
      <label class="solo-cfe">Serie<input name="serie" value="${esc(d.serie)}"></label>
      <label class="solo-cfe">Número o folio<input name="numero" value="${esc(d.numero)}"></label>
      <label class="no-pix">Neto (sin IVA)<span class="solo-pagos xs muted"> · si figura</span><input name="neto" inputmode="decimal" value="${esc(d.neto)}"></label>
      <label class="no-pix">IVA<span class="solo-pagos xs muted"> · si figura</span><input name="iva" inputmode="decimal" value="${esc(d.iva)}"></label>
      <label>Total<input name="total" inputmode="decimal" value="${esc(d.total)}" required></label>
    </div>
    <div class="lista items">${(d.items || []).map(filaItem).join("")}</div>
    <div class="fila entre"><button type="button" class="btn-link" data-a="agregar-linea">+ Agregar línea</button><span class="small suma"></span></div>
    <label>Justificación (si se pasa del tope, algo no cierra o no hay comprobante fiscal)<textarea name="justificacion">${esc(d.justificacion)}</textarea></label>
    <div class="fila"><button class="btn-p">Guardar ticket</button><button type="button" data-a="descartar" data-key="${rev.key}">Descartar</button></div>
  </div></div></form>`;
}
function leerForm(form) {
  const v = (n) => form.querySelector(`[name="${n}"]`)?.value ?? "";
  const tipo = form.querySelector('[name="tipo_comprobante"]:checked')?.value || "cfe";
  const cfe = tipo === "cfe", pix = tipo === "pix";
  return {
    tipo_comprobante: tipo, moneda: v("moneda") || S.perfil.moneda || "UYU",
    medio_pago: pix ? "Pix" : cfe ? "" : v("medio_pago").trim(), nro_operacion: cfe ? "" : v("nro_operacion").replace(/[^\dA-Za-z-]/g, ""),
    comercio: v("comercio").trim(), fecha: v("fecha"), categoria: v("categoria"),
    rut_emisor: cfe ? v("rut_emisor").replace(/[^\dkK]/g, "").toUpperCase() : "",
    serie: cfe ? v("serie").trim() : "", numero: cfe ? v("numero").trim() : "",
    neto: pix ? null : numero(v("neto")), iva: pix ? null : numero(v("iva")), total: numero(v("total")),
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
  form.querySelector(".suma").innerHTML = `Las líneas suman <b class="num">${dinero(suma, d.moneda)}</b> ${d.total === null ? "" : cierra ? "· coincide con el total ✓" : `· <span class="error">no coincide con el total</span>`}${d.moneda !== "UYU" && d.total ? ` <span class="muted">· ≈ ${plata(d.total * tasa(d.moneda))}</span>` : ""}`;
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

// ---------------------------------------------------------------- eliminar borradores
async function borrarRends(ids, { volver = false } = {}) {
  const res = await rpc("borrar_rendiciones", { p_ids: ids.map(Number) });
  if (res?.fotos?.length) await sb.storage.from("tickets").remove(res.fotos).catch(() => {});   // si falla, solo quedan fotos sueltas
  await cargarRends();
  toast(res.borradas === 1 ? "Borrador eliminado" : `${res.borradas} borradores eliminados` + (res.omitidas ? ` (${res.omitidas} no se podían borrar)` : ""));
  if (volver) location.hash = "#/rendiciones/borrador"; else await render();
}
function contarSel() {
  const lista = $("#contenido .lista"); if (!lista) return;
  const marcadas = [...lista.querySelectorAll("[data-sel]:checked")];
  const todas = lista.querySelectorAll(".fila-wrap.borrable:not([hidden]) [data-sel]");
  const c = lista.querySelector("[data-sel-cuenta]"); if (c) c.textContent = `${marcadas.length} seleccionado${marcadas.length === 1 ? "" : "s"}`;
  const b = lista.querySelector('[data-a="borrar-sel"]'); if (b) { b.disabled = !marcadas.length; b.lastChild.textContent = marcadas.length ? ` Eliminar (${marcadas.length})` : " Eliminar"; }
  const t = lista.querySelector("[data-sel-todo]"); if (t) { t.checked = marcadas.length > 0 && marcadas.length === todas.length; t.indeterminate = marcadas.length > 0 && marcadas.length < todas.length; }
}
function cerrarDeslizadas(excepto) {
  document.querySelectorAll(".fila-wrap.abierta").forEach((w) => { if (w !== excepto) { w.classList.remove("abierta"); w.querySelector(".fila-r").style.transform = ""; } });
}

const acciones = {
  "borrar-rend": async (b) => {
    const ok = await confirmar(`¿Eliminar el borrador «${b.dataset.titulo}»? Se borran sus tickets y fotos. No se puede deshacer.`, { ok: "Eliminar", peligro: true });
    if (!ok) { cerrarDeslizadas(); return; }
    try { await borrarRends([b.dataset.id], { volver: !!b.dataset.volver }); } catch (e) { toast(msg(e), true); }
  },
  "modo-sel": () => { $("#contenido .lista").classList.add("seleccionando"); cerrarDeslizadas(); contarSel(); },
  "cancelar-sel": () => { const l = $("#contenido .lista"); l.classList.remove("seleccionando"); l.querySelectorAll("[data-sel]").forEach((c) => { c.checked = false; }); contarSel(); },
  "borrar-sel": async () => {
    const ids = [...$("#contenido .lista").querySelectorAll("[data-sel]:checked")].map((c) => c.dataset.sel);
    if (!ids.length) return;
    const ok = await confirmar(`¿Eliminar ${ids.length === 1 ? "1 borrador" : ids.length + " borradores"}? Se borran sus tickets y fotos. No se puede deshacer.`, { ok: "Eliminar", peligro: true });
    if (!ok) return;
    try { await borrarRends(ids); } catch (e) { toast(msg(e), true); }
  },
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
  enviar: async (b) => { const a = b.dataset.destino || "tu jefe";
    if (await confirmar(`¿Enviar la rendición a ${a}? Mientras la revisa no la vas a poder modificar.`, { ok: "Enviar" }))
      hacer(() => rpc("enviar_rendicion", { p_rend: S.rendId }), `Enviada a ${a}`); },
  decidir: (b) => {
    const id = Number(b.dataset.gasto), motivo = $("#m-" + id).value;
    const nr = [...document.querySelectorAll(".nr-" + id + ":checked")].map((c) => Number(c.value));
    hacer(() => rpc("decidir_gasto", { p_gasto: id, p_decision: b.dataset.d, p_motivo: motivo, p_no_reconocidos: nr }),
      { aprobado: nr.length ? "Aprobado sin las líneas no reconocidas" : "Ticket aprobado", corregir: "Se pidió corrección", rechazado: "Ticket rechazado" }[b.dataset.d]);
  },
  fin: (b) => hacer(() => rpc("decidir_finanzas", { p_rend: S.rendId, p_aprobar: b.dataset.ok === "1", p_motivo: $("#motivo-fin").value }),
    b.dataset.ok === "1" ? "Aprobada por Finanzas" : "Rechazada por Finanzas"),
  recibido: async () => { if (await confirmar("¿Confirmás que ya recibiste el pago de este reembolso?", { ok: "Sí, lo recibí" }))
    hacer(() => rpc("confirmar_recepcion", { p_rend: S.rendId }), "¡Listo! Rendición cerrada"); },
  exportar: (b) => { b.closest("details")?.removeAttribute("open"); exportar(b.dataset.f).catch((e) => toast("No se pudo descargar: " + msg(e), true)); },
  reiniciar: async () => { if (await confirmar("Se borran todas las rendiciones y se cargan las de ejemplo. ¿Seguimos?", { ok: "Reiniciar", peligro: true }))
    hacer(() => rpc("reiniciar_demo"), "Datos demo reiniciados"); },
};

app.addEventListener("click", (e) => {
  const fila = e.target.closest(".fila-r");
  if (fila) {
    const w = fila.parentElement;
    if (w.closest(".seleccionando") && w.classList.contains("borrable")) { e.preventDefault(); const c = w.querySelector("[data-sel]"); c.checked = !c.checked; contarSel(); return; }
    if (w.classList.contains("abierta") || deslizo) { e.preventDefault(); deslizo = false; cerrarDeslizadas(); return; }
  }
  if (!e.target.closest(".fila-wrap")) cerrarDeslizadas();
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
// Deslizar un borrador hacia la izquierda (celular) muestra el tachito
let toque = null, deslizo = false;
const ANCHO_TACHO = 92;
app.addEventListener("touchstart", (e) => {
  const w = e.target.closest(".fila-wrap.borrable");
  if (!w || w.closest(".seleccionando") || e.target.closest("button")) { toque = null; return; }
  const t = e.touches[0];
  toque = { w, x: t.clientX, y: t.clientY, base: w.classList.contains("abierta") ? -ANCHO_TACHO : 0, dx: 0, eje: null };
  w.classList.add("arrastrando");
}, { passive: true });
app.addEventListener("touchmove", (e) => {
  if (!toque) return;
  const t = e.touches[0], dx = t.clientX - toque.x, dy = t.clientY - toque.y;
  if (!toque.eje && Math.abs(dx) + Math.abs(dy) > 8) toque.eje = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
  if (toque.eje !== "x") return;
  e.preventDefault();   // mientras se desliza de costado, la página no hace scroll
  toque.dx = dx;
  const pos = Math.max(-ANCHO_TACHO * 1.3, Math.min(0, toque.base + dx));
  toque.w.querySelector(".fila-r").style.transform = `translateX(${pos}px)`;
}, { passive: false });
app.addEventListener("touchend", () => {
  if (!toque) return;
  const { w, base, dx, eje } = toque; toque = null;
  w.classList.remove("arrastrando");
  if (eje !== "x") return;
  deslizo = true; setTimeout(() => { deslizo = false; }, 350);   // que el toque no abra la rendición
  const abrir = base + dx < -ANCHO_TACHO / 2;
  cerrarDeslizadas(abrir ? w : null);
  w.classList.toggle("abierta", abrir);
  w.querySelector(".fila-r").style.transform = abrir ? `translateX(${-ANCHO_TACHO}px)` : "";
});
app.addEventListener("change", (e) => {
  if (e.target.id === "archivos" && e.target.files.length) { subirArchivos([...e.target.files]); e.target.value = ""; }
  if (e.target.matches('[data-form="pago"] [name="archivo"]') && e.target.files[0]) leerTransferencia(e.target.closest("form"), e.target.files[0]);
  if (e.target.id === "foto-perfil" && e.target.files[0]) {
    subirAvatar(e.target.files[0]).then(() => { toast("Foto actualizada"); render(); }).catch((err) => toast(msg(err), true));
  }
  if (e.target.id === "idioma") {
    try { localStorage.setItem("rendi-idioma", e.target.value); } catch { /* sin almacenamiento */ }
    location.reload();   // se vuelve a dibujar todo en el idioma elegido
  }
  if (e.target.matches("[data-sel]")) contarSel();
  if (e.target.matches("[data-sel-todo]")) {
    $("#contenido .lista").querySelectorAll(".fila-wrap.borrable:not([hidden]) [data-sel]").forEach((c) => { c.checked = e.target.checked; });
    contarSel();
  }
  if (e.target.matches('[name="tipo_comprobante"]')) {
    const form = e.target.closest("form"); form.dataset.tipo = e.target.value;
    if (e.target.value !== "cfe" && form.querySelector('[name="categoria"]').value === "otros" && /taxi|uber|cabify|remise/i.test(form.querySelector('[name="comercio"]').value))
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
  if (e.target.matches("[data-filtro-usuarios]")) {
    const t = e.target.value.toLowerCase().trim();
    document.querySelectorAll("#usuarios form").forEach((f) => (f.hidden = t && !f.textContent.toLowerCase().includes(t)));
  }
  if (e.target.matches("[data-filtro]")) {
    const t = e.target.value.toLowerCase().trim();
    e.target.closest(".lista, main").querySelectorAll(".fila-wrap").forEach((w) => (w.hidden = t && !w.querySelector(".fila-r").dataset.texto.includes(t)));
    contarSel();
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
  if (tipo === "pago") {
    if (!(await confirmar(`¿Ya hiciste la transferencia? La rendición queda como reembolsada con el comprobante ${f.referencia.value}.`, { ok: "Sí, marcar reembolsada" }))) return;
    hacer(async () => {
      let path = f.dataset.path || null;
      const file = f.archivo.files[0];
      if (file && !path) {
        const blob = await achicar(file);
        path = `${S.uid}/pago-${S.rendId}-${Date.now()}.jpg`;
        const up = await sb.storage.from("tickets").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw up.error;
      }
      await rpc("marcar_reembolsada", { p_rend: S.rendId, p_fecha: f.fecha.value, p_medio: f.medio.value, p_referencia: f.referencia.value, p_comprobante: path });
    }, "Reembolso registrado");
  }
  if (tipo === "usuario") {
    const accion = e.submitter?.value || "guardar";
    const estado = accion === "aprobar" ? "activa" : accion === "rechazar" ? "rechazada" : f.estado.value;
    if (accion === "rechazar" && !(await confirmar("¿Rechazar esta solicitud? La persona no va a poder usar la app.", { ok: "Rechazar", peligro: true }))) return;
    hacer(() => rpc("admin_guardar_usuario", { p_id: f.dataset.id, p_rol: f.rol.value, p_jefe: f.jefe.value || null, p_pais: f.pais.value, p_area: f.area.value, p_estado: estado }),
      accion === "aprobar" ? "Usuario aprobado" : accion === "rechazar" ? "Solicitud rechazada" : "Usuario actualizado");
  }
  if (tipo === "tasa") hacer(() => rpc("guardar_tasa", { p_codigo: f.dataset.codigo, p_tasa: numero(f.tasa.value) }).then(async () => {
    S.monedas = Object.fromEntries((await q(sb.from("monedas").select("*"))).map((m) => [m.codigo, m])); }), "Tasa guardada");
  if (tipo === "tope") hacer(() => rpc("guardar_tope", { p_categoria: f.dataset.cat, p_tope: numero(f.tope.value) }), "Tope guardado");
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
  perfil: vistaPerfil, r: vistaDetalle, usuarios: vistaUsuarios, todas: vistaTodas, config: vistaConfig };

arrancar();
