# 选品系统 Bug 排查报告

## 问题一：1688 图片链接在系统里不显示

### 现象
用户从 1688 复制图片 URL 粘贴到系统里，图片不显示。新电脑测试完全不显示（之前测试可能因浏览器缓存显示过）。

### 排查过程

1. **前端代码分析** (`/var/www/xborder/xborder-selection/src/components/shared/ProductImage.tsx`)
   - 图片显示使用代理：`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
   - img 标签没有设置 `referrerpolicy` 属性

2. **后端路由检查**
   - 源代码 `api-server/src/routes/imageServing.ts` 中**有** `/image-proxy` 路由实现
   - 但编译后的代码 `api-server/dist/index.mjs` 中**没有** `/image-proxy` 路由
   - 只编译了 `router.get("/storage/objects/*objectPath")`，缺失图片代理路由

3. **服务器测试**
   ```bash
   curl 'http://127.0.0.1:5000/api/image-proxy?url=...'
   # 返回 401 Unauthorized
   ```
   - 所有 `/api/*` 请求都被 `authenticate` 中间件拦截
   - 原因：`imageServingRouter` 虽然在 `authenticate` 之前注册，但编译后的代码中 `/image-proxy` 路由缺失

4. **编译产物对比**
   - 源代码行数正常，包含 `router.get("/image-proxy")`
   - 编译后代码行数减少，缺失图片代理路由
   - PM2 运行的是旧版本编译产物

### 根因
**源代码与编译产物不一致**。源代码中有 `/api/image-proxy` 路由实现，但编译后的 `dist/index.mjs` 缺失该路由。PM2 运行的仍是旧版本代码，导致：
1. 前端请求 `/api/image-proxy?url=...` 无法被正确处理
2. 请求被后续的 `authenticate` 中间件拦截，返回 401
3. 1688 图片无法通过代理显示

### 修复建议
```bash
# 重新编译后端代码
cd /var/www/xborder/api-server
pnpm build

# 重启 PM2 进程
pm2 restart xborder
```

---

## 问题二：样品采样建档的提交按钮时有时无

### 现象
用户说"有时候有提交按钮有时候没有，逻辑混乱"。

### 排查过程

1. **前端代码分析** (`/var/www/xborder/xborder-selection/src/pages/SamplingDetail.tsx`)

   **底部操作栏显示条件**：
   ```tsx
   {!isReadOnly && (status === 'sampling_collection' || status === 'sampling_ready') && (
     <div className="fixed bottom-0 ...">
   ```

   **isReadOnly 定义**：
   ```tsx
   const isReadOnly = status === 'sampling_review_submitted' || status === 'pending_purchase';
   ```

   **canSubmitReady 条件**：
   ```tsx
   const allArrived = myOptions.length >= 3 && 
                      myOptions.every(o => (o.sampleOrderStatus || 'pending') === 'arrived');
   const canSubmitReady = myOptions.length >= 3 && allArrived && status === 'sampling_collection';
   ```

   **按钮 disabled 条件**：
   - "开始验样"：`disabled={!canSubmitReady || submittingReady}`
   - "提交验样结果"：`disabled={!canSubmitReview || submittingReview}`

2. **状态流转分析**
   - `pending_sampling` → `sampling` (自动触发 `start_sampling_collection`)
   - `sampling` → `sample_arrived` (标记样品到货)
   - `sample_arrived` → `sampling_ready` (员工开始验样)
   - `sampling_ready` → `sampling_review_submitted` (提交验样结果)

### 根因
**多重条件叠加导致的 UX 问题**：

1. **按钮实际不会"消失"**，但会因以下原因看起来"异常"：
   - 按钮 disabled 时显示为灰色，用户可能误认为消失
   - 状态切换时，`sampling_collection` 显示"保存草稿"+"开始验样"，`sampling_ready` 显示"提交验样结果"，按钮会**切换**而非消失

2. **canSubmitReady 条件过于严格**：
   - 需要 `myOptions.length >= 3`（至少3个方案）
   - 需要 `allArrived`（所有方案的 sampleOrderStatus 都是 'arrived'）
   - 任一条件不满足时按钮 disabled

3. **状态自动触发逻辑**：
   ```tsx
   useEffect(() => {
     if (status === 'pending_sampling' && !startingCollection) {
       setStartingCollection(true);
       sampleAction(id, 'start_sampling_collection').finally(() => setStartingCollection(false));
     }
   }, [status]);
   ```
   - 进入页面时自动触发采样，状态从 `pending_sampling` 变为 `sampling`
   - 页面状态变化可能导致 UI 闪烁

### 修复建议
1. **添加空状态提示**：当条件不满足时，明确告知用户缺少什么
2. **按钮始终显示但提示原因**：
   ```tsx
   <button disabled={!canSubmitReady}>
     {myOptions.length < 3 ? `还需添加 ${3 - myOptions.length} 个方案` : 
      !allArrived ? '请等待所有方案样品到货' : '开始验样'}
   </button>
   ```
3. **优化加载状态**：防止数据加载过程中的 UI 抖动

---

## 问题三：样品阶段状态切换报 404

### 现象
待采样阶段点击"已到货"时系统提示 404。

### 排查过程

1. **前端代码分析** (`/var/www/xborder/xborder-selection/src/context/StoreContext.tsx`)
   ```tsx
   const updateSampleOptionStatus = async (id: string, sampleOrderStatus: string) => {
     const updated = await apiFetch(`${API}/sample-options/${id}/status`, {
       method: 'PATCH',
       body: JSON.stringify({ sampleOrderStatus }),
     });
     ...
   };
   ```
   - 前端调用：`PATCH /api/sample-options/${id}/status`
   - 请求体：`{ sampleOrderStatus: 'arrived' }`

2. **后端路由检查** (`/var/www/xborder/api-server/src/routes/sample-options.ts`)
   ```typescript
   router.get("/sample-options", ...);
   router.get("/sample-options/:id", ...);
   router.post("/sample-options", ...);
   router.put("/sample-options/:id", ...);
   router.delete("/sample-options/:id", ...);
   export default router;
   ```
   - **缺失**：`router.patch("/sample-options/:id/status")` 路由
   - 只支持 `PUT /sample-options/:id`，且不接受 `sampleOrderStatus` 字段

3. **字段不匹配**
   - 前端发送：`{ sampleOrderStatus: 'arrived' }`
   - 后端 PUT 接受：`status`（不是 `sampleOrderStatus`）
   - `sampleOrderStatus` 是前端在内存中维护的字段，后端数据库表使用 `status`

### 根因
**前后端 API 不一致**：
1. 前端调用了不存在的 API：`PATCH /api/sample-options/${id}/status`
2. 后端没有实现该路由
3. 前端发送 `sampleOrderStatus`，后端期望 `status`

### 修复建议
在后端 `sample-options.ts` 中添加缺失的路由：

```typescript
// 方案1：添加独立的 status 更新路由
router.patch("/sample-options/:id/status", async (req, res) => {
  const { sampleOrderStatus } = req.body;
  if (!sampleOrderStatus) {
    res.status(400).json({ error: "sampleOrderStatus is required" });
    return;
  }
  
  const [existing] = await db.select()
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.id, req.params.id));
  
  if (!existing) {
    res.status(404).json({ error: "Sample option not found" });
    return;
  }
  
  await db.update(sampleOptionsTable)
    .set({ status: sampleOrderStatus, updatedAt: new Date() })
    .where(eq(sampleOptionsTable.id, req.params.id));
  
  const [updated] = await db.select()
    .from(sampleOptionsTable)
    .where(eq(sampleOptionsTable.id, req.params.id));
  
  res.json(serializeSampleOption(updated as Record<string, unknown>));
});

// 方案2：在现有的 PUT 路由中添加 sampleOrderStatus 字段支持
router.put("/sample-options/:id", async (req, res) => {
  // ... 现有代码 ...
  const {
    // ... 现有字段 ...
    sampleOrderStatus,  // 添加此字段
  } = req.body;
  
  // 添加字段映射
  if (sampleOrderStatus !== undefined) updates.status = sampleOrderStatus;
  
  // ... 后续代码 ...
});
```

---

## 总结

| 问题 | 根因 | 严重程度 |
|------|------|----------|
| 1688 图片不显示 | 源代码与编译产物不一致，image-proxy 路由缺失 | **高** |
| 提交按钮时有时无 | UX 问题：条件判断复杂 + 状态切换导致按钮切换 | **中** |
| 状态切换 404 | 后端缺少 PATCH /sample-options/:id/status 路由 | **高** |

---

*报告生成时间：2026-05-13*
