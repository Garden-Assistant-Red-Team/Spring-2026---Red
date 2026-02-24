const admin = require("firebase-admin");

/**
 * Requires Authorization: Bearer <FirebaseIdToken>
 * Sets req.user = { uid, email, name }
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return res.status(401).json({ error: "Missing Authorization header (Bearer token required)" });
    }

    const decoded = await admin.auth().verifyIdToken(match[1]);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || decoded.displayName || null,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };