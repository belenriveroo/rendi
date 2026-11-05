// =====================================================================
// RENDÍ · Edge Function "leer-ticket"
// Recibe la ruta de una foto ya subida, se la manda a la IA y devuelve los
// datos del ticket. Guarda lo que respondió la IA en lecturas_ia.
//
// Secrets que hay que cargar en Supabase (Edge Functions > Secrets):
//   PROVEEDOR        gemini  o  claude          (por defecto: gemini)
//   GEMINI_API_KEY   la clave de Google AI Studio (si usás gemini)
//   GEMINI_MODELO    opcional, ej. gemini-3.1-flash-lite
//   ANTHROPIC_API_KEY la clave de console.anthropic.com (si usás claude)
//   CLAUDE_MODELO    opcional, ej. claude-haiku-5-5
//   LIMITE_DIARIO    opcional, lecturas por persona por día (por defecto 30)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen cargadas solas.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Sos un lector de comprobantes de Uruguay (e-Tickets / CFE y tickets comunes).
Mirá la imagen y devolvé SOLO un objeto JSON, sin texto antes ni después, con esta forma exacta:
{
  "rut_emisor": "solo dígitos o null",
  "serie": "letra(s) de la serie o null",
  "numero": "número del comprobante o null",
  "fecha": "YYYY-MM-DD o null",
  "comercio": "nombre del comercio",
  "neto": número sin IVA o null,
  "iva": monto del IVA o null,
  "total": total pagado,
  "categoria": "comidas" | "traslados" | "alojamiento" | "otros",
  "items": [ { "descripcion": "texto", "importe": número, "es_alcohol": true|false } ],
  "confianza": número entre 0 y 1
}
Reglas:
- Montos en pesos uruguayos, con punto decimal y sin separador de miles (ej. 1180.50).
- En "items" va una entrada por línea del ticket con su importe final (IVA incluido). Si hay descuentos, ponelos como línea con importe negativo.
- "es_alcohol" es true para vino, cerveza, whisky, tragos, espumante, etc.
- Si un dato no se ve, poné null. No inventes datos.
- "confianza" indica qué tan legible y completo está el ticket.
- Si la imagen no es un comprobante, devolvé {"error": "no_es_comprobante"}.`;

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// La IA a veces devuelve el JSON envuelto en ```json ... ```
function sacarJson(texto: string) {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin < ini) throw new Error("La IA no devolvió un JSON.");
  return JSON.parse(texto.slice(ini, fin + 1));
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function txt(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
}

function normalizar(d: Record<string, unknown>) {
  const cats = ["comidas", "traslados", "alojamiento", "otros"];
  const cat = String(d.categoria ?? "otros").toLowerCase();
  const items = Array.isArray(d.items) ? d.items : [];
  return {
    rut_emisor: txt(d.rut_emisor)?.replace(/\D/g, "") || null,
    serie: txt(d.serie),
    numero: txt(d.numero),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha ?? "")) ? String(d.fecha) : null,
    comercio: txt(d.comercio),
    neto: num(d.neto),
    iva: num(d.iva),
    total: num(d.total),
    categoria: cats.includes(cat) ? cat : "otros",
    items: items
      .map((i: Record<string, unknown>) => ({
        descripcion: txt(i?.descripcion) ?? "Sin descripción",
        importe: num(i?.importe),
        es_alcohol: i?.es_alcohol === true,
      }))
      .filter((i) => i.importe !== null),
    confianza: num(d.confianza),
  };
}

async function leerConGemini(b64: string, mime: string) {
  const clave = Deno.env.get("GEMINI_API_KEY");
  if (!clave) throw new Error("Falta el secret GEMINI_API_KEY.");
  const modelo = Deno.env.get("GEMINI_MODELO") || "gemini-3.1-flash-lite";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Gemini respondió ${r.status}: ${j?.error?.message ?? "error"}`);
  const texto = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { datos: sacarJson(texto), modelo };
}

async function leerConClaude(b64: string, mime: string) {
  const clave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!clave) throw new Error("Falta el secret ANTHROPIC_API_KEY.");
  const modelo = Deno.env.get("CLAUDE_MODELO") || "claude-haiku-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": clave, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Claude respondió ${r.status}: ${j?.error?.message ?? "error"}`);
  const texto = (j?.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  return { datos: sacarJson(texto), modelo };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return respuesta({ error: "Usá POST." }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. ¿Quién llama? (tiene que estar logueado)
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: quien, error: errUser } = await admin.auth.getUser(token);
    if (errUser || !quien?.user) return respuesta({ error: "Tenés que iniciar sesión." }, 401);
    const uid = quien.user.id;

    // 2. ¿La foto es suya?
    const { path } = await req.json();
    if (typeof path !== "string" || !path.startsWith(uid + "/")) {
      return respuesta({ error: "Esa foto no es tuya." }, 403);
    }

    // 3. Tope de lecturas por día, para cuidar el cupo gratis
    const limite = Number(Deno.env.get("LIMITE_DIARIO") || 30);
    const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
    const { count } = await admin.from("lecturas_ia").select("id", { count: "exact", head: true })
      .eq("usuario_id", uid).gte("creado", hoy.toISOString());
    if ((count ?? 0) >= limite) {
      return respuesta({ error: `Llegaste al tope de ${limite} lecturas por hoy. Podés cargar el ticket a mano.` }, 429);
    }

    // 4. Bajamos la foto y se la mandamos a la IA
    const { data: foto, error: errFoto } = await admin.storage.from("tickets").download(path);
    if (errFoto || !foto) return respuesta({ error: "No encontré la foto." }, 404);
    const mime = foto.type && foto.type.startsWith("image/") ? foto.type : "image/jpeg";
    const b64 = encodeBase64(new Uint8Array(await foto.arrayBuffer()));

    const proveedor = (Deno.env.get("PROVEEDOR") || "gemini").toLowerCase();
    const { datos: crudo, modelo } = proveedor === "claude"
      ? await leerConClaude(b64, mime)
      : await leerConGemini(b64, mime);

    if (crudo?.error) return respuesta({ error: "La foto no parece un comprobante. Probá con otra." }, 422);
    const datos = normalizar(crudo);

    // 5. Guardamos lo que dijo la IA (para medir después qué tan bien lee)
    const { data: lectura, error: errIns } = await admin.from("lecturas_ia")
      .insert({ usuario_id: uid, json_crudo: datos, confianza: datos.confianza, modelo })
      .select("id").single();
    if (errIns) throw new Error(errIns.message);

    return respuesta({ lectura_id: lectura.id, datos, modelo });
  } catch (e) {
    return respuesta({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
