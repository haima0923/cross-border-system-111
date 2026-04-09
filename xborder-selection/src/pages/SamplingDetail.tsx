import { useState, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Package, CheckCircle, XCircle, ClipboardList,
  AlertTriangle, Truck, ShoppingCart, BoxIcon, BadgeCheck,
  ClipboardCheck, AlertCircle, Star, ExternalLink, RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../context/StoreContext';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ProductImage } from '../components/shared/ProductImage';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' });
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-slate-400 min-w-[6rem] flex-shrink-0">{label}</span>
      <span className="text-slate-800">{children}</span>
    </div>
  );
}

function SectionCard({
  title, icon, color = 'slate', children,
}: {
  title: string;
  icon: React.ReactNode;
  color?: string;
  children: React.ReactNode;
}) {
  const border: Record<string, string> = {
    cyan:    'border-cyan-200',
    sky:     'border-sky-200',
    teal:    'border-teal-200',
    violet:  'border-violet-200',
    emerald: 'border-emerald-200',
    blue:    'border-blue-200',
    indigo:  'border-indigo-200',
    purple:  'border-purple-200',
    green:   'border-green-200',
    slate:   'border-slate-200',
  };
  const icon_c: Record<string, string> = {
    cyan:    'text-cyan-600',
    sky:     'text-sky-600',
    teal:    'text-teal-600',
    violet:  'text-violet-600',
    emerald: 'text-emerald-600',
    blue:    'text-blue-600',
    indigo:  'text-indigo-600',
    purple:  'text-purple-600',
    green:   'text-green-600',
    slate:   'text-slate-500',
  };
  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${border[color] ?? 'border-slate-200'} p-6`}>
      <h2 className={`text-base font-semibold text-slate-800 mb-4 flex items-center gap-2 ${icon_c[color] ?? ''}`}>
        {icon}
        <span className="text-slate-800">{title}</span>
      </h2>
      {children}
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, children, color = 'teal' }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; color?: string;
}) {
  const cls: Record<string, string> = {
    teal:    'bg-teal-600 hover:bg-teal-700',
    cyan:    'bg-cyan-600 hover:bg-cyan-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    blue:    'bg-blue-600 hover:bg-blue-700',
    indigo:  'bg-indigo-600 hover:bg-indigo-700',
    purple:  'bg-purple-600 hover:bg-purple-700',
    green:   'bg-green-600 hover:bg-green-700',
    red:     'bg-red-500 hover:bg-red-600',
    amber:   'bg-amber-500 hover:bg-amber-600',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls[color] ?? 'bg-slate-600 hover:bg-slate-700'} disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors`}
    >
      {children}
    </button>
  );
}

function WaitingCard({ text }: { text: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-slate-500 text-sm text-center">
      {text}
    </div>
  );
}

// ─── Rating row (1–5 stars) ──────────────────────────────────────────────────

function RatingRow({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
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
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2 flex-wrap">
        {ratings.map(r => (
          <button
            key={r.v}
            type="button"
            onClick={() => onChange(r.v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              value === r.v
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <Star size={13} className={value === r.v ? 'text-teal-500' : 'text-slate-300'} />
            {r.v} {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sample review results display ──────────────────────────────────────────

function SampleReviewResults({ product }: { product: any }) {
  return (
    <div className="space-y-3 text-sm">
      <InfoRow label="图片一致性">
        {product.sampleConsistentWithImage === true && (
          <span className="flex items-center gap-1 text-green-700 font-medium">
            <CheckCircle size={15} /> 一致
          </span>
        )}
        {product.sampleConsistentWithImage === false && (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <XCircle size={15} /> 不一致
          </span>
        )}
        {product.sampleConsistentWithImage == null && <span className="text-slate-400">未填写</span>}
      </InfoRow>
      <InfoRow label="材质评价">{product.sampleMaterialEval || '—'}</InfoRow>
      <InfoRow label="做工评价">{product.sampleWorkmanshipEval || '—'}</InfoRow>
      <InfoRow label="功能评价">{product.sampleFunctionEval || '—'}</InfoRow>
      {product.sampleRemarks && <InfoRow label="问题备注">{product.sampleRemarks}</InfoRow>}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <InfoRow label="验样人">{product.sampleReviewedBy || '—'}</InfoRow>
        <InfoRow label="验样时间">{fmt(product.sampleReviewedAt)}</InfoRow>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function SamplingDetailInner() {
  const params = useParams<{ id: string }>();
  const id = params.id!;
  const { products, loading, currentUser, role, sampleAction, addPurchaseOrder, sampleOptions, sampleSkuLines, updateSampleOption, managerDecision } = useAppStore();
  const [, setLocation] = useLocation();

  // Sample review form (shown at sample_reviewing stage — persisted in DB)
  const [sampleForm, setSampleForm] = useState({
    sampleConsistentWithImage: null as boolean | null,
    sampleMaterialEval: '',
    sampleWorkmanshipEval: '',
    sampleFunctionEval: '',
    sampleRemarks: '',
  });
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Normal path (inspecting stage) — local only, low risk (just an optional note + 1 button)
  const [normalPathExpanded, setNormalPathExpanded] = useState(false);
  const [normalNote, setNormalNote] = useState('');
  const [isStartingAnomalyReport, setIsStartingAnomalyReport] = useState(false);

  // Anomaly report form (inspecting_anomaly_entry → inspection_anomaly)
  // Form data is local state; DB status 'inspecting_anomaly_entry' persists the path choice across refresh
  const ANOMALY_TYPES = ['数量不符', '运输损坏', '颜色错误', '质量问题'];
  const [anomalyForm, setAnomalyForm] = useState({
    anomalyTypes: [] as string[],
    anomalyQuantity: '',
    anomalySeverity: '',
    anomalyNote: '',
  });
  const [anomalySubmitting, setAnomalySubmitting] = useState(false);

  // Manager handling method (inspection_anomaly → anomaly_handling)
  const HANDLING_METHODS = [
    { value: 'refund',          label: '退款',    color: 'amber' },
    { value: 'reship',          label: '补发',    color: 'blue' },
    { value: 'partial_accept',  label: '部分接受', color: 'emerald' },
    { value: 'return_goods',    label: '退货',    color: 'orange' },
    { value: 'terminate',       label: '终止',    color: 'red' },
  ];
  const [handlingMethod, setHandlingMethod] = useState('');
  const [handlingNote, setHandlingNote] = useState('');
  const [handlingSubmitting, setHandlingSubmitting] = useState(false);

  // Final decision at anomaly_resolved (manager)
  const [finalDecision, setFinalDecision] = useState<'accept' | 'terminate' | null>(null);
  const [terminateNote, setTerminateNote] = useState('');
  const [finalSubmitting, setFinalSubmitting] = useState(false);

  // Manager decision panel (sample_reviewed stage)
  const [pendingAction, setPendingAction] = useState<'approve_purchase' | 'change_supplier' | 'abandon' | null>(null);
  const [managerComment, setManagerComment] = useState('');
  const [skuQtys, setSkuQtys] = useState<Record<string, number>>({});
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Per-SKU evaluations during sample_reviewing
  const [skuEvals, setSkuEvals] = useState<Record<string, '好' | '一般' | '差'>>({});

  // Navigation timer — cleaned up on unmount to avoid navigation on stale components
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (navTimerRef.current) clearTimeout(navTimerRef.current); };
  }, []);

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
  const backPath = isManager ? '/manager-pool' : '/workbench';
  const status = product.status;

  // SKU data for this product
  const myOption = sampleOptions.find(o => o.productId === id);
  const mySkus = myOption ? sampleSkuLines.filter(s => s.sampleOptionId === myOption.id) : [];

  // ── action handlers ──────────────────────────────────────────────────────

  const navTo = (dest: string, delay = 700) => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    navTimerRef.current = setTimeout(() => setLocation(dest), delay);
  };

  const doAction = (action: string, data?: Record<string, unknown>) => {
    sampleAction(id, action, data);
    navTo(backPath);
  };

  // 开始验样：写入 DB (sample_arrived → sample_reviewing)，不导航，等待 StoreContext 刷新后页面自动切换
  const handleStartReview = () => {
    setIsStartingReview(true);
    sampleAction(id, 'start_review');
    setTimeout(() => setIsStartingReview(false), 1500);
  };

  // 取消验样：写入 DB (sample_reviewing → sample_arrived)，不导航
  const handleCancelReview = () => {
    sampleAction(id, 'cancel_review');
    setSampleForm({ sampleConsistentWithImage: null, sampleMaterialEval: '', sampleWorkmanshipEval: '', sampleFunctionEval: '', sampleRemarks: '' });
  };

  // 开始填写异常报告：写入 DB (inspecting → inspecting_anomaly_entry)，不导航
  const handleStartAnomalyReport = () => {
    setIsStartingAnomalyReport(true);
    sampleAction(id, 'start_anomaly_report');
    setTimeout(() => setIsStartingAnomalyReport(false), 1500);
  };

  // 取消填写异常报告：写入 DB (inspecting_anomaly_entry → inspecting)，不导航
  const handleCancelAnomalyReport = () => {
    sampleAction(id, 'cancel_anomaly_report');
    setAnomalyForm({ anomalyTypes: [], anomalyQuantity: '', anomalySeverity: '', anomalyNote: '' });
  };

  const handleSubmitSample = async () => {
    if (!sampleForm.sampleMaterialEval || !sampleForm.sampleWorkmanshipEval || !sampleForm.sampleFunctionEval) return;
    setSubmitting(true);
    try {
      await sampleAction(id, 'submit', {
        sampleConsistentWithImage: sampleForm.sampleConsistentWithImage,
        sampleMaterialEval: sampleForm.sampleMaterialEval,
        sampleWorkmanshipEval: sampleForm.sampleWorkmanshipEval,
        sampleFunctionEval: sampleForm.sampleFunctionEval,
        sampleRemarks: sampleForm.sampleRemarks,
      });
      if (myOption && Object.keys(skuEvals).length > 0) {
        const skuReviewData = mySkus.map(sku => ({
          id: sku.id,
          name: sku.skuName || '默认款',
          rating: skuEvals[sku.id] || null,
        }));
        await updateSampleOption(myOption.id, {
          sampleReviewSummary: JSON.stringify(skuReviewData),
        });
      }
      navTo(backPath);
    } catch (err) {
      console.error('提交验样失败:', err);
      alert('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManagerAction = async () => {
    if (!pendingAction) return;
    setActionSubmitting(true);
    try {
      if (pendingAction === 'approve_purchase') {
        if (!myOption) {
          alert('未找到采样方案，无法审批');
          setActionSubmitting(false);
          return;
        }
        const selectedSkuIds = mySkus
          .filter(s => (skuQtys[s.id] || 0) > 0)
          .map(s => s.id);
        if (selectedSkuIds.length === 0) {
          alert('请至少为一个 SKU 填写采购数量');
          setActionSubmitting(false);
          return;
        }
        await managerDecision(id, {
          action: 'approve',
          selectedOptionId: myOption.id,
          selectedSkuIds,
          skuQuantities: skuQtys,
          comment: managerComment,
        });
        const totalQty = selectedSkuIds.reduce((sum, sid) => sum + (skuQtys[sid] || 0), 0);
        addPurchaseOrder({
          productId: product.id,
          productName: product.productName,
          supplierName: product.supplierName || '未知供应商',
          purchasePrice: product.purchasePrice || 0,
          quantity: totalQty,
          totalAmount: (product.purchasePrice || 0) * totalQty,
        });
      } else {
        await sampleAction(id, pendingAction, { comment: managerComment });
      }
      navTo(backPath, 900);
    } catch (err) {
      console.error('操作失败:', err);
      alert('操作失败，请重试');
      setActionSubmitting(false);
    }
  };

  const handleReportAnomaly = () => {
    if (!anomalyForm.anomalyTypes.length || !anomalyForm.anomalySeverity) return;
    setAnomalySubmitting(true);
    sampleAction(id, 'report_anomaly', {
      anomalyTypes: anomalyForm.anomalyTypes,
      anomalyQuantity: anomalyForm.anomalyQuantity ? Number(anomalyForm.anomalyQuantity) : undefined,
      anomalySeverity: anomalyForm.anomalySeverity,
      anomalyNote: anomalyForm.anomalyNote,
    });
    navTo(backPath, 900);
    setTimeout(() => setAnomalySubmitting(false), 900);
  };

  const handleAcknowledgeAnomaly = () => {
    if (!handlingMethod) return;
    setHandlingSubmitting(true);
    sampleAction(id, 'acknowledge_anomaly', {
      anomalyHandlingMethod: handlingMethod,
      anomalyHandlingNote: handlingNote,
    });
    navTo(backPath, 900);
    setTimeout(() => setHandlingSubmitting(false), 900);
  };

  const handleFinalDecision = () => {
    if (!finalDecision) return;
    setFinalSubmitting(true);
    if (finalDecision === 'accept') {
      sampleAction(id, 'accept_goods', {});
    } else {
      sampleAction(id, 'terminate_order', { comment: terminateNote });
    }
    navTo(backPath, 900);
    setTimeout(() => setFinalSubmitting(false), 900);
  };

  const toggleAnomalyType = (type: string) => {
    setAnomalyForm(f => ({
      ...f,
      anomalyTypes: f.anomalyTypes.includes(type)
        ? f.anomalyTypes.filter(t => t !== type)
        : [...f.anomalyTypes, type],
    }));
  };

  const anomalyFormValid = anomalyForm.anomalyTypes.length > 0 && anomalyForm.anomalySeverity !== '';

  const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
    minor:  { label: '轻微', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
    moderate: { label: '一般', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    severe: { label: '严重', color: 'text-red-600 bg-red-50 border-red-200' },
  };

  const METHOD_LABEL: Record<string, string> = {
    refund: '退款', reship: '补发', partial_accept: '部分接受', return_goods: '退货', terminate: '终止',
  };

  const sampleFormValid =
    sampleForm.sampleMaterialEval.trim() !== '' &&
    sampleForm.sampleWorkmanshipEval.trim() !== '' &&
    sampleForm.sampleFunctionEval.trim() !== '';

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-5">

      {/* Back */}
      <button
        onClick={() => setLocation(backPath)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
      >
        <ArrowLeft size={16} /> 返回列表
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
            {/* 状态徽标行 — 换供产品追加"返工验样"标识 */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={status} />
              {(product as any).supplierChangeCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                  <RefreshCw size={11} /> 返工验样 · 已换供第{(product as any).supplierChangeCount}次
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{product.productName}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
              <span>供应商：{product.supplierName || '—'}</span>
              <span>采购价：¥{product.purchasePrice?.toFixed(2) ?? '—'}</span>
              {product.purchaseQuantity && (
                <span className="text-emerald-700 font-semibold">批准数量：{product.purchaseQuantity} 件</span>
              )}
            </div>
            {product.link1688 && (
              <a
                href={product.link1688}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <ExternalLink size={14} /> 打开采购链接
              </a>
            )}
            {/* 普通管理层备注：仅在非换供场景下显示（换供场景由下方 Banner 承接） */}
            {product.managerComment && !((product as any).supplierChangeCount > 0) && (
              <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                管理层备注：{product.managerComment}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 多轮换供历史时间线（仅换供产品可见）─────────────────────────────── */}
      {(product as any).supplierChangeCount > 0 && (() => {
        // supplierChangeLog: 每次经理触发 change_supplier 时追加的快照数组
        // 每条 = { round, supplierName, link1688, purchasePrice, moq, managerReason, changedAt, skus[] }
        type SkuSnap = { skuName: string; unitPrice: string | null; moq: number | null; notes: string | null; imageUrl?: string | null; hostedImageUrl?: string | null };
        type RoundSnap = {
          round: number;
          supplierName: string | null;
          link1688: string | null;
          purchasePrice: string | null;
          moq: number | null;
          managerReason: string | null;
          changedAt: string;
          skus: SkuSnap[];
        };
        const changeLog: RoundSnap[] = ((product as any).supplierChangeLog as RoundSnap[] | null) ?? [];
        const totalRounds = changeLog.length; // 历史快照数 = 已发生的换供次数

        // 当前数据（主表最新值）= 时间线的最后一条
        const currentEntry = {
          round:         totalRounds,
          supplierName:  product.supplierName  ?? null,
          link1688:      product.link1688       ?? null,
          purchasePrice: product.purchasePrice != null ? String(product.purchasePrice) : null,
          moq:           (product as any).moq   ?? null,
          managerReason: null, // 当前轮尚无经理决策
          changedAt:     product.updatedAt,
          skus:          [] as SkuSnap[], // 当前 SKU 由 sampleSkuLines 实时提供，此处仅占位
          isCurrent:     true,
        };

        // 合并：历史快照 + 当前轮（当前高亮）
        const allRounds = [
          ...changeLog.map(r => ({ ...r, isCurrent: false })),
          currentEntry,
        ];

        const fmtDate = (iso: string) => {
          try { return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
          catch { return iso; }
        };
        const fmtPrice = (p: string | null) => p != null ? `¥${Number(p).toFixed(2)}` : '—';

        return (
          <div className="space-y-3">
            {/* 标题 */}
            <div className="flex items-center gap-2 px-1">
              <RefreshCw size={15} className="text-amber-600" />
              <span className="text-sm font-bold text-amber-800">
                换供历史（共 {totalRounds} 次更换）
              </span>
              <span className="ml-auto text-xs text-amber-600 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                ⚠ 返工审核，请结合全部历史决策
              </span>
            </div>

            {/* 时间线卡片 */}
            <div className="relative">
              {/* 垂直连接线 */}
              <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-amber-200 z-0" />

              <div className="space-y-3 relative z-10">
                {allRounds.map((entry) => (
                  <div key={entry.round} className={`flex gap-3 ${entry.isCurrent ? '' : 'opacity-90'}`}>
                    {/* 时间线节点 */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      entry.isCurrent
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                        : 'bg-white border-amber-300 text-amber-700'
                    }`}>
                      {entry.round === 0 ? '初' : `第${entry.round}`}
                    </div>

                    {/* 内容卡片 */}
                    <div className={`flex-1 rounded-xl border p-4 ${
                      entry.isCurrent
                        ? 'bg-amber-50 border-amber-300 shadow-sm'
                        : 'bg-white border-slate-200'
                    }`}>
                      {/* 卡片头 */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-bold ${entry.isCurrent ? 'text-amber-700' : 'text-slate-500'}`}>
                          {entry.round === 0
                            ? '第0轮（初始供应商）'
                            : entry.isCurrent
                              ? `第${entry.round}轮（当前，待经理决策）`
                              : `第${entry.round}轮（已换供）`}
                        </span>
                        <span className="text-xs text-slate-400">{fmtDate(entry.changedAt)}</span>
                      </div>

                      {/* 供应商 / 价格 / MOQ */}
                      <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">供应商</div>
                          <div className="font-medium text-slate-800 truncate">{entry.supplierName || '—'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">采购价</div>
                          <div className="font-medium text-slate-800">{fmtPrice(entry.purchasePrice)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-0.5">MOQ</div>
                          <div className="font-medium text-slate-800">{entry.moq != null ? `${entry.moq} 件` : '—'}</div>
                        </div>
                      </div>

                      {/* SKU 快照（历史轮次从 supplierChangeLog 取；当前轮从 sampleSkuLines 实时取）*/}
                      {entry.isCurrent ? (() => {
                        const opt = sampleOptions.find(o => o.productId === product.id);
                        const liveskus = opt ? sampleSkuLines.filter(s => s.sampleOptionId === opt.id) : [];
                        if (liveskus.length === 0) return null;
                        return (
                          <div className="mt-2 border border-amber-200 rounded-lg overflow-hidden">
                            <div className="bg-amber-100/60 px-3 py-1.5 text-xs font-semibold text-amber-700 border-b border-amber-200">
                              当前 SKU（{liveskus.length} 款）
                            </div>
                            <table className="w-full text-xs">
                              <thead><tr className="bg-slate-50 text-slate-400">
                                <th className="px-2 py-1.5 w-10 text-center">图</th>
                                <th className="px-3 py-1.5 text-left">规格</th>
                                <th className="px-3 py-1.5 text-right">单价</th>
                                <th className="px-3 py-1.5 text-right">MOQ</th>
                                <th className="px-3 py-1.5 text-left">备注</th>
                              </tr></thead>
                              <tbody className="divide-y divide-slate-100">
                                {liveskus.map(sku => (
                                  <tr key={sku.id}>
                                    <td className="px-2 py-1.5">
                                      <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                                    </td>
                                    <td className="px-3 py-1.5 text-slate-700 font-medium">{sku.skuName || '默认款'}</td>
                                    <td className="px-3 py-1.5 text-right text-slate-600">{sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '—'}</td>
                                    <td className="px-3 py-1.5 text-right text-slate-600">{sku.moq ?? '—'}</td>
                                    <td className="px-3 py-1.5 text-slate-400">{sku.notes || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })() : entry.skus && entry.skus.length > 0 ? (
                        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 border-b border-slate-200">
                            历史 SKU 快照（{entry.skus.length} 款）
                          </div>
                          <table className="w-full text-xs">
                            <thead><tr className="bg-slate-50/50 text-slate-400">
                              <th className="px-2 py-1.5 w-10 text-center">图</th>
                              <th className="px-3 py-1.5 text-left">规格</th>
                              <th className="px-3 py-1.5 text-right">单价</th>
                              <th className="px-3 py-1.5 text-right">MOQ</th>
                              <th className="px-3 py-1.5 text-left">备注</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {entry.skus.map((sku, i) => (
                                <tr key={i}>
                                  <td className="px-2 py-1.5">
                                    <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-600">{sku.skuName || '默认款'}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-500">{sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '—'}</td>
                                  <td className="px-3 py-1.5 text-right text-slate-500">{sku.moq ?? '—'}</td>
                                  <td className="px-3 py-1.5 text-slate-400">{sku.notes || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {/* 经理换供原因（历史轮次才有，当前轮尚未决策） */}
                      {!entry.isCurrent && entry.managerReason && (
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-start gap-1.5">
                          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-amber-700">
                            <span className="font-semibold">换供原因：</span>{entry.managerReason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* SKU info panel — derived from sample_options / sample_sku_lines */}
      {(() => {
        const option = sampleOptions.find(o => o.productId === product.id);
        const skus = option ? sampleSkuLines.filter(s => s.sampleOptionId === option.id) : [];
        if (!option && skus.length === 0) return null;
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ClipboardList size={15} className="text-slate-400" />
              SKU 方案明细
              {option?.optionLabel && (
                <span className="text-xs text-slate-400 font-normal">— {option.optionLabel}</span>
              )}
            </h3>
            {skus.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="pb-2 pr-2 w-10 font-medium text-center">图</th>
                      <th className="text-left pb-2 pr-4 font-medium">SKU名称</th>
                      <th className="text-right pb-2 pr-4 font-medium">采购单价(¥)</th>
                      <th className="text-right pb-2 pr-4 font-medium">MOQ</th>
                      <th className="text-left pb-2 font-medium">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map(sku => (
                      <tr key={sku.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-2">
                          <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                        </td>
                        <td className="py-2 pr-4 font-medium text-slate-800">{sku.skuName || '—'}</td>
                        <td className="py-2 pr-4 text-right text-slate-700">
                          {sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 pr-4 text-right text-slate-700">
                          {sku.moq != null ? `${sku.moq} 件` : '—'}
                        </td>
                        <td className="py-2 text-slate-500 text-xs">{sku.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">暂无SKU明细</p>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 1: 待采样 (pending_sampling)
          员工：确认采样按钮
          管理层：等待视图
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'pending_sampling' && isEmployee && (
        <SectionCard title="待采样" icon={<ClipboardList size={18} />} color="cyan">
          <p className="text-slate-600 mb-2">
            管理层已通过初筛，请前往采购平台联系供应商索取样品，收到样品后回来点击「确认采样」。
          </p>
          {product.link1688 ? (
            <a
              href={product.link1688}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mb-4 bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <ExternalLink size={15} /> 前往采购链接（新窗口）
            </a>
          ) : (
            <p className="text-xs text-slate-400 mb-4 italic">（未填写采购链接，请在产品录入页补充）</p>
          )}

          {/* SKU list — show which SKUs will be sampled */}
          {mySkus.length > 0 && (
            <div className="mb-5 border border-cyan-100 rounded-xl overflow-hidden">
              <div className="bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-700 border-b border-cyan-100">
                需索样的 SKU 规格（共 {mySkus.length} 款）
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs">
                    <th className="px-2 py-2 w-10 text-center font-medium">图</th>
                    <th className="px-4 py-2 text-left font-medium">SKU 描述</th>
                    <th className="px-4 py-2 text-right font-medium">单价 (¥)</th>
                    <th className="px-4 py-2 text-right font-medium">MOQ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mySkus.map(sku => (
                    <tr key={sku.id} className="hover:bg-slate-50/50">
                      <td className="px-2 py-2">
                        <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-medium">{sku.skuName || '默认款'}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{sku.moq ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-slate-400 text-xs mb-5">确认后进入「采样中」状态，样品到达后再标记到样。</p>
          <PrimaryBtn onClick={() => doAction('start')} color="cyan">
            确认采样（已联系供应商）
          </PrimaryBtn>
        </SectionCard>
      )}

      {status === 'pending_sampling' && isManager && (
        <WaitingCard text="等待员工确认采样，联系供应商中…" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 2: 采样中 (sampling) — 禁止填写评价表
          员工：仅"标记样品已到"
          管理层：等待
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'sampling' && isEmployee && (
        <SectionCard title="采样中" icon={<Truck size={18} />} color="sky">
          <div className="space-y-4">
            <div className="text-sm text-slate-600 space-y-1">
              <p>样品已向供应商下单，等待快递寄达。</p>
              <div className="text-xs text-slate-400">
                开始于 {fmt(product.samplingStartedAt)}
                {product.samplingStartedBy && `，操作人：${product.samplingStartedBy}`}
              </div>
            </div>
            {product.link1688 && (
              <a
                href={product.link1688}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-800 font-medium transition-colors"
              >
                <ExternalLink size={14} /> 查看采购链接
              </a>
            )}
            {/* 严禁提前填写提示 */}
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-0.5">此阶段禁止填写验样结果</div>
                <div className="text-amber-700/80 text-xs">样品到达后请先点击"标记样品已到"，再进行检验并填写评价。</div>
              </div>
            </div>
            <PrimaryBtn onClick={() => doAction('arrive')} color="sky">
              标记样品已到 📦
            </PrimaryBtn>
          </div>
        </SectionCard>
      )}

      {status === 'sampling' && isManager && (
        <WaitingCard text="采样中，等待样品寄达后员工标记到样…" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 3: 已到样 (sample_arrived) — 此时才可验样
          员工：点击"开始验样"后展示评价表单
          管理层：等待
      ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 阶段 3a: 已到样 (sample_arrived) — 仅显示开始按钮 ── */}
      {status === 'sample_arrived' && isEmployee && (
        <SectionCard title="样品已到，准备验样" icon={<BadgeCheck size={18} />} color="teal">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              样品已到达，请仔细检验后填写验样报告。验样报告是管理层采购决策的核心依据。
            </p>
            <div className="text-xs text-slate-400">样品到样时间：{fmt(product.sampleArrivedAt)}</div>
            <PrimaryBtn onClick={handleStartReview} disabled={isStartingReview} color="teal">
              {isStartingReview ? '正在进入…' : '开始验样（填写评价）'}
            </PrimaryBtn>
          </div>
        </SectionCard>
      )}

      {status === 'sample_arrived' && isManager && (
        <WaitingCard text="样品已到，等待员工完成检验并提交验样报告…" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 3b: 验样中 (sample_reviewing) — 状态已持久化到 DB
          员工：直接显示评价表单（刷新后不丢失）
          管理层：等待
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'sample_reviewing' && isEmployee && (
        <SectionCard title="验样中 — 填写评价报告" icon={<BadgeCheck size={18} />} color="teal">
          <div className="space-y-5">
            <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-2.5 text-sm text-teal-700">
              <AlertCircle size={15} className="flex-shrink-0" />
              <span>验样状态已记录，刷新页面后表单保持开放，填完后提交即可。</span>
            </div>
            <p className="text-xs text-slate-400">样品到样：{fmt(product.sampleArrivedAt)}</p>

            {/* Per-SKU ratings */}
            {mySkus.length > 0 && (
              <div className="border border-teal-100 rounded-xl overflow-hidden">
                <div className="bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 border-b border-teal-100">
                  各 SKU 规格评价 <span className="text-xs font-normal text-teal-600/70">（可选，评价各规格的样品质量）</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {mySkus.map(sku => (
                    <div key={sku.id} className="flex items-center justify-between px-4 py-3 gap-4">
                      <span className="text-sm text-slate-700 font-medium flex-1 min-w-0 truncate">
                        {sku.skuName || '默认款'}
                        {sku.unitPrice != null && (
                          <span className="ml-2 text-xs text-slate-400 font-normal">¥{Number(sku.unitPrice).toFixed(2)}</span>
                        )}
                      </span>
                      <div className="flex gap-2 flex-shrink-0">
                        {(['好', '一般', '差'] as const).map(rating => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setSkuEvals(prev => ({ ...prev, [sku.id]: rating }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              skuEvals[sku.id] === rating
                                ? rating === '好' ? 'bg-emerald-500 text-white border-emerald-500'
                                  : rating === '一般' ? 'bg-amber-400 text-white border-amber-400'
                                  : 'bg-red-500 text-white border-red-500'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 图片一致性 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">样品是否与图片一致？</label>
              <div className="flex gap-3">
                {[
                  { val: true,  label: '一致',   icon: <CheckCircle size={15} className="text-green-600" /> },
                  { val: false, label: '不一致', icon: <XCircle size={15} className="text-red-500" /> },
                ].map(opt => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setSampleForm(f => ({ ...f, sampleConsistentWithImage: opt.val }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-colors ${
                      sampleForm.sampleConsistentWithImage === opt.val
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 材质评价 */}
            <RatingRow
              label="材质评价"
              value={sampleForm.sampleMaterialEval}
              onChange={v => setSampleForm(f => ({ ...f, sampleMaterialEval: v }))}
              required
            />

            {/* 做工评价 */}
            <RatingRow
              label="做工评价"
              value={sampleForm.sampleWorkmanshipEval}
              onChange={v => setSampleForm(f => ({ ...f, sampleWorkmanshipEval: v }))}
              required
            />

            {/* 功能评价 */}
            <RatingRow
              label="功能评价"
              value={sampleForm.sampleFunctionEval}
              onChange={v => setSampleForm(f => ({ ...f, sampleFunctionEval: v }))}
              required
            />

            {/* 问题备注 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">问题备注（可选）</label>
              <textarea
                rows={3}
                placeholder="描述外观、功能或物流问题（选填）"
                value={sampleForm.sampleRemarks}
                onChange={e => setSampleForm(f => ({ ...f, sampleRemarks: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <PrimaryBtn
                onClick={handleSubmitSample}
                disabled={submitting || !sampleFormValid}
                color="teal"
              >
                {submitting ? '提交中…' : '提交验样结果'}
              </PrimaryBtn>
              <button
                onClick={handleCancelReview}
                className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-5 py-3 rounded-xl transition-colors text-sm"
              >
                暂不填写（退回待验样）
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {status === 'sample_reviewing' && isManager && (
        <WaitingCard text="员工正在填写验样评价报告，请等待提交…" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 4: 已验样 (sample_reviewed) — 管理层决策
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'sample_reviewed' && (
        <>
          {/* 验样结果摘要 */}
          <SectionCard title="验样结果" icon={<ClipboardCheck size={18} />} color="violet">
            <SampleReviewResults product={product} />

            {/* Per-SKU evaluation breakdown (if saved) */}
            {(() => {
              if (!myOption?.sampleReviewSummary) return null;
              let parsed: Array<{ id: string; name: string; rating: string | null }> = [];
              try { parsed = JSON.parse(myOption.sampleReviewSummary); } catch { return null; }
              if (!parsed.length) return null;
              return (
                <div className="mt-4 pt-4 border-t border-violet-100">
                  <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">各 SKU 规格评价</div>
                  <div className="space-y-2">
                    {parsed.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{item.name}</span>
                        {item.rating ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.rating === '好' ? 'bg-emerald-100 text-emerald-700'
                            : item.rating === '一般' ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                            {item.rating}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">未评价</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </SectionCard>

          {/* 员工视图 */}
          {isEmployee && (
            <WaitingCard text="验样结果已提交，等待管理层做出采购决策…" />
          )}

          {/* 管理层决策面板 */}
          {isManager && !pendingAction && (
            <SectionCard title="管理层决策" icon={<ClipboardList size={18} />} color="slate">
              <p className="text-sm text-slate-500 mb-4">
                请根据验样结果决定是否进入采购流程。
              </p>
              <div className="flex flex-wrap gap-3">
                <PrimaryBtn onClick={() => setPendingAction('approve_purchase')} color="emerald">
                  通过
                </PrimaryBtn>
                <PrimaryBtn onClick={() => setPendingAction('change_supplier')} color="amber">
                  更换供应商
                </PrimaryBtn>
                <PrimaryBtn onClick={() => setPendingAction('abandon')} color="red">
                  取消
                </PrimaryBtn>
              </div>
            </SectionCard>
          )}

          {isManager && pendingAction && (
            <SectionCard
              title={
                pendingAction === 'approve_purchase' ? '确认通过'
                : pendingAction === 'change_supplier' ? '确认更换供应商'
                : '确认取消'
              }
              icon={<AlertTriangle size={18} />}
              color={pendingAction === 'approve_purchase' ? 'emerald' : pendingAction === 'change_supplier' ? 'amber' : 'slate'}
            >
              {pendingAction === 'abandon' && (
                <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
                  <AlertTriangle size={15} /> 放弃后产品进入已拒绝状态，无法撤回
                </div>
              )}

              {/* 采购数量 per-SKU (仅 approve) */}
              {pendingAction === 'approve_purchase' && (
                <div className="mb-5 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-sm font-semibold text-emerald-800 mb-3">
                    采购数量（按 SKU 填写）<span className="text-red-500 ml-1">*</span>
                  </div>
                  {mySkus.length === 0 ? (
                    <p className="text-sm text-slate-500">暂无 SKU 记录，请联系员工补录。</p>
                  ) : (
                    <div className="space-y-2">
                      {mySkus.map(sku => (
                        <div key={sku.id} className="flex items-center gap-3">
                          <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                            {sku.skuName || '默认款'}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={skuQtys[sku.id] ?? ''}
                            onChange={e => setSkuQtys(prev => ({ ...prev, [sku.id]: Math.max(0, Number(e.target.value)) }))}
                            placeholder="0"
                            className="border border-emerald-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-24 text-right"
                          />
                          <span className="text-xs text-slate-500 w-4">件</span>
                        </div>
                      ))}
                      {(() => {
                        const totalQty = mySkus.reduce((s, sku) => s + (skuQtys[sku.id] || 0), 0);
                        const totalAmt = (product.purchasePrice || 0) * totalQty;
                        return totalQty > 0 ? (
                          <div className="pt-2 border-t border-emerald-100 text-sm text-slate-600 flex justify-between">
                            <span>合计</span>
                            <span className="font-semibold text-emerald-800">{totalQty} 件 · ¥{totalAmt.toLocaleString()}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  备注{pendingAction !== 'approve_purchase' && <span className="text-red-500"> *</span>}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    pendingAction === 'approve_purchase' ? '采购备注（可选）'
                    : pendingAction === 'change_supplier' ? '请说明更换供应商的原因…'
                    : '请说明放弃的原因…'
                  }
                  value={managerComment}
                  onChange={e => setManagerComment(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleManagerAction}
                  disabled={actionSubmitting || (pendingAction !== 'approve_purchase' && !managerComment.trim())}
                  className={`font-semibold px-5 py-3 rounded-xl transition-colors disabled:bg-slate-200 disabled:text-slate-400 text-white ${
                    pendingAction === 'approve_purchase' ? 'bg-emerald-600 hover:bg-emerald-700'
                    : pendingAction === 'change_supplier' ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {actionSubmitting ? '处理中…' : '确认'}
                </button>
                <button
                  onClick={() => { setPendingAction(null); setManagerComment(''); setSkuQtys({}); }}
                  className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-5 py-3 rounded-xl transition-colors"
                >
                  返回
                </button>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 5: 待采购 (pending_purchase) — 员工执行采购
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'pending_purchase' && isEmployee && (
        <SectionCard title="待采购" icon={<ShoppingCart size={18} />} color="emerald">
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="text-sm font-semibold text-emerald-800 mb-2">🎉 管理层已批准采购！</div>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-slate-500">批准采购数量</div>
                  {product.purchaseQuantity ? (
                    <div className="text-2xl font-bold text-emerald-700">{product.purchaseQuantity} 件</div>
                  ) : (
                    <div className="text-sm text-slate-400 italic">（见管理层备注）</div>
                  )}
                </div>
                {product.purchaseQuantity && product.purchasePrice ? (
                  <div>
                    <div className="text-xs text-slate-500">合计金额</div>
                    <div className="text-lg font-bold text-slate-700">
                      ¥{(product.purchaseQuantity * product.purchasePrice).toLocaleString()}
                    </div>
                  </div>
                ) : null}
              </div>
              {product.managerComment && (
                <div className="mt-3 text-xs text-emerald-700/80">备注：{product.managerComment}</div>
              )}
            </div>
            <p className="text-sm text-slate-600">请按批准数量联系供应商下单，确认后点击下方按钮。</p>
            <PrimaryBtn onClick={() => doAction('confirm_order')} color="emerald">
              确认已下单
            </PrimaryBtn>
          </div>
        </SectionCard>
      )}

      {status === 'pending_purchase' && isManager && (
        <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-sm text-emerald-800">
          <p className="font-semibold mb-1">已批准采购 {product.purchaseQuantity} 件</p>
          <p className="text-emerald-700/70">等待员工确认下单…</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 6: 已下单 (ordered) — 等待货物到达
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'ordered' && (
        <SectionCard title="已下单，等待到货" icon={<Truck size={18} />} color="blue">
          <div className="space-y-4">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <div className="text-slate-400 text-xs">采购数量</div>
                <div className="font-bold text-blue-700 text-lg">{product.purchaseQuantity ?? '—'} 件</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs">下单时间</div>
                <div className="font-medium text-slate-700">{fmt(product.orderedAt)}</div>
              </div>
            </div>
            {isEmployee && (
              <PrimaryBtn onClick={() => doAction('mark_arrived')} color="blue">
                货物已到 🚚
              </PrimaryBtn>
            )}
            {isManager && <p className="text-slate-400 text-sm">等待货物到达…</p>}
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 7: 已到货 (goods_arrived) — 点击开始验货进入验货中
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'goods_arrived' && (
        <SectionCard title="货物已到，待验货" icon={<BoxIcon size={18} />} color="indigo">
          <div className="space-y-3">
            <InfoRow label="到货时间">{fmt((product as any).goodsArrivedAt)}</InfoRow>
            <InfoRow label="采购数量">{(product as any).purchaseQuantity ? `${(product as any).purchaseQuantity} 件` : '—'}</InfoRow>
            {isEmployee && (
              <>
                <p className="text-sm text-slate-600">请进入验货流程，根据实际情况选择"验货正常"或"发现异常"。</p>
                <PrimaryBtn onClick={() => doAction('start_inspection')} color="indigo">
                  开始验货
                </PrimaryBtn>
              </>
            )}
            {isManager && <p className="text-slate-400 text-sm">货物已到，等待员工开始验货…</p>}
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 7b: 验货中 (inspecting) — 员工选择正常或异常分支
          "发现异常"路径会写 DB → inspecting_anomaly_entry，刷新后不丢失
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'inspecting' && isEmployee && (
        <SectionCard title="验货中" icon={<ClipboardList size={18} />} color="sky">
          <div className="space-y-5">
            <div className="text-xs text-slate-400">开始验货：{fmt((product as any).inspectingStartedAt)}</div>

            {/* Path selection (default view) */}
            {!normalPathExpanded && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 font-medium">请根据验货结果选择：</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNormalPathExpanded(true)}
                    className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                  >
                    <CheckCircle size={28} className="text-emerald-500" />
                    <span className="font-semibold text-slate-800">验货正常</span>
                    <span className="text-xs text-slate-400 text-center">数量和质量均符合要求</span>
                  </button>
                  <button
                    onClick={handleStartAnomalyReport}
                    disabled={isStartingAnomalyReport}
                    className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-red-200 hover:border-red-400 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle size={28} className="text-red-500" />
                    <span className="font-semibold text-slate-800">
                      {isStartingAnomalyReport ? '正在进入…' : '发现异常'}
                    </span>
                    <span className="text-xs text-slate-400 text-center">数量/质量存在问题</span>
                  </button>
                </div>
              </div>
            )}

            {/* Normal path — local state only (low risk: optional note + 1 button) */}
            {normalPathExpanded && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle size={18} />
                  <span className="font-semibold">验货正常</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">备注（可选）</label>
                  <textarea
                    rows={2}
                    placeholder="如有补充说明请填写…"
                    value={normalNote}
                    onChange={e => setNormalNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <PrimaryBtn onClick={() => doAction('pass_inspection', { goodsInspectionNote: normalNote })} color="emerald">
                    确认验货通过 ✓
                  </PrimaryBtn>
                  <button onClick={() => setNormalPathExpanded(false)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-5 py-3 rounded-xl text-sm">
                    返回
                  </button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {status === 'inspecting' && isManager && (
        <WaitingCard text="验货中，员工正在核查货物…" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 7b-异常: 异常填报中 (inspecting_anomaly_entry)
          DB 状态已持久化，刷新后表单页面直接恢复，无需重新选择路径
          员工：直接显示异常报告表单
          管理层：等待视图
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'inspecting_anomaly_entry' && isEmployee && (
        <SectionCard title="填写验货异常报告" icon={<AlertTriangle size={18} />} color="sky">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={16} />
              <span className="font-semibold text-sm">异常路径已记录，刷新页面后表单保持开放</span>
            </div>

            {/* 异常类型（多选）*/}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                异常类型 <span className="text-red-500">*</span>
                <span className="text-slate-400 font-normal ml-1">（可多选）</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {ANOMALY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleAnomalyType(type)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      anomalyForm.anomalyTypes.includes(type)
                        ? 'border-red-400 bg-red-50 text-red-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 异常数量 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">异常数量（件）</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="发现异常的数量"
                value={anomalyForm.anomalyQuantity}
                onChange={e => setAnomalyForm(f => ({ ...f, anomalyQuantity: e.target.value }))}
                className="border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 w-40"
              />
            </div>

            {/* 严重程度 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                严重程度 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {[
                  { v: 'minor',    label: '轻微',  cls: 'border-yellow-300 bg-yellow-50 text-yellow-700', sel: 'border-yellow-400' },
                  { v: 'moderate', label: '一般',  cls: 'border-orange-300 bg-orange-50 text-orange-700', sel: 'border-orange-400' },
                  { v: 'severe',   label: '严重',  cls: 'border-red-300 bg-red-50 text-red-700',          sel: 'border-red-400' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setAnomalyForm(f => ({ ...f, anomalySeverity: opt.v }))}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                      anomalyForm.anomalySeverity === opt.v ? `${opt.cls} ${opt.sel}` : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 图片证据链接 + 备注 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">问题描述 / 图片链接</label>
              <textarea
                rows={3}
                placeholder="详细描述异常情况，可附图片链接（如云存储 URL）…"
                value={anomalyForm.anomalyNote}
                onChange={e => setAnomalyForm(f => ({ ...f, anomalyNote: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <PrimaryBtn
                onClick={handleReportAnomaly}
                disabled={anomalySubmitting || !anomalyFormValid}
                color="red"
              >
                {anomalySubmitting ? '提交中…' : '提交异常报告'}
              </PrimaryBtn>
              <button
                onClick={handleCancelAnomalyReport}
                className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-5 py-3 rounded-xl text-sm"
              >
                返回
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {status === 'inspecting_anomaly_entry' && isManager && (
        <WaitingCard text="员工正在填写验货异常报告，请等待提交…" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 7c: 验货异常 (inspection_anomaly) — 等待管理层决策
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'inspection_anomaly' && (
        <>
          {/* Anomaly report summary — visible to both roles */}
          <SectionCard title="验货异常报告" icon={<AlertTriangle size={18} />} color="slate">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 mb-1">
                {((product as any).anomalyTypes as string[] | null)?.map(t => (
                  <span key={t} className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-lg text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
              <InfoRow label="异常数量">
                {(product as any).anomalyQuantity ? `${(product as any).anomalyQuantity} 件` : '未填写'}
              </InfoRow>
              <InfoRow label="严重程度">
                {(product as any).anomalySeverity ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${SEVERITY_MAP[(product as any).anomalySeverity]?.color ?? 'text-slate-600'}`}>
                    {SEVERITY_MAP[(product as any).anomalySeverity]?.label ?? (product as any).anomalySeverity}
                  </span>
                ) : '—'}
              </InfoRow>
              {(product as any).anomalyNote && (
                <InfoRow label="问题描述">{(product as any).anomalyNote}</InfoRow>
              )}
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <InfoRow label="上报人">{(product as any).anomalyReportedBy || '—'}</InfoRow>
                <InfoRow label="上报时间">{fmt((product as any).anomalyReportedAt)}</InfoRow>
              </div>
            </div>
          </SectionCard>

          {/* Employee waits */}
          {isEmployee && (
            <WaitingCard text="异常报告已提交，等待管理层确认处理方案…" />
          )}

          {/* Manager: select handling method */}
          {isManager && (
            <SectionCard title="选择处理方案" icon={<ClipboardList size={18} />} color="orange">
              <div className="space-y-4">
                <p className="text-sm text-slate-600">请根据异常情况选择与供应商的处理方案：</p>
                <div className="flex flex-wrap gap-2">
                  {HANDLING_METHODS.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setHandlingMethod(m.value)}
                      className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                        handlingMethod === m.value
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">处理说明</label>
                  <textarea
                    rows={3}
                    placeholder="请说明具体处理要求（如退款金额、补发数量等）…"
                    value={handlingNote}
                    onChange={e => setHandlingNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  />
                </div>
                <PrimaryBtn
                  onClick={handleAcknowledgeAnomaly}
                  disabled={handlingSubmitting || !handlingMethod}
                  color="amber"
                >
                  {handlingSubmitting ? '确认中…' : '确认处理方案'}
                </PrimaryBtn>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 7d: 异常处理中 (anomaly_handling) — 与供应商沟通
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'anomaly_handling' && (
        <>
          {/* Handling plan summary */}
          <SectionCard title="异常处理追踪" icon={<AlertCircle size={18} />} color="orange">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 mb-1">
                {((product as any).anomalyTypes as string[] | null)?.map(t => (
                  <span key={t} className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-lg text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
              <InfoRow label="严重程度">
                {(product as any).anomalySeverity ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${SEVERITY_MAP[(product as any).anomalySeverity]?.color ?? 'text-slate-600'}`}>
                    {SEVERITY_MAP[(product as any).anomalySeverity]?.label ?? (product as any).anomalySeverity}
                  </span>
                ) : '—'}
              </InfoRow>
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <InfoRow label="处理方案">
                  <span className="font-semibold text-orange-700">
                    {METHOD_LABEL[(product as any).anomalyHandlingMethod] ?? (product as any).anomalyHandlingMethod ?? '—'}
                  </span>
                </InfoRow>
                {(product as any).anomalyHandlingNote && (
                  <InfoRow label="处理说明">{(product as any).anomalyHandlingNote}</InfoRow>
                )}
                <InfoRow label="负责人">{(product as any).anomalyHandledBy || '—'}</InfoRow>
                <InfoRow label="确认时间">{fmt((product as any).anomalyHandledAt)}</InfoRow>
              </div>
            </div>
          </SectionCard>

          {/* Employee: confirm resolution done */}
          {isEmployee && (
            <SectionCard title="确认异常已处理完毕" icon={<CheckCircle size={18} />} color="slate">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  请在与供应商完成沟通并确认处理结果后，点击下方按钮进入再决策阶段。
                </p>
                <PrimaryBtn onClick={() => doAction('resolve_anomaly')} color="teal">
                  确认异常已处理完毕
                </PrimaryBtn>
              </div>
            </SectionCard>
          )}

          {isManager && (
            <WaitingCard text="异常处理中，等待员工确认处理完毕…" />
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 7e: 处理完成 (anomaly_resolved) — 管理层再决策：入库/终止
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'anomaly_resolved' && (
        <>
          {/* Resolution summary */}
          <SectionCard title="异常处理总结" icon={<BadgeCheck size={18} />} color="slate">
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 mb-1">
                {((product as any).anomalyTypes as string[] | null)?.map(t => (
                  <span key={t} className="bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-lg text-xs font-medium">
                    {t}
                  </span>
                ))}
              </div>
              <InfoRow label="处理方案">
                <span className="font-semibold text-slate-800">
                  {METHOD_LABEL[(product as any).anomalyHandlingMethod] ?? '—'}
                </span>
              </InfoRow>
              {(product as any).anomalyHandlingNote && (
                <InfoRow label="处理说明">{(product as any).anomalyHandlingNote}</InfoRow>
              )}
              <InfoRow label="处理完成时间">{fmt((product as any).anomalyResolvedAt)}</InfoRow>
            </div>
          </SectionCard>

          {/* Employee waits */}
          {isEmployee && (
            <WaitingCard text="异常已处理，等待管理层决定是否入库…" />
          )}

          {/* Manager: final decision */}
          {isManager && !finalDecision && (
            <SectionCard title="再决策：是否入库？" icon={<ClipboardList size={18} />} color="slate">
              <p className="text-sm text-slate-500 mb-4">
                异常处理已完成。请决定是否继续将货物入库，或终止本次采购。
              </p>
              <div className="flex flex-wrap gap-3">
                <PrimaryBtn onClick={() => setFinalDecision('accept')} color="green">
                  同意入库 ✓
                </PrimaryBtn>
                <PrimaryBtn onClick={() => setFinalDecision('terminate')} color="red">
                  终止采购 ✗
                </PrimaryBtn>
              </div>
            </SectionCard>
          )}

          {isManager && finalDecision === 'accept' && (
            <SectionCard title="确认入库" icon={<CheckCircle size={18} />} color="green">
              <div className="space-y-3">
                <p className="text-sm text-slate-600">确认将异常处理后的货物接受入库，流程将标记为已完成。</p>
                <div className="flex gap-3">
                  <PrimaryBtn onClick={handleFinalDecision} disabled={finalSubmitting} color="green">
                    {finalSubmitting ? '处理中…' : '确认入库'}
                  </PrimaryBtn>
                  <button onClick={() => setFinalDecision(null)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-5 py-3 rounded-xl text-sm">
                    返回
                  </button>
                </div>
              </div>
            </SectionCard>
          )}

          {isManager && finalDecision === 'terminate' && (
            <SectionCard title="确认终止采购" icon={<XCircle size={18} />} color="slate">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle size={15} /> 终止后产品进入已拒绝状态，操作不可撤销
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">终止原因 <span className="text-red-500">*</span></label>
                  <textarea
                    rows={2}
                    placeholder="说明终止原因…"
                    value={terminateNote}
                    onChange={e => setTerminateNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <PrimaryBtn onClick={handleFinalDecision} disabled={finalSubmitting || !terminateNote.trim()} color="red">
                    {finalSubmitting ? '处理中…' : '确认终止'}
                  </PrimaryBtn>
                  <button onClick={() => setFinalDecision(null)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-5 py-3 rounded-xl text-sm">
                    返回
                  </button>
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 8: 已验货 (goods_inspected) — 正常验货路径入库确认
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'goods_inspected' && (
        <SectionCard title="已验货，确认入库" icon={<ClipboardCheck size={18} />} color="purple">
          <div className="space-y-3">
            {product.goodsInspectionNote && (
              <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 text-sm text-slate-700">
                <div className="text-xs text-slate-400 mb-1">验货备注</div>
                {product.goodsInspectionNote}
              </div>
            )}
            <InfoRow label="验货时间">{fmt(product.goodsInspectedAt)}</InfoRow>
            {isEmployee && (
              <>
                <p className="text-sm text-slate-600 pt-2">验货通过，请确认货物已入库。</p>
                <PrimaryBtn onClick={() => doAction('complete')} color="purple">
                  确认入库完成 ✓
                </PrimaryBtn>
              </>
            )}
            {isManager && <p className="text-slate-400 text-sm">等待员工确认入库…</p>}
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          阶段 9: 已完成 (completed) — 流程结束
      ══════════════════════════════════════════════════════════════════════ */}
      {status === 'completed' && (
        <SectionCard title="流程已完成" icon={<AlertCircle size={18} />} color="green">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle size={32} />
              <div>
                <div className="font-bold text-lg">🎉 产品已成功入库！</div>
                <div className="text-sm text-green-600/80">完成时间：{fmt(product.completedAt)}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 space-y-2 text-sm">
              <InfoRow label="采购数量">{product.purchaseQuantity ? `${product.purchaseQuantity} 件` : '—'}</InfoRow>
              <InfoRow label="下单时间">{fmt(product.orderedAt)}</InfoRow>
              <InfoRow label="到货时间">{fmt(product.goodsArrivedAt)}</InfoRow>
              <InfoRow label="验货时间">{fmt(product.goodsInspectedAt)}</InfoRow>
            </div>
          </div>
        </SectionCard>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          历史记录（折叠式，所有状态均可见）
      ══════════════════════════════════════════════════════════════════════ */}
      {product.historyLog && (product.historyLog as any[]).length > 0 && (
        <details className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <summary className="text-sm font-semibold text-slate-600 cursor-pointer select-none">
            操作历史（{(product.historyLog as any[]).length} 条）
          </summary>
          <ol className="mt-4 space-y-2">
            {(product.historyLog as any[]).slice().reverse().map((h: any, i: number) => (
              <li key={i} className="flex items-start gap-3 text-xs text-slate-500">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                <div>
                  <span className="font-medium text-slate-700">{h.actor}</span>
                  {' · '}{h.action}
                  {h.fromStatus && h.toStatus && (
                    <span className="text-slate-400"> ({h.fromStatus} → {h.toStatus})</span>
                  )}
                  <div className="text-slate-400">{fmt(h.timestamp)}</div>
                  {h.note && <div className="text-slate-500 italic">"{h.note}"</div>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

export default SamplingDetailInner;
