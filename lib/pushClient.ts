import { csrfFetch } from "./csrf-client";

export async function registerWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator))
    return null;
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch (err) {
    console.error("[push] sw register failed", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function bufferToBase64(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return window.btoa(binary);
}

async function getRegistration() {
  const reg = await registerWorker();
  if (!reg) throw new Error("Service worker not available");
  return reg;
}

export async function subscribePush() {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission !== "granted"
  ) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission denied");
    }
  }

  const keyResponse = await fetch("/api/community/push/public-key");
  if (!keyResponse.ok) {
    throw new Error("Failed to load VAPID key");
  }
  const keyJson = (await keyResponse.json()) as { key: string | null };
  const vapidKey = keyJson.key;
  if (!vapidKey) {
    throw new Error("Missing VAPID public key");
  }

  const registration = await getRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const convertedKey = urlBase64ToUint8Array(vapidKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });

  await csrfFetch("/api/community/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: bufferToBase64(subscription.getKey("p256dh")),
      auth: bufferToBase64(subscription.getKey("auth")),
    }),
  });

  return subscription;
}

export async function unsubscribePush() {
  const registration = await registerWorker();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await csrfFetch("/api/community/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

export async function hasSubscription() {
  const registration = await registerWorker();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}
