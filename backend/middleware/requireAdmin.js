const admin = require("firebase-admin");
const { requireAuth } = require("./auth");

const db = admin.firestore();

async function requireAdmin(req, res, next) {
  try {
    // verify token
    await new Promise((resolve, reject) => {
      requireAuth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const uid = req.user.uid;

    //check admin flag
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(403).json({ error: "User not found" });
    }

    if (!userDoc.data().isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      error: "Unauthorized",
      details: err.message,
    });
  }
}

module.exports = { requireAdmin };