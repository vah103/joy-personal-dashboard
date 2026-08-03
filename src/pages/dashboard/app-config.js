window.JoyDashboardConfig = Object.freeze({
  profileName: "Vanh",
  timeZone: "Asia/Ho_Chi_Minh",
  google: Object.freeze({
    clientId: document.querySelector('meta[name="joy-google-client-id"]')?.content || "",
    gmailScope: "https://www.googleapis.com/auth/gmail.readonly",
    gmailApiRoot: "https://gmail.googleapis.com/gmail/v1/users/me",
    inboxUrl: "https://mail.google.com/mail/u/0/#inbox",
  }),
  weather: Object.freeze({
    location: "Hanoi",
    latitude: 21.0285,
    longitude: 105.8542,
    refreshMinutes: 15,
  }),
  refresh: Object.freeze({
    gmailMs: 60_000,
    salesMs: 60_000,
  }),
  seedProjects: Object.freeze([
    Object.freeze({
      id: 1,
      name: "TurtleBot 4",
      progress: 42,
      accent: "slate",
      focus: "Stage 5 · Frontier Detection",
      next: "Implement frontier detection and RViz markers",
    }),
    Object.freeze({
      id: 2,
      name: "IELTS",
      progress: 0,
      accent: "blue",
      focus: "Band 7.0 · December 2026",
      next: "Prepare the August baseline",
    }),
  ]),
});
