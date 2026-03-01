# 📋 Auth 系統 — Enhanced Draft (Skill A 輸入樣板 · Blueprint 路線)

> **此文件是 Skill A 的輸入**：Blueprint 5輪對話產物
> Skill A 讀「模組動作清單表」→ 產出 `.gems/specs/auth-service.json`

---

## 模組動作清單表

| Story | 模組動作名稱 | Type | Prio | GEMS-FLOW 簡述 | 功能描述 |
|-------|------------|------|------|---------------|---------|
| 1.0 | Login | FUNC | P0 | Validate→Query→Hash→IssueJwt | 驗證帳密，簽發 JWT |
| 1.0 | Register | FUNC | P0 | ValidateInput→CheckDuplicate→HashPwd→Insert→Return | 建立新帳號 |
| 1.1 | Logout | FUNC | P1 | RevokeToken→ClearSession→Return | 撤銷 token，清除 session |

---

## 實體定義

```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}
```

## 依賴
- bcrypt (密碼雜湊)
- jsonwebtoken (JWT 簽發)
- pg (PostgreSQL)
