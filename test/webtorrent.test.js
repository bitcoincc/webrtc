/**
 * WebTorrent tests — test actual magnet link download via WebTorrent
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

const MAGNET_EPOCH = 'magnet:?xt=urn:btih:b037539bb5b50aad9d4720cd4637ad688349a6bf&dn=headers.bin&tr=wss://melvin.me/.webrtc&tr=wss://tracker.openwebtorrent.com'
const EXPECTED_SIZE = 75312000

describe('WebTorrent: magnet link download', () => {
  it('should download headers via magnet link with epoch pieces', async () => {
    const WebTorrent = (await import('/tmp/node_modules/webtorrent/index.js')).default
    const client = new WebTorrent()

    const t0 = Date.now()
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout after 120s')), 120000)

      const torrent = client.add(MAGNET_EPOCH)

      torrent.on('metadata', () => {
        const tMeta = ((Date.now() - t0) / 1000).toFixed(1)
        console.log('    Metadata received: ' + tMeta + 's — ' + torrent.name + ' (' + torrent.pieces.length + ' pieces, ' + torrent.pieceLength + ' bytes each)')
      })

      torrent.on('wire', () => {
        const tPeer = ((Date.now() - t0) / 1000).toFixed(1)
        console.log('    Peer connected: ' + tPeer + 's (' + torrent.numPeers + ' total)')
      })

      torrent.on('done', () => {
        clearTimeout(timeout)
        const ms = Date.now() - t0
        resolve({ ms, size: torrent.length, peers: torrent.numPeers, pieces: torrent.pieces.length })
        client.destroy()
      })

      torrent.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
        client.destroy()
      })
    })

    const mbps = (result.size / 1048576) / (result.ms / 1000)
    console.log('    Done: ' + result.size + ' bytes in ' + result.ms + 'ms (' + mbps.toFixed(1) + ' MB/s) peers: ' + result.peers)
    assert.ok(result.size >= EXPECTED_SIZE * 0.9, 'Should download ~72 MB')
    assert.ok(result.ms < 120000, 'Should complete within 120s')
  })
})
