/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PauseCircle, Play, Trash2, Clock, User, ShoppingBag, X, PlusCircle, AlertTriangle } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatCurrencyValue } from '../../lib/financialMath';

interface HoldCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currencySymbol?: string;
  cashierId?: string;
  cashierName?: string;
}

/**
 * BLOCK: Hold / Parked Cart Management Drawer
 * Enables retail cashiers to suspend (park) incomplete transactions when customers
 * step away or need to fetch items, and recall them instantly with zero line-item data loss.
 */
export const HoldCartDrawer: React.FC<HoldCartDrawerProps> = ({
  isOpen,
  onClose,
  currencySymbol = 'R',
  cashierId = 'Terminal',
  cashierName = 'Staff',
}) => {
  const { cart, total, parkCurrentCart, recallParkedCart, removeParkedCart, parkedCarts, clearAllParkedCarts } = useCart();

  const [isHoldingCurrent, setIsHoldingCurrent] = useState<boolean>(false);
  const [ticketLabel, setTicketLabel] = useState<string>('');
  const [ticketNotes, setTicketNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleConfirmHold = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    parkCurrentCart(ticketLabel.trim() || undefined, ticketNotes.trim() || undefined, cashierId, cashierName);
    setTicketLabel('');
    setTicketNotes('');
    setIsHoldingCurrent(false);
    onClose();
  };

  const handleResume = (id: string) => {
    if (cart.length > 0) {
      if (!window.confirm('The register currently has items. Resuming this held ticket will replace the active cart. Continue?')) {
        return;
      }
    }
    recallParkedCart(id);
    onClose();
  };

  return (
    <div className="popup-card-overlay fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs">
      {/* BLOCK: Drawer Container Card */}
      <div className="popup-card w-full max-w-md h-full bg-zinc-900 border-l border-zinc-800 text-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* ELEMENT: Header */}
        <div className="popup-card__header flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Parked / Held Orders</h3>
              <p className="text-xs text-zinc-400">{parkedCarts.length} active layaway tickets</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="popup-card__close-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ELEMENT: Active Cart Quick Hold Bar */}
        {cart.length > 0 && !isHoldingCurrent && (
          <div className="px-5 py-3.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-400">Current Cart: {cart.length} items</p>
              <p className="text-xs font-bold text-white">{formatCurrencyValue(total, currencySymbol)}</p>
            </div>
            <button
              onClick={() => setIsHoldingCurrent(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <PauseCircle className="w-4 h-4" />
              Hold Current Cart
            </button>
          </div>
        )}

        {/* ELEMENT: Form to Hold Current Cart */}
        {isHoldingCurrent && (
          <form onSubmit={handleConfirmHold} className="p-5 bg-zinc-950/90 border-b border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Park Active Cart</h4>
              <button
                type="button"
                onClick={() => setIsHoldingCurrent(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">Customer / Reference Label</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Customer in Red Shirt / Table 2"
                value={ticketLabel}
                onChange={(e) => setTicketLabel(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-300 block mb-1">Internal Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Went to grab cold drink"
                value={ticketNotes}
                onChange={(e) => setTicketNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs transition-colors"
            >
              Confirm & Suspend Order
            </button>
          </form>
        )}

        {/* ELEMENT: List of Held Tickets */}
        <div className="popup-card__body flex-1 overflow-y-auto p-4 space-y-3">
          {parkedCarts.length === 0 ? (
            /* BLOCK: Empty Held Carts Card */
            <div className="held-carts-empty-card h-full flex flex-col items-center justify-center p-8 text-center">
              <ShoppingBag size={54} strokeWidth={1.5} className="held-carts-empty-card__icon mb-2 text-cyan-400" />
              <p className="held-carts-empty-card__title text-lg font-bold tracking-tight font-presale text-white">No Held Carts</p>
              <p className="held-carts-empty-card__subtitle text-xs font-presale tracking-wide text-slate-300 mt-1 max-w-xs">
                When a customer needs to pause their order, click "Hold Order" to park their cart and serve the next customer.
              </p>
            </div>
          ) : (
            parkedCarts.map((ticket) => {
              const elapsedMinutes = Math.floor((Date.now() - new Date(ticket.parkedAt).getTime()) / 60000);

              return (
                <div
                  key={ticket.id}
                  className="popup-card__item p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {ticket.id}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{elapsedMinutes === 0 ? 'Just now' : `${elapsedMinutes}m ago`}</span>
                        </div>
                      </div>
                      <h4 className="text-sm font-semibold text-white mt-1.5">
                        {ticket.ticketName || ticket.customerName || 'Parked Ticket'}
                      </h4>
                      {ticket.notes && (
                        <p className="text-xs text-zinc-400 mt-0.5 italic">"{ticket.notes}"</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-base font-bold text-emerald-400">
                        {formatCurrencyValue(ticket.totalAmount, currencySymbol)}
                      </p>
                      <p className="text-[11px] text-zinc-400">{ticket.items.reduce((s, i) => s + (i.quantity || 1), 0)} items</p>
                    </div>
                  </div>

                  {/* Summary of Items */}
                  <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-xs space-y-1">
                    {ticket.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-zinc-300 text-[11px]">
                        <span className="truncate max-w-[200px]">{item.quantity}x {item.name}</span>
                        <span className="text-zinc-400 font-mono">
                          {formatCurrencyValue((item.priceOverride ?? item.price) * item.quantity, currencySymbol)}
                        </span>
                      </div>
                    ))}
                    {ticket.items.length > 3 && (
                      <p className="text-[10px] text-zinc-500 text-right">+ {ticket.items.length - 3} more items</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleResume(ticket.id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Resume Order
                    </button>
                    <button
                      onClick={() => removeParkedCart(ticket.id)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-700 transition-colors"
                      title="Discard ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ELEMENT: Footer Clear All */}
        {parkedCarts.length > 0 && (
          <div className="popup-card__footer p-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center">
            <span className="text-xs text-zinc-400">Total Held: {parkedCarts.length}</span>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all parked carts?')) {
                  clearAllParkedCarts();
                }
              }}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Held Carts
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
