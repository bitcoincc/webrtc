/**
 * Background service worker — opens client page for magnet links
 */

chrome.runtime.onMessage.addListener(function(msg, sender) {
  if (msg.type === 'magnet' && msg.url) {
    var clientUrl = chrome.runtime.getURL('client.html') + '?magnet=' + msg.url
    chrome.tabs.create({ url: clientUrl })
  }
})

chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: chrome.runtime.getURL('client.html') })
})
