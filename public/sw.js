self.addEventListener("push", (event) => {
  const fallbackPayload = {
    body: "A DayStack reminder is ready.",
    icon: "/icon.png",
    tag: "daystack-reminder",
    title: "DayStack",
    url: "/app",
  };

  let payload = fallbackPayload;

  if (event.data) {
    try {
      payload = {
        ...fallbackPayload,
        ...event.data.json(),
      };
    } catch {
      payload = {
        ...fallbackPayload,
        body: event.data.text(),
      };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: payload.badge || "/apple-icon.png",
      body: payload.body,
      data: {
        url: payload.url || "/app",
      },
      icon: payload.icon || "/icon.png",
      tag: payload.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/app", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client && client.url === targetUrl) {
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});
