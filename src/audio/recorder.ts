import workletUrl from './capture.worklet.ts?worker&url';

export interface RecorderEvents {
  /** Called for every block of raw PCM from the microphone. */
  onBlock: (samples: Float32Array, sampleRate: number) => void;
}

/**
 * Microphone capture with all browser processing disabled (no AGC, no noise
 * suppression, no echo cancellation), raw PCM via an AudioWorklet.
 */
export class Recorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private _sampleRate = 0;
  appliedSettings: MediaTrackSettings | null = null;

  get sampleRate() { return this._sampleRate; }
  get recording() { return this.ctx !== null; }

  async start(ev: RecorderEvents, blockSize = 1024): Promise<void> {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    const track = this.stream.getAudioTracks()[0];
    this.appliedSettings = track.getSettings();

    this.ctx = new AudioContext();
    await this.ctx.resume();
    await this.ctx.audioWorklet.addModule(workletUrl);
    this._sampleRate = this.ctx.sampleRate;
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'pcm-capture', {
      numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1,
      processorOptions: { blockSize },
    });
    this.chunks = [];
    this.node.port.onmessage = (e: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
      this.chunks.push(e.data.samples);
      ev.onBlock(e.data.samples, e.data.sampleRate);
    };
    src.connect(this.node);
  }

  /** Stop and return everything recorded as one mono buffer. */
  async stop(): Promise<{ samples: Float32Array; sampleRate: number }> {
    const sr = this._sampleRate;
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    this.node = null; this.stream = null; this.ctx = null;
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const out = new Float32Array(total);
    let pos = 0;
    for (const c of this.chunks) { out.set(c, pos); pos += c.length; }
    this.chunks = [];
    return { samples: out, sampleRate: sr };
  }
}
