// WAV → MP3 转码（lamejs，48kHz→128kbps）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lamejs = require('lamejs/lame.all.js');


const SRC = 'docs/bgm';
const OUT = 'public/assets/audio';
mkdirSync(OUT, { recursive: true });

function readWav(path) {
  const buf = readFileSync(path);
  // 解析 WAV header
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bits = buf.readUInt16LE(34);
  // 找 data chunk
  let offset = 12;
  let dataOffset = -1;
  while (offset < buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') { dataOffset = offset + 8; break; }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error('no data chunk');
  const samples = (buf.length - dataOffset) / (bits / 8);
  const pcm = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    pcm[i] = buf.readInt16LE(dataOffset + i * 2);
  }
  return { channels, sampleRate, bits, pcm };
}

// 降采样到 44100（lamejs 不支持 48k）
function resample(pcm, fromRate, toRate) {
  if (fromRate === toRate) return pcm;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(pcm.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(pcm.length - 1, i0 + 1);
    const frac = pos - i0;
    out[i] = Math.round(pcm[i0] * (1 - frac) + pcm[i1] * frac);
  }
  return out;
}

function encode(channels, sampleRate, pcm) {
  if (sampleRate !== 44100) {
    pcm = resample(pcm, sampleRate, 44100);
    sampleRate = 44100;
  }
  const kbps = 128;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const blockSize = 1152;
  const chunks = [];
  if (channels === 2) {
    const left = new Int16Array(blockSize);
    const right = new Int16Array(blockSize);
    for (let i = 0; i < pcm.length; i += blockSize * 2) {
      const n = Math.min(blockSize, (pcm.length - i) / 2);
      for (let j = 0; j < n; j++) {
        left[j] = pcm[i + j * 2];
        right[j] = pcm[i + j * 2 + 1];
      }
      const chunk = encoder.encodeBuffer(left, right);
      if (chunk.length > 0) chunks.push(Buffer.from(chunk));
    }
  } else {
    const mono = new Int16Array(blockSize);
    for (let i = 0; i < pcm.length; i += blockSize) {
      const n = Math.min(blockSize, pcm.length - i);
      for (let j = 0; j < n; j++) mono[j] = pcm[i + j];
      const chunk = encoder.encodeBuffer(mono);
      if (chunk.length > 0) chunks.push(Buffer.from(chunk));
    }
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

import { readdirSync } from 'node:fs';
for (const f of readdirSync(SRC)) {
  if (!f.endsWith('.wav')) continue;
  const { channels, sampleRate, pcm } = readWav(join(SRC, f));
  const mp3 = encode(channels, sampleRate, pcm);
  const name = basename(f, '.wav');
  writeFileSync(join(OUT, name + '.mp3'), mp3);
  console.log(`${f} → ${name}.mp3 (${(mp3.length / 1024 / 1024).toFixed(1)}MB, ${channels}ch ${sampleRate}Hz)`);
}
console.log('全部转码完成');
