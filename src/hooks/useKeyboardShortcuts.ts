/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useCallback } from 'react';

export interface ShortcutHandlers {
  onSearchFocus?: () => void;
  onBarcodeScanModal?: () => void;
  onCustomerLookup?: () => void;
  onHoldCart?: () => void;
  onDiscountModal?: () => void;
  onExactCash?: () => void;
  onSplitPaymentModal?: () => void;
  onShiftModal?: () => void;
  onClearCart?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger if user is typing in standard text input or textarea (unless it's an F-key or Escape)
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        if (handlers.onEscape) {
          e.preventDefault();
          handlers.onEscape();
        }
        return;
      }

      // F-Keys always work regardless of focus
      if (e.key === 'F1') {
        e.preventDefault();
        handlers.onSearchFocus?.();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handlers.onBarcodeScanModal?.();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handlers.onCustomerLookup?.();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handlers.onHoldCart?.();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handlers.onDiscountModal?.();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handlers.onExactCash?.();
      } else if (e.key === 'F10') {
        e.preventDefault();
        handlers.onSplitPaymentModal?.();
      } else if (e.key === 'F12') {
        e.preventDefault();
        handlers.onShiftModal?.();
      }

      // Alt/Ctrl Combinations when not in input
      if (!isInput) {
        if (e.key === '/' || e.key === '?') {
          e.preventDefault();
          handlers.onSearchFocus?.();
        } else if (e.key === 'c' && (e.ctrlKey || e.altKey)) {
          e.preventDefault();
          handlers.onClearCart?.();
        }
      }
    },
    [handlers, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
