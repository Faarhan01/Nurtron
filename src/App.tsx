/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLocation, useNavigate, useSearchParams, Routes, Route, Navigate } from 'react-router-dom';
import { cn, handleFirestoreError, OperationType, handleBackdropClick } from './lib/utils';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Register } from './pages/Register';
import { Inventory } from './pages/Inventory';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Transactions } from './pages/Transactions';
import { Home } from './pages/Home';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User } from "./lib/firebase";
import { 
  Home as HomeIcon, 
  ShoppingCart, 
  Package, 
  BarChart3, 
  Settings as SettingsIcon,
  Shield,
  Lock,
  Wallet,
  Store,
  User as UserIcon,
  Smartphone,
  RefreshCw,
  Save,
  AlertTriangle,
  X,
  Cpu
} from 'lucide-react';
import { doc, getDoc, updateDoc, onSnapshot, setDoc, collection, getDocs } from "./lib/firebase";
import { db } from './lib/firebase';

import { UserRole } from './types';
import { useTheme } from './context/ThemeContext';

{/* BLOCK: Access Denied View - Renders when operator lacks permission for a sector */}
const AccessDeniedView: React.FC<{ onReturnHome: () => void; theme: 'dark' | 'light' }> = ({ onReturnHome, theme }) => (
  <div className="access-denied-view flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center p-6">
    <div className={cn(
      "access-denied-view__icon-box p-4 rounded-2xl",
      theme === 'dark' ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
    )}>
      <Shield className="w-12 h-12" />
    </div>
    <h2 className="access-denied-view__title text-2xl font-black uppercase tracking-tight">Access Restricted</h2>
    <p className={cn(
      "access-denied-view__desc text-sm max-w-md",
      theme === 'dark' ? "text-zinc-400" : "text-slate-600"
    )}>
      Your active operator profile does not have clearance to access this sector.
    </p>
    <button 
      onClick={onReturnHome}
      className={cn(
        "access-denied-view__button px-6 py-2.5 rounded-xl font-bold uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer",
        theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-[#062A95] text-white hover:bg-[#062A95]/90"
      )}
    >
      Return to Dashboard
    </button>
  </div>
);

{/* BLOCK: Not Found Sector - Renders when accessing an unregistered sector URL */}
const NotFoundSector: React.FC<{ onNavigateHome: () => void; theme: 'dark' | 'light' }> = ({ onNavigateHome, theme }) => (
  <div className="not-found-sector flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
    <div className={cn(
      "not-found-sector__icon-box p-4 rounded-2xl mb-4",
      theme === 'dark' ? "bg-zinc-800/80 text-brand-primary" : "bg-slate-100 text-[#062A95]"
    )}>
      <AlertTriangle size={40} />
    </div>
    <h2 className="not-found-sector__title text-3xl font-black uppercase tracking-tight mb-2">404 Sector Unknown</h2>
    <p className={cn(
      "not-found-sector__desc text-sm max-w-md mb-6",
      theme === 'dark' ? "text-zinc-400" : "text-slate-600"
    )}>
      The requested route does not exist in the active terminal registry.
    </p>
    <button
      onClick={onNavigateHome}
      className={cn(
        "not-found-sector__button px-6 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer",
        theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-[#062A95] text-white hover:bg-[#062A95]/90"
      )}
    >
      Return to Dashboard
    </button>
  </div>
);

export default function App() {
  const { theme, themePreset, setThemePreset, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine current active tab from router path
  const getTabFromPath = (pathname: string): string => {
    if (pathname.startsWith('/register')) return 'register';
    if (pathname.startsWith('/inventory')) return 'inventory';
    if (pathname.startsWith('/transactions')) return 'transactions';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'home';
  };

  const getPathFromTab = (tab: string): string => {
    switch (tab) {
      case 'register': return '/register';
      case 'inventory': return '/inventory';
      case 'transactions': return '/transactions';
      case 'reports': return '/reports';
      case 'settings': return '/settings';
      default: return '/';
    }
  };

  const activeTab = getTabFromPath(location.pathname);

  const [cartCount, setCartCount] = React.useState(0);
  const [pendingTab, setPendingTab] = React.useState<string | null>(null);

  const [isSettingsDirty, setIsSettingsDirty] = React.useState(false);
  const onSettingsSyncRef = React.useRef<(() => Promise<boolean>) | null>(null);
  const [pendingSettingsTab, setPendingSettingsTab] = React.useState<string | null>(null);
  const [showSettingsConfirmModal, setShowSettingsConfirmModal] = React.useState(false);
  const [isSyncingModal, setIsSyncingModal] = React.useState(false);

  const [inventoryModule, setInventoryModule] = React.useState<'inventory' | 'vault' | 'balances'>('inventory');
  const [transactionsTab, setTransactionsTab] = React.useState<'presales' | 'returns' | 'expenditure' | 'revenue' | 'balances'>('presales');
  const [settingsTab, setSettingsTab] = React.useState<'store' | 'user' | 'staff' | 'terminal' | 'devices' | 'appearance' | 'admin' | 'manager'>('user');
  const [reportsTab, setReportsTab] = React.useState<'performance' | 'history' | 'expenses' | 'products' | 'balances'>('performance');
  const [inventoryInitialFilter, setInventoryInitialFilter] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [subscriptionLevel, setSubscriptionLevel] = React.useState<'basic' | 'pro' | 'enterprise'>('basic');
  const [authReady, setAuthReady] = React.useState(false);
  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({
    home: true,
    register: true,
    inventory: true,
    reports: true,
    settings: true,
    transactions: true,
    setup_guide: true
  });
  const [role, setRole] = React.useState<UserRole>('Manager');
  const [customRoleName, setCustomRoleName] = React.useState('');
  const [storeId, setStoreId] = React.useState<string>(() => {
    const cached = localStorage.getItem('nurtron-current-store-id');
    if (!cached || cached === 'store') {
      return 'STR-100100';
    }
    return cached;
  });
  const [appSettings, setAppSettings] = React.useState<{ taxRate: number, taxType: 'inclusive' | 'exclusive' | 'none', currency: string, storeName: string, registrationNumber?: string, vatNumber?: string, autoPrint: boolean, productLayout: 'grid' | 'list-img' | 'list-text', textSize: 'sm' | 'base' | 'lg' }>(() => {
    let savedLayout: 'grid' | 'list-img' | 'list-text' = 'grid';
    let savedTextSize: 'sm' | 'base' | 'lg' = 'base';
    try {
      const cached = localStorage.getItem('nurtron_product_layout');
      if (cached === 'grid' || cached === 'list-img' || cached === 'list-text') {
        savedLayout = cached;
      }
      const cachedSize = localStorage.getItem('nurtron_text_size');
      if (cachedSize === 'sm' || cachedSize === 'base' || cachedSize === 'lg') {
        savedTextSize = cachedSize;
      }
    } catch (e) {}
    return {
      taxRate: 0.08,
      taxType: 'exclusive',
      currency: 'USD',
      storeName: 'megapos',
      registrationNumber: '',
      vatNumber: '',
      autoPrint: true,
      productLayout: savedLayout,
      textSize: savedTextSize
    };
  });

  // Sync sub-tabs with URL search parameters on route navigation
  React.useEffect(() => {
    const currentTab = getTabFromPath(location.pathname);
    if (currentTab === 'inventory') {
      const mod = searchParams.get('module');
      if (mod === 'inventory' || mod === 'vault' || mod === 'balances') {
        setInventoryModule(mod);
      }
    } else if (currentTab === 'transactions') {
      const tab = searchParams.get('tab');
      if (tab === 'presales' || tab === 'returns' || tab === 'expenditure' || tab === 'revenue' || tab === 'balances') {
        setTransactionsTab(tab);
      }
    } else if (currentTab === 'reports') {
      const tab = searchParams.get('tab');
      if (tab === 'performance' || tab === 'history' || tab === 'expenses' || tab === 'products' || tab === 'balances') {
        setReportsTab(tab);
      }
    } else if (currentTab === 'settings') {
      const tab = searchParams.get('tab');
      if (tab === 'store' || tab === 'user' || tab === 'staff' || tab === 'terminal' || tab === 'devices' || tab === 'appearance' || tab === 'admin' || tab === 'manager') {
        setSettingsTab(tab);
      }
    }
  }, [location.pathname, location.search, searchParams]);

  // Main navigation dispatcher with safety guard checks
  const setActiveTab = (tab: string, subTab?: string) => {
    const currentTab = getTabFromPath(location.pathname);
    if (currentTab === 'settings' && tab !== 'settings' && isSettingsDirty) {
      setPendingSettingsTab(tab);
      setShowSettingsConfirmModal(true);
      return;
    }
    if (currentTab === 'register' && tab !== 'register' && cartCount > 0) {
      setPendingTab(tab);
      return;
    }

    const targetPath = getPathFromTab(tab);
    let search = '';
    if (subTab) {
      if (tab === 'inventory') {
        search = `?module=${subTab}`;
        setInventoryModule(subTab as any);
      } else if (tab === 'transactions') {
        search = `?tab=${subTab}`;
        setTransactionsTab(subTab as any);
      } else if (tab === 'reports') {
        search = `?tab=${subTab}`;
        setReportsTab(subTab as any);
      } else if (tab === 'settings') {
        search = `?tab=${subTab}`;
        setSettingsTab(subTab as any);
      }
    }
    navigate(targetPath + search);
  };

  const handleStoreIdChange = (id: string) => {
    setStoreId(id);
    localStorage.setItem('nurtron-current-store-id', id);
  };

  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'settings', storeId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let savedLocal: 'grid' | 'list-img' | 'list-text' = 'grid';
        let savedLocalTextSize: 'sm' | 'base' | 'lg' = 'base';
        try {
          const cached = localStorage.getItem('nurtron_product_layout');
          if (cached === 'grid' || cached === 'list-img' || cached === 'list-text') {
            savedLocal = cached;
          }
          const cachedText = localStorage.getItem('nurtron_text_size');
          if (cachedText === 'sm' || cachedText === 'base' || cachedText === 'lg') {
            savedLocalTextSize = cachedText;
          }
        } catch (e) {}

        const layout = data.productLayout || savedLocal || 'grid';
        const textSizeVal = data.textSize || savedLocalTextSize || 'base';

        if (data.productLayout) {
          try { localStorage.setItem('nurtron_product_layout', data.productLayout); } catch (e) {}
        }
        if (data.textSize) {
          try { localStorage.setItem('nurtron_text_size', data.textSize); } catch (e) {}
        }

        setAppSettings({
          taxRate: (data.taxRate || 8) / 100,
          taxType: data.taxType || 'exclusive',
          currency: data.currency || 'USD',
          storeName: data.storeName || 'megapos',
          registrationNumber: data.registrationNumber || '',
          vatNumber: data.vatNumber || '',
          autoPrint: data.autoPrint !== false,
          productLayout: layout,
          textSize: textSizeVal
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${storeId}`, auth);
    });
    return () => unsub();
  }, [user, storeId]); 

  // Listen to the user's subscription level and enforce offline local/sync connection
  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const udata = docSnap.data();
        if (udata.subscriptionLevel) {
          setSubscriptionLevel(udata.subscriptionLevel);
        } else {
          setSubscriptionLevel('basic');
        }
      } else {
        setSubscriptionLevel('basic');
      }
    }, (error) => {
      console.warn("Could not fetch subscriptionLevel, default to basic:", error);
      setSubscriptionLevel('basic');
    });
    return () => unsub();
  }, [user]);

  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [managerEmail, setManagerEmail] = React.useState<string>(() => {
    try {
      return localStorage.getItem('nurtron_registered_manager_email') || '';
    } catch (e) {
      return '';
    }
  });

  React.useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setRole('Cashier');
        setPermissions({
          home: true,
          register: false,
          inventory: false,
          reports: false,
          settings: false,
          transactions: false,
          setup_guide: true
        });
        return;
      }

      try {
        const emailLower = (user.email || '').trim().toLowerCase();
        const displayNameLower = (user.displayName || '').trim().toLowerCase();
        let resolvedManagerEmail = emailLower;

        // 1. Full Manager / Admin Grant
        const isMasterAdmin = 
          emailLower === 'admin@megapos.pos' || 
          displayNameLower === 'admin' || 
          user.uid === 'usr_admin_master' || 
          user.uid === 'usr_admin_001';

        const fullManagerPermissions = {
          home: true,
          register: true,
          inventory: true,
          reports: true,
          settings: true,
          manage_presales: true,
          manage_returns: true,
          manage_vault: true,
          manage_balances: true,
          manage_staff: true,
          manage_store: true,
          manage_terminal: true,
          transactions: true,
          setup_guide: true
        };

        if (isMasterAdmin) {
          setRole('Manager');
          setCustomRoleName('System Administrator');
          setPermissions(fullManagerPermissions);
          setManagerEmail(emailLower);
          try {
            localStorage.setItem('nurtron_terminal_initialized', 'true');
            localStorage.setItem('nurtron_registered_manager_email', emailLower);
          } catch (e) {}
          return;
        }

        // 2. Local Staff Role Evaluation
        let docSnap = await getDoc(doc(db, 'staff', emailLower));
        if (!docSnap.exists() && emailLower !== user.email!) {
          docSnap = await getDoc(doc(db, 'staff', user.email!));
        }

        if (docSnap.exists()) {
          const data = docSnap.data();
          const userRole = data.role || 'Cashier';
          setRole(userRole);
          setCustomRoleName(data.customRoleName || '');
          
          if (userRole.toLowerCase() === 'manager') {
            setPermissions(fullManagerPermissions);
            resolvedManagerEmail = emailLower;
          } else {
            setPermissions(data.permissions || {
              home: true,
              register: true,
              transactions: true
            });
            if (data.addedBy) {
              resolvedManagerEmail = data.addedBy.trim().toLowerCase();
            } else if (data.managerEmail) {
              resolvedManagerEmail = data.managerEmail.trim().toLowerCase();
            } else {
              resolvedManagerEmail = emailLower;
            }
          }
        } else {
          // Auto-Register new operator as Manager if no prior profile exists
          setRole('Manager');
          setCustomRoleName('Manager');
          setPermissions(fullManagerPermissions);
          resolvedManagerEmail = emailLower;
          try {
            await setDoc(doc(db, 'staff', emailLower), {
              email: emailLower,
              username: user.displayName || emailLower.split('@')[0],
              role: 'Manager',
              permissions: fullManagerPermissions,
              addedBy: emailLower,
              addedAt: new Date().toISOString()
            });
          } catch (writeErr) {
            console.warn('Could not register operator in staff collection:', writeErr);
          }
        }

        setManagerEmail(resolvedManagerEmail);
        try {
          localStorage.setItem('nurtron_terminal_initialized', 'true');
          const oldMgr = localStorage.getItem('nurtron_registered_manager_email');
          if (oldMgr && oldMgr.toLowerCase().trim() !== resolvedManagerEmail) {
            localStorage.removeItem('nurtron_cached_products');
            localStorage.removeItem('nurtron_cached_staff');
          }
          localStorage.setItem('nurtron_registered_manager_email', resolvedManagerEmail);
        } catch (e) {}
      } catch (error) {
        console.warn('Error evaluating local RBAC permissions:', error);
      }
    };
    fetchPermissions();
  }, [user]);

  React.useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      console.warn('Firebase auth initial check timed out. Proceeding via resilience fallback...');
      setAuthReady(true);
    }, 2500);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      clearTimeout(fallbackTimer);
      setUser(user);
      setAuthReady(true);
    }, (error) => {
      clearTimeout(fallbackTimer);
      console.error('Auth state change error:', error);
      setAuthReady(true);
    });
    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  const updateProductLayout = async (layout: 'grid' | 'list-img' | 'list-text') => {
    try {
      localStorage.setItem('nurtron_product_layout', layout);
    } catch (e) {}
    setAppSettings(prev => ({ ...prev, productLayout: layout }));
    if (user) {
      try {
        await updateDoc(doc(db, 'settings', storeId), { productLayout: layout });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `settings/${storeId}`, auth);
      }
    }
  };

  if (!authReady) {
    return (
      <div className={cn(
        "auth-loading-screen h-screen flex items-center justify-center transition-colors duration-500",
        theme === 'dark' ? "bg-dark-bg" : "bg-light-bg"
      )}>
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={cn(
            "auth-loading-screen__spinner w-8 h-8 border-2 border-t-transparent rounded-full border-brand-primary"
          )}
        />
      </div>
    );
  }

  {/* BLOCK: Authentication Portal - Signed-out terminal landing page */}
  if (!user) {
    return (
      <div className={cn(
        "auth-portal font-sans relative transition-colors duration-500 min-h-screen",
        theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text",
        appSettings.textSize === 'sm' ? "text-size-sm" : appSettings.textSize === 'lg' ? "text-size-lg" : "text-size-base"
      )}>
        <Routes>
          <Route path="*" element={<Home onGetStarted={() => setActiveTab('register')} onNavigate={setActiveTab} theme={theme} />} />
        </Routes>
      </div>
    );
  }

  {/* BLOCK: Active Terminal Layout - Controls header, sidebar, and workspace panels with a modern floating centered/detached design */}
  return (
    <div className={cn(
      "active-terminal active-terminal--fullscreen flex flex-col h-screen overflow-hidden font-sans relative transition-all duration-500 p-0 m-0",
      theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text",
      appSettings.textSize === 'sm' ? "text-size-sm" : appSettings.textSize === 'lg' ? "text-size-lg" : "text-size-base"
    )}>

      {user && (
        /* BLOCK: Floating Sidebar Portal - Detached vertical menu hovering above the main content view */
        <div className="active-terminal__sidebar-wrapper hidden md:block fixed md:absolute left-4 top-24 bottom-4 z-[90] w-16">
          <Sidebar 
            user={user}
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            inventoryModule={inventoryModule}
            setInventoryModule={(mod) => {
              setInventoryModule(mod);
              if (activeTab === 'inventory') {
                setSearchParams({ module: mod }, { replace: true });
              }
            }}
            theme={theme}
            permissions={permissions}
          />
        </div>
      )}
      
      {/* BLOCK: Floating Content Shell - Full-width layout shell supporting the floating header and main pages */}
      <div className="active-terminal__content-shell flex-1 flex flex-col min-h-0 min-w-0 relative">
        {user && (
          /* BLOCK: Floating Header Portal - Detached horizontal control bar hovering above the main content view */
          <div className="active-terminal__header-wrapper fixed top-4 left-4 right-4 z-[9000]">
            <Header 
              user={user} 
              role={role}
              theme={theme} 
              isNotificationsOpen={isNotificationsOpen}
              setIsNotificationsOpen={setIsNotificationsOpen}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              permissions={permissions}
              inventoryModule={inventoryModule}
              setInventoryModule={(mod) => {
                setInventoryModule(mod);
                if (activeTab === 'inventory') {
                  setSearchParams({ module: mod }, { replace: true });
                }
              }}
              settingsTab={settingsTab}
              setSettingsTab={(tab) => {
                setSettingsTab(tab);
                if (activeTab === 'settings') {
                  setSearchParams({ tab }, { replace: true });
                }
              }}
              transactionsTab={transactionsTab}
              setTransactionsTab={(tab) => {
                setTransactionsTab(tab);
                if (activeTab === 'transactions') {
                  setSearchParams({ tab }, { replace: true });
                }
              }}
              reportsTab={reportsTab}
              setReportsTab={(tab) => {
                setReportsTab(tab);
                if (activeTab === 'reports') {
                  setSearchParams({ tab }, { replace: true });
                }
              }}
              onNotificationClick={(tab, filter) => {
                if (tab === 'inventory' || tab === 'vault' || tab === 'balances') {
                  if (filter) setInventoryInitialFilter(filter);
                  setActiveTab('inventory', tab);
                } else if (tab === 'settings' || tab === 'user' || tab === 'staff' || tab === 'terminal' || tab === 'store' || tab === 'manager') {
                  setActiveTab('settings', tab);
                } else {
                  setActiveTab(tab);
                }
              }}
            />
          </div>
        )}
        
        <main className={cn(
          "active-terminal__main flex-1 flex flex-col min-w-0 pb-0 overflow-hidden relative transition-all duration-500 w-full h-full",
          theme === 'dark' 
            ? "active-terminal__main--dark bg-dark-bg text-dark-text" 
            : "active-terminal__main--light bg-light-bg text-light-text"
        )}>
          <div className="active-terminal__scroll-container flex-1 overflow-y-auto no-scrollbar relative p-4 pt-24 pb-6 md:p-8 md:pt-28 md:pb-8 md:pl-28">
            <div className="active-terminal__view-wrapper min-h-full flex flex-col">
              <Routes location={location}>
                <Route 
                  path="/" 
                  element={
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }}
                      className="page-route-view page-route-view--home flex-1 flex flex-col"
                    >
                      <ErrorBoundary moduleName="Dashboard">
                        <Home onGetStarted={() => setActiveTab('register')} onNavigate={setActiveTab} theme={theme} />
                      </ErrorBoundary>
                    </motion.div>
                  } 
                />
                <Route path="/home" element={<Navigate to="/" replace />} />
                
                <Route 
                  path="/register" 
                  element={
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }}
                      className="page-route-view page-route-view--register flex-1 flex flex-col"
                    >
                      {(!permissions || !permissions['register']) ? (
                        <AccessDeniedView onReturnHome={() => setActiveTab('home')} theme={theme} />
                      ) : (
                        <ErrorBoundary moduleName="Point of Sale Register">
                          <Register 
                            user={user}
                            theme={theme} 
                            storeId={storeId}
                            taxRate={appSettings.taxRate} 
                            taxType={appSettings.taxType} 
                            currency={appSettings.currency} 
                            storeSettings={{
                              storeName: appSettings.storeName,
                              registrationNumber: appSettings.registrationNumber,
                              vatNumber: appSettings.vatNumber
                            }}
                            permissions={permissions} 
                            role={role} 
                            customRoleName={customRoleName}
                            autoPrint={appSettings.autoPrint}
                            productLayout={appSettings.productLayout}
                            onProductLayoutChange={updateProductLayout}
                            onOpenSettings={() => {
                              setActiveTab('settings');
                              setSettingsTab('user');
                            }}
                            onCartChange={setCartCount}
                            managerEmail={managerEmail}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  } 
                />

                <Route 
                  path="/inventory" 
                  element={
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }}
                      className="page-route-view page-route-view--inventory flex-1 flex flex-col"
                    >
                      {(!permissions || !permissions['inventory']) ? (
                        <AccessDeniedView onReturnHome={() => setActiveTab('home')} theme={theme} />
                      ) : (
                        <ErrorBoundary moduleName="Inventory & Catalog Management">
                          <Inventory 
                            user={user} 
                            theme={theme} 
                            storeId={storeId}
                            currency={appSettings.currency}
                            module={inventoryModule}
                            onModuleChange={(mod) => {
                              setInventoryModule(mod);
                              setSearchParams({ module: mod }, { replace: true });
                            }}
                            permissions={permissions}
                            role={role}
                            productLayout={appSettings.productLayout}
                            onProductLayoutChange={updateProductLayout}
                            onNotificationTrigger={() => setIsNotificationsOpen(true)} 
                            initialFilter={inventoryInitialFilter}
                            onClearInitialFilter={() => setInventoryInitialFilter(null)}
                            managerEmail={managerEmail}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  } 
                />

                <Route 
                  path="/transactions" 
                  element={
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }}
                      className="page-route-view page-route-view--transactions flex-1 flex flex-col"
                    >
                      {(!permissions || !permissions['transactions']) ? (
                        <AccessDeniedView onReturnHome={() => setActiveTab('home')} theme={theme} />
                      ) : (
                        <ErrorBoundary moduleName="Transactions & Audit Journal">
                          <Transactions 
                            user={user} 
                            theme={theme} 
                            storeId={storeId} 
                            currency={appSettings.currency} 
                            permissions={permissions} 
                            role={role} 
                            activeTab={transactionsTab} 
                            setActiveTab={(tab) => {
                              setTransactionsTab(tab);
                              setSearchParams({ tab }, { replace: true });
                            }} 
                            managerEmail={managerEmail} 
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  } 
                />

                <Route 
                  path="/reports" 
                  element={
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }}
                      className="page-route-view page-route-view--reports flex-1 flex flex-col"
                    >
                      {(!permissions || !permissions['reports']) ? (
                        <AccessDeniedView onReturnHome={() => setActiveTab('home')} theme={theme} />
                      ) : (
                        <ErrorBoundary moduleName="Analytics & Financial Reports">
                          <Reports 
                            user={user} 
                            theme={theme} 
                            currency={appSettings.currency} 
                            role={role} 
                            storeId={storeId} 
                            storeName={appSettings.storeName} 
                            activeSubTab={reportsTab} 
                            setActiveSubTab={(tab) => {
                              setReportsTab(tab);
                              setSearchParams({ tab }, { replace: true });
                            }} 
                            managerEmail={managerEmail} 
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  } 
                />

                <Route 
                  path="/settings" 
                  element={
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      transition={{ duration: 0.2 }}
                      className="page-route-view page-route-view--settings flex-1 flex flex-col"
                    >
                      {(!permissions || !permissions['settings']) ? (
                        <AccessDeniedView onReturnHome={() => setActiveTab('home')} theme={theme} />
                      ) : (
                        <ErrorBoundary moduleName="System Settings & Hardware Config">
                          <Settings 
                            user={user} 
                            theme={theme} 
                            themePreset={themePreset}
                            onThemePresetChange={setThemePreset}
                            onThemeChange={toggleTheme} 
                            activeTab={settingsTab}
                            onTabChange={(tab) => {
                              setSettingsTab(tab);
                              setSearchParams({ tab }, { replace: true });
                            }}
                            permissions={permissions}
                            role={role}
                            customRoleName={customRoleName}
                            onDirtyChange={setIsSettingsDirty}
                            onSyncRef={onSettingsSyncRef}
                            storeId={storeId}
                            onStoreIdChange={handleStoreIdChange}
                            subscriptionLevel={subscriptionLevel}
                          />
                        </ErrorBoundary>
                      )}
                    </motion.div>
                  } 
                />

                <Route path="*" element={<NotFoundSector onNavigateHome={() => setActiveTab('home')} theme={theme} />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>

      {/* BLOCK: Unsaved Transaction Confirmation Popup Card - Warns user when navigating away from active cart */}
      <AnimatePresence>
        {pendingTab !== null && (
          <div id="unsaved-cart-popup-card-overlay" className="unsaved-cart-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="unsaved-cart-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              className={cn(
                "popup-card unsaved-cart-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 flex flex-col gap-5 overflow-hidden z-20",
                theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="unsaved-cart-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

              <div className="popup-card__header unsaved-cart-popup-card__header flex items-start gap-4">
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
                  className="popup-card__icon unsaved-cart-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                >
                  <AlertTriangle size={24} />
                </motion.div>
                <div className="popup-card__title-group unsaved-cart-popup-card__title-group space-y-1">
                  <h3 className={cn(
                    "popup-card__title unsaved-cart-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Unsaved Transaction
                  </h3>
                  <p className="popup-card__subtitle unsaved-cart-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Staging Alert</p>
                </div>
              </div>

              <div className={cn(
                "popup-card__body unsaved-cart-popup-card__body text-sm tracking-tight leading-relaxed",
                theme === 'dark' ? "text-white/85" : "text-black/85"
              )}>
                There are currently <span className="font-bold text-red-500">{cartCount} items</span> in your Register cart. Navigating away will discard this pending transaction. Are you sure you want to proceed?
              </div>

              <div className="popup-card__footer unsaved-cart-popup-card__footer flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setPendingTab(null)}
                  className={cn(
                    "popup-card__button popup-card__button--cancel unsaved-cart-popup-card__button--stay px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
                    theme === 'dark' 
                      ? "bg-transparent border-dark-border text-white/70 hover:bg-white/5 hover:text-white"
                      : "bg-transparent border-light-border text-black/70 hover:bg-black/5 hover:text-black"
                  )}
                >
                  Stay in Register
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextTab = pendingTab;
                    setPendingTab(null);
                    setCartCount(0); // clear count
                    if (nextTab) {
                      navigate(getPathFromTab(nextTab));
                    }
                  }}
                  className="popup-card__button popup-card__button--confirm unsaved-cart-popup-card__button--discard px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white cursor-pointer"
                >
                  Discard & Proceed
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BLOCK: Settings Dirty Confirmation Popup Card - Prompts user to sync unsaved settings changes */}
      <AnimatePresence>
        {showSettingsConfirmModal && (
          <div id="settings-dirty-popup-card-overlay" className="settings-dirty-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="settings-dirty-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
              onClick={handleBackdropClick}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              className={cn(
                "popup-card settings-dirty-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 flex flex-col gap-5 overflow-hidden z-20",
                theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="settings-dirty-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-cyan-500" />

              <div className="popup-card__header settings-dirty-popup-card__header flex items-start gap-4">
                <motion.div
                  animate={isSyncingModal ? { rotate: 360 } : { rotate: [0, 15, -15, 0] }}
                  transition={isSyncingModal ? { repeat: Infinity, duration: 1.5, ease: "linear" } : { repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="popup-card__icon settings-dirty-popup-card__icon p-3 rounded-xl bg-cyan-500/10 text-cyan-500 shrink-0"
                >
                  <RefreshCw size={24} />
                </motion.div>
                <div className="popup-card__title-group settings-dirty-popup-card__title-group space-y-1">
                  <h3 className={cn(
                    "popup-card__title settings-dirty-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Unsaved Settings
                  </h3>
                  <p className="popup-card__subtitle settings-dirty-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Configuration Alert</p>
                </div>
              </div>

              <div className={cn(
                "popup-card__body settings-dirty-popup-card__body text-sm tracking-tight leading-relaxed",
                theme === 'dark' ? "text-white/85" : "text-black/85"
              )}>
                You have made changes to the system configuration. Would you like to sync these changes before leaving?
              </div>

              <div className="popup-card__footer settings-dirty-popup-card__footer flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsConfirmModal(false);
                    setPendingSettingsTab(null);
                  }}
                  className={cn(
                    "popup-card__button popup-card__button--cancel settings-dirty-popup-card__button--cancel px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
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
                    setIsSettingsDirty(false);
                    setShowSettingsConfirmModal(false);
                    if (pendingSettingsTab) {
                      navigate(getPathFromTab(pendingSettingsTab));
                      setPendingSettingsTab(null);
                    }
                  }}
                  className={cn(
                    "popup-card__button popup-card__button--discard settings-dirty-popup-card__button--discard px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
                    theme === 'dark'
                      ? "bg-red-500 hover:bg-red-600 border-transparent text-white"
                      : "bg-red-600 hover:bg-red-700 border-transparent text-white"
                  )}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncingModal(true);
                    if (onSettingsSyncRef.current) {
                      const success = await onSettingsSyncRef.current();
                      if (success) {
                        setIsSettingsDirty(false);
                        setShowSettingsConfirmModal(false);
                        if (pendingSettingsTab) {
                          navigate(getPathFromTab(pendingSettingsTab));
                          setPendingSettingsTab(null);
                        }
                      }
                    }
                    setIsSyncingModal(false);
                  }}
                  disabled={isSyncingModal}
                  className={cn(
                    "popup-card__button popup-card__button--save settings-dirty-popup-card__button--sync flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 text-white cursor-pointer",
                    theme === 'dark'
                      ? "bg-cyan-500 hover:bg-cyan-600 border border-cyan-400/20"
                      : "bg-[#062A95] hover:bg-[#062A95]/90"
                  )}
                >
                  {isSyncingModal ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
                  Sync Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

