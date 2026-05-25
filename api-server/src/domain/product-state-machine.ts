export const ALL_PRODUCT_STATUSES = [
  "draft",
  "pending_info",
  "pending_analysis",
  "analyzed_pending_review",
  "screening_submitted",
  "manager_reviewing",
  "pending_sampling",
  "sampling_collection",
  "sampling_review_submitted",
  "sample_reviewed",
  "pending_purchase",
  "purchased",
  "ordered",
  "goods_arrived",
  "inspecting",
  "inspecting_anomaly_entry",
  "inspection_anomaly",
  "anomaly_handling",
  "anomaly_resolved",
  "goods_inspected",
  "exception_reported",
  "completed",
  "terminated",
  "rejected",
  "rejected_unconfirmed",
  "supplier_change_requested",
  "supplier_changing",
  "returned",
] as const;

export type ProductStatus = (typeof ALL_PRODUCT_STATUSES)[number];
export type ProductFromStatus = ProductStatus | "__new__";

export const PRODUCT_ACTIONS = [
  "create_draft",
  "create_pending_info",
  "create_submit_analysis",
  "update_draft",
  "update_pending_info",
  "update_submit_analysis",
  "run_analysis",
  "submit_screening",
  "manager_approve",
  "manager_reject",
  "manager_return",
  "start_sampling_collection",
  "start",
  "submit_sampling_review",
  "arrive",
  "start_review",
  "cancel_review",
  "submit",
  "approve_purchase",
  "change_supplier",
  "abandon",
  "confirm_order",
  "mark_arrived",
  "start_inspection",
  "start_anomaly_report",
  "cancel_anomaly_report",
  "pass_inspection",
  "report_anomaly",
  "acknowledge_anomaly",
  "start_anomaly_handling",
  "resolve_anomaly",
  "accept_goods",
  "terminate_order",
  "report_exception",
  "accept_exception",
  "reorder_exception",
  "terminate_exception",
  "inspect",
  "complete",
  "acknowledge_rejection",
  "acknowledge_supplier_change",
  "resubmit_supplier",
  "resubmit_screening",
  "manager_decision_reject",
  "manager_decision_approve",
] as const;

export type ProductAction = (typeof PRODUCT_ACTIONS)[number];

type TransitionRule = {
  allowedFrom: ProductFromStatus[];
  to: ProductStatus;
};

const TRANSITIONS: Record<ProductAction, TransitionRule> = {
  create_draft: { allowedFrom: ["__new__"], to: "draft" },
  create_pending_info: { allowedFrom: ["__new__"], to: "pending_info" },
  create_submit_analysis: { allowedFrom: ["__new__"], to: "analyzed_pending_review" },

  update_draft: { allowedFrom: ["draft", "pending_info", "returned"], to: "draft" },
  update_pending_info: { allowedFrom: ["draft", "pending_info", "returned"], to: "pending_info" },
  update_submit_analysis: { allowedFrom: ["draft", "pending_info", "returned"], to: "analyzed_pending_review" },

  run_analysis: {
    allowedFrom: ["draft", "pending_info", "returned", "analyzed_pending_review", "screening_submitted"],
    to: "analyzed_pending_review",
  },
  submit_screening: { allowedFrom: ["analyzed_pending_review"], to: "screening_submitted" },

  manager_approve: { allowedFrom: ["screening_submitted", "manager_reviewing"], to: "pending_sampling" },
  manager_reject: { allowedFrom: ["screening_submitted", "manager_reviewing"], to: "rejected_unconfirmed" },
  manager_return: { allowedFrom: ["screening_submitted", "manager_reviewing"], to: "returned" },

  start_sampling_collection: { allowedFrom: ["pending_sampling"], to: "sampling_collection" },
  start: { allowedFrom: ["pending_sampling"], to: "pending_sampling" },
  submit_sampling_review: { allowedFrom: ["sampling_collection"], to: "sampling_review_submitted" },

  arrive: { allowedFrom: ["pending_sampling"], to: "sample_arrived" },
  start_review: { allowedFrom: ["sample_arrived"], to: "sample_reviewing" },
  cancel_review: { allowedFrom: ["sample_reviewing"], to: "sample_arrived" },
  submit: { allowedFrom: ["sample_reviewing"], to: "sample_reviewed" },

  approve_purchase: { allowedFrom: ["sample_reviewed"], to: "pending_purchase" },
  change_supplier: { allowedFrom: ["sample_reviewed"], to: "supplier_change_requested" },
  abandon: { allowedFrom: ["sample_reviewed"], to: "rejected_unconfirmed" },

  confirm_order: { allowedFrom: ["pending_purchase"], to: "ordered" },
  mark_arrived: { allowedFrom: ["ordered"], to: "goods_arrived" },
  start_inspection: { allowedFrom: ["goods_arrived"], to: "inspecting" },
  start_anomaly_report: { allowedFrom: ["inspecting"], to: "inspecting_anomaly_entry" },
  cancel_anomaly_report: { allowedFrom: ["inspecting_anomaly_entry"], to: "inspecting" },
  pass_inspection: { allowedFrom: ["inspecting"], to: "goods_inspected" },
  report_anomaly: { allowedFrom: ["inspecting"], to: "inspection_anomaly" },
  acknowledge_anomaly: { allowedFrom: ["inspection_anomaly"], to: "anomaly_handling" },
  start_anomaly_handling: { allowedFrom: ["anomaly_handling"], to: "anomaly_handling" },
  resolve_anomaly: { allowedFrom: ["anomaly_handling"], to: "anomaly_resolved" },
  accept_goods: { allowedFrom: ["anomaly_resolved"], to: "completed" },
  terminate_order: { allowedFrom: ["anomaly_resolved"], to: "rejected" },

  report_exception: { allowedFrom: ["goods_arrived", "inspecting"], to: "exception_reported" },
  accept_exception: { allowedFrom: ["exception_reported"], to: "completed" },
  reorder_exception: { allowedFrom: ["exception_reported"], to: "ordered" },
  terminate_exception: { allowedFrom: ["exception_reported"], to: "terminated" },

  inspect: { allowedFrom: ["goods_arrived"], to: "goods_inspected" }, // TODO: legacy compatibility action
  complete: { allowedFrom: ["goods_inspected"], to: "completed" }, // TODO: legacy compatibility action

  acknowledge_rejection: { allowedFrom: ["rejected_unconfirmed"], to: "rejected" },
  acknowledge_supplier_change: { allowedFrom: ["supplier_change_requested"], to: "supplier_changing" },
  resubmit_supplier: { allowedFrom: ["supplier_changing"], to: "pending_sampling" },

  resubmit_screening: { allowedFrom: ["completed", "rejected", "returned"], to: "screening_submitted" },
  manager_decision_reject: { allowedFrom: ["sample_reviewed", "sampling_review_submitted"], to: "rejected_unconfirmed" },
  manager_decision_approve: { allowedFrom: ["sample_reviewed", "sampling_review_submitted"], to: "pending_purchase" },
};

export function resolveNextStatus(from: ProductFromStatus, action: ProductAction): ProductStatus {
  const rule = TRANSITIONS[action];
  if (!rule) {
    throw new Error(`Unknown action: ${String(action)}`);
  }
  if (!rule.allowedFrom.includes(from)) {
    throw new Error(
      `Invalid transition: action=${action}, from=${from}, allowedFrom=${rule.allowedFrom.join(",")}`,
    );
  }
  return rule.to;
}

export function assertTransitOrThrow(from: ProductFromStatus, action: ProductAction) {
  return resolveNextStatus(from, action);
}
