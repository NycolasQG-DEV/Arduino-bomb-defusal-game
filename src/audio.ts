class Sound {
  private context?: AudioContext;
  private voices = new Set<OscillatorNode>();
  private active = true;
  get enabled() { return this.active; }
  set enabled(value: boolean) { this.active = value; if (!value) this.cancel(); }
  init() { this.context ??= new AudioContext(); void this.context.resume(); }
  private note(frequency: number, duration: number, offset = 0) {
    if (!this.active || !this.context) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    const start = this.context.currentTime + offset;
    oscillator.type = 'square'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.035, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start); oscillator.stop(start + duration);
  }
  play(frequency = 500, duration = .06) { this.note(frequency, duration); }
  success() { [659, 831, 988].forEach((note, i) => this.note(note, .13, i * .13)); }
  victory() { [659, 784, 988, 1319, 988, 1319, 1568, 1319].forEach((note, i) => this.note(note, i === 7 ? .7 : .2, i * .25)); }
  cancel() { for (const voice of this.voices) { try { voice.stop(); } catch {} } this.voices.clear(); }
}
export const sound = new Sound();
