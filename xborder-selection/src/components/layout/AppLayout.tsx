import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { useAppStore } from '@/context/StoreContext';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Inbox, 
  ShoppingCart, 
  UserCircle,
  LogOut,
  Globe,
  Package,
  ClipboardCheck,
  BarChart2,
  Users,
} from 'lucide-react';
import { cn } from '@/components/shared/StatusBadge';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { role, currentUser, logout, products } = useAppStore();

  // ── 采购池未读提醒 ─────────────────────────────────────────────────────────
  const purchaseStorageKey = `purchase_last_viewed_uid_${currentUser.id}`;
  const [purchaseLastViewed, setPurchaseLastViewed] = useState<string | null>(
    () => localStorage.getItem(purchaseStorageKey)
  );

  const purchaseUnreadCount = useMemo(() => {
    return products.filter(p => {
      if (!p.enteredPurchaseAt) return false;
      if (!purchaseLastViewed) return true;
      return p.enteredPurchaseAt > purchaseLastViewed;
    }).length;
  }, [products, purchaseLastViewed]);

  const handlePurchaseClick = () => {
    const now = new Date().toISOString();
    localStorage.setItem(purchaseStorageKey, now);
    setPurchaseLastViewed(now);
  };

  const navItems = [
    { name: '员工工作台', path: '/workbench', icon: LayoutDashboard, roles: ['product_specialist'] },
    { name: '候选录入', path: '/entry', icon: PlusCircle, roles: ['product_specialist'] },
    { name: '样品管理', path: '/samples', icon: Package, roles: ['product_specialist'] },
    { name: '样品决策', path: '/decisions', icon: ClipboardCheck, roles: ['product_manager'] },
    { name: '管理层初筛池', path: '/manager-pool', icon: Inbox, roles: ['product_manager'] },
    { name: '采购池', path: '/purchase-pool', icon: ShoppingCart, roles: ['product_specialist', 'product_manager'] },
    { name: '数据中心', path: '/data-center', icon: BarChart2, roles: ['product_specialist', 'product_manager'] },
    { name: '账号管理', path: '/admin/users', icon: Users, roles: ['admin'] },
  ];

  const visibleNav = navItems.filter(item => item.roles.includes(role));

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col z-20 shadow-sm relative">
        <div className="h-16 flex items-center px-6 border-b border-border gap-3">
          <div className="bg-primary/10 p-2 rounded-xl text-primary">
            <Globe size={24} />
          </div>
          <h1 className="font-bold text-lg text-foreground tracking-tight">跨境选品系统</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">主菜单</div>
          {visibleNav.map(item => {
            const isActive = location === item.path || (location.startsWith('/analysis') && item.path === '/workbench');
            const isPurchasePool = item.path === '/purchase-pool';
            const badge = isPurchasePool && purchaseUnreadCount > 0 ? purchaseUnreadCount : 0;
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={isPurchasePool ? handlePurchaseClick : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                    : "text-slate-600 hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon size={18} className={cn(isActive ? "text-primary-foreground" : "text-slate-400")} />
                <span className="flex-1">{item.name}</span>
                {badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-border">
          <div className="bg-secondary/50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground shadow-inner">
                <UserCircle size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">{currentUser.name}</span>
                <span className="text-xs text-muted-foreground">
                  {role === 'admin' ? '系统管理员' : role === 'product_manager' ? '产品经理' : '产品专员'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50">
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-8 z-10 sticky top-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {role === 'admin' ? (
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-400"></span> 管理员视图</span>
            ) : role === 'product_manager' ? (
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> 产品经理视图</span>
            ) : (
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> 产品专员视图</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={logout}
              title="退出登录"
              className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-secondary rounded-full"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto">
          <div className="p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
