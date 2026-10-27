/**
 * AudioWorklet that forwards raw mono PCM to the main thread in blocks of
 * `blockSize` samples. No processing happens here; keeping the audio thread
 * trivial avoids glitches. Registered as 'pcm-capture'.
 */
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
}

class PcmCapture extends AudioWorkletProcessor {
  private buf: Float32Array;
  private pos = 0;
  constructor(options?: { processorOptions?: { blockSize?: number } }) {
    super();
    const size = options?.processorOptions?.blockSize ?? 1024;
    this.buf = new Float32Array(size);
  }
  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.pos++] = ch[i];
      if (this.pos === this.buf.length) {
        this.port.postMessage({ samples: this.buf.slice(), sampleRate });
        this.pos = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
