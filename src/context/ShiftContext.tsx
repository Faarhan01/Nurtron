/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CashShift, CashDrop, Transaction, PaymentMethod } from '../types';
import { toCents, fromCents, roundHalfUp } from '../lib/financialMath';

interface ShiftContextType {
  currentShift: CashShift | null;
  isShiftOpen: boolean;
  shiftHistory: CashShift[];
  openShift: (openingFloat: number, cashierId: string, cashierName: string, terminalId?: string, storeId?: string) => CashShift;
  recordCashIn: (amount: number, reason: string, cashierId: string, cashierName: string) => CashDrop;
  recordCashOut: (amount: number, reason: string, cashierId: string, cashierName: string) => CashDrop;
  recordTransactionSale: (transaction: Transaction) => void;
  closeShift: (actualCountedCash: number, notes?: string) => CashShift | null;
  generateXReport: () => CashShift | null;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

const CURRENT_SHIFT_STORAGE_KEY = 'nurtron_pos_active_cash_shift';
const SHIFT_HISTORY_STORAGE_KEY = 'nurtron_pos_shift_history_ledger';

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentShift, setCurrentShift] = useState<CashShift | null>(() => {
    try {
      const saved = localStorage.getItem(CURRENT_SHIFT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [shiftHistory, setShiftHistory] = useState<CashShift[]>(() => {
    try {
      const saved = localStorage.getItem(SHIFT_HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (currentShift) {
        localStorage.setItem(CURRENT_SHIFT_STORAGE_KEY, JSON.stringify(currentShift));
      } else {
        localStorage.removeItem(CURRENT_SHIFT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to persist active shift', e);
    }
  }, [currentShift]);

  useEffect(() => {
    try {
      localStorage.setItem(SHIFT_HISTORY_STORAGE_KEY, JSON.stringify(shiftHistory));
    } catch (e) {
      console.warn('Failed to persist shift history', e);
    }
  }, [shiftHistory]);

  const openShift = useCallback(
    (openingFloat: number, cashierId: string, cashierName: string, terminalId: string = 'MAIN-POS-01', storeId?: string): CashShift => {
      const floatAmount = Math.max(0, fromCents(toCents(openingFloat)));
      
      const newShift: CashShift = {
        id: `SHIFT-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`,
        cashierId,
        cashierName,
        terminalId,
        status: 'open',
        openedAt: new Date().toISOString(),
        openingFloat: floatAmount,
        cashSales: 0,
        cardSales: 0,
        upiSales: 0,
        splitSales: 0,
        storeCreditSales: 0,
        otherSales: 0,
        totalSales: 0,
        transactionCount: 0,
        cashIn: 0,
        cashOut: 0,
        expectedCashInDrawer: floatAmount,
        drops: [],
        storeId,
      };

      setCurrentShift(newShift);
      return newShift;
    },
    []
  );

  const recordCashIn = useCallback(
    (amount: number, reason: string, cashierId: string, cashierName: string): CashDrop => {
      const safeAmount = Math.max(0, fromCents(toCents(amount)));
      const newDrop: CashDrop = {
        id: `DROP-IN-${Date.now()}`,
        type: 'cash_in',
        amount: safeAmount,
        reason,
        cashierId,
        cashierName,
        timestamp: new Date().toISOString(),
      };

      setCurrentShift((prev) => {
        if (!prev) return null;
        const newCashInCents = toCents(prev.cashIn) + toCents(safeAmount);
        const expectedCents = toCents(prev.expectedCashInDrawer) + toCents(safeAmount);

        return {
          ...prev,
          cashIn: fromCents(newCashInCents),
          expectedCashInDrawer: fromCents(expectedCents),
          drops: [newDrop, ...prev.drops],
        };
      });

      return newDrop;
    },
    []
  );

  const recordCashOut = useCallback(
    (amount: number, reason: string, cashierId: string, cashierName: string): CashDrop => {
      const safeAmount = Math.max(0, fromCents(toCents(amount)));
      const newDrop: CashDrop = {
        id: `DROP-OUT-${Date.now()}`,
        type: 'cash_out',
        amount: safeAmount,
        reason,
        cashierId,
        cashierName,
        timestamp: new Date().toISOString(),
      };

      setCurrentShift((prev) => {
        if (!prev) return null;
        const newCashOutCents = toCents(prev.cashOut) + toCents(safeAmount);
        const expectedCents = Math.max(0, toCents(prev.expectedCashInDrawer) - toCents(safeAmount));

        return {
          ...prev,
          cashOut: fromCents(newCashOutCents),
          expectedCashInDrawer: fromCents(expectedCents),
          drops: [newDrop, ...prev.drops],
        };
      });

      return newDrop;
    },
    []
  );

  const recordTransactionSale = useCallback((transaction: Transaction) => {
    setCurrentShift((prev) => {
      if (!prev || prev.status !== 'open') return prev;

      const totalSalesCents = toCents(prev.totalSales) + toCents(transaction.totalAmount);
      let cashSalesDelta = 0;
      let cardSalesDelta = 0;
      let upiSalesDelta = 0;
      let splitSalesDelta = 0;
      let storeCreditDelta = 0;
      let otherSalesDelta = 0;

      if (transaction.paymentMethod === PaymentMethod.CASH) {
        cashSalesDelta = toCents(transaction.totalAmount);
      } else if (transaction.paymentMethod === PaymentMethod.CARD) {
        cardSalesDelta = toCents(transaction.totalAmount);
      } else if (transaction.paymentMethod === PaymentMethod.UPI) {
        upiSalesDelta = toCents(transaction.totalAmount);
      } else if (transaction.paymentMethod === PaymentMethod.STORE_CREDIT) {
        storeCreditDelta = toCents(transaction.totalAmount);
      } else if (transaction.paymentMethod === PaymentMethod.SPLIT && transaction.tenders) {
        splitSalesDelta = toCents(transaction.totalAmount);
        for (const tender of transaction.tenders) {
          if (tender.method === PaymentMethod.CASH) {
            cashSalesDelta += toCents(tender.amount);
          } else if (tender.method === PaymentMethod.CARD) {
            cardSalesDelta += toCents(tender.amount);
          } else if (tender.method === PaymentMethod.UPI) {
            upiSalesDelta += toCents(tender.amount);
          } else if (tender.method === PaymentMethod.STORE_CREDIT) {
            storeCreditDelta += toCents(tender.amount);
          } else {
            otherSalesDelta += toCents(tender.amount);
          }
        }
      } else {
        otherSalesDelta = toCents(transaction.totalAmount);
      }

      const expectedCashCents = toCents(prev.expectedCashInDrawer) + cashSalesDelta;

      return {
        ...prev,
        totalSales: fromCents(totalSalesCents),
        cashSales: fromCents(toCents(prev.cashSales) + cashSalesDelta),
        cardSales: fromCents(toCents(prev.cardSales) + cardSalesDelta),
        upiSales: fromCents(toCents(prev.upiSales) + upiSalesDelta),
        splitSales: fromCents(toCents(prev.splitSales) + splitSalesDelta),
        storeCreditSales: fromCents(toCents(prev.storeCreditSales) + storeCreditDelta),
        otherSales: fromCents(toCents(prev.otherSales) + otherSalesDelta),
        expectedCashInDrawer: fromCents(expectedCashCents),
        transactionCount: prev.transactionCount + 1,
      };
    });
  }, []);

  const closeShift = useCallback(
    (actualCountedCash: number, notes?: string): CashShift | null => {
      if (!currentShift || currentShift.status !== 'open') return null;

      const countedCents = toCents(actualCountedCash);
      const expectedCents = toCents(currentShift.expectedCashInDrawer);
      const discrepancyCents = countedCents - expectedCents;

      const finalizedShift: CashShift = {
        ...currentShift,
        status: 'closed',
        closedAt: new Date().toISOString(),
        actualCountedCash: fromCents(countedCents),
        discrepancy: fromCents(discrepancyCents),
        notes,
      };

      setShiftHistory((prev) => [finalizedShift, ...prev]);
      setCurrentShift(null);
      return finalizedShift;
    },
    [currentShift]
  );

  const generateXReport = useCallback((): CashShift | null => {
    return currentShift;
  }, [currentShift]);

  return (
    <ShiftContext.Provider
      value={{
        currentShift,
        isShiftOpen: !!currentShift && currentShift.status === 'open',
        shiftHistory,
        openShift,
        recordCashIn,
        recordCashOut,
        recordTransactionSale,
        closeShift,
        generateXReport,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = (): ShiftContextType => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShift must be used within a ShiftProvider');
  }
  return context;
};
