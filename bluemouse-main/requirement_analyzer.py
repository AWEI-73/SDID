"""
Requirement Analyzer - 需求模糊點分析器

檢測用戶需求中的模糊點、邏輯漏洞和潛在災難場景，
決定是否需要觸發蘇格拉底面試。
"""

import re
from typing import Dict, List, Any, Optional


class RequirementAnalyzer:
    """需求分析器 - 檢測模糊點和邏輯漏洞"""
    
    # 模糊關鍵詞（觸發面試的信號）
    FUZZY_KEYWORDS = [
        # 數量不明確
        '一些', '幾個', '多個', '很多',
        # 時間不明確
        '快速', '實時', '即時', '盡快',
        # 規模不明確
        '大量', '海量', '高並發', '大規模',
        # 邏輯不明確
        '可能', '也許', '應該', '大概',
        # 範圍不明確
        '等等', '之類', '相關', '類似'
    ]
    
    # 災難場景關鍵詞（必須追問的領域）
    DISASTER_KEYWORDS = [
        # 併發問題
        '併發', '並發', '多用戶', '同時',
        # 一致性問題
        '數據', '資料', '狀態', '交易',
        # 可用性問題
        '支付', '訂單', '金錢', '庫存',
        # 安全問題
        '用戶', '認證', '權限', '密碼',
        # 性能問題
        '查詢', '搜索', '列表', '分頁'
    ]
    
    def analyze(self, requirement: str) -> Dict[str, Any]:
        """
        分析需求，返回分析結果
        
        Args:
            requirement: 用戶需求描述
        
        Returns:
            {
                "needs_interview": bool,
                "fuzzy_points": [...],
                "disaster_scenarios": [...],
                "complexity_score": 0-10
            }
        """
        fuzzy_points = self._detect_fuzzy_keywords(requirement)
        disaster_scenarios = self._detect_disaster_scenarios(requirement)
        complexity_score = self._calculate_complexity(requirement)
        
        # 決策邏輯：有模糊點 OR 有災難場景 OR 複雜度 > 5
        needs_interview = (
            len(fuzzy_points) > 0 or
            len(disaster_scenarios) > 0 or
            complexity_score > 5
        )
        
        return {
            "needs_interview": needs_interview,
            "fuzzy_points": fuzzy_points,
            "disaster_scenarios": disaster_scenarios,
            "complexity_score": complexity_score,
            "word_count": len(requirement),
            "analysis_summary": self._generate_summary(
                fuzzy_points, 
                disaster_scenarios, 
                complexity_score
            )
        }
    
    def _detect_fuzzy_keywords(self, requirement: str) -> List[Dict[str, str]]:
        """檢測模糊關鍵詞"""
        found = []
        for keyword in self.FUZZY_KEYWORDS:
            if keyword in requirement:
                # 找到上下文
                pattern = f".{{0,20}}{re.escape(keyword)}.{{0,20}}"
                matches = re.finditer(pattern, requirement)
                for match in matches:
                    found.append({
                        "keyword": keyword,
                        "context": match.group(0),
                        "type": "fuzzy"
                    })
        return found
    
    def _detect_disaster_scenarios(self, requirement: str) -> List[Dict[str, str]]:
        """檢測災難場景關鍵詞"""
        found = []
        for keyword in self.DISASTER_KEYWORDS:
            if keyword in requirement:
                # 確定災難類型
                disaster_type = self._classify_disaster(keyword)
                found.append({
                    "keyword": keyword,
                    "type": disaster_type,
                    "severity": "high" if disaster_type in ["concurrency", "payment"] else "medium"
                })
        return found
    
    def _classify_disaster(self, keyword: str) -> str:
        """分類災難類型"""
        disaster_map = {
            "併發": "concurrency",
            "並發": "concurrency",
            "多用戶": "concurrency",
            "同時": "concurrency",
            "數據": "consistency",
            "資料": "consistency",
            "狀態": "consistency",
            "交易": "consistency",
            "支付": "payment",
            "訂單": "payment",
            "金錢": "payment",
            "庫存": "payment",
            "用戶": "security",
            "認證": "security",
            "權限": "security",
            "密碼": "security",
            "查詢": "performance",
            "搜索": "performance",
            "列表": "performance",
            "分頁": "performance"
        }
        return disaster_map.get(keyword, "general")
    
    def _calculate_complexity(self, requirement: str) -> int:
        """
        計算複雜度分數 (0-10)
        
        依據：
        - 字數（越長越複雜）
        - 功能數量（「、」的數量）
        - 系統數量（「系統」、「平台」、「服務」的數量）
        """
        word_count = len(requirement)
        feature_count = requirement.count('、') + requirement.count('，')
        system_count = (
            requirement.count('系統') + 
            requirement.count('平台') + 
            requirement.count('服務')
        )
        
        # 計算分數
        score = 0
        if word_count > 100:
            score += 3
        elif word_count > 50:
            score += 2
        elif word_count > 20:
            score += 1
        
        score += min(feature_count, 4)  # 最多加4分
        score += min(system_count * 2, 3)  # 最多加3分
        
        return min(score, 10)
    
    def _generate_summary(
        self, 
        fuzzy_points: List[Dict], 
        disaster_scenarios: List[Dict],
        complexity_score: int
    ) -> str:
        """生成分析摘要"""
        parts = []
        
        if len(fuzzy_points) > 0:
            parts.append(f"發現 {len(fuzzy_points)} 個模糊描述")
        
        if len(disaster_scenarios) > 0:
            parts.append(f"發現 {len(disaster_scenarios)} 個潛在災難場景")
        
        if complexity_score > 7:
            parts.append("需求複雜度高")
        elif complexity_score > 4:
            parts.append("需求複雜度中等")
        
        if not parts:
            return "需求描述清晰，無明顯邏輯漏洞"
        
        return "、".join(parts) + "，建議進行蘇格拉底面試"


# 全局單例
_analyzer = None

def get_analyzer() -> RequirementAnalyzer:
    """獲取分析器單例"""
    global _analyzer
    if _analyzer is None:
        _analyzer = RequirementAnalyzer()
    return _analyzer


if __name__ == "__main__":
    # 測試分析器
    analyzer = get_analyzer()
    
    test_cases = [
        "建立一個簡單的部落格系統",
        "建立一個電商平台，需要處理高並發訂單、支付、庫存管理等功能",
        "我想做一個類似 Uber 的叫車系統，用戶可以快速叫車，司機可以即時接單"
    ]
    
    print("🔍 需求分析測試")
    print("=" * 60)
    
    for i, req in enumerate(test_cases, 1):
        print(f"\n測試 {i}: {req[:30]}...")
        result = analyzer.analyze(req)
        print(f"  需要面試: {'✅ 是' if result['needs_interview'] else '❌ 否'}")
        print(f"  模糊點: {len(result['fuzzy_points'])} 個")
        print(f"  災難場景: {len(result['disaster_scenarios'])} 個")
        print(f"  複雜度: {result['complexity_score']}/10")
        print(f"  摘要: {result['analysis_summary']}")
