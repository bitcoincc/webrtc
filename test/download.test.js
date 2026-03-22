/**
 * Download tests — break the problem into testable units
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createHash } from 'crypto'

const INFOHASH = 'd17fd54e591e4e42434c1695b3f4c50f249552fd'
const WELL_KNOWN_PATH = '/.well-known/webrtc/' + INFOHASH + '/headers.bin'
const SERVERS = [
  'https://melvin.me',
  'https://melvincarvalho.com',
]
const TORRENT_URL = 'https://melvin.me/melvin/public/btc-headers.torrent'
const EXPECTED_SIZE = 71800000 // approximately 72 MB
const TRACKER_URL = 'wss://melvin.me/.webrtc'

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

describe('Unit 1: HTTP fetch from each server', () => {
  for (const server of SERVERS) {
    it('should fetch headers.bin from ' + server, async () => {
      const url = server + WELL_KNOWN_PATH
      const res = await fetch(url, { method: 'HEAD' })
      assert.strictEqual(res.status, 200, url + ' should return 200')
      const contentLength = parseInt(res.headers.get('content-length') || '0')
      console.log('    ' + server + ': ' + contentLength + ' bytes')
      assert.ok(contentLength > EXPECTED_SIZE * 0.9, 'Should be approximately 72 MB')
    })
  }

  it('should get same content from both servers', async () => {
    // Fetch first 1000 bytes from each and compare
    const results = await Promise.all(SERVERS.map(async function(server) {
      const res = await fetch(server + WELL_KNOWN_PATH, { headers: { 'Range': 'bytes=0-999' } })
      return Buffer.from(await res.arrayBuffer())
    }))
    assert.strictEqual(sha256(results[0]), sha256(results[1]), 'First 1000 bytes should be identical')
    console.log('    First 1000 bytes match: ' + sha256(results[0]).slice(0, 16) + '...')
  })
})

describe('Unit 2: Verify downloaded headers', () => {
  it('should have correct genesis in first 80 bytes', async () => {
    const res = await fetch(SERVERS[0] + WELL_KNOWN_PATH, { headers: { 'Range': 'bytes=0-79' } })
    const buf = Buffer.from(await res.arrayBuffer())
    assert.strictEqual(buf.length, 80, 'Should get 80 bytes')

    // Genesis prevHash should be all zeros (bytes 4-36)
    const prevHash = buf.slice(4, 36)
    assert.ok(prevHash.every(b => b === 0), 'Genesis prevHash should be zeros')

    // SHA256d of genesis header should match known hash
    const hash = createHash('sha256').update(
      createHash('sha256').update(buf).digest()
    ).digest()
    const hashHex = Buffer.from(hash).reverse().toString('hex')
    console.log('    Genesis hash: ' + hashHex)
    // Bitcoin genesis hash
    assert.ok(hashHex.startsWith('000000000019d6'), 'Should match Bitcoin genesis hash prefix')
  })

  it('should have valid header linkage at block 1', async () => {
    // Fetch first two headers (160 bytes)
    const res = await fetch(SERVERS[0] + WELL_KNOWN_PATH, { headers: { 'Range': 'bytes=0-159' } })
    const buf = Buffer.from(await res.arrayBuffer())

    const header0 = buf.slice(0, 80)
    const header1 = buf.slice(80, 160)

    // Hash of header 0
    const hash0 = createHash('sha256').update(
      createHash('sha256').update(header0).digest()
    ).digest()
    const hash0Hex = Buffer.from(hash0).reverse().toString('hex')

    // prevHash of header 1 (bytes 4-36)
    const prevHash1 = Buffer.from(header1.slice(4, 36)).reverse().toString('hex')

    console.log('    Block 0 hash:     ' + hash0Hex.slice(0, 24) + '...')
    console.log('    Block 1 prevHash: ' + prevHash1.slice(0, 24) + '...')
    assert.strictEqual(prevHash1, hash0Hex, 'Block 1 prevHash should equal block 0 hash')
  })
})

describe('Unit 3: .torrent file', () => {
  it('should fetch .torrent file', async () => {
    const res = await fetch(TORRENT_URL)
    assert.strictEqual(res.status, 200)
    const buf = Buffer.from(await res.arrayBuffer())
    assert.ok(buf.length > 1000, 'Torrent file should be > 1KB')
    console.log('    .torrent size: ' + buf.length + ' bytes')
  })
})

describe('Unit 4: .well-known path convention', () => {
  for (const server of SERVERS) {
    it('should serve at .well-known/webrtc/<hash>/ on ' + server, async () => {
      const res = await fetch(server + WELL_KNOWN_PATH)
      assert.strictEqual(res.status, 200)
      const cors = res.headers.get('access-control-allow-origin')
      assert.strictEqual(cors, '*', 'Should have CORS headers')
      console.log('    ' + server + ': OK, CORS: ' + cors)
    })
  }

  it('should support Range requests', async () => {
    const res = await fetch(SERVERS[0] + WELL_KNOWN_PATH, { headers: { 'Range': 'bytes=0-79' } })
    assert.ok(res.status === 206 || res.status === 200, 'Should support range requests')
    console.log('    Range request status: ' + res.status)
  })
})

describe('Unit 5: JSS WebRTC tracker', () => {
  it('should connect to tracker via WebSocket', async () => {
    const { WebSocket } = await import('ws')
    const ws = new WebSocket(TRACKER_URL)

    const connected = await new Promise((resolve) => {
      ws.on('open', () => resolve(true))
      ws.on('error', () => resolve(false))
      setTimeout(() => resolve(false), 5000)
    })

    assert.ok(connected, 'Should connect to tracker')
    console.log('    Tracker connected: ' + TRACKER_URL)
    ws.close()
  })
})
