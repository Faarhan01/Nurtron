/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw, 
  Trash2,
  Download,
  Barcode,
  Save,
  Eye,
  ShoppingBag,
  Printer,
  Tags,
  Truck,
  Users,
  LayoutGrid,
  Menu,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  X,
  Lock,
  Wallet,
  BarChart3,
  Mail,
  Phone,
  MapPin,
  Globe,
  CreditCard,
  MoreVertical,
  Landmark,
  Database,
  ShoppingCart,
  Edit2,
  AlertTriangle,
  Upload,
  Maximize2,
  CheckSquare,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
const limitLetters = (str: string, maxChars: number = 30) => {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars) + '...';
};
import { formatCurrency, cn, OperationType, handleFirestoreError, maskEmail, handleBackdropClick } from '../lib/utils';
import { db, auth } from '../lib/firebase';
import { collection, 
  onSnapshot, 
  addDoc,
  deleteDoc,
  doc, 
  getDoc,
  setDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  increment } from "../lib/firebase";
import { Product } from '../types';
import { MOCK_PRODUCTS } from '../mockData';
import { motion, AnimatePresence } from 'motion/react';

interface Category {
  id: string;
  name: string;
  itemCount: number;
  subCategory?: string;
}

interface Supplier {
  id: string;
  name: string;
  contact: string;
  category: string;
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  address?: string;
  phone?: string;
  allowBalance?: boolean;
  balanceLimit?: number;
  accountBalance?: number;
  totalSpent: number;
  customerId?: string;
  createdAt?: any;
}

import { format } from 'date-fns';
import { User } from "../lib/firebase";
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { useTheme } from '../context/ThemeContext';

import { UserRole } from '../types';

interface InventoryProps {
  user: User | null;
  theme?: 'dark' | 'light';
  storeId?: string;
  currency?: string;
  module?: 'inventory' | 'vault' | 'balances';
  onModuleChange?: (module: 'inventory' | 'vault' | 'balances') => void;
  onNotificationTrigger?: () => void;
  permissions?: Record<string, boolean>;
  role?: UserRole;
  productLayout?: 'grid' | 'list-img' | 'list-text';
  onProductLayoutChange?: (layout: 'grid' | 'list-img' | 'list-text') => void;
  initialFilter?: string | null;
  onClearInitialFilter?: () => void;
  managerEmail?: string;
}

let cachedProducts: Product[] | null = null;
let cachedCategories: Category[] | null = null;
let cachedSuppliers: Supplier[] | null = null;
let cachedCustomers: Customer[] | null = null;
let cachedExpenditures: any[] | null = null;
let cachedRevenue: any[] | null = null;
let cachedBalanceAdjustments: any[] | null = null;
let isFirstLoadOfSession = true;

export const Inventory: React.FC<InventoryProps> = ({ 
  user, 
  theme = 'dark',
  storeId = 'STR-100100',
  currency = 'USD',
  module = 'inventory',
  onModuleChange,
  onNotificationTrigger,
  permissions = { manage_vault: true, manage_balances: true },
  role = 'Manager',
  productLayout = 'grid',
  onProductLayoutChange,
  initialFilter,
  onClearInitialFilter,
  managerEmail
}) => {
  const activeManagerEmail = (managerEmail || localStorage.getItem('nurtron_registered_manager_email') || user?.email || 'admin@megapos.pos').toLowerCase().trim();
  const invTabsRef = React.useRef<HTMLDivElement>(null);
  const { themePreset } = useTheme();
  const inputClassName = cn(
    "w-full rounded-lg py-2 px-3 outline-none text-xs font-presale font-medium tracking-tight border transition-all duration-300 shadow-sm",
    theme === 'dark' 
      ? (themePreset === 'saas-dark'
          ? "bg-black border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
          : "bg-black border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
      : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
  );
  const labelClassName = cn(
    "text-xs font-presale font-bold tracking-tight block text-left mb-2",
    theme === 'dark' ? "text-slate-200" : "text-slate-700"
  );
  const [activeTab, setActiveTab] = React.useState<string>('products');
  const [activeVaultTab, setActiveVaultTab] = React.useState<'expenditure' | 'cash_inflow'>('expenditure');
  const [activeBalanceTab, setActiveBalanceTab] = React.useState<'store' | 'expenditure' | 'customer' | 'shareholder'>('store');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('all');
  const [products, setProducts] = React.useState<Product[]>(() => {
    if (cachedProducts) return cachedProducts;
    try {
      const local = localStorage.getItem('nurtron_cached_products');
      if (local) {
        const parsed = JSON.parse(local);
        cachedProducts = parsed;
        return parsed;
      }
    } catch(e) {}
    return [];
  });
  const [categories, setCategories] = React.useState<Category[]>(cachedCategories || []);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>(cachedSuppliers || []);
  const [customers, setCustomers] = React.useState<Customer[]>(cachedCustomers || []);
  const [expenditures, setExpenditures] = React.useState<any[]>(cachedExpenditures || []);
  const [revenue, setRevenue] = React.useState<any[]>(cachedRevenue || []);
  const [balanceAdjustments, setBalanceAdjustments] = React.useState<any[]>(cachedBalanceAdjustments || []);
  const [loading, setLoading] = React.useState(isFirstLoadOfSession && !cachedProducts);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [viewingProductDetails, setViewingProductDetails] = React.useState<Product | null>(null);
  const [isImageExpanded, setIsImageExpanded] = React.useState(false);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = React.useState<string | null>(null);
  const [showMassDeleteConfirm, setShowMassDeleteConfirm] = React.useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false);
  const [isFabOpen, setIsFabOpen] = React.useState(false);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [isModuleMenuOpen, setIsModuleMenuOpen] = React.useState(false);
  const [stockFilter, setStockFilter] = React.useState<'all' | 'critical' | 'healthy' | 'low-stock'>('all');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = React.useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const [isEditModeEnabled, setIsEditModeEnabled] = React.useState(false);
  const [isMultiSelectEnabled, setIsMultiSelectEnabled] = React.useState(false);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [isMassEditPopupOpen, setIsMassEditPopupOpen] = React.useState(false);
  const [massEditTab, setMassEditTab] = React.useState<'promo' | 'prices' | 'stock' | 'delete'>('promo');
  const [massPromoActive, setMassPromoActive] = React.useState(false);
  const [massPromoPrice, setMassPromoPrice] = React.useState(0);
  const [massPromoStartDate, setMassPromoStartDate] = React.useState('');
  const [massPromoEndDate, setMassPromoEndDate] = React.useState('');
  const [massPromoLabel, setMassPromoLabel] = React.useState('');
  const [massCostPrice, setMassCostPrice] = React.useState<string>('');
  const [massPrice, setMassPrice] = React.useState<string>('');
  const [massStockChangeType, setMassStockChangeType] = React.useState<'add' | 'remove'>('add');
  const [massStockAmount, setMassStockAmount] = React.useState<string>('');
  const [importStatus, setImportStatus] = React.useState<'idle' | 'parsing' | 'ready' | 'importing' | 'success' | 'error'>('idle');
  const [importedProducts, setImportedProducts] = React.useState<any[]>([]);
  const [importError, setImportError] = React.useState('');
  const [dragActive, setDragActive] = React.useState(false);
  const [barcodeSearch, setBarcodeSearch] = React.useState('');
  const [selectedBarcodes, setSelectedBarcodes] = React.useState<Record<string, { selected: boolean; count: number }>>({});
  const [sortBy, setSortBy] = React.useState<'latest' | 'name' | 'price' | 'stock' | 'category'>('latest');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory, stockFilter]);
  
  const [presales, setPresales] = React.useState<any[]>([]);
  const [selectedCategoryInfo, setSelectedCategoryInfo] = React.useState<Category | null>(null);
  const [selectedSupplierInfo, setSelectedSupplierInfo] = React.useState<Supplier | null>(null);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = React.useState<Customer | null>(null);
  const [editingCategoryData, setEditingCategoryData] = React.useState<Category | null>(null);
  const [editingSupplierData, setEditingSupplierData] = React.useState<Supplier | null>(null);
  const [editingCustomerData, setEditingCustomerData] = React.useState<Customer | null>(null);
  const [isAddingBalance, setIsAddingBalance] = React.useState(false);
  const [balanceAddAmount, setBalanceAddAmount] = React.useState('');
  const [balanceAddDesc, setBalanceAddDesc] = React.useState('');
  const [isSubmittingBalance, setIsSubmittingBalance] = React.useState(false);

  const [newProduct, setNewProduct] = React.useState<Partial<Product>>({
    name: '',
    price: 0,
    costPrice: 0,
    category: 'beverages',
    stockLevel: 0,
    imageUrl: '',
    description: '',
    barcode: '',
    markupPrice: 0,
    discountPrice: 0,
    color: '',
    size: '',
    weight: '',
    palletSize: '',
    sku: '',
    variations: [],
    promoActive: false,
    promoPrice: 0,
    promoStartDate: '',
    promoEndDate: '',
    promoLabel: ''
  });

  const [newCategory, setNewCategory] = React.useState({ name: '', subCategory: '' });
  const [newSupplier, setNewSupplier] = React.useState({ 
    name: '', 
    contact: '', 
    category: 'General',
    address: '',
    website: '',
    email: '',
    phone: ''
  });
  const [productFormTab, setProductFormTab] = React.useState<'basic' | 'extra' | 'variation' | 'promo'>('basic');
  const [newExpenditure, setNewExpenditure] = React.useState({ description: '', amount: 0, category: 'Operational' });
  const [newRevenue, setNewRevenue] = React.useState({ source: '', amount: 0, category: 'Sales' });
  const [newBalanceAdj, setNewBalanceAdj] = React.useState({ description: '', amount: 0, type: '' });
  const [newCustomer, setNewCustomer] = React.useState({ 
    name: '', 
    email: '', 
    address: '', 
    phone: '', 
    allowBalance: false, 
    balanceLimit: 0,
    accountBalance: 0
  });
  
  const [lowStockThreshold, setLowStockThreshold] = React.useState(10);
  const [lowStockEnabled, setLowStockEnabled] = React.useState(true);
  const [hidePersonalInfo, setHidePersonalInfo] = React.useState(false);
  const [globalMarkup, setGlobalMarkup] = React.useState(0);
  const [globalDiscount, setGlobalDiscount] = React.useState(0);

  const renderInputDot = (value: any, maxLength?: number, rightClass: string = "right-3.5") => {
    const strVal = String(value !== undefined && value !== null ? value : "");
    const len = strVal.length;
    
    let dotColor = "bg-gray-300 dark:bg-zinc-700"; // Neutral grey for empty
    let isPulse = false;

    if (len > 0 && strVal !== "0" && strVal !== "0.00") {
      if (maxLength) {
        const ratio = len / maxLength;
        if (ratio >= 0.9) {
          dotColor = "bg-rose-500";
          isPulse = true;
        } else if (ratio >= 0.7) {
          dotColor = "bg-amber-500";
        } else {
          dotColor = "bg-emerald-500";
        }
      } else {
        dotColor = "bg-emerald-500";
      }
    }

    return (
      <span className={cn(
        "w-2 h-2 rounded-full absolute top-1/2 -translate-y-1/2 transition-all duration-300 shadow-sm pointer-events-none z-10",
        rightClass,
        dotColor,
        isPulse && "animate-pulse scale-110"
      )} />
    );
  };

  const handleDecimalInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      e.ctrlKey || e.metaKey
    ) {
      return;
    }
    if (e.key === '.' && !e.currentTarget.value.includes('.')) {
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleIntegerInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      e.ctrlKey || e.metaKey
    ) {
      return;
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const renderInputWithDot = (inputElement: React.ReactNode, value: any, maxLength?: number, isSelect: boolean = false) => {
    if (isSelect) {
      return (
        <div className="relative w-full flex items-center">
          {React.isValidElement(inputElement) ? React.cloneElement(inputElement as React.ReactElement<any>, {
            className: cn(
              (inputElement as React.ReactElement<any>).props?.className,
              "appearance-none pr-10 cursor-pointer"
            )
          }) : inputElement}
          <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 text-slate-400 dark:text-slate-300" />
        </div>
      );
    }
    return (
      <div className="relative w-full flex items-center">
        {React.isValidElement(inputElement) ? React.cloneElement(inputElement as React.ReactElement<any>, {
          className: cn((inputElement as React.ReactElement<any>).props?.className, "pr-8")
        }) : inputElement}
        {renderInputDot(value, maxLength, "right-3.5")}
      </div>
    );
  };
  const [desktopLayout, setDesktopLayout] = React.useState<'card' | 'table'>('table');
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [lastTransactionId, setLastTransactionId] = React.useState('');

  // Barcode Default Options States
  const [barcodeShowNames, setBarcodeShowNames] = React.useState(true);
  const [barcodeShowSkus, setBarcodeShowSkus] = React.useState(true);
  const [barcodeShowPerforation, setBarcodeShowPerforation] = React.useState(true);
  const [barcodeSpacingMargin, setBarcodeSpacingMargin] = React.useState('16px');
  const [barcodeHeight, setBarcodeHeight] = React.useState('5.5mm');
  const [barcodeShowArrow, setBarcodeShowArrow] = React.useState(true);
  const [barcodeLinkWithWhitespace, setBarcodeLinkWithWhitespace] = React.useState(false);
  
  const [presaleMenuAnchor, setPresaleMenuAnchor] = React.useState<{id: string, x: number, y: number} | null>(null);

  const [storeInfo, setStoreInfo] = React.useState({
    name: 'Apex Retail',
    streetNumber: '',
    streetName: '',
    suburb: '',
    phoneNumber: '',
    website: ''
  });

  React.useEffect(() => {
    if (isBarcodeModalOpen) {
      const initial: Record<string, { selected: boolean; count: number }> = {};
      products.forEach(p => {
        initial[p.id] = { selected: false, count: 1 };
      });
      setSelectedBarcodes(initial);
      setBarcodeSearch('');
    }
  }, [isBarcodeModalOpen, products]);

  React.useEffect(() => {
    if (isFirstLoadOfSession && !cachedProducts) {
      setLoading(true);
    }
    
    // Listen for products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const allFetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const fetchedProducts = allFetched.filter(p => {
        if (p.managerEmail) return p.managerEmail.toLowerCase().trim() === activeManagerEmail;
        if (p.ownerEmail) return p.ownerEmail.toLowerCase().trim() === activeManagerEmail;
        return activeManagerEmail === 'admin@megapos.pos' || activeManagerEmail === 'faarhanch@gmail.com';
      });

      cachedProducts = fetchedProducts;
      setProducts(fetchedProducts);
      try {
        localStorage.setItem('nurtron_cached_products', JSON.stringify(fetchedProducts));
      } catch(e) {}
      
      // Auto-seed for new accounts if no manager products exist
      if (fetchedProducts.length === 0 && (snapshot.empty || activeManagerEmail !== 'admin@megapos.pos')) {
        let cachedLocal: Product[] = [];
        try {
          const cachedStr = localStorage.getItem('nurtron_cached_products');
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            cachedLocal = (parsed || []).filter((p: any) => !p.managerEmail || p.managerEmail.toLowerCase().trim() === activeManagerEmail);
          }
        } catch(e) {}

        if (cachedLocal && cachedLocal.length > 0) {
          cachedProducts = cachedLocal;
          setProducts(cachedLocal);
          if (user) {
            try {
              const batch = writeBatch(db);
              cachedLocal.forEach((prod) => {
                const docRef = doc(db, 'products', prod.id);
                batch.set(docRef, { ...prod, managerEmail: activeManagerEmail });
              });
              batch.commit().catch(() => {});
            } catch(e) {}
          }
        } else {
          seedData();
        }
      }
      setLoading(false);
      isFirstLoadOfSession = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products', auth);
      setLoading(false);
    });

    // Listen for others (mocked for now or added if collections exist)
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const allCats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      const fetchedCategories = allCats.filter((c: any) => !c.managerEmail || c.managerEmail.toLowerCase().trim() === activeManagerEmail);
      cachedCategories = fetchedCategories;
      setCategories(fetchedCategories);
    }, () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Beverages', itemCount: 12 },
        { id: 'cat-2', name: 'Electronics', itemCount: 45 },
        { id: 'cat-3', name: 'Apparel', itemCount: 8 }
      ];
      cachedCategories = mockCategories;
      setCategories(mockCategories);
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const allSups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      const fetchedSuppliers = allSups.filter((s: any) => !s.managerEmail || s.managerEmail.toLowerCase().trim() === activeManagerEmail);
      cachedSuppliers = fetchedSuppliers;
      setSuppliers(fetchedSuppliers);
    }, () => {
      const mockSuppliers = [
        { id: 'sup-1', name: 'Global Tech', contact: 'John Smith', category: 'Electronics' },
        { id: 'sup-2', name: 'Fresh Foods Ltd', contact: 'Jane Doe', category: 'Food' }
      ];
      cachedSuppliers = mockSuppliers;
      setSuppliers(mockSuppliers);
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const allCusts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      const fetchedCustomers = allCusts.filter((c: any) => !c.managerEmail || c.managerEmail.toLowerCase().trim() === activeManagerEmail);
      cachedCustomers = fetchedCustomers;
      setCustomers(fetchedCustomers);
    }, () => {
      const mockCustomers = [
        { id: 'cust-1', name: 'Alice Wilson', email: 'alice@example.com', totalSpent: 1250 },
        { id: 'cust-2', name: 'Bob Roberts', email: 'bob@example.com', totalSpent: 840 }
      ];
      cachedCustomers = mockCustomers;
      setCustomers(mockCustomers);
    });

    const unsubExpenditures = onSnapshot(collection(db, 'expenditures'), (snapshot) => {
      const allExp = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedExpenditures = allExp.filter((e: any) => !e.managerEmail || e.managerEmail.toLowerCase().trim() === activeManagerEmail);
      cachedExpenditures = fetchedExpenditures;
      setExpenditures(fetchedExpenditures);
    }, () => {
      const mockExpenditures = [
        { id: 'EXP-001', description: 'Utility Bill - HQ', amount: 450.00, category: 'Operational', date: new Date().toISOString() },
        { id: 'EXP-002', description: 'Stock Acquisition', amount: 1200.00, category: 'Inventory', date: new Date().toISOString() }
      ];
      cachedExpenditures = mockExpenditures;
      setExpenditures(mockExpenditures);
    });

    const unsubRevenue = onSnapshot(collection(db, 'revenue'), (snapshot) => {
      const allRev = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedRevenue = allRev.filter((r: any) => !r.managerEmail || r.managerEmail.toLowerCase().trim() === activeManagerEmail);
      cachedRevenue = fetchedRevenue;
      setRevenue(fetchedRevenue);
    }, () => {
      const mockRevenue = [
        { id: 'REV-001', source: 'Direct Sales', amount: 8900.00, category: 'Sales', date: new Date().toISOString() }
      ];
      cachedRevenue = mockRevenue;
      setRevenue(mockRevenue);
    });

    const unsubBalances = onSnapshot(collection(db, 'balances'), (snapshot) => {
      const allBal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const fetchedBalances = allBal.filter((b: any) => !b.managerEmail || b.managerEmail.toLowerCase().trim() === activeManagerEmail);
      cachedBalanceAdjustments = fetchedBalances;
      setBalanceAdjustments(fetchedBalances);
    }, () => {
      const mockBalances = [
        { id: 'ADJ-001', description: 'Monthly Profit Allocation', amount: 25000.00, type: 'stakeholder_balance', date: new Date().toISOString() },
        { id: 'ADJ-002', description: 'Escrow Release', amount: 1200.00, type: 'client_balance', date: new Date().toISOString() }
      ];
      cachedBalanceAdjustments = mockBalances;
      setBalanceAdjustments(mockBalances);
    });

    const unsubPresales = onSnapshot(collection(db, 'presales'), (snapshot) => {
      const allPs = snapshot.docs.map(doc => {
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
          console.warn("Error parsing presale timestamp in Inventory:", e);
        }
        return {
          id: doc.id,
          op: data.operator,
          amount: data.amount,
          time: timeStr,
          status: data.status,
          managerEmail: data.managerEmail
        };
      });
      const filteredPs = allPs.filter((p: any) => !p.managerEmail || p.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setPresales(filteredPs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'presales', auth));

    const unsubSettings = onSnapshot(doc(db, 'settings', storeId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setLowStockThreshold(data.lowStockThreshold || 10);
        setLowStockEnabled(data.lowStockEnabled !== false);
        setHidePersonalInfo(data.hidePersonalInfo || false);
        setGlobalMarkup(data.globalMarkup || 0);
        setGlobalDiscount(data.globalDiscount || 0);
        setDesktopLayout(data.desktopLayout || 'table');
        setBarcodeShowNames(data.barcodeShowNames !== false);
        setBarcodeShowSkus(data.barcodeShowSkus !== false);
        setBarcodeShowPerforation(data.barcodeShowPerforation !== false);
        setBarcodeSpacingMargin(data.barcodeSpacingMargin || '16px');
        setBarcodeHeight(data.barcodeHeight || '5.5mm');
        setBarcodeShowArrow(data.barcodeShowArrow !== false);
        setBarcodeLinkWithWhitespace(data.barcodeLinkWithWhitespace || false);
        setStoreInfo({
          name: data.storeName || 'Apex Retail',
          streetNumber: data.streetNumber || '',
          streetName: data.streetName || '',
          suburb: data.suburb || '',
          phoneNumber: data.phoneNumber || '',
          website: data.website || ''
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `settings/${storeId}`, auth));

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSuppliers();
      unsubCustomers();
      unsubExpenditures();
      unsubRevenue();
      unsubBalances();
      unsubPresales();
      unsubSettings();
    };
  }, [user, storeId]);

  React.useEffect(() => {
    if (initialFilter) {
      if (initialFilter === 'low-stock') {
        setActiveTab('products');
        setStockFilter('low-stock');
        setIsFilterOpen(true);
      }
      if (onClearInitialFilter) onClearInitialFilter();
    }
  }, [initialFilter, onClearInitialFilter]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      const productId = editingProduct ? editingProduct.id : `prod-${Date.now()}`;
      const resolvedBarcode = (newProduct.barcode && newProduct.barcode.trim())
        ? newProduct.barcode.trim()
        : (editingProduct?.barcode || newProduct.sku || `BC-${productId.replace('prod-', '')}`);

      const productData = {
        ...newProduct,
        id: productId,
        barcode: resolvedBarcode,
        price: Number(newProduct.price),
        costPrice: Number(newProduct.costPrice || 0),
        markupPrice: Number(newProduct.markupPrice || 0),
        discountPrice: Number(newProduct.discountPrice || 0),
        stockLevel: Number(newProduct.stockLevel),
        promoActive: Boolean(newProduct.promoActive || false),
        promoPrice: Number(newProduct.promoPrice || 0),
        promoStartDate: newProduct.promoStartDate || '',
        promoEndDate: newProduct.promoEndDate || '',
        promoLabel: newProduct.promoLabel || '',
        managerEmail: activeManagerEmail
      } as Product;

      // Optimistically update React state & localStorage immediately
      setProducts(prev => {
        const exists = prev.some(p => p.id === productId);
        const updated = exists ? prev.map(p => p.id === productId ? productData : p) : [productData, ...prev];
        try {
          localStorage.setItem('nurtron_cached_products', JSON.stringify(updated));
        } catch(e) {}
        return updated;
      });

      // Reset modals immediately so user is never locked out
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
      setEditingProduct(null);
      setNewProduct({
        name: '',
        price: 0,
        costPrice: 0,
        category: 'beverages',
        stockLevel: 0,
        imageUrl: '',
        description: '',
        barcode: '',
        markupPrice: 0,
        discountPrice: 0,
        color: '',
        size: '',
        weight: '',
        palletSize: '',
        sku: '',
        variations: [],
        promoActive: false,
        promoPrice: 0,
        promoStartDate: '',
        promoEndDate: '',
        promoLabel: ''
      });

      // Save to Firestore with a 4s timeout fallback
      if (user) {
        try {
          await Promise.race([
            setDoc(doc(db, 'products', productId), productData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore operation timeout')), 4000))
          ]);
        } catch (err) {
          console.warn('[handleAddProduct] Firestore save notice (saved locally):', err);
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: product.price,
      costPrice: product.costPrice || 0,
      category: product.category,
      stockLevel: product.stockLevel,
      imageUrl: product.imageUrl || '',
      description: product.description || '',
      barcode: product.barcode || '',
      markupPrice: product.markupPrice || 0,
      discountPrice: product.discountPrice || 0,
      color: product.color || '',
      size: product.size || '',
      weight: product.weight || '',
      palletSize: product.palletSize || '',
      sku: product.sku || '',
      variations: product.variations || [],
      promoActive: product.promoActive || false,
      promoPrice: product.promoPrice || 0,
      promoStartDate: product.promoStartDate || '',
      promoEndDate: product.promoEndDate || '',
      promoLabel: product.promoLabel || ''
    });
    setIsEditModalOpen(true);
  };

  const seedData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      MOCK_PRODUCTS.forEach((prod) => {
        const prodId = `${activeManagerEmail.replace(/[^a-zA-Z0-9]/g, '_')}-${prod.id}`;
        const docRef = doc(db, 'products', prodId);
        const seedProd = {
          ...prod,
          id: prodId,
          managerEmail: activeManagerEmail,
          costPrice: Number((prod.price * 0.6).toFixed(2)) // Default cost price for seed data
        };
        batch.set(docRef, seedProd);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products', auth);
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const row: string[] = [];
      let insideQuote = false;
      let entry = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          row.push(entry.trim().replace(/^"|"$/g, ''));
          entry = '';
        } else {
          entry += char;
        }
      }
      row.push(entry.trim().replace(/^"|"$/g, ''));
      result.push(row);
    }
    return result;
  };

  const mapCSVRows = (rows: string[][]) => {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.toLowerCase().trim().replace(/["']/g, ''));
    const dataRows = rows.slice(1);

    // find index for each field
    const nameIdx = headers.findIndex(h => ['name', 'title', 'designation', 'asset', 'product'].some(alias => h === alias || h.includes(alias)));
    const priceIdx = headers.findIndex(h => ['price', 'retail', 'selling', 'rate', 'retailprice'].some(alias => h === alias || h.includes(alias)));
    const costIdx = headers.findIndex(h => ['cost', 'purchase', 'buying', 'costprice'].some(alias => h === alias || h.includes(alias)));
    const categoryIdx = headers.findIndex(h => ['category', 'segment', 'type', 'group'].some(alias => h === alias || h.includes(alias)));
    const stockIdx = headers.findIndex(h => ['stock', 'quantity', 'qty', 'count', 'level', 'stocklevel'].some(alias => h === alias || h.includes(alias)));
    const barcodeIdx = headers.findIndex(h => ['barcode', 'code', 'upc', 'bar'].some(alias => h === alias || h.includes(alias)));
    const descIdx = headers.findIndex(h => ['desc', 'about', 'note', 'description'].some(alias => h === alias || h.includes(alias)));
    const skuIdx = headers.findIndex(h => ['sku', 'ref', 'reference'].some(alias => h === alias || h.includes(alias)));

    return dataRows.map((row, index) => {
      const getValue = (idx: number) => idx !== -1 && row[idx] !== undefined ? row[idx].trim() : '';

      const rawName = getValue(nameIdx);
      const name = rawName.slice(0, 40); // 40 char limit
      
      const rawPriceStr = getValue(priceIdx);
      const price = parseFloat(rawPriceStr.replace(/[^0-9.]/g, '')) || 0;
      
      const rawCostStr = getValue(costIdx);
      const costPrice = parseFloat(rawCostStr.replace(/[^0-9.]/g, '')) || 0;
      
      const rawStockStr = getValue(stockIdx);
      const stockLevel = parseInt(rawStockStr.replace(/[^0-9]/g, '')) || 0;
      
      const rawBarcode = getValue(barcodeIdx);
      const barcode = rawBarcode.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20); // clean barcode
      
      const sku = getValue(skuIdx);
      const category = getValue(categoryIdx).toLowerCase();
      const description = getValue(descIdx);

      const isValid = rawName.trim().length > 0;

      return {
        id: `prod-${Date.now()}-${index}`,
        name: name || `Asset #${index + 1}`,
        price,
        costPrice,
        category: category || 'general',
        stockLevel,
        barcode,
        sku,
        description,
        isValid
      };
    });
  };

  const handleCSVUpload = (file: File) => {
    if (!file) return;
    setImportStatus('parsing');
    setImportError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error("File is empty or could not be read.");
        }
        
        const rawRows = parseCSV(text);
        if (rawRows.length < 2) {
          throw new Error("CSV file requires a header row and at least one data row.");
        }
        
        const mapped = mapCSVRows(rawRows);
        if (mapped.length === 0) {
          throw new Error("No products could be parsed from the CSV.");
        }
        
        setImportedProducts(mapped);
        setImportStatus('ready');
      } catch (err: any) {
        setImportError(err.message || 'An error occurred while parsing the CSV.');
        setImportStatus('error');
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read the file.');
      setImportStatus('error');
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (!user || importedProducts.length === 0) return;
    setImportStatus('importing');
    
    try {
      const validProducts = importedProducts.filter(p => p.isValid);
      if (validProducts.length === 0) {
        throw new Error("All parsed products are invalid.");
      }

      const CHUNK_SIZE = 400;
      for (let i = 0; i < validProducts.length; i += CHUNK_SIZE) {
        const chunk = validProducts.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(prod => {
          const docRef = doc(db, 'products', prod.id);
          const productData = {
            id: prod.id,
            name: prod.name,
            price: prod.price,
            costPrice: prod.costPrice,
            category: prod.category || 'general',
            stockLevel: prod.stockLevel,
            imageUrl: '',
            description: prod.description || '',
            barcode: prod.barcode || '',
            sku: prod.sku || '',
            markupPrice: 0,
            discountPrice: 0,
            color: '',
            size: '',
            weight: '',
            palletSize: '',
            variations: []
          };
          batch.set(docRef, productData);
        });
        
        await batch.commit();
      }

      setImportStatus('success');
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportStatus('idle');
        setImportedProducts([]);
      }, 1500);
    } catch (err: any) {
      setImportError(err.message || 'An error occurred during import.');
      setImportStatus('error');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`, auth);
    }
  };

  const applyMassPromo = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedProductIds.forEach(id => {
        const docRef = doc(db, 'products', id);
        batch.update(docRef, {
          promoActive: massPromoActive,
          promoPrice: Number(massPromoPrice || 0),
          promoStartDate: massPromoStartDate,
          promoEndDate: massPromoEndDate,
          promoLabel: massPromoLabel
        });
      });
      await batch.commit();
      setIsMassEditPopupOpen(false);
      setSelectedProductIds([]);
      setIsMultiSelectEnabled(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products/batch', auth);
    } finally {
      setLoading(false);
    }
  };

  const applyMassPrices = async () => {
    if (massCostPrice === '' && massPrice === '') {
      alert("Please specify at least one price field (Cost Price or Marked Price) to apply.");
      return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedProductIds.forEach(id => {
        const docRef = doc(db, 'products', id);
        const updates: any = {};
        if (massCostPrice !== '') {
          updates.costPrice = Number(massCostPrice);
        }
        if (massPrice !== '') {
          updates.price = Number(massPrice);
        }
        batch.update(docRef, updates);
      });
      await batch.commit();
      setIsMassEditPopupOpen(false);
      setSelectedProductIds([]);
      setIsMultiSelectEnabled(false);
      setMassCostPrice('');
      setMassPrice('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products/batch', auth);
    } finally {
      setLoading(false);
    }
  };

  const applyMassStock = async () => {
    if (massStockAmount === '') {
      alert("Please specify a stock amount to apply.");
      return;
    }
    const amount = Number(massStockAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid stock amount greater than 0.");
      return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedProductIds.forEach(id => {
        const product = products.find(p => p.id === id);
        const currentStock = product ? (product.stockLevel || 0) : 0;
        const newStock = massStockChangeType === 'add' 
          ? currentStock + amount 
          : Math.max(0, currentStock - amount);
        
        const docRef = doc(db, 'products', id);
        batch.update(docRef, { stockLevel: newStock });
      });
      await batch.commit();
      setIsMassEditPopupOpen(false);
      setSelectedProductIds([]);
      setIsMultiSelectEnabled(false);
      setMassStockAmount('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products/batch', auth);
    } finally {
      setLoading(false);
    }
  };

  const applyMassDelete = async () => {
    setShowMassDeleteConfirm(false);
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedProductIds.forEach(id => {
        const docRef = doc(db, 'products', id);
        batch.delete(docRef);
      });
      await batch.commit();
      setIsMassEditPopupOpen(false);
      setSelectedProductIds([]);
      setIsMultiSelectEnabled(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products/batch', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const catId = `cat-${Date.now()}`;
      await setDoc(doc(db, 'categories', catId), {
        ...newCategory,
        id: catId,
        itemCount: 0
      });
      setIsAddModalOpen(false);
      setNewCategory({ name: '', subCategory: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const supId = `sup-${Date.now()}`;
      await setDoc(doc(db, 'suppliers', supId), {
        ...newSupplier,
        id: supId
      });
      setIsAddModalOpen(false);
      setNewSupplier({ name: '', contact: '', category: 'General', address: '', website: '', email: '', phone: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'suppliers', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const custId = `cust-${Date.now()}`;
      const codeNum = Math.floor(100000 + Math.random() * 900000);
      const customerId = `CUST-${codeNum}`;
      await setDoc(doc(db, 'customers', custId), {
        ...newCustomer,
        id: custId,
        customerId: customerId,
        totalSpent: 0,
        createdAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
      setNewCustomer({ 
        name: '', 
        email: '', 
        address: '', 
        phone: '', 
        allowBalance: false, 
        balanceLimit: 0,
        accountBalance: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCategoryData) return;
    setLoading(true);
    try {
      const catRef = doc(db, 'categories', editingCategoryData.id);
      await setDoc(catRef, editingCategoryData, { merge: true });
      setSelectedCategoryInfo(editingCategoryData);
      setEditingCategoryData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingSupplierData) return;
    setLoading(true);
    try {
      const supRef = doc(db, 'suppliers', editingSupplierData.id);
      await setDoc(supRef, editingSupplierData, { merge: true });
      setSelectedSupplierInfo(editingSupplierData);
      setEditingSupplierData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'suppliers', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCustomerData) return;
    setLoading(true);
    try {
      const custRef = doc(db, 'customers', editingCustomerData.id);

      // Determine if limit increased/decreased
      const oldLimit = Number(selectedCustomerInfo?.balanceLimit || 0);
      const newLimit = Number(editingCustomerData.balanceLimit || 0);
      if (oldLimit !== newLimit) {
        const diff = newLimit - oldLimit;
        const adjId = `adj-cust-limit-${Date.now()}`;
        await setDoc(doc(db, 'balances', adjId), {
          id: adjId,
          amount: Math.abs(diff),
          type: diff > 0 ? 'customer_limit_increase' : 'customer_limit_decrease',
          customerId: editingCustomerData.id,
          customerName: editingCustomerData.name,
          description: `Credit line limit ${diff > 0 ? 'increased' : 'decreased'} by ${Math.abs(diff)} (New Limit: ${newLimit})`,
          date: new Date().toISOString()
        });
      }

      await setDoc(custRef, editingCustomerData, { merge: true });
      setSelectedCustomerInfo(editingCustomerData);
      setEditingCustomerData(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers', auth);
    } finally {
      setLoading(false);
    }
  };

  const submitAddBalance = async () => {
    if (!user || !selectedCustomerInfo) return;
    const amountNum = parseFloat(balanceAddAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    setIsSubmittingBalance(true);
    try {
      const custRef = doc(db, 'customers', selectedCustomerInfo.id);
      await setDoc(custRef, {
        accountBalance: increment(amountNum)
      }, { merge: true });

      const adjId = `adj-cust-${Date.now()}`;
      await setDoc(doc(db, 'balances', adjId), {
        id: adjId,
        amount: amountNum,
        type: 'customer_balance',
        customerId: selectedCustomerInfo.id,
        customerName: selectedCustomerInfo.name,
        description: balanceAddDesc || `Account balance top-up for ${selectedCustomerInfo.name}`,
        date: new Date().toISOString()
      });

      const currentBalance = (selectedCustomerInfo as any).accountBalance || 0;
      setSelectedCustomerInfo({
        ...selectedCustomerInfo,
        accountBalance: currentBalance + amountNum
      } as any);

      setIsAddingBalance(false);
      setBalanceAddAmount('');
      setBalanceAddDesc('');
    } catch (error) {
      console.error("Error updating customer balance:", error);
    } finally {
      setIsSubmittingBalance(false);
    }
  };

  const handleAddExpenditure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const expId = `exp-${Date.now()}`;
      await setDoc(doc(db, 'expenditures', expId), {
        ...newExpenditure,
        id: expId,
        date: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewExpenditure({ description: '', amount: 0, category: 'Operational' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenditures', auth);
    } finally {
      setLoading(false);
    }
  };


  const handleAddRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const revId = `rev-${Date.now()}`;
      await setDoc(doc(db, 'revenue', revId), {
        ...newRevenue,
        id: revId,
        date: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewRevenue({ source: '', amount: 0, category: 'Sales' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'revenue', auth);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBalanceAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const adjId = `adj-${Date.now()}`;
      await setDoc(doc(db, 'balances', adjId), {
        ...newBalanceAdj,
        id: adjId,
        date: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewBalanceAdj({ description: '', amount: 0, type: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'balances', auth);
    } finally {
      setLoading(false);
    }
  };


  const criticalStock = products.filter(p => p.stockLevel < (lowStockEnabled ? lowStockThreshold : 10)).length;

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    
    let matchesStock = true;
    const threshold = lowStockEnabled ? lowStockThreshold : 10;
    if (stockFilter === 'critical' || stockFilter === 'low-stock') matchesStock = p.stockLevel < threshold;
    if (stockFilter === 'healthy') matchesStock = p.stockLevel >= threshold;
    
    return matchesSearch && matchesCategory && matchesStock;
  }).sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'latest': {
        const aVal = a.updatedAt || a.createdAt || a.id || '';
        const bVal = b.updatedAt || b.createdAt || b.id || '';
        const aTime = typeof (aVal as any).toDate === 'function' ? (aVal as any).toDate().getTime() : (new Date(aVal).getTime() || 0);
        const bTime = typeof (bVal as any).toDate === 'function' ? (bVal as any).toDate().getTime() : (new Date(bVal).getTime() || 0);
        comparison = aTime - bTime;
        break;
      }
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'price':
        comparison = a.price - b.price;
        break;
      case 'stock':
        comparison = a.stockLevel - b.stockLevel;
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const itemsPerPage = 50;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (module !== 'inventory' || activeTab !== 'products') return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (paginatedProducts.length === 0) return;
        e.preventDefault();

        const currentIndex = editingProduct ? paginatedProducts.findIndex(p => p.id === editingProduct.id) : -1;
        let nextIndex = currentIndex;

        if (e.key === 'ArrowDown') {
          if (currentIndex === -1) {
            nextIndex = 0;
          } else if (currentIndex < paginatedProducts.length - 1) {
            nextIndex = currentIndex + 1;
          }
        } else if (e.key === 'ArrowUp') {
          if (currentIndex > 0) {
            nextIndex = currentIndex - 1;
          }
        }

        if (nextIndex !== currentIndex && paginatedProducts[nextIndex]) {
          const nextProduct = paginatedProducts[nextIndex];
          setEditingProduct(nextProduct);
          
          setTimeout(() => {
            const rowEl = document.getElementById(`product-row-${nextProduct.id}`);
            if (rowEl) {
              rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }, 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [module, activeTab, paginatedProducts, editingProduct]);

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBarcodeProducts = products.filter(p => {
    const q = barcodeSearch.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || 
           (p.sku || '').toLowerCase().includes(q) || 
           (p.barcode || '').toLowerCase().includes(q) || 
           p.id.toLowerCase().includes(q);
  });

  const printableBarcodeItems = React.useMemo(() => {
    return filteredBarcodeProducts.flatMap(p => {
      const baseItem = {
        id: p.id,
        productId: p.id,
        name: p.name,
        sku: p.sku || p.id.slice(0, 8).toUpperCase(),
        barcode: p.barcode || p.sku || p.id.slice(0, 8).toUpperCase(),
        imageUrl: p.imageUrl,
        price: p.price
      };
      const variationItems = (p.variations || []).map(v => {
        const specs = [v.size, v.color, v.quantity ? `Pack ${v.quantity}` : ''].filter(Boolean).join(' / ');
        const labelText = specs ? ` (${specs})` : '';
        return {
          id: `${p.id}::${v.id}`,
          productId: p.id,
          variationId: v.id,
          name: `${p.name}${labelText}`,
          sku: v.sku || `${p.sku || p.id.slice(0, 8).toUpperCase()}-V`,
          barcode: v.barcode || v.sku || p.barcode || p.sku || p.id,
          imageUrl: p.imageUrl,
          price: v.price ?? p.price,
          varietyLabel: specs || 'Variation'
        };
      });
      return [baseItem, ...variationItems];
    });
  }, [filteredBarcodeProducts]);

  const handleDownloadBarcodeCSV = () => {
    const selectedItems = (Object.entries(selectedBarcodes) as Array<[string, { selected: boolean; count: number } ]>)
      .filter(([_, data]) => data.selected)
      .map(([id, data]) => {
        const p = printableBarcodeItems.find(prod => prod.id === id);
        return {
          name: p?.name || '',
          sku: p?.sku || '',
          barcode: p?.barcode || '',
          quantity: data.count
        };
      });

    if (selectedItems.length === 0) return;

    const headers = ["Product Name", "SKU", "Barcode Value", "Label Print Quantity"];
    const rows = selectedItems.map(item => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.sku.replace(/"/g, '""')}"`,
      `"${item.barcode.replace(/"/g, '""')}"`,
      item.quantity
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `barcodes_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCode39SVG = (text: string): string => {
    const CODE39_MAP: Record<string, string> = {
      '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
      '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
      '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
      'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
      'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
      'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
      'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
      'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
      'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
      '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100',
      '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010'
    };

    const cleanText = text.toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '');
    const barcodeText = `*${cleanText || 'A1'}*`;
    
    const narrowWidth = 0.85;
    const wideWidth = 2.15;
    const gapWidth = 0.85;
    
    let x = 0;
    const rects: string[] = [];
    
    for (let i = 0; i < barcodeText.length; i++) {
       const char = barcodeText[i];
       const pattern = CODE39_MAP[char];
       if (!pattern) continue;
       
       for (let j = 0; j < 9; j++) {
         const isBar = j % 2 === 0;
         const isWide = pattern[j] === '1';
         const width = isWide ? wideWidth : narrowWidth;
         
         if (isBar) {
           rects.push(`<rect x="${x}" y="0" width="${width}" height="24" fill="black" />`);
         }
         x += width;
       }
       x += gapWidth;
    }
    
    return `<svg viewBox="0 0 ${x} 24" preserveAspectRatio="none" style="height: 100%; width: auto; display: block;">${rects.join('')}</svg>`;
  };

  const handlePrintBarcodes = () => {
    const selectedItems = (Object.entries(selectedBarcodes) as Array<[string, { selected: boolean; count: number } ]>)
      .filter(([_, data]) => data.selected)
      .flatMap(([id, data]) => {
        const p = printableBarcodeItems.find(prod => prod.id === id);
        return Array(data.count).fill(null).map(() => ({
          id: p?.id || '',
          name: p?.name || '',
          sku: p?.sku || '',
          barcode: p?.barcode || '',
          price: p?.price ?? 0
        }));
      });

    if (selectedItems.length === 0) return;

    // Compile barcode grid list with actual vector SVGs and compact retail layouts.
    const barcodeCardsHTML = selectedItems.map(item => {
      const barcodeVal = item.barcode || item.sku || item.id.slice(0, 8).toUpperCase();
      const svgCode = generateCode39SVG(barcodeVal);
      const formattedPrice = formatCurrency(item.price, currency);
      return `
        <div class="label-card">
          <!-- Left Zone (approx. 15mm width): Pre-printed arrow/perforation section -->
          <div class="left-zone">
            <div class="arrow-container">
              <span class="arrow-icon" style="${barcodeShowArrow ? '' : 'visibility: hidden;'}">▲</span>
            </div>
          </div>
          <!-- Right Zone (Remaining width): Primary content area -->
          <div class="right-zone">
            <div class="label-name">${item.name}</div>
            <div class="label-sku">BARCODE: ${item.barcode}</div>
            <div class="label-svg">${svgCode}</div>
            <div class="label-price">${formattedPrice} Incl.</div>
          </div>
        </div>
      `;
    }).join('');

    // Self-contained, responsive layout for any device with interactive panel + crisp printing
    const fullHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Print Sheets (Retail Shelf Labels)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #f4f6f9;
      color: #1e293b;
    }

    /* Interactive toolbar style */
    header {
      background: #0f172a;
      color: white;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 1px solid #1e293b;
    }

    .brand h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.025em;
      text-transform: uppercase;
      font-style: ;
      color: #06b6d4;
    }

    .brand p {
      margin: 4px 0 0 0;
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .actions {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .btn {
      background: #06b6d4;
      color: #0f172a;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 10px rgba(6, 182, 212, 0.2);
      transition: all 0.2s ease;
    }

    .btn:hover {
      background: #22d3ee;
      transform: translateY(-1px);
    }

    .controls {
      background: #1e293b;
      padding: 12px 40px;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      border-top: 1px solid #334155;
      font-size: 12px;
      color: #cbd5e1;
    }

    .control-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .control-item input[type="checkbox"] {
      cursor: pointer;
      accent-color: #06b6d4;
    }

    .control-item select {
      background: #0f172a;
      border: 1px solid #475569;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
    }

    main {
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .print-roll-container {
      display: grid;
      grid-template-cols: repeat(auto-fill, minmax(65mm, 1fr));
      gap: 16px;
      justify-content: center;
    }

    .label-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      display: flex;
      flex-direction: row;
      width: 65mm;
      height: 25mm;
      box-sizing: border-box;
      overflow: hidden;
      margin: 0 auto;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      background: #ffffff;
    }

    .left-zone {
      width: 15mm;
      min-width: 15mm;
      max-width: 15mm;
      height: 100%;
      border-right: 1px dotted #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    .arrow-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .arrow-icon {
      font-size: 20px;
      transform: scaleY(1.8);
      color: #000000;
      display: inline-block;
      line-height: 1;
    }

    .right-zone {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4px 8px;
      box-sizing: border-box;
      overflow: hidden;
      text-align: left;
      font-family: 'Courier New', Courier, monospace;
    }

    .label-name {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #000000;
      line-height: 1.1;
      margin: 3px 0 0px 0;
    }

    .label-sku {
      font-size: 6.5pt;
      font-weight: normal;
      color: #000000;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 2px 0;
    }

    .label-svg {
      height: var(--barcode-height, ${barcodeHeight});
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      overflow: hidden;
    }

    .label-svg svg {
      height: 100%;
      width: auto;
      max-width: 100%;
      display: block;
    }

    .label-price {
      font-size: 11.5pt;
      font-weight: bold;
      color: #000000;
      text-align: right;
      line-height: 1;
      margin: 2px 0 0 0;
    }

    /* Print media style sheets */
    @media print {
      header, .controls {
        display: none !important;
      }
      body {
        background: white !important;
        color: black !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      main {
        padding: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
      }

      /* Roll mode styling */
      body:not(.list-mode) .print-roll-container {
        display: block !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      body:not(.list-mode) .label-card {
        width: 65mm !important;
        height: 25mm !important;
        max-width: 65mm !important;
        max-height: 25mm !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: auto !important;
        page-break-before: auto !important;
      }

      /* List mode (whitespace separated) styling */
      body.list-mode .print-roll-container {
        display: grid !important;
        grid-template-cols: repeat(auto-fill, minmax(65mm, 1fr)) !important;
        gap: var(--spacing-gap, ${barcodeSpacingMargin}) !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      body.list-mode .label-card {
        width: 65mm !important;
        height: 25mm !important;
        border: 1px solid #cbd5e1 !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        margin-bottom: var(--spacing-gap, ${barcodeSpacingMargin}) !important; /* white space */
      }
      .left-zone {
        border-right: 1px dotted #000000 !important;
      }
    }
  </style>
  <style id="print-page-layout">
    @media print {
      @page {
        size: 65mm 25mm;
        margin: 0;
      }
    }
  </style>
</head>
<body style="--barcode-height: ${barcodeHeight}; --spacing-gap: ${barcodeSpacingMargin};">

  <header>
    <div class="brand">
      <h1>Barcode Hub Sheet</h1>
      <p>Universal Asset Label Engine</p>
    </div>
    <div class="actions">
      <button class="btn" onclick="window.print()">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4" />
        </svg>
        Trigger Print Sheet
      </button>
    </div>
  </header>

  <div class="controls">
    <div class="control-item">
      <label>
        <input type="checkbox" id="toggle-names" checked onchange="toggleClassName('label-name', this.checked)">
        Show Label Names
      </label>
    </div>
    <div class="control-item">
      <label>
        <input type="checkbox" id="toggle-skus" checked onchange="toggleClassName('label-sku', this.checked)">
        Show Label Barcodes
      </label>
    </div>
    <div class="control-item">
      <label>
        <input type="checkbox" id="toggle-perforation" checked onchange="toggleClassName('left-zone', this.checked)">
        Show Perforation Section
      </label>
    </div>
    <div class="control-item">
      <label>
        <input type="checkbox" id="toggle-arrow" checked onchange="toggleArrow(this.checked)">
        Show Arrow Icon
      </label>
    </div>
    <div class="control-item">
      <label>
        <input type="checkbox" id="toggle-list-flow" onchange="toggleListFlow(this.checked)">
        Flow as Linked List (PDF Friendly)
      </label>
    </div>
    <div class="control-item">
      <label>Spacing Margin:</label>
      <select onchange="changeGap(this.value)">
        <option value="16px" ${barcodeSpacingMargin === '16px' ? 'selected' : ''}>Normal Grid (16px)</option>
        <option value="8px" ${barcodeSpacingMargin === '8px' ? 'selected' : ''}>Compact Grid (8px)</option>
        <option value="4px" ${barcodeSpacingMargin === '4px' ? 'selected' : ''}>Extra Tight (4px)</option>
      </select>
    </div>
    <div class="control-item">
      <label>Barcode Height:</label>
      <select onchange="changeBarcodeHeight(this.value)">
        <option value="4.5mm" ${barcodeHeight === '4.5mm' ? 'selected' : ''}>Extra Small (4.5mm)</option>
        <option value="5.5mm" ${barcodeHeight === '5.5mm' ? 'selected' : ''}>Small (5.5mm)</option>
        <option value="6.5mm" ${barcodeHeight === '6.5mm' ? 'selected' : ''}>Medium (6.5mm)</option>
        <option value="8.0mm" ${barcodeHeight === '8.0mm' ? 'selected' : ''}>Large (8.0mm)</option>
      </select>
    </div>
  </div>

  <main>
    <div class="print-roll-container" id="barcode-grid">
      ${barcodeCardsHTML}
    </div>
  </main>

  <script>
    function toggleClassName(className, isVisible) {
      const items = document.getElementsByClassName(className);
      for (let i = 0; i < items.length; i++) {
        items[i].style.display = isVisible ? '' : 'none';
      }
    }
    function toggleArrow(isVisible) {
      const items = document.getElementsByClassName('arrow-icon');
      for (let i = 0; i < items.length; i++) {
        items[i].style.visibility = isVisible ? 'visible' : 'hidden';
      }
    }
    function toggleListFlow(isListMode) {
      const styleEl = document.getElementById('print-page-layout');
      if (isListMode) {
        document.body.classList.add('list-mode');
        styleEl.innerHTML = "@media print { @page { size: auto; margin: 15mm; } }";
      } else {
        document.body.classList.remove('list-mode');
        styleEl.innerHTML = "@media print { @page { size: 65mm 25mm; margin: 0; } }";
      }
    }
    function changeGap(val) {
      document.getElementById('barcode-grid').style.gap = val;
      document.body.style.setProperty('--spacing-gap', val);
    }
    function changeBarcodeHeight(val) {
      document.body.style.setProperty('--barcode-height', val);
    }
    
    // Auto-trigger printing mechanism
    window.onload = function() {
      // Apply initial settings based on saved database/hub states
      const showNames = ${barcodeShowNames};
      const showSkus = ${barcodeShowSkus};
      const showPerf = ${barcodeShowPerforation};
      const showArrow = ${barcodeShowArrow};
      const useListFlow = ${barcodeLinkWithWhitespace};

      document.getElementById('toggle-names').checked = showNames;
      document.getElementById('toggle-skus').checked = showSkus;
      document.getElementById('toggle-perforation').checked = showPerf;
      document.getElementById('toggle-arrow').checked = showArrow;
      document.getElementById('toggle-list-flow').checked = useListFlow;

      toggleClassName('label-name', showNames);
      toggleClassName('label-sku', showSkus);
      toggleClassName('left-zone', showPerf);
      toggleArrow(showArrow);
      toggleListFlow(useListFlow);
      changeBarcodeHeight('${barcodeHeight}');
      changeGap('${barcodeSpacingMargin}');

      setTimeout(function() {
        window.print();
      }, 800);
    }
  </script>
</body>
</html>`;

    // Package HTML string into printable download blob and invoke instant download link
    const fileBlob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(fileBlob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `inventory_barcodes_${Date.now()}.html`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Revoke object URL to clean memory
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const anyBarcodeSelected = (Object.values(selectedBarcodes) as Array<{ selected: boolean; count: number }>).some(v => v.selected);
  const totalBarcodeLabelsCount = (Object.values(selectedBarcodes) as Array<{ selected: boolean; count: number }>)
    .filter(v => v.selected)
    .reduce((sum, current) => sum + current.count, 0);

  return (
    <div className={cn(
      "inventory-page font-presale min-h-full flex flex-col transition-colors duration-500 relative",
      theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text"
    )}>
      {createPortal(
        <AnimatePresence>
          {isBarcodeModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
              {/* BLOCK: Barcode Management Card - Allows label layout generation and asset tag print-outs */}
              <motion.div 
                key="barcode-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="barcode-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />

              <motion.div
                key="barcode-modal-body"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card barcode-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-4xl h-[78vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === 'dark' ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header barcode-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <Barcode size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "popup-card__title barcode-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Barcode Management
                      </h3>
                      <span className="popup-card__subtitle barcode-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        Workspace
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setIsBarcodeModalOpen(false)}
                        className={cn(
                          "popup-card__close-button barcode-popup-card__close-button w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          theme === 'dark' 
                            ? "bg-black/40 border-white/40 text-white hover:bg-gray-950" 
                            : "bg-white border-light-border text-black hover:bg-gray-50"
                        )}
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
                  {/* Search Bar & Quick Toggles */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={16} />
                      <input 
                        type="text" 
                        value={barcodeSearch}
                        onChange={(e) => setBarcodeSearch(e.target.value)}
                        placeholder="Search assets inside workspace..."
                        className={cn(
                          "w-full border-2 pl-10 pr-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest outline-none transition-all",
                          theme === 'dark' ? "bg-black/20 border-[#333] focus:border-brand-primary text-white" : "bg-gray-50 border-[#EEE] focus:border-black text-black"
                        )}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updated = { ...selectedBarcodes };
                          printableBarcodeItems.forEach(item => {
                            if (!updated[item.id]) {
                              updated[item.id] = { selected: true, count: 1 };
                            } else {
                              updated[item.id].selected = true;
                            }
                          });
                          setSelectedBarcodes(updated);
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] uppercase tracking-widest font-black border rounded-lg transition-all",
                          theme === 'dark' ? "border-dark-border text-white hover:bg-white/5" : "border-light-border text-black hover:bg-black/5"
                        )}
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => {
                          const updated = { ...selectedBarcodes };
                          Object.keys(updated).forEach(id => {
                            updated[id].selected = false;
                          });
                          setSelectedBarcodes(updated);
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] uppercase tracking-widest font-black border rounded-lg transition-all",
                          theme === 'dark' ? "border-dark-border text-light-muted hover:text-white" : "border-light-border text-light-muted hover:text-black"
                        )}
                      >
                        Reset All
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Products List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 text-[10px] font-black uppercase tracking-widest text-[#666]">
                      <span>Asset detail</span>
                      <span>Print count</span>
                    </div>

                    <div className={cn(
                      "border rounded-xl no-scrollbar overflow-y-auto min-h-[160px] max-h-[35vh]",
                      theme === 'dark' ? "border-dark-border" : "border-light-border"
                    )}>
                      {printableBarcodeItems.length === 0 ? (
                        /* BLOCK: Empty Barcode Catalog Items Card */
                        <div className={cn(
                          "barcode-catalog-empty-card p-8 sm:p-12 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-300",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          <Barcode size={54} strokeWidth={1.5} className={cn("barcode-catalog-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("barcode-catalog-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Catalog Assets Identified</p>
                          <p className={cn("barcode-catalog-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>No products match your barcode search query</p>
                        </div>
                      ) : (
                        printableBarcodeItems.map(p => {
                          const itemState = selectedBarcodes[p.id] || { selected: false, count: 1 };
                          return (
                            <div 
                              key={`barcode-row-${p.id}`}
                              className={cn(
                                "flex items-center justify-between p-3 border-b last:border-b-0 transition-colors gap-4",
                                theme === 'dark' 
                                  ? "border-dark-border hover:bg-white/5" 
                                  : "border-light-border hover:bg-gray-50",
                                itemState.selected ? (theme === 'dark' ? "bg-brand-primary/5" : "bg-black/5") : ""
                              )}
                            >
                              {/* Left check + Product details */}
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Small Select Box next to item list */}
                                <input 
                                  type="checkbox"
                                  id={`checkbox-barcode-${p.id}`}
                                  checked={itemState.selected}
                                  onChange={(e) => {
                                    setSelectedBarcodes(prev => ({
                                      ...prev,
                                      [p.id]: {
                                        ...prev[p.id],
                                        selected: e.target.checked
                                      }
                                    }));
                                  }}
                                  className={cn(
                                    "w-4 h-4 rounded cursor-pointer accent-brand-primary",
                                    theme === 'dark' ? "border-dark-border" : "border-light-border"
                                  )}
                                />
                                {/* Product Content */}
                                <label 
                                  htmlFor={`checkbox-barcode-${p.id}`}
                                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none"
                                >
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover bg-black" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                                      <Package size={14} />
                                    </div>
                                  )}
                                  <div className="truncate">
                                    <h4 className="text-xs font-bold truncate uppercase">{p.name}</h4>
                                    <p className="text-[10px] font-mono opacity-50 truncate">SKU: {p.sku}</p>
                                  </div>
                                </label>
                              </div>

                              {/* Right Quantity controller (defaults to 1 barcode per product) */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBarcodes(prev => ({
                                      ...prev,
                                      [p.id]: {
                                        ...prev[p.id],
                                        count: Math.max(1, (prev[p.id]?.count || 1) - 1)
                                      }
                                    }));
                                  }}
                                  disabled={!itemState.selected}
                                  className={cn(
                                    "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black border transition-opacity active:scale-90",
                                    theme === 'dark' ? "border-dark-border hover:bg-white/5 text-white" : "border-light-border hover:bg-black/5 text-black",
                                    !itemState.selected ? "opacity-30 pointer-events-none" : "opacity-100"
                                  )}
                                >
                                  -
                                </button>
                                <span className={cn(
                                  "w-8 text-center text-xs font-black",
                                  !itemState.selected ? "opacity-30 text-neutral-500" : "opacity-100 font-bold"
                                )}>
                                  {itemState.count}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBarcodes(prev => ({
                                      ...prev,
                                      [p.id]: {
                                        ...prev[p.id],
                                        count: (prev[p.id]?.count || 1) + 1
                                      }
                                    }));
                                  }}
                                  disabled={!itemState.selected}
                                  className={cn(
                                    "w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black border transition-opacity active:scale-90",
                                    theme === 'dark' ? "border-dark-border hover:bg-white/5 text-white" : "border-light-border hover:bg-black/5 text-black",
                                    !itemState.selected ? "opacity-30 pointer-events-none" : "opacity-100"
                                  )}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Preview layout box */}
                  {anyBarcodeSelected && (
                    <div className={cn(
                      "p-4 border-2 border-dashed rounded-xl space-y-3",
                      theme === 'dark' ? "bg-black/20 border-dark-border" : "bg-gray-50 border-light-border"
                    )}>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-brand-primary">
                        <span>Workflow summary</span>
                        <span>{totalBarcodeLabelsCount} total labels queued</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
                        <div className="opacity-75">
                          Selected items will compile into standard Avery grid layouts ready for direct print-out. Make sure your barcode label roll/sheets are lined up in the printer settings.
                        </div>
                        <div className="flex flex-col justify-center items-end bg-black/10 dark:bg-white/5 rounded-lg p-2 font-mono text-[10px]">
                          <div>PAGE MATRIX: 4 COLUMN LIST</div>
                          <div>TOTAL ESTIMATED PAGES: {Math.ceil(totalBarcodeLabelsCount / 24) || 1}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className={cn(
                  "popup-card__footer barcode-popup-card__footer p-4 border-t shrink-0 flex flex-col sm:flex-row gap-3 justify-between items-center select-none",
                  theme === 'dark' ? "bg-transparent border-white/10" : "bg-transparent border-black/10"
                )}>
                  <div className="text-xs font-bold uppercase tracking-wider opacity-60 w-full sm:w-auto text-center sm:text-left">
                    {anyBarcodeSelected ? `${totalBarcodeLabelsCount} Label(s) Queued` : 'Select assets to begin'}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsBarcodeModalOpen(false)}
                      className={cn(
                        "popup-card__button popup-card__button--cancel px-4 py-2 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                        theme === 'dark' ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50"
                      )}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintBarcodes}
                      disabled={!anyBarcodeSelected}
                      className={cn(
                        "popup-card__button popup-card__button--save px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                        theme === 'dark' 
                          ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" 
                          : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10",
                        !anyBarcodeSelected ? "opacity-30 pointer-events-none" : "opacity-100"
                      )}
                    >
                      <Download size={12} />
                      Generate
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* CSV Import Modal Portal */}
      {createPortal(
        <AnimatePresence>
          {isImportModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
              {/* BLOCK: CSV Import Card - Handles file ingest and catalog row parsing */}
              <motion.div 
                key="import-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="import-csv-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />

              <motion.div
                key="import-modal-body"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card import-csv-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-4xl h-[78vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === 'dark' ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
                )}
              >
                {/* Accent Top Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header import-csv-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <Upload size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-sans">
                      <h3 className={cn(
                        "popup-card__title import-csv-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        CSV Product Import
                      </h3>
                      <span className="popup-card__subtitle import-csv-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        Ingest Pipeline
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          if (importStatus !== 'importing') {
                            setIsImportModalOpen(false);
                            setImportStatus('idle');
                            setImportedProducts([]);
                          }
                        }}
                        disabled={importStatus === 'importing'}
                        className={cn(
                          "popup-card__close-button import-csv-popup-card__close-button w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          theme === 'dark' 
                            ? "bg-black/40 border-white/40 text-white hover:bg-gray-950" 
                            : "bg-white border-light-border text-black hover:bg-gray-50"
                        )}
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
                  
                  {/* Status 1: Success State */}
                  {importStatus === 'success' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4 p-8">
                      <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center animate-bounce">
                        <CheckCircle2 size={36} />
                      </div>
                      <div className="text-center">
                        <h4 className="text-lg font-black uppercase tracking-wider">Catalog Integration Complete</h4>
                        <p className="text-xs opacity-60 mt-1 uppercase font-mono tracking-widest">
                          {importedProducts.filter(p => p.isValid).length} products successfully compiled & committed to database
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Status 2: Idle & Error Status */}
                  {(importStatus === 'idle' || importStatus === 'error') && (
                    <div className="flex-1 flex flex-col space-y-6">
                      
                      {importError && (
                        <div className="p-4 rounded-xl border-2 border-red-500/20 bg-red-400/5 text-red-400 text-xs flex items-center gap-3">
                          <AlertCircle size={18} className="shrink-0" />
                          <div>
                            <p className="font-bold uppercase tracking-wider">Import Operation Failed</p>
                            <p className="opacity-75 mt-0.5 uppercase tracking-widest font-mono text-[10px]">{importError}</p>
                          </div>
                        </div>
                      )}

                      {/* Drag & Drop Area */}
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleCSVUpload(e.dataTransfer.files[0]);
                          }
                        }}
                        className={cn(
                          "flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all relative group cursor-pointer min-h-[220px]",
                          dragActive 
                            ? "border-brand-primary bg-brand-primary/5" 
                            : (theme === 'dark' ? "border-[#333] bg-black/10 hover:border-brand-primary hover:bg-white/5" : "border-light-border bg-gray-50 hover:border-black hover:bg-neutral-100")
                        )}
                        onClick={() => {
                          const input = document.getElementById('csv-file-input');
                          input?.click();
                        }}
                      >
                        <input 
                          type="file" 
                          id="csv-file-input" 
                          accept=".csv" 
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleCSVUpload(e.target.files[0]);
                            }
                          }}
                        />
                        <div className="p-4 rounded-xl bg-brand-primary/10 text-brand-primary mb-4 group-hover:scale-110 transition-transform duration-200">
                          <Upload size={32} />
                        </div>
                        <p className="text-sm font-black uppercase tracking-wider text-center">
                          Drag & drop products CSV file here
                        </p>
                        <p className="text-[10px] font-mono tracking-widest uppercase opacity-65 text-center mt-1">
                          or click to select file from storage browser
                        </p>
                      </div>

                      {/* Guidelines and Demo Template Block */}
                      <div className={cn(
                        "p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
                        theme === 'dark' ? "bg-white/5 border-[#222]" : "bg-neutral-50 border-light-border"
                      )}>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider">CSV Data Specifications</p>
                          <p className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1 leading-relaxed max-w-xl">
                            Required column header mappings: <span className="text-brand-primary">Name</span> (mandatory), Price, Cost Price, Stock Level, Category, Barcode, SKU, Description.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const demoCSV = `"Product Name","Retail Price","Cost Price","Stock","Segment","SKU","Code","Description"\n` +
                              `"Premium Arabica Blend",18.50,11.00,45,"Beverages","SKU-ARB-01","880101","Rich body with cocoa finish"\n` +
                              `"Organics Earl Grey",12.99,7.50,12,"Tea","SKU-EGY-02","880102","Bergamot premium loose tea"\n` +
                              `"Chocolate Chip Cookie",3.50,1.20,80,"Bakery","SKU-CCC-03","880103","Double chocolate chunks bakery treat"\n` +
                              `"Espresso Roast Pods",22.00,14.50,30,"Beverages","SKU-ESP-04","880104","Capsules high intensity espresso"\n` +
                              `"Almond Milk Barista",4.99,2.80,6,"General","SKU-ALM-05","","Unsweetened dairy-free carton"\n` +
                              `"Gluten-Free Brownie",4.50,1.90,3,"Bakery","SKU-GFB-06","","Rich fudge texture chocolate fudge"`;
                            
                            const file = new File([demoCSV], "megapos_demo_products.csv", { type: "text/csv" });
                            handleCSVUpload(file);
                          }}
                          className={cn(
                            "px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shrink-0 whitespace-nowrap",
                            theme === 'dark' ? "border-brand-primary text-brand-primary hover:bg-[#22D3EE]/10" : "border-black text-black hover:bg-neutral-100"
                          )}
                        >
                          Use Demo Template
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Status 3: Parsing Status */}
                  {importStatus === 'parsing' && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                      <RefreshCw className="animate-spin text-brand-primary" size={40} />
                      <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-wider">Parsing catalog content...</p>
                        <p className="text-[9px] font-mono tracking-widest uppercase opacity-45 mt-1">Verifying headers and alignment</p>
                      </div>
                    </div>
                  )}

                  {/* Status 4: Ready/Importing Status */}
                  {(importStatus === 'ready' || importStatus === 'importing') && (
                    <div className="flex-1 flex flex-col space-y-4 max-h-[85%] min-h-0">
                      
                      {/* Summary card */}
                      <div className={cn(
                        "p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0",
                        theme === 'dark' ? "bg-white/5 border-[#222]" : "bg-neutral-50 border-light-border"
                      )}>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider">CSV Catalog Auto-Mapped</p>
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 mt-1">
                            Parsed <span className="text-brand-primary">{importedProducts.length} entries</span> • Ready to index & persist
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setImportStatus('idle');
                              setImportedProducts([]);
                            }}
                            className={cn(
                              "px-3 py-1.5 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                              theme === 'dark' ? "border-dark-border text-white hover:bg-white/5" : "border-light-border text-black hover:bg-black/5"
                            )}
                          >
                            Reset File
                          </button>
                        </div>
                      </div>

                      {/* Table preview (scrollable) */}
                      <div className={cn(
                        "flex-1 border rounded-xl overflow-auto no-scrollbar",
                        theme === 'dark' ? "border-[#222] bg-black/10" : "border-light-border bg-gray-50/50"
                      )}>
                        <table className="w-full border-collapse min-w-[700px] text-left">
                          <thead>
                            <tr className={cn(
                              "text-[9px] font-bold uppercase tracking-widest text-[#888] border-b",
                              theme === 'dark' ? "bg-[#0c0c0c] border-[#222]" : "bg-neutral-100 border-light-border"
                            )}>
                              <th className="py-2.5 px-4 font-bold w-[50px] text-center">Row</th>
                              <th className="py-2.5 px-4 font-bold">Asset Name</th>
                              <th className="py-2.5 px-4 font-bold">Segment</th>
                              <th className="py-2.5 px-4 font-bold text-right">Selling Price</th>
                              <th className="py-2.5 px-4 font-bold text-right">Cost Price</th>
                              <th className="py-2.5 px-4 font-bold text-center">In Stock</th>
                              <th className="py-2.5 px-4 font-bold">Barcode</th>
                              <th className="py-2.5 px-4 font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-transparent">
                            {importedProducts.map((p, index) => {
                              const trClass = cn(
                                "border-b text-[11px] font-medium transition-colors hover:bg-brand-primary/5",
                                theme === 'dark' ? "border-[#222]/30 text-white" : "border-light-border/30 text-black",
                                !p.isValid ? (theme === 'dark' ? "bg-red-500/5 text-red-400" : "bg-red-500/5 text-red-600") : ""
                              );

                              return (
                                <tr key={`import-preview-row-${index}`} className={trClass}>
                                  <td className="py-2 px-4 font-mono text-center opacity-45 font-bold">
                                    {(index + 1).toString().padStart(2, '0')}
                                  </td>
                                  <td className="py-2 px-4 font-sans font-bold uppercase tracking-tight">
                                    {limitLetters(p.name, 35)}
                                  </td>
                                  <td className="py-2 px-4 uppercase font-mono tracking-wider font-semibold">
                                    {p.category}
                                  </td>
                                  <td className="py-2 px-4 text-right font-mono font-semibold">
                                    {formatCurrency(p.price, currency)}
                                  </td>
                                  <td className="py-2 px-4 text-right font-mono opacity-80">
                                    {(role === 'Manager' || user?.email === 'admin@megapos.pos') ? formatCurrency(p.costPrice, currency) : '—'}
                                  </td>
                                  <td className="py-2 px-4 text-center font-mono font-bold text-brand-primary">
                                    {p.stockLevel}
                                  </td>
                                  <td className="py-2 px-4 font-mono font-bold tracking-normal opacity-85">
                                    {p.barcode || p.sku || 'N/A'}
                                  </td>
                                  <td className="py-2 px-4">
                                    <div className="flex items-center gap-1">
                                      {p.isValid ? (
                                        <>
                                          <CheckCircle2 size={12} className="text-green-500" />
                                          <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-green-500">Ready</span>
                                        </>
                                      ) : (
                                        <>
                                          <AlertCircle size={12} className="text-red-500" />
                                          <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-red-500">Missing Title</span>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Action buttons (Footer area) */}
                      <div className={cn(
                        "popup-card__footer import-csv-popup-card__footer pt-4 border-t border-inherit/20 flex gap-4 justify-end shrink-0 mt-auto",
                        theme === 'dark' ? "border-white/10" : "border-black/10"
                      )}>
                        <button 
                          type="button" 
                          onClick={() => {
                            setIsImportModalOpen(false);
                            setImportStatus('idle');
                            setImportedProducts([]);
                          }}
                          disabled={importStatus === 'importing'}
                          className={cn(
                            "popup-card__button popup-card__button--cancel px-4 py-2.5 border-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                            theme === 'dark' ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50"
                          )}
                        >
                          Abort
                        </button>
                        <button 
                          type="button"
                          onClick={executeImport}
                          disabled={importStatus === 'importing' || importedProducts.filter(p => p.isValid).length === 0}
                          className={cn(
                            "popup-card__button popup-card__button--save px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center gap-2",
                            theme === 'dark' 
                              ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" 
                              : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                          )}
                        >
                          {importStatus === 'importing' ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />
                              Ingesting Catalog...
                            </>
                          ) : (
                            <>
                              Confirm & Import ({importedProducts.filter(p => p.isValid).length} Assets)
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  )}

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <div className="fixed bottom-6 right-8 z-[110] flex flex-col items-end gap-3">
        <button 
          onClick={() => {
            if (module === 'inventory') {
              setIsAddModalOpen(true);
            } else if (module === 'vault') {
              setActiveTab(activeVaultTab === 'expenditure' ? 'expenditure' : 'revenue');
              setIsAddModalOpen(true);
            } else if (module === 'balances') {
              const balanceForms: Record<string, string> = {
                'store': 'store_balance',
                'expenditure': 'expenditure',
                'customer': 'client_balance',
                'shareholder': 'stakeholder_balance'
              };
              setActiveTab(balanceForms[activeBalanceTab] || 'store_balance');
              setIsAddModalOpen(true);
            }
          }}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 active:scale-95 focus:outline-none group",
            theme === 'dark' 
              ? "bg-[#22D3EE] text-black border-[#0F172A] shadow-[#22D3EE]/20 hover:brightness-110" 
              : "bg-[#062A95] text-white border-white shadow-[#062A95]/20 hover:bg-opacity-95"
          )}
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      <div className="flex-1 px-4 pb-4 pt-0 md:px-10 md:pb-10 md:pt-0">
        <div className="w-full max-w-[1600px] mx-auto font-presale transition-all duration-300 ease-in-out">
          {/* BLOCK: Inventory Floating Control Row - Manages the layout of tabs and search controls */}
          <div className="inv-controls-layout relative z-30 flex flex-col xl:flex-row items-center justify-between gap-3 sm:gap-4 mb-8 transition-all duration-300 ease-in-out">
            
            {/* BLOCK: Tabs Floating Bar Card - Holds navigation tabs for inventory selection */}
            <div className={cn(
              "inv-tabs-card flex flex-row items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full xl:w-1/2 xl:flex-1 min-w-0 shrink-0 backdrop-blur-xl relative overflow-hidden",
              theme === 'dark' 
                ? "inv-tabs-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "inv-tabs-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              {/* Left scroll arrow button */}
              <button
                type="button"
                onClick={() => invTabsRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                className={cn(
                  "inv-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/15"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-black hover:bg-slate-200"
                )}
                title="Scroll tabs left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} className="shrink-0" />
              </button>

              <div ref={invTabsRef} className="inv-tabs-card__list flex items-center justify-start flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto scroll-smooth no-scrollbar w-full py-0.5 my-auto">
                {module === 'inventory' && [
                  { id: 'products', label: 'HOLDINGS', icon: Package },
                  { id: 'categories', label: 'SEGMENTS', icon: Tags },
                  { id: 'suppliers', label: 'VENDORS', icon: Truck },
                  { id: 'customers', label: 'CLIENTELE', icon: Users }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "inv-tabs-card__tab-btn h-10 px-3.5 sm:px-4 md:px-5 xl:px-6 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap border flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 my-auto font-presale",
                      activeTab === tab.id 
                        ? theme === 'dark'
                          ? "inv-tabs-card__tab-btn--active bg-brand-primary border-brand-primary text-black shadow-md shadow-cyan-500/20"
                          : "inv-tabs-card__tab-btn--active bg-[#062A95] border-[#062A95] text-white shadow-md shadow-blue-900/20"
                        : theme === 'dark'
                          ? "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                          : "border-transparent text-slate-600 hover:text-black hover:bg-slate-100"
                    )}
                  >
                    <tab.icon size={15} className={cn("transition-transform shrink-0 flex items-center justify-center my-auto", activeTab === tab.id ? "scale-110" : "opacity-75")} />
                    <span className="flex items-center justify-center text-center my-auto leading-normal font-presale font-bold tracking-wide text-[11px] md:text-[12px] uppercase">{tab.label}</span>
                  </button>
                ))}

                {module === 'vault' && [
                  { id: 'expenditure', label: 'OPERATIONAL SPEND', icon: AlertCircle },
                  { id: 'cash_inflow', label: 'CASH INFLOW', icon: BarChart3 }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveVaultTab(tab.id as any)}
                    className={cn(
                      "inv-tabs-card__tab-btn h-10 px-3.5 sm:px-4 md:px-5 xl:px-6 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap border flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 my-auto font-presale",
                      activeVaultTab === tab.id 
                        ? theme === 'dark'
                          ? "inv-tabs-card__tab-btn--active bg-brand-primary border-brand-primary text-black shadow-md shadow-cyan-500/20"
                          : "inv-tabs-card__tab-btn--active bg-[#062A95] border-[#062A95] text-white shadow-md shadow-blue-900/20"
                        : theme === 'dark'
                          ? "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                          : "border-transparent text-slate-600 hover:text-black hover:bg-slate-100"
                    )}
                  >
                    <tab.icon size={15} className={cn("transition-transform shrink-0 flex items-center justify-center my-auto", activeVaultTab === tab.id ? "scale-110" : "opacity-75")} />
                    <span className="flex items-center justify-center text-center my-auto leading-normal font-presale font-bold tracking-wide text-[11px] md:text-[12px] uppercase">{tab.label}</span>
                  </button>
                ))}

                {module === 'balances' && [
                  { id: 'store', label: 'CORE LIQUID', icon: LayoutGrid },
                  { id: 'expenditure', label: 'CUMULATIVE SPEND', icon: AlertCircle },
                  { id: 'customer', label: 'CLIENT ESCROW', icon: Users },
                  { id: 'shareholder', label: 'STAKEHOLDER EQUITY', icon: RefreshCw }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveBalanceTab(tab.id as any)}
                    className={cn(
                      "inv-tabs-card__tab-btn h-10 px-3.5 sm:px-4 md:px-5 xl:px-6 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap border flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 my-auto font-presale",
                      activeBalanceTab === tab.id 
                        ? theme === 'dark'
                          ? "inv-tabs-card__tab-btn--active bg-brand-primary border-brand-primary text-black shadow-md shadow-cyan-500/20"
                          : "inv-tabs-card__tab-btn--active bg-[#062A95] border-[#062A95] text-white shadow-md shadow-blue-900/20"
                        : theme === 'dark'
                          ? "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                          : "border-transparent text-slate-600 hover:text-black hover:bg-slate-100"
                    )}
                  >
                    <tab.icon size={15} className={cn("transition-transform shrink-0 flex items-center justify-center my-auto", activeBalanceTab === tab.id ? "scale-110" : "opacity-75")} />
                    <span className="flex items-center justify-center text-center my-auto leading-normal font-presale font-bold tracking-wide text-[11px] md:text-[12px] uppercase">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Right scroll arrow button */}
              <button
                type="button"
                onClick={() => invTabsRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                className={cn(
                  "inv-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
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
              "inv-search-card relative z-30 flex flex-row items-center gap-2 sm:gap-3 lg:gap-4 p-1.5 sm:p-2 px-3 sm:px-4 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full xl:w-1/2 xl:flex-1 min-w-0 justify-between xl:justify-start backdrop-blur-xl",
              theme === 'dark' 
                ? "inv-search-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "inv-search-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              {module === 'inventory' && activeTab === 'products' && (
                <div className="flex items-center gap-2 shrink-0 my-auto">
                  {/* Action Required Badge */}
                  <button
                    onClick={onNotificationTrigger}
                    className={cn(
                      "h-10 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 focus:outline-none no-gradient transition-all cursor-pointer my-auto",
                      criticalStock > 0
                        ? (theme === 'dark' ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20" : "border-red-500/40 bg-red-50 text-red-700 hover:bg-red-100")
                        : (theme === 'dark' ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100")
                    )}
                    title={criticalStock > 0 ? `Action Required: ${criticalStock} critical shortages detected` : 'System health within parameters'}
                  >
                    <AlertCircle size={14} className={cn("shrink-0 my-auto", activeTab === 'products' && "animate-pulse")} />
                    <span className="text-xs font-mono font-black shrink-0 leading-none my-auto">
                      {criticalStock > 99 ? '99+' : criticalStock}
                    </span>
                  </button>

                  {/* Total Holdings Badge */}
                  <div
                    className={cn(
                      "h-10 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all my-auto",
                      theme === 'dark' ? "border-dark-border text-dark-muted" : "border-light-border text-light-muted"
                    )}
                    title={`${products.length} cataloged assets`}
                  >
                    <Package size={14} className={cn("shrink-0 my-auto", activeTab === 'products' && "animate-pulse")} />
                    <span className="text-xs font-mono font-black shrink-0 leading-none my-auto">
                      {products.length > 99 ? '99+' : products.length}
                    </span>
                  </div>
                </div>
              )}

              <div className="inv-search-card__search-wrapper relative flex-1 min-w-0 my-auto">
                <Search className="inv-search-card__search-icon absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none" size={15} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets & resources..."
                  className={cn(
                    "inv-search-card__search-input w-full h-10 border pl-10 sm:pl-12 pr-4 rounded-xl text-xs font-presale font-medium tracking-wide outline-none transition-colors duration-200 flex items-center",
                    theme === 'dark' 
                      ? "bg-[#041a5c]/80 border-[#123ebd] text-white placeholder-white/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20" 
                      : "bg-white border-slate-300 text-light-text placeholder-gray-400 focus:border-brand-primary-light focus:ring-1 focus:ring-brand-primary-light/20"
                  )}
                />
              </div>

              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "inv-search-card__filter-btn h-10 px-3.5 sm:px-4 border rounded-xl transition-colors duration-200 shrink-0 active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-xs font-presale font-bold tracking-wide my-auto",
                  isFilterOpen
                    ? theme === 'dark'
                      ? "bg-brand-primary border-brand-primary text-black"
                      : "bg-black border-black text-white"
                    : theme === 'dark' 
                      ? "bg-[#041a5c]/80 text-white border-[#123ebd] hover:bg-[#062480] hover:border-brand-primary" 
                      : "bg-white text-black border-slate-300 hover:bg-gray-100 hover:border-black",
                )}
              >
                <Filter size={15} className="shrink-0 my-auto" />
                <span className="hidden md:inline text-xs font-presale font-bold tracking-wide my-auto flex items-center justify-center">Filters</span>
              </button>

              {module === 'inventory' && activeTab === 'products' && (
                <div className="relative z-40 my-auto">
                  <button 
                    onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                    className={cn(
                      "inv-search-card__actions-btn h-10 w-10 p-0 border rounded-xl transition-colors duration-200 shrink-0 active:scale-95 cursor-pointer flex items-center justify-center text-xs font-presale font-bold tracking-wide my-auto",
                      isActionsMenuOpen
                        ? theme === 'dark'
                          ? "bg-brand-primary border-brand-primary text-black"
                          : "bg-black border-black text-white"
                        : theme === 'dark' 
                          ? "bg-[#041a5c]/80 text-white border-[#123ebd] hover:bg-[#062480] hover:border-brand-primary" 
                          : "bg-white text-black border-slate-300 hover:bg-gray-100 hover:border-black",
                    )}
                    title="More Actions"
                  >
                    <MoreVertical size={15} className="my-auto" />
                  </button>
                  <AnimatePresence>
                    {isActionsMenuOpen && (
                      <motion.div
                        key="actions-menu-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="inv-search-card__actions-backdrop fixed inset-0 z-[190]"
                        onClick={() => setIsActionsMenuOpen(false)}
                      />
                    )}
                    {isActionsMenuOpen && (
                      <motion.div
                        key="actions-menu"
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className={cn(
                          "inv-search-card__actions-dropdown absolute right-0 mt-2 z-[200] w-52 rounded-xl border shadow-hard p-1 backdrop-blur-md overflow-hidden",
                          theme === "dark"
                            ? "inv-search-card__actions-dropdown--dark bg-dark-surface/90 border-white/20 text-white"
                            : "inv-search-card__actions-dropdown--light bg-white/90 border-slate-300 text-black",
                        )}
                      >
                        <button
                          onClick={() => {
                            setIsEditModeEnabled(!isEditModeEnabled);
                            setIsActionsMenuOpen(false);
                          }}
                          className={cn(
                            "inv-search-card__actions-item w-full flex items-center gap-3 p-3 rounded-lg text-xs font-presale font-bold tracking-wide transition-all",
                            theme === "dark" 
                              ? "text-white hover:bg-white/5" 
                              : "text-black hover:bg-black/5",
                          )}
                        >
                          <Edit2 size={14} className="text-brand-primary" /> {isEditModeEnabled ? "Disable Edit Mode" : "Enable Edit Mode"}
                        </button>
                        <button
                          onClick={() => {
                            setIsMultiSelectEnabled(!isMultiSelectEnabled);
                            setSelectedProductIds([]);
                            setIsActionsMenuOpen(false);
                          }}
                          className={cn(
                            "inv-search-card__actions-item w-full flex items-center gap-3 p-3 rounded-lg text-xs font-presale font-bold tracking-wide transition-all border-t",
                            theme === "dark" 
                              ? "text-white hover:bg-white/5 border-white/10" 
                              : "text-black hover:bg-black/5 border-slate-200",
                          )}
                        >
                          <CheckSquare size={14} className="text-brand-primary" /> {isMultiSelectEnabled ? "Disable Select" : "Enable Select"}
                        </button>
                        <button
                          onClick={() => {
                            setIsImportModalOpen(true);
                            setIsActionsMenuOpen(false);
                          }}
                          className={cn(
                            "inv-search-card__actions-item w-full flex items-center gap-3 p-3 rounded-lg text-xs font-presale font-bold tracking-wide transition-all border-t",
                            theme === "dark" 
                              ? "text-white hover:bg-white/5 border-white/10" 
                              : "text-black hover:bg-black/5 border-slate-200",
                          )}
                        >
                          <Upload size={14} className="text-brand-primary" /> Import Products
                        </button>
                        <button
                          onClick={() => {
                            setIsBarcodeModalOpen(true);
                            setIsActionsMenuOpen(false);
                          }}
                          className={cn(
                            "inv-search-card__actions-item w-full flex items-center gap-3 p-3 rounded-lg text-xs font-presale font-bold tracking-wide transition-all",
                            theme === "dark" 
                              ? "text-white hover:bg-white/5" 
                              : "text-black hover:bg-black/5",
                          )}
                        >
                          <Download size={14} className="text-brand-primary" /> Print Barcodes
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>


      {/* Add Asset Sidebar */}
      {createPortal(
        <AnimatePresence>
          {(isAddModalOpen || isEditModalOpen) && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
              {/* Backdrop */}
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 onClick={handleBackdropClick}
                 className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              {/* BLOCK: New Product Card - Form for creating or updating inventory assets */}
              <motion.div 
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card new-product-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === 'dark' 
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" 
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header new-product-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        {isEditModalOpen ? <Edit2 size={16} className="text-brand-primary" /> : 
                         activeTab === 'products' ? <Package size={16} className="text-brand-primary" /> : 
                         activeTab === 'categories' ? <Tags size={16} className="text-brand-primary" /> : 
                         activeTab === 'suppliers' ? <Truck size={16} className="text-brand-primary" /> : 
                         activeTab === 'customers' ? <Users size={16} className="text-brand-primary" /> : 
                         activeTab === 'expenditure' ? <CreditCard size={16} className="text-brand-primary" /> : 
                         activeTab === 'revenue' ? <Wallet size={16} className="text-brand-primary" /> : 
                         <Plus size={16} className="text-brand-primary" />}
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-sans">
                      <h3 className={cn(
                        "popup-card__title new-product-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        {isEditModalOpen ? 'Modify Asset' : 
                         activeTab === 'products' ? 'New Product' : 
                         activeTab === 'categories' ? 'New Segment' : 
                         activeTab === 'suppliers' ? 'Register Vendor' : 
                         activeTab === 'customers' ? 'Profile Clientele' : 
                         activeTab === 'expenditure' ? 'Log Expenditure' : 
                         activeTab === 'revenue' ? 'Add Cash Inflow' : 
                         activeTab === 'client_balance' ? 'Add Client Balance' :
                         activeTab === 'stakeholder_balance' ? 'Add Stakeholder Balance' :
                         activeTab === 'store_balance' ? 'Add Store Balance' :
                         'New Asset'}
                      </h3>
                      <span className="popup-card__subtitle new-product-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        {isEditModalOpen ? `#${editingProduct?.id}` : `#New`}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAddModalOpen(false);
                          setIsEditModalOpen(false);
                          setEditingProduct(null);
                          setNewProduct({
                            name: '',
                            price: 0,
                            costPrice: 0,
                            sku: '',
                            barcode: '',
                            category: '',
                            stockLevel: 0,
                            color: '',
                            size: '',
                            weight: '',
                            palletSize: '',
                            supplierId: '',
                            description: '',
                            imageUrl: '',
                            promoActive: false,
                            promoPrice: 0,
                            promoStartDate: '',
                            promoEndDate: '',
                            promoLabel: ''
                          });
                        }}
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
              
              <div className="flex-1 p-8 overflow-y-auto no-scrollbar">
                {activeTab === 'products' ? (
                  <form onSubmit={handleAddProduct} className="space-y-8">
                    {/* BLOCK: Asset Configuration Section Card - Contains sub-form tab selectors with white background container */}
                    <div className={cn(
                      "asset-config-section-card p-5 sm:p-6 rounded-2xl border transition-all",
                      theme === 'dark' 
                        ? "bg-[#020d30] border-[#123ebd]/50 shadow-lg shadow-black/40" 
                        : "bg-white border border-slate-200 shadow-sm"
                    )}>
                      <span className={cn(
                        "asset-config-section-card__title text-[10px] font-black uppercase tracking-widest block font-sans mb-3",
                        theme === 'dark' ? "text-slate-300" : "text-slate-700"
                      )}>
                        Asset Configuration Section
                      </span>
                      {/* BLOCK: Asset Config Tabs - Responsive selector for different sub-forms; scrollable horizontally on smaller screens */}
                      <div className="asset-config-tabs flex flex-row overflow-x-auto whitespace-nowrap sm:grid sm:grid-cols-4 gap-2 max-h-none scrollbar-none w-full">
                        {([
                          { id: 'basic', label: 'BASIC INFO' },
                          { id: 'extra', label: 'EXTRA INFO' },
                          { id: 'variation', label: 'VARIATION' },
                          { id: 'promo', label: 'PROMO INFO' }
                        ] as const).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setProductFormTab(opt.id)}
                            className={cn(
                              "asset-config-tabs__tab px-3.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-2 text-center cursor-pointer shrink-0 font-presale",
                              productFormTab === opt.id
                                ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400 shadow-md font-bold" : "bg-[#062A95] text-white border-[#062A95] shadow-md font-bold")
                                : (theme === 'dark' ? "bg-white/[0.04] border-white/10 text-white/80 hover:text-white hover:border-white/20" : "bg-slate-50 border-slate-200 text-slate-700 hover:text-black hover:border-slate-400")
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BLOCK: Asset Form Fields Card - Houses the input controls for the active configuration tab */}
                    <div className={cn(
                      "asset-form-fields-card grid grid-cols-2 gap-4",
                      theme === 'dark' 
                        ? "bg-[#020d30] border border-[#123ebd]/50 p-5 sm:p-6 rounded-2xl shadow-lg shadow-black/40"
                        : "bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm"
                    )}>
                      {productFormTab === 'basic' && (
                        <>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Product Designation</label>
                            {renderInputWithDot(
                              <input 
                                required
                                type="text" 
                                maxLength={300}
                                value={newProduct.name || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setNewProduct({...newProduct, name: val.slice(0, 300)});
                                }}
                                placeholder="IDENTIFY ASSET..."
                                className={inputClassName} 
                              />,
                              newProduct.name || "",
                              300
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Barcode</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                maxLength={20}
                                value={newProduct.barcode || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  const cleanVal = val.replace(/\s+/g, '');
                                  setNewProduct({...newProduct, barcode: cleanVal.slice(0, 20)});
                                }}
                                placeholder="ENTER ASSET BARCODE..."
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.barcode || "",
                              20
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Base Cost ({currency})</label>
                            {renderInputWithDot(
                              <input 
                                required
                                type="text" 
                                inputMode="decimal"
                                value={newProduct.costPrice ?? ''}
                                onKeyDown={handleDecimalInputKeyDown}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  const parts = val.split('.');
                                  const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                                  setNewProduct({...newProduct, costPrice: cleanVal as any});
                                }}
                                placeholder="0.00"
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.costPrice ?? 0
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Marked Price ({currency})</label>
                            {renderInputWithDot(
                              <input 
                                required
                                type="text" 
                                inputMode="decimal"
                                value={newProduct.price ?? ''}
                                onKeyDown={handleDecimalInputKeyDown}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  const parts = val.split('.');
                                  const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                                  setNewProduct({...newProduct, price: cleanVal as any});
                                }}
                                placeholder="0.00"
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.price ?? 0
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Color</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                value={newProduct.color || ""}
                                onChange={e => setNewProduct({...newProduct, color: e.target.value})}
                                placeholder="E.G. MIDNIGHT BLACK"
                                className={inputClassName} 
                              />,
                              newProduct.color || ""
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Size</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                value={newProduct.size || ""}
                                onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                                placeholder="E.G. XL, 42MM"
                                className={inputClassName} 
                              />,
                              newProduct.size || ""
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Inventory Volume</label>
                            {renderInputWithDot(
                              <input 
                                required
                                type="text" 
                                inputMode="numeric"
                                value={newProduct.stockLevel ?? ''}
                                onKeyDown={handleIntegerInputKeyDown}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  setNewProduct({...newProduct, stockLevel: val as any});
                                }}
                                placeholder="0"
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.stockLevel ?? 0
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Market Segment</label>
                            {renderInputWithDot(
                              <select 
                                value={newProduct.category || ""}
                                onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                                className={cn(inputClassName, "cursor-pointer")}
                              >
                                {[{id: '', name: 'Select Segment'}, ...categories].map(cat => (
                                  <option key={'form-cat-' + cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                              </select>,
                              newProduct.category || "",
                              undefined,
                              true
                            )}
                          </div>
                          <div className="col-span-2 space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest block font-sans text-dark-muted">Visual Source & Upload</label>
                            
                            {/* Drag & Drop zone */}
                            <div 
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const file = e.dataTransfer.files?.[0];
                                if (file && file.type.startsWith('image/')) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setNewProduct(prev => ({ ...prev, imageUrl: reader.result as string }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              onClick={() => {
                                const fileInput = document.getElementById('product-image-file-input');
                                if (fileInput) fileInput.click();
                              }}
                              className={cn(
                                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group",
                                theme === 'dark' 
                                  ? "bg-[#0F172A]/40 border-dark-border hover:border-cyan-400 hover:bg-[#0F172A]/60" 
                                  : "bg-gray-50 border-gray-200 hover:border-[#062A95] hover:bg-gray-100"
                              )}
                            >
                              <input 
                                id="product-image-file-input"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && file.type.startsWith('image/')) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setNewProduct(prev => ({ ...prev, imageUrl: reader.result as string }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              
                              {newProduct.imageUrl ? (
                                <div className="relative w-28 h-28 rounded-lg overflow-hidden border border-inherit">
                                  <img src={newProduct.imageUrl} alt="" className="w-full h-full object-cover" />
                                  <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-white text-[8px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                    Replace
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Upload size={24} className={theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"} />
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider">Drag & drop or click to upload</p>
                                    <p className="text-[8px] opacity-60 font-mono mt-0.5 text-dark-muted">Supports PNG, JPG, GIF (Max 5MB)</p>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Remote URL fallback */}
                            <div className="pt-1">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-dark-muted/80 mb-1">Or Reference via Remote URL</p>
                              <input 
                                type="url" 
                                value={newProduct.imageUrl || ""}
                                onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
                                placeholder="HTTP://IMAGE-RESOURCE.COM/..."
                                className={cn(inputClassName, "font-mono")} 
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {productFormTab === 'extra' && (
                        <>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Weight (KG/LB)</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                value={newProduct.weight || ""}
                                onChange={e => setNewProduct({...newProduct, weight: e.target.value})}
                                placeholder="E.G. 1.2KG"
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.weight || ""
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Pallet Size</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                value={newProduct.palletSize || ""}
                                onChange={e => setNewProduct({...newProduct, palletSize: e.target.value})}
                                placeholder="E.G. 120X80"
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.palletSize || ""
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Asset SKU</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                value={newProduct.sku || ""}
                                onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                                placeholder="UNIQUE IDENTIFIER..."
                                className={cn(inputClassName, "font-mono")} 
                              />,
                              newProduct.sku || ""
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            {/* Empty space or offset */}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Markup Price ({currency})</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                inputMode="decimal"
                                value={newProduct.markupPrice ?? ''}
                                onKeyDown={handleDecimalInputKeyDown}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  const parts = val.split('.');
                                  const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                                  setNewProduct({...newProduct, markupPrice: cleanVal as any});
                                }}
                                placeholder="0.00"
                                className={cn(inputClassName, "font-mono font-bold text-orange-500")} 
                              />,
                              newProduct.markupPrice || 0
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={labelClassName}>Discount Price ({currency})</label>
                            {renderInputWithDot(
                              <input 
                                type="text" 
                                inputMode="decimal"
                                value={newProduct.discountPrice ?? ''}
                                onKeyDown={handleDecimalInputKeyDown}
                                onChange={e => {
                                  const val = e.target.value.replace(/[^0-9.]/g, '');
                                  const parts = val.split('.');
                                  const cleanVal = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                                  setNewProduct({...newProduct, discountPrice: cleanVal as any});
                                }}
                                placeholder="0.00"
                                className={cn(inputClassName, "font-mono font-bold text-green-500")} 
                              />,
                              newProduct.discountPrice || 0
                            )}
                          </div>
                        </>
                      )}

                      {productFormTab === 'variation' && (
                        <div className="col-span-2 space-y-6">
                          {/* BLOCK: Multi-Variant Header Banner */}
                          <div className={cn(
                            "p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm",
                            theme === 'dark' ? "bg-[#0F172A]/80 border-dark-border" : "bg-slate-50 border-slate-200"
                          )}>
                            <div className="space-y-1">
                              <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 dark:text-cyan-400 text-[#062A95]">Configure Multi-Variant Strategy</h4>
                              <p className={cn(
                                "text-xs leading-relaxed max-w-xl font-medium",
                                theme === 'dark' ? "text-slate-300" : "text-slate-600"
                              )}>
                                Define unique variations based on Size, Color, or custom Pack Quantity. Each gets its own stock, SKU, and price.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const defaultVar = {
                                  id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                  sku: `${newProduct.sku || 'SKU'}-VAR-${(newProduct.variations?.length || 0) + 1}`,
                                  size: '',
                                  color: '',
                                  barcode: '',
                                  quantity: undefined,
                                  price: Number(newProduct.price || 0),
                                  costPrice: Number(newProduct.costPrice || 0),
                                  stockLevel: 0
                                };
                                setNewProduct({
                                  ...newProduct,
                                  variations: [...(newProduct.variations || []), defaultVar]
                                });
                              }}
                              className={cn(
                                "px-4 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-sm shrink-0 cursor-pointer flex items-center justify-center gap-2",
                                theme === 'dark' ? "bg-cyan-400 hover:bg-cyan-300 text-black" : "bg-[#062A95] hover:bg-[#052175] text-white"
                              )}
                            >
                              <Plus size={14} /> Add Variant
                            </button>
                          </div>

                          {/* BLOCK: Variation Cards Container */}
                          <div className="space-y-4">
                            {(!newProduct.variations || newProduct.variations.length === 0) ? (
                              /* BLOCK: Empty Product Variations Card */
                              <div className={cn(
                                "product-variations-empty-card py-12 px-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all duration-300",
                                theme === 'dark' ? "border-white/15 bg-black/20 text-white" : "border-slate-300 bg-slate-50 text-black"
                              )}>
                                <Package size={48} strokeWidth={1.5} className={cn("product-variations-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                                <p className={cn("product-variations-empty-card__title text-base font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Active Variations</p>
                                <p className={cn("product-variations-empty-card__subtitle text-xs font-presale tracking-wide max-w-xs mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                  Click "+ Add Variant" above to create unique size charts, color options, or bulk pack options for this asset.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {newProduct.variations.map((variant, idx) => {
                                  const titleSummary = [variant.size, variant.color].filter(Boolean).join(' / ') || 'Base Variant';
                                  return (
                                    <div 
                                      key={variant.id}
                                      className={cn(
                                        "rounded-2xl border p-4 sm:p-5 transition-all duration-200 shadow-sm space-y-4",
                                        theme === 'dark' 
                                          ? "bg-[#0F172A] border-dark-border hover:border-cyan-500/40" 
                                          : "bg-white border-slate-200 hover:border-[#062A95]/30"
                                      )}
                                    >
                                      {/* Variant Header */}
                                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                                        <div className="flex items-center gap-2.5">
                                          <span className={cn(
                                            "text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-lg border",
                                            theme === 'dark' 
                                              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                                              : "bg-[#062A95]/10 border-[#062A95]/20 text-[#062A95]"
                                          )}>
                                            Var #{idx + 1}
                                          </span>
                                          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate max-w-[180px] sm:max-w-xs">
                                            {titleSummary}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const dupVar = {
                                                ...variant,
                                                id: `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                                sku: `${variant.sku || 'SKU'}-COPY`
                                              };
                                              setNewProduct({ ...newProduct, variations: [...(newProduct.variations || []), dupVar] });
                                            }}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                                            title="Duplicate Variant"
                                          >
                                            Duplicate
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const refreshed = (newProduct.variations || []).filter(v => v.id !== variant.id);
                                              setNewProduct({ ...newProduct, variations: refreshed });
                                            }}
                                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                            title="Delete Variant"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Inputs Grid: Row 1 - Physical Attributes */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Size
                                          </label>
                                          <input 
                                            type="text"
                                            placeholder="e.g. S, M, XL, 42"
                                            value={variant.size || ''}
                                            onChange={e => {
                                              const newVal = e.target.value.toUpperCase();
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, size: newVal } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-bold text-xs tracking-wider uppercase outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-white" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-black"
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Color
                                          </label>
                                          <input 
                                            type="text"
                                            placeholder="e.g. Red, Black"
                                            value={variant.color || ''}
                                            onChange={e => {
                                              const newVal = e.target.value;
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, color: newVal } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-bold text-xs tracking-wider uppercase outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-white" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-black"
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Qty / Pack
                                          </label>
                                          <input 
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="e.g. 1"
                                            value={variant.quantity ?? ''}
                                            onKeyDown={handleIntegerInputKeyDown}
                                            onChange={e => {
                                              const valStr = e.target.value.replace(/[^0-9]/g, '');
                                              const val = valStr ? Number(valStr) : undefined;
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, quantity: val } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-mono text-xs font-bold outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-white" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-black"
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Stock Level
                                          </label>
                                          <input 
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="0"
                                            value={variant.stockLevel ?? ''}
                                            onKeyDown={handleIntegerInputKeyDown}
                                            onChange={e => {
                                              const valStr = e.target.value.replace(/[^0-9]/g, '');
                                              const val = valStr ? Number(valStr) : 0;
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, stockLevel: val } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-mono text-xs font-bold outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-white" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-black"
                                            )}
                                          />
                                        </div>
                                      </div>

                                      {/* Inputs Grid: Row 2 - Identifiers & Financials */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Variant SKU
                                          </label>
                                          <input 
                                            type="text"
                                            placeholder="SKU-VAR-01"
                                            value={variant.sku || ''}
                                            onChange={e => {
                                              const newVal = e.target.value.toUpperCase();
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, sku: newVal } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-mono text-xs font-bold tracking-wider outline-none transition-all uppercase",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-white" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-black"
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Barcode
                                          </label>
                                          <input 
                                            type="text"
                                            placeholder="Barcode..."
                                            value={variant.barcode || ''}
                                            onChange={e => {
                                              const newVal = e.target.value.replace(/\s+/g, '');
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, barcode: newVal } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-mono text-xs font-bold tracking-wider outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-white" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-black"
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Marked Price ({currency})
                                          </label>
                                          <input 
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={variant.price ?? ''}
                                            onKeyDown={handleDecimalInputKeyDown}
                                            onChange={e => {
                                              const valStr = e.target.value.replace(/[^0-9.]/g, '');
                                              const val = valStr ? Number(valStr) : 0;
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, price: val } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-mono text-xs font-bold outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-cyan-400" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-[#062A95]"
                                            )}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                            Base Cost ({currency})
                                          </label>
                                          <input 
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="0.00"
                                            value={variant.costPrice ?? ''}
                                            onKeyDown={handleDecimalInputKeyDown}
                                            onChange={e => {
                                              const valStr = e.target.value.replace(/[^0-9.]/g, '');
                                              const val = valStr ? Number(valStr) : 0;
                                              const updated = (newProduct.variations || []).map(v => v.id === variant.id ? { ...v, costPrice: val } : v);
                                              setNewProduct({ ...newProduct, variations: updated });
                                            }}
                                            className={cn(
                                              "w-full h-9 px-3 border rounded-xl font-mono text-xs font-bold outline-none transition-all",
                                              theme === 'dark' ? "bg-[#0F172A] border-dark-border focus:border-cyan-400 text-orange-400" : "bg-slate-50 border-slate-200 focus:border-[#062A95] text-orange-600"
                                            )}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {productFormTab === 'promo' && (
                        <>
                          {/* BLOCK: Promo Details Panel - Handles visual state of the promotion and active dates */}
                          <div className="col-span-2 space-y-4">
                            <div className={cn(
                              "p-4 rounded-xl border flex items-center justify-between",
                              theme === 'dark' ? "bg-[#0F172A]/40 border-dark-border" : "bg-gray-50 border-gray-200"
                            )}>
                              <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 dark:text-cyan-400 text-[#062A95]">Active Promotion Status</h4>
                                <p className={cn(
                                  "text-[9px] leading-relaxed max-w-sm font-mono",
                                  theme === 'dark' ? "text-white/70" : "text-black/70"
                                )}>
                                  Toggle this to activate promotion prices in POS transactions.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setNewProduct({ ...newProduct, promoActive: !newProduct.promoActive })}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border-2 cursor-pointer",
                                  newProduct.promoActive 
                                    ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400" : "bg-[#062A95] text-white border-[#062A95]")
                                    : (theme === 'dark' ? "bg-transparent border-white/10 text-white/60" : "bg-transparent border-black/10 text-black/60")
                                )}
                              >
                                {newProduct.promoActive ? "ACTIVE" : "INACTIVE"}
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2 md:col-span-1">
                                <label className={labelClassName}>Promo Tagline / Label</label>
                                {renderInputWithDot(
                                  <input 
                                    type="text" 
                                    value={newProduct.promoLabel || ""}
                                    onChange={e => setNewProduct({...newProduct, promoLabel: e.target.value})}
                                    placeholder="E.G. FLASH SALE, 20% OFF"
                                    className={inputClassName} 
                                  />,
                                  newProduct.promoLabel || ""
                                )}
                              </div>
                              <div className="col-span-2 md:col-span-1">
                                <label className={labelClassName}>Promo Price ({currency})</label>
                                {renderInputWithDot(
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    value={newProduct.promoPrice ?? 0}
                                    onChange={e => setNewProduct({...newProduct, promoPrice: e.target.value as any})}
                                    placeholder="ENTER PROMO PRICE..."
                                    className={cn(inputClassName, "font-mono font-bold text-red-400")} 
                                  />,
                                  newProduct.promoPrice ?? 0
                                )}
                              </div>
                              <div className="col-span-2 md:col-span-1">
                                <label className={labelClassName}>Start Date</label>
                                {renderInputWithDot(
                                  <input 
                                    type="date" 
                                    value={newProduct.promoStartDate || ""}
                                    onChange={e => setNewProduct({...newProduct, promoStartDate: e.target.value})}
                                    className={cn(inputClassName, "font-mono text-xs")} 
                                  />,
                                  newProduct.promoStartDate || ""
                                )}
                              </div>
                              <div className="col-span-2 md:col-span-1">
                                <label className={labelClassName}>Expiry / End Date</label>
                                {renderInputWithDot(
                                  <input 
                                    type="date" 
                                    value={newProduct.promoEndDate || ""}
                                    onChange={e => setNewProduct({...newProduct, promoEndDate: e.target.value})}
                                    className={cn(inputClassName, "font-mono text-xs")} 
                                  />,
                                  newProduct.promoEndDate || ""
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
      
                    {/* BLOCK: Modify Asset Action Controls - Confirm and delete buttons styled after Product Details Card */}
                    <div className="modify-asset-card__actions pt-8 flex flex-col sm:flex-row gap-3 justify-end">
                      {isEditModalOpen && (
                        <button 
                          type="button"
                          onClick={() => {
                            if (editingProduct) {
                              setConfirmDeleteProductId(editingProduct.id);
                            }
                          }}
                          className={cn(
                            "modify-asset-card__button modify-asset-card__button--delete flex-1 sm:flex-none px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                            theme === 'dark' 
                              ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20" 
                              : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                          )}
                        >
                          <Trash2 size={12} /> Delete Asset
                        </button>
                      )}
                      
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm flex-1 sm:flex-none px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark'
                            ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                            : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : (isEditModalOpen ? <Save size={12} /> : <Plus size={12} />)}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'categories' ? (
                  <form onSubmit={handleAddCategory} className="space-y-8">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest block font-sans mb-3 text-dark-muted">
                        Segment Configuration Details
                      </span>
                    </div>
                    <div className={cn(
                      "grid grid-cols-2 gap-4",
                      theme === 'dark' 
                        ? "bg-[#020d30] border border-[#123ebd]/50 p-5 sm:p-6 rounded-2xl shadow-lg shadow-black/40"
                        : "bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm"
                    )}>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Segment Title</label>
                        <input 
                          required
                          type="text" 
                          value={newCategory.name}
                          onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                          placeholder="E.G. ELECTRONICS..."
                          className={inputClassName} 
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Sub Category</label>
                        <input 
                          type="text" 
                          value={newCategory.subCategory}
                          onChange={e => setNewCategory({ ...newCategory, subCategory: e.target.value })}
                          placeholder="E.G. SMARTPHONES..."
                          className={inputClassName} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark' ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : <Plus size={12} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'suppliers' ? (
                  <form onSubmit={handleAddSupplier} className="space-y-8">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest block font-sans mb-3 text-dark-muted">
                        Vendor Registry Particulars
                      </span>
                    </div>
                    <div className={cn(
                      "grid grid-cols-2 gap-4",
                      theme === 'dark' 
                        ? "bg-[#020d30] border border-[#123ebd]/50 p-5 sm:p-6 rounded-2xl shadow-lg shadow-black/40"
                        : "bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm"
                    )}>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Vendor Name</label>
                        <input 
                          required
                          type="text" 
                          value={newSupplier.name}
                          onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                          placeholder="ENTITY NAME..."
                          className={inputClassName} 
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Primary Contact Person</label>
                        <input 
                          required
                          type="text" 
                          value={newSupplier.contact}
                          onChange={e => setNewSupplier({...newSupplier, contact: e.target.value})}
                          placeholder="PRIMARY CONTACT..."
                          className={inputClassName} 
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Contact Email</label>
                        <input 
                          type="email" 
                          value={newSupplier.email}
                          onChange={e => setNewSupplier({...newSupplier, email: e.target.value})}
                          placeholder="VEND@DOMAIN.COM"
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Phone Number</label>
                        <input 
                          type="tel" 
                          value={newSupplier.phone}
                          onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})}
                          placeholder="+234..."
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Website</label>
                        <input 
                          type="url" 
                          value={newSupplier.website}
                          onChange={e => setNewSupplier({...newSupplier, website: e.target.value})}
                          placeholder="WWW.VENDOR.COM"
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Physical Address</label>
                        <textarea 
                          value={newSupplier.address}
                          onChange={e => setNewSupplier({...newSupplier, address: e.target.value})}
                          placeholder="FULL OPERATIONAL ADDRESS..."
                          className={cn(inputClassName, "min-h-[100px] resize-none")} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark' ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : <Plus size={12} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'customers' ? (
                  <form onSubmit={handleAddCustomer} className="space-y-8">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest block font-sans mb-3 text-dark-muted">
                        Client Identity Profiling
                      </span>
                    </div>
                    <div className={cn(
                      "grid grid-cols-2 gap-4",
                      theme === 'dark' 
                        ? "bg-[#020d30] border border-[#123ebd]/50 p-5 sm:p-6 rounded-2xl shadow-lg shadow-black/40"
                        : "bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-sm"
                    )}>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Client Identity</label>
                        <input 
                          required
                          type="text" 
                          value={newCustomer.name}
                          onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                          placeholder="FULL NAME..."
                          className={inputClassName} 
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Email Address (Optional)</label>
                        <input 
                          type="email" 
                          value={newCustomer.email}
                          onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                          placeholder="QUALIFIED EMAIL..."
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Phone Number (Optional)</label>
                        <input 
                          type="tel" 
                          value={newCustomer.phone}
                          onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                          placeholder="+234..."
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest block font-sans mb-2 text-dark-muted">Physical Address (Optional)</label>
                        <textarea 
                          value={newCustomer.address}
                          onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                          placeholder="FULL ADDRESS..."
                          className={cn(inputClassName, "min-h-[80px] resize-none")} 
                        />
                      </div>
                      <div className={cn(
                        "col-span-2 flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                        theme === 'dark' ? "border-cyan-400/20 bg-cyan-400/[0.02]" : "border-[#062A95]/20 bg-[#062A95]/[0.02]"
                      )}>
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            id="allowBalance"
                            checked={newCustomer.allowBalance}
                            onChange={(e) => setNewCustomer({...newCustomer, allowBalance: e.target.checked})}
                            className={cn(
                              "w-5 h-5 rounded-md border-2 appearance-none transition-all cursor-pointer relative after:content-[''] after:hidden after:absolute after:left-[5px] after:top-[1px] after:w-[6px] after:h-[10px] after:border-r-2 after:border-b-2 after:rotate-45 checked:after:block",
                              theme === 'dark' 
                                ? "border-cyan-400 checked:bg-cyan-400 after:border-black" 
                                : "border-[#062A95] checked:bg-[#062A95] after:border-white"
                            )}
                          />
                          <label htmlFor="allowBalance" className="text-[10px] font-black uppercase tracking-widest text-dark-muted cursor-pointer font-sans">Allow Balance?</label>
                        </div>
                        {newCustomer.allowBalance && (
                          <div className="w-48">
                            <label className="text-[8px] font-black uppercase tracking-widest block font-sans mb-1 text-dark-muted">Limit ($)</label>
                            <input 
                              type="number"
                              value={newCustomer.balanceLimit}
                              onChange={(e) => setNewCustomer({...newCustomer, balanceLimit: Number(e.target.value)})}
                              className={cn(inputClassName, "font-mono px-3 py-1.5")}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark' ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : <Plus size={12} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'expenditure' ? (
                  <form onSubmit={handleAddExpenditure} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Spend Description</label>
                        <input 
                          required
                          type="text" 
                          value={newExpenditure.description}
                          onChange={e => setNewExpenditure({...newExpenditure, description: e.target.value})}
                          placeholder="REASON FOR OUTFLOW..."
                          className={inputClassName} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Metric Volume ($)</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          value={newExpenditure.amount}
                          onChange={e => setNewExpenditure({...newExpenditure, amount: Number(e.target.value)})}
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark' ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : <Plus size={12} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'revenue' ? (
                  <form onSubmit={handleAddRevenue} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Revenue Source</label>
                        <input 
                          required
                          type="text" 
                          value={newRevenue.source}
                          onChange={e => setNewRevenue({...newRevenue, source: e.target.value})}
                          placeholder="ORIGIN OF INFLUX..."
                          className={inputClassName} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Metric Volume ($)</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          value={newRevenue.amount}
                          onChange={e => setNewRevenue({...newRevenue, amount: Number(e.target.value)})}
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark' ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : <Plus size={12} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : ['client_balance', 'stakeholder_balance', 'store_balance'].includes(activeTab) ? (
                  <form onSubmit={handleAddBalanceAdjustment} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Adjustment Description</label>
                        <input 
                          required
                          type="text" 
                          value={newBalanceAdj.description}
                          onChange={e => setNewBalanceAdj({...newBalanceAdj, description: e.target.value})}
                          placeholder="REASON FOR ADJUSTMENT..."
                          className={inputClassName} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Financial Volume ($)</label>
                        <input 
                          required
                          type="number" 
                          step="0.01"
                          value={newBalanceAdj.amount}
                          onChange={e => setNewBalanceAdj({...newBalanceAdj, amount: Number(e.target.value)})}
                          className={cn(inputClassName, "font-mono")} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "popup-card__button popup-card__button--save new-product-popup-card__button new-product-popup-card__button--confirm px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === 'dark' ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={12} /> : <Plus size={12} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'categories' ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      await addDoc(collection(db, 'categories'), {
                        name: (e.target as any).categoryName.value,
                        itemCount: 0,
                        createdAt: serverTimestamp()
                      });
                      setIsAddModalOpen(false);
                      (e.target as any).reset();
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'categories', auth);
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Segment Designation</label>
                        <input 
                          name="categoryName"
                          required
                          type="text" 
                          placeholder="E.G. TECHNICAL GEAR, UTILITIES..."
                          className={inputClassName} 
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "w-full sm:w-auto px-6 py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all shadow-hard active:scale-98 flex items-center justify-center gap-2.5 group",
                          theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110 animate-pulse shadow-glow" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-indigo-900/10"
                        )}
                      >
                        {loading ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'suppliers' ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      const form = e.target as any;
                      await addDoc(collection(db, 'suppliers'), {
                        name: form.name.value,
                        contact: form.contact.value,
                        category: form.category.value,
                        createdAt: serverTimestamp()
                      });
                      setIsAddModalOpen(false);
                      form.reset();
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'suppliers', auth);
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Vendor Name</label>
                          <input name="name" required className={inputClassName} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Contact Link</label>
                          <input name="contact" required placeholder="EMAIL OR PHONE" className={inputClassName} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Operations Area</label>
                          <input name="category" required placeholder="E.G. LOGISTICS" className={inputClassName} />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        className={cn(
                          "w-full sm:w-auto px-6 py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all shadow-hard active:scale-98 flex items-center justify-center gap-2.5 group",
                          theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110 animate-pulse shadow-glow" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-indigo-900/10"
                        )}
                      >
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'customers' ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      const form = e.target as any;
                      const codeNum = Math.floor(100000 + Math.random() * 900000);
                      const customerId = `CUST-${codeNum}`;
                      await addDoc(collection(db, 'customers'), {
                        name: form.name.value,
                        email: form.email.value,
                        customerId: customerId,
                        totalSpent: 0,
                        createdAt: serverTimestamp()
                      });
                      setIsAddModalOpen(false);
                      form.reset();
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'customers', auth);
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Legal Identity</label>
                        <input name="name" required className={cn(
                          "w-full border rounded-lg px-4 py-4 outline-none transition-all font-bold uppercase text-xs tracking-widest",
                          theme === 'dark' ? "bg-[#1E1E24] border-[#333]" : "bg-[#F9F9F9] border-[#EEE]"
                        )} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Credential (Email)</label>
                        <input name="email" type="email" required className={cn(
                          "w-full border rounded-lg px-4 py-4 outline-none transition-all font-bold uppercase text-xs tracking-widest",
                          theme === 'dark' ? "bg-[#1E1E24] border-[#333]" : "bg-[#F9F9F9] border-[#EEE]"
                        )} />
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        className={cn(
                          "w-full sm:w-auto px-6 py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all shadow-hard active:scale-98 flex items-center justify-center gap-2.5 group",
                          theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110 animate-pulse shadow-glow" : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-indigo-900/10"
                        )}
                      >
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : activeTab === 'expenditure' ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    try {
                      const form = e.target as any;
                      await addDoc(collection(db, 'expenditures'), {
                        description: form.desc.value,
                        amount: Number(form.amount.value),
                        category: form.category.value,
                        date: new Date().toISOString(),
                        createdAt: serverTimestamp()
                      });
                      setIsAddModalOpen(false);
                      form.reset();
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'expenditures', auth);
                    } finally {
                      setLoading(false);
                    }
                  }} className="space-y-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Expenditure Reference</label>
                        <input name="desc" required placeholder="NATURE OF SPEND..." className={cn(
                          "w-full border rounded-lg px-4 py-4 outline-none transition-all font-bold uppercase text-xs tracking-widest",
                          theme === 'dark' ? "bg-[#1E1E24] border-[#333]" : "bg-[#F9F9F9] border-[#EEE]"
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Metric Volume ($)</label>
                          <input name="amount" type="number" step="0.01" required className={cn(
                            "w-full border rounded-lg px-4 py-4 outline-none transition-all font-mono font-bold",
                            theme === 'dark' ? "bg-[#0A0A0A] border-[#333]" : "bg-[#F9F9F9] border-[#EEE]"
                          )} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#666] mb-2">Cost Center</label>
                          <input name="category" required placeholder="E.G. OPERATIONS" className={cn(
                            "w-full border rounded-lg px-4 py-4 outline-none transition-all font-bold uppercase text-xs tracking-widest",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333]" : "bg-[#F9F9F9] border-[#EEE]"
                          )} />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button 
                        type="submit"
                        className={cn(
                          "w-full sm:w-auto px-6 py-3.5 rounded-xl font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all shadow-hard active:scale-98 flex items-center justify-center gap-2.5 group",
                          "bg-red-600 text-white hover:brightness-110 shadow-red-900/10"
                        )}
                      >
                        Confirm
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                    <div className={cn(
                      "w-32 h-32 rounded-xl border-4 flex items-center justify-center border-dashed",
                      theme === 'dark' ? "border-[#222]" : "border-[#DDD]"
                    )}>
                      {activeTab === 'categories' ? <Tags size={48} strokeWidth={1} /> : activeTab === 'suppliers' ? <Truck size={48} strokeWidth={1} /> : <Users size={48} strokeWidth={1} />}
                    </div>
                    <div>
                      <h3 className="font-black uppercase  tracking-tighter text-2xl">Module Expansion Pending</h3>
                      <p className="text-xs uppercase tracking-[0.2em] mt-2 max-w-[200px] mx-auto">Database Sync in Progress</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}

              {/* Category/Segment Detail Modal */}
              {createPortal(
                <AnimatePresence>
                  {selectedCategoryInfo && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
                      {/* BLOCK: Segment Details Card - Displays and edits category segment details */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleBackdropClick}
                        className="segment-details-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
                      />
                      <motion.div 
                        initial={{ scale: 0.98, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.98, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className={cn(
                          "popup-card segment-details-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                          theme === 'dark' 
                            ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" 
                            : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
                        )}
                      >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header segment-details-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <Tags size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-sans">
                      <h3 className={cn(
                        "popup-card__title segment-details-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        {editingCategoryData ? "Modify Segment Info" : "Segment Description"}
                      </h3>
                      <span className="popup-card__subtitle segment-details-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        {selectedCategoryInfo ? `#${selectedCategoryInfo.id}` : `#New`}
                      </span>
                    </div>

                    <div className="flex justify-end items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => { setSelectedCategoryInfo(null); setEditingCategoryData(null); }}
                        className={cn(
                          "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          theme === 'dark' ? "bg-black/40 border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50"
                        )}
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {editingCategoryData ? (
                  <form onSubmit={handleUpdateCategory} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Segment Name</label>
                        <input 
                          type="text"
                          required
                          value={editingCategoryData.name}
                          onChange={(e) => setEditingCategoryData({ ...editingCategoryData, name: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-sm uppercase tracking-wide",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Classification (Sub-Category)</label>
                        <input 
                          type="text"
                          value={editingCategoryData.subCategory || ''}
                          onChange={(e) => setEditingCategoryData({ ...editingCategoryData, subCategory: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-sm uppercase tracking-wide",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                    </div>
                    <div className={cn(
                      "p-6 border-t flex gap-4 justify-end shrink-0",
                      theme === 'dark' ? "bg-[#0F172A] border-dark-border" : "bg-gray-50 border-light-border"
                    )}>
                      <button 
                        type="button" 
                        onClick={() => { setEditingCategoryData(null); }}
                        className={cn(
                          "px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black/5 dark:hover:bg-white/5",
                          theme === 'dark' ? "border-dark-border text-white" : "border-light-border text-black"
                        )}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          theme === 'dark' ? "bg-[#22D3EE] text-black hover:brightness-110" : "bg-[#062A95] text-white hover:bg-opacity-90"
                        )}
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="segment-details-card p-6 md:p-8 font-sans overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
                    {/* BLOCK: Segment Details Content Card - Displays information and actions for a category segment */}
                    <div className="segment-details-card__scrollable space-y-6 max-h-[80%] overflow-y-auto pr-2">
                      <div className="segment-details-card__section space-y-4">
                        <div className="segment-details-card__field">
                          <span className="segment-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40">Segment Name</span>
                          <p className="segment-details-card__value text-lg font-black uppercase tracking-tighter text-brand-primary">{selectedCategoryInfo.name}</p>
                        </div>
                        {selectedCategoryInfo.subCategory && (
                          <div className="segment-details-card__field">
                            <span className="segment-details-card__label text-[10px] font-[900] uppercase tracking-widest opacity-40">Classification</span>
                            <p className={cn("segment-details-card__value text-sm font-bold uppercase", theme === 'dark' ? "text-white" : "text-black")}>{selectedCategoryInfo.subCategory}</p>
                          </div>
                        )}
                        <div className="segment-details-card__field">
                          <span className="segment-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Holdings Inventory</span>
                          <p className={cn("segment-details-card__value text-xs font-mono font-bold", theme === 'dark' ? "text-white/60" : "text-black/60")}>
                            {selectedCategoryInfo.itemCount} ACTIVE CATEGORIZED SKUS
                          </p>
                        </div>
                      </div>

                      <div className="segment-details-card__enrolled-products border-t border-inherit/10 pt-4">
                        <span className="segment-details-card__enrolled-title text-[10px] font-black uppercase tracking-widest opacity-40 block mb-3">Enrolled Products in Segment</span>
                        <div className="segment-details-card__products-list space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                          {products.filter(p => (p.category || '').toLowerCase() === (selectedCategoryInfo.name || '').toLowerCase() || (p.category || '').toLowerCase() === (selectedCategoryInfo.id || '').toLowerCase()).length === 0 ? (
                            <p className="segment-details-card__empty text-xs opacity-30 py-2">No active products cataloged under this segment.</p>
                          ) : (
                            products.filter(p => (p.category || '').toLowerCase() === (selectedCategoryInfo.name || '').toLowerCase() || (p.category || '').toLowerCase() === (selectedCategoryInfo.id || '').toLowerCase()).map(p => (
                              <div key={p.id} className={cn(
                                "segment-details-card__product-item p-3 rounded-lg border flex items-center justify-between text-xs",
                                theme === 'dark' ? "bg-dark-surface/50 border-[#333]" : "bg-gray-50 border-[#EEE]"
                              )}>
                                <p className="segment-details-card__product-name font-bold uppercase truncate max-w-[200px]">{p.name}</p>
                                <div className="segment-details-card__product-stats text-right whitespace-nowrap">
                                  <p className="segment-details-card__product-price font-mono font-bold">{formatCurrency(p.price, currency)}</p>
                                  <p className="segment-details-card__product-stock text-[9px] opacity-40 font-mono">STOCK: {p.stockLevel}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BLOCK: Segment Details Actions Bar - Footer containing actions to print and edit */}
                    <div className="segment-details-card__actions pt-3.5 border-t border-inherit flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3.5 shrink-0 mt-3.5">
                      <div className="segment-details-card__btn-group flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const doc = new jsPDF();
                            doc.setFont("helvetica", "bold");
                            doc.text("SEGMENT PROFILE", 10, 20);
                            doc.setFont("helvetica", "normal");
                            doc.text(`Segment Name: ${selectedCategoryInfo.name}`, 10, 35);
                            doc.text(`Classification: ${selectedCategoryInfo.subCategory || "N/A"}`, 10, 45);
                            doc.text(`Active SKUs: ${selectedCategoryInfo.itemCount}`, 10, 55);
                            doc.save(`Segment_${selectedCategoryInfo.id}.pdf`);
                          }}
                          className={cn(
                            "segment-details-card__btn segment-details-card__btn--print px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                            theme === "dark" 
                              ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                              : "bg-white border-light-border text-black hover:bg-gray-50",
                          )}
                        >
                          <Printer size={12} /> Print Summary
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingCategoryData({ ...selectedCategoryInfo })}
                          className={cn(
                            "segment-details-card__btn segment-details-card__btn--modify px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                            theme === "dark"
                              ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                              : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                          )}
                        >
                          <Edit2 size={12} /> Modify Segment
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Supplier/Vendor Detail Modal */}
      {createPortal(
        <AnimatePresence>
          {selectedSupplierInfo && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
              {/* BLOCK: Vendor Details Card - Displays and edits supplier profile details */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="vendor-details-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div 
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card vendor-details-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === 'dark' 
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" 
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header vendor-details-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <Truck size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-sans">
                      <h3 className={cn(
                        "popup-card__title vendor-details-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        {editingSupplierData ? "Modify Vendor Info" : "Vendor Profile Detail"}
                      </h3>
                      <span className="popup-card__subtitle vendor-details-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        {selectedSupplierInfo ? `#${selectedSupplierInfo.id}` : `#New`}
                      </span>
                    </div>

                    <div className="flex justify-end items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => { setSelectedSupplierInfo(null); setEditingSupplierData(null); }}
                        className={cn(
                          "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          theme === 'dark' ? "bg-black/40 border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50"
                        )}
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {editingSupplierData ? (
                  <form onSubmit={handleUpdateSupplier} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Vendor Name</label>
                        <input 
                          type="text"
                          required
                          value={editingSupplierData.name}
                          onChange={(e) => setEditingSupplierData({ ...editingSupplierData, name: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-sm uppercase tracking-wide",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Operations Area (Category)</label>
                          <input 
                            type="text"
                            required
                            value={editingSupplierData.category}
                            onChange={(e) => setEditingSupplierData({ ...editingSupplierData, category: e.target.value })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-xs uppercase tracking-wide",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Representative Name</label>
                          <input 
                            type="text"
                            value={editingSupplierData.contact || ''}
                            onChange={(e) => setEditingSupplierData({ ...editingSupplierData, contact: e.target.value })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-xs uppercase tracking-wide",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Email Connection</label>
                          <input 
                            type="email"
                            value={editingSupplierData.email || ''}
                            onChange={(e) => setEditingSupplierData({ ...editingSupplierData, email: e.target.value })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-mono text-xs font-bold",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Contact Phone</label>
                          <input 
                            type="text"
                            value={editingSupplierData.phone || ''}
                            onChange={(e) => setEditingSupplierData({ ...editingSupplierData, phone: e.target.value })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-mono text-xs font-bold",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Physical Address</label>
                        <input 
                          type="text"
                          value={editingSupplierData.address || ''}
                          onChange={(e) => setEditingSupplierData({ ...editingSupplierData, address: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-xs uppercase tracking-wide",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Corporate Website</label>
                        <input 
                          type="text"
                          value={editingSupplierData.website || ''}
                          onChange={(e) => setEditingSupplierData({ ...editingSupplierData, website: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-mono text-xs font-bold",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                    </div>
                    <div className={cn(
                      "p-6 border-t flex gap-4 justify-end shrink-0",
                      theme === 'dark' ? "bg-[#0F172A] border-dark-border" : "bg-gray-50 border-light-border"
                    )}>
                      <button 
                        type="button" 
                        onClick={() => { setEditingSupplierData(null); }}
                        className={cn(
                          "px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black/5 dark:hover:bg-white/5",
                          theme === 'dark' ? "border-dark-border text-white" : "border-light-border text-black"
                        )}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          theme === 'dark' ? "bg-[#22D3EE] text-black hover:brightness-110" : "bg-[#062A95] text-white hover:bg-opacity-90"
                        )}
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="vendor-details-card p-6 md:p-8 font-sans overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
                    {/* BLOCK: Vendor Details Content Card - Displays information and actions for a vendor profile */}
                    <div className="vendor-details-card__scrollable space-y-6 max-h-[80%] overflow-y-auto pr-2">
                      <div className="vendor-details-card__section space-y-4">
                        <div className="vendor-details-card__field">
                          <span className="vendor-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40">Vendor Name</span>
                          <p className="vendor-details-card__value text-xl font-black uppercase tracking-tighter text-purple-500">{selectedSupplierInfo.name}</p>
                        </div>

                        <div className="vendor-details-card__grid grid grid-cols-2 gap-4 border-t border-inherit/10 pt-4">
                          <div className="vendor-details-card__field">
                            <span className="vendor-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Operations Area</span>
                            <span className={cn(
                              "vendor-details-card__badge px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider",
                              theme === 'dark' ? "bg-[#222] border border-[#333] text-purple-400" : "bg-purple-50 text-purple-700"
                            )}>
                              {selectedSupplierInfo.category}
                            </span>
                          </div>
                          <div className="vendor-details-card__field">
                            <span className="vendor-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Representative</span>
                            <p className={cn("vendor-details-card__value text-xs font-bold uppercase", theme === 'dark' ? "text-white" : "text-black")}>{selectedSupplierInfo.contact}</p>
                          </div>
                        </div>

                        <div className="vendor-details-card__contact-info space-y-3 pt-3 border-t border-inherit/10">
                          {selectedSupplierInfo.email && (
                            <div className="vendor-details-card__contact-item flex items-center gap-3 text-xs">
                              <Mail size={14} className="opacity-40" />
                              <span className="font-mono">{selectedSupplierInfo.email}</span>
                            </div>
                          )}
                          {selectedSupplierInfo.phone && (
                            <div className="vendor-details-card__contact-item flex items-center gap-3 text-xs">
                              <Phone size={14} className="opacity-40" />
                              <span className="font-mono">{selectedSupplierInfo.phone}</span>
                            </div>
                          )}
                          {selectedSupplierInfo.address && (
                            <div className="vendor-details-card__contact-item flex items-start gap-4 text-xs">
                              <MapPin size={14} className="opacity-45 shrink-0 mt-0.5" />
                              <span className="uppercase font-bold tracking-normal leading-tight">{selectedSupplierInfo.address}</span>
                            </div>
                          )}
                          {selectedSupplierInfo.website && (
                            <div className="vendor-details-card__contact-item flex items-center gap-3 text-xs text-brand-primary">
                              <Globe size={14} className="opacity-50" />
                              <a href={selectedSupplierInfo.website.startsWith('http') ? selectedSupplierInfo.website : `https://${selectedSupplierInfo.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-bold font-mono">
                                {selectedSupplierInfo.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BLOCK: Vendor Details Actions Bar - Footer containing actions to print and edit */}
                    <div className="vendor-details-card__actions pt-3.5 border-t border-inherit flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3.5 shrink-0 mt-3.5">
                      <div className="vendor-details-card__btn-group flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const doc = new jsPDF();
                            doc.setFont("helvetica", "bold");
                            doc.text("VENDOR / SUPPLIER PROFILE", 10, 20);
                            doc.setFont("helvetica", "normal");
                            doc.text(`Vendor Name: ${selectedSupplierInfo.name}`, 10, 35);
                            doc.text(`Contact Representative: ${selectedSupplierInfo.contact || "N/A"}`, 10, 45);
                            doc.text(`Operations Area: ${selectedSupplierInfo.category || "N/A"}`, 10, 55);
                            doc.text(`Email: ${selectedSupplierInfo.email || "N/A"}`, 10, 65);
                            doc.text(`Phone: ${selectedSupplierInfo.phone || "N/A"}`, 10, 75);
                            doc.text(`Address: ${selectedSupplierInfo.address || "N/A"}`, 10, 85);
                            doc.save(`Vendor_${selectedSupplierInfo.id}.pdf`);
                          }}
                          className={cn(
                            "vendor-details-card__btn vendor-details-card__btn--print px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                            theme === "dark" 
                              ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                              : "bg-white border-light-border text-black hover:bg-gray-50",
                          )}
                        >
                          <Printer size={12} /> Print Profile
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingSupplierData({ ...selectedSupplierInfo })}
                          className={cn(
                            "vendor-details-card__btn vendor-details-card__btn--modify px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                            theme === "dark"
                              ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                              : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                          )}
                        >
                          <Edit2 size={12} /> Modify Vendor
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Clientele/Customer Detail Modal */}
      {createPortal(
        <AnimatePresence>
          {selectedCustomerInfo && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
              {/* BLOCK: Client Details Card - Displays and edits customer profile details */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="client-details-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div 
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card client-details-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === 'dark' 
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white" 
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header client-details-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <Users size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-sans">
                      <h3 className={cn(
                        "popup-card__title client-details-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        {editingCustomerData ? "Modify Client Info" : "Client Profile Detail"}
                      </h3>
                      <span className="popup-card__subtitle client-details-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        {selectedCustomerInfo ? `#${selectedCustomerInfo.id}` : `#New`}
                      </span>
                    </div>

                    <div className="flex justify-end items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => { setSelectedCustomerInfo(null); setEditingCustomerData(null); }}
                        className={cn(
                          "w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          theme === 'dark' ? "bg-black/40 border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50"
                        )}
                        title="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                
                {editingCustomerData ? (
                  <form onSubmit={handleUpdateCustomer} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Client Name</label>
                        <input 
                          type="text"
                          required
                          value={editingCustomerData.name}
                          onChange={(e) => setEditingCustomerData({ ...editingCustomerData, name: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-sm uppercase tracking-wide",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Email Address</label>
                          <input 
                            type="email"
                            required
                            value={editingCustomerData.email}
                            onChange={(e) => setEditingCustomerData({ ...editingCustomerData, email: e.target.value })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-mono text-xs font-bold",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Phone Number</label>
                          <input 
                            type="text"
                            value={editingCustomerData.phone || ''}
                            onChange={(e) => setEditingCustomerData({ ...editingCustomerData, phone: e.target.value })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-mono text-xs font-bold",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Office/Home Address</label>
                        <input 
                          type="text"
                          value={editingCustomerData.address || ''}
                          onChange={(e) => setEditingCustomerData({ ...editingCustomerData, address: e.target.value })}
                          className={cn(
                            "w-full px-4 py-2.5 rounded-lg border outline-none font-bold text-xs uppercase tracking-wide",
                            theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                          )}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-inherit/10">
                        <div>
                          <p className="text-xs font-bold uppercase">Staging Credit Settings</p>
                          <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Allow items on dynamic credit balance</p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={editingCustomerData.allowBalance || false}
                          onChange={(e) => setEditingCustomerData({ ...editingCustomerData, allowBalance: e.target.checked })}
                          className="w-5 h-5 accent-brand-primary rounded cursor-pointer"
                        />
                      </div>
                      {editingCustomerData.allowBalance && (
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Credit Line Limit ({currency})</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={editingCustomerData.balanceLimit || 0}
                            onChange={(e) => setEditingCustomerData({ ...editingCustomerData, balanceLimit: Number(e.target.value) })}
                            className={cn(
                              "w-full px-4 py-2.5 rounded-lg border outline-none font-mono text-xs font-bold",
                              theme === 'dark' ? "bg-[#1E1E24] border-[#333] focus:border-brand-primary text-white" : "bg-[#F9F9F9] border-[#EEE] focus:border-brand-secondary text-black"
                            )}
                          />
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "p-6 border-t flex gap-4 justify-end shrink-0",
                      theme === 'dark' ? "bg-[#0F172A] border-dark-border" : "bg-gray-50 border-light-border"
                    )}>
                      <button 
                        type="button" 
                        onClick={() => { setEditingCustomerData(null); }}
                        className={cn(
                          "px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black/5 dark:hover:bg-white/5",
                          theme === 'dark' ? "border-dark-border text-white" : "border-light-border text-black"
                        )}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={loading}
                        className={cn(
                          "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                          theme === 'dark' ? "bg-[#22D3EE] text-black hover:brightness-110" : "bg-[#062A95] text-white hover:bg-opacity-90"
                        )}
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="clientele-details-card p-6 md:p-8 font-sans overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
                    {/* BLOCK: Clientele Details Content Card - Displays information and actions for a client profile */}
                    <div className="clientele-details-card__scrollable space-y-6 max-h-[80%] overflow-y-auto pr-2">
                      <div className="clientele-details-card__section space-y-4">
                        <div className="clientele-details-card__identity-header flex items-start justify-between gap-4">
                          <div className="clientele-details-card__identity-text min-w-0">
                            <span className="clientele-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40">Client Identity</span>
                            <p className="clientele-details-card__value text-xl font-black uppercase tracking-tighter text-brand-primary leading-tight mt-1 truncate">{selectedCustomerInfo.name}</p>
                          </div>
                          <span className="clientele-details-card__id-badge text-xs font-mono font-black border-2 border-brand-primary text-brand-primary px-3 py-1 rounded shrink-0">
                            {selectedCustomerInfo.customerId || ('CUST-' + (selectedCustomerInfo.id ? selectedCustomerInfo.id.slice(-6).toUpperCase() : 'UNKNOWN'))}
                          </span>
                        </div>

                        <div className="clientele-details-card__grid grid grid-cols-2 gap-4 border-t border-inherit/10 pt-4">
                          <div className="clientele-details-card__field">
                            <span className="clientele-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Credit Line Limit</span>
                            <p className={cn("clientele-details-card__value text-base font-black font-mono", theme === 'dark' ? "text-white" : "text-black")}>
                              {selectedCustomerInfo.allowBalance 
                                ? formatCurrency(selectedCustomerInfo.balanceLimit || 0, currency)
                                : 'Disallowed'}
                            </p>
                          </div>
                          <div className="clientele-details-card__field">
                            <span className="clientele-details-card__label text-[10px] font-black uppercase tracking-widest opacity-40 block mb-1">Staging Credit</span>
                            <div className="clientele-details-card__credit-status flex items-center gap-1.5 mt-1">
                              <span className={cn(
                                "clientele-details-card__pulse-dot w-2.5 h-2.5 rounded-full inline-block shrink-0",
                                selectedCustomerInfo.allowBalance ? "bg-green-500" : "bg-red-500"
                              )} />
                              <span className="clientele-details-card__value text-[10px] font-black uppercase tracking-wider select-none">
                                {selectedCustomerInfo.allowBalance ? 'Authorized' : 'Disallowed'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="clientele-details-card__ltv-card p-4 rounded-xl border flex items-center justify-between bg-brand-primary/5 border-brand-primary/20">
                          <div className="clientele-details-card__field">
                            <p className="clientele-details-card__ltv-label text-[9px] font-bold uppercase tracking-widest opacity-40">Lifetime Value (LTV)</p>
                            <p className={cn("clientele-details-card__ltv-sublabel text-xs font-black uppercase mt-1", theme === 'dark' ? "text-white" : "text-black")}>Total Customer Expenditure</p>
                          </div>
                          <p className="clientele-details-card__ltv-value text-lg font-black font-mono text-brand-primary">
                            {formatCurrency(selectedCustomerInfo.totalSpent || 0, currency)}
                          </p>
                        </div>

                        {/* BLOCK: Client Account Balance Card - Displays customer's prepaid balance or current balance limit standing */}
                        <div className="clientele-details-card__balance-card p-4 rounded-xl border flex items-center justify-between bg-cyan-500/5 border-cyan-500/20">
                          <div className="clientele-details-card__field">
                            <p className="clientele-details-card__balance-label text-[9px] font-bold uppercase tracking-widest opacity-40">Escrow & Prepaid</p>
                            <p className={cn("clientele-details-card__balance-sublabel text-xs font-black uppercase mt-1", theme === 'dark' ? "text-white" : "text-black")}>Account Balance</p>
                          </div>
                          <p className="clientele-details-card__balance-value text-lg font-black font-mono text-cyan-500">
                            {formatCurrency(selectedCustomerInfo.accountBalance || 0, currency)}
                          </p>
                        </div>

                        <div className="clientele-details-card__contact-info space-y-3 pt-4 border-t border-inherit/10">
                          {selectedCustomerInfo.email && (
                            <div className="clientele-details-card__contact-item flex items-center gap-3 text-xs">
                              <Mail size={14} className="opacity-40" />
                              <span className="font-mono">{selectedCustomerInfo.email}</span>
                            </div>
                          )}
                          {selectedCustomerInfo.phone && (
                            <div className="clientele-details-card__contact-item flex items-center gap-3 text-xs">
                              <Phone size={14} className="opacity-40" />
                              <span className="font-mono">{selectedCustomerInfo.phone}</span>
                            </div>
                          )}
                          {selectedCustomerInfo.address && (
                            <div className="clientele-details-card__contact-item flex items-start gap-3 text-xs">
                              <MapPin size={14} className="opacity-45 shrink-0 mt-0.5" />
                              <span className="uppercase font-bold tracking-normal leading-tight">{selectedCustomerInfo.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BLOCK: Clientele Details Actions Bar - Footer containing actions to print and edit */}
                    <div className="clientele-details-card__actions pt-3.5 border-t border-inherit flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3.5 shrink-0 mt-3.5">
                      <div className="clientele-details-card__btn-group flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const doc = new jsPDF();
                            doc.setFont("helvetica", "bold");
                            doc.text("CLIENT / CUSTOMER PROFILE", 10, 20);
                            doc.setFont("helvetica", "normal");
                            doc.text(`Client Name: ${selectedCustomerInfo.name}`, 10, 35);
                            doc.text(`Customer ID: ${selectedCustomerInfo.customerId || ('CUST-' + (selectedCustomerInfo.id ? selectedCustomerInfo.id.slice(-6).toUpperCase() : 'UNKNOWN'))}`, 10, 45);
                            doc.text(`Credit Line Limit: ${selectedCustomerInfo.allowBalance ? formatCurrency(selectedCustomerInfo.balanceLimit || 0, currency) : "Disallowed"}`, 10, 55);
                            doc.text(`Lifetime Value: ${formatCurrency(selectedCustomerInfo.totalSpent || 0, currency)}`, 10, 65);
                            doc.text(`Email: ${selectedCustomerInfo.email || "N/A"}`, 10, 75);
                            doc.text(`Phone: ${selectedCustomerInfo.phone || "N/A"}`, 10, 85);
                            doc.text(`Address: ${selectedCustomerInfo.address || "N/A"}`, 10, 95);
                            doc.save(`Client_${selectedCustomerInfo.id}.pdf`);
                          }}
                          className={cn(
                            "clientele-details-card__btn clientele-details-card__btn--print px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                            theme === "dark" 
                              ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                              : "bg-white border-light-border text-black hover:bg-gray-50",
                          )}
                        >
                          <Printer size={12} /> Print Profile
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingCustomerData({ ...selectedCustomerInfo })}
                          className={cn(
                            "clientele-details-card__btn clientele-details-card__btn--modify px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                            theme === "dark"
                              ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                              : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                          )}
                        >
                          <Edit2 size={12} /> Modify Client
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {isMassEditPopupOpen && (
            <motion.div 
              key="mass-edit-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="mass-actions-popup-backdrop fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[99998]"
            />
          )}

          {isMassEditPopupOpen && (
            <motion.div
              key="mass-edit-body"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={cn(
                "popup-card mass-actions-popup-card fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-[550px] max-h-[85vh] z-[99999] flex flex-col shadow-2xl border rounded-2xl overflow-hidden",
                theme === 'dark' 
                  ? "bg-[#04123a] border-[#123ebd] text-white" 
                  : "bg-white border-slate-300 text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

              {/* Header */}
              <div className={cn(
                "popup-card__header mass-actions-popup-card__header p-4 border-b shrink-0 relative z-10",
                theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
              )}>
                {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      {massEditTab === 'promo' && <Tags size={16} className="text-brand-primary animate-in fade-in zoom-in duration-300" />}
                      {massEditTab === 'prices' && <DollarSign size={16} className="text-brand-primary animate-in fade-in zoom-in duration-300" />}
                      {massEditTab === 'stock' && <Package size={16} className="text-brand-primary animate-in fade-in zoom-in duration-300" />}
                      {massEditTab === 'delete' && <Trash2 size={16} className="text-brand-primary animate-in fade-in zoom-in duration-300" />}
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-sans">
                    <h3 className={cn(
                      "popup-card__title mass-actions-popup-card__title text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Mass Configure Assets
                    </h3>
                    <span className="popup-card__subtitle mass-actions-popup-card__subtitle text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                      {selectedProductIds.length} Selected
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => setIsMassEditPopupOpen(false)}
                      className={cn(
                        "popup-card__close-button mass-actions-popup-card__close-button w-9 h-9 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                        theme === 'dark' 
                          ? "bg-black/40 border-white/40 text-white hover:bg-gray-950" 
                          : "bg-white border-light-border text-black hover:bg-gray-50"
                      )}
                      title="Close"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="popup-card__body mass-actions-popup-card__body p-6 space-y-6 overflow-y-auto no-scrollbar">
                
                {/* BLOCK: Mass Actions Config Tabs - Selector for different asset configuration options */}
                <div className={cn(
                  "mass-config-tabs flex flex-row overflow-x-auto whitespace-nowrap sm:grid sm:grid-cols-4 gap-2 pb-4 border-b",
                  theme === 'dark' ? "border-white/10" : "border-slate-200"
                )}>
                  {([
                    { id: 'promo', label: 'PROMO', icon: Tags },
                    { id: 'prices', label: 'PRICES', icon: DollarSign },
                    { id: 'stock', label: 'STOCK', icon: Package },
                    { id: 'delete', label: 'DELETE', icon: Trash2 }
                  ]).map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMassEditTab(opt.id as any)}
                        className={cn(
                          "mass-config-tabs__tab px-3 py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all border-2 text-center cursor-pointer shrink-0 flex items-center justify-center gap-1.5",
                          massEditTab === opt.id
                            ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400 shadow-md" : "bg-[#062A95] text-white border-[#062A95] shadow-md")
                            : (theme === 'dark' ? "bg-white/[0.02] border-white/5 text-white/70 hover:text-white hover:border-white/20" : "bg-gray-50 border-gray-200 text-black/70 hover:text-black hover:border-gray-400")
                        )}
                      >
                        <Icon size={12} /> {opt.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content: Promo Configuration */}
                {massEditTab === 'promo' && (
                  <div className={cn(
                    "mass-actions-popup-card__content p-4 rounded-xl border space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    theme === 'dark' ? "bg-black/25 border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="flex items-center gap-2">
                      <Tags size={15} className="text-brand-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Configure Promotion</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Enable Promo Sale</span>
                      <button
                        type="button"
                        onClick={() => setMassPromoActive(!massPromoActive)}
                        className={cn(
                          "w-12 h-6.5 rounded-full p-1 transition-all duration-300 cursor-pointer flex items-center",
                          massPromoActive ? "bg-emerald-500 justify-end" : "bg-gray-400 justify-start"
                        )}
                      >
                        <motion.div layout className="w-4.5 h-4.5 rounded-full bg-white shadow-md" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Sale Price ({currency})</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={massPromoPrice || ''}
                          onChange={(e) => setMassPromoPrice(Number(e.target.value))}
                          disabled={!massPromoActive}
                          className={cn(
                            "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono tracking-wide",
                            !massPromoActive 
                              ? "opacity-50 cursor-not-allowed" 
                              : theme === 'dark' 
                                ? "bg-[#020d30] border-[#123ebd] text-white" 
                                : "bg-white border-slate-300 text-black"
                          )}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Promo Tagline / Label</label>
                        <input 
                          type="text"
                          value={massPromoLabel}
                          onChange={(e) => setMassPromoLabel(e.target.value)}
                          disabled={!massPromoActive}
                          className={cn(
                            "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-medium outline-none tracking-wide uppercase",
                            !massPromoActive 
                              ? "opacity-50 cursor-not-allowed" 
                              : theme === 'dark' 
                                ? "bg-[#020d30] border-[#123ebd] text-white" 
                                : "bg-white border-slate-300 text-black"
                          )}
                          placeholder="e.g. FLASH SALE"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Start Date</label>
                        <input 
                          type="date"
                          value={massPromoStartDate}
                          onChange={(e) => setMassPromoStartDate(e.target.value)}
                          disabled={!massPromoActive}
                          className={cn(
                            "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-semibold outline-none",
                            !massPromoActive 
                              ? "opacity-50 cursor-not-allowed" 
                              : theme === 'dark' 
                                ? "bg-[#020d30] border-[#123ebd] text-white" 
                                : "bg-white border-slate-300 text-black"
                          )}
                        />
                      </div>

                      <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-70">End Date</label>
                        <input 
                          type="date"
                          value={massPromoEndDate}
                          onChange={(e) => setMassPromoEndDate(e.target.value)}
                          disabled={!massPromoActive}
                          className={cn(
                            "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-semibold outline-none",
                            !massPromoActive 
                              ? "opacity-50 cursor-not-allowed" 
                              : theme === 'dark' 
                                ? "bg-[#020d30] border-[#123ebd] text-white" 
                                : "bg-white border-slate-300 text-black"
                          )}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={applyMassPromo}
                        className={cn(
                          "w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95",
                          theme === 'dark'
                            ? "bg-cyan-400 text-black hover:scale-[1.02]"
                            : "bg-[#062A95] text-white hover:bg-[#062A95]/90 hover:scale-[1.02]"
                        )}
                      >
                        Apply Promotions to {selectedProductIds.length} Products
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab Content: Prices Configuration */}
                {massEditTab === 'prices' && (
                  <div className={cn(
                    "mass-actions-popup-card__content p-4 rounded-xl border space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    theme === 'dark' ? "bg-black/25 border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="flex items-center gap-2">
                      <DollarSign size={15} className="text-brand-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Configure Prices</span>
                    </div>

                    <p className="text-[10px] opacity-70 font-semibold uppercase tracking-wider leading-relaxed">
                      Enter values for the fields you wish to change. Fields left blank will remain unchanged on all selected products.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Cost Price ({currency})</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={massCostPrice}
                          onChange={(e) => setMassCostPrice(e.target.value)}
                          className={cn(
                            "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono tracking-wide",
                            theme === 'dark' 
                              ? "bg-[#020d30] border-[#123ebd] text-white" 
                              : "bg-white border-slate-300 text-black"
                          )}
                          placeholder="e.g. 15.00"
                        />
                      </div>

                      <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Marked/Retail Price ({currency})</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={massPrice}
                          onChange={(e) => setMassPrice(e.target.value)}
                          className={cn(
                            "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono tracking-wide",
                            theme === 'dark' 
                              ? "bg-[#020d30] border-[#123ebd] text-white" 
                              : "bg-white border-slate-300 text-black"
                          )}
                          placeholder="e.g. 29.99"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={applyMassPrices}
                        className={cn(
                          "w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95",
                          theme === 'dark'
                            ? "bg-cyan-400 text-black hover:scale-[1.02]"
                            : "bg-[#062A95] text-white hover:bg-[#062A95]/90 hover:scale-[1.02]"
                        )}
                      >
                        Apply Prices to {selectedProductIds.length} Products
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab Content: Stock Adjustments */}
                {massEditTab === 'stock' && (
                  <div className={cn(
                    "mass-actions-popup-card__content p-4 rounded-xl border space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    theme === 'dark' ? "bg-black/25 border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <div className="flex items-center gap-2">
                      <Package size={15} className="text-brand-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Adjust Stock Levels</span>
                    </div>

                    <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Adjustment Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setMassStockChangeType('add')}
                          className={cn(
                            "py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer text-center",
                            massStockChangeType === 'add'
                              ? (theme === 'dark' ? "bg-cyan-400 text-black border-cyan-400 font-bold" : "bg-[#062A95] text-white border-[#062A95] font-bold")
                              : (theme === 'dark' ? "bg-white/[0.02] border-white/5 text-white/70" : "bg-white border-slate-300 text-black/70")
                          )}
                        >
                          Add Amount (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMassStockChangeType('remove')}
                          className={cn(
                            "py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer text-center",
                            massStockChangeType === 'remove'
                              ? "bg-red-600 border-red-600 text-white font-bold"
                              : (theme === 'dark' ? "bg-white/[0.02] border-white/5 text-white/70" : "bg-white border-slate-300 text-black/70")
                          )}
                        >
                          Remove Amount (-)
                        </button>
                      </div>
                    </div>

                    <div className="mass-actions-popup-card__field flex flex-col gap-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Amount of Stock to {massStockChangeType === 'add' ? 'Add' : 'Remove'}</label>
                      <input 
                        type="number"
                        min="1"
                        step="1"
                        value={massStockAmount}
                        onChange={(e) => setMassStockAmount(e.target.value)}
                        className={cn(
                          "mass-actions-popup-card__input border rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono tracking-wide",
                          theme === 'dark' 
                            ? "bg-[#020d30] border-[#123ebd] text-white" 
                            : "bg-white border-slate-300 text-black"
                        )}
                        placeholder="e.g. 10"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={applyMassStock}
                        className={cn(
                          "w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md active:scale-95",
                          massStockChangeType === 'add'
                            ? (theme === 'dark' ? "bg-cyan-400 text-black hover:scale-[1.02]" : "bg-[#062A95] text-white hover:scale-[1.02]")
                            : "bg-red-600 text-white hover:bg-red-700 hover:scale-[1.02]"
                        )}
                      >
                        {massStockChangeType === 'add' ? 'Add' : 'Remove'} Stock for {selectedProductIds.length} Products
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab Content: Delete Operation */}
                {massEditTab === 'delete' && (
                  <div className={cn(
                    "mass-actions-popup-card__content p-4 rounded-xl border border-red-500/30 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    theme === 'dark' ? "bg-red-950/20" : "bg-red-50/50"
                  )}>
                    <div className="flex items-center gap-2 text-red-500">
                      <Trash2 size={15} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Danger Zone</span>
                    </div>
                    <p className="text-[10px] opacity-75 font-semibold uppercase tracking-wider leading-relaxed">
                      This will permanently delete the {selectedProductIds.length} selected asset(s). This operation is completely irreversible and cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowMassDeleteConfirm(true)}
                      className="w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-md hover:scale-[1.02] active:scale-95"
                    >
                      Permanently Delete {selectedProductIds.length} Assets
                    </button>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className={cn(
                "popup-card__footer mass-actions-popup-card__footer p-4 border-t shrink-0 flex justify-end gap-3",
                theme === 'dark' ? "bg-black/20 border-white/10" : "bg-slate-50 border-slate-200"
              )}>
                <button
                  type="button"
                  onClick={() => setIsMassEditPopupOpen(false)}
                  className={cn(
                    "py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border cursor-pointer active:scale-95",
                    theme === 'dark' 
                      ? "border-white/10 hover:bg-white/5 text-white/85" 
                      : "border-slate-300 hover:bg-black/5 text-black/85"
                  )}
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="w-full max-w-[1600px] mx-auto font-sans">
      {/* BLOCK: Selection Control Bar - Displayed when Multi-Select is enabled */}
      {isMultiSelectEnabled && (
        <div className={cn(
          "selection-controller-card flex flex-col sm:flex-row gap-3 sm:gap-4 w-full items-center justify-between mb-6 py-2 sm:py-2.5 px-3.5 sm:px-4 rounded-2xl border transition-colors duration-200 animate-in fade-in slide-in-from-top-4 duration-300",
          theme === 'dark' 
            ? "bg-[#041a5c]/90 border-cyan-500/50 shadow-lg shadow-black/40 backdrop-blur-md" 
            : "bg-cyan-50/90 border-cyan-200 shadow-md backdrop-blur-md text-black"
        )}>
          <div className="selection-controller-card__left flex items-center gap-3.5">
            <input 
              type="checkbox"
              id="select-all-products-checkbox"
              className="selection-controller-card__checkbox w-4.5 h-4.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer shrink-0"
              checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id))}
              onChange={() => {
                const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id));
                if (allSelected) {
                  setSelectedProductIds([]);
                } else {
                  setSelectedProductIds(filteredProducts.map(p => p.id));
                }
              }}
            />
            <label htmlFor="select-all-products-checkbox" className={cn(
              "selection-controller-card__count-text text-xs font-black uppercase tracking-widest cursor-pointer select-none",
              theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
            )}>
              Select All ({selectedProductIds.length} of {filteredProducts.length} selected)
            </label>
          </div>
          
          <div className="selection-controller-card__right flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                if (selectedProductIds.length === 0) return;
                setIsMassEditPopupOpen(true);
              }}
              disabled={selectedProductIds.length === 0}
              className={cn(
                "selection-controller-card__edit-button py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 border-2",
                selectedProductIds.length === 0
                  ? "opacity-40 cursor-not-allowed bg-transparent border-gray-300 text-gray-400"
                  : theme === 'dark'
                    ? "bg-cyan-400 border-cyan-400 text-black shadow-md hover:scale-105"
                    : "bg-[#062A95] border-[#062A95] text-white shadow-md hover:scale-105"
              )}
            >
              <CheckSquare size={13} /> Edit ({selectedProductIds.length})
            </button>
            <button
              onClick={() => {
                setSelectedProductIds([]);
                setIsMultiSelectEnabled(false);
              }}
              className={cn(
                "selection-controller-card__cancel-button py-2.5 sm:py-3 px-3.5 sm:px-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 border",
                theme === 'dark'
                  ? "border-white/10 hover:bg-white/5 text-white/70"
                  : "border-slate-300 hover:bg-black/5 text-black/70"
              )}
            >
              Cancel
            </button>
          </div>
        </div>
      )}



      {/* Filter Menu */}
      <AnimatePresence>
        {isFilterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className={cn(
              "p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
              theme === 'dark' ? "bg-black/30 border-dark-border" : "bg-gray-50 border-light-border shadow-inner"
            )}>
              {/* Category Filter */}
              {module === 'inventory' && activeTab === 'products' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                    Filter by Category
                  </label>
                  <select 
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                      theme === 'dark' 
                        ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                        : "bg-white border-light-border text-black focus:border-black"
                    )}
                  >
                    <option value="all">ALL ASSETS / CATEGORIES</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id || cat.name.toLowerCase()}>
                        {cat.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stock Level Filter */}
              {module === 'inventory' && activeTab === 'products' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                    Stock Status
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
              )}

              {/* Sort By */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                  Ordered By
                </label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                    theme === 'dark' 
                      ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                      : "bg-white border-light-border text-black focus:border-black"
                  )}
                >
                  <option value="latest">LATEST / RECENT</option>
                  <option value="name">DESIGNATION</option>
                  <option value="price">PRICE</option>
                  <option value="stock">QUANTITY</option>
                  <option value="category">CATEGORY</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-presale font-bold tracking-wide opacity-80">
                  Sequence
                </label>
                <select 
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-xs font-presale font-bold tracking-wide outline-none transition-all h-[38px] cursor-pointer",
                    theme === 'dark' 
                      ? "bg-[#1E1E24] border-dark-border text-white focus:border-brand-primary" 
                      : "bg-white border-light-border text-black focus:border-black"
                  )}
                >
                  <option value="asc">ASCENDING</option>
                  <option value="desc">DESCENDING</option>
                </select>
              </div>

              {/* Reset Filters */}
              <div className={cn(
                "flex flex-col gap-1.5",
                (module === 'inventory' && activeTab === 'products') ? "sm:col-span-2 lg:col-span-4" : "sm:col-span-1 lg:col-span-3"
              )}>
                <label className="text-xs font-presale font-bold tracking-wide opacity-0 hidden sm:block">
                  Reset
                </label>
                <button
                  onClick={() => {
                    setStockFilter('all');
                    setSortBy('latest');
                    setSortOrder('asc');
                    setActiveCategory('all');
                  }}
                  className={cn(
                    "w-full rounded-lg text-xs font-presale font-bold tracking-wide transition-all border flex items-center justify-center gap-2 cursor-pointer h-[38px]",
                    theme === 'dark' 
                      ? "border-dark-border bg-black/20 text-dark-muted hover:text-white" 
                      : "border-light-border bg-white text-light-muted hover:text-black"
                  )}
                >
                  <RefreshCw size={12} />
                  Reset Parameters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Alerts (Only for Products and if empty) */}
      {activeTab === 'products' && products.length === 0 && !loading && (
        <div className="grid grid-cols-1 gap-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          <button 
            onClick={seedData}
            className={cn(
              "flex items-center gap-6 p-6 border rounded-lg transition-all hover:shadow-hard group",
              theme === 'dark' ? "bg-dark-surface border-dark-border" : "bg-white border-light-border"
            )}
          >
            <div className="w-14 h-14 flex items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
              <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-700" />
            </div>
            <div className="text-left">
              <p className="font-black text-xs uppercase tracking-widest leading-none mb-2">Initialize Store</p>
              <p className="text-[10px] opacity-60 font-medium">Auto-generate sample assets</p>
            </div>
          </button>
        </div>
      )}

      {/* Main Table Content */}
      <div className="flex-1 flex flex-col mb-8">
        <div className="flex-1">
          {loading && isFirstLoadOfSession && module === 'inventory' ? (
             <div className="p-20 flex justify-center"><RefreshCw className="animate-spin text-brand-primary" /></div>
          ) : (
            <div>
              {module === 'inventory' && activeTab === 'products' && (
                <motion.div
                  key="products-list-motion"
                  initial={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  animate={isFirstLoadOfSession ? { opacity: 1 } : undefined}
                  exit={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  className="space-y-6 font-presale presale-stream-container holdings-container"
                >
                  {filteredProducts.length === 0 ? (
                    desktopLayout === 'table' ? (
                      <div className={cn(
                        "w-full rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 presale-stream-table holdings-table",
                        theme === "dark"
                          ? "bg-dark-surface border-white/20"
                          : "bg-white border-slate-300",
                      )}>
                        {/* BLOCK: Empty Product Table View - Displays complete table header with centered empty state row */}
                        <div className="w-full overflow-x-auto no-scrollbar">
                          <table className="w-full border-collapse min-w-[750px] text-left">
                            <thead className="sticky top-0 z-20 shadow-xs">
                              <tr className={cn(
                                "text-left border-b transition-colors duration-200",
                                theme === "dark"
                                  ? "bg-[#0c1836] border-white/20"
                                  : "bg-slate-100 border-slate-300",
                              )}>
                                {isMultiSelectEnabled && (
                                  <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                                    <input type="checkbox" disabled className="w-4.5 h-4.5 rounded border-gray-300" />
                                  </th>
                                )}
                                <th className={cn(isMultiSelectEnabled ? "px-3 lg:px-6 py-4" : "pl-6 lg:pl-8 pr-3 lg:pr-6 py-4", "text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Line</th>
                                {productLayout !== 'list-text' && <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Pic</th>}
                                <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Barcode</th>
                                <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Product Name</th>
                                <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Stock</th>
                                <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Cost</th>
                                <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Price</th>
                                <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="empty-catalog-table__row border-0">
                                <td colSpan={isMultiSelectEnabled ? (productLayout !== 'list-text' ? 9 : 8) : (productLayout !== 'list-text' ? 8 : 7)} className="empty-catalog-table__cell py-16 text-center">
                                  <div className="empty-catalog-table__container flex flex-col items-center justify-center text-center gap-2">
                                    <Package size={54} strokeWidth={1.5} className={cn("empty-catalog-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                                    <p className={cn("empty-catalog-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Assets Identified</p>
                                    <p className={cn("empty-catalog-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Adjust filtration parameters or add products</p>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 p-1">
                        {/* BLOCK: Empty Product Cards View - Framed card container displaying asset icon and status text */}
                        <div className={cn(
                          "empty-catalog-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                          theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                        )}>
                          <Package size={54} strokeWidth={1.5} className={cn("empty-catalog-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("empty-catalog-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Assets Identified</p>
                          <p className={cn("empty-catalog-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Adjust filtration parameters or add products</p>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      {/* Product Card Grid: Always visible on mobile (< md), and on desktop (>= md) if desktopLayout === 'card' */}
                      <div className={cn(
                        "grid grid-cols-1 sm:grid-cols-2 gap-4 p-1 transition-all duration-300 ease-in-out",
                        desktopLayout === 'card' 
                          ? "md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" 
                          : "md:hidden"
                      )}>
                        {paginatedProducts.map((product, index) => {
                          const threshold = lowStockEnabled ? lowStockThreshold : 10;
                          const isLowStock = product.stockLevel < threshold;
                          const isChecked = selectedProductIds.includes(product.id);
                          const isSelected = selectedProductId === product.id || editingProduct?.id === product.id || viewingProductDetails?.id === product.id;

                          // BLOCK: Holdings Card Item - Displays product card with selection and edit mode support
                          return (
                            <div 
                              key={product.id} 
                              onClick={() => {
                                if (isMultiSelectEnabled) {
                                  if (isChecked) {
                                    setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                  } else {
                                    setSelectedProductIds([...selectedProductIds, product.id]);
                                  }
                                } else if (isEditModeEnabled) {
                                  openEditModal(product);
                                } else {
                                  setSelectedProductId(selectedProductId === product.id ? null : product.id);
                                }
                              }}
                              onDoubleClick={() => {
                                if (isMultiSelectEnabled) {
                                  // Toggle already handled on click
                                } else if (isEditModeEnabled) {
                                  openEditModal(product);
                                } else {
                                  setViewingProductDetails(product);
                                }
                              }}
                              className={cn(
                                "holdings-card p-4 sm:p-5 rounded-2xl border flex items-center justify-between group transition-all duration-300 hover:shadow-lg cursor-pointer relative overflow-hidden font-presale",
                                (isMultiSelectEnabled && isChecked) || isSelected
                                  ? "holdings-card--selected " + (theme === 'dark' ? "bg-cyan-950/40 border-brand-primary text-white shadow-md" : "bg-blue-50/90 border-[#062A95] text-black shadow-md")
                                  : (theme === 'dark' ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black")
                              )}
                            >
                              <div className="holdings-card__content flex flex-col gap-2 min-w-0 flex-1">
                                {/* Top Row: Image on left, two-line product name on right */}
                                <div className="holdings-card__top flex items-start gap-2.5 sm:gap-3 min-w-0">
                                  {isMultiSelectEnabled && (
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (isChecked) {
                                          setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                        } else {
                                          setSelectedProductIds([...selectedProductIds, product.id]);
                                        }
                                      }}
                                      className="w-4.5 h-4.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer shrink-0 mt-1"
                                    />
                                  )}
                                  <div className={cn(
                                    "holdings-card__image-wrapper w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center overflow-hidden border shrink-0 transition-all duration-300 group-hover:scale-105 mt-0.5",
                                    theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-400 shadow-inner"
                                  )}>
                                    {product.imageUrl ? (
                                      <img src={product.imageUrl} alt="" className="holdings-card__image w-full h-full object-cover animate-in fade-in duration-300" referrerPolicy="no-referrer" />
                                    ) : (
                                      <Package size={20} className={theme === 'dark' ? "text-cyan-400" : "text-blue-900"} />
                                    )}
                                  </div>
                                  <div className="holdings-card__info min-w-0 flex-1">
                                    <h4 className={cn(
                                      "holdings-card__title text-xs sm:text-sm font-bold tracking-tight uppercase title-text leading-snug line-clamp-2 transition-colors duration-200 font-presale",
                                      theme === 'dark' ? "text-white group-hover:text-cyan-400" : "text-slate-900 group-hover:text-blue-900"
                                    )}>{product.name}</h4>
                                  </div>
                                </div>

                                {/* Underneath Rows: Barcode on line 1, Qty & Price on line 2 under barcode */}
                                <div className="holdings-card__meta flex flex-col gap-1 min-w-0 pt-1.5 border-t border-dashed border-slate-300 dark:border-white/10">
                                  <p className={cn(
                                    "holdings-card__barcode text-[10px] sm:text-[11px] font-presale font-medium tracking-wide truncate min-w-0",
                                    theme === 'dark' ? "text-slate-300" : "text-slate-600"
                                  )}>
                                    BARCODE: {product.barcode || product.sku || product.id.slice(-6).toUpperCase()}
                                  </p>
                                  <div className="holdings-card__stats flex items-center justify-between gap-2 font-presale text-[10px] sm:text-[11px]">
                                    <div className="flex items-center gap-1">
                                      <span className={cn(
                                        "w-1.5 h-1.5 rounded-full shrink-0 animate-pulse",
                                        product.stockLevel <= 0 ? "bg-neutral-500" : isLowStock ? "bg-red-500" : "bg-emerald-500"
                                      )} />
                                      <span className={cn(
                                        "holdings-card__qty font-semibold uppercase tracking-wider",
                                        product.stockLevel <= 0 ? "text-neutral-500" : isLowStock ? "text-red-500" : (theme === 'dark' ? "text-slate-200" : "text-slate-800")
                                      )}>
                                        QTY: <span className="font-extrabold font-presale">{product.stockLevel}</span>
                                      </span>
                                    </div>
                                    <span className={cn(
                                      "holdings-card__price font-bold tracking-wider font-presale",
                                      theme === 'dark' ? "text-cyan-400" : "text-blue-900"
                                    )}>
                                      {formatCurrency(product.price, currency)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {isEditModeEnabled && (
                                <div className="p-1 -mr-1 text-brand-primary shrink-0">
                                  <Edit2 size={16} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop View: Table Layout when desktopLayout === 'table' */}
                      {desktopLayout === 'table' && (
                        <div className={cn(
                          "hidden md:block w-full rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ease-in-out presale-stream-table holdings-table",
                          theme === "dark"
                            ? "bg-dark-surface border-white/20"
                            : "bg-white border-slate-300",
                        )}>
                          <div className="w-full overflow-x-auto no-scrollbar transition-all duration-300 ease-in-out">
                            <table className="w-full border-collapse min-w-[750px] text-left transition-all duration-300 ease-in-out">
                              <thead className="sticky top-0 z-20 shadow-xs">
                                <tr className={cn(
                                  "text-left border-b transition-colors duration-200",
                                  theme === "dark"
                                    ? "bg-[#0c1836] border-white/20"
                                    : "bg-slate-100 border-slate-300",
                                )}>
                                  {isMultiSelectEnabled && (
                                    <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                                      <input 
                                        type="checkbox"
                                        checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id))}
                                        onChange={() => {
                                          const allSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id));
                                          if (allSelected) {
                                            setSelectedProductIds([]);
                                          } else {
                                            setSelectedProductIds(filteredProducts.map(p => p.id));
                                          }
                                        }}
                                        className="w-4.5 h-4.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                      />
                                    </th>
                                  )}
                                  <th className={cn(isMultiSelectEnabled ? "px-3 lg:px-6 py-4" : "pl-6 lg:pl-8 pr-3 lg:pr-6 py-4", "text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Line</th>
                                  {productLayout !== 'list-text' && <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Pic</th>}
                                  <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Barcode</th>
                                  <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Product Name</th>
                                  <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Stock</th>
                                  <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Cost</th>
                                  <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Price</th>
                                  <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedProducts.map((product, index) => {
                                  const threshold = lowStockEnabled ? lowStockThreshold : 10;
                                  const isLowStock = product.stockLevel < threshold;
                                  const costPrice = product.costPrice || (product.price * 0.7);
                                  const isSelected = selectedProductId === product.id || editingProduct?.id === product.id || viewingProductDetails?.id === product.id;
                                  const isChecked = selectedProductIds.includes(product.id);

                                  // BLOCK: Holdings Products Table Row - Displays product data row with selection and hover colors
                                  return (
                                    <tr 
                                      key={product.id}
                                      onClick={() => {
                                        if (isMultiSelectEnabled) {
                                          if (isChecked) {
                                            setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                          } else {
                                            setSelectedProductIds([...selectedProductIds, product.id]);
                                          }
                                        } else if (isEditModeEnabled) {
                                          openEditModal(product);
                                        } else {
                                          setSelectedProductId(selectedProductId === product.id ? null : product.id);
                                        }
                                      }}
                                      onDoubleClick={() => {
                                        if (isMultiSelectEnabled) {
                                          // Toggle already handled on click
                                        } else if (isEditModeEnabled) {
                                          openEditModal(product);
                                        } else {
                                          setViewingProductDetails(product);
                                        }
                                      }}
                                      className={cn(
                                        "holdings-table__row border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                                        isSelected ? "holdings-table__row--selected" : "",
                                        theme === "dark"
                                          ? (isMultiSelectEnabled && isChecked)
                                            ? "bg-cyan-950/40 hover:bg-cyan-950/60 border-cyan-400 text-white"
                                            : isSelected
                                              ? "bg-brand-primary/20 hover:bg-brand-primary/25 border-brand-primary/60 text-white font-semibold"
                                              : "border-white/10 hover:bg-white/5 text-slate-100"
                                          : (isMultiSelectEnabled && isChecked)
                                            ? "bg-cyan-50 hover:bg-cyan-100/80 border-[#062A95]"
                                            : isSelected
                                              ? "bg-blue-50 hover:bg-blue-100/80 border-blue-300 text-slate-900 font-semibold"
                                              : "border-slate-200 hover:bg-slate-50 text-slate-900",
                                      )}
                                    >
                                      {/* Checkbox Column */}
                                      {isMultiSelectEnabled && (
                                        <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5">
                                          <input 
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              if (isChecked) {
                                                setSelectedProductIds(selectedProductIds.filter(id => id !== product.id));
                                              } else {
                                                setSelectedProductIds([...selectedProductIds, product.id]);
                                              }
                                            }}
                                            className="w-4.5 h-4.5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                          />
                                        </td>
                                      )}
                                      {/* Line Number */}
                                      <td className={cn(
                                        isMultiSelectEnabled ? "px-3 lg:px-6 py-3.5" : "pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5",
                                        "whitespace-nowrap"
                                      )}>
                                        <span className={cn("font-presale text-xs font-bold px-2 py-1 rounded-md tracking-wide", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                                          {((currentPage - 1) * itemsPerPage + index + 1).toString().padStart(2, '0')}
                                        </span>
                                      </td>

                                      {/* Pic column */}
                                      {productLayout !== 'list-text' && (
                                        <td className="px-3 lg:px-6 py-2.5 text-left whitespace-nowrap">
                                          <div className="flex justify-start">
                                            <div className={cn(
                                              "rounded-lg overflow-hidden border shrink-0 w-10 h-10 flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm",
                                              theme === 'dark' ? "bg-black border-white/20" : "bg-light-bg border-slate-300 shadow-inner"
                                            )}>
                                              {product.imageUrl ? (
                                                <img src={product.imageUrl} alt="" className="w-full h-full object-cover animate-in fade-in duration-300" referrerPolicy="no-referrer" />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 dark:from-[#0d0d0d] dark:to-[#1a1a1a] text-dark-muted">
                                                  <Package size={16} className={theme === 'dark' ? "text-cyan-400" : "text-blue-900"} />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                      )}

                                      {/* Code */}
                                      <td className={cn(
                                        "px-3 lg:px-6 py-3.5 font-presale text-xs font-semibold whitespace-nowrap tracking-wide",
                                        theme === 'dark' ? "text-white" : "text-slate-900"
                                      )}>
                                        {product.barcode || product.sku || product.id.slice(-6).toUpperCase()}
                                      </td>

                                      {/* Product Name */}
                                      <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                                        <div className="min-w-0 flex items-center gap-2">
                                          <h4 className={cn(
                                            "font-semibold tracking-tight text-xs truncate group-hover:text-brand-primary transition-colors duration-200 line-clamp-1 flex-1 min-w-0 font-presale",
                                            theme === 'dark' ? "text-white" : "text-slate-900"
                                          )}>{limitLetters(product.name, 60)}</h4>
                                        </div>
                                      </td>

                                      {/* Stock Level with indicator */}
                                      <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                                        <div className="flex justify-start items-center gap-2">
                                          <span className={cn(
                                            "w-1.5 h-1.5 rounded-full shrink-0 group-hover:scale-125 transition-all duration-200 animate-pulse",
                                            isLowStock ? "bg-red-500" : "bg-emerald-500"
                                          )} />
                                          <span className={cn(
                                            "font-presale text-xs font-semibold uppercase tracking-wider",
                                            isLowStock ? "text-red-500" : (theme === 'dark' ? "text-slate-200" : "text-slate-800")
                                          )}>
                                            {product.stockLevel}
                                          </span>
                                        </div>
                                      </td>

                                      {/* Cost Price */}
                                      <td className={cn(
                                        "px-3 lg:px-6 py-3.5 text-left font-presale text-xs font-semibold whitespace-nowrap",
                                        theme === 'dark' ? "text-slate-300" : "text-slate-700"
                                      )}>
                                        {(role === 'Manager' || user?.email === 'admin@megapos.pos') ? formatCurrency(costPrice, currency) : '—'}
                                      </td>

                                      {/* Retail Price */}
                                      <td className={cn(
                                        "px-3 lg:px-6 py-3.5 text-left font-presale text-xs font-bold whitespace-nowrap",
                                        theme === 'dark' ? "text-cyan-400 dark:text-cyan-300" : "text-blue-900"
                                      )}>
                                        {formatCurrency(product.price, currency)}
                                      </td>

                                      {/* Action button */}
                                      <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isEditModeEnabled) {
                                                openEditModal(product);
                                              } else {
                                                setViewingProductDetails(product);
                                              }
                                            }}
                                            className={cn(
                                              "w-8 h-8 rounded-xl border flex items-center justify-center shadow-xs transition-all duration-200 hover:scale-105 shrink-0 cursor-pointer",
                                              theme === 'dark' 
                                                ? "bg-black/40 border-white/20 text-cyan-400 hover:bg-cyan-500/20" 
                                                : "bg-white border-slate-300 text-blue-900 hover:bg-slate-100"
                                            )}
                                            title={isEditModeEnabled ? "Modify Asset" : "View Details"}
                                          >
                                            {isEditModeEnabled ? (
                                              <Edit2 size={14} className={theme === 'dark' ? "text-cyan-400" : "text-blue-900"} />
                                            ) : (
                                              <Search size={14} className={theme === 'dark' ? "text-cyan-400" : "text-blue-900"} />
                                            )}
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
                    </>
                  )}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-8 pb-4 px-2 border-t border-dashed border-[#888]/20 mt-8">
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
                </motion.div>
              )}

              {module === 'inventory' && activeTab === 'categories' && (
                <motion.div
                  key="categories-list"
                  initial={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  animate={isFirstLoadOfSession ? { opacity: 1 } : undefined}
                  exit={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  className="space-y-6 font-presale presale-stream-container"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
                    {filteredCategories.length === 0 ? (
                      /* BLOCK: Empty Categories Card - Displays zero category segments card */
                      <div className={cn(
                        "categories-empty-card col-span-full p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                        theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                      )}>
                        <Tags size={54} strokeWidth={1.5} className={cn("categories-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                        <p className={cn("categories-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Segments Identified</p>
                        <p className={cn("categories-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add or adjust catalog categories</p>
                      </div>
                    ) : (
                      filteredCategories.map(cat => (
                        <div 
                          key={cat.id} 
                          onClick={() => setSelectedCategoryInfo(cat)}
                          className={cn(
                            "presale-stream-card border p-5 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:shadow-md cursor-pointer border-l-4 border-l-cyan-500 font-presale",
                            theme === 'dark' 
                              ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                              : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 shadow-xs",
                              theme === 'dark' ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                            )}>
                              <Tags size={22} />
                            </div>
                            <div className="min-w-0">
                               <p className="text-xs font-bold uppercase tracking-wide title-text truncate">{cat.name}</p>
                               <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{cat.itemCount} ACTIVE SKUS</p>
                            </div>
                          </div>
                          <button className="p-2 text-slate-400 hover:text-cyan-400 transition-colors shrink-0"><ChevronRight size={18} /></button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {module === 'inventory' && activeTab === 'suppliers' && (
                <motion.div
                  key="suppliers-list"
                  initial={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  animate={isFirstLoadOfSession ? { opacity: 1 } : undefined}
                  exit={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  className="space-y-6 font-presale presale-stream-container"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
                    {filteredSuppliers.length === 0 ? (
                      /* BLOCK: Empty Suppliers Card - Displays zero vendors card */
                      <div className={cn(
                        "suppliers-empty-card col-span-full p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                        theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                      )}>
                        <Truck size={54} strokeWidth={1.5} className={cn("suppliers-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                        <p className={cn("suppliers-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Vendors Identified</p>
                        <p className={cn("suppliers-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Register new supply chain vendors</p>
                      </div>
                    ) : (
                      filteredSuppliers.map(sup => (
                        <div 
                          key={sup.id} 
                          onClick={() => setSelectedSupplierInfo(sup)}
                          className={cn(
                            "presale-stream-card border p-5 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:shadow-md cursor-pointer border-l-4 border-l-cyan-500 font-presale",
                            theme === 'dark' 
                              ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                              : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 shadow-xs",
                              theme === 'dark' ? "bg-purple-500/10 text-purple-300 border border-purple-500/20" : "bg-purple-50 text-purple-900 border border-purple-200"
                            )}>
                              <Truck size={22} />
                            </div>
                            <div className="min-w-0">
                               <p className="text-xs font-bold uppercase tracking-wide title-text truncate">{sup.name}</p>
                               <p className={cn("text-[10px] font-mono mt-1 opacity-70 truncate", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                 {hidePersonalInfo && sup.contact.includes('@') ? maskEmail(sup.contact) : sup.contact} • {sup.category}
                               </p>
                            </div>
                          </div>
                          <button className="p-2 text-slate-400 hover:text-cyan-400 transition-colors shrink-0"><ChevronRight size={18} /></button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {module === 'inventory' && activeTab === 'customers' && (
                <motion.div
                  key="customers-list"
                  initial={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  animate={isFirstLoadOfSession ? { opacity: 1 } : undefined}
                  exit={isFirstLoadOfSession ? { opacity: 0 } : undefined}
                  className="space-y-6 font-presale presale-stream-container"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
                    {filteredCustomers.length === 0 ? (
                      /* BLOCK: Empty Clientele Card - Displays zero profiled customers card */
                      <div className={cn(
                        "customers-empty-card col-span-full p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                        theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                      )}>
                        <Users size={54} strokeWidth={1.5} className={cn("customers-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                        <p className={cn("customers-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Clientele Profiled</p>
                        <p className={cn("customers-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>Add customer profiles to catalog</p>
                      </div>
                    ) : (
                      filteredCustomers.map(cust => {
                        const displayId = cust.customerId || ('CUST-' + (cust.id ? cust.id.slice(-6).toUpperCase() : 'UNKNOWN'));
                        return (
                          <div 
                            key={cust.id} 
                            onClick={() => setSelectedCustomerInfo(cust)}
                            className={cn(
                              "presale-stream-card border p-5 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:shadow-md cursor-pointer border-l-4 border-l-cyan-500 font-presale",
                              theme === 'dark' 
                                ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                                : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                            )}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className={cn(
                                "w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-inner border",
                                theme === 'dark' ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" : "bg-blue-50 text-blue-900 border-blue-200"
                              )}>
                                {cust.name ? cust.name[0].toUpperCase() : 'C'}
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="text-xs font-bold uppercase tracking-wide title-text truncate">{cust.name}</p>
                                 <span className="text-[9px] font-mono font-bold text-cyan-400 dark:text-cyan-300 tracking-wider uppercase bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 inline-block mt-0.5">
                                   {displayId}
                                 </span>
                                 <p className={cn("text-[10px] font-mono mt-1 opacity-70 truncate", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{hidePersonalInfo ? maskEmail(cust.email) : cust.email}</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-row items-center gap-4 shrink-0 pl-2">
                              <div className="flex flex-col items-end">
                                <p className={cn(
                                  "text-xs font-mono font-bold",
                                  theme === 'dark' ? "text-white" : "text-slate-900"
                                )}>{formatCurrency(cust.totalSpent, currency)}</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider opacity-60 mt-0.5">LTV</p>
                              </div>
                              <div className="flex flex-col items-end border-l border-slate-300 dark:border-white/10 pl-3">
                                <p className="text-xs font-mono font-bold text-cyan-400 dark:text-cyan-300">
                                  {formatCurrency(cust.accountBalance || 0, currency)}
                                </p>
                                <p className="text-[9px] font-bold uppercase tracking-wider opacity-60 mt-0.5">Balance</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* VAULT MODULE */}
              {module === 'vault' && (
                <motion.div
                  key="vault-module"
                  initial={isFirstLoadOfSession ? { opacity: 0, x: 20 } : undefined}
                  animate={isFirstLoadOfSession ? { opacity: 1, x: 0 } : undefined}
                  exit={isFirstLoadOfSession ? { opacity: 0, x: -20 } : undefined}
                  className="space-y-6 font-presale presale-stream-container"
                >
                  {activeVaultTab === 'cash_inflow' ? (
                    <div className="space-y-6">
                       <div className="flex items-center justify-between mb-2 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <h3 className="text-xs font-bold uppercase tracking-wider opacity-80 font-presale">Cash Inflow Ledger</h3>
                        </div>
                        <p className="text-[10px] font-bold opacity-70 font-mono">{revenue.length} ENTRIES</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {revenue.length === 0 ? (
                           /* BLOCK: Empty Cash Inflow Card - Displays zero cash inflow transactions card */
                           <div className={cn(
                             "inflow-empty-card col-span-full p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                             theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                           )}>
                             <BarChart3 size={54} strokeWidth={1.5} className={cn("inflow-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                             <p className={cn("inflow-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Inflow Records Identified</p>
                             <p className={cn("inflow-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>No cash inflow transactions logged</p>
                           </div>
                         ) : (
                           revenue.map(rev => (
                             <div key={rev.id} className={cn(
                                "presale-stream-card border p-5 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:shadow-md border-l-4 border-l-emerald-500 font-presale",
                                theme === 'dark' 
                                  ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                                  : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                              )}>
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 shadow-xs",
                                    theme === 'dark' ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                                  )}>
                                    <BarChart3 size={22} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold uppercase tracking-wide title-text mb-0.5">{rev.source}</p>
                                     <p className={cn("text-[10px] font-mono opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{rev.category} • {rev.id.slice(-6).toUpperCase()}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-base font-bold font-mono tracking-tight text-emerald-500 dark:text-emerald-400">+{formatCurrency(rev.amount, currency)}</p>
                                  <p className={cn("text-[10px] font-mono opacity-70 mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{new Date(rev.date).toLocaleDateString()}</p>
                                </div>
                              </div>
                           ))
                         )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                       <div className="flex items-center justify-between mb-2 px-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <h3 className="text-xs font-bold uppercase tracking-wider opacity-80 font-presale">Expenditure Ledger</h3>
                        </div>
                        <p className="text-[10px] font-bold opacity-70 font-mono">{expenditures.length} ENTRIES</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {expenditures.length === 0 ? (
                           /* BLOCK: Empty Expenditure Card - Displays zero expenditure records status card */
                           <div className={cn(
                             "expenditure-empty-card col-span-full p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                             theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                           )}>
                             <AlertCircle size={54} strokeWidth={1.5} className={cn("expenditure-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                             <p className={cn("expenditure-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Expenditure Records Identified</p>
                             <p className={cn("expenditure-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>No operating expenses recorded</p>
                           </div>
                         ) : (
                           expenditures.map(exp => (
                             <div key={exp.id} className={cn(
                                "presale-stream-card border p-5 rounded-2xl flex items-center justify-between group transition-all duration-300 hover:shadow-md border-l-4 border-l-red-500 font-presale",
                                theme === 'dark' 
                                  ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white" 
                                  : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black"
                              )}>
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 shadow-xs",
                                    theme === 'dark' ? "bg-red-500/15 text-red-300 border border-red-500/30" : "bg-red-50 text-red-900 border border-red-200"
                                  )}>
                                    <AlertCircle size={22} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold uppercase tracking-wide title-text mb-0.5">{exp.description}</p>
                                     <p className={cn("text-[10px] font-mono opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{exp.category} • {exp.id.slice(-6).toUpperCase()}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-base font-bold font-mono tracking-tight text-red-500 dark:text-red-400">-{formatCurrency(exp.amount, currency)}</p>
                                  <p className={cn("text-[10px] font-mono opacity-70 mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{new Date(exp.date).toLocaleDateString()}</p>
                                </div>
                              </div>
                           ))
                         )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* BALANCES MODULE */}
              {module === 'balances' && (
                <motion.div
                  key="balances-module"
                  initial={isFirstLoadOfSession ? { opacity: 0, y: 20 } : undefined}
                  animate={isFirstLoadOfSession ? { opacity: 1, y: 0 } : undefined}
                  exit={isFirstLoadOfSession ? { opacity: 0, y: -20 } : undefined}
                  className="space-y-6 font-presale presale-stream-container"
                >
                    {/* BLOCK: Ledger Balance Metrics Grid - Displays store balance, cumulative spend, customer escrow, and shareholder equity portfolios */}
                    <div className="balance-metrics-grid dashboard-metrics-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8 w-full">
                       {[
                         { 
                           id: 'store', 
                           label: 'STORE BALANCE', 
                           amount: formatCurrency(revenue.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 42850.20, currency), 
                           trend: '+12.4%', 
                           sub: 'Net Liquidity',
                           icon: DollarSign,
                           iconDark: 'bg-emerald-500/10 text-emerald-400',
                           iconLight: 'bg-emerald-50 text-emerald-600',
                           trendColor: 'text-emerald-500 dark:text-emerald-400',
                           trendIcon: TrendingUp
                         },
                         { 
                           id: 'expenditure', 
                           label: 'CUMULATIVE SPEND', 
                           amount: formatCurrency(expenditures.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 12400.00, currency), 
                           trend: '-2.1%', 
                           sub: 'Cycle Spend',
                           icon: CreditCard,
                           iconDark: 'bg-rose-500/10 text-rose-400',
                           iconLight: 'bg-rose-50 text-rose-600',
                           trendColor: 'text-rose-500 dark:text-rose-400',
                           trendIcon: TrendingDown
                         },
                         { 
                           id: 'customer', 
                           label: 'CUSTOMER ESCROW', 
                           amount: formatCurrency(balanceAdjustments.filter(adj => adj.type === 'customer_balance').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 8140.00, currency), 
                           trend: '+0.8%', 
                           sub: 'Deposit Holdings',
                           icon: Users,
                           iconDark: 'bg-cyan-500/10 text-cyan-400',
                           iconLight: 'bg-cyan-50 text-cyan-600',
                           trendColor: 'text-cyan-400 dark:text-cyan-300',
                           trendIcon: TrendingUp
                         },
                         { 
                           id: 'shareholder', 
                           label: 'SHAREHOLDER EQUITY', 
                           amount: formatCurrency(balanceAdjustments.filter(adj => adj.type === 'shareholder_balance').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 125000.00, currency), 
                           trend: 'Static', 
                           sub: 'Valuation Basis',
                           icon: BarChart3,
                           iconDark: 'bg-purple-500/10 text-purple-400',
                           iconLight: 'bg-purple-50 text-purple-600',
                           trendColor: 'text-purple-400 dark:text-purple-300',
                           trendIcon: Activity
                         },
                       ].map((bal) => {
                         const IconComponent = bal.icon;
                         const TrendIconComponent = bal.trendIcon;
                         const isSelected = activeBalanceTab === bal.id;

                         return (
                           /* BLOCK: Balance Metric Card - Interactive card matching logged-in dashboard telemetry style */
                           <button 
                             key={bal.id} 
                             type="button"
                             onClick={() => setActiveBalanceTab(bal.id as any)}
                             className={cn(
                               "balance-metric-card dashboard-metrics-card border p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 cursor-pointer group text-left relative overflow-hidden select-none",
                               isSelected
                                 ? (theme === 'dark' 
                                     ? "balance-metric-card--active border-brand-primary bg-cyan-950/40 text-white shadow-lg shadow-cyan-500/10" 
                                     : "balance-metric-card--active border-[#062A95] bg-blue-50/90 text-slate-900 shadow-md shadow-blue-900/10")
                                 : (theme === 'dark' 
                                     ? "dashboard-metrics-card--dark bg-dark-surface/90 border-[#123ebd]/40 text-white hover:border-brand-primary/80" 
                                     : "dashboard-metrics-card--light bg-white border-slate-200 text-slate-900 hover:border-slate-400")
                             )}
                           >
                             {/* Icon Container */}
                             <div className={cn(
                               "balance-metric-card__icon-container dashboard-metrics-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                               theme === 'dark' ? bal.iconDark : bal.iconLight
                             )}>
                               <IconComponent size={22} className="balance-metric-card__icon dashboard-metrics-card__icon" />
                             </div>

                             {/* Content */}
                             <div className="balance-metric-card__content dashboard-metrics-card__content min-w-0 flex-1 text-left">
                               <span className="balance-metric-card__label dashboard-metrics-card__label text-[9px] font-black uppercase tracking-[0.2em] block opacity-70">
                                 {bal.label}
                               </span>
                               <p className="balance-metric-card__value dashboard-metrics-card__value text-2xl font-black font-mono tracking-tight mt-0.5 truncate">
                                 {bal.amount}
                               </p>
                               <p className="balance-metric-card__trend dashboard-metrics-card__trend text-[9px] font-mono font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5 truncate">
                                 <TrendIconComponent size={11} className={cn("balance-metric-card__trend-icon dashboard-metrics-card__trend-icon shrink-0", bal.trendColor)} />
                                 <span className={bal.trendColor}>{bal.trend}</span>
                                 <span className="opacity-60 truncate">· {bal.sub}</span>
                               </p>
                             </div>
                           </button>
                         );
                       })}
                    </div>

                  <div className="space-y-6">
                    <h3 className="text-base font-extrabold uppercase tracking-tight font-presale pl-3 border-l-4 border-cyan-500">
                      Ledger Activity: {activeBalanceTab.charAt(0).toUpperCase() + activeBalanceTab.slice(1)} Portfolio
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeBalanceTab === 'expenditure' ? (
                        expenditures.map(exp => (
                          /* BLOCK: Expenditure Activity Card */
                          <div key={exp.id} className={cn(
                            "balance-activity-card presale-stream-card border p-4 rounded-2xl flex items-center justify-between group transition-all duration-300 shadow-xs hover:shadow-sm border-l-4 border-l-rose-500 font-presale",
                            theme === 'dark' ? "bg-dark-surface/90 border-white/15 text-white hover:border-rose-500/50" : "bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs"
                          )}>
                            <div className="balance-activity-card__body flex items-center gap-4">
                              <div className="balance-activity-card__icon-box w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                                <AlertCircle size={20} />
                              </div>
                              <div className="balance-activity-card__info min-w-0">
                                 <p className="balance-activity-card__title text-xs font-bold uppercase tracking-wide truncate">{exp.description}</p>
                                 <p className={cn("balance-activity-card__subtitle text-[10px] font-mono opacity-70 mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{exp.id}</p>
                              </div>
                            </div>
                            <div className="balance-activity-card__amount text-right shrink-0">
                              <p className="text-sm font-bold font-mono text-rose-500 dark:text-rose-400">-{formatCurrency(exp.amount, currency)}</p>
                            </div>
                          </div>
                        ))
                      ) : activeBalanceTab === 'store' ? (
                        revenue.map(rev => (
                          /* BLOCK: Store Revenue Activity Card */
                          <div key={rev.id} className={cn(
                            "balance-activity-card presale-stream-card border p-4 rounded-2xl flex items-center justify-between group transition-all duration-300 shadow-xs hover:shadow-sm border-l-4 border-l-emerald-500 font-presale",
                            theme === 'dark' ? "bg-dark-surface/90 border-white/15 text-white hover:border-emerald-500/50" : "bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs"
                          )}>
                            <div className="balance-activity-card__body flex items-center gap-4">
                              <div className="balance-activity-card__icon-box w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                <BarChart3 size={20} />
                              </div>
                              <div className="balance-activity-card__info min-w-0">
                                 <p className="balance-activity-card__title text-xs font-bold uppercase tracking-wide truncate">{rev.source}</p>
                                 <p className={cn("balance-activity-card__subtitle text-[10px] font-mono opacity-70 mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{rev.id}</p>
                              </div>
                            </div>
                            <div className="balance-activity-card__amount text-right shrink-0">
                              <p className="text-sm font-bold font-mono text-emerald-500 dark:text-emerald-400">+{formatCurrency(rev.amount, currency)}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        balanceAdjustments.filter(adj => adj.type === `${activeBalanceTab}_balance`).map(adj => (
                          /* BLOCK: Balance Adjustment Activity Card */
                          <div key={adj.id} className={cn(
                            "balance-activity-card presale-stream-card border p-4 rounded-2xl flex items-center justify-between group transition-all duration-300 shadow-xs hover:shadow-sm border-l-4 border-l-cyan-500 font-presale",
                            theme === 'dark' ? "bg-dark-surface/90 border-white/15 text-white hover:border-cyan-500/50" : "bg-white border-slate-200 text-slate-900 hover:border-slate-300 shadow-xs"
                          )}>
                            <div className="balance-activity-card__body flex items-center gap-4">
                              <div className={cn(
                                "balance-activity-card__icon-box w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                theme === 'dark' ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                              )}>
                                {activeBalanceTab === 'customer' ? <Users size={20} /> : <Landmark size={20} />}
                              </div>
                              <div className="balance-activity-card__info min-w-0">
                                 <p className="balance-activity-card__title text-xs font-bold uppercase tracking-wide truncate">{adj.description}</p>
                                 <p className={cn("balance-activity-card__subtitle text-[10px] font-mono opacity-70 mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{adj.id}</p>
                              </div>
                            </div>
                            <div className="balance-activity-card__amount text-right shrink-0">
                              <p className="text-sm font-bold font-mono text-cyan-400 dark:text-cyan-300">{formatCurrency(adj.amount, currency)}</p>
                              <p className={cn("text-[10px] font-mono opacity-70 mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>{new Date(adj.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))
                      )}

                      {/* Generic Placeholder if empty */}
                      {((activeBalanceTab === 'expenditure' && expenditures.length === 0) || 
                        (activeBalanceTab === 'store' && revenue.length === 0) ||
                        (['customer', 'shareholder'].includes(activeBalanceTab) && balanceAdjustments.filter(adj => adj.type === `${activeBalanceTab}_balance`).length === 0)) && (
                        /* BLOCK: Empty Portfolio Card - Displays zero activity logs for active portfolio */
                        <div className={cn(
                          "portfolio-empty-card col-span-full p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm font-presale",
                          theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                        )}>
                          <Package size={54} strokeWidth={1.5} className={cn("portfolio-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                          <p className={cn("portfolio-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                            No Activity Records Identified
                          </p>
                          <p className={cn("portfolio-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            No active records logged for {activeBalanceTab.toUpperCase()} portfolio
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        {/* BLOCK: Delete Product Confirmation Popup Card */}
        <AnimatePresence>
          {confirmDeleteProductId !== null && (
            <div id="delete-product-popup-card-overlay" className="popup-card-overlay delete-product-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="delete-product-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                className={cn(
                  "popup-card delete-product-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
                  theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="delete-product-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

                <div className="popup-card__header delete-product-popup-card__header flex items-start gap-4">
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
                    className="popup-card__icon delete-product-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                  >
                    <AlertTriangle size={24} />
                  </motion.div>
                  <div className="popup-card__title-group delete-product-popup-card__title-group space-y-1">
                    <h3 className={cn(
                      "popup-card__title delete-product-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Permanently Delete Asset?
                    </h3>
                    <p className="popup-card__subtitle delete-product-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Hard Purge Alert</p>
                  </div>
                </div>

                <div className={cn(
                  "popup-card__body delete-product-popup-card__body text-sm tracking-tight leading-relaxed",
                  theme === 'dark' ? "text-white/85" : "text-black/85"
                )}>
                  You are about to delete <span className="font-extrabold text-red-500">"{editingProduct?.name || 'this product'}"</span> from your catalog. This operation cannot be undone. Are you absolutely sure?
                </div>

                <div className="popup-card__footer delete-product-popup-card__footer flex gap-2 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteProductId(null)}
                    className={cn(
                      "popup-card__button popup-card__button--cancel delete-product-popup-card__button--keep px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
                      theme === 'dark' 
                        ? "bg-transparent border-dark-border text-white/70 hover:bg-white/5 hover:text-white"
                        : "bg-transparent border-light-border text-black/70 hover:bg-black/5 hover:text-black"
                    )}
                  >
                    Keep Asset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDeleteProductId) {
                        deleteProduct(confirmDeleteProductId);
                        setConfirmDeleteProductId(null);
                        setIsEditModalOpen(false);
                        setEditingProduct(null);
                      }
                    }}
                    className="popup-card__button popup-card__button--confirm delete-product-popup-card__button--delete px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md shadow-red-500/10 cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* BLOCK: Mass Delete Confirmation Popup Card */}
        <AnimatePresence>
          {showMassDeleteConfirm && (
            <div id="mass-delete-popup-card-overlay" className="popup-card-overlay mass-delete-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="mass-delete-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                className={cn(
                  "popup-card mass-delete-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
                  theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="mass-delete-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

                <div className="popup-card__header mass-delete-popup-card__header flex items-start gap-4">
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
                    className="popup-card__icon mass-delete-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                  >
                    <AlertTriangle size={24} />
                  </motion.div>
                  <div className="popup-card__title-group mass-delete-popup-card__title-group space-y-1">
                    <h3 className={cn(
                      "popup-card__title mass-delete-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      Batch Delete Assets?
                    </h3>
                    <p className="popup-card__subtitle mass-delete-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Bulk Action Alert</p>
                  </div>
                </div>

                <div className={cn(
                  "popup-card__body mass-delete-popup-card__body text-sm tracking-tight leading-relaxed",
                  theme === 'dark' ? "text-white/85" : "text-black/85"
                )}>
                  Are you absolutely sure you want to permanently delete <span className="font-extrabold text-red-500">{selectedProductIds.length} selected asset(s)</span>? This bulk operation cannot be undone.
                </div>

                <div className="popup-card__footer mass-delete-popup-card__footer flex gap-2 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setShowMassDeleteConfirm(false)}
                    className={cn(
                      "popup-card__button popup-card__button--cancel mass-delete-popup-card__button--cancel px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
                      theme === 'dark' 
                        ? "bg-transparent border-dark-border text-white/70 hover:bg-white/5 hover:text-white"
                        : "bg-transparent border-light-border text-black/70 hover:bg-black/5 hover:text-black"
                    )}
                  >
                    Cancel Action
                  </button>
                  <button
                    type="button"
                    onClick={applyMassDelete}
                    className="popup-card__button popup-card__button--confirm mass-delete-popup-card__button--confirm px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md shadow-red-500/10 cursor-pointer"
                  >
                    Batch Delete ({selectedProductIds.length})
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Product Details Modal on Double Click */}
        <AnimatePresence>
          {viewingProductDetails && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28">
              {/* BLOCK: Product Details Card - Displays comprehensive info about the selected product */}
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="product-details-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card product-details-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-[99999] rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all",
                  theme === "dark"
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

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
                        <Package size={16} />
                      </div>
                    </div>

                    {/* Center Column: Title & Subtitle */}
                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === "dark" ? "text-cyan-400" : "text-[#062A95]",
                      )}>
                        Product Details
                      </h3>
                      <span className={cn(
                        "text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1",
                        theme === "dark" ? "text-white" : ""
                      )}>
                        #{viewingProductDetails.id}
                      </span>
                    </div>

                    {/* Right Column: Close Button */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setViewingProductDetails(null)}
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

                {/* Content */}
                <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col justify-between">
                  <div className="space-y-6 max-h-[80%] overflow-y-auto pr-2">
                    
                    {/* Top layout with image and basic info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Product Image */}
                      <div className="flex justify-center md:col-span-1">
                        <div className="relative">
                          <div className={cn(
                            "w-full aspect-square max-w-[150px] rounded-2xl overflow-hidden border-2 flex items-center justify-center shadow-md",
                            theme === "dark" ? "bg-black/40 border-white/40" : "bg-gray-50 border-light-border"
                          )}>
                            {viewingProductDetails.imageUrl ? (
                              <img src={viewingProductDetails.imageUrl} alt={viewingProductDetails.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={52} className="opacity-30" />
                            )}
                          </div>
                          {viewingProductDetails.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setIsImageExpanded(true)}
                              className={cn(
                                "absolute top-1.5 right-1.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 border shadow-sm cursor-pointer z-10 backdrop-blur-md opacity-80 hover:opacity-100",
                                theme === "dark" 
                                  ? "bg-black/60 border-white/30 text-white hover:bg-black/80" 
                                  : "bg-white/80 border-black/10 text-black hover:bg-white"
                              )}
                              title="Expand Image"
                            >
                              <Maximize2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title and Basic Details */}
                      <div className="md:col-span-2 space-y-3 font-presale">
                        <div>
                          <h2 className="text-lg md:text-xl font-presale font-bold tracking-tight leading-tight">
                            {viewingProductDetails.name}
                          </h2>
                          
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-presale font-bold tracking-wide",
                              theme === "dark" ? "bg-cyan-400/20 text-cyan-300" : "bg-[#062A95]/10 text-[#062A95]"
                            )}>
                              {categories.find(c => c.id === viewingProductDetails.category)?.name || "General Segment"}
                            </span>
                            {viewingProductDetails.barcode && (
                              <span className={cn(
                                "px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wide border",
                                theme === "dark" ? "bg-black/40 border-white/50 text-white" : "bg-gray-50 border-light-border text-black/70"
                              )}>
                                BARCODE: {viewingProductDetails.barcode}
                              </span>
                            )}
                            <span className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wide border",
                              theme === "dark" ? "bg-black/40 border-white/40 text-white/90" : "bg-gray-50 border-light-border text-black/50"
                            )}>
                              SKU: {viewingProductDetails.sku || "N/A"}
                            </span>
                          </div>
                        </div>

                        {viewingProductDetails.description && (
                          <div className={cn(
                            "p-3 rounded-xl border text-xs font-presale font-medium leading-relaxed tracking-wide",
                            theme === "dark" ? "bg-black/20 border-white/30 text-white/90" : "bg-gray-50 border-light-border/40 text-black/70"
                          )}>
                            {viewingProductDetails.description}
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
                          {(role === 'Manager' || user?.email === 'admin@megapos.pos') ? formatCurrency(viewingProductDetails.costPrice || (viewingProductDetails.price * 0.7), currency) : 'Protected'}
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
                          {formatCurrency(viewingProductDetails.price, currency)}
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
                            if (role !== 'Manager' && user?.email !== 'admin@megapos.pos') return 'Protected';
                            const cost = viewingProductDetails.costPrice || (viewingProductDetails.price * 0.7);
                            const profit = viewingProductDetails.price - cost;
                            const pct = viewingProductDetails.price > 0 ? (profit / viewingProductDetails.price) * 100 : 0;
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
                            viewingProductDetails.stockLevel < (lowStockEnabled ? lowStockThreshold : 10) ? "bg-red-500" : "bg-emerald-500"
                          )} />
                          <span className={theme === "dark" ? "text-white" : ""}>{viewingProductDetails.stockLevel} units</span>
                        </div>
                      </div>
                    </div>

                    {/* Extra Attributes */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={cn(
                        "p-2.5 rounded-xl border flex flex-col gap-0.5",
                        theme === "dark" ? "bg-black/20 border-white/40" : "bg-gray-50 border-light-border/20"
                      )}>
                        <span className={cn(
                          "text-[8px] uppercase font-black",
                          theme === "dark" ? "text-slate-100" : "opacity-40"
                        )}>Image Attached</span>
                        <span className={cn(
                          "text-xs font-black uppercase tracking-wider",
                          viewingProductDetails.imageUrl 
                            ? (theme === "dark" ? "text-emerald-400" : "text-emerald-500") 
                            : (theme === "dark" ? "text-red-400" : "text-red-500")
                        )}>
                          {viewingProductDetails.imageUrl ? "YES" : "NO"}
                        </span>
                      </div>
                      
                      <div className={cn(
                        "p-2.5 rounded-xl border flex flex-col gap-0.5",
                        theme === "dark" ? "bg-black/20 border-white/40" : "bg-gray-50 border-light-border/20"
                      )}>
                        <span className={cn(
                          "text-[8px] uppercase font-black",
                          theme === "dark" ? "text-slate-100" : "opacity-40"
                        )}>Color / Style</span>
                        <span className={cn(
                          "text-xs uppercase font-medium",
                          theme === "dark" ? "text-white" : "text-black"
                        )}>{viewingProductDetails.color || "N/A"}</span>
                      </div>

                      <div className={cn(
                        "p-2.5 rounded-xl border flex flex-col gap-0.5",
                        theme === "dark" ? "bg-black/20 border-white/40" : "bg-gray-50 border-light-border/20"
                      )}>
                        <span className={cn(
                          "text-[8px] uppercase font-black",
                          theme === "dark" ? "text-slate-100" : "opacity-40"
                        )}>Size Dimensions</span>
                        <span className={cn(
                          "text-xs font-mono",
                          theme === "dark" ? "text-white/90" : ""
                        )}>{viewingProductDetails.size || "N/A"}</span>
                      </div>

                      <div className={cn(
                        "p-2.5 rounded-xl border flex flex-col gap-0.5",
                        theme === "dark" ? "bg-black/20 border-white/40" : "bg-gray-50 border-light-border/20"
                      )}>
                        <span className={cn(
                          "text-[8px] uppercase font-black",
                          theme === "dark" ? "text-slate-100" : "opacity-40"
                        )}>Weight / Pallet</span>
                        <span className={cn(
                          "text-xs font-mono",
                          theme === "dark" ? "text-white/90" : ""
                        )}>
                          {viewingProductDetails.weight ? `${viewingProductDetails.weight}` : ""}
                          {viewingProductDetails.weight && viewingProductDetails.palletSize ? " | " : ""}
                          {viewingProductDetails.palletSize ? `${viewingProductDetails.palletSize}` : ""}
                          {!viewingProductDetails.weight && !viewingProductDetails.palletSize && "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* BLOCK: Calculated Valuation Section - Shows current valuation details */}
                    <div className={cn(
                      "product-valuation-card p-4.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md transition-all duration-300",
                      theme === "dark"
                        ? "bg-gradient-to-br from-[#040e33] to-[#010619] border-[#123ebd]/30 text-white"
                        : "bg-gradient-to-br from-slate-50 via-white to-slate-100/50 border-slate-200 text-black"
                    )}>
                      <div className="product-valuation-card__info">
                        <p className={cn(
                          "product-valuation-card__label text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-1",
                          theme === "dark" ? "text-cyan-400" : "text-[#062A95]"
                        )}>
                          <span className="product-valuation-card__pulse-dot w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                          Calculated Valuation
                        </p>
                        <p className="product-valuation-card__formula text-[9px] font-presale uppercase tracking-widest opacity-60">
                          Price &times; Current Stock Level
                        </p>
                      </div>
                      <div className="product-valuation-card__value-container text-left sm:text-right">
                        <h4 className="product-valuation-card__value text-xl md:text-2xl font-presale font-black text-brand-primary">
                          {formatCurrency(viewingProductDetails.price * viewingProductDetails.stockLevel, currency)}
                        </h4>
                      </div>
                    </div>

                    {/* Variations Segment */}
                    {viewingProductDetails.variations && viewingProductDetails.variations.length > 0 && (
                      <div className="space-y-3">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest block",
                          theme === "dark" ? "text-slate-100" : "opacity-40"
                        )}>Variant Portfolio</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto no-scrollbar pr-1">
                          {viewingProductDetails.variations.map((v, i) => (
                            <div 
                              key={v.id || i}
                              className={cn(
                                "p-3 rounded-xl border-2 grid grid-cols-3 items-center gap-2",
                                theme === "dark" ? "bg-black/40 border-white/40" : "bg-white border-light-border/40"
                              )}
                            >
                              <div className="col-span-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary truncate">
                                  {v.color || v.size ? `${v.color || ""} ${v.size || ""}` : `Variant #${i+1}`}
                                </p>
                                <p className={cn(
                                  "text-[8px] font-presale truncate",
                                  theme === "dark" ? "text-slate-300" : "opacity-50"
                                )}>{v.sku || "N/A"}</p>
                              </div>
                              <div className="col-span-1 text-center">
                                <p className={cn(
                                  "text-[8px] uppercase",
                                  theme === "dark" ? "text-slate-200" : "opacity-40"
                                )}>Stock</p>
                                <p className={cn(
                                  "font-presale text-xs font-bold",
                                  theme === "dark" ? "text-white" : ""
                                )}>{v.stockLevel ?? 0} qty</p>
                              </div>
                              <div className="col-span-1 text-right">
                                <p className={cn(
                                  "text-[8px] uppercase",
                                  theme === "dark" ? "text-slate-200" : "opacity-40"
                                )}>Price</p>
                                <p className="font-presale text-xs font-black text-brand-primary">{formatCurrency(v.price || viewingProductDetails.price, currency)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3.5 border-t border-inherit flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3.5 shrink-0 mt-3.5">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          const doc = new jsPDF();
                          doc.setFont("helvetica", "bold");
                          doc.text("PRODUCT TAG & BARCODE VOUCHER", 10, 20);
                          doc.setFont("helvetica", "normal");
                          doc.text(`Product Name: ${viewingProductDetails.name}`, 10, 35);
                          doc.text(`Price: ${formatCurrency(viewingProductDetails.price, currency)}`, 10, 45);
                          doc.text(`Barcode: ${viewingProductDetails.barcode || "N/A"}`, 10, 55);
                          doc.text(`SKU: ${viewingProductDetails.sku || "N/A"}`, 10, 65);
                          doc.text(`Stock Level: ${viewingProductDetails.stockLevel} Units`, 10, 75);
                          doc.save(`Product_${viewingProductDetails.id}.pdf`);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                          theme === "dark" 
                            ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                            : "bg-white border-light-border text-black hover:bg-gray-50",
                        )}
                      >
                        <Printer size={12} /> Print Voucher
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const productToEdit = viewingProductDetails;
                          setViewingProductDetails(null);
                          openEditModal(productToEdit);
                        }}
                        className={cn(
                          "px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5",
                          theme === "dark"
                            ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                            : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10"
                        )}
                      >
                        <Edit2 size={12} /> Modify Product
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Expanded Image Lightbox */}
        <AnimatePresence>
          {isImageExpanded && viewingProductDetails?.imageUrl && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="absolute inset-0 bg-black/15 backdrop-blur-[1px] cursor-pointer"
              />

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl max-h-[85vh] z-10 flex flex-col items-center justify-center"
              >
                <button
                  type="button"
                  onClick={() => setIsImageExpanded(false)}
                  className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>

                <img 
                  src={viewingProductDetails.imageUrl} 
                  alt={viewingProductDetails.name} 
                  className="max-w-full max-h-[75vh] rounded-2xl object-contain border-2 border-white/10 shadow-2xl" 
                  referrerPolicy="no-referrer"
                />
                
                <div className="text-center mt-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">{viewingProductDetails.name}</h4>
                  <p className="text-[10px] font-mono text-white/50 uppercase mt-0.5">Reference #{viewingProductDetails.id}</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        </div>
      </div>
    </div>
  </div>
</div>
</div>
  );
};
