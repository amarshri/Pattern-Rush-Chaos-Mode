export const playTone = (frequency: number, duration = 0.12, volume = 0.18) => {
  if (typeof window === "undefined") return;
  const AudioContext =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.value = volume;

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);

  oscillator.onended = () => context.close();
};

export const hapticPulse = (pattern: number | number[]) => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(pattern);
};
