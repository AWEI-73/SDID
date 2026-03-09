"""
質量監控器 - 監控數據收集的質量和進度
"""

import json
from typing import Dict, List
from collections import Counter
from datetime import datetime


class QualityMonitor:
    """數據質量監控器"""
    
    def __init__(self, data_file: str = "data_trap.jsonl"):
        self.data_file = data_file
        self.data = []
        self.load_data()
    
    def load_data(self):
        """加載數據"""
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                self.data = [json.loads(line) for line in f]
            print(f"✅ 已加載 {len(self.data)} 筆數據")
        except FileNotFoundError:
            print(f"⚠️ 文件不存在: {self.data_file}")
            self.data = []
    
    def check_diversity(self) -> Dict:
        """檢查數據多樣性"""
        print("\n📊 數據多樣性分析")
        print("="*70)
        
        # 按領域統計
        domains = Counter(item.get("domain", "unknown") for item in self.data)
        
        # 按來源統計
        sources = Counter(
            item.get("metadata", {}).get("source_type", "unknown") 
            for item in self.data
        )
        
        print("\n領域分布:")
        for domain, count in domains.most_common():
            percentage = count / len(self.data) * 100
            print(f"  {domain:25s}: {count:5d} ({percentage:5.1f}%)")
        
        print("\n來源分布:")
        for source, count in sources.most_common():
            percentage = count / len(self.data) * 100
            print(f"  {source:15s}: {count:5d} ({percentage:5.1f}%)")
        
        return {
            "total": len(self.data),
            "domains": dict(domains),
            "sources": dict(sources)
        }
    
    def check_quality(self) -> Dict:
        """檢查數據質量"""
        print("\n🔍 數據質量分析")
        print("="*70)
        
        if not self.data:
            print("⚠️ 沒有數據")
            return {}
        
        # 質量評分統計
        scores = []
        passed_count = 0
        
        for item in self.data:
            validation = item.get("validation_result", {})
            score = validation.get("quality_score", 0)
            scores.append(score)
            
            if validation.get("passed", False):
                passed_count += 1
        
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # 評分分布
        score_ranges = {
            "90-100": sum(1 for s in scores if s >= 90),
            "80-89": sum(1 for s in scores if 80 <= s < 90),
            "70-79": sum(1 for s in scores if 70 <= s < 80),
            "< 70": sum(1 for s in scores if s < 70)
        }
        
        print(f"\n平均質量評分: {avg_score:.1f}/100")
        print(f"驗證通過率: {passed_count}/{len(self.data)} ({passed_count/len(self.data)*100:.1f}%)")
        
        print("\n評分分布:")
        for range_name, count in score_ranges.items():
            percentage = count / len(scores) * 100 if scores else 0
            print(f"  {range_name:10s}: {count:5d} ({percentage:5.1f}%)")
        
        return {
            "average_score": avg_score,
            "pass_rate": passed_count / len(self.data) if self.data else 0,
            "score_distribution": score_ranges
        }
    
    def check_progress(self, target: int = 50000) -> Dict:
        """檢查收集進度"""
        print("\n📈 收集進度分析")
        print("="*70)
        
        current = len(self.data)
        percentage = current / target * 100
        remaining = target - current
        
        print(f"\n當前進度: {current:,} / {target:,} ({percentage:.1f}%)")
        print(f"剩餘目標: {remaining:,} 筆")
        
        # 按領域檢查進度
        from data_collector import DomainDataCollector
        
        print("\n各領域進度:")
        domains = Counter(item.get("domain", "unknown") for item in self.data)
        
        for domain, config in DomainDataCollector.DOMAINS.items():
            target_count = config["target"]
            current_count = domains.get(domain, 0)
            progress = current_count / target_count * 100 if target_count > 0 else 0
            
            status = "✅" if progress >= 100 else "🔄" if progress >= 50 else "⏳"
            print(f"  {status} {domain:25s}: {current_count:5d} / {target_count:5d} ({progress:5.1f}%)")
        
        return {
            "current": current,
            "target": target,
            "percentage": percentage,
            "remaining": remaining
        }
    
    def generate_report(self, output_file: str = "quality_report.md"):
        """生成質量報告"""
        print("\n📝 生成質量報告...")
        
        diversity = self.check_diversity()
        quality = self.check_quality()
        progress = self.check_progress()
        
        report = f"""# 數據質量報告

**生成時間**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  
**數據文件**: {self.data_file}

---

## 📊 總體統計

- **總數據量**: {len(self.data):,} 筆
- **目標數據量**: 50,000 筆
- **完成進度**: {progress['percentage']:.1f}%
- **平均質量評分**: {quality.get('average_score', 0):.1f}/100
- **驗證通過率**: {quality.get('pass_rate', 0)*100:.1f}%

---

## 🎯 領域分布

| 領域 | 數據量 | 目標 | 進度 |
|------|--------|------|------|
"""
        
        from data_collector import DomainDataCollector
        domains = Counter(item.get("domain", "unknown") for item in self.data)
        
        for domain, config in DomainDataCollector.DOMAINS.items():
            target_count = config["target"]
            current_count = domains.get(domain, 0)
            progress_pct = current_count / target_count * 100 if target_count > 0 else 0
            report += f"| {domain} | {current_count:,} | {target_count:,} | {progress_pct:.1f}% |\n"
        
        report += f"""
---

## 📈 質量分析

### 評分分布

| 分數範圍 | 數量 | 百分比 |
|---------|------|--------|
"""
        
        for range_name, count in quality.get('score_distribution', {}).items():
            percentage = count / len(self.data) * 100 if self.data else 0
            report += f"| {range_name} | {count:,} | {percentage:.1f}% |\n"
        
        report += f"""
---

## 🔍 來源分析

| 來源類型 | 數量 | 百分比 |
|---------|------|--------|
"""
        
        sources = Counter(
            item.get("metadata", {}).get("source_type", "unknown") 
            for item in self.data
        )
        
        for source, count in sources.most_common():
            percentage = count / len(self.data) * 100
            report += f"| {source} | {count:,} | {percentage:.1f}% |\n"
        
        report += "\n---\n\n**報告結束**\n"
        
        # 保存報告
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report)
        
        print(f"✅ 報告已保存到 {output_file}")
        
        return report


if __name__ == "__main__":
    monitor = QualityMonitor()
    monitor.check_diversity()
    monitor.check_quality()
    monitor.check_progress()
    monitor.generate_report()
