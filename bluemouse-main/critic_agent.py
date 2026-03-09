"""
Critic Agent (v5.2)
負責調用 17 層驗證系統，並提供統一的審查介面給 Agentic Loop。
"""

from typing import Dict, Any, Optional
from validation_17_layers import validate_code_17_layers

class CriticAgent:
    def __init__(self):
        pass

    def critique(self, code: str, spec: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        執行審查
        
        Args:
            code: 待審查代碼
            spec: 規格定義
            
        Returns:
            驗證結果字典
        """
        # 調用底層 17 層驗證邏輯
        result = validate_code_17_layers(code, "unknown_node", spec)
        
        return result

# 單例模式
_critic = None

def get_critic():
    global _critic
    if _critic is None:
        _critic = CriticAgent()
    return _critic
