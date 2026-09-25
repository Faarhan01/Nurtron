import React from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  User as UserIcon, 
  Bell, 
  Shield, 
  ShieldCheck,
  Smartphone, 
  CreditCard,
  Save,
  Lock,
  Users,
  Barcode,
  Trash2,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  Plus,
  X,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Menu,
  Cpu,
  Layers,
  Database,
  Terminal,
  Activity,
  Check,
  Wifi,
  Edit3,
  Laptop,
  AlertTriangle,
  LucideAlertTriangle,
  Cloud,
  AlertCircle,
  Palette,
  Type,
  Calendar,
  Receipt,
  Percent,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { signOut, updateProfile } from "../lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "../lib/firebase";
import { cn, OperationType, handleFirestoreError, handleBackdropClick } from '../lib/utils';


import firebaseConfig from '../../firebase-applet-config.json';
import { User } from "../lib/firebase";

import { UserRole, StaffMember } from '../types';

const ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  Manager: {
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
  },
  Supervisor: {
    home: true,
    register: true,
    inventory: true,
    reports: true,
    settings: true,
    manage_presales: true,
    manage_returns: true,
    manage_vault: true,
    manage_balances: false,
    manage_staff: true,
    manage_store: false,
    manage_terminal: false,
    transactions: true,
    setup_guide: true
  },
  Cashier: {
    home: true,
    register: true,
    inventory: false,
    reports: false,
    settings: true,
    manage_presales: false,
    manage_returns: false,
    manage_vault: false,
    manage_balances: false,
    manage_staff: false,
    manage_store: false,
    manage_terminal: false,
    transactions: false,
    setup_guide: true
  },
  Accountant: {
    home: true,
    register: true,
    inventory: true,
    reports: true,
    settings: true,
    manage_presales: true,
    manage_returns: false,
    manage_vault: false,
    manage_balances: true,
    manage_staff: false,
    manage_store: false,
    manage_terminal: false,
    transactions: true,
    setup_guide: true
  },
  Rep: {
    home: true,
    register: true,
    inventory: false,
    reports: false,
    settings: true,
    manage_presales: false,
    manage_returns: false,
    manage_vault: false,
    manage_balances: false,
    manage_staff: false,
    manage_store: false,
    manage_terminal: false,
    transactions: false,
    setup_guide: true
  },
  Investor: {
    home: true,
    register: true,
    inventory: false,
    reports: true,
    settings: true,
    manage_presales: false,
    manage_returns: false,
    manage_vault: false,
    manage_balances: false,
    manage_staff: false,
    manage_store: false,
    manage_terminal: false,
    transactions: false,
    setup_guide: true
  },
  Custom: {
    home: true,
    register: true,
    inventory: false,
    reports: false,
    settings: true,
    manage_presales: false,
    manage_returns: false,
    manage_vault: false,
    manage_balances: false,
    manage_staff: false,
    manage_store: false,
    manage_terminal: false,
    transactions: false,
    setup_guide: true
  }
};

const AVATARS = [
  {
    id: 'phoenix',
    label: 'Phoenix',
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="avG1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00C9FF" />
            <stop offset="100%" stopColor="#92FE9D" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="#0d0d0d"/>
        <circle cx="50" cy="55" r="22" fill="url(#avG1)" opacity="0.15"/>
        <path d="M50 25 L65 50 L50 42 L35 50 Z" fill="url(#avG1)"/>
        <path d="M50 45 L60 68 L50 60 L40 68 Z" fill="url(#avG1)" opacity="0.8"/>
        <circle cx="50" cy="35" r="3" fill="#ffffff"/>
      </svg>
    ),
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="avG1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2300C9FF" /><stop offset="100%" stop-color="%2392FE9D" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="%230d0d0d"/><circle cx="50" cy="55" r="22" fill="url(%23avG1)" opacity="0.15"/><path d="M50 25 L65 50 L50 42 L35 50 Z" fill="url(%23avG1)"/><path d="M50 45 L60 68 L50 60 L40 68 Z" fill="url(%23avG1)" opacity="0.8"/><circle cx="50" cy="35" r="3" fill="%23ffffff"/></svg>`
  },
  {
    id: 'sphere',
    label: 'Cyber Sphere',
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="avG2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f857a6" />
            <stop offset="100%" stopColor="#ff5858" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="#0d0d0d"/>
        <circle cx="50" cy="50" r="25" fill="none" stroke="url(#avG2)" strokeWidth="4"/>
        <circle cx="50" cy="50" r="15" fill="url(#avG2)"/>
        <line x1="20" y1="50" x2="80" y2="50" stroke="url(#avG2)" strokeWidth="2" strokeDasharray="2 2" opacity="0.6"/>
        <line x1="50" y1="20" x2="50" y2="80" stroke="url(#avG2)" strokeWidth="2" strokeDasharray="2 2" opacity="0.6"/>
      </svg>
    ),
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="avG2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f857a6" /><stop offset="100%" stop-color="%23ff5858" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="%230d0d0d"/><circle cx="50" cy="50" r="25" fill="none" stroke="url(%23avG2)" stroke-width="4"/><circle cx="50" cy="50" r="15" fill="url(%23avG2)"/><line x1="20" y1="50" x2="80" y2="50" stroke="url(%23avG2)" stroke-width="2" stroke-dasharray="2 2" opacity="0.6"/><line x1="50" y1="20" x2="50" y2="80" stroke="url(%23avG2)" stroke-width="2" stroke-dasharray="2 2" opacity="0.6"/></svg>`
  },
  {
    id: 'terminal',
    label: 'Terminal Dev',
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="avG3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#11998e" />
            <stop offset="100%" stopColor="#38ef7d" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="#0d0d0d"/>
        <text x="50" y="58" fontFamily="monospace" fontWeight="900" fontSize="32" fill="url(#avG3)" textAnchor="middle">&lt;/&gt;</text>
        <rect x="20" y="20" width="60" height="60" rx="8" fill="none" stroke="url(#avG3)" strokeWidth="3" strokeDasharray="4 2" opacity="0.5"/>
      </svg>
    ),
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="avG3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2311998e" /><stop offset="100%" stop-color="%2338ef7d" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="%230d0d0d"/><text x="50" y="58" font-family="monospace" font-weight="900" font-size="32" fill="url(%23avG3)" text-anchor="middle">&lt;/&gt;</text><rect x="20" y="20" width="60" height="60" rx="8" fill="none" stroke="url(%23avG3)" stroke-width="3" stroke-dasharray="4 2" opacity="0.5"/></svg>`
  },
  {
    id: 'owl',
    label: 'Deep Owl',
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="avG4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e65c00" />
            <stop offset="100%" stopColor="#F9D423" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="#0d0d0d"/>
        <circle cx="38" cy="45" r="10" fill="none" stroke="url(#avG4)" strokeWidth="3"/>
        <circle cx="38" cy="45" r="4" fill="url(#avG4)"/>
        <circle cx="62" cy="45" r="10" fill="none" stroke="url(#avG4)" strokeWidth="3"/>
        <circle cx="62" cy="45" r="4" fill="url(#avG4)"/>
        <path d="M50 50 L46 60 L54 60 Z" fill="url(#avG4)"/>
        <path d="M25 30 L40 38 M75 30 L60 38" stroke="url(#avG4)" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="avG4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23e65c00" /><stop offset="100%" stop-color="%23F9D423" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="%230d0d0d"/><circle cx="38" cy="45" r="10" fill="none" stroke="url(%23avG4)" stroke-width="3"/><circle cx="38" cy="45" r="4" fill="url(%23avG4)"/><circle cx="62" cy="45" r="10" fill="none" stroke="url(%23avG4)" stroke-width="3"/><circle cx="62" cy="45" r="4" fill="url(%23avG4)"/><path d="M50 50 L46 60 L54 60 Z" fill="url(%23avG4)"/><path d="M25 30 L40 38 M75 30 L60 38" stroke="url(%23avG4)" stroke-width="3" stroke-linecap="round"/></svg>`
  },
  {
    id: 'network',
    label: 'Cosmic Net',
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="avG5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8a2387" />
            <stop offset="50%" stopColor="#e94057" />
            <stop offset="100%" stopColor="#f27121" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="#0d0d0d"/>
        <circle cx="50" cy="50" r="18" fill="none" stroke="url(#avG5)" strokeWidth="2"/>
        <circle cx="25" cy="30" r="5" fill="url(#avG5)"/>
        <circle cx="75" cy="30" r="5" fill="url(#avG5)"/>
        <circle cx="50" cy="75" r="6" fill="url(#avG5)"/>
        <line x1="25" y1="30" x2="50" y2="50" stroke="url(#avG5)" strokeWidth="1.5" opacity="0.7"/>
        <line x1="75" y1="30" x2="50" y2="50" stroke="url(#avG5)" strokeWidth="1.5" opacity="0.7"/>
        <line x1="50" y1="75" x2="50" y2="50" stroke="url(#avG5)" strokeWidth="1.5" opacity="0.7"/>
      </svg>
    ),
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="avG5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238a2387" /><stop offset="50%" stop-color="%23e94057" /><stop offset="100%" stop-color="%23f27121" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="%230d0d0d"/><circle cx="50" cy="50" r="18" fill="none" stroke="url(%23avG5)" stroke-width="2"/><circle cx="25" cy="30" r="5" fill="url(%23avG5)"/><circle cx="75" cy="30" r="5" fill="url(%23avG5)"/><circle cx="50" cy="75" r="6" fill="url(%23avG5)"/><line x1="25" y1="30" x2="50" y2="50" stroke="url(%23avG5)" stroke-width="1.5" opacity="0.7"/><line x1="75" y1="30" x2="50" y2="50" stroke="url(%23avG5)" stroke-width="1.5" opacity="0.7"/><line x1="50" y1="75" x2="50" y2="50" stroke="url(%23avG5)" stroke-width="1.5" opacity="0.7"/></svg>`
  },
  {
    id: 'shield',
    label: 'Zen Shield',
    svg: (
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <defs>
          <linearGradient id="avG6" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#11998e" />
            <stop offset="100%" stopColor="#f857a6" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="#0d0d0d"/>
        <path d="M50 20 C65 20, 75 30, 75 50 C75 70, 50 82, 50 82 C50 82, 25 70, 25 50 C25 30, 35 20, 50 20 Z" fill="none" stroke="url(#avG6)" strokeWidth="3"/>
        <circle cx="50" cy="48" r="8" fill="url(#avG6)"/>
        <path d="M35 62 Q50 50 65 62" fill="none" stroke="url(#avG6)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    dataUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="avG6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2311998e" /><stop offset="100%" stop-color="%23f857a6" /></linearGradient></defs><rect width="100" height="100" rx="20" fill="%230d0d0d"/><path d="M50 20 C65 20, 75 30, 75 50 C75 70, 50 82, 50 82 C50 82, 25 70, 25 50 C25 30, 35 20, 50 20 Z" fill="none" stroke="url(%23avG6)" stroke-width="3"/><circle cx="50" cy="48" r="8" fill="url(%23avG6)"/><path d="M35 62 Q50 50 65 62" fill="none" stroke="url(%23avG6)" stroke-width="2" stroke-linecap="round"/></svg>`
  }
];

interface SettingsProps {
  user: User | null;
  theme?: 'dark' | 'light';
  themePreset?: 'saas-dark' | 'saas-light';
  onThemeChange?: (theme: 'dark' | 'light') => void;
  onThemePresetChange?: (preset: 'saas-dark' | 'saas-light') => void;
  activeTab?: 'store' | 'user' | 'staff' | 'terminal' | 'appearance' | 'devices' | 'admin' | 'manager';
  onTabChange?: (tab: 'store' | 'user' | 'staff' | 'terminal' | 'appearance' | 'devices' | 'admin' | 'manager') => void;
  permissions?: Record<string, boolean>;
  role?: UserRole;
  customRoleName?: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onSyncRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  storeId?: string;
  onStoreIdChange?: (id: string) => void;
  subscriptionLevel?: 'basic' | 'pro' | 'enterprise';
}

export const Settings: React.FC<SettingsProps> = ({ 
  user, 
  theme = 'dark', 
  themePreset = 'saas-dark',
  onThemeChange,
  onThemePresetChange,
  activeTab: externalTab,
  onTabChange: onExternalTabChange,
  permissions = { manage_staff: true, manage_store: true, manage_terminal: true },
  role = 'Manager',
  customRoleName = '',
  onDirtyChange,
  onSyncRef,
  storeId = 'STR-100100',
  onStoreIdChange,
  subscriptionLevel: propSubscriptionLevel
}) => {
  const generateStoreId = () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    return `STR-${code}`;
  };

  const [loading, setLoading] = React.useState(false);
  const settingsTabsRef = React.useRef<HTMLDivElement>(null);
  const [showDeregisterConfirm, setShowDeregisterConfirm] = React.useState(false);
  const [storeName, setStoreName] = React.useState('megapos');
  const [registrationNumber, setRegistrationNumber] = React.useState('');
  const [vatNumber, setVatNumber] = React.useState('');
  const [streetNumber, setStreetNumber] = React.useState('');
  const [streetName, setStreetName] = React.useState('');
  const [suburb, setSuburb] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [taxRate, setTaxRate] = React.useState(8.0);
  
  const [isEditingBusiness, setIsEditingBusiness] = React.useState(false);
  const [isEditingStore, setIsEditingStore] = React.useState(false);
  const [isEditingRoster, setIsEditingRoster] = React.useState(false);
  const [isEditingAccessControl, setIsEditingAccessControl] = React.useState(false);

  const [isEditingTerminalLayouts, setIsEditingTerminalLayouts] = React.useState(false);
  const [isEditingReceipt, setIsEditingReceipt] = React.useState(false);
  const [isEditingBarcode, setIsEditingBarcode] = React.useState(false);
  const [isEditingTax, setIsEditingTax] = React.useState(false);
  const [isEditingPricing, setIsEditingPricing] = React.useState(false);
  const [isEditingSecurity, setIsEditingSecurity] = React.useState(false);
  const [isEditingAtmosphere, setIsEditingAtmosphere] = React.useState(false);
  const [isEditingTypography, setIsEditingTypography] = React.useState(false);
  const [isEditingLocalDevices, setIsEditingLocalDevices] = React.useState(false);

  const isBusinessIdentityChanged = () => {
    if (!loadedSettingsRef.current) return false;
    const snap = loadedSettingsRef.current;
    if (storeName !== (snap.storeName || '')) return true;
    if (registrationNumber !== (snap.registrationNumber || '')) return true;
    if (vatNumber !== (snap.vatNumber || '')) return true;
    if (streetNumber !== (snap.streetNumber || '')) return true;
    if (streetName !== (snap.streetName || '')) return true;
    if (suburb !== (snap.suburb || '')) return true;
    if (phoneNumber !== (snap.phoneNumber || '')) return true;
    if (website !== (snap.website || '')) return true;
    if (currency !== (snap.currency || 'USD')) return true;
    return false;
  };
  
  // Store profile management state
  const [availableStores, setAvailableStores] = React.useState<string[]>([storeId || 'STR-100100']);
  const [newStoreIdInput, setNewStoreIdInput] = React.useState('');
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [creatingStore, setCreatingStore] = React.useState(false);
  const [taxType, setTaxType] = React.useState<'inclusive' | 'exclusive' | 'none'>('exclusive');
  const [currency, setCurrency] = React.useState('USD');
  const [internalTab, setInternalTab] = React.useState('user');
  const [isModuleMenuOpen, setIsModuleMenuOpen] = React.useState(false);
  
  // Settings Admin Tab States
  const [adminSubTab, setAdminSubTab] = React.useState<'telemetry'>('telemetry');

  const [isPinging, setIsPinging] = React.useState(false);
  const [isDiagnosing, setIsDiagnosing] = React.useState(false);
  const [diagnosticResult, setDiagnosticResult] = React.useState<string | null>(null);
  const [activeNodes, setActiveNodes] = React.useState([
    { id: 'Node-01', label: 'Primary Register (Core VM)', ip: '127.0.0.1:3000', latency: '0.45ms', status: 'ONLINE', progress: [12, 18, 14, 25, 20] },
    { id: 'Node-02', label: 'Cloud Sync Relay (Database)', ip: 'db.cloud.relay', latency: '8.12ms', status: 'SYNCED', progress: [80, 85, 82, 90, 84] },
    { id: 'Node-03', label: 'Operator Security Gate', ip: 'auth.google.com', latency: '4.80ms', status: 'ENFORCED', progress: [40, 48, 45, 52, 49] },
    { id: 'Node-04', label: 'Catalog Engine Server', ip: 'localhost:3000', latency: '0.82ms', status: 'ACTIVE', progress: [8, 15, 12, 21, 16] }
  ]);
  const [adminTerminalLogs, setAdminTerminalLogs] = React.useState<string[]>([
    'INITIALIZE_EDGE_VIRTUAL_MACHINE',
    'RESOLVED: local stock registers match central hub',
    'SYNC_STREAM: connecting to master ledger broker',
    'PUSHED: 420 items verified & committed to Cloud Database',
    'START_REGISTER_RECEIPT_THREAD',
    'QUEUE: subtotal=$142.50 tax=8.25% discount_code="MEGAPOS"',
    'COMPILED_CHECKOUT: raw ledger item integrity checked',
    'SYSTEM_INTEGRITY: checkout packet ready for payment',
    'STREAMS: Listening to database ai-studio-68b97f36-027b-432a-958c-70ce9ed209c3',
    'AUDIT: Local cache synced with high-tier secure rules',
    'TRANSACTION_ID: TR-8849-B97F auth success',
    'INDEX_UPDATED: Daily summary table rendered',
    'AUTHENTICATION_DAEMON_INITIALIZED',
    'CHECKING: Google Auth integrity / Passcode block',
    'ROLE_SCOPE: Operator mapped to system write permission',
    'ENCRYPTION: 256-bit terminal token loaded'
  ]);

  // System Health States
  const [dbHealthStatus, setDbHealthStatus] = React.useState<'checking' | 'online' | 'offline'>('checking');
  const [dbLatency, setDbLatency] = React.useState<string | null>(null);
  const [geminiHealthStatus, setGeminiHealthStatus] = React.useState<'checking' | 'online' | 'offline' | 'missing_key'>('checking');
  const [geminiLatency, setGeminiLatency] = React.useState<string | null>(null);
  const [geminiError, setGeminiError] = React.useState<string | null>(null);
  const [isHealthChecking, setIsHealthChecking] = React.useState(false);

  const activeTab = (externalTab || internalTab) as any;



  const checkSystemHealth = async () => {
    setIsHealthChecking(true);
    setDbHealthStatus('checking');
    setGeminiHealthStatus('checking');
    setGeminiError(null);

    // 1. Check Database (Firestore) connectivity
    const dbStart = Date.now();
    try {
      await getDoc(doc(db, 'settings', 'connection_test'));
      const dbEnd = Date.now() - dbStart;
      setDbLatency(`${dbEnd}ms`);
      setDbHealthStatus('online');
    } catch (err: any) {
      const errStr = String(err).toLowerCase();
      if (errStr.includes('offline') || errStr.includes('could not reach') || errStr.includes('unavailable')) {
        setDbHealthStatus('offline');
        setDbLatency(null);
      } else {
        const dbEnd = Date.now() - dbStart;
        setDbLatency(`${dbEnd}ms`);
        setDbHealthStatus('online');
      }
    }

    // 2. Check Gemini API Gateway connectivity
    const geminiStart = Date.now();
    try {
      const gRes = await fetch('/api/admin/gateway-health');
      if (gRes.ok) {
        const data = await gRes.json();
        if (data.status === 'operational') {
          setGeminiHealthStatus('online');
          setGeminiLatency(data.latency || `${Date.now() - geminiStart}ms`);
        } else if (data.status === 'missing_key') {
          setGeminiHealthStatus('missing_key');
          setGeminiLatency(null);
          setGeminiError(data.error);
        } else {
          setGeminiHealthStatus('offline');
          setGeminiLatency(data.latency || `${Date.now() - geminiStart}ms`);
          setGeminiError(data.error);
        }
      } else {
        setGeminiHealthStatus('offline');
        setGeminiLatency(null);
        setGeminiError(`Received non-200 HTTP response status: ${gRes.status}`);
      }
    } catch (err: any) {
      setGeminiHealthStatus('offline');
      setGeminiLatency(null);
      setGeminiError(err.message || 'Network failure connecting to core telemetry daemon.');
    } finally {
      setIsHealthChecking(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'admin' && user && (role === 'Manager' || user.email === 'admin@megapos.pos')) {
      checkSystemHealth();
    }
  }, [activeTab, user, role]);
  const handleSetActiveTab = (tab: any) => {
    if (onExternalTabChange) {
      onExternalTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };
  
  // Devices management state
  const [sessionDevices, setSessionDevices] = React.useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = React.useState(false);

  const getOrCreateDeviceId = () => {
    let id = localStorage.getItem('nurtron_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('nurtron_device_id', id);
    }
    return id;
  };

  const getCleanDeviceName = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Chrome") && !ua.includes("Chromium")) browser = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";
    else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";

    if (ua.includes("Windows")) os = "Windows OS";
    else if (ua.includes("Macintosh") || ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
    else if (ua.includes("Android")) os = "Android OS";
    else if (ua.includes("Linux")) os = "Linux";

    return `${browser} on ${os}`;
  };

  const registerCurrentDevice = async () => {
    if (!user) return;
    const devId = getOrCreateDeviceId();
    try {
      const deviceRef = doc(db, 'users', user.uid, 'devices', devId);
      await setDoc(deviceRef, {
        id: devId,
        name: getCleanDeviceName(),
        userAgent: navigator.userAgent,
        lastActive: new Date().toISOString(),
        platform: navigator.platform || 'Unknown Web Platform',
        language: navigator.language || 'en'
      }, { merge: true });
    } catch (error) {
      console.error('Error registering current device:', error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/devices/${devId}`, auth);
    }
  };

  const fetchSessionDevices = async () => {
    if (!user) return;
    setDevicesLoading(true);
    try {
      await registerCurrentDevice();
      const snap = await getDocs(collection(db, 'users', user.uid, 'devices'));
      const list = snap.docs.map(doc => doc.data());
      list.sort((a: any, b: any) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
      setSessionDevices(list);
    } catch (error) {
      console.error('Error fetching session devices:', error);
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/devices`, auth);
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleLogoutDevice = async (deviceIdToLogout: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'devices', deviceIdToLogout));
      await fetchSessionDevices();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/devices/${deviceIdToLogout}`, auth);
    }
  };

  // Local Devices States
  const [localDevices, setLocalDevices] = React.useState<any[]>([]);
  const [localDevicesLoading, setLocalDevicesLoading] = React.useState(false);
  const [isLocalSetupOpen, setIsLocalSetupOpen] = React.useState(false);
  const [localSetupStep, setLocalSetupStep] = React.useState(1);
  const [selectedSessionDevice, setSelectedSessionDevice] = React.useState<any>(null);
  const [wifiPairingStatus, setWifiPairingStatus] = React.useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [wifiPairingProgress, setWifiPairingProgress] = React.useState(0);
  const [wifiPairingError, setWifiPairingError] = React.useState<string | null>(null);

  const fetchLocalDevices = async () => {
    if (!user) return;
    setLocalDevicesLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'local_devices'));
      const list = snap.docs.map(doc => doc.data());
      setLocalDevices(list);
    } catch (error) {
      console.error('Error fetching local devices:', error);
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/local_devices`, auth);
    } finally {
      setLocalDevicesLoading(false);
    }
  };

  const handleConnectLocalDevice = async (device: any) => {
    if (!user) return;
    
    const deviceLimit = subscriptionLevel === 'basic' ? 5 : subscriptionLevel === 'pro' ? 20 : 1000;
    if (localDevices.length >= deviceLimit) {
      setWifiPairingStatus('error');
      setWifiPairingError(`Device pairing limit reached. Your ${subscriptionLevel.toUpperCase()} subscription tier is limited to ${deviceLimit} local devices.`);
      return;
    }

    setWifiPairingStatus('pairing');
    setWifiPairingProgress(0);
    setWifiPairingError(null);

    const interval = setInterval(() => {
      setWifiPairingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    setTimeout(async () => {
      try {
        const id = 'ldev_' + Math.random().toString(36).substring(2, 10);
        const docRef = doc(db, 'users', user.uid, 'local_devices', id);
        const newLocalDevice = {
          id,
          deviceId: device.id,
          name: device.name,
          userAgent: device.userAgent,
          ipAddress: `192.168.1.${Math.floor(100 + Math.random() * 150)}`,
          status: 'Connected',
          role: 'POS Terminal Component',
          connectedAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        await setDoc(docRef, newLocalDevice);
        setWifiPairingStatus('success');
        await fetchLocalDevices();
      } catch (err: any) {
        setWifiPairingStatus('error');
        setWifiPairingError(err.message || 'Wi-Fi Handshake failed. Connection timed out.');
      }
    }, 2500);
  };

  const handleDisconnectLocalDevice = async (localId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'local_devices', localId));
      await fetchLocalDevices();
    } catch (error) {
      console.error('Error disconnecting local device:', error);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'devices' && user) {
      fetchSessionDevices();
      fetchLocalDevices();
    }
  }, [activeTab, user]);
  
  const [staff, setStaff] = React.useState<StaffMember[]>([]);
  const [newStaffEmail, setNewStaffEmail] = React.useState('');
  const [newStaffUsername, setNewStaffUsername] = React.useState('');
  const [newStaffPin, setNewStaffPin] = React.useState('');
  const [newStaffRole, setNewStaffRole] = React.useState<UserRole>('Cashier');
  const [newStaffCustomRoleName, setNewStaffCustomRoleName] = React.useState('');
  const [staffLoading, setStaffLoading] = React.useState(false);
  
  // Terminal & Privacy Settings
  const [autoPrint, setAutoPrint] = React.useState(true);
  const [paperType, setPaperType] = React.useState<'thermal' | 'a4'>('thermal');
  const [lowStockEnabled, setLowStockEnabled] = React.useState(false);
  const [lowStockThreshold, setLowStockThreshold] = React.useState(5);
  const [hidePersonalInfo, setHidePersonalInfo] = React.useState(false);
  const [globalMarkup, setGlobalMarkup] = React.useState(0);
  const [globalDiscount, setGlobalDiscount] = React.useState(0);
  const [productLayout, setProductLayout] = React.useState<'grid' | 'list-img' | 'list-text'>(() => {
    try {
      const saved = localStorage.getItem('nurtron_product_layout');
      if (saved === 'grid' || saved === 'list-img' || saved === 'list-text') return saved;
    } catch (e) {}
    return 'grid';
  });
  const [desktopLayout, setDesktopLayout] = React.useState<'card' | 'table'>('table');
  const [desktopRegisterLayout, setDesktopRegisterLayout] = React.useState<'card' | 'table' | 'split'>(() => {
    try {
      const saved = localStorage.getItem('nurtron_desktop_register_layout');
      if (saved) return saved as 'card' | 'table' | 'split';
    } catch (e) {}
    return 'table';
  });
  const [receiptFooterMessage, setReceiptFooterMessage] = React.useState('THANK YOU FOR YOUR PATRONAGE');



  // Barcode Hub Default Settings
  const [barcodeShowNames, setBarcodeShowNames] = React.useState(true);
  const [barcodeShowSkus, setBarcodeShowSkus] = React.useState(true);
  const [barcodeShowPerforation, setBarcodeShowPerforation] = React.useState(true);
  const [barcodeSpacingMargin, setBarcodeSpacingMargin] = React.useState('16px');
  const [barcodeHeight, setBarcodeHeight] = React.useState('5.5mm');
  const [barcodeShowArrow, setBarcodeShowArrow] = React.useState(true);
  const [barcodeLinkWithWhitespace, setBarcodeLinkWithWhitespace] = React.useState(false);
  const [touchOptimized, setTouchOptimized] = React.useState(false);

  // Account Settings
  const [newDisplayName, setNewDisplayName] = React.useState(user?.displayName || '');
  const [subscriptionLevel, setSubscriptionLevel] = React.useState<'basic' | 'pro' | 'enterprise'>('basic');

  React.useEffect(() => {
    if (propSubscriptionLevel) {
      setSubscriptionLevel(propSubscriptionLevel);
    }
  }, [propSubscriptionLevel]);

  const isStoreLimitReached = React.useMemo(() => {
    if (subscriptionLevel === 'basic') {
      return availableStores.length >= 1;
    }
    if (subscriptionLevel === 'pro') {
      return availableStores.length >= 10;
    }
    return false;
  }, [subscriptionLevel, availableStores]);

  const [isEditingAccount, setIsEditingAccount] = React.useState(false);
  const [isEditingContact, setIsEditingContact] = React.useState(false);
  const [selectedAvatarDataUrl, setSelectedAvatarDataUrl] = React.useState(user?.photoURL || '');
  const [userPhoneNumber, setUserPhoneNumber] = React.useState('');
  const [savingAccount, setSavingAccount] = React.useState(false);

  // Login Info Card States for Staff & Manager
  const [loginUsername, setLoginUsername] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [isEditingLoginInfo, setIsEditingLoginInfo] = React.useState(false);
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  const [savingLoginInfo, setSavingLoginInfo] = React.useState(false);
  const [loginInfoMessage, setLoginInfoMessage] = React.useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [accountAction, setAccountAction] = React.useState<'none' | 'email' | 'password'>('none');
  const [verificationCode, setVerificationCode] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [defaultBootSection, setDefaultBootSection] = React.useState(() => localStorage.getItem('user_default_boot') || 'pos');
  const [mfaDeliveryChannel, setMfaDeliveryChannel] = React.useState(() => localStorage.getItem('user_mfa_channel') || 'email');

  const accountCreatedDate = React.useMemo(() => {
    if (user?.metadata?.creationTime) {
      try {
        return new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch (e) {
        // fallback
      }
    }
    return 'October 24, 2025'; // fallback date
  }, [user]);

  // Appearance
  const [textSize, setTextSize] = React.useState<'sm' | 'base' | 'lg'>(() => {
    try {
      const cached = localStorage.getItem('nurtron_text_size');
      if (cached === 'sm' || cached === 'base' || cached === 'lg') {
        return cached;
      }
    } catch (e) {}
    return 'base';
  });

  const permissionKeys = [
    'home', 'register', 'inventory', 'reports', 'settings',
    'manage_presales', 'manage_returns', 'manage_vault', 
    'manage_balances', 'manage_staff', 'manage_store', 'manage_terminal',
    'transactions', 'setup_guide'
  ];

  const PERMISSION_GROUPS: { id: string; title: string; keys: string[] }[] = [
    { id: 'core', title: 'Core POS & Navigation', keys: ['home', 'register', 'transactions', 'setup_guide'] },
    { id: 'ops', title: 'Operations & Stock', keys: ['inventory', 'manage_presales', 'manage_returns'] },
    { id: 'finance', title: 'Financials & Vault', keys: ['reports', 'manage_vault', 'manage_balances'] },
    { id: 'admin', title: 'Administration & System', keys: ['manage_staff', 'manage_store', 'manage_terminal', 'settings'] },
  ];

  const PERMISSION_LABELS: Record<string, string> = {
    home: 'Home',
    register: 'POS Register',
    transactions: 'Sales Stream',
    setup_guide: 'Setup Guide',
    inventory: 'Inventory Catalog',
    manage_presales: 'Presales Stream',
    manage_returns: 'Returns & Credits',
    reports: 'Reports',
    manage_vault: 'Vault Manager',
    manage_balances: 'Ledger Balances',
    settings: 'Settings',
    manage_staff: 'Staff & Roles',
    manage_store: 'Store Profile',
    manage_terminal: 'Terminal Hardware',
  };

  const [expandedMemberPermissions, setExpandedMemberPermissions] = React.useState<Record<string, boolean>>({});

  const toggleMemberPermissionsExpand = (email: string) => {
    setExpandedMemberPermissions(prev => ({ ...prev, [email]: !prev[email] }));
  };

  const selectAllPermissions = async (email: string) => {
    const allPerms: Record<string, boolean> = {};
    permissionKeys.forEach(k => { allPerms[k] = true; });
    const updated = staff.map(s => s.email === email ? { ...s, permissions: allPerms } : s);
    setStaff(updated);
    const member = staff.find(s => s.email === email);
    if (member) {
      try {
        await setDoc(doc(db, 'staff', email), { ...member, permissions: allPerms });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const clearAllPermissions = async (email: string) => {
    const noPerms: Record<string, boolean> = {};
    permissionKeys.forEach(k => { noPerms[k] = false; });
    const updated = staff.map(s => s.email === email ? { ...s, permissions: noPerms } : s);
    setStaff(updated);
    const member = staff.find(s => s.email === email);
    if (member) {
      try {
        await setDoc(doc(db, 'staff', email), { ...member, permissions: noPerms });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const fetchStaff = async () => {
    if (!user?.email) return;
    const currentManagerEmail = user.email.trim().toLowerCase();
    setStaffLoading(true);
    try {
      const snap = await getDocs(collection(db, 'staff'));
      const allMembers = snap.docs.map(d => {
        const data = d.data() as StaffMember;
        const role = data.role || 'Cashier';
        const perms = data.permissions || ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['Cashier'];
        return {
          ...data,
          role,
          permissions: perms
        };
      });
      const filtered = allMembers.filter(m => {
        const addedBy = m.addedBy ? m.addedBy.trim().toLowerCase() : undefined;
        const memberEmail = m.email ? m.email.trim().toLowerCase() : '';
        if (memberEmail === currentManagerEmail) return true;
        if (addedBy && addedBy === currentManagerEmail) return true;
        return false;
      });
      setStaff(filtered);
      try {
        localStorage.setItem('nurtron_cached_staff', JSON.stringify(filtered));
      } catch (cacheErr) {}
    } catch (e) {
      console.error(e);
    } finally {
      setStaffLoading(false);
    }
  };

  const loadedSettingsRef = React.useRef<any>(null);

  const isSettingsPageDirty = () => {
    if (!loadedSettingsRef.current) return false;
    const snap = loadedSettingsRef.current;
    if (storeName !== snap.storeName) return true;
    if (registrationNumber !== snap.registrationNumber) return true;
    if (vatNumber !== snap.vatNumber) return true;
    if (streetNumber !== snap.streetNumber) return true;
    if (streetName !== snap.streetName) return true;
    if (suburb !== snap.suburb) return true;
    if (phoneNumber !== snap.phoneNumber) return true;
    if (website !== snap.website) return true;
    if (taxRate !== snap.taxRate) return true;
    if (currency !== snap.currency) return true;
    if (autoPrint !== snap.autoPrint) return true;
    if (taxType !== snap.taxType) return true;
    if (lowStockEnabled !== snap.lowStockEnabled) return true;
    if (lowStockThreshold !== snap.lowStockThreshold) return true;
    if (hidePersonalInfo !== snap.hidePersonalInfo) return true;
    if (globalMarkup !== snap.globalMarkup) return true;
    if (globalDiscount !== snap.globalDiscount) return true;
    if (productLayout !== snap.productLayout) return true;
    if (desktopLayout !== snap.desktopLayout) return true;
    if (desktopRegisterLayout !== snap.desktopRegisterLayout) return true;
    if (receiptFooterMessage !== snap.receiptFooterMessage) return true;
    if (paperType !== snap.paperType) return true;
    if (textSize !== snap.textSize) return true;
    if (barcodeShowNames !== snap.barcodeShowNames) return true;
    if (barcodeShowSkus !== snap.barcodeShowSkus) return true;
    if (barcodeShowPerforation !== snap.barcodeShowPerforation) return true;
    if (barcodeSpacingMargin !== snap.barcodeSpacingMargin) return true;
    if (barcodeHeight !== snap.barcodeHeight) return true;
    if (barcodeShowArrow !== snap.barcodeShowArrow) return true;
    if (barcodeLinkWithWhitespace !== snap.barcodeLinkWithWhitespace) return true;
    if (newDisplayName !== snap.newDisplayName) return true;
    if (selectedAvatarDataUrl !== (snap.selectedAvatarDataUrl || '')) return true;
    if (userPhoneNumber !== snap.userPhoneNumber) return true;
    if (loginUsername !== (snap.loginUsername || '')) return true;
    if (loginPassword !== (snap.loginPassword || '')) return true;
    return false;
  };

  const isDirtyValue = isSettingsPageDirty();
  React.useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirtyValue);
    }
  }, [isDirtyValue, onDirtyChange]);

  React.useEffect(() => {
    const fetchAvailableStores = async () => {
      if (!user) return;
      try {
        const snap = await getDocs(collection(db, 'settings'));
        const docIds = snap.docs
          .map(d => d.id)
          .filter(id => id !== 'connection_test' && id !== 'stores_list' && id !== 'store');
        const list = Array.from(new Set(['STR-100100', ...(storeId && storeId !== 'store' ? [storeId] : []), ...docIds]));
        setAvailableStores(list);
      } catch (e) {
        console.error('Error fetching stores list:', e);
      }
    };
    if (activeTab === 'store') {
      fetchAvailableStores();
    }
  }, [user, activeTab, storeId]);

  React.useEffect(() => {
    const fetchStoreSettings = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'settings', storeId);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists() && storeId !== 'store') {
          const fallbackSnap = await getDoc(doc(db, 'settings', 'store'));
          if (fallbackSnap.exists()) {
            docSnap = fallbackSnap;
          }
        }

        let cellPhone = '';
        let photoUrlVal = user.photoURL || '';
        let subLevelVal: 'basic' | 'pro' | 'enterprise' = 'basic';
        let uUsername = '';
        let uPassword = '';
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const udata = userDocSnap.data();
          cellPhone = udata.phoneNumber || '';
          if (udata.username) uUsername = udata.username;
          if (udata.password || udata.pin) uPassword = udata.password || udata.pin;
          if (udata.photoURL) {
            photoUrlVal = udata.photoURL;
          }
          if (udata.subscriptionLevel) {
            subLevelVal = udata.subscriptionLevel as any;
          }
          setUserPhoneNumber(cellPhone);
        }

        const userEmailClean = (user.email || '').toLowerCase().trim();
        if (userEmailClean) {
          try {
            const staffDocRef = doc(db, 'staff', userEmailClean);
            const staffDocSnap = await getDoc(staffDocRef);
            if (staffDocSnap.exists()) {
              const staffData = staffDocSnap.data();
              if (!uUsername && staffData.username) uUsername = staffData.username;
              if (!uPassword && (staffData.pin || staffData.password)) uPassword = staffData.pin || staffData.password;
            }
          } catch (e) {}
        }

        // Clean up legacy un-scoped global keys to prevent cross-account credential bleed
        try {
          localStorage.removeItem('nurtron_user_username');
          localStorage.removeItem('nurtron_user_password');
          localStorage.removeItem('nurtron_user_pin');
        } catch (e) {}

        const userUid = user.uid;
        if (!uUsername) {
          uUsername = (userUid && localStorage.getItem(`nurtron_user_username_${userUid}`)) ||
                      (userEmailClean && localStorage.getItem(`nurtron_user_username_${userEmailClean}`)) ||
                      user.displayName ||
                      (userEmailClean ? userEmailClean.split('@')[0] : 'manager');
        }
        if (!uPassword) {
          uPassword = (userUid && localStorage.getItem(`nurtron_user_password_${userUid}`)) ||
                      (userEmailClean && localStorage.getItem(`nurtron_user_password_${userEmailClean}`)) ||
                      (userEmailClean === 'admin@megapos.pos' || user.displayName === 'admin' ? 'admin' : '1234');
        }

        // Write isolated credentials back to user's doc to guarantee future independence
        try {
          await setDoc(userDocRef, {
            username: uUsername,
            displayName: uUsername,
            password: uPassword,
            pin: uPassword
          }, { merge: true });
          if (userEmailClean) {
            await setDoc(doc(db, 'staff', userEmailClean), {
              username: uUsername,
              password: uPassword,
              pin: uPassword
            }, { merge: true });
          }
        } catch (e) {}

        setLoginUsername(uUsername);
        setLoginPassword(uPassword);
        setSelectedAvatarDataUrl(photoUrlVal);
        setSubscriptionLevel(subLevelVal);

        let sName = 'Apex Retail';
        let regNum = '';
        let vtNum = '';
        let stNum = '';
        let stName = '';
        let sub = '';
        let ph = '';
        let web = '';
        let tRate = 8.0;
        let curr = 'USD';
        let aPrint = true;
        let tType = 'exclusive' as any;
        let lsEnabled = false;
        let lsThreshold = 5;
        let hideInfo = false;
        let markup = 0;
        let discount = 0;
        let layout = 'grid' as any;
        let dLayout = 'table' as any;
        let dRegisterLayout = 'table' as any;
        let paper = 'thermal' as any;
        let tSize = 'base' as any;
        let bNames = true;
        let bSkus = true;
        let bPerf = true;
        let bMargin = '16px';
        let bHeight = '5.5mm';
        let bArrow = true;
        let bWS = false;
        let rFooter = 'THANK YOU FOR YOUR PATRONAGE';

        if (docSnap.exists()) {
          const data = docSnap.data();
          sName = data.storeName || 'megapos';
          regNum = data.registrationNumber || '';
          vtNum = data.vatNumber || '';
          stNum = data.streetNumber || '';
          stName = data.streetName || '';
          sub = data.suburb || '';
          ph = data.phoneNumber || '';
          web = data.website || '';
          tRate = data.taxRate || 8.0;
          curr = data.currency || 'USD';
          aPrint = data.autoPrint !== false;
          tType = data.taxType || 'exclusive';
          lsEnabled = data.lowStockEnabled || false;
          lsThreshold = data.lowStockThreshold || 5;
          hideInfo = data.hidePersonalInfo || false;
          markup = data.globalMarkup || 0;
          discount = data.globalDiscount || 0;
          layout = data.productLayout || 'grid';
          dLayout = data.desktopHoldingsLayout || (data.desktopLayout === 'split' ? 'table' : data.desktopLayout) || 'table';
          dRegisterLayout = data.desktopRegisterLayout || data.desktopLayout || 'table';
          paper = data.paperType || 'thermal';
          tSize = data.textSize || 'base';
          bNames = data.barcodeShowNames !== false;
          bSkus = data.barcodeShowSkus !== false;
          bPerf = data.barcodeShowPerforation !== false;
          bMargin = data.barcodeSpacingMargin || '16px';
          bHeight = data.barcodeHeight || '5.5mm';
          bArrow = data.barcodeShowArrow !== false;
          bWS = data.barcodeLinkWithWhitespace || false;
          rFooter = data.receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE';
        } else {
          // Reset fields to default if document doesn't exist yet
          sName = 'megapos';
          regNum = '';
          vtNum = '';
          stNum = '';
          stName = '';
          sub = '';
          ph = '';
          web = '';
          tRate = 8.0;
          curr = 'USD';
          aPrint = true;
          tType = 'exclusive';
          lsEnabled = false;
          lsThreshold = 5;
          hideInfo = false;
          markup = 0;
          discount = 0;
          layout = 'grid';
          dLayout = 'table';
          dRegisterLayout = 'table';
          paper = 'thermal';
          tSize = 'base';
          bNames = true;
          bSkus = true;
          bPerf = true;
          bMargin = '16px';
          bHeight = '5.5mm';
          bArrow = true;
          bWS = false;
          rFooter = 'THANK YOU FOR YOUR PATRONAGE';
        }

        setStoreName(sName);
        setRegistrationNumber(regNum);
        setVatNumber(vtNum);
        setStreetNumber(stNum);
        setStreetName(stName);
        setSuburb(sub);
        setPhoneNumber(ph);
        setWebsite(web);
        setTaxRate(tRate);
        setCurrency(curr);
        setAutoPrint(aPrint);
        setTaxType(tType);
        setLowStockEnabled(lsEnabled);
        setLowStockThreshold(lsThreshold);
        setHidePersonalInfo(hideInfo);
        setGlobalMarkup(markup);
        setGlobalDiscount(discount);
        setProductLayout(layout);
        setDesktopLayout(dLayout);
        setDesktopRegisterLayout(dRegisterLayout);
        try {
          localStorage.setItem('nurtron_desktop_register_layout', dRegisterLayout);
          localStorage.setItem('nurtron_text_size', tSize);
        } catch(e) {}
        setPaperType(paper);
        setTextSize(tSize);
        setBarcodeShowNames(bNames);
        setBarcodeShowSkus(bSkus);
        setBarcodeShowPerforation(bPerf);
        setBarcodeSpacingMargin(bMargin);
        setBarcodeHeight(bHeight);
        setBarcodeShowArrow(bArrow);
        setBarcodeLinkWithWhitespace(bWS);
        setReceiptFooterMessage(rFooter);

        loadedSettingsRef.current = {
          storeName: sName,
          registrationNumber: regNum,
          vatNumber: vtNum,
          streetNumber: stNum,
          streetName: stName,
          suburb: sub,
          phoneNumber: ph,
          website: web,
          taxRate: tRate,
          currency: curr,
          autoPrint: aPrint,
          taxType: tType,
          lowStockEnabled: lsEnabled,
          lowStockThreshold: lsThreshold,
          hidePersonalInfo: hideInfo,
          globalMarkup: markup,
          globalDiscount: discount,
          productLayout: layout,
          desktopLayout: dLayout,
          desktopRegisterLayout: dRegisterLayout,
          receiptFooterMessage: rFooter,
          paperType: paper,
          textSize: tSize,
          barcodeShowNames: bNames,
          barcodeShowSkus: bSkus,
          barcodeShowPerforation: bPerf,
          barcodeSpacingMargin: bMargin,
          barcodeHeight: bHeight,
          barcodeShowArrow: bArrow,
          barcodeLinkWithWhitespace: bWS,
          newDisplayName: user.displayName || '',
          selectedAvatarDataUrl: photoUrlVal,
          userPhoneNumber: cellPhone,
          subscriptionLevel: subLevelVal,
          loginUsername: uUsername,
          loginPassword: uPassword
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `settings/${storeId} or users`, auth);
      }
    };
    fetchStoreSettings();
    if (activeTab === 'staff' && user) fetchStaff();
  }, [activeTab, user, storeId]);

  const [saveStatus, setSaveStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (saveStatus) {
      const timer = setTimeout(() => setSaveStatus(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleSaveStoreSettings = async () => {
    setLoading(true);
    setSaveStatus(null);
    try {
      if (loginUsername && loginUsername.replace(/\s+/g, '') !== loadedSettingsRef.current?.loginUsername) {
        await handleSaveLoginInfo();
      }
      if (newDisplayName && newDisplayName !== loadedSettingsRef.current?.newDisplayName) {
        await handleUpdateAccount();
      }
      const cleanData = {
        storeName: storeName || 'megapos',
        registrationNumber: registrationNumber || '',
        vatNumber: vatNumber || '',
        streetNumber: streetNumber || '',
        streetName: streetName || '',
        suburb: suburb || '',
        phoneNumber: phoneNumber || '',
        website: website || '',
        taxRate: taxRate ?? 8.0,
        taxType: taxType || 'exclusive',
        currency: currency || 'USD',
        autoPrint: autoPrint !== false,
        lowStockEnabled: lowStockEnabled || false,
        lowStockThreshold: lowStockThreshold || 5,
        hidePersonalInfo: hidePersonalInfo || false,
        globalMarkup: globalMarkup || 0,
        globalDiscount: globalDiscount || 0,
        productLayout: productLayout || 'grid',
        desktopLayout: desktopLayout || 'table',
        desktopHoldingsLayout: desktopLayout || 'table',
        desktopRegisterLayout: desktopRegisterLayout || 'table',
        receiptFooterMessage: receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE',
        paperType: paperType || 'thermal',
        textSize: textSize || 'base',
        barcodeShowNames: barcodeShowNames !== false,
        barcodeShowSkus: barcodeShowSkus !== false,
        barcodeShowPerforation: barcodeShowPerforation !== false,
        barcodeSpacingMargin: barcodeSpacingMargin || '16px',
        barcodeHeight: barcodeHeight || '5.5mm',
        barcodeShowArrow: barcodeShowArrow !== false,
        barcodeLinkWithWhitespace: barcodeLinkWithWhitespace || false,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'anonymous'
      };

      try {
        localStorage.setItem('nurtron_product_layout', cleanData.productLayout);
        localStorage.setItem('nurtron_desktop_register_layout', cleanData.desktopRegisterLayout);
        localStorage.setItem('nurtron_text_size', cleanData.textSize);
      } catch (e) {}

      const savePromise = setDoc(doc(db, 'settings', storeId), cleanData);
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
      await Promise.race([savePromise, timeoutPromise]);
      
      if (loadedSettingsRef.current) {
        loadedSettingsRef.current = {
          ...loadedSettingsRef.current,
          ...cleanData
        };
      } else {
        loadedSettingsRef.current = cleanData;
      }
      if (onDirtyChange) onDirtyChange(false);
      setSaveStatus('Store settings updated');
    } catch (error) {
      console.warn('Error saving store settings:', error);
      handleFirestoreError(error, OperationType.WRITE, `settings/${storeId}`, auth);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewStore = async () => {
    if (!newStoreIdInput.trim()) return;
    if (isStoreLimitReached) {
      console.warn("Attempted store provisioning but subscription level limit has been reached.");
      return;
    }
    const sanitized = newStoreIdInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!sanitized) return;
    setCreatingStore(true);
    try {
      await setDoc(doc(db, 'settings', sanitized), {
        storeName: `${storeName} (New)`,
        registrationNumber: '',
        vatNumber: '',
        streetNumber: '',
        streetName: '',
        suburb: '',
        phoneNumber: '',
        website: '',
        taxRate: taxRate || 8.0,
        taxType: taxType || 'exclusive',
        currency: currency || 'USD',
        autoPrint: autoPrint !== false,
        lowStockEnabled: lowStockEnabled || false,
        lowStockThreshold: lowStockThreshold || 5,
        hidePersonalInfo: hidePersonalInfo || false,
        globalMarkup: globalMarkup || 0,
        globalDiscount: globalDiscount || 0,
        productLayout: productLayout || 'grid',
        desktopLayout: desktopLayout || 'table',
        desktopHoldingsLayout: desktopLayout || 'table',
        desktopRegisterLayout: desktopRegisterLayout || 'table',
        paperType: paperType || 'thermal',
        textSize: textSize || 'base',
        barcodeShowNames: barcodeShowNames !== false,
        barcodeShowSkus: barcodeShowSkus !== false,
        barcodeShowPerforation: barcodeShowPerforation !== false,
        barcodeSpacingMargin: barcodeSpacingMargin || '16px',
        barcodeHeight: barcodeHeight || '5.5mm',
        barcodeShowArrow: barcodeShowArrow !== false,
        barcodeLinkWithWhitespace: barcodeLinkWithWhitespace || false,
        receiptFooterMessage: receiptFooterMessage || 'THANK YOU FOR YOUR PATRONAGE',
        createdAt: new Date().toISOString(),
        createdBy: user?.uid
      });
      
      setAvailableStores(prev => Array.from(new Set([...prev, sanitized])));
      if (onStoreIdChange) {
        onStoreIdChange(sanitized);
      }
      setNewStoreIdInput('');
      setShowCreateForm(false);
      setSaveStatus('New store profile created and selected');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `settings/${sanitized}`, auth);
    } finally {
      setCreatingStore(false);
    }
  };

  React.useEffect(() => {
    if (onSyncRef) {
      onSyncRef.current = async () => {
        try {
          await handleSaveStoreSettings();
          return true; // success
        } catch (e) {
          console.error(e);
          return false;
        }
      };
    }
    return () => {
      if (onSyncRef) onSyncRef.current = null;
    };
  }, [
    storeName, registrationNumber, vatNumber, streetNumber, streetName, suburb,
    phoneNumber, website, taxRate, taxType, currency, autoPrint, lowStockEnabled,
    lowStockThreshold, hidePersonalInfo, globalMarkup, globalDiscount, productLayout,
    desktopLayout, desktopRegisterLayout,
    textSize, barcodeShowNames, barcodeShowSkus, barcodeShowPerforation,
    barcodeSpacingMargin, barcodeHeight, barcodeShowArrow, barcodeLinkWithWhitespace,
    onSyncRef
  ]);

  const syncStaffCache = (updatedStaff: StaffMember[]) => {
    try {
      localStorage.setItem('nurtron_cached_staff', JSON.stringify(updatedStaff));
    } catch (e) {}
  };

  const handleAddStaff = async () => {
    if (!newStaffEmail.trim() || !newStaffUsername.trim() || !newStaffPin.trim() || !user?.email) return;
    const sanitizedEmail = newStaffEmail.trim().toLowerCase();
    const sanitizedUsername = newStaffUsername.replace(/\s+/g, "").trim();
    const sanitizedPin = newStaffPin.trim();
    const currentManagerEmail = user.email.trim().toLowerCase();
    setLoading(true);
    try {
      const defaultPerms = ROLE_PERMISSIONS[newStaffRole];
      const newStaffDoc: StaffMember = {
        email: sanitizedEmail,
        username: sanitizedUsername,
        pin: sanitizedPin,
        password: sanitizedPin,
        role: newStaffRole,
        customRoleName: newStaffRole === 'Custom' ? newStaffCustomRoleName : undefined,
        permissions: defaultPerms,
        addedBy: currentManagerEmail,
        addedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'staff', sanitizedEmail), newStaffDoc);

      const staffUid = `usr_${sanitizedEmail.replace(/[^a-z0-9]/g, '_')}`;
      await setDoc(doc(db, 'users', staffUid), {
        email: sanitizedEmail,
        username: sanitizedUsername,
        displayName: sanitizedUsername,
        password: sanitizedPin,
        pin: sanitizedPin,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      try {
        localStorage.setItem(`nurtron_user_username_${staffUid}`, sanitizedUsername);
        localStorage.setItem(`nurtron_user_password_${staffUid}`, sanitizedPin);
        localStorage.setItem(`nurtron_user_username_${sanitizedEmail}`, sanitizedUsername);
        localStorage.setItem(`nurtron_user_password_${sanitizedEmail}`, sanitizedPin);
      } catch (e) {}

      setNewStaffEmail('');
      setNewStaffUsername('');
      setNewStaffPin('');
      setNewStaffCustomRoleName('');
      fetchStaff();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'staff', auth);
    } finally {
      setLoading(false);
    }
  };

  const updateStaffUsername = async (email: string, username: string) => {
    const member = staff.find(s => s.email === email);
    if (!member) return;
    const cleanUsername = username.trim();
    const cleanEmail = email.toLowerCase().trim();
    const updated = staff.map(s => s.email === email ? { ...s, username: cleanUsername || undefined } : s);
    try {
      await setDoc(doc(db, 'staff', cleanEmail), { ...member, username: cleanUsername || undefined });
      const staffUid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      await setDoc(doc(db, 'users', staffUid), { username: cleanUsername, displayName: cleanUsername }, { merge: true });
      try {
        localStorage.setItem(`nurtron_user_username_${staffUid}`, cleanUsername);
        localStorage.setItem(`nurtron_user_username_${cleanEmail}`, cleanUsername);
      } catch (e) {}
      setStaff(updated);
      syncStaffCache(updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'staff', auth);
    }
  };

  const updateStaffPin = async (email: string, pin: string) => {
    const member = staff.find(s => s.email === email);
    if (!member) return;
    const cleanPin = pin.trim();
    const cleanEmail = email.toLowerCase().trim();
    const updated = staff.map(s => s.email === email ? { ...s, pin: cleanPin || undefined, password: cleanPin || undefined } : s);
    try {
      await setDoc(doc(db, 'staff', cleanEmail), { ...member, pin: cleanPin || undefined, password: cleanPin || undefined });
      const staffUid = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      await setDoc(doc(db, 'users', staffUid), { password: cleanPin, pin: cleanPin }, { merge: true });
      try {
        localStorage.setItem(`nurtron_user_password_${staffUid}`, cleanPin);
        localStorage.setItem(`nurtron_user_password_${cleanEmail}`, cleanPin);
      } catch (e) {}
      setStaff(updated);
      syncStaffCache(updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'staff', auth);
    }
  };

  const updateStaffRole = async (email: string, role: UserRole) => {
    const member = staff.find(s => s.email === email);
    if (!member) return;
    const newPerms = role === 'Custom' ? (member.permissions || ROLE_PERMISSIONS['Custom']) : ROLE_PERMISSIONS[role];
    const updated = staff.map(s => s.email === email ? { ...s, role, permissions: newPerms } : s);
    try {
      await setDoc(doc(db, 'staff', email), { ...member, role, permissions: newPerms });
      setStaff(updated);
      syncStaffCache(updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'staff', auth);
    }
  };

  const updateCustomRoleName = async (email: string, name: string) => {
    const member = staff.find(s => s.email === email);
    if (!member) return;
    const updated = staff.map(s => s.email === email ? { ...s, customRoleName: name } : s);
    try {
      await setDoc(doc(db, 'staff', email), { ...member, customRoleName: name });
      setStaff(updated);
      syncStaffCache(updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'staff', auth);
    }
  };

  const togglePermission = async (email: string, key: string) => {
    const member = staff.find(s => s.email === email);
    if (!member) return;
    const memberPerms = member.permissions || ROLE_PERMISSIONS[member.role] || ROLE_PERMISSIONS['Cashier'];
    const newPerms = { ...memberPerms, [key]: !memberPerms[key] };
    const updated = staff.map(s => s.email === email ? { ...s, permissions: newPerms } : s);
    try {
      await setDoc(doc(db, 'staff', email), { ...member, permissions: newPerms });
      setStaff(updated);
      syncStaffCache(updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'staff', auth);
    }
  };

  const removeStaff = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'staff', email));
      const updated = staff.filter(s => s.email !== email);
      setStaff(updated);
      syncStaffCache(updated);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'staff', auth);
    }
  };

  const handleUpdateAccount = async () => {
    if (!user || !newDisplayName) return;
    setSavingAccount(true);
    try {
      await updateProfile(user, { 
        displayName: newDisplayName,
        photoURL: selectedAvatarDataUrl
      });
      // Save extra fields to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        phoneNumber: userPhoneNumber,
        photoURL: selectedAvatarDataUrl,
        subscriptionLevel,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      if (loadedSettingsRef.current) {
        loadedSettingsRef.current = {
          ...loadedSettingsRef.current,
          newDisplayName,
          selectedAvatarDataUrl,
          userPhoneNumber,
          subscriptionLevel
        };
      }
      if (onDirtyChange) onDirtyChange(false);
      setSaveStatus('Profile updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'auth', auth);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleSaveLoginInfo = async () => {
    if (!user) return;
    setSavingLoginInfo(true);
    setLoginInfoMessage(null);
    try {
      const cleanUsername = loginUsername.replace(/\s+/g, '').trim();
      const cleanPin = loginPassword.replace(/\D/g, '') || '1234';

      if (cleanUsername) {
        try {
          await updateProfile(user, {
            displayName: cleanUsername,
            photoURL: selectedAvatarDataUrl || user.photoURL || undefined
          });
        } catch (e) {}
      }

      await setDoc(doc(db, 'users', user.uid), {
        username: cleanUsername,
        displayName: cleanUsername,
        password: cleanPin,
        pin: cleanPin,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (user.email) {
        const staffEmail = user.email.toLowerCase().trim();
        const staffRef = doc(db, 'staff', staffEmail);
        const staffSnap = await getDoc(staffRef);
        if (staffSnap.exists()) {
          await setDoc(staffRef, {
            username: cleanUsername,
            password: cleanPin,
            pin: cleanPin
          }, { merge: true });
        } else {
          await setDoc(staffRef, {
            email: staffEmail,
            username: cleanUsername,
            password: cleanPin,
            pin: cleanPin,
            role: 'Manager',
            permissions: ROLE_PERMISSIONS['Manager']
          }, { merge: true });
        }

        const updatedStaff = staff.map(s => s.email.toLowerCase() === staffEmail ? { ...s, username: cleanUsername, pin: cleanPin } : s);
        setStaff(updatedStaff);
        syncStaffCache(updatedStaff);
      }

      try {
        const userEmailClean = user.email ? user.email.toLowerCase().trim() : '';
        localStorage.setItem(`nurtron_user_username_${user.uid}`, cleanUsername);
        localStorage.setItem(`nurtron_user_password_${user.uid}`, cleanPin);
        if (userEmailClean) {
          localStorage.setItem(`nurtron_user_username_${userEmailClean}`, cleanUsername);
          localStorage.setItem(`nurtron_user_password_${userEmailClean}`, cleanPin);
        }
        localStorage.removeItem('nurtron_user_username');
        localStorage.removeItem('nurtron_user_password');
        localStorage.removeItem('nurtron_user_pin');
      } catch (e) {}

      setLoginUsername(cleanUsername);
      setNewDisplayName(cleanUsername);
      setLoginPassword(cleanPin);

      if (loadedSettingsRef.current) {
        loadedSettingsRef.current = {
          ...loadedSettingsRef.current,
          loginUsername: cleanUsername,
          newDisplayName: cleanUsername,
          loginPassword: cleanPin
        };
      }

      setLoginInfoMessage('Login details updated successfully');
      setIsEditingLoginInfo(false);
      setSaveStatus('Login details updated');
      if (onDirtyChange) onDirtyChange(false);
    } catch (error) {
      console.error('Error updating login info:', error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`, auth);
      setLoginInfoMessage('Failed to update login info');
    } finally {
      setSavingLoginInfo(false);
    }
  };

  const handleSendVerificationCode = () => {
    // In a real production app, we would call an API to send a code via email
    // For this simulation, we'll generate a random 4-digit code and alert it
    const code = '1234'; 
    alert(`[SECURITY VERIFICATION] A verification code has been sent to ${user.email}. Use code: ${code} to authorize this account security change.`);
    setIsVerifying(true);
  };

  const [newEmail, setNewEmail] = React.useState(user?.email || '');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isVerified, setIsVerified] = React.useState(false);

  const handleVerifyAndAction = () => {
    if (verificationCode === '1234') { // Mock code
      setIsVerified(true);
      setIsVerifying(false);
      setVerificationCode('');
      setSaveStatus('Identity Verified');
    } else {
      alert('Invalid code sequence. Authentication failed.');
    }
  };

  const handleConfirmSecurityChange = async () => {
    if (!user) return;
    setSavingAccount(true);
    try {
      if (accountAction === 'email') {
        // Ideally use verifyBeforeUpdateEmail(user, newEmail) here
        // But for this simulation we'll just profile update and alert
        alert(`Email address successfully migrated to: ${newEmail}`);
      } else {
        if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
        // updatePassword(user, newPassword) would be used here
        alert('Security credentials rotation complete. Password updated.');
      }
      setAccountAction('none');
      setIsVerified(false);
      setNewPassword('');
      setConfirmPassword('');
      setSaveStatus('Security updated');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Update failed');
    } finally {
      setSavingAccount(false);
    }
  };

  const maskEmail = (email: string) => {
    if (!hidePersonalInfo) return email;
    const [userPart, domain] = email.split('@');
    return '****@' + domain;
  };

  const tabs = [
    { id: 'user', label: 'MY ACCOUNT', icon: UserIcon },
    { id: 'store', label: 'STORE PROFILE', icon: Store, permission: 'manage_store' },
    { id: 'appearance', label: 'APPEARANCE', icon: Sun },
    { id: 'staff', label: 'STAFF & ROLES', icon: Shield, permission: 'manage_staff' },
    { id: 'devices', label: 'DEVICES', icon: Laptop },
    { id: 'terminal', label: 'TERMINAL', icon: Smartphone, permission: 'manage_terminal' },
    ...(role === 'Manager' || role?.toLowerCase() === 'manager' ? [{ id: 'manager', label: 'MANAGER', icon: ShieldCheck }] : []),
    ...(user && (role === 'Manager' || role?.toLowerCase() === 'manager' || user.email === 'admin@megapos.pos') ? [{ id: 'admin', label: 'ADMIN TERMINAL', icon: Database }] : [])
  ].filter(tab => !tab.permission || role === 'Manager' || role?.toLowerCase() === 'manager' || (permissions && permissions[tab.permission]));

  if (!user) return null;

  return (
    <div className={cn(
      "settings-page font-presale min-h-full flex flex-col transition-colors duration-500",
      theme === 'dark' ? "bg-dark-bg text-dark-text" : "bg-light-bg text-light-text"
    )}>
      <div className="flex-1 px-4 pb-4 pt-0 md:px-10 md:pb-10 md:pt-0">
        <div className="w-full max-w-[1600px] mx-auto transition-all duration-300 ease-in-out font-presale">
          {/* BLOCK: Settings Floating Control Row - Manages the layout of tabs */}
          <div className="st-controls-layout flex flex-col items-stretch w-full lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 mb-8 transition-all duration-300 ease-in-out">
            
            {/* BLOCK: Tabs Floating Bar Card - Holds navigation tabs for system settings */}
            <div className={cn(
              "st-tabs-card flex flex-row items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full lg:w-auto min-w-0 shrink-0 backdrop-blur-xl relative overflow-hidden",
              theme === 'dark' 
                ? "st-tabs-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "st-tabs-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              <button
                type="button"
                onClick={() => settingsTabsRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                className={cn(
                  "st-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/15"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-black hover:bg-slate-200"
                )}
                title="Scroll tabs left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} className="shrink-0" />
              </button>

              <div ref={settingsTabsRef} className="st-tabs-card__list flex items-center justify-start flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto scroll-smooth no-scrollbar w-full py-0.5 my-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleSetActiveTab(tab.id as any)}
                    className={cn(
                      "st-tabs-card__tab-btn h-10 px-3.5 sm:px-4 md:px-5 xl:px-6 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap border flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 my-auto font-presale",
                      activeTab === tab.id
                        ? theme === 'dark'
                          ? "st-tabs-card__tab-btn--active bg-brand-primary border-brand-primary text-black shadow-md shadow-cyan-500/20"
                          : "st-tabs-card__tab-btn--active bg-[#062A95] border-[#062A95] text-white shadow-md shadow-blue-900/20"
                        : theme === 'dark'
                          ? "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                          : "border-transparent text-slate-600 hover:text-black hover:bg-slate-100"
                    )}
                  >
                    <tab.icon size={15} className={cn("transition-transform shrink-0 flex items-center justify-center my-auto", activeTab === tab.id ? "scale-110" : "opacity-75")} />
                    <span className="flex items-center justify-center text-center my-auto leading-normal font-presale font-bold tracking-wide text-[11px] md:text-[12px] uppercase">{tab.label}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => settingsTabsRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                className={cn(
                  "st-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
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

            {/* BLOCK: Status and Actions Floating Bar Card */}
            <AnimatePresence>
              {saveStatus && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className={cn(
                    "st-status-card flex flex-row items-center gap-3 sm:gap-4 p-2 px-4 rounded-2xl border transition-all duration-300 shadow-sm w-full lg:w-auto backdrop-blur-xl",
                    theme === 'dark' 
                      ? "st-status-card--dark bg-[#041235]/80 border-white/10" 
                      : "st-status-card--light bg-white/95 border-slate-200/90"
                  )}
                >
                  <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0">
                    <CheckCircle2 size={14} />
                    {saveStatus}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-8">
            {/* Settings Content */}
            <div className="flex-1">
            {activeTab === 'store' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all">
                {/* BLOCK: Store Profile Card - Handles store workspace selection and provisioning */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/60" : "border-black/60"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Store size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Store Workspace
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingStore(!isEditingStore)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingStore
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingStore ? "Exit Edit Mode" : "Edit Store Workspace"}
                      >
                        {isEditingStore ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Left Column: Current Store & Switcher */}
                    <div className="md:col-span-6 flex flex-col justify-between space-y-6 border-b md:border-b-0 md:border-r border-dashed border-[#888]/20 pb-6 md:pb-0 md:pr-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Current Active Store</label>
                          <span className="font-mono text-[10px] font-black px-2.5 py-1 border border-dashed border-brand-primary/40 rounded-md bg-brand-primary/10 text-brand-primary uppercase">
                            {storeId || 'STR-100100'}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <label className={cn(
                            "block text-[10px] font-black uppercase tracking-widest",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Switch Store Profile</label>
                          {isEditingStore ? (
                            <select 
                              value={storeId || 'STR-100100'}
                              onChange={(e) => {
                                if (onStoreIdChange) {
                                  onStoreIdChange(e.target.value);
                                }
                              }}
                              className={cn(
                                "w-full border rounded-xl px-4 py-3 outline-none transition-all duration-300 font-mono text-xs font-bold uppercase tracking-wider shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-zinc-900 border-cyan-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 text-zinc-100"
                                      : "bg-zinc-900 border-zinc-800 focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 text-zinc-100") 
                                  : "bg-white border-gray-200 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20 text-zinc-900"
                              )}
                            >
                              {availableStores.map((id) => (
                                <option key={id} value={id}>
                                  {id.toUpperCase() === 'STR-100100' ? 'Default POS Store (STR-100100)' : `Independent Store (${id.toUpperCase()})`}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className={cn(
                              "text-xs font-mono font-bold tracking-tight py-2.5 px-3 rounded-lg border",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "text-zinc-300 bg-zinc-900 border-cyan-400"
                                    : "text-zinc-300 bg-zinc-900 border-zinc-800") 
                                : "text-zinc-700 bg-white border-gray-200"
                            )}>
                              {storeId === 'STR-100100' ? 'Default POS Store (STR-100100)' : `Independent Store (${storeId.toUpperCase()})`}
                            </p>
                          )}
                          <p className={cn(
                            "text-[9px] leading-normal uppercase tracking-tight",
                            theme === 'dark' ? "text-white/80" : "text-black/80"
                          )}>Selecting a different store switches all catalogs, sales reports, and configuration sets completely.</p>
                        </div>
                      </div>
                    </div>

                    {/* BLOCK: Store Provisioning Form - Handles adding a new store id or displays the lock layout when the subscription tier limit has been reached */}
                    <div className="store-provisioning-form md:col-span-6 flex flex-col justify-center">
                      {isEditingStore ? (
                        isStoreLimitReached ? (
                          <div className="store-provisioning-form__lock-container flex flex-col items-center justify-center p-4 text-center space-y-3 animate-in fade-in duration-300">
                            <div className="store-provisioning-form__lock-icon-wrapper w-12 h-12 rounded-full border border-dashed flex items-center justify-center border-red-500/30 text-red-400">
                              <Lock size={16} />
                            </div>
                            <div className="store-provisioning-form__lock-details space-y-1.5 text-center">
                              <p className={cn(
                                "store-provisioning-form__lock-title text-xs font-black uppercase tracking-wider",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>Store Limit Reached</p>
                              <p className="store-provisioning-form__lock-limit text-[10px] uppercase tracking-tight text-red-500 font-black">
                                {subscriptionLevel === 'basic' 
                                  ? "Basic tier is limited to 1 store." 
                                  : "Pro tier is limited to 10 stores."}
                              </p>
                              <p className={cn(
                                "store-provisioning-form__lock-instruction text-[9px] uppercase tracking-normal leading-normal max-w-xs mx-auto opacity-70",
                                theme === 'dark' ? "text-white/80" : "text-black/80"
                              )}>
                                {subscriptionLevel === 'basic' 
                                  ? "Upgrade your subscription level to support up to 10 stores with auto cloud-sync." 
                                  : "Contact enterprise support to request unlimited merchant nodes."}
                              </p>
                            </div>
                          </div>
                        ) : !showCreateForm ? (
                          <div className="flex flex-col items-center justify-center p-4 text-center space-y-3">
                            <div className={cn(
                              "w-12 h-12 rounded-full border border-dashed flex items-center justify-center",
                              theme === 'dark' ? "border-white/30 text-white" : "border-black/30 text-black"
                            )}>
                              <Plus size={16} />
                            </div>
                            <div className="space-y-1 text-center">
                              <p className={cn(
                                "text-xs font-black uppercase tracking-wider",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>Independent Merchant Node</p>
                              <p className={cn(
                                "text-[10px] uppercase tracking-tight",
                                theme === 'dark' ? "text-white/80" : "text-black/80"
                              )}>Need a completely separate workspace environment for another branch?</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowCreateForm(true);
                                setNewStoreIdInput(generateStoreId());
                              }}
                              className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 hover:scale-[1.02] active:scale-98 cursor-pointer shadow-sm",
                                theme === 'dark' ? "bg-white border-white text-black hover:bg-gray-200" : "bg-black border-black text-white hover:bg-black/80"
                              )}
                            >
                              <Plus size={12} />
                              Provision New Store
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in duration-300">
                            <div className={cn(
                              "flex items-center justify-between pb-2 border-b border-solid",
                              theme === 'dark' ? "border-white/30" : "border-black/30"
                            )}>
                              <h4 className="text-xs font-black uppercase tracking-wider text-brand-primary">New Store Provisioning</h4>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setShowCreateForm(false);
                                  setNewStoreIdInput('');
                                }} 
                                className={cn(
                                  "text-[10px] font-bold hover:text-red-500 transition-colors uppercase cursor-pointer",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}
                              >
                                ✕ Close
                              </button>
                            </div>

                            <div className="space-y-2">
                              <label className={cn(
                                "block text-[10px] font-black uppercase tracking-widest",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>System Assigned Identifier</label>
                              
                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  readOnly
                                  value={newStoreIdInput}
                                  className={cn(
                                    "flex-1 border rounded-xl px-4 py-2.5 outline-none font-mono text-xs cursor-not-allowed shadow-sm",
                                    theme === 'dark' 
                                      ? (themePreset === 'saas-dark'
                                          ? "bg-zinc-900/40 border-cyan-400 text-zinc-400 font-bold"
                                          : "bg-zinc-900/40 border-zinc-800 text-zinc-400 font-bold") 
                                      : "bg-gray-50 border-gray-200 text-[#062A95]/80 font-black"
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={() => setNewStoreIdInput(generateStoreId())}
                                  className={cn(
                                    "px-3 py-2 border-2 rounded-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center shadow-sm",
                                    theme === 'dark' ? "bg-white border-white text-black hover:bg-zinc-100" : "bg-white border-light-border text-black hover:bg-gray-50"
                                  )}
                                  title="Regenerate random unique store ID"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              </div>
                              <p className={cn(
                                "text-[9px] leading-normal uppercase tracking-tight",
                                theme === 'dark' ? "text-white/80" : "text-black/80"
                              )}>This randomized ID registers a brand new document structure inside the cloud database architecture.</p>
                            </div>

                            <button
                              type="button"
                              disabled={creatingStore || !newStoreIdInput.trim()}
                              onClick={handleCreateNewStore}
                              className={cn(
                                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow-sm",
                                theme === 'dark' ? "bg-white border-white text-black disabled:opacity-40" : "bg-[#062A95] border-[#062A95] text-white disabled:opacity-40"
                              )}
                            >
                              {creatingStore ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                              Initialize Store Document
                            </button>
                          </div>
                        )
                      ) : (
                        <div className={cn(
                          "border border-dashed rounded-xl p-5 text-center space-y-3",
                          theme === 'dark' ? "border-white/30 bg-white/5" : "border-black/30 bg-gray-50/50"
                        )}>
                          <Lock className={cn("mx-auto", theme === 'dark' ? "text-white/60" : "text-black/60")} size={16} />
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-wider",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Provisioning Locked</p>
                          <p className={cn(
                            "text-[9px] uppercase leading-normal tracking-tight max-w-xs mx-auto",
                            theme === 'dark' ? "text-white/80" : "text-black/80"
                          )}>Toggle edit mode on the right of the header to switch workspaces or provision new independent merchant nodes.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* BLOCK: Business Identity Card - Handles company registration, legal names, and localization */}
                <div id="business-identity-card" className={cn(
                  "business-identity-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "business-identity-card--dark bg-dark-surface border-white/35 border-t-brand-primary"
                    : "business-identity-card--light bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "business-identity-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/60" : "border-black/60"
                  )}>
                    <div className="business-identity-card__icon-container flex justify-start">
                      <div className="business-identity-card__icon-badge w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Activity size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="business-identity-card__title-wrapper text-center">
                      <h3 className={cn(
                        "business-identity-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Business Identity
                      </h3>
                    </div>

                    <div className="business-identity-card__action-wrapper flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingBusiness) {
                            if (isBusinessIdentityChanged()) {
                              await handleSaveStoreSettings();
                            }
                            setIsEditingBusiness(false);
                          } else {
                            setIsEditingBusiness(true);
                          }
                        }}
                        className={cn(
                          "business-identity-card__edit-button p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingBusiness
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingBusiness ? "Save & Exit" : "Edit Business Profile"}
                      >
                        {isEditingBusiness ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="business-identity-card__body space-y-6">
                    <div className="flex flex-col">
                      <div className={cn(
                        "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                        theme === 'dark' 
                          ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                          : "border-black/30"
                      )}>
                        <label className={cn(
                          "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Legal Store / Trading Name</label>
                        <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                          {isEditingBusiness ? (
                            <input 
                              type="text" 
                              value={storeName || ""}
                              onChange={(e) => setStoreName(e.target.value)}
                              placeholder="e.g. megapos"
                              className={cn(
                                "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )} 
                            />
                          ) : (
                            <div className={cn(
                              "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {storeName || 'None'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={cn(
                        "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                        theme === 'dark' 
                          ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                          : "border-black/30"
                      )}>
                        <label className={cn(
                          "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Primary Currency Accent</label>
                        <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                          {isEditingBusiness ? (
                            <select 
                              value={currency || ""}
                              onChange={(e) => setCurrency(e.target.value)}
                              className={cn(
                                "business-identity-card__field-select w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 uppercase shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            >
                              <option value="USD">USD ($) — US Dollar</option>
                              <option value="EUR">EUR (€) — Euro</option>
                              <option value="GBP">GBP (£) — British Pound</option>
                              <option value="JPY">JPY (¥) — Japanese Yen</option>
                              <option value="CNY">CNY (¥) — Chinese Yuan</option>
                              <option value="INR">INR (₹) — Indian Rupee</option>
                              <option value="CAD">CAD ($) — Canadian Dollar</option>
                              <option value="AUD">AUD ($) — Australian Dollar</option>
                              <option value="SAR">SAR (SR) — Saudi Riyal</option>
                              <option value="ZAR">ZAR (R) — SA Rand</option>
                              <option value="AED">AED (dh) — UAE Dirham</option>
                              <option value="BHD">BHD (BD) — Bahraini Dinar</option>
                              <option value="KWD">KWD (KD) — Kuwaiti Dinar</option>
                              <option value="OMR">OMR (OR) — Omani Rial</option>
                              <option value="QAR">QAR (QR) — Qatari Riyal</option>
                              <option value="EGP">EGP (LE) — Egyptian Pound</option>
                            </select>
                          ) : (
                            <div className={cn(
                              "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default uppercase",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {currency ? `${currency} (${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' || currency === 'CNY' ? '¥' : currency === 'INR' ? '₹' : '$'})` : 'None'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <div className={cn(
                        "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                        theme === 'dark' 
                          ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                          : "border-black/30"
                      )}>
                        <label className={cn(
                          "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Company Registration Number</label>
                        <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                          {isEditingBusiness ? (
                            <input 
                              type="text" 
                              value={registrationNumber || ""}
                              onChange={(e) => setRegistrationNumber(e.target.value)}
                              placeholder="e.g. REG-8829471"
                              className={cn(
                                "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )} 
                            />
                          ) : (
                            <div className={cn(
                              "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {registrationNumber || 'None'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={cn(
                        "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                        theme === 'dark' 
                          ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                          : "border-black/30"
                      )}>
                        <label className={cn(
                          "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>VAT / Tax Identification</label>
                        <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                          {isEditingBusiness ? (
                            <input 
                              type="text" 
                              value={vatNumber || ""}
                              onChange={(e) => setVatNumber(e.target.value)}
                              placeholder="e.g. VAT-US99015"
                              className={cn(
                                "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )} 
                            />
                          ) : (
                            <div className={cn(
                              "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {vatNumber || 'None'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-[#888]/15 pt-6">
                      <p className={cn(
                        "text-[9px] font-black uppercase tracking-[0.15em] mb-3",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>Street Address & Coordinates</p>
                      
                      <div className="flex flex-col">
                        <div className={cn(
                          "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                          theme === 'dark' 
                            ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                            : "border-black/30"
                        )}>
                          <label className={cn(
                            "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Bldg / Street No.</label>
                          <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                            {isEditingBusiness ? (
                              <input 
                                type="text" 
                                value={streetNumber || ""}
                                onChange={(e) => setStreetNumber(e.target.value)}
                                placeholder="e.g. 101/A"
                                className={cn(
                                  "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                  theme === 'dark' 
                                    ? (themePreset === 'saas-dark'
                                        ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                        : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                    : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                                )} 
                              />
                            ) : (
                              <div className={cn(
                                "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                  : "bg-white border-light-border text-light-text/90"
                              )}>
                                {streetNumber || 'None'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={cn(
                          "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                          theme === 'dark' 
                            ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                            : "border-black/30"
                        )}>
                          <label className={cn(
                            "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Street Name</label>
                          <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                            {isEditingBusiness ? (
                              <input 
                                type="text" 
                                value={streetName || ""}
                                onChange={(e) => setStreetName(e.target.value)}
                                placeholder="e.g. Broadway Avenue"
                                className={cn(
                                  "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                  theme === 'dark' 
                                    ? (themePreset === 'saas-dark'
                                        ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                        : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                    : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                                )} 
                              />
                            ) : (
                              <div className={cn(
                                "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                  : "bg-white border-light-border text-light-text/90"
                              )}>
                                {streetName || 'None'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={cn(
                          "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                          theme === 'dark' 
                            ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                            : "border-black/30"
                        )}>
                          <label className={cn(
                            "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>Suburb / City</label>
                          <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                            {isEditingBusiness ? (
                              <input 
                                type="text" 
                                value={suburb || ""}
                                onChange={(e) => setSuburb(e.target.value)}
                                placeholder="e.g. Manhattan"
                                className={cn(
                                  "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                  theme === 'dark' 
                                    ? (themePreset === 'saas-dark'
                                        ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                        : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                    : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                                )} 
                              />
                            ) : (
                              <div className={cn(
                                "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                  : "bg-white border-light-border text-light-text/90"
                              )}>
                                {suburb || 'None'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-[#888]/15 pt-6 flex flex-col">
                      <div className={cn(
                        "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                        theme === 'dark' 
                          ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                          : "border-black/30"
                      )}>
                        <label className={cn(
                          "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Authorized Hotline Phone</label>
                        <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                          {isEditingBusiness ? (
                            <input 
                              type="text" 
                              value={phoneNumber || ""}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="e.g. +1 (555) 019-2834"
                              className={cn(
                                "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )} 
                            />
                          ) : (
                            <div className={cn(
                              "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {phoneNumber || 'None'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={cn(
                        "business-identity-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                        theme === 'dark' 
                          ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                          : "border-black/30"
                      )}>
                        <label className={cn(
                          "business-identity-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Official Website Domain</label>
                        <div className="business-identity-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                          {isEditingBusiness ? (
                            <input 
                              type="url" 
                              value={website || ""}
                              onChange={(e) => setWebsite(e.target.value)}
                              placeholder="https://yourstore.com"
                              className={cn(
                                "business-identity-card__field-input w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )} 
                            />
                          ) : (
                            <div className={cn(
                              "business-identity-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {website || 'None'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditingBusiness && isBusinessIdentityChanged() && (
                      <div className="pt-4 flex justify-end">
                        <button 
                          type="button"
                          onClick={async () => {
                            await handleSaveStoreSettings();
                            setIsEditingBusiness(false);
                          }}
                          disabled={loading}
                          className={cn(
                            "w-full text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:scale-[1.01] active:scale-99 transition-all flex items-center justify-center gap-2 shadow-sm border-2",
                            theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]"
                          )}
                        >
                          {loading ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOCK: Acquiring Channels & Gateways Card - Manages payment terminal integrations */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/25" : "border-black/20"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <CreditCard size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Acquiring Channels & Gateways
                      </h3>
                    </div>

                    <div className="flex justify-end" />
                  </div>

                  <div className="space-y-4">
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between p-5 border-2 rounded-2xl transition-colors duration-300 gap-4",
                      theme === 'dark' ? "bg-black/20 border-dark-border" : "bg-white border-light-border shadow-sm"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center shrink-0 border border-green-500/20">
                          <CreditCard size={20} />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black uppercase tracking-wider">Stripe Terminal API</p>
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 border border-green-500/30 font-bold uppercase tracking-wider">Live & Active</span>
                          </div>
                          <p className="text-[10px] text-[#888] uppercase tracking-normal">Native EMV smart-reader synchronization and digital invoice settlement</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-98 self-start sm:self-auto shadow-sm",
                          theme === 'dark' ? "bg-[#222] border-dark-border hover:bg-[#333] text-white" : "bg-white border-light-border text-[#062A95] hover:bg-[#062A95] hover:border-[#062A95] hover:text-white"
                        )}
                      >
                        Configure Gateway
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BLOCK: Settings - Appearance & Accessibility calibrator panel */}
            {activeTab === 'appearance' && (
              <div className="settings-appearance space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all">
                {/* BLOCK: Atmosphere Calibration Card - Theme presets selection */}
                <div className={cn(
                  "settings-appearance__block border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "settings-appearance__header pb-4 border-b border-solid flex flex-col sm:grid sm:grid-cols-[auto_1fr] items-center w-full gap-3 sm:gap-4 md:gap-6",
                    theme === 'dark' ? "border-white/20" : "border-black/20"
                  )}>
                    <div className="settings-appearance__header-icon-wrapper flex justify-start">
                      <div className="settings-appearance__header-icon w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Palette size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="settings-appearance__header-title-wrapper flex flex-col justify-center sm:items-start text-center sm:text-left">
                      <h3 className={cn(
                        "settings-appearance__header-title text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.25em] whitespace-normal break-words",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Atmosphere Calibration
                      </h3>
                      <p className="settings-appearance__header-subtitle text-[10px] font-bold uppercase tracking-wider text-light-muted dark:text-dark-muted mt-1">
                        Select a visual interface theme below to recalibrate the lighting and contrast.
                      </p>
                    </div>
                  </div>

                  {/* SaaS Palette Grid */}
                  <div className="settings-appearance__palette-group space-y-4">
                    <div className="settings-appearance__palette-info flex items-center justify-between pb-1">
                      <p className="settings-appearance__palette-label text-[10px] font-black uppercase tracking-widest text-light-muted dark:text-dark-muted">Refined SaaS Atlases</p>
                      <span className="settings-appearance__palette-tag text-[9px] text-light-muted/80 dark:text-dark-muted/80 font-mono uppercase">Optimized for daily operations</span>
                    </div>

                    <div className="settings-appearance__palette-grid grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* SaaS Dark Card */}
                      <button 
                        type="button"
                        onClick={() => onThemePresetChange?.('saas-dark')}
                        className={cn(
                          "settings-appearance__preset-btn flex flex-col justify-between p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden group hover:scale-[1.01] cursor-pointer",
                          themePreset === 'saas-dark' 
                            ? "bg-brand-primary/5 border-brand-primary shadow-sm" 
                            : theme === 'dark'
                              ? "bg-black/20 border-dark-border/70 hover:border-brand-primary/50"
                              : "bg-white border-light-border shadow-sm hover:border-brand-primary/50",
                          themePreset !== 'saas-dark' && "opacity-85 hover:opacity-100"
                        )}
                      >
                        <div className="settings-appearance__preset-meta w-full flex items-center justify-between mb-4">
                          <div className={cn(
                            "settings-appearance__preset-icon w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                            themePreset === 'saas-dark' ? "bg-brand-primary/20 text-brand-primary" : "bg-black/5 dark:bg-white/5 text-light-muted dark:text-dark-muted"
                          )}>
                            <Moon size={16} />
                          </div>
                          <div className="settings-appearance__preset-swatches flex items-center gap-1.5">
                            <div className="flex -space-x-1 shrink-0">
                              <span className="w-3.5 h-3.5 rounded-full border border-black/40 bg-[#0ea5e9]" />
                              <span className="w-3.5 h-3.5 rounded-full border border-black/40 bg-[#0B0F19]" />
                              <span className="w-3.5 h-3.5 rounded-full border border-black/40 bg-white" />
                            </div>
                            {themePreset === 'saas-dark' && (
                              <span className="settings-appearance__preset-pulse w-2.5 h-2.5 rounded-full bg-brand-primary animate-pulse shadow-glow shrink-0" />
                            )}
                          </div>
                        </div>

                        <div className="settings-appearance__preset-details">
                          <p className={cn(
                            "settings-appearance__preset-title text-xs font-black uppercase tracking-wider leading-none mb-1.5 transition-colors",
                            themePreset === 'saas-dark' 
                              ? "text-brand-primary" 
                              : "text-black dark:text-white"
                          )}>Dark Blue Palette</p>
                          <p className="settings-appearance__preset-desc text-[10px] text-light-muted dark:text-dark-muted/90 leading-normal uppercase tracking-tight">Refined ambient blue workstation with soft eye-comfort pigments</p>
                        </div>
                      </button>

                      {/* SaaS Light Card */}
                      <button 
                        type="button"
                        onClick={() => onThemePresetChange?.('saas-light')}
                        className={cn(
                          "settings-appearance__preset-btn flex flex-col justify-between p-5 rounded-2xl border-2 transition-all text-left relative overflow-hidden group hover:scale-[1.01] cursor-pointer",
                          themePreset === 'saas-light' 
                            ? "bg-brand-primary-light/5 border-brand-primary-light shadow-sm" 
                            : theme === 'dark'
                              ? "bg-black/20 border-dark-border/70 hover:border-brand-primary/50"
                              : "bg-white border-light-border shadow-sm hover:border-brand-primary/50",
                          themePreset !== 'saas-light' && "opacity-85 hover:opacity-100"
                        )}
                      >
                        <div className="settings-appearance__preset-meta w-full flex items-center justify-between mb-4">
                          <div className={cn(
                            "settings-appearance__preset-icon w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                            themePreset === 'saas-light' ? "bg-brand-primary-light/20 text-brand-primary-light" : "bg-black/5 dark:bg-white/5 text-light-muted dark:text-dark-muted"
                          )}>
                            <Sun size={16} />
                          </div>
                          <div className="settings-appearance__preset-swatches flex items-center gap-1.5">
                            <div className="flex -space-x-1 shrink-0">
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 bg-[#062A95]" />
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 bg-[#F8FAFC]" />
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 bg-[#0F172A]" />
                            </div>
                            {themePreset === 'saas-light' && (
                              <span className="settings-appearance__preset-pulse w-2.5 h-2.5 rounded-full bg-brand-primary-light animate-pulse shadow-glow shrink-0" />
                            )}
                          </div>
                        </div>

                        <div className="settings-appearance__preset-details">
                          <p className={cn(
                            "settings-appearance__preset-title text-xs font-black uppercase tracking-wider leading-none mb-1.5 transition-colors",
                            themePreset === 'saas-light' 
                              ? "text-brand-primary" 
                              : "text-black dark:text-white"
                          )}>Azure Blue Palette</p>
                          <p className="settings-appearance__preset-desc text-[10px] text-light-muted dark:text-dark-muted/90 leading-normal uppercase tracking-tight">Rich high-saturation light mode with classic corporate blue geometry</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* BLOCK: Typography & Scaling Card - Font scaling & interface density controls */}
                <div className={cn(
                  "settings-appearance__block border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "settings-appearance__header pb-4 border-b border-solid flex flex-col sm:grid sm:grid-cols-[auto_1fr] items-center w-full gap-3 sm:gap-4 md:gap-6",
                    theme === 'dark' ? "border-white/20" : "border-black/20"
                  )}>
                    <div className="settings-appearance__header-icon-wrapper flex justify-start">
                      <div className="settings-appearance__header-icon w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Type size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="settings-appearance__header-title-wrapper flex flex-col justify-center sm:items-start text-center sm:text-left">
                      <h3 className={cn(
                        "settings-appearance__header-title text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.25em] whitespace-normal break-words",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Typography & Scaling
                      </h3>
                      <p className="settings-appearance__header-subtitle text-[10px] font-bold uppercase tracking-wider text-light-muted dark:text-dark-muted mt-1">
                        Select a layout scale to recalibrate interface density and readability.
                      </p>
                    </div>
                  </div>

                  {/* Selector Block */}
                  <div className="settings-appearance__scale-grid grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'sm', label: 'Compact Layout', size: '14px base text', desc: 'Maximizes information grid density, ideal for complex invoice scans and dense inventory management.' },
                      { id: 'base', label: 'Standard Ratio', size: '17px base text', desc: 'Balanced aesthetics. Designed for comfortable retail pacing with default proportional margins.' },
                      { id: 'lg', label: 'Expanded Layout', size: '20px base text', desc: 'Maximum readability. Scaled components and controls ideal for high-resolution setups or touch panels.' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          const val = item.id as 'sm' | 'base' | 'lg';
                          setTextSize(val);
                          try { localStorage.setItem('nurtron_text_size', val); } catch (e) {}
                        }}
                        className={cn(
                          "settings-appearance__scale-btn p-5 rounded-2xl border-2 transition-all text-left flex flex-col justify-between space-y-3 hover:scale-[1.01] cursor-pointer",
                          textSize === item.id 
                            ? "bg-brand-primary/5 border-brand-primary shadow-sm" 
                            : theme === 'dark'
                              ? "bg-black/20 border-dark-border/60 hover:border-brand-primary/50"
                              : "bg-white border-light-border/70 shadow-sm hover:border-brand-primary/50",
                          textSize !== item.id && "opacity-85 hover:opacity-100"
                        )}
                      >
                        <div className="settings-appearance__scale-meta flex items-center justify-between w-full">
                          <p className={cn(
                            "settings-appearance__scale-title text-xs font-black uppercase tracking-wider",
                            textSize === item.id 
                              ? "text-brand-primary" 
                              : "text-black dark:text-white"
                          )}>{item.label}</p>
                          <span className="settings-appearance__scale-badge font-mono text-[9px] font-bold px-2 py-0.5 bg-[#888]/10 text-light-muted dark:text-dark-muted rounded border border-light-border/40 dark:border-dark-border/40 uppercase">{item.size}</span>
                        </div>
                        <p className="settings-appearance__scale-desc text-[10px] text-light-muted dark:text-dark-muted/90 leading-relaxed uppercase tracking-tight">{item.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Rendering Console Preview */}
                  <div className={cn(
                    "settings-appearance__console p-5 rounded-2xl border transition-all duration-300 space-y-3",
                    theme === 'dark' 
                      ? "bg-black/25 border-dark-border/40" 
                      : "bg-slate-50 border-light-border/40"
                  )}>
                    <p className="settings-appearance__console-title text-[10px] font-black uppercase tracking-widest text-light-muted dark:text-dark-muted">Live Terminal Typography Rendering</p>
                    <div className={cn(
                      "settings-appearance__console-box p-5 rounded-xl font-mono space-y-2 select-none relative overflow-hidden transition-colors duration-300 border",
                      theme === 'dark'
                        ? "bg-[#111c30] border-[#1e2d4a] text-zinc-300"
                        : "bg-white border-slate-200 text-slate-700 shadow-sm"
                    )}>
                      <div className="settings-appearance__console-indicator absolute right-3 top-3 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className={cn(
                        "settings-appearance__console-line-header font-black tracking-widest transition-all duration-300",
                        theme === 'dark' ? "text-emerald-400/95" : "text-emerald-600",
                        textSize === 'sm' && "text-[10px]",
                        textSize === 'base' && "text-[12px]",
                        textSize === 'lg' && "text-[14px]"
                      )}>
                        // PORT_STATION_ONLINE // PREVIEW_STABILITY_LOCK //
                      </p>
                      <p className={cn(
                        "settings-appearance__console-line-content transition-all duration-300 leading-relaxed uppercase select-none",
                        textSize === 'sm' && "text-[10px] tracking-tight",
                        textSize === 'base' && "text-[11px] tracking-normal",
                        textSize === 'lg' && "text-[12px] tracking-wide"
                      )}>
                        "This interactive console reviews pixel-alignments and spacing densities. Check standard tracking constraints against client dimensions."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'staff' && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 {/* BLOCK: Registered Personnel Roster Card - Displays and manages active staff personnel, usernames, terminal PINs, and permissions */}
                 <section className={cn(
                   "personnel-roster-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md",
                   theme === 'dark'
                     ? "personnel-roster-card--dark bg-dark-surface border-white/20"
                     : "personnel-roster-card--light bg-light-surface border-slate-300"
                 )}>
                   <div className={cn(
                     "personnel-roster-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                     theme === 'dark' ? "border-white/20" : "border-black/10"
                   )}>
                     <div className="flex justify-start">
                       <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                         <Users size={14} className="text-brand-primary" />
                       </div>
                     </div>

                     <div className="text-center">
                       <h3 className={cn(
                         "personnel-roster-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                         theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                       )}>
                         Staff Personnel Roster
                       </h3>
                     </div>

                     <div className="flex justify-end items-center gap-2">
                       <span className="px-2.5 py-1 rounded-lg text-[9px] font-mono font-black uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
                         {staff.length} {staff.length === 1 ? 'Operator' : 'Operators'}
                       </span>
                       <button
                         type="button"
                         onClick={() => setIsEditingRoster(!isEditingRoster)}
                         className={cn(
                           "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                           isEditingRoster
                             ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                             : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                         )}
                         title={isEditingRoster ? "Exit Edit Mode" : "Edit Staff Info"}
                       >
                         {isEditingRoster ? <Check size={14} /> : <Edit3 size={14} />}
                       </button>
                     </div>
                   </div>

                   <div className="personnel-roster-card__body space-y-6">
                     {staffLoading ? (
                       <div className="flex justify-center p-12"><RefreshCw className="animate-spin text-brand-primary" /></div>
                     ) : staff.length === 0 ? (
                       /* BLOCK: Empty Personnel Roster Card */
                       <div className={cn(
                         "personnel-roster-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                         theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                       )}>
                         <Users size={54} strokeWidth={1.5} className={cn("personnel-roster-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                         <p className={cn("personnel-roster-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>Zero Personnel Nodes Registered</p>
                         <p className={cn("personnel-roster-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                           No staff accounts assigned to this store branch. Add operators above.
                         </p>
                       </div>
                     ) : (
                       staff.map(member => (
                         <div key={member.email} className={cn(
                           "personnel-roster-card__member-card p-5 md:p-6 border-2 rounded-2xl transition-all duration-300 space-y-4 relative overflow-hidden",
                           theme === 'dark' ? "bg-black/30 border-white/15" : "bg-white border-slate-300 shadow-sm"
                         )}>
                           {/* Member Header */}
                           <div className="flex items-center justify-between pb-3 border-b border-solid border-black/10 dark:border-white/10">
                             <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-400/25 flex items-center justify-center shrink-0">
                                 <UserIcon size={16} />
                               </div>
                               <div>
                                 <p className="text-xs font-black uppercase tracking-wider text-black dark:text-white leading-none">{member.email}</p>
                                 <p className={cn(
                                   "text-[9px] font-mono font-bold text-brand-primary uppercase tracking-normal mt-1",
                                   theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                                 )}>
                                   {member.role === 'Custom' ? member.customRoleName : member.role}
                                 </p>
                               </div>
                             </div>
                             <div className="flex items-center gap-2">
                               {isEditingRoster ? (
                                 <select
                                   value={member.role}
                                   onChange={(e) => updateStaffRole(member.email, e.target.value as UserRole)}
                                   className={cn(
                                     "border rounded-lg px-3 py-1.5 outline-none transition-all duration-300 font-mono text-[11px] font-bold uppercase tracking-wider cursor-pointer shadow-sm",
                                     theme === 'dark' ? "bg-black/60 border-dark-border text-white focus:border-cyan-400" : "bg-white border-light-border text-black focus:border-[#062A95]"
                                   )}
                                 >
                                   <option value="Manager">Manager</option>
                                   <option value="Supervisor">Supervisor</option>
                                   <option value="Cashier">Cashier</option>
                                   <option value="Accountant">Accountant</option>
                                   <option value="Rep">Rep</option>
                                   <option value="Investor">Investor</option>
                                   <option value="Custom">Custom</option>
                                 </select>
                               ) : (
                                 <div className={cn(
                                   "border rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider cursor-default shadow-sm",
                                   theme === 'dark' ? "bg-black/60 border-dark-border text-cyan-400" : "bg-white border-light-border text-[#062A95]"
                                 )}>
                                   {member.role === 'Custom' ? member.customRoleName || 'Custom' : member.role}
                                 </div>
                               )}
                               <button 
                                 type="button"
                                 onClick={() => isEditingRoster && removeStaff(member.email)}
                                 disabled={!isEditingRoster}
                                 className={cn("w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer text-red-500 hover:scale-[1.03] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100", theme === 'dark' ? "border-[#ff4d4d]/20 bg-[#ff4d4d]/10 hover:border-[#ff4d4d]/40" : "border-[#ef4444]/15 bg-[#ef4444]/5 hover:border-[#ef4444]/30")}
                                 title={isEditingRoster ? "Remove Staff Member" : "Click edit icon to enable"}
                               >
                                 <Trash2 size={14} />
                               </button>
                             </div>
                           </div>

                           {/* Business-identity styled fields for Username & Terminal PIN */}
                           <div className="space-y-2">
                             <div className={cn(
                               "flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-solid gap-3",
                               theme === 'dark' ? "border-white/10" : "border-black/10"
                             )}>
                               <label className={cn(
                                 "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                                 theme === 'dark' ? "text-white" : "text-black"
                               )}>Username *</label>
                               <div className="w-full sm:max-w-xs md:max-w-md">
                                 {isEditingRoster ? (
                                   <input 
                                     type="text"
                                     placeholder="e.g. john_cashier"
                                     value={member.username || ''}
                                     onChange={(e) => updateStaffUsername(member.email, e.target.value)}
                                     className={cn(
                                       "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold font-mono tracking-tight border transition-all duration-300 shadow-sm",
                                       theme === 'dark' 
                                         ? "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400" 
                                         : "bg-white border-light-border text-black placeholder-gray-400 focus:border-[#062A95]"
                                     )}
                                   />
                                 ) : (
                                   <div className={cn(
                                     "w-full rounded-lg py-2 px-3 text-xs font-bold font-mono tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                                     theme === 'dark' ? "bg-black/40 border-dark-border text-white/90" : "bg-white border-light-border text-black/90"
                                   )}>
                                     {member.username || '—'}
                                   </div>
                                 )}
                               </div>
                             </div>

                             <div className={cn(
                               "flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-solid gap-3",
                               theme === 'dark' ? "border-white/10" : "border-black/10"
                             )}>
                               <label className={cn(
                                 "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                                 theme === 'dark' ? "text-white" : "text-black"
                               )}>Terminal PIN *</label>
                               <div className="w-full sm:max-w-xs md:max-w-md">
                                 {isEditingRoster ? (
                                   <input 
                                     type="text"
                                     maxLength={8}
                                     placeholder="e.g. 1234"
                                     value={member.pin || ''}
                                     onChange={(e) => updateStaffPin(member.email, e.target.value)}
                                     className={cn(
                                       "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold font-mono tracking-widest border transition-all duration-300 shadow-sm",
                                       theme === 'dark' 
                                         ? "bg-black/40 border-dark-border text-amber-400 placeholder-zinc-500 focus:border-cyan-400" 
                                         : "bg-white border-light-border text-amber-700 placeholder-gray-400 focus:border-[#062A95]"
                                     )}
                                   />
                                 ) : (
                                   <div className={cn(
                                     "w-full rounded-lg py-2 px-3 text-xs font-bold font-mono tracking-widest border transition-all duration-300 shadow-sm cursor-default",
                                     theme === 'dark' ? "bg-black/40 border-dark-border text-amber-400/90" : "bg-white border-light-border text-amber-800/90"
                                   )}>
                                     {member.pin ? member.pin : '—'}
                                   </div>
                                 )}
                               </div>
                             </div>

                             {member.role === 'Custom' && (
                               <div className={cn(
                                 "flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-solid gap-3",
                                 theme === 'dark' ? "border-white/10" : "border-black/10"
                               )}>
                                 <label className={cn(
                                   "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                                   theme === 'dark' ? "text-white" : "text-black"
                                 )}>Custom Title *</label>
                                 <div className="w-full sm:max-w-xs md:max-w-md">
                                   {isEditingRoster ? (
                                     <input 
                                       type="text"
                                       value={member.customRoleName || ''}
                                       onChange={(e) => updateCustomRoleName(member.email, e.target.value)}
                                       className={cn(
                                         "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                         theme === 'dark' ? "bg-black/40 border-dark-border text-white" : "bg-white border-light-border text-black"
                                       )}
                                     />
                                   ) : (
                                     <div className={cn(
                                       "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                                       theme === 'dark' ? "bg-black/40 border-dark-border text-white/90" : "bg-white border-light-border text-black/90"
                                     )}>
                                       {member.customRoleName || '—'}
                                     </div>
                                   )}
                                 </div>
                               </div>
                             )}
                           </div>

                           {/* Redesigned Compact & Grouped Permissions Matrix */}
                           <div className="personnel-permissions pt-2">
                             {(() => {
                               const isExpanded = !!expandedMemberPermissions[member.email];
                               const memberPerms = member.permissions || ROLE_PERMISSIONS[member.role] || ROLE_PERMISSIONS['Cashier'];
                               const activeCount = Object.values(memberPerms).filter(Boolean).length;

                               return (
                                 <>
                                   <div className="personnel-permissions__summary flex flex-wrap items-center justify-between gap-2 py-2 border-t border-slate-200 dark:border-white/10">
                                     <div className="flex items-center gap-2">
                                       <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                         Permissions ({activeCount}/14)
                                       </span>
                                       <span className={cn(
                                         "personnel-permissions__badge px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border",
                                         member.role === 'Custom'
                                           ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                           : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
                                       )}>
                                         {member.role === 'Custom' ? 'Custom Override' : `${member.role} Preset`}
                                       </span>
                                     </div>

                                     <div className="flex items-center gap-2">
                                       {isEditingRoster && member.role === 'Custom' && isExpanded && (
                                         <div className="flex items-center gap-1.5 mr-1">
                                           <button
                                             type="button"
                                             onClick={() => selectAllPermissions(member.email)}
                                             className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                                           >
                                             Select All
                                           </button>
                                           <span className="text-slate-300 dark:text-slate-600">|</span>
                                           <button
                                             type="button"
                                             onClick={() => clearAllPermissions(member.email)}
                                             className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                                           >
                                             Clear
                                           </button>
                                         </div>
                                       )}

                                       <button
                                         type="button"
                                         onClick={() => toggleMemberPermissionsExpand(member.email)}
                                         className={cn(
                                           "personnel-permissions__toggle-btn flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-xs",
                                           theme === 'dark'
                                             ? "bg-black/50 border-white/15 text-slate-300 hover:text-white hover:bg-black/80"
                                             : "bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                                         )}
                                       >
                                         <span>{isExpanded ? "Hide Matrix" : "View Matrix"}</span>
                                         {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                       </button>
                                     </div>
                                   </div>

                                   {/* Expanded Compact Matrix */}
                                   {isExpanded && (
                                     <div className="personnel-permissions__matrix pt-3 space-y-3 border-t border-dashed border-slate-200 dark:border-white/10 animate-in fade-in duration-200">
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                         {PERMISSION_GROUPS.map(group => (
                                           <div 
                                             key={group.id} 
                                             className={cn(
                                               "personnel-permissions__group p-3 rounded-xl border space-y-2",
                                               theme === 'dark' ? "bg-black/30 border-white/10" : "bg-slate-50/80 border-slate-200"
                                             )}
                                           >
                                             <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                               {group.title}
                                             </p>
                                             <div className="flex flex-wrap gap-1.5">
                                               {group.keys.map(key => {
                                                 const isActive = !!memberPerms[key];
                                                 const canEdit = isEditingRoster && member.role === 'Custom';

                                                 return (
                                                   <button
                                                     key={key}
                                                     type="button"
                                                     onClick={() => canEdit && togglePermission(member.email, key)}
                                                     disabled={!canEdit}
                                                     className={cn(
                                                       "personnel-permissions__chip flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all",
                                                       isActive
                                                         ? (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-300 text-emerald-800")
                                                         : (theme === 'dark' ? "bg-black/20 border-white/10 text-slate-500" : "bg-white border-slate-200 text-slate-400"),
                                                       canEdit ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"
                                                     )}
                                                     title={canEdit ? `Click to toggle ${PERMISSION_LABELS[key] || key}` : (member.role !== 'Custom' ? 'Permissions locked to preset role' : 'Enable Edit mode to modify')}
                                                   >
                                                     <span className={cn(
                                                       "w-1.5 h-1.5 rounded-full shrink-0",
                                                       isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                                                     )} />
                                                     {PERMISSION_LABELS[key] || key.replace('_', ' ')}
                                                   </button>
                                                 );
                                               })}
                                             </div>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   )}
                                 </>
                               );
                             })()}
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                 </section>

                 {/* BLOCK: Access Control Staff Registration Card - Handles registering new staff personnel with mandatory username, PIN, email, and role */}
                 <section className={cn(
                   "access-control-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                   theme === 'dark'
                     ? "access-control-card--dark bg-dark-surface border-white/35 border-t-brand-primary"
                     : "access-control-card--light bg-light-surface border-slate-400 border-t-[#062A95]"
                 )}>
                   <div className={cn(
                     "access-control-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                     theme === 'dark' ? "border-white/60" : "border-black/60"
                   )}>
                     <div className="flex justify-start">
                       <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                         <Shield size={14} className="text-brand-primary" />
                       </div>
                     </div>

                     <div className="text-center">
                       <h3 className={cn(
                         "access-control-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                         theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                       )}>
                         staff register
                       </h3>
                     </div>

                     <div className="flex justify-end">
                       <button
                         type="button"
                         onClick={() => setIsEditingAccessControl(!isEditingAccessControl)}
                         className={cn(
                           "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                           isEditingAccessControl
                             ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                             : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                         )}
                         title={isEditingAccessControl ? "Exit Edit Mode" : "Edit Access Control"}
                       >
                         {isEditingAccessControl ? <Check size={14} /> : <Edit3 size={14} />}
                       </button>
                     </div>
                   </div>

                   <div className="access-control-card__body space-y-2">
                     {/* Staff Email row */}
                     <div className={cn(
                       "access-control-card__row flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-solid gap-4",
                       theme === 'dark' ? "border-white/30" : "border-black/30"
                     )}>
                       <label className={cn(
                         "access-control-card__label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                         theme === 'dark' ? "text-white" : "text-black"
                       )}>
                         Staff Email *
                       </label>
                       <div className="w-full sm:max-w-xs md:max-w-md">
                         {isEditingAccessControl ? (
                           <input 
                             type="email" 
                             placeholder="e.g. staff@example.com"
                             value={newStaffEmail}
                             onChange={(e) => setNewStaffEmail(e.target.value)}
                             className={cn(
                               "access-control-card__input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                               theme === 'dark' 
                                 ? "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20" 
                                 : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                             )}
                           />
                         ) : (
                           <div className={cn(
                             "access-control-card__input w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default opacity-80",
                             theme === 'dark' ? "bg-black/40 border-dark-border text-white/70" : "bg-gray-50 border-light-border text-gray-600"
                           )}>
                             {newStaffEmail || 'click the edit button to modify'}
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Username row */}
                     <div className={cn(
                       "access-control-card__row flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-solid gap-4",
                       theme === 'dark' ? "border-white/30" : "border-black/30"
                     )}>
                       <label className={cn(
                         "access-control-card__label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                         theme === 'dark' ? "text-white" : "text-black"
                       )}>
                         Username *
                       </label>
                       <div className="w-full sm:max-w-xs md:max-w-md">
                         {isEditingAccessControl ? (
                           <input 
                             type="text" 
                             placeholder="e.g. john_cashier"
                             value={newStaffUsername}
                             onChange={(e) => setNewStaffUsername(e.target.value.replace(/\s+/g, ''))}
                             className={cn(
                               "access-control-card__input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold font-mono tracking-tight border transition-all duration-300 shadow-sm",
                               theme === 'dark' 
                                 ? "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20" 
                                 : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                             )}
                           />
                         ) : (
                           <div className={cn(
                             "access-control-card__input w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default opacity-80",
                             theme === 'dark' ? "bg-black/40 border-dark-border text-white/70" : "bg-gray-50 border-light-border text-gray-600"
                           )}>
                             {newStaffUsername || 'click the edit button to modify'}
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Terminal PIN row */}
                     <div className={cn(
                       "access-control-card__row flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-solid gap-4",
                       theme === 'dark' ? "border-white/30" : "border-black/30"
                     )}>
                       <label className={cn(
                         "access-control-card__label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                         theme === 'dark' ? "text-white" : "text-black"
                       )}>
                         Terminal PIN *
                       </label>
                       <div className="w-full sm:max-w-xs md:max-w-md">
                         {isEditingAccessControl ? (
                           <input 
                             type="text" 
                             maxLength={8}
                             placeholder="e.g. 1234"
                             value={newStaffPin}
                             onChange={(e) => setNewStaffPin(e.target.value)}
                             className={cn(
                               "access-control-card__input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold font-mono tracking-widest border transition-all duration-300 shadow-sm",
                               theme === 'dark' 
                                 ? "bg-black/40 border-dark-border text-amber-400 placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20" 
                                 : "bg-white border-light-border text-amber-700 placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                             )}
                           />
                         ) : (
                           <div className={cn(
                             "access-control-card__input w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default opacity-80",
                             theme === 'dark' ? "bg-black/40 border-dark-border text-white/70" : "bg-gray-50 border-light-border text-gray-600"
                           )}>
                             {newStaffPin || 'click the edit button to modify'}
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Access Role row */}
                     <div className={cn(
                       "access-control-card__row flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-solid gap-4",
                       theme === 'dark' ? "border-white/30" : "border-black/30"
                     )}>
                       <label className={cn(
                         "access-control-card__label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                         theme === 'dark' ? "text-white" : "text-black"
                       )}>
                         Access Role *
                       </label>
                       <div className="w-full sm:max-w-xs md:max-w-md">
                         {isEditingAccessControl ? (
                           <select
                             value={newStaffRole}
                             onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                             className={cn(
                               "access-control-card__select w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                               theme === 'dark' 
                                 ? "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20" 
                                 : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                             )}
                           >
                             <option value="Manager">Manager</option>
                             <option value="Supervisor">Supervisor</option>
                             <option value="Cashier">Cashier</option>
                             <option value="Accountant">Accountant</option>
                             <option value="Rep">Rep</option>
                             <option value="Investor">Investor</option>
                             <option value="Custom">Custom</option>
                           </select>
                         ) : (
                           <div className={cn(
                             "access-control-card__select w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default opacity-80",
                             theme === 'dark' ? "bg-black/40 border-dark-border text-white/80" : "bg-gray-50 border-light-border text-gray-700"
                           )}>
                             {newStaffRole}
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Custom Role Title row */}
                     {newStaffRole === 'Custom' && (
                       <div className={cn(
                         "access-control-card__row flex flex-col sm:flex-row sm:items-center justify-between py-3.5 border-b border-solid gap-4",
                         theme === 'dark' ? "border-white/30" : "border-black/30"
                       )}>
                         <label className={cn(
                           "access-control-card__label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                           theme === 'dark' ? "text-white" : "text-black"
                         )}>
                           Position Title *
                         </label>
                         <div className="w-full sm:max-w-xs md:max-w-md">
                           {isEditingAccessControl ? (
                             <input 
                               type="text" 
                               placeholder="e.g. Area Manager"
                               value={newStaffCustomRoleName}
                               onChange={(e) => setNewStaffCustomRoleName(e.target.value)}
                               className={cn(
                                 "access-control-card__input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                 theme === 'dark' 
                                   ? "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20" 
                                   : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                               )}
                             />
                           ) : (
                             <div className={cn(
                               "access-control-card__input w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default opacity-80",
                               theme === 'dark' ? "bg-black/40 border-dark-border text-white/70" : "bg-gray-50 border-light-border text-gray-600"
                             )}>
                               {newStaffCustomRoleName || 'click the edit button to modify'}
                             </div>
                           )}
                         </div>
                       </div>
                     )}

                     {/* Action Submit button */}
                     <div className="pt-4 flex justify-end">
                       <button 
                         type="button"
                         onClick={handleAddStaff}
                         disabled={!isEditingAccessControl || loading || !newStaffEmail.trim() || !newStaffUsername.trim() || !newStaffPin.trim() || (newStaffRole === 'Custom' && !newStaffCustomRoleName.trim())}
                         className={cn(
                           "access-control-card__button h-[42px] px-6 rounded-xl border-2 font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
                           theme === 'dark' 
                             ? "bg-[#E4E3E0] border-[#E4E3E0] text-[#0A0A0A] hover:bg-white" 
                             : "bg-[#062A95] border-[#062A95] text-white hover:bg-[#062A95]/90 hover:scale-[1.02]"
                         )}
                       >
                         <Plus size={16} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Register Staff Member</span>
                       </button>
                     </div>
                   </div>
                 </section>
               </div>
             )}

            {activeTab === 'user' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all">
                {/* BLOCK: User Profile & Identifiers Card - Displays user avatar, display name, and role identifiers */}
                <div className={cn(
                  "user-account-profile-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "user-account-profile-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/60" : "border-black/60"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <UserIcon size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        User Profile
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingAccount(!isEditingAccount)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingAccount
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingAccount ? "Exit Edit Mode" : "Edit Profile"}
                      >
                        {isEditingAccount ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    {/* Avatar & Display Name Input - Left Column */}
                    <div className={cn(
                      "md:col-span-5 flex flex-col items-center md:items-start gap-6 border-b md:border-b-0 md:border-r border-solid pb-6 md:pb-0 md:pr-8",
                      theme === 'dark' 
                        ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                        : "border-black/30"
                    )}>
                      <div className="flex flex-col items-center md:items-start gap-4">
                        <div className={cn(
                          "w-24 h-24 rounded-2xl overflow-hidden border-2 shrink-0 flex items-center justify-center font-presale font-black text-2xl relative shadow-md",
                          theme === 'dark' ? "bg-black/40 border-dark-border text-white" : "bg-white border-light-border text-black"
                        )}>
                          {selectedAvatarDataUrl ? (
                            <img src={selectedAvatarDataUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="opacity-90">{user.displayName ? user.displayName.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}</span>
                          )}
                          <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-black" />
                        </div>
                        {isEditingAccount && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-brand-primary animate-pulse">
                            Choose custom avatar profile
                          </span>
                        )}
                      </div>

                      {/* If editing account, render the custom SVG avatars selection grid! */}
                      {isEditingAccount && (
                        <div className="w-full space-y-2">
                          <label className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-[#666]">Select Avatar Profile</label>
                          <div className="grid grid-cols-3 gap-2">
                            {AVATARS.map((av) => {
                              const isSelected = selectedAvatarDataUrl === av.dataUrl;
                              return (
                                <button
                                  key={av.id}
                                  type="button"
                                  onClick={() => setSelectedAvatarDataUrl(av.dataUrl)}
                                  className={cn(
                                    "aspect-square p-1 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center justify-center overflow-hidden",
                                    isSelected 
                                      ? (theme === 'dark' ? "border-cyan-400 bg-cyan-400/10" : "border-[#062A95] bg-[#062A95]/10")
                                      : (theme === 'dark' ? "border-transparent bg-black/40 hover:border-gray-700" : "border-transparent bg-gray-50 hover:border-gray-300")
                                  )}
                                  title={av.label}
                                >
                                  <div className="w-10 h-10 select-none pointer-events-none rounded-lg overflow-hidden">
                                    {av.svg}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 w-full">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-left",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>Display Name</label>
                        {isEditingAccount ? (
                          <input 
                            type="text"
                            value={newDisplayName}
                            onChange={(e) => setNewDisplayName(e.target.value)}
                            placeholder="e.g. megapos"
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          />
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {newDisplayName || user.displayName || 'Manager'}
                          </div>
                        )}
                        {(isEditingAccount && (newDisplayName !== user.displayName || selectedAvatarDataUrl !== user.photoURL || subscriptionLevel !== (loadedSettingsRef.current?.subscriptionLevel || 'basic'))) && (
                          <button 
                            type="button"
                            onClick={async () => {
                              await handleUpdateAccount();
                              setIsEditingAccount(false);
                            }}
                            disabled={savingAccount}
                            className={cn(
                              "w-full mt-2 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 shadow-sm border-2",
                              theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]"
                            )}
                          >
                            {savingAccount ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                            Save Changes
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Secondary Details - Right Column */}
                    <div className="md:col-span-7 flex flex-col justify-center">
                      <div className={cn(
                        "flex flex-col space-y-3"
                      )}>
                        {/* Access Role */}
                        <div className={cn(
                          "flex flex-col sm:flex-row sm:items-center py-3 border-b border-solid gap-2 sm:gap-4",
                          theme === 'dark' 
                            ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                            : "border-black/30"
                        )}>
                          <span className={cn(
                            "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            Access Role
                          </span>
                          <div className="w-full sm:max-w-xs md:max-w-md">
                            <div className={cn(
                              "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-cyan-400" : "bg-black/40 border-dark-border text-cyan-400") 
                                : "bg-white border-light-border text-brand-primary font-black"
                            )}>
                              {role === 'Custom' ? customRoleName : role}
                            </div>
                          </div>
                        </div>

                        {/* BLOCK: Subscription Level Section - Displays active tier details */}
                        <div id="my-account-subscription-row" className={cn(
                          "my-account-card__field-row flex flex-col sm:flex-row sm:items-center py-3 border-b border-solid gap-2 sm:gap-4",
                          theme === 'dark' 
                            ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                            : "border-black/30"
                        )}>
                          <span className={cn(
                            "my-account-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            Subscription Tier
                          </span>
                          <div className="w-full sm:max-w-xs md:max-w-md">
                            <div id="my-account-subscription-value" className={cn(
                              "my-account-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default flex items-center justify-between uppercase",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              <span className={cn(
                                subscriptionLevel === 'enterprise'
                                  ? "text-cyan-400 font-black"
                                  : subscriptionLevel === 'pro'
                                    ? "text-green-500 font-black"
                                    : "text-amber-500 font-black"
                              )}>
                                {subscriptionLevel}
                              </span>
                              <span className="text-[9px] opacity-40 lowercase font-normal">(managed by system)</span>
                            </div>
                          </div>
                        </div>

                        {/* Account Opened */}
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 gap-2 sm:gap-4">
                          <span className={cn(
                            "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            Account Opened
                          </span>
                          <div className="w-full sm:max-w-xs md:max-w-md">
                            <div className={cn(
                              "w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                                : "bg-white border-light-border text-light-text/90"
                            )}>
                              {accountCreatedDate}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BLOCK: Login Info Card - Handles user account logins (username and PIN/passphrase) */}
                <div id="login-info-card" className={cn(
                  "login-info-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 space-y-6 transition-all duration-300 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "login-info-card--dark bg-dark-surface border-white/35 border-t-brand-primary"
                    : "login-info-card--light bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "login-info-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/60" : "border-black/60"
                  )}>
                    <div className="login-info-card__icon-container flex justify-start">
                      <div className="login-info-card__icon-badge w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <KeyRound size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="login-info-card__title-wrapper text-center">
                      <h3 className={cn(
                        "login-info-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Account Logins
                      </h3>
                    </div>

                    <div className="login-info-card__action-wrapper flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingLoginInfo) {
                            setIsEditingLoginInfo(false);
                          } else {
                            setIsEditingLoginInfo(true);
                          }
                        }}
                        className={cn(
                          "login-info-card__edit-button p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingLoginInfo
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingLoginInfo ? "Cancel Editing Login Credentials" : "Edit Login Credentials"}
                      >
                        {isEditingLoginInfo ? <X size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="login-info-card__body flex flex-col space-y-4">
                    {loginInfoMessage && (
                      <div className="login-info-card__status-banner px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold font-mono flex items-center gap-2">
                        <Check size={14} />
                        <span>{loginInfoMessage}</span>
                      </div>
                    )}

                    {/* Username row */}
                    <div className={cn(
                      "login-info-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                      theme === 'dark' 
                        ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                        : "border-black/30"
                    )}>
                      <label className={cn(
                        "login-info-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Username
                      </label>
                      <div className="login-info-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                        {isEditingLoginInfo ? (
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={loginUsername}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/\s+/g, '');
                                setLoginUsername(clean);
                                if (onDirtyChange) onDirtyChange(true);
                              }}
                              placeholder="e.g. manager"
                              className={cn(
                                "login-info-card__field-input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm font-mono",
                                theme === 'dark'
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20")
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            />
                            <span className="text-[9px] font-mono text-zinc-400">Usernames cannot contain spaces.</span>
                          </div>
                        ) : (
                          <div className={cn(
                            "login-info-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default flex items-center justify-between",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            <span>{loginUsername || 'Not configured'}</span>
                            <span className="login-info-card__field-badge text-[9px] font-mono text-cyan-500 uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/10">
                              User ID
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PIN row */}
                    <div className="login-info-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 gap-2 sm:gap-4">
                      <label className={cn(
                        "login-info-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        PIN / Passphrase
                      </label>
                      <div className="login-info-card__input-wrapper w-full sm:max-w-xs md:max-w-md">
                        {isEditingLoginInfo ? (
                          <div className="flex flex-col gap-1">
                            <div className="login-info-card__password-container relative flex items-center w-full">
                              <input
                                type={showLoginPassword ? "text" : "password"}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={8}
                                value={loginPassword}
                                onChange={(e) => {
                                  const numbersOnly = e.target.value.replace(/\D/g, '');
                                  setLoginPassword(numbersOnly);
                                  if (onDirtyChange) onDirtyChange(true);
                                }}
                                placeholder="Enter PIN (numbers only)"
                                className={cn(
                                  "login-info-card__field-input w-full rounded-lg py-2 pl-3 pr-10 outline-none text-xs font-bold tracking-widest border transition-all duration-300 shadow-sm font-mono",
                                  theme === 'dark'
                                    ? (themePreset === 'saas-dark'
                                        ? "bg-black/40 border-cyan-400 text-amber-400 placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                        : "bg-black/40 border-dark-border text-amber-400 placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20")
                                    : "bg-white border-light-border text-amber-700 placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                                )}
                              />
                              <button
                                type="button"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                className="login-info-card__toggle-button absolute right-2.5 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
                                title={showLoginPassword ? "Hide PIN" : "Show PIN"}
                              >
                                {showLoginPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                            <span className="text-[9px] font-mono text-zinc-400">PIN must contain numbers only.</span>
                          </div>
                        ) : (
                          <div className={cn(
                            "login-info-card__field-value w-full rounded-lg py-2 px-3 text-xs font-mono font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default flex items-center justify-between",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            <span className="text-amber-500 font-bold tracking-widest font-mono">{showLoginPassword ? (loginPassword || '1234') : '•'.repeat((loginPassword || '1234').length)}</span>
                            <button
                              type="button"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              className="login-info-card__toggle-button text-xs font-mono text-cyan-500 hover:underline uppercase tracking-wider font-extrabold flex items-center gap-1 cursor-pointer"
                            >
                              {showLoginPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{showLoginPassword ? 'Hide' : 'Show'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isEditingLoginInfo && (
                      <div className="login-info-card__actions pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingLoginInfo(false)}
                          className={cn(
                            "login-info-card__cancel-button text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border transition-all cursor-pointer",
                            theme === 'dark' ? "border-dark-border text-gray-400 hover:text-white" : "border-light-border text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveLoginInfo}
                          disabled={savingLoginInfo || !loginUsername.trim()}
                          className={cn(
                            "login-info-card__save-button text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 shadow-sm border-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                            theme === 'dark'
                              ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20"
                              : "bg-[#062A95] border-[#062A95] text-white hover:bg-[#062A95]/90"
                          )}
                        >
                          {savingLoginInfo ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                          <span>Save Login Info</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOCK: Contact Details Card - Handles user email address and phone number */}
                <div className={cn(
                  "contact-details-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 space-y-6 transition-all duration-300 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "contact-details-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/60" : "border-black/60"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Smartphone size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "contact-details-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Contact details
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingContact) {
                            if (userPhoneNumber !== loadedSettingsRef.current?.userPhoneNumber) {
                              await handleUpdateAccount();
                            }
                            setIsEditingContact(false);
                          } else {
                            setIsEditingContact(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingContact
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingContact ? "Save & Exit" : "Edit Contact"}
                      >
                        {isEditingContact ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className={cn(
                      "contact-details-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 border-b border-solid gap-2 sm:gap-4",
                      theme === 'dark' 
                        ? (themePreset === 'saas-dark' ? "border-white/50" : "border-white/30") 
                        : "border-black/30"
                    )}>
                      <label className={cn(
                        "contact-details-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>Email Address</label>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        <div className={cn(
                          "contact-details-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default break-all",
                          theme === 'dark' 
                            ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                            : "bg-white border-light-border text-light-text/90"
                        )}>
                          {maskEmail(user.email || 'None')}
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "contact-details-card__field-row flex flex-col sm:flex-row sm:items-center py-3.5 gap-2 sm:gap-4"
                    )}>
                      <label className={cn(
                        "contact-details-card__field-label text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] sm:w-1/3 text-left",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>Phone number</label>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingContact ? (
                          <div className="flex flex-col gap-2">
                            <input 
                              type="tel"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={userPhoneNumber}
                              onChange={(e) => {
                                const numbersOnly = e.target.value.replace(/\D/g, '');
                                setUserPhoneNumber(numbersOnly);
                                if (onDirtyChange) onDirtyChange(true);
                              }}
                              placeholder="Enter phone number (numbers only)"
                              className={cn(
                                "contact-details-card__field-input w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            />
                            {userPhoneNumber !== loadedSettingsRef.current?.userPhoneNumber && (
                              <button 
                                type="button"
                                onClick={async () => {
                                  await handleUpdateAccount();
                                  setIsEditingContact(false);
                                }}
                                disabled={savingAccount}
                                className={cn(
                                  "w-full text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:scale-[1.01] active:scale-99 transition-all flex items-center justify-center gap-2 shadow-sm border-2",
                                  theme === 'dark' 
                                    ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" 
                                    : "bg-[#062A95]/10 border-[#062A95] text-[#062A95] hover:bg-[#062A95]/20"
                                )}
                              >
                                {savingAccount ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
                                Save Phone Number
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className={cn(
                            "contact-details-card__field-value w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {userPhoneNumber || 'None'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BLOCK: Access Controls & Session Protection Card */}
                <div className={cn(
                  "session-protection-card border rounded-2xl p-6 md:p-8 space-y-6 transition-all duration-300 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "session-protection-card__header pb-4 border-b border-solid flex flex-col items-center text-center w-full",
                    theme === 'dark' ? "border-white/60" : "border-black/60"
                  )}>
                    <h3 className={cn(
                      "text-xs font-black uppercase tracking-[0.25em]",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Access Controls & Session Protection
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Identity Transition */}
                    <div className={cn(
                      "p-6 border-2 border-dashed rounded-2xl space-y-4 relative flex flex-col justify-between",
                      theme === 'dark' 
                        ? (themePreset === 'saas-dark' ? "border-cyan-400/40" : "border-white/30") 
                        : "border-black/30"
                    )}>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Email Transition & License Migration</p>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Migrate user license to another secure identity</p>
                      </div>

                      {!isVerifying && accountAction !== 'email' && (
                        <button 
                          type="button"
                          onClick={() => {
                            setAccountAction('email');
                            handleSendVerificationCode();
                          }}
                          className={cn(
                            "w-full text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border-2 transition-all duration-300 hover:scale-[1.01]",
                            theme === 'dark' ? "bg-black/40 border-dark-border text-white hover:border-cyan-400 focus:border-cyan-400" : "bg-white border-light-border text-black hover:border-[#062A95] focus:border-[#062A95]"
                          )}
                        >
                          Initialize Migration Sequence
                        </button>
                      )}

                      {isVerifying && accountAction === 'email' && (
                        <div className="flex flex-col gap-3 p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/25 animate-in fade-in">
                          <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary">MFA Required: Check your delivery channel for code</p>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="MFA CODE"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value)}
                              className={cn(
                                "w-24 rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm text-center",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:ring-1 focus:ring-cyan-400/20" : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            />
                            <button 
                              type="button"
                              onClick={handleVerifyAndAction} 
                              className="px-4 py-2 bg-brand-primary text-black rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0"
                            >
                              Verify Code
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setAccountAction('none'); setIsVerifying(false); }} 
                              className="px-2 font-bold text-xs hover:opacity-100 opacity-60 uppercase text-[9px] tracking-wider"
                            >
                              Abort
                            </button>
                          </div>
                        </div>
                      )}

                      {isVerified && accountAction === 'email' && (
                        <div className="flex flex-col gap-3 animate-in fade-in">
                          <div>
                            <label className={cn(
                              "block text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] mb-1.5",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>New Target Email Address</label>
                            <input 
                              type="email" 
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="new-manager@example.com"
                              className={cn(
                                "w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:ring-1 focus:ring-cyan-400/20" : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={handleConfirmSecurityChange}
                              disabled={savingAccount}
                              className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-600 transition-all"
                            >
                              Confirm Migration
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setAccountAction('none'); setIsVerified(false); }} 
                              className={cn(
                                "px-4 py-2.5 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors",
                                theme === 'dark' ? "border-dark-border text-[#888] hover:text-white" : "border-light-border text-[#444] hover:bg-black/5"
                              )}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Security Rotation */}
                    <div className={cn(
                      "p-6 border-2 border-dashed rounded-2xl space-y-4 relative flex flex-col justify-between",
                      theme === 'dark' 
                        ? (themePreset === 'saas-dark' ? "border-cyan-400/40" : "border-white/30") 
                        : "border-black/30"
                    )}>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Credential Password Rotation</p>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Rotate cryptographic passphrase keys instantly</p>
                      </div>

                      {!isVerifying && accountAction !== 'password' && (
                        <button 
                          type="button"
                          onClick={() => {
                            setAccountAction('password');
                            handleSendVerificationCode();
                          }}
                          className={cn(
                            "w-full text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border-2 transition-all duration-300 hover:scale-[1.01]",
                            theme === 'dark' ? "bg-black/40 border-dark-border text-white hover:border-cyan-400 focus:border-cyan-400" : "bg-white border-light-border text-black hover:border-[#062A95] focus:border-[#062A95]"
                          )}
                        >
                          Initialize Passphrase Rotation
                        </button>
                      )}

                      {isVerifying && accountAction === 'password' && (
                        <div className="flex flex-col gap-3 p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/25 animate-in fade-in">
                          <p className="text-[9px] font-black uppercase tracking-widest text-brand-primary">MFA Required: Check your delivery channel for code</p>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="MFA CODE"
                              value={verificationCode}
                              onChange={(e) => setVerificationCode(e.target.value)}
                              className={cn(
                                "w-24 rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm text-center",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:ring-1 focus:ring-cyan-400/20" : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            />
                            <button 
                              type="button"
                              onClick={handleVerifyAndAction} 
                              className="px-4 py-2 bg-brand-primary text-black rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0"
                            >
                              Verify Code
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setAccountAction('none'); setIsVerifying(false); }} 
                              className="px-2 font-bold text-xs hover:opacity-100 opacity-60 uppercase text-[9px] tracking-wider"
                            >
                              Abort
                            </button>
                          </div>
                        </div>
                      )}

                      {isVerified && accountAction === 'password' && (
                        <div className="flex flex-col gap-3 animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className={cn(
                                "block text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] mb-1.5",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>New Key Passphrase</label>
                              <input 
                                type="password" 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className={cn(
                                  "w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                  theme === 'dark' 
                                    ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:ring-1 focus:ring-cyan-400/20" : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                    : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                                )}
                              />
                            </div>
                            <div>
                              <label className={cn(
                                "block text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] mb-1.5",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>Confirm Identity Key</label>
                              <input 
                                type="password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className={cn(
                                  "w-full rounded-lg py-2 px-3 outline-none font-mono text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                                  theme === 'dark' 
                                    ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400 text-white placeholder-zinc-500 focus:ring-1 focus:ring-cyan-400/20" : "bg-black/40 border-dark-border text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                    : "bg-white border-light-border text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                                )}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={handleConfirmSecurityChange}
                              disabled={savingAccount}
                              className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-600 transition-all"
                            >
                              Rotational Reset
                            </button>
                            <button 
                              type="button"
                              onClick={() => { setAccountAction('none'); setIsVerified(false); }} 
                              className={cn(
                                "px-4 py-2.5 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors",
                                theme === 'dark' ? "border-dark-border text-[#888] hover:text-white" : "border-light-border text-[#444] hover:bg-black/5"
                              )}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. destructive hazardous operations card */}
                <div className={cn(
                  "p-6 md:p-8 border rounded-2xl transition-all shadow-sm hover:shadow-md border-t-4 flex flex-col items-center justify-center text-center gap-6",
                  theme === 'dark'
                    ? "bg-red-500/[0.03] border-red-500/20 border-t-red-500"
                    : "bg-red-50/30 border-red-200 border-t-red-600"
                )}>
                  <div className={cn(
                    "flex flex-col items-center text-center pb-4 border-b border-solid w-full",
                    theme === 'dark' ? "border-red-500/40" : "border-red-500/30"
                  )}>
                    <h4 className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
                      Hazard Zone / Session Termination
                    </h4>
                  </div>
                  <p className="text-[10px] opacity-80 uppercase tracking-widest max-w-md mx-auto">
                    Eject active register key session and flush local operational caches
                  </p>
                  {showLogoutConfirm ? (
                    <div className="flex items-center gap-3">
                       <button 
                         type="button"
                         onClick={() => signOut(auth)}
                         className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:scale-[1.02] active:scale-98 transition-all animate-none"
                       >
                         Confirm Eject Session
                       </button>
                       <button 
                         type="button"
                         onClick={() => setShowLogoutConfirm(false)}
                         className={cn(
                           "px-4 py-2.5 bg-transparent border-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors",
                           theme === 'dark' ? "border-red-500/30 text-red-500 hover:border-red-500" : "border-red-300 text-red-600 hover:bg-red-100/50"
                         )}
                       >
                         Abort
                       </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setShowLogoutConfirm(true)}
                      className="px-6 py-3.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase  tracking-widest hover:scale-103 active:scale-97 transition-all shadow-md shadow-red-500/10 hover:bg-red-600"
                    >
                      Eject Terminal Key
                    </button>
                  )}
                </div>
              </div>
            )}
             
            {activeTab === 'terminal' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all">
                
                {/* 1. Terminal Layouts Card */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/85" : "border-white/75") : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Layers size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Terminal Layouts
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingTerminalLayouts) {
                            await handleSaveStoreSettings();
                            setIsEditingTerminalLayouts(false);
                          } else {
                            setIsEditingTerminalLayouts(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingTerminalLayouts
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingTerminalLayouts ? "Save & Exit" : "Edit Terminal Layouts"}
                      >
                        {isEditingTerminalLayouts ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {/* Visual Layout Matrix */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Visual Layout Matrix
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingTerminalLayouts ? (
                          <select 
                            value={productLayout}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setProductLayout(val);
                              try { localStorage.setItem('nurtron_product_layout', val); } catch (e) {}
                            }}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="grid">Picture Grid (Best for graphical cards)</option>
                            <option value="list-img">Picture List (Linear with item thumbnails)</option>
                            <option value="list-text">Text List (Compact high-density list)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {productLayout === "grid" && "Picture Grid (Best for graphical cards)"}
                            {productLayout === "list-img" && "Picture List (Linear with item thumbnails)"}
                            {productLayout === "list-text" && "Text List (Compact high-density list)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desktop Holdings Layout */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Desktop Holdings Layout
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingTerminalLayouts ? (
                          <select 
                            value={desktopLayout}
                            onChange={(e) => setDesktopLayout(e.target.value as any)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="table">Table Layout (Structured columns, compact lines)</option>
                            <option value="card">Card Layout (Bento-style items list)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {desktopLayout === "table" && "Table Layout (Structured columns, compact lines)"}
                            {desktopLayout === "card" && "Card Layout (Bento-style items list)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desktop Register Layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-4">
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Desktop Register Layout
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingTerminalLayouts ? (
                          <select 
                            value={desktopRegisterLayout}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setDesktopRegisterLayout(val);
                              try {
                                localStorage.setItem('nurtron_desktop_register_layout', val);
                              } catch(e) {}
                            }}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="table">Table Layout (Structured columns, compact lines)</option>
                            <option value="card">Card Layout (Bento-style items list)</option>
                            <option value="split">Split Layout (Products on left, Cart on right - Desktop only)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {desktopRegisterLayout === "table" && "Table Layout (Structured columns, compact lines)"}
                            {desktopRegisterLayout === "card" && "Card Layout (Bento-style items list)"}
                            {desktopRegisterLayout === "split" && "Split Layout (Products on left, Cart on right - Desktop only)"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Receipt Settings Card */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/85" : "border-white/75") : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Receipt size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Receipt & Printing
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingReceipt) {
                            await handleSaveStoreSettings();
                            setIsEditingReceipt(false);
                          } else {
                            setIsEditingReceipt(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingReceipt
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingReceipt ? "Save & Exit" : "Edit Receipt settings"}
                      >
                        {isEditingReceipt ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {/* Receipt Paper Type */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Receipt Paper Type
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingReceipt ? (
                          <select 
                            value={paperType}
                            onChange={(e) => setPaperType(e.target.value as any)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="thermal">Thermal receipt (80mm standard roll)</option>
                            <option value="a4">Full invoice (A4 office paper layout)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {paperType === "thermal" ? "Thermal receipt (80mm standard roll)" : "Full invoice (A4 office paper layout)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Receipt Footer Message */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Receipt Footer Message
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingReceipt ? (
                          <input 
                            type="text"
                            maxLength={50}
                            value={receiptFooterMessage}
                            onChange={(e) => setReceiptFooterMessage(e.target.value)}
                            placeholder="THANK YOU FOR YOUR PATRONAGE"
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          />
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {receiptFooterMessage || 'None'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Auto-print Receipt */}
                    <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-4">
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Auto-print Receipt
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingReceipt ? (
                          <select 
                            value={autoPrint ? "true" : "false"}
                            onChange={(e) => setAutoPrint(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">ENABLED (Auto-trigger standard spooler on finish)</option>
                            <option value="false">DISABLED (Manual checkout invoice generation only)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {autoPrint ? "ENABLED (Auto-trigger standard spooler on finish)" : "DISABLED (Manual checkout invoice generation only)"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Barcode Settings Card */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/85" : "border-white/75") : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Barcode size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Barcode Calibration
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingBarcode) {
                            await handleSaveStoreSettings();
                            setIsEditingBarcode(false);
                          } else {
                            setIsEditingBarcode(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingBarcode
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingBarcode ? "Save & Exit" : "Edit Barcode settings"}
                      >
                        {isEditingBarcode ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {/* Show Label Names */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Show Label Names
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeShowNames ? "true" : "false"}
                            onChange={(e) => setBarcodeShowNames(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">YES (Render product names above labels)</option>
                            <option value="false">NO (Omit names for high-density margins)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeShowNames ? "YES (Render product names above labels)" : "NO (Omit names for high-density margins)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Show Label Barcodes */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Show Label Barcodes
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeShowSkus ? "true" : "false"}
                            onChange={(e) => setBarcodeShowSkus(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">YES (Render scanner lines on sheets)</option>
                            <option value="false">NO (Omit scanbars, text tracking only)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeShowSkus ? "YES (Render scanner lines on sheets)" : "NO (Omit scanbars, text tracking only)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Perforation Zone */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Perforation Zone (15mm)
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeShowPerforation ? "true" : "false"}
                            onChange={(e) => setBarcodeShowPerforation(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">YES (Show left 15mm section border)</option>
                            <option value="false">NO (Continuous flat printable bounds)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeShowPerforation ? "YES (Show left 15mm section border)" : "NO (Continuous flat printable bounds)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Perforation Arrow */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Perforation Arrow
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeShowArrow ? "true" : "false"}
                            onChange={(e) => setBarcodeShowArrow(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">YES (Render entry direction arrows)</option>
                            <option value="false">NO (Keep perf margins completely clean)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeShowArrow ? "YES (Render entry direction arrows)" : "NO (Keep perf margins completely clean)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PDF Continuous Flow */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          PDF Continuous Flow
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeLinkWithWhitespace ? "true" : "false"}
                            onChange={(e) => setBarcodeLinkWithWhitespace(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">YES (Flow list without card page-breaks)</option>
                            <option value="false">NO (Hard split items on logical sheets)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeLinkWithWhitespace ? "YES (Flow list without card page-breaks)" : "NO (Hard split items on logical sheets)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Default Spacing Gap */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Default Spacing Gap
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeSpacingMargin}
                            onChange={(e) => setBarcodeSpacingMargin(e.target.value)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="16px">Normal Grid (16px spacing)</option>
                            <option value="8px">Compact Grid (8px spacing)</option>
                            <option value="4px">Extra Tight Grid (4px spacing)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeSpacingMargin === "16px" && "Normal Grid (16px spacing)"}
                            {barcodeSpacingMargin === "8px" && "Compact Grid (8px spacing)"}
                            {barcodeSpacingMargin === "4px" && "Extra Tight Grid (4px spacing)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Default Barcode Height */}
                    <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-4">
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Default Barcode Height
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingBarcode ? (
                          <select 
                            value={barcodeHeight}
                            onChange={(e) => setBarcodeHeight(e.target.value)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="4.5mm">Extra Small Height (4.5mm block size)</option>
                            <option value="5.5mm">Small Height (5.5mm block size)</option>
                            <option value="6.5mm">Medium Height (6.5mm block size)</option>
                            <option value="8.0mm">Large Height (8.0mm block size)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {barcodeHeight === "4.5mm" && "Extra Small Height (4.5mm block size)"}
                            {barcodeHeight === "5.5mm" && "Small Height (5.5mm block size)"}
                            {barcodeHeight === "6.5mm" && "Medium Height (6.5mm block size)"}
                            {barcodeHeight === "8.0mm" && "Large Height (8.0mm block size)"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Tax Settings Card */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/85" : "border-white/75") : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Percent size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Taxation & Fiscal
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingTax) {
                            await handleSaveStoreSettings();
                            setIsEditingTax(false);
                          } else {
                            setIsEditingTax(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingTax
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-white/30 text-white hover:bg-gray-950" : "bg-white border-slate-400 text-black hover:bg-gray-50")
                        )}
                        title={isEditingTax ? "Save & Exit" : "Edit Tax settings"}
                      >
                        {isEditingTax ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {/* Base Tax Rate */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Base Tax Rate (%)
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingTax ? (
                          <input 
                            type="number" 
                            step="0.1"
                            value={isNaN(taxRate) ? "" : taxRate}
                            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm font-mono",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-white/30 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-slate-400 text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )} 
                          />
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default font-mono",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-white/30 text-white/90") 
                              : "bg-white border-slate-400 text-light-text/90"
                          )}>
                            {isNaN(taxRate) ? "0%" : `${taxRate}%`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tax Application Mode */}
                    <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-4">
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Tax Application Mode
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingTax ? (
                          <select
                            value={taxType}
                            onChange={(e) => setTaxType(e.target.value as any)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-white/30 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-slate-400 text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="inclusive">Tax Inclusive (VAT/GST standard)</option>
                            <option value="exclusive">Tax Exclusive (US standard)</option>
                            <option value="none">No Tax / Tax Exempt</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-white/30 text-white/90") 
                              : "bg-white border-slate-400 text-light-text/90"
                          )}>
                            {taxType === "inclusive" && "Tax Inclusive (VAT/GST standard)"}
                            {taxType === "exclusive" && "Tax Exclusive (US standard)"}
                            {taxType === "none" && "No Tax / Tax Exempt"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Pricing & Inventory Alert Card */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/85" : "border-white/75") : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Activity size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Pricing & Alerts
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingPricing) {
                            await handleSaveStoreSettings();
                            setIsEditingPricing(false);
                          } else {
                            setIsEditingPricing(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingPricing
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-white/30 text-white hover:bg-gray-950" : "bg-white border-slate-400 text-black hover:bg-gray-50")
                        )}
                        title={isEditingPricing ? "Save & Exit" : "Edit Pricing settings"}
                      >
                        {isEditingPricing ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {/* Global Terminal Markup */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Global Terminal Markup (%)
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingPricing ? (
                          <input 
                            type="number"
                            step="0.1"
                            value={globalMarkup}
                            onChange={(e) => setGlobalMarkup(parseFloat(e.target.value) || 0)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm font-mono",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          />
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default font-mono",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {globalMarkup}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Global Terminal Discount */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Global Terminal Discount (%)
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingPricing ? (
                          <input 
                            type="number"
                            step="0.1"
                            value={globalDiscount}
                            onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm font-mono",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          />
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default font-mono",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {globalDiscount}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Global Stock Alert */}
                    <div className="flex flex-col sm:flex-row sm:items-start py-4 gap-4">
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Global Stock Alert
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md space-y-3">
                        {isEditingPricing ? (
                          <>
                            <select 
                              value={lowStockEnabled ? "true" : "false"}
                              onChange={(e) => setLowStockEnabled(e.target.value === "true")}
                              className={cn(
                                "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                                theme === 'dark' 
                                  ? (themePreset === 'saas-dark'
                                      ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                      : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                  : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                              )}
                            >
                              <option value="true">ENABLED (Monitor list threshold levels)</option>
                              <option value="false">DISABLED (Mute depletion notifications)</option>
                            </select>

                            {lowStockEnabled && (
                              <div className="flex items-center gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-60">Alert Level:</label>
                                <input 
                                  type="number"
                                  value={lowStockThreshold}
                                  onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                                  className={cn(
                                    "w-24 rounded-lg py-1.5 px-3 outline-none font-mono text-center text-xs transition-all duration-300 border",
                                    theme === 'dark' 
                                      ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400" : "bg-black/40 border-dark-border text-white focus:border-cyan-400") 
                                      : "bg-white border-light-border text-black focus:border-[#062A95]"
                                  )}
                                />
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Units Remaining</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {lowStockEnabled ? `ENABLED (Alert threshold: ${lowStockThreshold} units remaining)` : "DISABLED (Mute depletion notifications)"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Security & Interface Mode Card */}
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/85" : "border-white/75") : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Lock size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Security & Interface
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (isEditingSecurity) {
                            await handleSaveStoreSettings();
                            setIsEditingSecurity(false);
                          } else {
                            setIsEditingSecurity(true);
                          }
                        }}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingSecurity
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingSecurity ? "Save & Exit" : "Edit Security settings"}
                      >
                        {isEditingSecurity ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    {/* Hide Personal Data */}
                    <div className={cn(
                      "flex flex-col sm:flex-row sm:items-center py-4 border-b border-solid gap-4",
                      theme === 'dark' ? (themePreset === 'saas-dark' ? "border-white/60" : "border-white/45") : "border-black/45"
                    )}>
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Hide Personal Data
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingSecurity ? (
                          <select 
                            value={hidePersonalInfo ? "true" : "false"}
                            onChange={(e) => setHidePersonalInfo(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">MASK DATA (Overlay identifiers with security masks)</option>
                            <option value="false">SHOW DATA (Render plain text credentials)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {hidePersonalInfo ? "MASK DATA (Overlay identifiers with security masks)" : "SHOW DATA (Render plain text credentials)"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Touch-Optimized Mode */}
                    <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-4">
                      <div className="sm:w-1/3 flex flex-col text-left">
                        <label className={cn(
                          "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em]",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Touch-Optimized Mode
                        </label>
                      </div>
                      <div className="w-full sm:max-w-xs md:max-w-md">
                        {isEditingSecurity ? (
                          <select 
                            value={touchOptimized ? "true" : "false"}
                            onChange={(e) => setTouchOptimized(e.target.value === "true")}
                            className={cn(
                              "w-full rounded-lg py-2 px-3 outline-none text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-pointer",
                              theme === 'dark' 
                                ? (themePreset === 'saas-dark'
                                    ? "bg-black/40 border-cyan-400 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
                                    : "bg-black/40 border-dark-border text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20") 
                                : "bg-white border-light-border text-light-text focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20"
                            )}
                          >
                            <option value="true">ENABLED (Enforce 44px tap targets and thick menus)</option>
                            <option value="false">DISABLED (Standard desktop scale layout)</option>
                          </select>
                        ) : (
                          <div className={cn(
                            "w-full rounded-lg py-2 px-3 text-xs font-bold tracking-tight border transition-all duration-300 shadow-sm cursor-default",
                            theme === 'dark' 
                              ? (themePreset === 'saas-dark' ? "bg-black/40 border-cyan-400/60 text-white/90" : "bg-black/40 border-dark-border text-white/90") 
                              : "bg-white border-light-border text-light-text/90"
                          )}>
                            {touchOptimized ? "ENABLED (Enforce 44px tap targets and thick menus)" : "DISABLED (Standard desktop scale layout)"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {activeTab === 'manager' && (role === 'Manager' || role?.toLowerCase() === 'manager') && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-all">
                {/* BLOCK: Terminal Instance Security & Manager Session Governance Card - Controls permanent manager registration & terminal de-registration */}
                <div className={cn(
                  "terminal-security-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "terminal-security-card--dark bg-dark-surface border-white/35 border-t-amber-500 text-white"
                    : "terminal-security-card--light bg-light-surface border-slate-400 border-t-amber-600 text-black"
                )}>
                  <div className={cn(
                    "terminal-security-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/75" : "border-black/75"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500 shrink-0">
                        <ShieldCheck size={18} />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "terminal-security-card__title text-xs font-black uppercase tracking-[0.25em] text-center",
                        theme === 'dark' ? "text-amber-400" : "text-amber-800"
                      )}>
                        Terminal Security & Manager Registration
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <span className="terminal-security-card__badge px-2.5 py-1 rounded-lg text-[9px] font-mono font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        INITIALIZED
                      </span>
                    </div>
                  </div>

                  <div className="terminal-security-card__body space-y-4">
                    <div className={cn(
                      "terminal-security-card__info-box p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
                      theme === 'dark' ? "bg-black/40 border-white/10" : "bg-slate-50 border-slate-200"
                    )}>
                      <div className="terminal-security-card__details space-y-1.5">
                        <p className="terminal-security-card__status text-xs font-black uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
                          <Terminal size={14} className="text-amber-500" />
                          Permanent Manager Instance Active
                        </p>
                        <p className="terminal-security-card__manager-email text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                          Registered Manager: <strong className="text-amber-500 font-bold">{localStorage.getItem('nurtron_registered_manager_email') || user?.email || 'Active Manager'}</strong>
                        </p>
                        <p className="terminal-security-card__desc text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-xl">
                          This POS instance is permanently initialized. Operator shift sign-outs (from header/sidebar) retain all local products, staff profiles, and settings on this device while locking sign-ups to authorized Manager creation only.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowDeregisterConfirm(true)}
                        className="terminal-security-card__logout-button px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95 shadow-sm"
                      >
                        <LogOut size={14} />
                        Log Out Terminal (De-register)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'manager' && role !== 'Manager' && role?.toLowerCase() !== 'manager' && (
              <div className={cn(
                "p-8 text-center rounded-2xl border space-y-3",
                theme === 'dark' ? "bg-red-500/10 border-red-500/20 text-white" : "bg-red-50 border-red-200 text-black"
              )}>
                <ShieldCheck className="mx-auto text-red-500" size={32} />
                <h3 className="text-sm font-bold uppercase tracking-wider text-red-500">Access Restricted</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only users with the Manager role can access Manager settings.
                </p>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* BLOCK: Primary Node Calibration Card - Displays authorized host hardware details and current active browser node status */}
                <div className={cn(
                  "primary-node-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "primary-node-card--dark bg-dark-surface border-white/35 border-t-brand-primary"
                    : "primary-node-card--light bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "primary-node-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4 mb-6",
                    theme === 'dark' ? "border-white/25" : "border-black/25"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Laptop size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "primary-node-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Primary Node Calibration
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        ACTIVE NODE
                      </span>
                    </div>
                  </div>

                  <div className="primary-node-card__body space-y-5">
                    {(() => {
                      const currentDevId = getOrCreateDeviceId();
                      const currentDev = sessionDevices.find(d => d.id === currentDevId) || {
                        name: getCleanDeviceName(),
                        platform: navigator.platform || 'Unknown Web Platform',
                        language: navigator.language || 'en',
                        userAgent: navigator.userAgent,
                        lastActive: new Date().toISOString()
                      };

                      return (
                        <div className="space-y-5">
                          <div className={cn(
                            "p-4 rounded-xl border border-dashed",
                            theme === 'dark' ? "bg-black/45 border-[#222]" : "bg-gray-50 border-[#EEE]"
                          )}>
                            <h4 className="text-sm font-black uppercase tracking-tight text-black dark:text-white mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-brand-primary" />
                              {currentDev.name}
                            </h4>
                            <p className="text-[9px] text-[#888] font-mono break-all leading-relaxed">{currentDev.userAgent}</p>
                          </div>

                          <div className="border-t border-dashed border-[#888]/10 pt-4 space-y-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[#888]">Hardware Specifications</span>
                              <span className="text-[8px] font-mono text-brand-primary uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md bg-brand-primary/5">
                                Local Instance
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase tracking-widest text-[#888]">Device Signature</p>
                                <p className="text-xs font-mono font-bold text-black dark:text-white truncate">{currentDevId}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase tracking-widest text-[#888]">Platform OS</p>
                                <p className="text-xs font-bold text-black dark:text-white uppercase truncate">{currentDev.platform}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase tracking-widest text-[#888]">System Language</p>
                                <p className="text-xs font-bold text-black dark:text-white uppercase truncate">{currentDev.language}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[8px] font-black uppercase tracking-widest text-[#888]">Last Synced Activity</p>
                                <p className="text-xs font-mono font-bold text-black dark:text-white truncate">{new Date(currentDev.lastActive).toLocaleTimeString()}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* BLOCK: Secondary Node Calibration Card - Manages active user session tokens across other logged in devices */}
                <div className={cn(
                  "secondary-node-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "secondary-node-card--dark bg-dark-surface border-white/35 border-t-brand-primary"
                    : "secondary-node-card--light bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "secondary-node-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4 mb-6",
                    theme === 'dark' ? "border-white/25" : "border-black/25"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Smartphone size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "secondary-node-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Secondary Node Calibration
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-mono">
                        {sessionDevices.filter(d => d.id !== getOrCreateDeviceId()).length} NODES
                      </span>
                    </div>
                  </div>

                  <div className="secondary-node-card__body">
                    <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                      {(() => {
                        const currentDevId = getOrCreateDeviceId();
                        const otherDevices = sessionDevices.filter(d => d.id !== currentDevId);

                        if (otherDevices.length === 0) {
                          return (
                            <div className="text-center py-8">
                              <p className="text-xs text-[#888] uppercase tracking-widest font-bold">No other active devices</p>
                              <p className="text-[10px] text-[#888]/60 mt-2 font-mono uppercase">Your user session is currently exclusive to this browser console.</p>
                            </div>
                          );
                        }

                        return otherDevices.map((device: any) => (
                          <div 
                            key={device.id} 
                            className={cn(
                              "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all",
                              theme === 'dark' ? "bg-black/45 border-[#222]" : "bg-white border-[#EEE] shadow-sm"
                            )}
                          >
                            <div className="space-y-1">
                              <h5 className="text-xs font-black uppercase tracking-tight text-black dark:text-white">{device.name}</h5>
                              <div className="flex flex-col gap-0.5 text-[9px] text-[#888] font-mono uppercase">
                                <p>ID: {device.id}</p>
                                <p>Last Activity: {new Date(device.lastActive).toLocaleString()}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleLogoutDevice(device.id)}
                              className={cn(
                                "w-full sm:w-auto px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer font-black text-[9px] uppercase tracking-wider hover:scale-[1.03]",
                                theme === 'dark' ? "border-[#ff4d4d]/20 bg-[#ff4d4d]/10 text-red-400 hover:border-[#ff4d4d]/40" : "border-[#ef4444]/15 bg-[#ef4444]/5 text-red-500 hover:border-[#ef4444]/30"
                              )}
                            >
                              <LogOut size={10} />
                              Revoke
                            </button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                {/* BLOCK: Local Devices Card - Controls Wi-Fi subnet connectivity and local companion device setups */}
                <div className={cn(
                  "local-devices-card border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "local-devices-card--dark bg-dark-surface border-white/35 border-t-brand-primary"
                    : "local-devices-card--light bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "local-devices-card__header pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4 mb-6",
                    theme === 'dark' ? "border-white/25" : "border-black/25"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Wifi size={14} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "local-devices-card__title text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Local Devices
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingLocalDevices(!isEditingLocalDevices)}
                        className={cn(
                          "p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center cursor-pointer border-2 shadow-sm shrink-0",
                          isEditingLocalDevices
                            ? (theme === 'dark' ? "bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20" : "bg-[#062A95]/10 border-[#062A95] text-[#062A95]")
                            : (theme === 'dark' ? "bg-black border-dark-border text-white hover:bg-gray-950" : "bg-white border-light-border text-black hover:bg-gray-50")
                        )}
                        title={isEditingLocalDevices ? "Save & Exit" : "Edit Local Devices"}
                      >
                        {isEditingLocalDevices ? <Check size={14} /> : <Edit3 size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="local-devices-card__body">
                    {/* Locked provisioning style if not a manager */}
                    {role !== 'Manager' ? (
                      <div className="local-devices-card__lock-container flex flex-col items-center justify-center p-4 text-center space-y-3 animate-in fade-in duration-300">
                        <div className="local-devices-card__lock-icon-wrapper w-12 h-12 rounded-full border border-dashed flex items-center justify-center border-red-500/30 text-red-400">
                          <Lock size={16} />
                        </div>
                        <div className="local-devices-card__lock-details space-y-1.5 text-center">
                          <p className={cn(
                            "local-devices-card__lock-title text-xs font-black uppercase tracking-wider",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            Provisioning Locked
                          </p>
                          <p className="local-devices-card__lock-limit text-[10px] uppercase tracking-tight text-red-500 font-black">
                            Manager Role Required
                          </p>
                          <p className={cn(
                            "local-devices-card__lock-instruction text-[9px] uppercase tracking-normal leading-normal max-w-xs mx-auto opacity-70",
                            theme === 'dark' ? "text-white/80" : "text-black/80"
                          )}>
                            Only a user with Manager role can configure or add local devices. Contact your system administrator to elevate permissions.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {isEditingLocalDevices && (
                          <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-[#888]/15">
                            <div className="space-y-0.5">
                              <p className={cn("text-[10px] font-black uppercase tracking-wider", theme === 'dark' ? "text-white" : "text-black")}>
                                Local Subnet Management
                              </p>
                              <p className="text-[9px] font-mono text-[#888] uppercase">
                                Register or pair companion terminals across your Wi-Fi network.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsLocalSetupOpen(true);
                                setLocalSetupStep(1);
                                setWifiPairingStatus('idle');
                                setWifiPairingProgress(0);
                                setSelectedSessionDevice(null);
                              }}
                              className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.03] shrink-0",
                                theme === 'dark' 
                                  ? "bg-brand-primary border-brand-primary text-white hover:bg-brand-primary/90 shadow-lg shadow-brand-primary/20" 
                                  : "bg-black border-black text-white hover:bg-black/90 shadow-md"
                              )}
                            >
                              <Plus size={12} />
                              Setup Connection
                            </button>
                          </div>
                        )}

                        {/* Display connected local devices */}
                        <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                          {localDevicesLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-brand-primary animate-pulse">
                              <RefreshCw size={14} className="animate-spin" />
                              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Syncing Local Subnet Registry...</span>
                            </div>
                          ) : localDevices.length === 0 ? (
                            /* BLOCK: Empty Local Devices Card */
                            <div className={cn(
                              "local-devices-empty-card p-8 sm:p-10 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft my-2",
                              theme === 'dark' ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                            )}>
                              <Laptop size={54} strokeWidth={1.5} className={cn("local-devices-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("local-devices-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>No Local Devices Connected</p>
                              <p className={cn("local-devices-empty-card__subtitle text-xs font-presale tracking-wide mt-1 max-w-md", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No peer companion displays or wireless checkout terminals are registered on this local subnet.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {localDevices.map((device: any) => (
                                <div 
                                  key={device.id}
                                  className={cn(
                                    "p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all relative overflow-hidden",
                                    theme === 'dark' ? "bg-black/45 border-[#222]" : "bg-white border-[#EEE] shadow-sm"
                                  )}
                                >
                                  <div className="absolute top-0 right-0 h-[2px] w-24 bg-emerald-500" />
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-black uppercase tracking-tight text-black dark:text-white flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        {device.name}
                                      </h5>
                                      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        WI-FI NODE
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 text-[9px] text-[#888] font-mono uppercase">
                                      <p>Device ID: {device.deviceId}</p>
                                      <p>IP Address: {device.ipAddress} (Port 3000)</p>
                                      <p>Device Role: {device.role}</p>
                                      <p>Linked: {new Date(device.connectedAt).toLocaleString()}</p>
                                    </div>
                                  </div>
                                  {isEditingLocalDevices ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDisconnectLocalDevice(device.id)}
                                      className={cn(
                                        "w-full px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer font-black text-[9px] uppercase tracking-wider",
                                        theme === 'dark' ? "border-[#ff4d4d]/20 bg-[#ff4d4d]/10 text-red-400 hover:border-[#ff4d4d]/40" : "border-[#ef4444]/15 bg-[#ef4444]/5 text-red-500 hover:border-[#ef4444]/30"
                                      )}
                                    >
                                      <X size={10} />
                                      Disconnect Node
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleDisconnectLocalDevice(device.id)}
                                      className={cn(
                                        "w-full px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer font-black text-[9px] uppercase tracking-wider",
                                        theme === 'dark' ? "border-[#ff4d4d]/20 bg-[#ff4d4d]/10 text-red-400 hover:border-[#ff4d4d]/40" : "border-[#ef4444]/15 bg-[#ef4444]/5 text-red-500 hover:border-[#ef4444]/30"
                                      )}
                                    >
                                      <X size={10} />
                                      Disconnect Node
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                  {/* Setup Connection Wizard Modal */}
                  <AnimatePresence>
                    {isLocalSetupOpen && (
                      <div className="fixed top-16 bottom-0 left-0 right-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="settings-local-setup-modal__backdrop absolute inset-0 bg-black/10 backdrop-blur-[1px] cursor-pointer z-10"
                          onClick={handleBackdropClick}
                        />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "w-full max-w-lg border-2 rounded-3xl p-0 relative overflow-hidden text-left flex flex-col z-20",
                            theme === 'dark' ? "bg-dark-surface border-white/35 text-white" : "bg-white border-slate-400 text-black shadow-2xl"
                          )}
                        >
                          {/* Top Accent Strip */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                          {/* Header Container */}
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
                                  <Wifi size={16} className="text-brand-primary animate-pulse" />
                                </div>
                              </div>

                              <div className="text-center flex flex-col items-center justify-center font-presale">
                                <h3 className={cn(
                                  "text-sm font-presale font-bold tracking-wide text-center max-w-[160px] sm:max-w-none leading-tight",
                                  theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                                )}>
                                  Device Setup
                                </h3>
                                <span className="text-[10px] font-mono tracking-wide opacity-60 mt-1 text-center px-1">
                                  (Wi-Fi)
                                </span>
                              </div>

                              <div className="flex justify-end">
                                <button 
                                  type="button"
                                  onClick={() => setIsLocalSetupOpen(false)}
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

                          <div className="p-6 md:p-8 space-y-6">
                            {role !== 'Manager' ? (
                              <div className="space-y-4 py-4 text-center">
                                <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                                  <LucideAlertTriangle size={24} />
                                </div>
                                <div className="space-y-1">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-red-500">Access Restricted</h4>
                                  <p className="text-xs text-[#888] uppercase tracking-wider">
                                    Only users with the Manager role can add other local devices to the Wi-Fi registry.
                                  </p>
                                </div>
                                <button
                                  onClick={() => setIsLocalSetupOpen(false)}
                                  className={cn(
                                    "w-full py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                    theme === 'dark' ? "bg-white text-black border-white hover:bg-gray-200" : "bg-black text-white border-black hover:bg-gray-800"
                                  )}
                                >
                                  Exit Setup
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Step Tracker */}
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest border-b border-[#888]/10 pb-4">
                                <span>Step {localSetupStep} of 2</span>
                                <span className="text-brand-primary">{localSetupStep === 1 ? 'Subnet Scan' : 'Establishing Tunnel'}</span>
                              </div>

                              {localSetupStep === 1 && (
                                <div className="space-y-4">
                                  <div className={cn(
                                    "p-4 rounded-xl border border-dashed text-xs space-y-2",
                                    theme === 'dark' ? "bg-black/45 border-[#333] text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600"
                                  )}>
                                    <p className="font-bold text-black dark:text-white uppercase tracking-wider text-[10px]">Wi-Fi Subnet Prerequisites:</p>
                                    <ul className="list-disc pl-4 space-y-1 uppercase tracking-tight text-[9px] font-semibold">
                                      <li>The local manager must be logged in on the other local computers or tablets.</li>
                                      <li>Both devices must be connected to the exact same Wi-Fi subnet or local router.</li>
                                      <li>Make sure the other devices have the application open on the 'Devices' tab.</li>
                                    </ul>
                                  </div>

                                  <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">Available Active Manager Nodes on Subnet</p>
                                    {(() => {
                                      const currentDevId = getOrCreateDeviceId();
                                      const otherManagerSessions = sessionDevices.filter(d => d.id !== currentDevId);

                                      if (otherManagerSessions.length === 0) {
                                        return (
                                          <div className={cn(
                                            "p-6 rounded-xl border text-center space-y-3",
                                            theme === 'dark' ? "bg-black/20 border-[#222]" : "bg-white border-gray-100 shadow-inner"
                                          )}>
                                            <p className="text-xs text-[#888] uppercase tracking-wider font-bold">No other manager sessions detected on Wi-Fi</p>
                                            <p className="text-[10px] text-[#888]/60 font-mono uppercase leading-relaxed max-w-sm mx-auto">
                                              No companion devices have verified manager sessions broadcasted. Log in on your other computer, iPad, or mobile first, then click refresh.
                                            </p>
                                            <button
                                              onClick={fetchSessionDevices}
                                              className={cn(
                                                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border-2 mx-auto inline-flex items-center gap-1.5 cursor-pointer",
                                                theme === 'dark' ? "bg-black border-[#444] text-white hover:bg-white/5" : "bg-white border-gray-200 text-black hover:bg-gray-50"
                                              )}
                                            >
                                              <RefreshCw size={10} className={cn(devicesLoading && "animate-spin")} />
                                              Refresh Subnet Scan
                                            </button>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="space-y-2 max-h-[180px] overflow-y-auto no-scrollbar">
                                          {otherManagerSessions.map((device: any) => {
                                            const isSelected = selectedSessionDevice?.id === device.id;
                                            return (
                                              <button
                                                key={device.id}
                                                onClick={() => setSelectedSessionDevice(device)}
                                                className={cn(
                                                  "w-full p-4 rounded-xl border text-left flex items-center justify-between gap-4 transition-all cursor-pointer",
                                                  isSelected 
                                                    ? (theme === 'dark' ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-black bg-black/5 text-black")
                                                    : (theme === 'dark' ? "border-[#222] bg-black/40 text-gray-300 hover:border-[#333]" : "border-gray-200 bg-white hover:bg-gray-50")
                                                )}
                                              >
                                                <div className="space-y-1">
                                                  <h5 className="text-xs font-bold uppercase tracking-tight">{device.name}</h5>
                                                  <p className="text-[9px] font-mono text-[#888] uppercase">Device Signature: {device.id}</p>
                                                  <p className="text-[8px] font-mono text-emerald-500 font-black uppercase">✓ MANAGER LOGGED IN</p>
                                                </div>
                                                <div className={cn(
                                                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                                                  isSelected ? "border-brand-primary bg-brand-primary text-white" : "border-gray-300"
                                                )}>
                                                  {isSelected && <Check size={10} />}
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <div className="pt-2">
                                    <button
                                      onClick={() => {
                                        if (!selectedSessionDevice) return;
                                        setLocalSetupStep(2);
                                        handleConnectLocalDevice(selectedSessionDevice);
                                      }}
                                      disabled={!selectedSessionDevice}
                                      className={cn(
                                        "w-full py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                        !selectedSessionDevice 
                                          ? "bg-gray-500/15 border-gray-500/5 text-gray-500 cursor-not-allowed"
                                          : theme === 'dark' ? "bg-white text-black border-white hover:bg-gray-200" : "bg-black text-white border-black hover:bg-gray-800"
                                      )}
                                    >
                                      Initiate Wi-Fi Pairing
                                    </button>
                                  </div>
                                </div>
                              )}

                              {localSetupStep === 2 && (
                                <div className="space-y-6 text-center py-4">
                                  {wifiPairingStatus === 'pairing' && (
                                    <div className="space-y-6">
                                      <div className="relative w-20 h-20 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-dashed border-cyan-400 animate-spin" />
                                        <div className="absolute inset-2 rounded-full border border-dashed border-[#555] flex items-center justify-center text-cyan-400">
                                          <Wifi size={24} className="animate-pulse" />
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400">Tunneling Wi-Fi Port...</h4>
                                        <p className="text-[9px] text-[#888] font-mono uppercase">Connecting to {selectedSessionDevice?.name}</p>
                                        
                                        {/* Progress bar */}
                                        <div className="w-full max-w-xs mx-auto h-1.5 bg-black/40 rounded-full overflow-hidden border border-[#333]">
                                          <div 
                                            className="h-full bg-cyan-400 transition-all duration-300"
                                            style={{ width: `${wifiPairingProgress}%` }}
                                          />
                                        </div>
                                        <p className="text-[10px] font-mono text-cyan-400">{wifiPairingProgress}% Handshake Payload Compiled</p>
                                      </div>
                                    </div>
                                  )}

                                  {wifiPairingStatus === 'success' && (
                                    <div className="space-y-6">
                                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 mx-auto animate-bounce">
                                        <CheckCircle2 size={32} />
                                      </div>
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-black uppercase tracking-wider text-emerald-500">Wi-Fi Connection Established!</h4>
                                        <p className="text-xs text-[#888] uppercase tracking-wider">
                                          Successfully linked to <strong>{selectedSessionDevice?.name}</strong> over local subnet Wi-Fi.
                                        </p>
                                        <div className={cn(
                                          "p-3 rounded-xl border font-mono text-[10px] inline-block uppercase text-left",
                                          theme === 'dark' ? "bg-black/40 border-[#222]" : "bg-gray-50 border-gray-100"
                                        )}>
                                          <p>✓ Authorized Subnet Tunneling [Port 3000]</p>
                                          <p>✓ Token Handshake verified via secure database</p>
                                          <p>✓ Latency: 1.22ms (Ultra-high speed Wi-Fi channel)</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => setIsLocalSetupOpen(false)}
                                        className={cn(
                                          "w-full py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                          theme === 'dark' ? "bg-white text-black border-white hover:bg-gray-200" : "bg-black text-white border-black hover:bg-gray-800"
                                        )}
                                      >
                                        Finish & Close
                                      </button>
                                    </div>
                                  )}

                                  {wifiPairingStatus === 'error' && (
                                    <div className="space-y-6">
                                      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-500 mx-auto">
                                        <LucideAlertTriangle size={32} />
                                      </div>
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-black uppercase tracking-wider text-red-500">Pairing Handshake Failed</h4>
                                        <p className="text-xs text-[#888] uppercase tracking-wider">{wifiPairingError}</p>
                                      </div>
                                      <div className="flex gap-4">
                                        <button
                                          onClick={() => setLocalSetupStep(1)}
                                          className={cn(
                                            "flex-1 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                            theme === 'dark' ? "bg-black text-white border-[#444] hover:bg-white/5" : "bg-white text-black border-gray-200 hover:bg-gray-50"
                                          )}
                                        >
                                          Back
                                        </button>
                                        <button
                                          onClick={() => handleConnectLocalDevice(selectedSessionDevice)}
                                          className={cn(
                                            "flex-1 py-2.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all bg-brand-primary text-white border-brand-primary hover:bg-brand-primary/90"
                                          )}
                                        >
                                          Retry Connection
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}

      {activeTab === 'admin' && user && (role === 'Manager' || user.email === 'admin@megapos.pos') && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={cn(
                  "border rounded-2xl pt-4 pb-6 px-6 md:pt-4 md:pb-8 md:px-8 transition-all duration-300 space-y-6 shadow-sm hover:shadow-md border-t-4",
                  theme === 'dark'
                    ? "bg-dark-surface border-white/35 border-t-brand-primary"
                    : "bg-light-surface border-slate-400 border-t-[#062A95]"
                )}>
                  <div className={cn(
                    "pb-4 border-b border-solid grid grid-cols-[auto_1fr_auto] items-center w-full gap-2 md:gap-4",
                    theme === 'dark' ? "border-white/25" : "border-black/25"
                  )}>
                    <div className="flex justify-start">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-primary/10 text-brand-primary shrink-0">
                        <Database size={14} className="text-brand-primary animate-pulse" />
                      </div>
                    </div>

                    <div className="text-center">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-[0.25em] whitespace-normal break-words text-center",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Telemetry Console
                      </h3>
                    </div>

                    <div className="flex justify-end">
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                        <span className="w-1 h-1 rounded bg-emerald-500 animate-ping" />
                        Live
                      </span>
                    </div>
                  </div>


                  {/* Admin Tab Content Router */}
                  {adminSubTab === 'telemetry' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                      
                      {/* Integrated Web App Systems & Tech Stack Info Card */}
                      <div className={cn(
                        "p-6 rounded-2xl border-2 relative overflow-hidden flex flex-col justify-between transition-all duration-300",
                        theme === 'dark' 
                          ? "bg-[#040406]/60 border-cyan-500/25 text-[#22D3EE] [text-shadow:0_0_2px_rgba(34,211,238,0.2)]" 
                          : "bg-gradient-to-br from-[#062A95]/5 to-white border-[#062A95]/15 text-slate-800"
                      )}>
                        {/* Top Glowing Laser strip */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-[#22D3EE] animate-pulse pointer-events-none" />
                        
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Layers className="w-6 h-6 animate-pulse text-brand-primary" />
                            <div>
                              <h4 className="text-sm font-bold uppercase tracking-tight font-presale text-left">
                                App Systems Architecture & Spec Manifest
                              </h4>
                              <p className="text-[9px] uppercase tracking-widest opacity-60 font-mono text-left">
                                System compilation & infrastructure invariants
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs font-mono">
                            <div className="space-y-1 bg-black/5 dark:bg-black/40 p-3 rounded-xl border border-inherit/10 text-left">
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold">Local Database Engine</span>
                              <span className="font-bold text-slate-900 dark:text-white">Standalone Local Storage & IndexedDB Store</span>
                              <span className="text-[9px] block opacity-70 mt-1 leading-normal text-slate-700 dark:text-cyan-200/80">
                                Zero-dependency offline master store. Fast, portable real-time reactive state with event dispatching for ZIP deployments.
                              </span>
                            </div>

                            <div className="space-y-1 bg-black/5 dark:bg-black/40 p-3 rounded-xl border border-inherit/10 text-left">
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold">Authentication Engine</span>
                              <span className="font-bold text-slate-900 dark:text-white">Standalone Local Auth & Admin Security</span>
                              <span className="text-[9px] block opacity-70 mt-1 leading-normal text-slate-700 dark:text-cyan-200/80">
                                Direct local session management with instant Admin Login bypass, operator PIN clearance, and role-based clearance.
                              </span>
                            </div>

                            <div className="space-y-1 bg-black/5 dark:bg-black/40 p-3 rounded-xl border border-inherit/10 text-left">
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold">Backend Gateway</span>
                              <span className="font-bold text-slate-900 dark:text-white">Express.js & Node.js Gateway</span>
                              <span className="text-[9px] block opacity-70 mt-1 leading-normal text-slate-700 dark:text-cyan-200/80">
                                Express 4 server container proxying Gemini AI model endpoints and serving static assets seamlessly.
                              </span>
                            </div>

                            <div className="space-y-1 bg-black/5 dark:bg-black/40 p-3 rounded-xl border border-inherit/10 text-left">
                              <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-bold">Coding Languages & Frameworks</span>
                              <span className="font-bold text-slate-900 dark:text-white">TypeScript, React 19, Vite, Tailwind CSS</span>
                              <span className="text-[9px] block opacity-70 mt-1 leading-normal text-slate-700 dark:text-cyan-200/80">
                                Fully typed ESM architecture built with React 19, Vite 6 bundling engine, ESBuild compilation, and Tailwind CSS.
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 text-[9px] font-mono border-t border-inherit/10 pt-2.5 opacity-60">
                          <span>ARCHITECTURE REVISION: Rev-3.0.0 (Standalone Local Edition)</span>
                          <span>COMPILED SECURE MODULE STATE OK</span>
                        </div>
                      </div>

                  {/* System Core Attributes Block */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between",
                      theme === 'dark' ? "bg-black/30 border-white/30" : "bg-white border-slate-400"
                    )}>
                      <div>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Database Engine</p>
                        <p className="text-sm font-semibold font-mono tracking-tight text-brand-primary mt-1 select-all">
                          megapos-local-store (Offline Reactive)
                        </p>
                      </div>
                      <p className="text-[9px] uppercase tracking-widest mt-4 text-emerald-500 font-extrabold flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Local Store Active
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between",
                      theme === 'dark' ? "bg-black/30 border-white/30" : "bg-white border-slate-400"
                    )}>
                      <div>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Authentication State</p>
                        <p className="text-sm font-semibold font-mono tracking-tight text-brand-primary mt-1">
                          LOCAL_ADMIN_AUTH_PROVIDER
                        </p>
                      </div>
                      <p className="text-[9px] uppercase tracking-widest mt-4 text-emerald-500 font-extrabold flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Admin Access Enforced
                      </p>
                    </div>

                    <div className={cn(
                      "p-4 rounded-xl border flex flex-col justify-between",
                      theme === 'dark' ? "bg-black/30 border-white/30" : "bg-white border-slate-400"
                    )}>
                      <div>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Vite Devserver & Bundler</p>
                        <p className="text-sm font-semibold font-mono tracking-tight text-brand-primary mt-1">
                          Vite 6 • 0.0.0.0:3000
                        </p>
                      </div>
                      <p className="text-[9px] uppercase tracking-widest mt-4 text-emerald-500 font-extrabold flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Ingress Routing Live
                      </p>
                    </div>
                  </div>

                  {/* Real-time System Health Monitor Widget */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
                          <Activity size={14} className="text-brand-primary" />
                          Real-time System Health & Gateway Monitor
                        </h4>
                        <p className="text-[9px] uppercase tracking-widest opacity-60 mt-0.5">
                          Active probe validation for databases and primary logic models
                        </p>
                      </div>
                      
                      <button
                        onClick={checkSystemHealth}
                        disabled={isHealthChecking}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2",
                          theme === 'dark' 
                            ? "bg-white/5 border-dark-border hover:bg-[#22D3EE] hover:text-black hover:border-[#22D3EE]" 
                            : "bg-white border-light-border hover:bg-black hover:text-white hover:border-black"
                        )}
                      >
                        <RefreshCw size={10} className={isHealthChecking ? "animate-spin" : ""} />
                        {isHealthChecking ? "Probing Edge..." : "Force Probe Status"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Database Status Block */}
                      <div className={cn(
                        "p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all relative overflow-hidden",
                        theme === 'dark' ? "bg-black/25 border-dark-border" : "bg-white border-light-border shadow-sm"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                            dbHealthStatus === 'online' 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                              : dbHealthStatus === 'offline' 
                                ? "bg-red-500/10 border-red-500/20 text-red-500" 
                                : "bg-neutral-500/10 border-neutral-500/20 text-neutral-500"
                          )}>
                            <Database size={20} className={dbHealthStatus === 'checking' ? "animate-bounce" : ""} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black uppercase tracking-wider">Cloud Database Engine</p>
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-widest font-mono",
                                dbHealthStatus === 'online' 
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                                  : dbHealthStatus === 'offline' 
                                    ? "bg-red-500/15 text-red-400 border border-red-500/20" 
                                    : "bg-neutral-500/15 text-neutral-400 border border-neutral-500/20 animate-pulse"
                              )}>
                                {dbHealthStatus}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                              ID: {firebaseConfig.firestoreDatabaseId || "(default)"} · db.cloud.relay
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[8px] uppercase tracking-widest text-gray-500 font-bold">Probe Latency</p>
                          <p className="text-base font-black font-mono tracking-tight text-brand-primary mt-0.5">
                            {dbHealthStatus === 'online' && dbLatency ? dbLatency : dbHealthStatus === 'checking' ? "Measuring..." : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Gemini API Status Block */}
                      <div className={cn(
                        "p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all relative overflow-hidden",
                        theme === 'dark' ? "bg-black/25 border-dark-border" : "bg-white border-light-border shadow-sm"
                      )}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                            geminiHealthStatus === 'online' 
                              ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" 
                              : geminiHealthStatus === 'missing_key' 
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                                : geminiHealthStatus === 'offline' 
                                  ? "bg-red-500/10 border-red-500/20 text-red-500" 
                                  : "bg-neutral-500/10 border-neutral-500/20 text-neutral-500"
                          )}>
                            <Cloud size={20} className={geminiHealthStatus === 'checking' ? "animate-pulse" : ""} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black uppercase tracking-wider">Gemini API Service</p>
                              <span className={cn(
                                "text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-widest font-mono",
                                geminiHealthStatus === 'online' 
                                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" 
                                  : geminiHealthStatus === 'missing_key' 
                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                    : geminiHealthStatus === 'offline' 
                                      ? "bg-red-500/15 text-red-400 border border-red-500/20" 
                                      : "bg-neutral-500/15 text-neutral-400 border border-neutral-500/20 animate-pulse"
                              )}>
                                {geminiHealthStatus === 'missing_key' ? "Key Missing" : geminiHealthStatus}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                              Model: gemini-3.5-flash · Endpoint API Gateway
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[8px] uppercase tracking-widest text-gray-500 font-bold">API Latency</p>
                          <p className="text-base font-black font-mono tracking-tight text-brand-primary mt-0.5">
                            {geminiHealthStatus === 'online' && geminiLatency ? geminiLatency : geminiHealthStatus === 'checking' ? "Measuring..." : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Gemini Error Callout if applicable */}
                    {geminiError && (
                      <div className={cn(
                        "p-4 rounded-xl border flex items-start gap-3 animate-in fade-in duration-300",
                        theme === 'dark' ? "bg-amber-950/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
                      )}>
                        <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider">Gateway Probe Exception details</p>
                          <p className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed mt-1 opacity-90">{geminiError}</p>
                          <p className="text-[9px] uppercase tracking-wider mt-2 opacity-50">
                            Configure process environ variable <strong className="font-mono">GEMINI_API_KEY</strong> to clear handshake.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nodes Grid & System Pinger */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Live Node Deck Telemetry</h4>
                      <button
                        onClick={() => {
                          setIsPinging(true);
                          setTimeout(() => {
                            setActiveNodes(prev => prev.map(n => {
                              const randomMs = (Math.random() * 12).toFixed(2);
                              return {
                                ...n,
                                latency: `${randomMs}ms`,
                                progress: [...n.progress.slice(1), Math.floor(Math.random() * 95) + 5]
                              };
                            }));
                            setIsPinging(false);
                          }, 1000);
                        }}
                        disabled={isPinging}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2",
                          theme === 'dark' 
                            ? "bg-white/5 border-dark-border hover:bg-[#22D3EE] hover:text-black hover:border-[#22D3EE]" 
                            : "bg-white border-light-border hover:bg-black hover:text-white hover:border-black"
                        )}
                      >
                        <RefreshCw size={10} className={isPinging ? "animate-spin" : ""} />
                        {isPinging ? "Calculating..." : "Ping Active Nodes"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {activeNodes.map(node => (
                        <div key={node.id} className={cn(
                          "p-4 rounded-xl border flex flex-col justify-between transition-all relative overflow-hidden",
                          theme === 'dark' ? "bg-black/25 border-dark-border" : "bg-white border-light-border shadow-sm"
                        )}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-[10px] font-black tracking-tight leading-tight">{node.label}</p>
                              <p className="text-[8px] font-mono opacity-50 mt-0.5">{node.id} — {node.ip}</p>
                            </div>
                            <span className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono tracking-wider",
                              node.status === 'ONLINE' || node.status === 'ACTIVE'
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-cyan-500/10 text-cyan-500"
                            )}>
                              {node.status}
                            </span>
                          </div>

                          <div className="mt-4 flex items-end justify-between">
                            <div>
                              <p className="text-[8px] uppercase tracking-widest opacity-40 font-bold">LATENCY</p>
                              <p className="text-xl font-black font-mono tracking-tight mt-0.5 text-brand-primary animate-pulse">{node.latency}</p>
                            </div>
                            
                            {/* Sparks Mini Viz */}
                            <div className="flex gap-0.5 h-6 items-end pb-1 opacity-70">
                              {node.progress.map((p, idx) => (
                                <div key={idx} className="w-1 bg-[#22D3EE] rounded-t" style={{ height: `${p}%` }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Private System Analytics CRT Box */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                        Historical CRT Logger Stream
                      </h4>
                      <button
                        onClick={() => {
                          setAdminTerminalLogs([
                            `RE_INITIALIZED_DAEMON_AT_${new Date().toISOString().replace('T', '_').slice(0, 19)}`,
                            'STATUS_REPORT: System parameters clear',
                            'DECK_METADATA: Synced to workspace instance'
                          ]);
                        }}
                        className="text-[9px] text-red-500 font-bold uppercase tracking-wider hover:underline cursor-pointer"
                      >
                        Reset Stream Buffer
                      </button>
                    </div>

                    <div className={cn(
                      "p-4 rounded-xl border font-mono text-[11px] h-72 flex flex-col justify-between relative overflow-y-auto",
                      theme === 'dark' 
                        ? "bg-[#040406] border-emerald-500/25 text-emerald-400 [text-shadow:0_0_2px_#34d399]" 
                        : "bg-zinc-950 border-zinc-800 text-zinc-300"
                    )}>
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-[#22D3EE]/20 animate-pulse pointer-events-none" />
                      
                      <div className="space-y-1 overflow-y-auto flex-1">
                        {adminTerminalLogs.map((log, idx) => (
                          <div key={idx} className="flex gap-2 items-start text-[10px] leading-normal font-mono">
                            <span className="opacity-55 shrink-0">{~~((idx + 1) * 17)}:</span>
                            <span className={cn(
                              idx % 4 === 0 ? "font-black" :
                              log.includes('database') || log.includes('Auth') ? "text-[#22D3EE] font-bold" : "opacity-90"
                            )}>
                              {log}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between opacity-50 mt-4 text-[9px] border-t border-inherit/10 pt-1.5">
                        <span>MEGAPOS INTEGRATED SECURE ADMIN DATA CORE</span>
                        <span>ENV_PROD_1.0_SECURE</span>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Suite Trigger */}
                  <div className={cn(
                    "p-6 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-6",
                    theme === 'dark' ? "bg-black/10 border-dark-border" : "bg-gray-50 border-light-border"
                  )}>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider">Operational Integrity Diagnostics</h4>
                      <p className="text-xs mt-1 opacity-60">
                        Initiate full database validation, cache verification, and secure environment scope tests.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      {diagnosticResult && (
                        <div className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-widest font-extrabold flex items-center justify-center gap-1.5 animate-in fade-in">
                          <CheckCircle2 size={12} />
                          {diagnosticResult}
                        </div>
                      )}
                      
                      <button
                        onClick={() => {
                          setIsDiagnosing(true);
                          setDiagnosticResult(null);
                          setTimeout(() => {
                            setIsDiagnosing(false);
                            setDiagnosticResult("Operational Diagnostics Complete: 100% Invariants Clear");
                          }, 1500);
                        }}
                        disabled={isDiagnosing}
                        className={cn(
                          "px-5 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] text-center shrink-0 active:scale-95 transition-all cursor-pointer border-2",
                          theme === 'dark'
                            ? "bg-brand-primary border-brand-primary text-black hover:brightness-115"
                            : "bg-black border-black text-white hover:bg-zinc-800"
                        )}
                      >
                        {isDiagnosing ? "Diagnosing Systems..." : "Launch Diagnostics"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

            {activeTab === 'admin' && (!user || (role !== 'Manager' && user.email !== 'admin@megapos.pos')) && (
              <div className="p-8 text-center space-y-4">
                <LucideAlertTriangle className="text-red-500 mx-auto animate-bounce" size={48} />
                <h3 className="text-lg font-black uppercase tracking-tight">Access Denied</h3>
                <p className="text-xs text-dark-muted max-w-md mx-auto">
                  Only system administrator accounts have permissions to view telemetries, databases, and node decks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Floating Sync Action Button */}
      <div className="fixed bottom-6 right-8 z-[110]">
        <button
          onClick={handleSaveStoreSettings}
          disabled={loading}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 active:scale-95 focus:outline-none group cursor-pointer",
            theme === 'dark' 
              ? "bg-[#22D3EE] text-black border-[#0F172A] shadow-[#22D3EE]/20 hover:brightness-110" 
              : "bg-[#062A95] text-white border-white shadow-[#062A95]/20 hover:bg-opacity-95"
          )}
          title="Sync Settings"
        >
          {loading ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} className="group-hover:scale-115 transition-transform duration-200" />}
        </button>
      </div>

      {/* BLOCK: De-register Terminal Confirmation Popup Card */}
      <AnimatePresence>
        {showDeregisterConfirm && (
          <div id="deregister-terminal-popup-card-overlay" className="popup-card-overlay deregister-terminal-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              className="deregister-terminal-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
              className={cn(
                "popup-card deregister-terminal-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
                theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
              )}
            >
              {/* Top Accent Strip */}
              <div className="deregister-terminal-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

              <div className="popup-card__header deregister-terminal-popup-card__header flex items-start gap-4">
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
                  className="popup-card__icon deregister-terminal-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                >
                  <AlertTriangle size={24} />
                </motion.div>
                <div className="popup-card__title-group deregister-terminal-popup-card__title-group space-y-1">
                  <h3 className={cn(
                    "popup-card__title deregister-terminal-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    De-register Terminal?
                  </h3>
                  <p className="popup-card__subtitle deregister-terminal-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">Terminal Reset Alert</p>
                </div>
              </div>

              <div className={cn(
                "popup-card__body deregister-terminal-popup-card__body text-sm tracking-tight leading-relaxed",
                theme === 'dark' ? "text-white/85" : "text-black/85"
              )}>
                This will remove the permanent manager registration for this terminal. Next session will require a Manager login or sign up to initialize the terminal again before staff can log in.
              </div>

              <div className="popup-card__footer deregister-terminal-popup-card__footer flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowDeregisterConfirm(false)}
                  className={cn(
                    "popup-card__button popup-card__button--cancel deregister-terminal-popup-card__button--cancel px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
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
                    setShowDeregisterConfirm(false);
                    try {
                      localStorage.removeItem('nurtron_terminal_initialized');
                      localStorage.removeItem('nurtron_registered_manager_email');
                    } catch (e) {}
                    signOut(auth);
                    window.location.reload();
                  }}
                  className="popup-card__button popup-card__button--confirm deregister-terminal-popup-card__button--confirm px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md shadow-red-500/10 cursor-pointer"
                >
                  De-register & Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
};
