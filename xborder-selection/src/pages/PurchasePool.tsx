import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore, SampleSkuLine, SampleOption } from '@/context/StoreContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { HistoryLog, HistoryLogEntry } from '@/components/shared/HistoryLog';
import { ProductImage } from '@/components/shared/ProductImage';
import { format } from 'date-fns';
import {
  ShoppingCart, Truck, PackageOpen, Search, CheckCircle2, PackageCheck,
  ExternalLink, AlertTriangle, ChevronDown, ChevronUp, Package,
  Clock, User,
} from 'lucide-react';
import { cn } from '@/components/shared/StatusBadge';

// 异常类型配置
const ANOMALY_TYPES = [
  { value: 'damaged', label: '货物损坏' },
  { value: 'shortage', label: '数量不足' },
  { value: 'wrong_item', label: '发错货' },
  { value: 'quality', label: '质量问题' },
  { value: 'spec_mismatch', label: '规格不符' },
  { value: 'other', label: '其他' },
] as const;

// SKU状态标签
const SKU_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_purchase:   { label: '待下单',    color: 'text-slate-600',   bg: 'bg-slate-100' },
  ordered:            { label: '已下单',    color: 'text-blue-600',   bg: 'bg-blue-50' },
  arrived:            { label: '已到货',    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  inspecting:         { label: '验货中',    color: 'text-orange-600', bg: 'bg-orange-50' },
  passed:             { label: '已通过',    color: 'text-green-600',  bg: 'bg-green-50' },
  completed:          { label: '已入库',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  anomaly_reported:   { label: '异常已报',  color: 'text-red-600',    bg: 'bg-red-50' },
  anomaly_resolved:   { label: '异常已解决', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  terminated:         { label: '已终止',    color: 'text-slate-500',  bg: 'bg-slate-100' },
};

function SkuStatusBadge({ status }: { status: string }) {
  const config = SKU_STATUS_CONFIG[status] || { label: status, color: 'text-slate-600', bg: 'bg-slate-100' };
  return (
    <span className={cn(
      "px-2 py-0.5 text-xs font-medium rounded-full",
      config.color, config.bg
    )}>
      {config.label}
    </span>
  );
}

// SKU行组件
function SkuRow({
  sku,
  onAction,
  role,
  loading,
}: {
  sku: SampleSkuLine;
  onAction: (skuLineId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  role: string;
  loading: boolean;
}) {
  const [showAnomalyForm, setShowAnomalyForm] = useState(false);
  const [anomalyType, setAnomalyType] = useState('');
  const [anomalyNote, setAnomalyNote] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const status = sku.purchaseStatus || 'pending_purchase';
  const isAnomaly = status === 'anomaly_reported';
  
  // 根据状态和角色获取可执行操作
  const actions = useMemo(() => {
    // 经理端：异常状态显示解决异常按钮
    if (role === 'product_manager') {
      if (status === 'anomaly_reported') {
        return [
          { action: 'resolve_anomaly', label: '解决异常', primary: true },
        ];
      }
      return [];
    }
    
    // 专员端：正常的采购流程操作
    if (role === 'product_specialist') {
      switch (status) {
        case 'pending_purchase':
          return [{ action: 'confirm_order', label: '确认下单', primary: true }];
        case 'ordered':
          return [{ action: 'mark_arrived', label: '标记到货', primary: true }];
        case 'arrived':
          return [{ action: 'start_inspection', label: '开始验货', primary: true }];
        case 'inspecting':
          return [
            { action: 'pass_inspection', label: '验货通过', primary: true },
            { action: 'report_anomaly', label: '报告异常', primary: false, danger: true },
          ];
        case 'anomaly_resolved':
          return [{ action: 'start_inspection', label: '重新验货', primary: true }];
        default:
          return [];
      }
    }
    
    return [];
  }, [status, role]);

  const handleAction = async (action: string, data?: Record<string, unknown>) => {
    setLocalLoading(true);
    try {
      await onAction(sku.id, action, data);
    } finally {
      setLocalLoading(false);
      setShowAnomalyForm(false);
      setAnomalyType('');
      setAnomalyNote('');
    }
  };

  const handleReportAnomaly = () => {
    if (!anomalyType || !anomalyNote.trim()) return;
    handleAction('report_anomaly', { anomalyType, anomalyNote: anomalyNote.trim() });
  };

  const priceDisplay = sku.unitPrice ? '¥' + sku.unitPrice.toFixed(2) : '-';
  const qtyDisplay = sku.purchaseQuantity || '-';
  const subtotal = sku.unitPrice && sku.purchaseQuantity 
    ? '¥' + (sku.unitPrice * sku.purchaseQuantity).toFixed(2)
    : '-';

  return (
    <tr className={cn(
      "border-b border-slate-100 last:border-0",
      isAnomaly && "bg-red-50"
    )}>
      {/* 图片 - 使用ProductImage组件 */}
      <td className="py-2 px-2 w-12">
        <ProductImage
          hostedImageUrl={sku.hostedImageUrl}
          imageUrl={sku.imageUrl}
          size="md"
          className="w-10 h-10"
          alt={sku.skuName || 'SKU'}
        />
      </td>
      
      {/* 名称 */}
      <td className="py-2 px-2">
        <div className="font-medium text-sm text-slate-800">{sku.skuName || '未命名SKU'}</div>
        {sku.attributes && Object.keys(sku.attributes).length > 0 && (
          <div className="text-xs text-slate-500 flex flex-wrap gap-1 mt-0.5">
            {Object.entries(sku.attributes).map(([k, v]) => (
              <span key={k} className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </td>
      
      {/* 单价 */}
      <td className="py-2 px-2 text-sm text-slate-600">
        {priceDisplay}
      </td>
      
      {/* 数量 */}
      <td className="py-2 px-2 text-sm text-slate-600">
        {qtyDisplay}
      </td>
      
      {/* 小计 */}
      <td className="py-2 px-2 text-sm font-medium text-slate-800">
        {subtotal}
      </td>
      
      {/* 状态 */}
      <td className="py-2 px-2">
        <SkuStatusBadge status={status} />
      </td>
      
      {/* 操作 */}
      <td className="py-2 px-2 min-w-[180px]">
        {isAnomaly ? (
          <div className="text-xs text-red-500">
            <div className="font-medium">等待经理处置</div>
            {sku.anomalyType && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                {ANOMALY_TYPES.find(t => t.value === sku.anomalyType)?.label || sku.anomalyType}
              </div>
            )}
            {sku.anomalyNote && (
              <div className="text-[10px] text-slate-500 italic truncate max-w-[150px]">
                {sku.anomalyNote}
              </div>
            )}
          </div>
        ) : actions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {actions.map(a => (
              a.action === 'report_anomaly' ? (
                !showAnomalyForm ? (
                  <button
                    key={a.action}
                    onClick={() => setShowAnomalyForm(true)}
                    disabled={loading || localLoading}
                    className="px-2 py-1 text-xs font-medium rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
                  >
                    {a.label}
                  </button>
                ) : (
                  <div key={a.action} className="w-full p-2 bg-red-50 rounded-lg border border-red-200 space-y-1.5">
                    <select
                      value={anomalyType}
                      onChange={e => setAnomalyType(e.target.value)}
                      className="w-full text-xs border border-red-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">选择异常类型</option>
                      {ANOMALY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <textarea
                      value={anomalyNote}
                      onChange={e => setAnomalyNote(e.target.value)}
                      placeholder="描述异常情况..."
                      className="w-full text-xs border border-red-200 rounded px-2 py-1 bg-white resize-none h-16"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={handleReportAnomaly}
                        disabled={!anomalyType || !anomalyNote.trim() || localLoading}
                        className="flex-1 py-1 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        {localLoading ? '提交中...' : '提交异常'}
                      </button>
                      <button
                        onClick={() => { setShowAnomalyForm(false); setAnomalyType(''); setAnomalyNote(''); }}
                        className="px-2 py-1 text-xs font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <button
                  key={a.action}
                  onClick={() => handleAction(a.action)}
                  disabled={loading || localLoading}
                  className={cn(
                    "px-2 py-1 text-xs font-medium rounded-lg",
                    a.primary
                      ? "bg-blue-500 text-white hover:bg-blue-600"
                      : "border border-slate-300 text-slate-600 hover:bg-slate-50",
                    (loading || localLoading) && "opacity-50"
                  )}
                >
                  {a.label}
                </button>
              )
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}

// 经理异常处置面板
function ManagerAnomalyPanel({
  sku,
  productId,
  onAction,
  loading,
}: {
  sku: SampleSkuLine;
  productId: string;
  onAction: (productId: string, skuLineId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}) {
  const [action, setAction] = useState<'resolve' | 'terminate' | ''>('');
  const [note, setNote] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const handleSubmit = async () => {
    if (!action) return;
    setLocalLoading(true);
    try {
      await onAction(productId, sku.id, action === 'resolve' ? 'resolve_anomaly' : 'terminate_purchase', {
        note: note.trim(),
      });
      setAction('');
      setNote('');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle size={14} className="text-red-500" />
        <span className="font-medium text-red-700">SKU异常: {sku.skuName || '未命名'}</span>
      </div>
      <div className="text-xs text-slate-600 pl-6">
        {sku.anomalyType && <span>类型: {ANOMALY_TYPES.find(t => t.value === sku.anomalyType)?.label || sku.anomalyType}</span>}
        {sku.anomalyNote && <p className="mt-0.5 italic">"{sku.anomalyNote}"</p>}
      </div>
      <div className="flex gap-1 pl-6 pt-1">
        <button
          onClick={() => setAction('resolve')}
          className={cn(
            "px-2 py-1 text-xs rounded-lg border transition-colors",
            action === 'resolve'
              ? "bg-green-500 text-white border-green-500"
              : "border-green-300 text-green-600 hover:bg-green-50"
          )}
        >
          重新验货
        </button>
        <button
          onClick={() => setAction('terminate')}
          className={cn(
            "px-2 py-1 text-xs rounded-lg border transition-colors",
            action === 'terminate'
              ? "bg-slate-500 text-white border-slate-500"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          )}
        >
          终止采购
        </button>
      </div>
      {action && (
        <div className="pl-6 space-y-1.5">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={action === 'resolve' ? "备注（可选）" : "终止原因"}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none h-14 bg-white"
          />
          <div className="flex gap-1">
            <button
              onClick={handleSubmit}
              disabled={loading || localLoading || (action === 'terminate' && !note.trim())}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg text-white",
                action === 'resolve' ? "bg-green-500 hover:bg-green-600" : "bg-slate-500 hover:bg-slate-600",
                (loading || localLoading || (action === 'terminate' && !note.trim())) && "opacity-50"
              )}
            >
              {localLoading || loading ? '处理中...' : (action === 'resolve' ? '确认重新验货' : '确认终止')}
            </button>
            <button
              onClick={() => { setAction(''); setNote(''); }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 产品卡片组件
function ProductCard({
  product,
  sampleOptions,
  sampleSkuLines,
  onSkuAction,
  onCompletePurchase,
  role,
  isUnread,
  onMarkViewed,
}: {
  isUnread: boolean;
  onMarkViewed: () => void;
  product: any;
  sampleOptions: SampleOption[];
  sampleSkuLines: SampleSkuLine[];
  onSkuAction: (productId: string, skuLineId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  onCompletePurchase: (productId: string) => Promise<void>;
  role: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);

  // 获取经理选中的方案（selectedAt不为空）
  const selectedOptions = sampleOptions.filter(
    o => o.productId === product.id && o.selectedAt !== null
  );

  // 获取所有已选SKU
  const selectedSkus = sampleSkuLines.filter(
    s => selectedOptions.some(o => o.id === s.sampleOptionId) && s.managerSelected
  );

  // 统计各状态SKU数量
  const skuStats = useMemo(() => {
    const passed = selectedSkus.filter(s => s.purchaseStatus === 'passed').length;
    const inspecting = selectedSkus.filter(s => ['inspecting', 'anomaly_reported', 'anomaly_resolved'].includes(s.purchaseStatus || '')).length;
    const anomalyReported = selectedSkus.filter(s => s.purchaseStatus === 'anomaly_reported');
    return { total: selectedSkus.length, passed, inspecting, anomalyReported };
  }, [selectedSkus]);

  // 是否可以入库（所有SKU都是passed或completed）
  const canComplete = selectedSkus.length > 0 && 
    selectedSkus.every(s => ['passed', 'completed'].includes(s.purchaseStatus || ''));

  // 获取历史日志
  const historyLog: HistoryLogEntry[] = (product as any).historyLog || [];

  const handleComplete = async () => {
    if (!confirm('确认所有SKU验货通过，完成入库？')) return;
    setLoading(true);
    try {
      await onCompletePurchase(product.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm",
      skuStats.anomalyReported.length > 0 ? "border-red-300" : "border-slate-200"
    )}>
      {/* 卡片头部 */}
      <div 
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors relative"
        onClick={() => { onMarkViewed(); setExpanded(!expanded); }}
      >
        {isUnread && (
          <span className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse z-10" />
        )}
        <ProductImage
          hostedImageUrl={product.hostedImageUrl}
          imageUrl={product.imageUrl}
          size="md"
          alt={product.productName}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={product.status} />
            {skuStats.anomalyReported.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                <AlertTriangle size={10} />
                {skuStats.anomalyReported.length}个SKU异常
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 truncate">{product.productName}</h3>
          <div className="text-xs text-slate-500 mt-0.5">
            {skuStats.total > 0 ? (
              <span>{skuStats.passed}/{skuStats.total} SKU已验货通过</span>
            ) : (
              <span>暂无已选SKU</span>
            )}
            {skuStats.inspecting > 0 && <span className="text-orange-600 ml-2">验货中: {skuStats.inspecting}</span>}
          </div>
        </div>
        <button className="p-1 text-slate-400 hover:text-slate-600">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* SKU列表 */}
          {selectedSkus.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs text-slate-500">
                    <th className="py-2 px-2 font-medium w-12">图片</th>
                    <th className="py-2 px-2 font-medium">名称</th>
                    <th className="py-2 px-2 font-medium w-20">单价</th>
                    <th className="py-2 px-2 font-medium w-16">数量</th>
                    <th className="py-2 px-2 font-medium w-20">小计</th>
                    <th className="py-2 px-2 font-medium w-20">状态</th>
                    <th className="py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSkus.map(sku => (
                    <SkuRow
                      key={sku.id}
                      sku={sku}
                      onAction={(skuLineId, action, data) => onSkuAction(product.id, skuLineId, action, data)}
                      role={role}
                      loading={loading}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-sm text-slate-400 py-4 bg-slate-50 rounded-lg">
              暂无已选SKU
            </div>
          )}

          {/* 经理异常处置面板 */}
          {role === 'product_manager' && skuStats.anomalyReported.length > 0 && (
            <div className="space-y-2">
              {skuStats.anomalyReported.map(sku => (
                <ManagerAnomalyPanel
                  key={sku.id}
                  sku={sku}
                  productId={product.id}
                  onAction={onSkuAction}
                  loading={loading}
                />
              ))}
            </div>
          )}

          {/* 入库按钮 */}
          {canComplete && role === 'product_specialist' && (
            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <PackageCheck size={18} />
              {loading ? '处理中...' : '确认入库'}
            </button>
          )}

          {/* 方案信息 */}
          {selectedOptions.length > 0 && (
            <div className="text-xs text-slate-500">
              {selectedOptions.map(opt => (
                <div key={opt.id} className="flex items-center gap-2 mt-1">
                  <Package size={12} className="text-slate-400" />
                  <span className="font-medium">{opt.optionLabel || '方案'}</span>
                  {opt.supplierName && <span className="text-slate-400">| {opt.supplierName}</span>}
                  {opt.link1688 && typeof opt.link1688 === 'string' && opt.link1688.startsWith('http') && (
                    <a href={opt.link1688} target="_blank" rel="noopener noreferrer" 
                       className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
                      1688 <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 操作日志 */}
          {historyLog.length > 0 && (
            <HistoryLog log={historyLog} title="采购日志" maxItems={10} />
          )}
        </div>
      )}
    </div>
  );
}

// 分组配置
const GROUPS = [
  {
    id: 'pending' as const,
    label: '待执行',
    statuses: ['pending_purchase'] as string[],
  },
  {
    id: 'active' as const,
    label: '执行中',
    statuses: ['ordered', 'goods_arrived', 'inspecting', 'goods_inspected', 'exception_reported', 'inspection_anomaly', 'anomaly_handling', 'anomaly_resolved'] as string[],
  },
  {
    id: 'done' as const,
    label: '已完成',
    statuses: ['completed', 'terminated'] as string[],
  },
];

export default function PurchasePool() {
  const { products, sampleOptions, sampleSkuLines, skuPurchaseAction, completePurchase, role, currentUser } = useAppStore();

  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'done'>('pending');

  // ── 未读提醒逻辑 ──
  const productViewedKey = (productId: string) => 'purchase_pool_pv_' + currentUser.id + '_' + productId;
  const [productLastViewed, setProductLastViewed] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    products.forEach(p => { init[p.id] = localStorage.getItem(productViewedKey(p.id)); });
    return init;
  });
  const markProductViewed = (productId: string) => {
    const now = new Date().toISOString();
    localStorage.setItem(productViewedKey(productId), now);
    setProductLastViewed(prev => ({ ...prev, [productId]: now }));
  };
  const isProductUnread = (product: { id: string; updatedAt: string }) => {
    const viewed = productLastViewed[product.id];
    if (!viewed) return true;
    return product.updatedAt > viewed;
  };

  const purchaseProducts = products
    .filter(p => ['pending_purchase', 'ordered', 'goods_arrived', 'inspecting', 'goods_inspected', 'completed', 'exception_reported', 'terminated', 'inspection_anomaly', 'anomaly_handling', 'anomaly_resolved'].includes(p.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleSkuAction = async (
    productId: string,
    skuLineId: string,
    action: string,
    data?: Record<string, unknown>
  ) => {
    await skuPurchaseAction(productId, skuLineId, action, data);
  };

  const handleComplete = async (productId: string) => {
    await completePurchase(productId);
  };

  // 统计各状态产品数量
  const countMap = useMemo(() => ({
    pending: purchaseProducts.filter(p => GROUPS[0].statuses.includes(p.status)).length,
    active: purchaseProducts.filter(p => GROUPS[1].statuses.includes(p.status)).length,
    done: purchaseProducts.filter(p => GROUPS[2].statuses.includes(p.status)).length,
  }), [purchaseProducts]);

  // 根据当前Tab筛选产品
  const getFilteredProducts = useMemo(() => {
    const group = GROUPS.find(g => g.id === activeTab);
    if (!group) return [];
    return purchaseProducts.filter(p => group.statuses.includes(p.status));
  }, [activeTab, purchaseProducts]);

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">采购池</h1>
          <p className="text-sm text-slate-500 mt-0.5">SKU级采购执行管理</p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
          role === 'product_manager'
            ? 'bg-violet-50 text-violet-600 border-violet-200'
            : 'bg-blue-50 text-blue-600 border-blue-200'
        )}>
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            role === 'product_manager' ? 'bg-violet-400' : 'bg-blue-400'
          )} />
          {role === 'product_manager' ? '产品经理视图' : '产品专员视图'}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: '待执行', count: countMap.pending, color: 'text-orange-600 bg-orange-50 border-orange-200', statuses: ['pending_purchase'] },
          { label: '执行中', count: countMap.active,  color: 'text-blue-600 bg-blue-50 border-blue-200', statuses: ['ordered', 'goods_arrived', 'inspecting', 'goods_inspected', 'exception_reported', 'inspection_anomaly', 'anomaly_handling', 'anomaly_resolved'] },
          { label: '已完成', count: countMap.done,    color: 'text-emerald-600 bg-emerald-50 border-emerald-200', statuses: ['completed', 'terminated'] },
        ].map(s => {
          const unreadCount = purchaseProducts.filter(p => s.statuses.includes(p.status) && isProductUnread(p)).length;
          return (
            <div key={s.label} className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border",
              s.color
            )}>
              <span className="text-xl font-bold">{s.count}</span>
              <span className="text-sm font-medium">{s.label}</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 状态Tab栏 */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {[
          { key: 'pending' as const, label: '待执行', count: countMap.pending, color: 'text-orange-600 border-orange-400' },
          { key: 'active' as const, label: '执行中', count: countMap.active, color: 'text-blue-600 border-blue-400' },
          { key: 'done' as const, label: '已完成', count: countMap.done, color: 'text-emerald-600 border-emerald-400' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.key
                ? `${tab.color} border-current`
                : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* 当前状态的产品卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {getFilteredProducts.length === 0 ? (
          <p className="text-sm text-center text-slate-400 py-12 col-span-2">
            暂无{activeTab === 'pending' ? '待执行' : activeTab === 'active' ? '执行中' : '已完成'}产品
          </p>
        ) : (
          getFilteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              sampleOptions={sampleOptions}
              sampleSkuLines={sampleSkuLines}
              onSkuAction={handleSkuAction}
              onCompletePurchase={handleComplete}
              role={role}
            />
          ))
        )}
      </div>
    </div>
  );
}
