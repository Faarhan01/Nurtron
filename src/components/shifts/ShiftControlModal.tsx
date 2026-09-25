/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Landmark, ArrowDownRight, ArrowUpRight, FileText, CheckSquare, X, DollarSign, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { useShift } from '../../context/ShiftContext';
import { formatCurrencyValue, roundHalfUp } from '../../lib/financialMath';

interface ShiftControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
  cashierId?: string;
  cashierName?: string;
}

type ShiftTab = 'status' | 'open_shift' | 'cash_in' | 'cash_out' | 'x_report' | 'z_report';

/**
 * BLOCK: Shift Control & Cash Management Modal
 * Enables retail cashiers to open shifts with float balances, log cash in/out drops,
 * view mid-shift X-Reports, and finalize end-of-day Z-Reports with discrepancy calculations.
 */
export const ShiftControlModal: React.FC<ShiftControlModalProps> = ({
  isOpen,
  onClose,
  currencySymbol = 'R',
  cashierId = 'Terminal',
  cashierName = 'Staff',
}) => {
  const { currentShift, isShiftOpen, openShift, recordCashIn, recordCashOut, closeShift } = useShift();

  const [activeTab, setActiveTab] = useState<ShiftTab>(isShiftOpen ? 'status' : 'open_shift');
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('200.00');
  const [cashDropAmount, setCashDropAmount] = useState<string>('');
  const [cashDropReason, setCashDropReason] = useState<string>('');
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const floatAmt = parseFloat(openingFloatInput) || 0;
    openShift(floatAmt, cashierId, cashierName);
    setActiveTab('status');
    setFeedbackMessage('Shift opened successfully with cash float.');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleCashIn = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(cashDropAmount);
    if (!amt || amt <= 0 || !cashDropReason.trim()) return;

    recordCashIn(amt, cashDropReason.trim(), cashierId, cashierName);
    setCashDropAmount('');
    setCashDropReason('');
    setActiveTab('status');
    setFeedbackMessage(`Logged Cash In: +${formatCurrencyValue(amt, currencySymbol)}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleCashOut = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(cashDropAmount);
    if (!amt || amt <= 0 || !cashDropReason.trim()) return;

    recordCashOut(amt, cashDropReason.trim(), cashierId, cashierName);
    setCashDropAmount('');
    setCashDropReason('');
    setActiveTab('status');
    setFeedbackMessage(`Logged Cash Out: -${formatCurrencyValue(amt, currencySymbol)}`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleCloseShiftZReport = (e: React.FormEvent) => {
    e.preventDefault();
    const counted = parseFloat(countedCashInput) || 0;
    const closed = closeShift(counted, closingNotes.trim() || undefined);
    if (closed) {
      alert(`Shift closed successfully!\nDiscrepancy: ${formatCurrencyValue(closed.discrepancy || 0, currencySymbol)}`);
      onClose();
    }
  };

  return (
    <div className="popup-card-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      {/* BLOCK: Shift Control Card */}
      <div className="popup-card w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* ELEMENT: Header */}
        <div className="popup-card__header flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Register & Cash Shift Manager</h3>
              <p className="text-xs text-zinc-400">Drawer Floats, Petty Cash Drops, and X/Z Audit Reports</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="popup-card__close-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ELEMENT: Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-zinc-800 bg-zinc-950/40 overflow-x-auto">
          {isShiftOpen ? (
            <>
              <button
                onClick={() => setActiveTab('status')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'status'
                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Active Shift
              </button>
              <button
                onClick={() => setActiveTab('cash_in')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'cash_in'
                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                Cash In (Paid In)
              </button>
              <button
                onClick={() => setActiveTab('cash_out')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'cash_out'
                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                Cash Out (Drop)
              </button>
              <button
                onClick={() => setActiveTab('x_report')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'x_report'
                    ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                X-Report
              </button>
              <button
                onClick={() => setActiveTab('z_report')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'z_report'
                    ? 'border-red-500 text-red-400 bg-zinc-900/60'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-red-400" />
                Close Shift (Z-Report)
              </button>
            </>
          ) : (
            <button
              onClick={() => setActiveTab('open_shift')}
              className="px-4 py-2 text-xs font-semibold border-b-2 border-emerald-500 text-emerald-400 bg-zinc-900/60 rounded-t-xl"
            >
              Open Register Shift
            </button>
          )}
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        <div className="popup-card__body p-6 overflow-y-auto space-y-5 flex-1">
          {/* VIEW: Open Shift */}
          {!isShiftOpen || activeTab === 'open_shift' ? (
            <form onSubmit={handleOpenShift} className="space-y-4 max-w-md mx-auto py-4">
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-white">Start New Cashier Shift</h4>
                <p className="text-xs text-zinc-400">Enter the physical cash float amount placed into the drawer.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1.5">Opening Cash Float ({currencySymbol})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    value={openingFloatInput}
                    onChange={(e) => setOpeningFloatInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 text-lg font-bold font-mono rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {['100', '200', '300', '500'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningFloatInput(amt)}
                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300"
                  >
                    {currencySymbol}{amt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors shadow-md shadow-emerald-900/20"
              >
                Open Register Shift
              </button>
            </form>
          ) : activeTab === 'status' && currentShift ? (
            /* VIEW: Shift Status Dashboard */
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 font-medium block">Opening Float</span>
                  <span className="text-base font-bold text-white font-mono">
                    {formatCurrencyValue(currentShift.openingFloat, currencySymbol)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[11px] text-emerald-400 font-medium block">Total Sales</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {formatCurrencyValue(currentShift.totalSales, currencySymbol)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[11px] text-blue-400 font-medium block">Total Transactions</span>
                  <span className="text-base font-bold text-white font-mono">
                    {currentShift.transactionCount}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-emerald-500/40 bg-emerald-950/20">
                  <span className="text-[11px] text-emerald-300 font-medium block">Expected in Drawer</span>
                  <span className="text-base font-black text-emerald-300 font-mono">
                    {formatCurrencyValue(currentShift.expectedCashInDrawer, currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Tender Breakdown */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                <h4 className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">Sales Tender Breakdown</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-zinc-300">
                  <div>Cash: <span className="font-bold font-mono text-white">{formatCurrencyValue(currentShift.cashSales, currencySymbol)}</span></div>
                  <div>Card: <span className="font-bold font-mono text-white">{formatCurrencyValue(currentShift.cardSales, currencySymbol)}</span></div>
                  <div>UPI/QR: <span className="font-bold font-mono text-white">{formatCurrencyValue(currentShift.upiSales, currencySymbol)}</span></div>
                  <div>Split: <span className="font-bold font-mono text-white">{formatCurrencyValue(currentShift.splitSales, currencySymbol)}</span></div>
                </div>
              </div>

              {/* Petty Cash Drops */}
              {currentShift.drops.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-zinc-300 uppercase tracking-wider text-[11px]">Cash Drops & Additions</h4>
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 text-xs">
                    {currentShift.drops.map((drop) => (
                      <div key={drop.id} className="p-2.5 border-b border-zinc-800/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            drop.type === 'cash_in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {drop.type === 'cash_in' ? 'CASH IN' : 'CASH OUT'}
                          </span>
                          <span className="text-zinc-300">{drop.reason}</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                          {drop.type === 'cash_in' ? '+' : '-'}{formatCurrencyValue(drop.amount, currencySymbol)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'cash_in' || activeTab === 'cash_out' ? (
            /* VIEW: Cash In / Cash Out Drop Form */
            <form onSubmit={activeTab === 'cash_in' ? handleCashIn : handleCashOut} className="space-y-4 max-w-md mx-auto py-2">
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white capitalize">
                  {activeTab === 'cash_in' ? 'Log Cash In (Float Addition)' : 'Log Cash Out (Petty Cash / Drop)'}
                </h4>
                <p className="text-xs text-zinc-400">Record cash additions or payouts with an audit trail note.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={cashDropAmount}
                  onChange={(e) => setCashDropAmount(e.target.value)}
                  className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Reason / Note</label>
                <input
                  type="text"
                  required
                  placeholder={activeTab === 'cash_in' ? 'e.g. Added coins float from safe' : 'e.g. Paid window cleaner / Supplier cash drop'}
                  value={cashDropReason}
                  onChange={(e) => setCashDropReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors ${
                  activeTab === 'cash_in'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                Confirm {activeTab === 'cash_in' ? 'Cash In' : 'Cash Out'}
              </button>
            </form>
          ) : activeTab === 'x_report' && currentShift ? (
            /* VIEW: Mid-Day X-Report */
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 font-mono text-xs space-y-3">
              <div className="text-center border-b border-zinc-800 pb-3">
                <h4 className="font-bold text-sm text-white">*** X-REPORT (MID-SHIFT AUDIT) ***</h4>
                <p className="text-zinc-400 text-[11px]">Shift ID: {currentShift.id}</p>
                <p className="text-zinc-400 text-[11px]">Time: {new Date().toLocaleString()}</p>
                <p className="text-zinc-400 text-[11px]">Cashier: {currentShift.cashierName} ({currentShift.cashierId})</p>
              </div>

              <div className="space-y-1.5 text-zinc-300">
                <div className="flex justify-between"><span>OPENING FLOAT:</span><span>{formatCurrencyValue(currentShift.openingFloat, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>TOTAL SALES:</span><span className="text-emerald-400 font-bold">{formatCurrencyValue(currentShift.totalSales, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>&gt; CASH SALES:</span><span>{formatCurrencyValue(currentShift.cashSales, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>&gt; CARD SALES:</span><span>{formatCurrencyValue(currentShift.cardSales, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>&gt; OTHER/UPI:</span><span>{formatCurrencyValue(currentShift.upiSales + currentShift.otherSales, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>CASH IN:</span><span>+{formatCurrencyValue(currentShift.cashIn, currencySymbol)}</span></div>
                <div className="flex justify-between"><span>CASH OUT:</span><span>-{formatCurrencyValue(currentShift.cashOut, currencySymbol)}</span></div>
                <div className="border-t border-zinc-800 pt-2 flex justify-between font-bold text-white text-sm">
                  <span>EXPECTED DRAWER CASH:</span>
                  <span className="text-emerald-400">{formatCurrencyValue(currentShift.expectedCashInDrawer, currencySymbol)}</span>
                </div>
              </div>

              <div className="pt-3 text-center">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                >
                  Print X-Report Slip
                </button>
              </div>
            </div>
          ) : activeTab === 'z_report' && currentShift ? (
            /* VIEW: End of Day Z-Report Closeout */
            <form onSubmit={handleCloseShiftZReport} className="space-y-4 max-w-md mx-auto py-2">
              <div className="space-y-1">
                <h4 className="text-base font-bold text-red-400">Close Shift & Reconcile Z-Report</h4>
                <p className="text-xs text-zinc-400">Perform a physical cash count of the drawer to reconcile variances.</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs">
                <span className="text-zinc-400">System Expected Cash:</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {formatCurrencyValue(currentShift.expectedCashInDrawer, currencySymbol)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Physical Counted Cash ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="Enter actual counted cash"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-red-500"
                />
              </div>

              {countedCashInput && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Discrepancy (Over/Short):</span>
                  <span className={`text-sm font-bold font-mono ${
                    parseFloat(countedCashInput) - currentShift.expectedCashInDrawer >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {formatCurrencyValue(parseFloat(countedCashInput) - currentShift.expectedCashInDrawer, currencySymbol)}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Closing Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. End of evening shift"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-zinc-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shadow-md shadow-red-900/30"
              >
                Finalize Z-Report & Lock Shift
              </button>
            </form>
          ) : null}
        </div>

      </div>
    </div>
  );
};
