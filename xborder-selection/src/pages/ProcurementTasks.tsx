import React from 'react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import {
  ClipboardList, Plus, Upload, Link as LinkIcon, Users, UserCheck,
  ChevronDown, ChevronUp, ExternalLink, Lock, PackagePlus,
} from 'lucide-react';
import { useAppStore, type ProcurementTask } from '@/context/StoreContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProductImage } from '@/components/shared/ProductImage';
import { TaskReferenceImage } from '@/components/shared/TaskContext';

type Specialist = {
  employeeId: string;
  name: string;
  status: string;
};

const API = '/api';

function taskProducts(products: any[], taskId: string) {
  return products.filter(product => product.taskId === taskId);
}

function productPath(product: any) {
  if (['draft', 'pending_info', 'returned', 'supplier_changing'].includes(product.status)) return `/entry?id=${product.id}`;
  if (['pending_sampling', 'sampling_collection', 'sampling_ready', 'sampling', 'sample_arrived', 'sample_reviewing', 'sampling_review_submitted', 'sample_reviewed'].includes(product.status)) return `/sampling/${product.id}`;
  if (['pending_purchase', 'ordered', 'goods_arrived', 'inspecting', 'inspection_anomaly', 'anomaly_handling', 'anomaly_resolved', 'goods_inspected', 'completed'].includes(product.status)) return '/purchase-pool';
  return `/analysis/${product.id}`;
}

function TaskDetail({
  task,
  products,
  onCreateProduct,
  onOpenProduct,
  onRead,
  unreadEnabled = false,
}: {
  task: ProcurementTask;
  products: any[];
  onCreateProduct?: () => void;
  onOpenProduct: (product: any) => void;
  onRead?: () => void;
  unreadEnabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const isClosed = task.status === 'closed';
  const unread = unreadEnabled && task.status === 'published' && !task.readAt;

  const toggle = () => {
    setOpen(v => !v);
    onRead?.();
  };

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-visible ${unread ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">{task.title}</h3>
              {unread && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold">
                  1
                </span>
              )}
              {isClosed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  <Lock size={11} /> 已关闭
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 flex gap-2 flex-wrap">
              {task.category && <span>方向：{task.category}</span>}
              <span>发布：{task.createdByName}</span>
              {task.publishedAt && <span>{format(new Date(task.publishedAt), 'MM-dd HH:mm')}</span>}
              <span>{products.length} 个产品</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onCreateProduct && !isClosed && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onRead?.();
                  onCreateProduct();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90"
              >
                <PackagePlus size={14} />
                新建产品目录
              </button>
            )}
            <button
              onClick={toggle}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {open ? '收起' : '查看详情'}
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 rounded-xl bg-slate-50 p-4">
            <div className="space-y-3">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{task.detail}</div>
              {task.referenceLink && (
                <a
                  href={task.referenceLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  参考链接 <ExternalLink size={12} />
                </a>
              )}
            </div>
            {task.referenceImageUrl && (
              <TaskReferenceImage src={task.referenceImageUrl} alt={task.title} size="lg" />
            )}
          </div>
        )}
      </div>

      {products.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
          <div className="space-y-2">
            {products.map(product => (
              <button
                key={product.id}
                onClick={() => onOpenProduct(product)}
                className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <ProductImage hostedImageUrl={product.hostedImageUrl} imageUrl={product.imageUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">{product.productName}</div>
                  <div className="text-xs text-slate-400 truncate">{product.supplierName || '未填写供应商'}</div>
                </div>
                <StatusBadge status={product.status} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProcurementTasks() {
  const {
    role,
    products,
    procurementTasks,
    createProcurementTask,
    updateProcurementTask,
    markProcurementTaskRead,
    refetch,
  } = useAppStore();
  const [, setLocation] = useLocation();
  const [expandedForm, setExpandedForm] = React.useState(false);
  const [specialists, setSpecialists] = React.useState<Specialist[]>([]);
  const [specialistsError, setSpecialistsError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({
    title: '',
    category: '',
    detail: '',
    referenceImageUrl: '',
    referenceLink: '',
    assigneeMode: 'all' as 'all' | 'specific',
    assigneeEmployeeIds: [] as string[],
  });

  const fetchSpecialists = React.useCallback(async () => {
    if (role !== 'product_manager') return;
    setSpecialistsError('');
    try {
      const res = await fetch(API + '/tasks/specialists', { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `读取员工账号失败（${res.status}）`);
      }
      setSpecialists(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '读取员工账号失败';
      setSpecialists([]);
      setSpecialistsError(message);
    }
  }, [role]);

  React.useEffect(() => {
    fetchSpecialists();
  }, [fetchSpecialists]);

  React.useEffect(() => {
    refetch().catch(() => {});
  }, [refetch]);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch(API + '/upload/task-reference-image', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      setForm(prev => ({ ...prev, referenceImageUrl: data.url }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传失败';
      alert(message);
    } finally {
      setUploading(false);
    }
  };

  const submitTask = async () => {
    setSubmitting(true);
    try {
      await createProcurementTask({
        ...form,
        referenceImageUrl: form.referenceImageUrl || null,
        referenceLink: form.referenceLink || null,
      } as any);
      setForm({
        title: '',
        category: '',
        detail: '',
        referenceImageUrl: '',
        referenceLink: '',
        assigneeMode: 'all',
        assigneeEmployeeIds: [],
      });
      setExpandedForm(false);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : '发布任务失败，请检查任务信息或网络状态后重试';
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const openProduct = (product: any) => setLocation(productPath(product));

  if (role === 'product_manager') {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">采购任务</h1>
            <p className="text-slate-500 mt-1">发布采购方向给产品专员，并追踪任务下的选品进度</p>
          </div>
          <button
            onClick={() => setExpandedForm(v => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 hover:bg-primary/90"
          >
            <Plus size={16} />
            发布任务
          </button>
        </div>

        {expandedForm && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">任务标题</label>
                <input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="如：母婴用品采购任务"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">采购方向</label>
                <input
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="如：母婴、户外、某款产品"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">任务详情</label>
              <textarea
                rows={5}
                value={form.detail}
                onChange={e => setForm(prev => ({ ...prev, detail: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="写清楚采购目标、价格要求、禁采方向、重点关注点等"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">参考链接（选填）</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                  <LinkIcon size={14} className="text-slate-400" />
                  <input
                    value={form.referenceLink}
                    onChange={e => setForm(prev => ({ ...prev, referenceLink: e.target.value }))}
                    className="min-w-0 flex-1 text-sm outline-none"
                    placeholder="https://"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">参考图（选填）</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-primary/40 hover:text-primary">
                  <Upload size={14} />
                  {uploading ? '上传中...' : form.referenceImageUrl ? '已上传，可重新选择' : '上传参考图'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(file);
                    }}
                  />
                </label>
              </div>
            </div>
            {form.referenceImageUrl && (
              <TaskReferenceImage src={form.referenceImageUrl} alt="任务参考图" size="md" />
            )}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">发布对象</span>
              </div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setForm(prev => ({ ...prev, assigneeMode: 'all' }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${form.assigneeMode === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  全部产品专员
                </button>
                <button
                  onClick={() => setForm(prev => ({ ...prev, assigneeMode: 'specific' }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${form.assigneeMode === 'specific' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  指定员工
                </button>
              </div>
              {form.assigneeMode === 'specific' && (
                <div className="space-y-2">
                  {specialistsError && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-3">
                      <span>{specialistsError}</span>
                      <button type="button" onClick={fetchSpecialists} className="font-semibold hover:underline">
                        重试
                      </button>
                    </div>
                  )}
                  {!specialistsError && specialists.length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                      暂无可选产品专员账号。请先在账号管理中新建产品专员，或选择“全部产品专员”发布。
                    </div>
                  )}
                  {specialists.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {specialists.map(user => {
                        const checked = form.assigneeEmployeeIds.includes(user.employeeId);
                        const disabled = user.status === 'disabled';
                        return (
                          <label
                            key={user.employeeId}
                            className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ${disabled ? 'opacity-50' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={e => setForm(prev => ({
                                ...prev,
                                assigneeEmployeeIds: e.target.checked
                                  ? [...prev.assigneeEmployeeIds, user.employeeId]
                                  : prev.assigneeEmployeeIds.filter(id => id !== user.employeeId),
                              }))}
                            />
                            <span className="font-medium text-slate-700">{user.name}</span>
                            <span className="text-xs text-slate-400">{user.employeeId}</span>
                            {disabled && <span className="text-[10px] text-slate-400">已禁用</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExpandedForm(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={submitTask}
                disabled={submitting || !form.title.trim() || !form.detail.trim() || (form.assigneeMode === 'specific' && form.assigneeEmployeeIds.length === 0)}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? '发布中...' : '发布任务'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {procurementTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
              暂无采购任务
            </div>
          ) : procurementTasks.map(task => {
            const productsInTask = taskProducts(products as any[], task.id);
            return (
              <div key={task.id} className="space-y-2">
                <TaskDetail task={task} products={productsInTask} onOpenProduct={openProduct} />
                <div className="flex items-center gap-2 text-xs text-slate-500 pl-1">
                  <UserCheck size={13} />
                  <span>{task.assigneeMode === 'all' ? '全部产品专员' : `指定 ${task.assignees?.length || 0} 人`}</span>
                  {task.status !== 'closed' && (
                    <button
                      onClick={() => updateProcurementTask(task.id, { status: 'closed' })}
                      className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      关闭任务
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">采购任务</h1>
        <p className="text-slate-500 mt-1">查看经理发布的采购方向，并在任务下新建产品目录</p>
      </div>
      <div className="space-y-4">
        {procurementTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
            暂无采购任务
          </div>
        ) : procurementTasks.map(task => (
          <TaskDetail
            key={task.id}
            task={task}
            products={taskProducts(products as any[], task.id)}
            onRead={() => {
              if (!task.readAt && task.status === 'published') markProcurementTaskRead(task.id).catch(() => {});
            }}
            unreadEnabled
            onCreateProduct={() => setLocation(`/entry?taskId=${task.id}`)}
            onOpenProduct={openProduct}
          />
        ))}
      </div>
    </div>
  );
}
