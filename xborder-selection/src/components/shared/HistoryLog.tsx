import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, History, Eye } from 'lucide-react';
import { cn } from './StatusBadge';

export interface HistoryLogEntry {
  action: string;
  actor: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  timestamp: string;
}

interface HistoryLogProps {
  log: HistoryLogEntry[];
  title?: string;
  maxItems?: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_info: '待补充信息',
  pending_analysis: '待分析',
  analyzed_pending_review: '分析完成待审核',
  screening_submitted: '初筛已提交',
  manager_reviewing: '经理审核中',
  pending_sampling: '待采样',
  sampling_collection: '采样收集中',
  sampling_ready: '采样就绪',
  sampling_review_submitted: '验样已提交',
  sample_reviewed: '验样已审核',
  pending_purchase: '待采购',
  purchased: '已采购',
  ordered: '已下单',
  goods_arrived: '已到货',
  inspecting: '验货中',
  inspecting_anomaly_entry: '异常录入中',
  inspection_anomaly: '验货异常',
  anomaly_handling: '异常处理中',
  anomaly_resolved: '异常已解决',
  goods_inspected: '已验货',
  exception_reported: '异常已上报',
  completed: '已完成',
  terminated: '已终止',
  rejected: '已拒绝',
  rejected_unconfirmed: '待确认拒绝',
  supplier_change_requested: '要求换供',
  supplier_changing: '换供中',
  returned: '已退回',
  sample_arrived: '样品已到',
  sample_reviewing: '验样中',
};

const ACTION_LABELS: Record<string, string> = {
  create: '创建产品',
  submit_analysis: '提交分析',
  approve: '审批通过',
  reject: '审批拒绝',
  start_sampling: '开始采样',
  submit_sample_review: '提交验样',
  approve_sample: '通过验样',
  request_supplier_change: '要求换供',
  select_option: '选择方案',
  confirm_order: '确认下单',
  mark_arrived: '标记到货',
  start_inspection: '开始验货',
  pass_inspection: '验货通过',
  report_anomaly: '报告异常',
  report_sampling_anomaly: '报告采样异常',
  handle_anomaly: '处置异常',
  resolve_anomaly: '异常解决',
  complete_purchase: '完成入库',
  approve_sampling_anomaly: "审批采样异常",
  sku_evaluation: "SKU评价",
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  damaged: '损坏',
  color_spec_mismatch: '颜色规格不对',
  shortage: '缺货',
  quality_issue: '质量差',
  other: '其他',
  wrong_item: '发错货',
  quality: '质量问题',
  spec_mismatch: '规格不符',
};

const HANDLING_LABELS: Record<string, string> = {
  accept: '接受现货',
  reorder: '要求补发',
  terminate: '终止采购',
  approved: '通过',
  rejected: '驳回',
};

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

const SUMMARY_MAX_LEN = 20;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function parseAction(entry: HistoryLogEntry): { summary: string; detail?: string; isHighlight?: boolean } {
  const action = entry.action || '';

  if (action === 'report_sampling_anomaly') {
    const note = entry.note || '';
    const skuMatch = note.match(/SKU:\s*([^,]+)/);
    const typeMatch = note.match(/类型:\s*([^,]+)/);
    const descMatch = note.match(/描述:\s*(.+)$/);

    const skuName = skuMatch ? skuMatch[1].trim() : '';
    const typeName = typeMatch ? ANOMALY_TYPE_LABELS[typeMatch[1].trim()] || typeMatch[1].trim() : '';
    const desc = descMatch ? descMatch[1].trim() : '';

    const summaryParts = ['报告采样异常'];
    if (skuName) summaryParts.push('SKU ' + skuName);
    if (typeName) summaryParts.push(typeName);
    const summary = summaryParts.join(' - ');
    const detail = desc || undefined;
    return { summary, detail, isHighlight: true };
  }

  if (action === 'approve_sampling_anomaly') {
    const note = entry.note || '';
    const summary = note.includes('审批通过') ? '采样异常审批通过' : '采样异常审批驳回';
    const detail = note || undefined;
    return { summary, detail };
  }

  if (action === 'report_anomaly') {
    const note = entry.note || '';
    const skuMatch = note.match(/SKU:\s*([^,]+)/);
    const typeMatch = note.match(/类型:\s*([^,]+)/);

    const skuName = skuMatch ? skuMatch[1].trim() : '';
    const typeName = typeMatch ? ANOMALY_TYPE_LABELS[typeMatch[1].trim()] || typeMatch[1].trim() : '';

    const summaryParts = ['报告异常'];
    if (skuName) summaryParts.push('SKU ' + skuName);
    if (typeName) summaryParts.push(typeName);
    return { summary: summaryParts.join(' - '), detail: note, isHighlight: true };
  }

  if (action === 'handle_anomaly') {
    const method = entry.note || '';
    const label = HANDLING_LABELS[method] || method;
    return { summary: '处置异常 - ' + label, detail: undefined };
  }

  if (entry.fromStatus || entry.toStatus) {
    const from = entry.fromStatus ? getStatusLabel(entry.fromStatus) : '';
    const to = entry.toStatus ? getStatusLabel(entry.toStatus) : '';
    if (from && to && from !== to) {
      return { summary: to, detail: from + ' \u2192 ' + to };
    }
    if (to) {
      return { summary: to };
    }
  }

  if (entry.note) {
    const mainLabel = getActionLabel(action);
    if (mainLabel !== action) {
      return { summary: mainLabel, detail: entry.note };
    }
    return { summary: truncate(entry.note, SUMMARY_MAX_LEN), detail: entry.note };
  }

  return { summary: getActionLabel(action) || action };
}

export function HistoryLog({ log, title = '操作日志', maxItems = 50 }: HistoryLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  if (!log || log.length === 0) {
    return null;
  }

  const sortedLog = [...log]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxItems);

  const displayLog = expanded ? sortedLog : sortedLog.slice(0, 3);
  const hasMore = sortedLog.length > 3;

  return (
    <div className="border-t border-slate-100 pt-2 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <History size={12} />
        <span>{title}</span>
        <span className="text-slate-400">({sortedLog.length})</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
          {displayLog.map((entry, idx) => {
            const { summary, detail, isHighlight } = parseAction(entry);
            const showDetailBtn = detail && detail !== summary;
            const isShowingDetail = detailIndex === idx;
            return (
              <div key={idx} className="flex items-start gap-2 text-xs py-1">
                <div className="flex-shrink-0 w-16 text-slate-400">
                  {format(new Date(entry.timestamp), 'MM-dd HH:mm')}
                </div>
                <div className="flex-shrink-0 w-14 text-slate-600 truncate">
                  {entry.actor || '系统'}
                </div>
                <div className={cn(
                  "flex-1",
                  isHighlight ? 'text-orange-600 font-medium' : 'text-slate-700'
                )}>
                  <span>{summary}</span>
                  {showDetailBtn && (
                    <button
                      onClick={() => setDetailIndex(isShowingDetail ? null : idx)}
                      className="ml-1.5 inline-flex items-center gap-0.5 text-slate-400 hover:text-primary transition-colors"
                    >
                      <Eye size={10} />
                      <span className="text-[10px]">{isShowingDetail ? '收起' : '详情'}</span>
                    </button>
                  )}
                  {isShowingDetail && detail && (
                    <div className="mt-0.5 text-slate-500 text-[11px] bg-slate-50 rounded px-2 py-1 border border-slate-100">
                      {detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!expanded && hasMore && (
        <div className="text-center text-[10px] text-slate-400 mt-1">
          还有 {sortedLog.length - 3} 条记录...
        </div>
      )}
    </div>
  );
}

export default HistoryLog;
