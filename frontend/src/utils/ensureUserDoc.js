import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function ensureUserDoc(user) {
  if (!user?.uid) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // If user doc doesn't exist, create it ONCE
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // If it exists, only update fields that actually changed.
  // (Don't touch updatedAt every time.)
  const data = snap.data() || {};
  const email = user.email ?? null;
  const displayName = user.displayName ?? null;

  const needsUpdate =
    (data.email ?? null) !== email || (data.displayName ?? null) !== displayName;

  if (needsUpdate) {
    await setDoc(
      ref,
      {
        email,
        displayName,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
}