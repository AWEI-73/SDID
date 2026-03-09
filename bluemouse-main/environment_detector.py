"""
Environment Detector - 藍圖小老鼠環境檢測模組

檢測 MCP Server 運行的宿主環境（Antigravity, Cursor, VSCode 等）
並驗證必要的配置和依賴。
"""

import os
import json
import sys
from typing import Dict, Any, Optional
from pathlib import Path


class EnvironmentDetector:
    """環境檢測器"""
    
    def __init__(self):
        self.config_paths = [
            Path.home() / ".bluemouse" / "config.json",
            Path.cwd() / "config.json",
            Path.cwd() / "mcp.json"
        ]
    
    def detect_host(self) -> str:
        """
        檢測宿主環境
        
        Returns:
            宿主名稱: 'antigravity', 'cursor', 'vscode', 'standalone'
        """
        # 檢測環境變數
        if os.getenv('ANTIGRAVITY_MODE'):
            return 'antigravity'
        elif os.getenv('CURSOR_MODE'):
            return 'cursor'
        elif os.getenv('VSCODE_PID'):
            return 'vscode'
        
        # 檢測進程名稱
        try:
            import psutil
            parent = psutil.Process().parent()
            if parent:
                parent_name = parent.name().lower()
                if 'antigravity' in parent_name:
                    return 'antigravity'
                elif 'cursor' in parent_name:
                    return 'cursor'
                elif 'code' in parent_name:
                    return 'vscode'
        except ImportError:
            pass
        
        return 'standalone'
    
    def check_api_key(self) -> Optional[str]:
        """
        檢查 API Key 配置
        
        Returns:
            API Key 或 None
        """
        # 1. 環境變數
        api_key = os.getenv('ANTHROPIC_API_KEY')
        if api_key:
            return api_key
        
        # 2. 配置文件
        for path in self.config_paths:
            if path.exists():
                try:
                    with open(path, 'r') as f:
                        config = json.load(f)
                        if 'api_key' in config:
                            return config['api_key']
                        if 'anthropic_api_key' in config:
                            return config['anthropic_api_key']
                except Exception:
                    continue
        
        return None
    
    def check_dependencies(self) -> Dict[str, bool]:
        """
        檢查必要依賴
        
        Returns:
            依賴檢查結果
        """
        dependencies = {}
        
        # Python 版本
        dependencies['python_version'] = sys.version_info >= (3, 9)
        
        # 必要套件
        required_packages = [
            'fastmcp',
            'pydantic',
            'anthropic'
        ]
        
        for package in required_packages:
            try:
                __import__(package)
                dependencies[package] = True
            except ImportError:
                dependencies[package] = False
        
        return dependencies
    
    def check_environment(self) -> Dict[str, Any]:
        """
        完整環境檢查
        
        Returns:
            環境狀態報告
        """
        host = self.detect_host()
        api_key = self.check_api_key()
        dependencies = self.check_dependencies()
        
        # 判斷是否就緒
        ready = (
            api_key is not None and
            all(dependencies.values())
        )
        
        return {
            "host": host,
            "api_key_present": api_key is not None,
            "api_key_masked": self._mask_key(api_key) if api_key else None,
            "dependencies": dependencies,
            "ready": ready,
            "mcp_version": "1.0",
            "bluemouse_version": "5.3",
            "working_directory": str(Path.cwd()),
            "config_paths": [str(p) for p in self.config_paths if p.exists()]
        }
    
    def _mask_key(self, key: str) -> str:
        """遮罩 API Key（只顯示前後4個字符）"""
        if len(key) <= 8:
            return "*" * len(key)
        return f"{key[:4]}...{key[-4:]}"
    
    def get_setup_instructions(self, env_status: Dict[str, Any]) -> str:
        """
        根據環境狀態生成設置說明
        
        Args:
            env_status: 環境檢查結果
        
        Returns:
            設置指南文本
        """
        if env_status["ready"]:
            return "✅ 環境就緒！可以開始使用藍圖小老鼠。"
        
        instructions = ["⚠️ 環境配置不完整，請完成以下設置：\n"]
        
        # API Key 缺失
        if not env_status["api_key_present"]:
            instructions.append(
                "1. 設置 API Key:\n"
                "   方法 A: 設置環境變數\n"
                "     export ANTHROPIC_API_KEY=your_key_here\n"
                "   方法 B: 創建配置文件\n"
                "     echo '{\"api_key\": \"your_key_here\"}' > ~/.bluemouse/config.json\n"
            )
        
        # 依賴缺失
        missing_deps = [
            pkg for pkg, installed in env_status["dependencies"].items()
            if not installed and pkg != 'python_version'
        ]
        
        if missing_deps:
            instructions.append(
                f"2. 安裝缺失的依賴:\n"
                f"   pip install {' '.join(missing_deps)}\n"
            )
        
        # Python 版本過舊
        if not env_status["dependencies"].get("python_version", True):
            instructions.append(
                "3. Python 版本需要 3.9+\n"
                f"   當前版本: {sys.version}\n"
            )
        
        return "\n".join(instructions)


# 單例模式
_detector = None

def get_detector() -> EnvironmentDetector:
    """獲取環境檢測器單例"""
    global _detector
    if _detector is None:
        _detector = EnvironmentDetector()
    return _detector


if __name__ == "__main__":
    # 測試環境檢測
    detector = get_detector()
    env_status = detector.check_environment()
    
    print("🔍 藍圖小老鼠環境檢測報告")
    print("=" * 50)
    print(f"宿主環境: {env_status['host']}")
    print(f"API Key: {'✅ 已配置' if env_status['api_key_present'] else '❌ 未配置'}")
    if env_status['api_key_masked']:
        print(f"  ({env_status['api_key_masked']})")
    print(f"工作目錄: {env_status['working_directory']}")
    print(f"\n依賴檢查:")
    for dep, status in env_status['dependencies'].items():
        print(f"  {dep}: {'✅' if status else '❌'}")
    print(f"\n整體狀態: {'✅ 就緒' if env_status['ready'] else '⚠️ 需要配置'}")
    print("=" * 50)
    
    # 顯示設置指南
    print(f"\n{detector.get_setup_instructions(env_status)}")
