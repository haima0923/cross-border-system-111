import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/context/StoreContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useLocation } from 'wouter';
import { Search, Plus, ArrowRight, X, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ProductImage } from '@/components/shared/ProductImage';

// ── Routing constants (determines which detail page a card links to) ──────────
const ENTRY_STATUSES = ['draft', 'pending_info', 'returned', 'supplier_changing'];
const SAMPLING_ROUTE_STATUSES = [
  'pending_sampling', 'sampling_collection', 'sampling_ready', 'sampling', 'sample_arrived', 'sample_reviewing', 'sampling_review_submitted', 'sample_reviewed',
];

function getCardPath(status: string, id: string): string {
  if (status === 'completed') return '/purchase-pool';
  if (ENTRY_STATUSES.includes(status)) return `/entry?id=${id}`;
  if (SAMPLING_ROUTE_STATUSES.includes(status)) return `/sampling/${id}`;
  return `/analysis/${id}`;
}

// ── Display groups (reorganized, sorted by updatedAt desc within each group) ──
const MAIN_GROUPS = [
  {
    id: 'pending',
    title: '待处理',
    statuses: ['draft', 'pending_info', 'returned'],
    color: 'border-orange-200 bg-orange-50/30',
    headerColor: 'text-orange-700',
    dotColor: 'bg-orange-400',
    showReviewSubLabel: false,
  },
  {
    id: 'analysis',
    title: '分析 & 提交',
    statuses: ['pending_analysis', 'analyzed_pending_review'],
    color: 'border-blue-200 bg-blue-50/30',
    headerColor: 'text-blue-700',
    dotColor: 'bg-blue-400',
    showReviewSubLabel: false,
  },
  {
    id: 'review',
    title: '审核状态',
    statuses: ['screening_submitted', 'pending_sampling', 'sampling_collection', 'sampling_ready'],
    color: 'border-emerald-200 bg-emerald-50/30',
    headerColor: 'text-emerald-700',
    dotColor: 'bg-emerald-400',
    showReviewSubLabel: true,
  },
  {
    id: 'sampling',
    title: '采样',
    statuses: [
      'sampling', 'sample_arrived', 'sample_reviewing', 'sampling_review_submitted', 'sample_reviewed',
    ],
    color: 'border-cyan-200 bg-cyan-50/30',
    headerColor: 'text-cyan-700',
    dotColor: 'bg-cyan-400',
    showReviewSubLabel: false,
  },
];

const ENDED_STATUSES = ['rejected', 'completed'];

// Sub-labels shown on cards inside the "审核状态" column
function getReviewSubLabel(status: string, supplierChangeCount?: number): { label: string; className: string } | null {
  if (status === 'screening_submitted') {
    return { label: '审核中', className: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (status === 'pending_sampling') {
    if ((supplierChangeCount ?? 0) > 0) {
      return { label: '换供后待采样', className: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { label: '审核完成', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  return null;
}

// ── Supplier-change badge ──────────────────────────────────────────────────────
function SupplierChangeBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      <RefreshCw size={9} />已换供应商（第{count}次）
    </span>
  );
}

export default function Workbench() {
  const { products, currentUser, role, sampleAction } = useAppStore();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [showEnded, setShowEnded] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // ── 已结束未读提醒 ─────────────────────────────────────────────────────────
  const endedStorageKey = `ended_last_viewed_uid_${currentUser.id}`;
  const [endedLastViewed, setEndedLastViewed] = useState<string | null>(
    () => localStorage.getItem(endedStorageKey)
  );

  React.useEffect(() => {
    if (role === 'product_manager') setLocation('/manager-pool');
  }, [role, setLocation]);

  if (role === 'product_manager') return null;

  const myProducts = products.filter(p => p.submitterName === currentUser.name);

  // Items waiting for employee action — shown above the board (sorted by updatedAt desc)
  const needsConfirmProducts = myProducts.filter(p =>
    p.status === 'rejected_unconfirmed' || p.status === 'supplier_change_requested'
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const filteredProducts = searchQuery.trim()
    ? myProducts.filter(p =>
        p.productName?.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        p.supplierName?.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : myProducts;

  const handleSearch = () => setSearchQuery(inputValue);
  const handleClear = () => { setInputValue(''); setSearchQuery(''); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Ended products (completed + rejected) shown separately below
  const endedProducts = filteredProducts
    .filter(p => ENDED_STATUSES.includes(p.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // 已结束未读数：从当前用户的全部产品计算（不受搜索过滤影响）
  const endedUnreadCount = useMemo(() => {
    return myProducts.filter(p => {
      if (!p.enteredEndedAt) return false;
      if (!endedLastViewed) return true;
      return p.enteredEndedAt > endedLastViewed;
    }).length;
  }, [myProducts, endedLastViewed]);

  const handleToggleEnded = () => {
    if (!showEnded) {
      // 展开时清零：记录当前时间为最后查看时间
      const now = new Date().toISOString();
      localStorage.setItem(endedStorageKey, now);
      setEndedLastViewed(now);
    }
    setShowEnded(prev => !prev);
  };

  const isFiltering = searchQuery.trim() !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">产品专员工作台</h1>
          <p className="text-slate-500 mt-1">管理您提交的选品候选和审核进度</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center gap-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索产品名称或供应商..."
                className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm shadow-sm w-64"
              />
              {inputValue && (
                <button
                  onClick={handleClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="h-[38px] px-3 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl hover:bg-slate-200 transition-colors text-sm font-medium text-slate-600 shadow-sm"
            >
              搜索
            </button>
          </div>
          <button
            onClick={() => setLocation('/entry')}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 text-sm font-medium"
          >
            <Plus size={16} /> 新增录入
          </button>
        </div>
      </div>

      {isFiltering && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>
            搜索"{searchQuery}"，共找到 <strong className="text-slate-800">{filteredProducts.length}</strong> 条结果
          </span>
          <button onClick={handleClear} className="text-primary hover:underline text-xs font-medium">
            清除搜索
          </button>
        </div>
      )}

      {/* ── 需确认 banner ──────────────────────────────────────────────────── */}
      {needsConfirmProducts.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-red-500" />
            <h3 className="text-sm font-semibold text-red-700">需要您确认（{needsConfirmProducts.length}）</h3>
            <span className="text-xs text-red-400">以下产品等待您处理，请尽快确认</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsConfirmProducts.map(product => {
              const isRejection = product.status === 'rejected_unconfirmed';
              const isSupplierChange = product.status === 'supplier_change_requested';
              const actionKey = `${product.id}-${product.status}`;
              const isLoading = pendingAction === actionKey;

              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl border p-4 shadow-sm ${
                    isRejection ? 'border-red-200' : 'border-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <StatusBadge status={product.status} />
                    <SupplierChangeBadge count={product.supplierChangeCount ?? 0} />
                  </div>
                  <p className="font-semibold text-slate-800 text-sm mb-1 line-clamp-1">{product.productName}</p>
                  <p className="text-xs text-slate-500 mb-1">{product.supplierName}</p>
                  {product.managerComment && (
                    <p className={`text-xs rounded px-2 py-1 mb-3 border ${
                      isRejection
                        ? 'bg-red-50 border-red-100 text-red-700'
                        : 'bg-amber-50 border-amber-100 text-amber-700'
                    }`}>
                      {isRejection ? '拒绝原因：' : '换供原因：'}{product.managerComment}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {isRejection && (
                      <button
                        disabled={isLoading}
                        onClick={async e => {
                          e.stopPropagation();
                          setPendingAction(actionKey);
                          try {
                            await sampleAction(product.id, 'acknowledge_rejection');
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={12} />
                        {isLoading ? '处理中…' : '确认知晓'}
                      </button>
                    )}
                    {isSupplierChange && (
                      <button
                        disabled={isLoading}
                        onClick={async e => {
                          e.stopPropagation();
                          setPendingAction(actionKey);
                          try {
                            await sampleAction(product.id, 'acknowledge_supplier_change');
                            // Navigate to entry page so employee can fill in new supplier
                            setLocation(`/entry?id=${product.id}`);
                          } finally {
                            setPendingAction(null);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={12} />
                        {isLoading ? '处理中…' : '确认并开始换供'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main 4-column board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {MAIN_GROUPS.map(group => {
          const groupProducts = filteredProducts
            .filter(p => group.statuses.includes(p.status))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          return (
            <div
              key={group.id}
              className={`rounded-2xl border ${group.color} p-4 flex flex-col h-[calc(100vh-13rem)]`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                  <h3 className={`font-semibold text-sm ${group.headerColor}`}>{group.title}</h3>
                </div>
                <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm border border-slate-100">
                  {groupProducts.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                {groupProducts.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    {isFiltering ? '无匹配结果' : '暂无数据'}
                  </div>
                ) : (
                  groupProducts.map(product => {
                    const reviewSubLabel = group.showReviewSubLabel
                      ? getReviewSubLabel(product.status, product.supplierChangeCount ?? 0)
                      : null;

                    return (
                      <div
                        key={product.id}
                        onClick={() => setLocation(getCardPath(product.status, product.id))}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          {reviewSubLabel ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${reviewSubLabel.className}`}>
                              {reviewSubLabel.label}
                            </span>
                          ) : (
                            <StatusBadge status={product.status} />
                          )}
                          <span className="text-xs text-slate-400 shrink-0 ml-1">
                            {format(new Date(product.updatedAt), 'MM-dd')}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 mb-1">
                          <h4 className="font-bold text-slate-800 group-hover:text-primary transition-colors text-sm leading-snug line-clamp-2 flex-1">
                            {product.productName}
                          </h4>
                          <ProductImage
                            hostedImageUrl={product.hostedImageUrl}
                            imageUrl={product.imageUrl}
                            size="md"
                            alt={product.productName}
                          />
                        </div>
                        {(product.supplierChangeCount ?? 0) > 0 && (
                          <div className="mb-1">
                            <SupplierChangeBadge count={product.supplierChangeCount ?? 0} />
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mb-3 line-clamp-1">
                          {product.supplierName} · {product.productSource}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          <div className="text-sm font-semibold text-slate-700">
                            ¥{product.purchasePrice?.toFixed(2) || '--'}
                          </div>
                          <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-medium">
                            查看 <ArrowRight size={13} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ended section (completed + rejected) — collapsed by default */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
        <button
          onClick={handleToggleEnded}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-100/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            {showEnded ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
            <span className="text-sm font-semibold text-slate-500">已结束</span>
            <span className="text-xs text-slate-400">（已拒绝 / 已入库）</span>
            {endedUnreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
                {endedUnreadCount > 99 ? '99+' : endedUnreadCount}
              </span>
            )}
          </div>
          <span className="bg-white text-slate-500 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm border border-slate-100">
            {endedProducts.length}
          </span>
        </button>

        {showEnded && (
          <div className="px-5 pb-5 pt-1">
            {endedProducts.length === 0 ? (
              <div className="text-center text-slate-400 text-sm py-8 border-2 border-dashed border-slate-200 rounded-xl">
                {isFiltering ? '无匹配结果' : '暂无已结束产品'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {endedProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => setLocation(getCardPath(product.status, product.id))}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group opacity-75 hover:opacity-100"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <StatusBadge status={product.status} />
                      <span className="text-xs text-slate-400 shrink-0 ml-1">
                        {format(new Date(product.updatedAt), 'MM-dd')}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-700 mb-1 group-hover:text-slate-900 transition-colors text-sm leading-snug line-clamp-2">
                      {product.productName}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {product.supplierName} · {product.productSource}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
