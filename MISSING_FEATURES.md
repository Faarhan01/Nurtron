# Missing Features & Functional Roadmap: Nurtron / MegaPOS

**Audit Date**: August 2026  
**Auditor**: Lead Product & POS Systems Architect  
**Benchmark Reference**: Open Kiosk, Kauils, Kasirku, ERPNext POS, Medusa POS, Square & Lightspeed POS

---

## Executive Summary

This specification outlines the critical functional gaps between our current Point-of-Sale implementation and industry-standard commercial and open-source retail POS platforms. 

Each feature below includes a **business justification**, **data model schema**, **cashier UX workflow**, and **technical implementation blueprint**.

---

## 1. Park / Hold Cart (Suspended Orders & Layaway)

### 1.1 Business Justification
In retail checkout lines, a customer frequently forgets an item or needs to fetch another payment method. Without a Hold Cart capability, the cashier must either void the entire transaction (frustrating the customer) or stall the entire checkout line.

### 1.2 Data Model
```typescript
export interface ParkedCart {
  id: string;                      // e.g. "HOLD-88492"
  ticketName?: string;             // e.g. "Customer in Blue Jacket" or "Table 4"
  customerName?: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  discount: number;
  parkedAt: string;                // ISO Timestamp
  cashierId: string;
  cashierName: string;
  notes?: string;
}
```

### 1.3 UX & Technical Workflow
1. **Hold Button**: Cashier clicks `Hold Order` (or presses `F4`).
2. **Prompt (Optional)**: Modal asks for optional reference name/note.
3. **Storage**: Cart state is pushed to `parked_orders` collection in database/storage.
4. **Recall Drawer**: A prominent badge in the register header displays `Held Carts (3)`.
5. **Resume**: Cashier clicks a held cart to restore all line items, discounts, and customer associations into the active register with zero data loss.

---

## 2. Split Tender Payments (Multi-Payment Transactions)

### 2.1 Business Justification
Customers frequently request splitting a total between multiple tender types (e.g., paying $20 in Cash and the remaining $34.50 on a Credit Card, or splitting across two debit cards).

### 2.2 Data Model
```typescript
export interface PaymentTender {
  id: string;
  method: 'cash' | 'card' | 'upi' | 'store_credit' | 'gift_card' | 'other';
  amount: number;
  tenderedAmount?: number;         // For cash: e.g. paid $50 for a $40 split
  changeGiven?: number;           // Calculated change
  reference?: string;             // Card auth code or transaction ID
  timestamp: string;
}

export interface SplitTransaction extends Transaction {
  tenders: PaymentTender[];
  isFullyPaid: boolean;
  remainingBalance: number;
}
```

### 2.3 UX & Technical Workflow
1. At Checkout, the cashier selects **Split Payment**.
2. An interactive breakdown displays the Total Due ($100), Amount Paid ($0), and Remaining Balance ($100).
3. The cashier records Tender 1: `$40.00 via Cash`.
4. Remaining Balance dynamically updates to `$60.00`.
5. The cashier records Tender 2: `$60.00 via Card`.
6. Once Remaining Balance reaches `$0.00`, the transaction automatically finalizes and generates a combined itemized receipt showing the breakdown of all tenders used.

---

## 3. Embedded Camera Barcode & QR Scanner

### 3.1 Business Justification
While handheld USB/Bluetooth barcode guns work on desktop PCs, tablets and mobile phones running the web app need the ability to scan barcodes directly using the device's built-in camera without requiring extra hardware.

### 3.2 Technical Implementation
- **Primary API**: Modern native browser `BarcodeDetector` API (supported in Chrome/Edge/Android).
- **Universal Fallback**: `@zxing/browser` or `html5-qrcode` for iOS Safari and cross-browser support.
- **Hardware Wedge Hook**: `useBarcodeScanner` listener capturing fast keystroke streams (detecting input arrival under 30ms ending in `Enter`) for physical laser guns.

### 3.3 UX Workflow
- Cashier clicks the **Scan Barcode** icon next to the register search bar.
- A smooth camera viewfinder modal opens with laser alignment guidelines and flashlight/torch toggle.
- On detection, it emits a subtle audio beep (`Web Audio API` synthetic 800Hz beep), looks up the SKU/Barcode in the product index, increments the cart quantity by 1, and remains open for continuous scanning.

---

## 4. Cash Drawer Management & Shift Reconciliation (X/Z Reports)

### 4.1 Business Justification
Loss prevention, cash discrepancy detection, and daily accounting require rigorous shift tracking. Retailers must track initial opening cash floats, mid-day cash drops (paying suppliers or petty cash), and end-of-day drawer counting.

### 4.2 Data Model
```typescript
export interface CashShift {
  id: string;                      // e.g. "SHIFT-2026-08-16-01"
  cashierId: string;
  cashierName: string;
  terminalId: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingFloat: number;            // e.g. $200.00 starting cash
  cashSales: number;               // System computed cash total
  cardSales: number;
  otherSales: number;
  cashIn: number;                  // Petty cash added during shift
  cashOut: number;                 // Cash drops / paid out during shift
  expectedCashInDrawer: number;    // openingFloat + cashSales + cashIn - cashOut
  actualCountedCash?: number;      // Physical count entered by cashier on close
  discrepancy?: number;            // Over / Short amount
  notes?: string;
}
```

### 4.3 Shift Reports:
- **X-Report (Mid-Shift Audit)**: Real-time non-resettable snapshot of current sales, cash in drawer, and transaction count without closing the drawer.
- **Z-Report (End-of-Day Closeout)**: Closes the active shift, locks register sales for the session, calculates cash over/short discrepancies, and prints a final reconciliation slip for store management.

---

## 5. Customer Relationship Management (CRM) & Loyalty Program

### 5.1 Missing Functionalities
1. **Customer Search at Checkout**: Quick lookup by phone number, customer ID, or email directly from the cart header.
2. **Store Credit Ledger**: Tracking store credit balances earned from product returns or prepaid accounts.
3. **Loyalty Points Engine**:
   - Accumulate: $1 spent = 1 Loyalty Point.
   - Redeem: 100 Points = $5 Discount at checkout.
4. **Customer Purchase History**: Viewing past receipts associated with a specific customer profile.

---

## 6. Hardware Integration & Direct Thermal ESC/POS Printing

### 6.1 Direct ESC/POS Command Generation
Currently, printing relies on browser `window.print()`, which produces standard A4/Letter browser dialogs rather than fast 58mm or 80mm roll receipts.

### 6.2 Raw ESC/POS Buffer Generator (`/src/lib/escpos.ts`):
```typescript
export function buildEscPosReceipt(transaction: Transaction, settings: StoreSettings): Uint8Array {
  const encoder = new TextEncoder();
  const ESC = 0x1B;
  const GS = 0x1D;

  const buffer: number[] = [
    ESC, 0x40,               // Initialize printer
    ESC, 0x61, 0x01,         // Center align
    ...encoder.encode(`${settings.storeName}\n`),
    ESC, 0x61, 0x00,         // Left align
    ...encoder.encode(`Receipt: ${transaction.id}\n`),
    ...encoder.encode(`Date: ${new Date(transaction.timestamp).toLocaleString()}\n`),
    ...encoder.encode('--------------------------------\n')
  ];

  // Cash Drawer Kick Pulse
  buffer.push(ESC, 0x70, 0x00, 0x19, 0xFA);

  // Partial Paper Cut
  buffer.push(GS, 0x56, 0x41, 0x03);

  return new Uint8Array(buffer);
}
```

### 6.3 Connectivity Channels:
- **Web Bluetooth**: Direct connection to wireless mobile receipt printers (e.g. Star, Epson, Munbyn).
- **WebUSB / WebSerial**: Direct connection to desktop USB thermal printers without third-party print spooler drivers.

---

## 7. Supply Chain: Purchase Orders (PO) & Goods Received Notes (GRN)

### 7.1 Missing Purchasing Pipeline:
1. **Vendor / Supplier Management**: Address, tax ID, lead time, contact person, payment terms (Net 30/60).
2. **Purchase Orders (PO)**: Creating orders sent to suppliers for stock restocking with expected arrival dates.
3. **Goods Received Notes (GRN)**: Receiving shipment against a PO, verifying received vs ordered quantities, and updating product stock levels automatically with updated Cost of Goods Sold (COGS).

---

## 8. Summary Comparison Matrix

| Feature Domain | Priority | Implementation Effort | Expected Impact on Business Operations |
| :--- | :--- | :--- | :--- |
| **Park / Hold Cart** | High (P0) | 1-2 Days | Eliminates checkout line bottlenecks immediately |
| **Split Tender Payments** | High (P0) | 1-2 Days | Essential for high-ticket retail and restaurant sales |
| **Camera Barcode Scanner** | High (P0) | 1 Day | Enables instant tablet/mobile POS operations without hardware |
| **Shift Management (X/Z Reports)**| High (P0) | 2-3 Days | Essential for cash control, fraud prevention, and accounting |
| **Direct ESC/POS Thermal Printing**| Medium (P1) | 2 Days | High-speed receipt output and automatic cash drawer opening |
| **Customer Loyalty & Store Credit** | Medium (P1) | 2-3 Days | Improves customer retention and repeat visits |
| **Purchase Orders & GRN** | Medium (P2) | 3-4 Days | Streamlines inventory procurement and supplier reconciliation |
