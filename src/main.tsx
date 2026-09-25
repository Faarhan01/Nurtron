import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';

import {ThemeProvider} from './context/ThemeContext.tsx';
import {CartProvider} from './context/CartContext.tsx';
import {ShiftProvider} from './context/ShiftContext.tsx';
import {CustomerProvider} from './context/CustomerContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <CustomerProvider>
            <ShiftProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </ShiftProvider>
          </CustomerProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);


