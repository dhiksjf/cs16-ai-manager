import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { DataProvider } from '@/context/DataContext';
import { Toaster } from '@/components/ui/sonner';
import './i18n';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/repair">
      <ThemeProvider>
        <DataProvider>
          <App />
          <Toaster position="top-right" richColors />
        </DataProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
