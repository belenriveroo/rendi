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

function abrirLogin() {
  vista("entrar");
  dlg.querySelectorAll(".error, .ok").forEach((e) => (e.hidden = true));
  if (!configurado) mostrar(dlg.querySelector("#form-login .error"), "Falta configurar config.js con la URL y la clave pública de Supabase.");
  dlg.showModal();
  dlg.querySelector('input[name="email"]').focus();
}
document.querySelectorAll("[data-abrir-login]").forEach((b) => b.addEventListener("click", abrirLogin));
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });   // clic afuera cierra
dlg.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => vista(b.dataset.ir)));

// Mostrar / ocultar contraseña
dlg.querySelector("[data-ver-clave]").addEventListener("click", (e) => {
  const input = dlg.querySelector('input[name="clave"]');
  input.type = input.type === "password" ? "text" : "password";
  e.target.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
});

// Cuentas demo: solo completan los campos; hay que tocar Entrar
document.getElementById("cuentas-demo").innerHTML = (CFG.USUARIOS_DEMO || []).map((u, i) =>
  `<button type="button" class="chip" data-demo="${i}"><b>${esc(u.rol)}</b> · ${esc(u.nombre)}</button>`).join("");
dlg.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", () => {
  const u = CFG.USUARIOS_DEMO[Number(b.dataset.demo)];
  const f = document.getElementById("form-login");
  f.email.value = u.email; f.clave.value = u.clave;
  dlg.querySelectorAll("[data-demo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  f.querySelector(".btn-p").focus();
}));

const traducir = (m) => ({
  "Invalid login credentials": "El email o la contraseña no son correctos.",
  "Email not confirmed": "Ese usuario todavía no confirmó su email.",
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
