const express = require("express");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing image file (field name must be 'image')." });
    }

    const apiKey = process.env.PLANT_ID_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing PLANT_ID_API_KEY in backend .env" });
    }

    const base64 = req.file.buffer.toString("base64");
    const plantIdRes = await fetch("https://plant.id/api/v3/identification", {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        images: [base64],
   
        similar_images: true,
      }),
    });

    const contentType = plantIdRes.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await plantIdRes.text();
      return res.status(502).json({
        error: "Plant.id returned non-JSON",
        snippet: text.slice(0, 200),
      });
    }

    const raw = await plantIdRes.json();

    const isPlant = raw?.result?.is_plant?.binary ?? null;

    const suggestions = (raw?.result?.classification?.suggestions || []).map((s) => ({
      name: s?.name || "",
      probability: s?.probability ?? 0,
      details: {
        common_names: s?.details?.common_names || [],
        url: s?.details?.url || "",
      },
    }));

    return res.json({ isPlant, suggestions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Identify failed" });
  }
});

module.exports = router;