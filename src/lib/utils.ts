import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function triggerModalPulse(targetElement?: HTMLElement | null) {
  if (!targetElement) return;
  targetElement.classList.remove('modal-pulse-warning');
  void targetElement.offsetWidth;
  targetElement.classList.add('modal-pulse-warning');
  setTimeout(() => {
    targetElement.classList.remove('modal-pulse-warning');
  }, 450);
}

export function isRootModalCard(el: HTMLElement): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const className = typeof el.className === 'string' ? el.className : '';

  // 1. Must not be a backdrop or backdrop overlay
  if (className.includes('backdrop') || className.includes('overlay__backdrop')) return false;

  // 2. Reject internal BEM sub-elements (elements with double underscore like __icon, __header, __body, __title, __footer, __accent, __button)
  const classList = Array.from(el.classList);
  const isBEMChild = classList.some(cls => 
    cls.includes('__') && (
      cls.includes('__icon') || 
      cls.includes('__header') || 
      cls.includes('__body') || 
      cls.includes('__footer') || 
      cls.includes('__title') || 
      cls.includes('__subtitle') || 
      cls.includes('__accent') || 
      cls.includes('__button') || 
      cls.includes('__content')
    )
  );
  if (isBEMChild) return false;

  return true;
}

export function handleBackdropClick(e: React.MouseEvent<HTMLElement>) {
  e.preventDefault();
  e.stopPropagation();

  const backdropEl = e.currentTarget as HTMLElement;
  const overlayContainer = backdropEl.parentElement || backdropEl;

  // Step 1: Look at direct children of overlayContainer.
  // The root modal card is ALWAYS a direct child of overlayContainer and a sibling to backdropEl.
  const directChildren = Array.from(overlayContainer.children) as HTMLElement[];
  let modalCard = directChildren.find(el => el !== backdropEl && isRootModalCard(el) && el.offsetWidth > 0) || null;

  // Step 2: Fallback if overlay structure is nested
  if (!modalCard) {
    const candidateSelector = '.popup-card, .unsaved-cart-popup-card, .settings-dirty-popup-card, .login-popup-card, .logout-popup-card, [role="dialog"], [class*="popup-card"], [class*="modal-card"]';
    const candidates = Array.from(overlayContainer.querySelectorAll<HTMLElement>(candidateSelector));
    
    modalCard = candidates.find(el => {
      if (!isRootModalCard(el) || el.offsetWidth === 0) return false;
      // Ensure it is not an internal child of another root modal card
      const parentModal = el.parentElement?.closest('.popup-card, .unsaved-cart-popup-card, .settings-dirty-popup-card, .login-popup-card, [role="dialog"]');
      return !parentModal || parentModal === el;
    }) || null;
  }

  if (modalCard) {
    triggerModalPulse(modalCard);
  }
}

export function formatCurrency(amount: number | undefined | null, currency: string = 'ZAR'): string {
  const safeAmount = amount || 0;
  
  if (currency === '') {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  }

  const safeCurrency = currency ? currency.trim() : 'ZAR';

  if (safeCurrency === 'ZAR' || safeCurrency === 'R') {
    const formatted = new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return `R${formatted}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
    }).format(safeAmount);
  } catch (e) {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeAmount);
    return `${safeCurrency} ${formatted}`;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;
  
  const isOfflineError = 
    errMsg.toLowerCase().includes('offline') || 
    errMsg.toLowerCase().includes('could not reach') ||
    errMsg.toLowerCase().includes('unavailable') ||
    errMsg.toLowerCase().includes('connection failed') ||
    errCode === 'unavailable' ||
    errCode === 'failed-precondition';

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isOfflineError) {
    console.warn('[Firestore Offline Detect] Operating in offline mode: ', JSON.stringify(errInfo));
    // Do not throw for connection/unavailability offline errors so the application can operate smoothly offline
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function maskEmail(email: string | undefined | null): string {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return email; // Not a valid email
  if (localPart.length <= 2) return `****@${domain}`;
  return `${localPart.substring(0, 2)}****@${domain}`;
}
