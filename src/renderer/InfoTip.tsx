import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const MARGIN = 8;
const GAP = 6;

interface Props {
  children: ReactNode;
  /** "warn" draws an amber "!" badge for things the user should check. */
  variant?: 'info' | 'warn';
  label?: string;
  /** Makes the badge a button, e.g. to mark an imported value as checked. */
  onActivate?: () => void;
}

/**
 * Small "i" badge that shows an explanation on hover or keyboard focus.
 * The popover is fixed to the window so scrolling panels can't clip it, and it is
 * kept inside the window: shifted sideways, and flipped above the badge when needed.
 */
export function InfoTip({ children, variant = 'info', label = 'More information', onActivate }: Props) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !badgeRef.current || !popRef.current) return;
    const badge = badgeRef.current.getBoundingClientRect();
    const pop = popRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(MARGIN, badge.left - MARGIN), window.innerWidth - pop.width - MARGIN);
    const below = badge.bottom + GAP;
    const top =
      below + pop.height + MARGIN <= window.innerHeight ? below : Math.max(MARGIN, badge.top - GAP - pop.height);
    setPos({ left, top });
  }, [open]);

  const show = () => setOpen(true);
  const hide = () => {
    setOpen(false);
    setPos(null);
  };

  return (
    <span
      ref={badgeRef}
      className={`info-tip${variant === 'warn' ? ' warn' : ''}${onActivate ? ' clickable' : ''}`}
      tabIndex={0}
      role={onActivate ? 'button' : undefined}
      aria-label={label}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      // Inside a <label>, a click would otherwise toggle its checkbox.
      onClick={(e) => {
        e.preventDefault();
        // Clicks inside the popover (reading, selecting text) don't count as activating the badge.
        if (!popRef.current?.contains(e.target as Node)) onActivate?.();
      }}
      onKeyDown={(e) => {
        if (onActivate && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {variant === 'warn' ? '!' : 'i'}
      {open && (
        <span
          ref={popRef}
          className="info-pop"
          role="tooltip"
          // Measured off-screen first, then placed.
          style={pos ?? { left: -9999, top: 0 }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
