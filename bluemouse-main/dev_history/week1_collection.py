"""
Week 1 數據收集腳本 - P1 領域
目標: 6,000 筆數據
領域: Web 開發、數據科學、機器學習、網絡安全
"""

import asyncio
import sys
from data_collector import DomainDataCollector
from quality_monitor import QualityMonitor
from datetime import datetime


async def collect_week1():
    """Week 1 收集任務"""
    
    print("="*70)
    print("🚀 Week 1 數據收集開始")
    print(f"時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("目標: 6,000 筆 (P1 領域)")
    print("="*70)
    
    # P1 領域配置
    domains = [
        ("web_development", 1500),
        ("data_science", 1500),
        ("machine_learning", 1500),
        ("cybersecurity", 1000)
    ]
    
    total_collected = 0
    total_validated = 0
    
    for domain, target in domains:
        print(f"\n{'='*70}")
        print(f"📋 領域: {domain}")
        print(f"🎯 目標: {target} 筆")
        print(f"{'='*70}")
        
        try:
            # 創建收集器
            collector = DomainDataCollector(domain)
            
            # 收集數據
            print(f"\n[1/2] 收集數據...")
            collected = await collector.collect_all()
            total_collected += len(collected)
            
            # 驗證並保存
            print(f"\n[2/2] 驗證並保存...")
            validated = await collector.validate_and_save()
            total_validated += len(validated)
            
            print(f"\n✅ {domain} 完成!")
            print(f"   收集: {len(collected)} 筆")
            print(f"   驗證通過: {len(validated)} 筆")
            print(f"   通過率: {len(validated)/len(collected)*100:.1f}%")
            
        except Exception as e:
            print(f"\n❌ {domain} 失敗: {e}")
            import traceback
            traceback.print_exc()
    
    # 生成週報
    print(f"\n{'='*70}")
    print("📊 Week 1 總結")
    print(f"{'='*70}")
    print(f"總收集: {total_collected} 筆")
    print(f"總驗證通過: {total_validated} 筆")
    print(f"總通過率: {total_validated/total_collected*100:.1f}%")
    
    # 質量監控
    print(f"\n{'='*70}")
    print("🔍 質量監控")
    print(f"{'='*70}")
    
    monitor = QualityMonitor()
    monitor.check_diversity()
    monitor.check_quality()
    monitor.check_progress()
    monitor.generate_report("week1_report.md")
    
    print(f"\n{'='*70}")
    print("✅ Week 1 收集完成!")
    print(f"{'='*70}")


if __name__ == "__main__":
    asyncio.run(collect_week1())
