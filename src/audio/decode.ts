/** Decode an uploaded audio file to mono Float32 samples at its decoded rate. */
export async function decodeFile(file: File): Promise<{ samples: Float32Array; sampleRate: number }> {
  const buf = await file.arrayBuffer();
  // A throwaway context: decodeAudioData resamples to the context rate, which
  // defaults to the output device rate (44.1 or 48 kHz). Fine for tracking.
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(buf);
    return { samples: toMono(audio), sampleRate: audio.sampleRate };
  } finally {
    await ctx.close();
  }
}

export function toMono(audio: AudioBuffer): Float32Array {
  const n = audio.length;
  const out = new Float32Array(n);
  const ch = audio.numberOfChannels;
  for (let c = 0; c < ch; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}
