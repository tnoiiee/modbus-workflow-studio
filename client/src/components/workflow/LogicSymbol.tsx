import { Box } from 'lucide-react';
import type { ReactNode } from 'react';

import { GATE_SYMBOL_TYPES } from '../../lib/blockMetadata.js';

/** Types rendered with an IEC gate glyph. Single source: block metadata. */
export const LOGIC_SYMBOL_TYPES: ReadonlySet<string> = GATE_SYMBOL_TYPES;

/**
 * IEC gate glyph used on logic blocks and on their library cards.
 * Moved verbatim out of `App.tsx` so the library and the canvas share one
 * renderer; the drawn shapes, viewBox, and fallback are unchanged.
 */
export const LogicSymbol = ({ type }: { type: string }) => {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const bubble = type === 'NAND' || type === 'NOR' || type === 'NOT' ? <circle {...common} cx="20.5" cy="12" r="2" /> : null;
  let shape: ReactNode = null;
  if (type === 'AND' || type === 'NAND')
    shape = (
      <>
        <path {...common} d="M5 4h6c5 0 8 3.6 8 8s-3 8-8 8H5z" />
        <path {...common} d="M2 8h3M2 16h3M19 12h1.5" />
      </>
    );
  else if (['OR', 'NOR', 'XOR'].includes(type))
    shape = (
      <>
        <path {...common} d="M5 4c4 4 4 12 0 16 7 0 11-2.5 14-8-3-5.5-7-8-14-8z" />
        <path {...common} d="M2 8h5M2 16h5M19 12h1.5" />
        {type === 'XOR' && <path {...common} d="M2.5 4c4 4 4 12 0 16" />}
      </>
    );
  else if (type === 'NOT')
    shape = (
      <>
        <path {...common} d="M4 4v16l14-8z" />
        <path {...common} d="M2 12h2M22.5 12H24" />
      </>
    );
  else if (type === 'SR_LATCH' || type === 'RS_LATCH')
    shape = (
      <>
        <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
        <text x="7" y="10" fontSize="7" fill="currentColor">
          {type === 'SR_LATCH' ? 'S' : 'R'}
        </text>
        <text x="7" y="18" fontSize="7" fill="currentColor">
          {type === 'SR_LATCH' ? 'R' : 'S'}
        </text>
        <text x="15" y="14" fontSize="8" fill="currentColor">
          Q
        </text>
        <path {...common} d="M1 8h3M1 16h3M20 12h3" />
      </>
    );
  else if (type === 'RISING_EDGE') shape = <path {...common} d="M2 18h7V6h13" />;
  else if (type === 'FALLING_EDGE') shape = <path {...common} d="M2 6h7v12h13" />;
  if (!shape) return <Box size={16} />;
  return (
    <span className="logic-symbol" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {shape}
        {bubble}
      </svg>
    </span>
  );
};
