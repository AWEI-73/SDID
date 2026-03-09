
import asyncio
import sys
import os

# Ensure we can import from root directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from antigravity_inline_generator import generate_questions_inline




def test_dynamic():
    test_cases = [
        ("1. 低風險 - 個人部落格 (Blog)", "我要寫一個個人部落格"),
        ("2. 高風險 - 加密貨幣交易 (Crypto)", "我要寫一個高頻比特幣交易機器人，涉及熱錢包資金"),
        ("3. 隱私敏感 - 聊天軟體 (Chat)", "我要做一個像 WhatsApp 的即時聊天 App，要重視隱私"),
        ("4. 高流量 - 影音串流 (Video)", "我要做一個像 Netflix 的 4K 影片串流平台"),
        ("5. 金融交易 - 第三方支付 (Payment)", "我要接 Stripe 金流，處理信用卡退款邏輯")
    ]

    print("="*60)
    print("🧠 BlueMouse IQ 測試 (5大場景連發)")
    print("="*60)

    for title, prompt in test_cases:
        print(f"\n{title}")
        print(f"📝 輸入: {prompt}")
        q = generate_questions_inline(prompt, "zh-TW")
        # print(f"  🔍 識別場景: {q.get('scenario', 'unknown')}") # Removed to avoid key error if not present
        
        questions = q['questions']
        if questions:
            print(f"  💡 BlueMouse 提問 (只列前 2 題):")
            for i, question in enumerate(questions[:2]):
                print(f"     Q{i+1}: {question['text']}")
        else:
            print("  ⚠️ 無提問 (可能是通用場景)")
        print("-" * 40)

if __name__ == "__main__":
    test_dynamic()


