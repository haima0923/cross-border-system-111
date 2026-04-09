import React, { useState, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { StoreProvider, useAppStore, AuthUser } from "@/context/StoreContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Workbench from "@/pages/Workbench";
import ProductEntry from "@/pages/ProductEntry";
import AnalysisResult from "@/pages/AnalysisResult";
import ManagerPool from "@/pages/ManagerPool";
import PurchasePool from "@/pages/PurchasePool";
import SamplingDetail from "@/pages/SamplingDetail";
import SampleManagement from "@/pages/SampleManagement";
import ManagerDecision from "@/pages/ManagerDecision";
import DataCenter from "@/pages/DataCenter";
import AdminUsers from "@/pages/AdminUsers";
import Login from "@/pages/Login";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

const API = '/api';

// wrap() creates a stable component — must be called at MODULE LEVEL only, never
// inside a render function. Calling wrap() inside Router() would create a NEW
// component reference on every re-render, causing React to unmount+remount the
// child page and silently reset all its local state (form fields, progress, etc.).
function wrap(Page: React.ComponentType, name: string) {
  return function WrappedPage() {
    return (
      <ErrorBoundary pageName={name}>
        <Page />
      </ErrorBoundary>
    );
  };
}

// ── Guards ── (must be declared before the module-level wrapped constants below)

function ManagerDecisionGuard() {
  const { role } = useAppStore();
  if (role !== 'product_manager') {
    return <Redirect to="/workbench" />;
  }
  return <ManagerDecision />;
}

function AdminGuard() {
  const { role } = useAppStore();
  if (role !== 'admin') {
    return <Redirect to="/workbench" />;
  }
  return <AdminUsers />;
}

// ── Stable wrapped page components (created ONCE at module init, never recreated) ──
// This prevents React from treating them as new component types on re-render,
// which would cause child state (form fields, scroll position, etc.) to be reset.

const WrappedWorkbench           = wrap(Workbench,              '工作台');
const WrappedProductEntry        = wrap(ProductEntry,           '新增录入');
const WrappedAnalysisResult      = wrap(AnalysisResult,         '分析结果');
const WrappedSamplingDetail      = wrap(SamplingDetail,         '样品详情');
const WrappedSampleManagement    = wrap(SampleManagement,       '样品管理');
const WrappedManagerDecisionGuard = wrap(ManagerDecisionGuard,  '经理决策');
const WrappedManagerPool         = wrap(ManagerPool,            '经理初筛池');
const WrappedPurchasePool        = wrap(PurchasePool,           '采购池');
const WrappedDataCenter          = wrap(DataCenter,             '数据中心');
const WrappedAdminGuard          = wrap(AdminGuard,             '账号管理');

const queryClient = new QueryClient();

function Router() {
  const { role } = useAppStore();
  return (
    <AppLayout>
      <Switch>
        <Route path="/">
          {role === 'admin' ? <Redirect to="/admin/users" /> : <Redirect to="/workbench" />}
        </Route>
        <Route path="/workbench"    component={WrappedWorkbench} />
        <Route path="/entry"        component={WrappedProductEntry} />
        <Route path="/analysis/:id" component={WrappedAnalysisResult} />
        <Route path="/sampling/:id" component={WrappedSamplingDetail} />
        <Route path="/samples"      component={WrappedSampleManagement} />
        <Route path="/decisions"    component={WrappedManagerDecisionGuard} />
        <Route path="/manager-pool" component={WrappedManagerPool} />
        <Route path="/purchase-pool" component={WrappedPurchasePool} />
        <Route path="/data-center"  component={WrappedDataCenter} />
        <Route path="/admin/users"  component={WrappedAdminGuard} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  const [authState, setAuthState] = useState<'checking' | 'unauthenticated' | 'authenticated'>('checking');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then(r => {
        if (r.ok) return r.json();
        throw new Error('unauthenticated');
      })
      .then((user: AuthUser) => {
        setAuthUser(user);
        setAuthState('authenticated');
      })
      .catch(() => setAuthState('unauthenticated'));
  }, []);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-muted-foreground text-sm">加载中...</div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <WouterRouter base={base}>
        <Login />
      </WouterRouter>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider user={authUser!}>
        <TooltipProvider>
          <WouterRouter base={base}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

export default App;
