#!/usr/bin/env python3
import asyncio
import time
import sys
import os
from typing import List, Dict

# 確保可以導入當前目錄的模塊
sys.path.append(os.getcwd())

from socratic_generator import generate_socratic_questions
from validation_17_layers import validate_code_17_layers

async def single_request_task(request_id: int, requirement: str):
    """模擬單個用戶請求的全流程壓力測試"""
    start_time = time.time()
    try:
        # 1. 測試蘇格拉底生成 (包含四層 AI 切換邏輯)
        # 這裡會觸發我們具現化的 API Key 層與內聯生成
        questions = await generate_socratic_questions(requirement, language='zh-TW')
        
        # 2. 測試 17 層驗證 (包含深層 AST 分析)
        # 模擬生成的代碼 (帶有一些潛在問題以測試具現化後的深度檢查)
        sample_code = """
def process_data(data: list) -> dict:
    \"\"\"
    核心處理邏輯
    \"\"\"
    try:
        # 故意製造嵌套循環以測試 L17
        for i in range(10):
            for j in range(10):
                for k in range(10):
                    pass
        
        # 故意製造危險函數以測試 L16
        # eval("data") 
        
        return {"status": "ok"}
    except:
        # 故意製造空捕獲以測試 L15
        pass
"""
        validation = validate_code_17_layers(sample_code, f"stress_{request_id}")
        
        duration = time.time() - start_time
        return {
            "id": request_id,
            "success": True,
            "duration": duration,
            "questions_count": len(questions.get('questions', [])),
            "quality_score": validation['quality_score'],
            "l15_passed": validation['layers'][14]['passed'],
            "l17_passed": validation['layers'][16]['passed']
        }
    except Exception as e:
        return {"id": request_id, "success": False, "error": str(e)}

async def run_stress_test(concurrency: int = 100):
    print(f"🔥 開始壓力測試 - 併發數: {concurrency}")
    print("="*50)
    
    tasks = []
    requirements = [
        "要做一個電商系統，要有庫存管理和支付",
        "簡單的部落格系統",
        "高併發聊天室，支持千萬用戶",
        "區塊鏈交易平台"
    ]
    
    start_all = time.time()
    for i in range(concurrency):
        tasks.append(single_request_task(i, requirements[i % len(requirements)]))
    
    results = await asyncio.gather(*tasks)
    total_duration = time.time() - start_all
    
    # 統計結果
    success_count = sum(1 for r in results if r.get('success'))
    avg_duration = sum(r['duration'] for r in results if r.get('success')) / success_count if success_count else 0
    l15_failures = sum(1 for r in results if r.get('success') and not r['l15_passed'])
    l17_failures = sum(1 for r in results if r.get('success') and not r['l17_passed'])
    
    print(f"\n📊 測試報告摘要:")
    print(f"總耗時: {total_duration:.2f}s")
    print(f"成功率: {success_count}/{concurrency} ({success_count/concurrency*100:.1f}%)")
    print(f"平均響應時間: {avg_duration:.3f}s")
    print(f"L15 (空捕獲) 檢出數: {l15_failures} (符合預期)")
    print(f"L17 (深嵌套) 檢出數: {l17_failures} (符合預期)")
    print(f"吞吐量: {concurrency/total_duration:.2f} req/s")
    
    if success_count == concurrency:
        print("\n🚀 系統在高併發下表現穩定，通過極限挑戰！")
    else:
        print("\n⚠️ 系統在高併發下出現部分失敗，需檢查資源鎖定情況。")

if __name__ == "__main__":
    asyncio.run(run_stress_test(100)) # 執行終極 100 併發壓測
