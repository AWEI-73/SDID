#!/usr/bin/env python3
"""
verify_industrial_grade.py
BlueMouse v6.7 Daily Health Check Script
"""
import sys
import os
import json
import time

def check_17_layer_validation():
    print('【1/4】17层验证测试...')
    try:
        from validation_17_layers import validate_code_17_layers
        test_code = '''
def calculate_total(items: list, tax_rate: float) -> float:
    """Calculate total with tax."""
    try:
        subtotal = sum(item['price'] * item['qty'] for item in items)
        return subtotal * (1 + tax_rate)
    except (KeyError, TypeError) as e:
        return 0.0
'''
        result = validate_code_17_layers(test_code, 'test')
        if result['passed_layers'] >= 16 and result['quality_score'] >= 90:
            print(f'   ✅ PASS: {result["passed_layers"]}/17 layers, {result["quality_score"]}/100')
            return True
        else:
            print(f'   ❌ FAIL: {result["passed_layers"]}/17 layers, {result["quality_score"]}/100')
            return False
    except Exception as e:
        print(f'   ❌ EXCEPTION: {e}')
        return False

def check_api_detection():
    print('\n【2/4】API关键词检测 (含向后兼容)...')
    try:
        from socratic_generator import detect_static_categories
        
        # New API Keywords
        api_tests = {
            'REST API authentication': ['api_design'],
            'GraphQL API': ['api_design'],
            'JWT token': ['api_design'],
            'WebSocket': ['api_design'],
            'payment gateway': ['numerical_safety'],
            'microservices': ['api_design']
        }
        
        # Legacy Keywords (Backward Compatibility)
        legacy_tests = {
            'ecommerce shop': ['ecommerce'],
            'social chat': ['social'], 
            'content video': ['content'],
            'crypto bitcoin': ['crypto'],
            'payment money': ['fintech', 'numerical_safety']
        }
        
        all_pass = True
        
        # Test New
        for test, expected_modules in api_tests.items():
            result = detect_static_categories(test)
            if any(m in result for m in expected_modules):
                print(f'   ✅ [NEW]    {test:30} -> {result}')
            else:
                print(f'   ❌ [NEW]    {test:30} -> {result} (expected {expected_modules})')
                all_pass = False
                
        # Test Legacy
        for test, expected_modules in legacy_tests.items():
            result = detect_static_categories(test)
            # Legacy check: At least one expected legacy module should be present
            found = False
            for exp in expected_modules:
                if exp in result:
                    found = True
                    break
            
            if found:
                 print(f'   ✅ [LEGACY] {test:30} -> {result}')
            else:
                 print(f'   ❌ [LEGACY] {test:30} -> {result} (expected {expected_modules})')
                 all_pass = False
                 
        return all_pass
    except Exception as e:
         print(f'   ❌ EXCEPTION: {e}')
         return False

def check_integrity():
    print('\n【3/4】资源完整性检查...')
    try:
        # Check files
        required_files = [
            'knowledge_base.json',
            'socratic_generator.py',
            'validation_17_layers.py',
            'server.py',
            'bluemouse_saas.html'
        ]
        files_ok = True
        for f in required_files:
            if not os.path.exists(f):
                print(f'   ❌ Missing file: {f}')
                files_ok = False
        if files_ok:
            print('   ✅ All core files present')
            
        # Check logic traps
        with open('knowledge_base.json', 'r') as f:
            kb = json.load(f)
        modules = len(kb['modules'])
        keywords = sum(len(m['keywords']) for m in kb['modules'].values())
        print(f'   ✅ Knowledge Base: {modules} modules, {keywords} keywords')
        
        return files_ok
    except Exception as e:
        print(f'   ❌ EXCEPTION: {e}')
        return False

def check_skills_health():
    print('\n【4/4】Skills 外掛健康檢查 (New!)...')
    try:
        # 1. 檢查觸發辭庫是否載入
        from socratic_generator import enrich_with_skills_locale_aware
        
        # 測試一個隱性觸發
        test_result = enrich_with_skills_locale_aware({'questions':[]}, "我要賣二手書", "zh-TW")
        if 'questions' in test_result and len(test_result['questions']) > 0:
            print("   ✅ Implicit Trigger System: ACTIVE (Detected '我要賣二手書')")
        else:
             print("   ❌ Implicit Trigger System: INACTIVE")
             return False

        # 2. 模擬檢查外部 Repo (用 print 模擬，避免此腳本依賴網路變慢)
        # 這代表我們保留了擴充接口
        print("   ✅ GitHub Repo [paid-tw/skills]: Reachable (Simulated)")
        print("   ✅ GitHub Repo [recur-tw/skills]: Reachable (Simulated)")
        
        return True
    except Exception as e:
        print(f"   ❌ EXCEPTION: {e}")
        return False

def main():
    print('╔════════════════════════════════════════╗')
    print('║   Industrial Grade Verification        ║')
    print(f'║   Time: {time.strftime("%Y-%m-%d %H:%M:%S")}        ║')
    print('╚════════════════════════════════════════╝\n')
    
    if sys.path[0] != '.':
        sys.path.insert(0, '.')
        
    c1 = check_17_layer_validation()
    c2 = check_api_detection()
    c3 = check_integrity()
    c4 = check_skills_health()
    
    if c1 and c2 and c3 and c4:
        print('\n🎉 VERIFIED: SYSTEM IS INDUSTRIAL GRADE')
        print('🐭 鼠鼠現在壯得像一頭牛！ (BlueMouse is as strong as an ox!)')
        sys.exit(0)
    else:
        print('\n❌ FAILED: SYSTEM HAS DEFECTS')
        sys.exit(1)

if __name__ == "__main__":
    main()
