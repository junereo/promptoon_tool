import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { queryClient } from './app/query-client';
import { router } from './app/router';
import { AuthSessionBootstrap } from './features/auth/components/AuthSessionBootstrap';
import './styles.css';

import { QueryClientProvider } from '@tanstack/react-query';

document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthSessionBootstrap>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </AuthSessionBootstrap>
    </QueryClientProvider>
  </React.StrictMode>
);
