/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { CartItem, Product, ParkedCart, PaymentTender, PaymentMethod, CustomerProfile } from '../types';
import { calculateCartFinancials, calculateChange, toCents, fromCents } from '../lib/financialMath';

interface CartContextType {
  cart: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  totalDiscount: number;
  total: number;
  taxRate: number;
  setTaxRate: (rate: number) => void;
  taxIncluded: boolean;
  setTaxIncluded: (included: boolean) => void;
  globalDiscountPercent: number;
  setGlobalDiscountPercent: (percent: number) => void;
  globalDiscountFixed: number;
  setGlobalDiscountFixed: (amount: number) => void;

  // Cart Mutators
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updatePriceOverride: (productId: string, priceOverride?: number) => void;
  updateItemDiscount: (productId: string, discountPercent: number) => void;
  clearCart: () => void;
  setCartItems: (items: CartItem[]) => void;

  // Customer Management
  customer: CustomerProfile | null;
  setCustomer: (customer: CustomerProfile | null) => void;

  // Park / Hold Cart
  parkedCarts: ParkedCart[];
  parkCurrentCart: (ticketName?: string, notes?: string, cashierId?: string, cashierName?: string) => string | null;
  recallParkedCart: (id: string) => boolean;
  removeParkedCart: (id: string) => void;
  clearAllParkedCarts: () => void;

  // Split Tender Management
  tenders: PaymentTender[];
  addTender: (method: PaymentMethod, amount: number, tenderedAmount?: number, reference?: string, notes?: string) => void;
  removeTender: (id: string) => void;
  clearTenders: () => void;
  splitTotalPaid: number;
  splitRemainingBalance: number;
  isSplitFullyPaid: boolean;
  splitChangeDue: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const PARKED_CARTS_STORAGE_KEY = 'nurtron_pos_parked_carts';
const ACTIVE_CART_STORAGE_KEY = 'nurtron_pos_active_cart_draft';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [taxRate, setTaxRate] = useState<number>(0);
  const [taxIncluded, setTaxIncluded] = useState<boolean>(false);
  const [globalDiscountPercent, setGlobalDiscountPercent] = useState<number>(0);
  const [globalDiscountFixed, setGlobalDiscountFixed] = useState<number>(0);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  // Parked Carts
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>(() => {
    try {
      const saved = localStorage.getItem(PARKED_CARTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Split Tenders
  const [tenders, setTenders] = useState<PaymentTender[]>([]);

  // Persist active cart draft
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
      console.warn('Failed to persist active cart draft', e);
    }
  }, [cart]);

  // Persist parked carts
  useEffect(() => {
    try {
      localStorage.setItem(PARKED_CARTS_STORAGE_KEY, JSON.stringify(parkedCarts));
    } catch (e) {
      console.warn('Failed to persist parked carts', e);
    }
  }, [parkedCarts]);

  // Calculations using Financial Precision Engine
  const financials = useMemo(() => {
    return calculateCartFinancials(
      cart,
      taxRate,
      globalDiscountPercent,
      globalDiscountFixed,
      taxIncluded
    );
  }, [cart, taxRate, globalDiscountPercent, globalDiscountFixed, taxIncluded]);

  // Cart Mutators
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        const newQty = (updated[existingIndex].quantity || 1) + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };
        return updated;
      } else {
        const newItem: CartItem = {
          ...product,
          quantity: Math.max(1, quantity),
          originalPrice: product.discountPrice || product.price,
        };
        return [...prev, newItem];
      }
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity } : item))
    );
  }, []);

  const updatePriceOverride = useCallback((productId: string, priceOverride?: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              priceOverride: priceOverride !== undefined && !isNaN(priceOverride) && priceOverride >= 0 ? priceOverride : undefined,
            }
          : item
      )
    );
  }, []);

  const updateItemDiscount = useCallback((productId: string, discountPercent: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              discount: Math.min(100, Math.max(0, discountPercent || 0)),
            }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setCustomer(null);
    setGlobalDiscountPercent(0);
    setGlobalDiscountFixed(0);
    setTenders([]);
  }, []);

  const setCartItems = useCallback((items: CartItem[]) => {
    setCart(items);
  }, []);

  // Park / Hold Cart
  const parkCurrentCart = useCallback(
    (ticketName?: string, notes?: string, cashierId: string = 'Terminal', cashierName: string = 'Staff') => {
      if (cart.length === 0) return null;

      const newParkedCart: ParkedCart = {
        id: `HOLD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
        ticketName: ticketName || (customer ? customer.name : `Ticket #${parkedCarts.length + 1}`),
        customerName: customer ? customer.name : undefined,
        customerPhone: customer ? customer.phone : undefined,
        customerId: customer ? customer.id : undefined,
        items: [...cart],
        subtotal: financials.subtotal,
        tax: financials.tax,
        discount: financials.totalDiscount,
        totalAmount: financials.total,
        parkedAt: new Date().toISOString(),
        cashierId,
        cashierName,
        notes,
      };

      setParkedCarts((prev) => [newParkedCart, ...prev]);
      clearCart();
      return newParkedCart.id;
    },
    [cart, customer, financials, parkedCarts.length, clearCart]
  );

  const recallParkedCart = useCallback(
    (id: string): boolean => {
      const target = parkedCarts.find((p) => p.id === id);
      if (!target) return false;

      // Restore cart items
      setCart(target.items);
      if (target.customerId || target.customerName) {
        setCustomer({
          id: target.customerId || `cust-${Date.now()}`,
          name: target.customerName || 'Customer',
          phone: target.customerPhone || '',
          storeCredit: 0,
          loyaltyPoints: 0,
          totalSpent: 0,
          orderCount: 1,
          createdAt: new Date().toISOString(),
        });
      }

      // Remove from parked list
      setParkedCarts((prev) => prev.filter((p) => p.id !== id));
      return true;
    },
    [parkedCarts]
  );

  const removeParkedCart = useCallback((id: string) => {
    setParkedCarts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAllParkedCarts = useCallback(() => {
    setParkedCarts([]);
  }, []);

  // Split Tender Calculations
  const addTender = useCallback(
    (method: PaymentMethod, amount: number, tenderedAmount?: number, reference?: string, notes?: string) => {
      if (amount <= 0) return;
      const change = tenderedAmount && tenderedAmount > amount ? tenderedAmount - amount : 0;

      const newTender: PaymentTender = {
        id: `TENDER-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        method,
        amount: fromCents(toCents(amount)),
        tenderedAmount: tenderedAmount ? fromCents(toCents(tenderedAmount)) : undefined,
        changeGiven: change > 0 ? fromCents(toCents(change)) : undefined,
        reference,
        timestamp: new Date().toISOString(),
        notes,
      };

      setTenders((prev) => [...prev, newTender]);
    },
    []
  );

  const removeTender = useCallback((id: string) => {
    setTenders((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearTenders = useCallback(() => {
    setTenders([]);
  }, []);

  const splitTotals = useMemo(() => {
    const totalDueCents = toCents(financials.total);
    let paidCents = 0;
    let changeCents = 0;

    for (const tender of tenders) {
      paidCents += toCents(tender.amount);
      if (tender.changeGiven) {
        changeCents += toCents(tender.changeGiven);
      }
    }

    const remainingCents = Math.max(0, totalDueCents - paidCents);
    const isFullyPaid = totalDueCents > 0 && paidCents >= totalDueCents;

    return {
      splitTotalPaid: fromCents(paidCents),
      splitRemainingBalance: fromCents(remainingCents),
      isSplitFullyPaid: isFullyPaid,
      splitChangeDue: fromCents(changeCents),
    };
  }, [financials.total, tenders]);

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount: financials.itemCount,
        subtotal: financials.subtotal,
        tax: financials.tax,
        totalDiscount: financials.totalDiscount,
        total: financials.total,
        taxRate,
        setTaxRate,
        taxIncluded,
        setTaxIncluded,
        globalDiscountPercent,
        setGlobalDiscountPercent,
        globalDiscountFixed,
        setGlobalDiscountFixed,
        addToCart,
        removeFromCart,
        updateQuantity,
        updatePriceOverride,
        updateItemDiscount,
        clearCart,
        setCartItems,
        customer,
        setCustomer,
        parkedCarts,
        parkCurrentCart,
        recallParkedCart,
        removeParkedCart,
        clearAllParkedCarts,
        tenders,
        addTender,
        removeTender,
        clearTenders,
        splitTotalPaid: splitTotals.splitTotalPaid,
        splitRemainingBalance: splitTotals.splitRemainingBalance,
        isSplitFullyPaid: splitTotals.isSplitFullyPaid,
        splitChangeDue: splitTotals.splitChangeDue,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
