// Collects microphone audio for live captions: mono, downsampled to 16 kHz, posted in ~100 ms blocks.
class KayakCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.buf = [];
    this.pos = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (; this.pos < ch.length; this.pos += this.ratio) this.buf.push(ch[Math.floor(this.pos)]);
      this.pos -= ch.length;
      if (this.buf.length >= 1600) {
        this.port.postMessage(new Float32Array(this.buf));
        this.buf = [];
      }
    }
    return true;
  }
}
registerProcessor("kayak-capture", KayakCapture);
