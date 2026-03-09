"""
成本估算器 - 藍圖小老鼠
智能估算項目開發成本、時間和團隊配置
"""

from typing import Dict, List, Any
from datetime import datetime


def estimate_cost(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """
    估算項目成本
    
    Args:
        blueprint: 藍圖資訊
        
    Returns:
        成本估算結果
    """
    modules = blueprint.get('modules', [])
    complexity = blueprint.get('complexity', '中等')
    
    # 估算開發時間
    development = estimate_development_time(modules, complexity)
    
    # 估算開發成本
    dev_cost = estimate_development_cost(development)
    
    # 估算運營成本
    operations = estimate_operations_cost(modules, complexity)
    
    # 估算團隊配置
    team = estimate_team_size(modules, complexity)
    
    # 生成里程碑
    milestones = generate_milestones(development['total_days'])
    
    return {
        "development": development,
        "cost": dev_cost,
        "operations": operations,
        "team": team,
        "milestones": milestones,
        "summary": generate_summary(development, dev_cost, operations, team)
    }


def estimate_development_time(modules: List[Dict], complexity: str) -> Dict[str, Any]:
    """
    估算開發時間
    
    Args:
        modules: 模組列表
        complexity: 複雜度
        
    Returns:
        開發時間估算
    """
    # 基礎時間 (天)
    base_days = {
        "簡單": 30,
        "中等": 60,
        "複雜": 120
    }
    
    # 每個模組的平均時間
    module_days = {
        "簡單": 5,
        "中等": 10,
        "複雜": 20
    }
    
    # 計算總時間
    base = base_days.get(complexity, 60)
    module_time = len(modules) * module_days.get(complexity, 10)
    
    total_days = base + module_time
    
    # 考慮整合時間 (20%)
    integration_days = int(total_days * 0.2)
    
    # 考慮測試時間 (15%)
    testing_days = int(total_days * 0.15)
    
    # 總時間
    final_days = total_days + integration_days + testing_days
    
    return {
        "base_days": base,
        "module_days": module_time,
        "integration_days": integration_days,
        "testing_days": testing_days,
        "total_days": final_days,
        "months": round(final_days / 22, 1),  # 工作日
        "breakdown": {
            "開發": total_days,
            "整合": integration_days,
            "測試": testing_days
        }
    }


def estimate_development_cost(development: Dict[str, Any]) -> Dict[str, Any]:
    """
    估算開發成本
    
    Args:
        development: 開發時間估算
        
    Returns:
        開發成本估算
    """
    # 每人每天成本 (USD)
    daily_rate = {
        "前端工程師": 500,
        "後端工程師": 600,
        "全端工程師": 650,
        "UI/UX 設計師": 450,
        "項目經理": 550,
        "QA 測試": 400
    }
    
    total_days = development['total_days']
    
    # 基本團隊配置
    team_config = {
        "前端工程師": 2,
        "後端工程師": 2,
        "UI/UX 設計師": 1,
        "項目經理": 0.5,  # 兼職
        "QA 測試": 1
    }
    
    # 計算總成本
    total_cost = 0
    cost_breakdown = {}
    
    for role, count in team_config.items():
        role_cost = daily_rate[role] * count * total_days
        cost_breakdown[role] = {
            "人數": count,
            "天數": total_days,
            "日薪": daily_rate[role],
            "總計": int(role_cost)
        }
        total_cost += role_cost
    
    # 添加其他成本 (10%)
    other_cost = int(total_cost * 0.1)
    
    return {
        "total": int(total_cost + other_cost),
        "breakdown": cost_breakdown,
        "other_costs": {
            "工具和軟件": int(other_cost * 0.4),
            "培訓": int(other_cost * 0.3),
            "雜項": int(other_cost * 0.3)
        },
        "currency": "USD"
    }


def estimate_operations_cost(modules: List[Dict], complexity: str) -> Dict[str, Any]:
    """
    估算運營成本
    
    Args:
        modules: 模組列表
        complexity: 複雜度
        
    Returns:
        運營成本估算
    """
    # 基礎設施成本 (月)
    infrastructure = {
        "簡單": {
            "服務器": 100,
            "數據庫": 50,
            "CDN": 30,
            "存儲": 20
        },
        "中等": {
            "服務器": 300,
            "數據庫": 150,
            "CDN": 80,
            "存儲": 50
        },
        "複雜": {
            "服務器": 800,
            "數據庫": 400,
            "CDN": 200,
            "存儲": 150
        }
    }
    
    base_infra = infrastructure.get(complexity, infrastructure["中等"])
    
    # 第三方服務成本
    third_party = {
        "郵件服務": 20,
        "簡訊服務": 30,
        "支付網關": 50,
        "監控告警": 40
    }
    
    # 根據模組數量調整
    module_factor = 1 + (len(modules) * 0.1)
    
    monthly_infra = {k: int(v * module_factor) for k, v in base_infra.items()}
    monthly_total = sum(monthly_infra.values()) + sum(third_party.values())
    
    return {
        "monthly": monthly_total,
        "yearly": monthly_total * 12,
        "breakdown": {
            "基礎設施": monthly_infra,
            "第三方服務": third_party
        },
        "scaling": {
            "1000 用戶": monthly_total,
            "10000 用戶": int(monthly_total * 2),
            "100000 用戶": int(monthly_total * 5)
        }
    }


def estimate_team_size(modules: List[Dict], complexity: str) -> Dict[str, Any]:
    """
    估算團隊配置
    
    Args:
        modules: 模組列表
        complexity: 複雜度
        
    Returns:
        團隊配置建議
    """
    # 基礎團隊
    base_team = {
        "簡單": {
            "前端工程師": 1,
            "後端工程師": 1,
            "UI/UX 設計師": 1,
            "項目經理": 0.5
        },
        "中等": {
            "前端工程師": 2,
            "後端工程師": 2,
            "UI/UX 設計師": 1,
            "項目經理": 0.5,
            "QA 測試": 1
        },
        "複雜": {
            "前端工程師": 3,
            "後端工程師": 3,
            "全端工程師": 1,
            "UI/UX 設計師": 2,
            "項目經理": 1,
            "QA 測試": 2,
            "DevOps": 1
        }
    }
    
    team = base_team.get(complexity, base_team["中等"])
    
    # 根據模組數量調整
    if len(modules) > 5:
        team["後端工程師"] = team.get("後端工程師", 2) + 1
    
    total_members = sum(team.values())
    
    return {
        "total": total_members,
        "roles": team,
        "recommendations": [
            "建議採用敏捷開發方法",
            "每週進行代碼審查",
            "使用 Git 進行版本控制",
            "設置 CI/CD 自動化部署"
        ]
    }


def generate_milestones(total_days: int) -> List[Dict[str, Any]]:
    """
    生成項目里程碑
    
    Args:
        total_days: 總開發天數
        
    Returns:
        里程碑列表
    """
    milestones = []
    
    # 階段劃分
    phases = [
        {"name": "需求分析和設計", "percent": 0.15},
        {"name": "MVP 開發", "percent": 0.30},
        {"name": "功能完善", "percent": 0.30},
        {"name": "測試和優化", "percent": 0.15},
        {"name": "上線準備", "percent": 0.10}
    ]
    
    current_day = 0
    for phase in phases:
        days = int(total_days * phase['percent'])
        current_day += days
        
        milestones.append({
            "name": phase['name'],
            "days": days,
            "cumulative_days": current_day,
            "deliverables": get_phase_deliverables(phase['name'])
        })
    
    return milestones


def get_phase_deliverables(phase_name: str) -> List[str]:
    """獲取階段交付物"""
    deliverables = {
        "需求分析和設計": [
            "需求文檔",
            "系統架構設計",
            "數據庫設計",
            "UI/UX 設計稿"
        ],
        "MVP 開發": [
            "核心功能實現",
            "基礎 API",
            "數據庫搭建",
            "基本前端頁面"
        ],
        "功能完善": [
            "所有功能模組",
            "完整 API",
            "前端完整頁面",
            "用戶體驗優化"
        ],
        "測試和優化": [
            "單元測試",
            "集成測試",
            "性能優化",
            "安全加固"
        ],
        "上線準備": [
            "部署文檔",
            "用戶手冊",
            "運維手冊",
            "上線檢查清單"
        ]
    }
    
    return deliverables.get(phase_name, [])


def generate_summary(
    development: Dict,
    cost: Dict,
    operations: Dict,
    team: Dict
) -> str:
    """
    生成成本估算摘要
    
    Args:
        development: 開發時間
        cost: 開發成本
        operations: 運營成本
        team: 團隊配置
        
    Returns:
        摘要文本
    """
    summary = f"""
📊 成本估算摘要

⏱️ 開發時間: {development['months']} 個月 ({development['total_days']} 天)
💰 開發成本: ${cost['total']:,} USD
📈 月運營成本: ${operations['monthly']:,} USD
👥 團隊規模: {team['total']} 人

🎯 關鍵指標:
- 首年總成本: ${cost['total'] + operations['yearly']:,} USD
- 平均每月成本: ${int((cost['total'] + operations['yearly']) / 12):,} USD
- 建議啟動資金: ${int(cost['total'] * 1.2):,} USD (含 20% 緩衝)

💡 建議:
- 採用敏捷開發,分階段交付
- 優先開發 MVP,快速驗證市場
- 預留 20% 時間和預算應對變更
"""
    
    return summary.strip()
