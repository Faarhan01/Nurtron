/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CustomerProfile } from '../types';
import { toCents, fromCents } from '../lib/financialMath';

interface CustomerContextType {
  customers: CustomerProfile[];
  searchCustomers: (query: string) => CustomerProfile[];
  getCustomerById: (id: string) => CustomerProfile | undefined;
  getCustomerByPhone: (phone: string) => CustomerProfile | undefined;
  addCustomer: (customer: Omit<CustomerProfile, 'id' | 'createdAt' | 'totalSpent' | 'orderCount' | 'loyaltyPoints' | 'storeCredit'>) => CustomerProfile;
  updateCustomer: (id: string, updates: Partial<CustomerProfile>) => void;
  addLoyaltyPoints: (id: string, points: number) => void;
  redeemLoyaltyPoints: (id: string, points: number) => boolean;
  adjustStoreCredit: (id: string, amountDelta: number, reason?: string) => void;
  recordCustomerPurchase: (id: string, totalAmount: number, pointsEarned?: number) => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

const CUSTOMERS_STORAGE_KEY = 'nurtron_pos_customer_directory';

const INITIAL_DEMO_CUSTOMERS: CustomerProfile[] = [
  {
    id: 'CUST-001',
    name: 'Sarah Jenkins',
    phone: '+27 82 123 4567',
    email: 'sarah.j@example.com',
    storeCredit: 50.00,
    loyaltyPoints: 340,
    totalSpent: 1250.00,
    orderCount: 8,
    createdAt: '2026-01-15T09:30:00Z',
    notes: 'Prefers digital receipts via SMS',
  },
  {
    id: 'CUST-002',
    name: 'David Nkosi',
    phone: '+27 71 987 6543',
    email: 'david.nkosi@business.co.za',
    storeCredit: 0.00,
    loyaltyPoints: 120,
    totalSpent: 640.50,
    orderCount: 3,
    createdAt: '2026-03-02T14:10:00Z',
    notes: 'Contractor - eligible for bulk discount',
  },
  {
    id: 'CUST-003',
    name: 'Emily Chen',
    phone: '+27 83 555 7890',
    email: 'emily.chen@techstore.com',
    storeCredit: 120.00,
    loyaltyPoints: 780,
    totalSpent: 3890.00,
    orderCount: 19,
    createdAt: '2025-11-20T11:45:00Z',
    notes: 'VIP customer',
  },
];

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<CustomerProfile[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_DEMO_CUSTOMERS;
    } catch {
      return INITIAL_DEMO_CUSTOMERS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
    } catch (e) {
      console.warn('Failed to persist customer directory', e);
    }
  }, [customers]);

  const searchCustomers = useCallback(
    (query: string): CustomerProfile[] => {
      const clean = query.trim().toLowerCase();
      if (!clean) return customers.slice(0, 10);

      return customers.filter(
        (c) =>
          c.name.toLowerCase().includes(clean) ||
          c.phone.replace(/\s+/g, '').includes(clean.replace(/\s+/g, '')) ||
          (c.email && c.email.toLowerCase().includes(clean)) ||
          c.id.toLowerCase().includes(clean)
      );
    },
    [customers]
  );

  const getCustomerById = useCallback(
    (id: string) => customers.find((c) => c.id === id),
    [customers]
  );

  const getCustomerByPhone = useCallback(
    (phone: string) => {
      const clean = phone.replace(/\s+/g, '');
      return customers.find((c) => c.phone.replace(/\s+/g, '') === clean);
    },
    [customers]
  );

  const addCustomer = useCallback(
    (data: Omit<CustomerProfile, 'id' | 'createdAt' | 'totalSpent' | 'orderCount' | 'loyaltyPoints' | 'storeCredit'>): CustomerProfile => {
      const newCust: CustomerProfile = {
        ...data,
        id: `CUST-${Date.now().toString().slice(-5)}`,
        storeCredit: 0,
        loyaltyPoints: 0,
        totalSpent: 0,
        orderCount: 0,
        createdAt: new Date().toISOString(),
      };

      setCustomers((prev) => [newCust, ...prev]);
      return newCust;
    },
    []
  );

  const updateCustomer = useCallback((id: string, updates: Partial<CustomerProfile>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }, []);

  const addLoyaltyPoints = useCallback((id: string, points: number) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, loyaltyPoints: Math.max(0, c.loyaltyPoints + points) } : c
      )
    );
  }, []);

  const redeemLoyaltyPoints = useCallback(
    (id: string, points: number): boolean => {
      let success = false;
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === id && c.loyaltyPoints >= points) {
            success = true;
            return { ...c, loyaltyPoints: c.loyaltyPoints - points };
          }
          return c;
        })
      );
      return success;
    },
    []
  );

  const adjustStoreCredit = useCallback((id: string, amountDelta: number) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const newCreditCents = Math.max(0, toCents(c.storeCredit) + toCents(amountDelta));
          return { ...c, storeCredit: fromCents(newCreditCents) };
        }
        return c;
      })
    );
  }, []);

  const recordCustomerPurchase = useCallback((id: string, totalAmount: number, pointsEarned: number = 0) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const totalSpentCents = toCents(c.totalSpent) + toCents(totalAmount);
          return {
            ...c,
            totalSpent: fromCents(totalSpentCents),
            orderCount: c.orderCount + 1,
            loyaltyPoints: c.loyaltyPoints + pointsEarned,
          };
        }
        return c;
      })
    );
  }, []);

  return (
    <CustomerContext.Provider
      value={{
        customers,
        searchCustomers,
        getCustomerById,
        getCustomerByPhone,
        addCustomer,
        updateCustomer,
        addLoyaltyPoints,
        redeemLoyaltyPoints,
        adjustStoreCredit,
        recordCustomerPurchase,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};
