# Rendí

Rendición de gastos con IA: le sacás foto al ticket, la IA lo carga, la base chequea las reglas y el flujo lo lleva del jefe a Finanzas hasta el reembolso.

Trabajo para *Introducción a la Tecnología y Cultura Digital 2026* — desafío "Artefacto de software empresarial (Back-End)", reto 5 del catálogo (Validador de gastos corporativos).

## Qué hay en cada carpeta

| Carpeta / archivo | Qué es | Dónde se usa |
|---|---|---|
| `docs/` | La página web (HTML, CSS, JS). Se publica con GitHub Pages. | GitHub Pages |
| `docs/config.js` | El único archivo que hay que editar: URL y clave pública de Supabase. | GitHub Pages |
| `supabase/01_tablas.sql` | Las 8 tablas. | Supabase › SQL Editor |
| `supabase/02_reglas.sql` | Las reglas del negocio y el flujo de aprobación. | Supabase › SQL Editor |
| `supabase/03_seguridad.sql` | Quién ve qué (RLS) y la carpeta privada de fotos. | Supabase › SQL Editor |
| `supabase/04_demo_y_calidad.sql` | Usuarios demo, datos de ejemplo y el panel de Control de calidad. | Supabase › SQL Editor |
| `supabase/functions/leer-ticket/index.ts` | La función que le manda la foto a la IA (Gemini o Claude). | Supabase › Edge Functions |
| `.github/workflows/mantener-vivo.yml` | Consulta la base cada 3 días para que el plan gratis no la pause. | GitHub Actions |

## Stack y costo

- **GitHub Pages**: publica la página. Gratis.
- **Supabase (plan Free)**: login, base de datos PostgreSQL, fotos y la función de IA. Gratis.
- **IA**: Gemini Flash-Lite (free tier) o Claude Haiku 5.5 (~US$ 0,0005 por ticket). Se cambia con el secret `PROVEEDOR`.

## Cómo viajan los datos

Foto → Supabase Storage (carpeta privada) → Edge Function `leer-ticket` → IA con visión → la persona revisa → `guardar_gasto()` valida y guarda → jefe decide ticket por ticket → si lo aprobado supera $U 3.000, Finanzas → reembolsado.

Todas las reglas viven en la base (funciones `security definer` + RLS): desde el navegador solo se puede leer lo propio, y toda escritura pasa por funciones que chequean las reglas.
