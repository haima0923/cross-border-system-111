import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { Product, PurchaseOrder } from '@workspace/api-client-react';

const API = '/api';

export type ProductWithCodes = Product & {
  spuCode?: string | null;
  spuCodePeriod?: string | null;
  spuCodeSequence?: number | null;
  spuCodeAssignedAt?: string | null;
};

export type UserRole = 'product_specialist' | 'product_manager' | 'admin';

export interface AuthUser {
  name: string;
  role: UserRole;
  employeeId: string;
}

export interface SampleOption {
  id: string;
  productId: string;
  status: string;
  optionLabel?: string | null;
  supplierName?: string | null;
  link1688?: string | null;
  shippingCost?: number | null;
  contactStatus?: string | null;
  material?: string | null;
  packagingNote?: string | null;
  remarks?: string | null;
  sampleConsistentWithImage?: boolean | null;
  sampleMaterialEval?: string | null;
  sampleWorkmanshipEval?: string | null;
  sampleFunctionEval?: string | null;
  sampleRemarks?: string | null;
  sampleReviewSummary?: string | null;
  sampleReviewScore?: number | null;
  sampleReviewedBy?: string | null;
  sampleReviewedAt?: string | null;
  samplingStartedBy?: string | null;
  samplingStartedAt?: string | null;
  sampleOrderStatus?: string | null;
  sampleOrderedAt?: string | null;
  sampleArrivedAt?: string | null;
  selectionNote?: string | null;
  selectedBy?: string | null;
  selectedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleSkuLine {
  id: string;
  sampleOptionId: string;
  skuCode?: string | null;
  skuCodeSuffix?: number | null;
  skuCodeAssignedAt?: string | null;
  skuName?: string | null;
  attributes?: Record<string, string> | null;
  unitPrice?: number | null;
  moq?: number | null;
  weight?: number | null;
  dimensions?: { length?: number; width?: number; height?: number } | null;
  imageUrl?: string | null;
  hostedImageUrl?: string | null;
  recommended?: boolean | null;
  managerSelected?: boolean | null;
  purchaseQuantity?: number | null;
  notes?: string | null;
  // 采购相关字段
  purchaseStatus?: string;
  orderedAt?: string | null;
  arrivedAt?: string | null;
  inspectingStartedAt?: string | null;
  passedAt?: string | null;
  completedAt?: string | null;
  // 异常上报
  anomalyType?: string | null;
  anomalyNote?: string | null;
  anomalyReportedAt?: string | null;
  anomalyReportedBy?: string | null;
  // 经理处置
  anomalyHandlingMethod?: string | null;
  anomalyHandlingNote?: string | null;
  anomalyHandledBy?: string | null;
  anomalyHandledAt?: string | null;
  anomalyResolvedAt?: string | null;
  anomalyImages?: string[] | null;
  anomalyHistory?: SkuAnomalyHistoryEntry[] | null;
  // SKU级验样评价
  skuConsistentWithImage?: boolean | null;
  skuMaterialEval?: string | null;
  skuWorkmanshipEval?: string | null;
  skuFunctionEval?: string | null;
  skuRemarks?: string | null;
  packingQuantity?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkuAnomalyHistoryEntry {
  id: string;
  round: number;
  status: 'reported' | 'handling' | 'processing' | 'resolved';
  anomalyType?: string | null;
  anomalyTypes?: string[] | null;
  anomalyNote?: string | null;
  reportedAt?: string | null;
  reportedBy?: string | null;
  handlingMethod?: string | null;
  handlingNote?: string | null;
  handledAt?: string | null;
  handledBy?: string | null;
  startedAt?: string | null;
  startedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface ProcurementTask {
  id: string;
  title: string;
  category?: string | null;
  detail: string;
  referenceImageUrl?: string | null;
  referenceLink?: string | null;
  assigneeMode: 'all' | 'specific';
  status: 'published' | 'closed' | 'draft';
  createdById?: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  closedAt?: string | null;
  readAt?: string | null;
  assignees?: Array<{
    id: string;
    taskId: string;
    employeeId: string;
    employeeName?: string | null;
    assignedAt: string;
    readAt?: string | null;
  }>;
}

export interface ManagerEmployee {
  employeeId: string;
  name: string;
  status?: string | null;
}

// 操作日志类型
export interface HistoryLogEntry {
  action: string;
  actor: string;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  timestamp: string;
}

interface StoreState {
  role: UserRole;
  currentUser: { name: string; id: string; department: string };
  products: ProductWithCodes[];
  managerEmployees: ManagerEmployee[];
  managerEmployeeFilter: string;
  setManagerEmployeeFilter: (employeeId: string) => void;
  purchaseOrders: PurchaseOrder[];
  sampleOptions: SampleOption[];
  sampleSkuLines: SampleSkuLine[];
  procurementTasks: ProcurementTask[];
  loading: boolean;
  logout: () => Promise<void>;
  addProduct: (product: Partial<ProductWithCodes>, skus?: SkuInput[]) => Promise<ProductWithCodes>;
  updateProduct: (id: string, updates: Partial<ProductWithCodes>, logAction?: string, note?: string) => Promise<void>;
  sampleAction: (id: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  // SKU级采购操作
  skuPurchaseAction: (productId: string, skuLineId: string, action: string, data?: Record<string, unknown>) => Promise<void>;
  completePurchase: (productId: string) => Promise<void>;
  addPurchaseOrder: (po: Partial<PurchaseOrder>) => void;
  updatePurchaseOrderStatus: (id: string, status: PurchaseOrder['status']) => void;
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void;
  addSampleOption: (option: Partial<SampleOption>) => Promise<SampleOption>;
  updateSampleOption: (id: string, updates: Partial<SampleOption>) => Promise<SampleOption>;
  updateSampleOptionStatus: (id: string, sampleOrderStatus: string) => Promise<SampleOption>;
  deleteSampleOption: (id: string) => Promise<void>;
  addSampleSkuLine: (sku: Partial<SampleSkuLine>) => Promise<SampleSkuLine>;
  updateSampleSkuLine: (id: string, updates: Partial<SampleSkuLine>) => Promise<SampleSkuLine>;
  deleteSampleSkuLine: (id: string) => Promise<void>;
  updateSkuEvaluation: (skuLineId: string, evaluation: {
    skuConsistentWithImage?: boolean;
    skuMaterialEval?: string;
    skuWorkmanshipEval?: string;
    skuFunctionEval?: string;
    skuRemarks?: string;
    packingQuantity?: number;
  }) => Promise<void>;
  managerDecision: (productId: string, payload: {
    action: 'approve' | 'reject';
    selectedOptionId?: string;        // 保留向后兼容
    selectedOptionIds?: string[];     // 新增：多方案
    selectedSkuIds?: string[];
    skuQuantities?: Record<string, number>;
    comment?: string;
  }) => Promise<void>;
  reportSamplingAnomaly: (
    skuLineId: string,
    data: { anomalyType: string; anomalyNote: string; anomalyImages?: string[] },
  ) => Promise<void>;
  approveSamplingAnomaly: (skuLineId: string, data: { approved: boolean; note?: string }) => Promise<void>;
  createProcurementTask: (task: Partial<ProcurementTask> & { assigneeEmployeeIds?: string[] }) => Promise<ProcurementTask>;
  updateProcurementTask: (id: string, updates: Partial<ProcurementTask>) => Promise<ProcurementTask>;
  markProcurementTaskRead: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export interface SkuInput {
  skuName?: string;
  unitPrice?: number;
  moq?: number;
  notes?: string;
  imageUrl?: string;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

async function apiFetch(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    });
  } catch (networkErr) {
    const hint = '请检查网络连接。若您使用了浏览器插件（如广告拦截器），请尝试无痕模式或关闭插件后重试。';
    throw new Error('网络请求失败：' + hint);
  }
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('登录已失效，请重新登录');
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({ error: '权限不足' }));
    const msg = body.error || '权限不足，当前角色无法执行此操作';
    alert('权限不足：' + msg);
    throw new Error('403 权限不足: ' + msg);
  }
  if (res.status === 404) {
    throw new Error('404 资源不存在，请刷新页面后重试');
  }
  if (res.status >= 500) {
    const body = await res.text().catch(() => '');
    throw new Error('服务端异常（' + res.status + '），请稍后重试。' + (body ? '详情：' + body.slice(0, 200) : ''));
  }
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('请求失败（' + res.status + '）：' + (err || '未知错误'));
  }
  return res.json();
}

export function StoreProvider({
  children,
  user: authUser,
}: {
  children: ReactNode;
  user: AuthUser;
}) {
  const role = authUser.role;
  const currentUser = {
    name: authUser.name,
    id: authUser.employeeId,
    department: '跨境选品部',
  };

  const [products, setProducts] = useState<ProductWithCodes[]>([]);
  const [managerEmployees, setManagerEmployees] = useState<ManagerEmployee[]>([]);
  const [managerEmployeeFilter, setManagerEmployeeFilter] = useState('all');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [sampleOptions, setSampleOptions] = useState<SampleOption[]>([]);
  const [sampleSkuLines, setSampleSkuLines] = useState<SampleSkuLine[]>([]);
  const [procurementTasks, setProcurementTasks] = useState<ProcurementTask[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingSkuActionsRef = useRef<Set<string>>(new Set());

  const visibleProducts = useMemo(() => {
    if (role !== 'product_manager' || managerEmployeeFilter === 'all') return products;
    return products.filter(product => product.employeeId === managerEmployeeFilter);
  }, [products, role, managerEmployeeFilter]);

  const visibleProcurementTasks = useMemo(() => {
    if (role !== 'product_manager' || managerEmployeeFilter === 'all') return procurementTasks;
    const taskIdsWithProducts = new Set(
      products
        .filter(product => product.employeeId === managerEmployeeFilter && product.taskId)
        .map(product => product.taskId as string),
    );
    return procurementTasks.filter(task =>
      task.assigneeMode === 'all' ||
      task.assignees?.some(assignee => assignee.employeeId === managerEmployeeFilter) ||
      taskIdsWithProducts.has(task.id),
    );
  }, [managerEmployeeFilter, procurementTasks, products, role]);

  // 员工提交采样异常
  // 报告采样异常 - 优化：局部更新而非全量refetch
  const reportSamplingAnomaly = async (skuLineId: string, data: { anomalyType: string; anomalyNote: string; anomalyImages?: string[] }): Promise<void> => {
    await apiFetch(API + '/sample-sku-lines/' + skuLineId + '/sampling-anomaly', {
      method: 'POST',
      body: JSON.stringify({ ...data, operator: currentUser.name }),
    });
    // 局部更新：获取最新SKU数据并更新状态
    const updatedSku = await apiFetch(API + '/sample-sku-lines/' + skuLineId);
    setSampleSkuLines(prev => prev.map(s => s.id === skuLineId ? { ...s, ...updatedSku } : s));
  };

  // 经理审批采样异常 - 优化：局部更新而非全量refetch
  const approveSamplingAnomaly = async (skuLineId: string, data: { approved: boolean; note?: string }): Promise<void> => {
    await apiFetch(API + '/sample-sku-lines/' + skuLineId + '/approve-sampling-anomaly', {
      method: 'POST',
      body: JSON.stringify({ ...data, operator: currentUser.name }),
    });
    // 局部更新：获取最新SKU数据并更新状态
    const updatedSku = await apiFetch(API + '/sample-sku-lines/' + skuLineId);
    setSampleSkuLines(prev => prev.map(s => s.id === skuLineId ? { ...s, ...updatedSku } : s));
  };

  const refetch = useCallback(async () => {
    try {
      const [prods, pos] = await Promise.all([
        apiFetch(API + '/products'),
        apiFetch(API + '/purchase-orders'),
      ]);
      setProducts(prods);
      setPurchaseOrders(pos);
    } catch (err) {
      console.error('refetch (products) failed:', err);
    }
    try {
      const [tasks, specialists] = role === 'product_manager'
        ? await Promise.all([
            apiFetch(API + '/tasks'),
            apiFetch(API + '/tasks/specialists'),
          ])
        : [await apiFetch(API + '/tasks'), []];
      setProcurementTasks(tasks);
      if (role === 'product_manager') {
        setManagerEmployees(specialists);
      } else {
        setManagerEmployees([]);
        setManagerEmployeeFilter('all');
      }
    } catch (err) {
      console.error('refetch (procurement tasks) failed:', err);
    }
    try {
      const [opts, skus] = await Promise.all([
        apiFetch(API + '/sample-options'),
        apiFetch(API + '/sample-sku-lines'),
      ]);
      setSampleOptions(opts);
      setSampleSkuLines(prev => {
        const pending = pendingSkuActionsRef.current;
        if (pending.size === 0) return skus;
        const previousById = new Map(prev.map(s => [s.id, s]));
        return skus.map((sku: SampleSkuLine) => pending.has(sku.id) ? (previousById.get(sku.id) || sku) : sku);
      });
    } catch (err) {
      console.error('refetch (sample data) failed:', err);
    }
  }, [role]);

  useEffect(() => {
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  useEffect(() => {
    if (
      role === 'product_manager' &&
      managerEmployeeFilter !== 'all' &&
      !managerEmployees.some(employee => employee.employeeId === managerEmployeeFilter)
    ) {
      setManagerEmployeeFilter('all');
    }
  }, [managerEmployees, managerEmployeeFilter, role]);

  // 30秒自动轮询（仅在非loading时触发，避免刷新冲突）
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!loading) {
        refetch();
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [loading, refetch]);


  const logout = async () => {
    await fetch(API + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/login';
  };

  const createProcurementTask = async (
    task: Partial<ProcurementTask> & { assigneeEmployeeIds?: string[] }
  ): Promise<ProcurementTask> => {
    const created = await apiFetch(API + '/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    setProcurementTasks(prev => [created, ...prev]);
    return created;
  };

  const updateProcurementTask = async (id: string, updates: Partial<ProcurementTask>): Promise<ProcurementTask> => {
    const updated = await apiFetch(API + '/tasks/' + id, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setProcurementTasks(prev => prev.map(task => task.id === id ? updated : task));
    return updated;
  };

  const markProcurementTaskRead = async (id: string): Promise<void> => {
    const read = await apiFetch(API + '/tasks/' + id + '/read', { method: 'POST' });
    setProcurementTasks(prev => prev.map(task => task.id === id ? { ...task, readAt: read.readAt || new Date().toISOString() } : task));
  };

  const addProduct = (product: Partial<ProductWithCodes>, skus?: SkuInput[]): Promise<ProductWithCodes> => {
    const action =
      product.status === 'pending_analysis' ? 'submit_analysis'
      : product.status === 'pending_info' ? 'pending_info'
      : 'draft';

    return apiFetch(API + '/products', {
      method: 'POST',
      body: JSON.stringify({
        ...product,
        action,
        submitterName: product.submitterName || currentUser.name,
        employeeId: product.employeeId || currentUser.id,
        department: product.department || currentUser.department,
        skus: skus || [],
      }),
    })
      .then((newProd: Product) => {
        setProducts(prev => [newProd, ...prev]);
        refetch();
        return newProd;
      });
  };

  const updateProduct = (
    id: string,
    updates: Partial<ProductWithCodes>,
    _logAction?: string,
    note?: string,
  ) => {
    const status = updates.status;
    let url: string;
    let method: string;
    let body: Record<string, unknown>;

    if (status === 'screening_submitted') {
      url = API + '/products/' + id + '/submit-screening';
      method = 'POST';
      body = {
        employeeNote: note || (updates as any).employeeNote || '',
        submitterName: currentUser.name,
      };
    } else if (status === 'pending_sampling') {
      url = API + '/products/' + id + '/manager-action';
      method = 'POST';
      body = {
        action: 'approve',
        managerName: currentUser.name,
        comment: (updates as any).managerComment || note || '',
      };
    } else if (status === 'pending_purchase') {
      return Promise.reject(new Error('pending_purchase must be set through managerDecision'));
    } else if (status === 'rejected') {
      url = API + '/products/' + id + '/manager-action';
      method = 'POST';
      body = {
        action: 'reject',
        managerName: currentUser.name,
        comment: (updates as any).managerComment || note || '',
      };
    } else if (status === 'supplier_change_requested') {
      return Promise.reject(new Error('supplier_change_requested must be set through sampleAction'));
    } else if (status === 'returned') {
      url = API + '/products/' + id + '/manager-action';
      method = 'POST';
      body = { action: 'return', managerName: currentUser.name, comment: note || '' };
    } else if (status === 'pending_analysis') {
      url = API + '/products/' + id;
      method = 'PUT';
      body = { ...updates, submitterName: currentUser.name, action: 'submit_analysis' };
    } else if (status === 'analyzed_pending_review') {
      url = API + '/products/' + id + '/run-analysis';
      method = 'POST';
      body = {};
    } else if (status === 'pending_info') {
      url = API + '/products/' + id;
      method = 'PUT';
      body = { ...updates, submitterName: currentUser.name, action: 'pending_info' };
    } else if ((status as string) === 'save_draft') {
      url = API + '/products/' + id;
      method = 'PUT';
      const { status: _omit, ...rest } = updates;
      body = { ...rest, submitterName: currentUser.name, action: 'save_draft' };
    } else {
      url = API + '/products/' + id;
      method = 'PUT';
      body = { ...updates, submitterName: currentUser.name, action: 'draft' };
    }

    return apiFetch(url, { method, body: JSON.stringify(body) })
      .then((updated: Product) => {
        if (updated?.id) {
          setProducts(prev => prev.map(p => p.id === id ? updated : p));
        }
      });
  };

  const sampleAction = (id: string, action: string, data?: Record<string, unknown>): Promise<void> => {
    return apiFetch(API + '/products/' + id + '/sample-action', {
      method: 'POST',
      body: JSON.stringify({ action, ...data }),
    }).then((updated: Product) => {
      if (updated?.id) {
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
      }
    });
  };

  // SKU级采购动作 - 操作后局部刷新
  const skuPurchaseAction = async (productId: string, skuLineId: string, action: string, data?: Record<string, unknown>): Promise<void> => {
    // 执行操作 - 后端返回更新后的产品对象
    const updatedProduct = await apiFetch(API + "/products/" + productId + "/sample-action", {
      method: "POST",
      body: JSON.stringify({ skuLineId, action, ...data }),
    });
    // 立即更新产品状态（UI先响应）
    setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
    // 并行拉取最新SKU和方案数据（不阻塞返回，后台刷新）
    Promise.all([
      apiFetch(API + "/sample-sku-lines"),
      apiFetch(API + "/sample-options"),
    ]).then(([skus, opts]) => {
      setSampleSkuLines(skus);
      setSampleOptions(opts);
    });
  };

  // Purchase state changes wait for the API result; pending rows are protected from stale polling overwrites.
  const fastSkuPurchaseAction = async (productId: string, skuLineId: string, action: string, data?: Record<string, unknown>): Promise<void> => {
    if (pendingSkuActionsRef.current.has(skuLineId)) return;
    pendingSkuActionsRef.current.add(skuLineId);

    try {
      const response = await apiFetch(API + "/products/" + productId + "/sample-action", {
        method: "POST",
        body: JSON.stringify({ skuLineId, action, ...data }),
      });
      const { updatedSku, ...updatedProduct } = response;
      const nextSku = updatedSku || await apiFetch(API + "/sample-sku-lines/" + skuLineId);

      setProducts(prev => prev.map(p => p.id === productId ? updatedProduct : p));
      setSampleSkuLines(prev => prev.map(s => s.id === skuLineId ? nextSku : s));
    } finally {
      pendingSkuActionsRef.current.delete(skuLineId);
    }
  };

  const completePurchase = async (productId: string): Promise<void> => {
    const updatedProduct = await apiFetch(API + '/products/' + productId + '/sample-action', {
      method: 'POST',
      body: JSON.stringify({ action: 'complete' }),
    });
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updatedProduct } : p));
    Promise.all([
      apiFetch(API + '/sample-sku-lines'),
      apiFetch(API + '/sample-options'),
    ]).then(([skus, opts]) => {
      setSampleSkuLines(skus);
      setSampleOptions(opts);
    }).catch(err => console.error('completePurchase refetch failed:', err));
  };

  const addPurchaseOrder = (po: Partial<PurchaseOrder>) => {
    apiFetch(API + '/purchase-orders', {
      method: 'POST',
      body: JSON.stringify({
        productId: po.productId,
        productName: po.productName,
        supplierName: po.supplierName,
        purchasePrice: po.purchasePrice,
        quantity: po.quantity,
        totalAmount: po.totalAmount,
      }),
    })
      .then((newPo: PurchaseOrder) => {
        setPurchaseOrders(prev => [newPo, ...prev]);
      })
      .catch(err => console.error('addPurchaseOrder failed:', err));
  };

  const updatePurchaseOrderStatus = (id: string, status: PurchaseOrder['status']) => {
    const now = new Date().toISOString();
    const timestamps: Record<string, unknown> = {};
    if (status === 'ordered')   timestamps.orderedAt   = now;
    if (status === 'arrived')   timestamps.arrivedAt   = now;
    if (status === 'completed') timestamps.completedAt = now;

    apiFetch(API + '/purchase-orders/' + id, {
      method: 'PUT',
      body: JSON.stringify({ status, operator: currentUser.name, ...timestamps }),
    })
      .then((updated: PurchaseOrder) => {
        if (updated?.id) {
          setPurchaseOrders(prev => prev.map(po => po.id === id ? updated : po));
        }
      })
      .catch(err => console.error('updatePurchaseOrderStatus failed:', err));
  };

  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => {
    apiFetch(API + '/purchase-orders/' + id, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, operator: currentUser.name }),
    })
      .then((updated: PurchaseOrder) => {
        if (updated?.id) {
          setPurchaseOrders(prev => prev.map(po => po.id === id ? updated : po));
        }
      })
      .catch(err => console.error('updatePurchaseOrder failed:', err));
  };

  const addSampleOption = async (option: Partial<SampleOption>): Promise<SampleOption> => {
    const created = await apiFetch(API + '/sample-options', {
      method: 'POST',
      body: JSON.stringify({ ...option, createdBy: currentUser.name }),
    });
    setSampleOptions(prev => [...prev, created]);
    return created;
  };

  const updateSampleOption = async (id: string, updates: Partial<SampleOption>): Promise<SampleOption> => {
    const updated = await apiFetch(API + '/sample-options/' + id, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setSampleOptions(prev => prev.map(o => o.id === id ? updated : o));
    return updated;
  };

  const updateSampleOptionStatus = async (id: string, sampleOrderStatus: string): Promise<SampleOption> => {
    const updated = await apiFetch(API + '/sample-options/' + id + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ sampleOrderStatus }),
    });
    setSampleOptions(prev => prev.map(o => o.id === id ? updated : o));
    return updated;
  };

  const deleteSampleOption = async (id: string): Promise<void> => {
    await apiFetch(API + '/sample-options/' + id, { method: 'DELETE' });
    setSampleOptions(prev => prev.filter(o => o.id !== id));
    setSampleSkuLines(prev => prev.filter(s => s.sampleOptionId !== id));
  };

  const addSampleSkuLine = async (sku: Partial<SampleSkuLine>): Promise<SampleSkuLine> => {
    const created = await apiFetch(API + '/sample-sku-lines', {
      method: 'POST',
      body: JSON.stringify(sku),
    });
    setSampleSkuLines(prev => [...prev, created]);
    return created;
  };

  const updateSampleSkuLine = async (id: string, updates: Partial<SampleSkuLine>): Promise<SampleSkuLine> => {
    const updated = await apiFetch(API + '/sample-sku-lines/' + id, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setSampleSkuLines(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  };

  const deleteSampleSkuLine = async (id: string): Promise<void> => {
    await apiFetch(API + '/sample-sku-lines/' + id, { method: 'DELETE' });
    setSampleSkuLines(prev => prev.filter(s => s.id !== id));
  };

  const updateSkuEvaluation = async (
    skuLineId: string,
    evaluation: {
      skuConsistentWithImage?: boolean;
      skuMaterialEval?: string;
      skuWorkmanshipEval?: string;
      skuFunctionEval?: string;
      skuRemarks?: string;
      packingQuantity?: number;
    }
  ): Promise<void> =>
  {
    const url = API + '/sample-sku-lines/' + skuLineId + '/evaluation';
    const updated = await apiFetch(url, {
      method: 'PUT',
      body: JSON.stringify({ ...evaluation, operator: currentUser?.name || 'Anonymous' }),
    });
    // 只更新对应的SKU行数据，避免全量refetch导致输入卡顿和位置重排
    setSampleSkuLines(prev => prev.map(s => s.id === skuLineId ? updated : s));
  };

  // 经理决策 - 优化：局部更新而非全量refetch
  const managerDecision = async (
    productId: string,
    payload: {
      action: 'approve' | 'reject';
      selectedOptionId?: string;
      selectedOptionIds?: string[];
      selectedSkuIds?: string[];
      skuQuantities?: Record<string, number>;
      comment?: string;
    },
  ): Promise<void> => {
    const updated = await apiFetch(API + '/products/' + productId + '/manager-decision', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // 局部更新产品数据
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updated } : p));
    // 批准采购会同步写入方案选择和 SKU 采购数量；后台刷新即可，不能让刷新失败误报为审批失败。
    Promise.all([
      apiFetch(API + '/sample-options'),
      apiFetch(API + '/sample-sku-lines'),
    ]).then(([opts, skus]) => {
      setSampleOptions(opts);
      setSampleSkuLines(skus);
    }).catch(err => console.error('managerDecision sample refetch failed:', err));
  };


  return (
      <StoreContext.Provider
      value={{
        role, currentUser, products: visibleProducts,
        managerEmployees, managerEmployeeFilter, setManagerEmployeeFilter,
        purchaseOrders, sampleOptions, sampleSkuLines, procurementTasks: visibleProcurementTasks, loading,
        logout, addProduct, updateProduct, sampleAction,
        skuPurchaseAction: fastSkuPurchaseAction, completePurchase,
        addPurchaseOrder, updatePurchaseOrderStatus, updatePurchaseOrder,
        addSampleOption, updateSampleOption, updateSampleOptionStatus, deleteSampleOption,
        addSampleSkuLine, updateSampleSkuLine, deleteSampleSkuLine, updateSkuEvaluation,
        managerDecision,
        reportSamplingAnomaly,
        approveSamplingAnomaly,
        createProcurementTask,
        updateProcurementTask,
        markProcurementTaskRead,
        refetch,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used within StoreProvider');
  return ctx;
}
