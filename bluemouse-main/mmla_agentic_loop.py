"""
MMLA Agentic Loop - MRM 遞迴驗證機制 (v5.2)
集成 Traffic Light Sentinel 與 Critic Agent 四層防護網
"""

import asyncio
from typing import Dict, List, Any, Optional
from traffic_light_sentinel import get_sentinel, NodeState
from critic_agent import get_critic

async def mmla_validate_with_retry(
    code: str,
    node_id: str,
    spec: Dict[str, Any],
    max_retries: int = 16,
    progress_callback: Optional[Any] = None  # 新增: 進度回調函數
) -> Dict[str, Any]:
    """
    帶自動修正的驗證循環 (集成 v5.2 核心邏輯)
    1. 狀態檢查 (Strict Gating)
    2. Critic Agent 審查
    3. 自動修正
    4. 狀態更新
    5. 進度推送 (新增)
    """
    sentinel = get_sentinel()
    critic = get_critic()
    
    # 0. 狀態檢查 - 確保節點處於 VALIDATING 狀態
    current_state = sentinel.get_node_status(node_id)
    if current_state != NodeState.VALIDATING:
        # 嘗試嘗試轉換狀態，如果失敗則無法繼續
        # 通常應該已經在 Caller 處轉為 CODING -> VALIDATING
        if not sentinel.transition(node_id, NodeState.VALIDATING):
             return {
                 "passed": False,
                 "message": f"Node {node_id} cannot enter VALIDATING state. Current: {current_state}",
                 "quality_score": 0
             }

    history = []
    current_code = code
    
    final_passed = False

    for attempt in range(max_retries):
        print(f"\n🔄 Agentic Loop v5.2 第 {attempt + 1}/{max_retries} 次迭代 | Node: {node_id}")
        
        # 📡 進度推送: 開始驗證
        if progress_callback:
            await progress_callback({
                "attempt": attempt + 1,
                "total": max_retries,
                "status": "validating",
                "layer": f"全面檢查 (Critic Agent)",
                "message": f"正在執行第 {attempt + 1} 次驗證..."
            })
        
        # 1. 執行 Critic Agent 四層防護網
        result = critic.critique(current_code, spec)
        
        history.append({
            "attempt": attempt + 1,
            "quality_score": result["quality_score"],
            "passed": result["passed"],
            "failed_layers": [
                 f"{layer['name']}: {layer.get('message')}" 
                 for layer in result["layers"] 
                 if not layer["passed"]
            ]
        })
        
        # 2. 如果通過
        if result["passed"]:
            print(f"✅ 驗證通過! (第 {attempt + 1} 次嘗試)")
            final_passed = True
            
            # 📡 進度推送: 驗證通過
            if progress_callback:
                await progress_callback({
                    "attempt": attempt + 1,
                    "total": max_retries,
                    "status": "passed",
                    "layer": "所有層級",
                    "message": f"✅ 驗證通過！質量分數: {result['quality_score']}/100"
                })
            
            # Verify or Die: 只有通過驗證才能轉為 IMPLEMENTED
            sentinel.transition(node_id, NodeState.IMPLEMENTED)
            
            result["agentic_loop"] = {
                "total_attempts": attempt + 1,
                "history": history,
                "final_code": current_code
            }
            return result
        
        # 3. 失敗處理
        # 如果質量評分沒有改善且嘗試多次，或許可以考慮提早終止，但 v5.2 傾向於嚴格重試直到 max_retries
        
        # 4. 使用 AI 修正代碼
        print(f"🔧 Critic 反饋: {result['suggestions']}")
        print(f"🔧 嘗試修正代碼...")
        
        # 📡 進度推送: 開始修正
        if progress_callback:
            await progress_callback({
                "attempt": attempt + 1,
                "total": max_retries,
                "status": "fixing",
                "layer": "AI 代碼修正",
                "message": f"正在根據建議修正代碼..."
            })
        
        try:
            fixed_code = await ai_fix_code(current_code, result["suggestions"], spec)
            current_code = fixed_code
            print(f"✅ 代碼已修正，準備重新驗證")
        except Exception as e:
            print(f"❌ 修正失敗: {e}")
            # 如果修正失敗，保持原代碼繼續下一輪break
            
    # 如果循環結束仍未通過
    if not final_passed:
        print(f"❌ 驗證失敗，退回 CODING 狀態")
        sentinel.transition(node_id, NodeState.CODING)

    # 返回最後一次驗證結果
    result["agentic_loop"] = {
        "total_attempts": len(history),
        "history": history,
        "max_retries_reached": len(history) >= max_retries,
        "final_code": current_code
    }
    return result


async def ai_fix_code(
    code: str,
    suggestions: List[str],
    spec: Dict[str, Any]
) -> str:
    """
    使用 AI 根據建議修正代碼
    """
    from ultimate_parasite_ai import ai_generate
    
    prompt = f"""請修正以下 Python 代碼，使其通過 Critic Agent 的嚴格審查 (v5.2)。

原始代碼:
```python
{code}
```

規格要求 (MMLA Spec):
{spec}

Critic Agent 審查意見 (必須解決):
{chr(10).join(f"- {s}" for s in suggestions)}

要求：
1. 嚴格遵守 Type Hints (100% 覆蓋)。
2. 確保處理所有 Edge Cases。
3. 不要包含任何解釋文字，只返回完整的修正後 Python 代碼。
"""
    
    response = await ai_generate(prompt, temperature=0.2) # 降低溫度以獲取更精確的修正
    
    # 提取代碼
    if "```python" in response:
        start = response.find("```python") + 9
        end = response.find("```", start)
        return response[start:end].strip()
    elif "```" in response:
        start = response.find("```") + 3
        end = response.find("```", start)
        return response[start:end].strip()
    else:
        return response.strip()


if __name__ == "__main__":
    # 測試環境集成測試
    test_code = """
def calculate_sum(a, b):
    return a + b
"""
    
    test_spec = {
        "spec": {
            "inputs": [
                {"name": "a", "type": "int"},
                {"name": "b", "type": "int"}
            ],
            "outputs": {"type": "int"}
        }
    }
    
    # 初始化一個測試用的 sentinel DB
    import os
    if os.path.exists("mmla_spec.json"):
         # 臨時備份以免破壞真實數據
         pass 

    # 模擬主循環調用
    print("🚀 啟動集成測試...")
    # 注意：由於這需要真實的 AI 調用，如果沒有配置環境變數可能會失敗，這裡僅作為代碼結構驗證
    try:
        result = asyncio.run(mmla_validate_with_retry(test_code, "test_node_integration", test_spec, max_retries=2))
        print(result)
    except Exception as e:
        print(f"Integration test skip/fail: {e}")
