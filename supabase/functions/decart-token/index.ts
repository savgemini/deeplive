import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read the Decart API key from the settings table using the service role key
    const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/settings?select=decart_api_key,decart_api_keys&limit=1`, {
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
    });

    if (!settingsResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Could not read Decart API key from settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settingsData = await settingsResponse.json() as Array<{ decart_api_key?: string | null; decart_api_keys?: string[] | null }>;
    const apiKeys = Array.from(
      new Set(
        [
          ...(Array.isArray(settingsData[0]?.decart_api_keys) ? settingsData[0].decart_api_keys : []),
          settingsData[0]?.decart_api_key,
        ]
          .filter((key): key is string => typeof key === "string")
          .map((key) => key.trim())
          .filter(Boolean)
      )
    );

    if (apiKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: "Decart API key not configured in settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const expiresIn = Math.min(Math.max(body.expiresIn ?? 3600, 1), 3600);
    const allowedModels = body.allowedModels ?? ["lucy-2.1"];

    let lastError: { status: number; error: string; details?: unknown } | null = null;

    for (const apiKey of apiKeys) {
      const tokenResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          expiresIn,
          allowedModels,
        }),
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        return new Response(
          JSON.stringify(tokenData),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await tokenResponse.text();
      let parsedError: unknown = null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        parsedError = null;
      }

      const message =
        (typeof parsedError === "object" && parsedError !== null && "error" in parsedError && typeof (parsedError as { error?: unknown }).error === "string"
          ? (parsedError as { error: string }).error
          : (typeof parsedError === "object" && parsedError !== null && "message" in parsedError && typeof (parsedError as { message?: unknown }).message === "string"
            ? (parsedError as { message: string }).message
            : errorText || `Decart API error: ${tokenResponse.status}`));

      lastError = {
        status: tokenResponse.status,
        error: message,
        details: parsedError ?? errorText,
      };

      const lowerError = message.toLowerCase();
      const isKeyExhausted = /insufficient|credit|quota|limit|balance/.test(lowerError);
      const isKeyInvalid = /invalid.*key|unauthorized|forbidden|not allowed|bad api/.test(lowerError);

      if (!isKeyExhausted && !isKeyInvalid) {
        break;
      }
    }

    if (lastError) {
      return new Response(
        JSON.stringify({ error: `Decart API error: ${lastError.status}`, details: lastError.error }),
        { status: lastError.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Decart API key not configured in settings" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
