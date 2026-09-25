import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  FileText, 
  RefreshCw, 
  LayoutDashboard, 
  History, 
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingCart,
  CreditCard,
  Download,
  FileCode,
  FileDown,
  X,
  Package,
  Filter,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Menu,
  Eye,
  Printer,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { formatCurrency, OperationType, handleFirestoreError, cn, handleBackdropClick } from '../lib/utils';
import { ProductHealthDashboard } from '../components/ProductHealthDashboard';
import { db, auth } from '../lib/firebase';
import { collection, query, orderBy, getDocs, onSnapshot } from "../lib/firebase";

const limitLetters = (str: string, maxChars: number = 30) => {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '...';
};
import { Transaction, Product } from '../types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { User } from "../lib/firebase";

import { UserRole } from '../types';

const parseTransactionTimestamp = (ts: any): string => {
  if (!ts) return new Date().toISOString();
  try {
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toISOString();
    }
    if (ts.seconds !== undefined) {
      return new Date(ts.seconds * 1000).toISOString();
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {
    console.warn("Failed to parse timestamp:", ts, e);
  }
  return new Date().toISOString();
};

const getTillNumber = (cashierId: string | undefined): string => {
  if (!cashierId) return 'Till-01';
  const clean = cashierId.toUpperCase();
  if (clean === 'CPC2' || clean.endsWith('CPC2') || clean.endsWith('-CPC2') || clean === 'TILL-CPC2') {
    return 'Till-2';
  }
  if (clean.startsWith('CASHIER-')) {
    const num = clean.slice(8);
    return `Till-${num.startsWith('0') && num.length > 1 ? num.slice(1) : num}`;
  }
  if (clean.startsWith('TILL-')) {
    const code = clean.replace('TILL-', '');
    if (code === 'CPC2') return 'Till-2';
    return `Till-${code}`;
  }
  const suffix = cashierId.slice(-4).toUpperCase();
  if (suffix === 'CPC2') return 'Till-2';
  const code = /^[A-Z0-9]{4}$/.test(suffix) ? suffix : cashierId.slice(0, 4).toUpperCase();
  if (code === 'CPC2') return 'Till-2';
  return `Till-${code}`;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'bg-rose-500/10 text-rose-500 border-rose-500/20',
    'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
};

interface ReportsProps {
  user: User | null;
  theme?: 'dark' | 'light';
  currency?: string;
  role?: UserRole;
  storeId?: string;
  storeName?: string;
  activeSubTab?: 'performance' | 'history' | 'expenses' | 'products' | 'balances';
  setActiveSubTab?: (tab: 'performance' | 'history' | 'expenses' | 'products' | 'balances') => void;
  managerEmail?: string;
}

export const Reports: React.FC<ReportsProps> = ({ 
  user,
  theme = 'dark',
  currency = 'USD',
  role = 'Manager',
  storeId = 'megapos',
  storeName = 'megapos',
  activeSubTab: propActiveSubTab,
  setActiveSubTab: propSetActiveSubTab,
  managerEmail
}) => {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const reportsTabsRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('yearly');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = React.useState(false);
  const [internalSubTab, setInternalSubTab] = React.useState<'performance' | 'history' | 'expenses' | 'products' | 'balances'>('performance');

  const activeSubTab = propActiveSubTab !== undefined ? propActiveSubTab : internalSubTab;
  const setActiveSubTab = (tab: 'performance' | 'history' | 'expenses' | 'products' | 'balances') => {
    if (propSetActiveSubTab) {
      propSetActiveSubTab(tab);
    } else {
      setInternalSubTab(tab);
    }
  };
  const [searchQuery, setSearchQuery] = React.useState('');

  const [expenditures, setExpenditures] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [balances, setBalances] = React.useState<any[]>([]);
  const [customers, setCustomers] = React.useState<any[]>([]);

  const [txMenuAnchor, setTxMenuAnchor] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [viewingTransaction, setViewingTransaction] = React.useState<Transaction | null>(null);

  React.useEffect(() => {
    const handleClickOutside = () => {
      setTxMenuAnchor(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const [isExportOpen, setIsExportOpen] = React.useState(false);

  const [exportFilterType, setExportFilterType] = React.useState<'range' | 'custom'>('range');
  const [exportRange, setExportRange] = React.useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [exportStartDate, setExportStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [exportFinishDate, setExportFinishDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [stockExportFilter, setStockExportFilter] = React.useState<'all' | 'category' | 'date'>('all');
  const [stockSelectedCategory, setStockSelectedCategory] = React.useState<string>('all');
  const [stockStartDate, setStockStartDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [stockFinishDate, setStockFinishDate] = React.useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [stockReportSubtype, setStockReportSubtype] = React.useState<'product_list' | 'stock_valuation'>('product_list');

  const uniqueCategories = React.useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) {
        cats.add(p.category);
      }
    });
    return Array.from(cats);
  }, [products]);

  const customerOutstandingBalances = React.useMemo(() => {
    return customers.map(cust => {
      const userCharges = balances
        .filter(b => b.customerId === cust.id && b.type === 'customer_charge')
        .reduce((sum, b) => sum + (b.amount || 0), 0);
        
      const userPayments = balances
        .filter(b => b.customerId === cust.id && b.type === 'customer_balance')
        .reduce((sum, b) => sum + (b.amount || 0), 0);
        
      const owed = Math.max(0, userCharges - userPayments);
      return {
        ...cust,
        owed,
        totalAssigned: (cust.balanceLimit || 0) + owed
      };
    });
  }, [customers, balances]);

  const totalOwed = React.useMemo(() => {
    return customerOutstandingBalances.reduce((sum, c) => sum + c.owed, 0);
  }, [customerOutstandingBalances]);

  const totalLimitAssigned = React.useMemo(() => {
    const creditCustomers = customers.filter(c => c.allowBalance);
    return creditCustomers.reduce((sum, c) => sum + (c.balanceLimit || 0), 0) + totalOwed;
  }, [customers, totalOwed]);

  const activeCreditAccountsCount = React.useMemo(() => {
    return customerOutstandingBalances.filter(c => c.owed > 0 || c.allowBalance).length;
  }, [customerOutstandingBalances]);

  const getFilteredProductsForExport = () => {
    if (activeSubTab === 'products') {
      if (stockExportFilter === 'category') {
        if (stockSelectedCategory === 'all') return products;
        return products.filter(p => p.category === stockSelectedCategory);
      }
      if (stockExportFilter === 'date') {
        const start = new Date(stockStartDate).getTime();
        const end = new Date(stockFinishDate).getTime() + 86400000;
        return products.filter(p => {
          const val = p.updatedAt || p.createdAt || p.id || '';
          const pTime = typeof (val as any).toDate === 'function' 
            ? (val as any).toDate().getTime() 
            : (new Date(val).getTime() || 0);
          return pTime >= start && pTime <= end;
        });
      }
    }
    return products;
  };

  const fetchReports = async () => {
    if (!user) return;
    const activeManagerEmail = (managerEmail || localStorage.getItem('nurtron_registered_manager_email') || user?.email || 'admin@megapos.pos').toLowerCase().trim();
    setLoading(true);
    try {
      const txRef = collection(db, 'transactions');
      const q = query(txRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: parseTransactionTimestamp(data.timestamp)
        } as Transaction;
      }).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setTransactions(docs);

      // Fetch Expenditures
      const expRef = collection(db, 'expenditures');
      const expQuery = query(expRef, orderBy('date', 'desc'));
      const expSnap = await getDocs(expQuery);
      setExpenditures(expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail));

      // Fetch Products
      const prodRef = collection(db, 'products');
      const prodSnap = await getDocs(prodRef);
      setProducts(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Product).filter((item: any) => {
        if (item.managerEmail) return item.managerEmail.toLowerCase().trim() === activeManagerEmail;
        if (item.ownerEmail) return item.ownerEmail.toLowerCase().trim() === activeManagerEmail;
        return activeManagerEmail === 'admin@megapos.pos' || activeManagerEmail === 'faarhanch@gmail.com';
      }));

      // Fetch Balances
      const balRef = collection(db, 'balances');
      const balSnap = await getDocs(balRef);
      setBalances(balSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail));

      // Fetch Customers
      const custRef = collection(db, 'customers');
      const custSnap = await getDocs(custRef);
      setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'transactions', auth);
    } finally {
      setLoading(false);
    }
  };

  const filterByDateRange = (
    itemDate: Date,
    option: 'range' | 'custom',
    range: 'daily' | 'weekly' | 'monthly' | 'yearly',
    startS: string,
    finishS: string
  ): boolean => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (option === 'range') {
      if (range === 'daily') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (range === 'weekly') {
        start = startOfWeek(now);
        end = endOfWeek(now);
      } else if (range === 'monthly') {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else { // yearly
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      }
    } else {
      start = startOfDay(new Date(startS));
      end = endOfDay(new Date(finishS));
    }

    return itemDate >= start && itemDate <= end;
  };

  const getFilteredTransactionsForExport = () => {
    return transactions.filter(tx => {
      if (!tx.timestamp) return false;
      const date = new Date(tx.timestamp);
      return filterByDateRange(date, exportFilterType, exportRange, exportStartDate, exportFinishDate);
    });
  };

  const getFilteredExpendituresForExport = () => {
    return expenditures.filter(exp => {
      if (!exp.date) return false;
      const date = new Date(exp.date);
      return filterByDateRange(date, exportFilterType, exportRange, exportStartDate, exportFinishDate);
    });
  };

  const triggerCSVDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCSV = () => {
    if (activeSubTab === 'balances') {
      const filename = `apex_balances_outstanding_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
      const csvContent = [
        `APEX TERMINAL - CLIENT CREDIT LEDGER & BALANCES OWED`,
        `Store Name: ${storeName}, Store ID: ${storeId}`,
        `Export Filter: CLIENTS WITH OUTSTANDING BALANCES`,
        `Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm:ss')}`,
        ``,
        `CLIENT NAME,CLIENT ID,EMAIL,PHONE,AVAILABLE CREDIT CAPACITY,OUTSTANDING BALANCE OWED`,
        ...customerOutstandingBalances.map(cust => [
          cust.name,
          cust.customerId || (cust.id ? 'CUST-' + cust.id.slice(-6).toUpperCase() : 'N/A'),
          cust.email || 'N/A',
          cust.phone || 'N/A',
          (cust.balanceLimit || 0).toFixed(2),
          cust.owed.toFixed(2)
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      triggerCSVDownload(csvContent, filename);
      return;
    }

    let headers: string[] = [];
    let rows: any[] = [];
    const filename = `apex_report_${activeSubTab}${activeSubTab === 'products' ? '_' + stockReportSubtype : ''}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;

    let dateFilterDesc = "";
    if (activeSubTab === 'products') {
      if (stockExportFilter === 'all') {
        dateFilterDesc = "ALL PRODUCTS";
      } else if (stockExportFilter === 'category') {
        dateFilterDesc = `CATEGORY: ${stockSelectedCategory.toUpperCase()}`;
      } else {
        dateFilterDesc = `CREATED FROM ${format(new Date(stockStartDate), 'dd-MM-yyyy')} TO ${format(new Date(stockFinishDate), 'dd-MM-yyyy')}`;
      }
    } else {
      dateFilterDesc = exportFilterType === 'range' 
        ? exportRange.toUpperCase() 
        : `FROM ${format(new Date(exportStartDate), 'dd-MM-yyyy')} TO ${format(new Date(exportFinishDate), 'dd-MM-yyyy')}`;
    }

    if (activeSubTab === 'performance') {
      const txs = getFilteredTransactionsForExport();
      const totalRev = txs.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTxVal = txs.reduce((sum, t) => sum + t.tax, 0);
      const netProfit = totalRev - totalTxVal - (totalRev * 0.4);

      const csvContent = [
        `APEX TERMINAL - PERFORMANCE HUB REPORT`,
        `Store Name: ${storeName}, Store ID: ${storeId}`,
        `Export Filter: ${dateFilterDesc}`,
        `Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm:ss')}`,
        ``,
        `METRIC,VALUE`,
        `Total Sales,${totalRev.toFixed(2)}`,
        `Total Orders,${txs.length}`,
        `Average Ticket,${(txs.length > 0 ? totalRev / txs.length : 0).toFixed(2)}`,
        `Tax Total,${totalTxVal.toFixed(2)}`,
        `Estimated Net Profit,${netProfit.toFixed(2)}`,
        ``,
        `CONTRIBUTING TRANSACTIONS`,
        `Order ID,Timestamp,Client Identity,Metric Value,Seal,Till Number`,
        ...txs.map(tx => [
          tx.id.toUpperCase().startsWith("TX-") ? `TX-${tx.id.replace(/tx-/i, "").slice(-6)}` : tx.id.slice(0, 8),
          tx.timestamp ? format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm') : '',
          tx.customerName || 'walk-in',
          tx.totalAmount.toFixed(2),
          tx.paymentMethod,
          getTillNumber(tx.cashierId)
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      triggerCSVDownload(csvContent, filename);
       return;
    }

    if (activeSubTab === 'history') {
      const txs = getFilteredTransactionsForExport();
      headers = ["Order ID", "Timestamp", "Client Identity", "Metric Value", "Seal / Method", "Till Number"];
      rows = txs.map(tx => [
        tx.id.toUpperCase().startsWith("TX-") ? `TX-${tx.id.replace(/tx-/i, "").slice(-6)}` : tx.id.slice(0, 8),
        tx.timestamp ? format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm') : '',
        tx.customerName || 'walk-in',
        tx.totalAmount.toFixed(2),
        tx.paymentMethod,
        getTillNumber(tx.cashierId)
      ]);
    } else if (activeSubTab === 'expenses') {
      const exps = getFilteredExpendituresForExport();
      headers = ["Expense ID", "Date", "Description", "Category", "Amount"];
      rows = exps.map(exp => [
        exp.id,
        exp.date ? format(new Date(exp.date), 'yyyy-MM-dd') : '',
        exp.description || '',
        exp.category || 'Operational',
        (exp.amount || 0).toFixed(2)
      ]);
    } else if (activeSubTab === 'products') {
      if (stockReportSubtype === 'stock_valuation') {
        const filteredProds = getFilteredProductsForExport();
        let totalCostBasis = 0;
        let totalSellingValue = 0;
        let totalQty = 0;

        filteredProds.forEach(prod => {
          const qty = prod.stockLevel || 0;
          const cost = prod.costPrice || 0;
          const price = prod.price || 0;
          totalQty += qty;
          totalCostBasis += (qty * cost);
          totalSellingValue += (qty * price);
        });

        const totalGrossProfit = totalSellingValue - totalCostBasis;
        const totalProfitPercentage = totalCostBasis > 0 ? (totalGrossProfit / totalCostBasis) * 100 : 0;

        const csvContent = [
          `APEX TERMINAL - STOCK FINANCIAL VALUATION REPORT`,
          `Store Name: ${storeName}, Store ID: ${storeId}`,
          `Export Filter: ${dateFilterDesc}`,
          `Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm:ss')}`,
          ``,
          `SUMMARY METRICS`,
          `Total Registered Products,${filteredProds.length}`,
          `Total Quantity in Stock,${totalQty}`,
          `Total Inventory Cost Basis,${totalCostBasis.toFixed(2)}`,
          `Total Retail/Selling Value,${totalSellingValue.toFixed(2)}`,
          `Est. Total Gross Profit,${totalGrossProfit.toFixed(2)}`,
          `Percentage Profit in Markup,${totalProfitPercentage.toFixed(2)}%`,
          ``,
          `VALUATION REGISTER BY PRODUCT`,
          `Barcode,Product Name,Category,Cost,Price,Stock Level,Total Cost Basis,Total Valuation,Potential Profit,Profit %`,
          ...filteredProds.map(prod => {
            const stockVal = prod.stockLevel || 0;
            const priceVal = prod.price || 0;
            const costVal = prod.costPrice || 0;
            const itemTotalCost = stockVal * costVal;
            const itemTotalValuation = stockVal * priceVal;
            const itemProfit = itemTotalValuation - itemTotalCost;
            const itemProfitPct = itemTotalCost > 0 ? (itemProfit / itemTotalCost) * 105 : 0; // Using percentage in profit markup calculation

            return [
              prod.barcode || prod.sku || prod.id || 'N/A',
              prod.name,
              prod.category || 'General',
              costVal.toFixed(2),
              priceVal.toFixed(2),
              stockVal,
              itemTotalCost.toFixed(2),
              itemTotalValuation.toFixed(2),
              itemProfit.toFixed(2),
              `${itemTotalCost > 0 ? ((itemProfit / itemTotalCost) * 100).toFixed(2) : '0.00'}%`
            ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
          })
        ].join('\n');

        triggerCSVDownload(csvContent, filename);
        return;
      }

      headers = ["Barcode", "Product Name", "Description", "Category", "Cost", "Price", "Stock Level", "Inventory Valuation"];
      const filteredProds = getFilteredProductsForExport();
      rows = filteredProds.map(prod => {
        const stockVal = prod.stockLevel || 0;
        const priceVal = prod.price || 0;
        const costVal = prod.costPrice || 0;
        const valuation = stockVal * priceVal;
        return [
          prod.barcode || prod.sku || prod.id || 'N/A',
          prod.name,
          prod.description || 'No description supplied',
          prod.category || 'General',
          costVal.toFixed(2),
          priceVal.toFixed(2),
          stockVal,
          valuation.toFixed(2)
        ];
      });
    }

    if (headers.length === 0) {
      headers = ["No Data Available"];
      rows = [["Configure correct tab reference in filter UI"]];
    }

    const csvContent = [
      `APEX TERMINAL - ${activeSubTab.toUpperCase()} REPORT`,
      `Store Name: ${storeName}, Store ID: ${storeId}`,
      `Export Filter: ${dateFilterDesc}`,
      `Generated: ${format(new Date(), 'dd-MM-yyyy HH:mm:ss')}`,
      ``,
      headers.join(','),
      ...rows.map(row => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    triggerCSVDownload(csvContent, filename);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let dateFilterDesc = "";
    if (activeSubTab === 'products') {
      if (stockExportFilter === 'all') {
        dateFilterDesc = "ALL PRODUCTS";
      } else if (stockExportFilter === 'category') {
        dateFilterDesc = `CATEGORY: ${stockSelectedCategory.toUpperCase()}`;
      } else {
        dateFilterDesc = `CREATED FROM ${format(new Date(stockStartDate), 'dd-MM-yyyy')} TO ${format(new Date(stockFinishDate), 'dd-MM-yyyy')}`;
      }
    } else {
      dateFilterDesc = exportFilterType === 'range' 
        ? exportRange.toUpperCase() 
        : `FROM ${format(new Date(exportStartDate), 'dd-MM-yyyy')} TO ${format(new Date(exportFinishDate), 'dd-MM-yyyy')}`;
    }

    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('APEX TERMINAL', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Store: ${storeName}`, 196, 20, { align: 'right' });
    doc.text(`ID: ${storeId}`, 196, 25, { align: 'right' });
    
    doc.setFontSize(12);
    doc.text(`${activeSubTab.toUpperCase()} REPORT - BUSINESS INTELLIGENCE`, 14, 28);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 34);
    doc.text(`Filter Window: ${dateFilterDesc}`, 14, 39);

    doc.setDrawColor(230, 230, 230);
    doc.line(14, 43, 196, 43);

    if (activeSubTab === 'performance') {
      const txs = getFilteredTransactionsForExport();
      const totalRev = txs.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTxVal = txs.reduce((sum, t) => sum + t.tax, 0);
      const netProfit = totalRev - totalTxVal - (totalRev * 0.4);

      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Performance Summary Indicators', 14, 52);

      doc.setFontSize(10);
      doc.text(`Total Revenue: ${formatCurrency(totalRev, currency)}`, 14, 60);
      doc.text(`Total Orders: ${txs.length}`, 14, 66);
      doc.text(`Average Ticket: ${formatCurrency(txs.length > 0 ? totalRev / txs.length : 0, currency)}`, 14, 72);
      doc.text(`Tax Collected: ${formatCurrency(totalTxVal, currency)}`, 14, 78);
      doc.text(`Net Est. Profit: ${formatCurrency(netProfit, currency)}`, 14, 84);

      doc.line(14, 90, 196, 90);

      doc.setFontSize(13);
      doc.text('Contributing Transactions Audit Trail', 14, 98);

      const tableHeaders = [['Order ID', 'Timestamp', 'Client', 'Amount', 'Method']];
      const tableRows = txs.map(tx => [
        tx.id.toUpperCase().startsWith("TX-") ? `TX-${tx.id.replace(/tx-/i, "").slice(-6)}` : tx.id.slice(0, 8),
        tx.timestamp ? format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm') : 'N/A',
        tx.customerName || 'walk-in',
        formatCurrency(tx.totalAmount, currency),
        tx.paymentMethod
      ]);

      autoTable(doc, {
        startY: 104,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] },
        styles: { fontSize: 8 }
      });

    } else if (activeSubTab === 'history') {
      const txs = getFilteredTransactionsForExport();
      const tableHeaders = [['Order ID', 'Timestamp', 'Client Identity', 'Metric Value', 'Seal / Method', 'Till Number']];
      const tableRows = txs.map(tx => [
        tx.id.toUpperCase().startsWith("TX-") ? `TX-${tx.id.replace(/tx-/i, "").slice(-6)}` : tx.id.slice(0, 8),
        tx.timestamp ? format(new Date(tx.timestamp), 'yyyy-MM-dd HH:mm') : 'N/A',
        tx.customerName || 'walk-in',
        formatCurrency(tx.totalAmount, currency),
        tx.paymentMethod,
        getTillNumber(tx.cashierId)
      ]);

      autoTable(doc, {
        startY: 50,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] },
        styles: { fontSize: 8 }
      });

    } else if (activeSubTab === 'expenses') {
      const exps = getFilteredExpendituresForExport();
      const tableHeaders = [['Expense ID', 'Date', 'Description', 'Category', 'Amount']];
      const tableRows = exps.map(exp => [
        exp.id.slice(0, 10),
        exp.date ? format(new Date(exp.date), 'yyyy-MM-dd') : 'N/A',
        exp.description || '',
        exp.category || 'Operational',
        formatCurrency(exp.amount || 0, currency)
      ]);

      autoTable(doc, {
        startY: 50,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] },
        styles: { fontSize: 8 }
      });

    } else if (activeSubTab === 'products') {
      const filteredProds = getFilteredProductsForExport();

      if (stockReportSubtype === 'stock_valuation') {
        let totalCostBasis = 0;
        let totalSellingValue = 0;
        let totalQty = 0;

        filteredProds.forEach(prod => {
          const qty = prod.stockLevel || 0;
          const cost = prod.costPrice || 0;
          const price = prod.price || 0;
          totalQty += qty;
          totalCostBasis += (qty * cost);
          totalSellingValue += (qty * price);
        });

        const totalGrossProfit = totalSellingValue - totalCostBasis;
        const totalProfitPercentage = totalCostBasis > 0 ? (totalGrossProfit / totalCostBasis) * 100 : 0;

        doc.setFontSize(13);
        doc.setTextColor(40, 40, 40);
        doc.text('Stock Valuation & Assets Summary', 14, 52);

        doc.setFontSize(9);
        doc.text(`Total Registered Items: ${filteredProds.length}`, 14, 60);
        doc.text(`Total Qty in Stock: ${totalQty} units`, 14, 66);
        doc.text(`Total Cost Basis: ${formatCurrency(totalCostBasis, currency)}`, 14, 72);
        doc.text(`Total Selling Value (Retail): ${formatCurrency(totalSellingValue, currency)}`, 14, 78);
        doc.text(`Potential Profit: ${formatCurrency(totalGrossProfit, currency)}`, 14, 84);
        doc.text(`Markup / Profit Margin: ${totalProfitPercentage.toFixed(2)}%`, 14, 90);

        doc.line(14, 95, 196, 95);

        doc.setFontSize(13);
        doc.text('Calculated Valuation Register', 14, 103);

        const tableHeaders = [['Barcode', 'Product Title', 'Qty', 'Unit Cost', 'Unit Price', 'Cost Basis', 'Valuation', 'Profit', 'Profit%']];
        const tableRows = filteredProds.map(prod => {
          const stockVal = prod.stockLevel || 0;
          const priceVal = prod.price || 0;
          const costVal = prod.costPrice || 0;
          const itemTotalCost = stockVal * costVal;
          const itemTotalValuation = stockVal * priceVal;
          const itemProfit = itemTotalValuation - itemTotalCost;
          const itemProfitPct = itemTotalCost > 0 ? (itemProfit / itemTotalCost) * 100 : 0;

          return [
            prod.barcode || prod.sku || prod.id || 'N/A',
            prod.name,
            `${stockVal}`,
            formatCurrency(costVal, currency),
            formatCurrency(priceVal, currency),
            formatCurrency(itemTotalCost, currency),
            formatCurrency(itemTotalValuation, currency),
            formatCurrency(itemProfit, currency),
            `${itemProfitPct.toFixed(1)}%`
          ];
        });

        autoTable(doc, {
          startY: 109,
          head: tableHeaders,
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [20, 20, 20] },
          styles: { fontSize: 8 }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(`Total Products: ${filteredProds.length}`, 14, 49);

        const tableHeaders = [['Barcode', 'Product Title', 'Category', 'Cost', 'Price', 'Stock Level', 'Inventory Valuation']];
        const tableRows = filteredProds.map(prod => {
          const stockVal = prod.stockLevel || 0;
          const priceVal = prod.price || 0;
          const costVal = prod.costPrice || 0;
          const valuation = stockVal * priceVal;
          return [
            prod.barcode || prod.sku || prod.id || 'N/A',
            prod.name,
            prod.category || 'General',
            formatCurrency(costVal, currency),
            formatCurrency(priceVal, currency),
            `${stockVal} units`,
            formatCurrency(valuation, currency)
          ];
        });

        autoTable(doc, {
          startY: 53,
          head: tableHeaders,
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [20, 20, 20] },
          styles: { fontSize: 8 }
        });
      }
    } else if (activeSubTab === 'balances') {
      doc.setFontSize(13);
      doc.setTextColor(40, 40, 40);
      doc.text('Client Credit Ledger - Outstanding Balances Owed', 14, 52);

      const tableHeaders = [['Client Name', 'Client ID', 'Email', 'Phone', 'Available Cap', 'Outstanding Owed']];
      const tableRows = customerOutstandingBalances.map(cust => [
        cust.name,
        cust.customerId || (cust.id ? 'CUST-' + cust.id.slice(-6).toUpperCase() : 'N/A'),
        cust.email || 'N/A',
        cust.phone || 'N/A',
        formatCurrency(cust.balanceLimit || 0, currency),
        formatCurrency(cust.owed || 0, currency)
      ]);

      autoTable(doc, {
        startY: 58,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [20, 20, 20] },
        styles: { fontSize: 8 }
      });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
    }

    doc.save(`apex_${activeSubTab}_${stockReportSubtype}_report_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  React.useEffect(() => {
    if (!user) return;
    const activeManagerEmail = (managerEmail || localStorage.getItem('nurtron_registered_manager_email') || user?.email || 'admin@megapos.pos').toLowerCase().trim();
    setLoading(true);

    const txRef = collection(db, 'transactions');
    const q = query(txRef, orderBy('timestamp', 'desc'));
    const unsubTransactions = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          timestamp: parseTransactionTimestamp(data.timestamp)
        } as Transaction;
      }).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setTransactions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions', auth);
      setLoading(false);
    });

    const expRef = collection(db, 'expenditures');
    const expQuery = query(expRef, orderBy('date', 'desc'));
    const unsubExpenditures = onSnapshot(expQuery, (snapshot) => {
      setExpenditures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail));
    }, (error) => {
      console.error(error);
    });

    const prodRef = collection(db, 'products');
    const unsubProducts = onSnapshot(prodRef, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Product).filter((item: any) => {
        if (item.managerEmail) return item.managerEmail.toLowerCase().trim() === activeManagerEmail;
        if (item.ownerEmail) return item.ownerEmail.toLowerCase().trim() === activeManagerEmail;
        return activeManagerEmail === 'admin@megapos.pos' || activeManagerEmail === 'faarhanch@gmail.com';
      }));
    }, (error) => {
      console.error(error);
    });

    const unsubBalances = onSnapshot(collection(db, 'balances'), (snapshot) => {
      setBalances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail));
    }, (error) => {
      console.error(error);
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail));
    }, (error) => {
      console.error(error);
    });

    return () => {
      unsubTransactions();
      unsubExpenditures();
      unsubProducts();
      unsubBalances();
      unsubCustomers();
    };
  }, [user]);

  const getFilteredTransactions = () => {
    const now = new Date();
    let start: Date, end: Date;

    if (timeRange === 'daily') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (timeRange === 'weekly') {
      start = startOfWeek(now);
      end = endOfWeek(now);
    } else if (timeRange === 'monthly') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else { // yearly
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return transactions.filter(tx => {
      const date = tx.timestamp ? new Date(tx.timestamp) : new Date();
      const matchesSearch = tx.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (tx.customerName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                           (tx.paymentMethod?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      
      // If we are searching, ignore the time range to find "everything"
      if (searchQuery) return matchesSearch;
      
      return date >= start && date <= end && matchesSearch;
    });
  };

  const currentTxs = getFilteredTransactions();

  const filteredExpenditures = expenditures.filter(exp => {
    const matchesSearch = (exp.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (exp.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (exp.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    // If we are searching, ignore the time range to find "everything"
    if (searchQuery) return matchesSearch;

    if (activeSubTab === 'expenses') {
      const date = exp.date ? new Date(exp.date) : new Date();
      const now = new Date();
      let start: Date, end: Date;

      if (timeRange === 'daily') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (timeRange === 'weekly') {
        start = startOfWeek(now);
        end = endOfWeek(now);
      } else if (timeRange === 'monthly') {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else { // yearly
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      }
      return date >= start && date <= end && matchesSearch;
    }

    return matchesSearch;
  });

  const filteredProducts = products.filter(prod => {
    const term = searchQuery.toLowerCase();
    return (prod.name || '').toLowerCase().includes(term) ||
           (prod.category || '').toLowerCase().includes(term) ||
           (prod.id || '').toLowerCase().includes(term) ||
           (prod.sku || '').toLowerCase().includes(term);
  });

  const totalRevenue = currentTxs.reduce((sum, tx) => sum + tx.totalAmount, 0);
  const totalTax = currentTxs.reduce((sum, tx) => sum + tx.tax, 0);
  const profit = totalRevenue - totalTax - (totalRevenue * 0.4);

  const chartData = [
    { name: 'Revenue', value: totalRevenue, color: theme === 'dark' ? '#E4E3E0' : '#141414' },
    { name: 'Tax', value: totalTax, color: '#666' },
    { name: 'Profit', value: profit, color: '#22C55E' },
  ];

  const getCurrencySymbolOnly = (curr: string) => {
    const trimmed = (curr || 'ZAR').trim();
    if (trimmed === 'ZAR' || trimmed === 'R') return 'R';
    if (trimmed === 'USD') return '$';
    if (trimmed === 'EUR') return '€';
    if (trimmed === 'GBP') return '£';
    return trimmed;
  };

  const getCurrencyPrefix = (curr: string) => {
    const sym = getCurrencySymbolOnly(curr);
    return sym.length > 1 ? `${sym} ` : sym;
  };

  const performanceData = React.useMemo(() => {
    if (timeRange === 'daily') {
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      const hourlyData = hours.map(h => ({ name: h, sales: 0 }));
      currentTxs.forEach(tx => {
        if (!tx.timestamp) return;
        const date = new Date(tx.timestamp);
        const hour = date.getHours();
        
        if (hour < 9) {
          hourlyData[0].sales += tx.totalAmount;
        } else if (hour < 11) {
          hourlyData[1].sales += tx.totalAmount;
        } else if (hour < 13) {
          hourlyData[2].sales += tx.totalAmount;
        } else if (hour < 15) {
          hourlyData[3].sales += tx.totalAmount;
        } else if (hour < 17) {
          hourlyData[4].sales += tx.totalAmount;
        } else if (hour < 19) {
          hourlyData[5].sales += tx.totalAmount;
        } else {
          hourlyData[6].sales += tx.totalAmount;
        }
      });
      return hourlyData;
    } else if (timeRange === 'weekly') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weeklyData = days.map(d => ({ name: d, sales: 0 }));
      currentTxs.forEach(tx => {
        if (!tx.timestamp) return;
        const date = new Date(tx.timestamp);
        const day = date.getDay(); // 0 indicates Sunday
        const index = day === 0 ? 6 : day - 1;
        if (index >= 0 && index < 7) {
          weeklyData[index].sales += tx.totalAmount;
        }
      });
      return weeklyData;
    } else if (timeRange === 'monthly') {
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const monthlyData = weeks.map(w => ({ name: w, sales: 0 }));
      currentTxs.forEach(tx => {
        if (!tx.timestamp) return;
        const date = new Date(tx.timestamp);
        const dayOfMonth = date.getDate();
        if (dayOfMonth <= 7) {
          monthlyData[0].sales += tx.totalAmount;
        } else if (dayOfMonth <= 14) {
          monthlyData[1].sales += tx.totalAmount;
        } else if (dayOfMonth <= 21) {
          monthlyData[2].sales += tx.totalAmount;
        } else {
          monthlyData[3].sales += tx.totalAmount;
        }
      });
      return monthlyData;
    } else { // yearly
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const yearlyData = months.map(m => ({ name: m, sales: 0 }));
      currentTxs.forEach(tx => {
        if (!tx.timestamp) return;
        const date = new Date(tx.timestamp);
        const monthIndex = date.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          yearlyData[monthIndex].sales += tx.totalAmount;
        }
      });
      return yearlyData;
    }
  }, [currentTxs, timeRange]);

  const productVelocityStats = React.useMemo(() => {
    const salesMap: Record<string, { id: string; name: string; barcode: string; category: string; quantitySold: number; revenue: number; currentStock: number; price: number }> = {};

    // Seed all catalog products
    products.forEach(p => {
      const key = (p.id || p.name).toLowerCase();
      salesMap[key] = {
        id: p.id || '',
        name: p.name,
        barcode: p.barcode || p.sku || (p.id ? p.id.slice(0, 8).toUpperCase() : 'N/A'),
        category: p.category || 'General',
        quantitySold: 0,
        revenue: 0,
        currentStock: p.stockLevel || 0,
        price: p.price || 0,
      };
    });

    // Accumulate sales from currentTxs
    currentTxs.forEach(tx => {
      (tx.items || []).forEach((item: any) => {
        const matchKey = (item.id || item.name || '').toLowerCase();
        let targetKey = matchKey;
        if (!salesMap[targetKey]) {
          const foundKey = Object.keys(salesMap).find(k => salesMap[k].name.toLowerCase() === (item.name || '').toLowerCase());
          if (foundKey) targetKey = foundKey;
        }

        if (salesMap[targetKey]) {
          salesMap[targetKey].quantitySold += (item.quantity || 1);
          salesMap[targetKey].revenue += (item.price || 0) * (item.quantity || 1);
        } else {
          salesMap[targetKey] = {
            id: item.id || targetKey,
            name: item.name || 'Unknown Item',
            barcode: item.barcode || item.sku || 'N/A',
            category: 'General',
            quantitySold: item.quantity || 1,
            revenue: (item.price || 0) * (item.quantity || 1),
            currentStock: 0,
            price: item.price || 0,
          };
        }
      });
    });

    return Object.values(salesMap);
  }, [products, currentTxs]);

  const fastestMovingProducts = React.useMemo(() => {
    return [...productVelocityStats]
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 6)
      .map(p => ({
        ...p,
        displayName: limitLetters(p.name, 16),
      }));
  }, [productVelocityStats]);

  const slowMovingProducts = React.useMemo(() => {
    return [...productVelocityStats]
      .sort((a, b) => {
        if (a.quantitySold !== b.quantitySold) return a.quantitySold - b.quantitySold;
        return b.currentStock - a.currentStock;
      })
      .slice(0, 6)
      .map(p => ({
        ...p,
        displayName: limitLetters(p.name, 16),
      }));
  }, [productVelocityStats]);

  const productHealthStats = React.useMemo(() => {
    const totalValuation = products.reduce((acc, p) => acc + (p.stockLevel || 0) * (p.price || 0), 0);
    const healthyCount = products.filter(p => (p.stockLevel || 0) > 5).length;
    const lowStockCount = products.filter(p => (p.stockLevel || 0) > 0 && (p.stockLevel || 0) <= 5).length;
    const outOfStockCount = products.filter(p => (p.stockLevel || 0) === 0).length;
    const totalCount = products.length;
    const healthyRatio = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

    return {
      totalValuation,
      healthyCount,
      lowStockCount,
      outOfStockCount,
      totalCount,
      healthyRatio,
    };
  }, [products]);

  return (
    <div className={cn(
      "reports-page font-presale min-h-full flex flex-col transition-colors duration-500 relative",
      theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text"
    )}>
      {/* Export Card Overlay and Backdrop */}
      <AnimatePresence>
        {isExportOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="export-reports-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            />
            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "popup-card export-reports-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-md md:max-w-lg lg:max-w-xl h-[75vh] md:h-[82vh] z-[99999] flex flex-col shadow-2xl border rounded-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "popup-card__header export-reports-popup-card__header p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <Download size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Export Reports
                    </h3>
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                      {activeSubTab === 'products' ? (stockReportSubtype === 'product_list' ? '(Product List)' : '(Stock Valuation)') : '(Financials)'}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsExportOpen(false)}
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

              {/* Content */}
              <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
                <div className="space-y-6 max-h-[80%] overflow-y-auto pr-2">
                {activeSubTab === 'products' ? (
                  /* Custom Product/Stock Export Option Card */
                  <div className="space-y-6">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest block font-presale mb-3 text-dark-muted">
                        Report Type
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([
                          { id: 'product_list', label: 'PRODUCT LIST' },
                          { id: 'stock_valuation', label: 'STOCK VALUATION' }
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setStockReportSubtype(opt.id)}
                            className={cn(
                              "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 text-center cursor-pointer",
                              stockReportSubtype === opt.id
                                ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400 shadow-md animate-none" : "bg-[#062A95] text-white border-[#062A95] shadow-md animate-none")
                                : (theme === 'dark' ? "bg-[#020921] border-white/10 text-white/70 hover:text-white hover:border-white/20" : "bg-slate-50 border-slate-200 text-black/70 hover:text-black hover:border-gray-400")
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest block font-presale mb-3 text-dark-muted">
                        Filter By
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {([
                          { id: 'all', label: 'ALL PRODUCTS' },
                          { id: 'category', label: 'CATEGORY' },
                          { id: 'date', label: 'DATE ADDED' }
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setStockExportFilter(opt.id)}
                            className={cn(
                              "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 text-center cursor-pointer",
                              stockExportFilter === opt.id
                                ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400 shadow-md animate-none" : "bg-[#062A95] text-white border-[#062A95] shadow-md animate-none")
                                : (theme === 'dark' ? "bg-[#020921] border-white/10 text-white/70 hover:text-white hover:border-white/20" : "bg-slate-50 border-slate-200 text-black/70 hover:text-black hover:border-gray-400")
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {stockExportFilter === 'category' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest block font-presale text-dark-muted">
                          Select Category
                        </span>
                        <select
                          value={stockSelectedCategory}
                          onChange={(e) => setStockSelectedCategory(e.target.value)}
                          className={cn(
                            "w-full px-4 py-3 border-2 rounded-xl text-xs font-black uppercase transition-all outline-none",
                            theme === 'dark' ? "bg-[#0F172A] border-white/30 focus:border-cyan-400 text-white" : "bg-white border-slate-400 focus:border-[#062A95] text-black"
                          )}
                        >
                          <option value="all">ALL CATEGORIES</option>
                          {uniqueCategories.map(cat => (
                            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}

                    {stockExportFilter === 'date' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                      >
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest block font-presale text-dark-muted">
                            Start Date
                          </span>
                          <input
                            type="date"
                            value={stockStartDate}
                            onChange={(e) => setStockStartDate(e.target.value)}
                            className={cn(
                              "w-full px-4 py-3 border-2 rounded-xl text-xs font-black font-mono focus:outline-none transition-all",
                              theme === 'dark' ? "bg-[#0F172A] border-white/30 focus:border-cyan-400 text-white" : "bg-white border-slate-400 focus:border-[#062A95] text-black"
                            )}
                          />
                        </div>
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest block font-presale text-dark-muted">
                            End Date
                          </span>
                          <input
                            type="date"
                            value={stockFinishDate}
                            onChange={(e) => setStockFinishDate(e.target.value)}
                            className={cn(
                              "w-full px-4 py-3 border-2 rounded-xl text-xs font-black font-mono focus:outline-none transition-all",
                              theme === 'dark' ? "bg-[#0F172A] border-white/30 focus:border-cyan-400 text-white" : "bg-white border-slate-400 focus:border-[#062A95] text-black"
                            )}
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Predefined range presets */}
                    <div 
                      onClick={() => setExportFilterType('range')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all cursor-pointer relative",
                        exportFilterType === 'range'
                          ? (theme === 'dark' ? "bg-[#061445] border-[#22D3EE]" : "bg-blue-50 border-[#062A95]")
                          : (theme === 'dark' ? "bg-[#020921] border-white/10 opacity-70 hover:opacity-100 hover:border-white/20" : "bg-slate-50 border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-400")
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest block font-presale">Option 1: Preset Range</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          exportFilterType === 'range'
                            ? (theme === 'dark' ? "border-cyan-400 bg-cyan-400" : "border-[#062A95] bg-[#062A95]")
                            : "border-gray-400"
                        )}>
                          {exportFilterType === 'range' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((range) => (
                          <button
                            key={range}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExportFilterType('range');
                              setExportRange(range);
                            }}
                            className={cn(
                              "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all text-center border-2 cursor-pointer no-gradient",
                              exportFilterType === 'range' && exportRange === range
                                ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400 shadow-md" : "bg-[#062A95] text-white border-[#062A95] shadow-md")
                                : (theme === 'dark' ? "bg-[#0F172A]/40 border-transparent text-white/70 hover:text-white" : "bg-gray-100 border-transparent text-black/60 hover:text-black")
                            )}
                            disabled={exportFilterType !== 'range'}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Or divider */}
                    <div className="flex items-center my-1 overflow-hidden opacity-30">
                      <div className="flex-1 h-px bg-current"></div>
                      <span className="mx-3 text-[10px] font-black tracking-[0.2em]">OR</span>
                      <div className="flex-1 h-px bg-current"></div>
                    </div>

                    {/* Custom range date inputs */}
                    <div 
                      onClick={() => setExportFilterType('custom')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all cursor-pointer relative",
                        exportFilterType === 'custom'
                          ? (theme === 'dark' ? "bg-[#061445] border-[#22D3EE]" : "bg-blue-50 border-[#062A95]")
                          : (theme === 'dark' ? "bg-[#020921] border-white/10 opacity-70 hover:opacity-100 hover:border-white/20" : "bg-slate-50 border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-400")
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest block font-presale">Option 2: Custom Date Range</span>
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          exportFilterType === 'custom'
                            ? (theme === 'dark' ? "border-cyan-400 bg-cyan-400" : "border-[#062A95] bg-[#062A95]")
                            : "border-gray-400"
                        )}>
                          {exportFilterType === 'custom' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-65 block font-presale">Start Date</span>
                          <input
                            type="date"
                            value={exportStartDate}
                            onChange={(e) => {
                              setExportStartDate(e.target.value);
                            }}
                            onFocus={() => setExportFilterType('custom')}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "w-full px-4 py-2 rounded-lg border text-[10px] font-bold font-mono focus:outline-none transition-all",
                              exportFilterType === 'custom'
                                ? (theme === 'dark' ? "bg-[#0F172A] border-cyan-400 text-white" : "bg-light-surface border-[#062A95] text-black")
                                : (theme === 'dark' ? "bg-[#0F172A]/20 border-white/10 text-white/40 cursor-not-allowed" : "bg-gray-100/50 border-gray-200 text-black/30 cursor-not-allowed")
                            )}
                            disabled={exportFilterType !== 'custom'}
                          />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-65 block font-presale">End Date</span>
                          <input
                            type="date"
                            value={exportFinishDate}
                            onChange={(e) => {
                              setExportFinishDate(e.target.value);
                            }}
                            onFocus={() => setExportFilterType('custom')}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "w-full px-4 py-2 rounded-lg border text-[10px] font-bold font-mono focus:outline-none transition-all",
                              exportFilterType === 'custom'
                                ? (theme === 'dark' ? "bg-[#0F172A] border-cyan-400 text-white" : "bg-light-surface border-[#062A95] text-black")
                                : (theme === 'dark' ? "bg-[#0F172A]/20 border-white/10 text-white/40 cursor-not-allowed" : "bg-gray-100/50 border-gray-200 text-black/30 cursor-not-allowed")
                            )}
                            disabled={exportFilterType !== 'custom'}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                </div>

                {/* Actions Bar */}
                <div className="pt-3.5 border-t border-inherit flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3.5 shrink-0 mt-3.5">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        exportPDF();
                        setIsExportOpen(false);
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                        theme === "dark" 
                          ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                          : "bg-white border-light-border text-black hover:bg-gray-50",
                      )}
                    >
                      <FileDown size={12} /> Export PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        exportCSV();
                        setIsExportOpen(false);
                      }}
                      className={cn(
                        "px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                        theme === "dark"
                          ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                          : "bg-black text-white hover:bg-neutral-800 shadow-black/10"
                      )}
                    >
                      <FileCode size={12} /> Export CSV
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-8 z-[110] flex flex-col items-end gap-3">
        <button 
          onClick={() => setIsExportOpen(!isExportOpen)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 active:scale-95 focus:outline-none group",
            theme === 'dark' 
              ? "bg-[#22D3EE] text-black border-[#0F172A] shadow-[#22D3EE]/20 hover:brightness-110" 
              : "bg-[#062A95] text-white border-white shadow-[#062A95]/20 hover:bg-opacity-95"
          )}
        >
          <div className="relative transition-transform duration-300 group-hover:scale-110">
            {isExportOpen ? <X size={28} /> : <Download size={28} />}
          </div>
        </button>
      </div>

      <div className="flex-1 px-4 pb-4 pt-0 md:px-10 md:pb-10 md:pt-0">
        <div className="w-full max-w-[1600px] mx-auto transition-all duration-300 ease-in-out font-presale">
          {/* BLOCK: Reports Floating Control Row - Manages the layout of tabs and search controls */}
          <div className="rp-controls-layout flex flex-col xl:flex-row items-center justify-between gap-3 sm:gap-4 mb-8 transition-all duration-300 ease-in-out">
            
            {/* BLOCK: Tabs Floating Bar Card - Holds navigation tabs for reports selection */}
            <div className={cn(
              "rp-tabs-card flex flex-row items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full xl:w-1/2 xl:flex-1 min-w-0 shrink-0 backdrop-blur-xl relative overflow-hidden",
              theme === 'dark' 
                ? "rp-tabs-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "rp-tabs-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              {/* Left scroll arrow button */}
              <button
                type="button"
                onClick={() => reportsTabsRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                className={cn(
                  "rp-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/15"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-black hover:bg-slate-200"
                )}
                title="Scroll tabs left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} className="shrink-0" />
              </button>

              <div ref={reportsTabsRef} className="rp-tabs-card__list flex items-center justify-start flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto scroll-smooth no-scrollbar w-full py-0.5 my-auto">
                 {[
                   { id: 'performance', label: 'LIVE METRICS', icon: LayoutDashboard },
                   { id: 'history', label: 'TRANSACTION TRAIL', icon: History },
                   { id: 'expenses', label: 'OPERATING EXPENSES', icon: TrendingDown },
                   { id: 'products', label: 'STOCK', icon: Package },
                   { id: 'balances', label: 'ACCOUNTS RECEIVABLE', icon: CreditCard }
                 ].map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => {
                       setActiveSubTab(tab.id as any);
                       setSearchQuery('');
                     }}
                     className={cn(
                       "rp-tabs-card__tab-btn h-10 px-3.5 sm:px-4 md:px-5 xl:px-6 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap border flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 my-auto",
                       activeSubTab === tab.id 
                         ? theme === 'dark'
                           ? "rp-tabs-card__tab-btn--active bg-brand-primary border-brand-primary text-black shadow-md shadow-cyan-500/20"
                           : "rp-tabs-card__tab-btn--active bg-[#062A95] border-[#062A95] text-white shadow-md shadow-blue-900/20"
                         : theme === 'dark'
                           ? "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                           : "border-transparent text-slate-600 hover:text-black hover:bg-slate-100"
                     )}
                   >
                     <tab.icon size={15} className={cn("transition-transform shrink-0 flex items-center justify-center my-auto", activeSubTab === tab.id ? "scale-110" : "opacity-75")} />
                     <span className="flex items-center justify-center text-center my-auto leading-normal font-presale font-bold tracking-wide text-[11px] md:text-[12px] uppercase">{tab.label}</span>
                   </button>
                 ))}
              </div>

              {/* Right scroll arrow button */}
              <button
                type="button"
                onClick={() => reportsTabsRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                className={cn(
                  "rp-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/15"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-black hover:bg-slate-200"
                )}
                title="Scroll tabs right"
                aria-label="Scroll right"
              >
                <ChevronRight size={16} className="shrink-0" />
              </button>
            </div>

            {/* BLOCK: Search and Filter Floating Bar Card - Holds search controls, filter actions, and state refreshers */}
            <div className={cn(
              "rp-search-card flex flex-row items-center gap-2 sm:gap-3 lg:gap-4 p-1.5 sm:p-2 px-3 sm:px-4 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full xl:w-1/2 xl:flex-1 min-w-0 justify-between xl:justify-start backdrop-blur-xl",
              theme === 'dark' 
                ? "rp-search-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "rp-search-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              {activeSubTab !== 'performance' ? (
                <div className="rp-search-card__search-wrapper relative flex-1 min-w-0 my-auto">
                  <Search className="rp-search-card__search-icon absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" size={15} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`SEARCH ${activeSubTab === 'history' ? 'TRANSACTIONS' : activeSubTab === 'expenses' ? 'EXPENSES' : activeSubTab === 'balances' ? 'RECEIVABLES' : 'STOCK'}...`}
                    className={cn(
                      "rp-search-card__search-input w-full h-10 border pl-10 sm:pl-12 pr-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none transition-all duration-500 flex items-center",
                      theme === 'dark' 
                        ? "bg-[#041a5c]/80 border-[#123ebd] text-white placeholder-white/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20" 
                        : "bg-white border-slate-300 text-light-text placeholder-gray-400 focus:border-brand-primary-light focus:ring-1 focus:ring-brand-primary-light/20"
                    )}
                  />
                </div>
              ) : (
                <div className={cn(
                  "rp-search-card__range-wrapper flex-1 lg:w-80 flex gap-0.5 rounded-xl border p-0.5 items-center h-10 transition-all duration-500 my-auto",
                  theme === 'dark' ? "bg-[#041a5c]/80 border-[#123ebd]" : "bg-white border-slate-300"
                )}>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        "rp-search-card__range-btn h-full px-1.5 sm:px-3 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-all cursor-pointer flex-1 text-center flex items-center justify-center no-gradient leading-normal my-auto",
                        timeRange === range 
                          ? theme === 'dark'
                            ? "bg-brand-primary text-black font-black"
                            : "bg-black text-white font-black shadow-sm"
                          : theme === 'dark'
                            ? "text-white/40 hover:text-white hover:bg-white/5"
                            : "text-light-muted hover:text-black hover:bg-black/5"
                      )}
                    >
                      <span className="leading-normal flex items-center justify-center my-auto">{range}</span>
                    </button>
                  ))}
                </div>
              )}

              {activeSubTab !== 'products' && (
                <div className="rp-search-card__filter-wrapper relative shrink-0 my-auto">
                  <button 
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className={cn(
                      "rp-search-card__filter-btn h-10 px-3.5 sm:px-4 border rounded-xl transition-all duration-500 shrink-0 active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest my-auto",
                      isFilterDropdownOpen
                        ? theme === 'dark'
                          ? "bg-brand-primary border-brand-primary text-black"
                          : "bg-black border-black text-white"
                        : theme === 'dark' 
                          ? "bg-[#041a5c]/80 text-white border-[#123ebd] hover:bg-[#062480] hover:border-brand-primary" 
                          : "bg-white text-black border-slate-300 hover:bg-gray-100 hover:border-black",
                    )}
                    title="Filter Time Range"
                  >
                    <Filter size={15} className={cn("shrink-0 my-auto", isFilterDropdownOpen ? "animate-pulse" : "")} />
                    <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest my-auto flex items-center justify-center">{timeRange}</span>
                  </button>
                  
                  {/* Dropdown overlay */}
                  <AnimatePresence>
                    {isFilterDropdownOpen && (
                      <motion.div 
                        key="filter-dropdown-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120]" 
                        onClick={() => setIsFilterDropdownOpen(false)} 
                      />
                    )}
                    {isFilterDropdownOpen && (
                      <motion.div 
                        key="filter-dropdown-body"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          "absolute right-0 mt-2 w-48 rounded-xl border-2 p-1.5 shadow-2xl z-[130] flex flex-col gap-1",
                          theme === 'dark' ? "bg-dark-surface border-white/30 text-white" : "bg-white border-slate-400 text-black"
                        )}
                      >
                        <div className="rp-search-card__filter-title px-3 py-2 text-[9px] font-black uppercase tracking-widest opacity-40 border-b border-inherit/20 mb-1">
                          Select Time Range
                        </div>
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(range => (
                          <button
                            key={range}
                            onClick={() => {
                              setTimeRange(range);
                              setIsFilterDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-2 rounded-lg text-left text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-between",
                              timeRange === range 
                                ? theme === 'dark'
                                  ? "bg-brand-primary text-black"
                                  : "bg-black text-white"
                                : theme === 'dark'
                                  ? "text-white/60 hover:text-white hover:bg-white/5"
                                  : "text-light-muted hover:text-black hover:bg-black/5"
                            )}
                          >
                            <span>{range}</span>
                            {timeRange === range && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              
              <button 
                onClick={fetchReports}
                className={cn(
                  "rp-search-card__refresh-btn h-9 w-9 p-0 border rounded-xl transition-all shrink-0 active:scale-95 cursor-pointer flex items-center justify-center leading-none",
                  theme === 'dark' 
                    ? "bg-[#041a5c]/80 border-[#123ebd] text-white hover:bg-[#062480] hover:border-brand-primary" 
                    : "bg-white text-black border-slate-300 hover:bg-gray-100 hover:border-black",
                )}
                title="Refresh Reports Data"
              >
                <RefreshCw size={15} className={cn("shrink-0", loading ? 'animate-spin' : '')} />
              </button>
            </div>
          </div>

        {activeSubTab === 'expenses' && (
          <div 
            className="space-y-6 font-presale presale-stream-container"
          >
            {/* Handheld/Mobile Cards - Expenses */}
            <div className="flex flex-col gap-4 md:hidden mb-12">
              {filteredExpenditures.map((exp, idx) => {
                const cleanId = (exp.id || '').replace(/^(exp-|EXP-)/i, "");
                const shortId = (exp.id || '').toLowerCase().startsWith("exp-")
                  ? `EXP-${cleanId.slice(-6)}`
                  : (exp.id || '').slice(0, 8) || `EXP-${idx}`;

                let formattedDate = 'Recently';
                if (exp.date) {
                  try {
                    formattedDate = format(new Date(exp.date), 'yyyy-MM-dd');
                  } catch (err) {}
                }

                const categoryBadgeClass = theme === "dark" 
                  ? "bg-red-500/15 text-red-300 border-red-500/30" 
                  : "bg-red-50 text-red-800 border-red-300";

                return (
                  <div 
                    key={`report-expenses-card-${exp.id || idx}`}
                    className={cn(
                      "presale-stream-card border p-5 rounded-2xl flex flex-col gap-4 relative transition-all duration-300 shadow-sm hover:shadow-md border-l-4 border-l-cyan-500 cursor-pointer font-presale",
                      theme === "dark"
                        ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                        : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide",
                          theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                        )}>
                          #{shortId.toUpperCase()}
                        </span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                          categoryBadgeClass
                        )}>
                          {exp.category || 'Operational'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          Designation
                        </p>
                        <p className="text-sm font-semibold tracking-tight text-balance">
                          {exp.description || 'System Resource'}
                        </p>
                        <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          {formattedDate}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          Value
                        </p>
                        <p className="font-mono text-lg font-bold text-red-500 dark:text-red-400 drop-shadow-xs">
                          {formatCurrency(exp.amount || 0, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredExpenditures.length === 0 && (
                /* BLOCK: Empty Expenditure Mobile View - Card displaying zero expenditure records status */
                <div className={cn(
                  "expenditure-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                  theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                )}>
                  <Package size={54} strokeWidth={1.5} className={cn("expenditure-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                  <p className={cn("expenditure-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                    No Expenditure Records Identified
                  </p>
                  <p className={cn("expenditure-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                    No operating expenses recorded for this period
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Table - Expenses */}
            <div className={cn(
               "hidden md:block rounded-2xl border shadow-sm overflow-hidden mb-20 transition-all duration-300 presale-stream-table font-presale",
               theme === "dark"
                 ? "bg-dark-surface border-white/20"
                 : "bg-white border-slate-300"
            )}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 shadow-xs">
                  <tr className={cn(
                    "text-left border-b transition-colors duration-200",
                    theme === "dark"
                      ? "bg-[#0c1836] border-white/20"
                      : "bg-slate-100 border-slate-300"
                  )}>
                    <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                      Entry ID
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                      Designation
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                      Timestamp
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                      Category
                    </th>
                    <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenditures.map((exp, idx) => {
                    const cleanId = (exp.id || '').replace(/^(exp-|EXP-)/i, "");
                    const shortId = (exp.id || '').toLowerCase().startsWith("exp-")
                      ? `EXP-${cleanId.slice(-6)}`
                      : (exp.id || '').slice(0, 8) || `EXP-${idx}`;

                    let formattedDate = 'Recently';
                    if (exp.date) {
                      try {
                        formattedDate = format(new Date(exp.date), 'yyyy-MM-dd');
                      } catch (err) {}
                    }

                    const categoryBadgeClass = theme === "dark" 
                      ? "bg-red-500/15 text-red-300 border-red-500/30" 
                      : "bg-red-50 text-red-800 border-red-300";

                    return (
                      <tr key={exp.id || idx} className={cn(
                        "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                        theme === "dark"
                          ? "border-white/10 hover:bg-white/5 text-slate-100"
                          : "border-slate-200 hover:bg-slate-50 text-slate-900"
                      )}>
                        <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                          <span className={cn(
                            "font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide",
                            theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                          )}>
                            {shortId}
                          </span>
                        </td>
                        <td className={cn(
                          "px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap",
                          theme === "dark" ? "text-white" : "text-slate-900"
                        )}>
                          {exp.description || 'System Resource'}
                        </td>
                        <td className={cn(
                          "px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap"
                        )}>
                          {formattedDate}
                        </td>
                        <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                            categoryBadgeClass
                          )}>
                            {exp.category || 'Operational'}
                          </span>
                        </td>
                        <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-left font-mono text-xs font-bold text-red-500 dark:text-red-400 whitespace-nowrap">
                          {formatCurrency(exp.amount || 0, currency)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredExpenditures.length === 0 && (
                    /* BLOCK: Empty Expenditure Table Row - Displays zero expenditure records status card inside table */
                    <tr className="expenditure-empty-table__row border-0">
                      <td colSpan={5} className="expenditure-empty-table__cell py-16 text-center">
                        <div className="expenditure-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                          <Package size={54} strokeWidth={1.5} className={cn("expenditure-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("expenditure-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                            No Expenditure Records Identified
                          </p>
                          <p className={cn("expenditure-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            No operating expenses recorded for this period
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'performance' && (
          <div 
            className="space-y-8 font-presale live-metrics-container font-live-metrics"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Sales', value: formatCurrency(totalRevenue, currency), icon: TrendingUp },
                { label: 'Total Orders', value: currentTxs.length, icon: ShoppingCart },
                { label: 'Average Ticket', value: formatCurrency(currentTxs.length > 0 ? totalRevenue / currentTxs.length : 0, currency), icon: CreditCard },
                { label: 'Tax Total', value: formatCurrency(totalTax, currency), icon: FileText },
              ].map((stat, i) => (
                <div key={i} className={cn(
                  "presale-stream-card live-metrics-card border p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-md border-l-4 border-l-cyan-500 font-presale",
                  theme === 'dark' 
                    ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                    : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                )}>
                  <div className={cn(
                    "p-3 rounded-xl shrink-0 flex items-center justify-center shadow-xs",
                    theme === 'dark' ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                  )}>
                    <stat.icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1 font-presale">
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{stat.label}</p>
                    <p className={cn("text-2xl font-bold font-mono tracking-wide mt-0.5", theme === "dark" ? "text-white" : "text-slate-900")}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* BLOCK: Sales Velocity Chart Card - Renders an interactive historical line of transactional performance */}
            <div className={cn(
              "sales-velocity-card live-metrics-card presale-stream-card border rounded-2xl p-6 md:p-8 transition-colors shadow-hard font-presale",
              theme === 'dark' ? "sales-velocity-card--dark bg-dark-surface border-white/35" : "sales-velocity-card--light bg-light-surface border-slate-400"
            )}>
              <h3 className="sales-velocity-card__title font-presale font-extrabold uppercase tracking-widest text-xs sm:text-sm mb-8 title-text flex items-center gap-2">
                <TrendingUp size={16} className={theme === 'dark' ? 'text-cyan-400' : 'text-blue-900'} />
                Sales Velocity
              </h3>
              <div className="sales-velocity-card__chart-container h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData} margin={{ top: 5, right: 0, left: -22, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme === 'dark' ? "#CDDFF0" : "#141414"} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={theme === 'dark' ? "#CDDFF0" : "#141414"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />
                    <XAxis dataKey="name" stroke="#666" fontSize={10} axisLine={false} tickLine={false} fontWeight="bold" />
                    <YAxis stroke="#666" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${getCurrencyPrefix(currency)}${val.toLocaleString()}`} fontWeight="bold" />
                    <Tooltip 
                      cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', strokeWidth: 2, strokeDasharray: '5 5' }}
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#141414' : '#FFF',
                        border: `1px solid ${theme === 'dark' ? '#333' : '#EEE'}`,
                        borderRadius: '16px',
                        padding: '12px',
                        fontSize: '10px',
                        fontWeight: 'black',
                        textTransform: 'uppercase',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                      }}
                      formatter={(value: any) => [formatCurrency(Number(value), currency), 'Sales']}
                    />
                    <Area type="monotone" dataKey="sales" stroke={theme === 'dark' ? "#CDDFF0" : "#141414"} fill="url(#colorSales)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'history' && (
          <div 
            className="space-y-6 font-presale presale-stream-container"
          >
            {/* Handheld/Mobile Cards - History */}
            <div className="flex flex-col gap-4 md:hidden mb-12">
              {currentTxs.map(tx => {
                const cleanId = tx.id.replace(/^(tx-|TX-)/i, "");
                const shortId = tx.id.toLowerCase().startsWith("tx-")
                  ? `TX-${cleanId.slice(-6)}`
                  : tx.id.slice(0, 8);

                let formattedDate = 'Recently';
                if (tx.timestamp) {
                  try {
                    formattedDate = format(new Date(tx.timestamp), 'yyyy-MM-dd');
                  } catch (err) {}
                }

                const method = tx.paymentMethod || 'Other';
                const isCash = method.toLowerCase() === 'cash';
                const isCard = method.toLowerCase() === 'card';
                const methodBadgeClass = isCash
                  ? (theme === "dark" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-800 border-emerald-300")
                  : isCard
                    ? (theme === "dark" ? "bg-blue-500/15 text-cyan-300 border-blue-500/30" : "bg-blue-50 text-blue-800 border-blue-300")
                    : (theme === "dark" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-800 border-amber-300");

                return (
                  <div 
                    key={`report-history-pm-${tx.id}`}
                    className={cn(
                      "presale-stream-card border p-5 rounded-2xl flex flex-col gap-4 relative transition-all duration-300 shadow-sm hover:shadow-md border-l-4 border-l-cyan-500 cursor-pointer font-presale",
                      theme === "dark"
                        ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                        : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide",
                          theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                        )}>
                          #{shortId.toUpperCase()}
                        </span>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                          methodBadgeClass
                        )}>
                          {method}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          Designation
                        </p>
                        <p className="text-sm font-semibold tracking-tight text-balance">
                          {tx.customerName || 'walk-in'}
                        </p>
                        <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          {formattedDate} • Till: {getTillNumber(tx.cashierId)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          Value
                        </p>
                        <p className="font-mono text-lg font-bold text-cyan-400 dark:text-cyan-300 drop-shadow-xs">
                          {formatCurrency(tx.totalAmount, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {currentTxs.length === 0 && (
                /* BLOCK: Empty Audit Trail Mobile View - Displays zero audit trail records card */
                <div className={cn(
                  "audit-trail-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                  theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                )}>
                  <Package size={54} strokeWidth={1.5} className={cn("audit-trail-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                  <p className={cn("audit-trail-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                    No Audit Trail Records Identified
                  </p>
                  <p className={cn("audit-trail-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                    No transaction history logs found for this period
                  </p>
                </div>
              )}
            </div>

            {/* Desktop Table - History */}
            <div className={cn(
               "hidden md:block rounded-2xl border shadow-sm overflow-hidden mb-20 transition-all duration-300 presale-stream-table font-presale",
               theme === 'dark' ? "bg-dark-surface border-white/20" : "bg-white border-slate-300"
            )}>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 shadow-xs">
                  <tr className={cn(
                    "text-left border-b transition-colors duration-200",
                    theme === 'dark' ? "bg-[#0c1836] border-white/20" : "bg-slate-100 border-slate-300"
                  )}>
                    <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Entry ID
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Designation
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Timestamp
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Method
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Value
                    </th>
                    <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Till No
                    </th>
                    <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentTxs.map(tx => {
                    const cleanId = tx.id.replace(/^(tx-|TX-)/i, "");
                    const shortId = tx.id.toLowerCase().startsWith("tx-")
                      ? `TX-${cleanId.slice(-6)}`
                      : tx.id.slice(0, 8);

                    let formattedDate = 'Recently';
                    if (tx.timestamp) {
                      try {
                        formattedDate = format(new Date(tx.timestamp), 'yyyy-MM-dd');
                      } catch (err) {}
                    }

                    const method = tx.paymentMethod || 'Other';
                    const isCash = method.toLowerCase() === 'cash';
                    const isCard = method.toLowerCase() === 'card';
                    const methodBadgeClass = isCash
                      ? (theme === "dark" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-800 border-emerald-300")
                      : isCard
                        ? (theme === "dark" ? "bg-blue-500/15 text-cyan-300 border-blue-500/30" : "bg-blue-50 text-blue-800 border-blue-300")
                        : (theme === "dark" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-800 border-amber-300");

                    return (
                      <tr key={tx.id} className={cn(
                        "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                        theme === 'dark' 
                          ? "border-white/10 hover:bg-white/5 text-slate-100" 
                          : "border-slate-200 hover:bg-slate-50 text-slate-900"
                      )}>
                        <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                          <span className={cn(
                            "font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide",
                            theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                          )}>
                            {shortId}
                          </span>
                        </td>
                        <td className={cn("px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap", theme === "dark" ? "text-white" : "text-slate-900")}>
                          {tx.customerName || 'walk-in'}
                        </td>
                        <td className={cn("px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap")}>
                          {formattedDate}
                        </td>
                        <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                            methodBadgeClass
                          )}>
                            {method}
                          </span>
                        </td>
                        <td className="px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold text-cyan-400 dark:text-cyan-300 whitespace-nowrap">
                          {formatCurrency(tx.totalAmount, currency)}
                        </td>
                        <td className={cn("px-3 lg:px-6 py-3.5 text-center font-mono text-xs font-bold whitespace-nowrap", theme === "dark" ? "text-slate-300" : "text-slate-700")}>
                          {getTillNumber(tx.cashierId)}
                        </td>
                        <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTxMenuAnchor({
                                  id: tx.id,
                                  x: rect.left,
                                  y: rect.bottom,
                                });
                              }}
                              className={cn(
                                "w-8 h-8 rounded-xl border flex items-center justify-center shadow-xs transition-all duration-200 hover:scale-105 shrink-0 cursor-pointer",
                                theme === 'dark' 
                                  ? "bg-black/40 border-white/20 text-cyan-400 hover:bg-cyan-500/20" 
                                  : "bg-white border-slate-300 text-blue-900 hover:bg-slate-100"
                              )}
                            >
                              <Menu size={14} className={theme === 'dark' ? "text-cyan-400" : "text-blue-900"} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {currentTxs.length === 0 && (
                    /* BLOCK: Empty Audit Trail Table Row - Displays zero audit trail records status card inside table */
                    <tr className="audit-trail-empty-table__row border-0">
                      <td colSpan={7} className="audit-trail-empty-table__cell py-16 text-center">
                        <div className="audit-trail-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                          <Package size={54} strokeWidth={1.5} className={cn("audit-trail-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("audit-trail-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                            No Audit Trail Records Identified
                          </p>
                          <p className={cn("audit-trail-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            No transaction history logs found for this period
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'products' && (
          <ProductHealthDashboard
            products={products}
            currentTxs={currentTxs}
            theme={theme}
            currency={currency}
            formatCurrency={formatCurrency}
            limitLetters={limitLetters}
          />
        )}

        {/* Legacy block removed */}
        {false && (
          <div className="hidden">
            <div>
              <div>
                {filteredProducts.map(prod => {
                  const stockVal = prod.stockLevel || 0;
                  const valuation = stockVal * (prod.price || 0);
                  const isOutOfStock = stockVal === 0;
                  const isLowStock = stockVal <= 5;
                  const percentage = Math.min(100, Math.max(0, (stockVal / 50) * 100));
                  const safetyIndex = isOutOfStock ? "depleted" : isLowStock ? "depleted" : "stable";
                  const requiredReorder = isLowStock ? `${25 - stockVal}` : "0";

                  // BLOCK: Mobile Stock Product Card - Styled precisely to match Inventory Holdings card
                  return (
                    <div 
                      key={`report-prod-card-mobile-${prod.id}`}
                      className={cn(
                        "report-stock-card p-4 rounded-2xl border flex items-center justify-between group transition-all duration-300 hover:shadow-hard cursor-pointer",
                        theme === 'dark' 
                          ? "bg-dark-surface border-white/30 hover:border-brand-primary" 
                          : "bg-white border-slate-300 hover:border-black shadow-sm"
                      )}
                    >
                      <div className="report-stock-card__body flex items-center gap-4 min-w-0 flex-1">
                        <div className={cn(
                          "report-stock-card__image-container w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden border shrink-0 transition-all duration-300 group-hover:scale-110",
                          theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-400 shadow-inner"
                        )}>
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt="" className="report-stock-card__image w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Package size={24} className="report-stock-card__placeholder text-[#888] dark:text-[#555] group-hover:text-brand-primary transition-colors duration-200" />
                          )}
                        </div>
                        <div className="report-stock-card__details min-w-0 flex-1">
                          <h4 className={cn(
                            "report-stock-card__title text-xs font-black uppercase tracking-widest title-text leading-none mb-1.5 truncate transition-colors duration-200",
                            theme === 'dark' ? "text-white group-hover:text-brand-primary" : "text-black group-hover:text-brand-primary"
                          )}>{limitLetters(prod.name, 45)}</h4>
                          <div className="report-stock-card__info flex flex-col gap-1">
                            <p className="report-stock-card__code text-[9px] font-mono opacity-40 uppercase tracking-tight">
                              CODE: {prod.barcode || prod.sku || prod.id?.slice(-8).toUpperCase()}
                            </p>
                            <div className="report-stock-card__metrics flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "report-stock-card__status-dot w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
                                isOutOfStock || isLowStock ? "bg-red-500" : "bg-emerald-500"
                              )} />
                              <span className={cn(
                                "report-stock-card__metric report-stock-card__metric--stock font-mono text-[9px] font-semibold uppercase tracking-wider",
                                isOutOfStock || isLowStock ? "text-red-500" : (theme === 'dark' ? "text-white opacity-80" : "text-black opacity-80")
                              )}>
                                QTY: {stockVal}
                              </span>
                              <span className="report-stock-card__separator text-[9px] opacity-20 font-mono">|</span>
                              <span className={cn(
                                "report-stock-card__metric report-stock-card__metric--price font-mono text-[9px] font-medium tracking-wider",
                                theme === 'dark' ? "text-brand-primary" : "text-black opacity-80"
                              )}>
                                PRICE: {formatCurrency(prod.price || 0, currency)}
                              </span>
                              <span className="report-stock-card__separator text-[9px] opacity-20 font-mono">|</span>
                              <span className="report-stock-card__metric report-stock-card__metric--valuation text-[9px] font-mono opacity-40 uppercase">
                                VAL: {formatCurrency(valuation, currency)}
                              </span>
                            </div>
                            <div className="report-stock-card__badges mt-1 flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "report-stock-card__badge inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                                isOutOfStock ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                isLowStock ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              )}>
                                {safetyIndex}
                              </span>
                              {isLowStock && (
                                <span className="report-stock-card__badge report-stock-card__badge--reorder text-[8px] font-mono font-black text-red-500 uppercase tracking-wider animate-pulse">
                                  REORDER: {requiredReorder}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                /* BLOCK: Empty Stock Directory Mobile Card */
                <div className={cn(
                  "stock-directory-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                  theme === "dark" ? "bg-dark-surface border-white/30 text-white" : "bg-white border-slate-300 text-black"
                )}>
                  <Package size={54} strokeWidth={1.5} className={cn("stock-directory-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                  <p className={cn("stock-directory-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                    No Matching Products Found
                  </p>
                  <p className={cn("stock-directory-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                    Adjust filtration parameters or add catalog inventory
                  </p>
                </div>
              )}

            {/* Desktop Table Header - Separated from the actual table */}
            <div className="hidden lg:flex items-center justify-between mb-2 mt-1 px-1">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Stock Directory & Catalog Metrics</h3>
                <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Interactive catalog register, asset health, and restock metrics</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-lg text-[10px] font-black uppercase tracking-widest font-mono">
                  {filteredProducts.length} Items Listed
                </div>
              </div>
            </div>

            {/* Desktop Table - Products with Stock levels details */}
            {/* BLOCK: Report Stock Table - Desktop-first view of detailed inventory statistics */}
            <div className={cn(
               "report-stock-table hidden lg:block border rounded-2xl overflow-hidden transition-all duration-300 shadow-soft hover:shadow-hard mb-8 backdrop-blur-md",
               theme === 'dark' ? "bg-dark-surface border-white/35" : "bg-white border-slate-400"
            )}>
              <div className="report-stock-table__wrapper overflow-x-auto">
                <table className="report-stock-table__table w-full text-left min-w-[900px] border-collapse">
                  <thead className="report-stock-table__thead sticky top-0 z-20 shadow-sm">
                    <tr className={cn(
                      "report-stock-table__header-row text-left border-b transition-colors duration-200",
                      theme === "dark"
                        ? "bg-[#111c30] border-white/35"
                        : "bg-slate-100 border-slate-400",
                    )}>
                      <th className={cn("report-stock-table__header-cell pl-6 lg:pl-8 pr-3 lg:pr-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[120px]", theme === 'dark' ? "text-white" : "text-black/80")}>Pic</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[140px]", theme === 'dark' ? "text-white" : "text-black/80")}>Barcode</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[240px]", theme === 'dark' ? "text-white" : "text-black/80")}>Product Details</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[130px]", theme === 'dark' ? "text-white" : "text-black/80")}>Category</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[130px]", theme === 'dark' ? "text-white" : "text-black/80")}>Price</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[180px]", theme === 'dark' ? "text-white" : "text-black/80")}>Stock Health</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[110px]", theme === 'dark' ? "text-white" : "text-black/80")}>Status</th>
                      <th className={cn("report-stock-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[110px]", theme === 'dark' ? "text-white" : "text-black/80")}>Re-order</th>
                      <th className={cn("report-stock-table__header-cell pr-6 lg:pr-8 pl-3 py-5 lg:py-6 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-left w-[160px]", theme === 'dark' ? "text-white" : "text-black/80")}>Asset Valuation</th>
                    </tr>
                  </thead>
                  <tbody className="report-stock-table__tbody divide-y divide-dark-border/10">
                    {filteredProducts.map(prod => {
                      const stockVal = prod.stockLevel || 0;
                      const priceVal = prod.price || 0;
                      const valuation = stockVal * priceVal;
                      const isLowStock = stockVal <= 5;
                      const isOutOfStock = stockVal === 0;
                      const percentage = Math.min(100, Math.max(0, (stockVal / 50) * 100));
                      const safetyIndex = isOutOfStock ? "depleted" : isLowStock ? "depleted" : "stable";
                      const requiredReorder = isLowStock ? `${25 - stockVal}` : "0";

                      return (
                        <tr 
                          key={`report-table-row-${prod.id}`}
                          className={cn(
                            "report-stock-table__row border-b last:border-0 transition-colors duration-200 group text-xs",
                            theme === "dark"
                              ? "border-white/25 hover:bg-brand-primary/5 text-white"
                              : "border-slate-400 hover:bg-black/[0.025] text-black"
                          )}
                        >
                          <td className="report-stock-table__cell pl-6 lg:pl-8 pr-3 lg:pr-6 py-2.5 text-center">
                            <div className="flex justify-start">
                              <div className={cn(
                                "report-stock-table__image-container rounded-lg overflow-hidden border shrink-0 w-10 h-10 flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm",
                                theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-300 shadow-inner"
                              )}>
                                {prod.imageUrl ? (
                                  <img 
                                    src={prod.imageUrl} 
                                    alt={prod.name} 
                                    className="report-stock-table__image w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Package size={16} className="report-stock-table__placeholder text-[#888] dark:text-[#555] group-hover:text-brand-primary transition-colors duration-200" />
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={cn(
                            "report-stock-table__cell px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold text-left",
                            theme === 'dark' ? "text-white/90" : "text-black/90"
                          )}>
                            {prod.barcode || prod.sku || prod.id?.slice(-8).toUpperCase()}
                          </td>
                          <td className="report-stock-table__cell px-3 lg:px-6 py-3.5 text-left">
                            <p className={cn(
                              "report-stock-table__product-name text-xs font-black uppercase tracking-widest truncate group-hover:text-brand-primary transition-colors duration-200 line-clamp-1 flex-1 min-w-0 max-w-[150px] lg:max-w-[220px] xl:max-w-[320px]",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>{limitLetters(prod.name, 45)}</p>
                          </td>
                          <td className="report-stock-table__cell px-3 lg:px-6 py-3.5 text-left">
                            <span className="report-stock-table__category-badge text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 bg-black/5 dark:bg-white/5 rounded-xl border border-current/10">{prod.category || 'General'}</span>
                          </td>
                          <td className={cn(
                            "report-stock-table__cell px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold",
                            theme === 'dark' ? "text-brand-primary" : "text-black"
                          )}>{formatCurrency(priceVal, currency)}</td>
                          <td className="report-stock-table__cell px-3 lg:px-6 py-3.5 text-left">
                            <div className="report-stock-table__stock-progress flex flex-col gap-1 max-w-[130px]">
                              <div className="flex justify-between items-center text-[9px] font-black uppercase text-dark-muted">
                                <span>{stockVal} Unit{stockVal !== 1 && 's'}</span>
                                <span>{Math.round(percentage)}%</span>
                              </div>
                              <div className={cn(
                                "h-1.5 w-full rounded-full overflow-hidden",
                                theme === 'dark' ? "bg-white/10" : "bg-black/5"
                              )}>
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 1 }}
                                  className={cn(
                                    "h-full rounded-full",
                                    isOutOfStock ? "bg-red-500" :
                                    isLowStock ? "bg-yellow-500" :
                                    "bg-emerald-500"
                                  )}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="report-stock-table__cell px-3 lg:px-6 py-3.5 text-left">
                            <span className={cn(
                              "report-stock-table__status-badge text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border",
                              isOutOfStock ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              isLowStock ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                              "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            )}>
                              {safetyIndex}
                            </span>
                          </td>
                          <td className={cn(
                            "report-stock-table__cell px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-semibold",
                            isLowStock ? "text-red-500 font-bold" : "text-dark-muted"
                          )}>
                            {requiredReorder}
                          </td>
                          <td className="report-stock-table__cell pr-6 lg:pr-8 pl-3 py-3.5 text-left font-mono text-xs font-bold text-brand-primary">{formatCurrency(valuation, currency)}</td>
                        </tr>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      /* BLOCK: Empty Stock Directory Table Row */
                      <tr className="report-stock-table__empty-row border-0">
                        <td colSpan={9} className="report-stock-table__empty-cell py-16 text-center">
                          <div className="report-stock-table__empty-container flex flex-col items-center justify-center text-center gap-2">
                            <Package size={54} strokeWidth={1.5} className={cn("report-stock-table__empty-icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                            <p className={cn("report-stock-table__empty-title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                              No Matching Products Found
                            </p>
                            <p className={cn("report-stock-table__empty-subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                              Adjust filtration parameters or add catalog inventory
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        )}

        {activeSubTab === 'balances' && (
          <div
            className="space-y-8 font-presale presale-stream-container"
          >
            {/* BLOCK: Accounts Receivable Indicator Cards - Performance-style summary stats */}
            <div className="ar-metrics live-metrics-container font-presale font-live-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { 
                  label: 'Active Receivable Accounts', 
                  value: activeCreditAccountsCount, 
                  icon: CreditCard,
                  modifier: 'active-accounts',
                  iconColorClass: theme === 'dark' ? "text-cyan-300 bg-cyan-500/10 border border-cyan-500/20" : "text-blue-900 bg-blue-50 border border-blue-200"
                },
                { 
                  label: 'Allocated Credit Lines', 
                  value: formatCurrency(totalLimitAssigned, currency), 
                  icon: BarChart3,
                  modifier: 'allocated-credit',
                  iconColorClass: theme === 'dark' ? "text-blue-300 bg-blue-500/10 border border-blue-500/20" : "text-blue-800 bg-blue-50 border border-blue-200"
                },
                { 
                  label: 'Total Outstanding Receivables', 
                  value: formatCurrency(totalOwed, currency), 
                  icon: TrendingDown,
                  modifier: 'outstanding-receivables',
                  iconColorClass: theme === 'dark' ? "text-red-300 bg-red-500/10 border border-red-500/20" : "text-red-800 bg-red-50 border border-red-200",
                  valueColorClass: "text-red-500 dark:text-red-400"
                },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "ar-metric-card live-metrics-card presale-stream-card border p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-md font-presale",
                    `ar-metric-card--${stat.modifier}`,
                    theme === 'dark' 
                      ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                      : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                  )}
                >
                  <div className={cn(
                    "ar-metric-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center shadow-xs",
                    stat.iconColorClass
                  )}>
                    <stat.icon size={22} />
                  </div>
                  <div className="ar-metric-card__info min-w-0 flex-1">
                    <p className="ar-metric-card__label text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold mb-0.5 opacity-80">{stat.label}</p>
                    <p className={cn(
                      "ar-metric-card__value text-2xl font-bold font-mono tracking-tight mt-0.5 drop-shadow-xs",
                      stat.valueColorClass
                    )}>{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Balances Tabs Sub-divisions: Activities / Client Ledger */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* BLOCK: Accounts Receivable Ledger Card - Handles credit limits, utilization status, and drawing indicators */}
              <div className={cn(
                "ar-ledger-card presale-stream-card col-span-1 lg:col-span-7 border rounded-2xl p-6 h-fit transition-colors shadow-sm font-presale",
                theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
              )}>
                <div className="ar-ledger-card__header flex items-center justify-between mb-6 border-b border-solid border-inherit pb-4 flex-wrap gap-2">
                  <div className="ar-ledger-card__title-wrapper">
                    <h3 className="ar-ledger-card__title text-base font-extrabold uppercase tracking-tight font-presale">A/R Ledger</h3>
                    <p className="ar-ledger-card__description text-xs opacity-70 font-presale mt-0.5">Status of authorized accounts & drawings</p>
                  </div>
                  <span className="ar-ledger-card__badge px-3 py-1 bg-cyan-500/10 text-cyan-400 dark:text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider rounded-full border border-cyan-500/20">
                    {customerOutstandingBalances.filter(c => c.allowBalance).length} Active Accounts
                  </span>
                </div>

                <div className="ar-ledger-card__list-container flex flex-col gap-4 max-h-[550px] overflow-y-auto pr-1 no-scrollbar">
                  {customerOutstandingBalances.filter(c => c.allowBalance || c.owed > 0).map((cust, idx) => {
                    const q = searchQuery.toLowerCase();
                    if (q && !cust.name.toLowerCase().includes(q) && !(cust.email && cust.email.toLowerCase().includes(q))) {
                      return null;
                    }

                    // Status & Badging calculation
                    let statusText = "GOOD STANDING";
                    let statusColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
                    if (cust.owed > (cust.balanceLimit || 0) && (cust.balanceLimit || 0) > 0) {
                      statusText = "LIMIT EXCEEDED";
                      statusColor = "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse font-extrabold";
                    } else if (cust.owed > 0) {
                      const ratio = cust.owed / (cust.balanceLimit || 1);
                      if (ratio >= 0.8) {
                        statusText = "HIGH DRAWING";
                        statusColor = "bg-orange-500/10 text-orange-500 border-orange-500/20 font-bold";
                      } else {
                        statusText = "ACTIVE DRAWING";
                        statusColor = "bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold";
                      }
                    }

                    // Utilization bar calculation
                    const limit = cust.balanceLimit || 0;
                    const utilPercent = limit > 0 ? Math.min(100, Math.round((cust.owed / limit) * 100)) : 0;

                    return (
                      <div 
                        key={cust.id || idx} 
                        className={cn(
                          "ar-ledger-client-card presale-stream-card border p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs hover:shadow-sm border-l-4 border-l-cyan-500 font-presale",
                          theme === 'dark' 
                            ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                            : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                        )}
                      >
                        {/* BLOCK ELEMENT: Client Identification Segment */}
                        <div className="ar-ledger-client-card__profile flex items-center gap-3 min-w-0 sm:max-w-[200px] lg:max-w-[240px]">
                          <div className={cn(
                            "ar-ledger-client-card__avatar w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 shadow-inner",
                            getAvatarColor(cust.name)
                          )}>
                            {getInitials(cust.name)}
                          </div>
                          <div className="ar-ledger-client-card__profile-info min-w-0">
                            <p className="ar-ledger-client-card__client-name font-bold uppercase text-xs truncate">{cust.name}</p>
                            {cust.email && <p className="ar-ledger-client-card__client-email text-[10px] font-mono opacity-60 lowercase truncate">{cust.email}</p>}
                            {cust.phone && <p className="ar-ledger-client-card__client-phone text-[10px] font-mono opacity-50 tracking-wider font-medium truncate">{cust.phone}</p>}
                          </div>
                        </div>

                        {/* BLOCK ELEMENT: Credit Limit Segment */}
                        <div className="ar-ledger-client-card__limit flex flex-col justify-center min-w-[100px]">
                          <span className="ar-ledger-client-card__limit-label text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold opacity-70">CREDIT LIMIT</span>
                          <div className="ar-ledger-client-card__limit-value font-mono font-bold text-sm mt-0.5">
                            {formatCurrency(limit, currency)}
                          </div>
                          <div className="mt-1">
                            <span className={cn(
                              "ar-ledger-client-card__status-badge inline-block px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase border font-extrabold",
                              statusColor
                            )}>
                              {statusText}
                            </span>
                          </div>
                        </div>

                        {/* BLOCK ELEMENT: Utilization Progress Bar Segment */}
                        <div className="ar-ledger-client-card__utilization flex-1 max-w-full sm:max-w-[140px] flex flex-col justify-center">
                          {limit > 0 ? (
                            <div className="ar-ledger-client-card__util-wrapper w-full">
                              <div className="ar-ledger-client-card__util-stats flex justify-between items-center text-[10px] mb-1 font-mono font-bold">
                                <span className="ar-ledger-client-card__util-label opacity-60 uppercase">UTILIZED</span>
                                <span className={cn(
                                  "ar-ledger-client-card__util-value",
                                  utilPercent >= 90 ? "text-red-500 font-extrabold" : utilPercent >= 75 ? "text-orange-500" : "text-emerald-500"
                                )}>{utilPercent}%</span>
                              </div>
                              <div className="ar-ledger-client-card__util-track h-2 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                                <div 
                                  className={cn(
                                    "ar-ledger-client-card__util-bar h-full rounded-full transition-all duration-500",
                                    utilPercent >= 90 ? "bg-red-500" : utilPercent >= 75 ? "bg-orange-500" : "bg-emerald-500"
                                  )}
                                  style={{ width: `${utilPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="ar-ledger-client-card__util-label text-[10px] opacity-60 font-mono font-bold uppercase tracking-wider">UTILIZATION</span>
                              <span className="ar-ledger-client-card__no-limit text-[10px] opacity-60 font-mono font-bold uppercase tracking-wider mt-1">NO LIMIT SET</span>
                            </div>
                          )}
                        </div>

                        {/* BLOCK ELEMENT: Outstanding Balance Segment */}
                        <div className="ar-ledger-client-card__outstanding flex flex-col sm:items-end justify-center min-w-[100px]">
                          <span className="ar-ledger-client-card__outstanding-label text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold opacity-70">OUTSTANDING</span>
                          <div className={cn(
                            "ar-ledger-client-card__outstanding-value font-mono text-base font-bold tracking-tight mt-0.5",
                            cust.owed > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-500 dark:text-emerald-400"
                          )}>
                            {formatCurrency(cust.owed, currency)}
                          </div>
                          {cust.owed > 0 && limit > 0 && (
                            <p className="ar-ledger-client-card__outstanding-left text-[9px] opacity-60 uppercase font-bold font-presale mt-1 tracking-wider">
                              {formatCurrency(Math.max(0, limit - cust.owed), currency)} LEFT
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {customerOutstandingBalances.filter(c => c.allowBalance || c.owed > 0).length === 0 && (
                    /* BLOCK: Empty A/R Ledger Card - Displays zero active credit accounts card */
                    <div className={cn(
                      "ar-ledger-empty-card p-8 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm my-4 font-presale",
                      theme === "dark" ? "bg-dark-surface/50 border-white/20 text-white" : "bg-white border-slate-300 text-black"
                    )}>
                      <Package size={54} strokeWidth={1.5} className={cn("ar-ledger-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                      <p className={cn("ar-ledger-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                        No Active Credit Accounts
                      </p>
                      <p className={cn("ar-ledger-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                        No accounts detected with authorized drawing or balance
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* BLOCK: Accounts Receivable Journal Card - Handles audit history logs of charges, repayments, and limit updates */}
              <div className={cn(
                "ar-journal-card presale-stream-card col-span-1 lg:col-span-5 border rounded-2xl p-6 h-fit transition-colors shadow-sm font-presale",
                theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
              )}>
                <div className="ar-journal-card__header flex items-center justify-between mb-6 border-b border-solid border-inherit pb-4 flex-wrap gap-2">
                  <div className="ar-journal-card__title-wrapper">
                    <h3 className="ar-journal-card__title text-base font-extrabold uppercase tracking-tight font-presale">A/R Journal</h3>
                    <p className="ar-journal-card__description text-xs opacity-70 font-presale mt-0.5">Limits changes, drawings, and payments</p>
                  </div>
                  <span className="ar-journal-card__badge px-3 py-1 bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full border border-red-500/20">
                    {balances.length} Entries
                  </span>
                </div>

                <div className="ar-journal-card__list-container flex flex-col gap-4 max-h-[550px] overflow-y-auto pr-1 no-scrollbar">
                  {balances
                    .filter(b => {
                      if (!searchQuery) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        (b.customerName || '').toLowerCase().includes(q) ||
                        (b.description || '').toLowerCase().includes(q) ||
                        (b.type || '').toLowerCase().includes(q)
                      );
                    })
                    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
                    .map((item, idx) => {
                      const isCharge = item.type === 'customer_charge';
                      const isTopup = item.type === 'customer_balance';
                      const isInc = item.type === 'customer_limit_increase';
                      const isDec = item.type === 'customer_limit_decrease';

                      let badgeText = "ADJUST";
                      let badgeColor = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                      let iconElement = <TrendingDown className="w-3 h-3 inline mr-1" />;
                      let actionIcon = Calendar;
                      let actionColorClass = "text-slate-400 bg-slate-500/10 border border-slate-500/20";

                      if (isCharge) {
                        badgeText = "CHARGE";
                        badgeColor = "bg-red-500/15 text-red-400 border-red-500/30 font-extrabold";
                        iconElement = <TrendingDown className="w-3.5 h-3.5 inline mr-0.5 text-red-500" />;
                        actionIcon = TrendingDown;
                        actionColorClass = "text-red-400 bg-red-500/10 border border-red-500/20";
                      } else if (isTopup) {
                        badgeText = "PAYMENT";
                        badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-extrabold";
                        iconElement = <TrendingUp className="w-3.5 h-3.5 inline mr-0.5 text-emerald-500" />;
                        actionIcon = TrendingUp;
                        actionColorClass = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20";
                      } else if (isInc) {
                        badgeText = "LIMIT UP";
                        badgeColor = "bg-blue-500/15 text-blue-400 border-blue-500/30 font-bold";
                        iconElement = <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5 text-blue-500" />;
                        actionIcon = TrendingUp;
                        actionColorClass = "text-blue-400 bg-blue-500/10 border border-blue-500/20";
                      } else if (isDec) {
                        badgeText = "LIMIT DN";
                        badgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold";
                        iconElement = <ArrowDownLeft className="w-3.5 h-3.5 inline mr-0.5 text-amber-500" />;
                        actionIcon = TrendingDown;
                        actionColorClass = "text-amber-400 bg-amber-500/10 border border-amber-500/20";
                      }

                      return (
                        <div 
                          key={item.id || idx} 
                          className={cn(
                            "ar-journal-entry-card presale-stream-card border p-4 rounded-2xl flex items-center gap-4 transition-all shadow-xs hover:shadow-sm border-l-4 border-l-cyan-500 font-presale",
                            theme === 'dark' 
                              ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                              : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                          )}
                        >
                          {/* BLOCK ELEMENT: Visual Action Icon Container matching Live Metrics Cards */}
                          <div className={cn(
                            "ar-journal-entry-card__icon-wrapper p-3 rounded-xl shrink-0 flex items-center justify-center shadow-xs",
                            actionColorClass
                          )}>
                            {React.createElement(actionIcon, { size: 18 })}
                          </div>

                          {/* BLOCK ELEMENT: Info Details Segment */}
                          <div className="ar-journal-entry-card__info min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                              <span className="ar-journal-entry-card__client-name font-bold uppercase text-xs truncate">{item.customerName || 'N/A'}</span>
                              <span className={cn(
                                "ar-journal-entry-card__badge px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase border w-fit font-extrabold",
                                badgeColor
                              )}>
                                {badgeText}
                              </span>
                            </div>
                            <p className="ar-journal-entry-card__description text-[10px] opacity-70 mt-1 font-medium leading-tight line-clamp-2">{item.description}</p>
                            <div className="ar-journal-entry-card__date-wrapper text-[10px] font-mono opacity-60 font-medium flex items-center gap-1 mt-1.5">
                              <Calendar size={10} />
                              <span>{item.date ? format(new Date(item.date), 'dd MMM yyyy HH:mm') : 'N/A'}</span>
                            </div>
                          </div>

                          {/* BLOCK ELEMENT: Amount Value Segment */}
                          <div className="ar-journal-entry-card__amount text-right shrink-0 min-w-[80px]">
                            <span className="ar-journal-entry-card__amount-label text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-wider font-bold opacity-70 block">AMOUNT</span>
                            <div className={cn(
                              "ar-journal-entry-card__amount-value font-mono font-bold text-sm whitespace-nowrap mt-0.5 flex items-center justify-end",
                              isCharge ? "text-red-500 dark:text-red-400" : isTopup ? "text-emerald-500 dark:text-emerald-400" : isInc ? "text-blue-500 dark:text-blue-400" : "text-amber-500 dark:text-amber-400"
                            )}>
                              {iconElement}
                              <span>{formatCurrency(item.amount || 0, currency)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {balances.length === 0 && (
                    /* BLOCK: Empty A/R Journal Card - Displays zero balance logs card */
                    <div className={cn(
                      "ar-journal-empty-card p-8 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm my-4 font-presale",
                      theme === "dark" ? "bg-dark-surface/50 border-white/20 text-white" : "bg-white border-slate-300 text-black"
                    )}>
                      <Package size={54} strokeWidth={1.5} className={cn("ar-journal-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                      <p className={cn("ar-journal-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                        No Balance Logs Identified
                      </p>
                      <p className={cn("ar-journal-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                        No customer charge, payment, or limit adjustment entries logged
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Dropdown Menu */}
        {txMenuAnchor && (
          <motion.div
            key="tx-menu-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150]"
            onClick={() => setTxMenuAnchor(null)}
          />
        )}
        {txMenuAnchor && (
          <motion.div
            key="tx-menu"
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            style={{
              top: Math.min(txMenuAnchor.y, window.innerHeight - 200),
              left: Math.max(
                10,
                Math.min(
                  window.innerWidth - 200,
                  txMenuAnchor.x - 180,
                ),
              ),
            }}
            className={cn(
              "fixed z-[151] w-48 rounded-xl border shadow-hard p-1 backdrop-blur-md overflow-hidden",
              theme === "dark"
                ? "bg-dark-surface/90 border-white/30"
                : "bg-white/90 border-slate-400",
            )}
          >
            <button
              onClick={() => {
                const tx = transactions.find(
                  (t) => t.id === txMenuAnchor.id,
                );
                if (tx) {
                  setViewingTransaction(tx);
                }
                setTxMenuAnchor(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-left cursor-pointer",
                theme === "dark" ? "text-white hover:bg-white/5" : "text-black hover:bg-black/5",
              )}
            >
              <Eye size={14} className="text-brand-primary" /> View Details
            </button>
            <button
              onClick={() => {
                const tx = transactions.find(
                  (t) => t.id === txMenuAnchor.id,
                );
                if (tx) {
                  // Generate and download Presale Manifest PDF
                  const doc = new jsPDF();
                  doc.setFontSize(20);
                  doc.text("PRESALE MANIFEST", 10, 20);
                  doc.setFontSize(10);
                  doc.text(`Transaction Reference: ${tx.id}`, 10, 30);
                  doc.text(
                    `Operator ID: ${tx.cashierId}`,
                    10,
                    35,
                  );
                  doc.text(`Customer/Designation: ${tx.customerName || "Walk-In"}`, 10, 40);
                  doc.text(`Status: Completed`, 10, 45);
                  let y = 60;
                  (tx.items || []).forEach((item: any) => {
                    doc.text(`${item.name} x ${item.quantity}`, 10, y);
                    doc.text(
                      `${formatCurrency(item.price * item.quantity, currency)}`,
                      160,
                      y,
                    );
                    y += 10;
                  });
                  doc.text(
                    `TOTAL: ${formatCurrency(tx.totalAmount, currency)}`,
                    140,
                    y + 10,
                  );
                  doc.save(`Presale_Manifest_${tx.id}.pdf`);
                }
                setTxMenuAnchor(null);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-left cursor-pointer",
                theme === "dark" ? "text-white hover:bg-white/5" : "text-black hover:bg-black/5",
              )}
            >
              <Printer size={14} className="text-brand-primary" /> Presale Manifest
            </button>
          </motion.div>
        )}

        {/* View Transaction Modal (Transaction Audit) */}
        {viewingTransaction && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="tx-audit-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              onClick={handleBackdropClick}
            />

            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className={cn(
                "popup-card tx-audit-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                theme === "dark"
                  ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                  : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header Section */}
              <div className={cn(
                "popup-card__header tx-audit-popup-card__header pb-4 pt-4 border-b border-solid grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 px-6 md:px-8 shrink-0 relative z-10",
                theme === "dark" ? "bg-[#020d30] border-white/60 text-white" : "bg-white border-black/60 text-black",
              )}>
                <div className="flex justify-start">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                    theme === "dark" ? "bg-black/40 border-white/30 text-brand-primary" : "bg-white border-slate-400 text-brand-primary",
                  )}>
                    <TrendingUp size={16} />
                  </div>
                </div>

                <div className="text-center flex flex-col items-center justify-center font-presale">
                  <h3 className={cn(
                    "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                    theme === "dark" ? "text-cyan-400" : "text-[#062A95]",
                  )}>
                    Transaction Audit
                  </h3>
                  <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                    Snapshot of Record #{viewingTransaction.id}
                  </span>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setViewingTransaction(null)}
                    className={cn(
                      "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                      theme === "dark" ? "bg-black/40 border-white/40 text-white hover:bg-gray-950" : "bg-white border-slate-400 text-black hover:bg-gray-50",
                    )}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body Section */}
              <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col min-h-0">
                {/* Desktop view (table) */}
                <div className={cn(
                  "hidden md:block rounded-xl border overflow-hidden flex-1 overflow-y-auto no-scrollbar max-h-[55vh]",
                  theme === "dark" ? "border-white/20 bg-[#081335]" : "border-slate-400 bg-gray-50"
                )}>
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className={cn(
                        "border-b transition-colors duration-200 text-[10px] lg:text-xs font-bold uppercase tracking-widest sticky top-0 z-10",
                        theme === "dark" ? "bg-[#111c30] border-white/25 text-white/80" : "bg-slate-100 border-slate-400 text-black/80"
                      )}>
                        <th className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-5 lg:py-6 w-[70px] lg:w-[100px] text-left">Line</th>
                        <th className="px-3 lg:px-6 py-5 lg:py-6 w-[110px] lg:w-[180px] text-left">Barcode</th>
                        <th className="px-3 lg:px-6 py-5 lg:py-6 text-left">Product Name</th>
                        <th className="px-3 lg:px-6 py-5 lg:py-6 text-left w-[90px] lg:w-[140px]">Qty</th>
                        <th className="px-3 lg:px-6 py-5 lg:py-6 text-left w-[110px] lg:w-[180px]">Price</th>
                        <th className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-5 lg:py-6 text-left w-[110px] lg:w-[180px]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingTransaction.items || []).map((item: any, idx: number) => {
                        const itemPrice = item.price || 0;
                        const itemQty = item.quantity || 1;
                        const itemTotal = itemPrice * itemQty;
                        const shortSku = item.id ? (item.id.slice(0, 8).toUpperCase()) : "N/A";
                        const itemBarcode = item.barcode || item.sku || shortSku;
                        
                        return (
                          <tr 
                            key={idx}
                            className={cn(
                              "border-b last:border-0 transition-colors duration-150 text-xs font-semibold uppercase tracking-wider",
                              theme === "dark" 
                                ? "border-white/10 hover:bg-white/5 text-white" 
                                : "border-slate-300 hover:bg-black/[0.02] text-black"
                            )}
                          >
                            <td className="pl-4 py-3 font-mono text-[10px] opacity-60 text-left">
                              {String(idx + 1).padStart(2, "0")}
                            </td>
                            <td className="px-3 py-3 font-mono text-[10px] font-bold opacity-70 text-left">
                              {itemBarcode}
                            </td>
                            <td className="px-3 py-3 font-black text-[11px] max-w-[180px] truncate text-left">
                              {item.name}
                            </td>
                            <td className="px-3 py-3 font-mono font-bold text-xs text-left">
                              {itemQty}
                            </td>
                            <td className="px-3 py-3 font-mono text-[11px] opacity-85 text-left">
                              {formatCurrency(itemPrice, currency)}
                            </td>
                            <td className="pr-4 py-3 font-mono font-black text-brand-primary text-left">
                              {formatCurrency(itemTotal, currency)}
                            </td>
                          </tr>
                        );
                      })}
                      {(!viewingTransaction.items || viewingTransaction.items.length === 0) && (
                        /* BLOCK: Empty Transaction Record Items Table Row */
                        <tr className="tx-modal-empty-table__row border-0">
                          <td colSpan={6} className="tx-modal-empty-table__cell py-16 text-center">
                            <div className="tx-modal-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("tx-modal-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("tx-modal-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                No Items Found In Record
                              </p>
                              <p className={cn("tx-modal-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No itemized line items recorded
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view (cards) */}
                <div className="block md:hidden flex-1 overflow-y-auto no-scrollbar max-h-[55vh] space-y-3">
                  {(viewingTransaction.items || []).map((item: any, idx: number) => {
                    const itemPrice = item.price || 0;
                    const itemQty = item.quantity || 1;
                    const itemTotal = itemPrice * itemQty;
                    const shortSku = item.id ? (item.id.slice(0, 8).toUpperCase()) : "N/A";
                    const itemBarcode = item.barcode || item.sku || shortSku;
                    
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "p-4 rounded-xl border flex flex-col gap-3 transition-colors duration-150",
                          theme === "dark" 
                            ? "border-white/10 bg-[#081335] text-white hover:bg-white/5" 
                            : "border-slate-300 bg-slate-50 text-black hover:bg-black/[0.02]"
                        )}
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-dashed border-inherit">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary font-black uppercase">
                              Line {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-[9px] font-bold opacity-60">
                              {itemBarcode}
                            </span>
                          </div>
                          <span className="font-mono font-black text-xs text-brand-primary">
                            {formatCurrency(itemTotal, currency)}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <p className="font-black text-xs uppercase tracking-wide leading-tight">
                            {item.name}
                          </p>
                          <div className="flex justify-between items-center mt-1 text-[10px] font-semibold opacity-80 font-mono">
                            <span>Qty: {itemQty}</span>
                            <span>Price: {formatCurrency(itemPrice, currency)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!viewingTransaction.items || viewingTransaction.items.length === 0) && (
                    /* BLOCK: Empty Transaction Record Items Mobile Card */
                    <div className={cn(
                      "tx-modal-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                      theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                    )}>
                      <Package size={54} strokeWidth={1.5} className={cn("tx-modal-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                      <p className={cn("tx-modal-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                        No Items Found In Record
                      </p>
                      <p className={cn("tx-modal-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                        No itemized line items recorded
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Total Valuation Card */}
              <div className={cn(
                "pt-3.5 pb-3.5 px-6 md:px-8 border-t border-inherit flex flex-row items-center justify-between gap-4 shrink-0 bg-inherit pb-safe"
              )}>
                <div className={cn(
                  "py-2 px-4 rounded-xl border flex flex-row items-center justify-between gap-4 w-full sm:w-auto sm:min-w-[240px]",
                  theme === "dark"
                    ? "bg-gradient-to-r from-[#06143c] to-[#020921] border-[#123ebd]/40 text-white"
                    : "bg-gradient-to-r from-slate-100 to-slate-50 border-slate-300 text-black"
                )}>
                  <p className={cn(
                    "text-xs uppercase font-black tracking-wider whitespace-nowrap leading-none",
                    theme === "dark" ? "text-[#00E5FF]/90" : "text-[#062A95]"
                  )}>
                    Total Valuation
                  </p>
                  <p className="text-base sm:text-lg font-mono font-black text-brand-primary leading-none">
                    {formatCurrency(viewingTransaction.totalAmount, currency)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
