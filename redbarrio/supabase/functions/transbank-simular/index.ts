import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 🔒 Claves sandbox oficiales Transbank
const TBK_API_KEY_ID = "597055555532";
const TBK_API_KEY_SECRET =
  "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
const TBK_URL =
  "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions";

// 🌍 URL pública del HTML intermedio (Netlify)
const RETURN_URL = "https://redbarrio.netlify.app/retorno-transbank.html";

// 🌐 Helper CORS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  };
}

// 🚀 Servidor principal
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido. Usa POST." }),
      { status: 405, headers: corsHeaders() }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { id_reserva, monto, descripcion } = body;

    // 🔎 Validaciones básicas
    if (!id_reserva || !monto || !descripcion) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const amount = Math.trunc(Number(monto));
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Monto inválido (>0 CLP)" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // 🧾 Generar identificadores válidos
    const buyOrder = `RB-${id_reserva}-${Date.now()}`;
    const cleanSessionId = (descripcion ?? "ReservaRedBarrio")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .substring(0, 61);

    // 📦 Payload a enviar a Transbank
    const payload = {
      buy_order: buyOrder,
      session_id: cleanSessionId,
      amount,
      return_url: RETURN_URL,
    };

    console.log("📤 Payload enviado a Transbank:", payload);

    // 🔗 Crear transacción en Transbank
    const response = await fetch(TBK_URL, {
      method: "POST",
      headers: {
        "Tbk-Api-Key-Id": TBK_API_KEY_ID,
        "Tbk-Api-Key-Secret": TBK_API_KEY_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    console.log("🧾 Respuesta Transbank:", response.status, result);

    // ⚠️ Validar respuesta
    if (!response.ok || !result?.token) {
      return new Response(
        JSON.stringify({
          error: "Transbank rechazó la transacción (init).",
          detalle: result,
        }),
        { status: 400, headers: corsHeaders() }
      );
    }

    // ✅ Éxito: devolver URL de redirección al frontend
    return new Response(
      JSON.stringify({
        url: "https://webpay3gint.transbank.cl/webpayserver/initTransaction",
        token: result.token,
        return_url: RETURN_URL,
        buy_order: buyOrder,
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: any) {
    console.error("❌ Error general Transbank Simular:", err);
    return new Response(
      JSON.stringify({
        error: "Error interno",
        detalle: err?.message ?? String(err),
      }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
