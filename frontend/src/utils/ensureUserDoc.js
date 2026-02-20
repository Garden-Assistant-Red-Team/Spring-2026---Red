import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export function ensureUserDoc(user) {
  if (!user?.uid) return Promise.resolve();

  return setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}