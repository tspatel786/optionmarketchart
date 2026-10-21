/**
 * Audio Chime & Speech Alert Service
 * Uses Web Audio API to synthesize notification chimes (zero external audio files needed)
 * and Web SpeechSynthesis API for clear voice alerts.
 */

const STORAGE_KEY_SOUND = 'APP_SOUND_ALERTS_ENABLED_V1';
const STORAGE_KEY_VOICE = 'APP_VOICE_ALERTS_ENABLED_V1';

export class SoundAlertService {
  private static audioCtx: AudioContext | null = null;

  private static getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public static isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const val = localStorage.getItem(STORAGE_KEY_SOUND);
    return val === null ? true : val === 'true';
  }

  public static setSoundEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_SOUND, String(enabled));
  }

  public static isVoiceEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const val = localStorage.getItem(STORAGE_KEY_VOICE);
    return val === null ? true : val === 'true';
  }

  public static setVoiceEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_VOICE, String(enabled));
  }

  /**
   * Synthesize a melodic electronic chime using Web Audio API
   */
  public static playChime(isBullish: boolean = true): void {
    if (!this.isSoundEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Notes: Bullish = D5 (587Hz) -> A5 (880Hz); Bearish = A5 (880Hz) -> D5 (587Hz)
      const freqs = isBullish ? [587.33, 880.0] : [880.0, 587.33];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });
    } catch {
      // Audio context error ignored
    }
  }

  /**
   * Speak trade announcement using SpeechSynthesis
   */
  public static speakAnnouncement(text: string): void {
    if (!this.isVoiceEnabled()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel(); // Stop ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-IN'; // Indian English accent
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech error ignored
    }
  }

  /**
   * Complete alert notification on signal generation
   */
  public static notifySignal(instrument: string, signalType: 'BUY' | 'SELL', strike?: string): void {
    const isBull = signalType === 'BUY';
    this.playChime(isBull);

    const callOrPut = isBull ? 'Buy Call Option' : 'Buy Put Option';
    const strikeText = strike ? `Strike ${strike}` : '';
    const message = `Alert! ${instrument} ${callOrPut}. ${strikeText}. 80 percent confluence trade setup confirmed.`;

    setTimeout(() => {
      this.speakAnnouncement(message);
    }, 450);
  }

  /**
   * Test alert function for user button
   */
  public static testAlert(): void {
    this.playChime(true);
    setTimeout(() => {
      this.speakAnnouncement('Sound and voice alerts are working properly on your trading terminal.');
    }, 450);
  }
}
