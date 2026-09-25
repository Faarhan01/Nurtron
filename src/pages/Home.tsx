import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  History,
  ShoppingCart, 
  BarChart3, 
  Package, 
  ShieldCheck, 
  Zap,
  LayoutDashboard,
  User,
  Clock,
  Lock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Settings,
  Store,
  Activity,
  Users
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot } from "../lib/firebase";
import { signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile } from "../lib/firebase";
import { cn } from '../lib/utils';
import { TerminalLoginDialog } from '../components/TerminalLoginDialog';
import { DashboardPortal } from '../components/DashboardPortal';

interface AppFeature {
  id: string;
  icon: React.ComponentType<any>;
  title: string;
  category: string;
  desc: string;
  spec: string;
  throughput: string;
}

{/* BLOCK: System Capabilities Carousel - Horizontal carousel displaying MEGAPOS platform architectural capabilities */}
const SystemCapabilitiesCarousel: React.FC<{ theme: 'dark' | 'light' }> = ({ theme }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);
  const [activeSlide, setActiveSlide] = React.useState(0);

  const capabilities: AppFeature[] = [
    {
      id: 'catalog',
      icon: Package,
      title: 'Bulk Catalog Parser',
      category: 'Data Ingestion',
      desc: 'Map custom files, structure inventory inputs, and import thousands of retail menu entries to your register database instantly.',
      spec: 'CSV & JSON Mapping',
      throughput: '10,000+ SKU Index'
    },
    {
      id: 'cart',
      icon: ShoppingCart,
      title: 'High-Frequency Cart',
      category: 'Register Engine',
      desc: 'Deliver lightning-fast point of sale transactions, supporting automatic multi-tax schedules, cash rounding, and items drafts.',
      spec: 'Real-time Calculations',
      throughput: 'Sub-second Checkout'
    },
    {
      id: 'ledger',
      icon: History,
      title: 'Durable Sales Ledger',
      category: 'Audit & Compliance',
      desc: 'Keep secure business records perfectly up to date. Synchronize critical transaction records with redundant fallback protection.',
      spec: 'Persistent Cloud Journal',
      throughput: 'Multi-till Consistency'
    },
    {
      id: 'barcode',
      icon: Zap,
      title: 'Smart Barcode Resolver',
      category: 'Peripheral Gateway',
      desc: 'Turn mobile devices or hardware registers into swift UPC scanners for automated lookup and menu additions.',
      spec: 'USB HID & Optical Ready',
      throughput: 'Instant SKU Resolution'
    },
    {
      id: 'auth',
      icon: ShieldCheck,
      title: 'Operator Security Gate',
      category: 'Security & Access',
      desc: 'Control workspace details with roles, session logs, lock-screens, and custom cashier permissions.',
      spec: 'Role-Based Enforced Rules',
      throughput: 'Encrypted Sessions'
    }
  ];

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);

    const cardWidth = 320;
    const index = Math.min(
      capabilities.length - 1,
      Math.max(0, Math.round(scrollLeft / cardWidth))
    );
    setActiveSlide(index);
  };

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      checkScroll();
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollToSlide = (index: number) => {
    if (!scrollRef.current) return;
    const cards = scrollRef.current.children;
    if (cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  return (
    <div className={cn(
      "system-capabilities-carousel w-full rounded-2xl border p-5 sm:p-6 mb-8 sm:mb-12 transition-all relative overflow-hidden font-presale",
      theme === 'dark' 
        ? "system-capabilities-carousel--dark bg-dark-surface/90 border-white/20 text-white shadow-soft" 
        : "system-capabilities-carousel--light bg-white border-slate-300 text-slate-900 shadow-soft"
    )}>
      {/* Carousel Header */}
      <div className="system-capabilities-carousel__header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-inherit/20">
        <div className="system-capabilities-carousel__branding flex items-center gap-3">
          <div className={cn(
            "system-capabilities-carousel__badge w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg shrink-0",
            theme === 'dark' ? "bg-brand-primary text-black" : "bg-[#062A95] text-white"
          )}>
            M
          </div>
          <div>
            <span className={cn(
              "system-capabilities-carousel__eyebrow text-[10px] font-presale font-extrabold uppercase tracking-widest block",
              theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
            )}>
              Core POS Architecture
            </span>
            <h3 className="system-capabilities-carousel__title text-lg sm:text-xl font-bold font-presale uppercase tracking-tight leading-none mt-0.5">
              MEGAPOS Platform Capabilities
            </h3>
          </div>
        </div>

        {/* Carousel Controls */}
        <div className="system-capabilities-carousel__controls flex items-center gap-3 self-end sm:self-auto">
          <div className="system-capabilities-carousel__dots hidden md:flex items-center gap-1.5 mr-2">
            {capabilities.map((_, idx) => (
              <button
                key={idx}
                onClick={() => scrollToSlide(idx)}
                className={cn(
                  "system-capabilities-carousel__dot h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                  activeSlide === idx 
                    ? (theme === 'dark' ? "w-6 bg-cyan-400" : "w-6 bg-[#062A95]") 
                    : theme === 'dark' ? "w-1.5 bg-white/20 hover:bg-white/40" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                )}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleScroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                "system-capabilities-carousel__nav-button p-2 rounded-xl border transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                theme === 'dark'
                  ? "bg-black/30 border-white/20 text-white hover:bg-white/10 active:scale-95"
                  : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 active:scale-95"
              )}
              aria-label="Previous capabilities"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => handleScroll('right')}
              disabled={!canScrollRight}
              className={cn(
                "system-capabilities-carousel__nav-button p-2 rounded-xl border transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                theme === 'dark'
                  ? "bg-black/30 border-white/20 text-white hover:bg-white/10 active:scale-95"
                  : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 active:scale-95"
              )}
              aria-label="Next capabilities"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div 
        ref={scrollRef}
        className="system-capabilities-carousel__track flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scrollbar-none py-1.5 px-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {capabilities.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={cn(
                "capability-card snap-start shrink-0 w-[270px] sm:w-[310px] p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 group shadow-sm",
                theme === 'dark'
                  ? "capability-card--dark bg-dark-surface border-white/20 hover:border-brand-primary/60 text-white"
                  : "capability-card--light bg-slate-50 border-slate-300 hover:border-slate-800 text-slate-900"
              )}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "capability-card__icon-wrapper p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110",
                    theme === 'dark' ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30" : "bg-blue-50 text-[#062A95] border border-blue-200"
                  )}>
                    <Icon size={20} />
                  </div>
                  <span className={cn(
                    "capability-card__category text-[10px] font-presale font-bold uppercase tracking-wider",
                    theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                  )}>
                    {item.category}
                  </span>
                </div>

                <h4 className="capability-card__title text-base font-bold font-presale uppercase tracking-tight mb-1">
                  {item.title}
                </h4>
                <p className="capability-card__description text-xs font-presale leading-relaxed opacity-75 mt-2">
                  {item.desc}
                </p>
              </div>

              <div className="capability-card__footer pt-4 mt-4 border-t border-inherit/15 flex items-center justify-between text-[10px] font-presale opacity-75">
                <span>{item.spec}</span>
                <span aria-hidden="true">·</span>
                <span className="font-bold">{item.throughput}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Home: React.FC<{ 
  onGetStarted: () => void; 
  onNavigate?: (tab: string) => void;
  theme?: 'dark' | 'light';
}> = ({ onGetStarted, onNavigate, theme = 'dark' }) => {
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = React.useState(false);

  // Terminal Store & Manager state
  const [storeName, setStoreName] = React.useState<string>(() => {
    try {
      return localStorage.getItem('nurtron_store_name') || 'megapos';
    } catch (e) {
      return 'megapos';
    }
  });

  const [registeredManager, setRegisteredManager] = React.useState<string>(() => {
    try {
      return localStorage.getItem('nurtron_registered_manager_email') || '';
    } catch (e) {
      return '';
    }
  });

  const [isTerminalInitialized, setIsTerminalInitialized] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('nurtron_terminal_initialized') === 'true';
    } catch (e) {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      const name = localStorage.getItem('nurtron_store_name');
      if (name) setStoreName(name);
      const mgr = localStorage.getItem('nurtron_registered_manager_email');
      if (mgr) setRegisteredManager(mgr);
      const init = localStorage.getItem('nurtron_terminal_initialized') === 'true';
      setIsTerminalInitialized(init);
    } catch (e) {}
  }, [isLoginDialogOpen, user]);

  // Real-time store telemetry state
  const [products, setProducts] = React.useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('nurtron_cached_products');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });
  const [presales, setPresales] = React.useState<any[]>([]);
  const [productsLoading, setProductsLoading] = React.useState(false);
  const [presalesLoading, setPresalesLoading] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsLoginDialogOpen(false);
      } else {
        setIsLoginDialogOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    setProductsLoading(true);
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      let fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (snapshot.empty) {
        try {
          const cachedStr = localStorage.getItem('nurtron_cached_products');
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (parsed && parsed.length > 0) {
              fetched = parsed;
            }
          }
        } catch(e) {}
      }
      setProducts(fetched);
      if (fetched.length > 0) {
        try {
          localStorage.setItem('nurtron_cached_products', JSON.stringify(fetched));
        } catch(e) {}
      }
      setProductsLoading(false);
    }, (err) => {
      console.warn("Products snapshot error, falling back to cache:", err);
      try {
        const cachedStr = localStorage.getItem('nurtron_cached_products');
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          if (parsed) setProducts(parsed);
        }
      } catch (e) {}
      setProductsLoading(false);
    });

    setPresalesLoading(true);
    const unsubPresales = onSnapshot(collection(db, 'presales'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPresales(fetched);
      setPresalesLoading(false);
    }, (err) => {
      console.warn("Presales snapshot error:", err);
      setPresalesLoading(false);
    });

    return () => {
      unsubProducts();
      unsubPresales();
    };
  }, [user]);

  const [isDemoLoading, setIsDemoLoading] = React.useState(false);

  const handleDemoLogin = async () => {
    if (isDemoLoading) return;
    setIsDemoLoading(true);
    setLoginError(null);

    const demoEmail = 'demo@megapos.com';
    const demoPassword = 'demo1234';

    try {
      // First try signing in
      const userCredential = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      
      // Ensure displayName is updated if it isn't set yet
      if (userCredential.user && !userCredential.user.displayName) {
        try {
          await updateProfile(userCredential.user, { displayName: 'Demo Operator' });
        } catch (profileErr) {
          console.warn('Could not update profile display name', profileErr);
        }
      }

      setIsDemoLoading(false);
      onGetStarted();
    } catch (err: any) {
      // If user does not exist or credentials not found, sign up first
      if (
        err.code === 'auth/user-not-found' || 
        err.code === 'auth/invalid-credential' || 
        err.code === 'auth/invalid-email' ||
        err.message?.includes('invalid-credential') || 
        err.message?.includes('user-not-found')
      ) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          try {
            await updateProfile(userCredential.user, { displayName: 'Demo Operator' });
          } catch (profileErr) {
            console.warn('Could not update profile display name', profileErr);
          }
          setIsDemoLoading(false);
          onGetStarted();
          return;
        } catch (createErr: any) {
          console.error('Error creating demo operator account:', createErr);
          setLoginError(`Authentication system error: ${createErr.message || 'Could not instantiate demo database operator.'}`);
        }
      } else {
        console.error('Demo authentication system error:', err);
        setLoginError(err.message || 'Demo login sequence failed.');
      }
      setIsDemoLoading(false);
    }
  };

  const login = () => {
    setIsLoginDialogOpen(true);
  };

  return (
    <div className={cn(
      "home-page font-presale min-h-screen transition-colors duration-500 overflow-y-auto overflow-x-hidden selection:bg-[#22D3EE] selection:text-black",
      theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text"
    )}>
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={cn(
          "absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]",
          theme === 'dark' ? "bg-brand-primary/5" : "bg-brand-primary/10"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]",
          theme === 'dark' ? "bg-brand-primary/5" : "bg-brand-primary/10"
        )} />
      </div>

      {/* BLOCK: Signed-Out Floating Header Portal - Floating header matching the logged-in header style (3-column grid, floating rounded card, centered logo, no time/date) */}
      {!user && (
        <div className="signed-out-header-wrapper fixed top-4 left-4 right-4 z-[9000]">
          <header className={cn(
            "signed-out-header header-portal header-portal--floating relative h-16 border grid grid-cols-3 items-center px-6 z-50 transition-all duration-500 rounded-2xl backdrop-blur-md",
            theme === 'dark' 
              ? "header-portal--dark bg-black/60 border-zinc-800/80 text-dark-text hover:border-zinc-700/80" 
              : "header-portal--light bg-white border-zinc-200/80 text-light-text hover:border-zinc-300"
          )}>
            {/* Left Section: Terminal Lock Status Badge */}
            <div className="header-portal__left-section flex items-center justify-start gap-2 sm:gap-2.5">
              <div 
                className={cn(
                  "header-portal__status-badge h-9 px-2.5 sm:px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 focus:outline-none select-none transition-all duration-300 shrink-0",
                  theme === 'dark' ? "border-[#FFB800]/20 bg-[#FFB800]/5 text-[#FFB800]" : "border-[#FFB800]/30 bg-[#FFB800]/10 text-[#B25E00]"
                )}
              >
                <span className="header-portal__status-dot relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB800] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFB800]"></span>
                </span>
                <Lock size={12} className="header-portal__status-icon shrink-0 animate-pulse text-[#FFB800]" />
                <span className="header-portal__status-text text-[10px] font-mono font-black tracking-tight uppercase hidden sm:inline">Locked</span>
              </div>
            </div>

            {/* Center Section: App Branding & Logo */}
            <div className="header-portal__center-section flex items-center justify-center">
              <div className="header-portal__branding flex items-center gap-3">
                <div className={cn(
                  "header-portal__logo-badge w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg shrink-0",
                  theme === 'dark' ? "bg-dark-text text-dark-bg" : "bg-light-text text-light-surface"
                )}>
                  M
                </div>
                <div className="header-portal__branding-info text-left">
                  <h1 className="header-portal__branding-title text-sm font-black uppercase tracking-tighter leading-none">megapos</h1>
                </div>
              </div>
            </div>

            {/* Right Section: Terminal Login Trigger */}
            <div className="header-portal__right-section flex items-center justify-end gap-2.5 sm:gap-4">
              <button 
                onClick={login}
                className={cn(
                  "header-portal__login-button group flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer",
                  theme === 'dark' ? "bg-[#E4E3E0] text-[#0A0A0A] hover:bg-white" : "bg-[#141414] text-white hover:bg-black"
                )}
              >
                <span className="header-portal__login-button-text">Terminal Login</span>
                <ArrowRight size={12} className="header-portal__login-button-icon transition-all group-hover:translate-x-1" />
              </button>
            </div>
          </header>
        </div>
      )}

      <main className={cn(
        "relative z-10 w-full max-w-[1600px] mx-auto transition-all duration-500 ease-in-out px-4 pb-4 md:px-10 md:pb-10",
        user ? "pt-0" : "pt-24 sm:pt-28"
      )}>
        {/* Hero Section */}
        {user ? (
          <DashboardPortal
            user={user}
            products={products}
            presales={presales}
            productsLoading={productsLoading}
            presalesLoading={presalesLoading}
            onGetStarted={onGetStarted}
            onNavigate={onNavigate}
            theme={theme}
          />
        ) : (
          <div className="space-y-8 sm:space-y-12 mb-12 sm:mb-16 pt-1 sm:pt-2">
            
            {/* BLOCK: Ecosystem Overview Hero Card - Handles landing ecosystem details, store session status, and terminal actions */}
            <div 
              className={cn(
                "ecosystem-card w-full p-5 sm:p-6 rounded-2xl border transition-all relative overflow-hidden font-presale shadow-soft",
                theme === 'dark' 
                  ? "ecosystem-card--dark bg-dark-surface/90 border-white/20 text-white" 
                  : "ecosystem-card--light bg-white border-slate-300 text-slate-900"
              )}
            >
              <div className="ecosystem-card__content flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6">
                
                {/* Left Section: Metadata, Title & Description */}
                <div className="ecosystem-card__info space-y-2.5 max-w-3xl">
                  {/* ELEMENT: Clean unboxed metadata line */}
                  <div className="ecosystem-card__badge-container flex flex-wrap items-center gap-2 text-xs font-presale opacity-75">
                    <span className={cn("font-bold uppercase tracking-wider", theme === 'dark' ? "text-cyan-400" : "text-[#062A95]")}>
                      Enterprise Point of Sale
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>High-Performance Engine</span>
                    {(storeName || registeredManager || isTerminalInitialized) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Store: <strong className={theme === 'dark' ? "text-white" : "text-slate-900"}>{storeName || 'MEGAPOS Main Branch'}</strong>
                        </span>
                        {registeredManager && (
                          <>
                            <span aria-hidden="true" className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline">Operator: {registeredManager.split('@')[0]}</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* ELEMENT: Title & Description */}
                  <div className="ecosystem-card__header-text space-y-1">
                    <h2 className="ecosystem-card__title text-2xl sm:text-3xl lg:text-4xl font-bold font-presale uppercase leading-none tracking-tight">
                      The <span className={theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"}>MEGAPOS</span> Ecosystem
                    </h2>
                    
                    <p className="ecosystem-card__description text-xs sm:text-sm font-presale leading-relaxed opacity-75 max-w-2xl">
                      The high-performance point of sale system for modern wholesale and retail. Experience sub-second transaction speeds, automated catalog ingestion, and real-time distribution audits.
                    </p>
                  </div>
                </div>

                {/* Right Section: Action Buttons */}
                <div className="ecosystem-card__actions flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
                  <button 
                    onClick={login}
                    className={cn(
                      "ecosystem-card__button ecosystem-card__button--primary px-5 py-2.5 rounded-xl font-bold font-presale text-xs uppercase tracking-wider transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-md",
                      theme === 'dark' ? "bg-brand-primary text-black hover:brightness-110" : "bg-[#062A95] text-white hover:bg-blue-900"
                    )}
                  >
                    <span>Launch Terminal</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={handleDemoLogin}
                    disabled={isDemoLoading}
                    className={cn(
                      "ecosystem-card__button ecosystem-card__button--secondary px-5 py-2.5 border rounded-xl font-bold font-presale text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0",
                      isDemoLoading ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-0.5 active:translate-y-0",
                      theme === 'dark' ? "bg-black/30 border-white/20 text-white hover:bg-white/10" : "bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    {isDemoLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Entering...
                      </>
                    ) : 'View Demo'}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="ecosystem-card__error-alert p-3 mt-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left max-w-md">
                  <p className="font-bold uppercase tracking-wider mb-1 text-red-500 flex items-center gap-1.5 text-[10px]">
                    ⚠️ Authentication Alert
                  </p>
                  <p className="leading-relaxed font-semibold">{loginError}</p>
                </div>
              )}
            </div>

            {/* MEGAPOS System Capabilities Horizontal Carousel */}
            <div>
              <SystemCapabilitiesCarousel theme={theme} />
            </div>

          </div>
        )}

        {/* BLOCK: Feature Capabilities Grid - Displays key system capability cards on both logged-in and logged-out views */}
        <div className="feature-capabilities-grid mt-12 sm:mt-16 md:mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 font-presale">
          {[
            { icon: ShoppingCart, title: "Lightning Fast Checkout", desc: "Process transactions in sub-second speeds with our optimized engine." },
            { icon: BarChart3, title: "Real-time Analytics", desc: "Deep insights into products, sales trends, and inventory health." },
            { icon: Package, title: "Inventory Cloud", desc: "Sync stock levels across all terminals instantly via Firestore." },
            { icon: ShieldCheck, title: "Enterprise Security", desc: "Hardened security rules ensuring your data is always protected." },
          ].map((feature, i) => (
            <div 
              key={i}
              className={cn(
                "feature-card p-6 md:p-8 border rounded-2xl transition-all group shadow-soft",
                theme === 'dark' 
                  ? "feature-card--dark bg-dark-surface/90 border-white/20 hover:border-brand-primary/50 text-white" 
                  : "feature-card--light bg-white border-slate-300 hover:border-slate-800 text-slate-900"
              )}
            >
              <div className={cn(
                "feature-card__icon-wrapper w-12 h-12 border rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform",
                theme === 'dark' ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-blue-50 border-blue-200 text-[#062A95]"
              )}>
                <feature.icon size={22} className="feature-card__icon" />
              </div>
              <h3 className="feature-card__title text-lg font-bold font-presale uppercase tracking-tight mb-2">{feature.title}</h3>
              <p className="feature-card__description text-xs font-presale opacity-75 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {!user && (
        <>
          {/* Social Proof */}
          <div className={cn(
            "border-y py-4 transition-colors",
            theme === 'dark' ? "bg-[#0D0D0D] border-white/5" : "bg-[#F9F9F9] border-[#EEE]"
          )}>
            <div className="max-w-7xl mx-auto px-6 overflow-hidden flex whitespace-nowrap">
              <div className="flex items-center gap-20 animate-marquee">
                <div className="flex items-center gap-20 shrink-0">
                  {[1, 2, 3, 4, 5].map(i => (
                     <div key={`set1-${i}`} className="flex items-center gap-4 font-black uppercase  text-2xl opacity-50 select-none text-[#666]">
                        <div className="w-2 h-2 bg-current rounded-full" />
                        megapos
                        <div className="w-2 h-2 bg-current rounded-full" />
                        Precision POS
                        <div className="w-2 h-2 bg-current rounded-full" />
                        Hyper Scale
                     </div>
                  ))}
                </div>
                <div className="flex items-center gap-20 shrink-0">
                  {[1, 2, 3, 4, 5].map(i => (
                     <div key={`set2-${i}`} className="flex items-center gap-4 font-black uppercase  text-2xl opacity-50 select-none text-[#666]">
                        <div className="w-2 h-2 bg-current rounded-full" />
                        megapos
                        <div className="w-2 h-2 bg-current rounded-full" />
                        Precision POS
                        <div className="w-2 h-2 bg-current rounded-full" />
                        Hyper Scale
                     </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <footer className="max-w-7xl mx-auto px-6 py-20 text-center">
             <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#666]">Designed for High Performance wholesale and Retail</p>
          </footer>
        </>
      )}

      <AnimatePresence>
        {isLoginDialogOpen && (
          <TerminalLoginDialog
            isOpen={isLoginDialogOpen}
            onClose={() => setIsLoginDialogOpen(false)}
            onSuccess={onGetStarted}
            theme={theme}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
