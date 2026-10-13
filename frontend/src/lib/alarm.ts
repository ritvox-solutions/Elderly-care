// Emergency fall alarm — copied from backend/static/index.html
export function playEmergencyAlarm() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.22, 0.44].forEach((delaySec) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime + delaySec); // 880Hz alert tone
      gain.gain.setValueAtTime(0.28, ctx.currentTime + delaySec);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delaySec + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delaySec);
      osc.stop(ctx.currentTime + delaySec + 0.18);
    });
  } catch {
    /* audio unavailable — banner still shows */
  }
}
