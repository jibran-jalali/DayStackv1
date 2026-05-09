import { requestJson } from "@/lib/client/request";

export type PushSupportState = "blocked" | "configured" | "denied" | "unsupported";

function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function getPushSupportState(): PushSupportState {
  if (!getVapidPublicKey()) {
    return "blocked";
  }

  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  if (window.Notification.permission === "denied") {
    return "denied";
  }

  return "configured";
}

async function getServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration("/");

  if (existingRegistration) {
    return existingRegistration;
  }

  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
}

export async function getCurrentPushSubscription() {
  const registration = await getServiceWorkerRegistration();

  return registration.pushManager.getSubscription();
}

export async function subscribeToPushReminders() {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    throw new Error("Push notifications are not configured on this deployment.");
  }

  const supportState = getPushSupportState();

  if (supportState === "unsupported") {
    throw new Error("This browser does not support web push notifications.");
  }

  if (supportState === "denied") {
    throw new Error("Notifications are blocked for this site. Enable them in browser settings first.");
  }

  const permission = await window.Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await getServiceWorkerRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(publicKey),
      userVisibleOnly: true,
    }));

  await requestJson<{ subscription: { id: string } }>(
    "/api/push/subscriptions",
    {
      body: JSON.stringify(subscription.toJSON()),
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    },
    "Push subscription could not be saved.",
  );

  return subscription;
}

export async function unsubscribeFromPushReminders() {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    return;
  }

  await requestJson<{ ok: boolean }>(
    "/api/push/subscriptions",
    {
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      method: "DELETE",
    },
    "Push subscription could not be removed.",
  );

  await subscription.unsubscribe();
}

export async function sendTestPushNotification() {
  const subscription = await getCurrentPushSubscription();

  if (!subscription) {
    throw new Error("Enable push reminders on this device before sending a test.");
  }

  await requestJson<{ message: string }>(
    "/api/push/test",
    {
      credentials: "same-origin",
      method: "POST",
    },
    "Test push could not be sent.",
  );
}
