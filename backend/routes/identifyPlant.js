// backend/routes/identifyPlant.js
const express = require("express");
const multer = require("multer");
const axios = require("axios");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, 
});

function bufferToBase64(buffer) {
  return buffer.toString("base64");
}

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded. Use form-data field name 'image'." });
    }

    const apiKey = process.env.PLANT_ID_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing PLANT_ID_API_KEY in backend/.env" });
    }

    const base64 = bufferToBase64(req.file.buffer);

    const payload = {
      images: [base64],
      modifiers: ["crops_fast", "similar_images"],
      plant_language: "en",
      plant_details: ["common_names", "wiki_description", "taxonomy"],
    };

    const response = await axios.post(
      "https://api.plant.id/v3/identification",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Api-Key": apiKey,
        },
        timeout: 30000,
      }
    );

    const data = response.data;

    const suggestions = (data?.result?.classification?.suggestions || data?.result?.suggestions || [])
      .slice(0, 5)
      .map((s) => ({
        name: s?.name || s?.plant_name || "Unknown",
        probability: s?.probability ?? s?.confidence ?? null,
        commonNames: s?.details?.common_names || [],
        taxonomy: s?.details?.taxonomy || null,
        wikiDescription: s?.details?.wiki_description?.value || null,
      }));

    return res.json({
      rawId: data?.id || null,
      suggestions,
    });
  } catch (err) {

    const msg =
      err?.response?.data
        ? JSON.stringify(err.response.data)
        : err?.message || "Unknown error";

    return res.status(500).json({
      error: "Plant identification failed",
      details: msg,
    });
  }
});

module.exports = router;