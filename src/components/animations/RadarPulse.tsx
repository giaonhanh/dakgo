'use client';

export default function RadarPulse() {
  return (
    <div className="relative w-[16px] h-[16px]">
      {/* Center dot */}
      <div
        className="absolute w-[5px] h-[5px] rounded-full top-[5.5px] left-[5.5px]"
        style={{ background: 'var(--acc)', boxShadow: '0 0 5px var(--acc)' }}
      />
      {/* Pulse rings — CSS @keyframes radarPulse defined in globals.css */}
      {[0, 0.7].map((delay, i) => (
        <div
          key={i}
          className="absolute rounded-full border opacity-0"
          style={{
            borderColor: 'var(--acc)',
            width:  i === 0 ? 10 : 16,
            height: i === 0 ? 10 : 16,
            top:    i === 0 ?  3 :  0,
            left:   i === 0 ?  3 :  0,
            animation: `radarPulse 2s ${delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
