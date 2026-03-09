"""
需求複雜度分析器
智能分析需求的複雜程度，決定問題數量和深度
"""

import re
from typing import Dict, List, Tuple


def analyze_requirement_complexity(requirement: str) -> Dict:
    """
    分析需求複雜度
    
    返回:
    - complexity_score: 複雜度分數 (0-10)
    - question_count: 建議問題數量 (1-5)
    - scenarios: 檢測到的場景列表
    - depth_level: 深度級別 (basic/advanced/expert)
    """
    
    req_lower = requirement.lower()
    complexity_score = 0
    detected_scenarios = []
    
    # === 場景檢測 ===
    scenarios_patterns = {
        '部落格': r'部落格|blog|文章|內容管理|cms',
        '電商': r'電商|購物|訂單|商品|庫存|交易',
        '預約': r'預約|預訂|排程|日曆|時段',
        '聊天': r'聊天|即時|訊息|社交|IM',
        '支付': r'支付|金流|錢包|交易|payment',
        '會員': r'會員|用戶|帳號|登入|註冊',
        '搜尋': r'搜尋|檢索|查詢|search',
        '文件': r'文件|檔案|上傳|儲存|OSS',
        '視頻': r'視頻|影片|直播|媒體|video',
        '待辦': r'待辦|任務|todo|gtd',
        'Web3': r'區塊鏈|blockchain|web3|crypto|dao|defi|nft|智能合約',
    }
    
    for scenario_name, pattern in scenarios_patterns.items():
        if re.search(pattern, req_lower):
            detected_scenarios.append(scenario_name)
            complexity_score += 1
    
    # === 複雜度關鍵字 ===
    complexity_keywords = {
        # 高複雜度 (+3)
        r'多租戶|saas|multi.?tenant': 3,
        r'微服務|microservice': 3,
        r'實時|real.?time|即時': 2,
        
        # 中複雜度 (+2)
        r'分散式|distributed': 2,
        r'高併發|high.?concurrency': 2,
        r'多國|多語言|i18n|l10n': 2,
        r'大數據|big.?data': 2,
        
        # 基礎複雜度 (+1)
        r'api|restful': 1,
        r'資料庫|database': 1,
        r'認證|auth': 1,
        r'權限|permission|rbac': 1,
        r'緩存|cache|redis': 1,
        r'CDN': 1,
        r'推送|notification': 1,
    }
    
    for pattern, score in complexity_keywords.items():
        if re.search(pattern, req_lower):
            complexity_score += score
    
    # === 規模指標 ===
    scale_keywords = {
        r'百萬|million|millions': 2,
        r'千萬|十萬': 3,
        r'billions|億': 4,
        r'每秒|qps|tps': 2,
        r'高可用|HA|99\.9': 2,
    }
    
    for pattern, score in scale_keywords.items():
        if re.search(pattern, req_lower):
            complexity_score += score
    
    # === 需求長度加權 ===
    req_length = len(requirement)
    if req_length > 200:
        complexity_score += 2
    elif req_length > 100:
        complexity_score += 1
    
    # === 決定問題數量 ===
    if complexity_score <= 2:
        question_count = 2  # 簡單：部落格
        depth_level = 'basic'
    elif complexity_score <= 5:
        question_count = 3  # 中等：電商+支付
        depth_level = 'advanced'
    elif complexity_score <= 8:
        question_count = 5  # 複雜：多租戶SaaS
        depth_level = 'expert'
    elif complexity_score <= 12:
        question_count = 7  # 極複雜：分散式高併發
        depth_level = 'expert'
    else:
        question_count = 10  # 瘋狂複雜：核能+區塊鏈+社交 (BlueMouse Ultimate Mode)
        depth_level = 'insane'
    
    # 至少2個問題
    question_count = max(2, question_count)
    
    return {
        'complexity_score': complexity_score,
        'question_count': question_count,
        'scenarios': detected_scenarios,
        'depth_level': depth_level,
        'is_simple': complexity_score <= 2,
        'is_complex': complexity_score >= 6,
    }


def get_priority_questions(scenarios: List[str], question_count: int) -> List[str]:
    """
    根據場景和數量，返回應該問的問題優先級列表
    
    返回問題類型列表，如: ['inventory', 'payment', 'security']
    """
    
    # 核心問題池（每個場景的必問問題）
    core_questions = {
        '部落格': ['draft_recovery', 'spam_protection'],
        '電商': ['inventory_concurrency', 'payment_callback'],
        '預約': ['booking_conflict', 'no_show'],
        '聊天': ['offline_sync', 'message_delivery'],
        '支付': ['payment_timeout', 'refund_logic'],
        '會員': ['auth_security', 'session_management'],
        '搜尋': ['search_performance', 'result_ranking'],
        '文件': ['upload_resume', 'storage_limit'],
        '視頻': ['streaming_quality', 'bandwidth'],
        '待辦': ['delete_cascade', 'sync_conflict'],
    }
    
    # 進階問題池（複雜場景的額外問題）
    advanced_questions = {
        '電商': ['flash_sale', 'multi_warehouse'],
        'SaaS': ['tenant_isolation', 'data_privacy'],
        '實時': ['websocket_fallback', 'state_consistency'],
        '高併發': ['rate_limiting', 'circuit_breaker'],
    }
    
    questions = []
    
    # 1. 收集核心問題
    for scenario in scenarios[:3]:  # 最多取前3個場景
        if scenario in core_questions:
            questions.extend(core_questions[scenario])
    
    # 2. 如果檢測到高級特性，添加進階問題
    # （這裡可以根據complexity_score判斷）
    
    # 3. 返回優先級最高的N個問題
    return questions[:question_count]


if __name__ == '__main__':
    # 測試
    test_cases = [
        "我想做一個簡單的部落格",
        "我想做一個電商系統，有會員、支付、庫存管理",
        "我想做一個多租戶SaaS平台，支持實時同步、分散式部署、每秒處理百萬請求",
    ]
    
    for req in test_cases:
        result = analyze_requirement_complexity(req)
        print(f"\n需求: {req}")
        print(f"  複雜度: {result['complexity_score']}")
        print(f"  問題數: {result['question_count']}")
        print(f"  場景: {result['scenarios']}")
        print(f"  深度: {result['depth_level']}")
