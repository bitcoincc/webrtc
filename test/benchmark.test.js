/**
 * Benchmark: compare download approaches for Bitcoin headers
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

const URL1 = 'https://melvin.me/.well-known/webrtc/d17fd54e591e4e42434c1695b3f4c50f249552fd/headers.bin'
const URL2 = 'https://melvincarvalho.com/.well-known/webrtc/d17fd54e591e4e42434c1695b3f4c50f249552fd/headers.bin'

describe('Benchmark: plain fetch', () => {
  it('should download from melvin.me', async () => {
    const t0 = Date.now()
    const res = await fetch(URL1)
    const buf = await res.arrayBuffer()
    const ms = Date.now() - t0
    const mbps = (buf.byteLength / 1048576) / (ms / 1000)
    console.log('    melvin.me: ' + buf.byteLength + ' bytes in ' + ms + 'ms (' + mbps.toFixed(1) + ' MB/s)')
    assert.ok(buf.byteLength > 70000000)
  })

  it('should download from melvincarvalho.com', async () => {
    const t0 = Date.now()
    const res = await fetch(URL2)
    const buf = await res.arrayBuffer()
    const ms = Date.now() - t0
    const mbps = (buf.byteLength / 1048576) / (ms / 1000)
    console.log('    melvincarvalho.com: ' + buf.byteLength + ' bytes in ' + ms + 'ms (' + mbps.toFixed(1) + ' MB/s)')
    assert.ok(buf.byteLength > 70000000)
  })
})

describe('Benchmark: range requests (simulating WebTorrent)', () => {
  it('should measure single range request latency', async () => {
    const times = []
    for (let i = 0; i < 10; i++) {
      const start = i * 16384
      const end = start + 16383
      const t0 = Date.now()
      const res = await fetch(URL1, { headers: { 'Range': 'bytes=' + start + '-' + end } })
      await res.arrayBuffer()
      times.push(Date.now() - t0)
    }
    const avg = Math.round(times.reduce((a, b) => a + b) / times.length)
    const total16k = Math.ceil(75312000 / 16384)
    const estimated = Math.round(total16k * avg / 1000)
    console.log('    Avg 16KB range request: ' + avg + 'ms')
    console.log('    Total 16KB pieces: ' + total16k)
    console.log('    Estimated time at 16KB pieces (sequential): ' + estimated + 's')
  })

  it('should measure 256KB range request latency', async () => {
    const times = []
    for (let i = 0; i < 10; i++) {
      const start = i * 262144
      const end = start + 262143
      const t0 = Date.now()
      const res = await fetch(URL1, { headers: { 'Range': 'bytes=' + start + '-' + end } })
      await res.arrayBuffer()
      times.push(Date.now() - t0)
    }
    const avg = Math.round(times.reduce((a, b) => a + b) / times.length)
    const total256k = Math.ceil(75312000 / 262144)
    const estimated = Math.round(total256k * avg / 1000)
    console.log('    Avg 256KB range request: ' + avg + 'ms')
    console.log('    Total 256KB pieces: ' + total256k)
    console.log('    Estimated time at 256KB pieces (sequential): ' + estimated + 's')
  })

  it('should measure 1MB range request latency', async () => {
    const times = []
    for (let i = 0; i < 5; i++) {
      const start = i * 1048576
      const end = start + 1048575
      const t0 = Date.now()
      const res = await fetch(URL1, { headers: { 'Range': 'bytes=' + start + '-' + end } })
      await res.arrayBuffer()
      times.push(Date.now() - t0)
    }
    const avg = Math.round(times.reduce((a, b) => a + b) / times.length)
    const total1m = Math.ceil(75312000 / 1048576)
    const estimated = Math.round(total1m * avg / 1000)
    console.log('    Avg 1MB range request: ' + avg + 'ms')
    console.log('    Total 1MB pieces: ' + total1m)
    console.log('    Estimated time at 1MB pieces (sequential): ' + estimated + 's')
  })
})

describe('Benchmark: epoch-sized range requests (157.5 KB)', () => {
  it('should measure epoch piece latency', async () => {
    const EPOCH_SIZE = 80 * 2016 // 161280
    const times = []
    for (let i = 0; i < 10; i++) {
      const start = i * EPOCH_SIZE
      const end = start + EPOCH_SIZE - 1
      const t0 = Date.now()
      const res = await fetch(URL1, { headers: { 'Range': 'bytes=' + start + '-' + end } })
      await res.arrayBuffer()
      times.push(Date.now() - t0)
    }
    const avg = Math.round(times.reduce((a, b) => a + b) / times.length)
    const totalPieces = Math.ceil(75312000 / EPOCH_SIZE)
    const estimated = Math.round(totalPieces * avg / 1000)
    console.log('    Avg epoch range request: ' + avg + 'ms')
    console.log('    Total epoch pieces: ' + totalPieces)
    console.log('    Estimated time (sequential): ' + estimated + 's')
  })
})

describe('Benchmark: parallel fetch', () => {
  it('should download from both servers in parallel', async () => {
    const t0 = Date.now()
    const half = Math.floor(75312000 / 2)
    const [res1, res2] = await Promise.all([
      fetch(URL1, { headers: { 'Range': 'bytes=0-' + (half - 1) } }).then(r => r.arrayBuffer()),
      fetch(URL2, { headers: { 'Range': 'bytes=' + half + '-' + (75312000 - 1) } }).then(r => r.arrayBuffer()),
    ])
    const ms = Date.now() - t0
    const total = res1.byteLength + res2.byteLength
    const mbps = (total / 1048576) / (ms / 1000)
    console.log('    Parallel (2 servers): ' + total + ' bytes in ' + ms + 'ms (' + mbps.toFixed(1) + ' MB/s)')
    assert.ok(total > 70000000)
  })
})
