export type ProductStatus =
  | "draft"
  | "pending_info"
  | "pending_analysis"
  | "analyzed_pending_review"
  | "screening_submitted"
  | "manager_reviewing"
  | "pending_sampling"
  | "sampling_collection"
  | "sampling_ready"
  | "sampling"
  | "sample_arrived"
  | "sample_reviewing"
  | "sampling_review_submitted"
  | "sample_reviewed"
  | "pending_purchase"
  | "purchased"
  | "ordered"
  | "goods_arrived"
  | "inspecting"
  | "inspecting_anomaly_entry"
  | "inspection_anomaly"
  | "anomaly_handling"
  | "anomaly_resolved"
  | "goods_inspected"
  | "exception_reported"
  | "completed"
  | "terminated"
  | "rejected"
  | "rejected_unconfirmed"
  | "supplier_change_requested"
  | "supplier_changing"
  | "returned";

export interface HistoryEntry {
  timestamp: string;
  actor: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
}

export interface Product {
  id: string;
  status: ProductStatus;
  submitterName: string;
  employeeId?: string | null;
  department?: string | null;
  taskId?: string | null;
  spuCode?: string | null;
  spuCodePeriod?: string | null;
  spuCodeSequence?: number | null;
  spuCodeAssignedAt?: string | null;
  productName: string;
  productSource?: string | null;
  link1688?: string | null;
  imageUrl?: string | null;
  hostedImageUrl?: string | null;
  supplierName?: string | null;
  contactStatus?: string | null;
  purchasePrice?: number | null;
  moq?: number | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  boxQuantity?: number | null;
  packagingNote?: string | null;
  material?: string | null;
  usage?: string | null;
  categoryGuess?: string | null;
  suggestedPrice?: number | null;
  remarks?: string | null;
  logisticsMode?: string | null;
  airFreight?: number | null;
  seaFreight?: number | null;
  tariff?: number | null;
  vat?: number | null;
  totalTax?: number | null;
  totalCost?: number | null;
  grossProfit?: number | null;
  grossMargin?: number | null;
  aiCategory?: string | null;
  aiHsCode?: string | null;
  aiRiskLevel?: string | null;
  aiCompetitiveness?: number | null;
  aiRecommended?: boolean | null;
  aiReport?: string | null;
  aiSuggestedPriceMin?: number | null;
  aiSuggestedPriceMax?: number | null;
  aiRecommendedPrice?: number | null;
  aiRecommendedMargin?: number | null;
  samplingStartedBy?: string | null;
  samplingStartedAt?: string | null;
  sampleArrivedAt?: string | null;
  sampleConsistentWithImage?: boolean | null;
  sampleMaterialEval?: string | null;
  sampleWorkmanshipEval?: string | null;
  sampleFunctionEval?: string | null;
  sampleRemarks?: string | null;
  sampleReviewedBy?: string | null;
  sampleReviewedAt?: string | null;
  purchaseQuantity?: number | null;
  orderedAt?: string | null;
  goodsArrivedAt?: string | null;
  inspectingStartedAt?: string | null;
  goodsInspectedAt?: string | null;
  goodsInspectionNote?: string | null;
  anomalyTypes?: string[] | null;
  anomalyQuantity?: number | null;
  anomalySeverity?: string | null;
  anomalyNote?: string | null;
  anomalyReportedAt?: string | null;
  anomalyReportedBy?: string | null;
  anomalyHandlingMethod?: string | null;
  anomalyHandlingNote?: string | null;
  anomalyHandledBy?: string | null;
  anomalyHandledAt?: string | null;
  anomalyResolvedAt?: string | null;
  anomalyResolvedBy?: string | null;
  completedAt?: string | null;
  employeeNote?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
  analysisSubmittedAt?: string | null;
  screeningSubmittedBy?: string | null;
  screeningSubmittedAt?: string | null;
  resubmitted?: boolean | null;
  managerReviewedBy?: string | null;
  managerReviewedAt?: string | null;
  managerComment?: string | null;
  supplierChangeCount?: number | null;
  previousSupplierName?: string | null;
  previousPurchasePrice?: number | null;
  previousMoq?: number | null;
  supplierChangeLog?: unknown[] | null;
  enteredEndedAt?: string | null;
  enteredPurchaseAt?: string | null;
  historyLog?: HistoryEntry[];
}

export type PurchaseOrderStatus = "pending" | "ordered" | "arrived" | "completed";

export interface PurchaseOrder {
  id: string;
  productId: string;
  productName: string;
  supplierName: string;
  sampleOptionId?: string | null;
  purchasePrice: number;
  quantity: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  operator?: string | null;
  orderedAt?: string | null;
  arrivedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}
