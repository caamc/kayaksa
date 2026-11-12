// Meet by Kayak voice changer: a real-time pitch shifter (two overlapping delay taps, cross-faded)
// with an optional ring modulator for the robot sound. Runs on the speaker's own device.
class KayakVoice extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: "ratio", defaultValue: 1, minValue: 0.5, maxValue: 2 }, { name: "ring", defaultValue: 0, minValue: 0, maxValue: 400 }]; }
  constructor() { super(); this.N = 8192; this.buf = new Float32Array(this.N); this.w = 0; this.ph = 0; this.win = Math.round(sampleRate * 0.05); this.rp = 0; }
  read(d) { const N = this.N; let p = this.w - d; while (p < 0) p += N; const i = Math.floor(p), f = p - i; return this.buf[i % N] * (1 - f) + this.buf[(i + 1) % N] * f; }
  process(inputs, outputs, params) {
    const inp = inputs[0][0], out = outputs[0];
    if (!inp) return true;
    const ratio = params.ratio[0], ring = params.ring[0], W = this.win, N = this.N;
    for (let k = 0; k < inp.length; k++) {
      this.buf[this.w] = inp[k];
      let y;
      if (Math.abs(ratio - 1) < 0.001) y = inp[k];
      else {
        this.ph += (1 - ratio) / W; this.ph -= Math.floor(this.ph);
        const p2 = (this.ph + 0.5) % 1;
        const g1 = Math.sin(Math.PI * this.ph) ** 2, g2 = Math.sin(Math.PI * p2) ** 2;
        y = this.read(this.ph * W + 1) * g1 + this.read(p2 * W + 1) * g2;
      }
      if (ring > 0) { this.rp += (2 * Math.PI * ring) / sampleRate; if (this.rp > 2 * Math.PI) this.rp -= 2 * Math.PI; y = y * (0.35 + 0.65 * Math.sin(this.rp)); }
      for (const ch of out) ch[k] = y;
      this.w = (this.w + 1) % N;
    }
    return true;
  }
}
registerProcessor("kayak-voice", KayakVoice);
