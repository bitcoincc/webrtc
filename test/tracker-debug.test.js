/**
 * Debug tracker info_hash handling
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { WebSocket } from 'ws'

const TRACKER_URL = 'wss://melvin.me/.webrtc'
const INFOHASH_HEX = 'b037539bb5b50aad9d4720cd4637ad688349a6bf'

// Convert hex to 20-byte binary string (what WebTorrent sends)
function hex2bin(hex) {
  return Buffer.from(hex, 'hex').toString('binary')
}

function randomPeerId() {
  const buf = Buffer.alloc(20)
  for (let i = 0; i < 20; i++) buf[i] = Math.floor(Math.random() * 256)
  return buf.toString('binary')
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TRACKER_URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Timeout')), 5000)
  })
}

function waitMsg(ws, timeout) {
  timeout = timeout || 5000
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout)
    ws.once('message', function(data) {
      clearTimeout(timer)
      resolve(JSON.parse(data.toString()))
    })
  })
}

describe('Tracker info_hash debug', () => {

  it('should show what the seeder sends (binary 20-byte)', async () => {
    const ws = await connect()
    const binaryHash = hex2bin(INFOHASH_HEX)
    const binaryPeerId = randomPeerId()

    console.log('    hex info_hash: ' + INFOHASH_HEX)
    console.log('    binary length: ' + binaryHash.length)
    console.log('    binary bytes: ' + Buffer.from(binaryHash, 'binary').toString('hex'))

    ws.send(JSON.stringify({
      action: 'announce',
      info_hash: binaryHash,
      peer_id: binaryPeerId,
      offers: []
    }))

    const msg = await waitMsg(ws)
    console.log('    Response info_hash length: ' + (msg.info_hash ? msg.info_hash.length : 'none'))
    console.log('    Response incomplete: ' + msg.incomplete)
    ws.close()
  })

  it('should show what a hex client sends (40-char hex)', async () => {
    const ws = await connect()

    ws.send(JSON.stringify({
      action: 'announce',
      info_hash: INFOHASH_HEX,
      peer_id: 'test-peer-hex-000001',
      offers: []
    }))

    const msg = await waitMsg(ws)
    console.log('    Response incomplete: ' + msg.incomplete)
    ws.close()
  })

  it('should test if binary and hex end up in same swarm', async () => {
    const ws1 = await connect()
    const ws2 = await connect()

    // Peer 1 joins with binary info_hash (like WebTorrent seeder)
    ws1.send(JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFOHASH_HEX),
      peer_id: randomPeerId(),
      offers: []
    }))
    const msg1 = await waitMsg(ws1)
    console.log('    Binary peer joined, swarm size: ' + msg1.incomplete)

    // Peer 2 joins with hex info_hash (like our test)
    ws2.send(JSON.stringify({
      action: 'announce',
      info_hash: INFOHASH_HEX,
      peer_id: 'hex-peer-00000000001',
      offers: []
    }))
    const msg2 = await waitMsg(ws2)
    console.log('    Hex peer joined, swarm size: ' + msg2.incomplete)

    // If they're in the same swarm, msg2.incomplete should be > 1
    // If different swarms, msg2.incomplete would be 1
    if (msg2.incomplete > 1) {
      console.log('    ✅ Same swarm — binary and hex match')
    } else {
      console.log('    ❌ Different swarms — binary and hex DO NOT match')
    }

    ws1.close()
    ws2.close()
  })

  it('should test offer relay between binary and hex peers', async () => {
    const ws1 = await connect()
    const ws2 = await connect()

    // Peer 1 joins with binary (seeder-like)
    ws1.send(JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFOHASH_HEX),
      peer_id: randomPeerId(),
      offers: []
    }))
    await waitMsg(ws1)

    // Peer 2 joins with binary and sends offer (browser-like)
    const offerPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No offer received')), 5000)
      ws1.on('message', function handler(data) {
        const msg = JSON.parse(data.toString())
        if (msg.offer) {
          clearTimeout(timer)
          ws1.removeListener('message', handler)
          resolve(msg)
        }
      })
    })

    ws2.send(JSON.stringify({
      action: 'announce',
      info_hash: hex2bin(INFOHASH_HEX),
      peer_id: randomPeerId(),
      offers: [{ offer: { type: 'offer', sdp: 'test-sdp' }, offer_id: 'off1' }]
    }))

    try {
      const offer = await offerPromise
      console.log('    ✅ Offer relayed successfully')
      console.log('    offer_id: ' + offer.offer_id)
    } catch (e) {
      console.log('    ❌ Offer NOT relayed: ' + e.message)
    }

    ws1.close()
    ws2.close()
  })
})
