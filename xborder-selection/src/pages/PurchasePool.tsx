import React, { memo, useCallback, useState, useMemo, useEffect } from 'react';
import { useAppStore, SampleSkuLine, SampleOption, SkuAnomalyHistoryEntry } from '@/context/StoreContext';
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
import { isProductUnread as hasUnreadEvent, markProductUnreadRead } from '@/lib/unreadEvents';
import { TaskContextPanel } from '@/components/shared/TaskContext';

// 异常类型配置
const ANOMALY_TYPES = [
  { value: 'damaged', label: '货物损坏' },
  { value: 'shortage', label: '数量不足' },
  { value: 'wrong_item', label: '发错货' },
  { value: 'quality', label: '质量问题' },
  { value: 'spec_mismatch', label: '规格不符' },
  { value: 'other', label: '其他' },
] as const;

const ANOMALY_HANDLING_METHOD_LABELS: Record<string, string> = {
  reinspect: '补处理后重新验货',
  replace: '补发/换货',
  accept: '接受现状',
  terminate: '终止采购',
};

function anomalyTypeLabel(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return ANOMALY_TYPES.find(t => t.value === raw)?.label || raw;
}

function anomalyHandlingMethodLabel(value?: string | null) {
  if (!value) return null;
  return ANOMALY_HANDLING_METHOD_LABELS[value] || value;
}

const ANOMALY_HISTORY_STATUS_LABELS: Record<SkuAnomalyHistoryEntry['status'], string> = {
  reported: '已上报',
  handling: '经理已给意见',
  processing: '执行中',
  resolved: '已处理完成',
};

function formatAnomalyTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'MM-dd HH:mm');
}

function getSkuAnomalyHistory(sku: SampleSkuLine): SkuAnomalyHistoryEntry[] {
  if (Array.isArray(sku.anomalyHistory) && sku.anomalyHistory.length > 0) {
    return sku.anomalyHistory;
  }
  if (!sku.anomalyType && !sku.anomalyNote && !sku.anomalyHandlingNote && !sku.anomalyReportedAt) {
    return [];
  }
  const status = sku.anomalyResolvedAt
    ? 'resolved'
    : sku.purchaseStatus === 'anomaly_processing'
      ? 'processing'
      : sku.anomalyHandlingNote || sku.anomalyHandledAt || sku.purchaseStatus === 'anomaly_handling'
        ? 'handling'
        : 'reported';
  return [{
    id: `${sku.id}-legacy-anomaly-1`,
    round: 1,
    status,
    anomalyType: sku.anomalyType ?? null,
    anomalyTypes: sku.anomalyType ? [sku.anomalyType] : null,
    anomalyNote: sku.anomalyNote ?? null,
    reportedAt: sku.anomalyReportedAt ?? null,
    reportedBy: sku.anomalyReportedBy ?? null,
    handlingMethod: sku.anomalyHandlingMethod ?? null,
    handlingNote: sku.anomalyHandlingNote ?? null,
    handledAt: sku.anomalyHandledAt ?? null,
    handledBy: sku.anomalyHandledBy ?? null,
    resolvedAt: sku.anomalyResolvedAt ?? null,
    resolvedBy: null,
  }];
}

const AnomalyHistoryPanel = memo(function AnomalyHistoryPanel({
  history,
}: {
  history: SkuAnomalyHistoryEntry[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const latestType = anomalyTypeLabel(latest.anomalyTypes ?? latest.anomalyType);
  const latestStatus = ANOMALY_HISTORY_STATUS_LABELS[latest.status] || latest.status;

  return (
    <div className="max-w-[240px] rounded-lg border border-red-200 bg-red-50 text-red-700">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full px-2 py-1.5 text-left text-[10px] font-medium flex items-center justify-between gap-2"
      >
        <span className="truncate">
          异常申报（{history.length}） · 最新第{latest.round}次{latestType ? `：${latestType}` : ''}
        </span>
        <span className="shrink-0 text-red-500">{expanded ? '收起' : '展开'}</span>
      </button>
      {expanded && (
        <div className="border-t border-red-200 px-2 py-1.5 space-y-2 text-[10px]">
          {history.map((item) => {
            const anomalyLabel = anomalyTypeLabel(item.anomalyTypes ?? item.anomalyType);
            const methodLabel = anomalyHandlingMethodLabel(item.handlingMethod);
            return (
              <div key={item.id} className="rounded bg-white/70 border border-red-100 px-2 py-1.5 space-y-0.5">
                <div className="font-semibold flex justify-between gap-2">
                  <span>第{item.round}次申报</span>
                  <span>{ANOMALY_HISTORY_STATUS_LABELS[item.status] || item.status}</span>
                </div>
                {item.reportedAt && (
                  <div className="text-red-500">
                    上报：{formatAnomalyTime(item.reportedAt)}{item.reportedBy ? ` · ${item.reportedBy}` : ''}
                  </div>
                )}
                {anomalyLabel && <div>类型：{anomalyLabel}</div>}
                {item.anomalyNote && <div className="whitespace-normal break-words">备注：{item.anomalyNote}</div>}
                {(item.handlingNote || methodLabel) && (
                  <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-amber-700">
                    <div className="font-medium">经理处理意见</div>
                    {methodLabel && <div>方案：{methodLabel}</div>}
                    {item.handlingNote && <div className="whitespace-normal break-words">说明：{item.handlingNote}</div>}
                    {item.handledAt && (
                      <div className="text-amber-600">
                        {formatAnomalyTime(item.handledAt)}{item.handledBy ? ` · ${item.handledBy}` : ''}
                      </div>
                    )}
                  </div>
                )}
                {item.startedAt && <div className="text-orange-600">开始执行：{formatAnomalyTime(item.startedAt)}</div>}
                {item.resolvedAt && <div className="text-emerald-600">处理完成：{formatAnomalyTime(item.resolvedAt)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// SKU状态标签
const SKU_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_purchase:   { label: '待下单',    color: 'text-slate-600',   bg: 'bg-slate-100' },
  ordered:            { label: '已下单',    color: 'text-blue-600',   bg: 'bg-blue-50' },
  arrived:            { label: '已到货',    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  inspecting:         { label: '验货中',    color: 'text-orange-600', bg: 'bg-orange-50' },
  passed:             { label: '已通过',    color: 'text-green-600',  bg: 'bg-green-50' },
  completed:          { label: '已入库',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
  anomaly_reported:   { label: '异常已报',  color: 'text-red-600',    bg: 'bg-red-50' },
  anomaly_handling:   { label: '待执行处理', color: 'text-amber-700', bg: 'bg-amber-50' },
  anomaly_processing: { label: '异常处理中', color: 'text-orange-600', bg: 'bg-orange-50' },
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
const SkuRow = memo(function SkuRow({
  sku,
  productStatus,
  onAction,
  role,
  loading,
}: {
  sku: SampleSkuLine;
  productStatus: string;
  onAction: (skuLineId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  role: string;
  loading: boolean;
}) {
  const [showAnomalyForm, setShowAnomalyForm] = useState(false);
  const [anomalyType, setAnomalyType] = useState('');
  const [anomalyNote, setAnomalyNote] = useState('');
  const [managerNote, setManagerNote] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const status = sku.purchaseStatus || 'pending_purchase';
  const isAnomaly = status.startsWith('anomaly_');
  const waitingForManager = status === 'anomaly_reported';
  const anomalyHistory = useMemo(() => getSkuAnomalyHistory(sku), [sku]);
  const latestAnomaly = anomalyHistory[anomalyHistory.length - 1];
  const handlingMethodLabel = anomalyHandlingMethodLabel(latestAnomaly?.handlingMethod ?? sku.anomalyHandlingMethod);
  const latestHandlingNote = latestAnomaly?.handlingNote ?? sku.anomalyHandlingNote;
  const hasAnomalyReport = anomalyHistory.length > 0;
  
  // 根据状态和角色获取可执行操作
  const actions = useMemo(() => {
    if (role === 'product_manager') {
      return [];
    }

    if (role === 'product_specialist') {
      if (status === 'anomaly_handling') {
        return [{ action: 'start_anomaly_handling', label: '去执行', primary: true }];
      }
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
        case 'anomaly_processing':
          return [{ action: 'resolve_anomaly', label: '处理完成', primary: true }];
        case 'anomaly_resolved':
          return [{ action: 'start_inspection', label: '重新验货', primary: true }];
        default:
          return [];
      }
    }
    
    return [];
  }, [status, role, productStatus]);

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
    handleAction('report_anomaly', {
      anomalyTypes: [anomalyType],
      anomalyNote: anomalyNote.trim(),
    });
  };

  const handleAcknowledgeAnomaly = async () => {
    if (!managerNote.trim()) return;
    await handleAction('acknowledge_anomaly', {
      anomalyHandlingMethod: 'reinspect',
      anomalyHandlingNote: managerNote.trim(),
    });
    setManagerNote('');
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
        {sku.skuCode && (
          <div className="mt-0.5 text-[10px] font-semibold text-slate-500">SKU {sku.skuCode}</div>
        )}
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
        <div className="space-y-1.5">
          {hasAnomalyReport && (
            <AnomalyHistoryPanel history={anomalyHistory} />
          )}
          {role === 'product_manager' && waitingForManager ? (
            <div className="space-y-1.5">
              <textarea
                value={managerNote}
                onChange={e => setManagerNote(e.target.value)}
                placeholder="请填写该 SKU 的处理意见"
                className="w-full min-w-[160px] text-xs border border-red-200 rounded px-2 py-1.5 resize-none h-14 bg-white"
              />
              <button
                type="button"
                onClick={handleAcknowledgeAnomaly}
                disabled={loading || localLoading || !managerNote.trim()}
                className="w-full px-2 py-1 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {localLoading || loading ? '处理中...' : '确认该SKU处理方案'}
              </button>
            </div>
          ) : waitingForManager ? (
            <div className="text-xs text-red-500 font-medium">
              等待经理处置
            </div>
          ) : actions.length > 0 ? (
            <>
            {(latestHandlingNote || handlingMethodLabel) && (
              <div className="text-[10px] rounded bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 max-w-[220px]">
                <div className="font-medium">经理处理意见</div>
                {handlingMethodLabel && <div>方案：{handlingMethodLabel}</div>}
                {latestHandlingNote && <div className="whitespace-normal break-words">说明：{latestHandlingNote}</div>}
              </div>
            )}
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
            </>
          ) : (
            !hasAnomalyReport && <span className="text-xs text-slate-400">-</span>
          )}
        </div>
      </td>
    </tr>
  );
}, (prev, next) =>
  prev.sku === next.sku &&
  prev.productStatus === next.productStatus &&
  prev.onAction === next.onAction &&
  prev.role === next.role &&
  prev.loading === next.loading
);

// 经理异常处置面板
const ManagerAnomalyPanel = memo(function ManagerAnomalyPanel({
  sku,
  productId,
  productStatus,
  onAction,
  loading,
}: {
  sku: SampleSkuLine;
  productId: string;
  productStatus: string;
  onAction: (productId: string, skuLineId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  loading: boolean;
}) {
  const [note, setNote] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const skuStatus = sku.purchaseStatus || '';
  const anomalyHistory = useMemo(() => getSkuAnomalyHistory(sku), [sku]);
  const latestAnomaly = anomalyHistory[anomalyHistory.length - 1];
  const anomalyLabel = anomalyTypeLabel(latestAnomaly?.anomalyTypes ?? latestAnomaly?.anomalyType ?? sku.anomalyType);

  if (skuStatus === 'anomaly_resolved') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
        <div className="text-sm font-medium text-amber-800">异常已处理 — {sku.skuName || '未命名'}</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="终止采购时必填原因"
          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none h-14 bg-white"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || localLoading}
            onClick={async () => {
              setLocalLoading(true);
              try { await onAction(productId, sku.id, 'accept_goods', {}); } finally { setLocalLoading(false); }
            }}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white disabled:opacity-50"
          >
            接受入库
          </button>
          <button
            type="button"
            disabled={loading || localLoading || !note.trim()}
            onClick={async () => {
              setLocalLoading(true);
              try {
                await onAction(productId, sku.id, 'terminate_order', { comment: note.trim() });
                setNote('');
              } finally { setLocalLoading(false); }
            }}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-slate-600 text-white disabled:opacity-50"
          >
            终止采购
          </button>
        </div>
      </div>
    );
  }

  if (skuStatus !== 'anomaly_reported') {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle size={14} className="text-red-500" />
        <span className="font-medium text-red-700">SKU异常: {sku.skuName || '未命名'}</span>
      </div>
      <div className="text-xs text-slate-600 pl-6">
        {anomalyLabel && <span>类型: {anomalyLabel}</span>}
        {(latestAnomaly?.anomalyNote || sku.anomalyNote) && <p className="mt-0.5 italic">"{latestAnomaly?.anomalyNote || sku.anomalyNote}"</p>}
      </div>
      <div className="pl-6 space-y-1.5">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="请填写该 SKU 的处理意见（必填）"
          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none h-14 bg-white"
        />
        <button
          type="button"
          disabled={loading || localLoading || !note.trim()}
          onClick={async () => {
            setLocalLoading(true);
            try {
              await onAction(productId, sku.id, 'acknowledge_anomaly', {
                anomalyHandlingMethod: 'reinspect',
                anomalyHandlingNote: note.trim(),
              });
              setNote('');
            } finally {
              setLocalLoading(false);
            }
          }}
          className="w-full py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {localLoading || loading ? '处理中...' : '确认该SKU处理方案'}
        </button>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.sku === next.sku &&
  prev.productId === next.productId &&
  prev.productStatus === next.productStatus &&
  prev.onAction === next.onAction &&
  prev.loading === next.loading
);

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
  const onSkuActionForProduct = useCallback(
    (skuLineId: string, action: string, data?: Record<string, unknown>) =>
      onSkuAction(product.id, skuLineId, action, data),
    [onSkuAction, product.id],
  );

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
    const inspecting = selectedSkus.filter(s => ['inspecting', 'anomaly_reported', 'anomaly_handling', 'anomaly_processing', 'anomaly_resolved'].includes(s.purchaseStatus || '')).length;
    const anomalyReported = selectedSkus.filter(s => s.purchaseStatus === 'anomaly_reported');
    const anomalyActive = selectedSkus.filter(s => ['anomaly_reported', 'anomaly_handling', 'anomaly_processing'].includes(s.purchaseStatus || ''));
    return { total: selectedSkus.length, passed, inspecting, anomalyReported, anomalyActive };
  }, [selectedSkus]);

  // 是否可以入库（所有SKU都是passed或completed）
  const allSkusPassed = selectedSkus.length > 0 &&
    selectedSkus.every(s => ['passed', 'completed'].includes(s.purchaseStatus || ''));
  const canComplete = allSkusPassed &&
    (product.status === 'goods_inspected' || product.status === 'inspecting');

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
      skuStats.anomalyActive.length > 0 ? "border-red-300" : "border-slate-200"
    )}>
      {/* 卡片头部 */}
      <div 
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors relative"
        onClick={() => { onMarkViewed(); setExpanded(!expanded); }}
      >
        {isUnread && (
          <span className="absolute top-3 right-10 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white shadow-sm z-10">
            1
          </span>
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
            {product.spuCode && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-900 text-white">
                SPU {product.spuCode}
              </span>
            )}
            {skuStats.anomalyActive.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                <AlertTriangle size={10} />
                {skuStats.anomalyActive.length}个SKU异常
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
          <div className="mt-2">
            <TaskContextPanel taskId={(product as any).taskId} compact />
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
                      productStatus={product.status}
                      onAction={onSkuActionForProduct}
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
          {role === 'product_manager' && selectedSkus.some(sku => sku.purchaseStatus === 'anomaly_resolved') && (
            <div className="space-y-2">
              {selectedSkus
                .filter(sku => sku.purchaseStatus === 'anomaly_resolved')
                .map(sku => (
                <ManagerAnomalyPanel
                  key={sku.id}
                  sku={sku}
                  productId={product.id}
                  productStatus={product.status}
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

  const [unreadVersion, setUnreadVersion] = useState(0);
  const unreadRole = role === 'product_manager' || role === 'product_specialist' ? role : null;
  const markProductViewed = (product: any) => {
    if (!unreadRole) return;
    markProductUnreadRead(product, unreadRole, currentUser.id, ['purchase-pool']);
    setUnreadVersion(v => v + 1);
  };
  const isProductUnread = (product: any) => {
    unreadVersion;
    return !!unreadRole && hasUnreadEvent(product, unreadRole, currentUser.id, ['purchase-pool']);
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
              isUnread={isProductUnread(product)}
              onMarkViewed={() => markProductViewed(product)}
            />
          ))
        )}
      </div>
    </div>
  );
}
