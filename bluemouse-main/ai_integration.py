"""
AI 集成模組 - 藍圖小老鼠
使用 Antigravity AI 進行真正的自然語言架構生成
"""

import json
import os
from typing import Dict, List, Any

# AI 提示詞模板
ANALYSIS_PROMPT = """你是一個資深軟體架構師。用戶需求如下:

{user_input}

請分析這個需求,回答以下問題:

1. 這是什麼類型的系統? (電商/社交/工具/遊戲/企業應用/...)
2. 核心功能有哪些?
3. 需要哪些技術模組?
4. 預估複雜度? (簡單/中等/複雜)
5. 類似的產品有哪些?

請用 JSON 格式回答:
{{
  "type": "系統類型",
  "core_features": ["功能1", "功能2", "功能3"],
  "modules": ["模組1", "模組2", "模組3"],
  "complexity": "簡單/中等/複雜",
  "similar_products": ["產品1", "產品2"]
}}

只返回 JSON,不要其他文字。
"""

MODULE_GENERATION_PROMPT = """基於以下需求分析結果:
{analysis_result}

請為每個模組生成詳細規格。對於每個模組,請提供:
1. 模組名稱
2. 模組說明
3. 核心功能列表
4. 技術選型建議
5. 預估開發天數

請用 JSON 格式回答:
{{
  "modules": [
    {{
      "name": "模組名稱",
      "description": "模組說明",
      "features": ["功能1", "功能2"],
      "tech_stack": {{
        "backend": "後端技術",
        "database": "資料庫",
        "cache": "快取"
      }},
      "estimated_days": 10
    }}
  ]
}}

只返回 JSON,不要其他文字。
"""

# ========================================
# 核心修正 2: 蘇格拉底式提問 (Socratic Questioning)
# ========================================

SOCRATIC_QUESTION_PROMPT = """你是一個嚴格的系統架構面試官。你的任務是提出**決策型/邊界型**問題,而非配置型問題。

模組: {module_name}
說明: {module_description}
功能: {module_features}

請生成 3-5 個問題,每個問題必須:
1. 聚焦於**邊界情況**或**錯誤處理**
2. 要求用戶做出**明確的設計決策**
3. 暴露用戶對系統行為的**深層理解**

❌ **不要問配置型問題**:
- "你要用什麼資料庫?" (配置)
- "端口號是多少?" (配置)
- "要不要加快取?" (是非題)

✅ **要問決策型問題**:
- "如果付款 API 超時 30 秒,你要 (A) 重試三次 (B) 直接報錯給用戶 (C) 標記為待處理?" (決策)
- "如果庫存扣除成功但訂單建立失敗,你要如何回滾?" (邊界)
- "兩個用戶同時購買最後一件商品,你要如何處理?" (並發)

問題格式:
{{
  "questions": [
    {{
      "text": "問題描述",
      "category": "error_handling" | "concurrency" | "boundary" | "recovery" | "consistency",
      "options": ["選項A", "選項B", "選項C"],
      "risk_analysis": {{
        "0": "✅ 優點: ...\\n⚠️ 風險: ...\\n📊 影響: ...",
        "1": "✅ 優點: ...\\n⚠️ 風險: ...\\n📊 影響: ...",
        "2": "✅ 優點: ...\\n⚠️ 風險: ...\\n📊 影響: ..."
      }},
      "trap": "測試用戶是否理解..."
    }}
  ]
}}

只返回 JSON,不要其他文字。
"""

# 舊的 Prompt 保留作為 fallback
QUESTION_GENERATION_PROMPT_OLD = """為模組「{module_name}」生成蘇格拉底式問題。

模組說明: {module_description}
核心功能: {module_features}

請生成 5-8 個問題,每個問題要:
1. 問到關鍵決策點
2. 提供 3-4 個選項
3. 說明每個選項的影響
4. 包含「🤷 先跳過」選項

請用 JSON 格式回答:
{{
  "questions": [
    {{
      "text": "問題內容?",
      "explanation": "為什麼問這個問題",
      "options": ["選項1", "選項2", "選項3", "🤷 先跳過"],
      "impact": {{
        "0": "✅ 優點1\\n⚠️ 缺點1",
        "1": "✅ 優點2\\n⚠️ 缺點2",
        "2": "✅ 優點3\\n⚠️ 缺點3"
      }}
    }}
  ]
}}

只返回 JSON,不要其他文字。
"""


async def ai_analyze(user_input: str) -> Dict[str, Any]:
    """
    使用 AI 分析用戶需求
    
    Args:
        user_input: 用戶的自然語言需求描述
        
    Returns:
        分析結果 JSON
    """
    prompt = ANALYSIS_PROMPT.format(user_input=user_input)
    
    # TODO: 接入真正的 Antigravity AI
    # 目前使用模擬響應
    # 調用真正的寄生 AI
    response = await ai_call(prompt, temperature=0.7)
    
    try:
        result = parse_json_response(response)
        return result
    except Exception as e:
        print(f"AI 分析失敗: {e}")
        return get_fallback_analysis(user_input)


async def ai_generate_modules(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    根據分析結果生成模組列表
    
    Args:
        analysis: AI 分析結果
        
    Returns:
        模組列表 JSON
    """
    prompt = MODULE_GENERATION_PROMPT.format(
        analysis_result=json.dumps(analysis, ensure_ascii=False, indent=2)
    )
    
    response = await ai_call(prompt, temperature=0.7)
    
    try:
        result = parse_json_response(response)
        return result
    except Exception as e:
        print(f"模組生成失敗: {e}")
        return get_fallback_modules(analysis)


async def ai_generate_questions(module: Dict[str, Any]) -> Dict[str, Any]:
    """
    為指定模組生成問題
    
    🚨 核心修正 2: 蘇格拉底式提問
    生成決策型/邊界型問題,而非配置型問題
    
    Args:
        module: 模組資訊
        
    Returns:
        問題列表 JSON
    """
    # 使用新的蘇格拉底式 Prompt
    prompt = SOCRATIC_QUESTION_PROMPT.format(
        module_name=module['name'],
        module_description=module.get('description', ''),
        module_features=', '.join(module.get('features', []))
    )
    
    response = await ai_call(prompt, temperature=0.8)
    
    try:
        result = parse_json_response(response)
        
        # 🚨 過濾配置型問題
        if 'questions' in result:
            filtered_questions = []
            for q in result['questions']:
                if is_decision_question(q):
                    filtered_questions.append(q)
                else:
                    print(f"⚠️ 過濾配置型問題: {q.get('text', '')}")
            
            result['questions'] = filtered_questions
            
            # 如果過濾後沒有問題,使用 fallback
            if not filtered_questions:
                print("⚠️ 所有問題都被過濾,使用 fallback")
                return get_fallback_questions(module)
        
        return result
    except Exception as e:
        print(f"問題生成失敗: {e}")
        return get_fallback_questions(module)


def is_decision_question(question: Dict[str, Any]) -> bool:
    """
    判斷是否為決策型問題
    
    🚨 核心修正 2: 問題質量過濾
    排除配置型問題,保留決策型/邊界型問題
    
    Args:
        question: 問題字典
        
    Returns:
        bool: 是否為決策型問題
    """
    text = question.get('text', '').lower()
    
    # 配置型關鍵詞 (排除)
    config_keywords = [
        '資料庫', '端口', '配置', '設定', '參數',
        'database', 'port', 'config', 'setting',
        '用什麼', '選擇哪個', '要不要',
        '是否需要', '需要嗎'
    ]
    
    # 如果包含配置型關鍵詞,可能是配置型問題
    has_config_keyword = any(kw in text for kw in config_keywords)
    
    # 決策型關鍵詞 (保留)
    decision_keywords = [
        '如果', '失敗', '超時', '衝突', '同時', '回滾', '恢復',
        '錯誤', '異常', '並發', '競爭', '一致性',
        'if', 'fail', 'timeout', 'conflict', 'rollback',
        '怎麼處理', '如何', '怎樣', '要如何'
    ]
    
    has_decision_keyword = any(kw in text for kw in decision_keywords)
    
    # 檢查是否有 category 標記
    category = question.get('category', '')
    decision_categories = ['error_handling', 'concurrency', 'boundary', 'recovery', 'consistency']
    has_decision_category = category in decision_categories
    
    # 決策邏輯:
    # 1. 如果有決策型關鍵詞或類別,保留
    # 2. 如果只有配置型關鍵詞且沒有決策型關鍵詞,排除
    if has_decision_keyword or has_decision_category:
        return True
    
    if has_config_keyword and not has_decision_keyword:
        return False
    
    # 默認保留 (寬鬆策略)
    return True


async def ai_call(prompt: str, temperature: float = 0.7) -> str:
    """
    使用寄生 AI 調用
    
    三層策略:
    1. 自動寄生 (檢測 API Key)
    2. 配置寄生 (讀取配置文件)
    3. 手動寄生 (用戶觸發)
    """
    from ultimate_parasite_ai import ai_generate
    
    return await ai_generate(prompt, temperature)


def parse_json_response(response: str) -> Dict[str, Any]:
    """
    解析 AI 返回的 JSON
    
    Args:
        response: AI 響應文本
        
    Returns:
        解析後的 JSON 對象
    """
    # 提取 JSON 部分
    response = response.strip()
    
    # 如果有 markdown 代碼塊,提取出來
    if "```json" in response:
        start = response.find("```json") + 7
        end = response.find("```", start)
        response = response[start:end].strip()
    elif "```" in response:
        start = response.find("```") + 3
        end = response.find("```", start)
        response = response[start:end].strip()
    
    return json.loads(response)


def generate_mock_analysis(prompt: str) -> str:
    """生成模擬的需求分析"""
    # 從 prompt 中提取用戶輸入
    user_input = prompt.split("用戶需求如下:")[1].split("請分析")[0].strip()
    
    # 智能分析
    if any(kw in user_input for kw in ['電商', '購物', '商城', '蝦皮', '淘寶']):
        return json.dumps({
            "type": "電商平台",
            "core_features": ["商品管理", "購物車", "訂單處理", "支付", "物流追蹤"],
            "modules": ["用戶系統", "商品系統", "訂單系統", "支付系統", "物流系統"],
            "complexity": "中等",
            "similar_products": ["蝦皮", "淘寶", "Amazon"]
        }, ensure_ascii=False)
    
    elif any(kw in user_input for kw in ['社交', '聊天', '交友', 'IG', 'Facebook']):
        return json.dumps({
            "type": "社交平台",
            "core_features": ["用戶資料", "動態發布", "即時聊天", "好友系統", "通知"],
            "modules": ["用戶系統", "動態系統", "聊天系統", "好友系統", "通知系統"],
            "complexity": "複雜",
            "similar_products": ["Instagram", "Facebook", "Twitter"]
        }, ensure_ascii=False)
    
    else:
        # 通用分析
        return json.dumps({
            "type": "應用系統",
            "core_features": ["用戶管理", "數據處理", "業務邏輯"],
            "modules": ["用戶系統", "核心業務系統", "數據系統"],
            "complexity": "中等",
            "similar_products": []
        }, ensure_ascii=False)


def generate_mock_modules(prompt: str) -> str:
    """生成模擬的模組列表"""
    # 簡化版,實際會根據分析結果生成
    return json.dumps({
        "modules": [
            {
                "name": "用戶系統",
                "description": "處理用戶註冊、登入、權限管理",
                "features": ["註冊", "登入", "權限管理", "個人資料"],
                "tech_stack": {
                    "backend": "Django + JWT",
                    "database": "PostgreSQL",
                    "cache": "Redis"
                },
                "estimated_days": 10
            }
        ]
    }, ensure_ascii=False)


def generate_mock_questions(prompt: str) -> str:
    """生成模擬的問題列表"""
    return json.dumps({
        "questions": [
            {
                "text": "需要用戶登入嗎?",
                "explanation": "決定系統是否需要用戶認證功能",
                "options": ["需要", "不需要", "🤷 先跳過"],
                "impact": {
                    "0": "✅ 可以個性化體驗\n⚠️ 增加開發成本",
                    "1": "✅ 開發簡單\n⚠️ 無法個性化"
                }
            }
        ]
    }, ensure_ascii=False)


def get_fallback_analysis(user_input: str) -> Dict[str, Any]:
    """AI 失敗時的後備分析"""
    return {
        "type": "應用系統",
        "core_features": ["基礎功能"],
        "modules": ["核心模組"],
        "complexity": "中等",
        "similar_products": []
    }


def get_fallback_modules(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """AI 失敗時的後備模組"""
    return {
        "modules": [
            {
                "name": "核心模組",
                "description": "系統核心功能",
                "features": ["基礎功能"],
                "tech_stack": {
                    "backend": "Python",
                    "database": "SQLite",
                    "cache": "內存"
                },
                "estimated_days": 5
            }
        ]
    }


def get_fallback_questions(module: Dict[str, Any]) -> Dict[str, Any]:
    """AI 失敗時的後備問題"""
    return {
        "questions": [
            {
                "text": f"{module['name']}需要什麼功能?",
                "explanation": "確定模組的核心功能",
                "options": ["基礎功能", "完整功能", "🤷 先跳過"],
                "impact": {
                    "0": "✅ 快速上線",
                    "1": "✅ 功能完整"
                }
            }
        ]
    }
