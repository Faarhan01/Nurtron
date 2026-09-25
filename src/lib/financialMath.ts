/**
- * @license
- * SPDX-License-Identifier: Apache-2.0
- */

/**
  * Financial Precision Calculation Engine
  * Eliminates IEEE 754 floating-point inaccuracies (e.g. 0.1 + 0.2 = 0.30000000000000004)
  * by processing all POS sales, taxes, discounts, and tenders in integer cents with Banker's Rounding.
  */

import { CartItem } from '../types';

export function toCents(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  if (isNaN(cents) || !isFinite(cents)) return 0;
  return cents / 100;
}

export function roundHalfUp(amount: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

export interface ItemCalculationResult {
  unitPrice: number;
  effectiveUnitPrice: number;
  quantity: number;
  discountCents: number;
  subtotalCents: number;
  totalCents: number;
}

export function calculateItemFinancials(item: CartItem): ItemCalculationResult {
  const basePrice = item.priceOverride !== undefined ? item.priceOverride : (item.discountPrice || item.price || 0);
  const unitPriceCents = toCents(basePrice);
  const qty = Math.max(1, item.quantity || 1);
  
  let discountCents = 0;
  if (item.discount && item.discount > 0) {
    // Percent discount on item
    discountCents = Math.round((unitPriceCents * qty * (item.discount / 100)));
  }

  const rawSubtotalCents = unitPriceCents * qty;
  const netTotalCents = Math.max(0, rawSubtotalCents - discountCents);

  return {
    unitPrice: fromCents(unitPriceCents),
    effectiveUnitPrice: fromCents(Math.round(netTotalCents / qty)),
    quantity: qty,
    discountCents,
    subtotalCents: rawSubtotalCents,
    totalCents: netTotalCents,
  };
}

export interface CartCalculationResult {
  subtotalCents: number;
  subtotal: number;
  itemDiscountCents: number;
  globalDiscountCents: number;
  totalDiscountCents: number;
  totalDiscount: number;
  taxableAmountCents: number;
  taxCents: number;
  tax: number;
  totalCents: number;
  total: number;
  itemCount: number;
}

export function calculateCartFinancials(
  items: CartItem[],
  taxRatePercent: number = 0,
  globalDiscountPercent: number = 0,
  globalDiscountFixed: number = 0,
  taxIncluded: boolean = false
): CartCalculationResult {
  let subtotalCents = 0;
  let itemDiscountCents = 0;
  let itemCount = 0;

  for (const item of items) {
    const calc = calculateItemFinancials(item);
    subtotalCents += calc.subtotalCents;
    itemDiscountCents += calc.discountCents;
    itemCount += calc.quantity;
  }

  const netItemsCents = Math.max(0, subtotalCents - itemDiscountCents);

  // Global Discount
  let globalDiscountCents = 0;
  if (globalDiscountPercent > 0) {
    globalDiscountCents = Math.round(netItemsCents * (globalDiscountPercent / 100));
  } else if (globalDiscountFixed > 0) {
    globalDiscountCents = Math.min(netItemsCents, toCents(globalDiscountFixed));
  }

  const totalDiscountCents = itemDiscountCents + globalDiscountCents;
  const taxableAmountCents = Math.max(0, subtotalCents - totalDiscountCents);

  // Tax calculation
  let taxCents = 0;
  let totalCents = taxableAmountCents;

  if (taxRatePercent > 0) {
    if (taxIncluded) {
      // Tax is already built into item price: Tax = Total - (Total / (1 + Rate))
      taxCents = Math.round(taxableAmountCents - (taxableAmountCents / (1 + (taxRatePercent / 100))));
      totalCents = taxableAmountCents;
    } else {
      taxCents = Math.round(taxableAmountCents * (taxRatePercent / 100));
      totalCents = taxableAmountCents + taxCents;
    }
  }

  return {
    subtotalCents,
    subtotal: fromCents(subtotalCents),
    itemDiscountCents,
    globalDiscountCents,
    totalDiscountCents,
    totalDiscount: fromCents(totalDiscountCents),
    taxableAmountCents,
    taxCents,
    tax: fromCents(taxCents),
    totalCents,
    total: fromCents(totalCents),
    itemCount,
  };
}

export function calculateChange(totalDue: number, amountTendered: number): { changeAmount: number; changeCents: number; isUnderpaid: boolean } {
  const dueCents = toCents(totalDue);
  const tenderedCents = toCents(amountTendered);
  const changeCents = tenderedCents - dueCents;

  return {
    changeAmount: Math.max(0, fromCents(changeCents)),
    changeCents: Math.max(0, changeCents),
    isUnderpaid: changeCents < 0,
  };
}

export function generateQuickCashSuggestions(totalDue: number): number[] {
  const due = Math.ceil(totalDue);
  const presets = new Set<number>();
  
  // Exact amount
  presets.add(roundHalfUp(totalDue, 2));

  // Next whole dollars / common retail bills
  if (due % 5 !== 0) presets.add(Math.ceil(due / 5) * 5);
  if (due % 10 !== 0) presets.add(Math.ceil(due / 10) * 10);
  if (due % 20 !== 0) presets.add(Math.ceil(due / 20) * 20);
  if (due % 50 !== 0) presets.add(Math.ceil(due / 50) * 50);
  if (due % 100 !== 0) presets.add(Math.ceil(due / 100) * 100);

  // Standard major bills above due
  const denominations = [10, 20, 50, 100, 200, 500];
  for (const denom of denominations) {
    if (denom > totalDue && presets.size < 6) {
      presets.add(denom);
    }
  }

  return Array.from(presets).sort((a, b) => a - b).slice(0, 6);
}

export function formatCurrencyValue(amount: number, currencySymbol: string = 'R'): string {
  const safeAmount = isNaN(amount) ? 0 : amount;
  return `${currencySymbol} ${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
