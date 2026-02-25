export const environment = {
  production: true,
  apiUrl: '/api/v1',
  wsUrl: `wss://${window.location.host}/ws`,
  mapTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  defaultCenter: { lat: 14.6928, lng: -17.4467 },
  defaultZoom: 12,
};
