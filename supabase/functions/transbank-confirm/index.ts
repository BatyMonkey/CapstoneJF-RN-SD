// supabase/functions/transbank-confirm/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 🧩 Configuración del comercio de prueba (SANDBOX)
const TBK_API_KEY_ID = "597055555532";
const TBK_API_KEY_SECRET =
  "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
const TBK_URL =
  "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions";

// ⚙️ Helper CORS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      headers: corsHeaders(),
      status: 405,
    });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Falta token_ws" }), {
        headers: corsHeaders(),
        status: 400,
      });
    }

    console.log("🔁 Confirmando pago con token:", token);

    // 🧾 Confirmar transacción con Transbank
    const response = await fetch(`${TBK_URL}/${token}`, {
      method: "PUT",
      headers: {
        "Tbk-Api-Key-Id": TBK_API_KEY_ID,
        "Tbk-Api-Key-Secret": TBK_API_KEY_SECRET,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    console.log("🧾 Respuesta de Transbank:", result);

    // Si Transbank respondió con error HTTP
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Error en la confirmación del pago",
          detalle: result,
        }),
        { headers: corsHeaders(), status: response.status },
      );
    }

    // ✅ Devolver respuesta completa (status + datos del pago)
    return new Response(JSON.stringify(result), {
      headers: corsHeaders(),
      status: 200,
    });
  } catch (err) {
    console.error("❌ Error general al confirmar pago:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Error inesperado" }),
      { headers: corsHeaders(), status: 500 },
    );
  }
});
