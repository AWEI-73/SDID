import asyncio
import sys
import os
import json

# Add parent directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

import socratic_generator

async def run_bilingual_test():
    print("🌍 Starting Bilingual Acid Test...")
    
    # Test 1: Chinese Request -> Chinese Questions
    req_cn = "我要做一個類似蝦皮的電商平台"
    print(f"\n[Test 1] 🇹🇼 Chinese Request: {req_cn}")
    
    # Detect Categories First (Should match ecommerce)
    cats_cn = socratic_generator.detect_static_categories(req_cn)
    print(f"   Categories: {cats_cn}")
    
    # Generate Questions (L4 Fallback or whatever active layer)
    # We force L4 or mocked L1/L4 behavior by not setting API keys
    # But socratic_generator automatically handles it.
    
    res_cn = await socratic_generator.generate_socratic_questions(req_cn, 'zh-TW')
    qs_cn = res_cn.get('questions', [])
    
    if qs_cn:
        q1 = qs_cn[0]['text']
        print(f"   Generated Question 1: {q1}")
        # Check if text contains Chinese characters (e.g., "庫存", "蝦皮" or related domain terms)
        # Note: Generic questions might be returned if specific match fails, but they should still be in Chinese
        if any(char > '\u4e00' and char < '\u9fff' for char in q1):
            print("   ✅ Language Check: PASS (Contains Chinese)")
        else:
            print(f"   ❌ Language Check: FAIL (Expected Chinese, got English/Other): {q1}")
            
        # Check domain relevance
        if 'ecommerce' in cats_cn:
            # Should have ecommerce specific questions like "庫存" (Inventory)
            if '庫存' in q1 or '賣' in q1 or 'order' in q1.lower():
                 print("   ✅ Domain Check: PASS (Ecommerce context)")
            else:
                 print(f"   ⚠️ Domain Check: Warn (Maybe generic question?): {q1}")
    else:
        print("   ❌ Generation Failed: No questions.")

    # Test 2: English Request -> English Questions
    req_en = "I want to build an e-commerce platform like Shopify"
    print(f"\n[Test 2] 🇺🇸 English Request: {req_en}")
    
    cats_en = socratic_generator.detect_static_categories(req_en)
    print(f"   Categories: {cats_en}")
    
    res_en = await socratic_generator.generate_socratic_questions(req_en, 'en-US')
    qs_en = res_en.get('questions', [])
    
    if qs_en:
        q1_en = qs_en[0]['text']
        print(f"   Generated Question 1: {q1_en}")
        
        # Check IF it is English (ASCII mostly)
        if all(ord(c) < 128 for c in q1_en.replace('—', '-').replace('’', "'")):
            print("   ✅ Language Check: PASS (English)")
        else:
            print(f"   ❌ Language Check: FAIL (Contains non-English chars): {q1_en}")
            
        if 'ecommerce' in cats_en:
            if 'Inventory' in q1_en or 'Flash Sale' in q1_en or 'stock' in q1_en.lower():
                print("   ✅ Domain Check: PASS (Ecommerce context)")
            else:
                 print(f"   ⚠️ Domain Check: Warn (Maybe generic question?): {q1_en}")

    else:
        print("   ❌ Generation Failed: No questions.")

    # Test 3: Mixed/Weird Request (Mars Penguin) in English
    req_mix = "Mars Penguin Breeding System"
    print(f"\n[Test 3] 🐧 Mixed Request (English): {req_mix}")
    res_mix = await socratic_generator.generate_socratic_questions(req_mix, 'en-US')
    qs_mix = res_mix.get('questions', [])
    if qs_mix:
        print(f"   Generated: {qs_mix[0]['text']}")
        # Fallback check
        if 'concurrency' in qs_mix[0].get('id', '') or 'data' in qs_mix[0].get('text', '').lower():
             print("   ✅ Fallback Check: PASS (Generic/Data questions)")
    

if __name__ == "__main__":
    asyncio.run(run_bilingual_test())
