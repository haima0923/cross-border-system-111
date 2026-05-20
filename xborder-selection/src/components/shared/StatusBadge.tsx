import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '候选录入', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending_info: { label: '待补充', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  pending_analysis: { label: '待分析', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  analyzed_pending_review: { label: '已分析待复核', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  screening_submitted: { label: '初筛已提交', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  manager_reviewing: { label: '管理审核中', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  pending_sampling: { label: '待采样',  color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  sampling_collection: { label: '采样建档', color: 'bg-cyan-200 text-cyan-800 border-cyan-300' },  sampling:         { label: '采样中',  color: 'bg-sky-100 text-sky-700 border-sky-200' },
  sample_arrived:   { label: '已到样',  color: 'bg-teal-100 text-teal-700 border-teal-200' },
  sample_reviewing: { label: '验样中',  color: 'bg-teal-200 text-teal-800 border-teal-300' },
  sampling_review_submitted: { label: '已提交验样', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  sample_reviewed:  { label: '已验样',  color: 'bg-violet-100 text-violet-700 border-violet-200' },
  pending_purchase: { label: '待采购',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ordered:          { label: '已下单',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  goods_arrived:       { label: '已到货',    color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  inspecting:               { label: '验货中',      color: 'bg-sky-100 text-sky-700 border-sky-200' },
  inspecting_anomaly_entry: { label: '异常填报中',  color: 'bg-red-100 text-red-600 border-red-200' },
  inspection_anomaly:       { label: '验货异常',    color: 'bg-red-100 text-red-700 border-red-200' },
  anomaly_handling:    { label: '异常处理中', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  anomaly_resolved:    { label: '处理完成',  color: 'bg-lime-100 text-lime-700 border-lime-200' },
  exception_reported:  { label: '有异常待处理', color: 'bg-red-100 text-red-700 border-red-300' },
  goods_inspected:     { label: '已验货',    color: 'bg-purple-100 text-purple-700 border-purple-200' },
  completed:           { label: '已完成',    color: 'bg-green-100 text-green-700 border-green-200' },
  terminated:          { label: '已终止',    color: 'bg-slate-200 text-slate-600 border-slate-300' },
  purchased:        { label: '已采购',  color: 'bg-green-100 text-green-700 border-green-200' },
  rejected:                   { label: '已拒绝',      color: 'bg-red-100 text-red-700 border-red-200' },
  rejected_unconfirmed:       { label: '拒绝待确认',  color: 'bg-red-200 text-red-800 border-red-300' },
  supplier_change_requested:  { label: '待确认换供',  color: 'bg-amber-200 text-amber-800 border-amber-300' },
  supplier_changing:          { label: '换供中',      color: 'bg-amber-100 text-amber-700 border-amber-200' },
  returned:                   { label: '退回补充',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export const PO_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: '待下单', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  ordered:   { label: '已下单', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  arrived:   { label: '已到货', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700 border-green-200' },
}

export function StatusBadge({ status, isPO = false }: { status: string, isPO?: boolean }) {
  const config = isPO ? PO_STATUS_MAP[status] : STATUS_MAP[status];
  
  if (!config) return <span className="px-2.5 py-1 text-xs font-medium rounded-full border bg-gray-100 text-gray-700">{status}</span>;

  return (
    <span className={cn(
      "px-2.5 py-1 text-xs font-semibold rounded-full border shadow-sm inline-flex items-center gap-1.5",
      config.color
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
      {config.label}
    </span>
  );
}
