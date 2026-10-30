import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Which edge the popover lines up with, so it stays inside its column. */
  align?: 'left' | 'right';
}

/** Small "i" badge that shows an explanation on hover or keyboard focus. */
export function InfoTip({ children, align = 'left' }: Props) {
  return (
    <span className="info-tip" tabIndex={0} aria-label="More information">
      i
      <span className={`info-pop ${align}`} role="tooltip">
        {children}
      </span>
    </span>
  );
}
