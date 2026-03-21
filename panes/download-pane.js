/**
 * Download Pane — WebRTC peer-to-peer file transfer
 */

export default {
  label: 'Download',
  icon: '\u{1F4E5}',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Action')
  },

  render(subject, store, container) {
    function waitForWrt(cb) {
      if (window._wrt) return cb(window._wrt)
      setTimeout(function() { waitForWrt(cb) }, 50)
    }
    waitForWrt(function(wrt) { renderApp(wrt, container) })
  }
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

function formatSpeed(bps) {
  if (!bps) return '0 KB/s'
  if (bps < 1048576) return Math.round(bps / 1024) + ' KB/s'
  return (bps / 1048576).toFixed(1) + ' MB/s'
}

function renderApp(wrt, container) {
  var style = document.createElement('style')
  style.textContent = [
    '.wrt { max-width: 800px; margin: 0 auto; padding: 20px; font-family: -apple-system, sans-serif; }',
    '.wrt-header { text-align: center; padding: 20px 0; margin-bottom: 20px; }',
    '.wrt-header h1 { font-size: 22px; font-weight: 700; }',
    '.wrt-header .sub { font-size: 12px; color: #999; margin-top: 4px; }',
    '.wrt-card { background: #fff; border: 1px solid #ddd; padding: 16px; margin-bottom: 12px; border-radius: 4px; }',
    '.wrt-card h2 { font-size: 12px; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }',
    '.wrt-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }',
    '.wrt-row:last-child { border-bottom: none; }',
    '.wrt-row .label { color: #888; }',
    '.wrt-row .value { font-weight: 600; font-family: Consolas, monospace; font-size: 12px; }',
    '.wrt-progress { height: 12px; background: #eee; border-radius: 6px; overflow: hidden; margin: 8px 0; }',
    '.wrt-progress-bar { height: 100%; background: linear-gradient(90deg, #5cb85c, #4cae4c); transition: width 0.5s; border-radius: 6px; }',
    '.wrt-input-row { display: flex; gap: 8px; }',
    '.wrt-input { flex: 1; padding: 10px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; font-family: Consolas, monospace; }',
    '.wrt-btn { padding: 10px 24px; background: #5cb85c; color: #fff; border: none; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; }',
    '.wrt-btn:hover { background: #4cae4c; }',
    '.wrt-magnet { font-family: Consolas, monospace; font-size: 10px; color: #999; word-break: break-all; margin-top: 8px; }',
    '.wrt-file { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }',
    '.wrt-file:last-child { border-bottom: none; }',
    '.wrt-file-name { font-size: 13px; word-break: break-all; flex: 1; }',
    '.wrt-file-size { font-size: 11px; color: #888; white-space: nowrap; margin-left: 12px; }',
    '.wrt-file-dl { font-size: 12px; color: #5cb85c; text-decoration: none; font-weight: 600; margin-left: 8px; }',
    '.wrt-pct { font-size: 36px; font-weight: 700; text-align: center; color: #333; margin: 4px 0; }',
    '.wrt-footer { text-align: center; padding: 16px; font-size: 11px; color: #aaa; }',
    '.wrt-footer a { color: #999; }',
    '.wrt-log { font-family: Consolas, monospace; font-size: 11px; color: #888; line-height: 1.6; }',
    'video { width: 100%; border-radius: 4px; margin-top: 12px; }',
  ].join('\n')
  container.appendChild(style)

  var script = document.createElement('script')
  script.src = 'lib/webtorrent.min.js'
  script.onload = function() { initClient(wrt, container) }
  script.onerror = function() {
    var s2 = document.createElement('script')
    s2.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js'
    s2.onload = function() { initClient(wrt, container) }
    document.head.appendChild(s2)
  }
  document.head.appendChild(script)
}

function initClient(wrt, container) {
  var div = document.createElement('div')
  div.className = 'wrt'
  container.appendChild(div)

  var client = null
  var torrent = null
  var logs = []
  var startTime = 0
  var state = {
    phase: 'input',
    magnet: wrt.magnet || '',
  }

  var TRACKERS = [
    'wss://tracker.webtorrent.dev',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
  ]

  function addLog(msg) {
    var now = startTime ? ((Date.now() - startTime) / 1000).toFixed(1) + 's' : '0.0s'
    logs.push(now + ' ' + msg)
    if (logs.length > 20) logs.shift()
  }

  function render() {
    var pct = torrent ? Math.round(torrent.progress * 100) : 0
    var speed = torrent ? torrent.downloadSpeed : 0
    var peers = torrent ? torrent.numPeers : 0
    var downloaded = torrent ? torrent.downloaded : 0
    var uploaded = torrent ? torrent.uploaded : 0
    var totalSize = torrent ? torrent.length : 0
    var name = torrent ? torrent.name : ''
    var files = torrent ? torrent.files : []
    var isDone = state.phase === 'done'

    var html = '<div class="wrt-header">' +
      '<h1>\u{1F4E5} WebRTC File Transfer</h1>' +
      '<div class="sub">Peer-to-peer via WebRTC \u2022 No server required</div>' +
      '</div>'

    // Input
    if (state.phase === 'input') {
      html += '<div class="wrt-card">' +
        '<h2>Magnet Link</h2>' +
        '<div class="wrt-input-row">' +
        '<input class="wrt-input" id="wrt-magnet" type="text" placeholder="magnet:?xt=urn:btih:..." value="' + state.magnet + '" />' +
        '<button class="wrt-btn" id="wrt-go">Download</button>' +
        '</div></div>'
    }

    // Active torrent (connecting, downloading, or done)
    if (state.phase !== 'input') {
      // Main status card — always visible
      html += '<div class="wrt-card">' +
        '<h2>' + (name || 'Connecting...') + '</h2>'

      if (state.phase === 'connecting') {
        var elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
        html += '<div style="text-align:center;padding:16px 0;color:#888">' +
          '<div style="font-size:18px;margin-bottom:8px">\u{1F50D} Finding peers... (' + elapsed + 's)</div>' +
          '<div style="font-size:12px">Connecting to WebRTC trackers. This usually takes 10-30 seconds.</div>' +
          '<div style="font-size:12px;margin-top:4px">Peers found so far: <b>' + peers + '</b></div>' +
          '</div>'
      } else {
        html += '<div class="wrt-pct">' + (isDone ? '\u2705 ' : '') + pct + '%</div>' +
          '<div class="wrt-progress"><div class="wrt-progress-bar" style="width:' + pct + '%"></div></div>'
      }

      html += '<div class="wrt-row"><span class="label">Downloaded</span><span class="value">' + formatSize(downloaded) + (totalSize ? ' / ' + formatSize(totalSize) : '') + '</span></div>' +
        '<div class="wrt-row"><span class="label">Speed</span><span class="value">' + formatSpeed(speed) + '</span></div>' +
        '<div class="wrt-row"><span class="label">Peers</span><span class="value">' + peers + '</span></div>' +
        '<div class="wrt-row"><span class="label">Uploaded</span><span class="value">' + formatSize(uploaded) + '</span></div>' +
        '<div class="wrt-magnet">' + state.magnet + '</div>' +
        '</div>'

      // Files
      if (files.length > 0) {
        html += '<div class="wrt-card"><h2>Files (' + files.length + ')</h2>'
        for (var i = 0; i < files.length; i++) {
          var f = files[i]
          html += '<div class="wrt-file">' +
            '<span class="wrt-file-name">' + f.name + '</span>' +
            '<span class="wrt-file-size">' + formatSize(f.length) + '</span>' +
            '</div>'
        }
        html += '</div>'
      }

      // Activity log — always visible
      html += '<div class="wrt-card"><h2>Activity</h2><div class="wrt-log">' +
        logs.join('<br>') +
        '</div></div>'
    }

    html += '<div class="wrt-footer">WebRTC File Transfer v0.0.1 \u2022 <a href="https://losos.org">LOSOS</a></div>'

    div.innerHTML = html

    var goBtn = document.getElementById('wrt-go')
    if (goBtn) {
      goBtn.onclick = function() {
        var input = document.getElementById('wrt-magnet')
        if (input && input.value) startDownload(input.value)
      }
    }
    var magnetInput = document.getElementById('wrt-magnet')
    if (magnetInput) {
      magnetInput.onkeydown = function(e) {
        if (e.key === 'Enter' && magnetInput.value) startDownload(magnetInput.value)
      }
    }
  }

  function startDownload(magnet) {
    state.phase = 'connecting'
    state.magnet = magnet
    startTime = Date.now()
    logs = []
    addLog('Connecting to WebRTC trackers...')
    addLog('This usually takes 10-30 seconds')
    render()

    if (!client) client = new WebTorrent()

    client.on('error', function(err) { addLog('Error: ' + err.message); render() })

    torrent = client.add(magnet, { announce: TRACKERS })
    addLog('Info hash: ' + torrent.infoHash)
    render()

    torrent.on('warning', function(err) { addLog('Warning: ' + err.message); render() })
    torrent.on('error', function(err) { addLog('Error: ' + err.message); render() })

    torrent.on('wire', function() {
      addLog('Peer connected (' + torrent.numPeers + ' total)')
      addLog('Requesting torrent metadata from peer...')
      render()
    })

    torrent.on('metadata', function() {
      addLog('Metadata received: ' + torrent.name)
      addLog(torrent.files.length + ' files, ' + formatSize(torrent.length))
      addLog('Starting download...')
      state.phase = 'downloading'
      render()
    })

    torrent.on('done', function() {
      addLog('Download complete!')
      state.phase = 'done'
      render()

      torrent.files.forEach(function(file) {
        file.getBlobURL(function(err, url) {
          if (err || !url) return
          // Add save link
          var fileDivs = div.querySelectorAll('.wrt-file')
          fileDivs.forEach(function(fd) {
            var nameSpan = fd.querySelector('.wrt-file-name')
            if (nameSpan && nameSpan.textContent === file.name && !fd.querySelector('.wrt-file-dl')) {
              var a = document.createElement('a')
              a.href = url
              a.download = file.name
              a.textContent = '\u{2B07} Save'
              a.className = 'wrt-file-dl'
              fd.appendChild(a)
            }
          })
          // Video player
          if (file.name.match(/\.(mp4|webm)$/i)) {
            var card = document.createElement('div')
            card.className = 'wrt-card'
            card.innerHTML = '<h2>Preview</h2>'
            var video = document.createElement('video')
            video.src = url
            video.controls = true
            video.style.cssText = 'width:100%;border-radius:4px'
            card.appendChild(video)
            div.querySelector('.wrt-footer').before(card)
          }
        })
      })
    })

    // Tick every second for live feedback, stop when done
    var ticker = setInterval(function() {
      if (state.phase === 'input' || state.phase === 'done') { clearInterval(ticker); return }
      render()
    }, 1000)
  }

  render()

  if (state.magnet && state.magnet.startsWith('magnet:')) {
    startDownload(state.magnet)
  }
}
