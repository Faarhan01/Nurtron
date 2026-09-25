/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Bell, 
  User, 
  Clock, 
  ChevronDown, 
  LogOut, 
  Wifi, 
  WifiOff,
  Menu,
  X,
  Home,
  ShoppingCart,
  Package,
  RefreshCw,
  BarChart3,
  Settings,
  Lock,
  Wallet,
  RotateCcw,
  Store,
  Shield,
  Smartphone,
  Cpu,
  Monitor,
  Sun,
  AlertTriangle,
  Check,
  ShieldCheck,
  LayoutDashboard,
  History,
  TrendingDown,
  CreditCard,
  Landmark,
  PauseCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { auth, db } from '../lib/firebase';
import { signOut } from "../lib/firebase";
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, doc, onSnapshot } from "../lib/firebase";

import { User as FirebaseUser } from "../lib/firebase";
import { useShift } from '../context/ShiftContext';
import { useCart } from '../context/CartContext';
import { ShiftControlModal } from './shifts/ShiftControlModal';
import { HoldCartDrawer } from './cart/HoldCartDrawer';
import { formatCurrencyValue } from '../lib/financialMath';

interface HeaderProps {
  user: FirebaseUser | null;
  role?: string;
  theme?: 'dark' | 'light';
  isNotificationsOpen: boolean;
  setIsNotificationsOpen: (open: boolean) => void;
  onNotificationClick?: (tab: string, filter?: string) => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  permissions?: Record<string, boolean>;
  inventoryModule?: 'inventory' | 'vault' | 'balances';
  setInventoryModule?: (module: 'inventory' | 'vault' | 'balances') => void;
  settingsTab?: 'store' | 'user' | 'staff' | 'terminal' | 'devices' | 'appearance' | 'admin' | 'manager';
  setSettingsTab?: (tab: 'store' | 'user' | 'staff' | 'terminal' | 'devices' | 'appearance' | 'admin' | 'manager') => void;
  transactionsTab?: 'presales' | 'returns' | 'expenditure' | 'revenue' | 'balances';
  setTransactionsTab?: (tab: 'presales' | 'returns' | 'expenditure' | 'revenue' | 'balances') => void;
  reportsTab?: 'performance' | 'history' | 'expenses' | 'products' | 'balances';
  setReportsTab?: (tab: 'performance' | 'history' | 'expenses' | 'products' | 'balances') => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
  role,
  theme = 'dark',
  isNotificationsOpen,
  setIsNotificationsOpen,
  onNotificationClick,
  activeTab = 'home',
  setActiveTab,
  permissions = { home: true, register: true, inventory: true, reports: true, settings: true, transactions: true },
  inventoryModule = 'inventory',
  setInventoryModule,
  settingsTab = 'user',
  setSettingsTab,
  transactionsTab = 'presales',
  setTransactionsTab,
  reportsTab = 'performance',
  setReportsTab
}) => {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [isAccountOpen, setIsAccountOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(typeof window !== 'undefined' ? window.navigator.onLine : true);
  const [isFirestoreConnected, setIsFirestoreConnected] = React.useState(true);
  const [localDevicesCount, setLocalDevicesCount] = React.useState(0);
  const [desktopRegisterLayout, setDesktopRegisterLayout] = React.useState<'card' | 'table' | 'split'>(() => {
    try {
      const saved = localStorage.getItem('nurtron_desktop_register_layout');
      if (saved) return saved as 'card' | 'table' | 'split';
    } catch (e) {}
    return 'table';
  });
  const [registerMode, setRegisterMode] = React.useState<'presale' | 'cashsale'>('presale');
  const [registerActiveView, setRegisterActiveView] = React.useState<'cart' | 'verify'>('cart');
  const [isRegisterModeMenuOpen, setIsRegisterModeMenuOpen] = React.useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = React.useState(false);
  const [isHoldDrawerOpen, setIsHoldDrawerOpen] = React.useState(false);

  const { currentShift, isShiftOpen } = useShift();
  const { parkedCarts } = useCart();

  const effectiveRole = role || (user?.email === 'admin@megapos.pos' ? 'Manager' : 'Cashier');
  const isCashierOrAbove = ['cashier', 'supervisor', 'manager'].includes(effectiveRole.toLowerCase()) || user?.email === 'admin@megapos.pos';

  // Lock body & main scroll containers and disable background interaction when mobile menu is open
  React.useEffect(() => {
    const scrollContainers = document.querySelectorAll('.active-terminal__scroll-container');
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      scrollContainers.forEach((el) => {
        (el as HTMLElement).style.overflow = 'hidden';
        (el as HTMLElement).style.pointerEvents = 'none';
      });
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      scrollContainers.forEach((el) => {
        (el as HTMLElement).style.overflow = '';
        (el as HTMLElement).style.pointerEvents = '';
      });
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      scrollContainers.forEach((el) => {
        (el as HTMLElement).style.overflow = '';
        (el as HTMLElement).style.pointerEvents = '';
      });
    };
  }, [isMobileMenuOpen]);

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
      if (e.detail) setRegisterActiveView(e.detail);
    };
    window.addEventListener('registerModeChange' as any, handleModeChange);
    window.addEventListener('registerViewChange' as any, handleViewChange);
    return () => {
      window.removeEventListener('registerModeChange' as any, handleModeChange);
      window.removeEventListener('registerViewChange' as any, handleViewChange);
    };
  }, [role]);

  React.useEffect(() => {
    const storeId = typeof window !== 'undefined' ? (localStorage.getItem('nurtron_pos_store_id') || 'default') : 'default';
    const unsubSettings = onSnapshot(doc(db, 'settings', storeId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const layoutVal = data.desktopRegisterLayout || data.desktopLayout || 'table';
        setDesktopRegisterLayout(layoutVal);
        try {
          localStorage.setItem('nurtron_desktop_register_layout', layoutVal);
        } catch(e) {}
      }
    });
    return () => unsubSettings();
  }, []);

  const changeModeAndView = (mode: 'presale' | 'cashsale' | null, view: 'cart' | 'verify') => {
    let finalMode = mode;
    if (role?.toLowerCase() === 'rep' && finalMode === 'cashsale') {
      finalMode = 'presale';
    }
    if (finalMode) {
      setRegisterMode(finalMode);
      window.dispatchEvent(new CustomEvent('registerModeChange', { detail: finalMode }));
    }
    setRegisterActiveView(view);
    window.dispatchEvent(new CustomEvent('registerViewChange', { detail: view }));
  };

  const notifications = [
    { id: 1, title: 'Inventory Alert', message: '5 items reaching critical stock levels', type: 'alert', time: '2m ago', tab: 'inventory', filter: 'low-stock' },
    { id: 2, title: 'Sync Complete', message: 'Terminal matrix synchronized with cloud', type: 'success', time: '15m ago', tab: 'register' },
    { id: 3, title: 'System Batch', message: 'Daily report generation initialized', type: 'info', time: '1h ago', tab: 'reports' },
  ];

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    const handleFirestoreStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setIsFirestoreConnected(customEvent.detail.connected);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('firestore-connection', handleFirestoreStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('firestore-connection', handleFirestoreStatus);
    };
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/local_devices`;
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      setLocalDevicesCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to local devices:", error);
    });
    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  return (
    <header className={cn(
      "header-portal header-portal--floating relative h-16 border grid grid-cols-3 items-center px-6 z-50 transition-all duration-500 rounded-2xl shadow-lg backdrop-blur-md",
      theme === 'dark' 
        ? "header-portal--dark bg-black/60 border-zinc-800/80 text-dark-text hover:border-zinc-700/80" 
        : "header-portal--light bg-white border-zinc-200/80 text-light-text hover:border-zinc-300"
    )}>
      {/* BLOCK: Header Portal Left Area - Displays the page name, wifi connection, and local devices indicators on desktop */}
      <div className="header__left-section flex items-center justify-start gap-2 sm:gap-2.5">
        <div className={cn(
          "header__page-name-badge hidden md:inline-flex items-center justify-center w-36 h-9 border rounded-xl text-[10px] font-black uppercase tracking-widest text-center whitespace-nowrap select-none shrink-0 transition-all duration-300",
          theme === 'dark' 
            ? "bg-[#041a5c]/40 border-[#123ebd]/50 text-white" 
            : "bg-slate-50 border-slate-300 text-black"
        )}>
          <span className="leading-none flex items-center justify-center text-center w-full">
            {activeTab === 'home' && 'Home'}
            {activeTab === 'register' && 'Register'}
            {activeTab === 'inventory' && 'Inventory'}
            {activeTab === 'transactions' && 'Transactions'}
            {activeTab === 'reports' && 'Reports'}
            {activeTab === 'settings' && 'Settings'}
          </span>
        </div>

        {/* BLOCK: Real-time Cloud Connectivity Indicator - Displays active connection state to cloud using wifi icon */}
        <div 
          id="header-connectivity-indicator"
          className={cn(
            "header__connectivity-indicator h-9 w-9 rounded-lg border-2 hidden md:flex items-center justify-center focus:outline-none no-gradient select-none transition-all duration-300 shrink-0",
            !isOnline
              ? (theme === 'dark' ? "border-rose-500/40 bg-rose-500/10 text-rose-400 animate-pulse" : "border-rose-500/30 bg-rose-50 text-rose-700 animate-pulse")
              : !isFirestoreConnected
                ? (theme === 'dark' ? "border-amber-500/40 bg-amber-500/15 text-amber-400" : "border-amber-500/30 bg-amber-50 text-amber-600")
                : (theme === 'dark' ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-emerald-500/10 bg-emerald-50/50 text-emerald-700")
          )}
          title={
            !isOnline 
              ? "Terminal Offline — Storing Transactions Locally"
              : !isFirestoreConnected 
                ? "Operating in Fast Local Offline Mode: Third-party connection blocked in preview iframe. Click 'Open in new tab' at top-right to establish live cloud database."
                : "Terminal Online — Active Connection to Cloud Database"
          }
        >
          {!isOnline ? (
            <WifiOff size={14} className="header__connectivity-indicator__icon shrink-0 text-rose-500" />
          ) : !isFirestoreConnected ? (
            <Wifi size={14} className="header__connectivity-indicator__icon shrink-0 text-amber-400" />
          ) : (
            <Wifi size={14} className="header__connectivity-indicator__icon shrink-0" />
          )}
        </div>

        {/* BLOCK: Local Subnet Peer Connection Indicator - Shows connected workstation peer count and status PC icon */}
        {isCashierOrAbove && (
          <div 
            id="header-local-devices-indicator"
            className={cn(
              "header__local-devices-indicator h-9 px-2.5 sm:px-3 rounded-lg border-2 hidden md:inline-flex items-center justify-center gap-1.5 focus:outline-none no-gradient select-none transition-all duration-300 shrink-0",
              localDevicesCount > 0
                ? (theme === 'dark' ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-emerald-500/10 bg-emerald-50/50 text-emerald-700")
                : (theme === 'dark' ? "border-dark-border bg-black/10 text-dark-text/40" : "border-light-border bg-gray-50 text-light-text/40")
            )}
            title={`Local Network: ${localDevicesCount} peer companion devices connected.`}
          >
            <Monitor size={14} className={cn("header__local-devices-indicator__pc-icon shrink-0", localDevicesCount > 0 && "animate-pulse")} />
            <span className="header__local-devices-indicator__text text-[10px] font-mono font-black tracking-tight uppercase leading-none flex items-center">
              {localDevicesCount}
            </span>
          </div>
        )}

        {/* BLOCK: Cash Shift Indicator - Opens Shift/Drawer Management Modal */}
        <button
          onClick={() => setIsShiftModalOpen(true)}
          className={cn(
            "header__shift-indicator h-9 px-2.5 sm:px-3 rounded-lg border-2 inline-flex items-center justify-center gap-1.5 focus:outline-none select-none transition-all duration-300 shrink-0 cursor-pointer",
            isShiftOpen
              ? (theme === 'dark' ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "border-emerald-500/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100")
              : (theme === 'dark' ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "border-amber-500/30 bg-amber-50 text-amber-700 hover:bg-amber-100")
          )}
          title="Cash Drawer & Shift Status (F12)"
        >
          <Landmark size={14} className="shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-tight hidden lg:inline">
            {isShiftOpen && currentShift ? `Shift: ${formatCurrencyValue(currentShift.expectedCashInDrawer, 'R')}` : 'Open Shift'}
          </span>
        </button>

        {/* BLOCK: Held Orders Indicator - Opens Parked Cart Drawer */}
        {parkedCarts.length > 0 && (
          <button
            onClick={() => setIsHoldDrawerOpen(true)}
            className={cn(
              "header__held-orders-indicator h-9 px-2.5 sm:px-3 rounded-lg border-2 inline-flex items-center justify-center gap-1.5 focus:outline-none select-none transition-all duration-300 shrink-0 cursor-pointer animate-pulse",
              theme === 'dark'
                ? "border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                : "border-amber-500/40 bg-amber-100 text-amber-800 hover:bg-amber-200"
            )}
            title="Suspended Layaway Tickets (F4)"
          >
            <PauseCircle size={14} className="shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-tight">
              Held ({parkedCarts.length})
            </span>
          </button>
        )}
      </div>

      {/* BLOCK: Header Portal Center Area - Centered App Branding/Logo */}
      <div className="header__center-section flex items-center justify-center">
        <div className="header__branding flex items-center gap-3">
          <div className={cn(
            "header__logo-badge w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg",
            theme === 'dark' ? "bg-dark-text text-dark-bg" : "bg-light-text text-light-surface"
          )}>M</div>
          <div className="text-left">
            <h1 className="header__branding-title text-sm font-black uppercase tracking-tighter">megapos</h1>
          </div>
        </div>
      </div>

      {/* BLOCK: Header Portal Right Area - System connectivity indicators, intelligence notifications, operator profile */}
      <div className="header__right-section flex items-center justify-end gap-2.5 sm:gap-4">

        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsAccountOpen(false);
            }}
            className={cn(
              "relative p-2 transition-all rounded-full hover:bg-white/5 active:scale-95",
              theme === 'dark' ? "text-[#888] hover:text-[#E4E3E0]" : "text-[#666] hover:text-[#141414]"
            )}
          >
            <Bell size={20} />
            <span className={cn(
               "absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 animate-pulse",
               theme === 'dark' ? "bg-red-500 border-[#141414]" : "bg-red-500 border-white"
            )}></span>
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "absolute top-full right-0 mt-3 w-80 border rounded-lg shadow-[0_20px_50px_rgba(2,6,23,0.5)] p-0 z-50 overflow-hidden",
                    theme === 'dark' ? "bg-dark-bg border-dark-border text-dark-text" : "bg-white border-light-border text-light-text"
                  )}
                >
                  <div className="p-5 border-b border-inherit bg-inherit/50 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em]">Intelligence Feed</h3>
                    <span className="text-[8px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{notifications.length} Pending</span>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                    {notifications.map((note) => (
                      <button 
                        key={note.id}
                        onClick={() => {
                          if (onNotificationClick && note.tab) {
                            onNotificationClick(note.tab, note.filter);
                            setIsNotificationsOpen(false);
                          }
                        }}
                        className={cn(
                          "w-full text-left p-5 border-b border-inherit/50 transition-colors last:border-0",
                          theme === 'dark' ? "hover:bg-[#222]" : "hover:bg-[#F5F5F5]"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                            note.type === 'alert' ? "bg-red-500" : note.type === 'success' ? "bg-green-500" : "bg-blue-500"
                          )} />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1">{note.title}</p>
                            <p className="text-xs opacity-60 leading-relaxed uppercase">{note.message}</p>
                            <p className="text-[8px] font-mono opacity-30 mt-2 uppercase">{note.time} | FEED:SYS</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button className={cn(
                    "w-full p-4 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity",
                    theme === 'dark' ? "bg-[#1A1A1A]" : "bg-gray-50"
                  )}>
                    Acknowledge All Clear
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* BLOCK: Account Trigger - Desktop Only */}
        <div className="relative hidden md:block">
          <button 
            onClick={() => {
              setIsAccountOpen(!isAccountOpen);
              setIsNotificationsOpen(false);
            }}
            className={cn(
              "flex items-center transition-all active:scale-95 shadow-sm rounded-full focus:outline-none",
              "md:p-1 md:gap-2 md:border",
              theme === 'dark' ? "md:bg-dark-surface md:border-dark-border" : "md:bg-light-surface md:border-light-border",
              // Mobile specific styling: circular border matching online indicator
              isOnline 
                ? "border-2 border-emerald-500 md:border-dark-border" 
                : "border-2 border-rose-500 animate-pulse md:border-dark-border"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center overflow-hidden transition-all",
              theme === 'dark' ? "bg-[#333] text-[#E4E3E0]" : "bg-[#EEE] text-[#141414]"
            )}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={18} />
              )}
            </div>
            <ChevronDown size={14} className={cn("hidden md:block transition-transform mr-1 text-[#666]", isAccountOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {isAccountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsAccountOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={cn(
                    "absolute top-full right-0 mt-3 w-64 border rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-0 z-50 overflow-hidden",
                    theme === 'dark' ? "bg-[#141414] border-[#333] text-[#E4E3E0]" : "bg-white border-[#EEE] text-[#141414]"
                  )}
                >
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-inherit/30 opacity-90">
                      <div className={cn(
                        "w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden text-2xl font-bold border",
                        theme === 'dark' ? "bg-[#222] border-[#333]" : "bg-[#F5F5F5] border-[#EEE]"
                      )}>
                        {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black uppercase tracking-tight leading-tight truncate max-w-[140px]">{user.displayName || 'Operator'}</p>
                        <p className="text-[10px] text-[#666] font-mono truncate max-w-[140px] uppercase mt-1">Level: {role || 'Manager'}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-colors text-left",
                        theme === 'dark' ? "hover:bg-[#222]" : "hover:bg-[#F5F5F5]"
                      )}>
                        <User size={14} className="text-[#666]" />
                        User Dossier
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* BLOCK: Mobile Navigation Menu - Provides responsive menu trigger and fully featured dropdown with active subtabs */}
        <div className="relative md:hidden flex items-center">
          <button 
            onClick={() => {
              setIsMobileMenuOpen(!isMobileMenuOpen);
              setIsNotificationsOpen(false);
            }}
            className={cn(
              "mobile-menu__trigger flex items-center justify-center p-2 rounded-xl transition-all duration-300 active:scale-95 border",
              theme === 'dark' 
                ? "bg-dark-surface border-dark-border text-dark-text" 
                : "bg-light-surface border-light-border text-light-text",
              isOnline 
                ? "border-emerald-500/50 text-emerald-400" 
                : "border-rose-500 animate-pulse text-rose-500"
            )}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? (
              <X size={18} className="mobile-menu__trigger-icon text-red-500 animate-in fade-in zoom-in-50 duration-200" />
            ) : (
              <Menu size={18} className="mobile-menu__trigger-icon animate-in fade-in zoom-in-50 duration-200" />
            )}
          </button>

          <AnimatePresence>
            {isMobileMenuOpen && (
              <>
                {/* Backdrop to close menu - Covers screen below header, blocks touch gestures & background interaction */}
                <div 
                  className="fixed inset-0 top-[80px] z-[490] bg-black/20 backdrop-blur-[2px] touch-none cursor-default select-none pointer-events-auto" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  onTouchMove={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                />
                
                <motion.div 
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={cn(
                    "mobile-menu__dropdown fixed top-[88px] left-4 right-4 sm:left-auto sm:right-4 sm:w-80 max-h-[calc(100dvh-104px)] overflow-y-auto overscroll-contain touch-pan-y pointer-events-auto border rounded-2xl shadow-2xl p-4 z-[500] flex flex-col gap-4",
                    theme === 'dark' 
                      ? "bg-[#0c0c0e]/98 border-zinc-800 text-dark-text shadow-black/80" 
                      : "bg-white/98 border-zinc-200 text-light-text shadow-zinc-300/40"
                  )}
                  style={{
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {/* BLOCK: Mobile Status Indicators */}
                  <div className="mobile-menu__indicators flex justify-between gap-2">
                    {/* Local Subnet Peer Connection Indicator */}
                    {isCashierOrAbove && (
                      <div 
                        className={cn(
                          "flex-1 p-2 rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[9px] font-black uppercase tracking-wider",
                          theme === 'dark' ? "bg-[#041a5c]/40 border-[#123ebd]/30 text-emerald-400" : "bg-slate-50 border-slate-200 text-emerald-600"
                        )}
                      >
                        <Monitor size={14} className={cn("mobile-menu__pc-icon shrink-0", localDevicesCount > 0 && "animate-pulse")} />
                        <span>{localDevicesCount}</span>
                      </div>
                    )}

                    {/* Database Status Indicator */}
                    <div 
                      className={cn(
                        "flex-1 p-2 rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[9px] font-black uppercase tracking-wider",
                        theme === 'dark' 
                          ? isFirestoreConnected ? "bg-[#041a5c]/40 border-[#123ebd]/30 text-emerald-400" : "bg-[#5c041a]/40 border-[#bd123e]/30 text-rose-400"
                          : isFirestoreConnected ? "bg-slate-50 border-slate-200 text-emerald-600" : "bg-red-50 border-red-200 text-red-600"
                      )}
                    >
                      <span className={cn(
                        "relative flex h-1.5 w-1.5",
                        isFirestoreConnected && "animate-pulse"
                      )}>
                        <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", isFirestoreConnected ? "bg-emerald-500" : "bg-rose-500")}></span>
                      </span>
                      <span>DB {isFirestoreConnected ? "SYNC" : "OFFLINE"}</span>
                    </div>

                    {/* Network Connection Indicator */}
                    <div 
                      className={cn(
                        "flex-1 p-2 rounded-xl border flex flex-col items-center justify-center gap-1 font-mono text-[9px] font-black uppercase tracking-wider",
                        theme === 'dark' 
                          ? isOnline ? "bg-[#041a5c]/40 border-[#123ebd]/30 text-emerald-400" : "bg-[#5c041a]/40 border-[#bd123e]/30 text-rose-400"
                          : isOnline ? "bg-slate-50 border-slate-200 text-emerald-600" : "bg-red-50 border-red-200 text-red-600"
                      )}
                    >
                      {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                      <span>NET {isOnline ? "LIVE" : "DISCONN"}</span>
                    </div>
                  </div>

                  {/* Operator/User Info Card inside Mobile Menu */}
                  <div className={cn(
                    "mobile-menu__profile flex items-center gap-4 p-4 rounded-xl border",
                    theme === 'dark' ? "bg-black/40 border-zinc-800" : "bg-gray-50 border-zinc-100"
                  )}>
                    <div className="mobile-menu__profile-avatar w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden border">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={18} />
                      )}
                    </div>
                    <div className="mobile-menu__profile-info text-left flex-1 min-w-0">
                      <p className="mobile-menu__profile-name text-xs font-black uppercase tracking-tight truncate">{user.displayName || 'Operator'}</p>
                      <p className="mobile-menu__profile-role text-[9px] text-zinc-500 font-mono uppercase mt-0.5">
                        {role || 'Manager'}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        signOut(auth);
                      }}
                      className="mobile-menu__logout-btn p-2 rounded-lg text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
                      title="Log Out"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>

                  {/* Navigation List of Pages & Tabs */}
                  <nav className="mobile-menu__nav flex flex-col gap-2">
                    {[
                      { id: 'home', label: 'Home', icon: Home, hasTabs: false },
                      { id: 'register', label: 'Register', icon: ShoppingCart, hasTabs: false },
                      { 
                        id: 'inventory', 
                        label: 'Inventory', 
                        icon: Package, 
                        hasTabs: true,
                        activeModule: inventoryModule,
                        setModule: setInventoryModule,
                        tabs: [
                          { id: 'inventory', label: 'INVENTORY MATRIX', icon: Package },
                          { id: 'vault', label: 'THE VAULT', icon: Lock },
                          { id: 'balances', label: 'LEDGER BALANCES', icon: Wallet }
                        ]
                      },
                      { 
                        id: 'transactions', 
                        label: 'Transactions', 
                        icon: RefreshCw, 
                        hasTabs: true,
                        activeModule: transactionsTab,
                        setModule: setTransactionsTab,
                        tabs: [
                          { id: 'presales', label: 'PRESALE STREAM', icon: RefreshCw },
                          { id: 'returns', label: 'RETURNS PORTAL', icon: RotateCcw },
                          { id: 'expenditure', label: 'EXPENDITURE', icon: Package },
                          { id: 'revenue', label: 'REVENUE STREAMS', icon: BarChart3 },
                          { id: 'balances', label: 'ACCOUNTS BALANCES', icon: Wallet }
                        ]
                      },
                      { 
                        id: 'reports', 
                        label: 'Reports', 
                        icon: BarChart3, 
                        hasTabs: true,
                        activeModule: reportsTab,
                        setModule: setReportsTab,
                        tabs: [
                          { id: 'performance', label: 'LIVE METRICS', icon: LayoutDashboard },
                          { id: 'history', label: 'TRANSACTION TRAIL', icon: History },
                          { id: 'expenses', label: 'OPERATING EXPENSES', icon: TrendingDown },
                          { id: 'products', label: 'STOCK', icon: Package },
                          { id: 'balances', label: 'ACCOUNTS RECEIVABLE', icon: CreditCard }
                        ]
                      },
                      { 
                        id: 'settings', 
                        label: 'Settings', 
                        icon: Settings, 
                        hasTabs: true,
                        activeModule: settingsTab,
                        setModule: setSettingsTab,
                        tabs: [
                          { id: 'user', label: 'USER PROFILE', icon: User },
                          { id: 'store', label: 'STORE SETTINGS', icon: Store },
                          { id: 'staff', label: 'STAFF MANAGEMENT', icon: Shield },
                          { id: 'terminal', label: 'TERMINAL CONFIG', icon: Smartphone },
                          ...(role === 'Manager' || role?.toLowerCase() === 'manager' ? [{ id: 'manager', label: 'MANAGER SETTINGS', icon: ShieldCheck }] : []),
                          { id: 'devices', label: 'DEVICE DIAGNOSTICS', icon: Cpu },
                          { id: 'appearance', label: 'APPEARANCE THEME', icon: Sun },
                          { id: 'admin', label: 'ADMIN CENTER', icon: AlertTriangle }
                        ]
                      }
                    ].filter(item => permissions && permissions[item.id]).map((item) => {
                      const isTabActive = activeTab === item.id;
                      const IconComp = item.icon;

                      return (
                        <div key={item.id} className="mobile-menu__nav-group border border-transparent rounded-xl overflow-hidden">
                          <button
                            onClick={() => {
                              if (setActiveTab) {
                                setActiveTab(item.id);
                              }
                              // For simple pages without tabs, close menu immediately
                              if (!item.hasTabs) {
                                setIsMobileMenuOpen(false);
                              }
                            }}
                            className={cn(
                              "mobile-menu__nav-btn w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-300 rounded-xl",
                              isTabActive 
                                ? theme === 'dark'
                                  ? "bg-brand-primary text-black font-black"
                                  : "bg-brand-primary-light text-white font-black"
                                : theme === 'dark'
                                  ? "text-zinc-400 hover:text-white hover:bg-zinc-850/50"
                                  : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <IconComp size={16} className={cn(isTabActive && "animate-pulse")} />
                              <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                            </div>
                            {item.hasTabs && (
                              <ChevronDown 
                                size={14} 
                                className={cn(
                                  "transition-transform", 
                                  isTabActive ? "rotate-180 opacity-100" : "opacity-40"
                                )} 
                              />
                            )}
                          </button>

                          {/* Expanded Subtabs nested inside Nav Group */}
                          <AnimatePresence>
                            {item.hasTabs && isTabActive && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className={cn(
                                  "mobile-menu__subtabs flex flex-col gap-1 px-3 py-2 border-t mt-1",
                                  theme === 'dark' ? "bg-black/25 border-zinc-800" : "bg-gray-50/50 border-zinc-100"
                                )}
                              >
                                {item.tabs?.map((subTab) => {
                                  const isSubActive = item.activeModule === subTab.id;
                                  const SubIcon = subTab.icon;

                                  return (
                                    <button
                                      key={subTab.id}
                                      onClick={() => {
                                        if (item.setModule) {
                                          (item.setModule as (val: string) => void)(subTab.id);
                                        }
                                        setIsMobileMenuOpen(false);
                                      }}
                                      className={cn(
                                        "mobile-menu__subtab-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all",
                                        isSubActive
                                          ? theme === 'dark'
                                            ? "mobile-menu__subtab-btn--active bg-[#00E5FF]/10 text-[#00E5FF] font-black"
                                            : "mobile-menu__subtab-btn--active bg-brand-primary-light/10 text-brand-primary-light font-black"
                                          : theme === 'dark'
                                            ? "text-zinc-500 hover:text-white"
                                            : "text-zinc-500 hover:text-black"
                                      )}
                                    >
                                      <SubIcon size={12} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">{subTab.label}</span>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </nav>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* BLOCK: Global Modals mounted to Header */}
      <ShiftControlModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        currencySymbol="R"
        cashierId={user?.email || 'Terminal'}
        cashierName={user?.displayName || role || 'Operator'}
      />

      <HoldCartDrawer
        isOpen={isHoldDrawerOpen}
        onClose={() => setIsHoldDrawerOpen(false)}
        currencySymbol="R"
        cashierId={user?.email || 'Terminal'}
        cashierName={user?.displayName || role || 'Operator'}
      />
    </header>
  );
};
