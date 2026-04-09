import React, { useState } from 'react';
import { useAppStore } from '@/context/StoreContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import {
  ShoppingCart, Truck, PackageOpen, Search, CheckCircle2, PackageCheck,
  ExternalLink, User, Calendar, MessageSquare, Tag, AlertTriangle,
} from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';

const PURCHASE_STATUSES = [
  'pending_purchase', 'ordered', 'goods_arrived',
  'inspecting', 'goods_inspected', 'completed',
  'exception_reported', 'terminated',
] as const;

const PROGRESS_STEPS = [
  { key: 'pending_purchase', label: '待下单',   Icon: ShoppingCart },
  { key: 'ordered',          label: '已下单',   Icon: Truck },
  { key: 'goods_arrived',    label: '已到货',   Icon: PackageOpen },
  { key: 'inspecting',       label: '验货中',   Icon: Search },
  { key: 'goods_inspected',  label: '验货通过', Icon: CheckCircle2 },
  { key: 'completed',        label: '已入库',   Icon: PackageCheck },
] as const;

const STEP_IDX: Record<string, number> = {
  pending_purchase: 0,
  ordered:          1,
  goods_arrived:    2,
  inspecting:       3,
  goods_inspected:  4,
  completed:        5,
};

const ACTION_CONFIG: Record<string, { label: string; action: string; confirm: string }> = {
  pending_purchase: { label: '确认已向供应商下单', action: 'confirm_order',     confirm: '确认已向供应商完成下单？' },
  ordered:          { label: '标记货物已到',       action: 'mark_arrived',     confirm: '确认货物已到达仓库？' },
  goods_arrived:    { label: '开始验货',           action: 'start_inspection', confirm: '确认开始验货流程？' },
  inspecting:       { label: '确认验货通过',        action: 'pass_inspection',  confirm: '确认验货已通过，货物合格？' },
  goods_inspected:  { label: '确认入库完成',        action: 'complete',         confirm: '确认货物已完成入库？' },
};

const COMPLETED_DISPLAY_LIMIT = 20;

const GROUPS = [
  {
    id:          'pending',
    label:       '待执行',
    statuses:    ['pending_purchase'] as string[],
    emptyText:   '暂无待下单产品',
    dotColor:    'bg-orange-400',
    headerColor: 'text-orange-700',
    border:      'border-orange-200 bg-orange-50/30',
    badgeBg:     'bg-orange-100 text-orange-700',
  },
  {
    id:          'active',
    label:       '执行中',
    statuses:    ['ordered', 'goods_arrived', 'inspecting', 'goods_inspected', 'exception_reported'] as string[],
    emptyText:   '暂无执行中产品',
    dotColor:    'bg-blue-400',
    headerColor: 'text-blue-700',
    border:      'border-blue-200 bg-blue-50/30',
    badgeBg:     'bg-blue-100 text-blue-700',
  },
  {
    id:          'done',
    label:       '已完成 / 已终止',
    statuses:    ['completed', 'terminated'] as string[],
    emptyText:   '暂无已完成产品',
    dotColor:    'bg-emerald-400',
    headerColor: 'text-emerald-700',
    border:      'border-emerald-200 bg-emerald-50/30',
    badgeBg:     'bg-emerald-100 text-emerald-700',
  },
] as const;

function ProgressBar({ status }: { status: string }) {
  if (status === 'exception_reported') {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-red-50 border border-red-100">
        <AlertTriangle size={13} className="text-red-500 shrink-0" />
        <span className="text-xs text-red-600 font-medium">采购异常已上报，等待经理处置</span>
      </div>
    );
  }
  if (status === 'terminated') {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-slate-100 border border-slate-200">
        <AlertTriangle size={13} className="text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500 font-medium">采购已终止</span>
      </div>
    );
  }

  const idx = STEP_IDX[status] ?? 0;
  return (
    <div className="flex items-center">
      {PROGRESS_STEPS.map((step, i) => {
        const done   = i < idx;
        const active = i === idx;
        const { Icon } = step;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                done   ? 'bg-primary text-white' :
                active ? 'bg-primary/10 text-primary ring-2 ring-primary/30' :
                         'bg-slate-100 text-slate-400'
              }`}>
                <Icon size={13} />
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                done || active ? 'text-primary' : 'text-slate-400'
              }`}>{step.label}</span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-0.5 mb-4 rounded-full ${done ? 'bg-primary' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

type Product       = ReturnType<typeof useAppStore>['products'][number];
type SampleOption  = ReturnType<typeof useAppStore>['sampleOptions'][number];
type SampleSkuLine = ReturnType<typeof useAppStore>['sampleSkuLines'][number];

function ProductCard({
  product,
  role,
  sampleOptions,
  sampleSkuLines,
  onAction,
}: {
  product:        Product;
  role:           string;
  sampleOptions:  SampleOption[];
  sampleSkuLines: SampleSkuLine[];
  onAction:       (id: string, action: string, data?: Record<string, unknown>) => Promise<void>;
}) {
  const [confirming, setConfirming]               = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [reportingException, setReportingException] = useState(false);
  const [exceptionDesc, setExceptionDesc]         = useState('');
  const [managerNote, setManagerNote]             = useState('');

  const actionCfg         = ACTION_CONFIG[product.status];
  const isExceptionState  = product.status === 'exception_reported';
  const isTerminated      = product.status === 'terminated';
  const canReportException =
    role === 'product_specialist' &&
    ['goods_arrived', 'inspecting'].includes(product.status);
  const hasAnomaly = !!(product as any).anomalyNote;

  const selectedOption = sampleOptions.find(
    o => o.productId === product.id && o.selectedAt !== null,
  );
  const selectedSkus = selectedOption
    ? sampleSkuLines.filter(s => s.sampleOptionId === selectedOption.id && s.managerSelected)
    : [];

  const handleConfirm = async () => {
    if (!actionCfg) return;
    setLoading(true);
    try {
      await onAction(product.id, actionCfg.action);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  const handleReportException = async () => {
    if (!exceptionDesc.trim()) return;
    setLoading(true);
    try {
      await onAction(product.id, 'report_exception', { anomalyNote: exceptionDesc.trim() });
      setReportingException(false);
      setExceptionDesc('');
    } finally {
      setLoading(false);
    }
  };

  const handleManagerDecision = async (decision: string) => {
    setLoading(true);
    try {
      await onAction(product.id, decision, { note: managerNote.trim() || undefined });
      setManagerNote('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 space-y-3 ${
      isExceptionState ? 'border-red-300' :
      isTerminated     ? 'border-slate-300 opacity-80' :
                         'border-slate-200'
    }`}>
      {/* ── 卡片头部 ── */}
      <div className="flex items-start gap-3">
        <ProductImage
          hostedImageUrl={product.hostedImageUrl}
          imageUrl={product.imageUrl}
          size="md"
          alt={product.productName}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={product.status} />
            {hasAnomaly && (product.status === 'completed' || product.status === 'terminated') && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                <AlertTriangle size={9} />异常处理过
              </span>
            )}
            {product.link1688 && (
              <a
                href={product.link1688}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-primary flex items-center gap-0.5"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={11} />1688
              </a>
            )}
          </div>
          <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2">
            {product.productName}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{product.supplierName || '供应商未知'}</p>
        </div>
      </div>

      {/* ── 进度条 ── */}
      <ProgressBar status={product.status} />

      {/* ── 经理决策信息（正常流） ── */}
      {product.managerReviewedAt && (
        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 space-y-1">
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <User size={11} />经理决策：{product.managerReviewedBy}
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {format(new Date(product.managerReviewedAt), 'MM-dd HH:mm')}
            </span>
          </div>
          {product.managerComment && (
            <div className="flex items-start gap-1 text-xs text-slate-600">
              <MessageSquare size={11} className="mt-0.5 shrink-0" />
              <span>{product.managerComment}</span>
            </div>
          )}
        </div>
      )}

      {/* ── SKU 方案信息 ── */}
      {selectedOption ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 space-y-1.5">
          <div className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
            <Tag size={11} />已选方案
          </div>
          <div className="text-xs text-slate-700">
            {selectedOption.optionLabel || selectedOption.supplierName || '方案'}
            {selectedOption.optionLabel && selectedOption.supplierName && (
              <span className="text-slate-400 ml-1">· {selectedOption.supplierName}</span>
            )}
          </div>
          {selectedOption.selectionNote && (
            <div className="text-xs text-slate-500 italic">{selectedOption.selectionNote}</div>
          )}
          {selectedSkus.length > 0 && (
            <div className="pt-1.5 border-t border-indigo-100 space-y-1">
              <div className="text-[10px] font-semibold text-indigo-600">
                已选 SKU（{selectedSkus.length} 款）
              </div>
              {selectedSkus.map(sku => (
                <div key={sku.id} className="flex items-center justify-between text-xs gap-2">
                  <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                  <span className="text-slate-700 truncate flex-1">{sku.skuName || '规格未命名'}</span>
                  <span className="ml-2 shrink-0 text-slate-400 font-mono text-[11px]">
                    {sku.unitPrice ? `¥${Number(sku.unitPrice).toFixed(2)}` : ''}
                    {sku.purchaseQuantity ? (
                      <span className="ml-1 text-indigo-600 font-semibold">× {sku.purchaseQuantity} 件</span>
                    ) : sku.moq ? ` · MOQ ${sku.moq}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 space-y-1.5">
          <div className="text-[10px] font-semibold text-slate-400 tracking-wide">
            历史数据（无样品方案）
          </div>
          {product.supplierName && (
            <div className="text-xs text-slate-500">
              <span className="text-slate-400">供应商：</span>{product.supplierName}
            </div>
          )}
          {product.purchasePrice != null && (
            <div className="text-xs text-slate-500">
              <span className="text-slate-400">采购价：</span>¥{Number(product.purchasePrice).toFixed(2)}
            </div>
          )}
          {!product.supplierName && product.purchasePrice == null && (
            <div className="text-xs text-slate-400">暂无可用信息</div>
          )}
        </div>
      )}

      {/* ── 异常信息面板（exception_reported 状态） ── */}
      {isExceptionState && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <AlertTriangle size={12} />异常描述
          </div>
          <div className="text-xs text-red-700 leading-relaxed">
            {(product as any).anomalyNote || '（无描述）'}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-red-400 pt-0.5">
            <span>上报：{(product as any).anomalyReportedBy || '—'}</span>
            {(product as any).anomalyReportedAt && (
              <span>{format(new Date((product as any).anomalyReportedAt), 'MM-dd HH:mm')}</span>
            )}
          </div>
        </div>
      )}

      {/* ── 异常处置结果（completed / terminated 且曾有异常） ── */}
      {hasAnomaly && (product.status === 'completed' || product.status === 'terminated') && (product as any).anomalyHandledBy && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <CheckCircle2 size={12} />异常处置结果
          </div>
          <div className="text-xs text-amber-700 font-medium">
            {(product as any).anomalyHandlingMethod === 'accept'    ? '✓ 已接受现货入库' :
             (product as any).anomalyHandlingMethod === 'reorder'   ? '↺ 已要求供应商补发' :
             (product as any).anomalyHandlingMethod === 'terminate' ? '✗ 采购已终止' : '已处置'}
          </div>
          {(product as any).anomalyHandlingNote && (
            <div className="text-xs text-amber-600 italic">{(product as any).anomalyHandlingNote}</div>
          )}
          <div className="text-[10px] text-amber-400">
            经理：{(product as any).anomalyHandledBy}
            {(product as any).anomalyHandledAt && (
              <span className="ml-2">{format(new Date((product as any).anomalyHandledAt), 'MM-dd HH:mm')}</span>
            )}
          </div>
        </div>
      )}

      {/* ── 正常推进按钮（专员，非异常状态，非已终止） ── */}
      {role === 'product_specialist' && !isExceptionState && !isTerminated && actionCfg && (
        !confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {actionCfg.label}
          </button>
        ) : (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <p className="text-xs text-slate-700 font-medium text-center">{actionCfg.confirm}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={loading}
                className="flex-1 py-1.5 rounded-lg text-sm text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-1.5 rounded-lg text-sm text-white font-semibold bg-primary hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? '处理中…' : '确认'}
              </button>
            </div>
          </div>
        )
      )}

      {/* ── 报告异常按钮（专员，goods_arrived / inspecting） ── */}
      {canReportException && !confirming && (
        !reportingException ? (
          <button
            onClick={() => setReportingException(true)}
            className="w-full py-2 rounded-xl bg-white text-red-600 text-sm font-semibold border border-red-300 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <AlertTriangle size={14} />报告异常
          </button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-red-700">描述发现的问题（必填）</p>
            <textarea
              value={exceptionDesc}
              onChange={e => setExceptionDesc(e.target.value)}
              placeholder="例如：到货数量不足、货物破损、规格不符…"
              className="w-full text-xs border border-red-200 rounded-lg px-3 py-2 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
              disabled={loading}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setReportingException(false); setExceptionDesc(''); }}
                disabled={loading}
                className="flex-1 py-1.5 rounded-lg text-sm text-slate-600 font-medium bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleReportException}
                disabled={loading || !exceptionDesc.trim()}
                className="flex-1 py-1.5 rounded-lg text-sm text-white font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {loading ? '提交中…' : '确认上报异常'}
              </button>
            </div>
          </div>
        )
      )}

      {/* ── 经理处置面板（exception_reported + 产品经理） ── */}
      {isExceptionState && role === 'product_manager' && (
        <div className="rounded-xl border border-red-200 bg-red-50/40 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-red-700">选择处置方案</p>
          <textarea
            value={managerNote}
            onChange={e => setManagerNote(e.target.value)}
            placeholder="处置说明（可选）"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none h-14 focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
            disabled={loading}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleManagerDecision('accept_exception')}
              disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-xs text-white font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : '接受现货'}
            </button>
            <button
              onClick={() => handleManagerDecision('reorder_exception')}
              disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-xs text-white font-semibold bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : '要求补发'}
            </button>
            <button
              onClick={() => handleManagerDecision('terminate_exception')}
              disabled={loading}
              className="flex-1 py-1.5 rounded-lg text-xs text-slate-600 font-semibold bg-slate-200 hover:bg-slate-300 disabled:opacity-50 transition-colors"
            >
              {loading ? '…' : '终止采购'}
            </button>
          </div>
        </div>
      )}

      {/* ── 专员等待经理处置（exception_reported + 产品专员） ── */}
      {isExceptionState && role === 'product_specialist' && (
        <div className="text-center text-xs text-red-500 font-medium py-1.5 bg-red-50 rounded-xl border border-red-100">
          异常已上报，等待经理处置
        </div>
      )}

      {/* ── 专员视图：已入库完成 ── */}
      {role === 'product_specialist' && !actionCfg && product.status === 'completed' && (
        <div className="text-center text-xs text-emerald-600 font-medium py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
          已入库完成
        </div>
      )}

      {/* ── 经理视图：正常状态仅查看 ── */}
      {role === 'product_manager' && !isExceptionState && (
        <div className="text-center text-xs text-slate-400 py-1">
          仅查看，无法操作
        </div>
      )}
    </div>
  );
}

export default function PurchasePool() {
  const { products, sampleOptions, sampleSkuLines, sampleAction, role } = useAppStore();

  const purchaseProducts = products
    .filter(p => (PURCHASE_STATUSES as readonly string[]).includes(p.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleAction = (productId: string, action: string, data?: Record<string, unknown>) =>
    sampleAction(productId, action, data);

  const countMap: Record<string, number> = {
    pending: purchaseProducts.filter(p => p.status === 'pending_purchase').length,
    active:  purchaseProducts.filter(p =>
      ['ordered', 'goods_arrived', 'inspecting', 'goods_inspected', 'exception_reported'].includes(p.status)
    ).length,
    done: purchaseProducts.filter(p =>
      ['completed', 'terminated'].includes(p.status)
    ).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">采购池</h1>
          <p className="text-sm text-slate-500 mt-0.5">管理经批准产品的采购执行进度</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
          role === 'product_manager'
            ? 'bg-violet-50 text-violet-600 border-violet-200'
            : 'bg-blue-50 text-blue-600 border-blue-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            role === 'product_manager' ? 'bg-violet-400' : 'bg-blue-400'
          }`} />
          {role === 'product_manager' ? '产品经理视图' : '产品专员视图'}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        {[
          { label: '待执行', count: countMap.pending, color: 'text-orange-600 bg-orange-50 border-orange-200' },
          { label: '执行中', count: countMap.active,  color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: '已完成', count: countMap.done,    color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${s.color}`}>
            <span className="text-xl font-bold">{s.count}</span>
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5 items-start">
        {GROUPS.map(group => {
          const allGroupProducts = purchaseProducts.filter(p => group.statuses.includes(p.status));
          const isCompletedGroup = group.id === 'done';
          const completedOnly = isCompletedGroup
            ? allGroupProducts.filter(p => p.status === 'completed')
            : [];
          const hasMore = isCompletedGroup && completedOnly.length > COMPLETED_DISPLAY_LIMIT;
          const groupProducts = isCompletedGroup
            ? [
                ...(hasMore ? completedOnly.slice(0, COMPLETED_DISPLAY_LIMIT) : completedOnly),
                ...allGroupProducts.filter(p => p.status === 'terminated'),
              ]
            : allGroupProducts;

          return (
            <div key={group.id} className={`rounded-2xl border ${group.border} p-4`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                <h2 className={`font-semibold text-sm ${group.headerColor}`}>{group.label}</h2>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${group.badgeBg}`}>
                  {countMap[group.id]}
                </span>
              </div>
              <div className="space-y-3">
                {groupProducts.length === 0 ? (
                  <p className="text-xs text-center text-slate-400 py-8">{group.emptyText}</p>
                ) : (
                  groupProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      role={role}
                      sampleOptions={sampleOptions}
                      sampleSkuLines={sampleSkuLines}
                      onAction={handleAction}
                    />
                  ))
                )}
                {hasMore && (
                  <div className="text-center text-xs text-slate-400 pt-2 border-t border-emerald-100 mt-1">
                    仅显示最近 {COMPLETED_DISPLAY_LIMIT} 条，共 {completedOnly.length} 条已入库
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
