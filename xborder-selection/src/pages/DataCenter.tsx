import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart2, TrendingUp, BookOpen,
  Package, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Info, RefreshCw, ChevronDown, ChevronUp,
  ArrowRight,
} from 'lucide-react';

// ─── Status label map ─────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft:                    '候选录入',
  pending_info:             '待补充信息',
  pending_analysis:         '待分析',
  analyzed_pending_review:  '已分析待复核',
  screening_submitted:      '初筛已提交',
  manager_reviewing:        '管理审核中',
  returned:                 '已退回',
  pending_sampling:         '待打样',
  sampling:                 '打样中',
  sample_arrived:           '样品已到',
  sample_reviewing:         '验样中',
  sample_reviewed:          '已验样',
  pending_purchase:         '待下单',
  ordered:                  '已下单',
  goods_arrived:            '已到货',
  inspecting:               '验货中',
  goods_inspected:          '验货通过',
  exception_reported:       '有异常待处理',
  completed:                '已完成',
  terminated:               '已终止',
  rejected:                 '已拒绝',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', pending_info: '#fb923c', pending_analysis: '#60a5fa',
  analyzed_pending_review: '#a78bfa', screening_submitted: '#818cf8',
  manager_reviewing: '#fbbf24', returned: '#f59e0b',
  pending_sampling: '#22d3ee', sampling: '#38bdf8', sample_arrived: '#2dd4bf',
  sample_reviewing: '#14b8a6', sample_reviewed: '#8b5cf6',
  pending_purchase: '#34d399', ordered: '#3b82f6',
  goods_arrived: '#6366f1', inspecting: '#0ea5e9',
  goods_inspected: '#7c3aed', exception_reported: '#ef4444',
  completed: '#22c55e', terminated: '#64748b', rejected: '#f87171',
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}
function statusColor(s: string) {
  return STATUS_COLOR[s] ?? '#94a3b8';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(a: number, b: number): string {
  if (!b) return '—';
  return (a / b * 100).toFixed(1) + '%';
}
function days(n: string | number | null): string {
  if (n == null) return '—';
  const v = Number(n);
  if (isNaN(v)) return '—';
  return v.toFixed(1) + ' 天';
}

// ─── Tooltip badge ────────────────────────────────────────────────────────────
function MetricTip({ text }: { text: string }) {
  return (
    <span className="relative group ml-1 cursor-default inline-flex items-center">
      <Info size={12} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
      <span className="
        pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
        w-52 rounded-lg bg-slate-800 text-white text-[11px] leading-relaxed px-3 py-2
        opacity-0 group-hover:opacity-100 transition-opacity shadow-xl
      ">
        {text}
      </span>
    </span>
  );
}

// ─── Loading / Error ──────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center h-40 gap-2 text-slate-400">
      <RefreshCw size={16} className="animate-spin" />
      <span className="text-sm">加载中…</span>
    </div>
  );
}
function ErrorState({ msg, retry }: { msg: string; retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3 text-red-500">
      <AlertTriangle size={20} />
      <p className="text-sm">{msg}</p>
      <button onClick={retry} className="text-xs text-primary underline">重试</button>
    </div>
  );
}

// ─── Overdue list expandable ──────────────────────────────────────────────────
function OverdueList({
  title, icon, color, items, dateKey, dateLabel,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: Record<string, string>[];
  dateKey: string;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border ${color} overflow-hidden`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-black/5 transition-colors"
      >
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto flex items-center gap-2 text-sm font-bold">
          {items.length} 件
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && items.length > 0 && (
        <div className="border-t divide-y divide-black/5">
          {items.map((row, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <span className="flex-1 font-medium truncate">{row.product_name}</span>
              <span className="shrink-0 text-slate-400">{statusLabel(row.status)}</span>
              <span className="shrink-0 text-slate-400">
                {dateLabel} {row[dateKey] ? new Date(row[dateKey]).toLocaleDateString('zh-CN') : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && items.length === 0 && (
        <div className="px-4 py-3 text-xs text-slate-400">暂无超时产品</div>
      )}
    </div>
  );
}

// ─── Custom Funnel ────────────────────────────────────────────────────────────
function Funnel({ data }: { data: { label: string; value: number; base?: number; tip?: string }[] }) {
  const max = data[0]?.value || 1;
  return (
    <div className="space-y-2">
      {data.map((step, i) => {
        const w = Math.max(10, (step.value / max) * 100);
        const rawRate = i > 0 && data[i - 1].value ? step.value / data[i - 1].value * 100 : null;
        const convRate = rawRate !== null ? rawRate.toFixed(1) : null;
        const isAnomalous = rawRate !== null && rawRate > 100;
        return (
          <div key={step.label} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs text-right text-slate-500">{step.label}</div>
            <div className="flex-1 relative h-8">
              <div
                className="h-full rounded-lg bg-primary/20 border border-primary/30 flex items-center px-3 transition-all duration-500"
                style={{ width: `${w}%` }}
              >
                <span className="text-xs font-bold text-primary">{step.value}</span>
              </div>
            </div>
            <div className="w-20 shrink-0 text-xs text-slate-400 flex items-center gap-0.5">
              {convRate !== null ? (
                <>
                  <ArrowRight size={10} className="shrink-0" />
                  <span className={isAnomalous ? "text-amber-500" : ""}>{isAnomalous ? "⚠ " : ""}{convRate}%</span>
                </>
              ) : null}
              {step.tip && <MetricTip text={step.tip} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ title, tip, children }: { title: string; tip?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <h3 className="font-bold text-sm text-slate-800">{title}</h3>
        {tip && <MetricTip text={tip} />}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
type OverviewData = {
  summary: {
    total: number; this_week: number; this_month: number;
    in_purchase: number; completed: number; exception_count: number;
  };
  stageDistribution: { status: string; count: number }[];
  funnel: {
    total_entry: number; submitted_analysis: number; entered_sampling: number;
    manager_decided: number; entered_purchase: number; completed: number;
  };
};

function OverviewTab() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    fetch('/api/stats/overview', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error || '数据加载失败'} retry={load} />;

  const { summary, stageDistribution, funnel } = data;

  const summaryCards = [
    { label: '产品总数', value: summary.total, icon: Package, color: 'text-slate-700', bg: 'bg-slate-50', tip: '系统中所有产品的数量，含各阶段。' },
    { label: '本周新增', value: summary.this_week, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', tip: '口径：最近7天内 created_at 的产品数。' },
    { label: '本月新增', value: summary.this_month, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', tip: '口径：最近30天内 created_at 的产品数。' },
    { label: '采购执行中', value: summary.in_purchase, icon: BarChart2, color: 'text-emerald-600', bg: 'bg-emerald-50', tip: '口径：状态为 待下单/已下单/已到货/验货中/验货通过/有异常待处理 的产品数。' },
    { label: '已完成', value: summary.completed, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', tip: '口径：status = completed 或 completed_at IS NOT NULL 的产品数。' },
    { label: '异常总数', value: summary.exception_count, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', tip: '口径：anomaly_reported_at IS NOT NULL 的产品数（含已处置的历史异常）。' },
  ];

  const chartData = stageDistribution
    .filter(r => r.count > 0)
    .map(r => ({ name: statusLabel(r.status), count: r.count, status: r.status }));

  const funnelSteps = [
    { label: '录入产品', value: funnel.total_entry, tip: '所有产品总数。' },
    { label: '提交分析', value: funnel.submitted_analysis, tip: '口径：analysis_submitted_at IS NOT NULL。' },
    { label: '进入样品', value: funnel.entered_sampling, tip: '口径：sampling_started_at IS NOT NULL。' },
    { label: '经理决策', value: funnel.manager_decided, tip: '口径：manager_reviewed_at IS NOT NULL（经理完成样品方案+SKU决策）。' },
    { label: '进入采购', value: funnel.entered_purchase, tip: 'MVP口径：status IN 全部采购阶段状态。因无独立 pending_purchase_at 时间戳，以 status 判断。' },
    { label: '已完成', value: funnel.completed, tip: '口径：status = completed 或 completed_at IS NOT NULL。完成率 = 已完成 / 进入采购。' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 lg:grid-cols-6">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`${card.bg} rounded-2xl border border-slate-200 p-4 flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <MetricTip text={card.tip} />
              </div>
              <div className={`text-3xl font-black ${card.color}`}>{card.value}</div>
              <Icon size={16} className={`${card.color} opacity-50`} />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Stage Distribution */}
        <Section title="阶段分布" tip="各状态的产品数量，按数量降序排列。">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">暂无数据</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={88} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(value: number) => [value + ' 件', '数量']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Funnel */}
        <Section
          title="流程漏斗"
          tip="展示各主要节点的产品数量及逐步转化率。转化率 = 当前步数量 / 上一步数量。"
        >
          <Funnel data={funnelSteps} />
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-500">
            <div>
              完成率
              <MetricTip text="MVP口径：已完成 / 进入采购数量。因无独立采购起点时间戳，进入采购以 status 判断。" />
              <span className="ml-1 font-bold text-green-600">
                {pct(funnel.completed, funnel.entered_purchase)}
              </span>
            </div>
            <div>
              异常率
              <MetricTip text="MVP口径：异常数量 / 进入采购数量。" />
              <span className="ml-1 font-bold text-red-500">
                {pct(summary.exception_count, funnel.entered_purchase)}
              </span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Process Tab ──────────────────────────────────────────────────────────────
type ProcessData = {
  bottlenecks: { status: string; count: number }[];
  timing: {
    avg_days_to_analysis: string | null;   n_to_analysis: number;
    avg_days_to_sampling: string | null;   n_to_sampling: number;
    avg_days_to_decision: string | null;   n_to_decision: number;
    avg_days_to_complete: string | null;   n_to_complete: number;
  };
  overdueAnalysis: Record<string, string>[];
  overdueDecision: Record<string, string>[];
  overduePurchase: Record<string, string>[];
};

function ProcessTab() {
  const [data, setData] = useState<ProcessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    fetch('/api/stats/process', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error || '数据加载失败'} retry={load} />;

  const { bottlenecks, timing, overdueAnalysis, overdueDecision, overduePurchase } = data;

  const chartData = bottlenecks
    .filter(r => r.count > 0)
    .map(r => ({ name: statusLabel(r.status), count: r.count, status: r.status }));

  const timingSegments = [
    {
      label: '创建 → 提交分析',
      avg: days(timing.avg_days_to_analysis),
      n: timing.n_to_analysis,
      tip: '口径：analysis_submitted_at − created_at，仅统计已提交分析的产品。',
      color: 'border-blue-200 bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: '提交分析 → 进入样品',
      avg: days(timing.avg_days_to_sampling),
      n: timing.n_to_sampling,
      tip: '口径：sampling_started_at − analysis_submitted_at。此段包含初筛审核等待时间，无法单独拆分。',
      color: 'border-indigo-200 bg-indigo-50',
      textColor: 'text-indigo-600',
    },
    {
      label: '进入样品 → 经理决策',
      avg: days(timing.avg_days_to_decision),
      n: timing.n_to_decision,
      tip: '口径：manager_reviewed_at − sampling_started_at。此段包含打样等待、样品到货、验样、经理审核全部时间。无法细分。',
      color: 'border-violet-200 bg-violet-50',
      textColor: 'text-violet-600',
    },
    {
      label: '下单 → 已完成',
      avg: days(timing.avg_days_to_complete),
      n: timing.n_to_complete,
      tip: '口径：completed_at − ordered_at，仅统计已完成采购且有 ordered_at 记录的产品。',
      color: 'border-emerald-200 bg-emerald-50',
      textColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Bottleneck */}
        <Section
          title="当前卡点分布"
          tip="展示各未完成阶段的产品堆积数量（已排除 completed / terminated / rejected）。数量越多说明该阶段越拥堵。"
        >
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">暂无在途产品</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={88} tick={{ fontSize: 11 }} />
                <RechartsTooltip
                  formatter={(v: number) => [v + ' 件', '卡住数量']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        {/* Timing */}
        <Section
          title="阶段平均耗时（MVP 版）"
          tip="基于现有时间字段计算。部分阶段无法精确区分子步骤，已在各指标旁标注口径说明。样本量 n 越小，均值参考价值越低。"
        >
          <div className="space-y-3">
            {timingSegments.map(seg => (
              <div key={seg.label} className={`rounded-xl border ${seg.color} px-4 py-3 flex items-center gap-3`}>
                <Clock size={14} className={seg.textColor} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-600 flex items-center gap-1">
                    {seg.label}
                    <MetricTip text={seg.tip} />
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">样本量 n = {seg.n}</div>
                </div>
                <div className={`text-lg font-black ${seg.textColor} shrink-0`}>
                  {seg.avg}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
            <p>⚠ 当前无法精确统计的阶段：</p>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>初筛审核等待时间（无独立时间戳，混入"提交分析→进入样品"）</li>
              <li>打样等待 vs 经理审核等待（无法区分，混入"进入样品→经理决策"）</li>
              <li>待下单等待时间（无 pending_purchase_at，无法统计经理决策到实际下单的周期）</li>
            </ul>
            <p className="pt-1">如需精确统计，建议在关键状态转移时补写对应时间戳字段。</p>
          </div>
        </Section>
      </div>

      {/* Timeout lists */}
      <Section title="超时预警" tip="仅做展示，不触发任何通知。产品在当前阶段超过阈值天数仍未推进。">
        <div className="space-y-3">
          <OverdueList
            title={`超过 3 天未提交分析（待分析阶段）`}
            icon={<Clock size={14} className="text-orange-500" />}
            color="border-orange-200 bg-orange-50 text-orange-800"
            items={overdueAnalysis}
            dateKey="created_at"
            dateLabel="录入："
          />
          <OverdueList
            title={`超过 7 天未完成经理决策（样品阶段）`}
            icon={<Clock size={14} className="text-violet-500" />}
            color="border-violet-200 bg-violet-50 text-violet-800"
            items={overdueDecision}
            dateKey="sampling_started_at"
            dateLabel="进入样品："
          />
          <OverdueList
            title={`超过 14 天采购未完成`}
            icon={<Clock size={14} className="text-red-500" />}
            color="border-red-200 bg-red-50 text-red-800"
            items={overduePurchase}
            dateKey="ordered_at"
            dateLabel="下单日："
          />
        </div>
      </Section>
    </div>
  );
}

// ─── Review Tab ───────────────────────────────────────────────────────────────
type ReviewData = {
  categories: {
    category: string; total: number; entered_purchase: number;
    completed: number; exceptions: number;
  }[];
  suppliers: {
    supplier_name: string; total_options: number; selected_count: number;
    purchase_count: number; completed_count: number; anomaly_count: number;
  }[];
  anomalySummary: {
    total_exceptions: number; accepted: number;
    reordered: number; terminated: number; pending_handling: number;
  };
  skuStats: {
    total_skus: number; selected_skus: number; unselected_skus: number;
  };
};

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max ? Math.round(value / max * 100) : 0;
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-6 text-right">{value}</span>
    </div>
  );
}

function ReviewTab() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    fetch('/api/stats/review', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState msg={error || '数据加载失败'} retry={load} />;

  const { categories, suppliers, anomalySummary, skuStats } = data;
  const maxCatTotal = Math.max(...categories.map(c => c.total), 1);
  const maxSupTotal = Math.max(...suppliers.map(s => s.total_options), 1);

  return (
    <div className="space-y-6">
      {/* SKU & Anomaly summary row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Anomaly */}
        <Section title="异常复盘" tip="口径：anomaly_reported_at IS NOT NULL 的产品。pending_handling = 已上报但经理尚未处置。">
          {anomalySummary.total_exceptions === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">暂无异常记录</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-red-500">{anomalySummary.total_exceptions}</span>
                <span className="text-sm text-slate-500">件历史异常</span>
              </div>
              {[
                { label: '接受现货', value: anomalySummary.accepted, color: 'bg-emerald-500', tip: '经理选择接受现货，产品进入已完成。' },
                { label: '要求补发', value: anomalySummary.reordered, color: 'bg-blue-500', tip: '经理要求供应商补发，产品回到已下单继续推进。' },
                { label: '终止采购', value: anomalySummary.terminated, color: 'bg-slate-400', tip: '经理终止采购，产品状态变为已终止。' },
                { label: '待处置', value: anomalySummary.pending_handling, color: 'bg-orange-400', tip: '已上报但经理尚未做出处置决定（anomaly_handling_method IS NULL）。' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-600">
                      {row.label}
                      <MetricTip text={row.tip} />
                    </span>
                    <span className="font-bold">{pct(row.value, anomalySummary.total_exceptions)}</span>
                  </div>
                  <StatBar value={row.value} max={anomalySummary.total_exceptions} color={row.color} />
                </div>
              ))}
              <div className="pt-2 text-[11px] text-slate-400">
                ⚠ 当前异常描述为自由文字字段（anomaly_note），无法做结构化原因分类统计。
              </div>
            </div>
          )}
        </Section>

        {/* SKU */}
        <Section title="SKU 决策复盘（基础版）" tip="统计所有样品方案下的 SKU 数量及经理选中情况。选中率 = 被选中 SKU / 总 SKU 数。">
          {skuStats.total_skus === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">暂无 SKU 数据</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-700">{skuStats.total_skus}</span>
                <span className="text-sm text-slate-500">个 SKU</span>
              </div>
              {[
                { label: '被经理选中', value: skuStats.selected_skus, color: 'bg-primary', tip: 'manager_selected = true 的 SKU 数量。' },
                { label: '未被选中', value: skuStats.unselected_skus, color: 'bg-slate-300', tip: 'manager_selected = false 或 NULL 的 SKU 数量。' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-600">
                      {row.label}
                      <MetricTip text={row.tip} />
                    </span>
                    <span className="font-bold">{pct(row.value, skuStats.total_skus)}</span>
                  </div>
                  <StatBar value={row.value} max={skuStats.total_skus} color={row.color} />
                </div>
              ))}
              <div className="pt-2 text-[11px] text-slate-400">
                ⚠ SKU 属性（颜色/规格/材质等）为自由 JSON 结构，当前不做属性维度分析。
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Category */}
      <Section title="类目复盘" tip={'类目取 ai_category，无则用 category_guess，均无则归入〔未分类〕。供应商完成率 = completed / entered_purchase（MVP口径）。'}>
        {categories.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">暂无类目数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 pr-4 font-semibold">类目</th>
                  <th className="text-right py-2 px-3 font-semibold">产品总数</th>
                  <th className="text-right py-2 px-3 font-semibold">
                    进入采购
                    <MetricTip text="MVP口径：status IN 全部采购阶段状态的产品数。" />
                  </th>
                  <th className="text-right py-2 px-3 font-semibold">已完成</th>
                  <th className="text-right py-2 px-3 font-semibold">
                    完成率
                    <MetricTip text="口径：已完成 / 进入采购。MVP口径，见进入采购说明。" />
                  </th>
                  <th className="text-right py-2 pl-3 font-semibold">异常</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {categories.map(cat => (
                  <tr key={cat.category} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{cat.category}</td>
                    <td className="py-2.5 px-3 text-right">
                      <StatBar value={cat.total} max={maxCatTotal} color="bg-slate-300" />
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">{cat.entered_purchase}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-green-600">{cat.completed}</td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {pct(cat.completed, cat.entered_purchase)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-medium text-red-500">
                      {cat.exceptions > 0 ? cat.exceptions : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Supplier */}
      <Section
        title="供应商复盘"
        tip="基于 sample_options 表统计，按方案维度归属供应商，避免多方案混合。供应商完成率 = completed / purchase_count（MVP口径）。"
      >
        {suppliers.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">暂无供应商方案数据</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 pr-4 font-semibold">供应商</th>
                  <th className="text-right py-2 px-3 font-semibold">
                    参与方案数
                    <MetricTip text="该供应商在 sample_options 中出现的方案总数（含未被选中的）。" />
                  </th>
                  <th className="text-right py-2 px-3 font-semibold">
                    被选中
                    <MetricTip text="经理 selected_at IS NOT NULL 的方案数。选中率 = 被选中 / 参与方案数。" />
                  </th>
                  <th className="text-right py-2 px-3 font-semibold">
                    进入采购
                    <MetricTip text="MVP口径：关联产品 status IN 全部采购状态的方案数。" />
                  </th>
                  <th className="text-right py-2 px-3 font-semibold">已完成</th>
                  <th className="text-right py-2 px-3 font-semibold">
                    完成率
                    <MetricTip text="口径：已完成 / 进入采购。MVP口径。" />
                  </th>
                  <th className="text-right py-2 pl-3 font-semibold">异常</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map(sup => (
                  <tr key={sup.supplier_name} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-slate-700 max-w-32 truncate">
                      {sup.supplier_name}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <StatBar value={sup.total_options} max={maxSupTotal} color="bg-slate-300" />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-medium">{sup.selected_count}</span>
                      <span className="text-slate-400 text-xs ml-1">
                        ({pct(sup.selected_count, sup.total_options)})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">{sup.purchase_count}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-green-600">{sup.completed_count}</td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {pct(sup.completed_count, sup.purchase_count)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-medium text-red-500">
                      {sup.anomaly_count > 0 ? sup.anomaly_count : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Main DataCenter page ─────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: '总览看板', icon: BarChart2 },
  { key: 'process',  label: '流程分析', icon: TrendingDown },
  { key: 'review',   label: '复盘分析', icon: BookOpen },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function DataCenter() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 size={22} className="text-primary" />
          <h1 className="text-2xl font-bold text-slate-800">数据中心</h1>
          <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 font-medium ml-1">只读</span>
        </div>
        <p className="text-sm text-slate-500">所有数据基于当前真实数据库，刷新页面可获取最新数据。</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'process'  && <ProcessTab />}
      {activeTab === 'review'   && <ReviewTab />}
    </div>
  );
}
