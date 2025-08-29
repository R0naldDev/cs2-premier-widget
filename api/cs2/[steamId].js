// Vercel Serverless Function: https://vercel.com/docs/functions/serverless-functions
export default async function handler(req, res) {
  // Habilita CORS sencillo:
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { steamId } = req.query;
  if (!steamId) return res.status(400).json({ error: "Missing steamId" });

  // TODO: ajusta al endpoint exacto del Swagger de Leetify si difiere
  const PROFILE_ENDPOINT = `https://api-public.cs-prod.leetify.com/v3/profile?steamId=${encodeURIComponent(steamId)}`;

  try {
    const r = await fetch(PROFILE_ENDPOINT, { headers: { accept: "application/json" } });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).send(text);
    }
    const data = await r.json();

    // === Normalización defensiva del payload ===
    const p = data?.player ?? data ?? {};
    const premier = p?.cs2?.premier ?? p?.premier ?? {};
    const links = p?.links ?? data?.links ?? {};

    // Busca delta (última variación de rating)
    let ratingDelta = null;
    if (premier?.lastDelta != null) ratingDelta = premier.lastDelta;
    if (ratingDelta == null && Array.isArray(p?.recentGames)) {
      ratingDelta = p.recentGames?.[0]?.ratingDelta ?? null;
    }

    const normalized = {
      name: p?.name ?? "",
      avatarUrl: p?.avatarUrl ?? "",
      rating: premier?.rating ?? null,         // CS Rating (Premier)
      rankName: premier?.rankName ?? null,     // Nombre del rango si existe
      ratingDelta: ratingDelta,
      lastMatchAt: p?.lastMatchAt ?? null,
      profileUrl: links?.leetify ?? (p?.profileUrl ?? null)
    };

    // Cachea 60s en el edge/CDN (suficiente para overlay)
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(normalized);

  } catch (e) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
