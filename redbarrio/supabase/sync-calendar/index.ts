import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.15.4/index.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getAccessToken() {
  const credentials = JSON.parse(Deno.env.get("GOOGLE_CREDENTIALS")!);
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new jose.SignJWT({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256" })
    .sign(await jose.importPKCS8(credentials.private_key, "RS256"));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const json = await res.json();
  return json.access_token;
}

Deno.serve(async () => {
  try {
    const { data, error } = await supabase.from("calendario_integrado").select("*");

    if (error) throw error;

    const token = await getAccessToken();

    // 👇 ESTE es tu calendario real
    const calendarId =
      "8abcba30888047dd15f93d7dfc0b3edf0aa8bea55be29a4171886e81b2262f33@group.calendar.google.com";

    let count = 0;

    for (const row of data ?? []) {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: `[${row.tipo}] ${row.titulo}`,
            description: row.descripcion,
            start: { dateTime: row.fecha_inicio },
            end: { dateTime: row.fecha_fin },
          }),
        }
      );

      if (response.ok) {
        count++;
      } else {
        console.error("❌ Error creando evento:", await response.text());
      }
    }

    return new Response(JSON.stringify({ synced: count }), {
      status: 200,
    });
  } catch (err) {
    console.error("Error general:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});
