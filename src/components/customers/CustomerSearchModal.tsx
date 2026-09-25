/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Users, Search, UserPlus, Phone, Mail, Award, Wallet, Check, X, PlusCircle } from 'lucide-react';
import { useCustomer } from '../../context/CustomerContext';
import { useCart } from '../../context/CartContext';
import { CustomerProfile } from '../../types';
import { formatCurrencyValue } from '../../lib/financialMath';

interface CustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer?: (customer: CustomerProfile) => void;
  currencySymbol?: string;
  currency?: string;
  theme?: 'dark' | 'light';
}

/**
 * BLOCK: Customer Search & Loyalty Modal
 * Provides rapid phone number/name lookups, quick profile creation,
 * and direct loyalty point / store credit assignment to active register carts.
 */
export const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  currencySymbol,
  currency = 'R',
  theme = 'dark',
}) => {
  const activeCurrencySymbol = currencySymbol || currency || 'R';
  const { customers, searchCustomers, addCustomer } = useCustomer();
  const { customer: activeCustomer, setCustomer } = useCart();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'search' | 'create'>('search');

  // New Customer Form
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newNotes, setNewNotes] = useState<string>('');

  if (!isOpen) return null;

  const filteredCustomers = searchCustomers(searchQuery);

  const handleSelectCustomer = (cust: CustomerProfile) => {
    setCustomer(cust);
    if (onSelectCustomer) {
      onSelectCustomer(cust);
    }
    onClose();
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const created = addCustomer({
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim() || undefined,
      notes: newNotes.trim() || undefined,
    });

    setCustomer(created);
    if (onSelectCustomer) {
      onSelectCustomer(created);
    }
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewNotes('');
    onClose();
  };

  return (
    <div className="popup-card-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      {/* BLOCK: Customer Modal Card */}
      <div className="popup-card w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl text-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* ELEMENT: Header */}
        <div className="popup-card__header flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Customer CRM & Loyalty</h3>
              <p className="text-xs text-zinc-400">Search customer profile or register new patron</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="popup-card__close-button p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ELEMENT: Tab Switcher */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-zinc-800 bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-400 bg-zinc-900/60'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Find Customer
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-blue-500 text-blue-400 bg-zinc-900/60'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Profile
          </button>
        </div>

        <div className="popup-card__body p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'search' ? (
            <>
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by phone number, name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Customer Results List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  /* BLOCK: Empty Customer Search Card */
                  <div className="customer-search-empty-card p-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 flex flex-col items-center justify-center text-center">
                    <Users size={48} strokeWidth={1.5} className="customer-search-empty-card__icon mb-2 text-cyan-400" />
                    <p className="customer-search-empty-card__title text-base font-bold tracking-tight text-white font-presale">No Matching Customers</p>
                    <p className="customer-search-empty-card__subtitle text-xs text-zinc-400 font-presale tracking-wide mt-1">
                      No accounts match the current search query
                    </p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="customer-search-empty-card__action-btn mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-semibold font-presale transition-colors cursor-pointer"
                    >
                      + Create new customer profile
                    </button>
                  </div>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isSelected = activeCustomer?.id === cust.id;

                    return (
                      <div
                        key={cust.id}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600/10 border-blue-500/50 text-white'
                            : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{cust.name}</h4>
                            <span className="text-[10px] text-zinc-500 font-mono">{cust.id}</span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-zinc-500" />
                              {cust.phone}
                            </span>
                            {cust.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-zinc-500" />
                                {cust.email}
                              </span>
                            )}
                          </div>

                          {/* Points & Credit */}
                          <div className="flex items-center gap-3 pt-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-bold">
                              <Award className="w-3 h-3" />
                              {cust.loyaltyPoints} Points
                            </span>
                            {cust.storeCredit > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[10px] font-bold font-mono">
                                <Wallet className="w-3 h-3" />
                                {formatCurrencyValue(cust.storeCredit, currencySymbol)} Credit
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSelectCustomer(cust)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 hover:bg-blue-600 text-zinc-200 hover:text-white'
                          }`}
                        >
                          {isSelected ? 'Assigned' : 'Assign'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* CREATE CUSTOMER FORM */
            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Mobile / WhatsApp Phone *</label>
                <input
                  type="tel"
                  required
                  placeholder="+27 82 000 0000"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-300 block mb-1">Customer Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Senior citizen discount / Wholesale client"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-zinc-950 border border-zinc-700 text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-sm"
              >
                Create Customer Profile & Attach to Cart
              </button>
            </form>
          )}
        </div>

        {/* ELEMENT: Footer */}
        {activeCustomer && (
          <div className="popup-card__footer px-6 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              Assigned: <strong className="text-white">{activeCustomer.name}</strong> ({activeCustomer.phone})
            </span>
            <button
              onClick={() => setCustomer(null)}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              Detach Customer
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
