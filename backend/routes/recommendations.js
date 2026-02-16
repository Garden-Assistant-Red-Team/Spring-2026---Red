const express = require('express');
const router = express.Router();

// GET /api/recommendations?zone=7b&sun=full
router.get('/', (req, res) => {
  const { zone, sun } = req.query;

  return res.json({
    placeholder: true,
    inputs: { zone: zone || null, sun: sun || null },
    recommendations: [
      { name: "Basil", reason: "Easy starter herb and grows well in warm zones." },
      { name: "Tomato", reason: "Good for sunny spots and common home gardens." },
      { name: "Mint", reason: "Hardy and beginner friendly (keep in pot!)." }
    ]
  });
});

module.exports = router;
