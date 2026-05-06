import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AppRouter } from './app/AppRouter';
import { queryClient } from './app/query-client';
import { AuthSessionBootstrap } from './features/auth/components/AuthSessionBootstrap';
import './styles.css';

import { QueryClientProvider } from '@tanstack/react-query';

document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <AuthSessionBootstrap>
          <AppRouter />
        </AuthSessionBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
