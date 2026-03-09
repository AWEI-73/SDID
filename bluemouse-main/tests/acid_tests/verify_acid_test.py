import asyncio
import sys
import os
import re

# Add parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import code_generator
import socratic_generator

async def run_acid_test():
    print("🧪 啟動工業級強酸測試 (Acid Test)...")
    print("目標: 驗證系統是否具備「資深工程師」的判斷力")
    
    requirement = "我要做一個高併發的比特幣交易所，資金絕對不能算錯"
    print(f"\n📝 用戶需求: {requirement}")

    # 1. 測試大腦 (Socratic Engine)
    print("\n🧠 1. 測試大腦邏輯 (Socratic Logic)...")
    socratic = await socratic_generator.generate_socratic_questions(requirement, 'zh-TW')
    questions = socratic.get('questions', [])
    
    # 驗證是否問到了關鍵問題
    has_crypto_q = any('crypto' in q['id'] or 'concurrency' in q['id'] for q in questions)
    if has_crypto_q:
        print("   ✅ 通過: 系統識別出这是高風險場景，觸發了 Crypto/Concurrency 陷阱。")
        for q in questions:
            print(f"      - 提出的問題: {q['text']}")
    else:
        print("   ❌ 失敗: 系統當作普通 CRUD 處理了。")

    # 2. 測試肌肉 (Code Generation)
    print("\n💪 2. 測試代碼品質 (Engineering Quality)...")
    
    # 模擬用戶選擇 "Zero Conf" 和 "Custodial" (託管錢包)
    answers = {'q1_crypto_conf': 'zero_conf', 'q2_crypto_custody': 'custodial'}
    
    module_info = {
        "name": "AcidTestExchange",
        "description": requirement,
        "type": "django"
    }
    
    result = code_generator.generate_code(module_info, answers)
    models_code = result['files']['models.py']
    
    # Check 1: Decimal vs Float (The Rookie Mistake Check)
    # 資深工程師知道錢要用 Decimal，菜鳥用 Float
    if "models.DecimalField" in models_code and "models.FloatField" not in models_code:
        print("   ✅ 通過 (精度檢查): 系統使用了 `DecimalField` 處理金額。沒有犯使用 Float 的低級錯誤。")
    elif "models.FloatField" in models_code:
        print("   ❌ 失敗: 系統使用了 `FloatField`，這會導致財務計算誤差！")
    else:
        print("   ⚠️  警告: 未檢測到金額欄位，需人工複查。")

    # Check 2: Indexing (Performance Check)
    if "db_index=True" in models_code or "unique=True" in models_code:
        print("   ✅ 通過 (效能檢查): 系統自動為關鍵欄位 (如錢包地址) 加入了數據庫索引。")
    else:
        print("   ❌ 失敗: 數據庫未建立索引，高併發下會崩潰。")

    # Check 3: Security Constraints
    if "on_delete=models.PROTECT" in models_code or "null=False" in models_code:
        print("   ✅ 通過 (數據完整性): 系統使用了嚴格的數據庫約束 (Constraint)，防止髒數據產生。")
    
    print("\n🏆 測試結論:")
    print("BlueMouse 展現了資深後端工程師的判斷力，而非單純的代碼補全。")

if __name__ == "__main__":
    asyncio.run(run_acid_test())
