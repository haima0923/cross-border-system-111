import { useLocation } from 'wouter';
import { useAppStore } from '@/context/StoreContext';
import { format } from 'date-fns';
import { Package, ArrowRight, Clock, FlaskConical, Layers } from 'lucide-react';
import { ProductImage } from '@/components/shared/ProductImage';

const SAMPLING_STATUSES = [
  'pending_sampling',
  'sampling',
  'sample_arrived',
  'sample_reviewing',
  'sample_reviewed',
] as const;

type SamplingStatus = typeof SAMPLING_STATUSES[number];

const ACTION_STATUSES = new Set<SamplingStatus>([
  'pending_sampling',
  'sample_arrived',
  'sample_reviewing',
]);

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
  sampling: {
    label: '采样中',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    dot: 'bg-blue-400',
    btnText: '查看详情',
    btnPrimary: false,
  },
  sample_arrived: {
    label: '样品已到',
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    dot: 'bg-teal-400',
    btnText: '开始验样',
    btnPrimary: true,
  },
  sample_reviewing: {
    label: '验样中',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    dot: 'bg-purple-400',
    btnText: '继续验样',
    btnPrimary: true,
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

function getTimestamp(status: SamplingStatus, opt: { samplingStartedAt?: string | null; sampleArrivedAt?: string | null; sampleReviewedAt?: string | null }): string | null {
  if (status === 'sampling' && opt.samplingStartedAt) {
    return `确认采样：${format(new Date(opt.samplingStartedAt), 'MM-dd HH:mm')}`;
  }
  if ((status === 'sample_arrived' || status === 'sample_reviewing') && opt.sampleArrivedAt) {
    return `样品到达：${format(new Date(opt.sampleArrivedAt), 'MM-dd HH:mm')}`;
  }
  if (status === 'sample_reviewed' && opt.sampleReviewedAt) {
    return `完成验样：${format(new Date(opt.sampleReviewedAt), 'MM-dd HH:mm')}`;
  }
  return null;
}

function OptionCard({
  opt,
  product,
  skuCount,
  onNavigate,
}: {
  opt: ReturnType<typeof useAppStore>['sampleOptions'][number];
  product: ReturnType<typeof useAppStore>['products'][number];
  skuCount: number;
  onNavigate: (productId: string) => void;
}) {
  const status = product.status as SamplingStatus;
  const cfg = STATUS_CONFIG[status];
  const timestamp = getTimestamp(status, opt);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-md transition-all duration-200">
      <ProductImage
        hostedImageUrl={product.hostedImageUrl}
        imageUrl={product.imageUrl}
        size="md"
        alt={product.productName}
      />
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        <FlaskConical size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-400 font-medium mb-0.5 truncate">
          {product.productName}
        </div>
        <div className="text-sm font-semibold text-slate-800 mb-2">
          {opt.optionLabel || '方案'}
          {opt.supplierName && (
            <span className="ml-2 text-xs font-normal text-slate-500">· {opt.supplierName}</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Layers size={12} />
            {skuCount} 款 SKU
          </span>
          {timestamp && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              {timestamp}
            </span>
          )}
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
  );
}

function SectionBlock({
  title,
  subtitle,
  rows,
  onNavigate,
}: {
  title: string;
  subtitle: string;
  rows: Array<{
    opt: ReturnType<typeof useAppStore>['sampleOptions'][number];
    product: ReturnType<typeof useAppStore>['products'][number];
    skuCount: number;
  }>;
  onNavigate: (productId: string) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">
          {rows.length}
        </span>
        <span className="text-xs text-slate-400">{subtitle}</span>
      </div>
      <div className="space-y-3">
        {rows.map(({ opt, product, skuCount }) => (
          <OptionCard
            key={opt.id}
            opt={opt}
            product={product}
            skuCount={skuCount}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}

export default function SampleManagement() {
  const [, setLocation] = useLocation();
  const { products, sampleOptions, sampleSkuLines } = useAppStore();

  const samplingProducts = products.filter(p =>
    (SAMPLING_STATUSES as readonly string[]).includes(p.status)
  );

  const rows = sampleOptions
    .filter(opt => samplingProducts.some(p => p.id === opt.productId))
    .map(opt => {
      const product = samplingProducts.find(p => p.id === opt.productId)!;
      const skuCount = sampleSkuLines.filter(s => s.sampleOptionId === opt.id).length;
      return { opt, product, skuCount };
    })
    .sort((a, b) => {
      const order: Record<string, number> = {
        pending_sampling: 0,
        sample_arrived: 1,
        sample_reviewing: 2,
        sampling: 3,
        sample_reviewed: 4,
      };
      return (order[a.product.status] ?? 99) - (order[b.product.status] ?? 99);
    });

  const actionRows = rows.filter(r => ACTION_STATUSES.has(r.product.status as SamplingStatus));
  const waitingRows = rows.filter(r => !ACTION_STATUSES.has(r.product.status as SamplingStatus));

  const navigate = (productId: string) => setLocation(`/sampling/${productId}`);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
            <Package size={22} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">样品管理</h1>
        </div>
        <p className="text-slate-500 text-sm ml-14">
          当前在途样品方案
          <span className="ml-2 font-semibold text-slate-700">{rows.length}</span> 个
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
            <Package size={32} />
          </div>
          <p className="text-slate-500 text-sm">当前无在途样品方案</p>
          <p className="text-slate-400 text-xs mt-1">样品进入采样流程后将在此处显示</p>
        </div>
      ) : (
        <>
          <SectionBlock
            title="待操作"
            subtitle="需要你完成下一步动作"
            rows={actionRows}
            onNavigate={navigate}
          />
          <SectionBlock
            title="等待中"
            subtitle="当前等待外部进展或管理层决策"
            rows={waitingRows}
            onNavigate={navigate}
          />
        </>
      )}
    </div>
  );
}
