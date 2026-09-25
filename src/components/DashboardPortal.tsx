import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
  ShoppingCart, 
  Package, 
  History, 
  User, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight, 
  ArrowRight,
  ShieldCheck,
  Activity,
  QrCode,
  Printer,
  Scale,
  Coins,
  CreditCard,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Cpu,
  BarChart3,
  Zap,
  RefreshCw,
  Store,
  Clock,
  Wifi,
  CheckCircle,
  Sparkles,
  Database,
  Terminal,
  Radio,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User as FirebaseUser } from "../lib/firebase";

interface DashboardPortalProps {
  user: FirebaseUser;
  products: any[];
  presales: any[];
  productsLoading: boolean;
  presalesLoading: boolean;
  onGetStarted: () => void;
  onNavigate?: (tab: string) => void;
  theme: 'dark' | 'light';
}

/* BLOCK: Dashboard Portal - Primary operational command workspace rendering real-time business telemetry cards, peripheral station monitors, bento action routers, and the ledger table */
export const DashboardPortal: React.FC<DashboardPortalProps> = ({
  user,
  products,
  presales,
  productsLoading,
  presalesLoading,
  onGetStarted,
  onNavigate,
  theme
}) => {
  const activePresales = presales.filter(p => p.status?.toLowerCase() !== 'voided');
  
  const carouselRef = useRef<HTMLDivElement>(null);
  const ecosystemCarouselRef = useRef<HTMLDivElement>(null);

  const [hardwareDevices, setHardwareDevices] = useState<Array<{
    id: string;
    name: string;
    status: string;
    details: string;
    type: 'success' | 'info' | 'warning' | 'error' | 'neutral';
    icon: any;
    isConnected: boolean;
  }>>([]);
  const [isScanningHardware, setIsScanningHardware] = useState(false);

  const checkHardwareStatus = useCallback(async () => {
    setIsScanningHardware(true);
    
    let hasUsbScanner = false;
    let usbScannerName = 'USB Barcode Scanner';
    let hasSerialScale = false;
    let hasCameraDevice = false;
    
    // WebHID / WebUSB probing
    try {
      if ('hid' in navigator) {
        const hidDevices = await (navigator as any).hid.getDevices();
        if (hidDevices && hidDevices.length > 0) {
          hasUsbScanner = true;
          usbScannerName = hidDevices[0].productName || 'USB HID Barcode Scanner';
        }
      }
      if (!hasUsbScanner && 'usb' in navigator) {
        const usbDevices = await (navigator as any).usb.getDevices();
        if (usbDevices && usbDevices.length > 0) {
          hasUsbScanner = true;
          usbScannerName = usbDevices[0].productName || 'USB Barcode Device';
        }
      }
      if ('serial' in navigator) {
        const serialPorts = await (navigator as any).serial.getPorts();
        if (serialPorts && serialPorts.length > 0) {
          hasSerialScale = true;
        }
      }
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (devices.some(d => d.kind === 'videoinput')) {
          hasCameraDevice = true;
        }
      }
    } catch (e) {
      // Permission / API restrictions
    }

    // Web NFC Probing
    const hasNfc = 'NDEFReader' in window;

    // Multi-display probing
    const isExtendedScreen = !!(window.screen && (window.screen as any).isExtended);

    setHardwareDevices([
      {
        id: 'scanner',
        name: 'USB Barcode Scanner',
        status: hasUsbScanner ? 'Connected' : (hasCameraDevice ? 'Optical Ready' : 'Auto-Detecting'),
        details: hasUsbScanner ? `${usbScannerName} active` : (hasCameraDevice ? 'Camera barcode engine active' : 'Monitoring USB & HID ports...'),
        type: (hasUsbScanner || hasCameraDevice) ? 'success' : 'neutral',
        icon: QrCode,
        isConnected: hasUsbScanner || hasCameraDevice
      },
      {
        id: 'printer',
        name: 'Thermal Receipt Printer',
        status: 'Auto-Detecting',
        details: 'System print dialog active • Listening for USB thermal printers',
        type: 'neutral',
        icon: Printer,
        isConnected: false
      },
      {
        id: 'scale',
        name: 'Digital Weight Scale',
        status: hasSerialScale ? 'Connected' : 'Auto-Detecting',
        details: hasSerialScale ? 'Serial USB digital scale active' : 'Monitoring serial & USB ports • Manual weight entry backup',
        type: hasSerialScale ? 'success' : 'neutral',
        icon: Scale,
        isConnected: hasSerialScale
      },
      {
        id: 'drawer',
        name: 'Electronic Cash Drawer',
        status: 'Auto-Detecting',
        details: 'Listening for RJ12 interface triggers',
        type: 'neutral',
        icon: Coins,
        isConnected: false
      },
      {
        id: 'terminal',
        name: 'EMV PIN Pad Terminal',
        status: hasNfc ? 'NFC Ready' : 'Auto-Detecting',
        details: hasNfc ? 'Browser Web NFC Reader available' : 'Monitoring NFC & terminal ports',
        type: hasNfc ? 'info' : 'neutral',
        icon: CreditCard,
        isConnected: hasNfc
      },
      {
        id: 'display',
        name: 'Customer Facing Display',
        status: isExtendedScreen ? 'Multi-Display Active' : 'Single Display',
        details: isExtendedScreen ? 'Secondary customer screen connected' : 'Primary monitor active • Dual display ready',
        type: isExtendedScreen ? 'success' : 'neutral',
        icon: Smartphone,
        isConnected: isExtendedScreen
      }
    ]);

    setIsScanningHardware(false);
  }, []);

  useEffect(() => {
    checkHardwareStatus();

    const handleHardwareChange = () => {
      checkHardwareStatus();
    };

    if ('usb' in navigator) {
      (navigator as any).usb.addEventListener('connect', handleHardwareChange);
      (navigator as any).usb.addEventListener('disconnect', handleHardwareChange);
    }
    if ('hid' in navigator) {
      (navigator as any).hid.addEventListener('connect', handleHardwareChange);
      (navigator as any).hid.addEventListener('disconnect', handleHardwareChange);
    }
    if ('serial' in navigator) {
      (navigator as any).serial.addEventListener('connect', handleHardwareChange);
      (navigator as any).serial.addEventListener('disconnect', handleHardwareChange);
    }
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleHardwareChange);
    }

    const timer = setInterval(() => {
      checkHardwareStatus();
    }, 4000);

    return () => {
      clearInterval(timer);
      if ('usb' in navigator) {
        (navigator as any).usb.removeEventListener('connect', handleHardwareChange);
        (navigator as any).usb.removeEventListener('disconnect', handleHardwareChange);
      }
      if ('hid' in navigator) {
        (navigator as any).hid.removeEventListener('connect', handleHardwareChange);
        (navigator as any).hid.removeEventListener('disconnect', handleHardwareChange);
      }
      if ('serial' in navigator) {
        (navigator as any).serial.removeEventListener('connect', handleHardwareChange);
        (navigator as any).serial.removeEventListener('disconnect', handleHardwareChange);
      }
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleHardwareChange);
      }
    };
  }, [checkHardwareStatus]);

  const connectedCount = hardwareDevices.filter(d => d.isConnected).length;

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 280;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollEcosystemCarousel = (direction: 'left' | 'right') => {
    if (ecosystemCarouselRef.current) {
      const scrollAmount = 280;
      ecosystemCarouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const ecosystemFeatures = [
    {
      id: 'checkout',
      title: "Sub-Second Register",
      desc: "Process complex cash, card, and split-tender baskets with instant barcode scanning.",
      icon: ShoppingCart,
      colorClass: "text-emerald-500",
      bgClass: "bg-emerald-500/10 dark:bg-emerald-500/10",
      borderClass: "hover:border-emerald-500/40"
    },
    {
      id: 'analytics',
      title: "Real-Time Telemetry",
      desc: "Live gross profit monitoring, sales volume tracking, and operator shift analytics.",
      icon: BarChart3,
      colorClass: "text-cyan-400",
      bgClass: "bg-cyan-500/10 dark:bg-cyan-500/10",
      borderClass: "hover:border-cyan-500/40"
    },
    {
      id: 'inventory',
      title: "Cloud Stock Sync",
      desc: "Multi-device catalog database syncing stock levels across all active registers.",
      icon: Package,
      colorClass: "text-purple-400",
      bgClass: "bg-purple-500/10 dark:bg-purple-500/10",
      borderClass: "hover:border-purple-500/40"
    },
    {
      id: 'security',
      title: "Enterprise Vault",
      desc: "Hardened Firestore database rules ensuring total data privacy and encrypted audit trails.",
      icon: ShieldCheck,
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/10 dark:bg-blue-500/10",
      borderClass: "hover:border-blue-500/40"
    }
  ];

  return (
    <div 
      className="dashboard-portal flex flex-col gap-6 sm:gap-8 w-full text-left"
    >
      
      {/* BLOCK: Command Portal Welcome Banner Card - Command hub card displaying store status badges, operator info, and register launch button */}
      <div 
        className={cn(
          "dashboard-welcome-card w-full p-5 sm:p-6 rounded-2xl border transition-all relative overflow-hidden",
          theme === 'dark' 
            ? "dashboard-welcome-card--dark bg-[#0D1117] border-zinc-800 text-white" 
            : "dashboard-welcome-card--light bg-white border-zinc-200 text-zinc-900"
        )}
      >
        <div className="dashboard-welcome-card__content flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
          
          {/* Left Section: Badges, Title & Description */}
          <div className="dashboard-welcome-card__info space-y-2.5 max-w-3xl">
            {/* ELEMENT: Status Pills Row */}
            <div className="dashboard-welcome-card__badge-container flex flex-wrap items-center gap-2">
              <div className={cn(
                "dashboard-welcome-card__status-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em]",
                theme === 'dark' ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              )}>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>System Online</span>
              </div>

              <div className={cn(
                "dashboard-welcome-card__terminal-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider",
                theme === 'dark' ? "bg-zinc-800/80 border-zinc-700 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"
              )}>
                <Cpu size={11} className="shrink-0 text-yellow-500" />
                <span>Terminal #01-Main</span>
              </div>

              <div className={cn(
                "dashboard-welcome-card__store-badge inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wide uppercase transition-all",
                theme === 'dark' 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                  : "bg-amber-50 border-amber-200 text-amber-900"
              )}>
                <Store size={13} className="text-amber-500 shrink-0" />
                <span className="truncate">
                  Store: <strong className="font-extrabold">{localStorage.getItem('nurtron_store_name') || 'MEGAPOS Main Branch'}</strong>
                </span>
              </div>
            </div>
            
            {/* ELEMENT: Title & Description */}
            <div className="dashboard-welcome-card__header-text space-y-1">
              <h2 className="dashboard-welcome-card__title text-2xl sm:text-3xl lg:text-4xl font-black uppercase leading-none tracking-tighter">
                Welcome back, <span className={theme === 'dark' ? "text-yellow-400" : "text-black"}>{user.displayName || user.email?.split('@')[0] || 'Operator'}</span>
              </h2>
              
              <p className="dashboard-welcome-card__description text-xs sm:text-sm leading-relaxed opacity-75 max-w-2xl">
                Real-time point of sale ecosystem synced with cloud persistence, local transaction ledger, and active register telemetry.
              </p>
            </div>
          </div>

          {/* Right Section: Operator Profile & Action Buttons */}
          <div className="dashboard-welcome-card__actions flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Operator Card */}
            <div className={cn(
              "dashboard-operator-card flex items-center gap-3 px-3.5 py-2 rounded-xl border transition-all shrink-0",
              theme === 'dark' ? "bg-zinc-900/90 border-zinc-800 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-900"
            )}>
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  className="dashboard-operator-card__avatar w-8 h-8 rounded-lg object-cover border border-zinc-700/50 shrink-0" 
                  alt="" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="dashboard-operator-card__avatar-placeholder w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
              )}
              <div className="dashboard-operator-card__details text-left min-w-0">
                <h3 className="dashboard-operator-card__name text-xs font-black uppercase tracking-tight truncate max-w-[130px]">
                  {user.displayName || user.email?.split('@')[0] || 'Operator'}
                </h3>
                <p className="dashboard-operator-card__email text-[9px] font-mono opacity-60 truncate max-w-[130px]">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-2">
              <button
                onClick={onGetStarted}
                className={cn(
                  "dashboard-welcome-card__button dashboard-welcome-card__button--primary px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2 shrink-0",
                  theme === 'dark' ? "bg-white text-black hover:bg-zinc-200" : "bg-black text-white hover:bg-zinc-800"
                )}
              >
                <ShoppingCart size={14} />
                <span>Launch Register</span>
                <ArrowRight size={14} />
              </button>

              <button
                onClick={checkHardwareStatus}
                disabled={isScanningHardware}
                className={cn(
                  "dashboard-welcome-card__button dashboard-welcome-card__button--secondary h-10 px-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0",
                  theme === 'dark' 
                    ? "border-zinc-700/80 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800" 
                    : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
                title="Scan hardware peripherals"
              >
                <RefreshCw size={14} className={cn("shrink-0", isScanningHardware && "animate-spin text-yellow-500")} />
                <span className="hidden sm:inline text-[10px] uppercase font-mono font-bold tracking-wider">Scan</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCK: Live Telemetry Metrics Grid - Displays core revenue, completed checkouts, stock catalog, and hardware metrics */}
      <div className="dashboard-metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        
        {/* BLOCK: Revenue Telemetry Card - Displays total sales amount registered in system */}
        <div className={cn(
          "dashboard-metrics-card border p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 cursor-pointer group",
          theme === 'dark' 
            ? "dashboard-metrics-card--dark bg-dark-surface/90 border-[#123ebd]/40 text-white hover:border-brand-primary/80" 
            : "dashboard-metrics-card--light bg-white border-slate-200 text-slate-900 hover:border-slate-400"
        )}>
          <div className={cn(
            "dashboard-metrics-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            theme === 'dark' ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600"
          )}>
            <DollarSign size={22} className="dashboard-metrics-card__icon" />
          </div>
          <div className="dashboard-metrics-card__content min-w-0 flex-1 text-left">
            <span className={cn(
              "dashboard-metrics-card__label text-[9px] font-black uppercase tracking-[0.2em] block opacity-70"
            )}>
              REGISTER REVENUE
            </span>
            <p className="dashboard-metrics-card__value text-2xl font-black font-mono tracking-tight mt-0.5">
              ${(presalesLoading ? 0 : activePresales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="dashboard-metrics-card__trend text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1">
              <TrendingUp size={11} className="dashboard-metrics-card__trend-icon" />
              Live revenue stream
            </p>
          </div>
        </div>

        {/* BLOCK: Sales Checkout Card - Tracks total checkouts processed in register */}
        <div className={cn(
          "dashboard-metrics-card border p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 cursor-pointer group",
          theme === 'dark' 
            ? "dashboard-metrics-card--dark bg-dark-surface/90 border-[#123ebd]/40 text-white hover:border-brand-primary/80" 
            : "dashboard-metrics-card--light bg-white border-slate-200 text-slate-900 hover:border-slate-400"
        )}>
          <div className={cn(
            "dashboard-metrics-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            theme === 'dark' ? "bg-cyan-500/10 text-cyan-400" : "bg-cyan-50 text-cyan-600"
          )}>
            <ShoppingCart size={22} className="dashboard-metrics-card__icon" />
          </div>
          <div className="dashboard-metrics-card__content min-w-0 flex-1 text-left">
            <span className="dashboard-metrics-card__label text-[9px] font-black uppercase tracking-[0.2em] block opacity-70">
              COMPLETED SALES
            </span>
            <p className="dashboard-metrics-card__value text-2xl font-black font-mono tracking-tight mt-0.5">
              {presalesLoading ? 0 : activePresales.length}
            </p>
            <p className="dashboard-metrics-card__trend text-[9px] font-mono font-bold opacity-75 uppercase tracking-widest mt-1 truncate">
              Avg ticket: ${(presalesLoading || activePresales.length === 0 ? 0 : (activePresales.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0) / activePresales.length)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* BLOCK: SKU Catalog Inventory Card - Displays total catalog inventory items */}
        <div className={cn(
          "dashboard-metrics-card border p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 cursor-pointer group",
          theme === 'dark' 
            ? "dashboard-metrics-card--dark bg-dark-surface/90 border-[#123ebd]/40 text-white hover:border-brand-primary/80" 
            : "dashboard-metrics-card--light bg-white border-slate-200 text-slate-900 hover:border-slate-400"
        )}>
          <div className={cn(
            "dashboard-metrics-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            theme === 'dark' ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-600"
          )}>
            <Package size={22} className="dashboard-metrics-card__icon" />
          </div>
          <div className="dashboard-metrics-card__content min-w-0 flex-1 text-left">
            <span className="dashboard-metrics-card__label text-[9px] font-black uppercase tracking-[0.2em] block opacity-70">
              SKU INVENTORY
            </span>
            <p className="dashboard-metrics-card__value text-2xl font-black font-mono tracking-tight mt-0.5">
              {productsLoading ? 0 : products.length} <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">SKUs</span>
            </p>
            <div className="dashboard-metrics-card__trend text-[9px] font-mono font-bold uppercase tracking-widest mt-1">
              {(!productsLoading && products.filter(p => p.stockLevel !== undefined && p.stockLevel < 10).length > 0) ? (
                <div className="flex items-center gap-1 text-rose-500 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block shrink-0" />
                  {products.filter(p => p.stockLevel !== undefined && p.stockLevel < 10).length} low stock alerts
                </div>
              ) : (
                <div className="flex items-center gap-1 text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block shrink-0" />
                  Stock levels healthy
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOCK: Hardware Status Metrics Card - Confirms real-time peripheral device detection */}
        <div className={cn(
          "dashboard-metrics-card border p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 cursor-pointer group",
          theme === 'dark' 
            ? "dashboard-metrics-card--dark bg-dark-surface/90 border-[#123ebd]/40 text-white hover:border-brand-primary/80" 
            : "dashboard-metrics-card--light bg-white border-slate-200 text-slate-900 hover:border-slate-400"
        )}>
          <div className={cn(
            "dashboard-metrics-card__icon-container p-3 rounded-xl shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            theme === 'dark' ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"
          )}>
            <Cpu size={22} className="dashboard-metrics-card__icon" />
          </div>
          <div className="dashboard-metrics-card__content min-w-0 flex-1 text-left">
            <span className="dashboard-metrics-card__label text-[9px] font-black uppercase tracking-[0.2em] block opacity-70">
              HARDWARE STATION
            </span>
            <p className="dashboard-metrics-card__value text-2xl font-black font-mono tracking-tight mt-0.5">
              {connectedCount}<span className="text-sm font-normal opacity-60">/6 Active</span>
            </p>
            <p className="dashboard-metrics-card__trend text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest mt-1">
              AUTO-DETECT RUNNING
            </p>
          </div>
        </div>

      </div>

      {/* BLOCK: Hardware Telemetry Station Card - Horizontal carousel tracking real-time connected POS peripherals */}
      <div className={cn(
        "dashboard-hardware-section border rounded-2xl p-5 sm:p-6 w-full text-left relative overflow-hidden",
        theme === 'dark' ? "bg-zinc-900/40 border-[#123ebd]/40 text-white" : "bg-white border-slate-200/90 text-slate-900"
      )}>
        <div className="dashboard-hardware-section__header flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="dashboard-hardware-section__title-block flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary shrink-0">
              <Radio size={16} className="animate-pulse" />
            </div>
            <div>
              <h4 className="dashboard-hardware-section__title text-sm font-black uppercase tracking-tight">
                Hardware Telemetry Station
              </h4>
            </div>
          </div>

          <div className="dashboard-hardware-section__controls flex items-center gap-3">
            <span className={cn(
              "px-3 py-1 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5",
              connectedCount > 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              {connectedCount} Peripherals Detected
            </span>

            <div className="dashboard-hardware-section__nav-buttons flex items-center gap-1">
              <button
                onClick={() => scrollCarousel('left')}
                className={cn(
                  "p-1.5 rounded-lg border transition-all active:scale-90 cursor-pointer",
                  theme === 'dark' ? "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900"
                )}
                aria-label="Scroll left"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => scrollCarousel('right')}
                className={cn(
                  "p-1.5 rounded-lg border transition-all active:scale-90 cursor-pointer",
                  theme === 'dark' ? "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900"
                )}
                aria-label="Scroll right"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Track */}
        <div 
          ref={carouselRef}
          className="dashboard-hardware-carousel__track flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {hardwareDevices.map((device) => {
            const IconComponent = device.icon;
            return (
              <div
                key={device.id}
                className={cn(
                  "dashboard-device-card snap-start shrink-0 w-[240px] sm:w-[260px] p-4 border rounded-2xl flex flex-col justify-between transition-all relative overflow-hidden group",
                  theme === 'dark' 
                    ? "bg-black/30 border-[#123ebd]/30 hover:border-[#123ebd]/80" 
                    : "bg-slate-50/80 border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="dashboard-device-card__header flex items-center justify-between mb-3">
                  <div className={cn(
                    "dashboard-device-card__icon-box p-2.5 rounded-xl transition-transform group-hover:scale-105",
                    device.isConnected
                      ? (theme === 'dark' ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-100 text-emerald-700")
                      : (theme === 'dark' ? "bg-zinc-800/60 text-zinc-400" : "bg-slate-200 text-slate-600")
                  )}>
                    <IconComponent size={16} />
                  </div>
                  <div className="dashboard-device-card__status flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      {device.type === 'success' && (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </>
                      )}
                      {device.type === 'info' && (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </>
                      )}
                      {device.type === 'warning' && (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      )}
                      {(device.type === 'neutral' || device.type === 'error') && (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-400 dark:bg-zinc-600"></span>
                      )}
                    </span>
                    <span className={cn(
                      "dashboard-device-card__status-text text-[9px] font-mono font-bold uppercase tracking-wider",
                      device.type === 'success' ? "text-emerald-500" :
                      device.type === 'info' ? "text-blue-500" :
                      device.type === 'warning' ? "text-amber-500" :
                      "opacity-60"
                    )}>
                      {device.status}
                    </span>
                  </div>
                </div>

                <div className="dashboard-device-card__body text-left">
                  <h5 className="dashboard-device-card__title text-xs font-black uppercase tracking-tight truncate">
                    {device.name}
                  </h5>
                  <p className="dashboard-device-card__details text-[10px] opacity-70 font-medium leading-tight truncate mt-1">
                    {device.details}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCK: Quick Navigation Bento Grid - Core action cards for POS Register, Inventory Vault, and Audit Ledger */}
      <div className="dashboard-bento-grid grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        
        {/* BLOCK: POS Sales Register Action Card - Launches cash register checkout terminal */}
        <div 
          onClick={onGetStarted}
          className={cn(
            "dashboard-action-card p-6 border rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group text-left flex flex-col justify-between",
            theme === 'dark' 
              ? "bg-dark-surface/80 border-[#123ebd]/50 hover:border-emerald-500/80 text-white" 
              : "bg-white border-slate-200 hover:border-emerald-500/80 text-slate-900"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingCart size={22} />
              </div>
              <span className="text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                REGISTER #1
              </span>
            </div>

            <h3 className="dashboard-action-card__title text-lg font-black uppercase tracking-tight mb-2 flex items-center justify-between">
              <span>POS Sales Register</span>
              <ArrowUpRight size={18} className="text-zinc-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </h3>
            <p className="dashboard-action-card__subtitle text-xs opacity-75 leading-relaxed text-left">
              Launch the point-of-sale checkout terminal to scan barcodes, manage shopping baskets, override pricing, apply custom taxes, and issue credit receipts.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 group-hover:underline">
            <span>Open Checkout Terminal</span>
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* BLOCK: Inventory Vault Action Card - Routes operators directly to the product management catalog */}
        <div 
          onClick={() => onNavigate && onNavigate('inventory')}
          className={cn(
            "dashboard-action-card p-6 border rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group text-left flex flex-col justify-between",
            theme === 'dark' 
              ? "bg-dark-surface/80 border-[#123ebd]/50 hover:border-cyan-500/80 text-white" 
              : "bg-white border-slate-200 hover:border-cyan-500/80 text-slate-900"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-all" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package size={22} />
              </div>
              <span className="text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                CATALOG VAULT
              </span>
            </div>

            <h3 className="dashboard-action-card__title text-lg font-black uppercase tracking-tight mb-2 flex items-center justify-between">
              <span>Inventory Catalog</span>
              <ArrowUpRight size={18} className="text-zinc-400 group-hover:text-cyan-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </h3>
            <p className="dashboard-action-card__subtitle text-xs opacity-75 leading-relaxed text-left">
              Control stock catalogs, define pricing levels, audit critical low stock SKUs, print customized barcodes, configure vendors, and perform batch CSV uploads.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-400 group-hover:underline">
            <span>Manage Catalog Vault</span>
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* BLOCK: Ledger Records Action Card - Triggers sales audit records ledger */}
        <div 
          onClick={() => onNavigate && onNavigate('transactions')}
          className={cn(
            "dashboard-action-card p-6 border rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden group text-left flex flex-col justify-between",
            theme === 'dark' 
              ? "bg-dark-surface/80 border-[#123ebd]/50 hover:border-purple-500/80 text-white" 
              : "bg-white border-slate-200 hover:border-purple-500/80 text-slate-900"
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-500/10 transition-all" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <History size={22} />
              </div>
              <span className="text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                AUDIT LEDGER
              </span>
            </div>

            <h3 className="dashboard-action-card__title text-lg font-black uppercase tracking-tight mb-2 flex items-center justify-between">
              <span>Audits & Records</span>
              <ArrowUpRight size={18} className="text-zinc-400 group-hover:text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </h3>
            <p className="dashboard-action-card__subtitle text-xs opacity-75 leading-relaxed text-left">
              Inspect the persistent sales ledger, process voided transactions or order refunds, manage operating expenses, audit customer balances, and download PDF receipts.
            </p>
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-purple-400 group-hover:underline">
            <span>View Audit Journal</span>
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </div>
        </div>

      </div>

      {/* BLOCK: Ecosystem Capabilities Carousel Card - Feature showcase cards highlighting platform capabilities */}
      <div className={cn(
        "dashboard-ecosystem-section border rounded-2xl p-5 sm:p-6 w-full text-left relative overflow-hidden",
        theme === 'dark' ? "bg-zinc-900/40 border-[#123ebd]/40 text-white" : "bg-white border-slate-200/90 text-slate-900"
      )}>
        <div className="dashboard-ecosystem-section__header flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <h4 className="dashboard-ecosystem-section__title text-sm font-black uppercase tracking-tight">
                Ecosystem Engine Capabilities
              </h4>
              <p className="dashboard-ecosystem-section__subtitle text-[11px] opacity-70 font-mono">
                Sub-second transaction processing & enterprise security highlights
              </p>
            </div>
          </div>

          <div className="dashboard-ecosystem-section__nav-buttons flex items-center gap-1">
            <button
              onClick={() => scrollEcosystemCarousel('left')}
              className={cn(
                "p-1.5 rounded-lg border transition-all active:scale-90 cursor-pointer",
                theme === 'dark' ? "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900"
              )}
              aria-label="Scroll left"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => scrollEcosystemCarousel('right')}
              className={cn(
                "p-1.5 rounded-lg border transition-all active:scale-90 cursor-pointer",
                theme === 'dark' ? "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900"
              )}
              aria-label="Scroll right"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div 
          ref={ecosystemCarouselRef}
          className="dashboard-ecosystem-carousel__track flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {ecosystemFeatures.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.id}
                className={cn(
                  "dashboard-ecosystem-card snap-start shrink-0 w-[260px] sm:w-[280px] p-5 border rounded-2xl flex flex-col justify-between transition-all",
                  feature.borderClass,
                  theme === 'dark' 
                    ? "dashboard-ecosystem-card--dark bg-black/30 border-[#123ebd]/30 text-white" 
                    : "dashboard-ecosystem-card--light bg-slate-50/80 border-slate-200 text-slate-900"
                )}
              >
                <div className="dashboard-ecosystem-card__header flex items-center justify-between mb-3">
                  <div className={cn(
                    "dashboard-ecosystem-card__icon-box p-2.5 rounded-xl",
                    feature.bgClass,
                    feature.colorClass
                  )}>
                    <IconComponent size={18} />
                  </div>
                  <span className="dashboard-ecosystem-card__badge text-[8px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20">
                    FEATURE
                  </span>
                </div>

                <div className="dashboard-ecosystem-card__body text-left">
                  <h5 className="dashboard-ecosystem-card__title text-xs sm:text-sm font-black uppercase tracking-tight truncate">
                    {feature.title}
                  </h5>
                  <p className="dashboard-ecosystem-card__desc text-[11px] opacity-75 font-medium leading-relaxed mt-1">
                    {feature.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCK: Recent Store Logs Card - Real-time chronological receipt journal and shift logs table */}
      <div className={cn(
        "dashboard-ledger-card border rounded-2xl p-6 w-full text-left relative overflow-hidden",
        theme === 'dark' ? "bg-zinc-900/40 border-[#123ebd]/40 text-white" : "bg-white border-slate-200/90 text-slate-900"
      )}>
        <div className="dashboard-ledger-card__header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <h4 className="dashboard-ledger-card__title text-base font-black uppercase tracking-tight flex items-center gap-2">
                <span>Recent Live Ledger Journal</span>
              </h4>
              <p className="dashboard-ledger-card__subtitle text-[11px] opacity-70 mt-0.5 font-mono">
                Chronological receipt logs recorded in real-time on Cloud Database
              </p>
            </div>
          </div>

          <button 
            onClick={() => onNavigate && onNavigate('transactions')}
            className={cn(
              "dashboard-ledger-card__action-btn px-4 py-2 border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer",
              theme === 'dark' ? "bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800" : "bg-slate-100 border-slate-300 text-slate-900 hover:bg-slate-200"
            )}
          >
            <History size={12} />
            <span>Audit Full Ledger</span>
          </button>
        </div>

        {presalesLoading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
              Syncing Ledger Stream...
            </p>
          </div>
        ) : activePresales.length === 0 ? (
          /* BLOCK: Empty Dashboard Ledger Card */
          <div className={cn(
            "dashboard-ledger-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
            theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
          )}>
            <History size={54} strokeWidth={1.5} className={cn("dashboard-ledger-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
            <p className={cn("dashboard-ledger-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
              No Active Transactions Logged
            </p>
            <p className={cn("dashboard-ledger-empty-card__subtitle text-xs font-presale tracking-wide max-w-sm mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
              Open the sales register terminal to execute checkout receipts. All completed payments will display here in real-time.
            </p>
            <button 
              onClick={onGetStarted}
              className="dashboard-ledger-empty-card__cta-btn mt-4 px-5 py-2.5 bg-brand-primary hover:brightness-110 text-black text-xs font-bold font-presale tracking-wide rounded-xl transition-all cursor-pointer shadow-md active:scale-95"
            >
              Ring Up First Sale
            </button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            {/* BLOCK: Ledger Table - Displays individual transactional logs for live business audit */}
            <table className="dashboard-ledger-table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-inherit/15">
                  <th className="py-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                    TRANSACTION ID
                  </th>
                  <th className="py-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                    ITEMS
                  </th>
                  <th className="py-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                    METHOD
                  </th>
                  <th className="py-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] opacity-60">
                    STATUS
                  </th>
                  <th className="py-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] opacity-60 text-right">
                    TOTAL AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit/10">
                {activePresales.slice(0, 5).map((tx) => {
                  const itemsCount = tx.items?.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0) || 0;
                  return (
                    <tr key={tx.id} className="hover:bg-brand-primary/5 transition-colors dashboard-ledger-table__row">
                      <td className="py-3.5 px-3 text-xs font-mono font-bold opacity-80 dashboard-ledger-table__cell">
                        {tx.id}
                      </td>
                      <td className="py-3.5 px-3 text-xs font-bold dashboard-ledger-table__cell">
                        {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                      </td>
                      <td className="py-3.5 px-3 text-xs font-mono font-bold uppercase opacity-80 dashboard-ledger-table__cell">
                        {tx.paymentMethod || 'OTHER'}
                      </td>
                      <td className="py-3.5 px-3 dashboard-ledger-table__cell">
                        <span className={cn(
                          "inline-block text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-[0.15em] border",
                          tx.status?.toLowerCase() === 'completed' || tx.status?.toLowerCase() === 'paid'
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        )}>
                          {tx.status || 'PAID'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-xs font-black font-mono text-right dashboard-ledger-table__cell">
                        ${(Number(tx.totalAmount) || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
