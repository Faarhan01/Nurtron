/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductVariation {
  id: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity?: number; // variation based on quantity (e.g. quantity attribute)
  price?: number;    // variation-specific price
  costPrice?: number;// variation-specific cost price
  stockLevel?: number;// variation-specific stock level
  barcode?: string;   // variation-specific barcode
}

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  category: string;
  stockLevel: number;
  imageUrl?: string;
  description?: string;
  barcode?: string;
  markupPrice?: number;
  discountPrice?: number;
  color?: string;
  size?: string;
  weight?: string;
  palletSize?: string;
  sku?: string;
  supplierId?: string;
  variations?: ProductVariation[];
  promoActive?: boolean;
  promoPrice?: number;
  promoStartDate?: string;
  promoEndDate?: string;
  promoLabel?: string;
  managerEmail?: string;
  ownerEmail?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

export interface CartItem extends Product {
  quantity: number;
  priceOverride?: number;
  originalPrice?: number;
  discount?: number;
}

export enum TransactionStatus {
  COMPLETED = 'completed',
  PENDING = 'pending',
  VOIDED = 'voided',
  REFUNDED = 'refunded',
  PARKED = 'parked',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  SPLIT = 'split',
  STORE_CREDIT = 'store_credit',
  GIFT_CARD = 'gift_card',
  OTHER = 'other',
}

export interface PaymentTender {
  id: string;
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number;
  changeGiven?: number;
  reference?: string;
  timestamp: string;
  notes?: string;
}

export interface ParkedCart {
  id: string;
  ticketName?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  parkedAt: string;
  cashierId: string;
  cashierName: string;
  notes?: string;
  storeId?: string;
}

export interface CashDrop {
  id: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  cashierId: string;
  cashierName: string;
  timestamp: string;
}

export interface CashShift {
  id: string;
  cashierId: string;
  cashierName: string;
  terminalId: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  splitSales: number;
  storeCreditSales: number;
  otherSales: number;
  totalSales: number;
  transactionCount: number;
  cashIn: number;
  cashOut: number;
  expectedCashInDrawer: number;
  actualCountedCash?: number;
  discrepancy?: number;
  notes?: string;
  drops: CashDrop[];
  storeId?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  storeCredit: number;
  loyaltyPoints: number;
  totalSpent: number;
  orderCount: number;
  createdAt: string;
  notes?: string;
  managerEmail?: string;
}

export interface HardwareConfig {
  printerType: 'browser' | 'escpos_network' | 'escpos_bluetooth' | 'escpos_usb';
  printerIp?: string;
  printerPort?: number;
  paperWidth: '58mm' | '80mm';
  autoCut: boolean;
  openDrawerOnCash: boolean;
  beepOnScan: boolean;
  continuousCameraScan: boolean;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal?: number;
  totalAmount: number;
  tax: number;
  discount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  timestamp: string; // ISO string
  cashierId: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  managerEmail?: string;
  storeId?: string;
  tenders?: PaymentTender[];
  splitTenders?: any[];
  tenderedAmount?: number;
  changeAmount?: number;
  shiftId?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  parkedCartRef?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  subCategory?: string;
  managerEmail?: string;
}

export type UserRole = 'Manager' | 'Supervisor' | 'Cashier' | 'Accountant' | 'Rep' | 'Investor' | 'Custom';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  customRoleName?: string;
  managerEmail?: string;
}

export interface StaffMember {
  email: string;
  username?: string;
  pin?: string;
  password?: string;
  role: UserRole;
  customRoleName?: string;
  permissions: Record<string, boolean>;
  addedBy?: string;
  addedAt?: string;
  managerEmail?: string;
}
