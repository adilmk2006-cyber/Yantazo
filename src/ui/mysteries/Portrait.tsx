/** Stylised, procedurally drawn suspect portrait (no external images). */
import type { Portrait as P } from '../../mysteries/types';

const SKIN = ['#f3d2b8', '#e2b08a', '#c68863', '#8d5a3b', '#5c3a28'];
const HAIR = ['#1d1a1f', '#4a2f20', '#8a5a2b', '#c9a15a', '#9aa3ad'];

export function Portrait({ p, size = 72, label }: { p: P; size?: number; label: string }) {
  const skin = SKIN[p.skin % SKIN.length];
  const hair = HAIR[p.hairColor % HAIR.length];
  const bg = `hsl(${p.hue} 45% 32%)`;
  const coat = `hsl(${p.hue} 35% 20%)`;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className="portrait" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <circle cx="40" cy="40" r="39" fill={bg} />
      <path d="M12 80c2-16 14-24 28-24s26 8 28 24z" fill={coat} />
      {p.accessory === 'scarf' && <path d="M26 58c8 5 20 5 28 0l2 6c-10 6-22 6-32 0z" fill={`hsl(${(p.hue + 160) % 360} 60% 55%)`} />}
      <rect x="35" y="44" width="10" height="10" rx="3" fill={skin} />
      {(p.hair === 'long' || p.hair === 'curly') && <ellipse cx="40" cy="38" rx="19" ry="21" fill={hair} />}
      <ellipse cx="40" cy="34" rx="14" ry="16" fill={skin} />
      {p.hair === 'short' && <path d="M26 30c0-11 7-16 14-16s14 5 14 16c-4-6-9-8-14-8s-10 2-14 8z" fill={hair} />}
      {p.hair === 'swept' && <path d="M25 31c0-12 8-17 16-17 8 0 14 6 13 15-5-7-14-9-22-6-3 1-5 4-7 8z" fill={hair} />}
      {p.hair === 'bun' && (
        <>
          <circle cx="40" cy="15" r="6" fill={hair} />
          <path d="M26 31c0-11 7-15 14-15s14 4 14 15c-4-5-9-7-14-7s-10 2-14 7z" fill={hair} />
        </>
      )}
      {p.hair === 'long' && <path d="M26 30c0-11 6-15 14-15s14 4 14 15c-3-4-8-6-14-6s-11 2-14 6z" fill={hair} />}
      {p.hair === 'curly' && [0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={27 + i * 5.2} cy={19 + (i % 2) * 3} r="5" fill={hair} />)}
      <circle cx="35" cy="34" r="1.6" fill="#1b1b22" />
      <circle cx="45" cy="34" r="1.6" fill="#1b1b22" />
      <path d="M36 42c2.5 1.6 5.5 1.6 8 0" stroke="#5b3426" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {p.accessory === 'glasses' && (
        <g stroke="#e8edf5" strokeWidth="1.3" fill="none">
          <circle cx="35" cy="34" r="4.2" />
          <circle cx="45" cy="34" r="4.2" />
          <path d="M39.2 34h1.6" />
        </g>
      )}
      {p.accessory === 'beard' && <path d="M27 36c1 10 6 15 13 15s12-5 13-15c-3 5-8 6-13 6s-10-1-13-6z" fill={hair} />}
      {p.accessory === 'hat' && (
        <>
          <rect x="24" y="17" width="32" height="5" rx="2" fill="#0f1424" />
          <rect x="29" y="8" width="22" height="11" rx="3" fill="#0f1424" />
        </>
      )}
      {p.accessory === 'earrings' && (
        <>
          <circle cx="26.5" cy="39" r="1.8" fill="#f5c451" />
          <circle cx="53.5" cy="39" r="1.8" fill="#f5c451" />
        </>
      )}
    </svg>
  );
}
