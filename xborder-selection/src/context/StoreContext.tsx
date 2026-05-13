import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product, PurchaseOrder } from '@workspace/api-client-react/src/generated/api.schemas';

const API = '/api';

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
  createdAt: string;
  updatedAt: string;
}

interface StoreState {
  role: UserRole;
  currentUser: { name: string; id: string; department: string };
  products: Product[];
  purchaseOrders: PurchaseOrder[];
  sampleOptions: SampleOption[];
  sampleSkuLines: SampleSkuLine[];
  loading: boolean;
  logout: () => Promise<void>;
  addProduct: (product: Partial<Product>, skus?: SkuInput[]) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>, logAction?: string, note?: string) => Promise<void>;
  sampleAction: (id: string, action: string, data?: Record<string, unknown>) => Promise<void>;
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
  managerDecision: (productId: string, payload: {
    action: 'approve' | 'reject';
    selectedOptionId?: string;        // 保留向后兼容
    selectedOptionIds?: string[];     // 新增：多方案
    selectedSkuIds?: string[];
    skuQuantities?: Record<string, number>;
    comment?: string;
  }) => Promise<void>;
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
    throw new Error(`网络请求失败：${hint}`);
  }
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('登录已失效，请重新登录');
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({ error: '权限不足' }));
    const msg = body.error || '权限不足，当前角色无法执行此操作';
    alert(`🚫 ${msg}`);
    throw new Error(`403 权限不足: ${msg}`);
  }
  if (res.status === 404) {
    throw new Error('404 资源不存在，请刷新页面后重试');
  }
  if (res.status >= 500) {
    const body = await res.text().catch(() => '');
    throw new Error(`服务端异常（${res.status}），请稍后重试。${body ? '详情：' + body.slice(0, 200) : ''}`);
  }
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`请求失败（${res.status}）：${err || '未知错误'}`);
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

  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [sampleOptions, setSampleOptions] = useState<SampleOption[]>([]);
  const [sampleSkuLines, setSampleSkuLines] = useState<SampleSkuLine[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const [prods, pos] = await Promise.all([
        apiFetch(`${API}/products`),
        apiFetch(`${API}/purchase-orders`),
      ]);
      setProducts(prods);
      setPurchaseOrders(pos);
    } catch (err) {
      console.error('refetch (products) failed:', err);
    }
    try {
      const [opts, skus] = await Promise.all([
        apiFetch(`${API}/sample-options`),
        apiFetch(`${API}/sample-sku-lines`),
      ]);
      setSampleOptions(opts);
      setSampleSkuLines(skus);
    } catch (err) {
      console.error('refetch (sample data) failed:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  const logout = async () => {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/login';
  };

  const addProduct = (product: Partial<Product>, skus?: SkuInput[]): Promise<Product> => {
    const action =
      product.status === 'pending_analysis' ? 'submit_analysis'
      : product.status === 'pending_info' ? 'pending_info'
      : 'draft';

    return apiFetch(`${API}/products`, {
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
    updates: Partial<Product>,
    _logAction?: string,
    note?: string,
  ) => {
    const status = updates.status;
    let url: string;
    let method: string;
    let body: Record<string, unknown>;

    if (status === 'screening_submitted') {
      url = `${API}/products/${id}/submit-screening`;
      method = 'POST';
      body = {
        employeeNote: note || (updates as any).employeeNote || '',
        submitterName: currentUser.name,
      };
    } else if (status === 'pending_sampling') {
      url = `${API}/products/${id}/manager-action`;
      method = 'POST';
      body = {
        action: 'approve',
        managerName: currentUser.name,
        comment: (updates as any).managerComment || note || '',
      };
    } else if (status === 'pending_purchase') {
      url = `${API}/products/${id}/manager-action`;
      method = 'POST';
      body = {
        action: 'approve',
        managerName: currentUser.name,
        comment: (updates as any).managerComment || note || '',
      };
    } else if (status === 'rejected') {
      url = `${API}/products/${id}/manager-action`;
      method = 'POST';
      body = {
        action: 'reject',
        managerName: currentUser.name,
        comment: (updates as any).managerComment || note || '',
      };
    } else if (status === 'supplier_change_requested') {
      url = `${API}/products/${id}/manager-action`;
      method = 'POST';
      body = {
        action: 'request_supplier_change',
        managerName: currentUser.name,
        comment: (updates as any).managerComment || note || '',
      };
    } else if (status === 'returned') {
      url = `${API}/products/${id}/manager-action`;
      method = 'POST';
      body = { action: 'return', managerName: currentUser.name, comment: note || '' };
    } else if (status === 'pending_analysis') {
      url = `${API}/products/${id}`;
      method = 'PUT';
      body = { ...updates, submitterName: currentUser.name, action: 'submit_analysis' };
    } else if (status === 'analyzed_pending_review') {
      url = `${API}/products/${id}/run-analysis`;
      method = 'POST';
      body = {};
    } else if (status === 'pending_info') {
      url = `${API}/products/${id}`;
      method = 'PUT';
      body = { ...updates, submitterName: currentUser.name, action: 'pending_info' };
    } else {
      url = `${API}/products/${id}`;
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
    return apiFetch(`${API}/products/${id}/sample-action`, {
      method: 'POST',
      body: JSON.stringify({ action, ...data }),
    }).then((updated: Product) => {
      if (updated?.id) {
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
      }
    });
  };

  const addPurchaseOrder = (po: Partial<PurchaseOrder>) => {
    apiFetch(`${API}/purchase-orders`, {
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

    apiFetch(`${API}/purchase-orders/${id}`, {
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
    apiFetch(`${API}/purchase-orders/${id}`, {
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
    const created = await apiFetch(`${API}/sample-options`, {
      method: 'POST',
      body: JSON.stringify({ ...option, createdBy: currentUser.name }),
    });
    setSampleOptions(prev => [...prev, created]);
    return created;
  };

  const updateSampleOption = async (id: string, updates: Partial<SampleOption>): Promise<SampleOption> => {
    const updated = await apiFetch(`${API}/sample-options/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setSampleOptions(prev => prev.map(o => o.id === id ? updated : o));
    return updated;
  };

  const updateSampleOptionStatus = async (id: string, sampleOrderStatus: string): Promise<SampleOption> => {
    const updated = await apiFetch(`${API}/sample-options/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ sampleOrderStatus }),
    });
    setSampleOptions(prev => prev.map(o => o.id === id ? updated : o));
    return updated;
  };

  const deleteSampleOption = async (id: string): Promise<void> => {
    await apiFetch(`${API}/sample-options/${id}`, { method: 'DELETE' });
    setSampleOptions(prev => prev.filter(o => o.id !== id));
    setSampleSkuLines(prev => prev.filter(s => s.sampleOptionId !== id));
  };

  const addSampleSkuLine = async (sku: Partial<SampleSkuLine>): Promise<SampleSkuLine> => {
    const created = await apiFetch(`${API}/sample-sku-lines`, {
      method: 'POST',
      body: JSON.stringify(sku),
    });
    setSampleSkuLines(prev => [...prev, created]);
    return created;
  };

  const updateSampleSkuLine = async (id: string, updates: Partial<SampleSkuLine>): Promise<SampleSkuLine> => {
    const updated = await apiFetch(`${API}/sample-sku-lines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setSampleSkuLines(prev => prev.map(s => s.id === id ? updated : s));
    return updated;
  };

  const deleteSampleSkuLine = async (id: string): Promise<void> => {
    await apiFetch(`${API}/sample-sku-lines/${id}`, { method: 'DELETE' });
    setSampleSkuLines(prev => prev.filter(s => s.id !== id));
  };

  const managerDecision = async (
    productId: string,
    payload: {
      action: 'approve' | 'reject';
      selectedOptionId?: string;
      selectedSkuIds?: string[];
      skuQuantities?: Record<string, number>;
      comment?: string;
    },
  ): Promise<void> => {
    await apiFetch(`${API}/products/${productId}/manager-decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refetch();
  };

  return (
    <StoreContext.Provider
      value={{
        role, currentUser, products, purchaseOrders, sampleOptions, sampleSkuLines, loading,
        logout, addProduct, updateProduct, sampleAction,
        addPurchaseOrder, updatePurchaseOrderStatus, updatePurchaseOrder,
        addSampleOption, updateSampleOption, updateSampleOptionStatus, deleteSampleOption,
        addSampleSkuLine, updateSampleSkuLine, deleteSampleSkuLine,
        managerDecision,
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
