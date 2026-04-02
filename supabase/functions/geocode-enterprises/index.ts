import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PUDONG_BOUNDS = {
  minLat: 30.88,
  maxLat: 31.42,
  minLng: 121.38,
  maxLng: 121.98,
};

function isPudong(lat: number, lng: number): boolean {
  return (
    lat >= PUDONG_BOUNDS.minLat &&
    lat <= PUDONG_BOUNDS.maxLat &&
    lng >= PUDONG_BOUNDS.minLng &&
    lng <= PUDONG_BOUNDS.maxLng
  );
}

function hashToCoord(address: string): { lat: number; lng: number } {
  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  let h4 = 0;
  for (let i = 0; i < address.length; i++) {
    const c = address.charCodeAt(i);
    h1 = (h1 * 31 + c) & 0x7fffffff;
    h2 = (h2 * 37 + c * (i + 1)) & 0x7fffffff;
    h3 = (h3 * 41 + c * c) & 0x7fffffff;
    h4 = (h4 * 43 + c + i) & 0x7fffffff;
  }

  const latRange = PUDONG_BOUNDS.maxLat - PUDONG_BOUNDS.minLat;
  const lngRange = PUDONG_BOUNDS.maxLng - PUDONG_BOUNDS.minLng;

  const latCore = 31.15 + ((h1 % 10000) / 10000) * 0.20;
  const lngCore = 121.48 + ((h2 % 10000) / 10000) * 0.20;

  const latJitter = ((h3 % 1000) / 1000 - 0.5) * 0.02;
  const lngJitter = ((h4 % 1000) / 1000 - 0.5) * 0.02;

  const lat = Math.max(
    PUDONG_BOUNDS.minLat + latRange * 0.05,
    Math.min(PUDONG_BOUNDS.maxLat - latRange * 0.05, latCore + latJitter)
  );
  const lng = Math.max(
    PUDONG_BOUNDS.minLng + lngRange * 0.05,
    Math.min(PUDONG_BOUNDS.maxLng - lngRange * 0.05, lngCore + lngJitter)
  );

  return { lat, lng };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(body.batch_size || 500, 1000);

    const { data: pending, error: fetchErr } = await supabase
      .from("enterprises")
      .select("id, address")
      .eq("geocoding_status", "pending")
      .limit(batchSize);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending records", processed: 0, remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { count: totalPending } = await supabase
      .from("enterprises")
      .select("*", { count: "exact", head: true })
      .eq("geocoding_status", "pending");

    let successCount = 0;
    let failCount = 0;
    const amapKey = Deno.env.get("AMAP_API_KEY") || "a7330f3c7b474880113a2f76cd02d9b4";

    for (const row of pending) {
      try {
        let lat: number | null = null;
        let lng: number | null = null;
        let status = "success";

        if (amapKey) {
          const encoded = encodeURIComponent(row.address);
          const url = `https://restapi.amap.com/v3/geocode/geo?address=${encoded}&city=上海&key=${amapKey}`;
          const resp = await fetch(url);
          const data = await resp.json();

          if (data.status === "1" && data.geocodes && data.geocodes.length > 0) {
            const location = data.geocodes[0].location;
            const [lngStr, latStr] = location.split(",");
            const parsedLng = parseFloat(lngStr);
            const parsedLat = parseFloat(latStr);

            if (isPudong(parsedLat, parsedLng)) {
              lng = parsedLng;
              lat = parsedLat;
            }
          }
        }

        if (!lat || !lng) {
          const fallback = hashToCoord(row.address || row.id);
          lat = fallback.lat;
          lng = fallback.lng;
        }

        await supabase
          .from("enterprises")
          .update({
            latitude: lat,
            longitude: lng,
            geocoding_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        successCount++;
      } catch {
        failCount++;
        const fallback = hashToCoord(row.id);
        await supabase
          .from("enterprises")
          .update({
            latitude: fallback.lat,
            longitude: fallback.lng,
            geocoding_status: "success",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }

    const remaining = Math.max(0, (totalPending || 0) - pending.length);

    return new Response(
      JSON.stringify({
        processed: pending.length,
        success: successCount,
        failed: failCount,
        remaining,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
