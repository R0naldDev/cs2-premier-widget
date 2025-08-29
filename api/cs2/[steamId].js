// api/cs2/[steamId].js
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { steamId } = req.query;
  if (!steamId) return res.status(400).json({ error: "Missing steamId" });

  // Lista de intentos (endpoints y nombres de parámetro posibles).
  const attempts = [
    // lo que usamos al inicio
    `https://api-public.cs-prod.leetify.com/v3/profile?steamId=${encodeURIComponent(steamId)}`,
    // variantes comunes
    `https://api-public.cs-prod.leetify.com/v3/profile?steamId64=${encodeURIComponent(steamId)}`,
    `https://api-public.cs-prod.leetify.com/v3/profile?id=${encodeURIComponent(steamId)}`,
    // formato tipo "identifiers"
    `https://api-public.cs-prod.leetify.com/v3/profile?identifiers=steamId:${encodeURIComponent(steamId)}`,
    // fallback a otra ruta plausible
    `https://api-public.cs-prod.leetify.com/v3/player?steamId=${encodeURIComponent(steamId)}`
  ];

  let lastStatus = 0, lastBody = "";

  try {
    for (const url of attempts) {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      lastStatus = r.status;
      const text = await r.text();
      lastBody = text;

      // Si responde 200, intentamos parsear y normalizar
      if (r.ok) {
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }
        const p = data?.player ?? data ?? {};
        const premier = p?.cs2?.premier ?? p?.premier ?? {};
        const links = p?.links ?? data?.links ?? {};

        // Si no hay nada de premier/rating, seguimos probando:
        if (premier?.rating == null && attempts[attempts.length - 1] !== url) {
          continue;
        }

        let ratingDelta = null;
        if (premier?.lastDelta != null) ratingDelta = premier.lastDelta;
        if (ratingDelta == null && Array.isArray(p?.recentGames)) {
          ratingDelta = p.recentGames?.[0]?.ratingDelta ?? null;
        }

        const normalized = {
          name: p?.name ?? "",
          avatarUrl: p?.avatarUrl ?? "",
          rating: premier?.rating ?? null,
          rankName: premier?.rankName ?? null,
          ratingDelta,
          lastMatchAt: p?.lastMatchAt ?? null,
          profileUrl: links?.leetify || p?.profileUrl || `https://leetify.com/app/profile/${steamId}`,
          hasData: Boolean(premier?.rating != null),
          used: url
        };

        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30");
        return res.status(200).json(normalized);
      }
    }

    // Si ninguna opción fue 200 o no hubo rating
    console.error("Leetify last response", lastStatus, lastBody?.slice(0, 400));
    return res.status(lastStatus || 502).json({
      error: "Leetify did not return usable data",
      status: lastStatus,
      body: lastBody?.slice(0, 400)
    });
  } catch (e) {
    console.error("Handler exception", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
};
