/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, LogIn, Mail, Package, ShoppingBag, ChevronRight, Search, X, CheckCircle, CheckCircle2, Edit3, Printer, Eye, RefreshCw, BarChart3, MoreVertical, Menu, LayoutGrid, Table, AlignJustify, RotateCcw, User as UserIcon, Bell, Sun, Moon, LogOut, DollarSign, Filter, ChevronLeft, ArrowLeft, Smartphone, Barcode, Wifi, WifiOff, ShieldCheck, AlertCircle, AlertTriangle, ChevronDown, Check, Store, SlidersHorizontal, Camera, UserCheck, PauseCircle, Split, Lock } from 'lucide-react';
import { CATEGORIES, TAX_RATE } from '../constants';
import { Product, CartItem, PaymentMethod, TransactionStatus, Transaction } from '../types';
import { cn, formatCurrency, OperationType, handleFirestoreError, handleBackdropClick } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  serverTimestamp,
  updateDoc,
  increment,
  addDoc,
  deleteDoc,
  getDoc,
  writeBatch } from "../lib/firebase";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from "../lib/firebase";
import { db, auth } from '../lib/firebase';
import { MOCK_PRODUCTS } from '../mockData';
import { TerminalLoginDialog } from '../components/TerminalLoginDialog';
import { CameraBarcodeScannerModal } from '../components/hardware/CameraBarcodeScannerModal';
import { CustomerSearchModal } from '../components/customers/CustomerSearchModal';
import { SplitPaymentModal } from '../components/cart/SplitPaymentModal';
import { ThermalReceiptModal } from '../components/hardware/ThermalReceiptModal';
import { useCart } from '../context/CartContext';
import { useShift } from '../context/ShiftContext';
import { useCustomer } from '../context/CustomerContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { formatCurrencyValue, toCents, fromCents } from '../lib/financialMath';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

import { UserRole } from '../types';

const limitLetters = (str: string, maxChars: number = 30) => {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '...';
};

function getCurrencySymbol(curr: string = 'ZAR'): string {
  const c = curr.trim().toUpperCase();
  if (c === 'ZAR' || c === 'R') return 'R';
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  try {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: c });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find(part => part.type === 'currency');
    if (symbolPart) return symbolPart.value;
  } catch (e) {}
  return c;
}

function VisualBarcode({ value, theme }: { value: string; theme: 'dark' | 'light' }) {
  const svgRef = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    if (svgRef.current && value) {
      try {
        svgRef.current.innerHTML = ""; 
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 1.2,
          height: 30,
          displayValue: true,
          font: "monospace",
          fontSize: 8,
          background: "transparent",
          lineColor: theme === 'dark' ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.9)",
        });
      } catch (e) {
        console.warn("JsBarcode failed: ", e);
      }
    }
  }, [value, theme]);

  if (!value) return null;
  return (
    <div className={cn(
      "p-1.5 rounded-lg border flex items-center justify-center shrink-0 min-w-[120px] h-[48px] overflow-hidden",
      theme === 'dark' ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
    )}>
      <svg ref={svgRef} className="max-w-full block" />
    </div>
  );
}

interface RegisterProps {
  user: User | null;
  theme?: 'dark' | 'light';
  storeId?: string;
  taxRate?: number;
  taxType?: 'inclusive' | 'exclusive' | 'none';
  currency?: string;
  storeSettings?: {
    storeName: string;
    registrationNumber?: string;
    vatNumber?: string;
  };
  permissions?: Record<string, boolean>;
  role?: UserRole;
  customRoleName?: string;
  autoPrint?: boolean;
  productLayout?: 'grid' | 'list-img' | 'list-text';
  onProductLayoutChange?: (layout: 'grid' | 'list-img' | 'list-text') => void;
  onOpenSettings?: () => void;
  onCartChange?: (count: number) => void;
  managerEmail?: string;
}

export const Register: React.FC<RegisterProps> = ({ 
  user: initialUser,
  theme = 'dark', 
  storeId = 'STR-100100',
  taxRate = 0.08, 
  taxType = 'exclusive',
  currency = 'USD',
  storeSettings,
  permissions = { manage_presales: true, manage_returns: true },
  role = 'Manager',
  customRoleName = '',
  autoPrint: propAutoPrint = true,
  productLayout = 'grid',
  onProductLayoutChange,
  onOpenSettings,
  onCartChange,
  managerEmail
}) => {
  const [user, setUser] = React.useState<User | null>(initialUser);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('nurtron_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return MOCK_PRODUCTS;
  });
  const [productsLoading, setProductsLoading] = React.useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('nurtron_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (e) {}
    return true;
  });
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [activeView, setActiveView] = React.useState<'cart' | 'verify'>('cart');
  const [registerMode, setRegisterMode] = React.useState<'cashsale' | 'presale'>('presale');
  const [currentProductLayout, setCurrentProductLayout] = React.useState<'grid' | 'list-img' | 'list-text'>(
    () => (productLayout as 'grid' | 'list-img' | 'list-text') || 'grid'
  );

  React.useEffect(() => {
    if (productLayout) {
      setCurrentProductLayout(productLayout);
    }
  }, [productLayout]);

  const handleLayoutChange = (newLayout: 'grid' | 'list-img' | 'list-text') => {
    setCurrentProductLayout(newLayout);
    if (onProductLayoutChange) {
      onProductLayoutChange(newLayout);
    }
  };

  // Receipt Verification Tab State
  const [verifyQuery, setVerifyQuery] = React.useState('');
  const [searchedReceiptId, setSearchedReceiptId] = React.useState<string | null>(null);
  const [verifyResult, setVerifyResult] = React.useState<any | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [verifyStatus, setVerifyStatus] = React.useState<'idle' | 'found' | 'invalid'>('idle');

  const isRepRole = role?.toLowerCase() === 'rep';

  React.useEffect(() => {
    if (isRepRole && registerMode === 'cashsale') {
      setRegisterMode('presale');
      window.dispatchEvent(new CustomEvent('registerModeChange', { detail: 'presale' }));
    }
  }, [isRepRole, registerMode]);

  React.useEffect(() => {
    const handleModeChange = (e: CustomEvent) => {
      if (e.detail) {
        if (role?.toLowerCase() === 'rep' && e.detail === 'cashsale') {
          setRegisterMode('presale');
        } else {
          setRegisterMode(e.detail);
        }
      }
    };
    const handleViewChange = (e: CustomEvent) => {
      if (e.detail) setActiveView(e.detail);
    };
    window.addEventListener('registerModeChange' as any, handleModeChange);
    window.addEventListener('registerViewChange' as any, handleViewChange);
    return () => {
      window.removeEventListener('registerModeChange' as any, handleModeChange);
      window.removeEventListener('registerViewChange' as any, handleViewChange);
    };
  }, [role]);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('registerViewChange', { detail: activeView }));
  }, [activeView]);

  const handleSetRegisterMode = (mode: 'cashsale' | 'presale') => {
    if (role?.toLowerCase() === 'rep' && mode === 'cashsale') {
      setStatus({ message: "Rep role is restricted to Presale Terminal or Verify Receipts.", type: 'error' });
      setRegisterMode('presale');
      window.dispatchEvent(new CustomEvent('registerModeChange', { detail: 'presale' }));
      return;
    }
    setRegisterMode(mode);
    window.dispatchEvent(new CustomEvent('registerModeChange', { detail: mode }));
  };
  const [isNavOpen, setIsNavOpen] = React.useState(false);
  const [isTerminalMenuOpen, setIsTerminalMenuOpen] = React.useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = React.useState(false);
  const [presales, setPresales] = React.useState<any[]>([]);
  const [presaleMenuAnchor, setPresaleMenuAnchor] = React.useState<{id: string, x: number, y: number} | null>(null);
  const [viewingPresale, setViewingPresale] = React.useState<any | null>(null);
  const [editingPresale, setEditingPresale] = React.useState<any | null>(null);
  const [initiatingPresale, setInitiatingPresale] = React.useState<any | null>(null);
  const [editPresaleSearchQuery, setEditPresaleSearchQuery] = React.useState('');
  const [isViewPresaleOpen, setIsViewPresaleOpen] = React.useState(false);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<'latest' | 'oldest' | 'amount-desc' | 'amount-asc'>('latest');
  const [stockFilter, setStockFilter] = React.useState<'all' | 'critical' | 'low-stock' | 'healthy'>('all');
  const [desktopLayout, setDesktopLayout] = React.useState<'card' | 'table' | 'split'>(() => {
    try {
      const saved = localStorage.getItem('nurtron_desktop_register_layout');
      if (saved) return saved as 'card' | 'table' | 'split';
    } catch (e) {}
    return 'table';
  });

  const handleSetDesktopLayout = (layout: 'card' | 'table' | 'split') => {
    setDesktopLayout(layout);
    try {
      localStorage.setItem('nurtron_desktop_register_layout', layout);
    } catch (e) {}
  };

  const [status, setStatus] = React.useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [stockLimitWarning, setStockLimitWarning] = React.useState<{ message: string; productName?: string; maxStock?: number } | null>(null);

  const [isOnline, setIsOnline] = React.useState(typeof window !== 'undefined' ? window.navigator.onLine : true);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [returnSearchQuery, setReturnSearchQuery] = React.useState('');
  const [returnMenuAnchor, setReturnMenuAnchor] = React.useState<{id: string, x: number, y: number} | null>(null);
  const [selectedTransactionForReturn, setSelectedTransactionForReturn] = React.useState<any | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState(false);
  const [isViewTransactionOpen, setIsViewTransactionOpen] = React.useState(false);
  const [viewingTransaction, setViewingTransaction] = React.useState<any | null>(null);
  const [returnItems, setReturnItems] = React.useState<Record<string, { selected: boolean, quantity: number }>>({});
  const [returnsList, setReturnsList] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<any | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);
  const [customerCodeInput, setCustomerCodeInput] = React.useState('');
  const [chargeToCustomerCredit, setChargeToCustomerCredit] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    const unsubPresales = onSnapshot(collection(db, 'presales'), (snapshot) => {
      setPresales(snapshot.docs.map(doc => {
        const data = doc.data();
        let timeStr = 'Just now';
        try {
          if (data.timestamp) {
            if (typeof data.timestamp.toDate === 'function') {
              timeStr = format(data.timestamp.toDate(), 'HH:mm:ss');
            } else if (data.timestamp instanceof Date) {
              timeStr = format(data.timestamp, 'HH:mm:ss');
            } else if (typeof data.timestamp === 'string') {
              timeStr = format(new Date(data.timestamp), 'HH:mm:ss');
            } else if (data.timestamp.seconds) {
              timeStr = format(new Date(data.timestamp.seconds * 1000), 'HH:mm:ss');
            }
          }
        } catch (e) {
          console.warn("Error parsing presale timestamp:", e);
        }
        return {
          id: doc.id,
          op: data.operator,
          amount: data.amount,
          time: timeStr,
          status: data.status,
          items: data.items || []
        };
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'presales', auth));
    const unsubReturns = onSnapshot(collection(db, 'returns'), (snapshot) => {
      setReturnsList(snapshot.docs.map(doc => {
        const data = doc.data();
        let timeStr = 'Just now';
        try {
          if (data.timestamp) {
            if (typeof data.timestamp.toDate === 'function') {
              timeStr = format(data.timestamp.toDate(), 'yyyy-MM-dd HH:mm');
            } else if (data.timestamp instanceof Date) {
              timeStr = format(data.timestamp, 'yyyy-MM-dd HH:mm');
            } else if (typeof data.timestamp === 'string') {
              timeStr = format(new Date(data.timestamp), 'yyyy-MM-dd HH:mm');
            } else if (data.timestamp.seconds) {
              timeStr = format(new Date(data.timestamp.seconds * 1000), 'yyyy-MM-dd HH:mm');
            }
          }
        } catch (e) {
          console.warn("Error parsing return timestamp:", e);
        }
        return {
          id: doc.id,
          ...data,
          time: timeStr
        };
      }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'returns', auth));

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'customers', auth));

    return () => {
      unsubPresales();
      unsubReturns();
      unsubCustomers();
    };
  }, [user]);

  const searchTransactions = async (query: string) => {
    if (!query) return;
    // For now searching by exact ID or simple prefix
    const path = 'transactions';
    const unsub = onSnapshot(collection(db, path), (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const results = all.filter(tx => 
        tx.id.toLowerCase().includes(query.toLowerCase()) || 
        (tx.customerName && tx.customerName.toLowerCase().includes(query.toLowerCase()))
      );
      setTransactions(results);
    }, (error) => handleFirestoreError(error, OperationType.GET, path, auth));
    return unsub;
  };

  React.useEffect(() => {
    if (activeView === 'verify' && user) {
      const path = 'transactions';
      const unsub = onSnapshot(collection(db, path), (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => handleFirestoreError(error, OperationType.GET, path, auth));
      return () => unsub();
    }
  }, [activeView, user]);

  const formatReceiptTimestamp = (ts: any): string => {
    if (!ts) return 'N/A';
    try {
      if (typeof ts.toDate === 'function') {
        return format(ts.toDate(), 'yyyy-MM-dd HH:mm:ss');
      }
      if (ts instanceof Date) {
        return format(ts, 'yyyy-MM-dd HH:mm:ss');
      }
      if (typeof ts === 'string' || typeof ts === 'number') {
        return format(new Date(ts), 'yyyy-MM-dd HH:mm:ss');
      }
      if (ts.seconds) {
        return format(new Date(ts.seconds * 1000), 'yyyy-MM-dd HH:mm:ss');
      }
    } catch (e) {
      return String(ts);
    }
    return String(ts);
  };

  const handleVerifyReceipt = async (overrideQuery?: string) => {
    const rawQuery = (overrideQuery !== undefined ? overrideQuery : verifyQuery).trim();
    if (!rawQuery) {
      setSearchedReceiptId(null);
      setVerifyResult(null);
      setVerifyStatus('idle');
      return;
    }

    setIsVerifying(true);
    setSearchedReceiptId(rawQuery);

    const queryLower = rawQuery.toLowerCase();
    const cleanQuery = rawQuery.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    try {
      // 1. Search in local state transactions first
      let matched = transactions.find((tx: any) => {
        const txId = (tx.id || '').toLowerCase();
        const receiptNo = (tx.receiptNumber || '').toLowerCase();
        const cleanTxId = (tx.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return txId === queryLower || receiptNo === queryLower || cleanTxId === cleanQuery || txId.endsWith(queryLower);
      });

      // 2. Also search in local presales
      if (!matched) {
        matched = presales.find((ps: any) => {
          const psId = (ps.id || '').toLowerCase();
          const cleanPsId = (ps.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return psId === queryLower || cleanPsId === cleanQuery || psId.endsWith(queryLower);
        });
      }

      // 3. Also search in local returns
      if (!matched) {
        matched = returnsList.find((ret: any) => {
          const retId = (ret.id || '').toLowerCase();
          const cleanRetId = (ret.id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return retId === queryLower || cleanRetId === cleanQuery || retId.endsWith(queryLower);
        });
      }

      // 4. If not found in local memory, query Firestore directly by ID
      if (!matched && user) {
        const txSnap = await getDoc(doc(db, 'transactions', rawQuery));
        if (txSnap.exists()) {
          matched = { id: txSnap.id, ...txSnap.data() };
        } else {
          const psSnap = await getDoc(doc(db, 'presales', rawQuery));
          if (psSnap.exists()) {
            matched = { id: psSnap.id, ...psSnap.data() };
          }
        }
      }

      if (matched) {
        setVerifyResult(matched);
        setVerifyStatus('found');
      } else {
        setVerifyResult(null);
        setVerifyStatus('invalid');
      }
    } catch (err) {
      console.error("Receipt verification error:", err);
      setVerifyResult(null);
      setVerifyStatus('invalid');
    } finally {
      setIsVerifying(false);
    }
  };

  const generateVerifiedReceiptPDF = (tx: any) => {
    if (!tx) return;
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, 200]
      });

      const pageWidth = 80;
      let y = 10;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(storeInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('VERIFIED CASHSALE RECEIPT', pageWidth / 2, y, { align: 'center' });
      y += 6;

      doc.setDrawColor(200);
      doc.line(5, y, 75, y);
      y += 5;

      doc.setFontSize(7.5);
      doc.text(`RECEIPT ID: ${tx.id}`, 5, y);
      y += 4;
      doc.text(`DATE: ${formatReceiptTimestamp(tx.timestamp || tx.createdAt)}`, 5, y);
      y += 4;
      doc.text(`PAYMENT: ${(tx.paymentMethod || 'CASH').toUpperCase()}`, 5, y);
      y += 4;
      if (tx.customerName) {
        doc.text(`CLIENT: ${tx.customerName.toUpperCase()}`, 5, y);
        y += 4;
      }
      doc.text(`STATUS: VERIFIED (${(tx.status || 'COMPLETED').toUpperCase()})`, 5, y);
      y += 6;

      doc.line(5, y, 75, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('ITEM', 5, y);
      doc.text('QTY x PRICE', 45, y);
      doc.text('TOTAL', 75, y, { align: 'right' });
      y += 4;

      doc.setFont('helvetica', 'normal');
      const items = tx.items || [];
      items.forEach((item: any) => {
        const name = item.name || 'Item';
        const qty = item.quantity || 1;
        const price = item.price || item.unitPrice || 0;
        const lineTotal = item.subtotal || (qty * price);

        doc.text(name.length > 22 ? name.substring(0, 20) + '..' : name, 5, y);
        y += 3.5;
        doc.text(`${qty} x ${formatCurrency(price, currency)}`, 10, y);
        doc.text(formatCurrency(lineTotal, currency), 75, y, { align: 'right' });
        y += 4.5;
      });

      doc.line(5, y, 75, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('GRAND TOTAL:', 5, y);
      doc.text(formatCurrency(tx.totalAmount || tx.amount || 0, currency), 75, y, { align: 'right' });
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text('*** AUTHENTIC RECEIPT VERIFIED ***', pageWidth / 2, y, { align: 'center' });

      const blob = doc.output('bloburl');
      window.open(blob, '_blank');
    } catch (err) {
      console.error("PDF generation failed:", err);
      if (tx.id) generateReceipt(tx.id, 'sale');
    }
  };

  const getSortValue = (item: any): number => {
    return item.amount || item.totalAmount || item.val || 0;
  };

  const getTimestampMs = (item: any): number => {
    if (!item) return 0;
    const ts = item.timestamp || item.createdAt || item.date;
    if (!ts) return 0;
    if (typeof ts.toDate === 'function') {
      return ts.toDate().getTime();
    }
    if (ts instanceof Date) {
      return ts.getTime();
    }
    if (typeof ts === 'string') {
      return new Date(ts).getTime();
    }
    if (typeof ts === 'number') {
      return ts;
    }
    if (ts.seconds) {
      return ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1000000 : 0);
    }
    return 0;
  };

  const sortItemsList = React.useCallback(<T extends any>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      if (sortBy === 'latest') {
        return getTimestampMs(b) - getTimestampMs(a);
      }
      if (sortBy === 'oldest') {
        return getTimestampMs(a) - getTimestampMs(b);
      }
      if (sortBy === 'amount-desc') {
        return getSortValue(b) - getSortValue(a);
      }
      if (sortBy === 'amount-asc') {
        return getSortValue(a) - getSortValue(b);
      }
      return 0;
    });
  }, [sortBy]);

  const sortedPresales = React.useMemo(() => {
    return sortItemsList(presales);
  }, [presales, sortItemsList]);

  const sortedTransactions = React.useMemo(() => {
    return sortItemsList(transactions);
  }, [transactions, sortItemsList]);

  const sortedReturnsList = React.useMemo(() => {
    return sortItemsList(returnsList);
  }, [returnsList, sortItemsList]);

  const generateReturnReceipt = (returnId: string, transactionId: string, returnedItems: any[]) => {
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 150]
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(storeInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(10);
    doc.text('CREDIT NOTE / RETURN SLIP', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`RETURN ID: ${returnId}`, 10, y);
    doc.text(`ORIGINAL TX: ${transactionId}`, pageWidth - 10, y, { align: 'right' });
    y += 4;
    doc.text(`DATE: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 10, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text('RETURNED ITEMS', 10, y);
    doc.line(10, y + 1, pageWidth - 10, y + 1);
    y += 6;
    
    doc.setFont("helvetica", "normal");
    let returnTotal = 0;
    returnedItems.forEach(item => {
      doc.text(`${item.quantity}x ${item.name.toUpperCase()}`, 10, y);
      const itemTotal = item.price * item.quantity;
      doc.text(formatCurrency(itemTotal), pageWidth - 10, y, { align: 'right' });
      returnTotal += itemTotal;
      y += 5;
    });
    
    y += 4;
    doc.line(10, y, pageWidth - 10, y);
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text('TOTAL CREDIT:', 10, y);
    doc.text(formatCurrency(returnTotal), pageWidth - 10, y, { align: 'right' });
    y += 15;

    doc.setFontSize(7);
    doc.setFont("helvetica", "");
    doc.text('Return processed successfully.', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text('POWERED BY MEGAPOS', pageWidth / 2, y, { align: 'center' });
    
    doc.autoPrint();
    const pdfBlob = doc.output('bloburl');
    window.open(pdfBlob, '_blank');
  };

  const handleCreateReturn = async () => {
    if (!user || !selectedTransactionForReturn) return;
    setIsSubmitting(true);
    
    const selectedEntries = Object.entries(returnItems).filter(([_, val]) => (val as any).selected);
    if (selectedEntries.length === 0) {
      setStatus({ message: "Please select at least one item to return.", type: 'error' });
      setIsSubmitting(false);
      return;
    }

    const returnId = `RET-${Date.now()}`;
    const returnedItemsList: any[] = [];

    try {
      for (const [id, val] of selectedEntries) {
        const originalItem = selectedTransactionForReturn.items.find((i: any) => i.id === id);
        if (originalItem) {
          const castVal = val as any;
          returnedItemsList.push({
            ...originalItem,
            quantity: castVal.quantity
          });

          // Update Stock
          const prodRef = doc(db, 'products', id);
          await updateDoc(prodRef, {
            stockLevel: increment(castVal.quantity)
          });
        }
      }

      const totalReturnAmount = returnedItemsList.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      await setDoc(doc(db, 'returns', returnId), {
        id: returnId,
        originalTransactionId: selectedTransactionForReturn.id,
        items: returnedItemsList,
        totalAmount: totalReturnAmount,
        timestamp: serverTimestamp(),
        processedBy: user.uid,
        status: 'completed'
      });

      // Update linked customer account balance/spent if applicable
      if (selectedTransactionForReturn.customerId) {
        try {
          const custRef = doc(db, 'customers', selectedTransactionForReturn.customerId);
          const custUpdates: any = {
            totalSpent: increment(-totalReturnAmount)
          };
          if (selectedTransactionForReturn.chargedToCredit) {
            custUpdates.accountBalance = increment(totalReturnAmount);
          }
          await updateDoc(custRef, custUpdates);
        } catch (custErr) {
          console.error("Error updating customer account balance on return:", custErr);
        }
      }

      generateReturnReceipt(returnId, selectedTransactionForReturn.id, returnedItemsList);
      
      setIsReturnModalOpen(false);
      setSelectedTransactionForReturn(null);
      setReturnItems({});
      setLastTransactionId(returnId);
      setShowSuccess(true);
    } catch (error) {
      setStatus({ message: "Failed to process return.", type: 'error' });
      try {
        handleFirestoreError(error, OperationType.CREATE, 'returns', auth);
      } catch (e) {
        console.error("Firestore error in return:", e);
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const selectAllItemsForReturn = (selectAll: boolean) => {
    if (!selectedTransactionForReturn) return;
    const newItems = { ...returnItems };
    selectedTransactionForReturn.items.forEach((item: any) => {
      newItems[item.id] = { selected: selectAll, quantity: item.quantity };
    });
    setReturnItems(newItems);
  };
  const handleUpdatePresale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPresale || !user) return;
    setIsSubmitting(true);
    try {
      const psRef = doc(db, 'presales', editingPresale.id);
      await updateDoc(psRef, {
        operator: editingPresale.op || editingPresale.operator || 'Terminal Staff',
        amount: Number(editingPresale.amount),
        status: editingPresale.status,
        items: editingPresale.items || []
      });
      setEditingPresale(null);
      setStatus({ message: "Presale updated successfully", type: 'success' });
    } catch (error) {
      setStatus({ message: "Failed to update presale", type: 'error' });
      try {
        handleFirestoreError(error, OperationType.UPDATE, `presales/${editingPresale.id}`, auth);
      } catch (e) {
        console.error("Firestore error in update presale:", e);
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const approvePresale = async (id: string) => {
    try {
      setIsSubmitting(true);
      const psRef = doc(db, 'presales', id);
      await updateDoc(psRef, { status: 'Approved' });
      setStatus({ message: 'Order initiated for liquidation', type: 'success' });
      setInitiatingPresale(null);
    } catch (error) {
      setStatus({ message: 'Failed to initiate order', type: 'error' });
      try {
        handleFirestoreError(error, OperationType.UPDATE, `presales/${id}`, auth);
      } catch (e) {
        console.error("Firestore error in approve presale:", e);
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const voidPresale = async (id: string) => {
    try {
      setIsSubmitting(true);
      const psRef = doc(db, 'presales', id);
      await updateDoc(psRef, { status: 'Voided' });
      setStatus({ message: 'Entry voided and archived', type: 'success' });
    } catch (error) {
      setStatus({ message: 'Failed to void entry', type: 'error' });
      try {
        handleFirestoreError(error, OperationType.UPDATE, `presales/${id}`, auth);
      } catch (e) {
        console.error("Firestore error in void presale:", e);
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };
  const [voidConfirmPresaleId, setVoidConfirmPresaleId] = React.useState<string | null>(null);
  const [cart, setCart] = React.useState<CartItem[]>([]);

  // Global Context Integrations
  const globalCartContext = useCart();
  const { currentShift, recordTransactionSale } = useShift();
  const { customers: customerList } = useCustomer();

  // Advanced POS Modal States
  const [isScannerModalOpen, setIsScannerModalOpen] = React.useState(false);
  const [isCustomerSearchModalOpen, setIsCustomerSearchModalOpen] = React.useState(false);
  const [isSplitPaymentModalOpen, setIsSplitPaymentModalOpen] = React.useState(false);
  const [isThermalReceiptModalOpen, setIsThermalReceiptModalOpen] = React.useState(false);
  const [completedTransactionForReceipt, setCompletedTransactionForReceipt] = React.useState<Transaction | null>(null);

  React.useEffect(() => {
    if (onCartChange) {
      onCartChange(cart.length);
    }
  }, [cart, onCartChange]);

  const [selectedProductForCart, setSelectedProductForCart] = React.useState<Product | null>(null);
  const [editingCartItem, setEditingCartItem] = React.useState<CartItem | null>(null);
  const [popupQuantity, setPopupQuantity] = React.useState<number>(1);
  const [overridePrice, setOverridePrice] = React.useState<string>("");
  const [selectedCheckoutMethod, setSelectedCheckoutMethod] = React.useState<PaymentMethod | null>(null);
  const [tenderedAmount, setTenderedAmount] = React.useState<string>("");
  const [lastTendered, setLastTendered] = React.useState<number | null>(null);
  const [lastChange, setLastChange] = React.useState<number | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = React.useState(false);
  const [isProductsOpen, setIsProductsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [lastAddedId, setLastAddedId] = React.useState<string | null>(null);
  const [lastTransactionId, setLastTransactionId] = React.useState<string | null>(null);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [isProductDetailOpen, setIsProductDetailOpen] = React.useState(false);
  const [selectedVariationId, setSelectedVariationId] = React.useState<string | null>(null);
  const selectedVariantObj = selectedProductForCart?.variations?.find(v => v.id === selectedVariationId);

  // Keyboard shortcut handlers
  useKeyboardShortcuts({
    onBarcodeScanModal: () => setIsScannerModalOpen(prev => !prev),
    onCustomerLookup: () => setIsCustomerSearchModalOpen(prev => !prev),
    onHoldCart: () => {
      if (cart.length > 0) {
        handleParkActiveCart();
      }
    },
    onClearCart: () => {
      if (cart.length > 0 && confirm("Are you sure you want to empty the current cart?")) {
        setCart([]);
      }
    },
    onSplitPaymentModal: () => {
      if (cart.length > 0) {
        setIsSplitPaymentModalOpen(true);
      }
    },
    onEscape: () => {
      setIsScannerModalOpen(false);
      setIsCustomerSearchModalOpen(false);
      setIsSplitPaymentModalOpen(false);
      setIsThermalReceiptModalOpen(false);
      setIsCheckoutOpen(false);
      setIsProductDetailOpen(false);
      setIsProductsOpen(false);
    }
  });

  const handleParkActiveCart = () => {
    if (cart.length === 0) return;
    try {
      const note = prompt("Enter a label or customer reference for this parked cart (e.g. Table 4 / Phone Order):", selectedCustomer ? selectedCustomer.name : "");
      if (note === null) return; // User cancelled
      
      const parkedId = `parked_${Date.now()}`;
      const parkedData = {
        id: parkedId,
        items: cart,
        customer: selectedCustomer || null,
        note: note || undefined,
        createdAt: new Date().toISOString()
      };

      const existingRaw = localStorage.getItem('nurtron_parked_carts');
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      existingList.unshift(parkedData);
      localStorage.setItem('nurtron_parked_carts', JSON.stringify(existingList));

      // Also sync into globalCartContext if available
      if (globalCartContext?.parkCurrentCart) {
        globalCartContext.parkCurrentCart(note || undefined);
      }

      setCart([]);
      setSelectedCustomer(null);
      setStatus({ message: `Cart successfully held with reference: ${note || 'Order #' + parkedId.slice(-4)}`, type: 'success' });
    } catch (e) {
      console.error("Error holding cart:", e);
      setStatus({ message: "Failed to hold cart locally", type: 'error' });
    }
  };

  const handleBarcodeDetected = (code: string) => {
    const query = code.trim().toLowerCase();
    let targetVarId: string | undefined;
    const match = products.find(p => {
      if (p.barcode && p.barcode.toLowerCase() === query) return true;
      if (p.sku && p.sku.toLowerCase() === query) return true;
      if (p.variations) {
        const vMatch = p.variations.find(v => 
          (v.barcode && v.barcode.toLowerCase() === query) ||
          (v.sku && v.sku.toLowerCase() === query)
        );
        if (vMatch) {
          targetVarId = vMatch.id;
          return true;
        }
      }
      return false;
    });

    if (match) {
      if (match.variations && match.variations.length > 0) {
        openProductDetail(match, targetVarId);
      } else {
        addToCartValue(match);
      }
      setIsScannerModalOpen(false);
      setStatus({ message: `Scanned: ${match.name}`, type: 'success' });
    } else {
      setStatus({ message: `No inventory item matches barcode: ${code}`, type: 'error' });
    }
  };

  const openProductDetail = (product: Product, targetVariationId?: string, editingItem: CartItem | null = null) => {
    setSelectedProductForCart(product);
    setEditingCartItem(editingItem);
    
    if (product.variations && product.variations.length > 0) {
      const initialVar = targetVariationId 
        ? product.variations.find(v => v.id === targetVariationId) || product.variations[0]
        : product.variations[0];
      setSelectedVariationId(initialVar.id);
      setOverridePrice((editingItem?.priceOverride ?? initialVar.price ?? product.price).toString());
      const varStock = initialVar.stockLevel ?? product.stockLevel ?? 0;
      setPopupQuantity(editingItem ? Math.min(editingItem.quantity, varStock) : Math.min(1, Math.max(0, varStock)));
    } else {
      setSelectedVariationId(null);
      setOverridePrice((editingItem?.priceOverride ?? product.price).toString());
      const maxStock = product.stockLevel ?? 0;
      setPopupQuantity(editingItem ? Math.min(editingItem.quantity, maxStock) : Math.min(1, Math.max(0, maxStock)));
    }
    setIsProductDetailOpen(true);
  };
  const [autoPrint, setAutoPrint] = React.useState(true);
  const [paperType, setPaperType] = React.useState<'thermal' | 'a4'>('thermal');
  const [lowStockThreshold, setLowStockThreshold] = React.useState(10);
  const [lowStockEnabled, setLowStockEnabled] = React.useState(true);
  const [globalMarkup, setGlobalMarkup] = React.useState(0);
  const [globalDiscount, setGlobalDiscount] = React.useState(0);
  const [storeInfo, setStoreInfo] = React.useState({
    name: 'megapos',
    registrationNumber: '',
    vatNumber: '',
    streetNumber: '',
    streetName: '',
    suburb: '',
    phoneNumber: '',
    website: '',
    receiptFooterMessage: 'THANK YOU FOR YOUR PATRONAGE'
  });

  React.useEffect(() => {
    if (storeSettings) {
      setStoreInfo(prev => ({
        ...prev,
        ...storeSettings,
        name: storeSettings.storeName
      }));
    }
  }, [storeSettings]);

  React.useEffect(() => {
    if (isCheckoutOpen) {
      setSelectedCheckoutMethod(null);
      setTenderedAmount("");
    }
  }, [isCheckoutOpen]);

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', storeId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setAutoPrint(data.autoPrint !== false);
        setPaperType(data.paperType || 'thermal');
        setLowStockThreshold(data.lowStockThreshold || 10);
        setLowStockEnabled(data.lowStockEnabled !== false);
        setGlobalMarkup(data.globalMarkup || 0);
        setGlobalDiscount(data.globalDiscount || 0);
        const regLayout = data.desktopRegisterLayout || data.desktopLayout || 'table';
        setDesktopLayout(regLayout);
        try {
          localStorage.setItem('nurtron_desktop_register_layout', regLayout);
        } catch(e) {}
        setStoreInfo({
          name: data.storeName || 'megapos',
          registrationNumber: data.registrationNumber || '',
          vatNumber: data.vatNumber || '',
          streetNumber: data.streetNumber || '',
          streetName: data.streetName || '',
          suburb: data.suburb || '',
          phoneNumber: data.phoneNumber || '',
          website: data.website || '',
          receiptFooterMessage: data.receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE'
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubSettings();
    };
  }, [storeId]);

  React.useEffect(() => {
    setProductsLoading(true);
    const path = 'products';
    const activeManagerEmail = (managerEmail || localStorage.getItem('nurtron_registered_manager_email') || user?.email || 'admin@megapos.pos').toLowerCase().trim();

    const unsubscribe = onSnapshot(collection(db, path), async (snapshot) => {
      const allFetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      let prods = allFetched.filter(p => {
        if (p.managerEmail) return p.managerEmail.toLowerCase().trim() === activeManagerEmail;
        if (p.ownerEmail) return p.ownerEmail.toLowerCase().trim() === activeManagerEmail;
        return activeManagerEmail === 'admin@megapos.pos' || activeManagerEmail === 'faarhanch@gmail.com';
      });
      
      if (prods.length === 0 && (snapshot.empty || activeManagerEmail !== 'admin@megapos.pos')) {
        let cachedLocal: Product[] = [];
        try {
          const cachedStr = localStorage.getItem('nurtron_cached_products');
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            cachedLocal = (parsed || []).filter((p: any) => !p.managerEmail || p.managerEmail.toLowerCase().trim() === activeManagerEmail);
          }
        } catch(e) {}

        if (cachedLocal && cachedLocal.length > 0) {
          prods = cachedLocal;
          if (user) {
            try {
              const batch = writeBatch(db);
              cachedLocal.forEach((prod) => {
                const docRef = doc(db, 'products', prod.id);
                batch.set(docRef, { ...prod, managerEmail: activeManagerEmail });
              });
              await batch.commit();
            } catch(e) {
              console.error("Error restoring cached products to new database:", e);
            }
          }
        } else {
          if (user) {
            try {
              const batch = writeBatch(db);
              MOCK_PRODUCTS.forEach((prod) => {
                const pId = `${activeManagerEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${prod.id}`;
                const docRef = doc(db, 'products', pId);
                batch.set(docRef, {
                  ...prod,
                  id: pId,
                  managerEmail: activeManagerEmail,
                  costPrice: Number((prod.price * 0.6).toFixed(2))
                });
              });
              await batch.commit();
              return;
            } catch(e) {
              console.error("Error auto-seeding products:", e);
            }
          }
          prods = MOCK_PRODUCTS;
        }
      }

      setProducts(prods);
      setProductsLoading(false);
      try {
        localStorage.setItem('nurtron_cached_products', JSON.stringify(prods));
      } catch(e) {}
    }, (error) => {
      console.warn("Products snapshot notification:", error);
      setProducts(prev => prev.length > 0 ? prev : MOCK_PRODUCTS);
      setProductsLoading(false);
    });

    return () => unsubscribe();
  }, [user, storeId, managerEmail]);

  const handleLogin = () => {
    setIsLoginDialogOpen(true);
  };

  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, stockFilter]);

  const filteredProducts = products.filter(p => {
    if (!p) return false;
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const search = (searchQuery || '').toLowerCase();
    const nameMatch = p.name ? p.name.toLowerCase().includes(search) : false;
    const idMatch = p.id ? p.id.toLowerCase().includes(search) : false;
    const barcodeMatch = p.barcode ? p.barcode.toLowerCase().includes(search) : false;
    const skuMatch = p.sku ? p.sku.toLowerCase().includes(search) : false;
    const matchesSearch = nameMatch || idMatch || barcodeMatch || skuMatch;
    
    let matchesStock = true;
    const stock = p.stockLevel ?? 0;
    if (stockFilter === 'critical') matchesStock = stock <= 0;
    else if (stockFilter === 'low-stock') matchesStock = stock > 0 && stock < lowStockThreshold;
    else if (stockFilter === 'healthy') matchesStock = stock >= lowStockThreshold;
    
    return matchesCategory && matchesSearch && matchesStock;
  });

  const itemsPerPage = 50;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const addToCartValue = (product: Product, manualPrice?: number) => {
    const actualPrice = manualPrice !== undefined ? manualPrice : product.price;
    const originalPrice = product.price;
    const priceOverride = manualPrice !== undefined && manualPrice !== originalPrice ? manualPrice : undefined;

    const maxStock = product.stockLevel ?? 0;
    const existingInCart = cart.find(item => item.id === product.id && item.priceOverride === priceOverride);
    const currentQty = existingInCart ? existingInCart.quantity : 0;

    if (currentQty + 1 > maxStock) {
      const msg = maxStock <= 0 
        ? `"${product.name}" is currently out of stock.` 
        : `Cannot add more than available stock (${maxStock} unit${maxStock === 1 ? '' : 's'}) for "${product.name}". You currently have ${currentQty} in cart.`;
      setStockLimitWarning({ message: msg, productName: product.name, maxStock });
      return;
    }

    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 600);
    
    setCart(prev => {
      const discount = Math.max(0, originalPrice - actualPrice);
      const existingIndex = prev.findIndex(item => item.id === product.id && item.priceOverride === priceOverride);
      
      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }
      
      return [...prev, { 
        ...product, 
        quantity: 1, 
        priceOverride, 
        originalPrice,
        discount: discount > 0 ? discount : undefined
      }];
    });
    
    setSelectedProductForCart(null);
    setOverridePrice("");
  };

  const handleScanBarcode = React.useCallback((scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return false;

    let matchedProduct: Product | null = null;
    let matchedVariationId: string | undefined = undefined;

    for (const product of products) {
      if (
        (product.barcode && product.barcode.trim().toLowerCase() === code.toLowerCase()) ||
        (product.sku && product.sku.trim().toLowerCase() === code.toLowerCase())
      ) {
        matchedProduct = product;
        break;
      }

      if (product.variations) {
        const matchedVar = product.variations.find(v => 
          (v.barcode && v.barcode.trim().toLowerCase() === code.toLowerCase()) ||
          (v.sku && v.sku.trim().toLowerCase() === code.toLowerCase())
        );
        if (matchedVar) {
          matchedProduct = product;
          matchedVariationId = matchedVar.id;
          break;
        }
      }
    }

    if (matchedProduct) {
      if (matchedVariationId && matchedProduct.variations) {
        const varObj = matchedProduct.variations.find(v => v.id === matchedVariationId);
        if (varObj) {
          const suffixParts = [];
          if (varObj.size) suffixParts.push(`Size: ${varObj.size}`);
          if (varObj.color) suffixParts.push(`Color: ${varObj.color}`);
          if (varObj.quantity) suffixParts.push(`Qty: ${varObj.quantity}`);
          
          const suffix = suffixParts.join(' / ');
          const finalProduct: Product = {
            ...matchedProduct,
            id: `${matchedProduct.id}-${varObj.id}`,
            name: suffix ? `${matchedProduct.name} (${suffix})` : matchedProduct.name,
            sku: varObj.sku || matchedProduct.sku || '',
            barcode: varObj.barcode || matchedProduct.barcode || '',
            price: varObj.price ?? matchedProduct.price,
            costPrice: varObj.costPrice ?? matchedProduct.costPrice,
            stockLevel: varObj.stockLevel ?? matchedProduct.stockLevel
          };
          addToCartValue(finalProduct);
          setStatus({
            message: `Scanned and added: ${finalProduct.name}`,
            type: 'success'
          });
        }
      } else {
        addToCartValue(matchedProduct);
        setStatus({
          message: `Scanned and added: ${matchedProduct.name}`,
          type: 'success'
        });
      }
      return true;
    } else {
      setStatus({
        message: `No product found with barcode: "${code}"`,
        type: 'error'
      });
      return false;
    }
  }, [products, addToCartValue]);

  React.useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;

      const now = Date.now();

      // If the delay is too long, we reset the scanning buffer
      if (now - lastKeyTime > 200) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const scannedCode = buffer.trim();
        if (scannedCode.length >= 3) {
          const matched = handleScanBarcode(scannedCode);
          if (matched) {
            e.preventDefault();
            e.stopPropagation();
            buffer = '';
            return;
          }
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1) {
        const activeEl = document.activeElement;
        const isInputFocused = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          (activeEl as HTMLElement).isContentEditable
        );

        // Capture keystrokes if not in an input, OR if in an input but typed at high keypress speeds (< 50ms)
        if (!isInputFocused || (now - lastKeyTime < 50)) {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [products, addToCartValue, handleScanBarcode]);

  const handleConfirmAssetDetail = (quantity: number, price: number) => {
    if (!selectedProductForCart) return;
    
    if (editingCartItem) {
      // Editing existing cart item
      const maxStock = selectedProductForCart.stockLevel ?? 0;
      let targetQty = quantity;
      if (targetQty > maxStock) {
        const msg = maxStock <= 0 
          ? `"${selectedProductForCart.name}" is currently out of stock.` 
          : `Requested quantity (${targetQty}) exceeds maximum available stock (${maxStock} unit${maxStock === 1 ? '' : 's'}) for "${selectedProductForCart.name}".`;
        setStockLimitWarning({ message: msg, productName: selectedProductForCart.name, maxStock });
        return;
      }

      setCart(prev => prev.map(item => {
        if (item.id === selectedProductForCart.id) {
          const actualPrice = price;
          const originalPrice = selectedProductForCart.price;
          const discount = Math.max(0, originalPrice - actualPrice);
          const priceOverride = actualPrice !== originalPrice ? actualPrice : undefined;
          
          return {
            ...item,
            priceOverride,
            discount: discount > 0 ? discount : undefined,
            quantity: targetQty
          };
        }
        return item;
      }).filter(item => item.quantity > 0));
    } else {
      // Adding new product to the cart
      let finalProduct = { ...selectedProductForCart };
      let customPrice = price;
      
      if (selectedVariationId && selectedProductForCart.variations) {
        const varObj = selectedProductForCart.variations.find(v => v.id === selectedVariationId);
        if (varObj) {
          const suffixParts = [];
          if (varObj.size) suffixParts.push(`Size: ${varObj.size}`);
          if (varObj.color) suffixParts.push(`Color: ${varObj.color}`);
          if (varObj.quantity) suffixParts.push(`Qty: ${varObj.quantity}`);
          
          const suffix = suffixParts.join(' / ');
          finalProduct = {
            ...selectedProductForCart,
            id: `${selectedProductForCart.id}-${varObj.id}`, // unique cart item id
            name: suffix ? `${selectedProductForCart.name} (${suffix})` : selectedProductForCart.name,
            sku: varObj.sku || selectedProductForCart.sku || '',
            barcode: varObj.barcode || selectedProductForCart.barcode || '',
            price: varObj.price ?? selectedProductForCart.price,
            costPrice: varObj.costPrice ?? selectedProductForCart.costPrice,
            stockLevel: varObj.stockLevel ?? selectedProductForCart.stockLevel
          };
          if (price === selectedProductForCart.price && varObj.price !== undefined) {
            customPrice = varObj.price;
          }
        }
      }

      const maxStock = finalProduct.stockLevel ?? 0;
      const actualPrice = customPrice;
      const originalPrice = finalProduct.price;
      const priceOverride = actualPrice !== originalPrice ? actualPrice : undefined;

      const existingItem = cart.find(item => item.id === finalProduct.id && item.priceOverride === priceOverride);
      const currentInCart = existingItem ? existingItem.quantity : 0;

      let qtyToAdd = quantity;
      if (currentInCart + qtyToAdd > maxStock) {
        const remaining = Math.max(0, maxStock - currentInCart);
        const msg = maxStock <= 0 
          ? `"${finalProduct.name}" is currently out of stock.`
          : remaining <= 0 
            ? `Cannot add more units of "${finalProduct.name}". Maximum available stock (${maxStock}) is already in your cart.`
            : `Cannot add ${qtyToAdd} more unit(s) of "${finalProduct.name}". Only ${remaining} remaining unit(s) available for stock limit (${maxStock}).`;
        setStockLimitWarning({ message: msg, productName: finalProduct.name, maxStock });
        return;
      }

      setLastAddedId(selectedProductForCart.id);
      setTimeout(() => setLastAddedId(null), 600);

      setCart(prev => {
        const discount = Math.max(0, originalPrice - actualPrice);
        const existingIndex = prev.findIndex(item => item.id === finalProduct.id && item.priceOverride === priceOverride);
        
        if (existingIndex > -1) {
          const newCart = [...prev];
          newCart[existingIndex].quantity += qtyToAdd;
          return newCart;
        }
        
        return [...prev, { 
          ...finalProduct, 
          quantity: qtyToAdd, 
          priceOverride, 
          originalPrice,
          discount: discount > 0 ? discount : undefined
        }];
      });
    }
    
    setSelectedProductForCart(null);
    setEditingCartItem(null);
    setSelectedVariationId(null);
    setIsProductDetailOpen(false);
  };

  const handleCloseAssetDetail = () => {
    setSelectedProductForCart(null);
    setEditingCartItem(null);
    setSelectedVariationId(null);
    setIsProductDetailOpen(false);
  };

  const handleNextItem = () => {
    if (selectedProductForCart) {
      handleConfirmAssetDetail(popupQuantity, Number(overridePrice) || 0);
    }
  };

  const handleEndSale = () => {
    if (selectedProductForCart) {
      handleConfirmAssetDetail(popupQuantity, Number(overridePrice) || 0);
    }
    setIsProductsOpen(false);
    setIsProductDetailOpen(false);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    if (delta > 0) {
      const targetItem = cart.find(item => item.id === productId);
      if (targetItem) {
        const maxStock = targetItem.stockLevel ?? 0;
        if (targetItem.quantity + delta > maxStock) {
          const msg = maxStock <= 0 
            ? `"${targetItem.name}" is out of stock.` 
            : `Cannot exceed maximum available stock (${maxStock} unit${maxStock === 1 ? '' : 's'}) for "${targetItem.name}".`;
          setStockLimitWarning({ message: msg, productName: targetItem.name, maxStock });
          return;
        }
      }
    }

    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const originalSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const effectiveSubtotal = cart.reduce((acc, item) => acc + ((item.priceOverride ?? item.price) * item.quantity), 0);
  const priceOverrideDiscount = originalSubtotal - effectiveSubtotal;
  
  const markupAmount = effectiveSubtotal * (globalMarkup / 100);
  const totalDiscount = ((effectiveSubtotal + markupAmount) * (globalDiscount / 100)) + priceOverrideDiscount;
  
  const subtotalAfterMarkupAndDiscount = Math.max(0, effectiveSubtotal + markupAmount - ((effectiveSubtotal + markupAmount) * (globalDiscount / 100)));
  
  let tax = 0;
  let total = subtotalAfterMarkupAndDiscount;

  if (taxType === 'exclusive') {
    tax = subtotalAfterMarkupAndDiscount * taxRate;
    total = subtotalAfterMarkupAndDiscount + tax;
  } else if (taxType === 'inclusive') {
    tax = subtotalAfterMarkupAndDiscount - (subtotalAfterMarkupAndDiscount / (1 + taxRate));
    total = subtotalAfterMarkupAndDiscount;
  } else { // taxType === 'none'
    tax = 0;
    total = subtotalAfterMarkupAndDiscount;
  }

  const generatePresaleReceipt = async (transactionId: string, autoPrint = true) => {
    const docRef = doc(db, 'presales', transactionId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const data = snap.data();

    if (paperType === 'a4') {
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const repName = user?.displayName || 'Terminal Staff';
      const address = [storeInfo.streetNumber, storeInfo.streetName, storeInfo.suburb].filter(Boolean).join(' ');

      // Header Brand
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(30, 41, 59);
      pdf.text(storeInfo.name.toUpperCase(), 15, 20);

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      
      let currentY = 25;
      if (address) {
        pdf.text(address.toUpperCase(), 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.registrationNumber) {
        pdf.text(`REG NO: ${storeInfo.registrationNumber}`, 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.vatNumber) {
        pdf.text(`TAX/VAT NO: ${storeInfo.vatNumber}`, 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.phoneNumber) {
        pdf.text(`TEL: ${storeInfo.phoneNumber}`, 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.website) {
        pdf.text(`WEB: ${storeInfo.website.toLowerCase()}`, 15, currentY);
        currentY += 4.5;
      }

      // Title & Memo on Top Right
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(30, 41, 59);
      pdf.text('PRESALE ORDER SLIP', 195, 20, { align: 'right' });

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      pdf.text(`DOCUMENT ID: ${transactionId}`, 195, 25, { align: 'right' });
      pdf.text(`DATE / TIME: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 195, 29, { align: 'right' });
      pdf.text(`OPERATOR: ${repName.toUpperCase()}`, 195, 33, { align: 'right' });

      // Client Section Divider
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(15, 45, 195, 45);

      // Bill To Client Box
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text("BILL TO:", 15, 52);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      if (data.customerName) {
        pdf.text(data.customerName.toUpperCase(), 15, 57);
        pdf.text(`CUSTOMER ID/CODE: ${data.customerCode || 'N/A'}`, 15, 61.5);
      } else {
        pdf.text("WALK-IN CLIENT / RETAIL CASH CUSTOMER", 15, 57);
      }

      pdf.line(15, 68, 195, 68);

      // Draw items table
      pdf.setFillColor(248, 250, 252);
      pdf.rect(15, 73, 180, 8, 'F');
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);

      pdf.text("#", 18, 78.5);
      pdf.text("ITEM DESCRIPTION", 28, 78.5);
      pdf.text("SKU / BARCODE", 100, 78.5);
      pdf.text("UNIT PRICE", 135, 78.5);
      pdf.text("QTY", 158, 78.5);
      pdf.text("TOTAL", 180, 78.5);

      let y = 87;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);

      const items = data.items || [];
      items.forEach((item: any, index: number) => {
        pdf.setFont("helvetica", "normal");
        const displayName = (item.name || 'Product').toUpperCase();
        const barcodeVal = item.barcode || item.sku || 'N/A';
        
        pdf.text(String(index + 1), 18, y);
        pdf.text(displayName.substring(0, 36), 28, y);
        pdf.text(String(barcodeVal), 100, y);
        pdf.text(formatCurrency(item.price || 0, currency), 135, y);
        pdf.text(String(item.quantity), 158, y);
        pdf.text(formatCurrency((item.price || 0) * item.quantity, currency), 180, y);

        pdf.setDrawColor(241, 245, 249);
        pdf.line(15, y + 2.5, 195, y + 2.5);
        y += 7.5;

        if (y > 240) {
          pdf.addPage();
          pdf.setFillColor(248, 250, 252);
          pdf.rect(15, 15, 180, 8, 'F');
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(51, 65, 85);
          pdf.text("#", 18, 20.5);
          pdf.text("ITEM DESCRIPTION", 28, 20.5);
          pdf.text("SKU / BARCODE", 100, 20.5);
          pdf.text("UNIT PRICE", 135, 20.5);
          pdf.text("QTY", 158, 20.5);
          pdf.text("TOTAL", 180, 20.5);
          y = 28;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(15, 23, 42);
        }
      });

      // Total block
      pdf.setDrawColor(226, 232, 240);
      pdf.line(15, y, 195, y);
      y += 7;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);

      pdf.text("SUBTOTAL:", 145, y);
      pdf.text(formatCurrency(data.amount || 0, currency), 195, y, { align: 'right' });
      y += 4.5;

      pdf.setDrawColor(148, 163, 184);
      pdf.line(140, y - 1.5, 195, y - 1.5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text("PENDING GRAND TOTAL:", 145, y + 1);
      pdf.text(formatCurrency(data.amount || 0, currency), 195, y + 1, { align: 'right' });
      y += 15;

      // Note/Disclaimer
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "");
      pdf.setTextColor(100, 116, 139);
      pdf.text('This is a presale slip request (A4 format).', 105, y, { align: 'center' });
      y += 4.5;
      pdf.text('Please present this invoice slip to the desk operator for final payment.', 105, y, { align: 'center' });
      y += 12;

      // Space out for barcode at bottom if needed
      if (y > 240) {
        pdf.addPage();
      }

      // Nice footer banner
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(15, 255, 195, 255);

      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, transactionId, {
          format: "CODE128",
          width: 1.8,
          height: 45,
          displayValue: false
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 85, 258, 40, 11);
      } catch (e) {
        console.error(e);
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      pdf.text(transactionId, 105, 273, { align: 'center' });

      pdf.setFont("helvetica", "");
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(storeInfo.receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE', 105, 279, { align: 'center' });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text('POWERED BY MEGAPOS', 105, 284, { align: 'center' });

      if (autoPrint) {
        pdf.autoPrint();
      }
      const blob = pdf.output('bloburl');
      window.open(blob, '_blank');
      return;
    }

    const pdf = new jsPDF({
      unit: 'mm',
      format: [80, 220]
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = 10;
    
    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(storeInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 5;

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const address = [storeInfo.streetNumber, storeInfo.streetName, storeInfo.suburb].filter(Boolean).join(' ');
    if (address) {
      pdf.text(address.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.registrationNumber) {
      pdf.text(`REG NO: ${storeInfo.registrationNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.vatNumber) {
      pdf.text(`TAX NO: ${storeInfo.vatNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.phoneNumber) {
      pdf.text(`PH: ${storeInfo.phoneNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.website) {
      pdf.text(storeInfo.website.toLowerCase(), pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    
    y += 4;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text('PRESALE ORDER SLIP', pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(`REP: ${user?.displayName?.toUpperCase() || 'TECHNICIAN'}`, 10, y);
    pdf.text(`ID: ${transactionId}`, pageWidth - 10, y, { align: 'right' });
    y += 4;
    pdf.text(`DATE: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 10, y);
    y += 8;

    // Summary 
    pdf.setFont("helvetica", "bold");
    pdf.text('PRESALE SUMMARY', 10, y);
    pdf.line(10, y + 1, pageWidth - 10, y + 1);
    y += 6;
    
    pdf.setFont("helvetica", "normal");
    const items = data.items || [];
    pdf.text(`Item Count: ${items.length}`, 10, y);
    y += 8;
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text('PENDING TOTAL:', 10, y);
    pdf.text(formatCurrency(data.amount, currency), pageWidth - 10, y, { align: 'right' });
    y += 10;

    // Barcode
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, transactionId, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: false
      });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', (pageWidth - 50) / 2, y, 50, 15);
      y += 18;
    } catch (e) {
      console.error('Barcode generation failed', e);
    }

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(transactionId, pageWidth / 2, y, { align: 'center' });
    y += 10;

    pdf.setFontSize(7);
    pdf.setFont("helvetica", "");
    pdf.text('This is a presale request.', pageWidth / 2, y, { align: 'center' });
    y += 4;
    pdf.text('Please present this slip for final payment.', pageWidth / 2, y, { align: 'center' });
    y += 10;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.text('POWERED BY MEGAPOS', pageWidth / 2, y, { align: 'center' });
    y += 5;
    
    if (autoPrint) {
      pdf.autoPrint();
    }
    const blob = pdf.output('bloburl');
    window.open(blob, '_blank');
  };

  const generateReceipt = (transactionId: string, type: 'sale' | 'presale' = 'sale') => {
    if (paperType === 'a4') {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      const repName = user?.displayName || 'Terminal Staff';
      const address = [storeInfo.streetNumber, storeInfo.streetName, storeInfo.suburb].filter(Boolean).join(' ');

      // Header Brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59);
      doc.text(storeInfo.name.toUpperCase(), 15, 20);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      
      let currentY = 25;
      if (address) {
        doc.text(address.toUpperCase(), 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.registrationNumber) {
        doc.text(`REG NO: ${storeInfo.registrationNumber}`, 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.vatNumber) {
        doc.text(`TAX/VAT NO: ${storeInfo.vatNumber}`, 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.phoneNumber) {
        doc.text(`TEL: ${storeInfo.phoneNumber}`, 15, currentY);
        currentY += 4.5;
      }
      if (storeInfo.website) {
        doc.text(`WEB: ${storeInfo.website.toLowerCase()}`, 15, currentY);
        currentY += 4.5;
      }

      // Title & Memo on Top Right
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(type === 'presale' ? 'PRESALE ORDER SLIP' : 'TAX INVOICE / RECEIPT', 195, 20, { align: 'right' });

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`DOCUMENT ID: ${transactionId}`, 195, 25, { align: 'right' });
      doc.text(`DATE / TIME: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 195, 29, { align: 'right' });
      doc.text(`OPERATOR: ${repName.toUpperCase()}`, 195, 33, { align: 'right' });

      // Client Section Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(15, 45, 195, 45);

      // Bill To Client Box
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("BILL TO:", 15, 52);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      if (selectedCustomer) {
        doc.text(selectedCustomer.name.toUpperCase(), 15, 57);
        doc.text(`CUSTOMER ID: ${selectedCustomer.customerId || 'LINKED'}`, 15, 61.5);
      } else {
        doc.text("WALK-IN CLIENT / RETAIL CASH CUSTOMER", 15, 57);
      }

      doc.line(15, 68, 195, 68);

      if (type === 'presale') {
        // Presale Info Slip
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text('PRESALE STATEMENT', 15, 76);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(`Total Items: ${cart.length}`, 15, 82);
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text('PENDING GRAND TOTAL:', 15, 90);
        doc.text(formatCurrency(total, currency).toUpperCase(), 195, 90, { align: 'right' });

        // Warning & Footer positioning
        let y = 110;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "");
        doc.setTextColor(100, 116, 139);
        doc.text('This document is a formal presale order request.', 105, y, { align: 'center' });
        y += 4.5;
        doc.text('Please present this invoice slip to the desk operator for final payment.', 105, y, { align: 'center' });
        
        // Barcode block
        y += 12;
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y, 195, y);
        y += 6;
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, transactionId, {
            format: "CODE128",
            width: 1.8,
            height: 45,
            displayValue: false
          });
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 85, y, 40, 12);
          y += 15;
        } catch (e) {
          console.error(e);
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(transactionId, 105, y, { align: 'center' });
      } else {
        // Full standard Checkout Invoice
        doc.setFillColor(248, 250, 252);
        doc.rect(15, 73, 180, 8, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);

        doc.text("#", 18, 78.5);
        doc.text("ITEM DESCRIPTION", 28, 78.5);
        doc.text("SKU / BARCODE", 100, 78.5);
        doc.text("UNIT PRICE", 135, 78.5);
        doc.text("QTY", 158, 78.5);
        doc.text("TOTAL", 180, 78.5);

        let y = 87;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);

        cart.forEach((item, index) => {
          doc.setFont("helvetica", "normal");
          const displayName = (item.name || 'Product').toUpperCase();
          const barcodeVal = item.barcode || item.sku || 'N/A';
          
          doc.text(String(index + 1), 18, y);
          doc.text(displayName.substring(0, 36), 28, y);
          doc.text(String(barcodeVal), 100, y);
          doc.text(formatCurrency(item.price || 0, currency), 135, y);
          doc.text(String(item.quantity), 158, y);
          doc.text(formatCurrency((item.price || 0) * item.quantity, currency), 180, y);

          doc.setDrawColor(241, 245, 249);
          doc.line(15, y + 2.5, 195, y + 2.5);
          y += 7.5;

          if (y > 240) {
            doc.addPage();
            // Header Repeat
            doc.setFillColor(248, 250, 252);
            doc.rect(15, 15, 180, 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text("#", 18, 20.5);
            doc.text("ITEM DESCRIPTION", 28, 20.5);
            doc.text("SKU / BARCODE", 100, 20.5);
            doc.text("UNIT PRICE", 135, 20.5);
            doc.text("QTY", 158, 20.5);
            doc.text("TOTAL", 180, 20.5);
            y = 28;
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
          }
        });

        // Financial summary block aligned right
        doc.setDrawColor(226, 232, 240);
        doc.line(15, y, 195, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        doc.text("SUBTOTAL:", 145, y);
        doc.text(formatCurrency(originalSubtotal, currency), 195, y, { align: 'right' });
        y += 4.5;

        doc.text("TOTAL DISCOUNT:", 145, y);
        doc.text(`-${formatCurrency(totalDiscount, currency)}`, 195, y, { align: 'right' });
        y += 4.5;

        if (markupAmount > 0) {
          doc.text(`MARKUP (${globalMarkup}%):`, 145, y);
          doc.text(formatCurrency(markupAmount, currency), 195, y, { align: 'right' });
          y += 4.5;
        }

        const taxLabel = taxType === 'none' 
          ? 'FISCAL DUTY (NO TAX):' 
          : taxType === 'inclusive' 
            ? `FISCAL DUTY (${(taxRate * 100).toFixed(1)}% INCL):` 
            : `FISCAL DUTY (${(taxRate * 100).toFixed(1)}%):`;

        doc.text(taxLabel, 145, y);
        doc.text(formatCurrency(tax, currency), 195, y, { align: 'right' });
        y += 5.5;

        doc.setDrawColor(148, 163, 184);
        doc.line(140, y - 1.5, 195, y - 1.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text("GRAND TOTAL:", 145, y + 1);
        doc.text(formatCurrency(total, currency), 195, y + 1, { align: 'right' });
        y += 7.5;

        if (lastTendered !== null) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text("CASH TENDERED:", 145, y);
          doc.text(formatCurrency(lastTendered, currency), 195, y, { align: 'right' });
          y += 4.5;
          doc.text("CHANGE:", 145, y);
          doc.text(formatCurrency(lastChange ?? 0, currency), 195, y, { align: 'right' });
          y += 6;
        }

        // Space out for barcode at bottom if needed
        if (y > 240) {
          doc.addPage();
        }

        // Nice footer banner
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 255, 195, 255);

        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, transactionId, {
            format: "CODE128",
            width: 1.8,
            height: 45,
            displayValue: false
          });
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 85, 258, 40, 11);
        } catch (e) {
          console.error(e);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(transactionId, 105, 273, { align: 'center' });

        doc.setFont("helvetica", "");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(storeInfo.receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE', 105, 279, { align: 'center' });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text('POWERED BY MEGAPOS', 105, 284, { align: 'center' });
      }

      doc.autoPrint();
      const pdfBlob = doc.output('bloburl');
      window.open(pdfBlob, '_blank');
      return;
    }

    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 220] // Slightly longer for more info
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(storeInfo.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const address = [storeInfo.streetNumber, storeInfo.streetName, storeInfo.suburb].filter(Boolean).join(' ');
    if (address) {
      doc.text(address.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.registrationNumber) {
      doc.text(`REG NO: ${storeInfo.registrationNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.vatNumber) {
      doc.text(`TAX NO: ${storeInfo.vatNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.phoneNumber) {
      doc.text(`PH: ${storeInfo.phoneNumber}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    if (storeInfo.website) {
      doc.text(storeInfo.website.toLowerCase(), pageWidth / 2, y, { align: 'center' });
      y += 4;
    }
    
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(type === 'presale' ? 'PRESALE ORDER SLIP' : 'TAX INVOICE / RECEIPT', pageWidth / 2, y, { align: 'center' });
    y += 6;
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`REP: ${user?.displayName?.toUpperCase() || 'TECHNICIAN'}`, 10, y);
    doc.text(`ID: ${transactionId}`, pageWidth - 10, y, { align: 'right' });
    y += 4;
    doc.text(`DATE: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 10, y);
    y += 8;

    if (type === 'presale') {
      // Presale Short Receipt
      doc.setFont("helvetica", "bold");
      doc.text('PRESALE ORDER SLIP', 10, y);
      doc.line(10, y + 1, pageWidth - 10, y + 1);
      y += 6;
      
      doc.setFont("helvetica", "normal");
      doc.text(`Item Count: ${cart.length}`, 10, y);
      y += 5;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text('PENDING TOTAL:', 10, y + 5);
      doc.text(formatCurrency(total, currency).toUpperCase(), pageWidth - 10, y + 5, { align: 'right' });
      y += 15;
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "");
      doc.text('This is a presale request.', pageWidth / 2, y, { align: 'center' });
      y += 4;
      doc.text('Please present this slip for final payment.', pageWidth / 2, y, { align: 'center' });
      y += 10;
    } else {
      // Full Cash Sale Receipt
      doc.setFont("helvetica", "bold");
      doc.text('ITEM', 10, y);
      doc.text('TOTAL', pageWidth - 10, y, { align: 'right' });
      
      doc.line(10, y + 1, pageWidth - 10, y + 1);
      y += 6;
      
      doc.setFont("helvetica", "normal");
      cart.forEach(item => {
        // Line 1: Name, Total
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        const displayName = (item.name || 'Product').toUpperCase().substring(0, 36);
        doc.text(displayName, 10, y);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(formatCurrency(item.price * item.quantity, currency), pageWidth - 10, y, { align: 'right' });
        
        // Line 2: Barcode & Unit Price & Qty
        y += 4;
        const barcodeVal = item.barcode || item.sku || 'N/A';
        doc.setFontSize(6);
        doc.setFont("helvetica", "");
        doc.text(`${barcodeVal}  |  @ ${formatCurrency(item.price, currency)}  x ${item.quantity}`, 10, y);
        
        y += 5.5; // Spacing to next item
        
        if (y > 195) { doc.addPage(); y = 15; }
      });
      
      doc.line(10, y, pageWidth - 10, y);
      y += 5;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      
      doc.text('SUBTOTAL:', 10, y);
      doc.text(formatCurrency(originalSubtotal, currency), pageWidth - 10, y, { align: 'right' });
      y += 4.5;
      
      // Always show Discount amount under Subtotal
      doc.text('TOTAL DISCOUNT:', 10, y);
      doc.text(`-${formatCurrency(totalDiscount, currency)}`, pageWidth - 10, y, { align: 'right' });
      y += 4.5;

      if (markupAmount > 0) {
        doc.text(`MARKUP (${globalMarkup}%):`, 10, y);
        doc.text(formatCurrency(markupAmount, currency), pageWidth - 10, y, { align: 'right' });
        y += 4.5;
      }
      
      const taxLabel = taxType === 'none' 
        ? 'FISCAL DUTY (NO TAX):' 
        : taxType === 'inclusive' 
          ? `FISCAL DUTY (${(taxRate * 100).toFixed(1)}% INCL):` 
          : `FISCAL DUTY (${(taxRate * 100).toFixed(1)}%):`;
      doc.text(taxLabel, 10, y);
      doc.text(formatCurrency(tax, currency), pageWidth - 10, y, { align: 'right' });
      y += 5;
      
      // Clearly separate Grand Total from other previous amounts with a line and spacing
      doc.line(10, y, pageWidth - 10, y);
      y += 6;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text('GRAND TOTAL:', 10, y);
      doc.text(formatCurrency(total, currency), pageWidth - 10, y, { align: 'right' });
      y += 8;

      if (lastTendered !== null) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text('CASH TENDERED:', 10, y);
        doc.text(formatCurrency(lastTendered, currency), pageWidth - 10, y, { align: 'right' });
        y += 4;
        doc.text('CHANGE:', 10, y);
        doc.text(formatCurrency(lastChange ?? 0, currency), pageWidth - 10, y, { align: 'right' });
        y += 6;
      } else {
        y += 10;
      }
    }

    // Barcode Generation using jsbarcode
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, transactionId, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: false
      });
      const imgData = canvas.toDataURL('image/png');
      doc.addImage(imgData, 'PNG', (pageWidth - 50) / 2, y, 50, 15);
      y += 18;
    } catch (e) {
      console.error('Barcode generation failed', e);
      // Fallback to text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.text(`*${transactionId.replace(/-/g, '')}*`, pageWidth / 2, y, { align: 'center', charSpace: 2 });
      y += 5;
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(transactionId, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(7);
    doc.setFont("helvetica", "");
    doc.text(storeInfo.receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE', pageWidth / 2, y, { align: 'center' });
    
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text('POWERED BY MEGAPOS', pageWidth / 2, y, { align: 'center' });
    
    doc.autoPrint();
    const pdfBlob = doc.output('bloburl');
    window.open(pdfBlob, '_blank');
  };

  const handleCompleteSale = async (method: PaymentMethod, manualTenderedAmount?: number) => {
    if (!user) return;
    setIsSubmitting(true);
    
    const transactionId = `TX-${Date.now()}`;
    const txPath = `transactions/${transactionId}`;

    try {
      // 1. Create Transaction
      const sanitizedItems = cart.map(item => {
        const cleaned: any = {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          category: item.category || 'General',
          stockLevel: item.stockLevel ?? 0,
        };
        if (item.costPrice !== undefined) cleaned.costPrice = item.costPrice;
        if (item.imageUrl !== undefined) cleaned.imageUrl = item.imageUrl;
        if (item.description !== undefined) cleaned.description = item.description;
        if (item.barcode !== undefined) cleaned.barcode = item.barcode;
        if (item.markupPrice !== undefined) cleaned.markupPrice = item.markupPrice;
        if (item.discountPrice !== undefined) cleaned.discountPrice = item.discountPrice;
        if (item.color !== undefined) cleaned.color = item.color;
        if (item.size !== undefined) cleaned.size = item.size;
        if (item.weight !== undefined) cleaned.weight = item.weight;
        if (item.palletSize !== undefined) cleaned.palletSize = item.palletSize;
        if (item.sku !== undefined) cleaned.sku = item.sku;
        if (item.priceOverride !== undefined) cleaned.priceOverride = item.priceOverride;
        if (item.originalPrice !== undefined) cleaned.originalPrice = item.originalPrice;
        if (item.discount !== undefined) cleaned.discount = item.discount;
        return cleaned;
      });

      const changeVal = (method === PaymentMethod.CASH && manualTenderedAmount) 
        ? Math.max(0, manualTenderedAmount - total) 
        : 0;

      if (method === PaymentMethod.CASH && manualTenderedAmount) {
        setLastTendered(manualTenderedAmount);
        setLastChange(changeVal);
      } else {
        setLastTendered(null);
        setLastChange(null);
      }

      const transactionPayload: any = {
        id: transactionId,
        items: sanitizedItems,
        subtotal: effectiveSubtotal,
        markupAmount: markupAmount,
        discountAmount: totalDiscount,
        totalAmount: total,
        tax: tax,
        paymentMethod: chargeToCustomerCredit ? 'Customer Credit' : method,
        status: TransactionStatus.COMPLETED,
        timestamp: serverTimestamp(),
        cashierId: user.uid,
        tenderedAmount: method === PaymentMethod.CASH && manualTenderedAmount ? manualTenderedAmount : null,
        changeAmount: method === PaymentMethod.CASH && manualTenderedAmount ? changeVal : null,
      };

      if (selectedCustomer) {
        transactionPayload.customerId = selectedCustomer.id;
        transactionPayload.customerName = selectedCustomer.name;
        transactionPayload.customerCode = selectedCustomer.customerId || null;
        transactionPayload.chargedToCredit = chargeToCustomerCredit;
      }

      await setDoc(doc(db, 'transactions', transactionId), transactionPayload);

      // Update customer limit / spent in Firestore
      if (selectedCustomer) {
        const custRef = doc(db, 'customers', selectedCustomer.id);
        const updates: any = {
          totalSpent: increment(total)
        };
        if (chargeToCustomerCredit) {
          updates.accountBalance = increment(-total);
          
          // Log adjustment in 'balances' collection
          const adjId = `adj-cust-charge-${Date.now()}`;
          await setDoc(doc(db, 'balances', adjId), {
            id: adjId,
            amount: total,
            type: 'customer_charge',
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name,
            description: `Charged ${formatCurrency(total, currency)} for transaction ${transactionId}`,
            date: new Date().toISOString()
          });
        }
        await updateDoc(custRef, updates);
      }

      // 2. Update Stock Levels
      for (const item of cart) {
        const prodRef = doc(db, 'products', item.id);
        await updateDoc(prodRef, {
          stockLevel: increment(-item.quantity)
        });
      }

      setLastTransactionId(transactionId);
      setShowSuccess(true);
      if (autoPrint) {
        try {
          generateReceipt(transactionId, 'sale');
        } catch (e) {
          console.error("Error printing receipt:", e);
        }
      }
      
      setCart([]);
      setSelectedCustomer(null);
      setChargeToCustomerCredit(false);
      setIsCheckoutOpen(false);
    } catch (error) {
      setStatus({ message: "Failed to complete transaction.", type: 'error' });
      try {
        handleFirestoreError(error, OperationType.WRITE, txPath, auth);
      } catch (e) {
        console.error("Firestore error completing sale:", e);
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const handleCompleteSplitPayment = async (splitTenders: { method: PaymentMethod; amount: number; reference?: string }[]) => {
    if (!user || cart.length === 0) return;
    setIsSubmitting(true);
    const transactionId = `TX-${Date.now()}`;
    const txPath = `transactions/${transactionId}`;

    try {
      const sanitizedItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category || 'General',
        stockLevel: item.stockLevel ?? 0,
        costPrice: item.costPrice ?? 0,
        barcode: item.barcode || '',
        sku: item.sku || '',
        priceOverride: item.priceOverride,
        discount: item.discount
      }));

      const transactionPayload: any = {
        id: transactionId,
        items: sanitizedItems,
        subtotal: effectiveSubtotal,
        markupAmount: markupAmount,
        discountAmount: totalDiscount,
        totalAmount: total,
        tax: tax,
        paymentMethod: 'Split Tender',
        splitTenders: splitTenders,
        status: TransactionStatus.COMPLETED,
        timestamp: serverTimestamp(),
        cashierId: user.uid,
        cashierName: user.displayName || 'Terminal Staff'
      };

      if (selectedCustomer) {
        transactionPayload.customerId = selectedCustomer.id;
        transactionPayload.customerName = selectedCustomer.name;
        transactionPayload.customerCode = selectedCustomer.customerId || null;
      }

      await setDoc(doc(db, 'transactions', transactionId), transactionPayload);

      const txObj: Transaction = {
        id: transactionId,
        items: sanitizedItems as any,
        subtotal: effectiveSubtotal,
        tax: tax,
        discount: totalDiscount,
        totalAmount: total,
        paymentMethod: PaymentMethod.SPLIT,
        status: TransactionStatus.COMPLETED,
        timestamp: new Date().toISOString(),
        cashierId: user.uid,
        cashierName: user.displayName || 'Terminal Staff',
        splitTenders: splitTenders
      };

      // Check cash split payments to log cash drawer movement
      if (currentShift && recordTransactionSale) {
        try {
          recordTransactionSale(txObj);
        } catch (e) {
          console.warn("Could not log to shift ledger:", e);
        }
      }
      setCompletedTransactionForReceipt(txObj);
      setIsThermalReceiptModalOpen(true);

      setCart([]);
      setSelectedCustomer(null);
      setIsSplitPaymentModalOpen(false);
      setIsCheckoutOpen(false);
      setStatus({ message: `Split payment completed for ${formatCurrency(total, currency)}!`, type: 'success' });
    } catch (error) {
      console.error("Error finalizing split tender sale:", error);
      setStatus({ message: "Failed to complete split tender transaction.", type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestPresale = async () => {
    if (!user || cart.length === 0) return;
    setIsSubmitting(true);
    
    const presaleId = `PS-${Date.now().toString().slice(-6)}`;
    const psPath = `presales/${presaleId}`;

    try {
      // Save to presales collection with timeout protection
      const writePromise = setDoc(doc(db, 'presales', presaleId), {
        id: presaleId,
        operator: user.displayName || 'Terminal Staff',
        amount: total,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          barcode: item.barcode || '',
          sku: item.sku || '',
          costPrice: item.costPrice ?? 0,
          category: item.category || 'General',
        })),
        status: 'Pending',
        timestamp: serverTimestamp(),
        userId: user.uid
      });

      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000));
      await Promise.race([writePromise, timeoutPromise]);

      setLastTransactionId(presaleId);
      setShowSuccess(true);
      if (autoPrint) {
        try {
          generateReceipt(presaleId, 'presale');
        } catch (e) {
          console.error("Error printing presale receipt:", e);
        }
      }
      
      setCart([]);
      setIsCheckoutOpen(false);
      setStatus({ message: `Presale ${presaleId} created successfully!`, type: 'success' });
    } catch (error) {
      console.error("Error creating presale:", error);
      setStatus({ message: "Failed to create presale.", type: 'error' });
      try {
        handleFirestoreError(error, OperationType.WRITE, psPath, auth);
      } catch (e) {
        console.error("Firestore error creating presale:", e);
      }
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn(
        "h-full flex items-center justify-center transition-colors duration-500",
        theme === 'dark' ? "bg-dark-bg" : "bg-light-bg"
      )}>
        <div className="p-20 flex justify-center">
          <RefreshCw className="animate-spin text-brand-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn(
        "h-full flex flex-col items-center justify-center p-6 text-center transition-colors duration-500",
        theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text"
      )}>
        <div className={cn(
          "w-20 h-20 border rounded-lg flex items-center justify-center mb-6 shadow-2xl transition-colors",
          theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
        )}>
          <ShoppingCart size={40} className="text-[#888]" />
        </div>
        <h1 className="text-2xl font-bold uppercase tracking-[0.2em] mb-2">megapos</h1>
        <p className={cn(
          "max-w-sm mb-8 text-sm",
          theme === 'dark' ? "text-[#B0B0B0]" : "text-[#666]"
        )}>Please sign in to access the point of sale system and sync your inventory across terminals.</p>
        {/* BLOCK: Guest Authentication Options - Offers terminal entry methods via Email or Google Auth */}
        <div className="guest-auth-card__options flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center">
          <button 
            type="button"
            onClick={handleLogin}
            className={cn(
              "guest-auth-card__btn guest-auth-card__btn--email flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-md active:scale-95 cursor-pointer",
              theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110" : "bg-black text-white hover:bg-neutral-800"
            )}
          >
            <Mail size={16} />
            Email Sign In / Sign Up
          </button>

          <button 
            type="button"
            onClick={handleLogin}
            className={cn(
              "guest-auth-card__btn guest-auth-card__btn--google flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-md border-2 active:scale-95 cursor-pointer",
              theme === 'dark' ? "bg-transparent border-slate-700 hover:bg-slate-800/40 text-white" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-900"
            )}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.3 1.55-1.18 2.87-2.5 3.75v3.1h4.03c2.36-2.17 3.6-5.37 3.6-8.7z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.03-3.1c-1.12.75-2.56 1.2-3.9 1.2-3.03 0-5.6-2.05-6.51-4.8H1.31v3.2C3.29 22.35 7.4 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.49 14.39A7.14 7.14 0 0 1 5.09 12c0-.82.14-1.63.4-2.39V6.41H1.31C.47 8.09 0 9.99 0 12s.47 3.91 1.31 5.59l4.18-3.2z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.4 0 3.29 1.65 1.31 4.75l4.18 3.2C6.4 5.15 8.97 3.1 12 3.1z"
              />
            </svg>
            Google SSO
          </button>
        </div>
        {loginError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left max-w-sm mt-6 animate-in fade-in slide-in-from-bottom duration-300">
            <p className="font-black uppercase tracking-wider mb-1 text-red-500 flex items-center gap-1.5 text-[10px]">
              ⚠️ Authentication Alert
            </p>
            <p className="leading-relaxed font-semibold text-[11px]">{loginError}</p>
          </div>
        )}
        {window.self !== window.top && !loginError && (
          <p className={cn(
            "text-[9px] font-mono uppercase tracking-[0.15em] opacity-40 max-w-xs mt-4",
            theme === 'dark' ? "text-dark-text" : "text-light-text"
          )}>
            ℹ️ Sandbox: If the login popup is blocked, please click <b>"Open in new tab"</b> at the top-right.
          </p>
        )}

        <AnimatePresence>
          {isLoginDialogOpen && (
            <TerminalLoginDialog
              isOpen={isLoginDialogOpen}
              onClose={() => setIsLoginDialogOpen(false)}
              theme={theme}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  const renderProductMatrix = (isModal = false, forceCards = false) => {
    const effectiveLayout = (forceCards || desktopLayout === 'split') ? 'grid' : currentProductLayout;

    return (
    <div className={cn(
      "flex-1 flex flex-col min-h-0",
      !isModal && "h-full"
    )}>
      {/* Search & Filter Header (Only if not in modal, as modal has its own) */}
      {!isModal && (
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full">
            <div className="relative flex-1">
              <Search className={cn("absolute left-3.5 top-1/2 -translate-y-1/2", theme === 'dark' ? "text-slate-500" : "text-slate-400")} size={16} />
              <input 
                type="text" 
                placeholder="IDENTIFY ASSET SIGNATURE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const query = searchQuery.trim().toLowerCase();
                    if (query) {
                      let targetVarId: string | undefined;
                      const match = products.find(p => {
                        if (p.barcode && p.barcode.toLowerCase() === query) return true;
                        if (p.sku && p.sku.toLowerCase() === query) return true;
                        if (p.variations) {
                          const vMatch = p.variations.find(v => 
                            (v.barcode && v.barcode.toLowerCase() === query) ||
                            (v.sku && v.sku.toLowerCase() === query)
                          );
                          if (vMatch) {
                            targetVarId = vMatch.id;
                            return true;
                          }
                        }
                        return false;
                      });
                      if (match) {
                        if (match.variations && match.variations.length > 0) {
                          openProductDetail(match, targetVarId);
                        } else {
                          addToCartValue(match);
                        }
                        setSearchQuery('');
                        e.preventDefault();
                      }
                    }
                  }
                }}
                className={cn(
                  "w-full border-2 pl-10 pr-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide outline-none transition-all h-[38px]",
                  theme === 'dark'
                    ? "bg-dark-bg/50 border-dark-border focus:border-brand-primary text-white placeholder-slate-500"
                    : "bg-white border-light-border focus:border-black text-[#0F172A] placeholder-slate-400"
                )}
              />
            </div>

            {/* BLOCK: POS Quick Action Controls - Camera scanner, Customer lookup, and filter triggers */}
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => setIsScannerModalOpen(true)} 
                title="Scan barcode with camera (F2)"
                className={cn(
                  "px-3.5 py-2 border-2 rounded-lg transition-all shrink-0 cursor-pointer no-gradient flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider h-[38px]",
                  theme === 'dark' 
                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20" 
                    : "bg-blue-50 border-blue-200 text-[#062A95] hover:bg-blue-100"
                )}
              >
                <Camera size={14} className="shrink-0" />
                <span className="leading-none hidden sm:inline">Scan (F2)</span>
              </button>

              <button 
                type="button"
                onClick={() => setIsCustomerSearchModalOpen(true)} 
                title="Lookup & select customer (F3)"
                className={cn(
                  "px-3.5 py-2 border-2 rounded-lg transition-all shrink-0 cursor-pointer no-gradient flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider h-[38px]",
                  selectedCustomer
                    ? (theme === 'dark' ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-emerald-50 border-emerald-300 text-emerald-700")
                    : (theme === 'dark' ? "bg-black/20 border-dark-border text-dark-muted hover:bg-white/5" : "bg-white text-light-text border-light-border hover:bg-gray-50")
                )}
              >
                <UserCheck size={14} className="shrink-0" />
                <span className="leading-none hidden sm:inline">
                  {selectedCustomer ? selectedCustomer.name.slice(0, 10) : "Client (F3)"}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                className={cn(
                  "px-4 py-2 border-2 rounded-lg transition-all shrink-0 cursor-pointer no-gradient flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider h-[38px]",
                  isFilterOpen 
                    ? (theme === 'dark' ? "bg-brand-primary text-black border-brand-primary" : "bg-black text-white border-black")
                    : (theme === 'dark' ? "bg-black/20 border-dark-border text-dark-muted hover:bg-white/5" : "bg-white text-light-text border-light-border hover:bg-gray-50")
                )}
              >
                <Filter size={14} className="shrink-0" />
                <span className="leading-none">Filters</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className={cn(
                  "p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1",
                  theme === 'dark' ? "bg-black/30 border-dark-border" : "bg-gray-50 border-light-border shadow-inner"
                )}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                      Filter by Category
                    </label>
                    <select 
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                        theme === 'dark' 
                          ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                          : "bg-white border-light-border text-black focus:border-black"
                      )}
                    >
                      <option value="all">ALL ASSETS / CATEGORIES</option>
                      {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                      Stock Filter
                    </label>
                    <select 
                      value={stockFilter}
                      onChange={(e) => setStockFilter(e.target.value as any)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                        theme === 'dark' 
                          ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                          : "bg-white border-light-border text-black focus:border-black"
                      )}
                    >
                      <option value="all">ALL STOCK LEVELS</option>
                      <option value="critical">CRITICAL (OUT OF STOCK)</option>
                      <option value="low-stock">LOW STOCK INDICATOR</option>
                      <option value="healthy">HEALTHY STOCK SURPLUS</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Product Grid */}
      <div className={cn(
        "flex-1",
        !isModal && "pr-2"
      )}>
        <AnimatePresence mode="popLayout">
          {productsLoading && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-dark-muted py-20 min-h-[300px]">
              <RefreshCw size={36} className="animate-spin text-brand-primary mb-4" />
              <p className="text-xs font-black uppercase tracking-widest opacity-60">Loading Product Library...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            effectiveLayout === 'grid' ? (
              <div className="grid grid-cols-1 p-1">
                {/* BLOCK: Empty Product Cards View - Framed card container displaying asset icon and status text */}
                <div className={cn(
                  "empty-catalog-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                  theme === 'dark' ? "bg-dark-surface border-white/30 text-white" : "bg-white border-slate-300 text-black"
                )}>
                  <Package size={54} strokeWidth={1.5} className={cn("empty-catalog-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                  <p className={cn("empty-catalog-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Assets Identified</p>
                  <p className={cn("empty-catalog-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>No products available in this view</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:hidden p-1">
                  {/* BLOCK: Empty Product Cards View - Framed card container displaying asset icon and status text */}
                  <div className={cn(
                    "empty-catalog-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                    theme === 'dark' ? "bg-dark-surface border-white/30 text-white" : "bg-white border-slate-300 text-black"
                  )}>
                    <Package size={54} strokeWidth={1.5} className={cn("empty-catalog-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                    <p className={cn("empty-catalog-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Assets Identified</p>
                    <p className={cn("empty-catalog-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>No products available in this view</p>
                  </div>
                </div>
                <div className={cn(
                  "hidden lg:block rounded-2xl border shadow-soft overflow-hidden transition-all duration-300",
                  theme === "dark"
                    ? "bg-dark-surface border-white/35"
                    : "bg-white border-slate-400",
                )}>
                  {/* BLOCK: Empty Product Table View - Displays complete table header with centered empty state row */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#111c30] border-white/35"
                            : "bg-slate-100 border-slate-400",
                        )}>
                          <th className={cn("pl-4 lg:pl-6 pr-2 lg:pr-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[60px] lg:w-[75px]", theme === 'dark' ? "text-white" : "text-black/80")}>Line</th>
                          {effectiveLayout !== 'list-text' && <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap text-center w-[65px] lg:w-[80px]", theme === 'dark' ? "text-white" : "text-black/80")}>Pic</th>}
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[100px] lg:w-[130px]", theme === 'dark' ? "text-white" : "text-black/80")}>Barcode</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap min-w-[140px] lg:min-w-[200px]", theme === 'dark' ? "text-white" : "text-black/80")}>Product Name</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[80px] lg:w-[100px]", theme === 'dark' ? "text-white" : "text-black/80")}>Stock</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap text-left w-[90px] lg:w-[120px]", theme === 'dark' ? "text-white" : "text-black/80")}>Cost</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap text-left w-[90px] lg:w-[120px]", theme === 'dark' ? "text-white" : "text-black/80")}>Price</th>
                          <th className={cn("pl-2 lg:pl-3 pr-4 lg:pr-6 py-3 lg:py-3.5 text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap text-center w-[70px] lg:w-[85px]", theme === 'dark' ? "text-white" : "text-black/80")}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="empty-catalog-table__row border-0">
                          <td colSpan={effectiveLayout !== 'list-text' ? 8 : 7} className="empty-catalog-table__cell py-16 text-center">
                            <div className="empty-catalog-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("empty-catalog-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("empty-catalog-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Assets Identified</p>
                              <p className={cn("empty-catalog-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>No products available in this view</p>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )
          ) : (
            <motion.div 
              key="product-grid-container" 
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* BLOCK: Mobile Product Cards View - Compact cards layout with optimized padding and image size */}
              <div className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-3 p-1",
                effectiveLayout === 'grid' ? "md:hidden" : "lg:hidden"
              )}>
                {paginatedProducts.map((product, index) => {
                  const threshold = lowStockEnabled ? lowStockThreshold : 10;
                  const isLowStock = product.stockLevel < threshold;
                  const isOutOfStock = product.stockLevel <= 0;

                  return (
                    <div 
                      key={product.id} 
                      onClick={() => {
                        if (!isOutOfStock) {
                          openProductDetail(product);
                        }
                      }}
                      className={cn(
                        "product-card product-card--mobile p-2.5 sm:p-3 rounded-xl border flex items-center justify-between group transition-all duration-300 hover:shadow-md cursor-pointer relative overflow-hidden",
                        theme === 'dark' ? "bg-dark-surface border-white/25 hover:border-brand-primary" : "bg-white border-slate-300 hover:border-black",
                        isOutOfStock && "opacity-40 grayscale cursor-not-allowed"
                      )}
                    >
                      <AnimatePresence>
                        {lastAddedId === product.id && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-10 flex items-center justify-center bg-green-500/10 pointer-events-none backdrop-blur-sm"
                          >
                             <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg animate-scale-in">
                               <Plus size={10} /> Added
                             </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="product-card__content flex flex-col gap-2 min-w-0 flex-1">
                        {/* Top Row: Image on left, two-line product name on right */}
                        <div className="product-card__top flex items-start gap-2.5 sm:gap-3 min-w-0">
                          <div className={cn(
                            "product-card__image-wrapper w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center overflow-hidden border shrink-0 transition-all duration-300 group-hover:scale-105 mt-0.5",
                            theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-300 shadow-inner"
                          )}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt="" className="product-card__image w-full h-full object-cover animate-in fade-in duration-300" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={20} className="text-[#888] dark:text-[#555] group-hover:text-brand-primary transition-colors duration-200" />
                            )}
                          </div>
                          <div className="product-card__info min-w-0 flex-1">
                            <h4 className={cn(
                              "product-card__title text-xs sm:text-sm font-black uppercase tracking-wider title-text leading-snug line-clamp-2 transition-colors duration-200",
                              theme === 'dark' ? "text-white group-hover:text-brand-primary" : "text-black group-hover:text-brand-primary"
                            )}>{product.name}</h4>
                          </div>
                        </div>

                        {/* Underneath Rows: Barcode on line 1, then Qty & Price on line 2 under barcode */}
                        <div className="product-card__meta flex flex-col gap-1 min-w-0 pt-1.5 border-t border-dashed border-slate-300 dark:border-white/10">
                          <p className={cn(
                            "product-card__barcode text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-tight truncate min-w-0",
                            theme === 'dark' ? "text-white/60" : "text-black/60"
                          )}>
                            BARCODE: {product.barcode || product.sku || product.id.slice(-6).toUpperCase()}
                          </p>
                          <div className="product-card__stats flex items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px]">
                            <div className="flex items-center gap-1">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
                                isOutOfStock ? "bg-neutral-500" : isLowStock ? "bg-red-500" : "bg-emerald-500"
                              )} />
                              <span className={cn(
                                "product-card__qty font-semibold uppercase tracking-wider",
                                isOutOfStock ? "text-neutral-500" : isLowStock ? "text-red-500" : (theme === 'dark' ? "text-white opacity-90" : "text-black opacity-90")
                              )}>
                                QTY: <span className="font-black">{product.stockLevel}</span>
                              </span>
                            </div>
                            <span className={cn(
                              "product-card__price font-bold tracking-wider",
                              theme === 'dark' ? "text-brand-primary" : "text-black"
                            )}>
                              {formatCurrency(product.price, currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Table or Card based on layout option */}
              {effectiveLayout === 'grid' ? (
                /* BLOCK: Desktop Product Cards View - Grid of compact cards with clear thumbnail and readable product metrics */
                <div className={cn(
                  "hidden md:grid gap-3 p-1",
                  isModal 
                    ? "grid-cols-2 lg:grid-cols-3"
                    : desktopLayout === 'split'
                      ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-2"
                      : "grid-cols-1 xl:grid-cols-2"
                )}>
                  {paginatedProducts.map((product, index) => {
                    const threshold = lowStockEnabled ? lowStockThreshold : 10;
                    const isLowStock = product.stockLevel < threshold;
                    const isOutOfStock = product.stockLevel <= 0;

                    return (
                      <div 
                        key={product.id} 
                        onClick={() => {
                          if (!isOutOfStock) {
                            openProductDetail(product);
                          }
                        }}
                        className={cn(
                          "product-card product-card--desktop p-2.5 sm:p-3 rounded-xl border flex items-center justify-between group transition-all duration-300 hover:shadow-md cursor-pointer relative overflow-hidden",
                          theme === 'dark' ? "bg-dark-surface border-white/25 hover:border-brand-primary" : "bg-white border-slate-300 hover:border-black",
                          isOutOfStock && "opacity-40 grayscale cursor-not-allowed"
                        )}
                      >
                        <AnimatePresence>
                          {lastAddedId === product.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 z-10 flex items-center justify-center bg-green-500/10 pointer-events-none backdrop-blur-sm"
                            >
                               <div className="bg-green-500 text-white px-3 py-1.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg animate-scale-in">
                                 <Plus size={10} /> Added
                               </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="product-card__content flex flex-col gap-2 min-w-0 flex-1">
                          {/* Top Row: Image on left, two-line product name on right */}
                          <div className="product-card__top flex items-start gap-2.5 sm:gap-3 min-w-0">
                            <div className={cn(
                              "product-card__image-wrapper w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center overflow-hidden border shrink-0 transition-all duration-300 group-hover:scale-105 mt-0.5",
                              theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-300 shadow-inner"
                            )}>
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt="" className="product-card__image w-full h-full object-cover animate-in fade-in duration-300" referrerPolicy="no-referrer" />
                              ) : (
                                <Package size={20} className="text-[#888] dark:text-[#555] group-hover:text-brand-primary transition-colors duration-200" />
                              )}
                            </div>
                            <div className="product-card__info min-w-0 flex-1">
                              <h4 className={cn(
                                "product-card__title text-xs sm:text-sm font-black uppercase tracking-wider title-text leading-snug line-clamp-2 transition-colors duration-200",
                                theme === 'dark' ? "text-white group-hover:text-brand-primary" : "text-black group-hover:text-brand-primary"
                              )}>{product.name}</h4>
                            </div>
                          </div>

                          {/* Underneath Rows: Barcode on line 1, then Qty & Price on line 2 under barcode */}
                          <div className="product-card__meta flex flex-col gap-1 min-w-0 pt-1.5 border-t border-dashed border-slate-300 dark:border-white/10">
                            <p className={cn(
                              "product-card__barcode text-[10px] sm:text-[11px] font-mono font-medium uppercase tracking-tight truncate min-w-0",
                              theme === 'dark' ? "text-white/60" : "text-black/60"
                            )}>
                              BARCODE: {product.barcode || product.sku || product.id.slice(-6).toUpperCase()}
                            </p>
                            <div className="product-card__stats flex items-center justify-between gap-2 font-mono text-[10px] sm:text-[11px]">
                              <div className="flex items-center gap-1">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
                                  isOutOfStock ? "bg-neutral-500" : isLowStock ? "bg-red-500" : "bg-emerald-500"
                                )} />
                                <span className={cn(
                                  "product-card__qty font-semibold uppercase tracking-wider",
                                  isOutOfStock ? "text-neutral-500" : isLowStock ? "text-red-500" : (theme === 'dark' ? "text-white opacity-90" : "text-black opacity-90")
                                )}>
                                  QTY: <span className="font-black">{product.stockLevel}</span>
                                </span>
                              </div>
                              <span className={cn(
                                "product-card__price font-bold tracking-wider",
                                theme === 'dark' ? "text-brand-primary" : "text-black"
                              )}>
                                {formatCurrency(product.price, currency)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Desktop List / Table View with Beautiful Premium Table Design */
                <div className={cn(
                  "hidden lg:block rounded-2xl border shadow-soft overflow-hidden transition-all duration-300",
                  theme === "dark"
                    ? "bg-dark-surface border-white/35"
                    : "bg-white border-slate-400",
                )}>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#111c30] border-white/35"
                            : "bg-slate-100 border-slate-400",
                        )}>
                          <th className={cn("pl-4 lg:pl-6 pr-2 lg:pr-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap w-[60px] lg:w-[75px]", theme === 'dark' ? "text-white" : "text-black/80")}>Line</th>
                          {currentProductLayout !== 'list-text' && <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap text-center w-[65px] lg:w-[80px]", theme === 'dark' ? "text-white" : "text-black/80")}>Pic</th>}
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap w-[100px] lg:w-[130px]", theme === 'dark' ? "text-white" : "text-black/80")}>Barcode</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap min-w-[140px] lg:min-w-[200px]", theme === 'dark' ? "text-white" : "text-black/80")}>Product Name</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap w-[80px] lg:w-[100px]", theme === 'dark' ? "text-white" : "text-black/80")}>Stock</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap text-left w-[90px] lg:w-[120px]", theme === 'dark' ? "text-white" : "text-black/80")}>Cost</th>
                          <th className={cn("px-2 lg:px-3 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap text-left w-[90px] lg:w-[120px]", theme === 'dark' ? "text-white" : "text-black/80")}>Price</th>
                          <th className={cn("pl-2 lg:pl-3 pr-4 lg:pr-6 py-3 lg:py-3.5 text-[10px] lg:text-xs font-black uppercase tracking-wider whitespace-nowrap text-center w-[70px] lg:w-[85px]", theme === 'dark' ? "text-white" : "text-black/80")}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProducts.map((product, index) => {
                          const threshold = lowStockEnabled ? lowStockThreshold : 10;
                          const isLowStock = product.stockLevel < threshold;
                          const isOutOfStock = product.stockLevel <= 0;
                          const costPrice = product.costPrice || (product.price * 0.7);

                          return (
                            <tr 
                              key={product.id}
                              onClick={() => {
                                if (!isOutOfStock) {
                                  openProductDetail(product);
                                }
                              }}
                              className={cn(
                                "border-b last:border-0 transition-colors duration-200 group cursor-pointer relative",
                                theme === "dark"
                                  ? "border-white/25 hover:bg-brand-primary/5 text-white"
                                  : "border-slate-400 hover:bg-black/[0.025]",
                                isOutOfStock && "opacity-40 grayscale cursor-not-allowed"
                              )}
                            >
                              {/* Line Number */}
                              <td className={cn(
                                "pl-4 lg:pl-6 pr-2 lg:pr-3 py-2.5 lg:py-3 font-mono text-xs font-medium relative",
                                theme === 'dark' ? "text-white" : "text-black opacity-80"
                              )}>
                                <AnimatePresence>
                                  {lastAddedId === product.id && (
                                    <motion.div 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0 }}
                                      className="absolute inset-y-0 left-0 w-1 bg-green-500"
                                    />
                                  )}
                                </AnimatePresence>
                                {((currentPage - 1) * itemsPerPage + index + 1).toString().padStart(2, '0')}
                              </td>

                              {/* Pic column */}
                              {currentProductLayout !== 'list-text' && (
                                <td className="px-2 lg:px-3 py-2 text-center">
                                  <div className="flex justify-center">
                                    <div className={cn(
                                      "rounded-lg overflow-hidden border shrink-0 w-9 h-9 flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm",
                                      theme === 'dark' ? "bg-black border-white/25" : "bg-light-bg border-slate-400 shadow-inner"
                                    )}>
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover animate-in fade-in duration-300" referrerPolicy="no-referrer" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 dark:from-[#0d0d0d] dark:to-[#1a1a1a] text-dark-muted">
                                          <Package size={16} className="text-[#888] dark:text-[#555] group-hover:text-brand-primary transition-colors duration-200" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              )}

                              {/* Barcode / Code */}
                              <td className={cn(
                                "px-2 lg:px-3 py-2.5 lg:py-3 font-mono text-xs font-semibold",
                                theme === 'dark' ? "text-white" : "text-black/90"
                              )}>
                                {product.barcode || product.sku || product.id.slice(-6).toUpperCase()}
                              </td>

                              {/* Product Name */}
                              <td className="px-2 lg:px-3 py-2.5 lg:py-3">
                                <div className="min-w-0 flex items-center gap-2">
                                  <h4 className={cn(
                                    "font-black uppercase tracking-widest text-xs truncate group-hover:text-brand-primary transition-colors duration-200 line-clamp-1 flex-1 min-w-0 max-w-[140px] lg:max-w-[200px] xl:max-w-[280px]",
                                    theme === 'dark' ? "text-white" : "text-black"
                                  )}>{limitLetters(product.name, 60)}</h4>
                                  {isOutOfStock && (
                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0">Out</span>
                                  )}
                                </div>
                              </td>

                              {/* Stock */}
                              <td className="px-2 lg:px-3 py-2.5 lg:py-3">
                                <div className="flex justify-start items-center gap-2">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0 group-hover:scale-125 transition-all duration-200 animate-pulse",
                                    isOutOfStock ? "bg-neutral-500" : isLowStock ? "bg-red-500" : "bg-emerald-500"
                                  )} />
                                  <span className={cn(
                                    "font-mono text-xs font-semibold uppercase tracking-wider",
                                    isOutOfStock ? "text-neutral-500" : isLowStock ? "text-red-500" : (theme === 'dark' ? "text-white opacity-80" : "text-black opacity-80")
                                  )}>
                                    {product.stockLevel}
                                  </span>
                                </div>
                              </td>

                              {/* Cost */}
                              <td className={cn(
                                "px-2 lg:px-3 py-2.5 lg:py-3 text-left font-mono text-xs font-semibold",
                                theme === 'dark' ? "text-white" : "text-black/90"
                              )}>
                                {(role === 'Manager' || auth.currentUser?.email === 'admin@megapos.pos') ? formatCurrency(costPrice, currency) : '—'}
                              </td>

                              {/* Price */}
                              <td className={cn(
                                "px-2 lg:px-3 py-2.5 lg:py-3 text-left font-mono text-xs font-bold",
                                theme === 'dark' ? "text-brand-primary" : "text-black"
                              )}>
                                {formatCurrency(product.price, currency)}
                              </td>

                              {/* Action button */}
                              <td className="pl-2 lg:pl-3 pr-4 lg:pr-6 py-2.5 lg:py-3 text-center">
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isOutOfStock) {
                                        openProductDetail(product);
                                      }
                                    }}
                                    className={cn(
                                      "w-8 h-8 rounded-xl border flex items-center justify-center shadow-inner transition-all duration-200 hover:scale-105 hover:shadow-md shrink-0",
                                      theme === 'dark' 
                                        ? "bg-black/40 border-white/20 text-brand-primary hover:bg-brand-primary/10" 
                                        : "bg-white border-slate-300 text-brand-primary hover:bg-black/[0.02]"
                                    )}
                                    title="View / Add"
                                  >
                                    <Plus size={14} className="text-brand-primary" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 pb-2 px-2 border-t border-dashed border-[#888]/20 mt-6">
            <div className="text-[10px] font-mono font-bold text-[#888] uppercase tracking-wider">
              Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} Products
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "p-2 rounded-xl border-2 transition-all flex items-center justify-center font-black",
                  currentPage === 1
                    ? "opacity-30 cursor-not-allowed border-transparent bg-gray-500/5"
                    : (theme === 'dark' ? "border-dark-border bg-black hover:border-brand-primary text-white cursor-pointer" : "border-light-border bg-white hover:border-black text-black cursor-pointer shadow-sm")
                )}
              >
                <ChevronLeft size={14} />
              </button>
              
              <div className="flex items-center gap-1 px-2 font-mono text-xs font-black">
                <span className="text-brand-primary">{currentPage}</span>
                <span className="opacity-40">/</span>
                <span className="opacity-70">{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "p-2 rounded-xl border-2 transition-all flex items-center justify-center font-black",
                  currentPage === totalPages
                    ? "opacity-30 cursor-not-allowed border-transparent bg-gray-500/5"
                    : (theme === 'dark' ? "border-dark-border bg-black hover:border-brand-primary text-white cursor-pointer" : "border-light-border bg-white hover:border-black text-black cursor-pointer shadow-sm")
                )}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

  return (
    <div className={cn(
      "register-page font-presale min-h-full flex flex-col md:flex-row relative transition-colors duration-500",
      theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text"
    )}>
      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProductForCart && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="register-product-detail-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            />
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "popup-card register-product-detail-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 flex flex-col shadow-2xl border-2 rounded-2xl overflow-hidden transition-all",
                theme === 'dark' 
                  ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" 
                  : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse" />

              {/* Header */}
              <div className={cn(
                "p-4 border-b shrink-0 relative z-10",
                theme === "dark" ? "bg-transparent border-b border-white/10 text-white" : "bg-transparent border-b border-black/10 text-black",
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  {/* Left Column: Icon Container */}
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === "dark" ? "bg-black/40 border-white/40 text-brand-primary" : "bg-white border-light-border text-brand-primary",
                    )}>
                      <ShoppingBag size={16} />
                    </div>
                  </div>

                  {/* Center Column: Title & Subtitle */}
                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === "dark" ? "text-cyan-400" : "text-[#062A95]",
                    )}>
                      {editingCartItem ? "Modify Cart Item" : "Asset Detail"}
                    </h3>
                    <span className={cn(
                      "text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1",
                      theme === "dark" ? "text-white" : ""
                    )}>
                      {editingCartItem ? `#Qty` : `#Config`}
                    </span>
                  </div>

                  {/* Right Column: Close Button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCloseAssetDetail}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === "dark" ? "bg-black/40 border-white/40 text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50",
                      )}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Contents (Body) */}
              <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 space-y-6">
                
                {/* Top layout with image and basic info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Product Image */}
                  <div className="flex justify-center md:col-span-1">
                    <div className="relative">
                      <div className={cn(
                        "w-full aspect-square max-w-[150px] rounded-2xl overflow-hidden border-2 flex items-center justify-center shadow-md",
                        theme === "dark" ? "bg-black/40 border-white/40" : "bg-gray-50 border-light-border"
                      )}>
                        {selectedProductForCart.imageUrl ? (
                          <img src={selectedProductForCart.imageUrl} alt={selectedProductForCart.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Package size={52} className="opacity-30" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title and Basic Details */}
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">
                        {selectedProductForCart.name}
                      </h2>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {selectedProductForCart.category && (
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-presale font-bold tracking-wide",
                            theme === "dark" ? "bg-cyan-400/20 text-cyan-300" : "bg-[#062A95]/10 text-[#062A95]"
                          )}>
                            {selectedProductForCart.category}
                          </span>
                        )}
                        {((selectedVariantObj ? selectedVariantObj.barcode : selectedProductForCart.barcode) || selectedProductForCart.sku) && (
                          <span className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wide border",
                            theme === "dark" ? "bg-black/40 border-white/50 text-white" : "bg-gray-50 border-light-border text-black/70"
                          )}>
                            BARCODE: {(selectedVariantObj ? selectedVariantObj.barcode : selectedProductForCart.barcode) || selectedProductForCart.sku}
                          </span>
                        )}
                        <span className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wide border",
                          theme === "dark" ? "bg-black/40 border-white/40 text-white/90" : "bg-gray-50 border-light-border text-black/50"
                        )}>
                          SKU: {selectedProductForCart.sku || "N/A"}
                        </span>
                      </div>
                    </div>

                    {selectedProductForCart.description ? (
                      <div className={cn(
                        "p-3 rounded-xl border text-xs font-presale font-medium leading-relaxed tracking-wide",
                        theme === "dark" ? "bg-black/20 border-white/30 text-white/90" : "bg-gray-50 border-light-border/40 text-black/70"
                      )}>
                        {selectedProductForCart.description}
                      </div>
                    ) : (
                      <div className={cn(
                        "p-3 rounded-xl border border-dashed text-xs leading-relaxed font-medium uppercase tracking-wider text-center",
                        theme === "dark" ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"
                      )}>
                        No description provided for this asset.
                      </div>
                    )}
                  </div>
                </div>

                {/* Financials & Stock Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className={cn(
                    "p-2.5 rounded-xl border flex flex-col gap-0.5 shadow-sm",
                    theme === "dark" ? "bg-black/20 border-white/50" : "bg-gray-50 border-light-border/40"
                  )}>
                    <span className={cn(
                      "text-[9px] uppercase font-black tracking-wider",
                      theme === "dark" ? "text-slate-100" : "opacity-40"
                    )}>Base Cost</span>
                    <span className="font-mono text-xs md:text-sm font-bold text-red-500">
                      {(role === 'Manager' || auth.currentUser?.email === 'admin@megapos.pos') ? formatCurrency(selectedVariantObj ? (selectedVariantObj.costPrice ?? selectedProductForCart.costPrice ?? (selectedProductForCart.price * 0.7)) : (selectedProductForCart.costPrice ?? (selectedProductForCart.price * 0.7)), currency) : 'Protected'}
                    </span>
                  </div>

                  <div className={cn(
                    "p-2.5 rounded-xl border flex flex-col gap-0.5 shadow-sm",
                    theme === "dark" ? "bg-black/20 border-white/50" : "bg-gray-50 border-light-border/40"
                  )}>
                    <span className={cn(
                      "text-[9px] uppercase font-black tracking-wider",
                      theme === "dark" ? "text-slate-100" : "opacity-40"
                    )}>Retail Price</span>
                    <span className="font-mono text-xs md:text-sm font-bold text-emerald-500">
                      {formatCurrency(selectedVariantObj ? (selectedVariantObj.price ?? selectedProductForCart.price) : selectedProductForCart.price, currency)}
                    </span>
                  </div>

                  <div className={cn(
                    "p-2.5 rounded-xl border flex flex-col gap-0.5 shadow-sm",
                    theme === "dark" ? "bg-black/20 border-white/50" : "bg-gray-50 border-light-border/40"
                  )}>
                    <span className={cn(
                      "text-[9px] uppercase font-black tracking-wider",
                      theme === "dark" ? "text-slate-100" : "opacity-40"
                    )}>Gross Margin</span>
                    <span className="font-mono text-xs md:text-sm font-bold text-brand-primary">
                      {(() => {
                        if (role !== 'Manager' && auth.currentUser?.email !== 'admin@megapos.pos') return 'Protected';
                        const cost = selectedVariantObj ? (selectedVariantObj.costPrice ?? selectedProductForCart.costPrice ?? (selectedProductForCart.price * 0.7)) : (selectedProductForCart.costPrice ?? (selectedProductForCart.price * 0.7));
                        const price = selectedVariantObj ? (selectedVariantObj.price ?? selectedProductForCart.price) : selectedProductForCart.price;
                        const profit = price - cost;
                        const pct = price > 0 ? (profit / price) * 100 : 0;
                        return `${pct.toFixed(1)}%`;
                      })()}
                    </span>
                  </div>

                  <div className={cn(
                    "p-2.5 rounded-xl border flex flex-col gap-0.5 shadow-sm",
                    theme === "dark" ? "bg-black/20 border-white/50" : "bg-gray-50 border-light-border/40"
                  )}>
                    <span className={cn(
                      "text-[9px] uppercase font-black tracking-wider",
                      theme === "dark" ? "text-slate-100" : "opacity-40"
                    )}>In Stock</span>
                    <div className="flex items-center gap-1.5 font-mono text-xs md:text-sm font-black">
                      <span className={cn(
                        "w-2 h-2 rounded-full animate-pulse",
                        (selectedVariantObj ? (selectedVariantObj.stockLevel ?? 0) : (selectedProductForCart.stockLevel ?? 0)) <= 0 ? "bg-red-500" : "bg-emerald-500"
                      )} />
                      <span className={theme === "dark" ? "text-white" : ""}>{selectedVariantObj ? (selectedVariantObj.stockLevel ?? 0) : (selectedProductForCart.stockLevel ?? 0)} units</span>
                    </div>
                  </div>
                </div>

                {/* Variation selection row */}
                {selectedProductForCart.variations && selectedProductForCart.variations.length > 0 && !editingCartItem && (
                  <div className="space-y-3">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest block",
                      theme === "dark" ? "text-slate-100" : "opacity-40"
                    )}>Variant Portfolio</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto no-scrollbar pr-1">
                      {selectedProductForCart.variations.map((v) => {
                        const isSelected = selectedVariationId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setSelectedVariationId(v.id);
                              setOverridePrice((v.price ?? selectedProductForCart.price).toString());
                            }}
                            className={cn(
                              "p-3 rounded-xl border-2 grid grid-cols-3 items-center gap-2 text-left transition-all relative overflow-hidden active:scale-98 cursor-pointer",
                              isSelected 
                                ? "border-brand-primary bg-brand-primary/10 text-brand-primary" 
                                : (theme === 'dark' ? "border-white/20 bg-black/40 hover:bg-white/5 text-white" : "border-light-border/40 bg-gray-50 hover:bg-gray-100 text-black")
                            )}
                          >
                            <div className="col-span-1">
                              <p className={cn(
                                "text-[9px] font-black uppercase tracking-widest truncate",
                                isSelected ? "text-brand-primary" : (theme === 'dark' ? "text-[#00E5FF]" : "text-[#062A95]")
                              )}>
                                {v.color || v.size ? `${v.color || ""} ${v.size || ""}` : `Variant`}
                              </p>
                              <p className={cn(
                                "text-[8px] font-mono truncate",
                                theme === "dark" ? "text-slate-300" : "opacity-50"
                              )}>{v.sku || "N/A"}</p>
                            </div>
                            <div className="col-span-1 text-center">
                              <p className={cn(
                                "text-[8px] uppercase",
                                theme === "dark" ? "text-slate-200" : "opacity-40"
                              )}>Stock</p>
                              <p className={cn(
                                "font-mono text-xs font-bold",
                                theme === "dark" ? "text-white" : ""
                              )}>{v.stockLevel ?? 0} qty</p>
                            </div>
                            <div className="col-span-1 text-right">
                              <p className={cn(
                                "text-[8px] uppercase",
                                theme === "dark" ? "text-slate-200" : "opacity-40"
                              )}>Price</p>
                              <p className="font-mono text-xs font-black text-brand-primary">
                                {formatCurrency(v.price || selectedProductForCart.price, currency)}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pricing & Quantity Inputs Container with copied gradient/border theme */}
                <div className={cn(
                  "p-5 rounded-2xl border transition-all duration-300 mt-4 backdrop-blur-md",
                  theme === "dark"
                    ? "bg-black/20 border-white/20"
                    : "bg-gray-50 border-slate-200"
                )}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Proposed Price Section */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-[0.2em]",
                          theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                        )}>
                          Proposed Price
                        </span>
                        <span className="font-mono text-[10px] opacity-45 uppercase font-bold">
                          {currency}
                        </span>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm opacity-50 text-dark-muted">
                          {getCurrencySymbol(currency)}
                        </span>
                        <input 
                          type="number"
                          step="0.01"
                          value={overridePrice || ""}
                          onChange={(e) => setOverridePrice(e.target.value)}
                          className={cn(
                            "w-full pl-8 pr-3 py-2 rounded-lg border font-mono font-bold text-sm outline-none transition-all",
                            theme === 'dark' 
                              ? "bg-black/40 border-white/30 focus:border-brand-primary text-white" 
                              : "bg-white/60 border-slate-400 focus:border-black text-black"
                          )}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Quantity Section */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-[0.2em]",
                          theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                        )}>
                          Quantity
                        </span>
                        <span className="font-mono text-[10px] opacity-70 uppercase font-bold text-brand-primary">
                          Max: {selectedVariantObj ? (selectedVariantObj.stockLevel ?? 0) : (selectedProductForCart?.stockLevel ?? 0)} Available
                        </span>
                      </div>

                      <div className="relative">
                        <input 
                          type="number"
                          min="1"
                          max={selectedVariantObj ? (selectedVariantObj.stockLevel ?? 0) : (selectedProductForCart?.stockLevel ?? 0)}
                          value={popupQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            const maxStock = selectedVariantObj ? (selectedVariantObj.stockLevel ?? 0) : (selectedProductForCart?.stockLevel ?? 0);
                            if (val > maxStock) {
                              const prodName = selectedProductForCart?.name || "Product";
                              setStockLimitWarning({
                                message: maxStock <= 0 
                                  ? `"${prodName}" is currently out of stock.`
                                  : `Cannot set quantity to ${val}. Maximum available stock is ${maxStock} unit${maxStock === 1 ? '' : 's'} for "${prodName}".`,
                                productName: prodName,
                                maxStock
                              });
                              setPopupQuantity(Math.max(1, maxStock));
                            } else {
                              setPopupQuantity(Math.max(1, val));
                            }
                          }}
                          className={cn(
                            "w-full px-4 py-2 rounded-lg border font-mono font-bold text-sm outline-none transition-all",
                            theme === 'dark' 
                              ? "bg-black/40 border-white/30 focus:border-brand-primary text-white" 
                              : "bg-white/60 border-slate-400 focus:border-black text-black"
                          )}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCK: Asset Detail Card Action Controls - Action buttons styled after Product Details Card */}
              <div className={cn(
                "asset-detail-card__actions py-4 px-6 md:px-8 border-t flex items-center justify-center gap-4 shrink-0 pb-safe",
                theme === "dark" ? "bg-[#020d30] border-white/50 text-white" : "bg-white border-black/10 text-black",
              )}>
                <button 
                  type="button"
                  onClick={() => {
                    if (editingCartItem) {
                      handleConfirmAssetDetail(0, Number(overridePrice) || 0);
                    } else {
                      handleNextItem();
                    }
                  }}
                  className={cn(
                    "asset-detail-card__button asset-detail-card__button--secondary px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2 min-w-[130px]",
                    editingCartItem 
                      ? (theme === "dark" 
                        ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20" 
                        : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100")
                      : (theme === "dark" 
                        ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                        : "bg-white border-light-border text-black hover:bg-gray-50")
                  )}
                >
                  {editingCartItem ? (
                    <>
                      <Trash2 size={12} />
                      Remove Item
                    </>
                  ) : (
                    <>
                      <Plus size={12} />
                      Next Item
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (editingCartItem) {
                      handleConfirmAssetDetail(popupQuantity, Number(overridePrice) || 0);
                    } else {
                      handleEndSale();
                    }
                  }}
                  className={cn(
                    "asset-detail-card__button asset-detail-card__button--primary px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5 min-w-[130px]",
                    theme === "dark"
                      ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                      : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                  )}
                >
                  {editingCartItem ? (
                    <>
                      <CheckCircle size={12} />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <CheckCircle size={12} />
                      End Sale
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200]">
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className={cn(
                "px-6 py-3 rounded-lg shadow-hard border-2 flex items-center gap-3 backdrop-blur-xl",
                status.type === 'success' 
                  ? "bg-green-500/90 border-green-400 text-white" 
                  : "bg-red-500/90 border-red-400 text-white"
              )}
            >
              <CheckCircle size={20} />
              <span className="text-xs font-black uppercase tracking-widest">{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={cn(
        "fixed bottom-6 right-8 z-[110] flex flex-col items-end gap-3",
        (cart.length > 0 && activeView === 'cart') ? "hidden sm:flex" : "flex",
        desktopLayout === 'split' && "md:hidden"
      )}>
        <button 
          onClick={() => setIsProductsOpen(true)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 active:scale-95 focus:outline-none group",
            theme === 'dark' 
              ? "bg-[#22D3EE] text-black border-[#0F172A] shadow-[#22D3EE]/20 hover:brightness-110" 
              : "bg-[#062A95] text-white border-white shadow-[#062A95]/20 hover:bg-opacity-95"
          )}
          title="Add Assets"
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-full">
        <div className="flex-1 flex flex-col min-h-0 px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0">
          <div className="w-full max-w-[1600px] mx-auto transition-all duration-300 ease-in-out font-presale flex-1 flex flex-col min-h-0">
            {/* BLOCK: Register Control Row - Terminal Hardware, Store Badge, View Options & Billing Control Bar */}
            <div className="rg-controls-layout flex flex-col lg:flex-row items-stretch gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0 w-full max-w-full transition-all duration-300 ease-in-out">
              {/* Left Group: Active Tab & Hardware Status */}
              <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-1/2 flex-1 min-w-0">
                {/* BLOCK: Terminal Hardware & Store Identity Bar */}
                <div className="relative w-full min-w-0">
                  <div className={cn(
                    "rg-active-tab-card flex flex-row items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl border transition-all duration-300 ease-in-out shadow-md w-full shrink-0 select-none min-w-0 justify-between sm:justify-start flex-nowrap overflow-x-auto",
                    theme === 'dark' 
                      ? "rg-active-tab-card--dark bg-[#041a5c]/40 border-[#123ebd]/50 shadow-lg shadow-black/20 backdrop-blur-md text-white" 
                      : "rg-active-tab-card--light bg-white/90 border-slate-200/80 shadow-sm text-black"
                  )}>
                    {/* Store Identity Badge */}
                    <div className={cn(
                      "rg-active-tab-card__store-badge flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border font-black uppercase text-[10px] sm:text-xs tracking-wider shrink-0 transition-all select-none",
                      theme === 'dark' 
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                        : "bg-[#062A95]/10 border-[#062A95]/20 text-[#062A95]"
                    )}>
                      <Store size={14} className="shrink-0" />
                      <span className="truncate max-w-[110px] sm:max-w-[160px]">
                        {storeInfo.name || 'MEGAPOS'}
                      </span>
                    </div>

                    <div className="h-4 w-px bg-slate-300 dark:bg-white/10 hidden sm:block" />

                    {/* Terminal Dropdown Selector */}
                    <div className="rg-active-tab-card__list flex items-center p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsTerminalMenuOpen(!isTerminalMenuOpen)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border-2 transition-all cursor-pointer",
                          activeView === 'verify'
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            : registerMode === 'cashsale'
                              ? "border-brand-primary/30 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20"
                              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                        )}
                      >
                        {activeView === 'verify' ? (
                          <>
                            <ShieldCheck size={15} className="shrink-0" />
                            <span className="rg-active-tab-card__title text-[10px] sm:text-xs font-black uppercase tracking-wider leading-none inline-flex items-center">
                              Verify Receipts
                            </span>
                          </>
                        ) : registerMode === 'cashsale' ? (
                          <>
                            <ShoppingCart size={15} className="shrink-0" />
                            <span className="rg-active-tab-card__title text-[10px] sm:text-xs font-black uppercase tracking-wider leading-none inline-flex items-center">
                              Cash Sale
                            </span>
                          </>
                        ) : (
                          <>
                            <RefreshCw size={15} className="shrink-0" />
                            <span className="rg-active-tab-card__title text-[10px] sm:text-xs font-black uppercase tracking-wider leading-none inline-flex items-center">
                              Presale
                            </span>
                          </>
                        )}
                        <ChevronDown size={14} className={cn("transition-transform duration-200 ml-0.5 shrink-0 opacity-70", isTerminalMenuOpen && "rotate-180")} />
                      </button>
                    </div>

                    {/* Barcode Scanner Hardware Badge */}
                    <div 
                      className={cn(
                        "rg-active-tab-card__barcode-display flex items-center justify-between gap-2 px-2.5 py-1.5 h-9 rounded-xl border font-mono text-xs transition-all select-none min-w-0 shrink-0",
                        theme === 'dark'
                          ? "bg-black/40 border-[#123ebd]/60 text-white"
                          : "bg-slate-100/80 border-slate-300 text-slate-800"
                      )}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 shrink">
                        <Barcode size={15} className={cn("shrink-0", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")} />
                        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate leading-none">
                          Barcode Scanner
                        </span>
                      </div>

                      <div className="hidden xs:flex sm:flex items-center shrink-0">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 leading-none">
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          <span>Listening</span>
                        </span>
                      </div>
                    </div>

                    <div className="h-4 w-px bg-slate-300 dark:bg-white/10 hidden sm:block" />

                    {/* View Options Menu Icon Button */}
                    <button
                      type="button"
                      onClick={() => setIsLayoutModalOpen(true)}
                      className={cn(
                        "rg-active-tab-card__views-button flex items-center justify-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl border-2 transition-all cursor-pointer font-black text-[10px] sm:text-xs uppercase tracking-wider shrink-0 active:scale-95",
                        theme === 'dark'
                          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                          : "border-[#062A95]/30 bg-[#062A95]/10 text-[#062A95] hover:bg-[#062A95]/20"
                      )}
                      title="Open Terminal View Options"
                    >
                      <SlidersHorizontal size={14} className="shrink-0" />
                      <span className="inline">Views</span>
                    </button>
                  </div>

                  <AnimatePresence>
                    {isTerminalMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsTerminalMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.95 }}
                          className={cn(
                            "absolute top-full left-0 mt-2 w-56 p-1.5 rounded-xl border shadow-xl z-50 flex flex-col gap-1",
                            theme === 'dark' ? "bg-[#041a5c] border-[#123ebd]/60 text-white shadow-black/50" : "bg-white border-slate-200 text-black shadow-slate-300/50"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveView('cart');
                              handleSetRegisterMode('presale');
                              setIsTerminalMenuOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer gap-2",
                              (activeView === 'cart' && registerMode === 'presale')
                                ? (theme === 'dark' ? "bg-cyan-500/20 text-cyan-400 font-black" : "bg-[#062A95]/10 text-[#062A95] font-black")
                                : (theme === 'dark' ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-700")
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <RefreshCw size={14} className={(activeView === 'cart' && registerMode === 'presale') ? "text-cyan-400 shrink-0" : "text-slate-400 shrink-0"} />
                              <span className="leading-none flex items-center justify-center">Presale Terminal</span>
                            </div>
                            {(activeView === 'cart' && registerMode === 'presale') && <Check size={12} />}
                          </button>

                          <button
                            type="button"
                            disabled={isRepRole}
                            onClick={() => {
                              if (isRepRole) return;
                              setActiveView('cart');
                              handleSetRegisterMode('cashsale');
                              setIsTerminalMenuOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-between transition-all gap-2",
                              isRepRole
                                ? "opacity-40 cursor-not-allowed bg-black/10 text-slate-400"
                                : (activeView === 'cart' && registerMode === 'cashsale')
                                  ? (theme === 'dark' ? "bg-cyan-500/20 text-cyan-400 font-black" : "bg-[#062A95]/10 text-[#062A95] font-black")
                                  : (theme === 'dark' ? "hover:bg-white/5 text-slate-300 cursor-pointer" : "hover:bg-slate-100 text-slate-700 cursor-pointer")
                            )}
                            title={isRepRole ? "Cash Sale Terminal is restricted for Rep role" : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <ShoppingCart size={14} className={isRepRole ? "text-slate-500 shrink-0" : (activeView === 'cart' && registerMode === 'cashsale') ? "text-brand-primary shrink-0" : "text-slate-400 shrink-0"} />
                              <span className="leading-none flex items-center justify-center">
                                Cash Sale Terminal {isRepRole && "(Restricted)"}
                              </span>
                            </div>
                            {isRepRole ? (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase">Locked</span>
                            ) : (
                              (activeView === 'cart' && registerMode === 'cashsale') && <Check size={12} />
                            )}
                          </button>

                          <div className="h-px bg-slate-200 dark:bg-white/10 my-0.5" />

                          <button
                            type="button"
                            onClick={() => {
                              setActiveView('verify');
                              setIsTerminalMenuOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-between transition-all cursor-pointer gap-2",
                              activeView === 'verify'
                                ? (theme === 'dark' ? "bg-cyan-500/20 text-cyan-400 font-black" : "bg-[#062A95]/10 text-[#062A95] font-black")
                                : (theme === 'dark' ? "hover:bg-white/5 text-slate-300" : "hover:bg-slate-100 text-slate-700")
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={14} className={activeView === 'verify' ? "text-emerald-400 shrink-0" : "text-slate-400 shrink-0"} />
                              <span className="leading-none flex items-center justify-center">Verify Receipts</span>
                            </div>
                            {activeView === 'verify' && <Check size={12} />}
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              {/* BLOCK: Billing & Checkout Control Card - Total display & Customer/Cart icons to the LEFT of Checkout button */}
              <div className={cn(
                "rg-checkout-card flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-2xl border transition-all duration-300 ease-in-out shadow-md w-full lg:w-1/2 flex-1 min-w-0 select-none",
                theme === 'dark' 
                  ? "rg-checkout-card--dark bg-[#041a5c]/40 border-[#123ebd]/50 shadow-lg shadow-black/20 backdrop-blur-md text-white" 
                  : "rg-checkout-card--light bg-white/90 border-slate-200/80 shadow-sm text-black"
              )}>
                {/* Total Display Box - Total label and number on the SAME line */}
                <div 
                  className="rg-checkout-card__total-display flex flex-row items-center gap-2 sm:gap-3 px-2 py-0.5 font-mono select-none min-w-0 flex-1 overflow-hidden"
                >
                  <span className="text-xs sm:text-sm lg:text-base font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 leading-none whitespace-nowrap shrink-0">
                    Total:
                  </span>
                  <span className={cn(
                    "text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black tracking-tight leading-none truncate",
                    theme === 'dark' ? "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.25)]" : "text-[#062A95]"
                  )}>
                    {formatCurrency(total, currency)}
                  </span>
                </div>

                {/* Right Horizontal Row: Customer Button & Cart Button to the LEFT of Checkout Button */}
                <div className="rg-checkout-card__actions-row flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {/* Customer Button */}
                  <div className="relative shrink-0 flex-1 sm:flex-initial">
                    <button
                      type="button"
                      onClick={() => setIsAddCustomerOpen(!isAddCustomerOpen)}
                      className={cn(
                        "rg-checkout-card__customer-btn h-9 px-2.5 sm:px-3 rounded-xl border-2 transition-all flex items-center justify-between gap-1.5 focus:outline-none cursor-pointer text-xs font-bold uppercase tracking-wider",
                        selectedCustomer 
                          ? (theme === 'dark' ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" : "border-emerald-500/40 bg-emerald-50 text-emerald-700")
                          : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-300 hover:text-white hover:border-cyan-500/40" : "border-slate-200 bg-slate-50 text-slate-700 hover:text-black hover:border-[#062A95]/30")
                      )}
                      title={selectedCustomer ? "Linked: " + selectedCustomer.name : "Link Customer Code"}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <UserIcon size={15} className="shrink-0" />
                        <span className="truncate text-[10px] sm:text-xs font-black max-w-[70px] sm:max-w-[100px]">
                          {selectedCustomer ? selectedCustomer.name : 'Customer'}
                        </span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-mono font-black shrink-0 px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/10">
                        {selectedCustomer ? 1 : 0}
                      </span>
                    </button>

                    <AnimatePresence>
                      {isAddCustomerOpen && (
                        <motion.div 
                          key="add-customer-backdrop"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-40" 
                          onClick={handleBackdropClick} 
                        />
                      )}
                      {isAddCustomerOpen && (
                        <motion.div
                          key="add-customer-body"
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className={cn(
                            "absolute top-full right-0 mt-2 w-80 p-5 rounded-xl border-2 shadow-2xl z-50",
                            theme === 'dark' ? "bg-dark-surface border-dark-border text-white shadow-black/80" : "bg-white border-light-border text-black shadow-slate-300/80"
                          )}
                        >
                          <h4 className="text-xs font-black uppercase tracking-widest mb-3 text-brand-primary">
                            Link Customer Account
                          </h4>
                          
                          {selectedCustomer ? (
                            <div className="space-y-4">
                              <div className={cn(
                                "p-3 rounded-lg border text-xs space-y-2",
                                theme === 'dark' ? "bg-dark-background border-[#333]" : "bg-gray-50 border-[#EEE]"
                              )}>
                                <div className="flex justify-between items-start">
                                  <p className="font-bold uppercase truncate max-w-[150px]">{selectedCustomer.name}</p>
                                  <span className="text-[9px] font-mono font-bold bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded">
                                    {selectedCustomer.customerId || 'LINKED'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-[11px] opacity-70 font-mono">
                                  <span>LTV spent:</span>
                                  <span>{formatCurrency(selectedCustomer.totalSpent || 0, currency)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span>Credit Level:</span>
                                  <span className={selectedCustomer.allowBalance ? "text-green-500 font-bold" : "text-red-500"}>
                                    {selectedCustomer.allowBalance ? formatCurrency(selectedCustomer.balanceLimit || 0, currency) : 'No Debit Credit'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span>Account Balance:</span>
                                  <span className="text-cyan-500 font-bold">
                                    {formatCurrency(selectedCustomer.accountBalance || 0, currency)}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(null);
                                  setChargeToCustomerCredit(false);
                                  setIsAddCustomerOpen(false);
                                }}
                                className={cn(
                                  "w-full py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all cursor-pointer",
                                  "border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                )}
                              >
                                Unlink Customer
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-[10px] opacity-60 leading-relaxed uppercase font-bold">
                                Enter customer ID (e.g. CUST-XXXXXX) or Client's name to link with this active cart staging session.
                              </p>
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  placeholder="CUSTOMER CODE OR NAME"
                                  value={customerCodeInput}
                                  onChange={(e) => setCustomerCodeInput(e.target.value)}
                                  className={cn(
                                    "w-full px-3 py-2 rounded-lg text-xs font-mono font-bold uppercase border focus:outline-none focus:border-brand-primary transition-all",
                                    theme === 'dark' ? "bg-dark-background border-dark-border text-white" : "bg-gray-50 border-light-border text-black"
                                  )}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const matched = customers.find(c => 
                                        (c.customerId || '').toLowerCase() === customerCodeInput.trim().toLowerCase() ||
                                        (c.name || '').toLowerCase().includes(customerCodeInput.trim().toLowerCase())
                                      );
                                      if (matched) {
                                        setSelectedCustomer(matched);
                                        setCustomerCodeInput('');
                                      } else {
                                        alert("No client matching that code or identifier was retrieved.");
                                      }
                                    }
                                  }}
                                />
                                
                                {customerCodeInput.trim().length > 1 && (
                                  <div className={cn(
                                    "border rounded-lg max-h-40 overflow-y-auto divide-y font-mono text-[11px]",
                                    theme === 'dark' ? "bg-dark-background border-dark-border divide-[#222]" : "bg-white border-light-border divide-[#EEE]"
                                  )}>
                                    {customers.filter(c => 
                                      (c.customerId || '').toLowerCase().includes(customerCodeInput.toLowerCase()) ||
                                      (c.name || '').toLowerCase().includes(customerCodeInput.toLowerCase())
                                    ).length === 0 ? (
                                      <div className="customer-dropdown-empty p-3 text-center text-xs font-presale tracking-wide text-dark-muted">No matching client account found</div>
                                    ) : (
                                      customers.filter(c => 
                                        (c.customerId || '').toLowerCase().includes(customerCodeInput.toLowerCase()) ||
                                        (c.name || '').toLowerCase().includes(customerCodeInput.toLowerCase())
                                      ).map(c => (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedCustomer(c);
                                            setCustomerCodeInput('');
                                          }}
                                          className={cn(
                                            "w-full p-2.5 text-left transition-all uppercase flex justify-between items-center",
                                            theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
                                          )}
                                        >
                                          <span className="font-bold truncate max-w-[140px]">{c.name}</span>
                                          <span className="text-[9px] text-brand-primary font-bold">{c.customerId || 'LINK CLIENT'}</span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = customers.find(c => 
                                    (c.customerId || '').toLowerCase() === customerCodeInput.trim().toLowerCase() ||
                                    (c.name || '').toLowerCase().includes(customerCodeInput.trim().toLowerCase())
                                  );
                                  if (matched) {
                                    setSelectedCustomer(matched);
                                    setCustomerCodeInput('');
                                  } else {
                                    alert("No active client matching that code or identifier was retrieved.");
                                  }
                                }}
                                className="w-full py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                              >
                                Link Client Account
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Hold / Park Cart Button */}
                  <button 
                    type="button"
                    onClick={handleParkActiveCart}
                    disabled={cart.length === 0}
                    className={cn(
                      "rg-checkout-card__hold-btn h-10 px-2.5 sm:px-3 rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer text-xs font-bold uppercase tracking-wider shrink-0 flex-1 sm:flex-initial",
                      cart.length === 0
                        ? "opacity-40 cursor-not-allowed border-transparent bg-transparent text-slate-500"
                        : (theme === 'dark' 
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" 
                            : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100")
                    )}
                    title="Hold / Park active order (F4)"
                  >
                    <PauseCircle size={15} className="shrink-0" />
                    <span className="text-[10px] sm:text-xs font-black hidden sm:inline">Hold</span>
                  </button>

                  {/* Split Tender Payment Button */}
                  <button 
                    type="button"
                    onClick={() => setIsSplitPaymentModalOpen(true)}
                    disabled={cart.length === 0}
                    className={cn(
                      "rg-checkout-card__split-btn h-10 px-2.5 sm:px-3 rounded-xl border-2 transition-all flex items-center justify-center gap-1.5 focus:outline-none cursor-pointer text-xs font-bold uppercase tracking-wider shrink-0 flex-1 sm:flex-initial",
                      cart.length === 0
                        ? "opacity-40 cursor-not-allowed border-transparent bg-transparent text-slate-500"
                        : (theme === 'dark' 
                            ? "border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20" 
                            : "border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100")
                    )}
                    title="Split payment between cash/card/credit (F10)"
                  >
                    <Split size={15} className="shrink-0" />
                    <span className="text-[10px] sm:text-xs font-black hidden sm:inline">Split</span>
                  </button>

                  {/* Cart Icon & Clear Button */}
                  <button 
                    type="button"
                    onClick={() => setCart([])}
                    className={cn(
                      "rg-checkout-card__cart-btn h-10 px-3 rounded-xl border-2 transition-all flex items-center justify-between gap-1.5 focus:outline-none cursor-pointer text-xs font-bold uppercase tracking-wider shrink-0 flex-1 sm:flex-initial",
                      theme === 'dark' 
                        ? "border-white/10 bg-black/20 text-slate-300 hover:text-red-400 hover:border-red-500/40" 
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:text-red-500 hover:border-red-500/30"
                    )}
                    title="Clear Cart (F9)"
                    disabled={cart.length === 0}
                  >
                    <div className="flex items-center gap-1.5">
                      <ShoppingCart size={16} className="shrink-0" />
                      <span className="text-[10px] sm:text-xs font-black">Cart</span>
                    </div>
                    <span className="text-xs font-mono font-black shrink-0 px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/10">
                      {cart.length}
                    </span>
                  </button>

                  {/* Checkout Button */}
                  <button 
                    type="button"
                    onClick={() => setIsCheckoutOpen(true)}
                    disabled={cart.length === 0}
                    className={cn(
                      "rg-checkout-card__checkout-btn no-gradient h-10 px-4 sm:px-5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-sm relative overflow-hidden group active:scale-98 select-none cursor-pointer shrink-0 flex-1 sm:flex-initial",
                      cart.length === 0 
                        ? "rg-checkout-card__checkout-btn--disabled opacity-50 cursor-not-allowed bg-gray-500/15 border border-gray-500/20 text-gray-400"
                        : (theme === 'dark' 
                            ? "rg-checkout-card__checkout-btn--dark bg-brand-primary border border-brand-primary text-black hover:brightness-110" 
                            : "rg-checkout-card__checkout-btn--light bg-[#062A95] border border-[#062A95] text-white hover:bg-opacity-90")
                    )}
                  >
                    <div className="rg-checkout-card__checkout-shine absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
                    <Banknote className="rg-checkout-card__checkout-icon w-4 h-4 group-hover:rotate-12 transition-transform shrink-0" />
                    <span className="rg-checkout-card__checkout-label truncate leading-none inline-flex items-center pt-0.5">Checkout</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BLOCK: Layout Views Modal - Popup card allowing user to choose POS screen layout and product card display mode */}
            <AnimatePresence>
              {isLayoutModalOpen && (
                <div id="layout-views-modal" className="layout-views-modal fixed inset-0 z-[120] flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="layout-views-modal__backdrop fixed inset-0 bg-black/60 backdrop-blur-md"
                    onClick={() => setIsLayoutModalOpen(false)}
                  />

                  {/* Modal Popup Card */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    className={cn(
                      "popup-card layout-views-modal__card relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl z-10 overflow-hidden space-y-6",
                      theme === 'dark'
                        ? "layout-views-modal__card--dark bg-[#041a5c] border-[#123ebd]/60 text-white shadow-black/80"
                        : "layout-views-modal__card--light bg-white border-slate-200 text-black shadow-slate-300/80"
                    )}
                  >
                    {/* Modal Header */}
                    <div className="layout-views-modal__header flex items-center justify-between pb-4 border-b border-solid border-slate-200 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                          theme === 'dark' ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-[#062A95]/10 border-[#062A95]/20 text-[#062A95]"
                        )}>
                          <SlidersHorizontal size={20} />
                        </div>
                        <div>
                          <h3 className={cn(
                            "layout-views-modal__title text-sm font-black uppercase tracking-wider",
                            theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                          )}>
                            Terminal View Options
                          </h3>
                          <p className="layout-views-modal__subtitle text-[11px] text-slate-400 uppercase tracking-wide">
                            Select layout presentation & product display mode
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsLayoutModalOpen(false)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Section 1: Desktop Terminal Layout */}
                    <div className="layout-views-modal__section space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                        1. Main Terminal Screen Layout
                      </label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleSetDesktopLayout('table');
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all cursor-pointer gap-2 text-center",
                            desktopLayout === 'table'
                              ? (theme === 'dark' ? "border-cyan-400 bg-cyan-500/20 text-cyan-400 font-black" : "border-[#062A95] bg-[#062A95]/10 text-[#062A95] font-black")
                              : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-300 hover:bg-white/5" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")
                          )}
                        >
                          <Table size={22} />
                          <span className="text-[11px] font-black uppercase tracking-wider">Table View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleSetDesktopLayout('card');
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all cursor-pointer gap-2 text-center",
                            desktopLayout === 'card'
                              ? (theme === 'dark' ? "border-cyan-400 bg-cyan-500/20 text-cyan-400 font-black" : "border-[#062A95] bg-[#062A95]/10 text-[#062A95] font-black")
                              : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-300 hover:bg-white/5" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")
                          )}
                        >
                          <LayoutGrid size={22} />
                          <span className="text-[11px] font-black uppercase tracking-wider">Card View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleSetDesktopLayout('split');
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all cursor-pointer gap-2 text-center",
                            desktopLayout === 'split'
                              ? (theme === 'dark' ? "border-cyan-400 bg-cyan-500/20 text-cyan-400 font-black" : "border-[#062A95] bg-[#062A95]/10 text-[#062A95] font-black")
                              : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-300 hover:bg-white/5" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100")
                          )}
                        >
                          <AlignJustify size={22} className="rotate-90" />
                          <span className="text-[11px] font-black uppercase tracking-wider">Split Screen</span>
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Product Item Format (When not split) */}
                    {desktopLayout !== 'split' && (
                      <div className="layout-views-modal__section space-y-3 pt-2 border-t border-solid border-slate-200 dark:border-white/10">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                          2. Product Catalog Display Mode
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleLayoutChange('grid')}
                            className={cn(
                              "p-3 rounded-xl border-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
                              currentProductLayout === 'grid'
                                ? (theme === 'dark' ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 font-black" : "border-[#062A95] bg-[#062A95] text-white font-black")
                                : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-black")
                            )}
                          >
                            Grid Cards
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLayoutChange('list-img')}
                            className={cn(
                              "p-3 rounded-xl border-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
                              currentProductLayout === 'list-img'
                                ? (theme === 'dark' ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 font-black" : "border-[#062A95] bg-[#062A95] text-white font-black")
                                : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-black")
                            )}
                          >
                            List + Pic
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLayoutChange('list-text')}
                            className={cn(
                              "p-3 rounded-xl border-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5",
                              currentProductLayout === 'list-text'
                                ? (theme === 'dark' ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 font-black" : "border-[#062A95] bg-[#062A95] text-white font-black")
                                : (theme === 'dark' ? "border-white/10 bg-black/20 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-black")
                            )}
                          >
                            Compact Text
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Modal Action Footer */}
                    <div className="layout-views-modal__footer pt-4 border-t border-solid border-slate-200 dark:border-white/10 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsLayoutModalOpen(false)}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-brand-primary text-black hover:brightness-110 transition-all cursor-pointer shadow-md"
                      >
                        Apply & Close
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {activeView === 'cart' && (
              <>
                {/* BLOCK: Split POS Screen Layout - Active when split layout setting is enabled on desktop screens */}
                {desktopLayout === 'split' && (
                  <div className="pos-split pos-split--desktop hidden md:grid md:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-[600px] h-[calc(100vh-180px)] w-full items-stretch">
                    
                    {/* BLOCK: Product Library Panel - Displays all active items, search filter and categories */}
                    <div className={cn(
                      "pos-split__left md:col-span-6 xl:col-span-6 flex flex-col p-5 rounded-2xl border shadow-md overflow-hidden h-full",
                      theme === 'dark' 
                        ? "bg-[#041a5c]/25 border-[#123ebd]/40 backdrop-blur-md" 
                        : "bg-white border-slate-200/80"
                    )}>
                      <div className="pos-split__left-header flex items-center justify-between mb-4 pb-3 border-b border-dashed border-slate-300 dark:border-white/10 shrink-0">
                        <div className="pos-split__left-title-container flex items-center gap-2">
                          <ShoppingBag size={16} className="text-brand-primary" />
                          <h3 className={cn(
                            "pos-split__left-title text-xs font-black uppercase tracking-[0.15em]",
                            theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                          )}>
                            Product Library
                          </h3>
                        </div>

                        {/* BLOCK: Product Library Mode Indicator */}
                        <div className="pos-split__left-layout-controls flex items-center gap-2">
                          <span className="pos-split__left-mode text-[9px] font-mono uppercase tracking-widest opacity-60">
                            {registerMode === 'presale' ? 'Presale' : 'Cashsale'}
                          </span>
                        </div>
                      </div>

                      {/* Render product list matrix */}
                      <div className="pos-split__left-matrix-container flex-1 overflow-y-auto pr-1">
                        {renderProductMatrix(false, true)}
                      </div>

                      {/* BLOCK: Barcode Scanner Indicator Footer - Hardware status badge indicating auto-scan readiness */}
                      <div className="pos-split__left-footer mt-3 pt-3 border-t border-dashed border-slate-300 dark:border-white/10 shrink-0">
                        <div className={cn(
                          "pos-split__barcode-status flex items-center justify-between px-3.5 py-2.5 rounded-xl border font-mono text-xs transition-all select-none",
                          theme === 'dark'
                            ? "bg-black/30 border-[#123ebd]/50 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-800"
                        )}>
                          <div className="pos-split__barcode-status-left flex items-center gap-2.5 min-w-0">
                            <div className="pos-split__barcode-status-icon-wrapper relative flex items-center justify-center shrink-0">
                              <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </div>
                            <Barcode size={18} className={cn("shrink-0", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")} />
                            <span className="pos-split__barcode-status-label text-[11px] font-black uppercase tracking-wider truncate leading-none">
                              Barcode Scanner
                            </span>
                          </div>

                          <div className="pos-split__barcode-status-right flex items-center gap-2 shrink-0">
                            <span className="pos-split__barcode-status-badge px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 leading-none">
                              Ready & Listening
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BLOCK: Staged Cart Panel - Contains scrolling list of items, discount totals and action controls */}
                    <div className={cn(
                      "pos-split__right md:col-span-6 xl:col-span-6 flex flex-col p-5 rounded-2xl border shadow-md overflow-hidden h-full",
                      theme === 'dark' 
                        ? "bg-[#041a5c]/25 border-[#123ebd]/40 backdrop-blur-md" 
                        : "bg-white border-slate-200/80"
                    )}>
                      <div className="pos-split__right-header flex items-center justify-between mb-4 pb-3 border-b border-dashed border-slate-300 dark:border-white/10 shrink-0">
                        <div className="pos-split__right-title-container flex items-center gap-2">
                          <ShoppingCart size={16} className="text-brand-primary" />
                          <h3 className={cn(
                            "pos-split__right-title text-xs font-black uppercase tracking-[0.15em]",
                            theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                          )}>
                            Staged Cart
                          </h3>
                        </div>
                        <span className="pos-split__right-count text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-full uppercase tracking-wider">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
                        </span>
                      </div>

                      {/* Scrolling Cart items inside right panel */}
                      <div className={cn(
                        "pos-split__right-list flex-1 overflow-y-auto pr-1 mb-4",
                        cart.length === 0 ? "flex flex-col" : "grid grid-cols-1 lg:grid-cols-2 gap-3 content-start"
                      )}>
                        {cart.length === 0 ? (
                          <div className="pos-split__right-empty flex flex-col items-center justify-center space-y-2 py-16 h-full text-center">
                            <ShoppingCart size={54} strokeWidth={1.5} className={cn("mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                            <p className={cn("text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Terminal Awaiting Input</p>
                            <p className={cn("text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add transaction items to begin staging process</p>
                          </div>
                        ) : (
                          cart.map((item, index) => {
                            const rowDiscount = item.discount ?? (item.originalPrice ? item.originalPrice - (item.priceOverride ?? item.price) : 0);
                            return (
                              <div 
                                key={item.id}
                                className={cn(
                                  "pos-split__right-item p-3.5 rounded-xl border flex flex-col gap-2 relative overflow-hidden transition-all duration-300 hover:shadow-md",
                                  theme === 'dark' ? "bg-black/30 border-white/10" : "bg-slate-50 border-slate-200/60"
                                )}
                              >
                                {/* BLOCK: Top Row - Product image and two-line product name */}
                                <div className="pos-split__right-item-top flex items-start gap-2.5">
                                  <div className={cn(
                                    "pos-split__right-item-image w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border shrink-0 bg-black/5 mt-0.5",
                                    theme === 'dark' ? "border-white/15" : "border-slate-300"
                                  )}>
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <Package size={18} className="text-[#888]" />
                                    )}
                                  </div>
                                  <div className="pos-split__right-item-text min-w-0 flex-1">
                                    <h4 className={cn(
                                      "pos-split__right-item-name text-xs font-black uppercase tracking-wider line-clamp-2 leading-snug",
                                      theme === 'dark' ? "text-white" : "text-black"
                                    )}>
                                      {item.name}
                                    </h4>
                                  </div>
                                </div>

                                {/* BLOCK: Middle Row - Barcode and Quantity badge positioned under image and product name */}
                                <div className="pos-split__right-item-meta flex items-center justify-between gap-2 min-w-0 pt-0.5">
                                  <span className="pos-split__right-item-sku text-[10px] font-mono text-slate-400 font-semibold uppercase truncate min-w-0 flex-1">
                                    BARCODE: {item.barcode || item.sku || item.id.slice(-6).toUpperCase()}
                                  </span>

                                  <div className={cn(
                                    "pos-split__right-item-qty px-2.5 py-0.5 rounded-lg border font-mono text-xs font-black shrink-0",
                                    theme === 'dark' ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" : "border-[#062A95]/20 bg-[#062A95]/5 text-[#062A95]"
                                  )}>
                                    Qty: {item.quantity}
                                  </div>
                                </div>

                                {/* BLOCK: Footer Row - Individual price and total price calculation */}

                                <div className="pos-split__right-item-footer flex items-center justify-between pt-2 border-t border-dashed border-slate-300 dark:border-white/5 font-mono text-[10px]">
                                  <div className="pos-split__right-item-price-each text-slate-400">
                                    {formatCurrency(item.priceOverride ?? item.price, currency)} each
                                  </div>
                                  <div className={cn("pos-split__right-item-total-price font-black", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")}>
                                    {formatCurrency((item.priceOverride ?? item.price) * item.quantity, currency)}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Bill Breakdown Totals */}
                      <div className={cn(
                        "pos-split__totals p-4 rounded-xl border-2 space-y-2 font-mono text-xs tracking-tight shrink-0",
                        theme === 'dark' ? "bg-black/35 border-white/10" : "bg-slate-50 border-slate-200"
                      )}>
                        <div className="pos-split__totals-row flex items-center justify-between text-slate-400">
                          <span className="uppercase font-semibold tracking-wider">Subtotal</span>
                          <span className={theme === 'dark' ? "text-white" : "text-black"}>
                            {formatCurrency(originalSubtotal, currency)}
                          </span>
                        </div>
                        {totalDiscount > 0 && (
                          <div className="pos-split__totals-row flex items-center justify-between text-green-500">
                            <span className="uppercase font-semibold tracking-wider">Discount</span>
                            <span>-{formatCurrency(totalDiscount, currency)}</span>
                          </div>
                        )}
                        <div className="pos-split__totals-row flex items-center justify-between text-slate-400 pb-1.5 border-b border-dashed border-slate-300 dark:border-white/5">
                          <span className="uppercase font-semibold tracking-wider">Tax ({(taxRate * 100).toFixed(1)}%)</span>
                          <span className={theme === 'dark' ? "text-white" : "text-black"}>
                            {formatCurrency(tax, currency)}
                          </span>
                        </div>
                        <div className="pos-split__totals-due flex items-center justify-between pt-1">
                          <span className={cn("text-xs uppercase font-black tracking-wider", theme === 'dark' ? "text-white" : "text-black")}>Total Bill Due</span>
                          <span className={cn("text-base font-black tracking-tight", theme === 'dark' ? "text-brand-primary" : "text-[#062A95]")}>
                            {formatCurrency(total, currency)}
                          </span>
                        </div>
                      </div>

                      {/* BLOCK: Action buttons */}
                      <div className="pos-split__actions flex flex-col gap-3 mt-4 shrink-0">
                        <div className="flex items-center gap-3 w-full">
                          <button 
                            onClick={() => setCart([])}
                            disabled={cart.length === 0}
                            className={cn(
                              "pos-split__btn-clear w-11 h-11 rounded-xl flex items-center justify-center border transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0",
                              theme === 'dark' ? "border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                            )}
                            title="Clear Cart"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button 
                            onClick={() => setIsCheckoutOpen(true)}
                            disabled={cart.length === 0}
                            className={cn(
                              "pos-split__btn-checkout flex-1 h-11 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-sm relative overflow-hidden group active:scale-95 cursor-pointer select-none",
                              cart.length === 0 
                                ? "opacity-50 cursor-not-allowed bg-gray-500/15 border border-gray-500/20 text-gray-400"
                                : (theme === 'dark' 
                                    ? "bg-brand-primary border border-brand-primary text-black hover:brightness-110" 
                                    : "bg-black border border-black text-white hover:bg-gray-900")
                            )}
                          >
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-12" />
                            <Banknote className="w-4 h-4 group-hover:rotate-12 transition-transform shrink-0" />
                            <span>Checkout</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Standard responsive view of cart items */}
                <div className={cn(
                  "flex flex-col md:flex-row gap-8 flex-1 min-h-0",
                  desktopLayout === 'split' && "md:hidden"
                )}>
              {/* Cart Items View */}
              <div className={cn(
                "flex-1 space-y-4 pb-6 md:pb-8 w-full",
                theme === 'dark' ? "text-dark-muted" : "text-light-muted"
              )}>
                {/* BLOCK: Register Staged Cart Items Container - Displays table or card list depending on product layout setting */}
                <div>
                  {productLayout === 'grid' ? (
                    /* Picture Grid Layout for Cart Items */
                    <div className="grid gap-3 sm:gap-4 min-h-[100px] w-full grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {cart.length === 0 ? (
                        /* BLOCK: Empty Staged Cart Cards View - Displays terminal awaiting status card */
                        <div className={cn(
                          "staged-cart-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft col-span-full",
                          theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                        )}>
                          <ShoppingCart size={54} strokeWidth={1.5} className={cn("staged-cart-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("staged-cart-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Terminal Awaiting Input</p>
                          <p className={cn("staged-cart-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add transaction items to begin staging process</p>
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {cart.map((item, index) => {
                            const rowDiscount = item.discount ?? (item.originalPrice ? item.originalPrice - (item.priceOverride ?? item.price) : 0);
                            return (
                              <motion.div 
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                whileHover={{ y: -4 }}
                                className={cn(
                                  "group relative rounded-2xl border overflow-hidden transition-all duration-300 flex flex-col justify-between w-full cursor-pointer select-none hover:shadow-hard",
                                  theme === 'dark' ? "bg-dark-surface border-white/20 hover:border-brand-primary/50" : "bg-white border-slate-300 hover:border-black"
                                )}
                                onDoubleClick={() => {
                                  setSelectedProductForCart(item);
                                  setEditingCartItem(item);
                                  setOverridePrice((item.priceOverride ?? item.price).toString());
                                  setPopupQuantity(item.quantity);
                                  setIsProductDetailOpen(true);
                                }}
                              >
                                {/* Top Image Block - Compact height instead of aspect-square */}
                                <div className={cn(
                                  "relative overflow-hidden bg-black/5 shrink-0 border-b w-full h-28 sm:h-32",
                                  theme === 'dark' ? "border-white/15" : "border-slate-300"
                                )}>
                                  {item.imageUrl ? (
                                    <img 
                                      src={item.imageUrl} 
                                      alt={item.name} 
                                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                      referrerPolicy="no-referrer" 
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-[#0d0d0d] dark:to-[#181818] text-dark-muted select-none group-hover:from-neutral-150 group-hover:to-neutral-250 dark:group-hover:from-[#111] dark:group-hover:to-[#222] transition-colors duration-300">
                                      <div className="p-2.5 rounded-xl bg-white/40 dark:bg-black/40 border border-neutral-300/20 dark:border-white/5 shadow-sm transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                        <Package size={22} className="text-[#888] dark:text-[#555] group-hover:text-brand-primary" />
                                      </div>
                                      <span className="text-[7px] font-black uppercase tracking-widest text-[#888] dark:text-[#555] mt-1.5 group-hover:text-brand-primary transition-colors">NO IMAGE</span>
                                    </div>
                                  )}
                                </div>

                                {/* Bottom Info / Fields Block */}
                                <div className="p-2.5 sm:p-3 flex flex-col justify-between gap-2 w-full flex-1">
                                  <div className="space-y-1">
                                    <h3 className={cn(
                                      "font-black uppercase tracking-tighter leading-tight title-text text-xs line-clamp-1",
                                      theme === 'dark' ? "text-white" : "text-black"
                                    )}>
                                      {limitLetters(item.name, 30)}
                                    </h3>
                                    
                                    {/* Line number, Barcode and QTY under name */}
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-[#888]">
                                        Line {(index + 1).toString().padStart(2, '0')}
                                      </span>
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[8px] font-mono leading-none border uppercase tracking-tight",
                                        theme === 'dark' 
                                          ? "bg-[#111] border-white/10 text-brand-primary" 
                                          : "bg-slate-100 border-slate-300 text-slate-800 font-semibold"
                                      )}>
                                        {item.barcode || item.sku || item.id.slice(-6).toUpperCase()}
                                      </span>
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[8px] font-mono leading-none border uppercase tracking-tight font-black",
                                        theme === 'dark' ? "bg-black border-white/15 text-white" : "bg-slate-100 border-slate-300 text-slate-900"
                                      )}>
                                        QTY: {item.quantity}
                                      </span>
                                      {item.priceOverride && (
                                        <span className="text-[7px] sm:text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                          Override
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Financial Metrics box with Total under Price and Discount */}
                                  <div className={cn(
                                    "flex flex-col gap-1 p-2 rounded-xl border font-mono font-bold mt-1",
                                    theme === 'dark' ? "bg-black/40 border-white/10" : "bg-slate-50 border-slate-200"
                                  )}>
                                    <div className="grid grid-cols-2 gap-2 pb-1 border-b border-dashed border-slate-300 dark:border-white/10">
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-[6px] sm:text-[7px] uppercase tracking-wider text-dark-muted">Price</span>
                                        <span className={cn("text-left font-black truncate text-[9px] sm:text-[10px]", theme === 'dark' ? "text-white" : "text-black")}>
                                          {formatCurrency(item.price, currency)}
                                        </span>
                                      </div>
                                      <div className="flex flex-col text-left min-w-0">
                                        <span className="text-[6px] sm:text-[7px] uppercase tracking-wider text-dark-muted">Discount</span>
                                        <span className="text-green-500 text-left font-black truncate text-[9px] sm:text-[10px]">
                                          {rowDiscount > 0 ? `-${formatCurrency(rowDiscount, currency)}` : formatCurrency(0, currency)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between min-w-0 pt-0.5">
                                      <span className="text-[6px] sm:text-[7px] uppercase tracking-wider text-dark-muted">Total</span>
                                      <span className={cn("text-right font-black truncate text-[10px] sm:text-xs", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")}>
                                        {formatCurrency((item.priceOverride ?? item.price) * item.quantity, currency)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                    ) : (
                      /* Picture List / Text List Tabular Layouts with Beautiful Premium Table Design */
                      <div className={cn(
                        "hidden md:block rounded-2xl border shadow-soft overflow-hidden transition-all duration-300",
                        theme === "dark"
                          ? "bg-dark-surface border-white/35"
                          : "bg-white border-slate-400",
                      )}>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-20 shadow-sm">
                              <tr className={cn(
                                "text-left border-b transition-colors duration-200",
                                theme === "dark"
                                  ? "bg-[#111c30] border-white/35"
                                  : "bg-slate-100 border-slate-400",
                              )}>
                                <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap w-[70px] lg:w-[100px]", theme === 'dark' ? "text-white" : "text-black/80")}>Line</th>
                                {productLayout !== 'list-text' && <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap text-center w-[80px] lg:w-[120px]", theme === 'dark' ? "text-white" : "text-black/80")}>Pic</th>}
                                <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap w-[110px] lg:w-[180px]", theme === 'dark' ? "text-white" : "text-black/80")}>Barcode</th>
                                <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap w-[120px] lg:w-[280px]", theme === 'dark' ? "text-white" : "text-black/80")}>Product Name</th>
                                <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap text-center w-[90px] lg:w-[140px]", theme === 'dark' ? "text-white" : "text-black/80")}>Quantity</th>
                                <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap text-left w-[110px] lg:w-[180px]", theme === 'dark' ? "text-white" : "text-black/80")}>Price</th>
                                <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap text-left w-[110px] lg:w-[180px]", theme === 'dark' ? "text-white" : "text-black/80")}>Discount</th>
                                <th className={cn("px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap text-left w-[110px] lg:w-[180px]", theme === 'dark' ? "text-white" : "text-black/80")}>Total</th>
                                <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-5 lg:py-6 text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap text-center w-[80px] lg:w-[100px]", theme === 'dark' ? "text-white" : "text-black/80")}>Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-transparent">
                              {cart.length === 0 ? (
                                /* BLOCK: Empty Staged Cart Table Row - Displays empty state with column titles retained */
                                <tr className="staged-cart-table__row border-0">
                                  <td colSpan={productLayout !== 'list-text' ? 9 : 8} className="staged-cart-table__cell py-16 text-center">
                                    <div className="flex flex-col items-center justify-center text-center gap-2">
                                      <ShoppingCart size={54} strokeWidth={1.5} className={cn("staged-cart-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                                      <p className={cn("staged-cart-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Terminal Awaiting Input</p>
                                      <p className={cn("staged-cart-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add transaction items to begin staging process</p>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                <AnimatePresence mode="popLayout">
                                  {cart.map((item, index) => {
                                  const rowDiscount = item.discount ?? (item.originalPrice ? item.originalPrice - (item.priceOverride ?? item.price) : 0);
                                  const borderClass = theme === 'dark' ? "border-white/25" : "border-slate-400";

                                  return (
                                    <motion.tr 
                                      key={item.id}
                                      layout
                                      initial={{ opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      className={cn(
                                        "group cursor-pointer transition-colors duration-200 border-b last:border-0",
                                        theme === 'dark' ? "border-white/25 hover:bg-brand-primary/5 text-white" : "border-slate-400 hover:bg-black/[0.025] text-black"
                                      )}
                                    onDoubleClick={() => {
                                      setSelectedProductForCart(item);
                                      setEditingCartItem(item);
                                      setOverridePrice((item.priceOverride ?? item.price).toString());
                                      setPopupQuantity(item.quantity);
                                      setIsProductDetailOpen(true);
                                    }}
                                  >
                                    {/* Line Number */}
                                    <td className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 border-b group-last:border-0", borderClass)}>
                                      <div className={cn(
                                        "font-mono text-xs font-black group-hover:opacity-100 group-hover:text-cyan-400 transition-all duration-200",
                                        theme === 'dark' ? 'text-white' : 'opacity-35 text-slate-800'
                                      )}>
                                        {(index + 1).toString().padStart(2, '0')}
                                      </div>
                                    </td>

                                    {/* Pic column */}
                                    {productLayout !== 'list-text' && (
                                      <td className={cn("px-3 lg:px-6 py-2.5 border-b group-last:border-0", borderClass)}>
                                        <div className="flex justify-center">
                                          <div className={cn(
                                            "rounded-lg overflow-hidden border shrink-0 w-10 h-10 flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm",
                                            theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-300 shadow-inner"
                                          )}>
                                            {item.imageUrl ? (
                                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover animate-in fade-in duration-300" referrerPolicy="no-referrer" />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 dark:from-[#0d0d0d] dark:to-[#1a1a1a] text-dark-muted">
                                                <Package size={16} className="text-[#888] dark:text-[#555] group-hover:text-brand-primary transition-colors duration-200" />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    )}

                                    {/* Code */}
                                    <td className={cn("px-3 lg:px-6 py-3.5 border-b group-last:border-0 font-mono text-xs font-medium", borderClass)}>
                                      {item.barcode || item.sku || item.id.slice(-6).toUpperCase()}
                                    </td>

                                    {/* Product Name */}
                                    <td className={cn("px-3 lg:px-6 py-3.5 border-b group-last:border-0 min-w-0", borderClass)}>
                                      <h4 className={cn(
                                        "font-black uppercase tracking-tight text-xs lg:text-sm truncate group-hover:text-cyan-400 transition-colors duration-200",
                                        theme === 'dark' ? "text-white" : "text-black"
                                      )}>{item.name}</h4>
                                      {item.priceOverride && (
                                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 mt-1 inline-block">Override</span>
                                      )}
                                    </td>

                                    {/* Quantity with interactive steppers */}
                                    <td className={cn("px-3 lg:px-6 py-3.5 border-b group-last:border-0 text-center", borderClass)}>
                                      <span className={cn(
                                        "font-mono text-xs md:text-sm font-black text-center inline-block",
                                        theme === 'dark' ? "text-white" : "text-black"
                                      )}>
                                        {item.quantity}
                                      </span>
                                    </td>

                                    {/* Price */}
                                    <td className={cn("px-3 lg:px-6 py-3 border-b group-last:border-0 text-left font-mono text-xs font-bold", borderClass)}>
                                      {formatCurrency(item.price, currency)}
                                    </td>

                                    {/* Discount */}
                                    <td className={cn("px-3 lg:px-6 py-3 border-b group-last:border-0 text-left font-mono text-xs font-bold text-green-500", borderClass)}>
                                      {rowDiscount > 0 ? `-${formatCurrency(rowDiscount, currency)}` : formatCurrency(0, currency)}
                                    </td>

                                    {/* Total */}
                                    <td className={cn("px-3 lg:px-6 py-3 border-b group-last:border-0 text-left font-mono text-xs font-bold", borderClass)}>
                                      <div className={cn(
                                        "font-mono text-xs md:text-sm font-black",
                                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                                      )}>
                                        {formatCurrency((item.priceOverride ?? item.price) * item.quantity, currency)}
                                      </div>
                                    </td>

                                    {/* Action buttons */}
                                    <td className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-3 border-b group-last:border-0 text-center", borderClass)}>
                                      <div className="flex justify-center items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedProductForCart(item);
                                            setEditingCartItem(item);
                                            setOverridePrice((item.priceOverride ?? item.price).toString());
                                            setPopupQuantity(item.quantity);
                                            setIsProductDetailOpen(true);
                                          }}
                                          className={cn(
                                            "w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200 hover:scale-105 shrink-0 cursor-pointer",
                                            theme === 'dark' 
                                              ? "bg-black/40 border-white/20 text-cyan-400 hover:bg-cyan-500/10" 
                                              : "bg-white border-slate-300 text-[#062A95] hover:bg-slate-100"
                                          )}
                                          title="Edit Details / Override Price"
                                        >
                                          <Edit3 size={12} />
                                        </button>

                                      </div>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </AnimatePresence>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                    {/* Unified Mobile Optimized Cart Layout (Visible only on mobile/tablet viewports when not in grid layout) */}
                    {productLayout !== 'grid' && (
                      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        {cart.length === 0 ? (
                          /* BLOCK: Empty Mobile Cart Card View */
                          <div className={cn(
                            "staged-cart-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft col-span-full",
                            theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                          )}>
                            <ShoppingCart size={54} strokeWidth={1.5} className={cn("staged-cart-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                            <p className={cn("staged-cart-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Terminal Awaiting Input</p>
                            <p className={cn("staged-cart-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add transaction items to begin staging process</p>
                          </div>
                        ) : (
                          <AnimatePresence mode="popLayout">
                            {cart.map((item, index) => {
                          const rowDiscount = item.discount ?? (item.originalPrice ? item.originalPrice - (item.priceOverride ?? item.price) : 0);
                          return (
                            <motion.div 
                              key={item.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={cn(
                                "p-3 rounded-2xl border flex flex-col gap-3 w-full cursor-pointer select-none transition-all duration-300 hover:shadow-hard",
                                theme === 'dark' ? "bg-dark-surface border-white/20 hover:border-brand-primary/50" : "bg-white border-slate-300 hover:border-black shadow-sm"
                              )}
                              onDoubleClick={() => {
                                setSelectedProductForCart(item);
                                setEditingCartItem(item);
                                setOverridePrice((item.priceOverride ?? item.price).toString());
                                setPopupQuantity(item.quantity);
                                setIsProductDetailOpen(true);
                              }}
                            >
                              {/* Upper Section */}
                              <div className="flex gap-3 items-center w-full">
                                {productLayout !== 'list-text' && (
                                  <div className={cn(
                                    "rounded-lg overflow-hidden border shrink-0 w-10 h-10 flex items-center justify-center",
                                    theme === 'dark' ? "bg-black border-white/15" : "bg-light-bg border-slate-300 shadow-inner"
                                  )}>
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 dark:from-[#0d0d0d] dark:to-[#1a1a1a] text-dark-muted">
                                        <Package size={14} className="text-[#888] dark:text-[#555]" />
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-1">
                                    <h4 className={cn(
                                      "font-black uppercase  tracking-tighter leading-tight text-xs line-clamp-1",
                                      theme === 'dark' ? "text-white" : "text-black"
                                    )}>{limitLetters(item.name, 30)}</h4>
                                    {item.priceOverride && (
                                      <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 shrink-0">Override</span>
                                    )}
                                  </div>
                                  
                                  {/* Line #, Barcode and Qty on the line under the product name */}
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className="text-[8px] font-black uppercase text-[#888]">
                                      Line {(index + 1).toString().padStart(2, '0')}
                                    </span>
                                    <span className={cn(
                                      "px-1 py-0.5 rounded text-[8px] font-mono leading-none border uppercase tracking-tight",
                                      theme === 'dark' 
                                        ? "bg-[#111] border-white/10 text-brand-primary" 
                                        : "bg-slate-100 border-slate-300 text-slate-800 font-semibold"
                                    )}>
                                      {item.barcode || item.sku || item.id.slice(-6).toUpperCase()}
                                    </span>
                                    <span className={cn(
                                      "px-1 py-0.5 rounded text-[8px] font-mono leading-none border uppercase tracking-tight font-black",
                                      theme === 'dark' ? "bg-black border-white/15 text-white" : "bg-slate-100 border-slate-300 text-slate-900"
                                    )}>
                                      QTY: {item.quantity}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Financial footer with Total under Price & Discount */}
                              <div className={cn(
                                "flex flex-col gap-1 p-2.5 rounded-lg border text-[10px] font-mono font-bold",
                                theme === 'dark' ? "bg-black/40 border-white/10" : "bg-slate-50 border-slate-200"
                              )}>
                                <div className="grid grid-cols-2 gap-2 pb-1 border-b border-dashed border-slate-300 dark:border-white/10">
                                  <div>
                                    <span className="text-[8px] uppercase tracking-wider text-dark-muted block leading-none mb-1">Price</span>
                                    <span className={theme === 'dark' ? "text-white font-black" : "text-black font-black"}>{formatCurrency(item.price, currency)}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8px] uppercase tracking-wider text-dark-muted block leading-none mb-1">Discount</span>
                                    <span className="text-green-500 font-black block">{rowDiscount > 0 ? `-${formatCurrency(rowDiscount, currency)}` : formatCurrency(0, currency)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-[8px] uppercase tracking-wider text-dark-muted">Total</span>
                                  <span className={cn("font-black text-right block text-xs", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")}>
                                    {formatCurrency((item.priceOverride ?? item.price) * item.quantity, currency)}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                    </div>
                    )}

                    {/* Subtotal, VAT, Discounts Breakdown */}
                    <div className={cn(
                      "block mt-6 p-5 rounded-2xl border-2 space-y-3 font-mono text-sm tracking-tight w-full max-w-md ml-auto shadow-soft transition-all duration-300",
                      theme === 'dark' ? "bg-dark-surface border-white/20" : "bg-light-surface border-slate-300"
                    )}>
                      <div className="flex items-center justify-between text-dark-muted">
                        <span className="text-xs uppercase font-extrabold tracking-wider">Subtotal</span>
                        <span className={theme === 'dark' ? "text-white" : "text-black"}>
                          {formatCurrency(originalSubtotal, currency)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-green-500 py-1.5 border-t border-b border-dashed border-inherit my-1 select-none">
                        <span className="text-xs uppercase font-extrabold tracking-wider">Discount Amt</span>
                        <span className="font-extrabold font-mono text-xs">
                          {totalDiscount > 0 ? `-${formatCurrency(totalDiscount, currency)}` : formatCurrency(0, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-dark-muted">
                        <span className="text-xs uppercase font-extrabold tracking-wider">
                          {taxType === 'none' 
                            ? "VAT (No Tax)" 
                            : taxType === 'inclusive' 
                              ? `VAT (${(taxRate * 100).toFixed(1)}% Incl)` 
                              : `VAT (${(taxRate * 100).toFixed(1)}%)`}
                        </span>
                        <span className={theme === 'dark' ? "text-white" : "text-black"}>
                          {formatCurrency(tax, currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-300 dark:border-white/15 font-bold">
                        <span className={cn("text-xs uppercase font-black tracking-wider", theme === 'dark' ? "text-white" : "text-black")}>Total Due</span>
                        <span className={cn("text-base font-black tracking-tight", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")}>
                          {formatCurrency(total, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
            </div>
          </div>
          </>
        )}

          {/* BLOCK: Cashsale Receipt Verification View - Allows searching/scanning and inspecting verified cashsale receipts */}
          {activeView === 'verify' && (
            <div className="verify-tab verify-tab--active space-y-6 flex-1 flex flex-col min-h-0">
              {/* BLOCK: Receipt Verification Toolbar - Single line layout styled similar to checkout bar */}
              <div className={cn(
                "verify-toolbar flex flex-col md:flex-row items-center gap-3 sm:gap-4 p-3 px-5 rounded-2xl border transition-all duration-300 shadow-md w-full justify-between shrink-0",
                theme === 'dark' 
                  ? "verify-toolbar--dark bg-[#041a5c]/40 border-[#123ebd]/50 shadow-lg shadow-black/20 backdrop-blur-md text-white" 
                  : "verify-toolbar--light bg-white/90 border-slate-200/80 shadow-sm text-slate-900"
              )}>
                {/* BLOCK: Toolbar Title Label */}
                <div className="verify-toolbar__title-group flex items-center gap-2.5 shrink-0">
                  <span className="verify-toolbar__icon p-2 rounded-xl bg-brand-primary/10 text-brand-primary shrink-0">
                    <ShieldCheck size={20} />
                  </span>
                  <div>
                    <h2 className="verify-toolbar__title text-xs md:text-sm font-black uppercase tracking-wider leading-none">
                      Cash Sale Receipt Verification
                    </h2>
                    <p className="verify-toolbar__subtitle text-[10px] text-slate-400 opacity-80 mt-1 hidden lg:block">
                      Scan barcode or enter receipt ID to verify authenticity
                    </p>
                  </div>
                </div>

                {/* BLOCK: Inline Verification Search Form */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerifyReceipt();
                  }}
                  className="verify-toolbar__form flex-1 flex items-center gap-2 max-w-2xl w-full"
                >
                  <div className="verify-toolbar__input-wrapper relative flex-1">
                    <div className="verify-toolbar__input-icon absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Barcode size={18} />
                    </div>
                    <input
                      type="text"
                      value={verifyQuery}
                      onChange={(e) => setVerifyQuery(e.target.value)}
                      placeholder="Scan barcode or enter Cash Sale Receipt ID (e.g. TX-1721832941)..."
                      className={cn(
                        "verify-toolbar__input w-full pl-10 pr-8 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider border focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all shadow-inner",
                        theme === 'dark' 
                          ? "bg-black/40 border-white/15 text-white placeholder:text-slate-500" 
                          : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
                      )}
                      autoFocus
                    />
                    {verifyQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyQuery('');
                          setSearchedReceiptId(null);
                          setVerifyResult(null);
                          setVerifyStatus('idle');
                        }}
                        className="verify-toolbar__clear-btn absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || !verifyQuery.trim()}
                    className={cn(
                      "verify-toolbar__submit-btn h-10 px-5 rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-sm active:scale-95",
                      !verifyQuery.trim()
                        ? "opacity-50 cursor-not-allowed bg-slate-500/15 border border-slate-500/20 text-slate-400"
                        : (theme === 'dark'
                            ? "bg-brand-primary border border-brand-primary text-black hover:brightness-110 shadow-brand-primary/20"
                            : "bg-black border border-black text-white hover:bg-slate-900 shadow-slate-900/10")
                    )}
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Search size={15} />
                        <span>Verify Receipt</span>
                      </>
                    )}
                  </button>
                </form>

                {/* BLOCK: Reset/Clear Button */}
                {searchedReceiptId && (
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyQuery('');
                      setSearchedReceiptId(null);
                      setVerifyResult(null);
                      setVerifyStatus('idle');
                    }}
                    className={cn(
                      "verify-toolbar__reset-btn h-10 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer flex items-center gap-1.5 shrink-0",
                      theme === 'dark' ? "bg-white/5 border-white/10 hover:bg-white/10 text-slate-300" : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                    )}
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* BLOCK: Idle State Barcode Scanner Prompt */}
              {verifyStatus === 'idle' && (
                <div className={cn(
                  "verify-idle-card p-10 md:p-14 rounded-3xl border shadow-lg flex-1 flex flex-col items-center justify-center text-center space-y-5 max-w-2xl mx-auto w-full my-4",
                  theme === 'dark' ? "bg-dark-surface/40 border-dark-border text-white" : "bg-white border-slate-200 text-slate-900"
                )}>
                  <div className={cn(
                    "verify-idle-card__icon p-5 rounded-2xl border-2 shadow-inner",
                    theme === 'dark' ? "bg-brand-primary/10 border-brand-primary/20 text-brand-primary" : "bg-slate-100 border-slate-200 text-slate-700"
                  )}>
                    <Barcode size={44} />
                  </div>
                  <div className="verify-idle-card__content space-y-2 max-w-md">
                    <h3 className="verify-idle-card__title text-base font-black uppercase tracking-wider">
                      Awaiting Cash Sale Barcode Scan
                    </h3>
                    <p className="verify-idle-card__desc text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Scan a receipt barcode or enter a Cash Sale Receipt ID in the toolbar above to verify authenticity and inspect the itemized receipt slip.
                    </p>
                  </div>
                </div>
              )}

              {/* BLOCK: Unrecognized Receipt ID Alert Card */}
              {verifyStatus === 'invalid' && (
                <div className={cn(
                  "verify-invalid-card p-8 rounded-3xl border-2 shadow-xl flex flex-col items-center justify-center text-center space-y-4 max-w-xl mx-auto w-full my-6",
                  theme === 'dark'
                    ? "bg-red-500/10 border-red-500/40 text-white"
                    : "bg-red-50 border-red-200 text-slate-900"
                )}>
                  <div className="verify-invalid-card__icon p-4 rounded-2xl bg-red-500/20 text-red-500">
                    <AlertCircle size={36} />
                  </div>
                  <div className="verify-invalid-card__content max-w-md space-y-2">
                    <span className="verify-invalid-card__badge px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500 text-white">
                      Unrecognized Receipt ID
                    </span>
                    <h3 className="verify-invalid-card__title text-base font-black uppercase tracking-wide text-red-500">
                      Receipt Not Found
                    </h3>
                    <p className="verify-invalid-card__id font-mono text-xs bg-black/20 p-2.5 rounded-xl border border-red-500/20 text-red-400 font-bold break-all">
                      Scanned ID: "{searchedReceiptId}"
                    </p>
                    <p className="verify-invalid-card__desc text-xs opacity-80 leading-relaxed">
                      No matching cash sale transaction was found in the system for this identifier. Please check for typos or re-scan the barcode directly.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyQuery('');
                      setSearchedReceiptId(null);
                      setVerifyStatus('idle');
                    }}
                    className="verify-invalid-card__retry-btn px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                  >
                    Try Scanning Again
                  </button>
                </div>
              )}

              {/* BLOCK: Verified Scanned Cashsale Receipt Slip Inspector */}
              {verifyStatus === 'found' && verifyResult && (
                <div className="verify-slip-wrapper space-y-6 flex-1 flex flex-col items-center justify-center pb-6">
                  {/* BLOCK: Verified Top Status Seal Bar */}
                  <div className="verify-slip-banner w-full max-w-xl p-4 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-500 flex items-center justify-between gap-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={24} className="shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest">Genuine Verified Cash Sale Receipt</p>
                        <p className="text-[11px] opacity-90 font-mono">
                          Transaction ID: <span className="font-bold">{verifyResult.id}</span>
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-black shrink-0">
                      Authenticated
                    </span>
                  </div>

                  {/* BLOCK: Thermal Cash Sale Receipt Slip Card - Itemized transaction preview */}
                  <div className={cn(
                    "verify-receipt-slip-card w-full max-w-xl rounded-3xl border-2 p-6 md:p-8 font-mono text-xs shadow-2xl relative overflow-hidden transition-all",
                    theme === 'dark' 
                      ? "verify-receipt-slip-card--dark bg-[#0c1427] border-brand-primary/30 text-slate-100 shadow-brand-primary/5" 
                      : "verify-receipt-slip-card--light bg-white border-slate-300 text-slate-900"
                  )}>
                    {/* Header Details & Barcode Visual */}
                    <div className="verify-receipt-slip-card__header text-center space-y-3 pb-6 border-b-2 border-dashed border-slate-300 dark:border-white/20">
                      <div className="verify-receipt-slip-card__badge-row flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-500 font-presale text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                          Official Cash Sale Slip
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {formatReceiptTimestamp(verifyResult.timestamp || verifyResult.createdAt)}
                        </span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <h3 className="verify-receipt-slip-card__store-title text-xl font-black uppercase tracking-widest font-presale">{storeInfo.name || 'MEGAPOS'}</h3>
                        <p className="verify-receipt-slip-card__store-detail text-[10px] text-slate-400 uppercase tracking-wider">{[storeInfo.streetNumber, storeInfo.streetName, storeInfo.suburb].filter(Boolean).join(' ') || 'Retail Terminal Location'}</p>
                        <p className="verify-receipt-slip-card__store-detail text-[10px] text-slate-400 uppercase tracking-wider">TEL: {storeInfo.phoneNumber || '+1 (800) 555-0199'} • REG #{storeInfo.registrationNumber || 'POS-8802'}</p>
                      </div>

                      {/* Barcode Line Artwork */}
                      <div className="verify-receipt-slip-card__barcode-wrapper pt-3 flex flex-col items-center justify-center space-y-1.5">
                        <div className="verify-receipt-slip-card__barcode-box h-12 w-56 bg-slate-900 dark:bg-slate-200 rounded px-3 py-1.5 flex items-center justify-between">
                          {[4, 2, 6, 1, 3, 5, 2, 7, 3, 1, 4, 2, 6, 3, 5, 2, 4, 1, 6, 3, 2, 5, 4, 2].map((w, idx) => (
                            <div key={idx} className={cn("h-full bg-white dark:bg-slate-900 rounded-xs", w === 7 ? "w-1.5" : w > 4 ? "w-1" : "w-0.5")} />
                          ))}
                        </div>
                        <span className="verify-receipt-slip-card__barcode-text text-xs font-mono font-bold tracking-widest text-brand-primary">{verifyResult.id}</span>
                      </div>
                    </div>

                    {/* BLOCK: Receipt Slip Transaction Particulars */}
                    <div className="verify-receipt-slip-card__particulars py-4 space-y-2.5 border-b-2 border-dashed border-slate-300 dark:border-white/20 text-[11px]">
                      <div className="verify-receipt-slip-card__particular-row flex justify-between items-center">
                        <span className="text-slate-400">CUSTOMER:</span>
                        <span className="font-bold uppercase text-right">{verifyResult.customerName || 'Walk-in Customer'}</span>
                      </div>
                      <div className="verify-receipt-slip-card__particular-row flex justify-between items-center">
                        <span className="text-slate-400">PAYMENT METHOD:</span>
                        <span className="font-bold uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {verifyResult.paymentMethod || 'CASH'}
                        </span>
                      </div>
                      <div className="verify-receipt-slip-card__particular-row flex justify-between items-center">
                        <span className="text-slate-400">REGISTER CASHIER:</span>
                        <span className="font-bold uppercase">{verifyResult.cashierId || 'Terminal Cashier'}</span>
                      </div>
                      <div className="verify-receipt-slip-card__particular-row flex justify-between items-center">
                        <span className="text-slate-400">VERIFICATION STATUS:</span>
                        <span className="font-bold uppercase text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          PAID & AUTHENTICATED
                        </span>
                      </div>
                    </div>

                    {/* BLOCK: Scanned Items Slip Cards / Items Table */}
                    <div className="verify-receipt-slip-card__items py-4 space-y-3">
                      <div className="verify-receipt-slip-card__table-header grid grid-cols-12 text-[10px] font-black uppercase text-slate-400 tracking-wider pb-2 border-b border-slate-200 dark:border-white/10">
                        <span className="col-span-6">Item & Particulars</span>
                        <span className="col-span-3 text-right">Qty × Price</span>
                        <span className="col-span-3 text-right">Subtotal</span>
                      </div>

                      <div className="space-y-3 divide-y divide-slate-100 dark:divide-white/5">
                        {(verifyResult.items || []).map((item: any, idx: number) => {
                          const qty = item.quantity || 1;
                          const price = item.price || item.unitPrice || 0;
                          const lineSub = item.subtotal || (qty * price);
                          return (
                            <div key={idx} className="verify-receipt-slip-card__item-row pt-2.5 grid grid-cols-12 items-start gap-1 font-presale">
                              <div className="col-span-6 min-w-0 pr-2">
                                <p className="text-xs font-bold uppercase truncate text-slate-900 dark:text-slate-100">
                                  {item.name || 'Purchased Item'}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 uppercase">
                                  SKU: {item.barcode || item.sku || 'N/A'} {item.category ? `• ${item.category}` : ''}
                                </p>
                              </div>
                              <div className="col-span-3 text-right font-mono text-xs self-center">
                                <p className="font-bold text-slate-500 dark:text-slate-400">{qty} × {formatCurrency(price, currency)}</p>
                              </div>
                              <div className="col-span-3 text-right font-mono text-xs font-black text-emerald-500 self-center">
                                {formatCurrency(lineSub, currency)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* BLOCK: Receipt Slip Totals Breakdown */}
                    <div className="verify-receipt-slip-card__totals pt-4 border-t-2 border-dashed border-slate-300 dark:border-white/20 space-y-2 text-xs">
                      <div className="verify-receipt-slip-card__total-row flex justify-between text-slate-400">
                        <span>Subtotal Amount:</span>
                        <span>{formatCurrency(verifyResult.subtotal || verifyResult.totalAmount || 0, currency)}</span>
                      </div>
                      {verifyResult.discountAmount > 0 && (
                        <div className="verify-receipt-slip-card__total-row flex justify-between text-red-400">
                          <span>Discount Applied:</span>
                          <span>-{formatCurrency(verifyResult.discountAmount, currency)}</span>
                        </div>
                      )}
                      {verifyResult.tax > 0 && (
                        <div className="verify-receipt-slip-card__total-row flex justify-between text-slate-400">
                          <span>Tax (VAT):</span>
                          <span>{formatCurrency(verifyResult.tax, currency)}</span>
                        </div>
                      )}

                      <div className="verify-receipt-slip-card__total-row flex justify-between items-center pt-3 mt-2 border-t-2 border-slate-900 dark:border-white text-sm font-black font-presale">
                        <span className="uppercase tracking-wider">TOTAL PAID:</span>
                        <span className="text-emerald-500 font-mono text-base">{formatCurrency(verifyResult.totalAmount || verifyResult.amount || 0, currency)}</span>
                      </div>
                    </div>

                    {/* BLOCK: Bottom Receipt Footer */}
                    <div className="verify-receipt-slip-card__footer pt-6 mt-4 border-t border-slate-200 dark:border-white/10 text-center space-y-1.5 font-presale">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                        *** THANK YOU FOR YOUR BUSINESS ***
                      </p>
                      <p className="text-[9px] text-emerald-500/80 uppercase font-mono tracking-wider">
                        Official Digitally Verified Receipt
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>



      {/* Floating Mega Menu: Product Selection */}
      <AnimatePresence>
        {isProductsOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="register-mega-menu__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            />
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "popup-card register-mega-menu-popup-card relative w-[95%] sm:w-[92%] md:w-full max-w-5xl lg:max-w-6xl h-[80vh] md:h-[82vh] z-20 flex flex-col shadow-2xl border-2 rounded-2xl overflow-hidden transition-all",
                theme === 'dark' 
                  ? "bg-dark-surface/60 border-white/20 backdrop-blur-lg text-white" 
                  : "bg-white/60 border-light-border backdrop-blur-lg text-black"
              )}
            >
              {/* Menu Header */}
              {(() => {
                const isPresale = registerMode === 'presale';
                const headerBg = theme === 'dark'
                  ? "bg-transparent border-b border-white/10"
                  : "bg-transparent border-b border-black/10";

                const titleColor = theme === 'dark' ? "text-white" : "text-black";

                const subtitleColor = theme === 'dark' ? "text-dark-muted" : "text-light-muted";

                const inputClass = cn(
                  "w-full border-2 pl-10 pr-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wide outline-none transition-all",
                  theme === 'dark'
                    ? "bg-dark-bg/50 border-dark-border focus:border-brand-primary text-white placeholder-slate-500"
                    : "bg-white border-light-border focus:border-black text-[#0F172A] placeholder-slate-400"
                );

                const searchIconClass = theme === 'dark' ? "text-slate-500" : "text-slate-400";

                const filterBtnClass = cn(
                  "px-4 py-2.5 border-2 rounded-lg transition-all shrink-0 cursor-pointer no-gradient flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider h-[38px]",
                  isFilterOpen 
                    ? (theme === 'dark' ? "bg-brand-primary text-black border-brand-primary" : "bg-black text-white border-black")
                    : (theme === 'dark' ? "bg-black/20 border-dark-border text-dark-muted hover:bg-white/5" : "bg-white text-light-text border-light-border hover:bg-gray-50")
                );

                return (
                  <div className={cn("p-4 border-b shrink-0 relative", headerBg)}>
                    {/* Top Accent Strip */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />
                    
                    {/* Top Row: 3-Column Header to match Inventory style */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                      <div className="flex justify-start">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                          theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                        )}>
                          <ShoppingBag size={16} className="text-brand-primary" />
                        </div>
                      </div>

                      <div className="text-center flex flex-col items-center justify-center font-presale">
                        <h3 className={cn(
                          "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                          theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                        )}>
                          Product Library
                        </h3>
                        <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                          {isPresale ? '#Staging' : '#Checkout'}
                        </span>
                      </div>

                      <div className="flex justify-end">
                        <button 
                          type="button"
                          onClick={() => setIsProductsOpen(false)}
                          className={cn(
                            "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                            theme === 'dark' 
                              ? "bg-black/40 border-dark-border text-dark-muted hover:text-white" 
                              : "bg-white border-light-border text-light-muted hover:text-black"
                          )}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Controls Row: Search & Filters */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full mt-1">
                      <div className="relative flex-1">
                        <Search className={cn("absolute left-3.5 top-1/2 -translate-y-1/2", searchIconClass)} size={16} />
                        <input 
                          type="text" 
                          placeholder="IDENTIFY ASSET SIGNATURE..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const query = searchQuery.trim().toLowerCase();
                              if (query) {
                                let targetVarId: string | undefined;
                                const match = products.find(p => {
                                  if (p.barcode && p.barcode.toLowerCase() === query) return true;
                                  if (p.sku && p.sku.toLowerCase() === query) return true;
                                  if (p.variations) {
                                    const vMatch = p.variations.find(v => 
                                      (v.barcode && v.barcode.toLowerCase() === query) ||
                                      (v.sku && v.sku.toLowerCase() === query)
                                    );
                                    if (vMatch) {
                                      targetVarId = vMatch.id;
                                      return true;
                                    }
                                  }
                                  return false;
                                });
                                if (match) {
                                  if (match.variations && match.variations.length > 0) {
                                    openProductDetail(match, targetVarId);
                                  } else {
                                    addToCartValue(match);
                                  }
                                  setSearchQuery('');
                                  e.preventDefault();
                                }
                              }
                            }
                          }}
                          className={inputClass}
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={filterBtnClass}>
                          <Filter size={14} />
                          <span>Filters</span>
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isFilterOpen && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden mt-4"
                        >
                          <div className={cn(
                            "p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4",
                            theme === 'dark' ? "bg-black/30 border-dark-border" : "bg-gray-50 border-light-border shadow-inner"
                          )}>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                                Filter by Category
                              </label>
                              <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className={cn(
                                  "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                                  theme === 'dark' 
                                    ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                                    : "bg-white border-light-border text-black focus:border-black"
                                )}
                              >
                                <option value="all">ALL ASSETS / CATEGORIES</option>
                                {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                                Stock Filter
                              </label>
                              <select 
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value as any)}
                                className={cn(
                                  "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                                  theme === 'dark' 
                                    ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                                    : "bg-white border-light-border text-black focus:border-black"
                                )}
                              >
                                <option value="all">ALL STOCK LEVELS</option>
                                <option value="critical">CRITICAL (OUT OF STOCK)</option>
                                <option value="low-stock">LOW STOCK INDICATOR</option>
                                <option value="healthy">HEALTHY STOCK SURPLUS</option>
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* Product Grid Reusing the Matrix Helper */}
              <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-2 md:px-6 md:pb-6 md:pt-3 no-scrollbar">
                {renderProductMatrix(true)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             onClick={handleBackdropClick}
             className="register-checkout-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={cn(
              "popup-card register-checkout-popup-card relative w-full max-w-lg md:max-w-xl mx-4 my-auto z-20 flex flex-col shadow-hard border-2 rounded-xl overflow-hidden max-h-[90vh] md:max-h-[85vh] transition-all",
              theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
            )}
          >
            <div className={cn(
              "p-5 md:p-6 border-b shrink-0 flex items-center justify-between",
              theme === 'dark' ? "bg-dark-surface border-dark-border text-white" : "bg-light-surface border-light-border text-black"
            )}>
              <div>
                <h2 className={cn("text-xl font-black uppercase  tracking-tighter", theme === 'dark' ? "text-white" : "text-black")}>Checkout</h2>
                <p className={cn("text-xs opacity-60 mt-1", theme === 'dark' ? "text-white/60" : "text-black/60")}>Select a payment method to complete</p>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 shrink-0 border-black/10 text-black hover:bg-black/5",
                  theme === 'dark' ? "border-white/10 text-white hover:bg-white/5" : "border-black/10 text-black hover:bg-black/5"
                )}
              >
                <ArrowLeft size={20} />
              </button>
            </div>
            
            <div className="p-5 md:p-6 space-y-6 overflow-y-auto flex-1">
              <div className="flex gap-4">
                  {registerMode === 'presale' && (
                    <button 
                      onClick={handleRequestPresale}
                      disabled={isSubmitting || loading}
                      className={cn(
                        "flex-1 p-6 border rounded-xl transition-all group flex flex-col items-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                        theme === 'dark' ? "bg-brand-primary text-black border-brand-primary" : "bg-black text-white border-black"
                      )}
                    >
                      <RefreshCw size={28} className={cn(isSubmitting ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500")} />
                      <span className="text-xs font-black uppercase tracking-widest">{isSubmitting ? "Creating..." : "Create Presale"}</span>
                    </button>
                  )}
                  <div className={cn(
                    registerMode === 'presale' ? "flex-[1.5]" : "flex-1",
                    "text-center p-6 border rounded-xl flex flex-col justify-center",
                    theme === 'dark' ? "bg-[#1A1A1A] border-[#222]" : "bg-[#F9F9F9] border-[#EEE]"
                  )}>
                    <p className="text-[#666] text-[8px] uppercase tracking-[0.2em] mb-1">Total Liquidation</p>
                    <p className="text-3xl font-black font-mono tracking-tighter">{formatCurrency(total, currency)}</p>
                  </div>
              </div>

              {registerMode === 'cashsale' && (
                <div className="space-y-4">
                  {role === 'Rep' ? (
                    <div className={cn(
                      "p-6 border rounded-xl flex flex-col items-center gap-3 text-center",
                      theme === 'dark' ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-100"
                    )}>
                      <Lock size={24} className="text-red-500" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-red-500">Operation Restricted</p>
                        <p className="text-[10px] uppercase tracking-widest opacity-40 mt-1">Staged assets must be processed through the Presales Portal by an authorized validator.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Linked Customer checkout panel */}
                      {selectedCustomer && (
                        <div className={cn(
                          "p-4 rounded-xl border flex flex-col gap-3",
                          theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-[#F9F9F9] border-light-border"
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserIcon size={16} className="text-brand-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Linked Client Account</span>
                            </div>
                            <span className="text-[10px] font-mono font-black border border-brand-primary/40 text-brand-primary px-2 py-0.5 rounded">
                              {selectedCustomer.customerId || 'LINKED'}
                            </span>
                          </div>
                          
                          <div>
                            <p className="text-xs font-black uppercase">{selectedCustomer.name}</p>
                          </div>

                          {(() => {
                            const limitVal = selectedCustomer.allowBalance ? (selectedCustomer.balanceLimit || 0) : 0;
                            const balanceVal = selectedCustomer.accountBalance || 0;
                            const totalAvailable = balanceVal + limitVal;
                            
                            return (
                              <>
                                <div className="space-y-1 mt-1.5 border-t border-black/5 dark:border-white/5 pt-2">
                                  <p className="text-[10px] uppercase font-bold opacity-60">Account Balance: <span className="font-mono font-bold text-cyan-500">{formatCurrency(balanceVal, currency)}</span></p>
                                  <p className="text-[10px] uppercase font-bold opacity-60">Credit Line Limit: <span className="font-mono font-bold">{selectedCustomer.allowBalance ? formatCurrency(limitVal, currency) : 'Disallowed'}</span></p>
                                  <p className="text-[10px] uppercase font-black text-brand-primary">Total Spending Power: <span className="font-mono font-black">{formatCurrency(totalAvailable, currency)}</span></p>
                                </div>

                                <div className="pt-2">
                                  {totalAvailable >= total ? (
                                    <button
                                      type="button"
                                      onClick={() => setChargeToCustomerCredit(!chargeToCustomerCredit)}
                                      className={cn(
                                        "w-full p-2.5 rounded-lg border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                                        chargeToCustomerCredit
                                          ? (theme === 'dark' ? "bg-brand-primary text-black border-brand-primary" : "bg-black text-white border-black")
                                          : (theme === 'dark' ? "bg-dark-background border-[#333] text-white/70 hover:text-white" : "bg-white border-[#EEE] text-black/70 hover:text-black")
                                      )}
                                    >
                                      <input 
                                        type="checkbox" 
                                        checked={chargeToCustomerCredit} 
                                        onChange={() => {}} // handled by click
                                        className="accent-brand-primary pointer-events-none"
                                      />
                                      <span>Charge Sale to Account Balance</span>
                                    </button>
                                  ) : (
                                    <div className={cn(
                                      "p-3 rounded-lg border text-center text-xs font-bold uppercase tracking-wide",
                                      theme === 'dark' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-100 text-red-700"
                                    )}>
                                      ⚠️ Insufficient spending power ({formatCurrency(totalAvailable, currency)}) for this {formatCurrency(total, currency)} purchase.
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Payment Methods or Account Charging toggle */}
                      {chargeToCustomerCredit ? (
                        <div className="space-y-3">
                          <button
                            onClick={() => handleCompleteSale(PaymentMethod.CARD, undefined)}
                            className={cn(
                              "w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95",
                              theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110" : "bg-black text-white hover:bg-gray-900"
                            )}
                          >
                            <CreditCard size={18} />
                            <span>Confirm & Charge to Client Account</span>
                          </button>
                          
                          <p className="text-[10px] text-center opacity-40 uppercase tracking-widest font-bold">
                            Client will be registered with R {total.toFixed(2)} debt and limit will decrease.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: PaymentMethod.CASH, label: 'Cash', icon: Banknote },
                          { id: PaymentMethod.CARD, label: 'Card', icon: CreditCard },
                          { id: PaymentMethod.UPI, label: 'Card Reader', icon: Smartphone },
                        ].map(method => {
                          const isSelected = selectedCheckoutMethod === method.id;
                          return (
                            <button 
                              key={method.id}
                              onClick={() => {
                                if (method.id === PaymentMethod.CASH) {
                                  setSelectedCheckoutMethod(PaymentMethod.CASH);
                                } else {
                                  setSelectedCheckoutMethod(method.id as PaymentMethod);
                                  handleCompleteSale(method.id as PaymentMethod);
                                }
                              }}
                              className={cn(
                                "flex flex-col items-center gap-3 p-4 border rounded-xl transition-all group",
                                isSelected
                                  ? "bg-brand-primary text-black border-brand-primary"
                                  : (theme === 'dark' ? "bg-[#222] border-[#333] hover:border-[#888] hover:bg-[#333]" : "bg-[#F5F5F5] border-[#EEE] hover:border-[#CCC] hover:bg-white")
                              )}
                            >
                              <div className={cn(
                                "p-3 rounded-full group-hover:scale-110 transition-all",
                                isSelected
                                  ? "bg-black/10 text-black"
                                  : (theme === 'dark' ? "bg-[#333] text-[#E4E3E0]" : "bg-white text-[#141414] shadow-sm")
                              )}>
                                <method.icon size={24} />
                              </div>
                              <span className="text-xs font-bold uppercase tracking-widest">{method.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {selectedCheckoutMethod === PaymentMethod.CASH && !chargeToCustomerCredit && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "p-5 rounded-xl border space-y-4",
                            theme === 'dark' ? "bg-black/45 border-dark-border" : "bg-gray-100/60 border-light-border"
                          )}
                        >
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={cn(
                                "block text-[10px] font-black uppercase tracking-widest mb-1.5",
                                theme === 'dark' ? "text-dark-muted" : "text-light-muted"
                              )}>
                                Cash Tendered
                              </label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold opacity-50">
                                  {currency === 'USD' ? '$' : 'R'}
                                </span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="0.00"
                                  value={tenderedAmount}
                                  onChange={(e) => setTenderedAmount(e.target.value)}
                                  className={cn(
                                    "w-full pl-8 pr-3 py-2.5 rounded-lg border font-mono font-black text-lg outline-none transition-all",
                                    theme === 'dark' ? "bg-black border-dark-border focus:border-brand-primary text-white" : "bg-white border-light-border focus:border-black text-black"
                                  )}
                                  autoFocus
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className={cn(
                                "block text-[10px] font-black uppercase tracking-widest mb-1.5",
                                theme === 'dark' ? "text-dark-muted" : "text-light-muted"
                              )}>
                                Change Due
                              </label>
                              <div className={cn(
                                "w-full px-4 py-2.5 rounded-lg border font-mono font-black text-lg flex items-center justify-between",
                                theme === 'dark' ? "bg-black/30 border-dark-border text-green-400" : "bg-white border-light-border text-green-600"
                              )}>
                                <span>{currency === 'USD' ? '$' : 'R'}</span>
                                <span>
                                  {(() => {
                                    const tendered = parseFloat(tenderedAmount) || 0;
                                    const change = Math.max(0, tendered - total);
                                    return change.toFixed(2);
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button 
                            disabled={!tenderedAmount || parseFloat(tenderedAmount) < total}
                            onClick={() => handleCompleteSale(PaymentMethod.CASH, parseFloat(tenderedAmount))}
                            className={cn(
                              "w-full py-3.5 rounded-lg font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95",
                              (!tenderedAmount || parseFloat(tenderedAmount) < total)
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300 opacity-50 animate-none"
                                : (theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110" : "bg-black text-white hover:bg-gray-900")
                            )}
                          >
                            <CheckCircle size={16} />
                            Complete Cash Sale
                          </button>
                        </motion.div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className={cn(
              "p-6 flex gap-3",
              theme === 'dark' ? "bg-[#1A1A1A]" : "bg-[#F9F9F9]"
            )}>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className={cn(
                  "flex-1 py-4 font-bold border rounded-lg transition-colors uppercase tracking-[0.2em] text-xs",
                  theme === 'dark' ? "border-[#333] hover:bg-[#333]" : "border-[#EEE] hover:bg-white hover:border-[#CCC]"
                )}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success Transaction Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/15 backdrop-blur-[1px]"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn(
                "w-full max-w-md border rounded-xl p-10 text-center shadow-2xl space-y-8",
                theme === 'dark' ? "bg-[#141414] border-[#222]" : "bg-white border-[#EEE]"
              )}
            >
              <div className="space-y-4">
                <div className="flex justify-center">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
                    className="w-24 h-24 rounded-xl bg-green-500 flex items-center justify-center text-white"
                  >
                    <CheckCircle size={48} />
                  </motion.div>
                </div>
                <h2 className="text-3xl font-black uppercase  tracking-tighter text-green-500">Operation Successful</h2>
                <p className="text-xs uppercase tracking-[0.2em] text-[#666]">Reference ID: <span className="font-mono text-inherit">{lastTransactionId}</span></p>

                {lastTendered !== null && lastTendered !== undefined && (
                  <div className={cn(
                    "p-4 rounded-xl border text-left space-y-2 mt-4",
                    theme === 'dark' ? "bg-black/40 border-dark-border" : "bg-gray-100/60 border-light-border"
                  )}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">Cash Settlement Breakdown</p>
                    <div className="flex justify-between font-mono text-sm">
                      <span className="opacity-60">Tendered:</span>
                      <span className={cn("font-extrabold", theme === 'dark' ? "text-white" : "text-black")}>
                        {formatCurrency(lastTendered, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-sm border-t border-inherit/25 pt-2">
                      <span className="opacity-60 text-green-500 font-bold">Change Due:</span>
                      <span className="font-extrabold text-green-500">{formatCurrency(lastChange ?? 0, currency)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => lastTransactionId && generatePresaleReceipt(lastTransactionId, true)}
                  className={cn(
                    "success-card__btn success-card__btn--print flex items-center justify-center gap-3 py-5 rounded-lg font-black uppercase tracking-widest text-[10px] border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm",
                    theme === 'dark' 
                      ? "bg-[#222] border-[#333] text-white hover:bg-[#333]" 
                      : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                  )}
                >
                  <Printer size={18} />
                  Print Receipt
                </button>
                <button 
                   onClick={() => {
                     setShowSuccess(false);
                     setActiveView('cart');
                     handleSetRegisterMode('presale');
                   }}
                   className={cn(
                    "success-card__btn success-card__btn--ledger flex items-center justify-center gap-3 py-5 rounded-lg font-black uppercase tracking-widest text-[10px] border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm",
                    theme === 'dark' 
                      ? "bg-[#222] border-[#333] text-white hover:bg-[#333]" 
                      : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                  )}
                >
                  <Eye size={18} />
                  View Ledger
                </button>
              </div>

              <button 
                onClick={() => setShowSuccess(false)}
                className={cn(
                  "success-card__btn success-card__btn--resume w-full py-6 rounded-lg font-black uppercase tracking-[0.3em] text-sm transition-all shadow-xl active:scale-95 cursor-pointer",
                  theme === 'dark' 
                    ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" 
                    : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                )}
              >
                Accept & Resume
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Presale Menu Overlay */}
      {presaleMenuAnchor && (
        <div className="fixed inset-0 z-[150]" onClick={() => setPresaleMenuAnchor(null)}>
          <div 
            className={cn(
              "absolute w-56 rounded-2xl border shadow-hard p-2 backdrop-blur-xl animate-in fade-in zoom-in duration-200",
              theme === 'dark' ? "bg-dark-surface/90 border-dark-border" : "bg-white/90 border-light-border"
            )}
            style={{ 
              top: Math.min(presaleMenuAnchor.y, window.innerHeight - 250), 
              left: Math.max(10, Math.min(window.innerWidth - 240, presaleMenuAnchor.x - 200))
            }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const ps = presales.find(p => p.id === presaleMenuAnchor.id);
              const isFinalized = ps?.status === 'Approved' || ps?.status === 'Voided';
              
              return [
                { id: 'view', label: 'View Details', icon: Eye, onClick: () => {
                  setViewingPresale(ps);
                  setIsViewPresaleOpen(true);
                  setPresaleMenuAnchor(null);
                }},
                { id: 'approve', label: 'Initiate Order', icon: CheckCircle, hide: isFinalized, onClick: () => {
                  setInitiatingPresale(ps);
                  setPresaleMenuAnchor(null);
                }},
                { id: 'edit', label: 'Edit Transaction', icon: Package, hide: isFinalized, onClick: () => {
                  setEditingPresale(ps);
                  setPresaleMenuAnchor(null);
                }},
                { id: 'view_receipt', label: 'View Receipt', icon: Eye, onClick: () => {
                  generatePresaleReceipt(presaleMenuAnchor.id, false);
                  setPresaleMenuAnchor(null);
                }},
                { id: 'print_receipt', label: 'Print Receipt', icon: Printer, onClick: () => {
                  generatePresaleReceipt(presaleMenuAnchor.id, true);
                  setPresaleMenuAnchor(null);
                }},
                { id: 'delete', label: 'Void Entry', icon: Trash2, color: 'text-red-500', hide: isFinalized, onClick: () => {
                  setVoidConfirmPresaleId(presaleMenuAnchor.id);
                  setPresaleMenuAnchor(null);
                }}
              ].filter(item => !item.hide).map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:translate-x-1 grayscale hover:grayscale-0",
                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
                  )}
                >
                  <item.icon size={16} className={item.color || "text-brand-primary"} />
                  <span className={cn("text-[10px] font-black uppercase tracking-widest", item.color)}>{item.label}</span>
                </button>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Viewing Presale Modal */}
      <AnimatePresence>
        {isViewPresaleOpen && viewingPresale && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <div className="register-view-presale-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10" onClick={handleBackdropClick} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "popup-card register-view-presale-popup-card relative w-full max-w-lg md:max-w-xl mx-4 my-auto z-20 rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all",
                theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <ShoppingBag size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Presale Details
                    </h3>
                    <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                      #{viewingPresale.id}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsViewPresaleOpen(false)}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === 'dark' 
                          ? "bg-black/40 border-dark-border text-dark-muted hover:text-white" 
                          : "bg-white border-light-border text-light-muted hover:text-black"
                      )}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-8 overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Operator/Customer</p>
                    <p className="text-lg font-black title-text">{viewingPresale.op}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Metric Amount</p>
                    <p className="text-2xl font-black  text-brand-primary">{formatCurrency(viewingPresale.amount, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Timestamp</p>
                    <p className="text-sm font-mono">{viewingPresale.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Current Status</p>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                      viewingPresale.status === 'Approved' ? "bg-green-500/10 text-green-500" : 
                      viewingPresale.status === 'Voided' ? "bg-red-500/10 text-red-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    )}>{viewingPresale.status}</span>
                  </div>
                </div>

                <div className="pt-8 border-t border-inherit">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-4">Itemized Ledger</p>
                   <div className="space-y-3">
                     {viewingPresale.items?.map((item: any, idx: number) => (
                       <div key={idx} className="flex justify-between items-center bg-black/10 p-3 rounded-lg">
                         <div>
                           <p className="text-xs font-black uppercase">{item.name}</p>
                           <p className="text-[9px] opacity-40">Qty: {item.quantity}</p>
                         </div>
                         <p className="font-mono text-xs font-bold">{formatCurrency(item.price * item.quantity, currency)}</p>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
              <div className="p-8 bg-black/20 flex gap-4">
                <button 
                  onClick={() => generatePresaleReceipt(viewingPresale.id, true)}
                  className="flex-1 h-14 bg-brand-primary text-black font-black uppercase  tracking-widest text-[11px] rounded-xl active:scale-95 transition-all"
                >
                  Print Receipt
                </button>
                <button 
                  onClick={() => setIsViewPresaleOpen(false)}
                  className="flex-1 h-14 border border-inherit text-inherit font-black uppercase  tracking-widest text-[11px] rounded-xl active:scale-95 transition-all opacity-40 hover:opacity-100"
                >
                  Close Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Menu Overlay */}
      {returnMenuAnchor && (
        <div className="fixed inset-0 z-[150]" onClick={() => setReturnMenuAnchor(null)}>
          <div 
            className={cn(
              "absolute w-56 rounded-2xl border shadow-hard p-2 backdrop-blur-xl animate-in fade-in zoom-in duration-200",
              theme === 'dark' ? "bg-dark-surface/90 border-dark-border" : "bg-white/90 border-light-border"
            )}
            style={{ 
              top: Math.min(returnMenuAnchor.y, window.innerHeight - 250), 
              left: Math.max(10, Math.min(window.innerWidth - 240, returnMenuAnchor.x - 200))
            }}
            onClick={e => e.stopPropagation()}
          >
            {[
              { id: 'create', label: 'Create Return', icon: RotateCcw, onClick: () => {
                const tx = transactions.find(t => t.id === returnMenuAnchor.id);
                if (tx) {
                  setSelectedTransactionForReturn(tx);
                  const initialItems: any = {};
                  tx.items.forEach((item: any) => {
                    initialItems[item.id] = { selected: false, quantity: item.quantity };
                  });
                  setReturnItems(initialItems);
                  setIsReturnModalOpen(true);
                }
                setReturnMenuAnchor(null);
              }, disabled: !transactions.find(t => t.id === returnMenuAnchor?.id) },
              { id: 'view', label: 'View Info', icon: Eye, onClick: () => {
                const tx = (transactions.find(t => t.id === returnMenuAnchor.id) || returnsList.find(r => r.id === returnMenuAnchor.id));
                setViewingTransaction(tx);
                setIsViewTransactionOpen(true);
                setReturnMenuAnchor(null);
              }},
            ].map(item => (
              <button
                key={item.id}
                onClick={item.onClick}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:translate-x-1 grayscale hover:grayscale-0 text-left disabled:opacity-30 disabled:pointer-events-none",
                  theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
                )}
              >
                <item.icon size={16} className="text-brand-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Transaction Info Modal */}
      <AnimatePresence>
        {isViewTransactionOpen && viewingTransaction && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <div className="register-view-transaction-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10" onClick={handleBackdropClick} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "popup-card register-view-transaction-popup-card relative w-full max-w-lg md:max-w-xl mx-4 my-auto z-20 rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all",
                theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <ShoppingBag size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Asset Instance
                    </h3>
                    <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                      #{viewingTransaction.id}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsViewTransactionOpen(false)}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === 'dark' 
                          ? "bg-black/40 border-dark-border text-dark-muted hover:text-white" 
                          : "bg-white border-light-border text-light-muted hover:text-black"
                      )}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="p-4 rounded-2xl bg-black/5">
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Liquidation Val</p>
                      <p className="text-xl font-black  text-brand-primary">{formatCurrency(viewingTransaction.totalAmount, currency)}</p>
                   </div>
                   <div className="p-4 rounded-2xl bg-black/5">
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Fiscal Duty</p>
                      <p className="text-xl font-black ">{formatCurrency(viewingTransaction.tax, currency)}</p>
                   </div>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Itemized Manifest</p>
                  {viewingTransaction.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center p-3 border-b border-inherit last:border-0">
                      <div>
                        <p className="text-xs font-black uppercase tracking-tighter">{item.name}</p>
                        <p className="text-[9px] opacity-40">Signature: {item.id} • Qty: {item.quantity}</p>
                      </div>
                      <p className="font-mono text-xs font-bold">{formatCurrency(item.price * item.quantity, currency)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-8 border-t border-inherit flex gap-4">
                <button 
                  onClick={() => {
                    generateReceipt(viewingTransaction.id);
                  }}
                  className="flex-1 h-14 bg-white text-black border border-dark-border font-black uppercase  tracking-widest text-[11px] rounded-xl active:scale-95 transition-all"
                >
                  Regenerate Invoice
                </button>
                <button 
                  onClick={() => setIsViewTransactionOpen(false)}
                  className="px-8 h-14 border border-inherit text-inherit font-black uppercase  tracking-widest text-[11px] rounded-xl opacity-40 hover:opacity-100"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Creation Modal */}
      <AnimatePresence>
        {isReturnModalOpen && selectedTransactionForReturn && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 text-black">
            <div className="register-return-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10" onClick={handleBackdropClick} />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className={cn(
                "popup-card register-return-popup-card relative w-full max-w-lg md:max-w-2xl mx-4 my-auto z-20 rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all",
                theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <RefreshCw size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Reversal Protocol
                    </h3>
                    <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                      #{selectedTransactionForReturn.id}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsReturnModalOpen(false)}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === 'dark' 
                          ? "bg-black/40 border-dark-border text-dark-muted hover:text-white" 
                          : "bg-white border-light-border text-light-muted hover:text-black"
                      )}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                <div className="flex items-center justify-between p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/20">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="selectAll"
                      onChange={(e) => selectAllItemsForReturn(e.target.checked)}
                      className="w-5 h-5 rounded-md border-2 border-brand-primary appearance-none checked:bg-brand-primary transition-all cursor-pointer relative after:content-[''] after:hidden after:absolute after:left-[6px] after:top-[2px] after:w-[6px] after:h-[10px] after:border-white after:border-r-2 after:border-b-2 after:rotate-45 checked:after:block"
                    />
                    <label htmlFor="selectAll" className="text-xs font-black uppercase tracking-widest cursor-pointer">Elect Entire Manifest</label>
                  </div>
                  <p className="text-[10px] font-mono opacity-40 uppercase">{selectedTransactionForReturn.items.length} Assets Available</p>
                </div>

                <div className="space-y-3">
                  {selectedTransactionForReturn.items.map((item: any) => (
                      <div 
                        key={item.id} 
                        className={cn(
                          "p-5 rounded-lg border-2 transition-all flex items-center gap-6",
                          (returnItems[item.id] as any)?.selected 
                            ? (theme === 'dark' ? "bg-brand-primary/10 border-brand-primary" : "bg-brand-primary/5 border-black")
                            : (theme === 'dark' ? "bg-black/20 border-transparent opacity-60" : "bg-black/5 border-transparent opacity-40")
                        )}
                      >
                        <input 
                          type="checkbox" 
                          checked={(returnItems[item.id] as any)?.selected || false}
                          onChange={(e) => setReturnItems(prev => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], selected: e.target.checked, quantity: prev[item.id]?.quantity || item.quantity }
                          }))}
                          className="w-6 h-6 rounded-lg border-2 border-inherit appearance-none checked:bg-brand-primary transition-all cursor-pointer relative after:content-[''] after:hidden after:absolute after:left-[8px] after:top-[4px] after:w-[6px] after:h-[10px] after:border-white after:border-r-2 after:border-b-2 after:rotate-45 checked:after:block"
                        />
                        
                        <div className="flex-1">
                          <p className="text-sm font-black uppercase  tracking-tight leading-none mb-1">{item.name}</p>
                          <p className="text-[10px] font-mono opacity-60">Signature: {item.id} • {formatCurrency(item.price, currency)} ea</p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <p className="text-[9px] font-black uppercase opacity-40 mb-1">Return Val</p>
                            <p className="font-mono text-xs font-bold">{formatCurrency(item.price * ((returnItems[item.id] as any)?.quantity || 0), currency)}</p>
                          </div>
                          <div className={cn(
                            "flex items-center gap-3 px-3 py-1.5 rounded-xl border border-inherit",
                            theme === 'dark' ? "bg-black/40" : "bg-white"
                          )}>
                          <button 
                            onClick={() => setReturnItems(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], quantity: Math.max(1, ((prev[item.id] as any)?.quantity || 1) - 1), selected: (prev[item.id] as any)?.selected }
                            }))}
                            className="p-1 opacity-40 hover:opacity-100"
                          ><Minus size={14} /></button>
                          <span className="font-mono text-sm font-black w-4 text-center">{(returnItems[item.id] as any)?.quantity || 0}</span>
                          <button 
                            onClick={() => setReturnItems(prev => ({
                              ...prev,
                              [item.id]: { ...prev[item.id], quantity: Math.min(item.quantity, ((prev[item.id] as any)?.quantity || 0) + 1), selected: (prev[item.id] as any)?.selected }
                            }))}
                            className="p-1 opacity-40 hover:opacity-100"
                          ><Plus size={14} /></button>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              <div className="p-8 border-t border-inherit flex flex-col md:flex-row items-center gap-6 bg-black/5">
                <div className="flex-1">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Aggregate Credit</p>
                   <p className="text-4xl font-black  tracking-tighter text-brand-primary">
                      {formatCurrency(
                        Object.entries(returnItems)
                          .filter(([_, v]) => (v as any).selected)
                          .reduce((sum, [id, v]) => {
                            const item = selectedTransactionForReturn.items.find((i: any) => i.id === id);
                            return sum + (item?.price || 0) * (v as any).quantity;
                          }, 0),
                        currency
                      )}
                   </p>
                </div>
                <button 
                  onClick={handleCreateReturn}
                  disabled={loading || !Object.values(returnItems).some(v => (v as any).selected)}
                  className="w-full md:w-auto h-20 px-12 bg-black text-white font-black uppercase  tracking-[0.2em] text-sm rounded-lg shadow-hard active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-30"
                >
                  {loading ? <RefreshCw className="animate-spin" /> : <RotateCcw size={20} />}
                  Execute Reversal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editing Presale Modal */}
      <AnimatePresence>
        {editingPresale && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <div className="register-edit-presale-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10" onClick={handleBackdropClick} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "popup-card register-edit-presale-popup-card relative w-full max-w-lg md:max-w-2xl mx-4 my-auto z-20 rounded-2xl overflow-hidden shadow-2xl border flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all",
                theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <Edit3 size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Modify Entry
                    </h3>
                    <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                      #{editingPresale.id}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => { setEditingPresale(null); setEditPresaleSearchQuery(''); }}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === 'dark' 
                          ? "bg-black/40 border-dark-border text-dark-muted hover:text-white" 
                          : "bg-white border-light-border text-light-muted hover:text-black"
                      )}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <form onSubmit={handleUpdatePresale} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Customer Assignment</label>
                      <input 
                        type="text"
                        value={editingPresale.op || ""}
                        onChange={(e) => setEditingPresale({...editingPresale, op: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border outline-none font-bold text-sm uppercase tracking-widest",
                          theme === 'dark' ? "bg-[#1E1E24] border-dark-border focus:border-brand-primary" : "bg-[#F9F9F9] border-light-border focus:border-brand-secondary"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest opacity-30 mb-2">Status Flag</label>
                      <select 
                        value={editingPresale.status}
                        onChange={(e) => setEditingPresale({...editingPresale, status: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border outline-none font-black uppercase text-[10px] tracking-widest h-[46px]",
                          theme === 'dark' ? "bg-[#1E1E24] border-dark-border focus:border-brand-primary" : "bg-[#F9F9F9] border-light-border focus:border-brand-secondary"
                        )}
                      >
                        <option value="Pending">Pending Audit</option>
                        <option value="Approved">Initiated Order</option>
                        <option value="Voided">Voided Entry</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Itemized Manifest</p>
                      <div className="relative flex-1 max-w-xs ml-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={14} />
                        <input 
                          type="text"
                          placeholder="Search products to add..."
                          value={editPresaleSearchQuery || ""}
                          onChange={(e) => setEditPresaleSearchQuery(e.target.value)}
                          className={cn(
                            "w-full pl-9 pr-4 py-2 rounded-lg border outline-none text-[10px] font-bold uppercase tracking-widest",
                            theme === 'dark' ? "bg-[#1E1E24] border-dark-border" : "bg-[#F9F9F9] border-light-border"
                          )}
                        />
                        {editPresaleSearchQuery && (
                          <div className={cn(
                            "absolute top-full left-0 right-0 mt-2 border rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto no-scrollbar py-2",
                            theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
                          )}>
                            {products
                              .filter(p => p.name.toLowerCase().includes(editPresaleSearchQuery.toLowerCase()))
                              .slice(0, 5)
                              .map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    const currentItems = [...(editingPresale.items || [])];
                                    const existingIdx = currentItems.findIndex(i => i.id === p.id);
                                    if (existingIdx >= 0) {
                                      currentItems[existingIdx].quantity += 1;
                                    } else {
                                      currentItems.push({ id: p.id, name: p.name, price: p.price, quantity: 1 });
                                    }
                                    const newAmount = currentItems.reduce((s, i) => s + (i.price * i.quantity), 0);
                                    setEditingPresale({ ...editingPresale, items: currentItems, amount: newAmount });
                                    setEditPresaleSearchQuery('');
                                  }}
                                  className={cn(
                                    "w-full text-left px-4 py-2 hover:bg-black/5 text-[10px] font-black uppercase tracking-tight flex items-center justify-between group",
                                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
                                  )}
                                >
                                  <span>{p.name}</span>
                                  <span className="opacity-40 group-hover:opacity-100">{formatCurrency(p.price, currency)}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(editingPresale.items || []).map((item: any, idx: number) => (
                        <div key={idx} className={cn(
                          "flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border",
                          theme === 'dark' ? "bg-black/20 border-dark-border" : "bg-black/5 border-light-border"
                        )}>
                          <div className="flex-1">
                            <p className="text-xs font-black uppercase truncate">{item.name}</p>
                            <p className="text-[9px] opacity-40 font-mono">{item.id}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <label className="text-[8px] font-black uppercase opacity-30 mb-1">Price (Override)</label>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] opacity-40 font-mono">$</span>
                                <input 
                                  type="number"
                                  step="0.01"
                                  value={item.price || 0}
                                  onChange={(e) => {
                                    const newItems = [...editingPresale.items];
                                    newItems[idx] = { ...item, price: Number(e.target.value) };
                                    const newAmount = newItems.reduce((s, i) => s + (i.price * i.quantity), 0);
                                    setEditingPresale({ ...editingPresale, items: newItems, amount: newAmount });
                                  }}
                                  className={cn(
                                    "w-20 px-2 py-1 rounded border outline-none font-mono text-xs font-bold",
                                    theme === 'dark' ? "bg-[#141414] border-[#333]" : "bg-white border-[#EEE]"
                                  )}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[8px] font-black uppercase opacity-30 mb-1">Quantity</label>
                              <div className={cn(
                                "flex items-center gap-2 px-2 py-1 rounded border",
                                theme === 'dark' ? "bg-[#141414] border-[#333]" : "bg-white border-[#EEE]"
                              )}>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...editingPresale.items];
                                    const newQty = Math.max(1, item.quantity - 1);
                                    newItems[idx] = { ...item, quantity: newQty };
                                    const newAmount = newItems.reduce((s, i) => s + (i.price * i.quantity), 0);
                                    setEditingPresale({ ...editingPresale, items: newItems, amount: newAmount });
                                  }}
                                  className="p-0.5 opacity-40 hover:opacity-100"
                                ><Minus size={12} /></button>
                                <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newItems = [...editingPresale.items];
                                    const newQty = item.quantity + 1;
                                    newItems[idx] = { ...item, quantity: newQty };
                                    const newAmount = newItems.reduce((s, i) => s + (i.price * i.quantity), 0);
                                    setEditingPresale({ ...editingPresale, items: newItems, amount: newAmount });
                                  }}
                                  className="p-0.5 opacity-40 hover:opacity-100"
                                ><Plus size={12} /></button>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = editingPresale.items.filter((_: any, i: number) => i !== idx);
                                const newAmount = newItems.reduce((s: number, i: any) => s + (i.price * i.quantity), 0);
                                setEditingPresale({ ...editingPresale, items: newItems, amount: newAmount });
                              }}
                              className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!editingPresale.items || editingPresale.items.length === 0) && (
                        /* BLOCK: Empty Edit Presale Manifest Card */
                        <div className={cn(
                          "edit-presale-manifest-empty-card p-8 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                          theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                        )}>
                          <Package size={54} strokeWidth={1.5} className={cn("edit-presale-manifest-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("edit-presale-manifest-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Items In Manifest</p>
                          <p className={cn("edit-presale-manifest-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add products to stage presale manifest items</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-black/20 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-1">Recalculated Liquidation</p>
                      <p className="text-4xl font-black  tracking-tighter text-brand-primary">
                        {formatCurrency(editingPresale.amount, currency)}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={() => { setEditingPresale(null); setEditPresaleSearchQuery(''); }}
                        className={cn(
                          "px-6 h-12 border border-inherit text-[10px] font-black uppercase tracking-widest rounded-xl transition-all opacity-40 hover:opacity-100",
                          theme === 'dark' ? "border-dark-border" : "border-light-border"
                        )}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className="px-10 h-12 bg-white text-black font-black uppercase  tracking-widest text-[10px] rounded-xl active:scale-95 transition-all shadow-hard"
                      >
                        {loading ? <RefreshCw className="animate-spin text-black" size={14} /> : 'Commit Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Initiate Confirmation Modal */}
      <AnimatePresence>
        {initiatingPresale && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <div className="register-initiate-presale-modal__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10" onClick={handleBackdropClick} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "popup-card register-initiate-presale-popup-card relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border flex flex-col z-20 transition-all",
                theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-light-surface border-light-border"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <CheckCircle2 size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Initiate Liquidation
                    </h3>
                    <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                      #{initiatingPresale.id}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setInitiatingPresale(null)}
                      className={cn(
                        "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === 'dark' 
                          ? "bg-black/40 border-dark-border text-dark-muted hover:text-white" 
                          : "bg-white border-light-border text-light-muted hover:text-black"
                      )}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-6 overflow-y-auto no-scrollbar max-h-[50vh]">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Manifest Verification</p>
                  {initiatingPresale.items?.map((item: any, idx: number) => (
                    <div key={idx} className={cn(
                      "flex justify-between items-center p-4 rounded-xl border",
                      theme === 'dark' ? "bg-black/20 border-dark-border" : "bg-black/5 border-light-border"
                    )}>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase">{item.name}</p>
                        <p className="text-[9px] opacity-40">Quantity: {item.quantity} • {formatCurrency(item.price, currency)} ea</p>
                      </div>
                      <p className="font-mono text-xs font-black ">{formatCurrency(item.price * item.quantity, currency)}</p>
                    </div>
                  ))}
                  {(!initiatingPresale.items || initiatingPresale.items.length === 0) && (
                    <p className="text-xs opacity-40  text-center py-4">No itemized data found</p>
                  )}
                </div>

                {/* Total Valuation Card - REDESIGNED */}
                <div
                  className={cn(
                    "p-5 rounded-2xl border flex items-center justify-between shadow-lg relative overflow-hidden",
                    theme === "dark"
                      ? "bg-gradient-to-br from-[#081845] via-[#040c2b] to-[#010515] border-[#1e4cd8]/50 text-white"
                      : "bg-gradient-to-br from-slate-100 via-[#e2e8f0] to-[#cbd5e1] border-slate-300 text-black",
                  )}
                >
                  {/* Elegant background highlight */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="relative z-10">
                    <p className={cn(
                      "text-[10px] font-black uppercase tracking-wider mb-1",
                      theme === "dark" ? "text-[#00E5FF] opacity-80" : "text-[#062A95]/80"
                    )}>
                      Total Valuation
                    </p>
                    <p className="text-3xl font-extrabold tracking-tight text-brand-primary drop-shadow-[0_2px_10px_rgba(34,211,238,0.15)]">
                      {formatCurrency(initiatingPresale.amount, currency)}
                    </p>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-[9px] font-black uppercase opacity-50 mb-1 tracking-wider">
                      Customer
                    </p>
                    <p className={cn(
                      "text-xs font-black uppercase px-2.5 py-1 rounded-md border",
                      theme === "dark" 
                        ? "bg-black/30 border-white/10 text-white" 
                        : "bg-white/80 border-slate-300 text-black"
                    )}>
                      {initiatingPresale.operator || initiatingPresale.op || "Terminal Staff"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-black/20 flex gap-4">
                <button 
                  onClick={() => approvePresale(initiatingPresale.id)}
                  disabled={loading}
                  className="flex-1 h-14 bg-brand-primary text-black font-black uppercase  tracking-widest text-[11px] rounded-xl active:scale-95 transition-all shadow-hard flex items-center justify-center gap-3"
                >
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : (
                    <>
                      <CheckCircle size={18} />
                      Confirm Initiation
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setInitiatingPresale(null)}
                  className="px-8 h-14 border border-inherit text-inherit font-black uppercase  tracking-widest text-[11px] rounded-xl active:scale-95 transition-all opacity-40 hover:opacity-100"
                >
                  Abort
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BLOCK: Stock Limit Warning Modal Card - Displays warning card popup when user exceeds available stock */}
      <AnimatePresence>
        {stockLimitWarning && (
          <div className="popup-card-overlay stock-warning-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="stock-warning-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
            />

            {/* Modal Card Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              className={cn(
                "popup-card stock-warning-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
                theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="stock-warning-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

              <div className="popup-card__header stock-warning-popup-card__header flex items-start gap-4">
                <motion.div
                  animate={{
                    y: [0, -3, 0],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  className="popup-card__icon stock-warning-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                >
                  <AlertTriangle size={24} />
                </motion.div>
                <div className="popup-card__title-group stock-warning-popup-card__title-group space-y-1">
                  <h3 className={cn(
                    "popup-card__title stock-warning-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Stock Limit Exceeded
                  </h3>
                  <p className="popup-card__subtitle stock-warning-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Inventory Alert</p>
                </div>
              </div>

              <div className={cn(
                "popup-card__body stock-warning-popup-card__body text-sm tracking-tight leading-relaxed",
                theme === 'dark' ? "text-white/85" : "text-black/85"
              )}>
                {stockLimitWarning.message}
              </div>

              <div className="popup-card__footer stock-warning-popup-card__footer flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setStockLimitWarning(null)}
                  className={cn(
                    "popup-card__button popup-card__button--confirm stock-warning-popup-card__button--close px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer shadow-sm",
                    theme === 'dark' 
                      ? "bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30"
                      : "bg-red-50 border-red-300 text-red-900 hover:bg-red-100"
                  )}
                >
                  Acknowledge & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BLOCK: Void Presale Confirmation Popup Card */}
      <AnimatePresence>
        {voidConfirmPresaleId !== null && (
          <div id="void-presale-popup-card-overlay" className="popup-card-overlay void-presale-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="void-presale-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              className={cn(
                "popup-card void-presale-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
                theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="void-presale-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

              <div className="popup-card__header void-presale-popup-card__header flex items-start gap-4">
                <motion.div
                  animate={{
                    y: [0, -3, 0],
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  className="popup-card__icon void-presale-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                >
                  <AlertTriangle size={24} />
                </motion.div>
                <div className="popup-card__title-group void-presale-popup-card__title-group space-y-1">
                  <h3 className={cn(
                    "popup-card__title void-presale-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Void Presale Entry?
                  </h3>
                  <p className="popup-card__subtitle void-presale-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Audit Alert</p>
                </div>
              </div>

              <div className={cn(
                "popup-card__body void-presale-popup-card__body text-sm tracking-tight leading-relaxed",
                theme === 'dark' ? "text-white/85" : "text-black/85"
              )}>
                Are you sure you want to void this presale transaction? It will be permanently marked as Voided in the logs.
              </div>

              <div className="popup-card__footer void-presale-popup-card__footer flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setVoidConfirmPresaleId(null)}
                  className={cn(
                    "popup-card__button popup-card__button--cancel void-presale-popup-card__button--cancel px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
                    theme === 'dark' 
                      ? "bg-transparent border-dark-border text-white/70 hover:bg-white/5 hover:text-white"
                      : "bg-transparent border-light-border text-black/70 hover:bg-black/5 hover:text-black"
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = voidConfirmPresaleId;
                    setVoidConfirmPresaleId(null);
                    if (id) voidPresale(id);
                  }}
                  className="popup-card__button popup-card__button--confirm void-presale-popup-card__button--confirm px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md shadow-red-500/10 cursor-pointer"
                >
                  Void Entry
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera Live Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onDetected={handleBarcodeDetected}
        theme={theme}
      />

      {/* Customer Loyalty & Account Selector Modal */}
      <CustomerSearchModal
        isOpen={isCustomerSearchModalOpen}
        onClose={() => setIsCustomerSearchModalOpen(false)}
        onSelectCustomer={(cust) => {
          setSelectedCustomer(cust);
        }}
        theme={theme}
        currency={currency}
      />

      {/* Multi-Tender Split Payment Modal */}
      <SplitPaymentModal
        isOpen={isSplitPaymentModalOpen}
        onClose={() => setIsSplitPaymentModalOpen(false)}
        totalDue={total}
        currency={currency}
        theme={theme}
        onCompleteSplitPayment={handleCompleteSplitPayment}
      />

      {/* Thermal & Direct ESC/POS Hardware Receipt Modal */}
      {completedTransactionForReceipt && (
        <ThermalReceiptModal
          isOpen={isThermalReceiptModalOpen}
          onClose={() => {
            setIsThermalReceiptModalOpen(false);
            setCompletedTransactionForReceipt(null);
          }}
          transaction={completedTransactionForReceipt}
          storeInfo={storeInfo}
          currency={currency}
          theme={theme}
        />
      )}
    </div>
  </div>
  );
};

// Helper for admin checks (shared logic would be better in a lib)
function isAdmin(checkRole?: string) {
  return checkRole === 'Manager' || auth.currentUser?.email === 'admin@megapos.pos';
}

export default Register;
