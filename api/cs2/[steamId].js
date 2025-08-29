// api/cs2/[steamId].js
module.exports = async (req, res) => {
  const { steamId } = req.query;
  if (!steamId) return res.status(400).json({ error: "Missing steamId" });

  const PROFILE_ENDPOINT = `https://api-public.cs-prod.leetify.com/v3/profile?steamId=${encodeURIComponent(steamId)}`;

  try {
    const r = await fetch(PROFILE_ENDPOINT, { headers: { accept: "application/json" } });
    const text = await r.text();
    if (!r.ok) {
      console.error("Leetify error", r.status, text);
      return res.status(r.status).json({ error: "Leetify responded with error", status: r.status, body: text });
    }
    const data = JSON.parse(text);
    const p = data?.player ?? data ?? {};
    const premier = p?.cs2?.premier ?? p?.premier ?? {};
    const links = p?.links ?? data?.links ?? {};
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
      hasData: Boolean(premier?.rating != null)
    };
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30");
    return res.status(200).json(normalized);

  } catch (e) {
    console.error("Handler exception", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
};

