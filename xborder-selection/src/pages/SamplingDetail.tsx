import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Plus, Trash2, Package, CheckCircle, Star,
  ExternalLink, Save, Send, AlertTriangle, ChevronDown,
  Camera, X, ZoomIn,
} from 'lucide-react';
import { useAppStore } from '../context/StoreContext';
import { StatusBadge } from '../components/shared/StatusBadge';
import { HoverZoomImage, ProductImage } from '../components/shared/ProductImage';
import { TaskContextPanel } from '@/components/shared/TaskContext';
import { HistoryLog, HistoryLogEntry } from '@/components/shared/HistoryLog';

// ─── Color stripes for sample option cards ──────────────────────────────────
const CARD_COLORS = [
  { stripe: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  { stripe: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  { stripe: 'bg-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  { stripe: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  { stripe: 'bg-pink-500', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  { stripe: 'bg-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
];

// ─── Sample order status config (新流程) ─────────────────────────────────
const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: '待采购', bg: 'bg-slate-100', text: 'text-slate-600' },
  ordered:    { label: '已采购', bg: 'bg-blue-100',  text: 'text-blue-700' },
  arrived:    { label: '已到货', bg: 'bg-green-100', text: 'text-green-700' },
  evaluating: { label: '填写评价', bg: 'bg-purple-100', text: 'text-purple-700' },
  evaluated:  { label: '已评价', bg: 'bg-teal-100', text: 'text-teal-700' },
};

const ORDER_STATUS_FLOW = ['pending', 'ordered', 'arrived', 'evaluating', 'evaluated'] as const;

// 异常类型配置
const ANOMALY_TYPES = [
  { value: 'damaged', label: '损坏' },
  { value: 'color_spec_mismatch', label: '颜色规格不对' },
  { value: 'shortage', label: '缺货' },
  { value: 'quality_issue', label: '质量差' },
  { value: 'other', label: '其他' },
];

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Rating row (1–5 stars) for per-option evaluation ───────────────────────
function RatingRow({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const ratings = [
    { v: '1', label: '差' },
    { v: '2', label: '一般' },
    { v: '3', label: '合格' },
    { v: '4', label: '良好' },
    { v: '5', label: '优秀' },
  ];
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2 flex-wrap">
        {ratings.map(r => (
          <button
            key={r.v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r.v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              value === r.v
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Star size={13} className={value === r.v ? 'text-teal-500' : 'text-slate-300'} />
            {r.v} {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Image lightbox for anomaly images ──────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-slate-300 transition-colors"
        >
          <X size={24} />
        </button>
        <img
          src={src}
          alt="异常截图"
          className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

// ─── Status stepper for sample order status (新流程) ─────────────────────
function StatusStepper({ current, onChange, disabled }: {
  current: string;
  onChange: (status: string) => void;
  disabled?: boolean;
}) {
  const idx = ORDER_STATUS_FLOW.indexOf(current as any);
  const autoAdvanceStatuses = new Set(['evaluating', 'evaluated']);
  return (
    <div className="flex items-center gap-1">
      {ORDER_STATUS_FLOW.map((s, i) => {
        const cfg = ORDER_STATUS_CONFIG[s];
        const isActive = i <= idx;
        const isCurrent = s === current;
        const isAutoAdvance = autoAdvanceStatuses.has(s);
        return (
          <button
            key={s}
            type="button"
            disabled={disabled || isAutoAdvance || i <= idx}
            onClick={() => !isAutoAdvance && i > idx && onChange(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isCurrent
                ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-current/20`
                : isActive
                  ? `${cfg.bg} ${cfg.text} opacity-70`
                  : 'bg-slate-50 text-slate-400'
            } ${disabled || isAutoAdvance || i <= idx ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SamplingDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const {
    products, loading, currentUser, role, sampleAction,
    sampleOptions, sampleSkuLines,
    updateSampleOption, addSampleOption, deleteSampleOption,
    addSampleSkuLine, updateSampleSkuLine, deleteSampleSkuLine,
    updateSampleOptionStatus,
    updateSkuEvaluation,
    reportSamplingAnomaly,
  } = useAppStore();
  const [, setLocation] = useLocation();

  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); };
  }, []);

  const [startingCollection, setStartingCollection] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const [showAddOption, setShowAddOption] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionSupplier, setNewOptionSupplier] = useState('');
  const [newOptionLink, setNewOptionLink] = useState('');
  const [newOptionShippingCost, setNewOptionShippingCost] = useState('');
  // 运费编辑状态（optionId -> shippingCost）
  const [editingShippingCost, setEditingShippingCost] = useState<Record<string, string>>({});
  const [savingShippingCost, setSavingShippingCost] = useState<Record<string, boolean>>({});
  const [addingOption, setAddingOption] = useState(false);

  // Adding SKU to option
  const [addingSkuToOption, setAddingSkuToOption] = useState<string | null>(null);
  // 异常上报弹窗状态 - 支持截图上传
  const [samplingAnomaly, setSamplingAnomaly] = useState<{
    skuId: string;
    anomalyType: string;
    anomalyNote: string;
    anomalyImages: string[];
  } | null>(null);
  const [newAnomalyImageUrl, setNewAnomalyImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuPrice, setNewSkuPrice] = useState('');
  const [newSkuMoq, setNewSkuMoq] = useState('');
  const [newSkuNotes, setNewSkuNotes] = useState('');
  const [newSkuImageUrl, setNewSkuImageUrl] = useState('');
  

  // 图片灯箱
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Status change confirmation
  const [statusConfirm, setStatusConfirm] = useState<{ optionId: string; status: string } | null>(null);

  // 本地编辑状态管理 - 用于装箱数和备注输入，避免中文输入法卡顿
  const [localEdits, setLocalEdits] = useState<Record<string, { packingQuantity?: string; skuRemarks?: string }>>({});

  // SKU排序兜底 - 按sampleOptionId升序，按createdAt升序
  const sortedSkuLines = useMemo(() => 
    [...sampleSkuLines].sort((a, b) => {
      if (a.sampleOptionId !== b.sampleOptionId) 
        return a.sampleOptionId.localeCompare(b.sampleOptionId);
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }), [sampleSkuLines]);

  const product = products.find(p => p.id === id);
  if (!product) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        {loading ? '加载中…' : '产品未找到'}
      </div>
    );
  }

  const isEmployee = role === 'product_specialist';
  const isManager = role === 'product_manager';
  const backPath = isManager ? '/manager-pool' : '/samples';
  const status = product.status;

  // Get all options for this product
  const myOptions = sampleOptions
    .filter(o => o.productId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Auto-start collection if still in pending_sampling
  useEffect(() => {
    if (status === 'pending_sampling' && !startingCollection) {
      setStartingCollection(true);
      sampleAction(id, 'start_sampling_collection').finally(() => setStartingCollection(false));
    }
  }, [status]);

  const navTo = (dest: string, delay = 700) => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => setLocation(dest), delay);
  };

  // 统计方案状态
  const arrivedCount = myOptions.filter(o => {
    const os = o.sampleOrderStatus || 'pending';
    return os === 'arrived';
  }).length;
  
  const evaluatingCount = myOptions.filter(o => {
    const os = o.sampleOrderStatus || 'pending';
    return os === 'evaluating';
  }).length;
  
  const evaluatedCount = myOptions.filter(o => {
    const os = o.sampleOrderStatus || 'pending';
    return os === 'evaluated';
  }).length;
  
  const allArrived = myOptions.length >= 1 && arrivedCount === myOptions.length;
  const canStartEvaluating = myOptions.length >= 1 && allArrived && status === 'sampling_collection';
  const allEvaluated = myOptions.length > 0 && evaluatedCount === myOptions.length;
  const canSubmitReview = status === 'sampling_collection' && myOptions.length >= 3 && allEvaluated;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddOption = async () => {
    if (!newOptionLabel.trim() || !newOptionSupplier.trim() || !newOptionLink.trim() || !newOptionShippingCost.trim()) return;
    setAddingOption(true);
    try {
      await addSampleOption({
        productId: id,
        optionLabel: newOptionLabel.trim(),
        supplierName: newOptionSupplier.trim(),
        link1688: newOptionLink.trim(),
        shippingCost: newOptionShippingCost ? Number(newOptionShippingCost) : null,
        sampleOrderStatus: 'pending',
      });
      setNewOptionLabel('');
      setNewOptionSupplier('');
      setNewOptionLink('');
      setNewOptionShippingCost('');
      setShowAddOption(false);
    } catch (err) {
      alert('添加方案失败，请重试');
    } finally {
      setAddingOption(false);
    }
  };

  // 保存运费编辑
  const handleSaveShippingCost = async (optId: string) => {
    const newCost = editingShippingCost[optId];
    if (newCost === undefined) return;
    setSavingShippingCost(prev => ({ ...prev, [optId]: true }));
    try {
      const cost = newCost.trim() === '' ? null : Number(newCost);
      await updateSampleOption(optId, { shippingCost: cost });
      const n = { ...editingShippingCost };
      delete n[optId];
      setEditingShippingCost(n);
    } catch (err) {
      console.error('Failed to save shipping cost:', err);
      alert('保存运费失败');
    } finally {
      setSavingShippingCost(prev => ({ ...prev, [optId]: false }));
    }
  };

  const handleDeleteOption = async (optId: string) => {
    if (!confirm('确定删除此方案？关联的SKU也会一并删除。')) return;
    try {
      await deleteSampleOption(optId);
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleStatusChange = (optionId: string, newStatus: string) => {
    const current = myOptions.find(o => o.id === optionId);
    if (!current) return;
    const currentStatus = current.sampleOrderStatus || 'pending';
    const currentIdx = ORDER_STATUS_FLOW.indexOf(currentStatus as any);
    const newIdx = ORDER_STATUS_FLOW.indexOf(newStatus as any);
    if (newIdx <= currentIdx) return;
    setStatusConfirm({ optionId, status: newStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusConfirm) return;
    try {
      await updateSampleOptionStatus(statusConfirm.optionId, statusConfirm.status);
    } catch (err: any) {
      alert(err.message || '状态更新失败，请重试');
    }
    setStatusConfirm(null);
  };



  const handleAddSku = async (optionId: string) => {
    if (!newSkuName.trim() || !newSkuPrice.trim() || !newSkuMoq.trim() || !newSkuImageUrl.trim()) return;
    try {
      await addSampleSkuLine({
        sampleOptionId: optionId,
        skuName: newSkuName.trim(),
        unitPrice: newSkuPrice ? Number(newSkuPrice) : null,
        moq: newSkuMoq ? Number(newSkuMoq) : null,
        notes: newSkuNotes.trim() || null,
        imageUrl: newSkuImageUrl.trim() || null,
      });
      setNewSkuName('');
      setNewSkuPrice('');
      setNewSkuMoq('');
      setNewSkuNotes('');
      setNewSkuImageUrl('');
      setAddingSkuToOption(null);
    } catch (err) {
      alert('添加SKU失败，请重试');
    }
  };

  // 上传异常截图
  const handleUploadAnomalyImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await fetch('/api/upload/anomaly-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!resp.ok) throw new Error('上传失败');
      const data = await resp.json();
      if (samplingAnomaly) {
        setSamplingAnomaly({
          ...samplingAnomaly,
          anomalyImages: [...samplingAnomaly.anomalyImages, data.url],
        });
      }
    } catch (err) {
      alert('图片上传失败，请重试');
    } finally {
      setUploadingImage(false);
    }
  };

  // 报告异常 - 仅记录，不需要审批
  const handleSamplingAnomalySubmit = async () => {
    if (!samplingAnomaly || !samplingAnomaly.skuId || !samplingAnomaly.anomalyType || !samplingAnomaly.anomalyNote.trim()) return;
    try {
      await reportSamplingAnomaly(samplingAnomaly.skuId, {
        anomalyType: samplingAnomaly.anomalyType,
        anomalyNote: samplingAnomaly.anomalyNote,
        anomalyImages: samplingAnomaly.anomalyImages.length > 0 ? samplingAnomaly.anomalyImages : undefined,
      });
      setSamplingAnomaly(null);
      setNewAnomalyImageUrl('');
    } catch (err) {
      alert('提交异常记录失败，请重试');
    }
  };

  // 开始评价 - 将方案状态从arrived改为evaluating
  const handleStartEvaluating = async (optionId: string) => {
    try {
      await updateSampleOptionStatus(optionId, 'evaluating');
    } catch (err: any) {
      alert(err.message || '开始评价失败，请重试');
    }
  };

  // 完成评价 - 检查所有SKU是否都已评价（有异常的SKU跳过评价）
  const handleCompleteEvaluating = async (optionId: string, optSkus: typeof sampleSkuLines) => {
    const allFilled = optSkus.every(sku => {
      // 有异常记录的SKU不需要填评价
      if (sku.anomalyType) return true;
      return (
        sku.skuConsistentWithImage != null &&
        !!sku.skuMaterialEval &&
        !!sku.skuWorkmanshipEval &&
        !!sku.skuFunctionEval
      );
    });
    
    if (!allFilled) {
      alert('请为所有未报异常的SKU填写完整评价后再提交');
      return;
    }
    
    try {
      await updateSampleOptionStatus(optionId, 'evaluated');
    } catch (err: any) {
      alert(err.message || '提交失败，请重试');
    }
  };

  // 提交验样结果 - 所有方案都评价完成后提交给经理
  const handleSubmitReview = async () => {
    if (myOptions.length < 3) { alert('请至少添加3个采样方案后再提交'); return; } if (!canSubmitReview) return;
    setSubmittingReview(true);
    try {
      await sampleAction(id, 'submit_sampling_review', {
        note: '已提交验样评价',
      });
      navTo(backPath);
    } catch (err: any) {
      alert(err.message || '提交失败，请重试');
    } finally {
      setSubmittingReview(false);
    }
  };

  const isReadOnly = status === 'sampling_review_submitted' || status === 'pending_purchase';
  
  const canAddOption = status === 'sampling_collection' && myOptions.length < 3 && !isReadOnly;
  
  const canModifySku = (optionStatus: string | null | undefined) => {
    const os = optionStatus || 'pending';
    return !['ordered', 'arrived', 'evaluating', 'evaluated'].includes(os) && !isReadOnly;
  };

  return (
    <div className="max-w-4xl mx-auto pb-28 space-y-5">
      {/* Back */}
      <button
        onClick={() => setLocation(backPath)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} />
        返回列表
      </button>

      {/* Product header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <ProductImage
            hostedImageUrl={product.hostedImageUrl}
            imageUrl={product.imageUrl}
            size="xl"
            alt={product.productName}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={status} />
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.spuCode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {product.spuCode ? `SPU ${product.spuCode}` : '货号待生成'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{product.productName}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
              <span>供应商：{product.supplierName || '—'}</span>
              <span>采购价：¥{product.purchasePrice?.toFixed(2) ?? '—'}</span>
            </div>
            {product.link1688 && (
              <a
                href={product.link1688}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ExternalLink size={14} />
                打开采购链接
              </a>
            )}
            <div className="mt-3">
              <TaskContextPanel taskId={(product as any).taskId} compact />
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-6 text-sm flex-wrap">
          <span className="text-slate-500">
            方案数量：<span className="font-semibold text-slate-800">{myOptions.length}</span>
          </span>
          <span className="text-slate-500">
            待采购：<span className="font-semibold text-slate-800">{myOptions.filter(o => (o.sampleOrderStatus || 'pending') === 'pending').length}</span>
          </span>
          <span className="text-slate-500">
            已到货：<span className="font-semibold text-green-700">{arrivedCount}</span>
          </span>
          <span className="text-slate-500">
            评价中：<span className="font-semibold text-purple-700">{evaluatingCount}</span>
          </span>
          <span className="text-slate-500">
            已评价：<span className="font-semibold text-teal-700">{evaluatedCount}</span>
          </span>
          {status === 'sampling_collection' && allEvaluated && (
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle size={14} />
              所有方案评价完成，可提交验样结果
            </span>
          )}
        </div>
      </div>

      {/* Sample Option Cards */}
      {myOptions.map((opt, idx) => {
        const color = CARD_COLORS[idx % CARD_COLORS.length];
        const optSkus = sortedSkuLines.filter(s => s.sampleOptionId === opt.id);
        const orderStatus = opt.sampleOrderStatus || 'pending';
        const statusCfg = ORDER_STATUS_CONFIG[orderStatus];
        const isEvaluating = orderStatus === 'evaluating';
        const isEvaluated = orderStatus === 'evaluated';
        const isSkuEditable = isEvaluating && !isReadOnly;

        // 方案内是否有异常SKU
        const hasAnomalySku = optSkus.some(sku => sku.anomalyType);

        return (
          <div
            key={opt.id}
            className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${hasAnomalySku ? 'ring-2 ring-orange-200' : ''}`}
          >
            {/* Color stripe */}
            <div className={`h-1.5 ${color.stripe}`} />

            <div className="p-6">

              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 text-base">
                      {opt.optionLabel || `方案 ${idx + 1}`}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.label}
                    </span>
                    {/* 异常提示标签 */}
                    {hasAnomalySku && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 animate-pulse">
                        <AlertTriangle size={12} />
                        有异常
                      </span>
                    )}
                  </div>
                  {opt.supplierName && (
                    <p className="text-sm text-slate-500">供应商：{opt.supplierName}</p>
                  )}
                  {opt.link1688 && (
                    <a
                      href={opt.link1688}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1"
                    >
                      <ExternalLink size={12} />
                      采购链接
                    </a>
                  )}
                  {/* 运费显示/编辑 */}
                  {opt.shippingCost != null && (
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                      运费：
                      {(opt.sampleOrderStatus === 'pending' && !isReadOnly) ? (
                        editingShippingCost[opt.id] !== undefined ? (
                          <>
                            <input
                              type="number"
                              value={editingShippingCost[opt.id]}
                              onChange={e => setEditingShippingCost(prev => ({ ...prev, [opt.id]: e.target.value }))}
                              className="w-20 text-sm border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              placeholder="0.00"
                            />
                            <button
                              onClick={() => handleSaveShippingCost(opt.id)}
                              disabled={savingShippingCost[opt.id]}
                              className="text-xs bg-primary text-white px-2 py-0.5 rounded hover:bg-primary/90 disabled:opacity-40"
                            >
                              {savingShippingCost[opt.id] ? '保存中' : '保存'}
                            </button>
                            <button
                              onClick={() => { const n = {...editingShippingCost}; delete n[opt.id]; setEditingShippingCost(n); }}
                              className="text-xs text-slate-400 hover:text-slate-600 px-1"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <span
                            className="font-semibold text-slate-700 cursor-pointer hover:text-primary"
                            onClick={() => setEditingShippingCost(prev => ({ ...prev, [opt.id]: String(opt.shippingCost ?? '')}))}
                          >
                            ¥{Number(opt.shippingCost).toFixed(2)}
                          </span>
                        )
                      ) : (
                        <span className="font-semibold text-slate-700">¥{Number(opt.shippingCost).toFixed(2)}</span>
                      )}
                    </p>
                  )}
                </div>

                {!isReadOnly && myOptions.length > 1 && opt.optionLabel !== "初始方案" && !isEvaluating && !isEvaluated && (
                  <button
                    onClick={() => handleDeleteOption(opt.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    title="删除方案"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Order status stepper */}
              {!isReadOnly && !isEvaluating && !isEvaluated && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">样品采购状态</label>
                  <StatusStepper
                    current={orderStatus}
                    onChange={(s) => handleStatusChange(opt.id, s)}
                  />
                  <div className="flex gap-4 mt-2 text-xs text-slate-400">
                    {opt.sampleOrderedAt && <span>下单：{fmt(opt.sampleOrderedAt)}</span>}
                    {opt.sampleArrivedAt && <span>到货：{fmt(opt.sampleArrivedAt)}</span>}
                  </div>
                </div>
              )}

              {/* 开始评价按钮 - 当方案到达货时显示 */}
              {!isReadOnly && !isEvaluating && !isEvaluated && orderStatus === 'arrived' && (
                <div className="mb-4">
                  <button
                    onClick={() => handleStartEvaluating(opt.id)}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Star size={16} />
                    开始评价
                  </button>
                </div>
              )}

              {/* SKU table */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-slate-700">
                    SKU 列表 
                    {isEvaluating && <span className="text-purple-600 ml-1">（评价中）</span>}
                    {isEvaluated && <span className="text-teal-600 ml-1">（已评价）</span>}
                  </h4>
                  
                  {canModifySku(orderStatus) && (
                    <button
                      onClick={() => {
                        setAddingSkuToOption(addingSkuToOption === opt.id ? null : opt.id);
                        setNewSkuName('');
                        setNewSkuPrice('');
                        setNewSkuMoq('');
                        setNewSkuNotes('');
                        setNewSkuImageUrl('');
                      }}
                      className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                      <Plus size={12} />
                      添加SKU
                    </button>
                  )}
                </div>

                {optSkus.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="px-3 py-2 w-10" />
                          <th className="px-3 py-2 text-left font-medium">SKU名称</th>
                          <th className="px-3 py-2 text-right font-medium">单价</th>
                          <th className="px-3 py-2 text-right font-medium">MOQ</th>
                          <th className="px-3 py-2 text-left font-medium">备注</th>
                          {/* 已采购状态及以上，显示异常列 */}
                          {['arrived', 'evaluating', 'evaluated'].includes(orderStatus) && (
                            <th className="px-3 py-2 text-center font-medium">异常</th>
                          )}
                          {canModifySku(orderStatus) && <th className="px-3 py-2 w-8" />}
                        </tr>
                      </thead>
                      <tbody>
                        {optSkus.map(sku => {
                          const isSkuReadOnly = isEvaluated || (orderStatus !== "evaluating") || isReadOnly;
                          const canReportSamplingAnomaly = orderStatus === 'arrived' && !isReadOnly;
                          const hasAnomaly = !!sku.anomalyType;
                          return (
                            <Fragment key={sku.id}>
                              <tr className={`border-t border-slate-100 ${hasAnomaly ? 'bg-orange-50/50' : ''}`}>
                                <td className="px-3 py-2">
                                  <ProductImage
                                    hostedImageUrl={sku.hostedImageUrl}
                                    imageUrl={sku.imageUrl}
                                    size="sm"
                                    alt={sku.skuName || 'SKU'}
                                    withHover={true}
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-800">
                                  {sku.skuName || '—'}
                                  <div className={`mt-1 text-[10px] font-medium ${sku.skuCode ? 'text-slate-700' : 'text-slate-400'}`}>
                                    {sku.skuCode ? `SKU ${sku.skuCode}` : 'SKU货号待生成'}
                                  </div>
                                  {sku.managerSelected && (
                                    <span className="ml-1.5 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">已选中</span>
                                  )}
                                  {hasAnomaly && (
                                    <span className="ml-1.5 text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 inline-flex">
                                      <AlertTriangle size={10} />
                                      {ANOMALY_TYPES.find(t => t.value === sku.anomalyType)?.label || sku.anomalyType}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-700">
                                  {sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '-'}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-700">
                                  {sku.moq ?? '-'}
                                </td>
                                <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">
                                  {sku.notes || '-'}
                                </td>
                                {/* 异常操作列 */}
                                {['arrived', 'evaluating', 'evaluated'].includes(orderStatus) && (
                                  <td className="px-3 py-2 text-center">
                                    {hasAnomaly ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 font-medium">
                                        <AlertTriangle size={10} />
                                        已记录
                                      </span>
                                    ) : canReportSamplingAnomaly ? (
                                      <button
                                        onClick={() => setSamplingAnomaly({ skuId: sku.id, anomalyType: '', anomalyNote: '', anomalyImages: [] })}
                                        className="text-[10px] text-orange-500 hover:text-orange-700 font-medium flex items-center gap-0.5 mx-auto"
                                      >
                                        <AlertTriangle size={10} />
                                        报告异常
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">-</span>
                                    )}
                                  </td>
                                )}
                                {canModifySku(orderStatus) && (
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() => deleteSampleSkuLine(sku.id)}
                                      className="text-slate-400 hover:text-red-500"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                              
                              {/* SKU-level evaluation - when option is evaluating or evaluated */}
                              {(isEvaluating || isEvaluated) && (
                                <tr key={sku.id + '-eval'} className={`border-t border-slate-100 ${hasAnomaly ? 'bg-orange-50/30' : 'bg-slate-50/50'}`}>
                                  <td colSpan={7} className="px-3 py-3">
                                    <div className="space-y-3">
                                      <h5 className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                        <CheckCircle size={12} className="text-teal-600" />
                                        {sku.skuName || 'SKU'} - 验样评价
                                        {hasAnomaly && (
                                          <span className="ml-2 text-orange-500 text-[10px] font-medium">
                                            （异常：{ANOMALY_TYPES.find(t => t.value === sku.anomalyType)?.label || sku.anomalyType}）
                                          </span>
                                        )}
                                      </h5>

                                      {/* 异常详情展示 */}
                                      {hasAnomaly && (
                                        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                          <p className="text-xs text-orange-700 font-medium mb-1">异常描述：</p>
                                          <p className="text-xs text-orange-600">{sku.anomalyNote}</p>
                                          {sku.anomalyImages && sku.anomalyImages.length > 0 && (
                                            <div className="mt-2">
                                              <p className="text-xs text-orange-700 font-medium mb-1">异常截图：</p>
                                              <div className="flex gap-2 flex-wrap">
                                                {sku.anomalyImages.map((img, imgIdx) => (
                                                  <div
                                                    key={imgIdx}
                                                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-orange-200 cursor-pointer group"
                                                    onClick={() => setLightboxSrc(img)}
                                                  >
                                                    <HoverZoomImage src={img} alt={`异常截图${imgIdx+1}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                      <ZoomIn size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      
                                      {/* 评价表单 - 有异常的SKU不需要填写评价 */}
                                      {!hasAnomaly && (
                                        <>
                                          <div>
                                            <label className="text-xs text-slate-500">图片一致性</label>
                                            <div className="flex gap-2 mt-1">
                                              {[
                                                { val: true, label: '一致', cls: 'text-green-700 bg-green-50 border-green-200' },
                                                { val: false, label: '不一致', cls: 'text-red-700 bg-red-50 border-red-200' },
                                              ].map(opt2 => (
                                                <button
                                                  key={String(opt2.val)}
                                                  type="button"
                                                  disabled={isSkuReadOnly}
                                                  onClick={() => updateSkuEvaluation(sku.id, { skuConsistentWithImage: opt2.val })}
                                                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                                    sku.skuConsistentWithImage === opt2.val
                                                      ? opt2.cls
                                                      : 'border-slate-200 text-slate-400'
                                                  } ${isSkuReadOnly ? 'opacity-60 cursor-default' : ''}`}
                                                >
                                                  {opt2.label}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          
                                          <RatingRow
                                            label="材质评价"
                                            value={sku.skuMaterialEval || ''}
                                            onChange={v => updateSkuEvaluation(sku.id, { skuMaterialEval: v })}
                                            disabled={isSkuReadOnly}
                                          />
                                          
                                          <RatingRow
                                            label="做工评价"
                                            value={sku.skuWorkmanshipEval || ''}
                                            onChange={v => updateSkuEvaluation(sku.id, { skuWorkmanshipEval: v })}
                                            disabled={isSkuReadOnly}
                                          />
                                          
                                          <RatingRow
                                            label="功能评价"
                                            value={sku.skuFunctionEval || ''}
                                            onChange={v => updateSkuEvaluation(sku.id, { skuFunctionEval: v })}
                                            disabled={isSkuReadOnly}
                                          />
                                          
                                          <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                              <label className="text-xs text-slate-500">装箱数</label>
                                              <input
                                                type="number"
                                                min="1"
                                                value={localEdits[sku.id]?.packingQuantity ?? (sku.packingQuantity != null ? String(sku.packingQuantity) : '')}
                                                onChange={e => {
                                                  const val = e.target.value;
                                                  setLocalEdits(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], packingQuantity: val } }));
                                                }}
                                                onBlur={e => {
                                                  const raw = e.currentTarget.value;
                                                  const val = raw.trim();
                                                  const parsed = val === '' ? undefined : Number.parseInt(val, 10);
                                                  const num = parsed != null && Number.isFinite(parsed) ? parsed : undefined;
                                                  void updateSkuEvaluation(sku.id, { packingQuantity: num }).then(() => {
                                                    setLocalEdits(prev => {
                                                      if (prev[sku.id]?.packingQuantity !== raw) return prev;
                                                      const next = { ...prev };
                                                      if (next[sku.id]) {
                                                        delete next[sku.id].packingQuantity;
                                                        if (Object.keys(next[sku.id]).length === 0) delete next[sku.id];
                                                      }
                                                      return next;
                                                    });
                                                  }).catch(() => alert('保存装箱数失败，请重试'));
                                                }}
                                                disabled={isSkuReadOnly}
                                                placeholder={isSkuReadOnly ? '' : '每箱数量'}
                                                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:bg-slate-100 disabled:text-slate-400"
                                              />
                                            </div>
                                          </div>
                                          
                                          <div>
                                            <label className="text-xs text-slate-500">备注</label>
                                            <textarea
                                              value={localEdits[sku.id]?.skuRemarks ?? (sku.skuRemarks || '')}
                                              onChange={e => {
                                                const val = e.target.value;
                                                setLocalEdits(prev => ({ ...prev, [sku.id]: { ...prev[sku.id], skuRemarks: val } }));
                                              }}
                                                onBlur={e => {
                                                  const val = e.currentTarget.value;
                                                  void updateSkuEvaluation(sku.id, { skuRemarks: val }).then(() => {
                                                    setLocalEdits(prev => {
                                                      if (prev[sku.id]?.skuRemarks !== val) return prev;
                                                      const next = { ...prev };
                                                      if (next[sku.id]) {
                                                        delete next[sku.id].skuRemarks;
                                                        if (Object.keys(next[sku.id]).length === 0) delete next[sku.id];
                                                      }
                                                      return next;
                                                    });
                                                  }).catch(() => alert('保存备注失败，请重试'));
                                                }}
                                              readOnly={isSkuReadOnly}
                                              rows={2}
                                              placeholder={isSkuReadOnly ? '' : '验样备注...'}
                                              className={`w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none mt-1 ${isSkuReadOnly ? 'bg-slate-50 text-slate-500' : 'bg-white text-slate-800'}`}
                                            />
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {optSkus.length === 0 && (
                  <p className="text-xs text-slate-400 italic mt-2">暂无SKU，请添加</p>
                )}
              </div>

              {/* Complete evaluation button */}
              {isEvaluating && !isReadOnly && (
                <div className="mt-4">
                  <button
                    onClick={() => handleCompleteEvaluating(opt.id, optSkus)}
                    disabled={isReadOnly}
                    className="w-full py-3 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-all flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    完成评价
                  </button>
                </div>
              )}

              {/* Add SKU inline form */}
              {addingSkuToOption === opt.id && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newSkuName}
                      onChange={e => setNewSkuName(e.target.value)}
                      placeholder="SKU名称 *"
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <input
                      value={newSkuPrice}
                      onChange={e => setNewSkuPrice(e.target.value)}
                      placeholder="单价 *"
                      type="number"
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <input
                      value={newSkuMoq}
                      onChange={e => setNewSkuMoq(e.target.value)}
                      placeholder="MOQ *"
                      type="number"
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <input
                      value={newSkuNotes}
                      onChange={e => setNewSkuNotes(e.target.value)}
                      placeholder="备注"
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newSkuImageUrl}
                        onChange={e => setNewSkuImageUrl(e.target.value)}
                        placeholder="图片URL *"
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      {newSkuImageUrl && (
                        <button onClick={() => setNewSkuImageUrl('')} className="text-xs text-red-500 hover:text-red-700">清除</button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddSku(opt.id)}
                      disabled={!newSkuName.trim() || !newSkuPrice.trim() || !newSkuMoq.trim() || !newSkuImageUrl.trim()}
                      className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-40"
                    >
                      确认添加
                    </button>
                    <button
                      onClick={() => setAddingSkuToOption(null)}
                      className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add option card */}
      {canAddOption && (
        <>
          {showAddOption ? (
            <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-primary/30 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">添加新方案</h3>
              <div className="space-y-3">
                <input
                  value={newOptionLabel}
                  onChange={e => setNewOptionLabel(e.target.value)}
                  placeholder='方案名称 *（如供应商A）'
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newOptionSupplier}
                    onChange={e => setNewOptionSupplier(e.target.value)}
                    placeholder="供应商名称 *"
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  <input
                    value={newOptionLink}
                    onChange={e => setNewOptionLink(e.target.value)}
                    placeholder="1688采购链接 *"
                    className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <input
                  value={newOptionShippingCost}
                  onChange={e => setNewOptionShippingCost(e.target.value)}
                  placeholder="运费 *（单位：元）"
                  type="number"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddOption}
                    disabled={!newOptionLabel.trim() || !newOptionSupplier.trim() || !newOptionLink.trim() || !newOptionShippingCost.trim() || addingOption}
                    className="text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-40 font-medium"
                  >
                    {addingOption ? '添加中...' : '确认添加'}
                  </button>
                  <button
                    onClick={() => { setShowAddOption(false); setNewOptionShippingCost(''); }}
                    className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddOption(true)}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={18} />
              添加方案
            </button>
          )}
        </>
      )}

      {/* Bottom action bar */}
      {!isReadOnly && status === 'sampling_collection' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-6 py-4 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {myOptions.length === 0 && (
                <span>请添加至少一个方案</span>
              )}
              {myOptions.length > 0 && !allArrived && (
                <span className="text-amber-600">
                  已有 {myOptions.length} 个方案，等待所有方案到货后可开始评价
                </span>
              )}
              {allArrived && !allEvaluated && (
                <span className="text-purple-600">
                  所有方案已到货，请逐个方案点击"开始评价"
                </span>
              )}
              {allEvaluated && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle size={14} />
                  所有方案评价完成，可提交验样结果
                </span>
              )}
            </div>
            
            <div className="flex gap-3">
              {allEvaluated && (
                <button
                  onClick={handleSubmitReview}
                  disabled={!canSubmitReview || submittingReview}
                  className="text-sm bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:bg-slate-400 disabled:cursor-not-allowed font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Send size={14} />
                  {submittingReview ? '提交中...' : '提交验样结果'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status change confirmation dialog */}
      {statusConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-slate-900 mb-2">确认状态变更</h3>
            <p className="text-sm text-slate-600 mb-4">
              确认将此方案的样品状态从
              <span className="font-semibold mx-1">{ORDER_STATUS_CONFIG[myOptions.find(o => o.id === statusConfirm.optionId)?.sampleOrderStatus || 'pending']?.label}</span>
              变更为
              <span className="font-semibold mx-1">{ORDER_STATUS_CONFIG[statusConfirm.status]?.label}</span>？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setStatusConfirm(null)}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
              >
                取消
              </button>
              <button
                onClick={confirmStatusChange}
                className="text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 异常报告弹窗 - 支持截图上传 */}
      {samplingAnomaly && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" />
              报告异常
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  异常类型 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ANOMALY_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSamplingAnomaly({ ...samplingAnomaly, anomalyType: t.value })}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        samplingAnomaly.anomalyType === t.value
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  异常描述 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={samplingAnomaly.anomalyNote}
                  onChange={e => setSamplingAnomaly({ ...samplingAnomaly, anomalyNote: e.target.value })}
                  rows={3}
                  placeholder="请详细描述异常情况..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>
              {/* 截图上传区域 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  异常截图
                </label>
                {/* 已添加的截图预览 */}
                {samplingAnomaly.anomalyImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {samplingAnomaly.anomalyImages.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                        <HoverZoomImage src={img} alt={`截图${idx+1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            const newImgs = samplingAnomaly.anomalyImages.filter((_, i) => i !== idx);
                            setSamplingAnomaly({ ...samplingAnomaly, anomalyImages: newImgs });
                          }}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex-1 text-sm border border-dashed border-slate-300 rounded-lg px-3 py-1.5 text-slate-400 hover:border-primary/50 hover:text-primary cursor-pointer text-center transition-colors">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadAnomalyImage(file);
                        e.target.value = '';
                      }}
                      disabled={uploadingImage}
                    />
                    {uploadingImage ? '上传中...' : '📷 点击上传截图'}
                  </label>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">支持 jpg/png/gif/webp，单张不超过5MB</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => { setSamplingAnomaly(null); setNewAnomalyImageUrl(''); }}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2"
              >
                取消
              </button>
              <button
                onClick={handleSamplingAnomalySubmit}
                disabled={!samplingAnomaly.anomalyType || !samplingAnomaly.anomalyNote.trim()}
                className="text-sm bg-orange-500 text-white px-4 py-2 rounded-xl hover:bg-orange-600 disabled:opacity-40 font-medium"
              >
                提交异常记录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片灯箱 */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* 操作日志 */}
      {product.historyLog && (product.historyLog as any[]).length > 0 && (
        <div className="mt-6">
          <HistoryLog log={(product.historyLog as any[]) as HistoryLogEntry[]} title="操作日志" maxItems={10} />
        </div>
      )}
    </div>
  );
}
