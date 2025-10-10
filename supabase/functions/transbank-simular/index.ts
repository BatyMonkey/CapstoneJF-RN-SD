// deno run --allow-net server.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 🧩 Configuración del comercio de prueba oficial (SANDBOX)
const TBK_API_KEY_ID = "597055555532"; // <- clave: este es el de integración Webpay Plus
const TBK_API_KEY_SECRET =
  "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
const TBK_URL =
  "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions";

// CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  };
}

// Server
serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido. Usa POST." }), {
      status: 405,
      headers: corsHeaders(),
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    let { buyOrder, sessionId, amount } = body as {
      buyOrder?: string;
      sessionId?: string;
      amount?: number | string;
    };

    if (!buyOrder || !sessionId || amount === undefined || amount === null) {
      return new Response(JSON.stringify({ error: "Faltan parámetros requeridos" }), {
        headers: corsHeaders(),
        status: 400,
      });
    }

    // ✂️ Limitar longitudes (Transbank exige máximo 26 y 61 caracteres)
    buyOrder = String(buyOrder).substring(0, 26);
    sessionId = String(sessionId).substring(0, 61);

    // Monto entero en CLP
    const amountInt = Math.trunc(Number(amount));
    if (!Number.isFinite(amountInt) || amountInt <= 0) {
      return new Response(JSON.stringify({ error: "Monto inválido. Debe ser entero en CLP (>0)." }), {
        headers: corsHeaders(),
        status: 400,
      });
    }

    // 🧠 returnUrl local (HTTP funciona en sandbox)
    const returnUrl = "http://localhost:8100/pago-retorno";

    const payload = {
      buy_order: buyOrder,
      session_id: sessionId,
      amount: amountInt,
      return_url: returnUrl,
    };

    console.log("📦 Enviando payload limpio a Transbank:", payload);

    // 🚀 Llamada al sandbox Transbank
    const response = await fetch(TBK_URL, {
      method: "POST",
      headers: {
        "Tbk-Api-Key-Id": TBK_API_KEY_ID,         // <- ID correcto evita 401
        "Tbk-Api-Key-Secret": TBK_API_KEY_SECRET, // <- Secret correcto
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    console.log("🧾 Respuesta Transbank:", response.status, result);

    // 401 = credenciales/endpoint
    if (response.status === 401) {
      return new Response(
        JSON.stringify({
          error: "No autorizado (401). Revisa Api-Key-Id/Secret y que uses el host de integración.",
          detalle: result,
        }),
        { headers: corsHeaders(), status: 401 },
      );
    }

    if (!response.ok || !result?.token) {
      return new Response(
        JSON.stringify({ error: "Transbank rechazó la transacción (init).", detalle: result }),
        { headers: corsHeaders(), status: 400 },
      );
    }

    // ✅ Devuelve la respuesta válida { token, url }
    return new Response(JSON.stringify(result), {
      headers: corsHeaders(),
      status: 200,
    });
  } catch (err: any) {
    console.error("❌ Error general Transbank:", err);
    return new Response(
      JSON.stringify({ error: "Error interno", detalle: err?.message ?? String(err) }),
      { headers: corsHeaders(), status: 500 },
    );
  }
});

