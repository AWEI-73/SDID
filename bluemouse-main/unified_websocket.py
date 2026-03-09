"""
Unified WebSocket Service - 統一的 WebSocket 服務
合併 mcp_bridge.py 和 websocket_server.py 的功能
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from typing import List, Dict, Any, Optional, Callable
from datetime import datetime


# ========================================
# FastAPI 應用初始化
# ========================================

app = FastAPI(title="BlueMouse WebSocket Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========================================
# WebSocket 連接管理器（合併版）
# ========================================

class UnifiedConnectionManager:
    """統一的 WebSocket 連接管理器"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.event_handlers: Dict[str, List[Callable]] = {}
        self.state_history: List[Dict] = []
        
    async def connect(self, websocket: WebSocket):
        """接受新連接"""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"✅ 新客戶端連接，當前連接數: {len(self.active_connections)}")
        
        # 發送歡迎消息
        await self.send_to_client(websocket, "connected", {
            "message": "🐭 歡迎使用藍圖小老鼠",
            "timestamp": datetime.now().isoformat(),
            "version": "5.3"
        })
    
    def disconnect(self, websocket: WebSocket):
        """斷開連接"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"❌ 客戶端斷開，當前連接數: {len(self.active_connections)}")
    
    async def send_to_client(self, websocket: WebSocket, event: str, data: Dict[str, Any]):
        """發送消息到特定客戶端"""
        message = {
            "event": event,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"❌ 發送到客戶端失敗: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, event: str, data: Dict[str, Any]):
        """廣播消息給所有連接"""
        message = {
            "event": event,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        disconnected = []
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception as e:
                print(f"❌ 廣播失敗: {e}")
                disconnected.append(ws)
        
        # 清理斷開的連接
        for ws in disconnected:
            self.disconnect(ws)
    
    # ========================================
    # 高級功能：事件系統
    # ========================================
    
    def register_event_handler(self, event: str, handler: Callable):
        """註冊事件處理器"""
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)
    
    async def emit_event(self, event: str, data: Dict[str, Any]):
        """發送事件（觸發處理器 + 廣播）"""
        # 1. 觸發註冊的處理器
        if event in self.event_handlers:
            for handler in self.event_handlers[event]:
                try:
                    await handler(data)
                except Exception as e:
                    print(f"❌ 事件處理器執行失敗: {e}")
        
        # 2. 廣播給所有客戶端
        await self.broadcast(event, data)
    
    # ========================================
    # 狀態管理
    # ========================================
    
    async def on_state_change(self, new_state: str, context: Optional[Dict] = None):
        """狀態變更事件"""
        state_data = {
            "state": new_state,
            "context": context or {},
            "timestamp": datetime.now().isoformat()
        }
        
        # 記錄歷史
        self.state_history.append(state_data)
        
        # 廣播
        await self.emit_event("state_change", state_data)
    
    async def on_progress_update(self, progress: Dict[str, Any]):
        """進度更新"""
        await self.emit_event("progress_update", progress)
    
    async def on_question_required(self, questions: List[Dict]):
        """需要用戶回答問題"""
        await self.emit_event("socratic_interview", {
            "questions": questions,
            "required": True
        })
    
    async def on_validation_complete(self, result: Dict[str, Any]):
        """驗證完成"""
        await self.emit_event("validation_complete", result)
    
    async def on_code_generated(self, files: Dict[str, str]):
        """代碼生成完成"""
        await self.emit_event("code_generated", {
            "files": files,
            "count": len(files)
        })
    
    def get_state_history(self, limit: int = 10) -> List[Dict]:
        """獲取狀態歷史"""
        return self.state_history[-limit:]
    
    def get_current_state(self) -> Optional[Dict]:
        """獲取當前狀態"""
        return self.state_history[-1] if self.state_history else None


# 全局管理器實例
manager = UnifiedConnectionManager()


# ========================================
# WebSocket 端點
# ========================================

@app.websocket("/ws/journey")
async def websocket_journey(websocket: WebSocket):
    """
    用戶旅程 WebSocket
    處理前端的狀態同步和事件
    """
    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            # 處理不同的動作
            if action == "start_trial":
                await manager.on_state_change("WORKSPACE_ACTIVE")
            
            elif action == "submit_requirement":
                await manager.on_state_change("ANALYZING", {
                    "requirement": data.get("requirement")
                })
            
            elif action == "submit_answers":
                await manager.on_state_change("GENERATING", {
                    "answers": data.get("answers")
                })
            
            elif action == "ping":
                await manager.send_to_client(websocket, "pong", {
                    "timestamp": datetime.now().isoformat()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ WebSocket 錯誤: {e}")
        manager.disconnect(websocket)


@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    """
    進度推送 WebSocket
    用於 Agentic Loop 的實時進度
    """
    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("action") == "start_validation":
                code = data.get("code", "")
                node_id = data.get("node_id", "test_node")
                spec = data.get("spec", {})
                
                try:
                    from mmla_agentic_loop import mmla_validate_with_retry
                    
                    # 定義進度回調
                    async def progress_callback(progress_data):
                        await manager.send_to_client(websocket, "progress_update", progress_data)
                    
                    # 執行驗證
                    result = await mmla_validate_with_retry(
                        code=code,
                        node_id=node_id,
                        spec=spec,
                        max_retries=16,
                        progress_callback=progress_callback
                    )
                    
                    # 發送完成消息
                    await manager.send_to_client(websocket, "validation_complete", result)
                
                except Exception as e:
                    await manager.send_to_client(websocket, "error", {
                        "message": str(e)
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"❌ 進度推送錯誤: {e}")
        manager.disconnect(websocket)


# ========================================
# HTTP 端點
# ========================================

@app.get("/health")
async def health_check():
    """健康檢查"""
    return {
        "status": "healthy",
        "connections": len(manager.active_connections),
        "service": "unified_websocket_service",
        "version": "1.0.0"
    }


@app.get("/stats")
async def get_stats():
    """獲取統計信息"""
    return {
        "active_connections": len(manager.active_connections),
        "state_history_count": len(manager.state_history),
        "current_state": manager.get_current_state(),
        "event_handlers": {
            event: len(handlers) 
            for event, handlers in manager.event_handlers.items()
        }
    }


# ========================================
# 便捷函數（供外部調用）
# ========================================

async def push_progress(
    attempt: int,
    total: int,
    status: str,
    layer: str = "",
    message: str = ""
):
    """推送進度更新"""
    await manager.on_progress_update({
        "attempt": attempt,
        "total": total,
        "status": status,
        "layer": layer,
        "message": message,
        "percentage": int((attempt / total) * 100)
    })


async def push_state(state: str, context: Optional[Dict] = None):
    """推送狀態變更"""
    await manager.on_state_change(state, context)


async def push_questions(questions: List[Dict]):
    """推送問題"""
    await manager.on_question_required(questions)


def get_manager() -> UnifiedConnectionManager:
    """獲取管理器實例"""
    return manager


# ========================================
# 啟動配置
# ========================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,  # 統一使用 8001 端口
        log_level="info"
    )
