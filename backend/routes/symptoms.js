const express = require('express');
const router = express.Router();

// POST /api/symptoms
router.post('/', (req, res) => {
  const { plantName, symptoms } = req.body;

  return res.json({
    placeholder: true,
    received: { plantName, symptoms },
    assessment: {
      likelyIssue: "Overwatering (placeholder)",
      confidence: "Low",
      suggestions: [
        "Check soil moisture before watering again.",
        "Ensure drainage is good.",
        "Reduce watering for a few days."
      ]
    }
  });
});

module.exports = router;
