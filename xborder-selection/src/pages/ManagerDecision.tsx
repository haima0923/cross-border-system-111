import { useState } from 'react';
import { useAppStore, type SampleOption, type SampleSkuLine } from '@/context/StoreContext';
import { format } from 'date-fns';
import {
  ClipboardCheck, ArrowLeft, CheckCircle2, XCircle, Star,
  Layers, ChevronRight, AlertTriangle, Package
} from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';

interface ReviewItem { id: string; name: string; rating: number }

function parseSummary(raw: string | null | undefined): ReviewItem[] {
  try { return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}

function evalLabel(val: string | null | undefined): { text: string; color: string } | null {
  if (!val) return null;
  const map: Record<string, { text: string; color: string }> = {
    good: { text: '优', color: 'text-green-600 bg-green-50' },
    ok: { text: '良', color: 'text-blue-600 bg-blue-50' },
    bad: { text: '差', color: 'text-red-600 bg-red-50' },
  };
  return map[val] ?? { text: val, color: 'text-slate-600 bg-slate-100' };
}

function RatingBar({ rating, max = 5 }: { rating: number; max?: number }) {
  const pct = Math.min(100, (rating / max) * 100);
  const color = pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{rating}/{max}</span>
    </div>
  );
}

function SkuTable({
  skus,
  isSelectedOption,
  selectedSkuIds,
  onToggleSku,
  skuQuantities,
  onSetSkuQty,
}: {
  skus: SampleSkuLine[];
  isSelectedOption: boolean;
  selectedSkuIds: Set<string>;
  onToggleSku: (id: string) => void;
  skuQuantities: Record<string, number>;
  onSetSkuQty: (id: string, qty: number) => void;
}) {
  if (skus.length === 0) {
    return <p className="text-xs text-slate-400 italic mt-2">无 SKU 记录</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-slate-500">
            {isSelectedOption && <th className="px-3 py-2 w-8" />}
            <th className="px-2 py-2 w-10 text-center font-medium">图</th>
            <th className="px-3 py-2 text-left font-medium">SKU 名称</th>
            <th className="px-3 py-2 text-right font-medium">单价</th>
            <th className="px-3 py-2 text-right font-medium">MOQ</th>
            <th className="px-3 py-2 text-right font-medium">重量(g)</th>
            {isSelectedOption && <th className="px-3 py-2 text-right font-medium">采购数量</th>}
            <th className="px-3 py-2 text-left font-medium">备注</th>
          </tr>
        </thead>
        <tbody>
          {skus.map((sku, idx) => {
            const checked = selectedSkuIds.has(sku.id);
            return (
              <tr
                key={sku.id}
                className={`border-t border-slate-100 ${isSelectedOption && checked ? 'bg-primary/5' : ''}`}
                onClick={() => isSelectedOption && onToggleSku(sku.id)}
                style={{ cursor: isSelectedOption ? 'pointer' : 'default' }}
              >
                {isSelectedOption && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSku(sku.id)}
                      onClick={e => e.stopPropagation()}
                      className="accent-primary w-3.5 h-3.5"
                    />
                  </td>
                )}
                <td className="px-2 py-2">
                  <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                </td>
                <td className="px-3 py-2 font-medium text-slate-800">
                  {sku.skuName || `SKU ${idx + 1}`}
                  {sku.recommended && (
                    <span className="ml-1.5 text-amber-500 text-[10px] font-medium bg-amber-50 px-1.5 py-0.5 rounded-full">
                      推荐
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '-'}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {sku.moq != null ? sku.moq : '-'}
                </td>
                <td className="px-3 py-2 text-right text-slate-700">
                  {sku.weight != null ? sku.weight : '-'}
                </td>
                {isSelectedOption && (
                  <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                    {checked ? (
                      <input
                        type="number"
                        min={1}
                        value={skuQuantities[sku.id] ?? ''}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v > 0) onSetSkuQty(sku.id, v);
                          else if (e.target.value === '') onSetSkuQty(sku.id, 0);
                        }}
                        placeholder="必填"
                        className="w-20 text-right border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary bg-white"
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                )}
                <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">
                  {sku.notes || '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OptionCard({
  option,
  skus,
  isSelected,
  onSelect,
  selectedSkuIds,
  onToggleSku,
  skuQuantities,
  onSetSkuQty,
}: {
  option: SampleOption;
  skus: SampleSkuLine[];
  isSelected: boolean;
  onSelect: () => void;
  selectedSkuIds: Set<string>;
  onToggleSku: (id: string) => void;
  skuQuantities: Record<string, number>;
  onSetSkuQty: (id: string, qty: number) => void;
}) {
  const summary = parseSummary(option.sampleReviewSummary);
  const materialEval = evalLabel(option.sampleMaterialEval);
  const workEval = evalLabel(option.sampleWorkmanshipEval);
  const funcEval = evalLabel(option.sampleFunctionEval);

  return (
    <div
      className={`rounded-2xl border-2 transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div
        className="flex items-start gap-3 p-5 cursor-pointer"
        onClick={onSelect}
      >
        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          isSelected ? 'border-primary' : 'border-slate-300'
        }`}>
          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 text-sm">
              {option.optionLabel || '未命名方案'}
            </h3>
            <span className="text-xs text-slate-500 flex-shrink-0">
              <Layers size={11} className="inline mr-1" />
              {skus.length} 款 SKU
            </span>
          </div>

          {option.supplierName && (
            <p className="text-xs text-slate-500 mb-3">供应商：{option.supplierName}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              option.sampleConsistentWithImage
                ? 'bg-green-50 text-green-700'
                : option.sampleConsistentWithImage === false
                  ? 'bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-500'
            }`}>
              {option.sampleConsistentWithImage === true
                ? '✓ 与图片一致'
                : option.sampleConsistentWithImage === false
                  ? '✗ 与图片不符'
                  : '一致性未评'}
            </span>
            {materialEval && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${materialEval.color}`}>
                材质：{materialEval.text}
              </span>
            )}
            {workEval && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${workEval.color}`}>
                工艺：{workEval.text}
              </span>
            )}
            {funcEval && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${funcEval.color}`}>
                功能：{funcEval.text}
              </span>
            )}
          </div>

          {summary.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {summary.map(item => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-24 flex-shrink-0 truncate">{item.name}</span>
                  <div className="flex-1">
                    <RatingBar rating={item.rating} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {option.sampleRemarks && (
            <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2 mt-2">
              备注：{option.sampleRemarks}
            </p>
          )}
        </div>
      </div>

      <div className={`px-5 pb-5 ${!isSelected ? 'opacity-60' : ''}`}>
        {isSelected && selectedSkuIds.size === 0 && skus.length > 0 && (
          <div className="flex items-center gap-2 text-amber-600 text-xs mb-2 bg-amber-50 px-3 py-1.5 rounded-lg">
            <AlertTriangle size={12} />
            请至少勾选一款 SKU 才能提交批准
          </div>
        )}
        <SkuTable
          skus={skus}
          isSelectedOption={isSelected}
          selectedSkuIds={selectedSkuIds}
          onToggleSku={onToggleSku}
          skuQuantities={skuQuantities}
          onSetSkuQty={onSetSkuQty}
        />
      </div>
    </div>
  );
}

function DecisionDetail({
  productId,
  onBack,
}: {
  productId: string;
  onBack: () => void;
}) {
  const { products, sampleOptions, sampleSkuLines, managerDecision } = useAppStore();

  const product = products.find(p => p.id === productId);
  const options = sampleOptions.filter(o => o.productId === productId);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedSkuIds, setSelectedSkuIds] = useState<Set<string>>(new Set());
  const [skuQuantities, setSkuQuantities] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p>产品不存在</p>
        <button onClick={onBack} className="mt-4 text-sm text-primary underline">返回</button>
      </div>
    );
  }

  function handleSelectOption(optionId: string) {
    setSelectedOptionId(optionId);
    const skus = sampleSkuLines.filter(s => s.sampleOptionId === optionId);
    const hasRecommended = skus.some(s => s.recommended);
    const defaultSkus = hasRecommended
      ? skus.filter(s => s.recommended)
      : skus;
    setSelectedSkuIds(new Set(defaultSkus.map(s => s.id)));
    const initQty: Record<string, number> = {};
    defaultSkus.forEach(s => {
      if (s.moq && s.moq > 0) initQty[s.id] = s.moq;
    });
    setSkuQuantities(initQty);
  }

  function handleToggleSku(skuId: string) {
    setSelectedSkuIds(prev => {
      const next = new Set(prev);
      if (next.has(skuId)) {
        next.delete(skuId);
        setSkuQuantities(q => { const n = { ...q }; delete n[skuId]; return n; });
      } else {
        next.add(skuId);
      }
      return next;
    });
  }

  function handleSetSkuQty(skuId: string, qty: number) {
    setSkuQuantities(prev => ({ ...prev, [skuId]: qty }));
  }

  async function handleApprove() {
    if (!selectedOptionId || selectedSkuIds.size === 0) return;
    const allHaveQty = Array.from(selectedSkuIds).every(id => (skuQuantities[id] ?? 0) > 0);
    if (!allHaveQty) {
      alert('请为每款已选 SKU 填写采购数量（必须大于 0）');
      return;
    }
    setSubmitting(true);
    try {
      await managerDecision(product!.id, {
        action: 'approve',
        selectedOptionId,
        selectedSkuIds: Array.from(selectedSkuIds),
        skuQuantities,
        comment: comment.trim() || undefined,
      });
      onBack();
    } catch {
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await managerDecision(product!.id, {
        action: 'reject',
        comment: rejectComment.trim() || undefined,
      });
      onBack();
    } catch {
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  const allSelectedHaveQty = selectedSkuIds.size > 0 &&
    Array.from(selectedSkuIds).every(id => (skuQuantities[id] ?? 0) > 0);
  const canApprove = !!selectedOptionId && allSelectedHaveQty && !submitting;

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回决策列表
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5 mb-6 flex items-start gap-5">
        <ProductImage
          hostedImageUrl={product.hostedImageUrl}
          imageUrl={product.imageUrl}
          size="xl"
          alt={product.productName}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-1">待决策产品</p>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{product.productName}</h2>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {product.submitterName && <span>提报人：{product.submitterName}</span>}
            {product.sampleReviewedAt && (
              <span>验样完成：{format(new Date(product.sampleReviewedAt), 'MM-dd HH:mm')}</span>
            )}
            <span className="text-slate-400">共 {options.length} 个验样方案</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-700 mb-1">
          选择方案
          <span className="ml-2 text-xs font-normal text-slate-400">点击方案选中，再勾选进入采购的 SKU</span>
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {options.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-700">
            该产品暂无验样方案记录
          </div>
        ) : (
          options.map(opt => (
            <OptionCard
              key={opt.id}
              option={opt}
              skus={sampleSkuLines.filter(s => s.sampleOptionId === opt.id)}
              isSelected={selectedOptionId === opt.id}
              onSelect={() => handleSelectOption(opt.id)}
              selectedSkuIds={selectedOptionId === opt.id ? selectedSkuIds : new Set()}
              onToggleSku={handleToggleSku}
              skuQuantities={selectedOptionId === opt.id ? skuQuantities : {}}
              onSetSkuQty={handleSetSkuQty}
            />
          ))
        )}
      </div>

      {comment !== undefined && selectedOptionId && (
        <div className="mb-6">
          <label className="text-xs font-medium text-slate-600 block mb-1.5">决策备注（可选）</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder="说明选择理由或注意事项…"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-4 py-4 border-t border-slate-200">
        {!showReject ? (
          <>
            <button
              onClick={() => setShowReject(true)}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <XCircle size={16} />
              放弃采购
            </button>
            <button
              onClick={handleApprove}
              disabled={!canApprove}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-primary/20"
            >
              <CheckCircle2 size={16} />
              {submitting ? '提交中…' : '批准所选方案'}
            </button>
          </>
        ) : (
          <div className="w-full space-y-3">
            <p className="text-sm font-medium text-red-700">确认放弃该产品的采购？</p>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              rows={2}
              placeholder="请填写放弃原因（可选）"
              className="w-full text-sm border border-red-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowReject(false)}
                disabled={submitting}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <XCircle size={14} />
                {submitting ? '提交中…' : '确认放弃'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DecisionList({ onSelect }: { onSelect: (id: string) => void }) {
  const { products, sampleOptions } = useAppStore();
  const pending = products.filter(p => p.status === 'sample_reviewed');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <ClipboardCheck size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">样品决策</h1>
        </div>
        <p className="text-slate-500 text-sm ml-14">
          待决策产品
          <span className="ml-2 font-semibold text-slate-700">{pending.length}</span> 个
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
            <Package size={32} />
          </div>
          <p className="text-slate-500 text-sm">当前无待决策产品</p>
          <p className="text-slate-400 text-xs mt-1">专员完成验样后，产品将在此处等待批准</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(product => {
            const opts = sampleOptions.filter(o => o.productId === product.id);
            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-6 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => onSelect(product.id)}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Star size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">{product.productName}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {product.submitterName && <span>提报：{product.submitterName}</span>}
                    <span className="flex items-center gap-1">
                      <Layers size={11} />
                      {opts.length} 个方案
                    </span>
                    {product.sampleReviewedAt && (
                      <span>验样完成：{format(new Date(product.sampleReviewedAt), 'MM-dd HH:mm')}</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium group-hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
                  开始决策
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ManagerDecision() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (selectedProductId) {
    return (
      <DecisionDetail
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
      />
    );
  }

  return <DecisionList onSelect={setSelectedProductId} />;
}
