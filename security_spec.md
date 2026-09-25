# Apex POS Security Specification

## Data Invariants
1. Products can only be managed by Admins.
2. Transactions are immutable once completed.
3. Every transaction must be linked to a valid cashier ID (request.auth.uid).
4. Stock levels cannot be negative.
5. Prices must be positive.

## The "Dirty Dozen" Payloads (Denial Expected)
1. **Unauthenticated Write**: Attempting to create a product without being logged in.
2. **Identity Spoofing**: Cashier A trying to create a transaction with `cashierId` set to Cashier B.
3. **Price Manipulation**: Updating a product price to $0.01 via client SDK.
4. **Stock Poisoning**: Setting stock level to -500.
5. **Ghost Field Injection**: Adding an `isAdmin: true` field to a user profile or transaction.
6. **Bypassing Terminal State**: Trying to change the status of a 'completed' transaction to 'voided' without proper auth.
7. **Orphaned Transaction**: Creating a transaction referencing items that don't exist in the products collection (Atomicity Check).
8. **Malicious ID**: Creating a product with ID as a 2KB junk string.
9. **Timestamp Spoofing**: Providing a `timestamp` from 1970 instead of using `request.time`.
10. **Quantity Overflow**: Setting a cart item quantity to 999,999 in a transaction payload.
11. **Cross-User Data Leak**: A non-admin trying to 'list' all transactions if unauthorized.
12. **Shadow Field Update**: Updating a product but sneaking in a `totalSales` increment field.

## Test Runner Plan
A `firestore.rules.test.ts` will be implemented to verify these constraints.
