import { getState, setState, subscribe } from '../state/appState.js';

let audioCtx = null;

export function initSound(muteBtnId) {
  const btn = document.getElementById(muteBtnId);
  if (btn) {
    btn.addEventListener('click', () => {
      const currentMuted = getState().isMuted;
      const nextMuted = !currentMuted;
      setState({ isMuted: nextMuted });

      // Initialize AudioContext on first user gesture
      if (!nextMuted && !audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
    });
  }

  subscribe((state, prevState, updates) => {
    if (updates.isMuted !== undefined && btn) {
      btn.innerText = updates.isMuted ? '🔇 MUTED' : '🔊 SOUND ON';
      btn.style.color = updates.isMuted ? '' : '#38BDF8';
      btn.style.borderColor = updates.isMuted ? '' : '#38BDF8';
    }
  });
}

export function playCriticalAlert() {
  const { isMuted } = getState();
  if (isMuted || !audioCtx) return;
  
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    // AudioContext might need resumption
  }
}
