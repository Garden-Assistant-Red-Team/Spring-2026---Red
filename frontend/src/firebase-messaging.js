import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./firebase";

const messaging = getMessaging(app);

export async function requestNotificationPermission() {
  const vapidKey = (process.env.REACT_APP_FIREBASE_VAPID_KEY || "").trim();

  // Prevent crash if key is missing
  if (!vapidKey) {
    console.warn("FCM disabled: Missing VAPID key.");
    return null;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.log("Notifications blocked");
    return null;
  }

  try {
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
    });

    return token;
  } catch (error) {
    console.warn("Failed to get FCM token:", error);
    return null;
  }
}

export function listenForForegroundMessages() {
  onMessage(messaging, (payload) => {
    alert(
      payload?.notification?.title +
        "\n" +
        payload?.notification?.body
    );
  });
}