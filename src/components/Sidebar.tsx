/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { handleBackdropClick } from '../lib/utils';
import { 
  ShoppingCart, 
  Package, 
  Settings,
  Sun,
  Moon,
  BarChart3,
  Home as HomeIcon,
  RefreshCw,
  Lock,
  Wallet,
  ChevronRight,
  User as UserIcon,
  Store,
  Shield,
  Smartphone,
  LogOut,
  AlertTriangle,
  Cpu
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

import { User, signOut } from "../lib/firebase";
import { auth } from '../lib/firebase';

interface SidebarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  inventoryModule: 'inventory' | 'vault' | 'balances';
  setInventoryModule: (module: 'inventory' | 'vault' | 'balances') => void;
  theme?: 'dark' | 'light';
  permissions?: Record<string, boolean>;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  user,
  activeTab, 
  setActiveTab, 
  inventoryModule,
  setInventoryModule,
  theme = 'dark',
  permissions = { home: true, register: true, inventory: true, reports: true, settings: true }
}) => {
  const { toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon, permission: 'home' },
    { id: 'register', label: 'Register', icon: ShoppingCart, permission: 'register' },
    { id: 'inventory', label: 'Inventory', icon: Package, permission: 'inventory' },
    { id: 'transactions', label: 'Transactions', icon: RefreshCw, permission: 'transactions' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
  ];

  const inventoryModules = [
    { id: 'inventory', label: 'INVENTORY MATRIX', icon: Package, description: 'Core Assets' },
    { id: 'vault', label: 'THE VAULT', icon: Lock, description: 'Approvals & Spend' },
    { id: 'balances', label: 'LEDGER BALANCES', icon: Wallet, description: 'Fiscal Metrics' },
  ];

  if (!user) return null;

  return (
    <>
      {/* BLOCK: Sidebar Navigation - Floating vertical menu bar detached from the edges of the screen */}
      <aside 
        className={cn(
          "sidebar-navigation sidebar-navigation--floating h-full transition-all duration-300 flex flex-col border rounded-2xl w-16 shadow-lg backdrop-blur-md",
          theme === 'dark' 
            ? "sidebar-navigation--dark bg-black/60 text-dark-text border-zinc-800/80 hover:border-zinc-700/80" 
            : "sidebar-navigation--light bg-white text-light-text border-zinc-200/80 hover:border-zinc-300"
        )}
      >
      <div className={cn(
        "sidebar-navigation__brand p-6 flex items-center justify-center border-b hidden",
        theme === 'dark' ? "border-[#333]" : "border-[#EEE]"
      )}>
        <div className={cn(
          "sidebar-navigation__brand-logo w-10 h-10 rounded-lg flex items-center justify-center transform rotate-3 shadow-lg",
          theme === 'dark' ? "bg-[#E4E3E0]" : "bg-[#141414]"
        )}>
          <span className={cn(
            "sidebar-navigation__brand-text font-black text-2xl",
            theme === 'dark' ? "text-[#141414]" : "text-white"
          )}>A</span>
        </div>
      </div>

      <nav className="sidebar-navigation__nav flex-1 px-3 py-5 space-y-3 flex flex-col items-center overflow-visible w-full min-h-0">
        {navItems.filter(item => permissions && permissions[item.permission as keyof typeof permissions]).map((item) => (
          <div 
            key={item.id} 
            className="sidebar-navigation__item relative group w-full flex justify-center"
          >
            {activeTab === item.id && (
              <motion.div
                layoutId="active-indicator"
                className={cn(
                  "sidebar-navigation__active-line absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full z-10",
                  theme === 'dark' ? "bg-brand-primary" : "bg-[#062A95]"
                )}
              />
            )}
            <button
               onClick={() => {
                 setActiveTab(item.id);
               }}
               className={cn(
                 "sidebar-navigation__button p-2.5 rounded-lg transition-all duration-300 group relative flex items-center justify-center",
                 activeTab === item.id 
                   ? (theme === 'dark' ? "sidebar-navigation__button--active bg-brand-primary text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]" : "sidebar-navigation__button--active bg-[#062A95] text-white shadow-lg shadow-[#062A95]/30")
                   : (theme === 'dark' ? "text-dark-muted hover:text-white hover:bg-white/5" : "text-light-muted hover:text-[#062A95] hover:bg-[#062A95]/10")
               )}
             >
               <motion.div
                 whileHover={{ scale: 1.1 }}
                 whileTap={
                   item.id === 'home' ? { y: -5, scale: 0.9 } :
                   item.id === 'register' ? { rotate: -15, scale: 0.9 } :
                   item.id === 'inventory' ? { scale: 0.8, rotate: 5 } :
                   item.id === 'reports' ? { scaleY: 1.3, scaleX: 0.8 } :
                   { scale: 0.9 }
                 }
                 transition={{ type: "spring", stiffness: 400, damping: 10 }}
                 className="sidebar-navigation__icon-wrapper flex items-center justify-center"
               >
                 {item.id === 'inventory' ? (
                   inventoryModule === 'vault' ? <Lock size={20} /> : 
                   inventoryModule === 'balances' ? <Wallet size={20} /> : 
                   <Package size={20} />
                 ) : (
                   <item.icon size={20} />
                 )}
               </motion.div>
             </button>
             
             {/* Tooltip */}
             <div className={cn(
               "sidebar-navigation__tooltip absolute left-full ml-4 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 z-50 pointer-events-none shadow-xl whitespace-nowrap",
               theme === 'dark' ? "bg-white text-black" : "bg-black text-white"
             )}>
               {item.id === 'inventory' ? 
                 (inventoryModule === 'vault' ? 'The Vault' : inventoryModule === 'balances' ? 'Ledger' : 'Inventory') 
                 : item.label}
             </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-navigation__footer p-2.5 space-y-3 flex flex-col items-center pb-8 shrink-0 w-full mt-auto">
        <div className={cn(
          "sidebar-navigation__divider w-6 h-[1px] mb-2",
          theme === 'dark' ? "bg-dark-border" : "bg-light-border"
        )} />

        <div className="sidebar-navigation__item relative group w-full flex justify-center">
          {activeTab === 'settings' && (
            <motion.div
              layoutId="active-indicator"
              className={cn(
                "sidebar-navigation__active-line absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full z-10",
                theme === 'dark' ? "bg-brand-primary" : "bg-[#062A95]"
              )}
            />
          )}
          <button 
             onClick={() => setActiveTab('settings')}
             className={cn(
               "sidebar-navigation__button p-2.5 rounded-lg transition-all duration-300 group relative flex items-center justify-center",
               activeTab === 'settings' 
                 ? (theme === 'dark' ? "sidebar-navigation__button--active bg-brand-primary text-black shadow-lg" : "sidebar-navigation__button--active bg-[#062A95] text-white shadow-lg shadow-[#062A95]/30")
                 : (theme === 'dark' ? "text-dark-muted hover:text-white hover:bg-white/5" : "text-light-muted hover:text-[#062A95] hover:bg-[#062A95]/10")
             )}
           >
             <motion.div 
               whileHover={{ rotate: 45 }} 
               whileTap={{ rotate: 360, scale: 0.8 }}
               transition={{ type: "spring", stiffness: 200, damping: 15 }}
             >
               <Settings size={20} />
             </motion.div>
           </button>
           <div className={cn(
              "sidebar-navigation__tooltip absolute left-full ml-4 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 z-50 pointer-events-none shadow-xl whitespace-nowrap",
              theme === 'dark' ? "bg-white text-black" : "bg-black text-white"
            )}>
              Settings
            </div>
        </div>

        <div className="sidebar-navigation__item relative group w-full flex justify-center">
          <button 
            onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "sidebar-navigation__button p-2.5 rounded-lg transition-all duration-300 group relative flex items-center justify-center",
              theme === 'dark' ? "text-dark-muted hover:text-white hover:bg-white/5" : "text-light-muted hover:text-black hover:bg-black/5"
            )}
          >
            <motion.div 
              whileHover={{ rotate: 15 }} 
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </motion.div>
          </button>
          <div className={cn(
            "sidebar-navigation__tooltip absolute left-full ml-4 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 z-50 pointer-events-none shadow-xl whitespace-nowrap",
            theme === 'dark' ? "bg-white text-black" : "bg-black text-white"
          )}>
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </div>
        </div>

        <div className="sidebar-navigation__item relative group w-full flex justify-center">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className={cn(
              "sidebar-navigation__button p-2.5 rounded-lg transition-all duration-300 group relative flex items-center justify-center cursor-pointer",
              theme === 'dark' ? "text-dark-muted hover:text-red-400 hover:bg-red-500/10" : "text-light-muted hover:text-red-600 hover:bg-red-50"
            )}
          >
            <motion.div 
              whileHover={{ x: 2 }} 
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <LogOut size={20} />
            </motion.div>
          </button>
          <div className={cn(
            "sidebar-navigation__tooltip absolute left-full ml-4 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0 z-50 pointer-events-none shadow-xl whitespace-nowrap",
            theme === 'dark' ? "bg-white text-black" : "bg-black text-white"
          )}>
            Logout
          </div>
        </div>
      </div>
    </aside>

    {/* BLOCK: Logout Confirmation Popup Card - Confirms session termination with user */}
    <AnimatePresence>
      {showLogoutConfirm && (
        <div id="logout-popup-card-overlay" className="logout-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="logout-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className={cn(
              "popup-card logout-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
              theme === 'dark' 
                ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" 
                : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
            )}
          >
            {/* Top Accent Strip */}
            <div className="logout-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

            <div className="popup-card__header logout-popup-card__header flex items-start gap-4">
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
                className="popup-card__icon logout-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
              >
                <AlertTriangle size={24} />
              </motion.div>
              <div className="popup-card__title-group logout-popup-card__title-group space-y-1">
                <h3 className={cn(
                  "popup-card__title logout-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>
                  Confirm Logout
                </h3>
                <p className="popup-card__subtitle logout-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Session Termination</p>
              </div>
            </div>

            <div className={cn(
              "popup-card__body logout-popup-card__body text-sm tracking-tight leading-relaxed",
              theme === 'dark' ? "text-white/85" : "text-black/85"
            )}>
              Are you sure you want to end your active session and sign out of megapos? Your active register settings and staged connections will be secured.
            </div>

            <div className="popup-card__footer logout-popup-card__footer flex gap-2 justify-end mt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className={cn(
                  "popup-card__button popup-card__button--cancel logout-popup-card__button--keep px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
                  theme === 'dark' 
                    ? "bg-transparent border-dark-border text-white/70 hover:bg-white/5 hover:text-white"
                    : "bg-transparent border-light-border text-black/70 hover:bg-black/5 hover:text-black"
                )}
              >
                Keep Session
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  signOut(auth);
                }}
                className="popup-card__button popup-card__button--confirm logout-popup-card__button--signout px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md shadow-red-500/10 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
};
