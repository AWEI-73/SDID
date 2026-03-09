"""
完整壓力測試：模擬真實用戶的完整流程
包含：需求分析 → 問題生成 → 用戶選擇 → 結果驗證
"""

import json
import random
from antigravity_inline_generator import generate_questions_inline

# 模擬真實用戶的30個需求場景
test_scenarios = [
    # === 簡單需求（初學者）===
    {
        "user_id": "U001",
        "user_type": "學生",
        "requirement": "做一個簡單的個人部落格",
        "expected_complexity": "basic",
        "user_choices": {}  # 將在測試時填入
    },
    {
        "user_id": "U002", 
        "user_type": "小白",
        "requirement": "我想做一個Todo清單app",
        "expected_complexity": "basic"
    },
    {
        "user_id": "U003",
        "user_type": "新手",
        "requirement": "建立一個簡單的預約系統，讓客戶可以預約時間",
        "expected_complexity": "basic"
    },
    
    # === 中等需求（專業人士）===
    {
        "user_id": "U004",
        "user_type": "創業者",
        "requirement": "我要做一個電商平台，有商品管理、購物車、訂單系統和支付功能",
        "expected_complexity": "advanced"
    },
    {
        "user_id": "U005",
        "user_type": "產品經理",
        "requirement": "社群平台，用戶可以發文、評論、按讚，需要實時通知",
        "expected_complexity": "advanced"
    },
    {
        "user_id": "U006",
        "user_type": "餐廳老闆",
        "requirement": "線上訂餐系統，客戶下單、廚房接單、外送追蹤",
        "expected_complexity": "advanced"
    },
    {
        "user_id": "U007",
        "user_type": "健身教練",
        "requirement": "會員管理系統，可以預約課程、記錄運動數據、線上支付",
        "expected_complexity": "advanced"
    },
    {
        "user_id": "U008",
        "user_type": "醫生",
        "requirement": "診所預約系統，病患可以線上掛號、查看病歷、視訊問診",
        "expected_complexity": "advanced"
    },
    
    # === 複雜需求（企業級）===
    {
        "user_id": "U009",
        "user_type": "CTO",
        "requirement": "多租戶SaaS平台，支持企業自定義工作流、權限管理、數據隔離",
        "expected_complexity": "expert"
    },
    {
        "user_id": "U010",
        "user_type": "技術總監",
        "requirement": "大型電商，每秒10萬訂單，分散式架構，多倉庫庫存同步",
        "expected_complexity": "expert"
    },
    {
        "user_id": "U011",
        "user_type": "架構師",
        "requirement": "實時直播平台，百萬並發，CDN加速，智能推薦算法",
        "expected_complexity": "expert"
    },
    {
        "user_id": "U012",
        "user_type": "金融科技",
        "requirement": "支付網關系統，高可用99.99%，分散式事務，秒級對帳",
        "expected_complexity": "expert"
    },
    
    # === 特殊場景 ===
    {
        "user_id": "U013",
        "user_type": "教育工作者",
        "requirement": "在線教育平台，直播互動、作業批改、考試系統、學習分析",
        "expected_complexity": "expert"
    },
    {
        "user_id": "U014",
        "user_type": "區塊鏈開發",
        "requirement": "NFT交易平台，支持鑄造、拍賣、版稅分成",
        "expected_complexity": "expert"
    },
    {
        "user_id": "U015",
        "user_type": "遊戲開發",
        "requirement": "多人在線遊戲，實時對戰、排行榜、虛擬物品交易",
        "expected_complexity": "expert"
    },
]

def simulate_user_choices(questions):
    """
    模擬真實用戶的選擇行為
    根據問題類型，隨機選擇合理的答案
    """
    choices = {}
    for i, question in enumerate(questions, 1):
        # 隨機選擇A/B/C，模擬真實用戶的不確定性
        options = ['A', 'B', 'C']
        selected = random.choice(options)
        
        # 記錄用戶的選擇和思考過程
        option_obj = None
        for opt in question.get('options', []):
            if opt['label'].startswith(selected):
                option_obj = opt
                break
        
        choices[f"q{i}"] = {
            "selected": selected,
            "option_value": option_obj['value'] if option_obj else None,
            "description": option_obj['description'] if option_obj else None,
            "risk": option_obj.get('risk_score', 'unknown') if option_obj else None
        }
    
    return choices

def run_complete_stress_test():
    """
    完整的壓力測試：模擬真實用戶流程
    """
    print("=" * 80)
    print("🔥 藍圖小老鼠 - 完整壓力測試")
    print("=" * 80)
    print(f"\n📊 測試場景數: {len(test_scenarios)}")
    print("🎯 測試目標: 驗證系統魯棒性和問題質量\n")
    
    results = []
    
    for scenario in test_scenarios:
        print("\n" + "─" * 80)
        print(f"👤 用戶 {scenario['user_id']} ({scenario['user_type']})")
        print(f"📝 需求: {scenario['requirement']}")
        print("─" * 80)
        
        try:
            # 1. 生成問題
            print("\n【階段1: 需求分析與問題生成】")
            result = generate_questions_inline(scenario['requirement'], 'zh-TW')
            questions = result.get('questions', [])
            
            print(f"✅ 成功生成 {len(questions)} 個問題")
            
            # 2. 展示問題詳情
            print("\n【階段2: 蘇格拉底面試問題】")
            for i, q in enumerate(questions, 1):
                print(f"\n  問題 {i}: {q['text']}")
                for opt in q.get('options', []):
                    print(f"    {opt['label']}")
                    print(f"      → {opt['description']}")
                    print(f"      風險: {opt.get('risk_score', 'N/A')}")
            
            # 3. 模擬用戶選擇
            print("\n【階段3: 用戶決策過程】")
            choices = simulate_user_choices(questions)
            scenario['user_choices'] = choices
            
            for q_id, choice in choices.items():
                q_num = int(q_id[1:])
                print(f"\n  問題{q_num} 用戶選擇: {choice['selected']}")
                print(f"    選項: {choice['option_value']}")
                print(f"    說明: {choice['description']}")
                print(f"    風險評估: {choice['risk']}")
            
            # 4. 記錄結果
            test_result = {
                "user_id": scenario['user_id'],
                "user_type": scenario['user_type'],
                "requirement": scenario['requirement'],
                "expected_complexity": scenario['expected_complexity'],
                "questions_generated": len(questions),
                "question_ids": [q['id'] for q in questions],
                "user_choices": choices,
                "status": "success"
            }
            results.append(test_result)
            
            print(f"\n✅ 用戶 {scenario['user_id']} 流程完成")
            
        except Exception as e:
            print(f"\n❌ 錯誤: {e}")
            results.append({
                "user_id": scenario['user_id'],
                "status": "failed",
                "error": str(e)
            })
    
    # 5. 統計分析
    print("\n\n" + "=" * 80)
    print("📊 壓力測試統計")
    print("=" * 80)
    
    total = len(results)
    success = sum(1 for r in results if r['status'] == 'success')
    failed = total - success
    
    print(f"\n總測試數: {total}")
    print(f"成功: {success} ({success/total*100:.1f}%)")
    print(f"失敗: {failed} ({failed/total*100:.1f}%)")
    
    # 問題數量統計
    question_counts = {}
    for r in results:
        if r['status'] == 'success':
            count = r['questions_generated']
            question_counts[count] = question_counts.get(count, 0) + 1
    
    print(f"\n問題數量分佈:")
    for count in sorted(question_counts.keys()):
        freq = question_counts[count]
        print(f"  {count}個問題: {freq}次 ({freq/success*100:.1f}%)")
    
    # 保存詳細結果
    with open('stress_test_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 詳細結果已保存: stress_test_results.json")
    
    return results

if __name__ == '__main__':
    results = run_complete_stress_test()
    print("\n🎉 壓力測試完成！")
