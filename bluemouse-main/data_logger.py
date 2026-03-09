"""
數據日誌系統 (Data Logger)
攔截並記錄用戶的高價值決策數據

🚨 核心修正 3: Data Trap - 商業護城河
這是未來的資產,記錄人類的決策邏輯
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import hashlib


class DataLogger:
    """
    數據日誌記錄器
    記錄用戶在邏輯面試中的決策
    """
    
    def __init__(self, log_file: str = "data_trap.jsonl"):
        """
        初始化數據日誌器
        
        Args:
            log_file: 日誌文件路徑
        """
        self.log_file = log_file
        self._ensure_log_file()
    
    def _ensure_log_file(self):
        """確保日誌文件存在"""
        if not os.path.exists(self.log_file):
            # 創建空文件
            with open(self.log_file, 'w', encoding='utf-8') as f:
                pass
    
    def log_decision(
        self,
        scenario: str,
        question: str,
        options: List[str],
        user_choice: int,
        rejected_choices: List[int],
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        記錄用戶決策
        
        Args:
            scenario: 場景名稱 (如 "付款超時處理")
            question: 問題內容
            options: 所有選項
            user_choice: 用戶選擇的選項索引
            rejected_choices: 被拒絕的選項索引列表
            context: 額外上下文信息
            
        Returns:
            記錄的唯一 ID
        """
        # 生成唯一 ID
        record_id = self._generate_id(scenario, question)
        
        # 構建記錄
        record = {
            "id": record_id,
            "timestamp": datetime.now().isoformat(),
            "scenario": scenario,
            "question": question,
            "options": options,
            "user_choice": {
                "index": user_choice,
                "text": options[user_choice] if 0 <= user_choice < len(options) else None
            },
            "rejected_choices": [
                {
                    "index": idx,
                    "text": options[idx] if 0 <= idx < len(options) else None
                }
                for idx in rejected_choices
            ],
            "context": context or {},
            "data_quality": "high_value"  # 標記為高價值數據
        }
        
        # 寫入日誌
        self._append_record(record)
        
        return record_id
    
    def log_question_answer(
        self,
        module_name: str,
        question_data: Dict[str, Any],
        answer_index: int,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        記錄問答數據 (簡化版)
        
        Args:
            module_name: 模組名稱
            question_data: 問題數據 (包含 text, options, category 等)
            answer_index: 用戶選擇的答案索引
            metadata: 額外元數據
            
        Returns:
            記錄 ID
        """
        options = question_data.get('options', [])
        rejected = [i for i in range(len(options)) if i != answer_index]
        
        context = {
            "module": module_name,
            "category": question_data.get('category', 'unknown'),
            "risk_analysis": question_data.get('risk_analysis', {}),
            **(metadata or {})
        }
        
        return self.log_decision(
            scenario=f"{module_name} - {question_data.get('category', 'decision')}",
            question=question_data.get('text', ''),
            options=options,
            user_choice=answer_index,
            rejected_choices=rejected,
            context=context
        )
    
    def _generate_id(self, scenario: str, question: str) -> str:
        """
        生成唯一 ID
        
        Args:
            scenario: 場景
            question: 問題
            
        Returns:
            唯一 ID
        """
        content = f"{scenario}:{question}:{datetime.now().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _append_record(self, record: Dict[str, Any]):
        """
        追加記錄到日誌文件
        
        Args:
            record: 記錄數據
        """
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        獲取數據統計
        
        Returns:
            統計信息
        """
        if not os.path.exists(self.log_file):
            return {
                "total_records": 0,
                "scenarios": {},
                "categories": {}
            }
        
        total = 0
        scenarios = {}
        categories = {}
        
        with open(self.log_file, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                
                try:
                    record = json.loads(line)
                    total += 1
                    
                    # 統計場景
                    scenario = record.get('scenario', 'unknown')
                    scenarios[scenario] = scenarios.get(scenario, 0) + 1
                    
                    # 統計類別
                    category = record.get('context', {}).get('category', 'unknown')
                    categories[category] = categories.get(category, 0) + 1
                    
                except json.JSONDecodeError:
                    continue
        
        return {
            "total_records": total,
            "scenarios": scenarios,
            "categories": categories
        }
    
    def export_training_data(self, output_file: str = "training_data.jsonl"):
        """
        導出訓練數據格式
        
        Args:
            output_file: 輸出文件路徑
        """
        if not os.path.exists(self.log_file):
            return
        
        with open(self.log_file, 'r', encoding='utf-8') as f_in:
            with open(output_file, 'w', encoding='utf-8') as f_out:
                for line in f_in:
                    if not line.strip():
                        continue
                    
                    try:
                        record = json.loads(line)
                        
                        # 轉換為訓練數據格式
                        training_record = {
                            "prompt": record['question'],
                            "completion": record['user_choice']['text'],
                            "rejected": [choice['text'] for choice in record['rejected_choices']],
                            "metadata": {
                                "scenario": record['scenario'],
                                "category": record.get('context', {}).get('category'),
                                "timestamp": record['timestamp']
                            }
                        }
                        
                        f_out.write(json.dumps(training_record, ensure_ascii=False) + '\n')
                        
                    except (json.JSONDecodeError, KeyError):
                        continue


# 全局單例
_logger_instance = None


def get_logger(log_file: str = "data_trap.jsonl") -> DataLogger:
    """
    獲取全局日誌器實例
    
    Args:
        log_file: 日誌文件路徑
        
    Returns:
        DataLogger 實例
    """
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = DataLogger(log_file)
    return _logger_instance


# 便捷函數
def log_user_decision(
    scenario: str,
    question: str,
    options: List[str],
    user_choice: int,
    **kwargs
) -> str:
    """
    記錄用戶決策 (便捷函數)
    
    Args:
        scenario: 場景
        question: 問題
        options: 選項列表
        user_choice: 用戶選擇
        **kwargs: 額外參數
        
    Returns:
        記錄 ID
    """
    logger = get_logger()
    rejected = [i for i in range(len(options)) if i != user_choice]
    return logger.log_decision(scenario, question, options, user_choice, rejected, kwargs.get('context'))


if __name__ == "__main__":
    # 測試數據日誌器
    print("=" * 70)
    print("🧪 測試數據日誌系統")
    print("=" * 70)
    print()
    
    logger = DataLogger("test_data_trap.jsonl")
    
    # 測試記錄 1: 付款超時
    print("記錄測試數據 1: 付款超時處理")
    record_id_1 = logger.log_decision(
        scenario="付款超時處理",
        question="如果付款 API 超時 30 秒,你要如何處理?",
        options=[
            "A. 重試三次",
            "B. 直接報錯",
            "C. 標記為待處理"
        ],
        user_choice=1,  # 選擇 B
        rejected_choices=[0, 2],  # 拒絕 A 和 C
        context={
            "module": "付款系統",
            "category": "error_handling",
            "user_id": "test_user_001"
        }
    )
    print(f"  記錄 ID: {record_id_1}")
    print()
    
    # 測試記錄 2: 庫存並發
    print("記錄測試數據 2: 庫存並發處理")
    record_id_2 = logger.log_decision(
        scenario="庫存並發處理",
        question="兩個用戶同時購買最後一件商品,你要如何處理?",
        options=[
            "A. 先到先得",
            "B. 兩者都成功,超賣",
            "C. 使用樂觀鎖"
        ],
        user_choice=2,  # 選擇 C
        rejected_choices=[0, 1],
        context={
            "module": "庫存系統",
            "category": "concurrency"
        }
    )
    print(f"  記錄 ID: {record_id_2}")
    print()
    
    # 獲取統計
    print("數據統計:")
    stats = logger.get_statistics()
    print(f"  總記錄數: {stats['total_records']}")
    print(f"  場景分布: {stats['scenarios']}")
    print(f"  類別分布: {stats['categories']}")
    print()
    
    # 導出訓練數據
    print("導出訓練數據...")
    logger.export_training_data("test_training_data.jsonl")
    print("  ✅ 已導出到 test_training_data.jsonl")
    print()
    
    print("✅ 數據日誌系統測試完成!")
    print()
    print("💡 提示: 這些數據將成為你的商業護城河!")
