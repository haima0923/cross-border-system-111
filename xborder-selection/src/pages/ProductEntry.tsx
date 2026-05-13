/**
 * FIELD_REGISTRY — 录入表单字段清单（唯一真相源）
 *
 * 每次后端 schema 或 API spec 新增字段时，必须在此表格同步更新：
 *
 * ┌──────────────────┬──────────┬─────────────┬──────────┬──────────────────────────────┐
 * │ 字段名            │ 类型     │ initialForm  │ 必填     │ 说明                         │
 * ├──────────────────┼──────────┼─────────────┼──────────┼──────────────────────────────┤
 * │ productName      │ string   │ ''          │ ✓        │ 产品名称                     │
 * │ productSource    │ select   │ '1688'      │ ✓        │ 产品来源（有默认值也算必填）  │
 * │ link1688         │ string   │ ''          │ ✓        │ 采购链接                     │
 * │ supplierName     │ string   │ ''          │ ✓        │ 供应商名称                   │
 * │ purchasePrice    │ numeric  │ undefined   │ ✓        │ 参考采购单价                 │
 * │ weight           │ numeric  │ undefined   │ ✓        │ 毛重                        │
 * │ length           │ numeric  │ undefined   │ ✓        │ 包装长                      │
 * │ width            │ numeric  │ undefined   │ ✓        │ 包装宽                      │
 * │ height           │ numeric  │ undefined   │ ✓        │ 包装高                      │
 * │ material         │ string   │ ''          │ ✓        │ 主要材质                     │
 * │ usage            │ string   │ ''          │ ✓        │ 主要用途                     │
 * │ imageUrl         │ string   │ ''          │          │ 产品主图（选填）             │
 * │ logisticsMode    │ select   │ 'sea'       │          │ 物流方式（有默认值，不计必填）│
 * │ suggestedPrice   │ numeric  │ undefined   │          │ 建议售价（选填）             │
 * │ moq              │ numeric  │ undefined   │          │ MOQ（选填）                  │
 * │ remarks          │ string   │ ''          │          │ 备注说明（选填）             │
 * └──────────────────┴──────────┴─────────────┴──────────┴──────────────────────────────┘
 *
 * ❗ 新增字段时必须同步：
 *   1. 在此表格加行
 *   2. 在 initialForm 加对应 key / 默认值
 *   3. 如需必填，加入 requiredFields 数组 + fieldLabels 映射
 *   4. 如为数值型，加入 NUMERIC_FIELDS 数组
 *   5. 渲染对应 input 控件
 *   6. 确认 payload = { ...form } 自动携带（或手动补充）
 *
 * SKU 字段（SkuRow）：imageUrl / skuName / unitPriceStr / moqStr / notes / skuId
 * 新增产品时 skuId 为 undefined，SKU 通过 buildSkuInputs() 打包进 payload.skus，
 * 后端 POST /products 创建 sampleSkuLines 时消费。
 * 换供模式（supplier_changing）时 skuId 为现有 SKU 的 id，通过 updateSampleSkuLine 更新。
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, SkuInput } from '@/context/StoreContext';
import { useLocation, useSearch } from 'wouter';
import { Product } from '@workspace/api-client-react/src/generated/api.schemas';
import { Save, Send, AlertCircle, CheckCircle2, Plus, Trash2, ImageIcon, RefreshCw } from 'lucide-react';

const NUMERIC_FIELDS = ['purchasePrice', 'suggestedPrice', 'weight', 'length', 'width', 'height', 'moq'];

type ProductForm = Partial<Product> & { logisticsMode?: string };

interface SkuRow {
  skuId?: string;
  imageUrl: string;
  skuName: string;
  unitPriceStr: string;
  moqStr: string;
  notes: string;
}

function emptySkuRow(): SkuRow {
  return { skuId: undefined, imageUrl: '', skuName: '', unitPriceStr: '', moqStr: '', notes: '' };
}

const initialForm: ProductForm = {
  productName: '',
  productSource: '1688',
  link1688: '',
  supplierName: '',
  purchasePrice: undefined,
  weight: undefined,
  length: undefined,
  width: undefined,
  height: undefined,
  material: '',
  usage: '',
  imageUrl: '',
  logisticsMode: 'sea',
  suggestedPrice: undefined,
  moq: undefined,
  remarks: '',
};

const requiredFields = [
  'productName', 'productSource', 'link1688', 'supplierName',
  'purchasePrice', 'weight', 'length', 'width', 'height', 'material', 'usage',
];

const fieldLabels: Record<string, string> = {
  productName: '产品名称',
  productSource: '产品来源',
  link1688: '采购链接',
  supplierName: '供应商名称',
  purchasePrice: '采购价',
  weight: '重量',
  length: '长',
  width: '宽',
  height: '高',
  material: '材质',
  usage: '用途',
};

export default function ProductEntry() {
  const {
    currentUser, addProduct, updateProduct, products, loading,
    sampleAction, updateSampleSkuLine, addSampleSkuLine, deleteSampleSkuLine, sampleOptions, sampleSkuLines,
  } = useAppStore();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const editId = searchParams.get('id');

  const [form, setForm] = useState<ProductForm>(initialForm);
  const [numStr, setNumStr] = useState<Record<string, string>>({});
  const [skuRows, setSkuRows] = useState<SkuRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracks which editId we have already loaded into the form.
  // Prevents products re-fetches from overwriting user edits.
  const loadedForEditId = useRef<string | null>(null);

  // isDirtyRef: set to true the moment the user touches any field.
  // Once dirty, ALL external setForm calls are blocked — regardless of
  // where the data comes from (background refetch, role switch, re-login).
  // Reset to false only when editId changes (Effect A), i.e. on a new route.
  const isDirtyRef = useRef(false);

  // Effect A: Full reset whenever the route changes (editId changes).
  // Only depends on [editId] — products updates never trigger a reset.
  useEffect(() => {
    setForm({ ...initialForm });
    setNumStr({});
    setSkuRows([]);
    setIsSubmitting(false);
    loadedForEditId.current = null; // allow Effect B to load the new editId
    isDirtyRef.current = false;     // user has not typed anything on this new route
  }, [editId]);

  // Effect B: Load existing product data in edit mode.
  // Guards (in order):
  //   1. editId must exist (not new-entry mode)
  //   2. User must NOT have started editing (isDirtyRef) — once dirty, no
  //      external source may overwrite what the user typed, even if products
  //      arrives late (initial load, background refetch, post-login refetch).
  //   3. We only initialise the form ONCE per editId (loadedForEditId).
  // In supplier_changing mode, also pre-fills skuRows from existing sampleSkuLines.
  // The guard is only marked complete once both product AND (if needed) SKU data are ready.
  useEffect(() => {
    if (!editId) return;
    if (isDirtyRef.current) return;
    if (loadedForEditId.current === editId) return;
    const existing = products.find(p => p.id === editId);
    if (!existing) return;

    setForm({ ...existing, logisticsMode: (existing as any).logisticsMode || 'sea' });
    const initialNumStr: Record<string, string> = {};
    for (const field of NUMERIC_FIELDS) {
      const val = existing[field as keyof Product];
      if (val != null) initialNumStr[field] = String(val);
    }
    setNumStr(initialNumStr);

    // In edit mode: pre-fill SKU rows from existing sampleSkuLines.
    // If sampleOptions not yet loaded, bail without marking loaded — effect will
    // re-run when sampleOptions/sampleSkuLines arrive via the dependency array.
    {
      const option = sampleOptions.find(o => o.productId === editId);
      if (!option) {
        // sampleOptions not loaded yet — bail without marking, effect will re-run
        return;
      }
      const existingSkus = sampleSkuLines.filter(s => s.sampleOptionId === option.id);
      if (existingSkus.length > 0) {
        setSkuRows(existingSkus.map(sku => ({
          skuId:        sku.id,
          imageUrl:     sku.imageUrl  || '',
          skuName:      sku.skuName   || '',
          unitPriceStr: sku.unitPrice != null ? String(Number(sku.unitPrice)) : '',
          moqStr:       sku.moq       != null ? String(sku.moq) : '',
          notes:        sku.notes     || '',
        })));
      }
    }

    loadedForEditId.current = editId;
  }, [editId, products, sampleOptions, sampleSkuLines]);

  // Detect if we're in supplier_changing mode (负向决策回流)
  const editProduct = editId ? products.find(p => p.id === editId) : null;
  const isSupplierChangingMode = editProduct?.status === 'supplier_changing';
  // 草稿/待补充状态下，SKU应完全可编辑（可添加/删除/修改）
  const isSkuEditable = !editId || isSupplierChangingMode || editProduct?.status === 'draft' || editProduct?.status === 'pending_info';

  // ── Edit-mode gate ────────────────────────────────────────────────────────
  // When editId is set but the product data has not yet arrived, we must NOT
  // show a blank editable form — the user would start typing into empty fields
  // and isDirtyRef would block the real data from loading later.
  //
  //   • Still loading (StoreContext loading=true)  → show skeleton
  //   • Loaded but not found                       → show error
  //   • Found                                      → fall through to form
  //
  // New-entry mode (editId === null) skips this gate entirely.
  if (editId) {
    if (loading && !editProduct) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">编辑候选产品</h1>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center gap-4 text-slate-400">
            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm">正在加载原产品数据，请稍候…</p>
          </div>
        </div>
      );
    }
    if (!loading && !editProduct) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">编辑候选产品</h1>
          </div>
          <div className="bg-white rounded-2xl border border-red-200 p-12 flex flex-col items-center gap-4 text-red-400">
            <AlertCircle size={32} />
            <p className="text-sm font-medium">未找到产品数据（ID: {editId}）</p>
            <p className="text-xs text-slate-400">请检查链接是否正确，或返回工作台重新选择。</p>
            <button
              onClick={() => setLocation('/workbench')}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm transition-colors"
            >
              返回工作台
            </button>
          </div>
        </div>
      );
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    isDirtyRef.current = true;
    const { name, value } = e.target;
    if (NUMERIC_FIELDS.includes(name)) {
      setNumStr(prev => ({ ...prev, [name]: value }));
      if (value === '' || value === '-') {
        setForm(prev => ({ ...prev, [name]: undefined }));
      } else {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          setForm(prev => ({ ...prev, [name]: parsed }));
        }
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const numVal = (name: string) => {
    if (name in numStr) return numStr[name];
    const v = form[name as keyof ProductForm];
    return v != null ? String(v) : '';
  };

  const handleSkuChange = (idx: number, field: keyof SkuRow, value: string) => {
    isDirtyRef.current = true;
    setSkuRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const addSkuRow = () => {
    isDirtyRef.current = true;
    setSkuRows(prev => [...prev, emptySkuRow()]);
  };

  const removeSkuRow = (idx: number) => {
    isDirtyRef.current = true;
    setSkuRows(prev => prev.filter((_, i) => i !== idx));
  };

  const buildSkuInputs = (): SkuInput[] => {
    return skuRows.map(row => ({
      skuName: row.skuName.trim() || '默认款',
      unitPrice: row.unitPriceStr !== '' ? parseFloat(row.unitPriceStr) : (form.purchasePrice as number | undefined),
      moq: form.moq as number | undefined,
      notes: row.notes.trim() || undefined,
      imageUrl: row.imageUrl.trim() || undefined,
    })).filter(s => s.unitPrice == null || !isNaN(s.unitPrice as number));
  };

  const filledRequiredFields = requiredFields.filter(field => {
    const val = form[field as keyof ProductForm];
    return val !== null && val !== undefined && val !== '';
  });
  const progress = Math.round((filledRequiredFields.length / requiredFields.length) * 100);
  const missingFields = requiredFields.filter(field => {
    const val = form[field as keyof ProductForm];
    return val === null || val === undefined || val === '';
  });

  const handleAction = async (action: 'draft' | 'pending_info' | 'analyze') => {
    if (action === 'analyze' && progress < 100) {
      alert('请填写所有必填字段后再提交分析');
      return;
    }
    if (action === 'analyze' && form.moq != null && !Number.isInteger(Number(form.moq))) {
      alert('MOQ 必须为整数，请修改后重新提交');
      return;
    }

    const statusMap = { 'draft': 'draft', 'pending_info': 'pending_info', 'analyze': 'pending_analysis' };
    const payload = {
      ...form,
      status: statusMap[action] as any,
      submitterName: currentUser.name,
      employeeId: currentUser.id,
      department: currentUser.department,
    };

    if (editId) {
      setIsSubmitting(true);
      try {
        // 先保存产品基础信息
        await updateProduct(editId, payload, action === 'analyze' ? '提交AI分析' : (action === 'pending_info' ? '标记待补充' : '保存草稿'));

        // 草稿/待补充状态下，同步SKU变更到数据库
        if (isSkuEditable) {
          const option = sampleOptions.find(o => o.productId === editId);
          if (option) {
            const existingSkus = sampleSkuLines.filter(s => s.sampleOptionId === option.id);
            const existingIds = new Set(existingSkus.map(s => s.id));

            // 1. 更新已有SKU
            for (const row of skuRows) {
              if (row.skuId && existingIds.has(row.skuId)) {
                await updateSampleSkuLine(row.skuId, {
                  skuName: row.skuName.trim() || undefined,
                  unitPrice: row.unitPriceStr !== '' ? Number(row.unitPriceStr) : undefined,
                  moq: row.moqStr !== '' ? parseInt(row.moqStr, 10) : undefined,
                  notes: row.notes.trim() || undefined,
                });
                existingIds.delete(row.skuId);
              }
            }
            // 2. 新增没有skuId的行
            for (const row of skuRows) {
              if (!row.skuId) {
                await addSampleSkuLine({
                  sampleOptionId: option.id,
                  skuName: row.skuName.trim() || '默认款',
                  unitPrice: row.unitPriceStr !== '' ? Number(row.unitPriceStr) : form.purchasePrice as number | undefined,
                  moq: row.moqStr !== '' ? parseInt(row.moqStr, 10) : form.moq as number | undefined,
                  notes: row.notes.trim() || undefined,
                  imageUrl: row.imageUrl.trim() || undefined,
                });
              }
            }
            // 3. 删除已移除的SKU
            for (const deletedId of existingIds) {
              await deleteSampleSkuLine(deletedId);
            }
          }
        }
      } catch (err) {
        console.error('编辑提交失败:', err);
      } finally {
        setIsSubmitting(false);
      }
      setLocation('/workbench');
    } else {
      if (action === 'analyze') {
        setIsSubmitting(true);
        try {
          await addProduct(payload, buildSkuInputs());
          setIsSubmitting(false);
          setLocation('/workbench');
        } catch (err) {
          console.error('提交失败:', err);
          setIsSubmitting(false);
          alert('提交失败，请重试');
        }
      } else {
        addProduct(payload, buildSkuInputs()).catch(err => console.error('保存失败:', err));
        setLocation('/workbench');
      }
    }
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isSupplierChangingMode ? '更换供应商' : editId ? '编辑候选产品' : '新增候选录入'}
        </h1>
        <p className="text-slate-500 mt-1">
          {isSupplierChangingMode
            ? '请更新供应商信息（供应商名称、采购链接等），确认无误后点击"换供完成，提交采样"。'
            : '请填写产品基础信息，以供AI进行初步利润测算和可行性分析。'}
        </p>
      </div>

      {isSupplierChangingMode && editProduct?.managerComment && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <RefreshCw size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800 mb-0.5">管理层换供原因</div>
            <div className="text-sm text-amber-700">{editProduct.managerComment}</div>
          </div>
        </div>
      )}

      {isSupplierChangingMode && (() => {
        const prevName = (editProduct as any)?.previousSupplierName ?? editProduct?.supplierName;
        const prevPrice = (editProduct as any)?.previousPurchasePrice ?? editProduct?.purchasePrice;
        const prevMoq = (editProduct as any)?.previousMoq ?? editProduct?.moq;
        const newPrice = form.purchasePrice as number | undefined;
        const newMoq = form.moq as number | undefined;
        const priceDiff = (newPrice != null && prevPrice != null) ? newPrice - Number(prevPrice) : null;
        const moqDiff = (newMoq != null && prevMoq != null) ? newMoq - Number(prevMoq) : null;
        const diffCls = (n: number) => n > 0 ? 'text-red-600' : n < 0 ? 'text-emerald-600' : 'text-slate-400';
        const fmtDiff = (n: number, prefix = '¥') =>
          `${n > 0 ? '+' : ''}${prefix === '¥' ? n.toFixed(2) : n}`;
        return (
          <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">历史供应商对比</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 w-16 flex-shrink-0">供应商</span>
                <span className="text-slate-600 line-through">{prevName || '—'}</span>
                <span className="text-slate-400 mx-1">→</span>
                <span className={form.supplierName && form.supplierName !== prevName ? 'text-blue-700 font-medium' : 'text-slate-500'}>
                  {form.supplierName || '（未填写）'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 w-16 flex-shrink-0">采购价</span>
                <span className="text-slate-600 line-through">
                  {prevPrice != null ? `¥${Number(prevPrice).toFixed(2)}` : '—'}
                </span>
                <span className="text-slate-400 mx-1">→</span>
                <span className={newPrice != null ? 'text-blue-700 font-medium' : 'text-slate-500'}>
                  {newPrice != null ? `¥${newPrice.toFixed(2)}` : '（未填写）'}
                </span>
                {priceDiff !== null && priceDiff !== 0 && (
                  <span className={`text-xs font-semibold ${diffCls(priceDiff)}`}>
                    {fmtDiff(priceDiff)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400 w-16 flex-shrink-0">MOQ</span>
                <span className="text-slate-600 line-through">
                  {prevMoq != null ? `${prevMoq}` : '—'}
                </span>
                <span className="text-slate-400 mx-1">→</span>
                <span className={newMoq != null ? 'text-blue-700 font-medium' : 'text-slate-500'}>
                  {newMoq != null ? `${newMoq}` : '（未填写）'}
                </span>
                {moqDiff !== null && moqDiff !== 0 && (
                  <span className={`text-xs font-semibold ${diffCls(moqDiff)}`}>
                    {fmtDiff(moqDiff, '')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6">

          {/* ── 基础信息 ─────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">基础信息</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">产品名称 <span className="text-red-500">*</span></label>
                <input type="text" name="productName" value={form.productName || ''} onChange={handleChange} className={inputCls} placeholder="例如：多功能户外折叠椅" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">产品来源 <span className="text-red-500">*</span></label>
                <select name="productSource" value={form.productSource || '1688'} onChange={handleChange} className={inputCls}>
                  <option value="1688">1688</option>
                  <option value="拼多多">拼多多</option>
                  <option value="工厂微信">工厂微信</option>
                  <option value="展会">展会</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">供应商名称 <span className="text-red-500">*</span></label>
                <input type="text" name="supplierName" value={form.supplierName || ''} onChange={handleChange} className={inputCls} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">采购链接 <span className="text-red-500">*</span></label>
                <input type="url" name="link1688" value={form.link1688 || ''} onChange={handleChange} className={inputCls} placeholder="https://" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-slate-400" /> 产品主图 URL
                  <span className="text-xs font-normal text-slate-400">（选填）</span>
                </label>
                <input type="url" name="imageUrl" value={form.imageUrl || ''} onChange={handleChange} className={inputCls} placeholder="https://example.com/image.jpg" />
              </div>
            </div>
          </div>

          {/* ── 规格与成本 ───────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">规格与成本</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">参考采购单价 (RMB) <span className="text-red-500">*</span></label>
                <input type="text" inputMode="decimal" name="purchasePrice" value={numVal('purchasePrice')} onChange={handleChange} className={inputCls} placeholder="0.00" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">建议售价 (USD)</label>
                <input type="text" inputMode="decimal" name="suggestedPrice" value={numVal('suggestedPrice')} onChange={handleChange} className={inputCls} placeholder="留空由 AI 推算" />
              </div>

              {/* 物流方式 */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">
                  物流方式
                  <span className="text-xs font-normal text-slate-400 ml-1.5">（影响运费估算）</span>
                </label>
                <select
                  name="logisticsMode"
                  value={(form as any).logisticsMode || 'sea'}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="sea">海运</option>
                  <option value="air">空运</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">MOQ</label>
                <input type="text" inputMode="numeric" name="moq" value={numVal('moq')} onChange={handleChange} className={inputCls} placeholder="1" />
              </div>

              <div className="space-y-1.5 lg:col-span-4">
                <label className="text-sm font-semibold text-slate-700">毛重 (kg) <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-4 gap-3">
                  <input type="text" inputMode="decimal" name="weight" value={numVal('weight')} onChange={handleChange} className={inputCls} placeholder="重量" />
                  <input type="text" inputMode="decimal" name="length" value={numVal('length')} onChange={handleChange} className={inputCls} placeholder="长(cm)" />
                  <input type="text" inputMode="decimal" name="width" value={numVal('width')} onChange={handleChange} className={inputCls} placeholder="宽(cm)" />
                  <input type="text" inputMode="decimal" name="height" value={numVal('height')} onChange={handleChange} className={inputCls} placeholder="高(cm)" />
                </div>
                <p className="text-xs text-slate-400">包装重量 / 长(cm) / 宽(cm) / 高(cm)</p>
              </div>
            </div>
          </div>

          {/* ── SKU 明细（新增/编辑时）───── */}
          {(true) && (
            <div className={`bg-white rounded-2xl shadow-sm border p-6 ${isSupplierChangingMode ? 'border-amber-200' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {isSupplierChangingMode ? 'SKU 信息更新' : editId ? 'SKU 明细（已有数据）' : 'SKU 明细'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isSupplierChangingMode
                      ? '请更新各 SKU 的描述、单价、起订量及备注，提交后将覆盖原数据'
                      : editId
                        ? '以下为已有 SKU 数据，如需修改请通过样品管理操作'
                        : '同一供应商链接下的不同规格（颜色 / 套餐 / 尺寸等）'}
                  </p>
                </div>
                {isSkuEditable && (
                  <button
                    type="button"
                    onClick={addSkuRow}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/8 hover:bg-primary/15 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Plus size={14} /> 添加 SKU
                  </button>
                )}
              </div>

              {skuRows.length === 0 ? (
                isSupplierChangingMode ? (
                  <div className="border-2 border-dashed border-amber-200 rounded-xl py-8 text-center text-amber-400 text-sm">
                    正在加载 SKU 数据…
                  </div>
                ) : editId ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400 text-sm">
                    暂无 SKU 数据
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400 text-sm">
                    点击"添加 SKU"录入不同规格，不添加则默认按采购单价创建一款 SKU
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {skuRows.map((row, idx) => (
                    <div key={row.skuId ?? idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">SKU {idx + 1}</span>
                        {isSkuEditable && (
                          <button
                            type="button"
                            onClick={() => removeSkuRow(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="删除此 SKU"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {isSkuEditable && (
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                              <ImageIcon size={11} className="text-slate-400" /> SKU 图片 URL
                            </label>
                            <input
                              type="url"
                              value={row.imageUrl}
                              onChange={e => handleSkuChange(idx, 'imageUrl', e.target.value)}
                              placeholder="https://...（选填）"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">SKU 描述</label>
                          {isSkuEditable ? (
                            <input
                              type="text"
                              value={row.skuName}
                              onChange={e => handleSkuChange(idx, 'skuName', e.target.value)}
                              placeholder="如：红色款、USB-C版"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          ) : (
                            <span className="block px-3 py-2 text-sm text-slate-700">{row.skuName || '—'}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">单价 (RMB)</label>
                          {isSkuEditable ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.unitPriceStr}
                              onChange={e => handleSkuChange(idx, 'unitPriceStr', e.target.value)}
                              placeholder={form.purchasePrice ? `默认 ¥${form.purchasePrice}` : '0.00'}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          ) : (
                            <span className="block px-3 py-2 text-sm text-slate-700">{row.unitPriceStr ? `¥${row.unitPriceStr}` : '—'}</span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">起订量 (MOQ)</label>
                          {isSkuEditable ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.moqStr}
                              onChange={e => handleSkuChange(idx, 'moqStr', e.target.value)}
                              placeholder="件数"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          ) : (
                            <span className="block px-3 py-2 text-sm text-slate-700">{row.moqStr || '—'}</span>
                          )}
                        </div>
                        <div className={`space-y-1 ${isSupplierChangingMode ? '' : 'sm:col-span-2'}`}>
                          <label className="text-xs font-semibold text-slate-600">备注</label>
                          {isSkuEditable ? (
                            <input
                              type="text"
                              value={row.notes}
                              onChange={e => handleSkuChange(idx, 'notes', e.target.value)}
                              placeholder="可选"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          ) : (
                            <span className="block px-3 py-2 text-sm text-slate-700">{row.notes || '—'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">共 {skuRows.length} 个 SKU 规格</p>
                </div>
              )}
            </div>
          )}

          {/* ── 产品属性 ─────────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">产品属性</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">主要材质 <span className="text-red-500">*</span></label>
                <input type="text" name="material" value={form.material || ''} onChange={handleChange} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">主要用途 <span className="text-red-500">*</span></label>
                <input type="text" name="usage" value={form.usage || ''} onChange={handleChange} className={inputCls} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">备注说明</label>
                <textarea name="remarks" value={form.remarks || ''} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
              </div>
            </div>
          </div>

        </div>

        {/* ── 右侧进度面板 ─────────────────────────────── */}
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
            <h3 className="font-bold text-slate-800 mb-4">填写进度</h3>

            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-slate-600">完成度（必填项）</span>
                <span className={progress === 100 ? 'text-green-600 font-bold' : 'text-primary font-bold'}>{progress}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                共 <span>{requiredFields.length}</span> 个必填项，已填 <span>{filledRequiredFields.length}</span> 个
              </p>
            </div>

            {missingFields.length > 0 ? (
              <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm border border-orange-100 mb-6">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <AlertCircle size={16} /> 缺失必填项:
                </div>
                <ul className="list-disc pl-5 space-y-1 text-orange-700/80">
                  {missingFields.map(f => <li key={f}>{fieldLabels[f]}</li>)}
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 text-green-800 p-4 rounded-xl text-sm border border-green-100 mb-6 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <span className="font-medium">信息已完整，可提交分析。</span>
              </div>
            )}

            {/* 物流方式提示 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-xs text-slate-600">
              <span className="font-semibold">物流方式：</span>
              {((form as any).logisticsMode || 'sea') === 'sea' ? '🚢 海运' : '✈️ 空运'}
              <span className="text-slate-400 ml-1">（影响 AI 运费估算）</span>
            </div>

            {/* SKU 预览 */}
            {!editId && skuRows.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-xs">
                <div className="font-semibold text-slate-600 mb-1.5">SKU 明细预览（{skuRows.length} 款）</div>
                {skuRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-500 py-0.5">
                    {row.imageUrl && (
                      <img src={row.imageUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0 border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <span className="truncate max-w-[110px]">{row.skuName || `SKU ${idx + 1}`}</span>
                    <span className="font-medium text-slate-700 ml-auto">
                      {row.unitPriceStr ? `¥${row.unitPriceStr}` : (form.purchasePrice ? `¥${form.purchasePrice}` : '—')}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 pt-4 border-t border-slate-100">
              {isSupplierChangingMode ? (
                /* Supplier-changing mode: special resubmit button */
                <button
                  disabled={!form.supplierName?.trim() || !form.link1688?.trim() || isSubmitting}
                  onClick={async () => {
                    if (!editId) return;
                    setIsSubmitting(true);
                    try {
                      // ① 先批量更新所有 SKU（Promise.all 保证原子性：任意失败即中止）
                      const skusToUpdate = skuRows.filter(row => row.skuId);
                      if (skusToUpdate.length > 0) {
                        await Promise.all(
                          skusToUpdate.map(row =>
                            updateSampleSkuLine(row.skuId!, {
                              skuName:   row.skuName.trim() || undefined,
                              unitPrice: row.unitPriceStr !== '' ? Number(row.unitPriceStr) : undefined,
                              moq:       row.moqStr !== '' ? parseInt(row.moqStr, 10) : undefined,
                              notes:     row.notes.trim() || undefined,
                            })
                          )
                        );
                      }
                      // ② 全部 SKU 更新成功后，才执行产品状态流转
                      await sampleAction(editId, 'resubmit_supplier', {
                        supplierName:  form.supplierName,
                        link1688:      form.link1688,
                        purchasePrice: form.purchasePrice,
                        moq:           form.moq,
                        remarks:       form.remarks,
                      });
                      setLocation(`/sampling/${editId}`);
                    } catch (err) {
                      console.error('换供提交失败:', err);
                      alert('换供提交失败，请检查网络后重试。若 SKU 更新失败，可重新点击提交（幂等操作，安全重试）。');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-3 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      提交中…
                    </>
                  ) : (
                    <><RefreshCw size={18} /> 换供完成，提交采样</>
                  )}
                </button>
              ) : (
                /* Normal mode: regular submit buttons */
                <>
                  <button
                    onClick={() => handleAction('analyze')}
                    disabled={progress < 100 || isSubmitting}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/90 text-white px-4 py-3 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        提交中…
                      </>
                    ) : (
                      <><Send size={18} /> 提交AI分析</>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAction('draft')}
                      className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
                    >
                      <Save size={16} /> 存草稿
                    </button>
                    <button
                      onClick={() => handleAction('pending_info')}
                      className="flex items-center justify-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2.5 rounded-xl hover:bg-orange-100 transition-colors text-sm font-medium"
                    >
                      标记待补充
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
