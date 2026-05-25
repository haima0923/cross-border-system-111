import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { useAppStore } from '@/context/StoreContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { getDecisionSummary, getCompetitivenessGrade } from '@/lib/decisionUtils';
import {
  ArrowLeft, Sparkles, DollarSign, PackageOpen, TrendingUp, AlertTriangle,
  Send, RefreshCw, Undo2, Star, BarChart2, Lightbulb, CheckCircle, XCircle, AlertCircle, ImageIcon,
  ShieldAlert, TrendingDown, HelpCircle
} from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';
import { HistoryLog, type HistoryLogEntry } from '@/components/shared/HistoryLog';
import { TaskContextPanel } from '@/components/shared/TaskContext';
import { format } from 'date-fns';

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateDecisionData(product: ReturnType<typeof useAppStore>['products'][number]) {
  const margin = product.grossMargin ?? 0;
  const score = product.aiCompetitiveness ?? 0;
  const risk = product.aiRiskLevel ?? '中';

  // One-sentence product description
  const description = product.usage && product.material
    ? `${product.material}材质，用于${product.usage}，来自${product.productSource ?? '供应商'}。`
    : product.usage
    ? `主要用途：${product.usage}。`
    : `${product.productName}，来源：${product.productSource ?? '未知'}。`;

  // Core selling points (up to 3)
  const sellingPoints: string[] = [];
  if (margin > 0.35) sellingPoints.push(`毛利率高达 ${(margin * 100).toFixed(1)}%，利润空间充足`);
  else if (margin > 0.2) sellingPoints.push(`毛利率 ${(margin * 100).toFixed(1)}%，处于行业合理区间`);
  if (product.weight && product.weight < 0.5) sellingPoints.push('重量轻、体积小，空运成本极低');
  if (product.moq && product.moq <= 100) sellingPoints.push(`起订量仅 ${product.moq} 件，适合小批量测款`);
  if (risk === '低') sellingPoints.push('AI风险评估为低，合规风险可控');
  if (score >= 8) sellingPoints.push(`竞争力评分 ${score}/10，市场表现优秀`);
  if (product.material?.includes('食品')) sellingPoints.push('采用食品级材质，符合主流市场安全标准');
  if (sellingPoints.length === 0) sellingPoints.push('供应商已取得联系，可快速推进采购流程');
  const topPoints = sellingPoints.slice(0, 3);

  // Market analysis
  const marketAnalysis = `根据当前市场数据，${product.categoryGuess ?? '该类目'}在主流跨境平台（Amazon/eBay/Shopify）需求稳定。` +
    `竞争力评分 ${score}/10，` +
    (risk === '低' ? '专利与合规风险低，适合直接切入。' : risk === '中' ? '存在一定竞争压力，建议做好差异化定价。' : '市场竞争激烈或合规成本较高，需谨慎评估。') +
    ` 供应商 ${product.supplierName ?? ''} MOQ 为 ${product.moq ?? '待确认'} 件，` +
    (margin > 0.3 ? '利润空间较好，建议优先测款。' : '利润偏薄，可考虑压低采购价或抬高售价后再决策。');

  // Conclusion
  let conclusionLabel: string;
  let conclusionColor: string;
  let conclusionIcon: React.ReactNode;
  let conclusionBg: string;

  if (score >= 7 && margin > 0.25 && risk !== '高') {
    conclusionLabel = '建议测试采购';
    conclusionColor = 'text-emerald-700';
    conclusionBg = 'bg-emerald-50 border-emerald-200';
    conclusionIcon = <CheckCircle size={22} className="text-emerald-600" />;
  } else if (risk === '高' || margin < 0.1) {
    conclusionLabel = '暂不建议采购';
    conclusionColor = 'text-red-700';
    conclusionBg = 'bg-red-50 border-red-200';
    conclusionIcon = <XCircle size={22} className="text-red-600" />;
  } else {
    conclusionLabel = '谨慎考虑，建议补充信息';
    conclusionColor = 'text-amber-700';
    conclusionBg = 'bg-amber-50 border-amber-200';
    conclusionIcon = <AlertCircle size={22} className="text-amber-600" />;
  }

  return { description, topPoints, marketAnalysis, conclusionLabel, conclusionColor, conclusionIcon, conclusionBg };
}

// ── Decision Card ─────────────────────────────────────────────────────────────

function DecisionCard({ product }: { product: ReturnType<typeof useAppStore>['products'][number] }) {
  const { description, topPoints, marketAnalysis, conclusionLabel, conclusionColor, conclusionIcon, conclusionBg } =
    generateDecisionData(product);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden mb-8">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-3 flex items-center gap-2">
        <Lightbulb size={16} className="text-yellow-400" />
        <span className="text-white text-sm font-semibold tracking-wide">决策摘要卡片</span>
        <span className="ml-auto text-slate-400 text-xs">AI 辅助生成 · 仅供参考</span>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Left: product image */}
        <div className="lg:w-56 shrink-0 bg-slate-100 flex items-center justify-center min-h-48 border-r border-slate-100">
          <ProductImage
            hostedImageUrl={product.hostedImageUrl}
            imageUrl={product.imageUrl}
            alt={product.productName}
            className="w-full h-full min-h-48"
            size="xl"
          />
        </div>

        {/* Right: content */}
        <div className="flex-1 p-6 flex flex-col gap-5">
          {/* Product name + description */}
          <div>
            <div className="flex items-start gap-3 mb-1">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{product.productName}</h2>
              <StatusBadge status={product.status} />
            </div>
            <p className="text-sm text-slate-500">{description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Selling points */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Star size={14} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">核心卖点</span>
              </div>
              <ul className="space-y-2">
                {topPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Market analysis */}
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <BarChart2 size={14} className="text-blue-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">市场分析</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{marketAnalysis}</p>
            </div>
          </div>

          {/* Conclusion bar */}
          <div className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 ${conclusionBg}`}>
            {conclusionIcon}
            <div>
              <span className="text-xs text-slate-500 font-medium">AI 一句话结论</span>
              <p className={`font-bold text-base ${conclusionColor}`}>{conclusionLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-4 text-center">
              <div>
                <div className="text-xs text-slate-400 mb-0.5">竞争力</div>
                <div className="font-black text-lg text-slate-800">{product.aiCompetitiveness ?? '—'}<span className="text-xs font-medium text-slate-400">/10</span></div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <div className="text-xs text-slate-400 mb-0.5">毛利率</div>
                <div className={`font-black text-lg ${(product.grossMargin ?? 0) > 0.3 ? 'text-emerald-600' : (product.grossMargin ?? 0) > 0.15 ? 'text-amber-600' : 'text-red-600'}`}>
                  {product.grossMargin != null ? `${(product.grossMargin * 100).toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <div className="text-xs text-slate-400 mb-0.5">风险</div>
                <div className={`font-black text-lg ${product.aiRiskLevel === '低' ? 'text-emerald-600' : product.aiRiskLevel === '中' ? 'text-amber-600' : 'text-red-600'}`}>
                  {product.aiRiskLevel ?? '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalysisResult() {
  const params = useParams();
  const id = params.id as string;
  const { products, updateProduct, currentUser, role, loading, sampleOptions, sampleSkuLines } = useAppStore();
  const [, setLocation] = useLocation();
  const [note, setNote] = useState('');
  const [highRiskNote, setHighRiskNote] = useState('');
  const [confirmStage, setConfirmStage] = useState<'idle' | 'confirming'>('idle');
  const [managerComment, setManagerComment] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisRetrying, setAnalysisRetrying] = useState(false);

  const product = products.find(p => p.id === id);

  // Stable AI-analysis trigger — useEffect ensures the timer fires exactly once
  // per pending_analysis entry (React hook, must be called before any early returns)
  useEffect(() => {
    if (!product || product.status !== 'pending_analysis') return;
    setAnalysisError(null);
    const timer = setTimeout(() => {
      updateProduct(id, { status: 'analyzed_pending_review' }, '系统完成AI分析')
        .catch((err: unknown) => {
          const raw = err instanceof Error ? err.message : String(err);
          const isNetwork = raw.includes('网络') || raw.includes('fetch') || raw.includes('Failed');
          const msg = isNetwork
            ? '提交分析失败：网络异常或请求被浏览器插件拦截。请尝试无痕模式或关闭插件后刷新重试。'
            : `提交分析失败：${raw}`;
          setAnalysisError(msg);
          console.error('[AnalysisResult] run-analysis failed:', err);
        });
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.status, id, analysisRetrying]);
  
  // 初始化note和highRiskNote（当产品是returned状态时，保留之前填写的值）
  useEffect(() => {
    if (product) {
      if (product.employeeNote) {
        const parts = product.employeeNote.split("\n\n【高风险说明】");
        setNote(parts[0] || '');
        setHighRiskNote(parts[1] || '');
      }
    }
  }, [product?.id, product?.employeeNote]);

  if (!product) {
    return (
      <div className="p-8 text-center text-slate-500">
        {loading ? '加载中…' : '产品未找到'}
      </div>
    );
  }

  // Cost calculations
  const L = product.length || 0;
  const W = product.width || 0;
  const H = product.height || 0;
  const weight = product.weight || 0;
  const purchasePrice = product.purchasePrice || 0;
  // Use employee-supplied price first, fall back to AI recommended price
  const effectivePrice = product.suggestedPrice || product.aiRecommendedPrice || 0;

  const volumetric = (L * W * H) / 6000;
  const chargeableWeight = Math.max(weight, volumetric);
  const volumeCBM = (L * W * H) / 1000000;

  // Read logisticsMode from product (backend-stored)
  const logisticsMode = (product as any).logisticsMode as string | undefined;
  const isSea = logisticsMode === 'sea';

  // Priority: use backend-stored freight values; compute locally only as fallback
  const airFreight = product.airFreight != null ? product.airFreight : chargeableWeight * 35;
  const seaFreight = product.seaFreight != null ? product.seaFreight : volumeCBM * 800;
  const displayFreight = isSea ? seaFreight : airFreight;

  // Use backend-stored totalCost/totalTax if available (avoids re-implementing calcCosts)
  const totalTax = product.totalTax != null
    ? product.totalTax
    : (purchasePrice + displayFreight) * 0.15 + (purchasePrice + displayFreight + (purchasePrice + displayFreight) * 0.15) * 0.18;
  const totalCostRMB = product.totalCost != null
    ? product.totalCost
    : purchasePrice + displayFreight + totalTax;
  const exchangeRate = 7.2;
  const effectivePriceRMB = effectivePrice * exchangeRate;
  const grossProfitRMB = effectivePriceRMB - totalCostRMB;
  const grossMargin = effectivePriceRMB > 0 ? (grossProfitRMB / effectivePriceRMB) * 100 : 0;
  const priceSourceIsAI = !product.suggestedPrice && !!product.aiRecommendedPrice;

  const handleSubmitScreening = () => {
    if (!note) return alert('请填写推荐说明');
    const combinedNote = highRiskNote
      ? `${note}\n\n【高风险说明】${highRiskNote}`
      : note;
    updateProduct(id, {
      status: 'screening_submitted',
      employeeNote: combinedNote,
      screeningSubmittedBy: currentUser.name,
      screeningSubmittedAt: new Date().toISOString()
    }, '提交管理层初筛', combinedNote);
    setLocation('/workbench');
  };

  const handleReturn = () => {
    updateProduct(id, { status: 'returned' }, '退回补充', '员工觉得AI测算不理想或需要更多信息');
    setLocation('/workbench');
  };

  // 保存草稿（不改变状态）
  const handleSaveDraft = async () => {
    const combinedNote = note
      ? (highRiskNote ? note + '\n\n【高风险说明】' + highRiskNote : note)
      : (highRiskNote ? '【高风险说明】' + highRiskNote : product.employeeNote || '');
    await updateProduct(id, { employeeNote: combinedNote, status: 'save_draft' } as any, '保存草稿', '员工保存修改信息');
    alert('草稿已保存');
  };

  const handleResubmitAnalysis = async () => {
    const combinedNote = note
      ? (highRiskNote ? note + '\n\n【高风险说明】' + highRiskNote : note)
      : (highRiskNote ? '【高风险说明】' + highRiskNote : product.employeeNote || '');
    // 先保存当前编辑的信息作为草稿，再重新提交分析
    await updateProduct(id, { employeeNote: combinedNote, status: 'pending_analysis' } as any, '重新提交分析', '员工补充信息后重新提交分析');
    setLocation('/workbench');
  };

  // 重新提交初筛（用于completed/rejected状态）
  const handleResubmitToScreening = async () => {
    const combinedNote = note
      ? (highRiskNote ? note + '\n\n【高风险说明】' + highRiskNote : note)
      : (highRiskNote ? '【高风险说明】' + highRiskNote : product.employeeNote || '');
    await updateProduct(id, { employeeNote: combinedNote, status: 'screening_submitted', resubmitted: true } as any, '重新提交初筛', '员工重新提交初筛');
    alert('已重新提交初筛，等待经理审批');
    setLocation('/workbench');
  };

  const handleManagerApprove = () => {
    updateProduct(id, { status: 'pending_sampling', managerComment } as any, '管理层通过初筛', managerComment);
    setLocation('/manager-pool');
  };

  const handleManagerReturn = () => {
    if (!managerComment.trim()) {
      alert('请填写退回补充原因');
      return;
    }
    updateProduct(id, { status: 'returned', managerComment } as any, '管理层退回', managerComment);
    setLocation('/manager-pool');
  };

  const handleManagerReject = () => {
    if (!managerComment.trim()) {
      alert('请填写拒绝原因');
      return;
    }
    updateProduct(id, { status: 'rejected', managerComment } as any, '管理层拒绝', managerComment);
    setLocation('/manager-pool');
  };

  // Pending analysis — useEffect above fires the API call; show loading or error here
  if (product.status === 'pending_analysis') {
    if (analysisError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 space-y-5 px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={26} className="text-red-400" />
          </div>
          <div>
            <p className="text-slate-800 font-semibold mb-1">分析提交失败</p>
            <p className="text-sm text-slate-500 max-w-md">{analysisError}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setAnalysisError(null);
                setAnalysisRetrying(r => !r);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={15} /> 重试
            </button>
            <button
              onClick={() => setLocation('/workbench')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              返回工作台
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-600 font-medium">AI 正在深度分析市场数据并进行成本测算...</p>
        <p className="text-xs text-slate-400">正在提交 · 约需几秒</p>
      </div>
    );
  }

  const isEmployee = role === 'product_specialist';
  const isManager = role === 'product_manager';
  const needsEmployeeReview = product.status === 'analyzed_pending_review' || product.status === 'returned';
  const analysisStatuses = ['analyzed_pending_review', 'screening_submitted', 'manager_reviewing', 'pending_purchase', 'purchased', 'rejected', 'rejected_unconfirmed', 'returned'];
  const hasAnalysis = analysisStatuses.includes(product.status) || !!(product.aiCompetitiveness || product.aiRiskLevel || product.aiReport);

  // ── AI-driven behavior state ───────────────────────────────────────────────
  const aiDecision = getDecisionSummary(product);
  const competitivenessGrade = getCompetitivenessGrade(product.aiCompetitiveness);
  const isHighRisk = product.aiRiskLevel === '高';
  const isDGrade = competitivenessGrade === 'D';
  const isNotRecommended = aiDecision.verdict === 'reject';
  // Submit is blocked when high-risk note is missing (if risk is high)
  const canSubmit = note.trim().length > 0 && (!isHighRisk || highRiskNote.trim().length > 0);

  // SKU data for read-only display in this page
  const myOption = sampleOptions.find(o => o.productId === id);
  const mySkus = myOption ? sampleSkuLines.filter(s => s.sampleOptionId === myOption.id) : [];

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Back button */}
      <button
        onClick={() => setLocation(isEmployee ? '/workbench' : '/manager-pool')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> 返回列表
      </button>

      {/* Rejection banner — shown before employee confirms the rejection */}
      {isEmployee && product.status === 'rejected_unconfirmed' && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-300 rounded-2xl px-5 py-4">
          <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">该产品已被管理层拒绝，请先查看提交信息和拒绝原因</p>
            {product.managerComment && (
              <p className="text-sm text-red-700 mt-1">
                <span className="font-medium">拒绝原因：</span>{product.managerComment}
              </p>
            )}
            {product.managerReviewedBy && (
              <p className="text-xs text-red-500 mt-1">
                审核人：{product.managerReviewedBy}
                {product.managerReviewedAt && ` · ${format(new Date(product.managerReviewedAt), 'yyyy-MM-dd HH:mm')}`}
              </p>
            )}
            <p className="text-xs text-red-500 mt-2">
              看完本页的AI结论、员工推荐说明和管理层批注后，可返回工作台点击“确认知晓”归档。
            </p>
          </div>
        </div>
      )}

      {/* Return banner — shown to employee when product was returned by manager */}
      {isEmployee && product.status === 'returned' && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">该产品已被退回补充，请修改信息后重新提交分析</p>
            {product.managerComment && (
              <p className="text-sm text-amber-700 mt-1">
                <span className="font-medium">管理层意见：</span>{product.managerComment}
              </p>
            )}
            {product.managerReviewedBy && (
              <p className="text-xs text-amber-500 mt-1">
                退回人：{product.managerReviewedBy}
                {product.managerReviewedAt && ` · ${format(new Date(product.managerReviewedAt), 'yyyy-MM-dd HH:mm')}`}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <TaskContextPanel taskId={(product as any).taskId} />
      </div>

      {/* ── Decision Card (top, always shown when analysis exists) ── */}
      {hasAnalysis && <DecisionCard product={product} />}

      {/* ── Original header (keep for context) ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <p className="text-slate-500 flex items-center gap-2 text-sm">
            <span>供应商: {product.supplierName}</span>
            <span>•</span>
            <span>来源: {product.productSource}</span>
            <span>•</span>
            <a href={product.link1688} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              查看采购链接
            </a>
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 text-right">
          {product.suggestedPrice ? (
            <>
              <div className="text-xs text-slate-500 font-medium mb-1">员工建议售价</div>
              <div className="text-2xl font-bold text-slate-900">${product.suggestedPrice.toFixed(2)}</div>
            </>
          ) : product.aiRecommendedPrice ? (
            <>
              <div className="text-xs text-indigo-500 font-medium mb-1 flex items-center justify-end gap-1">
                <Sparkles size={11} /> AI 推荐售价
              </div>
              <div className="text-2xl font-bold text-indigo-700">${product.aiRecommendedPrice.toFixed(2)}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                区间 ${product.aiSuggestedPriceMin?.toFixed(2)} – ${product.aiSuggestedPriceMax?.toFixed(2)}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500 font-medium mb-1">建议售价</div>
              <div className="text-xl font-medium text-slate-400">待AI测算</div>
            </>
          )}
        </div>
      </div>

      {/* ── Below: Cost model + AI report + employee note + logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left column: cost + packaging */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><DollarSign size={20} /></div>
              <h2 className="text-lg font-bold text-slate-800">成本测算模型</h2>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">采购单价</span>
                <span className="font-semibold text-slate-800">¥{purchasePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  {isSea
                    ? `海运预估 (${volumeCBM.toFixed(4)}m³)`
                    : `空运预估 (${chargeableWeight.toFixed(2)}kg)`}
                </span>
                <span className="font-semibold text-slate-800">¥{displayFreight.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">关税+增值税 (约33%)</span>
                <span className="font-semibold text-slate-800">¥{totalTax.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="font-bold text-slate-700">总成本 (RMB)</span>
                <span className="text-xl font-bold text-red-600">¥{totalCostRMB.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600 font-medium">
                  预估毛利 (RMB)
                  {priceSourceIsAI && <span className="ml-1 text-xs text-indigo-500">·基于AI推荐价</span>}
                </span>
                <span className={`font-bold ${effectivePrice > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {effectivePrice > 0 ? `¥${grossProfitRMB.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">预估毛利率</span>
                <span className={`font-bold ${effectivePrice === 0 ? 'text-slate-400' : grossMargin > 30 ? 'text-emerald-600' : 'text-orange-500'}`}>
                  {effectivePrice > 0 ? `${grossMargin.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><PackageOpen size={20} /></div>
              <h2 className="text-lg font-bold text-slate-800">包装规格</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-500 mb-1">长宽高(cm)</div>
                <div className="font-semibold text-slate-800">{L} x {W} x {H}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">实重 / 体积重</div>
                <div className="font-semibold text-slate-800">{weight}kg / {volumetric.toFixed(2)}kg</div>
              </div>
              <div className="col-span-2">
                <div className="text-slate-500 mb-1">材质</div>
                <div className="font-semibold text-slate-800">{product.material}</div>
              </div>
            </div>
          </div>

          {/* SKU 规格（只读）— 管理层和员工均可见 */}
          {mySkus.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">SKU 规格清单</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-slate-500 font-medium pb-2 pr-2 w-10">图</th>
                      <th className="text-left text-slate-500 font-medium pb-2 pr-4">规格描述</th>
                      <th className="text-right text-slate-500 font-medium pb-2 pr-4">单价（¥）</th>
                      <th className="text-right text-slate-500 font-medium pb-2">MOQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySkus.map((sku) => (
                      <tr key={sku.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-2 pr-2">
                          <ProductImage hostedImageUrl={sku.hostedImageUrl} imageUrl={sku.imageUrl} size="sm" />
                        </td>
                        <td className="py-2 pr-4 text-slate-800 font-medium">{sku.skuName || '默认款'}</td>
                        <td className="py-2 pr-4 text-right text-slate-700">
                          {sku.unitPrice != null ? `¥${Number(sku.unitPrice).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 text-right text-slate-700">
                          {sku.moq != null ? sku.moq : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column: AI report + employee note + logs */}
        <div className="lg:col-span-2 space-y-6">
          {product.aiReport && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-sm border border-indigo-100 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 text-indigo-500/10">
                <Sparkles size={120} />
              </div>
              <div className="flex items-center gap-2 mb-6 relative z-10">
                <div className="bg-indigo-600 p-2 rounded-lg text-white"><Sparkles size={20} /></div>
                <h2 className="text-lg font-bold text-indigo-950">AI 智能选品报告</h2>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-600/70 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp size={14} /> 竞争力评分
                  </div>
                  <div className="text-2xl font-black text-indigo-900">
                    {product.aiCompetitiveness}<span className="text-sm font-medium text-indigo-600/50">/10</span>
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-600/70 mb-1 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={14} /> 风险等级
                  </div>
                  <div className="text-xl font-bold text-indigo-900">{product.aiRiskLevel}</div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-600/70 mb-1 uppercase tracking-wider">系统建议</div>
                  <div className="text-xl font-bold text-indigo-900">{product.aiRecommended ? '强力推荐' : '谨慎考虑'}</div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-md rounded-xl p-5 border border-indigo-100 relative z-10 text-sm text-indigo-950 leading-relaxed shadow-sm">
                {product.aiReport}
              </div>
            </div>
          )}

          {/* ── AI 定价建议 card ── */}
          {(product.aiRecommendedPrice || product.aiSuggestedPriceMin) && (
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl shadow-sm border border-violet-100 p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="bg-violet-600 p-2 rounded-lg text-white"><Lightbulb size={18} /></div>
                <div>
                  <h2 className="text-base font-bold text-violet-950">AI 定价建议</h2>
                  <p className="text-xs text-violet-500 mt-0.5">基于成本结构与目标毛利区间自动推算</p>
                </div>
              </div>

              {/* Price range bar */}
              <div className="mb-5">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-600">建议售价区间</span>
                  <span className="text-xs text-slate-400">目标毛利 45%–65%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-500 w-14 shrink-0">
                    ${product.aiSuggestedPriceMin?.toFixed(2)}
                  </span>
                  <div className="flex-1 h-3 bg-violet-100 rounded-full relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-violet-300 via-violet-500 to-indigo-500 rounded-full" />
                    {/* Recommended price marker */}
                    {product.aiSuggestedPriceMin && product.aiSuggestedPriceMax && product.aiRecommendedPrice && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-violet-600 rounded-full shadow-md"
                        style={{
                          left: `calc(${((product.aiRecommendedPrice - product.aiSuggestedPriceMin) / (product.aiSuggestedPriceMax - product.aiSuggestedPriceMin)) * 100}% - 8px)`
                        }}
                      />
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-500 w-14 shrink-0 text-right">
                    ${product.aiSuggestedPriceMax?.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Three metric cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-violet-100 text-center">
                  <div className="text-xs text-slate-500 mb-1">最低定价</div>
                  <div className="text-lg font-bold text-slate-700">${product.aiSuggestedPriceMin?.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">毛利 ~45%</div>
                </div>
                <div className="bg-violet-600 rounded-xl p-3 text-center shadow-md">
                  <div className="text-xs text-violet-200 mb-1">推荐售价</div>
                  <div className="text-lg font-bold text-white">${product.aiRecommendedPrice?.toFixed(2)}</div>
                  <div className="text-xs text-violet-300 mt-0.5">毛利 ~{product.aiRecommendedMargin?.toFixed(0)}%</div>
                </div>
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-violet-100 text-center">
                  <div className="text-xs text-slate-500 mb-1">最高定价</div>
                  <div className="text-lg font-bold text-slate-700">${product.aiSuggestedPriceMax?.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-0.5">毛利 ~65%</div>
                </div>
              </div>

              {product.suggestedPrice && (
                <div className="mt-4 flex items-center gap-2 text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  <Star size={12} />
                  员工已填写建议售价 ${product.suggestedPrice.toFixed(2)}，成本测算以员工价为准，AI 定价仅供参考。
                </div>
              )}
            </div>
          )}

          {/* Employee review form — AI-governed */}
          {isEmployee && needsEmployeeReview && (
            <div className="rounded-2xl shadow-lg border border-primary/20 overflow-hidden animate-in slide-in-from-bottom-4">

              {/* ── Rule 2: D-grade competitiveness warning ─────────────────── */}
              {isDGrade && (
                <div className="flex items-start gap-3 px-5 py-4 bg-orange-50 border-b border-orange-200">
                  <TrendingDown size={18} className="text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">该产品不建议推进</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      竞争力评分处于 D 级（{product.aiCompetitiveness ?? 0}/10），市场表现偏弱，推荐退回补充或放弃该候选。
                    </p>
                  </div>
                </div>
              )}

              {/* ── Rule 3: "Not recommended" verdict warning ────────────────── */}
              {isNotRecommended && !isDGrade && (
                <div className="flex items-start gap-3 px-5 py-4 bg-red-50 border-b border-red-200">
                  <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">AI综合判断：暂不建议采购</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      如坚持提交，将需要二次确认，并由管理层重点审查。
                    </p>
                  </div>
                </div>
              )}

              {/* ── Rule 1: High risk warning banner ────────────────────────── */}
              {isHighRisk && (
                <div className="flex items-start gap-3 px-5 py-4 bg-red-50 border-b border-red-200">
                  <ShieldAlert size={18} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">⚠ 高风险产品 — 提交前需额外说明</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      AI 将该产品风险等级评为「高」。如需推进，请在下方填写风险应对说明（必填）。
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-1">撰写推荐说明</h2>
                  <p className="text-sm text-slate-500">根据测算结果，请填写您向管理层推荐此产品的理由（必填）。</p>
                </div>

                <textarea
                  value={note}
                  onChange={e => { setNote(e.target.value); setConfirmStage('idle'); }}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none text-sm"
                  placeholder="例如：虽然利润率一般，但引流极佳，工厂可以配合贴牌..."
                />

                {/* ── Rule 1 extra field: high-risk justification ──────────── */}
                {isHighRisk && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                      <ShieldAlert size={14} /> 高风险应对说明
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <textarea
                      value={highRiskNote}
                      onChange={e => setHighRiskNote(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 resize-none text-sm bg-red-50/30"
                      placeholder="请说明您如何应对该风险，例如：已向律师确认专利情况，准备选品测试量不超过200件..."
                    />
                    {isHighRisk && !highRiskNote.trim() && note.trim() && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} /> 高风险产品必须填写此项才能提交
                      </p>
                    )}
                  </div>
                )}

                {/* ── Rule 3 double-confirm stage ─────────────────────────── */}
                {confirmStage === 'confirming' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
                      <HelpCircle size={16} className="shrink-0" />
                      AI 建议不采购此产品，确认仍要提交初筛？
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setConfirmStage('idle')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSubmitScreening}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                      >
                        确认提交
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {/* For returned status: show save draft and resubmit analysis buttons */}
                  {product.status === 'returned' ? (
                    <>
                      <button
                        onClick={handleSaveDraft}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-3 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"
                      >
                        保存草稿
                      </button>
                      <button
                        onClick={handleResubmitAnalysis}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                      >
                        <Sparkles size={16} />
                        重新提交分析
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Submit button — handles all three rule conditions */}
                      <button
                        disabled={!canSubmit}
                        onClick={() => {
                          if (isNotRecommended && confirmStage === 'idle') {
                            setConfirmStage('confirming');
                          } else {
                            handleSubmitScreening();
                          }
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                          isNotRecommended
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
                            : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                        }`}
                      >
                        <Send size={18} />
                        {isNotRecommended ? '我了解风险，仍要提交初筛' : '提交管理层初筛'}
                      </button>
                      <button
                        onClick={handleReturn}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl hover:bg-slate-50 transition-colors font-medium text-sm"
                      >
                        <Undo2 size={16} />
                        退回补充
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Returned: employee re-submit action panel ── */}
          {isEmployee && product.status === 'returned' && (
            <div className="rounded-2xl shadow-lg border border-amber-300 overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="bg-amber-50 px-5 py-4 border-b border-amber-200">
                <p className="text-sm font-semibold text-amber-800">请修改产品信息后重新提交分析</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  可直接重新提交，AI 将重新分析当前信息；也可先修改信息再提交。
                </p>
              </div>
              <div className="bg-white p-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setLocation(`/entry?id=${product.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw size={16} /> 修改信息
                </button>
                <button
                  onClick={handleResubmitAnalysis}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                >
                  <Sparkles size={16} /> 重新提交分析
                </button>
              </div>
            </div>
          )}


          {/* ── Completed/Rejected: employee re-submit to screening panel ── */}
          {isEmployee && (product.status === 'completed' || product.status === 'rejected') && (
            <div className="rounded-2xl shadow-lg border border-blue-300 overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="bg-blue-50 px-5 py-4 border-b border-blue-200">
                <p className="text-sm font-semibold text-blue-800">重新提交初筛</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  该产品已结束，可以修改信息后重新提交初筛流程。
                </p>
              </div>
              <div className="bg-white p-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setLocation('/entry?id=' + product.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors">
                  <RefreshCw size={16} />
                  修改信息
                </button>
                <button
                  onClick={handleResubmitToScreening}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
                  <Send size={16} />
                  重新提交初筛
                </button>
              </div>
            </div>
          )} 
          {/* Employee note (already submitted) */}
          {product.employeeNote && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">员工推荐说明</h2>
              <div className="bg-slate-50 p-4 rounded-xl text-slate-700 text-sm leading-relaxed border border-slate-100">
                "{product.employeeNote}"
              </div>
              {product.screeningSubmittedBy && (
                <div className="mt-3 text-xs text-slate-400">
                  提交人：{product.screeningSubmittedBy}
                  {product.screeningSubmittedAt && ` · ${format(new Date(product.screeningSubmittedAt), 'yyyy-MM-dd HH:mm')}`}
                </div>
              )}
            </div>
          )}

          {/* Manager action panel (inline approval — manager viewing screening_submitted product) */}
          {isManager && product.status === 'screening_submitted' && (
            <div className="bg-white rounded-2xl shadow-lg border border-violet-200 overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4">
                <h2 className="text-base font-bold text-white">管理层初筛审批</h2>
                <p className="text-violet-200 text-xs mt-0.5">请根据员工推荐说明及AI分析结果做出决策</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    审批意见 <span className="text-slate-400 font-normal text-xs">（退回/拒绝时必填）</span>
                  </label>
                  <textarea
                    value={managerComment}
                    onChange={e => setManagerComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 resize-none text-sm"
                    placeholder="例如：利润率偏低，建议重新与供应商谈价后再提交…"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleManagerApprove}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle size={16} /> 通过初筛
                  </button>
                  <button
                    onClick={handleManagerReturn}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors shadow-md shadow-amber-500/20"
                  >
                    <Undo2 size={16} /> 退回补充
                  </button>
                  <button
                    onClick={handleManagerReject}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors shadow-md shadow-red-600/20"
                  >
                    <XCircle size={16} /> 拒绝
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manager comment */}
          {product.managerComment && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">管理层批注</h2>
              <div className="bg-slate-50 p-4 rounded-xl text-slate-700 text-sm leading-relaxed border border-slate-100">
                "{product.managerComment}"
              </div>
              {product.managerReviewedBy && (
                <div className="mt-3 text-xs text-slate-400">
                  审核人：{product.managerReviewedBy}
                  {product.managerReviewedAt && ` · ${format(new Date(product.managerReviewedAt), 'yyyy-MM-dd HH:mm')}`}
                </div>
              )}
            </div>
          )}

          {/* 操作日志 */}
          {product.historyLog && (product.historyLog as any[]).length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <HistoryLog log={(product.historyLog as any[]) as HistoryLogEntry[]} title="操作日志" maxItems={20} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
