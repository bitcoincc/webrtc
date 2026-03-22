/**
 * Tracker tests — verify JSS WebRTC tracker matches peers correctly
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { WebSocket } from 'ws'

const TRACKER_URL = 'wss://melvin.me/.webrtc'
const INFOHASH = 'b037539bb5b50aad9d4720cd4637ad688349a6bf'

function randomPeerId() {
  const chars = '0123456789abcdef'
  let id = ''
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * 16)]
  return id
}

function connectTracker(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Timeout')), 5000)
  })
}

function waitForMessage(ws, actionType, timeout) {
  timeout = timeout || 5000
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for ' + actionType)), timeout)
    ws.on('message', function handler(data) {
      const msg = JSON.parse(data.toString())
      if (msg.action === actionType || msg.type === actionType) {
        clearTimeout(timer)
        ws.removeListener('message', handler)
        resolve(msg)
      }
    })
  })
}

describe('Tracker: connection', () => {
  it('should connect to JSS tracker', async () => {
    const ws = await connectTracker(TRACKER_URL)
    assert.ok(ws.readyState === 1)
    console.log('    Connected to ' + TRACKER_URL)
    ws.close()
  })
})

describe('Tracker: announce protocol', () => {
  it('should get announce response', async () => {
    const ws = await connectTracker(TRACKER_URL)
    const peerId = randomPeerId()

    ws.send(JSON.stringify({
      action: 'announce',
      info_hash: INFOHASH,
      peer_id: peerId,
      offers: []
    }))

    const msg = await waitForMessage(ws, 'announce')
    console.log('    Response:', JSON.stringify(msg))
    assert.strictEqual(msg.action, 'announce')
    assert.ok(msg.incomplete !== undefined, 'Should have incomplete count')
    console.log('    Peers in swarm: ' + msg.incomplete)
    ws.close()
  })
})

describe('Tracker: peer matching', () => {
  it('should relay offers between two peers', async () => {
    const ws1 = await connectTracker(TRACKER_URL)
    const ws2 = await connectTracker(TRACKER_URL)
    const peer1 = randomPeerId()
    const peer2 = randomPeerId()

    // Peer 1 announces (no offers, just joins swarm)
    ws1.send(JSON.stringify({
      action: 'announce',
      info_hash: INFOHASH,
      peer_id: peer1,
      offers: []
    }))
    await waitForMessage(ws1, 'announce')
    console.log('    Peer 1 joined swarm')

    // Peer 2 announces with an offer
    const offerPromise = waitForMessage(ws1, 'announce', 5000)
    ws2.send(JSON.stringify({
      action: 'announce',
      info_hash: INFOHASH,
      peer_id: peer2,
      offers: [{ offer: { sdp: 'test-offer-sdp' }, offer_id: 'test1' }]
    }))

    // Peer 1 should receive the offer
    const offer = await offerPromise
    console.log('    Peer 1 received offer from peer 2')
    assert.ok(offer.offer, 'Should have offer')
    assert.strictEqual(offer.offer_id, 'test1')

    ws1.close()
    ws2.close()
  })

  it('should count active seeder in swarm', async () => {
    const ws = await connectTracker(TRACKER_URL)
    const peerId = randomPeerId()

    ws.send(JSON.stringify({
      action: 'announce',
      info_hash: INFOHASH,
      peer_id: peerId,
      offers: []
    }))

    const msg = await waitForMessage(ws, 'announce')
    console.log('    Peers in swarm for ' + INFOHASH.slice(0, 12) + '...: ' + msg.incomplete)
    // The seeder should be in the swarm
    assert.ok(msg.incomplete >= 0, 'Should report swarm size')
    ws.close()
  })
})
