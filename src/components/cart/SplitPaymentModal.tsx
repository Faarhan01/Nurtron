/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Split, Banknote, CreditCard, QrCode, Wallet, Gift, X, Plus, Trash2, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { PaymentMethod, PaymentTender, Transaction, TransactionStatus } from '../../types';
import { formatCurrencyValue, generateQuickCashSuggestions, roundHalfUp } from '../../lib/financialMath';

interface SplitPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
  currency?: string;
  totalDue?: number;
  theme?: 'dark' | 'light';
  cashierId?: string;
  cashierName?: string;
  onTransactionComplete?: (transaction: Transaction) => void;
  onCompleteSplitPayment?: (splitTenders: { method: PaymentMethod; amount: number; reference?: string }[]) => void;
}

/**
 * BLOCK: Split Tender Payment Modal
 * Allows customers to split their cart total across multiple tender types
 * (e.g. $20 Cash + $45 Card + $10 Store Credit) with real-time balance calculations.
 */
export const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({
  isOpen,
  onClose,
  currencySymbol,
  currency = 'R',
  totalDue,
  theme = 'dark',
  cashierId = 'Terminal',
  cashierName = 'Staff',
  onTransactionComplete,
  onCompleteSplitPayment,
}) => {
  const activeCurrencySymbol = currencySymbol || currency || 'R';
  const {
    cart,
    total: contextTotal,
    tax,
    totalDiscount,
    customer,
    tenders,
    addTender,
    removeTender,
    clearTenders,
    splitTotalPaid,
    splitRemainingBalance: contextRemaining,
    isSplitFullyPaid: contextFullyPaid,
    splitChangeDue,
    clearCart,
  } = useCart();

  const effectiveTotal = totalDue !== undefined && totalDue > 0 ? totalDue : contextTotal;
  const isPaid = effectiveTotal > 0 && splitTotalPaid >= effectiveTotal;
  const remainingDue = Math.max(0, effectiveTotal - splitTotalPaid);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [tenderAmountInput, setTenderAmountInput] = useState<string>('');
  const [tenderCashGivenInput, setTenderCashGivenInput] = useState<string>('');
  const [tenderReference, setTenderReference] = useState<string>('');
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentTenderAmount = parseFloat(tenderAmountInput) || (remainingDue > 0 ? remainingDue : 0);
  const currentCashGiven = parseFloat(tenderCashGivenInput) || currentTenderAmount;
  const changeForThisTender = selectedMethod === PaymentMethod.CASH && currentCashGiven > currentTenderAmount
    ? roundHalfUp(currentCashGiven - currentTenderAmount, 2)
    : 0;

  const quickCashOptions = generateQuickCashSuggestions(remainingDue > 0 ? remainingDue : effectiveTotal);

  const handleAddTender = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(tenderAmountInput) || remainingDue;
    if (amt <= 0) return;

    const cashGiven = selectedMethod === PaymentMethod.CASH && tenderCashGivenInput ? parseFloat(tenderCashGivenInput) : amt;

    addTender(
      selectedMethod,
      amt,
      selectedMethod === PaymentMethod.CASH ? cashGiven : undefined,
      tenderReference.trim() || undefined
    );

    // Reset inputs
    setTenderAmountInput('');
    setTenderCashGivenInput('');
    setTenderReference('');
  };

  const handleQuickPreset = (presetAmount: number) => {
    const amountToApply = Math.min(presetAmount, remainingDue > 0 ? remainingDue : effectiveTotal);
    addTender(
      selectedMethod,
      amountToApply,
      selectedMethod === PaymentMethod.CASH ? presetAmount : undefined
    );
    setTenderAmountInput('');
    setTenderCashGivenInput('');
  };

  const handleFinalizeTransaction = () => {
    if (!isPaid) return;

    setIsFinalizing(true);

    if (onCompleteSplitPayment) {
      onCompleteSplitPayment(
        tenders.map((t) => ({
          method: t.method,
          amount: t.amount,
          reference: t.reference,
        }))
      );
      clearTenders();
      setIsFinalizing(false);
      onClose();
      return;
    }

    if (onTransactionComplete && cart.length > 0) {
      const transaction: Transaction = {
        id: `TX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
        items: [...cart],
        totalAmount: effectiveTotal,
        tax,
        discount: totalDiscount,
        paymentMethod: PaymentMethod.SPLIT,
        status: TransactionStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        cashierId,
        customerName: customer ? customer.name : undefined,
        customerPhone: customer ? customer.phone : undefined,
        customerId: customer ? customer.id : undefined,
        tenders: [...tenders],
        changeAmount: splitChangeDue,
      };

      onTransactionComplete(transaction);
      clearCart();
    }

    clearTenders();
    setIsFinalizing(false);
    onClose();
  };

  return (
    <div className="popup-card-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      {/* BLOCK: Split Payment Modal Card */}
      <div className="popup-card w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* ELEMENT: Header */}
        <div className="popup-card__header flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Split Tender Checkout</h3>
              <p className="text-xs text-zinc-400">Combine multiple payment methods for a single receipt</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="popup-card__close-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="popup-card__body p-6 overflow-y-auto space-y-6 flex-1">
          {/* ELEMENT: Financial Summary Bar */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">Total Due</span>
              <span className="text-xl font-black text-white font-mono">{formatCurrencyValue(effectiveTotal, activeCurrencySymbol)}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Paid So Far</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{formatCurrencyValue(splitTotalPaid, activeCurrencySymbol)}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Remaining</span>
              <span className={`text-xl font-black font-mono ${remainingDue === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {formatCurrencyValue(remainingDue, activeCurrencySymbol)}
              </span>
            </div>
          </div>

          {/* ELEMENT: Tender Entry Form */}
          {!isPaid && (
            <div className="space-y-4 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Add Payment Tender</h4>

              {/* Method Selector Tabs */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { method: PaymentMethod.CASH, label: 'Cash', icon: Banknote },
                  { method: PaymentMethod.CARD, label: 'Card', icon: CreditCard },
                  { method: PaymentMethod.UPI, label: 'UPI / QR', icon: QrCode },
                  { method: PaymentMethod.STORE_CREDIT, label: 'Credit', icon: Wallet },
                ].map(({ method, label, icon: Icon }) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedMethod(method)}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      selectedMethod === method
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-xs'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Quick Cash Suggestions */}
              {selectedMethod === PaymentMethod.CASH && (
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 block mb-1.5">Quick Cash Presets</label>
                  <div className="flex flex-wrap gap-2">
                    {quickCashOptions.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickPreset(amt)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-purple-600/20 border border-zinc-700 hover:border-purple-500/50 text-xs font-bold text-zinc-200 transition-colors"
                      >
                        {formatCurrencyValue(amt, activeCurrencySymbol)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Inputs */}
              <form onSubmit={handleAddTender} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-medium text-zinc-300 block mb-1">Amount to Apply</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={remainingDue.toString()}
                    value={tenderAmountInput}
                    onChange={(e) => setTenderAmountInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono focus:outline-hidden focus:border-purple-500"
                  />
                </div>

                {selectedMethod === PaymentMethod.CASH && (
                  <div>
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1">Cash Given by Customer</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={tenderAmountInput || remainingDue.toString()}
                      value={tenderCashGivenInput}
                      onChange={(e) => setTenderCashGivenInput(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Record Tender
                  </button>
                </div>
              </form>

              {changeForThisTender > 0 && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-400">
                  <span>Change to return on this cash tender:</span>
                  <span className="font-bold text-sm font-mono">{formatCurrencyValue(changeForThisTender, activeCurrencySymbol)}</span>
                </div>
              )}
            </div>
          )}

          {/* ELEMENT: Recorded Tenders Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Recorded Payment Ledger</h4>

            {tenders.length === 0 ? (
              /* BLOCK: Empty Payment Ledger Card */
              <div className="payment-ledger-empty-card p-8 rounded-2xl bg-zinc-950/40 border border-zinc-800 flex flex-col items-center justify-center text-center">
                <CreditCard size={48} strokeWidth={1.5} className="payment-ledger-empty-card__icon mb-2 text-cyan-400" />
                <p className="payment-ledger-empty-card__title text-base font-bold tracking-tight font-presale text-white">No Payment Tenders Recorded</p>
                <p className="payment-ledger-empty-card__subtitle text-xs font-presale tracking-wide text-zinc-400 mt-1 max-w-xs">
                  Select a method above to record payments and split the balance
                </p>
              </div>
            ) : (
              <div className="table-responsive border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                <table className="table w-full text-left text-xs">
                  <thead className="table__head bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <tr>
                      <th className="p-3">Method</th>
                      <th className="p-3">Amount Applied</th>
                      <th className="p-3">Cash Given</th>
                      <th className="p-3">Change</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="table__body divide-y divide-zinc-800/60">
                    {tenders.map((tender) => (
                      <tr key={tender.id} className="table__row hover:bg-zinc-900/40">
                        <td className="p-3 font-semibold text-white capitalize flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-400" />
                          {tender.method.replace('_', ' ')}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {formatCurrencyValue(tender.amount, activeCurrencySymbol)}
                        </td>
                        <td className="p-3 font-mono text-zinc-300">
                          {tender.tenderedAmount ? formatCurrencyValue(tender.tenderedAmount, activeCurrencySymbol) : '-'}
                        </td>
                        <td className="p-3 font-mono text-amber-400">
                          {tender.changeGiven ? formatCurrencyValue(tender.changeGiven, activeCurrencySymbol) : '-'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => removeTender(tender.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Remove tender"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Status Message */}
          {isPaid && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-400">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold">Total is Fully Settled!</p>
                  <p className="text-[11px] text-emerald-300/80">Click below to finalize transaction and issue receipt.</p>
                </div>
              </div>

              {splitChangeDue > 0 && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">Total Change Due</span>
                  <span className="text-base font-black font-mono">{formatCurrencyValue(splitChangeDue, activeCurrencySymbol)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ELEMENT: Footer Actions */}
        <div className="popup-card__footer px-6 py-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <button
            onClick={() => {
              clearTenders();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>

          <button
            disabled={!isPaid || isFinalizing}
            onClick={handleFinalizeTransaction}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
              isPaid && !isFinalizing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-900/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>{isFinalizing ? 'Processing...' : 'Complete Split Sale & Print Receipt'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
