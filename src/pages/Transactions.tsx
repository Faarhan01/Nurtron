import React from "react";
import {
  RefreshCw,
  RotateCcw,
  Search,
  Menu,
  CheckCircle,
  Eye,
  Printer,
  Trash2,
  Package,
  X,
  BarChart3,
  Wallet,
  Filter,
  ArrowLeft,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  User,
  Pencil,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  increment,
  setDoc,
  deleteDoc, } from "../lib/firebase";
import { db, auth } from "../lib/firebase";
import { format } from "date-fns";
import { serverTimestamp } from "../lib/firebase";
import {
  cn,
  formatCurrency,
  OperationType,
  handleFirestoreError,
  handleBackdropClick,
} from "../lib/utils";
import { UserRole } from "../types";
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

interface TransactionsProps {
  theme?: "dark" | "light";
  storeId?: string;
  currency?: string;
  permissions?: Record<string, boolean>;
  role?: UserRole;
  user: any;
  activeTab?: "presales" | "returns" | "expenditure" | "revenue" | "balances";
  setActiveTab?: (tab: "presales" | "returns" | "expenditure" | "revenue" | "balances") => void;
  managerEmail?: string;
}

let isFirstLoadOfSession = true;
let cachedPresales: any[] | null = null;
let cachedReturns: any[] | null = null;
let cachedTransactions: any[] | null = null;
let cachedExpenditures: any[] | null = null;
let cachedRevenue: any[] | null = null;
let cachedBalances: any[] | null = null;
let cachedCustomers: any[] | null = null;
let cachedProducts: any[] | null = null;

export const Transactions: React.FC<TransactionsProps> = ({
  theme = "dark",
  storeId = "STR-100100",
  currency = "USD",
  permissions = {},
  role = "Manager",
  user,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  managerEmail,
}) => {
  const [localActiveTab, setLocalActiveTab] = React.useState<
    "presales" | "returns" | "expenditure" | "revenue" | "balances"
  >("presales");

  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propSetActiveTab !== undefined ? propSetActiveTab : setLocalActiveTab;
  const txTabsRef = React.useRef<HTMLDivElement>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<
    "cash" | "card" | "upi" | "other"
  >("cash");
  const [presaleTenderedAmount, setPresaleTenderedAmount] =
    React.useState<string>("");
  const [presaleLastTendered, setPresaleLastTendered] = React.useState<
    number | null
  >(null);
  const [presaleLastChange, setPresaleLastChange] = React.useState<
    number | null
  >(null);
  const [returnFilter, setReturnFilter] = React.useState<
    "all" | "honored" | "returned"
  >("all");
  const [presales, setPresales] = React.useState<any[]>(cachedPresales || []);
  const [returnsList, setReturnsList] = React.useState<any[]>(cachedReturns || []);
  const [transactions, setTransactions] = React.useState<any[]>(cachedTransactions || []);
  const [expenditures, setExpenditures] = React.useState<any[]>(cachedExpenditures || []);
  const [revenue, setRevenue] = React.useState<any[]>(cachedRevenue || []);
  const [balances, setBalances] = React.useState<any[]>(cachedBalances || []);
  const [returnSearchQuery, setReturnSearchQuery] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);


  const [quickFilter, setQuickFilter] = React.useState<
    "all" | "today" | "week" | "high" | "pending"
  >("all");
  const [sortBy, setSortBy] = React.useState<
    "latest" | "oldest" | "amount-desc" | "amount-asc"
  >("latest");

  const matchesQuickFilter = React.useCallback(
    (dateStr: string, amount: number, status?: string) => {
      if (quickFilter === "all") return true;
      if (!dateStr) return false;
      const date = new Date(dateStr);
      const now = new Date();

      if (quickFilter === "today") {
        return date.toDateString() === now.toDateString();
      }
      if (quickFilter === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= oneWeekAgo;
      }
      if (quickFilter === "high") {
        return amount >= 500;
      }
      if (quickFilter === "pending") {
        return status?.toLowerCase() === "pending";
      }
      return true;
    },
    [quickFilter],
  );
  const [presaleMenuAnchor, setPresaleMenuAnchor] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [confirmActionItem, setConfirmActionItem] = React.useState<{
    id: string;
    type: 'void_presale' | 'delete_expenditure' | 'delete_revenue' | 'delete_balance';
    title: string;
    subtitle: string;
    message: string;
  } | null>(null);
  const [returnMenuAnchor, setReturnMenuAnchor] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [expenditureMenuAnchor, setExpenditureMenuAnchor] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [revenueMenuAnchor, setRevenueMenuAnchor] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [viewingExpenditure, setViewingExpenditure] = React.useState<any | null>(null);
  const [viewingRevenue, setViewingRevenue] = React.useState<any | null>(null);
  const [balancesMenuAnchor, setBalancesMenuAnchor] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [viewingBalance, setViewingBalance] = React.useState<any | null>(null);
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = React.useState(false);
  const [editEntryId, setEditEntryId] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editCategory, setEditCategory] = React.useState("Operational");
  const [editAmount, setEditAmount] = React.useState("");
  const [editDate, setEditDate] = React.useState("");
  const [editEntryTab, setEditEntryTab] = React.useState<"expenditure" | "revenue" | "balances">("expenditure");
  const [viewingPresale, setViewingPresale] = React.useState<any | null>(null);
  const [selectedPresale, setSelectedPresale] = React.useState<any | null>(null);
  const [viewingTransaction, setViewingTransaction] = React.useState<
    any | null
  >(null);
  const [initiatingPresale, setInitiatingPresale] = React.useState<any | null>(
    null,
  );
  const [loading, setLoading] = React.useState(isFirstLoadOfSession && !cachedPresales);
  const [finalizationSuccess, setFinalizationSuccess] = React.useState<
    any | null
  >(null);
  const [selectedTransactionForReturn, setSelectedTransactionForReturn] =
    React.useState<any | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = React.useState(false);
  const [returnError, setReturnError] = React.useState<string | null>(null);
  const [returnItems, setReturnItems] = React.useState<
    Record<string, { selected: boolean; quantity: number }>
  >({});
  const [customers, setCustomers] = React.useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = React.useState<any | null>(
    null,
  );
  const [customerCodeInput, setCustomerCodeInput] = React.useState("");
  const [products, setProducts] = React.useState<any[]>([]);
  const [editingPresale, setEditingPresale] = React.useState<any | null>(null);
  const [editPresaleSearchQuery, setEditPresaleSearchQuery] =
    React.useState("");
  const [storeInfo, setStoreInfo] = React.useState<any>({
    name: "megapos",
    registrationNumber: "",
    vatNumber: "",
    streetNumber: "",
    streetName: "",
    suburb: "",
    phoneNumber: "",
    website: "",
    paperType: "thermal",
    receiptFooterMessage: "THANK YOU FOR YOUR PATRONAGE",
  });

  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = React.useState(false);
  const [addDescription, setAddDescription] = React.useState("");
  const [addCategory, setAddCategory] = React.useState("Operational");
  const [addAmount, setAddAmount] = React.useState("");
  const [addDate, setAddDate] = React.useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [addAccountType, setAddAccountType] = React.useState<"store" | "customer">("store");
  const [addSelectedCustomerId, setAddSelectedCustomerId] = React.useState<string>("");

  const labelClassName = cn(
    "text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] block text-left mb-2 font-sans",
    theme === "dark" ? "text-white" : "text-black",
  );

  const inputClassName = cn(
    "w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none transition-all font-sans block",
    theme === "dark"
      ? "bg-black border-white/30 text-white placeholder-zinc-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20"
      : "bg-white border-slate-400 text-light-text placeholder-gray-400 focus:border-[#062A95] focus:ring-1 focus:ring-[#062A95]/20",
  );

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
        isPulse && "animate-pulse scale-110",
      )} />
    );
  };

  const renderInputWithDot = (inputElement: React.ReactNode, value: any, maxLength?: number, isSelect: boolean = false) => {
    return (
      <div className="relative w-full flex items-center">
        {React.isValidElement(inputElement) ? React.cloneElement(inputElement as React.ReactElement<any>, {
          className: cn((inputElement as React.ReactElement<any>).props?.className, isSelect ? "pr-10" : "pr-8"),
        }) : inputElement}
        {renderInputDot(value, maxLength, isSelect ? "right-8" : "right-3.5")}
      </div>
    );
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDescription || !addAmount || !user) return;
    try {
      const amountNum = parseFloat(addAmount);
      if (isNaN(amountNum)) return;

      if (activeTab === "expenditure") {
        const id = `exp-${Date.now()}`;
        await setDoc(doc(db, "expenditures", id), {
          id,
          description: addDescription,
          category: addCategory || "Operational",
          amount: amountNum,
          date: new Date(addDate).toISOString(),
          createdAt: serverTimestamp(),
        });
      } else if (activeTab === "revenue") {
        const id = `rev-${Date.now()}`;
        await setDoc(doc(db, "revenue", id), {
          id,
          source: addDescription,
          amount: amountNum,
          date: new Date(addDate).toISOString(),
          createdAt: serverTimestamp(),
        });
      } else if (activeTab === "balances") {
        const id = `bal-${Date.now()}`;
        const payload: any = {
          id,
          description: addDescription,
          amount: amountNum,
          date: new Date(addDate).toISOString(),
          createdAt: serverTimestamp(),
        };
        if (addAccountType === "customer") {
          const selectedCust = customers.find((c) => c.id === addSelectedCustomerId);
          payload.customerId = selectedCust ? selectedCust.id : "";
          payload.customerName = selectedCust ? selectedCust.name : "";
          payload.type = "customer_balance";

          if (selectedCust) {
            const custRef = doc(db, "customers", selectedCust.id);
            await updateDoc(custRef, {
              accountBalance: increment(amountNum)
            });
          }
        } else {
          payload.type = "store_balance";
        }
        await setDoc(doc(db, "balances", id), payload);
      }

      setIsAddEntryModalOpen(false);
      setAddDescription("");
      setAddAmount("");
      setAddCategory("Operational");
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDescription || !editAmount || !user || !editEntryId) return;
    setLoading(true);
    try {
      const amountNum = parseFloat(editAmount);
      if (isNaN(amountNum)) return;

      if (editEntryTab === "expenditure") {
        const ref = doc(db, "expenditures", editEntryId);
        await updateDoc(ref, {
          description: editDescription,
          category: editCategory || "Operational",
          amount: amountNum,
          date: new Date(editDate).toISOString(),
        });
      } else if (editEntryTab === "revenue") {
        const ref = doc(db, "revenue", editEntryId);
        await updateDoc(ref, {
          source: editDescription,
          amount: amountNum,
          date: new Date(editDate).toISOString(),
        });
      } else if (editEntryTab === "balances") {
        const ref = doc(db, "balances", editEntryId);
        const oldSnap = await getDoc(ref);
        if (oldSnap.exists()) {
          const oldData = oldSnap.data();
          if (oldData.type === "customer_balance" && oldData.customerId) {
            const diff = amountNum - (oldData.amount || 0);
            if (diff !== 0) {
              const custRef = doc(db, "customers", oldData.customerId);
              await updateDoc(custRef, {
                accountBalance: increment(diff)
              });
            }
          }
        }
        await updateDoc(ref, {
          description: editDescription,
          amount: amountNum,
          date: new Date(editDate).toISOString(),
        });
      }

      setIsEditEntryModalOpen(false);
      setEditEntryId("");
      setEditDescription("");
      setEditAmount("");
      setEditCategory("Operational");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: string, tab: "expenditure" | "revenue" | "balances") => {
    if (!user) return;
    try {
      const collectionName = tab === "expenditure" ? "expenditures" : tab === "revenue" ? "revenue" : "balances";
      const docRef = doc(db, collectionName, id);

      if (tab === "balances") {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.type === "customer_balance" && data.customerId) {
            const custRef = doc(db, "customers", data.customerId);
            await updateDoc(custRef, {
              accountBalance: increment(-(data.amount || 0))
            });
          }
        }
      }

      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting entry:", err);
    }
  };

  const voidPresale = async (id: string) => {
    try {
      await updateDoc(doc(db, "presales", id), { status: "Voided" });
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    if (initiatingPresale) {
      setSelectedPaymentMethod("cash");
      setPresaleTenderedAmount("");
      setSelectedCustomer(null);
      setCustomerCodeInput("");
    }
  }, [initiatingPresale]);

  React.useEffect(() => {
    if (!user) return;
    const activeManagerEmail = (managerEmail || localStorage.getItem('nurtron_registered_manager_email') || user?.email || 'admin@megapos.pos').toLowerCase().trim();

    if (isFirstLoadOfSession && !cachedPresales) {
      setLoading(true);
    }
    const unsubPresales = onSnapshot(collection(db, "presales"), (snapshot) => {
      const fetchedPresales = snapshot.docs.map((doc) => {
        const data = doc.data();
        let timeStr = "Just now";
        try {
          if (data.timestamp) {
            if (typeof data.timestamp.toDate === "function") {
              timeStr = format(data.timestamp.toDate(), "HH:mm:ss");
            } else if (data.timestamp instanceof Date) {
              timeStr = format(data.timestamp, "HH:mm:ss");
            } else if (typeof data.timestamp === "string") {
              timeStr = format(new Date(data.timestamp), "HH:mm:ss");
            } else if (data.timestamp.seconds) {
              timeStr = format(
                new Date(data.timestamp.seconds * 1000),
                "HH:mm:ss",
              );
            }
          }
        } catch (e) {
          console.warn("Error parsing presale timestamp:", e);
        }
        return {
          id: doc.id,
          ...data,
          time: timeStr,
        } as any;
      }).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setPresales(fetchedPresales);
      cachedPresales = fetchedPresales;
      setLoading(false);
      isFirstLoadOfSession = false;
    });
    const unsubReturns = onSnapshot(collection(db, "returns"), (snapshot) => {
      const fetchedReturns = snapshot.docs.map((doc) => {
        const data = doc.data();
        let timeStr = "Just now";
        try {
          if (data.timestamp) {
            if (typeof data.timestamp.toDate === "function") {
              timeStr = format(data.timestamp.toDate(), "yyyy-MM-dd HH:mm");
            } else if (data.timestamp instanceof Date) {
              timeStr = format(data.timestamp, "yyyy-MM-dd HH:mm");
            } else if (typeof data.timestamp === "string") {
              timeStr = format(new Date(data.timestamp), "yyyy-MM-dd HH:mm");
            } else if (data.timestamp.seconds) {
              timeStr = format(
                new Date(data.timestamp.seconds * 1000),
                "yyyy-MM-dd HH:mm",
              );
            }
          }
        } catch (e) {
          console.warn("Error parsing return timestamp:", e);
        }
        return {
          id: doc.id,
          ...data,
          time: timeStr,
        } as any;
      }).filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setReturnsList(fetchedReturns);
      cachedReturns = fetchedReturns;
    });

    const unsubTransactions = onSnapshot(
      collection(db, "transactions"),
      (snapshot) => {
        const fetchedTx = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail)
          .slice(0, 50);
        setTransactions(fetchedTx);
        cachedTransactions = fetchedTx;
      },
    );

    const unsubExpenditures = onSnapshot(
      collection(db, "expenditures"),
      (snapshot) => {
        const fetchedExpenditures = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
        setExpenditures(fetchedExpenditures);
        cachedExpenditures = fetchedExpenditures;
      },
    );

    const unsubRevenue = onSnapshot(collection(db, "revenue"), (snapshot) => {
      const fetchedRevenue = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setRevenue(fetchedRevenue);
      cachedRevenue = fetchedRevenue;
    });

    const unsubBalances = onSnapshot(collection(db, "balances"), (snapshot) => {
      const fetchedBalances = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
      setBalances(fetchedBalances);
      cachedBalances = fetchedBalances;
    });

    const unsubCustomers = onSnapshot(
      collection(db, "customers"),
      (snapshot) => {
        const fetchedCustomers = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item: any) => !item.managerEmail || item.managerEmail.toLowerCase().trim() === activeManagerEmail);
        setCustomers(fetchedCustomers);
        cachedCustomers = fetchedCustomers;
      },
    );

    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const fetchedProducts = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item: any) => {
          if (item.managerEmail) return item.managerEmail.toLowerCase().trim() === activeManagerEmail;
          if (item.ownerEmail) return item.ownerEmail.toLowerCase().trim() === activeManagerEmail;
          return activeManagerEmail === 'admin@megapos.pos' || activeManagerEmail === 'faarhanch@gmail.com';
        });
      setProducts(fetchedProducts);
      cachedProducts = fetchedProducts;
    });

    const unsubSettings = onSnapshot(
      doc(db, "settings", storeId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreInfo({
            name: data.storeName || "megapos",
            registrationNumber: data.registrationNumber || "",
            vatNumber: data.vatNumber || "",
            streetNumber: data.streetNumber || "",
            streetName: data.streetName || "",
            suburb: data.suburb || "",
            phoneNumber: data.phoneNumber || "",
            website: data.website || "",
            paperType: data.paperType || "thermal",
            receiptFooterMessage:
              data.receiptFooterMessage || "THANK YOU FOR YOUR PATRONAGE",
          });
        }
      },
    );

    return () => {
      unsubPresales();
      unsubReturns();
      unsubTransactions();
      unsubExpenditures();
      unsubRevenue();
      unsubBalances();
      unsubCustomers();
      unsubProducts();
      unsubSettings();
    };
  }, [user, storeId]);

  const searchTransactions = async (query: string) => {
    if (!query) return;
    const unsub = onSnapshot(collection(db, "transactions"), (snapshot) => {
      const all = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as any,
      );
      const results = all.filter(
        (tx) =>
          tx.id.toLowerCase().includes(query.toLowerCase()) ||
          (tx.customerName &&
            tx.customerName.toLowerCase().includes(query.toLowerCase())),
      );
      setTransactions(results);
    });
    return unsub;
  };

  const handleUpdatePresale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPresale || !user) return;
    setLoading(true);
    try {
      const psRef = doc(db, "presales", editingPresale.id);
      await updateDoc(psRef, {
        operator: editingPresale.operator || editingPresale.op || "",
        amount: Number(editingPresale.amount),
        status: editingPresale.status,
        items: editingPresale.items || [],
      });
      setEditingPresale(null);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `presales/${editingPresale.id}`,
        auth,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePresale = async (presale: any) => {
    if (!user) return;
    setLoading(true);
    try {
      const transactionId = `TX-${Date.now()}`;
      const items = presale.items || [];

      // 1. Create standard cashier transaction
      const sanitizedItems = items.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        category: item.category || "General",
        stockLevel: item.stockLevel ?? 0,
        costPrice: item.costPrice ?? 0,
        barcode: item.barcode || "",
        sku: item.sku || "",
      }));

      const isCash = selectedPaymentMethod === "cash";
      const tenderedVal =
        isCash && presaleTenderedAmount
          ? parseFloat(presaleTenderedAmount)
          : null;
      const changeVal =
        isCash && tenderedVal
          ? Math.max(0, tenderedVal - presale.amount)
          : null;

      if (isCash && tenderedVal !== null) {
        setPresaleLastTendered(tenderedVal);
        setPresaleLastChange(changeVal);
      } else {
        setPresaleLastTendered(null);
        setPresaleLastChange(null);
      }

      const transactionPayload: any = {
        id: transactionId,
        items: sanitizedItems,
        subtotal: presale.amount,
        markupAmount: 0,
        discountAmount: 0,
        totalAmount: presale.amount,
        tax: 0,
        paymentMethod: selectedPaymentMethod,
        status: "completed",
        timestamp: serverTimestamp(),
        cashierId: user.uid,
        tenderedAmount: tenderedVal,
        changeAmount: changeVal,
      };

      if (selectedCustomer) {
        transactionPayload.customerId = selectedCustomer.id;
        transactionPayload.customerName = selectedCustomer.name;
        transactionPayload.customerCode = selectedCustomer.customerId || null;
      }

      await setDoc(doc(db, "transactions", transactionId), transactionPayload);

      // Update customer spent in Firestore
      if (selectedCustomer) {
        const custRef = doc(db, "customers", selectedCustomer.id);
        await updateDoc(custRef, {
          totalSpent: increment(presale.amount),
        });
      }

      // 2. Decrement stock levels of the items
      for (const item of items) {
        if (item.id) {
          const prodRef = doc(db, "products", item.id);
          try {
            await updateDoc(prodRef, {
              stockLevel: increment(-item.quantity),
            });
          } catch (err) {
            console.error(`Error updating stock for product ${item.id}`, err);
          }
        }
      }

      // 3. Mark the presale as Approved
      await updateDoc(doc(db, "presales", presale.id), {
        status: "Approved",
        approvedAt: new Date().toISOString(),
        approvedBy: user.uid,
      });

      // Show finalization success options screen!
      setFinalizationSuccess({
        id: transactionId,
        amount: presale.amount,
        operator: presale.operator || presale.op || "Terminal Staff",
        items: items,
      });

      setInitiatingPresale(null);
      setSelectedCustomer(null);
      setCustomerCodeInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generatePresaleReceiptPDF = (presaleOrTx: any) => {
    try {
      if (storeInfo.paperType === "a4") {
        const doc = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const repName =
          presaleOrTx.operator || user?.displayName || "Terminal Staff";
        const address = [
          storeInfo.streetNumber,
          storeInfo.streetName,
          storeInfo.suburb,
        ]
          .filter(Boolean)
          .join(" ");

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
        doc.text("TAX INVOICE / RECEIPT", 195, 20, { align: "right" });

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`DOCUMENT ID: ${presaleOrTx.id}`, 195, 25, { align: "right" });
        doc.text(
          `DATE / TIME: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
          195,
          29,
          { align: "right" },
        );
        doc.text(`OPERATOR: ${repName.toUpperCase()}`, 195, 33, {
          align: "right",
        });

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
        if (presaleOrTx.customerName) {
          doc.text(presaleOrTx.customerName.toUpperCase(), 15, 57);
          doc.text(
            `CUSTOMER ID/CODE: ${presaleOrTx.customerCode || "N/A"}`,
            15,
            61.5,
          );
        } else {
          doc.text("WALK-IN CLIENT / RETAIL CASH CUSTOMER", 15, 57);
        }

        doc.line(15, 68, 195, 68);

        // Draw items table
        doc.setFillColor(248, 250, 252);
        doc.rect(15, 73, 180, 8, "F");
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

        const items = presaleOrTx.items || [];
        items.forEach((item: any, index: number) => {
          doc.setFont("helvetica", "normal");
          const displayName = (item.name || "Product").toUpperCase();
          const dbProduct = products.find(
            (p) => p.id === item.id || p.id === item.id?.split("-")[0],
          );
          const barcodeVal =
            item.barcode ||
            item.sku ||
            dbProduct?.barcode ||
            dbProduct?.sku ||
            "N/A";

          doc.text(String(index + 1), 18, y);
          doc.text(displayName.substring(0, 36), 28, y);
          doc.text(String(barcodeVal), 100, y);
          doc.text(formatCurrency(item.price || 0, currency), 135, y);
          doc.text(String(item.quantity), 158, y);
          doc.text(
            formatCurrency((item.price || 0) * item.quantity, currency),
            180,
            y,
          );

          doc.setDrawColor(241, 245, 249);
          doc.line(15, y + 2.5, 195, y + 2.5);
          y += 7.5;

          if (y > 240) {
            doc.addPage();
            doc.setFillColor(248, 250, 252);
            doc.rect(15, 15, 180, 8, "F");
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

        // Totals Calculations
        const subtotalVal = items.reduce(
          (acc: number, item: any) => acc + (item.price || 0) * item.quantity,
          0,
        );
        const grandTotalVal =
          presaleOrTx.amount || presaleOrTx.totalAmount || 0;
        const discountVal = Math.max(0, subtotalVal - grandTotalVal);

        doc.setDrawColor(226, 232, 240);
        doc.line(15, y, 195, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        doc.text("SUBTOTAL:", 145, y);
        doc.text(formatCurrency(subtotalVal, currency), 195, y, {
          align: "right",
        });
        y += 4.5;

        doc.text("TOTAL DISCOUNT:", 145, y);
        doc.text(`-${formatCurrency(discountVal, currency)}`, 195, y, {
          align: "right",
        });
        y += 5.5;

        doc.setDrawColor(148, 163, 184);
        doc.line(140, y - 1.5, 195, y - 1.5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text("GRAND TOTAL:", 145, y + 1);
        doc.text(formatCurrency(grandTotalVal, currency), 195, y + 1, {
          align: "right",
        });
        y += 7.5;

        const tendered =
          presaleOrTx.tenderedAmount !== undefined
            ? presaleOrTx.tenderedAmount
            : presaleLastTendered;
        const change =
          presaleOrTx.changeAmount !== undefined
            ? presaleOrTx.changeAmount
            : presaleLastChange;

        if (tendered !== null && tendered !== undefined) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text("CASH TENDERED:", 145, y);
          doc.text(formatCurrency(tendered, currency), 195, y, {
            align: "right",
          });
          y += 4.5;
          doc.text("CHANGE:", 145, y);
          doc.text(formatCurrency(change ?? 0, currency), 195, y, {
            align: "right",
          });
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
          const canvas = document.createElement("canvas");
          JsBarcode(canvas, presaleOrTx.id, {
            format: "CODE128",
            width: 1.8,
            height: 45,
            displayValue: false,
          });
          const imgData = canvas.toDataURL("image/png");
          doc.addImage(imgData, "PNG", 85, 258, 40, 11);
        } catch (e) {
          console.error(e);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text(presaleOrTx.id, 105, 273, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`STATUS: COMPLETED (PRESALE FINALIZED)`, 105, 279, {
          align: "center",
        });
        doc.setFont("helvetica", "");
        doc.setTextColor(100, 116, 139);
        doc.text(
          storeInfo.receiptFooterMessage || "THANK YOU FOR YOUR PATRONAGE",
          105,
          284,
          { align: "center" },
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text("POWERED BY MEGAPOS", 105, 289, { align: "center" });

        const blob = doc.output("bloburl");
        window.open(blob, "_blank");
        return;
      }

      const doc = new jsPDF({
        unit: "mm",
        format: [80, 220],
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(storeInfo.name.toUpperCase(), pageWidth / 2, y, {
        align: "center",
      });
      y += 5;

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const address = [
        storeInfo.streetNumber,
        storeInfo.streetName,
        storeInfo.suburb,
      ]
        .filter(Boolean)
        .join(" ");
      if (address) {
        doc.text(address.toUpperCase(), pageWidth / 2, y, { align: "center" });
        y += 4;
      }
      if (storeInfo.registrationNumber) {
        doc.text(`REG NO: ${storeInfo.registrationNumber}`, pageWidth / 2, y, {
          align: "center",
        });
        y += 4;
      }
      if (storeInfo.vatNumber) {
        doc.text(`TAX NO: ${storeInfo.vatNumber}`, pageWidth / 2, y, {
          align: "center",
        });
        y += 4;
      }
      if (storeInfo.phoneNumber) {
        doc.text(`PH: ${storeInfo.phoneNumber}`, pageWidth / 2, y, {
          align: "center",
        });
        y += 4;
      }
      if (storeInfo.website) {
        doc.text(storeInfo.website.toLowerCase(), pageWidth / 2, y, {
          align: "center",
        });
        y += 4;
      }

      y += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("TAX INVOICE / RECEIPT", pageWidth / 2, y, { align: "center" });
      y += 6;

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const repName =
        presaleOrTx.operator || user?.displayName || "Terminal Staff";
      doc.text(`REP: ${repName.toUpperCase()}`, 10, y);
      doc.text(`ID: ${presaleOrTx.id}`, pageWidth - 10, y, { align: "right" });
      y += 4;
      doc.text(`DATE: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`, 10, y);
      y += 8;

      // Full Cash Sale Receipt
      doc.setFont("helvetica", "bold");
      doc.text("ITEM", 10, y);
      doc.text("TOTAL", pageWidth - 10, y, { align: "right" });

      doc.line(10, y + 1, pageWidth - 10, y + 1);
      y += 6;

      doc.setFont("helvetica", "normal");
      const items = presaleOrTx.items || [];
      items.forEach((item: any) => {
        // Line 1: Name, Total
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        const displayName = (item.name || "Product")
          .toUpperCase()
          .substring(0, 36);
        doc.text(displayName, 10, y);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(
          formatCurrency((item.price || 0) * item.quantity, currency),
          pageWidth - 10,
          y,
          { align: "right" },
        );

        // Line 2: Barcode & Unit Price & Qty
        y += 4;
        const dbProduct = products.find(
          (p) => p.id === item.id || p.id === item.id?.split("-")[0],
        );
        const barcodeVal =
          item.barcode ||
          item.sku ||
          dbProduct?.barcode ||
          dbProduct?.sku ||
          "N/A";
        doc.setFontSize(6);
        doc.setFont("helvetica", "");
        doc.text(
          `${barcodeVal}  |  @ ${formatCurrency(item.price || 0, currency)}  x ${item.quantity}`,
          10,
          y,
        );

        y += 5.5; // Spacing to next item

        if (y > 195) {
          doc.addPage();
          y = 15;
        }
      });

      doc.line(10, y, pageWidth - 10, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);

      const subtotalVal = items.reduce(
        (acc: number, item: any) => acc + (item.price || 0) * item.quantity,
        0,
      );
      const grandTotalVal = presaleOrTx.amount || presaleOrTx.totalAmount || 0;
      const discountVal = Math.max(0, subtotalVal - grandTotalVal);

      doc.text("SUBTOTAL:", 10, y);
      doc.text(formatCurrency(subtotalVal, currency), pageWidth - 10, y, {
        align: "right",
      });
      y += 4.5;

      doc.text("TOTAL DISCOUNT:", 10, y);
      doc.text(`-${formatCurrency(discountVal, currency)}`, pageWidth - 10, y, {
        align: "right",
      });
      y += 5;

      // Clearly separate Grand Total from other previous amounts with a line and spacing
      doc.line(10, y, pageWidth - 10, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("GRAND TOTAL:", 10, y);
      doc.text(formatCurrency(grandTotalVal, currency), pageWidth - 10, y, {
        align: "right",
      });
      y += 8;

      const tendered =
        presaleOrTx.tenderedAmount !== undefined
          ? presaleOrTx.tenderedAmount
          : presaleLastTendered;
      const change =
        presaleOrTx.changeAmount !== undefined
          ? presaleOrTx.changeAmount
          : presaleLastChange;

      if (tendered !== null && tendered !== undefined) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("CASH TENDERED:", 10, y);
        doc.text(formatCurrency(tendered, currency), pageWidth - 10, y, {
          align: "right",
        });
        y += 4;
        doc.text("CHANGE:", 10, y);
        doc.text(formatCurrency(change ?? 0, currency), pageWidth - 10, y, {
          align: "right",
        });
        y += 6;
      } else {
        y += 10;
      }

      // Barcode Generation using jsbarcode
      try {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, presaleOrTx.id, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: false,
        });
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", (pageWidth - 50) / 2, y, 50, 15);
        y += 18;
      } catch (e) {
        console.error("Barcode generation failed", e);
        // Fallback to text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.text(`*${presaleOrTx.id.replace(/-/g, "")}*`, pageWidth / 2, y, {
          align: "center",
          charSpace: 2,
        });
        y += 5;
      }

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`STATUS: COMPLETED (PRESALE FINALIZED)`, pageWidth / 2, y, {
        align: "center",
      });
      y += 4;
      doc.setFont("helvetica", "");
      doc.text(
        storeInfo.receiptFooterMessage || "THANK YOU FOR YOUR PATRONAGE",
        pageWidth / 2,
        y,
        { align: "center" },
      );
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("POWERED BY MEGAPOS", pageWidth / 2, y, { align: "center" });
      y += 5;

      const blob = doc.output("bloburl");
      window.open(blob, "_blank");
    } catch (e) {
      console.error(e);
    }
  };

  const [returnReason, setReturnReason] = React.useState("");

  const handleReturn = async () => {
    if (!selectedTransactionForReturn || !user) return;
    try {
      const returnId = `RET-${Date.now()}`;
      const selectedItems = selectedTransactionForReturn.items.filter(
        (item: any) => returnItems[item.id]?.selected,
      );

      if (selectedItems.length === 0) {
        alert("Please select items to return");
        return;
      }

      const totalReturn = selectedItems.reduce(
        (acc: number, item: any) =>
          acc + item.price * returnItems[item.id].quantity,
        0,
      );

      await setDoc(doc(db, "returns", returnId), {
        id: returnId,
        originalTransactionId: selectedTransactionForReturn.id,
        items: selectedItems.map((item: any) => ({
          ...item,
          quantity: returnItems[item.id].quantity,
        })),
        totalAmount: totalReturn,
        reason: returnReason,
        timestamp: serverTimestamp(),
        processedBy: user.uid,
      });

      // Update product stocks
      for (const item of selectedItems) {
        const prodRef = doc(db, "products", item.id);
        await updateDoc(prodRef, {
          stockLevel: increment(returnItems[item.id].quantity),
        });
      }

      // Update linked customer account balance/spent if applicable
      if (selectedTransactionForReturn.customerId) {
        try {
          const custRef = doc(db, "customers", selectedTransactionForReturn.customerId);
          const custUpdates: any = {
            totalSpent: increment(-totalReturn),
          };
          if (selectedTransactionForReturn.chargedToCredit) {
            custUpdates.accountBalance = increment(totalReturn);
          }
          await updateDoc(custRef, custUpdates);
        } catch (custErr) {
          console.error("Error updating customer account on return:", custErr);
        }
      }

      setIsReturnModalOpen(false);
      setSelectedTransactionForReturn(null);
      setReturnReason("");
      setReturnItems({});
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = () => {
      setPresaleMenuAnchor(null);
      setReturnMenuAnchor(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const returnedTransactionIds = React.useMemo(() => {
    return new Set(returnsList.map((r) => r.originalTransactionId));
  }, [returnsList]);

  const getSortValue = (item: any): number => {
    return item.amount || item.totalAmount || item.val || 0;
  };

  const getTimestampMs = (item: any): number => {
    if (!item) return 0;
    const ts = item.timestamp || item.createdAt || item.date;
    if (!ts) return 0;
    if (typeof ts.toDate === "function") {
      return ts.toDate().getTime();
    }
    if (ts instanceof Date) {
      return ts.getTime();
    }
    if (typeof ts === "string") {
      return new Date(ts).getTime();
    }
    if (typeof ts === "number") {
      return ts;
    }
    if (ts.seconds) {
      return (
        ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1000000 : 0)
      );
    }
    return 0;
  };

  const sortItemsList = React.useCallback(
    <T extends any>(items: T[]): T[] => {
      return [...items].sort((a, b) => {
        if (sortBy === "latest") {
          return getTimestampMs(b) - getTimestampMs(a);
        }
        if (sortBy === "oldest") {
          return getTimestampMs(a) - getTimestampMs(b);
        }
        if (sortBy === "amount-desc") {
          return getSortValue(b) - getSortValue(a);
        }
        if (sortBy === "amount-asc") {
          return getSortValue(a) - getSortValue(b);
        }
        return 0;
      });
    },
    [sortBy],
  );

  const filteredPresales = React.useMemo(() => {
    const list = presales.filter(
      (p) => {
        const matchesSearch =
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.operator &&
            p.operator.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.op && p.op.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
        return matchesQuickFilter(p.createdAt || p.date, p.amount, p.status);
      }
    );
    return sortItemsList(list);
  }, [presales, searchQuery, sortItemsList, matchesQuickFilter]);

  const filteredExpenditures = React.useMemo(() => {
    const list = expenditures.filter(
      (e) => {
        const matchesSearch =
          (e.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.category || "").toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        return matchesQuickFilter(e.date, e.amount);
      }
    );
    return sortItemsList(list);
  }, [expenditures, searchQuery, sortItemsList, matchesQuickFilter]);

  const filteredRevenue = React.useMemo(() => {
    const list = revenue.filter(
      (r) => {
        const matchesSearch =
          (r.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.source || "").toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        return matchesQuickFilter(r.date, r.amount);
      }
    );
    return sortItemsList(list);
  }, [revenue, searchQuery, sortItemsList, matchesQuickFilter]);

  const filteredBalances = React.useMemo(() => {
    const list = balances.filter(
      (b) => {
        const matchesSearch =
          b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.description.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        return matchesQuickFilter(b.date || b.timestamp, b.amount || b.netChange);
      }
    );
    return sortItemsList(list);
  }, [balances, searchQuery, sortItemsList, matchesQuickFilter]);

  const filteredTransactions = React.useMemo(() => {
    const list = transactions.filter((tx) => {
      const matchesSearch =
        tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.customerName &&
          tx.customerName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === "returns") {
        const isReturned = returnedTransactionIds.has(tx.id);
        if (returnFilter === "honored") return !isReturned;
        if (returnFilter === "returned") return isReturned;
      } else {
        return matchesQuickFilter(tx.date || tx.timestamp, tx.amount || tx.total);
      }

      return true;
    });
    return sortItemsList(list);
  }, [
    transactions,
    searchQuery,
    activeTab,
    returnFilter,
    returnedTransactionIds,
    sortItemsList,
    matchesQuickFilter,
  ]);

  return (
    <div
      className={cn(
        "transactions-page font-presale min-h-full flex flex-col transition-colors duration-500 relative",
        theme === "dark"
          ? "bg-dark-bg text-dark-text"
          : "bg-light-bg text-light-text",
      )}
    >
      {/* BLOCK: Transactions Header Bar - Consolidates page name, active tabs, and search/filter actions */}
      <div className="pb-6 md:pb-8">
        {loading && isFirstLoadOfSession ? (
          <div className="p-20 flex justify-center">
            <RefreshCw className="animate-spin text-brand-primary animate-pulse" size={32} />
          </div>
        ) : (
          <div className={cn("px-4 pb-4 pt-0 md:px-10 md:pb-10 md:pt-0", isFirstLoadOfSession ? "animate-in fade-in slide-in-from-bottom-4 duration-700" : "")}>
            <div className="w-full max-w-[1600px] mx-auto transition-all duration-300 ease-in-out font-presale">
          {/* BLOCK: Transactions Floating Control Row - Manages the layout of tabs and search controls */}
          <div className="tx-controls-layout flex flex-col xl:flex-row items-center justify-between gap-3 sm:gap-4 mb-8 transition-all duration-300 ease-in-out">
            
            {/* BLOCK: Tabs Floating Bar Card - Holds navigation tabs for transactions stream selection */}
            <div className={cn(
              "tx-tabs-card flex flex-row items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full xl:w-1/2 xl:flex-1 min-w-0 shrink-0 backdrop-blur-xl relative overflow-hidden",
              theme === 'dark' 
                ? "tx-tabs-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "tx-tabs-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              {/* Left scroll arrow button */}
              <button
                type="button"
                onClick={() => txTabsRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                className={cn(
                  "tx-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/15"
                    : "bg-slate-100 border-slate-200 text-slate-600 hover:text-black hover:bg-slate-200"
                )}
                title="Scroll tabs left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} className="shrink-0" />
              </button>

              {/* Element: Navigation Tabs Selector */}
              <div ref={txTabsRef} className="tx-tabs-card__list flex items-center justify-start flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto scroll-smooth no-scrollbar w-full py-0.5 my-auto">
                {[
                  { id: "presales", label: "PRESALE STREAM", icon: RefreshCw },
                  { id: "returns", label: "RETURNS PORTAL", icon: RotateCcw },
                  { id: "expenditure", label: "EXPENDITURE", icon: Package },
                  { id: "revenue", label: "REVENUE", icon: BarChart3 },
                  { id: "balances", label: "BALANCES", icon: Wallet },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "tx-tabs-card__tab-btn h-10 px-3.5 sm:px-4 md:px-5 xl:px-6 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-200 whitespace-nowrap border flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 my-auto font-presale",
                      activeTab === tab.id
                        ? theme === "dark"
                          ? "tx-tabs-card__tab-btn--active bg-brand-primary border-brand-primary text-black shadow-md shadow-cyan-500/20"
                          : "tx-tabs-card__tab-btn--active bg-[#062A95] border-[#062A95] text-white shadow-md shadow-blue-900/20"
                        : theme === "dark"
                          ? "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                          : "border-transparent text-slate-600 hover:text-black hover:bg-slate-100",
                    )}
                  >
                    <tab.icon
                      size={15}
                      className={cn("transition-transform shrink-0 flex items-center justify-center my-auto", activeTab === tab.id ? "scale-110" : "opacity-75")}
                    />
                    <span className="flex items-center justify-center text-center my-auto leading-normal font-presale font-bold tracking-wide text-[11px] md:text-[12px] uppercase">
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right scroll arrow button */}
              <button
                type="button"
                onClick={() => txTabsRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                className={cn(
                  "tx-tabs-card__arrow-btn h-8 w-8 sm:h-9 sm:w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer z-10 my-auto",
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
              "tx-search-card flex flex-row items-center gap-2 sm:gap-3 lg:gap-4 p-1.5 sm:p-2 px-3 sm:px-4 rounded-2xl border transition-all duration-300 ease-in-out shadow-sm hover:shadow-md w-full xl:w-1/2 xl:flex-1 min-w-0 justify-between xl:justify-start backdrop-blur-xl",
              theme === 'dark' 
                ? "tx-search-card--dark bg-[#041235]/80 border-white/10 shadow-lg shadow-black/20" 
                : "tx-search-card--light bg-white/95 border-slate-200/90 shadow-sm"
            )}>
              {/* Element: Search Controls Bar */}
              <div className="tx-search-card__search-wrapper relative flex-1 min-w-0 my-auto">
                <Search
                  className="tx-search-card__search-icon absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none"
                  size={15}
                />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}, IDs...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "tx-search-card__search-input w-full h-10 border pl-10 sm:pl-12 pr-4 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest outline-none transition-colors duration-200 flex items-center",
                    theme === "dark"
                      ? "bg-[#041a5c]/80 border-[#123ebd] text-white placeholder-white/40 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                      : "bg-white border-slate-300 text-light-text placeholder-gray-400 focus:border-brand-primary-light focus:ring-1 focus:ring-brand-primary-light/20",
                  )}
                />
              </div>

              {/* Element: Advanced Filters Action Trigger */}
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "tx-search-card__filter-btn h-10 px-3.5 sm:px-4 border rounded-xl transition-colors duration-200 shrink-0 active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest my-auto",
                  theme === "dark"
                    ? isFilterOpen
                      ? "tx-search-card__filter-btn--active bg-brand-primary text-black border-brand-primary"
                      : "tx-search-card__filter-btn bg-[#041a5c]/80 text-white border-[#123ebd] hover:bg-[#062480] hover:border-brand-primary"
                    : isFilterOpen
                      ? "tx-search-card__filter-btn--active bg-black text-white border-black"
                      : "tx-search-card__filter-btn bg-white text-black border-slate-300 hover:bg-gray-100 hover:border-black",
                )}
              >
                <Filter size={15} className="shrink-0 my-auto" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest my-auto flex items-center justify-center">Filters</span>
              </button>

              {/* Element: Refresh Data Action Trigger */}
              <button
                onClick={() => {
                  setLoading(true);
                  setTimeout(() => setLoading(false), 700);
                }}
                className={cn(
                  "tx-search-card__refresh-btn h-10 w-10 p-0 border rounded-xl transition-colors duration-200 shrink-0 active:scale-95 cursor-pointer flex items-center justify-center text-[10px] sm:text-xs font-black uppercase tracking-widest my-auto",
                  theme === "dark"
                    ? "bg-[#041a5c]/80 text-white border-[#123ebd] hover:bg-[#062480] hover:border-brand-primary"
                    : "bg-white text-black border-slate-300 hover:bg-gray-100 hover:border-black",
                )}
              >
                <RefreshCw size={15} className={cn("my-auto", loading ? "animate-spin" : "")} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className={cn(
                  "p-4 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-4",
                  theme === "dark" 
                    ? "bg-black/30 border-white/30" 
                    : "bg-gray-50 border-slate-400 shadow-inner"
                )}>
                  {/* Quick Filters / Return Status */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-40 font-presale">
                      {activeTab === "returns" ? "Return Status" : "Quick Filters"}
                    </label>
                    {activeTab === "returns" ? (
                      <select
                        value={returnFilter}
                        onChange={(e) => setReturnFilter(e.target.value as any)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest outline-none transition-all h-[38px] cursor-pointer font-presale",
                          theme === "dark"
                            ? "bg-[#1E1E24] border-white/30 text-white focus:border-brand-primary"
                            : "bg-white border-slate-400 text-black focus:border-black",
                        )}
                      >
                        <option value="all">ALL RETURNS</option>
                        <option value="honored">HONORED RETURNS ONLY</option>
                        <option value="returned">RETURNED ASSETS ONLY</option>
                      </select>
                    ) : (
                      <select
                        value={quickFilter}
                        onChange={(e) => setQuickFilter(e.target.value as any)}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest outline-none transition-all h-[38px] cursor-pointer font-presale",
                          theme === "dark"
                            ? "bg-[#1E1E24] border-white/30 text-white focus:border-brand-primary"
                            : "bg-white border-slate-400 text-black focus:border-black",
                        )}
                      >
                        <option value="all">ALL ENTRIES / TRANSFERS</option>
                        <option value="today">TODAY ONLY</option>
                        <option value="week">THIS WEEK SURPLUS</option>
                        <option value="high">HIGH VALUE ONLY</option>
                        {activeTab === "presales" && <option value="pending">PENDING ONLY</option>}
                      </select>
                    )}
                  </div>

                  {/* Sequence Matrix */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-40 font-presale">
                      Sequence Matrix
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest outline-none transition-all h-[38px] cursor-pointer font-presale",
                        theme === "dark"
                          ? "bg-[#1E1E24] border-white/30 text-white focus:border-brand-primary"
                          : "bg-white border-slate-400 text-black focus:border-black",
                      )}
                    >
                      <option value="latest">LATEST / RECENT</option>
                      <option value="oldest">OLDEST FIRST</option>
                      <option value="amount-desc">VALUE: HIGH TO LOW</option>
                      <option value="amount-asc">VALUE: LOW TO HIGH</option>
                    </select>
                  </div>

                  {/* Reset Filters */}
                  <div className="sm:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-0 font-presale hidden sm:block">
                      Reset
                    </label>
                    <button
                      onClick={() => {
                        setReturnFilter("all");
                        setQuickFilter("all");
                        setSortBy("latest");
                      }}
                      className={cn(
                        "w-full rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 cursor-pointer h-[38px]",
                        theme === "dark"
                          ? "border-white/30 bg-black/20 text-dark-muted hover:text-white"
                          : "border-slate-400 bg-white text-light-muted hover:text-black",
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

          {activeTab === "presales" && (
            <div className="space-y-6 font-presale presale-stream-container">
              {/* Handheld/Mobile-Optimized Cards */}
              <div className="flex flex-col gap-4 md:hidden">
                {filteredPresales.map((p) => (
                  <div
                    key={`mobile-presale-${p.id}`}
                    className={cn(
                      "presale-stream-card p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative hover:shadow-lg cursor-pointer border-l-4",
                      theme === "dark"
                        ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                        : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                      p.status === "Approved" || p.status === "Authorized"
                        ? "border-l-emerald-500"
                        : p.status === "Voided" || p.status === "Void"
                          ? "border-l-rose-500"
                          : "border-l-amber-500"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 tracking-wider", 
                          theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                        )}>
                          #{p.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border transition-all shadow-xs",
                            p.status === "Approved" || p.status === "Authorized"
                              ? theme === "dark"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : p.status === "Voided" || p.status === "Void"
                                ? theme === "dark"
                                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                                : theme === "dark"
                                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  : "bg-amber-50 text-amber-800 border-amber-300",
                          )}
                        >
                          {p.status === "Approved" || p.status === "Authorized"
                            ? "Approved"
                            : p.status}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPresaleMenuAnchor({
                            id: p.id,
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

                    <div className="flex items-end justify-between">
                      <div>
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          Designation
                        </p>
                        <p className="text-sm font-semibold tracking-tight text-balance">
                          {p.operator || p.op || "Standard Customer"}
                        </p>
                        <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          {p.time}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          Value
                        </p>
                        <p className="font-mono text-lg font-bold text-cyan-400 dark:text-cyan-300 drop-shadow-xs">
                          {formatCurrency(p.amount, currency)}
                        </p>
                      </div>
                    </div>

                    {/* Mobile Finalize Action */}
                    {(p.status === "Pending" ||
                      p.status === "pending" ||
                      !p.status) && (
                      <div className="pt-3 border-t border-inherit/30 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInitiatingPresale(p);
                          }}
                          className={cn(
                            "w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md",
                            theme === "dark"
                              ? "bg-cyan-400 text-black shadow-cyan-400/20 hover:bg-cyan-300"
                              : "bg-[#062A95] text-white hover:bg-blue-900",
                          )}
                        >
                          <CheckCircle size={14} />
                          Finalize Sale
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {filteredPresales.length === 0 && (
                  /* BLOCK: Empty Presales Mobile View - Displays zero presales status card */
                  <div className={cn(
                    "presales-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm",
                    theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                  )}>
                    <Package size={54} strokeWidth={1.5} className={cn("presales-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                    <p className={cn("presales-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                      No Active Presales Identified
                    </p>
                    <p className={cn("presales-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                      No pending or active layaway presales recorded
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Table view (Shown on md up, hidden on mobile) */}
              <div
                className={cn(
                  "hidden md:block rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 presale-stream-table",
                  theme === "dark"
                    ? "bg-dark-surface border-white/20"
                    : "bg-white border-slate-300",
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-20 shadow-xs">
                      <tr
                        className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#0c1836] border-white/20"
                            : "bg-slate-100 border-slate-300",
                        )}
                      >
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
                          Status
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Value
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Shortcut
                        </th>
                        <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPresales.map((p) => {
                        const shortId = p.id.startsWith("PS-")
                          ? `PS-${p.id.replace("PS-", "").slice(-6)}`
                          : p.id.slice(0, 8);
                        const isSelected = selectedPresale?.id === p.id;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => setSelectedPresale(p)}
                            onDoubleClick={() => setViewingPresale(p)}
                            className={cn(
                              "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                              isSelected ? "holdings-table__row--selected" : "",
                              theme === "dark"
                                ? isSelected
                                  ? "bg-cyan-500/20 hover:bg-cyan-500/25 border-cyan-500/50 text-white font-semibold"
                                  : "border-white/10 hover:bg-white/5 text-slate-100"
                                : isSelected
                                  ? "bg-blue-50 hover:bg-blue-100/80 border-blue-300 text-slate-900 font-semibold"
                                  : "border-slate-200 hover:bg-slate-50 text-slate-900",
                            )}
                          >
                            <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                              <span className={cn(
                                "font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide",
                                theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                              )}>
                                {shortId}
                              </span>
                            </td>
                            <td className={cn("px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap", theme === "dark" ? "text-white" : "text-slate-900")}>
                              {p.operator || p.op || "Standard Customer"}
                            </td>
                            <td className={cn("px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap")}>
                              {p.time}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                              <span
                                className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                                  p.status === "Approved" || p.status === "Authorized"
                                    ? theme === "dark"
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : p.status === "Voided" || p.status === "Void"
                                      ? theme === "dark"
                                        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                        : "bg-rose-50 text-rose-800 border-rose-300"
                                      : theme === "dark"
                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : "bg-amber-50 text-amber-800 border-amber-300",
                                )}
                              >
                                {p.status === "Approved" ||
                                p.status === "Authorized"
                                  ? "Approved"
                                  : p.status}
                              </span>
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold text-cyan-400 dark:text-cyan-300 whitespace-nowrap">
                              {formatCurrency(p.amount, currency)}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                {(p.status === "Pending" ||
                                  p.status === "pending" ||
                                  !p.status) ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInitiatingPresale(p);
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-xs",
                                      theme === "dark"
                                        ? "bg-cyan-400 text-black hover:bg-cyan-300"
                                        : "bg-[#062A95] text-white hover:bg-blue-900",
                                    )}
                                  >
                                    <CheckCircle size={13} />
                                    Finalize
                                  </button>
                                ) : (
                                  <span className="text-xs font-bold uppercase tracking-widest opacity-35">-</span>
                                )}
                              </div>
                            </td>
                            <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect =
                                      e.currentTarget.getBoundingClientRect();
                                    setPresaleMenuAnchor({
                                      id: p.id,
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
                      {filteredPresales.length === 0 && (
                        /* BLOCK: Empty Presales Table Row - Displays zero presales status card inside table */
                        <tr className="presales-empty-table__row border-0">
                          <td colSpan={7} className="presales-empty-table__cell py-16 text-center">
                            <div className="presales-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("presales-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("presales-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                No Active Presales Identified
                              </p>
                              <p className={cn("presales-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No pending or active layaway presales recorded
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

          {/* BLOCK: Expenditure Ledger View - Displays operating expenses and deficit outflow logs */}
          {activeTab === "expenditure" && (
            <div className="space-y-6 font-presale expenditures-container">
              {/* Handheld/Mobile-Optimized Cards */}
              <div className="flex flex-col gap-4 md:hidden">
                {filteredExpenditures.map((exp) => {
                  let formattedTime = "Just now";
                  try {
                    const ms = getTimestampMs(exp);
                    if (ms) {
                      formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                    }
                  } catch (e) {}

                  return (
                    /* BLOCK: Expenditure Mobile Card - Displays individual expense record */
                    <div
                      key={`mobile-exp-${exp.id}`}
                      className={cn(
                        "expenditure-card p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative hover:shadow-lg cursor-pointer border-l-4 border-l-rose-500",
                        theme === "dark"
                          ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                          : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 tracking-wider", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                            #{exp.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border transition-all shadow-xs",
                            theme === "dark" ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-50 text-rose-800 border-rose-300"
                          )}>
                            {exp.category || "Expense"}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setExpenditureMenuAnchor({
                              id: exp.id,
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

                      <div className="flex items-end justify-between">
                        <div>
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Description
                          </p>
                          <p className="text-sm font-semibold tracking-tight text-balance">
                            {exp.description}
                          </p>
                          <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            {formattedTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Deficit Outflow
                          </p>
                          <p className="font-mono text-lg font-bold text-rose-500 dark:text-rose-400 drop-shadow-xs">
                            {formatCurrency(exp.amount, currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredExpenditures.length === 0 && (
                  /* BLOCK: Empty Expenditures Mobile View - Card displaying zero operating expense entries */
                  <div className={cn(
                    "expenditures-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm",
                    theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                  )}>
                    <Package size={54} strokeWidth={1.5} className={cn("expenditures-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                    <p className={cn("expenditures-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                      No Expenditure Records Identified
                    </p>
                    <p className={cn("expenditures-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                      No operating expense entries recorded for this period
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              {/* BLOCK: Expenditure Desktop Table - Displays operating expense entries in structured tabular view */}
              <div
                className={cn(
                  "hidden md:block rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 expenditure-table",
                  theme === "dark"
                    ? "bg-dark-surface border-white/20"
                    : "bg-white border-slate-300",
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-20 shadow-sm">
                      <tr
                        className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#0c1836] border-white/20"
                            : "bg-slate-100 border-slate-300",
                        )}
                      >
                        <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Entry ID
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Description
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Category
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Amount
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Timestamp
                        </th>
                        <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenditures.map((exp) => {
                        const idStr = String(exp.id || "");
                        const shortId = idStr.toLowerCase().startsWith("exp-")
                          ? `EXP-${idStr.replace(/exp-/i, "").slice(-6)}`
                          : idStr.slice(0, 8);
                        let formattedTime = "Just now";
                        try {
                          const ms = getTimestampMs(exp);
                          if (ms) {
                            formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                          }
                        } catch (e) {}
                        return (
                          <tr
                            key={exp.id}
                            className={cn(
                              "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                              theme === "dark"
                                ? "border-white/10 hover:bg-white/5 text-slate-100"
                                : "border-slate-200 hover:bg-slate-50 text-slate-900",
                            )}
                          >
                            <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                              <span className={cn("font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                                #{shortId}
                              </span>
                            </td>
                            <td className={cn("px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap", theme === "dark" ? "text-white" : "text-slate-900")}>
                              {exp.description}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                                theme === "dark" ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-50 text-rose-800 border-rose-300"
                              )}>
                                {exp.category || "Operational"}
                              </span>
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold text-rose-500 dark:text-rose-400 whitespace-nowrap">
                              {formatCurrency(exp.amount, currency)}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap">
                              {formattedTime}
                            </td>
                            <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setExpenditureMenuAnchor({
                                      id: exp.id,
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
                      {filteredExpenditures.length === 0 && (
                        /* BLOCK: Empty Expenditures Table Row - Displays zero operating expenses status card inside table */
                        <tr className="expenditures-empty-table__row border-0">
                          <td colSpan={6} className="expenditures-empty-table__cell py-16 text-center">
                            <div className="expenditures-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("expenditures-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("expenditures-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                No Expenditure Records Identified
                              </p>
                              <p className={cn("expenditures-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No operating expense entries recorded for this period
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

          {/* BLOCK: Revenue Ledger View - Displays inflow logs and non-POS income logs */}
          {activeTab === "revenue" && (
            <div className="space-y-6 font-presale revenue-container">
              {/* Handheld/Mobile-Optimized Cards */}
              <div className="flex flex-col gap-4 md:hidden">
                {filteredRevenue.map((rev) => {
                  let formattedTime = "Just now";
                  try {
                    const ms = getTimestampMs(rev);
                    if (ms) {
                      formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                    }
                  } catch (e) {}

                  const idStr = String(rev.id || "");
                  const shortId = idStr.toLowerCase().startsWith("rev-")
                    ? `REV-${idStr.replace(/rev-/i, "").slice(-6)}`
                    : idStr.slice(0, 8);

                  return (
                    /* BLOCK: Revenue Mobile Card - Displays individual revenue entry */
                    <div
                      key={`mobile-rev-${rev.id}`}
                      className={cn(
                        "revenue-card p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative hover:shadow-lg cursor-pointer border-l-4 border-l-emerald-500",
                        theme === "dark"
                          ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                          : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 tracking-wider", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                            #{shortId}
                          </span>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border transition-all shadow-xs",
                            theme === "dark" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-800 border-emerald-300"
                          )}>
                            Inflow
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRevenueMenuAnchor({
                              id: rev.id,
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

                      <div className="flex items-end justify-between">
                        <div>
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Description
                          </p>
                          <p className="text-sm font-semibold tracking-tight text-balance">
                            {rev.source}
                          </p>
                          <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            {formattedTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Value
                          </p>
                          <p className="font-mono text-lg font-bold text-emerald-500 dark:text-emerald-400 drop-shadow-xs">
                            {formatCurrency(rev.amount, currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredRevenue.length === 0 && (
                  /* BLOCK: Empty Revenue Mobile View - Card displaying zero revenue inflow entries */
                  <div className={cn(
                    "revenue-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm",
                    theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                  )}>
                    <Package size={54} strokeWidth={1.5} className={cn("revenue-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                    <p className={cn("revenue-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                      No Revenue Entries Identified
                    </p>
                    <p className={cn("revenue-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                      No secondary revenue or non-POS inflows recorded
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              {/* BLOCK: Revenue Desktop Table - Displays revenue inflow entries in structured tabular view */}
              <div
                className={cn(
                  "hidden md:block rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 revenue-table",
                  theme === "dark"
                    ? "bg-dark-surface border-white/20"
                    : "bg-white border-slate-300",
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-20 shadow-sm">
                      <tr
                        className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#0c1836] border-white/20"
                            : "bg-slate-100 border-slate-300",
                        )}
                      >
                        <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Source ID
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Description
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Classification
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Amount
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Timestamp
                        </th>
                        <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRevenue.map((rev) => {
                        const idStr = String(rev.id || "");
                        const shortId = idStr.toLowerCase().startsWith("rev-")
                          ? `REV-${idStr.replace(/rev-/i, "").slice(-6)}`
                          : idStr.slice(0, 8);
                        let formattedTime = "Just now";
                        try {
                          const ms = getTimestampMs(rev);
                          if (ms) {
                            formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                          }
                        } catch (e) {}
                        return (
                          <tr
                            key={rev.id}
                            className={cn(
                              "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                              theme === "dark"
                                ? "border-white/10 hover:bg-white/5 text-slate-100"
                                : "border-slate-200 hover:bg-slate-50 text-slate-900",
                            )}
                          >
                            <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                              <span className={cn("font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                                #{shortId}
                              </span>
                            </td>
                            <td className={cn("px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap", theme === "dark" ? "text-white" : "text-slate-900")}>
                              {rev.source}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                                theme === "dark" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-800 border-emerald-300"
                              )}>
                                Inflow
                              </span>
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400 whitespace-nowrap">
                              {formatCurrency(rev.amount, currency)}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap">
                              {formattedTime}
                            </td>
                            <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setRevenueMenuAnchor({
                                      id: rev.id,
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
                      {filteredRevenue.length === 0 && (
                        /* BLOCK: Empty Revenue Table Row - Displays zero revenue inflow entries card inside table */
                        <tr className="revenue-empty-table__row border-0">
                          <td colSpan={6} className="revenue-empty-table__cell py-16 text-center">
                            <div className="revenue-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("revenue-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("revenue-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                No Revenue Entries Identified
                              </p>
                              <p className={cn("revenue-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No secondary revenue or non-POS inflows recorded
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

          {/* BLOCK: Balances Ledger View - Displays account balance records and logs */}
          {activeTab === "balances" && (
            <div className="space-y-6 font-presale balances-container">
              {/* Handheld/Mobile-Optimized Cards */}
              <div className="flex flex-col gap-4 md:hidden">
                {filteredBalances.map((bal) => {
                  const idStr = String(bal.id || "");
                  const shortId = idStr.toLowerCase().startsWith("bal-")
                    ? `BAL-${idStr.replace(/bal-/i, "").slice(-6)}`
                    : idStr.slice(0, 8);
                  let formattedTime = "Just now";
                  try {
                    const ms = getTimestampMs(bal);
                    if (ms) {
                      formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                    }
                  } catch (e) {}

                  return (
                    /* BLOCK: Balances Mobile Card - Displays individual account balance log */
                    <div
                      key={`mobile-bal-${bal.id}`}
                      className={cn(
                        "balances-card p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative hover:shadow-lg cursor-pointer border-l-4 border-l-cyan-500",
                        theme === "dark"
                          ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                          : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 tracking-wider", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                            #{shortId}
                          </span>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border transition-all shadow-xs",
                            theme === "dark" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" : "bg-blue-50 text-blue-800 border-blue-300"
                          )}>
                            Account Balance
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setBalancesMenuAnchor({
                              id: bal.id,
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

                      <div className="flex items-end justify-between">
                        <div>
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Account
                          </p>
                          <p className="text-sm font-semibold tracking-tight text-balance">
                            {bal.description}
                          </p>
                          <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            {formattedTime}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Value
                          </p>
                          <p className="font-mono text-lg font-bold text-cyan-400 dark:text-cyan-300 drop-shadow-xs">
                            {formatCurrency(bal.amount, currency)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredBalances.length === 0 && (
                  /* BLOCK: Empty Balances Mobile View - Card displaying zero balance entries */
                  <div className={cn(
                    "balances-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm",
                    theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                  )}>
                    <Package size={54} strokeWidth={1.5} className={cn("balances-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                    <p className={cn("balances-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                      No Balance Entries Identified
                    </p>
                    <p className={cn("balances-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                      No manual account balance entries recorded
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              {/* BLOCK: Balances Desktop Table - Displays account balance records in structured tabular view */}
              <div
                className={cn(
                  "hidden md:block rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 balances-table",
                  theme === "dark"
                    ? "bg-dark-surface border-white/20"
                    : "bg-white border-slate-300",
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-20 shadow-sm">
                      <tr
                        className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#0c1836] border-white/20"
                            : "bg-slate-100 border-slate-300",
                        )}
                      >
                        <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Entry ID
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Account
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Balance
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Timestamp
                        </th>
                        <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBalances.map((bal) => {
                        const idStr = String(bal.id || "");
                        const shortId = idStr.toLowerCase().startsWith("bal-")
                          ? `BAL-${idStr.replace(/bal-/i, "").slice(-6)}`
                          : idStr.slice(0, 8);
                        let formattedTime = "Just now";
                        try {
                          const ms = getTimestampMs(bal);
                          if (ms) {
                            formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                          }
                        } catch (e) {}
                        return (
                          <tr
                            key={bal.id}
                            className={cn(
                              "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                              theme === "dark"
                                ? "border-white/10 hover:bg-white/5 text-slate-100"
                                : "border-slate-200 hover:bg-slate-50 text-slate-900",
                            )}
                          >
                            <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                              <span className={cn("font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                                #{shortId}
                              </span>
                            </td>
                            <td className={cn("px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap", theme === "dark" ? "text-white" : "text-slate-900")}>
                              {bal.description}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold text-cyan-400 dark:text-cyan-300 whitespace-nowrap">
                              {formatCurrency(bal.amount, currency)}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap">
                              {formattedTime}
                            </td>
                            <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setBalancesMenuAnchor({
                                      id: bal.id,
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
                      {filteredBalances.length === 0 && (
                        /* BLOCK: Empty Balances Table Row - Displays zero balance entries card inside table */
                        <tr className="balances-empty-table__row border-0">
                          <td colSpan={5} className="balances-empty-table__cell py-16 text-center">
                            <div className="balances-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("balances-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("balances-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                No Balance Entries Identified
                              </p>
                              <p className={cn("balances-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No manual account balance entries recorded
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

          {/* BLOCK: Returns Portal View - Displays returned items, audit status, and value logs */}
          {activeTab === "returns" && (
            <div className="space-y-6 font-presale returns-portal-container">
              {/* Handheld/Mobile-Optimized Cards */}
              <div className="flex flex-col gap-4 md:hidden">
                {filteredTransactions.map((tx) => {
                  const isReturned = returnedTransactionIds.has(tx.id);
                  let formattedTime = "Just now";
                  try {
                    const ms = getTimestampMs(tx);
                    if (ms) {
                      formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                    }
                  } catch (e) {}

                  return (
                    /* BLOCK: Returns Portal Mobile Card - Displays individual return/honored audit card */
                    <div
                      key={`mobile-tx-${tx.id}`}
                      className={cn(
                        "returns-portal-card p-5 rounded-2xl border transition-all duration-300 flex flex-col gap-4 relative hover:shadow-lg cursor-pointer border-l-4",
                        theme === "dark"
                          ? "bg-gradient-to-br from-[#0c1a44]/80 via-[#030a21] to-[#010619] border-white/10 hover:border-cyan-400 text-white"
                          : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-slate-300 hover:border-slate-800 text-black",
                        isReturned
                          ? "border-l-rose-500"
                          : "border-l-emerald-500"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-mono text-xs font-bold px-2 py-0.5 rounded-md shrink-0 tracking-wider",
                            theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200"
                          )}>
                            #{tx.id.slice(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border transition-all shadow-xs",
                              isReturned
                                ? theme === "dark"
                                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                  : "bg-rose-50 text-rose-800 border-rose-300"
                                : theme === "dark"
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
                            )}
                          >
                            {isReturned ? "Returned" : "Honored"}
                          </span>
                        </div>
                        {!isReturned && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setReturnMenuAnchor({
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
                        )}
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <p className={cn("text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            Designation
                          </p>
                          <p className="text-sm font-semibold tracking-tight text-balance">
                            {tx.customerName || "Standard Sale"}
                          </p>
                          <p className={cn("text-[10px] font-mono mt-1 opacity-70", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                            {formattedTime}
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
                {filteredTransactions.length === 0 && (
                  /* BLOCK: Empty Returns Portal Mobile Card - Card displaying zero transaction entries */
                  <div className={cn(
                    "returns-portal-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-sm",
                    theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                  )}>
                    <Package size={54} strokeWidth={1.5} className={cn("returns-portal-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                    <p className={cn("returns-portal-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                      No Transaction Records Identified
                    </p>
                    <p className={cn("returns-portal-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                      No sales audit records found for this period
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              {/* BLOCK: Returns Portal Desktop Table - Displays return and honored entries in structured tabular view */}
              <div
                className={cn(
                  "hidden md:block rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 returns-portal-table",
                  theme === "dark"
                    ? "bg-dark-surface border-white/20"
                    : "bg-white border-slate-300",
                )}
              >
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-20 shadow-sm">
                      <tr
                        className={cn(
                          "text-left border-b transition-colors duration-200",
                          theme === "dark"
                            ? "bg-[#0c1836] border-white/20"
                            : "bg-slate-100 border-slate-300",
                        )}
                      >
                        <th className={cn("pl-6 lg:pl-8 pr-3 lg:pr-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Entry ID
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Timestamp
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Designation
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Audit Status
                        </th>
                        <th className={cn("px-3 lg:px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-left whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Value
                        </th>
                        <th className={cn("pl-3 lg:pl-6 pr-6 lg:pr-8 py-4 text-[11px] font-extrabold uppercase tracking-widest text-center whitespace-nowrap", theme === 'dark' ? 'text-slate-200' : 'text-slate-700')}>
                          Shortcut
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx) => {
                        const shortId = tx.id.startsWith("TX-")
                          ? `TX-${tx.id.replace("TX-", "").slice(-6)}`
                          : tx.id.slice(0, 8);
                        
                        let formattedTime = "Just now";
                        try {
                          const ms = getTimestampMs(tx);
                          if (ms) {
                            formattedTime = format(new Date(ms), "yyyy-MM-dd HH:mm");
                          }
                        } catch (e) {}

                        const isReturned = returnedTransactionIds.has(tx.id);

                        return (
                          <tr
                            key={tx.id}
                            className={cn(
                              "border-b last:border-0 transition-colors duration-200 group cursor-pointer",
                              theme === "dark"
                                ? "border-white/10 hover:bg-white/5 text-slate-100"
                                : "border-slate-200 hover:bg-slate-50 text-slate-900"
                            )}
                          >
                            <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 whitespace-nowrap">
                              <span className={cn("font-mono text-xs font-bold px-2 py-1 rounded-md tracking-wide", theme === "dark" ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "bg-blue-50 text-blue-900 border border-blue-200")}>
                                {shortId}
                              </span>
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 font-mono text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap">
                              {formattedTime}
                            </td>
                            <td className={cn("px-3 lg:px-6 py-3.5 text-xs font-semibold tracking-tight whitespace-nowrap", theme === "dark" ? "text-white" : "text-slate-900")}>
                              {tx.customerName || "Standard Sale"}
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 whitespace-nowrap">
                              <span
                                className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border transition-all shadow-2xs",
                                  isReturned
                                    ? theme === "dark"
                                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                                      : "bg-rose-50 text-rose-800 border-rose-300"
                                    : theme === "dark"
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                )}
                              >
                                {isReturned ? "Returned" : "Honored"}
                              </span>
                            </td>
                            <td className="px-3 lg:px-6 py-3.5 text-left font-mono text-xs font-bold text-cyan-400 dark:text-cyan-300 whitespace-nowrap">
                              {formatCurrency(tx.totalAmount, currency)}
                            </td>
                            <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                {!isReturned ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect =
                                        e.currentTarget.getBoundingClientRect();
                                      setReturnMenuAnchor({
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
                                ) : (
                                  <span className="text-[10px] font-black uppercase tracking-widest opacity-35">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTransactions.length === 0 && (
                        /* BLOCK: Empty Returns Portal Table Row - Displays zero transaction entries card inside table */
                        <tr className="returns-portal-empty-table__row border-0">
                          <td colSpan={6} className="returns-portal-empty-table__cell py-16 text-center">
                            <div className="returns-portal-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                              <Package size={54} strokeWidth={1.5} className={cn("returns-portal-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                              <p className={cn("returns-portal-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                No Transaction Records Identified
                              </p>
                              <p className={cn("returns-portal-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                No sales audit records found for this period
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
            </div>
          </div>
        )}

        <AnimatePresence>
          {/* Presale Menu */}
          {presaleMenuAnchor && (
            <motion.div
              key="presale-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150]"
              onClick={() => setPresaleMenuAnchor(null)}
            />
          )}
          {presaleMenuAnchor && (
            <motion.div
              key="presale-menu"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              style={{
                top: Math.min(presaleMenuAnchor.y, window.innerHeight - 200),
                left: Math.max(
                  10,
                  Math.min(
                    window.innerWidth - 200,
                    presaleMenuAnchor.x - 180,
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
                  const ps = presales.find(
                    (p) => p.id === presaleMenuAnchor.id,
                  );
                  setViewingPresale(ps);
                  setPresaleMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  theme === "dark" ? "hover:bg-white/5" : "hover:bg-black/5",
                )}
              >
                <Eye size={14} /> View Details
              </button>
              {presales.find((p) => p.id === presaleMenuAnchor.id)?.status ===
                "Pending" && (
                <>
                  <button
                    onClick={() => {
                      const ps = presales.find(
                        (p) => p.id === presaleMenuAnchor.id,
                      );
                      setEditingPresale(ps);
                      setPresaleMenuAnchor(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-blue-500",
                      theme === "dark"
                        ? "hover:bg-blue-500/10"
                        : "hover:bg-blue-50",
                    )}
                  >
                    <Pencil size={14} /> Edit Presale
                  </button>
                  <button
                    onClick={() => {
                      const ps = presales.find(
                        (p) => p.id === presaleMenuAnchor.id,
                      );
                      setInitiatingPresale(ps);
                      setPresaleMenuAnchor(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-green-500",
                      theme === "dark"
                        ? "hover:bg-green-500/10"
                        : "hover:bg-green-50",
                    )}
                  >
                    <CheckCircle size={14} /> Finalize Sale
                  </button>
                  <button
                    onClick={() => {
                      setConfirmActionItem({
                        id: presaleMenuAnchor.id,
                        type: 'void_presale',
                        title: 'Void Presale Entry?',
                        subtitle: 'Audit Action Alert',
                        message: 'Are you sure you want to void this presale transaction? It will be permanently marked as Voided in system logs.'
                      });
                      setPresaleMenuAnchor(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-red-500",
                      theme === "dark"
                        ? "hover:bg-red-500/10"
                        : "hover:bg-red-50",
                    )}
                  >
                    <Trash2 size={14} /> Void Presale
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Return Menu */}
          {returnMenuAnchor && (
            <motion.div
              key="return-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150]"
              onClick={() => setReturnMenuAnchor(null)}
            />
          )}
          {returnMenuAnchor && (
            <motion.div
              key="return-menu"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              style={{
                top: Math.min(returnMenuAnchor.y, window.innerHeight - 200),
                left: Math.max(
                  10,
                  Math.min(window.innerWidth - 200, returnMenuAnchor.x - 180),
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
                    (t) => t.id === returnMenuAnchor.id,
                  );
                  setViewingTransaction(tx);
                  setReturnMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  theme === "dark" ? "hover:bg-white/5" : "hover:bg-black/5",
                )}
              >
                <Eye size={14} /> View Transaction
              </button>
              <button
                onClick={() => {
                  const tx = transactions.find(
                    (t) => t.id === returnMenuAnchor.id,
                  );
                  setSelectedTransactionForReturn(tx);
                  const initialReturnItems: Record<string, any> = {};
                  tx.items.forEach((item: any) => {
                    initialReturnItems[item.id] = {
                      selected: false,
                      quantity: item.quantity,
                    };
                  });
                  setReturnItems(initialReturnItems);
                  setIsReturnModalOpen(true);
                  setReturnMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-red-500",
                  theme === "dark"
                    ? "hover:bg-red-500/10"
                    : "hover:bg-red-50",
                )}
              >
                <RotateCcw size={14} /> Create Return
              </button>
            </motion.div>
          )}

          {/* View Transaction Modal */}
          {viewingTransaction && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="view-transaction-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card view-transaction-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === "dark"
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header view-transaction-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                  <div className="flex justify-start">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                      theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                    )}>
                      <Eye size={16} className="text-brand-primary" />
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center justify-center font-presale">
                    <h3 className={cn(
                      "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                      theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                    )}>
                      Transaction Audit
                    </h3>
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                      #{viewingTransaction.id}
                    </span>
                  </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setViewingTransaction(null)}
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

                {/* Scrollable Contents (Body) */}
                <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col min-h-0">
                  {/* Desktop view (table) */}
                  <div className={cn(
                    "hidden md:block rounded-xl border overflow-hidden flex-1 overflow-y-auto no-scrollbar max-h-[55vh]",
                    theme === "dark" ? "border-white/35 bg-dark-surface" : "border-slate-400 bg-white"
                  )}>
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className={cn(
                          "border-b transition-colors duration-200 text-[10px] lg:text-xs font-bold uppercase tracking-widest",
                          theme === "dark" ? "bg-[#111c30] border-white/35 text-white" : "bg-slate-100 border-slate-400 text-black/80"
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
                                "border-b last:border-0 transition-colors duration-200 group cursor-pointer text-xs font-semibold uppercase tracking-wider",
                                theme === "dark" 
                                  ? "border-white/20 hover:bg-brand-primary/10 text-white" 
                                  : "border-slate-300 hover:bg-[#062A95]/5 text-black"
                              )}
                            >
                              {/* Line */}
                              <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 font-mono text-xs font-medium opacity-80 text-left">
                                {String(idx + 1).padStart(2, "0")}
                              </td>
                              
                              {/* Barcode */}
                              <td className="px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold opacity-80 text-left">
                                {itemBarcode}
                              </td>
                              
                              {/* Product Name */}
                              <td className="px-3 lg:px-6 py-3.5 font-bold text-xs uppercase tracking-widest max-w-[180px] truncate text-left">
                                {item.name}
                              </td>
                              
                              {/* Qty */}
                              <td className="px-3 lg:px-6 py-3.5 font-mono font-semibold text-xs text-left">
                                {itemQty}
                              </td>
                              
                              {/* Price */}
                              <td className="px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold opacity-90 text-left">
                                {formatCurrency(itemPrice, currency)}
                              </td>
                              
                              {/* Total */}
                              <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 font-mono font-bold text-brand-primary text-xs text-left">
                                {formatCurrency(itemTotal, currency)}
                              </td>
                            </tr>
                          );
                        })}
                        {(!viewingTransaction.items || viewingTransaction.items.length === 0) && (
                          /* BLOCK: Empty Viewing Transaction Items Table Row */
                          <tr className="view-tx-empty-table__row border-0">
                            <td colSpan={6} className="view-tx-empty-table__cell py-16 text-center">
                              <div className="view-tx-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                                <Package size={54} strokeWidth={1.5} className={cn("view-tx-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                                <p className={cn("view-tx-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                  No Items Found In Record
                                </p>
                                <p className={cn("view-tx-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                  No itemized transaction lines recorded
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
                          {/* Card Header */}
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

                          {/* Product Info */}
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
                      /* BLOCK: Empty Viewing Transaction Items Mobile Card */
                      <div className={cn(
                        "view-tx-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                        theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                      )}>
                        <Package size={54} strokeWidth={1.5} className={cn("view-tx-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                        <p className={cn("view-tx-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                          No Items Found In Record
                        </p>
                        <p className={cn("view-tx-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          No itemized transaction lines recorded
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fixed Bottom Action Panel */}
                <div className={cn(
                  "p-3.5 px-6 md:px-8 border-t border-inherit flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shrink-0 bg-transparent pb-safe"
                )}>
                  <div className={cn(
                    "px-3.5 pt-2 pb-1.5 rounded-xl flex flex-col lg:flex-row lg:items-baseline lg:gap-2 shadow-sm bg-white text-black"
                  )}>
                    <p className={cn(
                      "text-[8px] uppercase font-black tracking-widest whitespace-nowrap",
                      theme === 'dark' ? "text-slate-500" : "opacity-50"
                    )}>
                      Total Valuation
                    </p>
                    <h4 className="text-sm md:text-base font-mono font-black text-brand-primary">
                      {formatCurrency(viewingTransaction.totalAmount, currency)}
                    </h4>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* View Presale Modal */}
          {viewingPresale && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="view-presale-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card view-presale-popup-card relative w-[92%] sm:w-[88%] md:w-full max-w-4xl lg:max-w-5xl h-[80vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === "dark"
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header view-presale-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <TrendingUp size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Presale Manifest
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        #{viewingPresale.id}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setViewingPresale(null)}
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

                {/* Scrollable Contents (Body) */}
                <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col min-h-0">
                  {/* Table view instead of list (Desktop) */}
                  <div className={cn(
                    "hidden md:block rounded-xl border overflow-hidden flex-1 overflow-y-auto no-scrollbar max-h-[55vh]",
                    theme === "dark" ? "border-white/35 bg-dark-surface" : "border-slate-400 bg-white"
                  )}>
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className={cn(
                          "border-b transition-colors duration-200 text-[10px] lg:text-xs font-bold uppercase tracking-widest",
                          theme === "dark" ? "bg-[#111c30] border-white/35 text-white" : "bg-slate-100 border-slate-400 text-black/80"
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
                        {(viewingPresale.items || []).map((item: any, idx: number) => {
                          const itemPrice = item.price || 0;
                          const itemQty = item.quantity || 1;
                          const itemTotal = itemPrice * itemQty;
                          const shortSku = item.id ? (item.id.slice(0, 8).toUpperCase()) : "N/A";
                          const itemBarcode = item.barcode || item.sku || shortSku;
                          
                          return (
                            <tr 
                              key={idx}
                              className={cn(
                                "border-b last:border-0 transition-colors duration-200 group cursor-pointer text-xs font-semibold uppercase tracking-wider",
                                theme === "dark" 
                                  ? "border-white/20 hover:bg-brand-primary/10 text-white" 
                                  : "border-slate-300 hover:bg-[#062A95]/5 text-black"
                              )}
                            >
                              {/* Line */}
                              <td className="pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 font-mono text-xs font-medium opacity-80 text-left">
                                {String(idx + 1).padStart(2, "0")}
                              </td>
                              
                              {/* Barcode */}
                              <td className="px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold opacity-80 text-left">
                                {itemBarcode}
                              </td>
                              
                              {/* Product Name */}
                              <td className="px-3 lg:px-6 py-3.5 font-bold text-xs uppercase tracking-widest max-w-[180px] truncate text-left">
                                {item.name}
                              </td>
                              
                              {/* Qty */}
                              <td className="px-3 lg:px-6 py-3.5 font-mono font-semibold text-xs text-left">
                                {itemQty}
                              </td>
                              
                              {/* Price */}
                              <td className="px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold opacity-90 text-left">
                                {formatCurrency(itemPrice, currency)}
                              </td>
                              
                              {/* Total */}
                              <td className="pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 font-mono font-bold text-brand-primary text-xs text-left">
                                {formatCurrency(itemTotal, currency)}
                              </td>
                            </tr>
                          );
                        })}
                        {(!viewingPresale.items || viewingPresale.items.length === 0) && (
                          /* BLOCK: Empty Viewing Presale Items Table Row */
                          <tr className="view-presale-empty-table__row border-0">
                            <td colSpan={6} className="view-presale-empty-table__cell py-16 text-center">
                              <div className="view-presale-empty-table__container flex flex-col items-center justify-center text-center gap-2">
                                <Package size={54} strokeWidth={1.5} className={cn("view-presale-empty-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                                <p className={cn("view-presale-empty-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                  No Items Found In Manifest
                                </p>
                                <p className={cn("view-presale-empty-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                  No presale manifest line items recorded
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
                    {(viewingPresale.items || []).map((item: any, idx: number) => {
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
                          {/* Card Header */}
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

                          {/* Product Info */}
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
                    {(!viewingPresale.items || viewingPresale.items.length === 0) && (
                      /* BLOCK: Empty Viewing Presale Items Mobile Card */
                      <div className={cn(
                        "view-presale-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                        theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                      )}>
                        <Package size={54} strokeWidth={1.5} className={cn("view-presale-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                        <p className={cn("view-presale-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                          No Items Found In Manifest
                        </p>
                        <p className={cn("view-presale-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                          No presale manifest line items recorded
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fixed Bottom Action Panel */}
                <div className={cn(
                  "p-3.5 px-6 md:px-8 border-t border-inherit flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shrink-0 bg-transparent pb-safe"
                )}>
                  <div className={cn(
                    "px-3.5 pt-2 pb-1.5 rounded-xl flex flex-col lg:flex-row lg:items-baseline lg:gap-2 shadow-sm bg-white text-black"
                  )}>
                    <p className={cn(
                      "text-[8px] uppercase font-black tracking-widest whitespace-nowrap",
                      theme === 'dark' ? "text-slate-500" : "opacity-50"
                    )}>
                      Total Valuation
                    </p>
                    <h4 className="text-sm md:text-base font-mono font-black text-brand-primary">
                      {formatCurrency(viewingPresale.amount, currency)}
                    </h4>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const doc = new jsPDF();
                        doc.setFontSize(20);
                        doc.text("PRESALE MANIFEST", 10, 20);
                        doc.setFontSize(10);
                        doc.text(`ID: ${viewingPresale.id}`, 10, 30);
                        doc.text(
                          `Operator: ${viewingPresale.operator || viewingPresale.op}`,
                          10,
                          35,
                        );
                        doc.text(`Status: ${viewingPresale.status}`, 10, 40);
                        let y = 60;
                        (viewingPresale.items || []).forEach((item: any) => {
                          doc.text(`${item.name} x ${item.quantity}`, 10, y);
                          doc.text(
                            `${formatCurrency(item.price * item.quantity, currency)}`,
                            160,
                            y,
                          );
                          y += 10;
                        });
                        doc.text(
                          `TOTAL: ${formatCurrency(viewingPresale.amount, currency)}`,
                          140,
                          y + 10,
                        );
                        doc.save(`Presale_${viewingPresale.id}.pdf`);
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 border-2",
                        theme === "dark" 
                          ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                          : "bg-white border-light-border text-black hover:bg-gray-50",
                      )}
                    >
                      <Printer size={12} /> Print Manifest
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Initiate/Finalize Confirmation Modal */}
          {initiatingPresale && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="initiate-presale-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card initiate-presale-popup-card relative w-[92%] sm:w-[88%] md:w-full max-w-4xl lg:max-w-5xl h-[80vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === "dark"
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-brand-primary animate-pulse w-full z-30" />

                {/* Header */}
                <div className={cn(
                  "popup-card__header initiate-presale-popup-card__header p-4 border-b shrink-0 relative z-10",
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <TrendingUp size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Initiate Liquidation
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
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

                <div className="p-6 md:p-8 overflow-y-auto no-scrollbar flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
                    {/* BLOCK: Manifest Verification Section - Displays items slated for liquidation */}
                    <div className="manifest-verification space-y-4">
                      <p className="manifest-verification__title text-[10px] font-black uppercase tracking-widest opacity-30">
                        Manifest Verification
                      </p>
                      
                      {/* BLOCK: Manifest Product Table Container - Holds the scrollable grid/table of assets being verified */}
                      <div className={cn(
                        "manifest-product-table-container hidden md:block rounded-xl border overflow-x-auto overflow-y-auto no-scrollbar max-h-[40vh] shadow-sm",
                        theme === "dark"
                          ? "bg-dark-surface border-white/35 text-white"
                          : "bg-white border-slate-400 text-black"
                      )}>
                        <table className="manifest-product-table w-full border-collapse text-left min-w-[480px]">
                          <thead className="sticky top-0 z-20 shadow-sm">
                             <tr className={cn(
                              "manifest-product-table__header-row border-b transition-colors duration-200 text-[10px] lg:text-xs font-bold uppercase tracking-widest",
                              theme === "dark" ? "bg-[#111c30] border-white/35 text-white" : "bg-slate-100 border-slate-400 text-black/80"
                            )}>
                              <th className="manifest-product-table__header-cell pl-6 lg:pl-8 pr-3 lg:pr-6 py-5 lg:py-6 w-[70px] lg:w-[100px] text-left">Line</th>
                              <th className="manifest-product-table__header-cell px-3 lg:px-6 py-5 lg:py-6 w-[110px] lg:w-[180px] text-left">Barcode</th>
                              <th className="manifest-product-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-left">Product Name</th>
                              <th className="manifest-product-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-left w-[90px] lg:w-[140px]">Qty</th>
                              <th className="manifest-product-table__header-cell px-3 lg:px-6 py-5 lg:py-6 text-left w-[110px] lg:w-[180px]">Price</th>
                              <th className="manifest-product-table__header-cell pl-3 lg:pl-6 pr-6 lg:pr-8 py-5 lg:py-6 text-left w-[110px] lg:w-[180px]">Total</th>
                            </tr>
                          </thead>
                          <tbody className="manifest-product-table__body">
                            {(initiatingPresale.items || []).map((item: any, idx: number) => {
                              const itemPrice = item.price || 0;
                              const itemQty = item.quantity || 1;
                              const itemTotal = itemPrice * itemQty;
                              const shortSku = item.id ? (item.id.slice(0, 8).toUpperCase()) : "N/A";
                              const itemBarcode = item.barcode || item.sku || shortSku;
                              
                              return (
                                <tr 
                                  key={idx}
                                  className={cn(
                                    "manifest-product-table__row border-b last:border-0 transition-colors duration-200 group cursor-pointer text-xs font-semibold uppercase tracking-wider",
                                    theme === "dark" 
                                      ? "border-white/20 hover:bg-brand-primary/10 text-white" 
                                      : "border-slate-300 hover:bg-[#062A95]/5 text-black"
                                  )}
                                >
                                  {/* Line */}
                                  <td className="manifest-product-table__cell pl-6 lg:pl-8 pr-3 lg:pr-6 py-3.5 font-mono text-xs font-medium opacity-80 text-left">
                                    {String(idx + 1).padStart(2, "0")}
                                  </td>
                                  
                                  {/* Barcode */}
                                  <td className="manifest-product-table__cell px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold opacity-80 text-left">
                                    {itemBarcode}
                                  </td>
                                  
                                  {/* Product Name */}
                                  <td className="manifest-product-table__cell px-3 lg:px-6 py-3.5 font-bold text-xs uppercase tracking-widest max-w-[150px] truncate text-left">
                                    {item.name}
                                  </td>
                                  
                                  {/* Qty */}
                                  <td className="manifest-product-table__cell px-3 lg:px-6 py-3.5 font-mono font-semibold text-xs text-left">
                                    {itemQty}
                                  </td>
                                  
                                  {/* Price */}
                                  <td className="manifest-product-table__cell px-3 lg:px-6 py-3.5 font-mono text-xs font-semibold opacity-90 text-left">
                                    {formatCurrency(itemPrice, currency)}
                                  </td>
                                  
                                  {/* Total */}
                                  <td className="manifest-product-table__cell pl-3 lg:pl-6 pr-6 lg:pr-8 py-3.5 font-mono font-bold text-brand-primary text-xs text-left">
                                    {formatCurrency(itemTotal, currency)}
                                  </td>
                                </tr>
                              );
                            })}
                            {(!initiatingPresale.items || initiatingPresale.items.length === 0) && (
                              /* BLOCK: Empty Manifest Product Table Row */
                              <tr className="manifest-product-table__row manifest-product-table__row--empty border-0">
                                <td colSpan={6} className="manifest-product-table__cell py-16 text-center">
                                  <div className="manifest-product-table__container flex flex-col items-center justify-center text-center gap-2">
                                    <Package size={54} strokeWidth={1.5} className={cn("manifest-product-table__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                                    <p className={cn("manifest-product-table__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                                      No Items Found In Manifest
                                    </p>
                                    <p className={cn("manifest-product-table__subtitle text-xs font-presale tracking-wide", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                                      No itemized presale data found
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* BLOCK: Manifest Product Card List Container - Hosts liquidation items as a card list on mobile viewports */}
                      <div className={cn(
                        "manifest-product-card-list block md:hidden rounded-xl border p-4 space-y-3 max-h-[40vh] overflow-y-auto pr-1 no-scrollbar shadow-sm",
                        theme === "dark"
                          ? "bg-gradient-to-br from-[#040e33] to-[#010619] border-[#123ebd]/30 text-white"
                          : "bg-gradient-to-br from-slate-50 via-white to-slate-100/50 border-slate-200 text-black"
                      )}>
                        {(initiatingPresale.items || []).map((item: any, idx: number) => {
                          const itemPrice = item.price || 0;
                          const itemQty = item.quantity || 1;
                          const itemTotal = itemPrice * itemQty;
                          const shortSku = item.id ? (item.id.slice(0, 8).toUpperCase()) : "N/A";
                          const itemBarcode = item.barcode || item.sku || shortSku;
                          
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "manifest-product-card p-4 rounded-xl border flex flex-col gap-3 transition-colors duration-150",
                                theme === "dark" 
                                  ? "border-white/10 bg-[#020921]/60 text-white hover:bg-[#071542]/80" 
                                  : "border-slate-300 bg-white text-black hover:bg-slate-50"
                              )}
                            >
                              {/* Card Header */}
                              <div className="manifest-product-card__header flex justify-between items-center pb-2 border-b border-dashed border-inherit">
                                <div className="manifest-product-card__meta flex items-center gap-2">
                                  <span className="manifest-product-card__line-tag font-mono text-[9px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary font-black uppercase">
                                    Line {String(idx + 1).padStart(2, "0")}
                                  </span>
                                  <span className="manifest-product-card__barcode font-mono text-[9px] font-bold opacity-60">
                                    {itemBarcode}
                                  </span>
                                </div>
                                <span className="manifest-product-card__total font-mono font-black text-xs text-brand-primary">
                                  {formatCurrency(itemTotal, currency)}
                                </span>
                              </div>

                              {/* Product Info */}
                              <div className="manifest-product-card__body flex flex-col gap-1">
                                <p className="manifest-product-card__name font-black text-xs uppercase tracking-wide leading-tight">
                                  {item.name}
                                </p>
                                <div className="manifest-product-card__details flex justify-between items-center mt-1 text-[10px] font-semibold opacity-80 font-mono">
                                  <span>Qty: {itemQty}</span>
                                  <span>Price: {formatCurrency(itemPrice, currency)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {(!initiatingPresale.items || initiatingPresale.items.length === 0) && (
                          /* BLOCK: Empty Manifest Product Mobile Card */
                          <div className={cn(
                            "manifest-product-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                            theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                          )}>
                            <Package size={54} strokeWidth={1.5} className={cn("manifest-product-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                            <p className={cn("manifest-product-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                              No Items Found In Manifest
                            </p>
                            <p className={cn("manifest-product-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                              No itemized presale data found
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Valuation & Payment Selection */}
                    <div className="space-y-5">
                      {/* BLOCK: Liquidation Valuation Card - Handles display of total asset evaluation and staff operator */}
                      <div
                        className={cn(
                          "liquidation-valuation-card p-5 rounded-2xl border flex items-center justify-between shadow-lg relative overflow-hidden",
                          theme === "dark"
                            ? "bg-gradient-to-br from-[#040e33] to-[#010619] border-[#123ebd]/30 text-white"
                            : "bg-gradient-to-br from-slate-50 via-white to-slate-100/50 border-slate-200 text-black",
                        )}
                      >
                        {/* Elegant background highlight */}
                        <div className="liquidation-valuation-card__highlight absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="liquidation-valuation-card__content relative z-10">
                          <p className={cn(
                            "liquidation-valuation-card__label text-[10px] font-black uppercase tracking-wider mb-1",
                            theme === "dark" ? "text-[#00E5FF] opacity-80" : "text-[#062A95]/80"
                          )}>
                            Total Valuation
                          </p>
                          <p className="liquidation-valuation-card__value text-3xl font-extrabold tracking-tight text-brand-primary drop-shadow-[0_2px_10px_rgba(34,211,238,0.15)]">
                            {formatCurrency(initiatingPresale.amount, currency)}
                          </p>
                        </div>
                        <div className="liquidation-valuation-card__operator text-right relative z-10">
                          <p className="liquidation-valuation-card__operator-label text-[9px] font-black uppercase opacity-50 mb-1 tracking-wider">
                            Customer
                          </p>
                          <p className={cn(
                            "liquidation-valuation-card__operator-value text-xs font-black uppercase px-2.5 py-1 rounded-md border",
                            theme === "dark" 
                              ? "bg-black/30 border-white/10 text-white" 
                              : "bg-white/80 border-slate-300 text-black"
                          )}>
                            {initiatingPresale.operator ||
                              initiatingPresale.op ||
                              "Terminal Staff"}
                          </p>
                        </div>
                      </div>

                      {/* Select Settlement Method - REDESIGNED */}
                      <div className={cn(
                        "p-5 rounded-2xl border space-y-4 shadow-md transition-all duration-300",
                        theme === "dark"
                          ? "bg-gradient-to-br from-[#040e33] to-[#010619] border-[#123ebd]/30"
                          : "bg-gradient-to-br from-slate-50 via-white to-slate-100/50 border-slate-200"
                      )}>
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                          theme === "dark" ? "text-[#00E5FF]/90" : "text-[#062A95]/90"
                        )}>
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                          Select Settlement Method
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            {
                              id: "cash",
                              label: "CASH SETTLEMENT",
                              icon: Banknote,
                            },
                            { id: "card", label: "CARD PAYMENT", icon: CreditCard },
                            { id: "upi", label: "UPI / QR SCAN", icon: QrCode },
                            { id: "other", label: "OTHER", icon: Smartphone },
                          ].map((method) => {
                            const IconComponent = method.icon;
                            const isSelected = selectedPaymentMethod === method.id;
                            return (
                              <button
                                key={method.id}
                                onClick={() =>
                                  setSelectedPaymentMethod(method.id as any)
                                }
                                type="button"
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-300 cursor-pointer text-left relative overflow-hidden group",
                                  isSelected
                                    ? theme === "dark"
                                      ? "bg-brand-primary border-brand-primary text-black font-black shadow-[0_0_15px_rgba(34,211,238,0.25)] scale-[1.01]"
                                      : "bg-brand-primary border-brand-primary text-white font-black shadow-md scale-[1.01]"
                                    : theme === "dark"
                                      ? "bg-[#020921]/60 border-white/10 text-slate-300 hover:bg-[#071542]/80 hover:border-brand-primary/40 hover:text-white"
                                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-[#062A95]/40 hover:text-black",
                                )}
                              >
                                {isSelected && (
                                  <div className={cn(
                                    "absolute top-0 right-0 w-8 h-8 rounded-bl-full flex items-center justify-center pointer-events-none",
                                    theme === "dark" ? "bg-black/5" : "bg-white/10"
                                  )}>
                                    <div className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      theme === "dark" ? "bg-black/60" : "bg-white/80"
                                    )} />
                                  </div>
                                )}
                                <div className={cn(
                                  "p-1.5 rounded-lg transition-colors",
                                  isSelected 
                                    ? theme === "dark"
                                      ? "bg-black/10 text-black" 
                                      : "bg-white/10 text-white"
                                    : theme === "dark"
                                      ? "bg-[#0c1a44] text-[#00E5FF]"
                                      : "bg-slate-100 text-[#062A95]"
                                )}>
                                  <IconComponent
                                    size={15}
                                    className={cn(isSelected && "animate-pulse")}
                                  />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                  {method.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {selectedPaymentMethod === "cash" && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              "p-3 rounded-xl border space-y-3 mt-1",
                              theme === "dark"
                                ? "bg-black/30 border-white/30"
                                : "bg-gray-50 border-slate-400",
                            )}
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label
                                  className={cn(
                                    "block text-[11px] font-black uppercase tracking-widest mb-1.5",
                                    theme === "dark"
                                      ? "text-dark-muted"
                                      : "text-[#666]",
                                  )}
                                >
                                  Amount Tendered
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm opacity-50 text-dark-muted">
                                    {currency === "USD" ? "$" : "R"}
                                  </span>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    placeholder="0.00"
                                    value={presaleTenderedAmount}
                                    onChange={(e) =>
                                      setPresaleTenderedAmount(e.target.value)
                                    }
                                    className={cn(
                                      "w-full pl-8 pr-1.5 py-2 rounded-lg border font-mono font-bold text-sm outline-none transition-all",
                                      theme === "dark"
                                        ? "bg-black border-white/30 focus:border-brand-primary text-white"
                                        : "bg-white border-slate-400 focus:border-black text-black",
                                    )}
                                    autoFocus
                                  />
                                </div>
                              </div>

                              <div>
                                <label
                                  className={cn(
                                    "block text-[11px] font-black uppercase tracking-widest mb-1.5",
                                    theme === "dark"
                                      ? "text-dark-muted"
                                      : "text-[#666]",
                                  )}
                                >
                                  Change Due
                                </label>
                                <div
                                  className={cn(
                                    "w-full px-4 py-2 rounded-lg border font-mono font-bold text-sm flex items-center justify-between",
                                    theme === "dark"
                                      ? "bg-black/20 border-white/30 text-green-400"
                                      : "bg-white border-slate-400 text-green-600",
                                  )}
                                >
                                  <span className="text-sm">{currency === "USD" ? "$" : "R"}</span>
                                  <span className="text-sm">
                                    {(() => {
                                      const tendered =
                                        parseFloat(presaleTenderedAmount) || 0;
                                      const change = Math.max(
                                        0,
                                        tendered - initiatingPresale.amount,
                                      );
                                      return change.toFixed(2);
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="py-2 px-6 md:px-8 border-t border-solid shrink-0 flex flex-row justify-end gap-3 w-full bg-inherit">
                  <button
                    onClick={() => setInitiatingPresale(null)}
                    className={cn(
                      "flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer border-2 min-w-[130px]",
                      theme === "dark" 
                        ? "bg-black/40 border-white/30 text-white hover:bg-gray-950" 
                        : "bg-white border-slate-300 text-black hover:bg-gray-50"
                    )}
                  >
                    Abort
                  </button>
                  <button
                    onClick={() => handleApprovePresale(initiatingPresale)}
                    disabled={
                      loading ||
                      (selectedPaymentMethod === "cash" &&
                        (!presaleTenderedAmount ||
                          parseFloat(presaleTenderedAmount) <
                            initiatingPresale.amount))
                    }
                    className={cn(
                      "flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer min-w-[130px]",
                      selectedPaymentMethod === "cash" &&
                        (!presaleTenderedAmount ||
                          parseFloat(presaleTenderedAmount) <
                            initiatingPresale.amount)
                        ? "bg-gray-300 text-gray-500 border border-gray-300 opacity-50 cursor-not-allowed"
                        : theme === "dark"
                          ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                          : "bg-black text-white hover:bg-neutral-800 shadow-black/10",
                    )}
                  >
                    {loading ? (
                      <RefreshCw className="animate-spin" size={12} />
                    ) : (
                      <>
                        <CheckCircle size={12} />
                        Confirm
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Success Transaction Overlay */}
          {finalizationSuccess && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 bg-black/20 backdrop-blur-[2px]">
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "w-[92%] sm:w-[85%] md:w-full max-w-md border rounded-2xl p-10 text-center shadow-2xl space-y-8 relative z-[221]",
                  theme === "dark"
                    ? "bg-[#141414] border-[#222]"
                    : "bg-white border-[#EEE]",
                )}
              >
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        damping: 12,
                        stiffness: 200,
                        delay: 0.2,
                      }}
                      className="w-24 h-24 rounded-xl bg-green-500 flex items-center justify-center text-white"
                    >
                      <CheckCircle size={48} />
                    </motion.div>
                  </div>
                  <h2 className="text-3xl font-black uppercase  tracking-tighter text-green-500">
                    Operation Successful
                  </h2>
                  <p className="text-sm font-black uppercase tracking-widest mb-1">
                    Presale Finalized
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                    Reference ID:{" "}
                    <span className="font-mono text-inherit font-bold">
                      {finalizationSuccess.id}
                    </span>
                  </p>

                  {presaleLastTendered !== null &&
                    presaleLastTendered !== undefined && (
                      <div
                        className={cn(
                          "p-4 rounded-xl border text-left space-y-2 mt-4",
                          theme === "dark"
                            ? "bg-black/40 border-white/30"
                            : "bg-gray-100/60 border-slate-400",
                        )}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#888]">
                          Cash Settlement Breakdown
                        </p>
                        <div className="flex justify-between font-mono text-sm">
                          <span className="opacity-60">Tendered:</span>
                          <span
                            className={cn(
                              "font-extrabold",
                              theme === "dark" ? "text-white" : "text-black",
                            )}
                          >
                            {formatCurrency(presaleLastTendered, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-sm border-t border-inherit/25 pt-2">
                          <span className="opacity-60 text-green-500 font-bold">
                            Change Due:
                          </span>
                          <span className="font-extrabold text-green-500">
                            {formatCurrency(presaleLastChange ?? 0, currency)}
                          </span>
                        </div>
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      generatePresaleReceiptPDF(finalizationSuccess);
                    }}
                    className={cn(
                      "success-card__btn success-card__btn--print flex items-center justify-center gap-3 py-5 rounded-lg font-black uppercase tracking-widest text-[10px] border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm",
                      theme === "dark"
                        ? "bg-[#222] border-[#333] text-white hover:bg-[#333]"
                        : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200",
                    )}
                  >
                    <Printer size={18} />
                    Print Receipt
                  </button>
                  <button
                    onClick={() => {
                      setFinalizationSuccess(null);
                      setActiveTab("returns"); // Switch to Returns / History tab which contains standard transactional history
                    }}
                    className={cn(
                      "success-card__btn success-card__btn--history flex items-center justify-center gap-3 py-5 rounded-lg font-black uppercase tracking-widest text-[10px] border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm",
                      theme === "dark"
                        ? "bg-[#222] border-[#333] text-white hover:bg-[#333]"
                        : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200",
                    )}
                  >
                    <Eye size={18} />
                    View History
                  </button>
                </div>

                <button
                  onClick={() => setFinalizationSuccess(null)}
                  className={cn(
                    "success-card__btn success-card__btn--resume w-full py-6 rounded-lg font-black uppercase tracking-[0.3em] text-sm transition-all shadow-xl active:scale-95 cursor-pointer",
                    theme === "dark"
                      ? "bg-brand-primary text-black shadow-brand-primary/20 hover:brightness-110"
                      : "bg-[#062A95] text-white hover:bg-[#062A95]/90 shadow-black/10",
                  )}
                >
                  Accept & Resume
                </button>
              </motion.div>
            </div>
          )}

          {/* Create Return Modal */}
          {isReturnModalOpen && selectedTransactionForReturn && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="create-return-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card create-return-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
                  theme === "dark"
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
                )}
              >
                {/* Top Accent Strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse w-full z-30" />

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
                        theme === 'dark' ? "bg-black/40 border-dark-border text-red-500" : "bg-white border-light-border text-red-500"
                      )}>
                        <RotateCcw size={16} className="text-red-500" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-red-400" : "text-[#062A95]"
                      )}>
                        Process Return
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        #{selectedTransactionForReturn.id}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsReturnModalOpen(false);
                          setSelectedTransactionForReturn(null);
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

                <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      Select Items for Reversal
                    </h3>
                    {selectedTransactionForReturn.items.map((item: any) => (
                      <div
                        key={item.id}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all flex items-center justify-between",
                          returnItems[item.id]?.selected
                            ? theme === "dark"
                              ? "bg-red-500/10 border-red-500"
                              : "bg-red-50 border-red-500"
                            : theme === "dark"
                              ? "bg-black/20 border-white/30"
                              : "bg-gray-50 border-slate-400",
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            onClick={() =>
                              setReturnItems({
                                ...returnItems,
                                [item.id]: {
                                  ...returnItems[item.id],
                                  selected: !returnItems[item.id].selected,
                                },
                              })
                            }
                            className={cn(
                              "w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                              returnItems[item.id]?.selected
                                ? "bg-red-500 border-red-500 text-white"
                                : "border-inherit",
                            )}
                          >
                            {returnItems[item.id]?.selected && (
                              <RotateCcw size={12} />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">
                              {item.name}
                            </p>
                            <p className="text-[10px] opacity-40 font-bold">
                              Purchase Value:{" "}
                              {formatCurrency(item.price, currency)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <label className="text-[8px] font-black uppercase opacity-40 mb-1">
                              Return Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              max={item.quantity}
                              value={returnItems[item.id]?.quantity || 1}
                              onChange={(e) =>
                                setReturnItems({
                                  ...returnItems,
                                  [item.id]: {
                                    ...returnItems[item.id],
                                    quantity: Math.min(
                                      item.quantity,
                                      Math.max(
                                        1,
                                        parseInt(e.target.value) || 0,
                                      ),
                                    ),
                                  },
                                })
                              }
                              className={cn(
                                "w-20 px-3 py-2 rounded-lg border-2 text-center font-mono font-black text-xs outline-none focus:border-red-500 transition-colors",
                                theme === "dark"
                                  ? "bg-black/40 border-white/30 text-white"
                                  : "bg-white border-slate-400 text-black",
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4 pt-6 border-t border-inherit">
                    <h3 className="text-[10px] font-black uppercase tracking-widest opacity-40">
                      Justification / Reason
                    </h3>
                    <textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="State the reason for return (e.g. Defective, Damage, Choice)..."
                      className={cn(
                        "w-full h-32 p-4 rounded-xl border-2 text-xs font-bold resize-none outline-none transition-all uppercase tracking-widest",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 focus:border-red-500 text-white"
                          : "bg-gray-50 border-slate-400 focus:border-red-500 text-black shadow-inner",
                      )}
                    />
                  </div>
                </div>

                <div className="p-8 border-t border-inherit shrink-0 flex items-center justify-between backdrop-blur-xl">
                  <div>
                    <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                      Total Reversal Credit
                    </p>
                    <p className="text-2xl font-black  tracking-tighter text-red-500">
                      {formatCurrency(
                        selectedTransactionForReturn.items
                          .filter((item: any) => returnItems[item.id]?.selected)
                          .reduce(
                            (acc: number, item: any) =>
                              acc + item.price * returnItems[item.id].quantity,
                            0,
                          ),
                        currency,
                      )}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setIsReturnModalOpen(false);
                        setSelectedTransactionForReturn(null);
                      }}
                      className="px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all uppercase cursor-pointer"
                    >
                      Cancel Request
                    </button>
                    <button
                      onClick={handleReturn}
                      className="px-10 py-4 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      Authorize Reversal
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {/* Expenditure Menu */}
          {expenditureMenuAnchor && (
            <motion.div
              key="expenditure-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150]"
              onClick={() => setExpenditureMenuAnchor(null)}
            />
          )}
          {expenditureMenuAnchor && (
            <motion.div
              key="expenditure-menu"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              style={{
                top: Math.min(expenditureMenuAnchor.y, window.innerHeight - 200),
                left: Math.max(
                  10,
                  Math.min(
                    window.innerWidth - 200,
                    expenditureMenuAnchor.x - 180,
                  ),
                ),
              }}
              className={cn(
                "fixed z-[151] w-48 rounded-xl border shadow-hard p-1 backdrop-blur-md overflow-hidden",
                theme === "dark"
                  ? "bg-dark-surface/90 border-white/30 text-white"
                  : "bg-white/90 border-slate-400 text-black",
              )}
            >
              <button
                onClick={() => {
                  const exp = expenditures.find(
                    (e) => e.id === expenditureMenuAnchor.id,
                  );
                  setViewingExpenditure(exp);
                  setExpenditureMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-inherit cursor-pointer",
                  theme === "dark" ? "hover:bg-white/5" : "hover:bg-black/5",
                )}
              >
                <Eye size={14} /> View Details
              </button>
              <button
                onClick={() => {
                  const exp = expenditures.find(
                    (e) => e.id === expenditureMenuAnchor.id,
                  );
                  if (exp) {
                    setEditEntryId(exp.id);
                    setEditDescription(exp.description || "");
                    setEditCategory(exp.category || "Operational");
                    setEditAmount(String(exp.amount || ""));
                    let d = "";
                    try {
                      const ms = getTimestampMs(exp);
                      if (ms) {
                        d = format(new Date(ms), "yyyy-MM-dd");
                      }
                    } catch (err) {}
                    setEditDate(d || format(new Date(), "yyyy-MM-dd"));
                    setEditEntryTab("expenditure");
                    setIsEditEntryModalOpen(true);
                  }
                  setExpenditureMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-blue-500 cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-blue-500/10"
                    : "hover:bg-blue-50",
                )}
              >
                <Pencil size={14} /> Edit Expense
              </button>
              <button
                onClick={() => {
                  if (expenditureMenuAnchor) {
                    setConfirmActionItem({
                      id: expenditureMenuAnchor.id,
                      type: 'delete_expenditure',
                      title: 'Delete Expenditure?',
                      subtitle: 'Audit Action Alert',
                      message: 'Are you sure you want to permanently remove this expenditure record from system logs?'
                    });
                  }
                  setExpenditureMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-red-500 cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-red-500/10"
                    : "hover:bg-red-50",
                )}
              >
                <Trash2 size={14} /> Delete Expense
              </button>
            </motion.div>
          )}

          {/* View Expenditure Modal */}
          {viewingExpenditure && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="view-expenditure-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card view-expenditure-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
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
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <TrendingDown size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Expense Audit
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        #{viewingExpenditure.id}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setViewingExpenditure(null)}
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

                {/* Scrollable Contents (Body) */}
                <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col min-h-0">
                  <div className="space-y-4 flex-1">
                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Description / Vendor
                      </p>
                      <p className="text-sm font-black uppercase tracking-wider text-inherit">
                        {viewingExpenditure.description}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Category Classification
                      </p>
                      <span className="self-start px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500">
                        {viewingExpenditure.category || "Operational"}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Record Timestamp
                      </p>
                      <p className="font-mono text-xs font-bold text-inherit uppercase">
                        {(() => {
                          try {
                            const ms = getTimestampMs(viewingExpenditure);
                            if (ms) return format(new Date(ms), "yyyy-MM-dd HH:mm:ss");
                          } catch (e) {}
                          return "N/A";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fixed Bottom Action Panel */}
                <div className={cn(
                  "p-3.5 px-6 md:px-8 border-t border-inherit flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shrink-0 bg-transparent pb-safe"
                )}>
                  <div className={cn(
                    "px-3.5 pt-2 pb-1.5 rounded-xl flex flex-col lg:flex-row lg:items-baseline lg:gap-2 shadow-sm bg-white text-black"
                  )}>
                    <p className={cn(
                      "text-[8px] uppercase font-black tracking-widest whitespace-nowrap",
                      theme === 'dark' ? "text-slate-500" : "opacity-50"
                    )}>
                      Deficit Outflow
                    </p>
                    <h4 className="text-sm md:text-base font-mono font-black text-brand-primary">
                      {formatCurrency(viewingExpenditure.amount, currency)}
                    </h4>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const doc = new jsPDF();
                        doc.setFontSize(20);
                        doc.text("EXPENSE VOUCHER", 10, 20);
                        doc.setFontSize(10);
                        doc.text(`Voucher ID: ${viewingExpenditure.id}`, 10, 30);
                        doc.text(`Description: ${viewingExpenditure.description}`, 10, 40);
                        doc.text(`Category: ${viewingExpenditure.category || "Operational"}`, 10, 50);
                        doc.text(`Amount: ${formatCurrency(viewingExpenditure.amount, currency)}`, 10, 60);
                        try {
                          const ms = getTimestampMs(viewingExpenditure);
                          if (ms) {
                            doc.text(`Date: ${format(new Date(ms), "yyyy-MM-dd HH:mm:ss")}`, 10, 70);
                          }
                        } catch (e) {}
                        doc.save(`Expense_${viewingExpenditure.id}.pdf`);
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
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Revenue Menu */}
          {revenueMenuAnchor && (
            <motion.div
              key="revenue-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150]"
              onClick={() => setRevenueMenuAnchor(null)}
            />
          )}
          {revenueMenuAnchor && (
            <motion.div
              key="revenue-menu"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              style={{
                top: Math.min(revenueMenuAnchor.y, window.innerHeight - 200),
                left: Math.max(
                  10,
                  Math.min(
                    window.innerWidth - 200,
                    revenueMenuAnchor.x - 180,
                  ),
                ),
              }}
              className={cn(
                "fixed z-[151] w-48 rounded-xl border shadow-hard p-1 backdrop-blur-md overflow-hidden",
                theme === "dark"
                  ? "bg-dark-surface/90 border-white/30 text-white"
                  : "bg-white/90 border-slate-400 text-black",
              )}
            >
              <button
                onClick={() => {
                  const rev = revenue.find(
                    (r) => r.id === revenueMenuAnchor.id,
                  );
                  setViewingRevenue(rev);
                  setRevenueMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-inherit cursor-pointer",
                  theme === "dark" ? "hover:bg-white/5" : "hover:bg-black/5",
                )}
              >
                <Eye size={14} /> View Details
              </button>
              <button
                onClick={() => {
                  const rev = revenue.find(
                    (r) => r.id === revenueMenuAnchor.id,
                  );
                  if (rev) {
                    setEditEntryId(rev.id);
                    setEditDescription(rev.source || "");
                    setEditCategory("Operational");
                    setEditAmount(String(rev.amount || ""));
                    let d = "";
                    try {
                      const ms = getTimestampMs(rev);
                      if (ms) {
                        d = format(new Date(ms), "yyyy-MM-dd");
                      }
                    } catch (err) {}
                    setEditDate(d || format(new Date(), "yyyy-MM-dd"));
                    setEditEntryTab("revenue");
                    setIsEditEntryModalOpen(true);
                  }
                  setRevenueMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-blue-500 cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-blue-500/10"
                    : "hover:bg-blue-50",
                )}
              >
                <Pencil size={14} /> Edit Revenue
              </button>
              <button
                onClick={() => {
                  if (revenueMenuAnchor) {
                    setConfirmActionItem({
                      id: revenueMenuAnchor.id,
                      type: 'delete_revenue',
                      title: 'Delete Revenue Entry?',
                      subtitle: 'Audit Action Alert',
                      message: 'Are you sure you want to permanently remove this revenue record from system logs?'
                    });
                  }
                  setRevenueMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-red-500 cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-red-500/10"
                    : "hover:bg-red-50",
                )}
              >
                <Trash2 size={14} /> Delete Revenue
              </button>
            </motion.div>
          )}

          {/* View Revenue Modal */}
          {viewingRevenue && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="view-revenue-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card view-revenue-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
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
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <TrendingUp size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Inflow Audit
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        #{viewingRevenue.id}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setViewingRevenue(null)}
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

                {/* Scrollable Contents (Body) */}
                <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col min-h-0">
                  <div className="space-y-4 flex-1">
                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Source Description
                      </p>
                      <p className="text-sm font-black uppercase tracking-wider text-inherit">
                        {viewingRevenue.source}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Category Classification
                      </p>
                      <span className="self-start px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500">
                        Inflow
                      </span>
                    </div>

                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Record Timestamp
                      </p>
                      <p className="font-mono text-xs font-bold text-inherit uppercase">
                        {(() => {
                          try {
                            const ms = getTimestampMs(viewingRevenue);
                            if (ms) return format(new Date(ms), "yyyy-MM-dd HH:mm:ss");
                          } catch (e) {}
                          return "N/A";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fixed Bottom Action Panel */}
                <div className={cn(
                  "p-3.5 px-6 md:px-8 border-t border-inherit flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shrink-0 bg-transparent pb-safe"
                )}>
                  <div className={cn(
                    "px-3.5 pt-2 pb-1.5 rounded-xl flex flex-col lg:flex-row lg:items-baseline lg:gap-2 shadow-sm bg-white text-black"
                  )}>
                    <p className={cn(
                      "text-[8px] uppercase font-black tracking-widest whitespace-nowrap",
                      theme === 'dark' ? "text-slate-500" : "opacity-50"
                    )}>
                      Inflow Amount
                    </p>
                    <h4 className="text-sm md:text-base font-mono font-black text-brand-primary">
                      {formatCurrency(viewingRevenue.amount, currency)}
                    </h4>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const doc = new jsPDF();
                        doc.setFontSize(20);
                        doc.text("INFLOW VOUCHER", 10, 20);
                        doc.setFontSize(10);
                        doc.text(`Voucher ID: ${viewingRevenue.id}`, 10, 30);
                        doc.text(`Source: ${viewingRevenue.source}`, 10, 40);
                        doc.text(`Classification: Inflow`, 10, 50);
                        doc.text(`Amount: ${formatCurrency(viewingRevenue.amount, currency)}`, 10, 60);
                        try {
                          const ms = getTimestampMs(viewingRevenue);
                          if (ms) {
                            doc.text(`Date: ${format(new Date(ms), "yyyy-MM-dd HH:mm:ss")}`, 10, 70);
                          }
                        } catch (e) {}
                        doc.save(`Revenue_${viewingRevenue.id}.pdf`);
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
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Balances Menu */}
          {balancesMenuAnchor && (
            <motion.div
              key="balances-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150]"
              onClick={() => setBalancesMenuAnchor(null)}
            />
          )}
          {balancesMenuAnchor && (
            <motion.div
              key="balances-menu"
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              style={{
                top: Math.min(balancesMenuAnchor.y, window.innerHeight - 200),
                left: Math.max(
                  10,
                  Math.min(
                    window.innerWidth - 200,
                    balancesMenuAnchor.x - 180,
                  ),
                ),
              }}
              className={cn(
                "fixed z-[151] w-48 rounded-xl border shadow-hard p-1 backdrop-blur-md overflow-hidden",
                theme === "dark"
                  ? "bg-dark-surface/90 border-white/30 text-white"
                  : "bg-white/90 border-slate-400 text-black",
              )}
            >
              <button
                onClick={() => {
                  const bal = balances.find(
                    (b) => b.id === balancesMenuAnchor.id,
                  );
                  setViewingBalance(bal);
                  setBalancesMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-inherit cursor-pointer",
                  theme === "dark" ? "hover:bg-white/5" : "hover:bg-black/5",
                )}
              >
                <Eye size={14} /> View Details
              </button>
              <button
                onClick={() => {
                  const bal = balances.find(
                    (b) => b.id === balancesMenuAnchor.id,
                  );
                  if (bal) {
                    setEditEntryId(bal.id);
                    setEditDescription(bal.description || "");
                    setEditCategory("Operational");
                    setEditAmount(String(bal.amount || ""));
                    let d = "";
                    try {
                      const ms = getTimestampMs(bal);
                      if (ms) {
                        d = format(new Date(ms), "yyyy-MM-dd");
                      }
                    } catch (err) {}
                    setEditDate(d || format(new Date(), "yyyy-MM-dd"));
                    setEditEntryTab("balances");
                    setIsEditEntryModalOpen(true);
                  }
                  setBalancesMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-blue-500 cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-blue-500/10"
                    : "hover:bg-blue-50",
                )}
              >
                <Pencil size={14} /> Edit Balance
              </button>
              <button
                onClick={() => {
                  if (balancesMenuAnchor) {
                    setConfirmActionItem({
                      id: balancesMenuAnchor.id,
                      type: 'delete_balance',
                      title: 'Delete Balance Entry?',
                      subtitle: 'Audit Action Alert',
                      message: 'Are you sure you want to permanently remove this balance adjustment record?'
                    });
                  }
                  setBalancesMenuAnchor(null);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all text-red-500 cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-red-500/10"
                    : "hover:bg-red-50",
                )}
              >
                <Trash2 size={14} /> Delete Balance
              </button>
            </motion.div>
          )}

          {/* View Balance Modal */}
          {viewingBalance && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="view-balance-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card view-balance-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 rounded-2xl border shadow-2xl overflow-hidden flex flex-col",
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
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        <TrendingUp size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Balance Audit
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        #{viewingBalance.id}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setViewingBalance(null)}
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

                {/* Scrollable Contents (Body) */}
                <div className="p-6 md:p-8 font-presale overflow-y-auto no-scrollbar flex-1 flex flex-col min-h-0">
                  <div className="space-y-4 flex-1">
                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Designation / Account Name
                      </p>
                      <p className="text-sm font-black uppercase tracking-wider text-inherit">
                        {viewingBalance.description}
                      </p>
                    </div>

                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Category Classification
                      </p>
                      <span className="self-start px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-brand-primary/10 text-brand-primary">
                        Account Balance
                      </span>
                    </div>

                    <div
                      className={cn(
                        "p-5 rounded-xl border flex flex-col gap-1.5",
                        theme === "dark"
                          ? "bg-black/20 border-white/30 text-white"
                          : "bg-gray-50 border-slate-400 text-black",
                      )}
                    >
                      <p className="text-[10px] uppercase font-black opacity-30 tracking-widest">
                        Record Timestamp
                      </p>
                      <p className="font-mono text-xs font-bold text-inherit uppercase">
                        {(() => {
                          try {
                            const ms = getTimestampMs(viewingBalance);
                            if (ms) return format(new Date(ms), "yyyy-MM-dd HH:mm:ss");
                          } catch (e) {}
                          return "N/A";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fixed Bottom Action Panel */}
                <div className={cn(
                  "p-3.5 px-6 md:px-8 border-t border-inherit flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 shrink-0 bg-transparent pb-safe"
                )}>
                  <div className={cn(
                    "px-3.5 pt-2 pb-1.5 rounded-xl flex flex-col lg:flex-row lg:items-baseline lg:gap-2 shadow-sm bg-white text-black"
                  )}>
                    <p className={cn(
                      "text-[8px] uppercase font-black tracking-widest whitespace-nowrap",
                      theme === 'dark' ? "text-slate-500" : "opacity-50"
                    )}>
                      Liquid Value
                    </p>
                    <h4 className="text-sm md:text-base font-mono font-black text-brand-primary">
                      {formatCurrency(viewingBalance.amount, currency)}
                    </h4>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        const doc = new jsPDF();
                        doc.setFontSize(20);
                        doc.text("BALANCE VOUCHER", 10, 20);
                        doc.setFontSize(10);
                        doc.text(`Voucher ID: ${viewingBalance.id}`, 10, 30);
                        doc.text(`Designation: ${viewingBalance.description}`, 10, 40);
                        doc.text(`Classification: Account Balance`, 10, 50);
                        doc.text(`Liquid Value: ${formatCurrency(viewingBalance.amount, currency)}`, 10, 60);
                        try {
                          const ms = getTimestampMs(viewingBalance);
                          if (ms) {
                            doc.text(`Date: ${format(new Date(ms), "yyyy-MM-dd HH:mm:ss")}`, 10, 70);
                          }
                        } catch (e) {}
                        doc.save(`Balance_${viewingBalance.id}.pdf`);
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
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Entry Edit Modal Overlay */}
        <AnimatePresence>
          {isEditEntryModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="view-return-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />

              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card view-return-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-20 flex flex-col shadow-2xl border rounded-2xl overflow-hidden",
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
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        {editEntryTab === "expenditure" ? (
                          <TrendingDown size={16} className="text-brand-primary" />
                        ) : editEntryTab === "revenue" ? (
                          <TrendingUp size={16} className="text-brand-primary" />
                        ) : (
                          <Wallet size={16} className="text-brand-primary" />
                        )}
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        {editEntryTab === "expenditure"
                          ? "Edit Expense"
                          : editEntryTab === "revenue"
                            ? "Edit Revenue"
                            : "Edit Account Balance"}
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        (Store Record)
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setIsEditEntryModalOpen(false)}
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

                <form onSubmit={handleEditEntry} className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className={labelClassName}>
                        {editEntryTab === "balances" ? "Designation" : "Description"}
                      </label>
                      {renderInputWithDot(
                        <input
                          type="text"
                          required
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className={inputClassName}
                        />,
                        editDescription,
                      )}
                    </div>

                    {editEntryTab === "expenditure" && (
                      <div className="space-y-2">
                        <label className={labelClassName}>
                          Expense Category
                        </label>
                        {renderInputWithDot(
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className={inputClassName}
                          >
                            <option value="Operational">Operational</option>
                            <option value="Inventory">Inventory</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Salaries">Salaries</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Other">Other</option>
                          </select>,
                          editCategory,
                          undefined,
                          true,
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClassName}>
                          Amount
                        </label>
                        {renderInputWithDot(
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className={cn(inputClassName, "font-mono")}
                          />,
                          editAmount,
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className={labelClassName}>
                          Date Record
                        </label>
                        {renderInputWithDot(
                          <input
                            type="date"
                            required
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className={cn(inputClassName, "font-mono")}
                          />,
                          editDate,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-inherit flex justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditEntryModalOpen(false)}
                      className="px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all focus:outline-none cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={cn(
                        "px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all focus:outline-none cursor-pointer",
                        theme === "dark"
                          ? "bg-cyan-400 text-black shadow-cyan-400/20 hover:bg-cyan-300"
                          : "bg-[#062A95] text-white shadow-[#062A95]/20 hover:bg-opacity-95",
                      )}
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Entry Add Modal Overlay */}
        <AnimatePresence>
          {isAddEntryModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="entry-add-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />

              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card entry-add-popup-card relative w-[92%] sm:w-[85%] md:w-full max-w-xl lg:max-w-2xl h-[75vh] md:h-[82vh] z-[99999] flex flex-col shadow-2xl border rounded-2xl overflow-hidden",
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
                  theme === 'dark' ? "bg-transparent border-b border-white/10" : "bg-transparent border-b border-black/10"
                )}>
                  {/* Top Row: 3-Column Header to match Inventory style */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full gap-4 shrink-0 relative">
                    <div className="flex justify-start">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center border-2 shadow-sm shrink-0",
                        theme === 'dark' ? "bg-black/40 border-dark-border text-brand-primary" : "bg-white border-light-border text-brand-primary"
                      )}>
                        {activeTab === "expenditure" ? (
                          <TrendingDown size={16} className="text-brand-primary" />
                        ) : activeTab === "revenue" ? (
                          <TrendingUp size={16} className="text-brand-primary" />
                        ) : (
                          <Wallet size={16} className="text-brand-primary" />
                        )}
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-presale">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        {activeTab === "expenditure"
                          ? "New Expense"
                          : activeTab === "revenue"
                            ? "New Revenue"
                            : "New Account Balance"}
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        (Store Record)
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => setIsAddEntryModalOpen(false)}
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

                <form onSubmit={handleAddEntry} className="flex-1 p-6 md:p-8 overflow-y-auto no-scrollbar space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    {activeTab === "balances" && (
                      <>
                        <div className="space-y-2">
                          <label className={labelClassName}>Account Type</label>
                          {renderInputWithDot(
                            <select
                              value={addAccountType}
                              onChange={(e) => {
                                const val = e.target.value as "store" | "customer";
                                setAddAccountType(val);
                                if (val === "store") {
                                  setAddSelectedCustomerId("");
                                  setAddDescription("");
                                } else {
                                  setAddDescription("");
                                }
                              }}
                              className={inputClassName}
                            >
                              <option value="store">Store Account</option>
                              <option value="customer">Customer Account</option>
                            </select>,
                            addAccountType,
                            undefined,
                            true,
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className={labelClassName}>Account</label>
                          {renderInputWithDot(
                            addAccountType === "customer" ? (
                              <select
                                required
                                value={addSelectedCustomerId}
                                onChange={(e) => {
                                  const custId = e.target.value;
                                  setAddSelectedCustomerId(custId);
                                  const cust = customers.find((c) => c.id === custId);
                                  if (cust) {
                                    setAddDescription(`CUSTOMER BALANCE - ${cust.name.toUpperCase()}`);
                                  } else {
                                    setAddDescription("");
                                  }
                                }}
                                className={inputClassName}
                              >
                                <option value="">Select Customer Account</option>
                                {customers.map((cust) => {
                                  const formattedId = cust.customerId || `CUST-${cust.id.slice(-6).toUpperCase()}`;
                                  return (
                                    <option key={cust.id} value={cust.id}>
                                      {cust.name} ({formattedId})
                                    </option>
                                  );
                                })}
                              </select>
                            ) : (
                              <select disabled className={cn(inputClassName, "opacity-60")} value="store_main">
                                <option value="store_main">Store Main Account</option>
                              </select>
                            ),
                            addAccountType === "customer" ? addSelectedCustomerId : "store_main",
                            undefined,
                            true,
                          )}
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <label className={labelClassName}>
                        {activeTab === "balances" ? "Designation" : "Description"}
                      </label>
                      {renderInputWithDot(
                        <input
                          type="text"
                          required
                          placeholder={
                            activeTab === "expenditure"
                              ? "e.g., Main power billing"
                              : activeTab === "revenue"
                                ? "e.g., Interest payout"
                                : "e.g., Petty Cash"
                          }
                          value={addDescription}
                          onChange={(e) => setAddDescription(e.target.value)}
                          className={inputClassName}
                        />,
                        addDescription,
                      )}
                    </div>

                    {activeTab === "expenditure" && (
                      <div className="space-y-2">
                        <label className={labelClassName}>
                          Expense Category
                        </label>
                        {renderInputWithDot(
                          <select
                            value={addCategory}
                            onChange={(e) => setAddCategory(e.target.value)}
                            className={inputClassName}
                          >
                            <option value="Operational">Operational</option>
                            <option value="Inventory">Inventory</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Salaries">Salaries</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Other">Other</option>
                          </select>,
                          addCategory,
                          undefined,
                          true,
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className={labelClassName}>
                          Amount
                        </label>
                        {renderInputWithDot(
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            placeholder="0.00"
                            value={addAmount}
                            onChange={(e) => setAddAmount(e.target.value)}
                            className={cn(inputClassName, "font-mono")}
                          />,
                          addAmount,
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className={labelClassName}>
                          Date Record
                        </label>
                        {renderInputWithDot(
                          <input
                            type="date"
                            required
                            value={addDate}
                            onChange={(e) => setAddDate(e.target.value)}
                            className={cn(inputClassName, "font-mono")}
                          />,
                          addDate,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-inherit flex justify-end gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsAddEntryModalOpen(false)}
                      className="px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-50 hover:opacity-100 transition-all focus:outline-none"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={cn(
                        "px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all focus:outline-none",
                        theme === "dark"
                          ? "bg-cyan-400 text-black shadow-cyan-400/20 hover:bg-cyan-300"
                          : "bg-[#062A95] text-white shadow-[#062A95]/20 hover:bg-opacity-95",
                      )}
                    >
                      Save
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Editing Presale Modal */}
        <AnimatePresence>
          {editingPresale && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pt-24 md:p-6 md:pt-28 font-presale">
              <div
                onClick={handleBackdropClick}
                className="edit-presale-popup-card__backdrop absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
              />
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={cn(
                  "popup-card edit-presale-popup-card relative w-[92%] sm:w-[88%] md:w-full max-w-4xl lg:max-w-5xl h-[80vh] md:h-[82vh] z-20 rounded-2xl overflow-hidden shadow-2xl border flex flex-col",
                  theme === "dark"
                    ? "bg-[#020d30]/60 border-[#123ebd] backdrop-blur-lg text-white"
                    : "bg-white/60 border-slate-300 backdrop-blur-lg text-black",
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
                        <Pencil size={16} className="text-brand-primary" />
                      </div>
                    </div>

                    <div className="text-center flex flex-col items-center justify-center font-sans">
                      <h3 className={cn(
                        "text-[13px] font-black uppercase tracking-[0.25em] text-center max-w-[160px] sm:max-w-none leading-tight",
                        theme === 'dark' ? "text-cyan-400" : "text-[#062A95]"
                      )}>
                        Modify Entry
                      </h3>
                      <span className="text-[9px] font-mono uppercase tracking-widest opacity-60 mt-1.5 text-center px-1">
                        #{editingPresale.id}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingPresale(null);
                          setEditPresaleSearchQuery("");
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

                {/* Main scrollable body split into left & right panes */}
                <form
                  onSubmit={handleUpdatePresale}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto lg:overflow-hidden p-4 sm:p-6 flex flex-col lg:flex-row gap-6 min-h-0">
                    {/* LEFT PANEL: Logistical Catalog Selection (styled exactly like Barcode Management) */}
                    <div className="w-full lg:w-5/12 flex flex-col min-h-[300px] lg:min-h-0 overflow-hidden lg:h-full">
                      <div className="mb-3 shrink-0">
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest opacity-80 mb-1">
                          Catalog Inventory
                        </h3>
                        <p className="text-[9px] font-mono opacity-50 uppercase tracking-widest">
                          Select products to add to this order
                        </p>
                      </div>

                      {/* Search Bar - styled like barcode design */}
                      <div className="relative mb-3 shrink-0">
                        <Search
                          className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30"
                          size={16}
                        />
                        <input
                          type="text"
                          value={editPresaleSearchQuery || ""}
                          onChange={(e) =>
                            setEditPresaleSearchQuery(e.target.value)
                          }
                          placeholder="Search products to add..."
                          className={cn(
                            "w-full border-2 pl-9 pr-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest outline-none transition-all",
                            theme === "dark"
                              ? "bg-black/20 border-[#333] focus:border-brand-primary text-white"
                              : "bg-gray-50 border-[#EEE] focus:border-black text-black",
                          )}
                        />
                      </div>

                      {/* Scrollable list of products matching search */}
                      <div
                        className={cn(
                          "border rounded-xl flex-1 overflow-y-auto no-scrollbar min-h-[200px] lg:h-full",
                          theme === "dark"
                            ? "border-white/30"
                            : "border-slate-400",
                        )}
                      >
                        {products.filter(
                          (p) =>
                            !editPresaleSearchQuery ||
                            p.name
                              .toLowerCase()
                              .includes(editPresaleSearchQuery.toLowerCase()),
                        ).length === 0 ? (
                          /* BLOCK: Empty Presale Product Search Card */
                          <div className={cn(
                            "presale-product-search-empty-card p-8 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 my-2",
                            theme === "dark" ? "bg-dark-surface/40 border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                          )}>
                            <Package size={42} strokeWidth={1.5} className={cn("presale-product-search-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                            <p className={cn("presale-product-search-empty-card__title text-sm font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                              No Matching Products
                            </p>
                            <p className={cn("presale-product-search-empty-card__subtitle text-xs font-presale tracking-wide mt-0.5", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                              Try adjusting your search criteria
                            </p>
                          </div>
                        ) : (
                          products
                            .filter(
                              (p) =>
                                !editPresaleSearchQuery ||
                                p.name
                                  .toLowerCase()
                                  .includes(
                                    editPresaleSearchQuery.toLowerCase(),
                                  ),
                            )
                            .map((p) => {
                              const matchedItem = (
                                editingPresale.items || []
                              ).find((i: any) => i.id === p.id);
                              const qCount = matchedItem
                                ? matchedItem.quantity
                                : 0;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    const currentItems = [
                                      ...(editingPresale.items || []),
                                    ];
                                    const existingIdx = currentItems.findIndex(
                                      (i) => i.id === p.id,
                                    );
                                    if (existingIdx >= 0) {
                                      currentItems[existingIdx].quantity += 1;
                                    } else {
                                      currentItems.push({
                                        id: p.id,
                                        name: p.name,
                                        price: p.price,
                                        quantity: 1,
                                      });
                                    }
                                    const newAmount = currentItems.reduce(
                                      (s, i) => s + i.price * i.quantity,
                                      0,
                                    );
                                    setEditingPresale({
                                      ...editingPresale,
                                      items: currentItems,
                                      amount: newAmount,
                                    });
                                  }}
                                  className={cn(
                                    "flex items-center justify-between p-3 border-b last:border-b-0 transition-all gap-4 cursor-pointer select-none group",
                                    theme === "dark"
                                      ? "border-white/10 hover:bg-white/5 text-white"
                                      : "border-slate-200 hover:bg-gray-50 text-black",
                                    qCount > 0
                                      ? theme === "dark"
                                        ? "bg-brand-primary/5 border-l-4 border-l-brand-primary pl-2.5"
                                        : "bg-black/5 border-l-4 border-l-black pl-2.5"
                                      : "",
                                  )}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {p.imageUrl ? (
                                      <img
                                        src={p.imageUrl}
                                        alt=""
                                        className="w-8 h-8 rounded-lg object-cover bg-black shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                                        <Package size={14} />
                                      </div>
                                    )}
                                    <div className="truncate">
                                      <h4 className="text-xs font-bold truncate uppercase">
                                        {p.name}
                                      </h4>
                                      <p className="text-[10px] font-mono opacity-50 truncate">
                                        Price:{" "}
                                        {formatCurrency(p.price, currency)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 flex items-center gap-2">
                                    {qCount > 0 && (
                                      <span
                                        className={cn(
                                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                          theme === "dark"
                                            ? "bg-cyan-400/20 text-cyan-400"
                                            : "bg-black text-white",
                                        )}
                                      >
                                        {qCount}x
                                      </span>
                                    )}
                                    <div
                                      className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center border transition-all text-xs font-black",
                                        theme === "dark"
                                          ? "border-white/30 text-white group-hover:bg-brand-primary group-hover:text-black group-hover:border-brand-primary"
                                          : "border-slate-400 text-black group-hover:bg-black group-hover:text-white group-hover:border-black",
                                      )}
                                    >
                                      +
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: Metadata Config & Selected Manifest (Items inside Presale) */}
                    <div className="w-full lg:w-7/12 flex flex-col min-h-[300px] lg:min-h-0 overflow-y-auto lg:overflow-hidden lg:h-full space-y-4 pr-1">
                      {/* Form Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-35 mb-2">
                            Customer Assignment
                          </label>
                          <input
                            type="text"
                            value={
                              editingPresale.operator || editingPresale.op || ""
                            }
                            onChange={(e) =>
                              setEditingPresale({
                                ...editingPresale,
                                operator: e.target.value,
                                op: e.target.value,
                              })
                            }
                            className={cn(
                              "w-full px-4 py-2.5 rounded-xl border outline-none font-bold text-xs uppercase tracking-widest",
                              theme === "dark"
                                ? "bg-[#1E1E24] border-white/30 focus:border-brand-primary text-white"
                                : "bg-[#F9F9F9] border-slate-400 focus:border-black text-black",
                            )}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest opacity-35 mb-2">
                            Status Flag
                          </label>
                          <select
                            value={editingPresale.status}
                            onChange={(e) =>
                              setEditingPresale({
                                ...editingPresale,
                                status: e.target.value,
                              })
                            }
                            className={cn(
                              "w-full px-4 py-2.5 rounded-xl border outline-none font-black uppercase text-[10px] tracking-widest h-[42px]",
                              theme === "dark"
                                ? "bg-[#1E1E24] border-white/30 focus:border-brand-primary text-white"
                                : "bg-[#F9F9F9] border-slate-400 focus:border-black text-black",
                            )}
                          >
                            <option value="Pending">Pending Audit</option>
                            <option value="Approved">Initiated Order</option>
                            <option value="Voided">Voided Entry</option>
                          </select>
                        </div>
                      </div>

                      {/* Manifest Header */}
                      <div className="flex items-center justify-between shrink-0 pt-2 border-t border-inherit/40">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-35">
                          Itemized Manifest
                        </p>
                        <p className="text-[10px] font-mono opacity-40 uppercase">
                          {(editingPresale.items || []).length} Unique SKU
                        </p>
                      </div>

                      {/* Manifest Items List */}
                      <div
                        className={cn(
                          "border rounded-xl flex-1 overflow-y-auto no-scrollbar space-y-2 p-2 lg:h-full min-h-[150px]",
                          theme === "dark"
                            ? "border-white/30 bg-black/10"
                            : "border-slate-400 bg-gray-50/50",
                        )}
                      >
                        {(editingPresale.items || []).map(
                          (item: any, idx: number) => {
                            const pObj = products.find((p) => p.id === item.id);
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border shadow-sm transition-all relative",
                                  theme === "dark"
                                    ? "bg-[#1E1E24] border-white/30 text-white"
                                    : "bg-white border-slate-400 text-black",
                                )}
                              >
                                {/* Product Info left */}
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  {pObj?.imageUrl ? (
                                    <img
                                      src={pObj.imageUrl}
                                      alt=""
                                      className="w-7 h-7 rounded-md object-cover bg-black shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-7 h-7 rounded-md bg-brand-primary/10 text-brand-primary flex items-center justify-center shrink-0">
                                      <Package size={12} />
                                    </div>
                                  )}
                                  <div className="truncate pr-8 sm:pr-0">
                                    <p className="text-xs font-bold uppercase truncate">
                                      {item.name}
                                    </p>
                                    <p className="text-[9px] opacity-40 font-mono">
                                      SKU: {item.id.slice(0, 8).toUpperCase()}
                                    </p>
                                  </div>
                                </div>

                                {/* Price and quantity controller right */}
                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-inherit/30">
                                  <div className="flex flex-col">
                                    <label className="text-[8px] font-black uppercase opacity-35 mb-0.5">
                                      Price
                                    </label>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] opacity-40 font-mono">
                                        {currency === "USD" ? "$" : "R"}
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.price || 0}
                                        onChange={(e) => {
                                          const newItems = [
                                            ...editingPresale.items,
                                          ];
                                          newItems[idx] = {
                                            ...item,
                                            price: Number(e.target.value),
                                          };
                                          const newAmount = newItems.reduce(
                                            (s, i) => s + i.price * i.quantity,
                                            0,
                                          );
                                          setEditingPresale({
                                            ...editingPresale,
                                            items: newItems,
                                            amount: newAmount,
                                          });
                                        }}
                                        className={cn(
                                          "w-16 px-1.5 py-0.5 rounded border outline-none font-mono text-xs font-bold text-right",
                                          theme === "dark"
                                            ? "bg-black border-[#333] text-white"
                                            : "bg-white border-slate-400 text-black",
                                        )}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-col">
                                    <label className="text-[8px] font-black uppercase opacity-35 mb-0.5 text-center">
                                      Qty
                                    </label>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 px-1.5 py-0.5 rounded border",
                                        theme === "dark"
                                          ? "bg-black border-[#333]"
                                          : "bg-white border-slate-400",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newItems = [
                                            ...editingPresale.items,
                                          ];
                                          const newQty = Math.max(
                                            1,
                                            item.quantity - 1,
                                          );
                                          newItems[idx] = {
                                            ...item,
                                            quantity: newQty,
                                          };
                                          const newAmount = newItems.reduce(
                                            (s, i) => s + i.price * i.quantity,
                                            0,
                                          );
                                          setEditingPresale({
                                            ...editingPresale,
                                            items: newItems,
                                            amount: newAmount,
                                          });
                                        }}
                                        className="p-0.5 opacity-40 hover:opacity-100 transition-opacity"
                                      >
                                        <Minus size={10} />
                                      </button>
                                      <span className="font-mono text-xs font-bold w-4 text-center">
                                        {item.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newItems = [
                                            ...editingPresale.items,
                                          ];
                                          const newQty = item.quantity + 1;
                                          newItems[idx] = {
                                            ...item,
                                            quantity: newQty,
                                          };
                                          const newAmount = newItems.reduce(
                                            (s, i) => s + i.price * i.quantity,
                                            0,
                                          );
                                          setEditingPresale({
                                            ...editingPresale,
                                            items: newItems,
                                            amount: newAmount,
                                          });
                                        }}
                                        className="p-0.5 opacity-40 hover:opacity-100 transition-opacity"
                                      >
                                        <Plus size={10} />
                                      </button>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newItems =
                                        editingPresale.items.filter(
                                          (_: any, i: number) => i !== idx,
                                        );
                                      const newAmount = newItems.reduce(
                                        (s: number, i: any) =>
                                          s + i.price * i.quantity,
                                        0,
                                      );
                                      setEditingPresale({
                                        ...editingPresale,
                                        items: newItems,
                                        amount: newAmount,
                                      });
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors absolute sm:static right-2 top-2"
                                    title="Remove item"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          },
                        )}
                        {(!editingPresale.items ||
                          editingPresale.items.length === 0) && (
                          /* BLOCK: Empty Edit Presale Manifest Items Card */
                          <div
                            className={cn(
                              "edit-presale-manifest-empty-card p-8 sm:p-12 rounded-2xl border flex flex-col items-center justify-center text-center transition-all duration-300 shadow-soft",
                              theme === "dark" ? "bg-dark-surface border-white/20 text-white" : "bg-white border-slate-300 text-black"
                            )}
                          >
                            <Package size={54} strokeWidth={1.5} className={cn("edit-presale-manifest-empty-card__icon mb-2", theme === "dark" ? "text-cyan-400" : "text-blue-900")} />
                            <p className={cn("edit-presale-manifest-empty-card__title text-lg font-bold tracking-tight font-presale", theme === "dark" ? "text-white" : "text-slate-900")}>
                              No Items In Manifest
                            </p>
                            <p className={cn("edit-presale-manifest-empty-card__subtitle text-xs font-presale tracking-wide mt-1", theme === "dark" ? "text-slate-300" : "text-slate-600")}>
                              Search and add products above to build presale
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM SUBMIT ROW: Recalculation & Execution buttons */}
                  <div
                    className={cn(
                      "p-4 sm:p-6 border-t shrink-0",
                      theme === "dark"
                        ? "bg-black/40 border-[#1E293B]"
                        : "bg-gray-50 border-slate-400",
                    )}
                  >
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-center sm:text-left w-full sm:w-auto">
                        <p
                          className={cn(
                            "text-[8px] sm:text-[10px] font-black uppercase tracking-widest opacity-35 mb-0.5",
                            theme === "dark" ? "text-white" : "text-black",
                          )}
                        >
                          Recalculated Liquidation
                        </p>
                        <p className="text-2xl sm:text-3xl font-black  tracking-tighter text-brand-primary">
                          {formatCurrency(editingPresale.amount, currency)}
                        </p>
                      </div>
                      <div className="flex gap-3 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPresale(null);
                            setEditPresaleSearchQuery("");
                          }}
                          className={cn(
                            "flex-1 sm:flex-initial px-6 py-3 border text-[10px] font-black uppercase tracking-widest rounded-xl transition-all opacity-40 hover:opacity-100",
                            theme === "dark"
                              ? "border-white/30 text-white"
                              : "border-slate-400 text-black",
                          )}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className={cn(
                            "flex-1 sm:flex-initial px-8 py-3 font-black uppercase  tracking-widest text-[10px] rounded-xl active:scale-95 transition-all shadow-hard",
                            theme === "dark"
                              ? "bg-[#22D3EE] text-black hover:brightness-110"
                              : "bg-[#062A95] text-white hover:bg-opacity-95",
                          )}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Floating Action Button */}
        {(activeTab === "expenditure" ||
          activeTab === "revenue" ||
          activeTab === "balances") && (
          <button
            onClick={() => {
              setAddDate(format(new Date(), "yyyy-MM-dd"));
              setAddAccountType("store");
              setAddSelectedCustomerId("");
              setIsAddEntryModalOpen(true);
            }}
            className={cn(
              "fixed bottom-6 right-8 z-[100] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 active:scale-95 focus:outline-none",
              theme === "dark"
                ? "bg-[#22D3EE] text-black border-[#0F172A] shadow-[#22D3EE]/20 hover:brightness-110"
                : "bg-[#062A95] text-white border-white shadow-[#062A95]/20 hover:bg-opacity-95",
            )}
          >
            <Plus size={28} />
          </button>
        )}

        {/* BLOCK: Confirmation Action Popup Card */}
        <AnimatePresence>
          {confirmActionItem !== null && (
            <div id="confirm-action-popup-card-overlay" className="popup-card-overlay confirm-action-popup-card-overlay fixed inset-0 z-[100000] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="confirm-action-popup-card-overlay__backdrop absolute inset-0 bg-black/30 backdrop-blur-[3px] z-10"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                className={cn(
                  "popup-card confirm-action-popup-card relative w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl flex flex-col gap-5 overflow-hidden z-20",
                  theme === 'dark' ? "bg-dark-surface/95 border-dark-border backdrop-blur-3xl text-white" : "bg-white/95 border-light-border backdrop-blur-3xl text-black"
                )}
              >
                {/* Top Accent Strip */}
                <div className="confirm-action-popup-card__accent absolute top-0 left-0 right-0 h-1 bg-red-500" />

                <div className="popup-card__header confirm-action-popup-card__header flex items-start gap-4">
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
                    className="popup-card__icon confirm-action-popup-card__icon p-3 rounded-xl bg-red-500/10 text-red-500 shrink-0"
                  >
                    <AlertTriangle size={24} />
                  </motion.div>
                  <div className="popup-card__title-group confirm-action-popup-card__title-group space-y-1">
                    <h3 className={cn(
                      "popup-card__title confirm-action-popup-card__title text-lg font-black uppercase tracking-tighter leading-none",
                      theme === 'dark' ? "text-white" : "text-black"
                    )}>
                      {confirmActionItem.title}
                    </h3>
                    <p className="popup-card__subtitle confirm-action-popup-card__subtitle text-xs font-mono uppercase tracking-widest text-[#00E5FF]">
                      {confirmActionItem.subtitle}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  "popup-card__body confirm-action-popup-card__body text-sm tracking-tight leading-relaxed",
                  theme === 'dark' ? "text-white/85" : "text-black/85"
                )}>
                  {confirmActionItem.message}
                </div>

                <div className="popup-card__footer confirm-action-popup-card__footer flex gap-2 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setConfirmActionItem(null)}
                    className={cn(
                      "popup-card__button popup-card__button--cancel confirm-action-popup-card__button--cancel px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all select-none active:scale-95 border cursor-pointer",
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
                      const item = confirmActionItem;
                      setConfirmActionItem(null);
                      if (!item) return;
                      if (item.type === 'void_presale') {
                        voidPresale(item.id);
                      } else if (item.type === 'delete_expenditure') {
                        handleDeleteEntry(item.id, 'expenditure');
                      } else if (item.type === 'delete_revenue') {
                        handleDeleteEntry(item.id, 'revenue');
                      } else if (item.type === 'delete_balance') {
                        handleDeleteEntry(item.id, 'balances');
                      }
                    }}
                    className="popup-card__button popup-card__button--confirm confirm-action-popup-card__button--confirm px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-red-500 hover:bg-red-600 active:scale-95 text-white shadow-md shadow-red-500/10 cursor-pointer"
                  >
                    Confirm Action
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
