const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const db = admin.firestore();

/**
 * GET /api/symptoms/options
 * Returns symptom checklist + observation questions
 */
router.get("/options", async (req, res) => {
  try {
    const [symSnap, obsSnap] = await Promise.all([
      db.collection("symptoms").get(),
      db.collection("observations").get(),
    ]);

    const symptoms = symSnap.docs.map((d) => d.data());
    const observations = obsSnap.docs.map((d) => d.data());

    res.json({ symptoms, observations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load options" });
  }
});

/**
 * POST /api/symptoms/diagnose
 *
 * body:
 * {
 *   plantName?: string,
 *   selectedSymptoms: ["yellow_leaves", ...],
 *   observations: { soil_moisture: "wet", ... }
 * }
 */
router.post("/diagnose", async (req, res) => {
  try {
    const { plantName, selectedSymptoms = [], observations = {} } = req.body;

    const condSnap = await db.collection("conditions").get();
    const conditions = condSnap.docs.map((d) => d.data());

    const symptomSet = new Set(selectedSymptoms);

    const results = conditions.map((cond) => {
      const rules = cond.rules || {};
      const weights = cond.weights || {
        required: 3,
        supporting: 1,
        contradiction: -2,
      };

      let score = 0;
      let maxScore = 0;

      const matchedRequired = [];
      const matchedSupporting = [];
      const matchedContradictions = [];

      // ---- REQUIRED ----
      (rules.requiredAny || []).forEach((r) => {
        maxScore += weights.required;

        let match = false;

        if (r.type === "symptom") {
          match = symptomSet.has(r.id);
        } else if (r.type === "observation") {
          const val = observations[r.id];
          if (r.op === "eq") match = val === r.value;
          else match = Boolean(val);
        }

        if (match) {
          score += weights.required;
          matchedRequired.push(r.id);
        }
      });

      // ---- SUPPORTING ----
      (rules.supportingAny || []).forEach((r) => {
        maxScore += weights.supporting;

        let match = false;

        if (r.type === "symptom") {
          match = symptomSet.has(r.id);
        } else if (r.type === "observation") {
          const val = observations[r.id];
          if (r.op === "eq") match = val === r.value;
          else match = Boolean(val);
        }

        if (match) {
          score += weights.supporting;
          matchedSupporting.push(r.id);
        }
      });

      // ---- CONTRADICTIONS ----
      (rules.contradictionsAny || []).forEach((r) => {
        maxScore += Math.abs(weights.contradiction);

        let match = false;

        if (r.type === "symptom") {
          match = symptomSet.has(r.id);
        } else if (r.type === "observation") {
          const val = observations[r.id];
          if (r.op === "eq") match = val === r.value;
          else match = Boolean(val);
        }

        if (match) {
          score += weights.contradiction;
          matchedContradictions.push(r.id);
        }
      });

      const confidence =
        maxScore > 0 ? Math.max(0, score) / maxScore : 0;

      return {
        id: cond.id,
        name: cond.name,
        category: cond.category,
        score,
        confidence,
        treatment: cond.treatment || [],
        because: {
          matchedRequired,
          matchedSupporting,
          matchedContradictions,
        },
      };
    });

    const sorted = results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    res.json({
      plantName,
      results: sorted,
      disclaimer:
        "Educational guidance only. For severe issues, consult a local extension expert.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Diagnosis failed" });
  }
});

module.exports = router;