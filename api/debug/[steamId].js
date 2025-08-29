// api/debug/[steamId].js
module.exports = async (req, res) => {
  const { steamId } = req.query;
  if (!steamId) return res.status(400).json({ error: "Missing steamId" });

  const PROFILE_ENDPOINT = `https://api-public.cs-prod.leetify.com/v3/profile?steamId=${encodeURIComponent(steamId)}`;

  try {
    const r = await fetch(PROFILE_ENDPOINT, { headers: { accept: "application/json" } });
    const text = await r.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    // Deja pasar status original y el raw body para inspección:
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
};
