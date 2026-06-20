import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

export default function CustomAudioPlayer({ src }) {
  const audioRef = useRef(null);
  const barRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => { setDuration(audio.duration); };
    const onTime = () => { setCurrentTime(audio.currentTime); };
    const onEnd = () => { setIsPlaying(false); setCurrentTime(0); audio.currentTime = 0; };

    audio.addEventListener('loadeddata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    if (audio.readyState > 0) onLoaded();

    return () => {
      audio.removeEventListener('loadeddata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) a.pause(); else a.play();
    setIsPlaying(!isPlaying);
  };

  const seek = (e) => {
    const a = audioRef.current;
    const b = barRef.current;
    if (!a || !b || !duration) return;
    const r = b.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = p * duration;
    setCurrentTime(p * duration);
  };

  const fmt = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' + s : s}`;
  };

  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Row 1: Play button + Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={toggle}
          style={{
            width: '36px', height: '36px', minWidth: '36px',
            borderRadius: '50%', border: 'none',
            background: 'var(--accent)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isPlaying
            ? <Pause size={16} fill="white" />
            : <Play size={16} fill="white" style={{ marginLeft: '2px' }} />}
        </button>

        {/* Progress bar — no position:absolute, just a background trick */}
        <div
          ref={barRef}
          onClick={seek}
          style={{
            flex: '1 1 0%',
            minWidth: 0,
            height: '5px',
            borderRadius: '3px',
            cursor: 'pointer',
            background: `linear-gradient(to right, var(--accent-light, #ff9a6e) ${pct}%, rgba(255,255,255,0.25) ${pct}%)`,
          }}
        />
      </div>

      {/* Time label */}
      <div style={{ fontSize: '0.72rem', opacity: 0.75, fontWeight: 500, paddingLeft: '48px' }}>
        {fmt(currentTime)} / {fmt(duration)}
      </div>
    </div>
  );
}
