var params = new URLSearchParams(window.location.search)
window._wrt = {
  magnet: params.get('magnet') || '',
  trackers: [
    'wss://tracker.webtorrent.dev',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
  ],
}
