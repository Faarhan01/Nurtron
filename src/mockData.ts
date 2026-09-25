import { Product, Transaction, TransactionStatus, PaymentMethod } from './types';

export const MOCK_PRODUCTS: Product[] = [
  { id: 'prod-001', name: 'Original Cola 500ml', price: 1.50, category: 'beverages', stockLevel: 45, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-002', name: 'Mineral Water 1L', price: 0.90, category: 'beverages', stockLevel: 120, imageUrl: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-003', name: 'Quantum Mouse', price: 89.99, category: 'electronics', stockLevel: 12, imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-004', name: 'Mechanical Keyboard', price: 149.99, category: 'electronics', stockLevel: 5, imageUrl: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-005', name: 'Artisan Sourdough', price: 8.50, category: 'food', stockLevel: 8, imageUrl: 'https://images.unsplash.com/photo-1585478259715-876a6a81fc08?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-006', name: 'Organic Green Tea', price: 12.00, category: 'beverages', stockLevel: 50, imageUrl: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-007', name: 'Smart Desk Lamp', price: 49.99, category: 'household', stockLevel: 85, imageUrl: 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-008', name: 'Ergonomic Office Chair', price: 349.99, category: 'furniture', stockLevel: 15, imageUrl: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-009', name: 'Stealth Headphones', price: 299.99, category: 'audio', stockLevel: 4, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-010', name: 'Leather Notebook', price: 24.99, category: 'office', stockLevel: 120, imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-011', name: 'Titanium Flask', price: 45.00, category: 'household', stockLevel: 30, imageUrl: 'https://images.unsplash.com/photo-1602143303410-fd3d39e3ecf7?auto=format&fit=crop&q=80&w=400' },
  { id: 'prod-012', name: 'Quantum Sneakers', price: 125.00, category: 'apparel', stockLevel: 20, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400' },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-001',
    items: [{ ...MOCK_PRODUCTS[0], quantity: 2 }, { ...MOCK_PRODUCTS[4], quantity: 1 }],
    totalAmount: 11.50,
    tax: 0.85,
    discount: 0,
    paymentMethod: PaymentMethod.CARD,
    status: TransactionStatus.COMPLETED,
    timestamp: new Date().toISOString(),
    cashierId: 'CASHIER-01',
    customerName: 'Anonymous'
  },
  {
    id: 'TX-002',
    items: [{ ...MOCK_PRODUCTS[8], quantity: 1 }],
    totalAmount: 323.99,
    tax: 24.00,
    discount: 0,
    paymentMethod: PaymentMethod.CASH,
    status: TransactionStatus.COMPLETED,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    cashierId: 'CASHIER-01'
  }
];
