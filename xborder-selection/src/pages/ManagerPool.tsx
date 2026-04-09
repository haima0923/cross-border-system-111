import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/context/StoreContext';
import { useLocation } from 'wouter';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import {
  CheckCircle2, XCircle, Undo2,
  TrendingUp, ChevronRight, ClipboardList, RefreshCw,
} from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { getDecisionSummary, verdictStyles } from '@/lib/decisionUtils';

export default function ManagerPool() {
  const { products, updateProduct, currentUser, role } = useAppStore();
  const [, setLocation] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [managerComment, setManagerComment] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<'all' | 'recommend' | 'caution' | 'reject'>('all');

  useEffect(() => {
    if (role !== 'product_manager') setLocation('/workbench');
  }, [role, setLocation]);

  if (role !== 'product_manager') return null;

  const byUpdatedDesc = (a: { updatedAt: string }, b: { updatedAt: string }) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

  // Section 1: initial screening review — sorted by updatedAt desc
  const poolProducts = products.filter(p =>
    p.status === 'screening_submitted' ||
    p.status === 'manager_reviewing'
  ).sort(byUpdatedDesc);

  // Section 2: sample review decisions (already verified by employee) — sorted by updatedAt desc
  const sampleProducts = products.filter(p => p.status === 'sample_reviewed')
    .sort(byUpdatedDesc);

  // Section 3: purchase execution tracking — sorted by updatedAt desc
  const purchaseTrackProducts = products.filter(p =>
    [
      'pending_purchase', 'ordered',
      'goods_arrived', 'inspecting', 'inspecting_anomaly_entry', 'inspection_anomaly', 'anomaly_handling', 'anomaly_resolved',
      'goods_inspected', 'completed',
    ].includes(p.status)
  ).sort(byUpdatedDesc);

  const filteredProducts = filterVerdict === 'all'
    ? poolProducts
    : poolProducts.filter(p => getDecisionSummary(p).verdict === filterVerdict);

  const handleAction = () => {
    if (!selectedProduct || !actionType) return;

    const statusMap = {
      approve: 'pending_sampling',
      reject: 'rejected',
      return: 'returned',
    };
    const actionText = {
      approve: '管理层通过初筛，进入采样',
      reject: '管理层拒绝（待员工确认）',
      return: '管理层退回',
    };

    updateProduct(selectedProduct, {
      status: statusMap[actionType] as any,
      managerComment,
      managerReviewedBy: currentUser.name,
      managerReviewedAt: new Date().toISOString()
    }, actionText[actionType], managerComment);

    setSelectedProduct(null);
    setManagerComment('');
    setActionType(null);
  };

  const verdictCounts = {
    recommend: poolProducts.filter(p => getDecisionSummary(p).verdict === 'recommend').length,
    caution:   poolProducts.filter(p => getDecisionSummary(p).verdict === 'caution').length,
    reject:    poolProducts.filter(p => getDecisionSummary(p).verdict === 'reject').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">管理层审核池</h1>
          <p className="text-slate-500 mt-1">审核员工提交的选品报告并决定是否进行采样测试</p>
        </div>
      </div>

      {/* ─── Section 1: Initial screening ─── */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">初筛待审核</h2>

        {/* Quick filter bar */}
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">快速筛选：</span>
          {([
            { key: 'all',       label: `全部 (${poolProducts.length})`,            cls: 'bg-slate-800 text-white border-slate-800' },
            { key: 'recommend', label: `✓ 建议测试 (${verdictCounts.recommend})`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { key: 'caution',   label: `⚠ 谨慎考虑 (${verdictCounts.caution})`,   cls: 'bg-amber-50 text-amber-700 border-amber-200'   },
            { key: 'reject',    label: `✕ 暂不建议 (${verdictCounts.reject})`,     cls: 'bg-red-50 text-red-700 border-red-200'         },
          ] as const).map(({ key, label, cls }) => (
            <button
              key={key}
              onClick={() => setFilterVerdict(key)}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                filterVerdict === key ? cls : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 px-6 py-12 text-center text-slate-400">
              目前没有符合条件的产品
            </div>
          ) : filteredProducts.map(product => {
            const decision = getDecisionSummary(product);
            const vstyle = verdictStyles[decision.verdict];
            const margin = (product.grossMargin ?? 0) * 100;
            const score = product.aiCompetitiveness ?? 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
              >
                <div className="flex items-stretch">
                  {/* Thumbnail */}
                  <div
                    className="w-28 shrink-0 border-r border-slate-100 cursor-pointer"
                    onClick={() => setLocation(`/analysis/${product.id}`)}
                  >
                    <ProductImage
                      hostedImageUrl={product.hostedImageUrl}
                      imageUrl={product.imageUrl}
                      alt={product.productName}
                      className="w-full h-full bg-slate-100 flex items-center justify-center"
                      size="lg"
                    />
                  </div>

                  {/* Main content */}
                  <div className="flex-1 px-5 py-4 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <button
                            onClick={() => setLocation(`/analysis/${product.id}`)}
                            className="font-bold text-slate-900 hover:text-primary transition-colors text-base leading-tight"
                          >
                            {product.productName}
                          </button>
                          <StatusBadge status={product.status} />
                          {((product as any).supplierChangeCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              <RefreshCw size={9} />已换供应商（第{(product as any).supplierChangeCount}次）
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mb-2.5 flex items-center gap-2 flex-wrap">
                          <span>{product.supplierName}</span>
                          <span>·</span>
                          <span>{product.productSource}</span>
                          <span>·</span>
                          <span>提交：{product.submitterName}</span>
                          {product.screeningSubmittedAt && (
                            <>
                              <span>·</span>
                              <span>{format(new Date(product.screeningSubmittedAt), 'MM-dd HH:mm')}</span>
                            </>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 max-w-full">
                          <TrendingUp size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{decision.sellingPoint}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* Key metrics */}
                        <div className="hidden md:flex items-center gap-5 text-center">
                          <div>
                            <div className="text-xs text-slate-400 mb-0.5">采购价</div>
                            <div className="font-bold text-slate-800 text-sm">¥{product.purchasePrice?.toFixed(0)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-0.5">毛利率</div>
                            <div className={`font-bold text-sm ${margin > 30 ? 'text-emerald-600' : margin > 15 ? 'text-amber-600' : 'text-red-500'}`}>
                              {margin > 0 ? `${margin.toFixed(1)}%` : '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-0.5">竞争力</div>
                            <div className="font-bold text-indigo-700 text-sm">
                              {score > 0 ? <>{score}<span className="text-indigo-300 font-normal">/10</span></> : '—'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-400 mb-0.5">风险</div>
                            <div className={`font-bold text-sm ${
                              product.aiRiskLevel === '低' ? 'text-emerald-600' :
                              product.aiRiskLevel === '中' ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {product.aiRiskLevel ?? '—'}
                            </div>
                          </div>
                        </div>

                        <div className="w-px h-10 bg-slate-100 hidden md:block" />

                        {/* AI conclusion badge */}
                        <div className={`rounded-lg px-3 py-2 border text-center min-w-[88px] ${vstyle.bg} border-${decision.verdict === 'recommend' ? 'emerald' : decision.verdict === 'caution' ? 'amber' : 'red'}-200`}>
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${vstyle.dot}`} />
                            <span className="text-xs text-slate-400 font-medium">AI结论</span>
                          </div>
                          <div className={`text-xs font-bold leading-tight ${vstyle.text}`}>
                            {decision.conclusionLabel}
                          </div>
                        </div>

                        <div className="w-px h-10 bg-slate-100" />

                        {/* Action buttons */}
                        <div className="flex flex-col gap-1.5 items-end">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { setSelectedProduct(product.id); setActionType('approve'); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                              title="通过初筛"
                            >
                              <CheckCircle2 size={13} /> 通过
                            </button>
                            <button
                              onClick={() => { setSelectedProduct(product.id); setActionType('return'); }}
                              className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                              title="退回"
                            >
                              <Undo2 size={15} />
                            </button>
                            <button
                              onClick={() => { setSelectedProduct(product.id); setActionType('reject'); }}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                              title="拒绝"
                            >
                              <XCircle size={15} />
                            </button>
                          </div>
                          <button
                            onClick={() => setLocation(`/analysis/${product.id}`)}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                          >
                            查看详情 <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Section 2: Sample review decisions ─── */}
      {sampleProducts.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ClipboardList size={18} className="text-violet-600" />
            待验样审批
            <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{sampleProducts.length}</span>
          </h2>
          <div className="space-y-3">
            {sampleProducts.map(product => (
              <div
                key={product.id}
                onClick={() => setLocation(`/sampling/${product.id}`)}
                className="bg-white rounded-2xl border border-violet-200 shadow-sm hover:shadow-md hover:border-violet-400 transition-all cursor-pointer overflow-hidden"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <ProductImage
                    hostedImageUrl={product.hostedImageUrl}
                    imageUrl={product.imageUrl}
                    size="lg"
                    alt={product.productName}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 truncate">{product.productName}</span>
                      <StatusBadge status={product.status} />
                    </div>
                    <div className="text-xs text-slate-400 flex gap-2 flex-wrap">
                      <span>{product.supplierName}</span>
                      <span>·</span>
                      <span>验样人：{product.sampleReviewedBy || '—'}</span>
                      {product.sampleReviewedAt && (
                        <>
                          <span>·</span>
                          <span>{format(new Date(product.sampleReviewedAt), 'MM-dd HH:mm')}</span>
                        </>
                      )}
                    </div>
                    {product.sampleMaterialEval && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        材质：{product.sampleMaterialEval}
                        {(product as any).sampleWorkmanshipEval && `  做工：${(product as any).sampleWorkmanshipEval}`}
                        {(product as any).sampleFunctionEval && `  功能：${(product as any).sampleFunctionEval}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-violet-600 font-medium flex items-center gap-1">
                      查看验样结果 <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Section 3: Purchase execution tracking ─── */}
      {purchaseTrackProducts.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <ClipboardList size={18} className="text-emerald-600" />
            采购执行追踪
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {purchaseTrackProducts.length}
            </span>
          </h2>
          <div className="space-y-2">
            {purchaseTrackProducts.map(product => (
              <div
                key={product.id}
                onClick={() => setLocation(`/sampling/${product.id}`)}
                className="bg-white rounded-xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <ProductImage
                    hostedImageUrl={product.hostedImageUrl}
                    imageUrl={product.imageUrl}
                    size="md"
                    alt={product.productName}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-800 text-sm truncate">{product.productName}</span>
                      <StatusBadge status={product.status} />
                    </div>
                    <div className="text-xs text-slate-400 flex gap-2 flex-wrap">
                      <span>{product.supplierName}</span>
                      {(product as any).purchaseQuantity && (
                        <span className="text-emerald-700 font-medium">· {(product as any).purchaseQuantity} 件</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action dialog (initial screening) */}
      <Dialog open={!!selectedProduct} onOpenChange={() => { setSelectedProduct(null); setActionType(null); setManagerComment(''); }}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {actionType === 'approve' ? '通过初筛，进入采样'
               : actionType === 'reject' ? '拒绝该选品'
               : '退回补充'}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {actionType === 'approve'
                ? '通过后将通知员工联系供应商获取样品，样品验收合格后方可进入采购流程。'
                : '请填写审批意见（将记录在操作日志中）。'}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                审批意见
                {actionType === 'approve' && <span className="text-slate-400 font-normal ml-1">（选填）</span>}
                {actionType === 'reject' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <textarea
                value={managerComment}
                onChange={(e) => setManagerComment(e.target.value)}
                placeholder={actionType === 'approve' ? '如需备注请填写…' : '请输入审批意见…'}
                className="w-full h-24 px-4 py-3 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => { setSelectedProduct(null); setActionType(null); setManagerComment(''); }}
              className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleAction}
              disabled={actionType === 'reject' && !managerComment.trim()}
              className={`px-6 py-2 rounded-xl text-white font-semibold shadow-sm transition-all disabled:opacity-50 ${
                actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' :
                actionType === 'reject'  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' :
                'bg-slate-600 hover:bg-slate-700'
              }`}
            >
              确认提交
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
