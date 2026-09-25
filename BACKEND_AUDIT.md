# Backend & Infrastructure Technical Audit: Nurtron / MegaPOS

**Audit Date**: August 2026  
**Auditor**: Lead System & Software Architect  
**Tech Stack**: Node.js, Express, TypeScript, Vite, Firebase Firestore (Configured) / Local Storage Persistence Layer

---

## Executive Summary

This document provides an exhaustive, production-grade audit of the backend architecture, API surfaces, database synchronization, security boundaries, and data integrity for the **Nurtron / MegaPOS** web application. 

While the system contains elaborate business rules (multi-store scoping, role-based access, inventory margins, and ledger balancing), the backend layer currently operates in a **hybrid/decoupled state**: the server is a minimal static-serving wrapper, and data persistence relies heavily on a client-side localStorage event emitter with security rules pre-configured in Firestore.

---

## 1. Server Architecture & API Surface

```
CURRENT ARCHITECTURE (Single Express Host + Client LocalStorage)
┌──────────────────────────────────────────────────────────────────────────┐
│                            Browser / Client                              │
│  ┌────────────────────────┐                   ┌───────────────────────┐  │
│  │   React Application    │ ──(Events/Sync)── │  LocalStorage Database │  │
│  │ (Register/Inventory/..) │                   │ (nurtron_db_collect..)│  │
│  └───────────┬────────────┘                   └───────────────────────┘  │
└──────────────┼───────────────────────────────────────────────────────────┘
               │ (Static assets & Health check only)
               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Express Backend (Port 3000)                        │
│  - GET /api/health                                                       │
│  - Vite Middleware (Development) / Express Static Dist (Production)      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Current API Implementations (`server.ts`)
- **Endpoints Defined**: Only `GET /api/health` returning `{ status: "ok" }`.
- **Static Hosting**: Correctly mounts Vite middleware in dev and serves static `dist/` in production on port `3000` (`0.0.0.0`).
- **Missing API Routes**:
  - **Transaction Processor** (`POST /api/v1/checkout`): No server-side endpoint to atomically validate stock, deduct quantities, apply promotions, and record financial ledger rows.
  - **Inventory Locks & Delta Sync** (`POST /api/v1/inventory/reserve`, `GET /api/v1/inventory/delta`): No reservation mechanism to prevent two cashiers from selling the exact same physical unit simultaneously.
  - **Cryptographic Auth Gateway** (`POST /api/v1/auth/login`, `POST /api/v1/auth/verify-pin`): Authentication is completely bypassed and handled in plaintext via localStorage strings.
  - **ESC/POS Print Relay Server** (`POST /api/v1/hardware/print-raw`): No local socket server to push binary ESC/POS buffers directly to network receipt printers.
  - **Telemetry & Central Audit Ingestion** (`POST /api/v1/audit/log`): No immutable append-only server log capturing supervisor overrides, refunds, and drawer opens.

### 1.2 Idempotency & Replay Vulnerabilities
- When network drops occur during checkout, web clients without **Idempotency Keys (`Idempotency-Key: UUIDv4`)** risk submitting duplicate sales records if the cashier clicks the Pay button twice in rapid succession.
- *Remediation*: Server-side endpoints must store recent `idempotency_keys` in Redis/Firestore with a 24-hour TTL, ensuring repeated requests return the original transaction without double-charging or deducting stock twice.

---

## 2. Database & Data Persistence Layer

### 2.1 Current Implementation (`src/lib/firebase.ts`)
- **Mechanism**: A custom in-memory and `localStorage` mock that emulates Firestore's query API (`collection`, `doc`, `getDocs`, `onSnapshot`, `setDoc`, `updateDoc`, `deleteDoc`).
- **Reactivity**: Uses custom `window.dispatchEvent(new CustomEvent('nurtron_local_db_change'))` to notify active React components of changes.

### 2.2 Critical Limitations:

| Metric | Current Local Engine | Production Target (Cloud Firestore / SQL) |
| :--- | :--- | :--- |
| **Storage Cap** | ~5MB hard browser limit | Unlimited cloud storage |
| **Durability** | Vulnerable to browser cache clearing / incognito resets | Durable, multi-region replicated persistence |
| **Multi-Terminal Sync** | Restricted to single browser tab/window | Real-time cross-device sync via WebSockets / gRPC |
| **Atomic Transactions** | Sequential `localStorage` writes (No ACID guarantees) | Atomic batch writes (`runTransaction`, `writeBatch`) |
| **Query Indexing** | In-memory JavaScript filtering | Composite indexing & B-tree server queries |
| **Offline Vector Clocks** | Timestamp overrides (Last-Write-Wins) | CRDTs or Revision vector clocks with conflict resolution |

### 2.3 Concurrency & Race Condition Vulnerability:
When two cashiers ring up the last unit of a product simultaneously on different terminals:
1. Terminal A reads stock = 1.
2. Terminal B reads stock = 1.
3. Both complete checkout and write stock = 0.
4. **Result**: 2 physical items sold from 1 available unit (Overselling / Stock Discrepancy).

### 2.4 Lack of Database Indexing & Query Scalability
- The mock database uses linear in-memory `.filter()` across arrays.
- In production with 10,000+ sales and 5,000+ products:
  - Filtering transactions by `storeId + timestamp + cashierId` requires composite Firestore indexes (`fields: [storeId ASC, timestamp DESC, status ASC]`).
  - Without composite indexes, queries will fail or force high-latency full collection scans.

---

## 3. Security, Authentication & Role-Based Access Control (RBAC)

### 3.1 Authentication Mechanism & Plaintext Password Flaw
- **Current State**: Authentication state (`nurtron_current_user`) stores plain JSON objects with `uid`, `email`, `displayName`, and role in localStorage.
- **PIN & Password Storage**:
  - Staff PINs and passwords in `nurtron_db_collection_staff` are stored as **plaintext strings** (e.g. `pin: '1234'`, `password: 'admin'`).
  - *Vulnerability*: Anyone with DevTools access or physical access to the browser console can extract all supervisor PINs, manager credentials, and master passcodes.
- **Hardcoded Admin Bypass (`src/lib/firebase.ts` line 194-205)**:
  ```typescript
  if ((cleanInput === 'admin' || cleanInput === 'admin@megapos.pos') && 
      (cleanPass === 'admin' || cleanPass === '1234' || cleanPass === '0000' || !cleanPass)) { ... }
  ```
  - A default `admin / admin` or `admin / 1234` backdoor exists in the codebase allowing anyone to assume full system administration privileges without authentication validation.

### 3.2 Firestore Security Rules Audit (`firestore.rules`)
The Firestore security rules in `firestore.rules` are comprehensive and well-structured, but contain specific logical flaws:

1. **Admin Escalation Fallback (Dangerous Default)**:
   ```javascript
   function isAdmin() {
     return isSignedIn() && (
       (getEmail() != null && getEmail() == 'faarhanch@gmail.com') ||
       (
         getEmail() != null &&
         exists(/databases/$(database)/documents/staff/$(getEmail())) && 
         'permissions' in get(/databases/$(database)/documents/staff/$(getEmail())).data &&
         'settings' in get(/databases/$(database)/documents/staff/$(getEmail())).data.permissions &&
         get(/databases/$(database)/documents/staff/$(getEmail())).data.permissions.settings == true
       ) || (
         getEmail() == null || !exists(/databases/$(database)/documents/staff/$(getEmail()))
       )
     );
   }
   ```
   - ⚠️ **Critical Flaw in Line 40**: `(getEmail() == null || !exists(/databases/$(database)/documents/staff/$(getEmail())))` grants full Administrator permissions to any unauthenticated or unregistered user by default. This must be inverted so non-existent staff records receive zero access.

2. **Tenant Isolation & Horizontal Privilege Escalation**:
   - Collections like `products`, `transactions`, `presales`, and `returns` share global root paths.
   - Multi-tenant data relies on client-filtered `managerEmail` or `storeId` fields.
   - *Recommendation*: Use subcollections (e.g. `/tenants/{tenantId}/products/{productId}`) or enforce `resource.data.managerEmail == request.auth.token.email` in Firestore rules.

---

## 4. Rate Limiting, DoS & Transport Security

1. **Missing Rate Limiting Middleware**:
   - `server.ts` has no `express-rate-limit` or DDoS defense. An attacker or malfunctioning POS loop can spam the API with millions of requests.
2. **Missing Security Headers (`helmet`)**:
   - Headers such as `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, and `Strict-Transport-Security` are not configured in Express.
3. **CORS Configuration**:
   - If accessed as a mobile app or secondary terminal, the server lacks CORS origin validation.

---

## 5. Remediation & Backend Target Architecture

```
PROPOSED TARGET BACKEND ARCHITECTURE
┌───────────────────────────────────────────────────────────────────────────┐
│                      Client POS Applications                              │
│              (Web Desktop, Tablet POS, Handheld Mobile)                   │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ (HTTPS / WSS with JWT / Auth Bearer)
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     Node.js / Express API Gateway                         │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌───────────────────┐ │
│  │ Rate Limiter & Helmet │ │ JWT Auth Middleware  │ │ Idempotency Guard │ │
│  └───────────┬───────────┘ └──────────┬───────────┘ └─────────┬─────────┘ │
├──────────────┼────────────────────────┼───────────────────────┼───────────┤
│              ▼                        ▼                       ▼           │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌───────────────────┐ │
│  │   /api/v1/checkout    │ │   /api/v1/shifts     │ │  /api/v1/sync     │ │
│  │ (Atomic batch write,  │ │ (Open/close float,   │ │ (Delta sync for   │ │
│  │  inventory decrement) │ │  X/Z Report engine)  │ │  offline caching) │ │
│  └───────────┬───────────┘ └──────────┬───────────┘ └─────────┬─────────┘ │
└──────────────┼────────────────────────┼───────────────────────┼───────────┘
               │                        │                       │
               ▼                        ▼                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    Cloud Firestore / PostgreSQL Engine                    │
│     - ACID Transactions & Optimistic Concurrency Control                  │
│     - Multi-tenant Security Partitioning                                  │
│     - Change Streams for Real-Time Multi-Register Inventory Updates       │
└───────────────────────────────────────────────────────────────────────────┘
```

### Action Items for Backend Hardening:
1. **Implement Server-Side Transaction Endpoint**:
   - Create `POST /api/v1/transactions/process` in `server.ts` that runs an atomic Firestore batch updating stock levels and recording receipts in a single operation.
2. **Cryptographic Password & PIN Hashing**:
   - Hash all staff PINs and supervisor passcodes using `bcrypt` or `argon2` before storing.
3. **Remove Hardcoded Backdoors & Fix Security Rules**:
   - Remove plaintext `admin / admin` shortcuts in production and invert line 40 of `firestore.rules` to deny unauthorized access.
4. **Shift Reconciler & Audit Service**:
   - Create shift audit records tracking physical cash drawer floats, cash-in/out drops, and cashier balance discrepancies.
5. **Add Express Security Middleware**:
   - Integrate `helmet`, `cors`, and `express-rate-limit` inside `server.ts`.
