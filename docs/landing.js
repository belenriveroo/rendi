// RENDÍ · landing: iniciar sesión, olvidé mi contraseña, cuentas demo y tema.
import { sb, CFG, configurado, esc, alternarTema, icono } from "./sb.js";

const dlg = document.getElementById("login");
const vista = (v) => dlg.querySelectorAll("[data-vista]").forEach((el) => (el.hidden = el.dataset.vista !== v));
const mostrar = (el, texto) => { el.textContent = texto; el.hidden = !texto; };

// Botón de tema
const botonTema = document.querySelector("[data-tema]");
const pintarTema = () => {
  const oscuro = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  botonTema.innerHTML = icono(oscuro ? "sun" : "moon");
};
botonTema.addEventListener("click", () => { alternarTema(); pintarTema(); });
pintarTema();

function abrirLogin(cual = "entrar") {
  vista(cual);
  dlg.querySelectorAll(".error, .ok").forEach((e) => (e.hidden = true));
  if (!configurado) mostrar(dlg.querySelector("#form-login .error"), "Falta configurar config.js con la URL y la clave pública de Supabase.");
  dlg.showModal();
  dlg.querySelector(`[data-vista="${cual}"] input`).focus();
}
document.querySelectorAll("[data-abrir-login]").forEach((b) => b.addEventListener("click", () => abrirLogin()));
document.querySelectorAll("[data-abrir-registro]").forEach((b) => b.addEventListener("click", () => abrirLogin("registro")));
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });   // clic afuera cierra
dlg.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => vista(b.dataset.ir)));

// Mostrar / ocultar contraseña
dlg.querySelector("[data-ver-clave]").addEventListener("click", (e) => {
  const input = dlg.querySelector('input[name="clave"]');
  input.type = input.type === "password" ? "text" : "password";
  e.target.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
});

// Cuentas demo: solo completan los campos; hay que tocar Entrar.
// Se suman las cuentas nuevas (admin y empleados de otros países) sin tocar config.js.
const EXTRA = [
  { email: "admin@example.com", clave: "rendi2026", nombre: "Ana Gómez", rol: "Admin" },
  { email: "empleado2@example.com", clave: "rendi2026", nombre: "Diego Fernández", rol: "Empleado" },
  { email: "brasil@example.com", clave: "rendi2026", nombre: "Camila Souza", rol: "Brasil" },
  { email: "argentina@example.com", clave: "rendi2026", nombre: "Julián Pérez", rol: "Argentina" },
  { email: "chile@example.com", clave: "rendi2026", nombre: "Valentina Muñoz", rol: "Chile" },
];
const BASE = CFG.USUARIOS_DEMO || [];
const DEMO = BASE.length ? [...BASE, ...EXTRA.filter((e) => !BASE.some((u) => u.email === e.email))] : [];
document.getElementById("cuentas-demo").innerHTML = DEMO.map((u, i) =>
  `<button type="button" class="chip" data-demo="${i}"><b>${esc(u.rol)}</b> · ${esc(u.nombre)}</button>`).join("");
dlg.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => {
  const u = DEMO[Number(b.dataset.demo)];
  const f = document.getElementById("form-login");
  f.email.value = u.email; f.clave.value = u.clave;
  dlg.querySelectorAll("[data-demo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  f.querySelector(".btn-p").focus();
}));

const traducir = (m) => ({
  "Invalid login credentials": "El email o la contraseña no son correctos.",
  "Email not confirmed": "Tu cuenta todavía no está aprobada. Cuando el administrador la apruebe vas a poder entrar.",
}[m] || m);

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = f.querySelector(".error"), boton = f.querySelector(".btn-p");
  if (!configurado) return;
  if (!f.email.value || !f.clave.value) return mostrar(err, "Completá el email y la contraseña.");
  boton.disabled = true; boton.textContent = "Entrando…";
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.clave.value });
  if (error) { boton.disabled = false; boton.textContent = "Entrar"; return mostrar(err, traducir(error.message)); }
  location.href = "app.html";
});

// Crear cuenta: queda pendiente hasta que la apruebe el administrador
const PERSONALES = /@(gmail|hotmail|outlook|live|yahoo|icloud|proton(mail)?|aol|msn)\./i;
document.getElementById("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = f.querySelector(".error"), ok = f.querySelector(".ok"), boton = f.querySelector(".btn-p");
  mostrar(err, ""); mostrar(ok, "");
  if (!configurado) return mostrar(err, "Falta configurar config.js.");
  const email = f.email.value.trim().toLowerCase(), nombre = f.nombre.value.trim();
  if (!nombre || !email || !f.clave.value) return mostrar(err, "Completá tu nombre, tu correo y una contraseña.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return mostrar(err, "Ese correo no parece válido.");
  if (PERSONALES.test(email)) return mostrar(err, "Usá tu correo corporativo (el de tu empresa), no uno personal.");
  if (f.clave.value.length < 8) return mostrar(err, "La contraseña tiene que tener al menos 8 caracteres.");
  boton.disabled = true; boton.textContent = "Enviando…";
  const { data, error } = await sb.auth.signUp({ email, password: f.clave.value,
    options: { data: { nombre, area: f.area.value.trim(), pais: f.pais.value }, emailRedirectTo: new URL("app.html", location.href).href } });
  boton.disabled = false; boton.textContent = "Enviar solicitud";
  if (error) return mostrar(err, /registered|exists/i.test(error.message) ? "Ya hay una cuenta con ese correo. Probá iniciar sesión."
    : /rate|limit/i.test(error.message) ? "Se hicieron muchos registros seguidos. Probá de nuevo en un rato." : error.message);
  if (data.session) { location.href = "app.html"; return; }
  f.reset();
  mostrar(ok, "¡Listo! Recibimos tu solicitud. Cuando el administrador la apruebe vas a poder entrar con tu correo y tu contraseña.");
});

document.getElementById("form-olvide").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, err = f.querySelector(".error"), ok = f.querySelector(".ok");
  mostrar(err, ""); mostrar(ok, "");
  if (!configurado) return mostrar(err, "Falta configurar config.js.");
  if (!f.email.value) return mostrar(err, "Escribí tu email.");
  const { error } = await sb.auth.resetPasswordForEmail(f.email.value.trim(), { redirectTo: new URL("app.html", location.href).href });
  if (error) return mostrar(err, error.message.includes("rate") ? "Se mandaron muchos emails en poco tiempo. Probá de nuevo en un rato." : error.message);
  mostrar(ok, "Si ese email tiene cuenta, en unos minutos te llega el link. Revisá también el correo no deseado.");
});

// Si ya hay sesión, el botón de arriba lleva directo a la app
if (configurado) {
  const { data } = await sb.auth.getSession();
  if (data.session) document.querySelectorAll(".l-acciones [data-abrir-login]").forEach((b) => {
    const a = document.createElement("a"); a.className = "btn-p"; a.href = "app.html"; a.textContent = "Ir a mi cuenta"; b.replaceWith(a);
  });
}
if (location.hash === "#entrar") abrirLogin();
