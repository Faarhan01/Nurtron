/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ESC/POS Thermal Receipt & Hardware Peripheral Command Generator
 * Generates raw byte buffers and printable formatted strings for 58mm / 80mm thermal receipt printers.
 */

import { Transaction, PaymentMethod } from '../types';
import { formatCurrencyValue } from './financialMath';

export interface EscPosOptions {
  paperWidth: '58mm' | '80mm';
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeTaxNumber?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  currencySymbol?: string;
  openCashDrawer?: boolean;
  cutPaper?: boolean;
}

export function buildEscPosRawBytes(transaction: Transaction, options: EscPosOptions): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  const ESC = 0x1B;
  const GS = 0x1D;
  const LF = 0x0A;

  // Initialize printer
  bytes.push(ESC, 0x40);

  // Open Cash Drawer if configured
  if (options.openCashDrawer && (transaction.paymentMethod === PaymentMethod.CASH || transaction.paymentMethod === PaymentMethod.SPLIT)) {
    // Pulse to standard pin 2 (m=0, t1=25 * 2ms, t2=250 * 2ms)
    bytes.push(ESC, 0x70, 0x00, 0x19, 0xFA);
  }

  // Helper to push text
  const pushText = (text: string) => {
    const encoded = encoder.encode(text);
    for (let i = 0; i < encoded.length; i++) {
      bytes.push(encoded[i]);
    }
  };

  const setAlign = (align: 'left' | 'center' | 'right') => {
    const val = align === 'left' ? 0x00 : align === 'center' ? 0x01 : 0x02;
    bytes.push(ESC, 0x61, val);
  };

  const setBold = (bold: boolean) => {
    bytes.push(ESC, 0x45, bold ? 0x01 : 0x00);
  };

  const setDoubleHeight = (enable: boolean) => {
    bytes.push(ESC, 0x21, enable ? 0x10 : 0x00);
  };

  // Header Section
  setAlign('center');
  setBold(true);
  setDoubleHeight(true);
  pushText(`${options.storeName || 'MEGAPOS RETAIL'}\n`);
  setDoubleHeight(false);
  setBold(false);

  if (options.storeAddress) pushText(`${options.storeAddress}\n`);
  if (options.storePhone) pushText(`Tel: ${options.storePhone}\n`);
  if (options.storeTaxNumber) pushText(`Tax Reg: ${options.storeTaxNumber}\n`);
  if (options.receiptHeader) pushText(`${options.receiptHeader}\n`);

  const cols = options.paperWidth === '58mm' ? 32 : 48;
  const divider = '-'.repeat(cols) + '\n';
  pushText(divider);

  // Metadata
  setAlign('left');
  pushText(`Receipt: #${transaction.id.slice(-8).toUpperCase()}\n`);
  pushText(`Date: ${new Date(transaction.timestamp).toLocaleString()}\n`);
  pushText(`Cashier: ${transaction.cashierId || 'Terminal'}\n`);
  if (transaction.customerName) {
    pushText(`Customer: ${transaction.customerName}\n`);
  }
  pushText(divider);

  // Item Table
  setBold(true);
  if (options.paperWidth === '58mm') {
    pushText('ITEM              QTY     TOTAL\n');
  } else {
    pushText('ITEM DESCRIPTION          QTY    PRICE    TOTAL\n');
  }
  setBold(false);
  pushText(divider);

  const cur = options.currencySymbol || 'R';

  for (const item of transaction.items) {
    const name = (item.name || 'Item').slice(0, options.paperWidth === '58mm' ? 14 : 22).padEnd(options.paperWidth === '58mm' ? 14 : 22);
    const qty = `${item.quantity}x`.padStart(5);
    const itemTotal = formatCurrencyValue((item.priceOverride ?? item.price) * item.quantity, '').trim().padStart(10);

    if (options.paperWidth === '58mm') {
      pushText(`${name} ${qty} ${itemTotal}\n`);
    } else {
      const unitPrice = formatCurrencyValue(item.priceOverride ?? item.price, '').trim().padStart(8);
      pushText(`${name} ${qty} ${unitPrice} ${itemTotal}\n`);
    }
  }

  pushText(divider);

  // Summary Totals
  setAlign('right');
  pushText(`Subtotal: ${formatCurrencyValue(transaction.totalAmount + transaction.discount - transaction.tax, cur)}\n`);
  if (transaction.discount > 0) {
    pushText(`Discount Savings: -${formatCurrencyValue(transaction.discount, cur)}\n`);
  }
  if (transaction.tax > 0) {
    pushText(`Tax: ${formatCurrencyValue(transaction.tax, cur)}\n`);
  }
  
  setBold(true);
  setDoubleHeight(true);
  pushText(`TOTAL: ${formatCurrencyValue(transaction.totalAmount, cur)}\n`);
  setDoubleHeight(false);
  setBold(false);

  // Payment Breakdown
  pushText(divider);
  setAlign('left');
  pushText(`Payment Method: ${transaction.paymentMethod.toUpperCase()}\n`);

  if (transaction.tenders && transaction.tenders.length > 0) {
    for (const tender of transaction.tenders) {
      pushText(` > ${tender.method.toUpperCase()}: ${formatCurrencyValue(tender.amount, cur)}\n`);
    }
  }

  if (transaction.tenderedAmount !== undefined && transaction.tenderedAmount > 0) {
    pushText(`Amount Tendered: ${formatCurrencyValue(transaction.tenderedAmount, cur)}\n`);
  }
  if (transaction.changeAmount !== undefined && transaction.changeAmount > 0) {
    setBold(true);
    pushText(`CHANGE GIVEN: ${formatCurrencyValue(transaction.changeAmount, cur)}\n`);
    setBold(false);
  }

  // Footer & Barcode
  pushText(divider);
  setAlign('center');
  if (options.receiptFooter) {
    pushText(`${options.receiptFooter}\n`);
  } else {
    pushText('Thank you for your business!\nPlease keep this receipt for returns.\n');
  }

  // Feed lines & Cut paper
  pushText('\n\n\n');
  if (options.cutPaper !== false) {
    bytes.push(GS, 0x56, 0x41, 0x03); // Full/Partial cut with feed
  }

  return new Uint8Array(bytes);
}
