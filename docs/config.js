// =====================================================================
// RENDÍ · Configuración. ESTE es el único archivo que tenés que editar.
// Los dos datos están en Supabase > Project Settings > API (o "Data API" / "API Keys").
// =====================================================================
window.RENDI_CONFIG = {
  // 1. Project URL (algo como https://abcdxyz.supabase.co)
  SUPABASE_URL: "https://xomgcxbwtzefiwxcbpgk.supabase.co",

  // 2. La clave PÚBLICA: "anon public" o "publishable" (empieza con eyJ... o con sb_publishable_...)
  //    Esta clave puede estar a la vista: la seguridad la ponen las reglas de la base.
  //    NUNCA pongas acá la "service_role" ni la "secret".
  SUPABASE_KEY: "sb_publishable_xgm0Fvoi1-BoT2QSWa1MjQ_nwJlkTfe",

  // 3. Usuarios demo que se muestran en la pantalla de inicio (tienen que existir en Supabase)
  USUARIOS_DEMO: [
    { email: "empleada@example.com", clave: "rendi2026", nombre: "Sofía Pereira",   rol: "Empleada", hace: "Sube tickets y sigue su reembolso" },
    { email: "jefe@example.com",     clave: "rendi2026", nombre: "Martín Acosta",   rol: "Jefe",     hace: "Aprueba los gastos de su equipo" },
    { email: "finanzas@example.com", clave: "rendi2026", nombre: "Lucía Rodríguez", rol: "Finanzas", hace: "Aprueba lo grande y reembolsa" },
  ],
};
