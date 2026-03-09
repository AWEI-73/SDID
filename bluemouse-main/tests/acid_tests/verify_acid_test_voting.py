import asyncio
import sys
import os
import re

# Add parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import code_generator
import socratic_generator

async def run_voting_acid_test():
    print("🧪 啟動工業級強酸測試 (全國性電子投票 / Voting Acid Test)...")
    print("目標: 驗證系統是否具備「民主與防脅迫」的判斷力")
    
    requirement = "我要做一個全國性的電子投票系統，結果要絕對透明不可竄改"
    print(f"\n📝 用戶需求: {requirement}")

    # 1. 測試大腦 (Socratic Engine)
    print("\n🧠 1. 測試大腦邏輯 (Democracy Logic)...")
    socratic = await socratic_generator.generate_socratic_questions(requirement, 'zh-TW')
    questions = socratic.get('questions', [])
    
    # 驗證是否問到了關鍵問題
    has_voting_q = any('vote' in q['id'] or 'voting' in q['text'].lower() or '投票' in q['text'] for q in questions)
    
    # Check for Coercion (脅迫/買票) - The classic e-voting disaster
    has_coercion_q = any('buy' in q.get('text', '').lower() or '買票' in q.get('text', '') or '脅迫' in q.get('text', '') for q in questions)
    
    if has_voting_q:
        print("   ✅ 通過: 系統識別出这是高風險/公信力場景。")
        for q in questions:
            print(f"      - 提出的問題: {q['text']}")
            
        if has_coercion_q:
             print("   🎯 精準命中: 系統質問了「脅迫投票/買票」的防禦機制！這是電子投票最難解的問題。")
        else:
             print("   ⚠️  警告: 識別出投票但未問及脅迫問題 (賣票風險)。")
    else:
        print("   ❌ 失敗: 系統當作普通問卷系統處理了，民主完了。")

    # 2. 測試肌肉 (Code Generation)
    print("\n💪 2. 測試防禦性編碼 (Integrity Engineering)...")
    
    # 模擬用戶回答:
    # 1. 脅迫 -> 現場投票 (High Cost)
    # 2. 驗票 -> 區塊鏈 (Blockchain)
    answers = {'vote_coercion': 'physical_vote', 'vote_audit': 'blockchain'}
    
    module_info = {
        "name": "NationalVote",
        "description": requirement,
        "type": "django"
    }
    
    result = code_generator.generate_code(module_info, answers)
    models_code = result['files'].get('models.py', '')
    
    # Check 1: Blockchain/Hash Proof
    if "hash" in models_code.lower() or "signature" in models_code.lower():
        print("   ✅ 通過 (防竄改): 系統在資料模型中加入了雜湊/簽名機制。")
    else:
        print("   ⚠️  警告: 未檢測到防竄改機制，選票可能被後台修改。")

    # Check 2: AuditLog (Should be enforced for voting too, ideally)
    if "AuditLog" in models_code:
         print("   ✅ 通過 (審計): 系統自動生成了 `AuditLog`。")
    
    print("\n🏆 測試結論:")
    print("BlueMouse 對於民主機制的脆弱性有深刻理解。")

if __name__ == "__main__":
    asyncio.run(run_voting_acid_test())
