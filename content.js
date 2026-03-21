/**
 * Content script — intercepts magnet link clicks on any web page
 */

document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="magnet:"]')
  if (!link) return

  e.preventDefault()
  e.stopPropagation()

  chrome.runtime.sendMessage({ type: 'magnet', url: link.href })
}, true)
