// api/csstats/[steamId].js
const CLEAN = (s) => s.replace(/\s+/g, " ").trim();
const NUM = (s) => (s ? parseInt(s.replace(/[^\d]/g, ""), 10) : null);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { steamId } = req.query;
  if (!steamId) return res.status(400).json({ error: "Missing steamId" });

  const url = `https://csstats.gg/player/${encodeURIComponent(steamId)}`;

  try {
    const r = await fetch(url, {
      headers: {
        // Finge un navegador normalito (a veces necesario para que no te bloqueen):
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "es-ES,es;q=0.9,en;q=0.8"
      }
    });

    const html = await r.text();
    if (!r.ok) {
      console.error("csstats status", r.status, html.slice(0, 300));
      return res.status(r.status).json({ error: "csstats error", status: r.status });
    }

    // Nombre (title) y avatar (og:image):
    const name = (html.match(/Player statistics - ([^|<]+)\s*\|/i)?.[1] || "").trim();
    const avatarUrl = html.match(/property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/i)?.[1] || "";

    // Texto plano para buscar “Premier - Season X …”
    const text = CLEAN(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    );

    function grabSeason(seasonNumber) {
      const reTwo = new RegExp(
        `Premier\\s*-\\s*Season\\s*${seasonNumber}[\\s\\S]*?S${seasonNumber}[\\s\\S]*?(\\d{3,6}[\\d,]*)[\\s\\S]*?(\\d{3,6}[\\d,]*)`,
        "i"
      );
      const m2 = text.match(reTwo);
      if (m2) return { season: `S${seasonNumber}`, current: NUM(m2[1]), best: NUM(m2[2]) };

      const reOne = new RegExp(
        `Premier\\s*-\\s*Season\\s*${seasonNumber}[\\s\\S]*?(\\d{3,6}[\\d,]*)`,
        "i"
      );
      const m1 = text.match(reOne);
      if (m1) return { season: `S${seasonNumber}`, current: NUM(m1[1]), best: null };

      return null;
      }

    const seasons = [3, 2, 1];
    let picked = null;
    for (const s of seasons) { picked = grabSeason(s); if (picked?.current) break; }

    const normalized = {
      name,
      avatarUrl,
      rating: picked?.current ?? null,
      bestRating: picked?.best ?? null,
      season: picked?.season ?? null,
      profileUrl: url,
      hasData: Boolean(picked?.current),
      used: url
    };

    // Cache 5 min (para no martillar csstats)
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json(normalized);

  } catch (e) {
    console.error("parser exception", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
};
