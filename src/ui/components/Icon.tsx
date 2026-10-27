/** Small inline SVG icon set (decorative; labels are always provided as text). */
const P: Record<string, string> = {
  matrix: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  fluid: 'M4 17c3-6 5 6 8 0s5 6 8 0M4 9c3-6 5 6 8 0s5 6 8 0',
  logic: 'M6 3v6M6 15v6M18 3v6M18 15v6M6 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM18 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM9 12h6',
  lateral: 'M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3zM9 20h6M10 16v-3l2-2 2 2v3',
  riddle: 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4M12 18h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  spatial: 'M12 2l9 5v10l-9 5-9-5V7zM12 22V12M21 7l-9 5-9-5',
  observation: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 3',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  unlock: 'M7 11V7a5 5 0 0 1 9.6-2M5 11h14v10H5zM12 15v2',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5zM12 15v2',
  skip: 'M5 5l8 7-8 7zM15 5v14',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.2-1 2.1H9.5c0-.9-.4-1.6-1-2.1A6 6 0 0 1 12 3z',
  check: 'M4 12l5 5L20 6',
  cross: 'M6 6l12 12M18 6L6 18',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4M8 13h3v3H8z',
  mystery: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM14.5 14.5L21 21',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  restart: 'M4 4v6h6M4.5 15a8 8 0 1 0 2-8.5L4 10',
  star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6',
  flame: 'M12 3s5 4.5 5 9.5A5 5 0 0 1 7 12.5C7 9.8 9 8 9 8s.5 2 2 2.5C11 7 12 3 12 3z',
  infinity: 'M7 9a3 3 0 1 0 0 6c3 0 7-6 10-6a3 3 0 1 1 0 6c-3 0-7-6-10-6z',
  shuffle: 'M3 6h4l10 12h4M3 18h4l3-3.6M14 9.6L17 6h4M18 3l3 3-3 3M18 15l3 3-3 3',
  note: 'M5 3h10l4 4v14H5zM9 9h6M9 13h6M9 17h4',
  pin: 'M12 2a5 5 0 0 1 5 5c0 4-5 9-5 9s-5-5-5-9a5 5 0 0 1 5-5zM12 16v6',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0',
  scale: 'M12 3v18M5 7h14M5 7l-3 7h6zM19 7l-3 7h6zM8 21h8',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  menu: 'M4 6h16M4 12h16M4 18h16',
  vault: 'M3 4h18v16H3zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12l2.5-1.5M7 20v1M17 20v1',
};

export function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={`icon ${className ?? ''}`}>
      <path d={P[name] ?? P.star} />
    </svg>
  );
}
