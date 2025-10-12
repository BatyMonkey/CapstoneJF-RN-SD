import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// 🔐 Configuración Transbank Sandbox
const TBK_API_KEY_ID = "597055555532";
const TBK_API_KEY_SECRET =
  "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
const TBK_URL =
  "https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2";

// 🔧 Variables de entorno Supabase
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// 🌐 CORS helper
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json",
  };
}

// 🚀 Función principal
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido. Usa POST." }),
      { headers: corsHeaders(), status: 405 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { token_ws } = body as { token_ws?: string };

    if (!token_ws) {
      return new Response(JSON.stringify({ error: "Falta token_ws" }), {
        headers: corsHeaders(),
        status: 400,
      });
    }

    console.log("📦 Confirmando transacción con token_ws:", token_ws);

    // 1️⃣ Confirmar transacción con Transbank
    const confirmResponse = await fetch(`${TBK_URL}/transactions/${token_ws}`, {
      method: "PUT",
      headers: {
        "Tbk-Api-Key-Id": TBK_API_KEY_ID,
        "Tbk-Api-Key-Secret": TBK_API_KEY_SECRET,
        "Content-Type": "application/json",
      },
    });

    const confirmData = await confirmResponse.json().catch(() => ({}));
    console.log("🧾 Respuesta Transbank:", confirmResponse.status, confirmData);

    if (!confirmResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Error al confirmar transacción con Transbank.",
          detalle: confirmData,
        }),
        { headers: corsHeaders(), status: 400 },
      );
    }

    // 2️⃣ Determinar estado del pago
    const estadoPago =
      confirmData.status === "AUTHORIZED" ? "pagado" : "rechazado";

    // 3️⃣ Actualizar la orden en Supabase usando token_ws
    const updateBody = {
      estado: estadoPago,
      tbk_order_id: confirmData.buy_order ?? null,
      updated_at: new Date().toISOString(),
    };

    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/orden_pago?token_ws=eq.${token_ws}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(updateBody),
      },
    );

    const supabaseData = await supabaseResponse.json().catch(() => ({}));
    console.log(
      "🗃️ Resultado actualización orden_pago:",
      supabaseResponse.status,
      supabaseData,
    );

    // 4️⃣ Responder al frontend
    return new Response(
      JSON.stringify({
        status: confirmData.status,
        authorization_code: confirmData.authorization_code,
        payment_type_code: confirmData.payment_type_code,
        amount: confirmData.amount,
        estado: estadoPago,
      }),
      { headers: corsHeaders(), status: 200 },
    );
  } catch (err: any) {
    console.error("❌ Error general transbank-confirm:", err);
    return new Response(
      JSON.stringify({
        error: "Error interno",
        detalle: err?.message ?? String(err),
      }),
      { headers: corsHeaders(), status: 500 },
    );
  }
});
