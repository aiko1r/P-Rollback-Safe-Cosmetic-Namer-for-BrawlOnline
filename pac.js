/* pac.js — extract textures from Brawl/P+ .pac and .pcs files, in the browser.
 * A .pcs is just a compressed .pac (same LZ77/LZ11 container), so both are
 * handled the same way: decompress, find TEX0/PLT0 sections (including ones
 * inside nested LZ11-compressed brres files), decode, and compute the Dolphin
 * texture filename with the same algorithm as the built-in datasets:
 * XXH64(seed 0) over the base level; C8/C4 textures also hash the palette
 * range [2*min, 2*(max+1)). The runtime _m flag is unknowable from files,
 * so the no-_m name is primary and _m is an alternate.
 * Nothing here is dump-verified — the site says so.
 */
'use strict';

/* ---------------- XXH64 (seed 0) ---------------- */
function xxh64(bytes) {
  const P1 = 0x9E3779B185EBCA87n, P2 = 0xC2B2AE3D27D4EB4Fn, P3 = 0x165667B19E3779F9n;
  const P4 = 0x85EBCA77C2B2AE63n, P5 = 0x27D4EB2F165667C5n;
  const M = 0xFFFFFFFFFFFFFFFFn;
  const b = bytes, len = b.length;
  const rd64 = o => { let v = 0n; for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(b[o + k]); return v; };
  const rd32 = o => ((b[o] | (b[o+1] << 8) | (b[o+2] << 16) | (b[o+3] << 24)) >>> 0);
  const rotl = (v, r) => ((v << BigInt(r)) | (v >> BigInt(64 - Number(r)))) & M;
  const rnd = (acc, val) => (rotl((acc + ((val * P2) & M)) & M, 31) * P1) & M;
  let i = 0, h;
  if (len >= 32) {
    let v1 = 0n + P1 + P2, v2 = 0n + P2, v3 = 0n, v4 = 0n - P1;
    for (; i + 32 <= len; i += 32) {
      v1 = rnd(v1, rd64(i)); v2 = rnd(v2, rd64(i + 8)); v3 = rnd(v3, rd64(i + 16)); v4 = rnd(v4, rd64(i + 24));
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) & M;
    const mg = (acc, val) => { val = rnd(0n, val); acc ^= val; return ((acc * P1) & M) + P4 & M; };
    h = mg(h, v1); h = mg(h, v2); h = mg(h, v3); h = mg(h, v4);
  } else {
    h = (0n + P5) & M;
  }
  h = (h + BigInt(len)) & M;
  const rem = len - i;
  while (len - i >= 8) {
    h = ((rotl(h ^ rnd(0n, rd64(i)), 27) * P1) + P4) & M; i += 8;
  }
  if (len - i >= 4) { h ^= BigInt(rd32(i)) * P1 & M; h = (rotl(h, 23) * P2 + P3) & M; i += 4; }
  while (i < len) { h ^= BigInt(b[i]) * P5 & M; h = (rotl(h, 11) * P1) & M; i++; }
  h ^= h >> 33n; h = (h * P2) & M;
  h ^= h >> 29n; h = (h * P3) & M;
  h ^= h >> 32n;
  return h.toString(16).padStart(16, '0');
}

/* ---------------- LZ77 (0x10) / LZ11 (0x11) ---------------- */
function lzDecompress(d) {
  const t = d[0];
  let size = d[1] | (d[2] << 8) | (d[3] << 16);
  let i = 4;
  if (size === 0) { size = (d[4] | (d[5] << 8) | (d[6] << 16) | (d[7] << 24)) >>> 0; i = 8; }
  const out = new Uint8Array(size);
  let o = 0;
  while (o < size) {
    if (i >= d.length) throw new Error('truncated lz stream');
    const flags = d[i]; i++;
    for (let b = 0; b < 8; b++) {
      if (o >= size) break;
      if (flags & (0x80 >> b)) {
        const a = d[i];
        if (a === undefined) throw new Error('truncated lz token');
        if (t === 0x10) {
          const c = d[i + 1];
          if (c === undefined) throw new Error('truncated lz token');
          i += 2;
          const n = (a >> 4) + 3, disp = ((a & 15) << 8 | c) + 1;
          if (disp > o) throw new Error('lz back-reference before start');
          for (let k = 0; k < n; k++) { out[o] = out[o - disp]; o++; }
        } else {
          const ind = a >> 4;
          let n, disp;
          if (ind === 0) {
            if (d[i+1] === undefined || d[i+2] === undefined) throw new Error('truncated lz token');
            n = ((a & 15) << 4 | d[i+1] >> 4) + 0x11; disp = ((d[i+1] & 15) << 8 | d[i+2]) + 1; i += 3;
          } else if (ind === 1) {
            if (d[i+1] === undefined || d[i+2] === undefined || d[i+3] === undefined) throw new Error('truncated lz token');
            n = ((a & 15) << 12 | d[i+1] << 4 | d[i+2] >> 4) + 0x111; disp = ((d[i+2] & 15) << 8 | d[i+3]) + 1; i += 4;
          } else {
            if (d[i+1] === undefined) throw new Error('truncated lz token');
            n = ind + 1; disp = ((a & 15) << 8 | d[i+1]) + 1; i += 2;
          }
          if (disp > o) throw new Error('lz back-reference before start');
          for (let k = 0; k < n; k++) { out[o] = out[o - disp]; o++; }
        }
      } else {
        if (i >= d.length) throw new Error('truncated lz literal');
        out[o] = d[i]; i++; o++;
      }
    }
  }
  return out;
}

/* ---------------- TEX0 / PLT0 scan ---------------- */
const BLK = { 0: [8, 8, 32], 1: [8, 4, 32], 2: [8, 4, 32], 3: [4, 4, 32], 4: [4, 4, 32],
  5: [4, 4, 32], 6: [4, 4, 64], 8: [8, 8, 32], 9: [8, 4, 32], 10: [4, 4, 32], 14: [8, 8, 32] };
const PALETTED = { 8: true, 9: true };
const rdU32 = (d, o) => ((d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0);
const rdU16 = (d, o) => (d[o] | (d[o+1] << 8));
/* brres section headers are big-endian */
const rdBE32 = (d, o) => (((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0);
const rdBE16 = (d, o) => ((d[o] << 8) | d[o+1]);

function scanTEX0(d) {
  const out = [];
  const sig = 0x30584554; // 'TEX0' LE
  for (let o = 0; o + 0x28 <= d.length; o++) {
    if (rdU32(d, o) !== sig) continue;
    const ln = rdBE32(d, o + 4), dat = rdBE32(d, o + 16), nam = rdBE32(d, o + 20);
    const w = rdBE16(d, o + 0x1c), h = rdBE16(d, o + 0x1e);
    const fmt = rdBE32(d, o + 0x20), mip = rdBE32(d, o + 0x24);
    if (!(fmt in BLK) || w === 0 || h === 0 || w > 2048 || h > 2048 || ln < 0x40 || o + ln > d.length) continue;
    let name = '';
    for (let k = 0; k < 48; k++) { const c = d[o + nam + k]; if (!c) break; if (c < 32 || c > 126) { name = ''; break; } name += String.fromCharCode(c); }
    if (!name) continue;
    const bw = BLK[fmt][0], bh = BLK[fmt][1], bs = BLK[fmt][2];
    const size = Math.ceil(w / bw) * Math.ceil(h / bh) * bs;
    if (dat + size > ln) continue;
    out.push({ name, w, h, fmt, mip, raw: d.subarray(o + dat, o + dat + size) });
  }
  return out;
}

function scanPLT0(d) {
  const out = {};
  const sig = 0x30544C50; // 'PLT0' LE
  for (let o = 0; o + 0x1e <= d.length; o++) {
    if (rdU32(d, o) !== sig) continue;
    const dat = rdBE32(d, o + 16), nam = rdBE32(d, o + 20);
    const pfmt = rdBE32(d, o + 0x18), n = rdBE16(d, o + 0x1c);
    if (!n || dat + n * 2 > d.length - o) continue;
    let name = '';
    for (let k = 0; k < 48; k++) { const c = d[o + nam + k]; if (!c) break; if (c < 32 || c > 126) { name = ''; break; } name += String.fromCharCode(c); }
    if (!name) continue;
    out[name] = { pfmt, n, bytes: d.subarray(o + dat, o + dat + n * 2) };
  }
  return out;
}

/* ---------------- decoders ---------------- */
const e5 = v => (v << 3) | (v >> 2);
const e6 = v => (v << 2) | (v >> 4);
const e4 = v => (v << 4) | v;
const e3 = v => (v << 5) | (v << 2) | (v >> 1);

function palLut(pal) {
  const n = pal.bytes.length >> 1, lut = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const c = (pal.bytes[i*2] << 8) | pal.bytes[i*2+1];
    if (pal.pfmt === 0) {        // IA8
      lut[i*4] = lut[i*4+1] = lut[i*4+2] = c >> 8; lut[i*4+3] = c & 255;
    } else if (pal.pfmt === 1) { // RGB565
      lut[i*4] = e5(c >> 11); lut[i*4+1] = e6((c >> 5) & 63); lut[i*4+2] = e5(c & 31); lut[i*4+3] = 255;
    } else {                     // RGB5A3
      if (c & 0x8000) { lut[i*4] = e5((c >> 10) & 31); lut[i*4+1] = e5((c >> 5) & 31); lut[i*4+2] = e5(c & 31); lut[i*4+3] = 255; }
      else { lut[i*4] = e4((c >> 8) & 15); lut[i*4+1] = e4((c >> 4) & 15); lut[i*4+2] = e4(c & 15); lut[i*4+3] = e3((c >> 12) & 7); }
    }
  }
  return lut;
}

function decodeTex(t, pal) {
  const { w, h, fmt, raw } = t;
  const [bw, bh, bs] = BLK[fmt];
  const bx = Math.ceil(w / bw), by = Math.ceil(h / bh);
  const px = new Uint8Array(w * h * 4);  // RGBA, row-major, cropped
  const put = (x, y, r, g, b, a) => {
    if (x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    px[o] = r; px[o+1] = g; px[o+2] = b; px[o+3] = a;
  };
  const lut = (fmt === 8 || fmt === 9 || fmt === 10) && pal ? palLut(pal) : null;

  for (let byI = 0; byI < by; byI++) {
    for (let bxI = 0; bxI < bx; bxI++) {
      const blk = byI * bx + bxI, base = blk * bs;
      const x0 = bxI * bw, y0 = byI * bh;
      if (fmt === 0) { // I4
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x += 2) {
          const b = raw[base + y * (bw / 2) + x / 2];
          const hi = (b >> 4) * 17, lo = (b & 15) * 17;
          put(x0 + x, y0 + y, hi, hi, hi, 255); put(x0 + x + 1, y0 + y, lo, lo, lo, 255);
        }
      } else if (fmt === 1) { // I8
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const v = raw[base + y * bw + x]; put(x0 + x, y0 + y, v, v, v, 255);
        }
      } else if (fmt === 2) { // IA4: hi nibble alpha, lo intensity
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const b = raw[base + y * bw + x];
          const g = (b & 15) * 17, a = (b >> 4) * 17;
          put(x0 + x, y0 + y, g, g, g, a);
        }
      } else if (fmt === 3) { // IA8
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const o2 = base + (y * bw + x) * 2;
          const g = raw[o2], a = raw[o2 + 1];
          put(x0 + x, y0 + y, g, g, g, a);
        }
      } else if (fmt === 4) { // RGB565
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const o2 = base + (y * bw + x) * 2;
          const c = (raw[o2] << 8) | raw[o2 + 1];
          put(x0 + x, y0 + y, e5(c >> 11), e6((c >> 5) & 63), e5(c & 31), 255);
        }
      } else if (fmt === 5) { // RGB5A3
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const o2 = base + (y * bw + x) * 2;
          const c = (raw[o2] << 8) | raw[o2 + 1];
          if (c & 0x8000) put(x0 + x, y0 + y, e5((c >> 10) & 31), e5((c >> 5) & 31), e5(c & 31), 255);
          else put(x0 + x, y0 + y, e4((c >> 8) & 15), e4((c >> 4) & 15), e4(c & 15), e3((c >> 12) & 7));
        }
      } else if (fmt === 6) { // RGBA8: AR plane then GB plane
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const p = y * bw + x;
          const ar = (raw[base + p * 2] << 8) | raw[base + p * 2 + 1];
          const gb = (raw[base + 32 + p * 2] << 8) | raw[base + 32 + p * 2 + 1];
          put(x0 + x, y0 + y, ar >> 8, gb & 255, gb >> 8, ar & 255);
        }
      } else if (fmt === 8 || fmt === 9) { // C4 / C8
        if (!lut) return null;
        const nl = lut.length / 4;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          let idx;
          if (fmt === 8) { const b = raw[base + y * (bw / 2) + (x >> 1)]; idx = (x & 1) ? (b & 15) : (b >> 4); }
          else idx = raw[base + y * bw + x];
          if (idx >= nl) idx = nl - 1;
          const o4 = idx * 4;
          put(x0 + x, y0 + y, lut[o4], lut[o4+1], lut[o4+2], lut[o4+3]);
        }
      } else if (fmt === 10) { // C14X2
        if (!lut) return null;
        const nl = lut.length / 4;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const o2 = base + (y * bw + x) * 2;
          let idx = ((raw[o2] << 8) | raw[o2 + 1]) & 0x3FFF;
          if (idx >= nl) idx = nl - 1;
          const o4 = idx * 4;
          put(x0 + x, y0 + y, lut[o4], lut[o4+1], lut[o4+2], lut[o4+3]);
        }
      } else if (fmt === 14) { // CMPR (DXT1 8x8 = four 4x4 sub-blocks)
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const sb = base + (sy * 2 + sx) * 8;
          const c0 = (raw[sb] << 8) | raw[sb + 1], c1 = (raw[sb + 2] << 8) | raw[sb + 3];
          const idx = (raw[sb+4] << 24 | raw[sb+5] << 16 | raw[sb+6] << 8 | raw[sb+7]) >>> 0;
          const r0 = [e5(c0 >> 11), e6((c0 >> 5) & 63), e5(c0 & 31)];
          const r1 = [e5(c1 >> 11), e6((c1 >> 5) & 63), e5(c1 & 31)];
          const gt = c0 > c1;
          const mid = [ (r0[0]+r1[0])>>1, (r0[1]+r1[1])>>1, (r0[2]+r1[2])>>1 ];
          const c2 = gt ? [ (5*r0[0]+3*r1[0])>>3, (5*r0[1]+3*r1[1])>>3, (5*r0[2]+3*r1[2])>>3 ] : mid;
          const c3 = gt ? [ (5*r1[0]+3*r0[0])>>3, (5*r1[1]+3*r0[1])>>3, (5*r1[2]+3*r0[2])>>3 ] : mid;
          const cols = [r0, r1, c2, c3];
          for (let py = 0; py < 4; py++) for (let px2 = 0; px2 < 4; px2++) {
            const pi = (idx >> (8 * py + 6 - 2 * px2)) & 3;
            const a = (pi === 3 && !gt) ? 0 : 255;
            put(x0 + sx * 4 + px2, y0 + sy * 4 + py, cols[pi][0], cols[pi][1], cols[pi][2], a);
          }
        }
      } else return null;
    }
  }
  return px;
}

/* ---------------- Dolphin name ---------------- */
function dolphinName(t, pal) {
  const { w, h, fmt, raw } = t;
  let tlut = '';
  if (PALETTED[fmt]) {
    if (!pal) return null;
    let mn = 255, mx = 0;
    if (fmt === 9) {
      for (let i = 0; i < raw.length; i++) { const v = raw[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    } else {
      for (let i = 0; i < raw.length; i++) {
        const hi = raw[i] >> 4, lo = raw[i] & 15;
        if (hi < mn) mn = hi; if (hi > mx) mx = hi;
        if (lo < mn) mn = lo; if (lo > mx) mx = lo;
      }
    }
    const from = 2 * mn, to = 2 * (mx + 1);
    if (to > pal.bytes.length) return null;
    tlut = '_' + xxh64(pal.bytes.subarray(from, to));
  }
  const base = 'tex1_' + w + 'x' + h + '_' + xxh64(raw) + tlut + '_' + fmt + '.png';
  const mvar = 'tex1_' + w + 'x' + h + '_m_' + xxh64(raw) + tlut + '_' + fmt + '.png';
  return { base, mvar };
}

/* ---------------- .pac / .pcs extraction ---------------- */
const MAX_TEX = 4000, MAX_NESTED = 400;

/* split a decompressed blob at brres file boundaries, so a TEX0 is paired with
 * the PLT0 in its own brres — two brres can contain same-named textures with
 * different palettes, and each pairing is a distinct Dolphin texture */
function scanBlob(d) {
  const starts = [];
  for (let o = 0; o + 4 <= d.length; o++)
    if (d[o] === 0x62 && d[o+1] === 0x72 && d[o+2] === 0x65 && d[o+3] === 0x73) starts.push(o); // 'bres'
  const segs = starts.length
    ? starts.map((s, i) => d.subarray(s, i + 1 < starts.length ? starts[i + 1] : d.length))
    : [d];
  const out = [];
  for (const seg of segs) {
    const pals = scanPLT0(seg);
    for (const t of scanTEX0(seg)) out.push({ t, pals });
  }
  return out;
}

async function extractPacTextures(buf) {
  let d = new Uint8Array(buf);
  // top-level container: LZ77/LZ11 compressed, or already an ARC / raw brres bundle
  if (d[0] === 0x10 || d[0] === 0x11) {
    const sz = (d[1] | (d[2] << 8) | (d[3] << 16)) >>> 0;
    if (sz > 0 && sz < 0x8000000) d = lzDecompress(d);
  }
  const blobs = [d];
  // nested LZ11/LZ77 streams (e.g. brres files inside an inner archive)
  let nested = 0;
  for (let i = 0; i < d.length - 8 && nested < MAX_NESTED; i++) {
    if (d[i] !== 0x11 && d[i] !== 0x10) continue;
    const sz = (d[i+1] | (d[i+2] << 8) | (d[i+3] << 16)) >>> 0;
    if (sz < 0x100 || sz > 0x800000) continue;
    let dec;
    try { dec = lzDecompress(d.subarray(i)); } catch (_) { continue; } // invalid candidate stream
    if (dec.length !== sz) continue;
    blobs.push(dec);
    nested++;
  }
  const out = [];
  const seen = new Set();
  for (const blob of blobs) {
    for (const { t, pals } of scanBlob(blob)) {
      if (t.w < 8 || t.h < 8) continue;                 // skip 4x4 placeholders
      if (t.fmt === 10) continue;                        // C14X2: palette-range naming not verified — skip rather than risk a wrong name
      const name = dolphinName(t, pals[t.name]);
      if (!name) continue;
      const key = t.name + '|' + name.base;
      if (seen.has(key)) continue;                       // same brres scanned via two paths
      seen.add(key);
      out.push({ tex: t, name: name.base, mvar: name.mvar, pal: pals[t.name] || null });
      if (out.length >= MAX_TEX) return out;
    }
  }
  return out;
}

/* decode one extracted texture to a full-size canvas (RGBA over transparent) */
function texToCanvas(item) {
  const t = item.tex;
  const px = decodeTex(t, item.pal);
  if (!px) return null;
  const c = document.createElement('canvas');
  c.width = t.w; c.height = t.h;
  const ctx = c.getContext('2d');
  const imgd = ctx.createImageData(t.w, t.h);
  imgd.data.set(px);
  ctx.putImageData(imgd, 0, 0);
  return c;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { xxh64, lzDecompress, scanTEX0, scanPLT0, decodeTex, dolphinName, extractPacTextures, BLK };
}
