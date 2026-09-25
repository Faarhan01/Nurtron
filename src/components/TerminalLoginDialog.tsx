import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  Key, 
  ShieldCheck, 
  Shield,
  ArrowRight, 
  AlertTriangle, 
  Terminal, 
  UserPlus 
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider,
  updateProfile,
  doc, 
  getDoc,
  setDoc,
  auth, 
  db,
  signInWithAdmin
} from '../lib/firebase';
import { cn, handleBackdropClick } from '../lib/utils';

interface TerminalLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  theme?: 'dark' | 'light';
}

export const TerminalLoginDialog: React.FC<TerminalLoginDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  theme = 'dark'
}) => {
  const [isTerminalInitialized, setIsTerminalInitialized] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('nurtron_terminal_initialized') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [registeredManagerEmail, setRegisteredManagerEmail] = React.useState<string>(() => {
    try {
      return localStorage.getItem('nurtron_registered_manager_email') || '';
    } catch (e) {
      return '';
    }
  });

  const [storeName, setStoreName] = React.useState<string>(() => {
    try {
      return localStorage.getItem('nurtron_store_name') || 'megapos';
    } catch (e) {
      return 'megapos';
    }
  });

  const [cachedStaff, setCachedStaff] = React.useState<Array<{ email: string; role: string; customRoleName?: string; username?: string; pin?: string }>>(() => {
    try {
      const raw = localStorage.getItem('nurtron_cached_staff');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [isSignUpMode, setIsSignUpMode] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Validation states
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // Focus tracking state
  const [activeField, setActiveField] = React.useState<'email' | 'password' | 'confirm' | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      // Refresh local terminal initialization & cached staff list
      try {
        const initialized = localStorage.getItem('nurtron_terminal_initialized') === 'true';
        setIsTerminalInitialized(initialized);
        const manager = localStorage.getItem('nurtron_registered_manager_email') || '';
        setRegisteredManagerEmail(manager);
        const rawStaff = localStorage.getItem('nurtron_cached_staff');
        if (rawStaff) {
          const parsed = JSON.parse(rawStaff);
          if (Array.isArray(parsed)) setCachedStaff(parsed);
        }

        const currentStoreId = localStorage.getItem('nurtron-current-store-id') || 'STR-100100';
        getDoc(doc(db, 'settings', currentStoreId)).then((snap) => {
          if (snap.exists() && snap.data().storeName) {
            setStoreName(snap.data().storeName);
            try { localStorage.setItem('nurtron_store_name', snap.data().storeName); } catch (e) {}
          }
        }).catch(() => {});
      } catch (e) {}

      // Reset forms on reopen
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setEmailError(null);
      setPasswordError(null);
      setConfirmError(null);
      setIsSignUpMode(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSuccessfulAuth = (authenticatedEmail: string) => {
    const cleanEmail = authenticatedEmail.toLowerCase().trim();
    try {
      localStorage.setItem('nurtron_terminal_initialized', 'true');
      setIsTerminalInitialized(true);
      const oldMgr = localStorage.getItem('nurtron_registered_manager_email');
      if (oldMgr && oldMgr.toLowerCase().trim() !== cleanEmail) {
        // Clear cached products from old manager so new account starts with clean workspace
        localStorage.removeItem('nurtron_cached_products');
        localStorage.removeItem('nurtron_cached_staff');
      }
      localStorage.setItem('nurtron_registered_manager_email', cleanEmail);
      setRegisteredManagerEmail(cleanEmail);
    } catch (e) {}
    setIsLoading(false);
    if (onSuccess) onSuccess();
    onClose();
  };

  const toggleMode = () => {
    setIsSignUpMode(!isSignUpMode);
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const validateForm = (): { isValid: boolean; targetEmail: string } => {
    let isValid = true;
    let targetEmail = email.trim();
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);

    if (!targetEmail) {
      setEmailError('Operator email or username is required');
      isValid = false;
    } else {
      const emailRegExp = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (targetEmail.toLowerCase() === 'admin' || targetEmail.toLowerCase() === 'sysadmin') {
        targetEmail = 'admin@megapos.pos';
      } else if (!emailRegExp.test(targetEmail)) {
        // Try matching with cached staff username or email prefix
        const found = cachedStaff.find(
          s => (s.username && s.username.toLowerCase() === targetEmail.toLowerCase()) ||
               (s.email && s.email.split('@')[0].toLowerCase() === targetEmail.toLowerCase())
        );
        if (found) {
          targetEmail = found.email;
        } else if (!isSignUpMode) {
          // Allow login attempts with plain username for local RBAC
          targetEmail = `${targetEmail}@megapos.pos`;
        } else {
          setEmailError('Enter a valid email format for sign up.');
          isValid = false;
        }
      }
    }

    if (!password) {
      setPasswordError('Security PIN or key is required');
      isValid = false;
    } else if (isSignUpMode && password.length < 6) {
      setPasswordError('Clearance key must have at least 6 tokens');
      isValid = false;
    }

    if (isSignUpMode) {
      if (!confirmPassword) {
        setConfirmError('Please re-type security clearance key');
        isValid = false;
      } else if (confirmPassword !== password) {
        setConfirmError('Secret keys are not matching');
        isValid = false;
      }
    }

    return { isValid, targetEmail };
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const { isValid, targetEmail } = validateForm();
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const userEmail = targetEmail.toLowerCase().trim();
      if (isSignUpMode) {
        await createUserWithEmailAndPassword(auth, userEmail, password);
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
        try {
          await setDoc(doc(db, 'staff', userEmail), {
            email: userEmail,
            username: userEmail.split('@')[0],
            role: 'Manager',
            permissions: fullManagerPermissions,
            addedBy: userEmail,
            addedAt: new Date().toISOString()
          });
        } catch (docErr) {
          console.warn('Could not save initial manager staff doc:', docErr);
        }
      } else {
        await signInWithEmailAndPassword(auth, userEmail, password);
      }
      handleSuccessfulAuth(userEmail);
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        console.warn('Operator sign-in rejected: Incorrect credentials.');
      } else {
        console.error('Authentication system error:', err);
      }
      setIsLoading(false);
      
      let friendlyMessage = err.message || 'Verification sequence rejected.';
      if (err.code === 'auth/operation-not-allowed') {
        friendlyMessage = 'Email/Password authentication provider is currently disabled in system settings.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'This email signature is already registered.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        friendlyMessage = 'Network handshake failed. This is a common browser security constraint within embedded preview frames.\n\nTo resolve this:\n1. Click "Open in new tab" at the top-right to launch standalone window.\n2. In the new window, login connects instantly!';
      }
      setError(friendlyMessage);
    }
  };

  const handleGoogleAuth = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const provider = new GoogleAuthProvider();
      const isIframe = window.self !== window.top;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile && !isIframe) {
        setError("Redirecting to Google Secure SSO. Please wait...");
        await signInWithRedirect(auth, provider);
      } else {
        const res = await signInWithPopup(auth, provider);
        handleSuccessfulAuth(res.user.email || '');
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setIsLoading(false);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google authentication provider is disabled in system settings.');
      } else if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        setError("Google SSO popup was blocked or closed.\n\nClick 'Open in new tab' at top-right to run standalone, or use the Demo Operator button below.");
      } else if (err.code === 'auth/network-request-failed' || err.message?.includes('network-request-failed')) {
        setError("Network authentication handshake failed. Use 'Open in new tab' or Demo Operator button.");
      } else {
        setError(err.message || 'SSO handshakes failed.');
      }
    }
  };

  const handleDemoLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    const demoEmail = 'demo@megapos.com';
    const demoPassword = 'demo1234';

    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      handleSuccessfulAuth(demoEmail);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          try {
            await updateProfile(userCredential.user, { displayName: 'Demo Operator' });
          } catch (profileErr) {
            console.error('Error updating demo profile name:', profileErr);
          }
          handleSuccessfulAuth(demoEmail);
        } catch (createErr: any) {
          console.error('Error creating demo operator account:', createErr);
          setError(`Authentication system error: ${createErr.message || 'Could not instantiate demo operator.'}`);
          setIsLoading(false);
        }
      } else {
        console.error('Demo authentication system error:', err);
        setError(err.message || 'Demo login sequence failed.');
        setIsLoading(false);
      }
    }
  };

  const handleAdminLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, 'admin', 'admin');
      handleSuccessfulAuth('admin@megapos.pos');
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(err.message || 'Admin login sequence failed.');
      setIsLoading(false);
    }
  };

  const isDark = theme === 'dark';
  const otherStaff = cachedStaff.filter(s => s.username !== 'admin' && s.email !== 'admin@megapos.pos');

  return (
    <div className="login-popup-card-overlay fixed inset-0 z-[8000] flex items-start justify-center p-4 pt-20 sm:pt-24 overflow-y-auto">
      {/* BACKGROUND MASK: Glassmorphic Animated Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="login-popup-card-overlay__backdrop fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* BLOCK: Terminal Login Popup Card - Handles operator shift authentication & instance registration */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className={cn(
          "login-popup-card relative z-10 w-full max-w-md overflow-hidden rounded-2xl border p-6 sm:p-7 shadow-2xl max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none my-2 transition-all",
          isDark 
            ? "login-popup-card--dark bg-[#0D1117] border-zinc-800 text-white shadow-black/80" 
            : "login-popup-card--light bg-white border-zinc-200 text-zinc-900 shadow-zinc-300/50"
        )}
      >
        {/* ELEMENT: Header Group - Branding & Status Indicator */}
        <div className="login-popup-card__header flex items-center justify-between mb-6 pb-4 border-b border-inherit/20">
          <div className="login-popup-card__header-branding flex items-center gap-3">
            <div className={cn(
              "login-popup-card__icon-badge w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm transition-transform hover:scale-105",
              isDark 
                ? "bg-white text-black" 
                : "bg-black text-white"
            )}>
              {isSignUpMode ? <UserPlus size={20} /> : <Terminal size={20} />}
            </div>
            <div className="login-popup-card__title-group">
              <h2 className="login-popup-card__title text-base sm:text-lg font-black tracking-tight uppercase leading-none mb-1">
                {!isTerminalInitialized 
                  ? 'Initialize Terminal' 
                  : (isSignUpMode ? 'Register Operator' : 'Terminal Operator Login')}
              </h2>
              {!isTerminalInitialized && (
                <p className="login-popup-card__subtitle text-[10px] font-mono font-bold tracking-wider uppercase text-yellow-500">
                  First-Time Manager Setup Required
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "login-popup-card__close-button p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer shrink-0",
              isDark ? "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-black"
            )}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* ELEMENT: Uninitialized Terminal Manager Setup Notice */}
        {!isTerminalInitialized && (
          <div className={cn(
            "login-popup-card__init-notice p-3.5 mb-5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed font-semibold tracking-tight",
            isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span>First Session Required: Log in or sign up as a Manager account to initialize and authorize this POS terminal.</span>
            </div>
          </div>
        )}

        {/* ELEMENT: Quick Staff Operator Selector (shown only if non-admin staff exist) */}
        {!isSignUpMode && otherStaff.length > 0 && (
          <div className="login-popup-card__staff-selector mb-5 space-y-2">
            <label className={cn(
              "login-popup-card__label block text-[10px] font-mono font-bold tracking-wider uppercase opacity-60",
              isDark ? "text-zinc-400" : "text-zinc-500"
            )}>
              Select Operator Profile
            </label>
            <div className="login-popup-card__staff-grid flex flex-wrap gap-2 max-h-28 overflow-y-auto p-0.5">
              {otherStaff.map((staffMember) => (
                <button
                  key={staffMember.email}
                  type="button"
                  onClick={() => {
                    setEmail(staffMember.username || staffMember.email);
                    if (staffMember.pin) {
                      setPassword(staffMember.pin);
                    }
                    setError(null);
                  }}
                  className={cn(
                    "login-popup-card__staff-chip px-3 py-1.5 rounded-xl border text-[11px] font-extrabold uppercase transition-all flex items-center gap-2 active:scale-95 cursor-pointer",
                    email === staffMember.email || email === staffMember.username
                      ? (isDark ? "bg-white text-black border-white" : "bg-black text-white border-black")
                      : (isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800" : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200")
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate max-w-[130px]">
                    {staffMember.username ? `@${staffMember.username}` : staffMember.email.split('@')[0]}
                  </span>
                  <span className="text-[9px] opacity-60 font-mono">({staffMember.role})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ELEMENT: Error Message Banner */}
        {error && (
          <div className="login-popup-card__error-ribbon flex flex-col gap-3 p-3.5 mb-5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <span className="login-popup-card__error-text font-semibold leading-relaxed whitespace-pre-line">{error}</span>
            </div>
            {(error.includes("SSO popup") || error.includes("handshake failed")) && (
              <button
                type="button"
                onClick={handleDemoLogin}
                className="login-popup-card__error-bypass-button self-start font-black tracking-wider uppercase text-[10px] bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg transition-colors border border-red-500/30 mt-1 cursor-pointer"
              >
                👉 Instant Bypass: Log in with Demo Operator
              </button>
            )}
          </div>
        )}

        {/* ELEMENT: Secure Login/Registration Form */}
        <form onSubmit={handlePasswordAuth} className="login-popup-card__form space-y-4">
          <div className="login-popup-card__field-group space-y-1.5">
            <label className={cn(
              "login-popup-card__label block text-[10px] font-mono font-bold tracking-wider uppercase",
              activeField === 'email' 
                ? "text-yellow-500" 
                : (isDark ? 'text-zinc-400' : 'text-zinc-500')
            )}>
              Email or Username
            </label>
            <div className={cn(
              "login-popup-card__input-wrapper flex items-center gap-2.5 border rounded-xl px-3.5 py-2.5 transition-all duration-200",
              activeField === 'email'
                ? (isDark 
                    ? 'border-zinc-500 ring-2 ring-yellow-500/15 bg-zinc-900' 
                    : 'border-zinc-800 ring-2 ring-zinc-800/10 bg-zinc-50')
                : (isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50/50')
            )}>
              <Mail size={16} className={cn(
                "login-popup-card__input-icon transition-colors shrink-0",
                activeField === 'email' ? "text-yellow-500" : "text-zinc-500"
              )} />
              <input
                type="text"
                placeholder="operator@megapos.com or admin"
                value={email}
                onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
                onFocus={() => setActiveField('email')}
                onBlur={() => setActiveField(null)}
                className="login-popup-card__input w-full bg-transparent text-xs font-semibold outline-none border-none"
              />
            </div>
            {emailError && (
              <p className="login-popup-card__error-text text-[10px] text-red-500 font-medium flex items-center gap-1 mt-1">
                <span>⚠️</span> {emailError}
              </p>
            )}
          </div>

          <div className="login-popup-card__field-group space-y-1.5">
            <label className={cn(
              "login-popup-card__label block text-[10px] font-mono font-bold tracking-wider uppercase",
              activeField === 'password'
                ? "text-yellow-500" 
                : (isDark ? 'text-zinc-400' : 'text-zinc-500')
            )}>
              Password or PIN
            </label>
            <div className={cn(
              "login-popup-card__input-wrapper flex items-center gap-2.5 border rounded-xl px-3.5 py-2.5 transition-all duration-200",
              activeField === 'password'
                ? (isDark 
                    ? 'border-zinc-500 ring-2 ring-yellow-500/15 bg-zinc-900' 
                    : 'border-zinc-800 ring-2 ring-zinc-800/10 bg-zinc-50')
                : (isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50/50')
            )}>
              <Key size={16} className={cn(
                "login-popup-card__input-icon transition-colors shrink-0",
                activeField === 'password' ? "text-yellow-500" : "text-zinc-500"
              )} />
              <input
                type="password"
                placeholder="Password or PIN"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setActiveField('password')}
                onBlur={() => setActiveField(null)}
                className="login-popup-card__input w-full bg-transparent text-xs font-semibold outline-none border-none"
              />
            </div>
            {passwordError && (
              <p className="login-popup-card__error-text text-[10px] text-red-500 font-medium flex items-center gap-1 mt-1">
                <span>⚠️</span> {passwordError}
              </p>
            )}
          </div>

          {isSignUpMode && (
            <div className="login-popup-card__field-group space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className={cn(
                "login-popup-card__label block text-[10px] font-mono font-bold tracking-wider uppercase",
                activeField === 'confirm'
                  ? "text-yellow-500" 
                  : (isDark ? 'text-zinc-400' : 'text-zinc-500')
              )}>
                Confirm Password
              </label>
              <div className={cn(
                "login-popup-card__input-wrapper flex items-center gap-2.5 border rounded-xl px-3.5 py-2.5 transition-all duration-200",
                activeField === 'confirm'
                  ? (isDark 
                      ? 'border-zinc-500 ring-2 ring-yellow-500/15 bg-zinc-900' 
                      : 'border-zinc-800 ring-2 ring-zinc-800/10 bg-zinc-50')
                  : (isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-zinc-200 bg-zinc-50/50')
              )}>
                <ShieldCheck size={16} className={cn(
                  "login-popup-card__input-icon transition-colors shrink-0",
                  activeField === 'confirm' ? "text-yellow-500" : "text-zinc-500"
                )} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setActiveField('confirm')}
                  onBlur={() => setActiveField(null)}
                  className="login-popup-card__input w-full bg-transparent text-xs font-semibold outline-none border-none"
                />
              </div>
              {confirmError && (
                <p className="login-popup-card__error-text text-[10px] text-red-500 font-medium flex items-center gap-1 mt-1">
                  <span>⚠️</span> {confirmError}
                </p>
              )}
            </div>
          )}

          {/* ACTION BUTTON */}
          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              "login-popup-card__submit-button w-full h-11 rounded-xl font-black tracking-widest uppercase text-xs transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 mt-2",
              isDark
                ? "bg-white text-black hover:bg-zinc-200"
                : "bg-black text-white hover:bg-zinc-800"
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {!isTerminalInitialized 
                    ? 'Initialize Terminal (Manager)' 
                    : (isSignUpMode ? 'Register Operator' : 'Operator Login')}
                </span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Separator / Divider matching specifications */}
        <div className="login-popup-card__divider flex items-center gap-3 my-5">
          <div className={cn("login-popup-card__divider-line h-px flex-1", isDark ? "bg-zinc-800" : "bg-zinc-200")} />
          <span className="login-popup-card__divider-text text-[9px] font-mono font-bold tracking-[0.2em] text-zinc-500 uppercase leading-none">
            OR CONNECT THROUGH
          </span>
          <div className={cn("login-popup-card__divider-line h-px flex-1", isDark ? "bg-zinc-800" : "bg-zinc-200")} />
        </div>

        {/* Action button container */}
        <div className="login-popup-card__social-actions flex flex-col gap-2.5">
          {/* Dedicated Admin Login Button */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleAdminLogin}
            className={cn(
              "login-popup-card__admin-button w-full flex items-center justify-center gap-2.5 h-10 rounded-xl text-xs font-black tracking-wider transition-all duration-200 active:scale-95 cursor-pointer shadow-sm",
              isDark 
                ? "bg-emerald-600/90 hover:bg-emerald-500 text-white" 
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            )}
          >
            <Shield size={16} className="text-emerald-200 shrink-0" />
            <span>ONE-CLICK ADMIN LOGIN (admin / admin)</span>
          </button>

          {/* Integrated Google Access option */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleAuth}
            className={cn(
              "login-popup-card__google-button w-full flex items-center justify-center gap-2.5 h-10 rounded-xl text-xs font-black tracking-wider border transition-all duration-200 active:scale-95 cursor-pointer",
              isDark 
                ? "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-white" 
                : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-900"
            )}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>LOG IN WITH GOOGLE SSO</span>
          </button>

          {/* Dedicated Quick Demo Operator Sign In */}
          <button
            type="button"
            disabled={isLoading}
            onClick={handleDemoLogin}
            className={cn(
              "login-popup-card__demo-button w-full flex items-center justify-center gap-2.5 h-10 rounded-xl text-xs font-black tracking-wider border transition-all duration-200 active:scale-95 border-dashed cursor-pointer",
              isDark 
                ? "bg-zinc-900/60 border-zinc-700 hover:bg-zinc-800 text-zinc-300" 
                : "bg-zinc-50 border-zinc-300 hover:bg-zinc-100 text-zinc-700"
            )}
          >
            <span>BYPASS WITH DEMO OPERATOR</span>
          </button>
        </div>

        {/* View Switcher toggle below everything */}
        <div className="login-popup-card__switch-mode flex items-center justify-center gap-1.5 mt-5">
          <span className="login-popup-card__switch-text text-xs text-zinc-500 font-medium">
            {isSignUpMode ? 'Already registered?' : 'Need manager profile?'}
          </span>
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              "login-popup-card__switch-button text-xs font-black transition-colors hover:underline cursor-pointer",
              isDark ? "text-yellow-400 hover:text-yellow-300" : "text-zinc-900 hover:text-black"
            )}
          >
            {isSignUpMode ? 'Sign In' : 'Manager Setup / Sign Up'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

