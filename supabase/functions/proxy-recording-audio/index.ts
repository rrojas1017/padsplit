import { corsHeaders, requireUser, STAFF } from "../_shared/auth.ts";
import { isAllowedRecordingUrl, safeRecordingFetch } from "../_shared/url.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req, STAFF);
    if (!auth.ok) return auth.response;

    // Get bookingId from query params
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("bookingId");
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "bookingId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read with the caller's own client so row-level access rules apply
    const { data: booking, error: bookingError } = await auth.ctx.userClient
      .from("bookings")
      .select("kixie_link")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking?.kixie_link || !isAllowedRecordingUrl(booking.kixie_link)) {
      return new Response(JSON.stringify({ error: "No recording found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch audio from the upstream URL server-side
    const audioResponse = await safeRecordingFetch(booking.kixie_link);
    if (!audioResponse.ok) {
      console.error(`Upstream fetch failed: ${audioResponse.status} ${audioResponse.statusText}`);
      return new Response(JSON.stringify({ error: "Failed to fetch recording" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine content type from upstream — normalize anything that isn't a
    // playable audio/* MIME (e.g. Vici returns "application/forcedownload")
    // to audio/mpeg so the browser <audio> element can play it.
    const upstreamType = audioResponse.headers.get("Content-Type") || "";
    const contentType = upstreamType.toLowerCase().startsWith("audio/")
      ? upstreamType
      : "audio/mpeg";

    // Stream the audio back to the client
    return new Response(audioResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
