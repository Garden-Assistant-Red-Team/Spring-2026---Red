import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./firebase";

const messaging = getMessaging(app);

export async function requestNotificationPermission() {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.log("Notifications blocked");
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey: "PASTE_YOUR_PUBLIC_VAPID_KEY_HERE"
  });

  return token;
}

export function listenForForegroundMessages() {
  onMessage(messaging, (payload) => {
    alert(payload.notification.title + "\n" + payload.notification.body);
  });
}