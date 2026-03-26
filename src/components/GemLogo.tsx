export default function GemLogo({ size = 32 }: { size?: number }) {
  const id = `gem-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Main body gradient */}
        <linearGradient id={`${id}-body`} x1="10" y1="5" x2="90" y2="95" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7b7" />
          <stop offset="0.3" stopColor="#34d399" />
          <stop offset="0.6" stopColor="#059669" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        {/* Crown highlight gradient */}
        <linearGradient id={`${id}-crown`} x1="20" y1="5" x2="80" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a7f3d0" />
          <stop offset="0.5" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        {/* Left pavilion */}
        <linearGradient id={`${id}-left`} x1="8" y1="35" x2="40" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#064e3b" />
        </linearGradient>
        {/* Right pavilion */}
        <linearGradient id={`${id}-right`} x1="60" y1="35" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        {/* Center pavilion */}
        <linearGradient id={`${id}-center`} x1="30" y1="40" x2="70" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="0.4" stopColor="#059669" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
        {/* Sparkle radial */}
        <radialGradient id={`${id}-sparkle`} cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="white" stopOpacity="1" />
          <stop offset="0.4" stopColor="white" stopOpacity="0.6" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        {/* Top shine */}
        <linearGradient id={`${id}-shine`} x1="30" y1="5" x2="70" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.5" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* === CROWN (top section) === */}
      {/* Left crown facet */}
      <polygon points="50,4 8,35 26,40" fill={`url(#${id}-crown)`} />
      {/* Right crown facet */}
      <polygon points="50,4 92,35 74,40" fill="#6ee7b7" />
      {/* Center-left crown */}
      <polygon points="50,4 26,40 42,38" fill="#34d399" />
      {/* Center-right crown */}
      <polygon points="50,4 74,40 58,38" fill="#4ade80" />
      {/* Table (top flat face) */}
      <polygon points="42,38 58,38 74,40 26,40" fill="#a7f3d0" opacity="0.6" />

      {/* === GIRDLE (middle band) === */}
      <polygon points="8,35 26,40 74,40 92,35" fill="#059669" opacity="0.4" />

      {/* === PAVILION (bottom section) === */}
      {/* Far left facet */}
      <polygon points="8,35 26,40 50,92" fill={`url(#${id}-left)`} />
      {/* Center-left facet */}
      <polygon points="26,40 42,38 50,92" fill="#047857" />
      {/* Center facet */}
      <polygon points="42,38 58,38 50,92" fill={`url(#${id}-center)`} />
      {/* Center-right facet */}
      <polygon points="58,38 74,40 50,92" fill="#059669" />
      {/* Far right facet */}
      <polygon points="74,40 92,35 50,92" fill={`url(#${id}-right)`} />

      {/* === FACET EDGE LINES === */}
      {/* Outer silhouette */}
      <polyline points="8,35 50,4 92,35 50,92 8,35" fill="none" stroke="#064e3b" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Crown internal edges */}
      <line x1="26" y1="40" x2="50" y2="4" stroke="#065f46" strokeWidth="0.7" opacity="0.6" />
      <line x1="74" y1="40" x2="50" y2="4" stroke="#065f46" strokeWidth="0.7" opacity="0.6" />
      <line x1="42" y1="38" x2="50" y2="4" stroke="#065f46" strokeWidth="0.5" opacity="0.4" />
      <line x1="58" y1="38" x2="50" y2="4" stroke="#065f46" strokeWidth="0.5" opacity="0.4" />
      {/* Girdle line */}
      <line x1="8" y1="35" x2="92" y2="35" stroke="#065f46" strokeWidth="0.5" opacity="0.5" />
      <line x1="26" y1="40" x2="74" y2="40" stroke="#065f46" strokeWidth="0.5" opacity="0.3" />
      {/* Pavilion internal edges */}
      <line x1="26" y1="40" x2="50" y2="92" stroke="#065f46" strokeWidth="0.6" opacity="0.4" />
      <line x1="74" y1="40" x2="50" y2="92" stroke="#065f46" strokeWidth="0.6" opacity="0.4" />
      <line x1="42" y1="38" x2="50" y2="92" stroke="#065f46" strokeWidth="0.4" opacity="0.3" />
      <line x1="58" y1="38" x2="50" y2="92" stroke="#065f46" strokeWidth="0.4" opacity="0.3" />

      {/* === LIGHT EFFECTS === */}
      {/* Top shine across crown */}
      <polygon points="50,4 35,20 65,20" fill={`url(#${id}-shine)`} />
      {/* Main sparkle - top right */}
      <circle cx="62" cy="18" r="8" fill={`url(#${id}-sparkle)`} />
      {/* Small sparkle - top left */}
      <circle cx="38" cy="14" r="4" fill={`url(#${id}-sparkle)`} opacity="0.5" />
      {/* Tiny sparkle points */}
      <circle cx="62" cy="18" r="2" fill="white" opacity="0.95" />
      <circle cx="38" cy="14" r="1.2" fill="white" opacity="0.7" />
      {/* Subtle table reflection */}
      <polygon points="44,38 56,38 54,40 46,40" fill="white" opacity="0.25" />
    </svg>
  );
}
