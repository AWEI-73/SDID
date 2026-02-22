
AI 時代的 Cynefin 工程應用
從決策感知到系統架構白皮書

整合 Dave Snowden 原始框架 × SDID 工程實務對應 × AI 協作應用指南
v2.0  2026 | 含 SDID 標籤深化擴充方向



前言
本白皮書整合 Dave Snowden 的 Cynefin 框架原始文獻、2021 年重大更新（含 Aporetic turn）、AI 時代的應用解析，以及 SDID（Semantic-Driven Iterative Development）的工程實務對應與未來標籤深化方向。

Cynefin（發音：kuh-NEV-in）是威爾斯語，意為「棲地、習慣之地、歸屬感」，代表環境脈絡會以不易察覺的方式影響行為與決策。由 Dave Snowden 於 1999 年在 IBM Global Services 創立；2007 年與 Mary E. Boone 在《哈佛商業評論》發表後廣為人知，獲組織行為學「傑出實務導向出版獎」。現由 The Cynefin Co 持續迭代維護。

核心定位：Cynefin 不是分類工具（Categorization），而是感知定位框架（Sense-making Framework）。它協助決策者在採取行動前先辨識：「我們目前處於何種因果環境中？」不同情境需要完全不同的決策邏輯，用錯框架比沒有框架更危險。

一、核心哲學：因果性 vs. 傾向性
理解 Cynefin 的關鍵，在於打破「凡事皆有線性因果」的傳統系統思維。框架將世界的可知性分為兩種本質不同的類型：

類型
存在的域
核心特徵
因果性 Causality
Clear、Complicated
因果關係穩定可預測，可透過流程或專家分析控制結果。適合 AI 直接推理。
傾向性 Dispositionality
Complex
無法精準控制結果，只能透過干預影響系統演化的傾向。AI 需輔助人類處理，不能獨立判斷。
在 AI 時代，這一區分尤為重要。AI 極度擅長因果推理（如預測模型、規則驗證），但目前並不真正理解傾向性系統中的湧現行為（Emergence）與上下文依賴的趨勢。這決定了 AI 在不同域中應扮演的角色。

二、Cynefin 五大決策域
核心差異在於因果關係的可知程度。以下每個域均包含因果特性、決策模式、約束類型、SDID 工程對應，以及主要風險。

2.1 Clear（清晰域）
前身：Simple → Obvious → Clear（2014 年改名）。SOP 成熟，照做就好，但過度自信是最大陷阱。

Clear
已知的已知
因果特性：因果關係穩定、可重複、可預測，所有人都能看見。

決策模式：感知 → 分類 → 回應（Sense → Categorize → Respond）

約束類型：固定約束（Fixed Constraints）／ 最佳實務（Best Practice）

SDID 對應：Gate 驗標籤格式與覆蓋率、編碼驗證（UTF-8）、CI/CD 自動化測試、Quality Gate

? 主要風險：自滿懸崖（Complacency Cliff）：環境巨變但死守舊規則，直接崩潰墜入 Chaotic。
適用例子：螺絲規格驗收、函式標籤格式檢查、標準化部署流程。

2.2 Complicated（可分析域）
大多數工程問題所在的域。有跡可循，但需要專家才能找到正確路徑。

Complicated
已知的未知
因果特性：因果關係存在但隱含在系統中，需要專家介入分析，有多個正確答案。

決策模式：感知 → 分析 → 回應（Sense → Analyze → Respond）

約束類型：治理約束（Governing Constraints）／ 良好實務（Good Practice）

SDID 對應：Spec 設計、GEMS 標籤協議、藍圖拆解、FLOW 標籤設計、架構審查、藍圖→執行計畫轉換

? 主要風險：專家偏見、過度分析癱瘓、排除非專家的創新觀點。
適用例子：採購契約技術規格審查、軟體架構設計、系統效能優化。

2.3 Complex（複雜域）
最容易被誤判的域。答案只能在嘗試之後浮現，強行分析只會製造虛假確定性。

Complex
未知的未知
因果特性：因果不可事前預測，只能事後回顧理解。系統具有傾向性（Dispositionality），模式在過程中湧現。

決策模式：探測 → 感知 → 回應（Probe → Sense → Respond）

約束類型：使能約束（Enabling Constraints）／ 湧現實務（Emergent Practice）

SDID 對應：POC 概念驗證、Safe-to-fail 迭代、Mock 機制、複雜業務需求拆解、Gemini Gem 五輪對話

? 主要風險：把 Complex 當 Complicated 處理（強逼給出精確時程圖），或反之（無限實驗浪費資源）。
適用例子：新市場進入策略、複雜業務需求、使用者行為預測、組織文化改變。

Complex 域的 Probe 設計實務
Safe-to-fail experiment 是這個域的核心工具。AI 可作為 Probe 生成器加速迭代，但實驗設計與價值判斷必須由人主導：
1. 假設生成：AI 產生多樣化假設，例如生成 10 種 A/B 測試變體。
2. 安全設計：限縮測試範圍（10% 流量），設定自動回滾閾值（轉換率降 20% 即停）。
3. 感知調整：AI 分析數據模式，人類判斷價值並決定下一步方向。

2.4 Chaotic（混亂域）
危機狀態，首要任務是止血而非分析。同時也是推動根本變革的機會窗口。

Chaotic
因果暫時不可辨識
因果特性：因果關係暫時不可辨識（注意：不是不存在，是當下無法看清），系統失序，需要立即行動建立秩序。

決策模式：行動 → 感知 → 回應（Act → Sense → Respond）

約束類型：缺乏有效約束，需快速建立強制約束 ／ 創新規範（Novel Practice）

SDID 對應：BLOCKER 機制、策略漂移第三層 PLAN_ROLLBACK、War room 人工介入止血

? 主要風險：在系統崩潰時仍試圖分析 Root Cause，錯失止血時機。危機後必須回顧學習，把因果釐清帶回 Complex 域處理。
適用例子：系統崩潰、需求全面推翻、重大安全漏洞、組織危機。
危機解除後務必進行回顧分析（Retrospective），將這次 Chaotic 的因果釐清，轉移回 Complex 域處理，避免同樣問題再次引發混亂。

2.5 Confused & Aporetic（困惑與悖論，中心域）
2021 年重大更新：將原先的 Disorder 區分為兩個本質不同的狀態。

狀態
Confused（困惑）
Aporetic（悖論）
本質
不知道自己身處哪個域
面對既有框架無法解決的根本性悖論
起源
問題界定不清，各方認知不一
源自希臘文 Aporia，指價值觀衝突、結構性無解難題
策略
拆解大問題 → 識別子問題所在域 → 分流處理
有意識懸置決斷，擁抱矛盾，作為 meta-framework 整合其他工具
SDID 對應
POC Step 1 模糊消除、需求規模評估
框架邊界定義、人類最終決策保留


三、域之間的動態流轉
Cynefin 是動態模型，問題會隨著知識累積和情境變化在域之間移動。約束類型的設計直接影響轉移方向。

流轉方向
路徑
說明
順時針（知識穩定化）
Chaotic → Complex → Complicated → Clear
創新想法被驗證、工程化，最終成為 SOP。Gate 機制的本質：將 Complex 的學習固化為 Clear 的規則。
逆時針（自滿懸崖）
Clear → Chaotic
最危險的轉變。過度僵化遭遇黑天鵝，系統瞬間瓦解。發生迅速無預警。
主動降域（創新策略）
Complicated → Complex
刻意打破既有專家假設，重新尋找湧現可能。
約束驅動轉移
使能約束 ? 固定約束
使能約束在 Complex 給空間讓模式浮現；固定約束在 Clear 強制順序，防止退化。
四、AI 時代的 Cynefin 應用解析
AI 在不同域的作用力有本質差異。清楚定位 AI 的能力邊界，是避免過度依賴或錯用 AI 的關鍵。

域
AI 能力
AI 角色
人類職責
Clear
★★★★★ 完全勝任
接管 SOP、自動審查、常規問答
定義規則，監控自滿懸崖風險
Complicated
★★★★☆ 強力輔助
海量數據分析、架構比對、程式碼重構建議
最終架構判斷，避免專家偏見
Complex
★★☆☆☆ 輔助探索
快速生成 Probe 假設，分析數據模式
實驗設計、價值判斷、傾向性理解
Chaotic
★☆☆☆☆ 輔助監控
事件日誌整理、即時監控警報
全權負責，果斷行動止血
Confused
★★★☆☆ 協助拆解
顯性化隱性需求，協助識別問題域
定義框架邊界，處理根本性悖論
核心原則：AI 越強，Clear 和 Complicated 域的自動化程度越高，釋放人力專注於 Complex 和 Chaotic 域。但 AI 能力提升的同時，邊界失控的風險也等比例上升，這正是 Gate 機制和治理框架越來越重要的原因。



五、SDID 系統架構的 Cynefin 映射
SDID（Semantic-Driven Iterative Development）的設計哲學與 Cynefin 高度吻合。每個機制都在處理特定域的問題，Gate 機制的本質是將 Complex 的學習結果逐步固化為 Clear 域的自動化防護網。

以下對應為工程實務建議，不是絕對規則。在需求高度模糊、跨領域場景、或團隊文化差異較大的情況下，對應關係可能失效，需要人工判斷調整。

Cynefin 域
SDID 機制
核心目標
典型輸出
Confused
POC Step 1 模糊消除 Gemini Gem 五輪對話 需求規模評估
消除模糊，識別問題真正所在的域
requirement_draft 規模評估報告
Complex
POC 原型驗證 Safe-to-fail 迭代 Mock 機制 小步迭代 A/B 測試
探索未知，找出有價值的湧現實務，失敗成本可控
POC.html Contract.ts 學習記錄
Complicated
Spec 設計 GEMS 標籤協議 藍圖拆解 FLOW 標籤設計 架構審查
結構化分析，確立技術邊界，優化效能與擴充性
implementation_plan spec.md / design.md
Clear
Gate 驗收 標籤覆蓋率 ?80% 編碼驗證 CI/CD 自動化
將已知規則自動化，防止人為失誤，不過就重來
checkpoint Pass/Fix/Block 信號
Chaotic
BLOCKER 機制 策略漂移 PLAN_ROLLBACK War room 人工介入
止血優先，恢復可用性，升級到人工介入
BLOCKER 信號 人工介入記錄
完整開發週期範例（AI 推薦系統）
? Confused：需求模糊 → Gemini Gem 五輪對話拆解 → 識別為 Complex（行為預測）+ Complicated（架構設計）
? Complex：AI 生成 5 種推薦算法 POC，Safe-to-fail A/B 測試（1 週、5% 用戶），感知湧現模式後調整
? Complicated：GEMS 標籤定義 API 介面，spec 建構，專家審查藍圖，優化效能
? Clear：Quality Gate 驗證覆蓋率 > 80%，編碼驗證，CI/CD 自動部署
? 若進入 Chaotic（部署崩潰）：BLOCKER → PLAN_ROLLBACK 退版 → War room 止血 → 轉回 Complex 調查根因

六、關鍵避坑原則

陷阱
症狀
對策
把 Complex 當 Complicated
要求工程師給出精確時程與架構圖（需求仍模糊時）
先做 POC，允許 Safe-to-fail 實驗，用 Mock 降低失敗成本
在 Clear 域過度創新
已有成熟套件和 SOP，卻堅持自造輪子
固定約束保護最佳實務，創新能量留給 Complex 域
在 Chaotic 域過度分析
伺服器崩潰時開會找 Root Cause，而非先退版止血
Act 優先，Sense 其次，分析事後再做
分析癱瘓
Complex 域試圖完全分析清楚再行動
接受「夠好的答案」，設計 Safe-to-fail 快速試探
專家陷阱
Complicated 域過度依賴少數專家，排除其他觀點
治理約束保持開放，定期引入非專家視角
自滿懸崖
Clear 域長期成功後忽略環境變化
定期主動審視約束是否仍適用，建立感知機制
快速判斷域的問題清單
? 因果關係現在就能看清楚？→ Clear
? 需要專家分析才能找到答案？→ Complicated
? 答案只能在嘗試之後才知道？→ Complex
? 情況完全失控，需要立即行動？→ Chaotic
? 以上都不確定？→ Confused，先拆解問題再識別域

七、延伸閱讀與資源

原始文獻
? Snowden, D.J. & Boone, M.E. (2007). A Leader's Framework for Decision Making. Harvard Business Review.
? Kurtz, C.F. & Snowden, D.J. (2003). The new dynamics of strategy: Sense-making in a complex and complicated world. IBM Systems Journal, 42(3).

官方資源
? The Cynefin Co 官方網站：thecynefin.co
? Dave Snowden 2021 更新版本框架說明（含 Aporetic 域完整解析）
? SenseMaker? 工具：用於敘事捕捉，揭示 Complex 域的經驗模式

Cynefin 框架持續演化，域的名稱和定義歷經多次調整。建議定期查閱 Dave Snowden 的最新說明，避免使用過時版本。



八、SDID 標籤系統深化擴充方向（未來規劃）
本章為未來擴充方向，尚未實作。核心概念是將 Cynefin 的域識別融入 SDID 的標籤系統，形成從需求到程式碼的完整語意鏈。

8.1 核心概念：語意鏈完整閉環
現有的 GEMS 標籤系統已具備技術層面的語意（risk、flow、deps、test）。加入域標籤後，每個 function 不只知道自己的技術屬性，還知道自己是在哪種決策環境下被設計出來的，Gate 驗收標準也能根據域自動調整嚴謹程度。

層次
現有機制
深化後增加
需求層
POC Step 1 模糊消除
三問快速域識別 → 自動推導 DOMAIN 聲明
規格層
spec.md / blueprint
spec 開頭加 domain 元資料，選擇對應模板
標籤層
GEMS 基本標籤
新增 GEMS-DOMAIN 欄位，從 POC 聲明帶下來
驗收層
固定 Gate 標準
根據 DOMAIN 自動選擇驗收嚴謹度
知識圖層
functions.json 掃描
多一個 domain 維度，支援域層級的分析與建議
8.2 POC 前置：三問域識別
在需求輸入時加三個強制問題，不需要使用者懂 Cynefin，問法白話，答案組合自動推導域：

問題
答案
推導結果
這個功能的做法，你現在清楚嗎？
清楚
傾向 Complicated 以上
有沒有類似的東西做過或參考過？
沒有
傾向 Complex
如果做錯了，代價大嗎？
大
需要更嚴謹的域識別與驗收標準
三個問題的答案組合由 AI 自動推導域，輸出一行 DOMAIN 聲明，後續所有步驟根據這個聲明調整行為。

8.3 GEMS-DOMAIN 標籤格式
在現有 GEMS 標籤後加一行，格式與現有標籤系統一致，零學習成本：

/**
 * GEMS: functionName | P0 | ?? | (args)→Result | Story-1.0 | 描述
 * GEMS-DOMAIN: Complicated | 理由：架構設計，有多個正確答案，需要專家分析
 * GEMS-FLOW: Validate → Process → Store → Return
 * GEMS-DEPS: [Internal.CoreTypes (型別定義)]
 * GEMS-DEPS-RISK: LOW
 * GEMS-TEST: ? Unit | ? Integration | - E2E
 * GEMS-TEST-FILE: function-name.test.ts
 */
域聲明可選值：Clear、Complicated、Complex、Chaotic。Confused 只在 POC 階段出現，不會帶到 function 層級（因為 Confused 代表問題還沒被釐清，不應該進入實作）。

8.4 Gate 驗收標準根據域自動調整
不同域的驗收嚴謹度應該不同。Clear 域需要最嚴格的格式驗證，Complex 域則不應該要求精確的覆蓋率，因為它本來就是在探索中：

Gate 項目
Clear
Complicated
Complex
標籤覆蓋率
? 90%（嚴格）
? 80%（現行）
? 60%（允許探索中）
FLOW 完整性
必須完整
必須完整
允許 TODO 佔位
測試要求
Unit + Integration 必須
Unit 必須
Mock 可替代
DEPS-RISK
必須評估
必須評估
可標記 UNKNOWN
策略漂移閾值
3 次即 BLOCK
5 次（現行）
7 次（給更多探索空間）
8.5 知識圖的域維度擴充
掃描器在產出 functions.json 時多一個 domain 欄位，整個知識圖就多了一個可以分析的維度：

{
  "name": "processPayment",
  "file": "src/modules/payment/processor.ts",
  "startLine": 42,
  "endLine": 89,
  "risk": "P0",
  "domain": "Complicated",
  "description": "支付流程處理",
  "flow": "Validate → Charge → Record → Notify",
  "deps": "[Internal.PaymentGateway]",
  "depsRisk": "HIGH"
}
有了 domain 欄位之後，知識圖可以回答新的問題：
? 哪些 P0 function 還在 Complex 域（尚未穩定化）？
? 有哪些 function 的域已經可以從 Complex 升格為 Complicated（反覆驗證成功）？
? 重構建議：這個 Complicated 域的 function deps 太複雜，建議拆分。
? 風險地圖：Chaotic 域的 function 目前有幾個，影響範圍是什麼？

8.6 域升降機制（未來進階）
域不是靜態的，隨著迭代進行，function 的域應該可以升降。這個機制對應 Cynefin 的動態流轉概念：

方向
觸發條件
意義
Complex → Complicated
連續 N 次迭代 Gate 通過，模式穩定
探索期結束，進入可分析階段，提升驗收標準
Complicated → Clear
spec 完整、測試全綠、無變更超過 M 次迭代
知識固化，進入 SOP 自動化階段
Clear → Complex（主動降域）
人工標記，準備重構或重新設計
打破既有假設，重新探索更好的實作方式
任何域 → Chaotic
連續 BLOCKER，策略漂移達上限
觸發 War room，人工介入止血
域升降記錄會寫入 project-memory，形成可審計的決策軌跡，出問題時可以追溯「這個 function 是什麼時候、因為什麼原因從 Complex 升格為 Complicated 的」。

8.7 實作優先順序建議
考量時間成本，建議按以下順序推進，每個步驟都能獨立帶來價值：

順序
項目
說明
預估成本
P0
POC 前三問域識別
在 POC Step 1 加三個問題，AI 自動推導域聲明
低，改 prompt 即可
P1
GEMS-DOMAIN 標籤
標籤格式加一行，掃描器加一個欄位
低，格式擴充
P2
Gate 根據域調整標準
phase-2 根據 DOMAIN 欄位選驗收嚴謹度
中，需改 Gate 邏輯
P3
知識圖域維度查詢
functions.json 多 domain 欄位，支援域層級分析
低，掃描器欄位擴充
P4
域升降機制
根據迭代結果自動升降域，寫入 project-memory
高，需設計狀態機
P0 和 P1 可以在一次迭代內完成，立即讓整個系統多一個語意維度。P4 是進階功能，有時間再做。

注意：本章所有數字閾值（覆蓋率 80%、FLOW 步驟 7 個、deps 數量 5 個等）均為實務經驗值，不是學術標準。應根據專案規模、團隊大小、風險容忍度調整，不宜直接套用。



8.8 複雜度拆解實例：從 Complex 到 Complicated
以電商訂單處理模組為例，說明掃描器如何偵測到複雜度超標，以及拆解後的結構變化。

白話理解：分工的概念
拆解前，像一個店員獨自處理所有事：確認客人身份、查庫存、算折扣、刷卡收錢、扣庫存、累積點數、開發票、發通知、寫日誌。九件事全部一個人扛，任何環節出錯都找他，難以測試、難以維護，這就是 Complex。

拆解後，改成分工：店長（協調層）負責指揮流程；驗收員負責確認客人和庫存；收銀員負責算錢和刷卡；倉管負責扣庫存、累積點數、開發票；客服負責發通知和寫日誌。每個人職責單一，出錯知道找誰，測試容易，這就是從 Complex 降回 Complicated 甚至 Clear。

拆解前：一個肥大的 Complex function
掃描器偵測到 FLOW 步驟 9 個、deps 6 個，兩項指標均超標，觸發重構建議。

GEMS: processOrder | P0 | ○○ | (order)→Result | Story-3.0 | 訂單處理
GEMS-DOMAIN: Complex | 理由：職責過多，FLOW 步驟 9 個，deps 6 個
GEMS-FLOW: ValidateUser → CheckInventory → CalcDiscount →
           ProcessPayment → UpdateInventory → SendNotification →
           UpdateLoyaltyPoints → GenerateInvoice → LogAudit
GEMS-DEPS: [Internal.UserService], [Internal.InventoryService],
           [Internal.PaymentGateway], [Internal.NotificationService],
           [Internal.LoyaltyService], [Internal.InvoiceService]
GEMS-DEPS-RISK: HIGH

// 掃描器輸出：
// ? FLOW 步驟 9 個（閾值 7）→ 建議拆解 subfunction
// ? deps 6 個（閾值 5）→ 建議抽出中間層
// 建議：拆為協調層 + orderValidator / paymentProcessor /
//       orderFulfiller / notifier
拆解後：協調層 + 四個 subfunction
協調層薄化為四個步驟，各 subfunction 職責單一，域從 Complex 降回 Complicated / Clear。

// ── 協調層（薄化）──
GEMS: processOrder | P0 | ?? | (order)→Result | Story-3.0 | 訂單處理協調層
GEMS-DOMAIN: Complicated | 理由：協調層，職責明確，可分析
GEMS-FLOW: ValidateOrder → ProcessPayment → FulfillOrder → Notify
GEMS-DEPS: [Internal.orderValidator], [Internal.paymentProcessor],
           [Internal.orderFulfiller], [Internal.notifier]
GEMS-DEPS-RISK: LOW

// ── subfunction 1：驗收員 ──
GEMS: orderValidator | P1 | ?? | (order)→ValidationResult | Story-3.0 | 訂單驗證
GEMS-DOMAIN: Clear | 理由：規則固定，因果清楚
GEMS-FLOW: ValidateUser → CheckInventory → CheckStock
GEMS-DEPS: [Internal.UserService], [Internal.InventoryService]

// ── subfunction 2：收銀員 ──
GEMS: paymentProcessor | P0 | ?? | (order)→PaymentResult | Story-3.0 | 支付處理
GEMS-DOMAIN: Complicated | 理由：有多種支付方式，需要專家分析
GEMS-FLOW: CalcDiscount → ChargePayment → RecordTransaction
GEMS-DEPS: [Internal.PaymentGateway]

// ── subfunction 3：倉管 ──
GEMS: orderFulfiller | P1 | ?? | (order)→FulfillResult | Story-3.0 | 訂單履行
GEMS-DOMAIN: Clear | 理由：流程固定，照 SOP 執行
GEMS-FLOW: UpdateInventory → UpdateLoyaltyPoints → GenerateInvoice
GEMS-DEPS: [Internal.InventoryService], [Internal.LoyaltyService]

// ── subfunction 4：客服 ──
GEMS: notifier | P2 | ? | (order)→void | Story-3.0 | 通知與稽核
GEMS-DOMAIN: Clear | 理由：固定流程，無分支
GEMS-FLOW: SendNotification → LogAudit
GEMS-DEPS: [Internal.NotificationService]
拆解前後數字對比

指標
拆解前
拆解後（協調層）
拆解後（各 subfunction）
FLOW 步驟數
9（超標）
4（合格）
2-3（合格）
deps 數量
6（超標）
4（合格）
1-2（合格）
GEMS-DOMAIN
Complex
Complicated
Clear / Complicated
DEPS-RISK
HIGH
LOW
LOW
可測試性
困難
容易
容易
出錯可定位
難（全部找他）
容易（找協調層）
精確（找對應人）
掃描器的閉環驗證
拆解不是一次性的，掃描器在每次迭代後重新計算複雜度，確認拆解品質：

? 拆解前：掃描器偵測超標 → 輸出重構建議
? 拆解中：AI 或人工按建議拆解 subfunction
? 拆解後：掃描器重新掃描 → 各 function 分數降到合理範圍 → Gate 通過
? 若拆完仍超標：代表拆的方式不對，邊界設計有問題 → 掃描器再次提示

核心洞察：複雜度拆解不是讓程式碼變多，而是讓每個單元的職責變單一、域降低、可測試性提升。掃描器的角色是客觀量化這個過程，讓重構有數據依據，不靠主觀感覺。



8.9 藍圖階段的域拆分前置檢查
最有效的複雜度控制不是事後重構，而是在藍圖階段就先做域拆分，讓 AI 從一開始就按照正確的邊界實作，根本不產生需要重構的肥大 function。

核心原則：預防勝於治療。規格前定義清楚比驗收時才發現問題便宜太多，跟契約管理的邏輯完全一致。

時機與範圍

階段
域拆分強制程度
說明
藍圖階段
強制
每個模組在進入實作前，必須先列出預期 FLOW 步驟和 deps，超過閾值就先拆設計再進實作
POC 階段
建議（不強制）
POC 本質是探索，允許暫時的肥大，但若發現 FLOW 超標，建議拆成多個獨立驗證腳本分別跑
實作階段
掃描器確認
掃描器角色從診斷工具變成驗證工具，確認實作有沒有按照藍圖的拆分設計走
藍圖階段的拆分檢查點
在藍圖產出之前，加一個輕量的域分析步驟，不需要複雜工具，只需要回答三個問題：

? 這個模組的 FLOW 步驟超過 7 個嗎？→ 超過就先拆設計
? 這個模組的 deps 超過 5 個嗎？→ 超過就考慮抽出中間層
? deps 裡有不可控的外部服務（AI API、第三方平台）嗎？→ 有就評估是否需要非同步隔離

三個問題都沒有超標，直接進實作。有超標的，先在藍圖裡定義協調層和 subfunction 的邊界，再交給 AI 實作。

POC 階段：多個獨立驗證腳本
POC 階段的目的是探索，不適合強制拆分，但可以用一個更輕量的方式處理複雜度：把一個 POC 拆成多個獨立的驗證腳本，每個腳本只驗證一個假設。

// 拆解前：一個 POC 腳本驗證所有事情
// poc-publishContent.js → 上傳 + AI審核 + DB寫入 + 通知 全部塞一起

// 拆解後：多個獨立腳本，task pipe 串起來
// poc-assetStorage.js     → 只驗證 S3 上傳
// poc-aiReviewer.js       → 只驗證 AI 審核 API 回應
// poc-recordCommitter.js  → 只驗證 DB 寫入邏輯
// poc-feedDistributor.js  → 只驗證非同步通知

// task pipe 不需要複雜，多個驗證器串起來就好
// 跑完各自獨立，失敗了知道是哪個環節出問題
這樣做的好處是每個腳本都可以獨立失敗、獨立修正，不會因為 AI API 不穩定就讓整個 POC 報廢。而且每個腳本的域也更清楚，上傳是 Clear、AI 審核是 Complex，不會混在一起。

掃描器角色的轉變

角色
舊：診斷工具
新：驗證工具
觸發時機
實作完成後才掃描，發現問題再重構
藍圖定義了拆分邊界，掃描器確認實作有沒有照做
發現問題的成本
高（程式碼已寫，重構代價大）
低（只是確認，偏差小）
輸出
重構建議（亡羊補牢）
一致性確認（防患未然）
複雜度偵測
掃描器主動偵測
藍圖已定義，掃描器只做比對
關鍵洞察：標籤系統的角色從「事後驗收」變成「事後確認」。設計問題在藍圖階段就解決，掃描器只需要確認實作和設計是否一致，不需要做複雜的域污染偵測，實作成本大幅降低。

進階概念：真正的降域是「拆時間」
函數拆分是降域的第一步，但不是終點。只要不同域的 function 還在同一個 call stack 裡同步執行，就還沒真正完成降域。

核心問題：同步流程是一種時間耦合。Clear 等待 Complex 的結果，就是讓可控的東西被不可控的東西綁架。

層次
做法
是否真正降域
第一層 函數拆分
把大 function 拆成多個小 function
部分降域。職責分離了，但如果還是同步呼叫，域污染仍然存在
第二層 非同步隔離
Complex 的工作丟進 Queue，Clear 不等結果直接回傳
真正降域。Clear 永遠不被 Complex 阻塞
第三層 事件驅動
所有跨域交互透過事件，狀態機管理轉移，每個域完全獨立
最完整的降域。爆炸半徑可計算，可橫向擴展
事件驅動的進階拆法（影音審核範例）
把同步流程改成事件驅動之後，架構變成三段完全獨立的 Clear → Complex → Clear：

// 第一段：Clear（上傳，立即回傳，不等 AI）
UploadController (Clear)
  → ValidateFormat → StoreAsset → CreateAggregate(status=PENDING)
  → EmitEvent: VideoCreated
  → 回傳 200 OK   ← 使用者不等待

// 第二段：Complex（AI 審核，非同步，可重試）
AIReviewWorker (Complex)  ← 消費 VideoCreated 事件
  → FetchAsset → Transcribe → NSFWCheck
  → EmitEvent: ReviewCompleted
  ← AI 掛了 = 影片卡在 Pending，系統其他部分不受影響

// 第三段：Clear（狀態更新，確定性）
ReviewProjector (Clear)   ← 消費 ReviewCompleted 事件
  → LoadAggregate → ApplyApprovedOrRejected → Persist
  → EmitEvent: VideoApproved / VideoRejected

FeedProjector (Clear)     ← 消費 VideoApproved 事件
  → UpdateCache → NotifyFollowers
這個設計的代價需要誠實面對：需要事件總線、狀態機設計、最終一致性、冪等性處理，debug 複雜度也會上升。小團隊 MVP 階段這套是過重的，適合核心業務已穩定、需要韌性的場景。

對藍圖設計的啟示：在藍圖階段做域拆分時，除了檢查 FLOW 步驟數和 deps 數量，還需要問第四個問題：「有沒有 Clear 在同步等待 Complex 的結果？」有的話就是時間耦合，評估是否需要非同步隔離。

標籤設計原則：聲明不能取代驗證
標籤系統的維護成本是真實的。每增加一個欄位，就增加一份需要持續維護的語意負擔。非必要不擴充是標籤設計的核心原則。

關鍵區別：標籤是聲明，測試是驗證，兩者不能互相取代。

一個常見的陷阱是：加了標籤聲明之後，開發者產生「我標了就等於處理了」的錯誤認知，真正的驗證反而被忽略。聲明取代了行為，問題不是沒有，只是被遮蔽了。

能用整合測試驗收的問題，就用測試，不要用標籤聲明來替代實際驗證。測試是行為的驗證，跑過就是跑過，沒有模糊地帶；標籤是意圖的記錄，不是保證。

問題類型
用標籤
用測試
語意記錄（是什麼）
? 適合，標籤說明設計意圖
? 測試無法說明為什麼這樣設計
行為驗證（有沒有做到）
? 標籤只是聲明，不保證實作正確
? 適合，整合測試直接驗證行為
時間耦合偵測
? 加標籤容易產生虛假安全感
? 整合測試自然暴露同步等待問題

「框架的價值不在於它告訴你答案，而在於它幫助你問對問題。」
— Dave Snowden

整合自 Dave Snowden 原始文獻、Cynefin Co 更新資料 × SDID 工程實務 | v2.0  2026
