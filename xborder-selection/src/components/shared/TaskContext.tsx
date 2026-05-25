import React from 'react';
import { ChevronDown, ChevronUp, ExternalLink, ClipboardList } from 'lucide-react';
import { useAppStore } from '@/context/StoreContext';

export function TaskReferenceImage({
  src,
  alt,
  size = 'md',
}: {
  src: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'sm'
    ? 'h-20 w-20 rounded-lg'
    : size === 'lg'
      ? 'h-28 w-28 rounded-xl'
      : 'h-24 w-24 rounded-xl';

  return (
    <span
      className="group relative inline-block shrink-0 align-top"
      onClick={e => e.stopPropagation()}
    >
      <img
        src={src}
        alt={alt || '任务参考图'}
        className={`${sizeClass} cursor-zoom-in border border-blue-100 object-cover transition-transform duration-150 group-hover:scale-105`}
      />
      <span className="pointer-events-none fixed left-1/2 top-1/2 z-[120] hidden -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl group-hover:block">
        <img
          src={src}
          alt={alt || '任务参考图'}
          className="max-h-[72vh] max-w-[72vw] rounded-xl object-contain"
        />
      </span>
    </span>
  );
}

export function TaskContextPanel({
  taskId,
  compact = false,
}: {
  taskId?: string | null;
  compact?: boolean;
}) {
  const { procurementTasks } = useAppStore();
  const [open, setOpen] = React.useState(false);
  const task = procurementTasks.find(item => item.id === taskId);

  if (!task) return null;

  if (compact) {
    return (
      <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-2 text-xs text-blue-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ClipboardList size={12} className="shrink-0" />
            <span className="font-semibold shrink-0">任务</span>
            <span className="truncate">{task.title}</span>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setOpen(v => !v);
            }}
            className="text-blue-600 hover:text-blue-800 shrink-0"
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
        {open && (
          <div className="mt-2 space-y-1 border-t border-blue-100 pt-2 text-blue-700">
            {task.category && <div>方向：{task.category}</div>}
            <div className="whitespace-pre-wrap">{task.detail}</div>
            {task.referenceImageUrl && (
              <div className="mt-2">
                <TaskReferenceImage src={task.referenceImageUrl} alt={task.title} size="sm" />
              </div>
            )}
            {task.referenceLink && (
              <a
                href={task.referenceLink}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-semibold hover:underline"
              >
                参考链接 <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-800 font-semibold text-sm">
            <ClipboardList size={16} />
            <span>采购任务：{task.title}</span>
            {task.status === 'closed' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">已关闭</span>
            )}
          </div>
          {task.category && <div className="mt-1 text-xs text-blue-600">采购方向：{task.category}</div>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
        >
          {open ? '收起详情' : '查看详情'}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 border-t border-blue-100 pt-3">
          <div className="space-y-2 text-sm text-blue-900">
            <div className="whitespace-pre-wrap leading-relaxed">{task.detail}</div>
            {task.referenceLink && (
              <a
                href={task.referenceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                打开参考链接 <ExternalLink size={12} />
              </a>
            )}
          </div>
          {task.referenceImageUrl && (
            <TaskReferenceImage src={task.referenceImageUrl} alt={task.title} size="md" />
          )}
        </div>
      )}
    </div>
  );
}
