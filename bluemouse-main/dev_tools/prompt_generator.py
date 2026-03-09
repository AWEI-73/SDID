"""
Prompt生成器 - 藍圖小老鼠 v6.0
根據蘇格拉底答案生成詳細的代碼生成Prompt
"""

from typing import Dict, List, Any, Optional


def generate_code_prompt(
    requirement: str,
    framework: str,
    socratic_answers: Dict[str, str],
    scenario: Optional[str] = None
) -> str:
    """
    生成代碼生成Prompt
    
    這是核心：將用戶的蘇格拉底答案轉化為詳細的代碼生成指令
    
    Args:
        requirement: 用戶需求
        framework: 選擇的框架 (django/flask/etc)
        socratic_answers: 蘇格拉底問題的答案，如 {"q1": "optimistic_lock", "q2": "polling"}
        scenario: 場景類型（可選）
    
    Returns:
        完整的代碼生成Prompt
    """
    
    # 1. 識別場景（如果未提供）
    if not scenario:
        scenario = identify_scenario(requirement)
    
    # 2. 獲取Prompt模板
    template = get_prompt_template(scenario, socratic_answers)
    
    # 3. 格式化用戶決策
    decisions = format_decisions(socratic_answers)
    
    # 4. 構建完整Prompt
    prompt = f"""你是一個專業的{framework}開發者。請生成完整、可運行的生產級代碼。

## 需求
{requirement}

## 用戶的技術決策
{decisions}

## 代碼要求
{template['requirements']}

## 必須實現的功能
{template['must_implement']}

## 代碼規範
- 使用{framework}最佳實踐
- 完整的錯誤處理
- 清晰的注釋說明技術決策
- 類型提示（Python 3.9+）
- 遵循PEP 8規範

## 輸出格式
請以JSON格式返回：
{{
  "files": {{
    "models.py": "代碼內容...",
    "views.py": "代碼內容...",
    ...
  }},
  "setup_instructions": "安裝和運行說明"
}}

只返回JSON，不要其他文字。
"""
    
    return prompt


def identify_scenario(requirement: str) -> str:
    """
    識別需求場景
    
    使用與antigravity_inline_generator.py相同的邏輯
    """
    req_lower = requirement.lower()
    
    scenarios = {
        '部落格': r'部落格|blog|文章|內容管理',
        '電商': r'電商|購物|訂單|商品|庫存',
        '預約': r'預約|預訂|排程|日曆',
        '聊天': r'聊天|即時通訊|訊息|社交',
        '待辦': r'待辦|任務|todo',
    }
    
    import re
    for scenario_name, pattern in scenarios.items():
        if re.search(pattern, req_lower):
            return scenario_name
    
    return 'generic'


def format_decisions(socratic_answers: Dict[str, str]) -> str:
    """
    格式化用戶的技術決策
    
    Args:
        socratic_answers: {"q1": "optimistic_lock", "q2": "polling"}
    
    Returns:
        格式化的決策說明
    """
    
    # 決策描述映射
    decision_descriptions = {
        # 樂觀鎖/悲觀鎖
        'optimistic_lock': '樂觀鎖（Optimistic Lock）- 允許並發，衝突時回滾',
        'pessimistic_lock': '悲觀鎖（Pessimistic Lock）- 排他鎖定，防止並發',
        'reserve_inventory': '預留庫存（Reserve Inventory）- 下單時鎖定，限時付款',
        
        # 支付處理
        'polling': '定期輪詢（Polling）- 定期查詢支付狀態',
        'rely_callback': '依賴回調（Rely on Callback）- 等待支付平台通知',
        'manual_fix': '人工處理（Manual Fix）- 異常訂單人工介',
        
        # 草稿保存
        'auto_save': '自動保存（Auto Save）- 每30秒自動保存草稿',
        'manual_save': '手動保存（Manual Save）- 僅在用戶點擊時保存',
        'localstorage': 'LocalStorage暫存 - 使用瀏覽器本地存儲',
        
        # 垃圾過濾
        'ai_filter': 'AI自動過濾（AI Filter）- 使用機器學習過濾',
        'manual_review': '人工審核（Manual Review）- 所有內容需審核',
        'rate_limit': 'IP限速（Rate Limit）- 限制提交頻率',
    }
    
    formatted = []
    for q_id, answer_value in socratic_answers.items():
        description = decision_descriptions.get(
            answer_value,
            f'{answer_value}'
        )
        formatted.append(f"- {q_id.upper()}: {description}")
    
    return '\n'.join(formatted) if formatted else "無特殊技術決策"


def get_prompt_template(
    scenario: str,
    socratic_answers: Dict[str, str]
) -> Dict[str, str]:
    """
    獲取場景和答案對應的Prompt模板
    
    這是從18萬筆數據中提取的核心邏輯
    """
    
    templates = {
        '電商': {
            'optimistic_lock': {
                'requirements': """
1. models.py - 數據模型（必須包含version字段）
2. views.py - API端點（包含衝突處理）
3. serializers.py - 序列化器
4. urls.py - 路由
5. requirements.txt - 依賴
                """,
                'must_implement': """
1. Product Model必須包含：
   - version字段（IntegerField, default=0）
   - 樂觀鎖更新邏輯

2. Purchase API必須包含：
   - 檢查version是否匹配
   - 使用F()表達式原子更新
   - 衝突時返回409 Conflict

3. 錯誤處理：
   - 捕獲OptimisticLockException
   - 返回清晰的錯誤訊息
                """
            },
            'polling': {
                'requirements': """
1. models.py - Order模型
2. tasks.py - Celery定期任務
3. views.py - 支付API
4. requirements.txt - 包含celery
                """,
                'must_implement': """
1. Order Model必須包含：
   - payment_status字段
   - check_payment_status()方法

2. Celery任務：
   - 每5分鐘檢查待確認訂單
   - 調用支付平台API核對狀態
   - 更新訂單狀態

3. 配置：
   - Celery beat配置
   - 支付平台API配置
                """
            }
        },
        
        '部落格': {
            'auto_save': {
                'requirements': """
1. models.py - Draft模型
2. views.py - 自動保存API
3. static/js/ - 前端定時器
4. requirements.txt
                """,
                'must_implement': """
1. Draft Model：
   - auto_saved_at時間戳
   - content TextField

2. Auto-save API：
   - POST /api/drafts/auto-save/
   - 返回保存時間

3. 前端JavaScript：
   - setInterval每30秒調用
   - 只在內容有變化時保存
                """
            },
            'ai_filter': {
                'requirements': """
1. models.py - Comment模型
2. ml/spam_filter.py - AI過濾器
3. views.py - 評論API
4. requirements.txt - ML庫
                """,
                'must_implement': """
1. Comment Model：
   - is_spam布爾字段
   - spam_score分數

2. AI過濾器：
   - 使用sklearn或transformers
   - 訓練好的模型文件
   - predict()方法

3. 評論處理：
   - 提交時自動過濾
   - 疑似垃圾標記review
                """
            }
        }
    }
    
    # 獲取場景模板
    scenario_templates = templates.get(scenario, {})
    
    # 根據答案選擇模板
    for answer_value in socratic_answers.values():
        if answer_value in scenario_templates:
            return scenario_templates[answer_value]
    
    # 默認模板
    return {
        'requirements': """
1. models.py - 數據模型
2. views.py - API端點
3. serializers.py - 序列化器
4. urls.py - 路由配置
5. requirements.txt - 依賴列表
        """,
        'must_implement': """
1. 完整的CRUD操作
2. 錯誤處理
3. 數據驗證
4. API文檔
        """
    }


def generate_fix_prompt(
    code: str,
    validation_result: Dict
) -> str:
    """
    根據驗證結果生成修復Prompt
    
    Args:
        code: 原始代碼
        validation_result: 17層驗證結果
    
    Returns:
        修復Prompt
    """
    
    # 提取失敗的層
    failed_layers = [
        layer for layer in validation_result['layers']
        if not layer['passed']
    ]
    
    issues = []
    for layer in failed_layers:
        layer_num = layer['layer']
        name = layer['name']
        message = layer['message']
        issues.append(f"L{layer_num} ({name}): {message}")
    
    prompt = f"""以下代碼未通過質量驗證，請修復：

## 原始代碼
```python
{code}
```

## 驗證失敗的問題
{chr(10).join(issues)}

## 建議
{chr(10).join(validation_result.get('suggestions', []))}

請修復以上問題，返回完整的修正後代碼（JSON格式）。
"""
    
    return prompt


if __name__ == '__main__':
    # 測試
    test_requirement = "我想做一個電商系統"
    test_answers = {
        "q1": "optimistic_lock",
        "q2": "polling"
    }
    
    prompt = generate_code_prompt(
        requirement=test_requirement,
        framework="Django",
        socratic_answers=test_answers
    )
    
    print("=" * 60)
    print("生成的Prompt:")
    print("=" * 60)
    print(prompt)
