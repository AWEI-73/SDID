# Integration Template for GEMS Flow

## Level 3: Integration (P2)

### 3.1 整合點規劃

#### main.ts 整合
```typescript
/**
 * GEMS: register{ModuleName}Module | P2 | ✓✓ | ()→void | Story-X.X | 註冊模組
 * GEMS-FLOW: LoadConfig→RegisterRoutes→InitServices
 * GEMS-DEPS: [{ModuleName}Routes.router], [{ModuleName}Service.init]
 * GEMS-DEPS-RISK: MEDIUM
 * GEMS-TEST: - Unit | ✓ Integration | - E2E
 * GEMS-TEST-FILE: main.integration.test.ts
 */
async function register{ModuleName}Module() {
  // [STEP] LoadConfig - 載入模組配置
  const config = loadModuleConfig('{module-name}');
  
  // [STEP] RegisterRoutes - 註冊路由
  app.use('/api/{module-name}', {moduleName}Routes);
  
  // [STEP] InitServices - 初始化服務
  await {moduleName}Service.init(config);
}
```

#### routes.ts 整合
```typescript
/**
 * GEMS: setup{ModuleName}Routes | P2 | ✓✓ | (router)→void | Story-X.X | 設定路由
 * GEMS-FLOW: DefineRoutes→AttachMiddleware→MountHandlers
 * GEMS-DEPS: [{ModuleName}Controller.*], [AuthMiddleware.verify]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: - Unit | ✓ Integration | ✓ E2E
 * GEMS-TEST-FILE: routes.integration.test.ts
 */
export function setup{ModuleName}Routes(router: Router) {
  // [STEP] DefineRoutes - 定義路由端點
  const routes = [
    { method: 'GET', path: '/', handler: 'list' },
    { method: 'POST', path: '/', handler: 'create' },
    { method: 'GET', path: '/:id', handler: 'get' },
    { method: 'PUT', path: '/:id', handler: 'update' },
    { method: 'DELETE', path: '/:id', handler: 'delete' }
  ];
  
  // [STEP] AttachMiddleware - 附加中介層
  router.use(authMiddleware.verify);
  router.use(validateRequest);
  
  // [STEP] MountHandlers - 掛載處理器
  routes.forEach(({ method, path, handler }) => {
    router[method.toLowerCase()](path, {moduleName}Controller[handler]);
  });
}
```

---

### 3.2 Integration 測試規範（務實 Mock 策略）

| 測試場景 | Given | When | Then | Mock 策略 |
|----------|-------|------|------|-----------|
| 模組啟動 | 系統啟動 | 載入模組 | 路由可訪問 | 已實作的用真實，未實作的可 mock |
| API 呼叫 | 模組已註冊 | GET /api/xxx | 返回資料 | 本模組真實，外部依賴可 mock |
| 錯誤處理 | 服務未初始化 | 呼叫 API | 返回 503 | 錯誤處理必須真實 |
| CRUD 操作 | 資料庫已初始化 | 執行 CRUD | 資料正確 | 資料庫用真實（in-memory 可） |

**Integration 測試 Mock 原則**：

✅ **允許 Mock**（未實作的依賴）：
- 外部 API 服務（尚未實作）
- 第三方服務（Stripe、SendGrid 等）
- 其他模組的功能（尚未開發）
- 複雜的外部依賴（AWS S3、Firebase 等）

❌ **禁止 Mock**（已實作的核心）：
- 本模組的業務邏輯
- 已實作的路由和控制器
- 已實作的資料庫操作
- 核心錯誤處理機制
- HTTP Request/Response 層

🔄 **彈性處理**（視情況）：
- 資料庫：優先用 in-memory（SQLite）或 Test Container
- 認證：如果認證模組已實作則用真實，否則可 mock token
- 檔案系統：可用 mock-fs 或臨時目錄

**測試範例**：
```typescript
// ✅ 正確：務實的 Integration 測試
describe('{ModuleName} Integration', () => {
  let app: Express;
  let db: Database;

  beforeAll(async () => {
    // 使用記憶體資料庫（真實但隔離）
    db = await createInMemoryDatabase();
    app = createApp(db);
    await register{ModuleName}Module();
  });

  it('should handle full CRUD flow', async () => {
    // CREATE - 本模組功能，用真實實作
    const created = await request(app)
      .post('/api/{module-name}')
      .send({ name: 'Test' });
    expect(created.status).toBe(201);

    // READ - 本模組功能，用真實實作
    const fetched = await request(app)
      .get(`/api/{module-name}/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.name).toBe('Test');

    // UPDATE - 本模組功能，用真實實作
    const updated = await request(app)
      .put(`/api/{module-name}/${created.body.id}`)
      .send({ name: 'Updated' });
    expect(updated.status).toBe(200);

    // DELETE - 本模組功能，用真實實作
    const deleted = await request(app)
      .delete(`/api/{module-name}/${created.body.id}`);
    expect(deleted.status).toBe(204);

    // 驗證資料庫狀態（真實查詢）
    const dbRecord = await db.query('SELECT * FROM tbl_{module_name} WHERE id = ?', [created.body.id]);
    expect(dbRecord).toBeNull();
  });

  it('should integrate with external service (mock if not implemented)', async () => {
    // 如果外部通知服務尚未實作，可以 mock
    const mockNotificationService = jest.spyOn(notificationService, 'send')
      .mockResolvedValue({ success: true });

    const created = await request(app)
      .post('/api/{module-name}')
      .send({ name: 'Test', notifyUser: true });

    expect(created.status).toBe(201);
    expect(mockNotificationService).toHaveBeenCalledWith({
      userId: expect.any(String),
      message: expect.any(String)
    });

    mockNotificationService.mockRestore();
  });

  it('should handle errors gracefully (real error handling)', async () => {
    // 錯誤處理必須真實
    const response = await request(app)
      .get('/api/{module-name}/non-existent-id');
    expect(response.status).toBe(404);
    expect(response.body.error).toBeDefined();
  });
});
```

```typescript
// ❌ 錯誤：過度 Mock 核心功能
describe('{ModuleName} Integration', () => {
  it('should call service', async () => {
    // 本模組的 service 已實作，不應該 mock
    const mockService = jest.fn().mockResolvedValue({ id: 1 });
    const mockRouter = { get: jest.fn() };
    
    // 這不是 Integration 測試，這是 Unit 測試！
    setup{ModuleName}Routes(mockRouter);
    expect(mockRouter.get).toHaveBeenCalled();
  });
});
```

```typescript
// ✅ 正確：Mock 未實作的外部依賴
describe('Payment Integration', () => {
  it('should process payment with mocked Stripe', async () => {
    // Stripe 是外部服務，可以 mock
    const mockStripe = {
      charges: {
        create: jest.fn().mockResolvedValue({
          id: 'ch_123',
          status: 'succeeded'
        })
      }
    };

    // 但本模組的 payment service 必須真實
    const result = await paymentService.processPayment({
      amount: 1000,
      currency: 'usd',
      stripeClient: mockStripe
    });

    expect(result.success).toBe(true);
    expect(mockStripe.charges.create).toHaveBeenCalled();
  });
});
```

---

### 3.3 E2E 測試場景規劃（後端真實，前端可選）

**E2E 測試定義**：
- **後端 + 資料庫**: 必須真實（不可 mock）
- **前端 UI**: 可選（有 Playwright 更好，沒有也可以）
- **外部服務**: 可 mock（Stripe、SendGrid 等）

#### 場景 1: API 端到端測試（必須）
```gherkin
Feature: {ModuleName} API E2E

Scenario: Complete CRUD workflow via API
  Given 資料庫已清空
    And 測試用戶已建立
  When 用戶透過 API 建立項目
    And 用戶透過 API 查詢項目列表
    And 用戶透過 API 更新項目
    And 用戶透過 API 刪除項目
  Then 所有 API 呼叫成功
    And 資料庫狀態正確
    And 無資料殘留
```

**Supertest 範例**（必須）：
```typescript
// e2e/{module-name}.e2e.test.ts
import request from 'supertest';
import { app } from '../src/main';
import { db } from '../src/lib/database';

describe('{ModuleName} API E2E', () => {
  beforeEach(async () => {
    // 清空測試資料庫
    await db.query('DELETE FROM tbl_{module_name}');
  });

  it('should complete full CRUD workflow', async () => {
    // 1. CREATE
    const createRes = await request(app)
      .post('/api/{module-name}')
      .send({ name: 'E2E Test Item' })
      .expect(201);
    
    const itemId = createRes.body.id;
    expect(itemId).toBeDefined();

    // 2. READ (List)
    const listRes = await request(app)
      .get('/api/{module-name}')
      .expect(200);
    
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe('E2E Test Item');

    // 3. READ (Single)
    const getRes = await request(app)
      .get(`/api/{module-name}/${itemId}`)
      .expect(200);
    
    expect(getRes.body.name).toBe('E2E Test Item');

    // 4. UPDATE
    const updateRes = await request(app)
      .put(`/api/{module-name}/${itemId}`)
      .send({ name: 'Updated E2E Item' })
      .expect(200);
    
    expect(updateRes.body.name).toBe('Updated E2E Item');

    // 5. DELETE
    await request(app)
      .delete(`/api/{module-name}/${itemId}`)
      .expect(204);

    // 6. 驗證刪除成功
    await request(app)
      .get(`/api/{module-name}/${itemId}`)
      .expect(404);

    // 7. 驗證資料庫狀態
    const dbCheck = await db.query(
      'SELECT * FROM tbl_{module_name} WHERE id = ?',
      [itemId]
    );
    expect(dbCheck.rows).toHaveLength(0);
  });

  it('should handle validation errors', async () => {
    // 提交無效資料
    const res = await request(app)
      .post('/api/{module-name}')
      .send({ name: '' })  // 空名稱
      .expect(400);
    
    expect(res.body.error).toContain('名稱為必填');
  });

  it('should handle authentication', async () => {
    // 未登入訪問受保護資源
    await request(app)
      .get('/api/{module-name}')
      .expect(401);

    // 登入後可訪問
    const token = await getTestAuthToken();
    await request(app)
      .get('/api/{module-name}')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

---

### 3.4 整合測試 Checklist

在 BUILD Phase 6 執行前，確認：

- [ ] main.ts 已加入模組註冊邏輯
- [ ] routes.ts 已加入路由掛載邏輯
- [ ] Integration 測試已撰寫（已實作的用真實，未實作的可 mock）
- [ ] API E2E 測試已撰寫（Supertest，必須）
- [ ] UI E2E 測試已規劃（Playwright，可選）
- [ ] 測試資料庫已設定（in-memory 或獨立測試 DB）
- [ ] 所有 Integration 測試通過
- [ ] 所有 API E2E 測試通過

**測試優先級**：
1. **P0**: Integration 測試（本模組真實）
2. **P0**: API E2E 測試（Supertest）
3. **P1**: UI E2E 測試（Playwright，可選）

---

## 使用指南

### Story 1.0 (基礎建設)
- 必須建立 main.ts 和 routes.ts 的基礎架構
- 必須定義模組註冊機制
- 必須建立路由掛載機制
- 必須建立測試資料庫設定

### Story 2.0+ (新模組)
- 參考此模板加入整合點規劃
- 在 PLAN Step 2.6 時加入 Level 3 區塊
- 在 BUILD Phase 6 時執行 Integration 測試
- 在 BUILD Phase 7 時執行 API E2E 測試（必須）
- 在 BUILD Phase 7 時執行 UI E2E 測試（可選）

---

**版本**: v1.1 | **更新日期**: 2026-01-25 | **變更**: 務實 Mock 策略 + API E2E 優先
