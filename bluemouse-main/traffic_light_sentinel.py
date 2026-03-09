"""
Traffic Light Sentinel (紅綠燈哨兵系統) - v5.2
核心狀態機，負責管理每個開發節點的生命週期與依賴管控。
"""

import enum
import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

# 設定日誌
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TrafficLightSentinel")

class NodeState(enum.Enum):
    """
    節點狀態定義 (v5.2)
    """
    LOCKED = "LOCKED"           # 依賴未就緒
    IDLE = "IDLE"               # 待開發
    PLANNING = "PLANNING"       # 規劃中
    CODING = "CODING"           # 編碼中
    VALIDATING = "VALIDATING"   # 驗證中
    IMPLEMENTED = "IMPLEMENTED" # 已完成 (穩定)

class TrafficLightSentinel:
    """
    紅綠燈哨兵 - 有限狀態機 (FSM)
    """
    
    def __init__(self, spec_db_path: str = "mmla_spec.json"):
        self.spec_db_path = spec_db_path
        self._load_spec()

    def _load_spec(self):
        """加載規格庫"""
        if os.path.exists(self.spec_db_path):
            with open(self.spec_db_path, 'r', encoding='utf-8') as f:
                self.specs = json.load(f)
        else:
            self.specs = {"nodes": []}
            logger.warning(f"Spec DB not found at {self.spec_db_path}, initializing empty.")

    def _save_spec(self):
        """保存規格庫"""
        with open(self.spec_db_path, 'w', encoding='utf-8') as f:
            json.dump(self.specs, f, indent=2, ensure_ascii=False)

    def _get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """獲取節點對象"""
        for node in self.specs.get("nodes", []):
            if node["id"] == node_id:
                return node
        return None

    def get_node_status(self, node_id: str) -> NodeState:
        """獲取節點當前狀態"""
        node = self._get_node(node_id)
        if not node:
            return None
        return NodeState(node.get("status", "LOCKED"))

    def check_upstream_dependencies(self, node_id: str) -> bool:
        """
        [Strict Gating] 檢查上游依賴
        只有所有依賴節點均為 IMPLEMENTED，才返回 True
        """
        node = self._get_node(node_id)
        if not node:
            return False
            
        dependencies = node.get("dependencies", [])
        if not dependencies:
            return True # 無依賴視為通過
            
        for dep_id in dependencies:
            dep_status = self.get_node_status(dep_id)
            if dep_status != NodeState.IMPLEMENTED:
                logger.info(f"Node {node_id} blocked by dependency {dep_id} ({dep_status})")
                return False
        
        return True

    def transition(self, node_id: str, target_state: NodeState) -> bool:
        """
        狀態流轉嘗試
        """
        current_state = self.get_node_status(node_id)
        logger.info(f"Attempting transition for {node_id}: {current_state} -> {target_state}")
        
        # 1. LOCKED -> IDLE (解鎖)
        if current_state == NodeState.LOCKED and target_state == NodeState.IDLE:
            if self.check_upstream_dependencies(node_id):
                self._update_node_status(node_id, NodeState.IDLE)
                return True
            else:
                logger.warning(f"Unlock failed for {node_id}: Dependencies not met.")
                return False

        # 2. IDLE -> PLANNING (啟動規劃)
        if current_state == NodeState.IDLE and target_state == NodeState.PLANNING:
            self._update_node_status(node_id, NodeState.PLANNING)
            return True

        # 3. PLANNING -> CODING (開始編碼)
        if current_state == NodeState.PLANNING and target_state == NodeState.CODING:
            # 這裡可以加入檢查 Implementation Plan 是否存在的邏輯
            self._update_node_status(node_id, NodeState.CODING)
            return True
            
        # 4. CODING -> VALIDATING (提交驗證)
        if current_state == NodeState.CODING and target_state == NodeState.VALIDATING:
            self._update_node_status(node_id, NodeState.VALIDATING)
            return True

        # 5. VALIDATING -> IMPLEMENTED (驗證通過 - Verify or Die)
        if current_state == NodeState.VALIDATING and target_state == NodeState.IMPLEMENTED:
            # 注意：此函數只負責狀態變更，實際驗證邏輯由外部 Caller (mmla_agentic_loop) 執行後決定是否調用此轉換
            self._update_node_status(node_id, NodeState.IMPLEMENTED)
            return True
            
        # 6. VALIDATING -> CODING (驗證失敗退回)
        if current_state == NodeState.VALIDATING and target_state == NodeState.CODING:
            self._update_node_status(node_id, NodeState.CODING)
            return True

        # 7. 任何狀態 -> LOCKED (重置/依賴變更)
        if target_state == NodeState.LOCKED:
             self._update_node_status(node_id, NodeState.LOCKED)
             return True

        logger.error(f"Invalid transition for {node_id}: {current_state} -> {target_state}")
        return False

    def _update_node_status(self, node_id: str, new_state: NodeState):
        """更新節點狀態並持久化"""
        for node in self.specs.get("nodes", []):
            if node["id"] == node_id:
                node["status"] = new_state.value
                node["last_updated"] = datetime.now().isoformat()
                self._save_spec()
                logger.info(f"Node {node_id} status updated to {new_state.value}")
                return

# 單例模式方便調用
_sentinel = None

def get_sentinel(spec_db_path="mmla_spec.json"):
    global _sentinel
    if _sentinel is None:
        _sentinel = TrafficLightSentinel(spec_db_path)
    return _sentinel
