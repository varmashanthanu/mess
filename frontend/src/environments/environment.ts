export const environment = {
  production: false,
  // Relative path — browser sends requests to the same host:port the app was
  // loaded from, so the ng serve proxy can forward them to the backend.
  // Never use http://localhost:8000 here — that resolves on the client machine,
  // not the server, so it breaks for anyone accessing from another device.
  apiUrl: '/api/v1',
  wsUrl: `ws://${window.location.host}/ws`,
  mapTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  defaultCenter: { lat: 14.6928, lng: -17.4467 }, // Dakar, Senegal
  defaultZoom: 12,
};
