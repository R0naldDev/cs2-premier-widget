// api/csstats/[steamId].js
// Proxy superligero que lee tu perfil público en csstats.gg y extrae CS Rating (Premier).
// Nota: uso personal; respetemos ToS de csstats.gg (baja frecuencia y atribución).
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
    const r = await fetch(url, { headers: { "accept": "text/html" } });
    const html = await r.text();
    if (!r.ok) {
      console.error("csstats status", r.status, html.slice(0, 300));
      return res.status(r.status).json({ error: "csstats error", status: r.status });
    }

    // ---- nombre (title) y avatar (og:image) ----
    const name = (html.match(/Player statistics - ([^|<]+)\s*\|/i)?.[1] || "").trim();
    const avatarUrl = html.match(/property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/i)?.[1] || "";

    // Quitamos tags para buscar en texto plano (como el snippet que ves si deshabilitas CSS)
    const text = CLEAN(html.replace(/<script[\s\S]*?<\/script>/gi, " ")
                           .replace(/<style[\s\S]*?<\/style>/gi, " ")
                           .replace(/<[^>]+>/g, " "));

    // ---- Extrae rating por temporada (S3 -> S2 -> S1). Tomamos la primera con números. ----
    function grabSeason(seasonNumber) {
      // patrón: "Premier - Season X ... S{X} ... <current> ... <best>"
      // muy tolerante a distancias/espacios
      const reTwo = new RegExp(
        `Premier\\s*-\\s*Season\\s*${seasonNumber}[\\s\\S]*?S${seasonNumber}[\\s\\S]*?(\\d{3,6}[\\d,]*)[\\s\\S]*?(\\d{3,6}[\\d,]*)`,
        "i"
      );
      const m2 = text.match(reTwo);
      if (m2) return { season: `S${seasonNumber}`, current: NUM(m2[1]), best: NUM(m2[2]) };

      // fallback: al menos un número tras el encabezado
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
    for (const s of seasons) {
      picked = grabSeason(s);
      if (picked && picked.current) break;
    }

    const normalized = {
      name,
      avatarUrl,
      rating: picked?.current ?? null,      // CS Rating actual (de la temporada más reciente con datos)
      bestRating: picked?.best ?? null,     // Pico de esa temporada si aparece
      season: picked?.season ?? null,
      profileUrl: url,
      hasData: Boolean(picked?.current),
      used: url
    };

    // Cache: 5 minutos en edge + SWR para no martillar a csstats (respeta ToS)
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=300");
    return res.status(200).json(normalized);

  } catch (e) {
    console.error("parser exception", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
};
