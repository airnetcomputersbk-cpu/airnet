import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { ModalProvider } from './context/ModalContext.tsx';
import { PathwayProvider } from './context/PathwayContext.tsx';
import PathwayWindow from './components/PathwayWindow.tsx';
import './index.css';

import PathwayPopout from './pages/admin/PathwayPopout.tsx';
const AdminLayout = lazy(() => import('./pages/admin/Layout.tsx'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

function AdminFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#061e38]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-blue-200 tracking-wider uppercase">Loading Admin Workspace...</span>
      </div>
    </div>
  );
}

function Root() {
  const isPopout = typeof window !== "undefined" && window.location.pathname.includes("/admin/pathway/popout");

  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <PathwayProvider>
          <Suspense fallback={<AdminFallback />}>
            <Switch>
              <Route path="/admin/pathway/popout" component={PathwayPopout} />
              <Route path="/admin/*" component={AdminLayout} />
              <Route path="*" component={App} />
            </Switch>
          </Suspense>
          {/* Always-on-top Floating Desktop Window across all tabs and routes */}
          {!isPopout && <PathwayWindow />}
        </PathwayProvider>
      </ModalProvider>
    </QueryClientProvider>
  );
}

// Global Fetch Interceptor to ensure Authorization Bearer header is automatically attached to admin calls
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url && url.includes("/api/admin")) {
      const token = localStorage.getItem("admin_token");
      if (token) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        init.headers = headers;
      }
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
