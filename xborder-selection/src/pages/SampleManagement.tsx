import { useLocation } from 'wouter';
import { useAppStore } from '@/context/StoreContext';
import { useState } from 'react';
import { format } from 'date-fns';
import { Package, ArrowRight, Clock, Layers } from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';
import { TaskContextPanel } from '@/components/shared/TaskContext';

const SAMPLING_STATUSES = [
  'pending_sampling',
  'sampling_collection',
  'sampling_review_submitted',
  'sample_reviewed',
] as const;

type SamplingStatus = typeof SAMPLING_STATUSES[number];

const STATUS_CONFIG: Record<SamplingStatus, {
  label: string;
  bg: string;
  text: string;
  dot: string;
  btnText: string;
  btnPrimary: boolean;
}> = {
  pending_sampling: {
    label: '待采样',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    dot: 'bg-orange-400',
    btnText: '确认采样',
    btnPrimary: true,
  },
  sampling_collection: {
    label: '采样建档',
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
    dot: 'bg-cyan-400',
    btnText: '继续建档',
    btnPrimary: true,
  },
  sampling_review_submitted: {
    label: '已提交验样',
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    dot: 'bg-indigo-400',
    btnText: '查看详情',
    btnPrimary: false,
  },
  sample_reviewed: {
    label: '已验样',
    bg: 'bg-green-100',
    text: 'text-green-700',
    dot: 'bg-green-400',
    btnText: '查看结果',
    btnPrimary: false,
  },
};

// Sample order status for option-level display
const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: '待采购', bg: 'bg-slate-100', text: 'text-slate-600' },
  ordered:    { label: '已采购', bg: 'bg-blue-100',  text: 'text-blue-700' },
  arrived:    { label: '已到货', bg: 'bg-green-100', text: 'text-green-700' },
  evaluating: { label: '填写评价', bg: 'bg-purple-100', text: 'text-purple-700' },
  evaluated:  { label: '已评价', bg: 'bg-teal-100', text: 'text-teal-700' },
};

function ProductCard({
  product,
  options,
  skuLines,
  onNavigate,
}: {
  product: ReturnType<typeof useAppStore>['products'][number];
  options: ReturnType<typeof useAppStore>['sampleOptions'][number][];
  skuLines: ReturnType<typeof useAppStore>['sampleSkuLines'][number][];
  onNavigate: (productId: string) => void;
}) {
  const status = product.status as SamplingStatus;
  const cfg = STATUS_CONFIG[status];

  // Count options by order status
  const statusCounts = options.reduce((acc, opt) => {
    const os = opt.sampleOrderStatus || 'pending';
    acc[os] = (acc[os] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalSkus = options.reduce((sum, opt) =>
    sum + skuLines.filter(s => s.sampleOptionId === opt.id).length, 0
  );

  const lastUpdated = options.length > 0
    ? options.reduce((latest, opt) => {
        const t = new Date(opt.updatedAt).getTime();
        return t > latest ? t : latest;
      }, 0)
    : new Date(product.updatedAt).getTime();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 hover:border-primary/30 hover:shadow-md transition-all duration-200">
      <div className="flex items-start gap-4">
        <ProductImage
          hostedImageUrl={product.hostedImageUrl}
          imageUrl={product.imageUrl}
          size="md"
          alt={product.productName}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-800 truncate">
              {product.productName}
            </h3>
            {product.spuCode && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                SPU {product.spuCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Layers size={12} />
              {options.length} 个方案 · {totalSkus} 款SKU
            </span>
          </div>

          {/* Per-option status chips */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {options.map(opt => {
              const os = opt.sampleOrderStatus || 'pending';
              const osc = ORDER_STATUS_CONFIG[os];
              return (
                <span
                  key={opt.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${osc.bg} ${osc.text}`}
                >
                  {opt.optionLabel || '方案'}: {osc.label}
                </span>
              );
            })}
          </div>

          <div className="mb-2">
            <TaskContextPanel taskId={(product as any).taskId} compact />
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Clock size={11} />
            {format(new Date(lastUpdated), 'MM-dd HH:mm')}
          </div>
        </div>

        <button
          onClick={() => onNavigate(product.id)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            cfg.btnPrimary
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
              : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800 bg-white'
          }`}
        >
          {cfg.btnText}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function SampleManagement() {
  const [, setLocation] = useLocation();
  const { products, sampleOptions, sampleSkuLines } = useAppStore();
  const [activeStatus, setActiveStatus] = useState<SamplingStatus>('pending_sampling');

  const samplingProducts = products.filter(p =>
    (SAMPLING_STATUSES as readonly string[]).includes(p.status)
  );

  const navigate = (productId: string) => setLocation(`/sampling/${productId}`);
  const productsForStatus = (status: SamplingStatus) =>
    samplingProducts
      .filter(p => p.status === status)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const activeProducts = productsForStatus(activeStatus);
  const activeConfig = STATUS_CONFIG[activeStatus];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <Package size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">样品管理</h1>
        </div>
        <p className="text-slate-500 text-sm ml-14">
          当前在途采样产品
          <span className="ml-2 font-semibold text-slate-700">{samplingProducts.length}</span> 个
        </p>
      </div>

      {samplingProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
            <Package size={32} />
          </div>
          <p className="text-slate-500 text-sm">当前无在途采样产品</p>
          <p className="text-slate-400 text-xs mt-1">产品进入采样流程后将在此处显示</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {SAMPLING_STATUSES.map(status => {
              const cfg = STATUS_CONFIG[status];
              const count = productsForStatus(status).length;
              const isActive = activeStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={`flex min-w-[9rem] flex-1 items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : cfg.dot}`} />
                    <span className="text-sm font-semibold">{cfg.label}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isActive ? 'bg-white/15 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 min-h-[calc(100vh-17rem)]">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${activeConfig.dot}`} />
                <h2 className={`text-sm font-semibold ${activeConfig.text}`}>{activeConfig.label}</h2>
              </div>
              <span className="bg-white text-slate-600 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm border border-slate-100">
                {activeProducts.length}
              </span>
            </div>

            {activeProducts.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
                当前状态暂无样品
              </div>
            ) : (
              <div className="space-y-3">
                {activeProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  options={sampleOptions.filter(o => o.productId === product.id)}
                  skuLines={sampleSkuLines}
                  onNavigate={navigate}
                />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// test marker
