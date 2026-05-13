import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAppStore, type SampleOption, type SampleSkuLine } from '@/context/StoreContext';
import {
  ClipboardCheck, ArrowLeft, CheckCircle2, XCircle, Star,
  Layers, AlertTriangle, Package, Eye, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';

const EVAL_MAP: Record<string, { text: string; color: string }> = {
  '1': { text: '差', color: 'text-red-600 bg-red-50' },
  '2': { text: '一般', color: 'text-orange-600 bg-orange-50' },
  '3': { text: '合格', color: 'text-yellow-600 bg-yellow-50' },
  '4': { text: '良好', color: 'text-blue-600 bg-blue-50' },
  '5': { text: '优秀', color: 'text-green-600 bg-green-50' },
};

// Color stripes for comparison cards
const CARD_COLORS = [
  { stripe: 'bg-blue-500', ring: 'ring-blue-300' },
  { stripe: 'bg-emerald-500', ring: 'ring-emerald-300' },
  { stripe: 'bg-orange-500', ring: 'ring-orange-300' },
  { stripe: 'bg-purple-500', ring: 'ring-purple-300' },
  { stripe: 'bg-pink-500', ring: 'ring-pink-300' },
  { stripe: 'bg-cyan-500', ring: 'ring-cyan-300' },
];

function evalLabel(val: string | null | undefined): { text: string; color: string } | null {
  if (!val) return null;
  return EVAL_MAP[val] ?? { text: val, color: 'text-slate-600 bg-slate-100' };
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

// ─── Comparison card for a single option ─────────────────────────────────────
function OptionComparisonCard({
  option,
  skus,
  isSelected,
  onSelect,
  colorIndex,
  selectedSkuIds,
  onToggleSku,
  skuQuantities,
  onSetSkuQty,
}: {
  option: SampleOption;
  skus: SampleSkuLine[];
  isSelected: boolean;
  onSelect: () => void;
  colorIndex: number;
  selectedSkuIds: Set<string>;
  onToggleSku: (id: string) => void;
  skuQuantities: Record<string, number>;
  onSetSkuQty: (id: string, qty: number) => void;
}) {
  const color = CARD_COLORS[colorIndex % CARD_COLORS.length];
  const materialEval = evalLabel(option.sampleMaterialEval);
  const workEval = evalLabel(option.sampleWorkmanshipEval);
  const funcEval = evalLabel(option.sampleFunctionEval);

  // Compute average score
  const scores = [option.sampleMaterialEval, option.sampleWorkmanshipEval, option.sampleFunctionEval]
    .filter(v => v)
    .map(v => Number(v));
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return (
    <div
      className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
        isSelected
          ? `border-primary bg-primary/5 shadow-md shadow-primary/10 ring-2 ${color.ring}`
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className={`h-1.5 ${color.stripe}`} />

      <div className="p-5">
        {/* Select radio */}
        <div
          className="flex items-start gap-3 cursor-pointer mb-4"
          onClick={onSelect}
        >
          <div className={`mt-0.5 w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            isSelected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
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
              <p className="text-xs text-slate-500 mb-2">供应商：{option.supplierName}</p>
            )}
          </div>
        </div>

        {/* Evaluation summary */}
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

        {/* Average score bar */}
        {avgScore > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">综合评分</span>
              <span className="text-xs font-semibold text-slate-700">{avgScore.toFixed(1)}/5</span>
            </div>
            <RatingBar rating={avgScore} />
          </div>
        )}

        {option.sampleRemarks && (
          <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2 mb-3">
            备注：{option.sampleRemarks}
          </p>
        )}

        {/* SKU table - show purchase qty input only for selected option */}
        <div className={isSelected ? '' : 'opacity-60'}>
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
    </div>
  );
}

// ─── Decision detail page ────────────────────────────────────────────────────
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

  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
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

  function handleToggleOption(optionId: string) {
    setSelectedOptionIds(prev => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        // 取消选中：清除该方案的所有SKU选中状态
        next.delete(optionId);
        setSelectedSkuIds(prevSkus => {
          const optionSkus = sampleSkuLines.filter(s => s.sampleOptionId === optionId).map(s => s.id);
          const newSkus = new Set(prevSkus);
          optionSkus.forEach(sid => newSkus.delete(sid));
          return newSkus;
        });
        // 清除该方案的采购数量
        setSkuQuantities(q => {
          const optionSkus = sampleSkuLines.filter(s => s.sampleOptionId === optionId).map(s => s.id);
          const n = { ...q };
          optionSkus.forEach(sid => delete n[sid]);
          return n;
        });
      } else {
        // 选中：默认勾选该方案下推荐/全部SKU
        next.add(optionId);
        const skus = sampleSkuLines.filter(s => s.sampleOptionId === optionId);
        const hasRecommended = skus.some(s => s.recommended);
        const defaultSkus = hasRecommended
          ? skus.filter(s => s.recommended)
          : skus;
        setSelectedSkuIds(prevSkus => {
          const newSkus = new Set(prevSkus);
          defaultSkus.forEach(s => newSkus.add(s.id));
          return newSkus;
        });
        setSkuQuantities(prevQty => {
          const n = { ...prevQty };
          defaultSkus.forEach(s => {
            if (s.moq && s.moq > 0 && !(s.id in n)) n[s.id] = s.moq;
          });
          return n;
        });
      }
      return next;
    });
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
    if (selectedOptionIds.size === 0 || selectedSkuIds.size === 0) return;
    const allHaveQty = Array.from(selectedSkuIds).every(id => (skuQuantities[id] ?? 0) > 0);
    if (!allHaveQty) {
      alert('请为每款已选 SKU 填写采购数量（必须大于 0）');
      return;
    }
    setSubmitting(true);
    try {
      await managerDecision(product!.id, {
        action: 'approve',
        selectedOptionIds: Array.from(selectedOptionIds),
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
  // 至少选1个方案，且每个选中方案至少有1个SKU被勾选，且所有勾选SKU都有数量
  const selectedOptionList = sampleOptions.filter(o => selectedOptionIds.has(o.id));
  const eachOptionHasSku = selectedOptionList.every(opt =>
    sampleSkuLines.filter(s => s.sampleOptionId === opt.id).some(s => selectedSkuIds.has(s.id))
  );
  const canApprove = selectedOptionIds.size > 0 && eachOptionHasSku && allSelectedHaveQty && !submitting;

  return (
    <div className="max-w-6xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回决策列表
      </button>

      {/* Product header */}
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
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>供应商：{product.supplierName || '—'}</span>
            <span>采购价：¥{product.purchasePrice?.toFixed(2) ?? '—'}</span>
          </div>
          {product.link1688 && (
            <a
              href={product.link1688}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary/80 font-medium"
            >
              采购链接
            </a>
          )}
        </div>
      </div>

      {/* Comparison view - side by side cards */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Eye size={16} className="text-primary" />
          方案对比（{options.length} 个方案）
          <span className="text-xs text-slate-400 font-normal ml-2">勾选要通过的方案（可多选）</span>
        </h3>

        <div className="grid gap-4" style={{
          gridTemplateColumns: options.length <= 3
            ? `repeat(${options.length}, 1fr)`
            : 'repeat(3, 1fr)',
        }}>
          {options.map((opt, idx) => {
            const optSkus = sampleSkuLines.filter(s => s.sampleOptionId === opt.id);
            return (
              <OptionComparisonCard
                key={opt.id}
                option={opt}
                skus={optSkus}
                isSelected={selectedOptionIds.has(opt.id)}
                onSelect={() => handleToggleOption(opt.id)}
                colorIndex={idx}
                selectedSkuIds={selectedSkuIds}
                onToggleSku={handleToggleSku}
                skuQuantities={skuQuantities}
                onSetSkuQty={handleSetSkuQty}
              />
            );
          })}
        </div>
      </div>

      {/* Decision bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              审批备注
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              placeholder="可选填写审批意见..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2 pt-6">
            <button
              onClick={handleApprove}
              disabled={!canApprove}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
            >
              <ThumbsUp size={16} />
              {submitting ? '提交中...' : '批准采购'}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={submitting}
              className="flex items-center gap-2 border border-red-200 text-red-600 px-5 py-2.5 rounded-xl hover:bg-red-50 disabled:opacity-40 text-sm font-medium"
            >
              <ThumbsDown size={16} />
              拒绝
            </button>
          </div>
        </div>
      </div>

      {/* Reject confirmation modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-slate-900 mb-2">确认拒绝</h3>
            <p className="text-sm text-slate-600 mb-4">拒绝后产品将退回待确认状态，员工需确认知晓。</p>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              rows={2}
              placeholder="请填写拒绝原因..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReject(false)}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="text-sm bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 disabled:opacity-40 font-medium"
              >
                {submitting ? '提交中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page: list of pending decisions ─────────────────────────────────────
export default function ManagerDecision() {
  const [, setLocation] = useLocation();
  const { products, sampleOptions, sampleSkuLines } = useAppStore();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Products awaiting manager decision
  const decisionProducts = products.filter(p =>
    p.status === 'sampling_review_submitted'
  );

  if (selectedProductId) {
    return (
      <DecisionDetail
        productId={selectedProductId}
        onBack={() => setSelectedProductId(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <ClipboardCheck size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">经理决策</h1>
        </div>
        <p className="text-slate-500 text-sm ml-14">
          待审批验样结果
          <span className="ml-2 font-semibold text-slate-700">{decisionProducts.length}</span> 个
        </p>
      </div>

      {decisionProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
            <ClipboardCheck size={32} />
          </div>
          <p className="text-slate-500 text-sm">当前无待审批验样</p>
          <p className="text-slate-400 text-xs mt-1">员工提交验样结果后将在此处显示</p>
        </div>
      ) : (
        <div className="space-y-3">
          {decisionProducts.map(product => {
            const opts = sampleOptions.filter(o => o.productId === product.id);
            const totalSkus = opts.reduce((sum, opt) =>
              sum + sampleSkuLines.filter(s => s.sampleOptionId === opt.id).length, 0
            );

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 hover:border-primary/30 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <ProductImage
                    hostedImageUrl={product.hostedImageUrl}
                    imageUrl={product.imageUrl}
                    size="md"
                    alt={product.productName}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate mb-1">
                      {product.productName}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                        待审批
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Layers size={12} />
                        {opts.length} 个方案 · {totalSkus} 款SKU
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedProductId(product.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
                  >
                    对比决策
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
