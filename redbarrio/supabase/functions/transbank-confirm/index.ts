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

// 🌐 Helper CORS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

// 🧩 HTML intermedio SIN JS, con meta refresh hacia la app
function renderDeepLinkHtml(token_ws: string) {
  const deepLink = `capacitor://localhost/pago-retorno?token_ws=${encodeURIComponent(
    token_ws,
  )}`;
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Redirigiendo a la aplicación...</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Redirección automática a la app -->
    <meta http-equiv="refresh" content="0;url=${deepLink}">
    <style>
      body { font-family: system-ui, -apple-system, Arial, sans-serif; text-align:center; margin-top:3rem; color:#333; }
      .loader { border:6px solid #f3f3f3; border-top:6px solid #3b82f6; border-radius:50%; width:40px; height:40px; animation:spin 1s linear infinite; margin:1rem auto; }
      @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      a { color:#3b82f6; text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="loader"></div>
    <h3>Procesando pago…</h3>
    <p>Si no se abre la app automáticamente, toca este enlace:</p>
    <p><a href="${deepLink}">Volver a RedBarrio</a></p>
  </body>
</html>`;
}

// 🧱 Helper: actualizar la ÚLTIMA orden en orden_pago con token_ws + estado
async function actualizarOrdenEnSupabase(
  token_ws: string,
  estadoPago: string,
  confirmData: any,
) {
  try {
    // 1) Obtener la última orden por id_orden (desc)
    const selectUrl =
      `${SUPABASE_URL}/rest/v1/orden_pago?select=id_orden&order=id_orden.desc&limit=1`;

    const selectRes = await fetch(selectUrl, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const filas = await selectRes.json().catch(() => []);
    console.log("🗃️ select última orden:", selectRes.status, filas);

    if (!Array.isArray(filas) || filas.length === 0) {
      console.warn("⚠️ No se encontró ninguna orden_pago para actualizar");
      return;
    }

    const idOrden = filas[0].id_orden;
    console.log("👉 Actualizando id_orden =", idOrden);

    // 2) PATCH a esa fila
    const updateBody = {
      estado: estadoPago,
      tbk_order_id: confirmData?.buy_order ?? null,
      token_ws: token_ws,
      updated_at: new Date().toISOString(),
    };

    const patchUrl =
      `${SUPABASE_URL}/rest/v1/orden_pago?id_orden=eq.${idOrden}`;

    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(updateBody),
    });

    const patchData = await patchRes.json().catch(() => []);
    console.log(
      "🗃️ PATCH orden_pago result:",
      patchRes.status,
      patchData,
    );
  } catch (e) {
    console.error("❌ Error al actualizar orden_pago en Supabase:", e);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const url = new URL(req.url);
    const tokenFromGet = url.searchParams.get("token_ws");

    // ─────────────────────────────────────────────
    // 🔹 CASO 1: Retorno GET desde Transbank
    // ─────────────────────────────────────────────
    if (tokenFromGet && req.method === "GET") {
      const token_ws = tokenFromGet;
      console.log("🔁 Retorno GET desde Transbank:", token_ws);

      // 1) Confirmar transacción con Transbank
      const confirmResponse = await fetch(
        `${TBK_URL}/transactions/${token_ws}`,
        {
          method: "PUT",
          headers: {
            "Tbk-Api-Key-Id": TBK_API_KEY_ID,
            "Tbk-Api-Key-Secret": TBK_API_KEY_SECRET,
            "Content-Type": "application/json",
          },
        },
      );

      const confirmData = await confirmResponse.json().catch(() => ({}));
      console.log(
        "🧾 Respuesta Transbank (GET):",
        confirmResponse.status,
        confirmData,
      );

      const estadoPago = confirmData?.status === "AUTHORIZED"
        ? "pagado"
        : "rechazado";

      // 2) Actualizar última orden en Supabase (best effort)
      await actualizarOrdenEnSupabase(token_ws, estadoPago, confirmData);

      // 3) Devolver HTML con meta-refresh hacia la app
      const html = renderDeepLinkHtml(token_ws);
      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          ...corsHeaders(),
        },
      });
    }

    // ─────────────────────────────────────────────
    // 🔹 CASO 2: Confirmación POST desde la app
    // ─────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { token_ws } = body as { token_ws?: string };

      if (!token_ws) {
        return new Response(JSON.stringify({ error: "Falta token_ws" }), {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          status: 400,
        });
      }

      console.log("📦 Confirmando transacción con token_ws (POST):", token_ws);

      // 1) Confirmar transacción con Transbank
      const confirmResponse = await fetch(
        `${TBK_URL}/transactions/${token_ws}`,
        {
          method: "PUT",
          headers: {
            "Tbk-Api-Key-Id": TBK_API_KEY_ID,
            "Tbk-Api-Key-Secret": TBK_API_KEY_SECRET,
            "Content-Type": "application/json",
          },
        },
      );

      const confirmData = await confirmResponse.json().catch(() => ({}));
      console.log(
        "🧾 Respuesta Transbank (POST):",
        confirmResponse.status,
        confirmData,
      );

      if (!confirmResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "Error al confirmar transacción",
            detalle: confirmData,
          }),
          {
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
            status: 400,
          },
        );
      }

      const estadoPago = confirmData.status === "AUTHORIZED"
        ? "pagado"
        : "rechazado";

      // 2) Actualizar última orden en Supabase con token_ws
      await actualizarOrdenEnSupabase(token_ws, estadoPago, confirmData);

      // 3) Responder JSON a la app
      return new Response(
        JSON.stringify({
          status: confirmData.status,
          authorization_code: confirmData.authorization_code,
          payment_type_code: confirmData.payment_type_code,
          amount: confirmData.amount,
          estado: estadoPago,
          buy_order: confirmData.buy_order ?? null,
          transaction_date: confirmData.transaction_date ?? null,
          card_detail: confirmData.card_detail ?? null,
        }),
        {
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // 🚫 Método no permitido
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      status: 405,
    });
  } catch (err: any) {
    console.error("❌ Error general transbank-confirm:", err);
    return new Response(
      JSON.stringify({
        error: "Error interno",
        detalle: err?.message ?? String(err),
      }),
      {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
