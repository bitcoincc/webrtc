/**
 * Background service worker — intercepts magnet links
 */

// Listen for navigation to magnet: URIs
chrome.webNavigation?.onBeforeNavigate?.addListener(function(details) {
  if (details.url && details.url.startsWith('magnet:')) {
    var clientUrl = chrome.runtime.getURL('client.html') + '?magnet=' + encodeURIComponent(details.url)
    chrome.tabs.update(details.tabId, { url: clientUrl })
  }
}, { url: [{ urlPrefix: 'magnet:' }] })

// Also handle clicks on the extension icon — open client
chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: chrome.runtime.getURL('client.html') })
})
