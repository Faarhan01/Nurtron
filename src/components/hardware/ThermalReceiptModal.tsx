/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Printer, Download, X, Check, Copy, Share2 } from 'lucide-react';
import { Transaction, PaymentMethod } from '../../types';
import { formatCurrencyValue } from '../../lib/financialMath';
import { buildEscPosRawBytes } from '../../lib/escpos';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  currencySymbol?: string;
  currency?: string;
  theme?: 'dark' | 'light';
  storeInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    taxNumber?: string;
    vatNumber?: string;
    receiptHeader?: string;
    receiptFooter?: string;
    logoUrl?: string;
  };
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeTaxNumber?: string;
}

/**
 * BLOCK: Thermal Receipt Modal & ESC/POS Print Engine
 * Provides an authentic 58mm / 80mm thermal receipt visualizer with raw ESC/POS
 * byte buffer export and native browser print styles.
 */
export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  currencySymbol,
  currency = 'R',
  theme = 'dark',
  storeInfo,
  storeName: directStoreName,
  storeAddress: directStoreAddress,
  storePhone: directStorePhone,
  storeTaxNumber: directStoreTaxNumber,
}) => {
  const receiptRef = useRef<HTMLDivElement | null>(null);

  const activeCurrencySymbol = currencySymbol || currency || 'R';
  const effectiveStoreName = storeInfo?.name || directStoreName || 'MEGAPOS RETAIL';
  const effectiveStoreAddress = storeInfo?.address || directStoreAddress || '123 Market Square, Central District';
  const effectiveStorePhone = storeInfo?.phone || directStorePhone || '+27 11 456 7890';
  const effectiveStoreTaxNumber = storeInfo?.taxNumber || storeInfo?.vatNumber || directStoreTaxNumber || 'VAT 4920192831';

  if (!isOpen || !transaction) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleDownloadEscPos = () => {
    const rawBytes = buildEscPosRawBytes(transaction, {
      paperWidth: '80mm',
      storeName: effectiveStoreName,
      storeAddress: effectiveStoreAddress,
      storePhone: effectiveStorePhone,
      storeTaxNumber: effectiveStoreTaxNumber,
      currencySymbol: activeCurrencySymbol,
      openCashDrawer: true,
      cutPaper: true,
    });

    const blob = new Blob([rawBytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${transaction.id}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="popup-card-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:p-0 print:bg-white">
      {/* BLOCK: Modal Container Card */}
      <div className="popup-card w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-w-none print:w-full print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* ELEMENT: Header (Hidden when printing) */}
        <div className="popup-card__header flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/80 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Receipt Generated</h3>
              <p className="text-xs text-zinc-400">Order #{transaction.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="popup-card__close-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ELEMENT: Thermal Paper Simulation */}
        <div className="popup-card__body p-6 overflow-y-auto bg-zinc-950/50 flex justify-center print:p-0 print:bg-white">
          <div
            ref={receiptRef}
            className="thermal-receipt-sheet w-full max-w-[320px] bg-white text-zinc-900 p-5 rounded-lg shadow-xl font-mono text-xs select-text space-y-3 print:shadow-none print:max-w-none print:w-full print:p-2"
          >
            {/* Header */}
            <div className="text-center space-y-0.5">
              <h2 className="text-base font-black tracking-tight">{effectiveStoreName}</h2>
              <p className="text-[11px] text-zinc-600">{effectiveStoreAddress}</p>
              <p className="text-[11px] text-zinc-600">Tel: {effectiveStorePhone}</p>
              <p className="text-[11px] text-zinc-600">{effectiveStoreTaxNumber}</p>
            </div>

            <div className="border-t border-b border-dashed border-zinc-400 py-1.5 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold">#{transaction.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(transaction.timestamp).toLocaleDateString()} {new Date(transaction.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{transaction.cashierId || 'Terminal 1'}</span>
              </div>
              {transaction.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{transaction.customerName}</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between font-bold border-b border-zinc-300 pb-1">
                <span>ITEM</span>
                <span>TOTAL</span>
              </div>

              {transaction.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="truncate max-w-[190px]">
                    <div>{item.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {item.quantity} x {formatCurrencyValue(item.priceOverride ?? item.price, activeCurrencySymbol)}
                      {item.discount ? ` (-${item.discount}%)` : ''}
                    </div>
                  </div>
                  <span className="font-bold">
                    {formatCurrencyValue((item.priceOverride ?? item.price) * item.quantity, activeCurrencySymbol)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-zinc-400 pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrencyValue(transaction.totalAmount + transaction.discount - transaction.tax, activeCurrencySymbol)}</span>
              </div>
              {transaction.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount Savings:</span>
                  <span>-{formatCurrencyValue(transaction.discount, activeCurrencySymbol)}</span>
                </div>
              )}
              {transaction.tax > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Tax (Included):</span>
                  <span>{formatCurrencyValue(transaction.tax, activeCurrencySymbol)}</span>
                </div>
              )}
              <div className="border-t border-zinc-900 pt-1 flex justify-between text-sm font-black">
                <span>TOTAL DUE:</span>
                <span>{formatCurrencyValue(transaction.totalAmount, activeCurrencySymbol)}</span>
              </div>
            </div>

            {/* Tender Breakdown */}
            <div className="border-t border-dashed border-zinc-400 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>Method:</span>
                <span className="uppercase">{transaction.paymentMethod}</span>
              </div>

              {transaction.tenders && transaction.tenders.map((t, idx) => (
                <div key={idx} className="flex justify-between pl-2 text-zinc-700">
                  <span className="capitalize">&gt; {t.method.replace('_', ' ')}:</span>
                  <span>{formatCurrencyValue(t.amount, activeCurrencySymbol)}</span>
                </div>
              ))}

              {transaction.tenderedAmount !== undefined && transaction.tenderedAmount > 0 && (
                <div className="flex justify-between text-zinc-700">
                  <span>Tendered:</span>
                  <span>{formatCurrencyValue(transaction.tenderedAmount, activeCurrencySymbol)}</span>
                </div>
              )}

              {transaction.changeAmount !== undefined && transaction.changeAmount > 0 && (
                <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-200 pt-0.5">
                  <span>CHANGE:</span>
                  <span>{formatCurrencyValue(transaction.changeAmount, activeCurrencySymbol)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-3 border-t border-dashed border-zinc-400 text-[10px] text-zinc-600 space-y-1">
              <p className="font-semibold">Thank you for shopping with us!</p>
              <p>Goods may be returned within 14 days with original receipt.</p>
              <div className="pt-2 font-mono text-[9px] text-zinc-400">
                *** MEGAPOS CLOUD POS ***
              </div>
            </div>
          </div>
        </div>

        {/* ELEMENT: Footer Controls (Hidden when printing) */}
        <div className="popup-card__footer px-5 py-3.5 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between print:hidden">
          <button
            onClick={handleDownloadEscPos}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1.5 transition-colors"
            title="Download raw ESC/POS binary buffer"
          >
            <Download className="w-4 h-4" />
            <span>ESC/POS Raw</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleBrowserPrint}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
