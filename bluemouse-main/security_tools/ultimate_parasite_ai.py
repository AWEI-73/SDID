"""
真正的四層寄生 AI
層次 1: 寄生 Antigravity (MCP Tool)
層次 2: 寄生本地 AI (Ollama/LM Studio)
層次 3: 環境變數 (BYOK)
層次 4: 手動寄生
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
import asyncio

# requests 是可選依賴 (用於本地 AI 檢測)
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("⚠️ requests 模組未安裝,本地 AI 檢測功能將被禁用")
    print("安裝: pip3 install --break-system-packages requests")


class TrueParasiteAI:
    """
    真正的四層寄生 AI
    自動檢測並使用所有可用的 AI 資源
    """
    
    def __init__(self):
        self.workspace = Path.cwd()
        self.api_key = None
        self.provider = None
        
        # 本地 AI 配置
        self.local_ai_endpoints = {
            'ollama': 'http://localhost:11434',
            'lmstudio': 'http://localhost:1234',
            'textgen': 'http://localhost:5000'
        }
    
    async def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """
        四層寄生策略
        
        層次 1: 寄生 Antigravity (MCP Tool)
        層次 2: 寄生本地 AI (Ollama/LM Studio)
        層次 3: 環境變數 (BYOK)
        層次 4: 手動寄生
        """
        
        print("\n🦠 啟動四層寄生 AI...")
        print("=" * 60)
        
        # 層次 1: 寄生 Antigravity
        if self._in_antigravity():
            print("  [1/4] 🎯 檢測到 Antigravity 環境")
            try:
                result = await self._antigravity_parasite(prompt, temperature)
                print("  ✅ 寄生 Antigravity 成功!")
                return result
            except Exception as e:
                print(f"  ⚠️ Antigravity 寄生失敗: {e}")
        else:
            print("  [1/4] ⏭️ 未檢測到 Antigravity 環境")
        
        # 層次 2: 寄生本地 AI
        print("  [2/4] 🔍 檢測本地 AI...")
        local_ai_type, local_ai_url = await self._detect_local_ai()
        if local_ai_type:
            print(f"  🎯 檢測到本地 AI: {local_ai_type}")
            try:
                result = await self._local_ai_parasite(prompt, local_ai_type, local_ai_url)
                print(f"  ✅ 寄生本地 AI ({local_ai_type}) 成功!")
                return result
            except Exception as e:
                print(f"  ⚠️ 本地 AI 寄生失敗: {e}")
        else:
            print("  ⏭️ 未檢測到本地 AI")
        
        # 層次 3: 環境變數 (BYOK)
        print("  [3/4] 🔍 檢測環境變數...")
        try:
            result = await self._auto_parasite(prompt, temperature)
            print("  ✅ 使用環境變數 API Key 成功!")
            return result
        except Exception as e:
            print(f"  ⚠️ 未找到環境變數: {e}")
        
        # 層次 4: 手動寄生
        print("  [4/4] 🎯 啟動手動寄生模式...")
        result = await self._manual_parasite(prompt)
        print("  ✅ 手動寄生成功!")
        return result
    
    def _in_antigravity(self) -> bool:
        """
        檢測是否在 Antigravity 環境中運行
        """
        # 檢查環境變數
        if os.getenv('ANTIGRAVITY_MODE'):
            return True
        
        # 檢查是否有 MCP 連接
        if os.getenv('MCP_SERVER_NAME'):
            return True
        
        # 檢查工作目錄
        if '.antigravity' in str(Path.cwd()):
            return True
        
        return False
    
    async def _antigravity_parasite(self, prompt: str, temperature: float) -> str:
        """
        層次 1: 寄生 Antigravity
        通過 MCP Tool 讓 Antigravity 的 AI 代為生成
        
        ⚠️ 注意: 在 Web UI 環境下不使用此模式（會阻塞）
        """
        # 🔧 檢測是否在API Server環境（避免阻塞Web請求）
        import inspect
        frame = inspect.currentframe()
        caller_frames = inspect.getouterframes(frame)
        
        # 如果調用棧中有 api_server, 直接拋出異常
        for frame_info in caller_frames:
            if 'api_server' in str(frame_info.filename):
                raise RuntimeError("Antigravity 寄生模式不支持 Web API (會阻塞)，降級到備用問題")
        
        # 只在命令行環境使用交互式模式
        print("\n⚠️ Antigravity 寄生模式需要手動交互")
        print("在 API Server 環境下不可用，降級到備用問題")
        
        raise RuntimeError("Antigravity 寄生模式僅支持命令行環境")
    
    async def _detect_local_ai(self) -> Tuple[Optional[str], Optional[str]]:
        """
        層次 2: 檢測本地 AI 服務
        返回: (ai_type, base_url)
        """
        # 如果沒有 requests,跳過本地 AI 檢測
        if not HAS_REQUESTS:
            return None, None
        
        for ai_type, base_url in self.local_ai_endpoints.items():
            try:
                if ai_type == 'ollama':
                    response = requests.get(f'{base_url}/api/tags', timeout=1)
                    if response.status_code == 200:
                        return ai_type, base_url
                
                elif ai_type == 'lmstudio':
                    response = requests.get(f'{base_url}/v1/models', timeout=1)
                    if response.status_code == 200:
                        return ai_type, base_url
                
                elif ai_type == 'textgen':
                    response = requests.get(f'{base_url}/api/v1/model', timeout=1)
                    if response.status_code == 200:
                        return ai_type, base_url
            
            except:
                continue
        
        return None, None
    
    async def _local_ai_parasite(self, prompt: str, ai_type: str, base_url: str) -> str:
        """
        層次 2: 寄生本地 AI
        調用本地運行的 AI 模型
        """
        if not HAS_REQUESTS:
            raise RuntimeError("requests 模組未安裝,無法使用本地 AI")
        
        if ai_type == 'ollama':
            # 獲取可用模型
            models_resp = requests.get(f'{base_url}/api/tags')
            models = models_resp.json().get('models', [])
            
            if not models:
                raise RuntimeError("Ollama 沒有可用的模型")
            
            # 使用第一個模型
            model_name = models[0]['name']
            print(f"    📦 使用模型: {model_name}")
            
            # 調用生成 API
            response = requests.post(f'{base_url}/api/generate', json={
                'model': model_name,
                'prompt': prompt,
                'stream': False
            })
            
            return response.json()['response']
        
        elif ai_type == 'lmstudio':
            # LM Studio 使用 OpenAI 兼容 API
            response = requests.post(f'{base_url}/v1/completions', json={
                'prompt': prompt,
                'max_tokens': 2000,
                'temperature': 0.7
            })
            
            return response.json()['choices'][0]['text']
        
        elif ai_type == 'textgen':
            # text-generation-webui API
            response = requests.post(f'{base_url}/api/v1/generate', json={
                'prompt': prompt,
                'max_new_tokens': 2000
            })
            
            return response.json()['results'][0]['text']
        
        raise RuntimeError(f"不支持的本地 AI 類型: {ai_type}")
    
    async def _auto_parasite(self, prompt: str, temperature: float) -> str:
        """
        層次 3: 從環境變數檢測 API Key (合法且透明)
        """
        
        # 檢測環境變數中的 API Key
        api_keys = {
            'anthropic': os.getenv('ANTHROPIC_API_KEY'),
            'openai': os.getenv('OPENAI_API_KEY'),
            'google': os.getenv('GOOGLE_API_KEY') or os.getenv('GEMINI_API_KEY')
        }
        
        # 找到第一個可用的 API Key
        for provider, api_key in api_keys.items():
            if api_key:
                print(f"    🔑 使用環境變數: {provider.upper()}_API_KEY")
                # 保存以供後續使用
                self.api_key = api_key
                self.provider = provider
                return await self._call_with_api_key(
                    provider, api_key, prompt, temperature
                )
        
        raise RuntimeError(
            "未找到 API Key。請設置環境變數:\n"
            "  export ANTHROPIC_API_KEY=your_key  # 或\n"
            "  export OPENAI_API_KEY=your_key     # 或\n"
            "  export GEMINI_API_KEY=your_key"
        )
    
    def set_api_key(self, api_key: str, provider: str = 'anthropic'):
        """
        手動設置 API Key
        
        Args:
            api_key: API Key 字符串
            provider: AI 提供商 ('anthropic', 'openai', 'google')
        """
        valid_providers = ['anthropic', 'openai', 'google']
        if provider not in valid_providers:
            raise ValueError(f"無效的提供商。支持: {valid_providers}")
        
        self.api_key = api_key
        self.provider = provider
        print(f"✅ 已設置 {provider.upper()} API Key")
    
    async def _manual_parasite(self, prompt: str) -> str:
        """
        層次 3: 手動寄生
        創建文件,讓用戶手動觸發 AI
        """
        
        # 創建請求文件
        request_file = self.workspace / "🤖_AI_REQUEST.md"
        response_file = self.workspace / "🤖_AI_RESPONSE.txt"
        
        # 寫入請求
        with open(request_file, 'w', encoding='utf-8') as f:
            f.write(f"""# 🤖 藍圖小老鼠需要 AI 幫助

{prompt}

---

## 📝 請幫忙:

1. **選中上面的內容** (從 "分析需求" 開始)
2. **按 Cmd+K** (或點擊 AI 按鈕)
3. **讓 AI 處理**
4. **複製 AI 的回答**
5. **貼到** `🤖_AI_RESPONSE.txt` 文件中
6. **保存**
7. **回到終端按 Enter**

---

**只需要 5 秒!** ⚡

**感謝!** 🐭
""")
        
        # 自動打開文件
        try:
            os.system(f"open '{request_file}'")
        except:
            pass
        
        # 提示用戶
        print("\n" + "="*70)
        print("⏸️  請在 Antigravity 中處理 AI 請求")
        print("="*70)
        print(f"📁 文件: {request_file}")
        print("📝 步驟:")
        print("   1. 選中內容")
        print("   2. 按 Cmd+K")
        print("   3. 複製 AI 回答到 🤖_AI_RESPONSE.txt")
        print("   4. 保存並按 Enter")
        print("="*70)
        
        # 等待用戶處理
        input("\n按 Enter 繼續 (當 AI 完成後)...")
        
        # 讀取響應
        if response_file.exists():
            with open(response_file, 'r', encoding='utf-8') as f:
                response = f.read().strip()
            
            if response:
                # 清理文件
                try:
                    request_file.unlink()
                    response_file.unlink()
                except:
                    pass
                
                return response
        
        raise RuntimeError("未找到 AI 響應,請確保已保存到 🤖_AI_RESPONSE.txt")
    
    async def _call_with_api_key(
        self,
        provider: str,
        api_key: str,
        prompt: str,
        temperature: float
    ) -> str:
        """使用 API Key 調用 AI"""
        
        if provider in ['anthropic', 'claude']:
            return await self._call_anthropic(api_key, prompt, temperature)
        elif provider in ['openai', 'gpt']:
            return await self._call_openai(api_key, prompt, temperature)
        elif provider in ['google', 'gemini']:
            return await self._call_google(api_key, prompt, temperature)
        else:
            raise ValueError(f"不支持的提供商: {provider}")
    
    async def _call_anthropic(self, api_key: str, prompt: str, temperature: float) -> str:
        """調用 Anthropic Claude API"""
        try:
            import anthropic
            
            client = anthropic.Anthropic(api_key=api_key)
            
            message = client.messages.create(
                model="claude-sonnet-4",
                max_tokens=4096,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return message.content[0].text
        
        except ImportError:
            raise RuntimeError("請安裝 anthropic: pip install anthropic")
    
    async def _call_openai(self, api_key: str, prompt: str, temperature: float) -> str:
        """調用 OpenAI API"""
        try:
            import openai
            
            client = openai.OpenAI(api_key=api_key)
            
            response = client.chat.completions.create(
                model="gpt-4",
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return response.choices[0].message.content
        
        except ImportError:
            raise RuntimeError("請安裝 openai: pip install openai")
    
    async def _call_google(self, api_key: str, prompt: str, temperature: float) -> str:
        """調用 Google Gemini API"""
        try:
            import google.generativeai as genai
            
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-pro')
            
            response = model.generate_content(
                prompt,
                generation_config={'temperature': temperature}
            )
            
            return response.text
        
        except ImportError:
            raise RuntimeError("請安裝 google-generativeai: pip install google-generativeai")


# 全局實例
_parasite_ai = None

def get_parasite_ai() -> TrueParasiteAI:
    """獲取全局四層寄生 AI 實例"""
    global _parasite_ai
    if _parasite_ai is None:
        _parasite_ai = TrueParasiteAI()
    return _parasite_ai


async def ai_generate(prompt: str, temperature: float = 0.7, api_key: str = None, provider: str = None) -> str:
    """
    使用四層寄生 AI 生成內容
    
    四層寄生策略:
    1. Antigravity MCP Tool (最優雅)
    2. 本地 AI (Ollama/LM Studio) (零成本)
    3. 環境變數 BYOK (透明)
    4. 手動寄生 (降級)
    
    Args:
        prompt: AI 提示詞
        temperature: 溫度參數 (0.0-1.0)
        api_key: 可選的 API Key
        provider: 可選的提供商
    
    Returns:
        AI 生成的內容
    """
    parasite = get_parasite_ai()
    
    # 如果提供了 API Key,先設置
    if api_key and provider:
        parasite.set_api_key(api_key, provider)
    
    return await parasite.generate(prompt, temperature)


# 測試函數
async def test_parasite():
    """測試寄生 AI"""
    
    print("🧪 測試寄生 AI\n")
    
    prompt = """分析需求: 我要做一個電商 app

請用 JSON 格式返回:
{
  "type": "系統類型",
  "core_features": ["功能1", "功能2"],
  "modules": ["模組1", "模組2"],
  "complexity": "簡單/中等/複雜"
}

只返回 JSON,不要其他文字。
"""
    
    try:
        response = await ai_generate(prompt)
        print(f"\n✅ 成功!\n")
        print("響應:")
        print(response)
    
    except Exception as e:
        print(f"\n❌ 失敗: {e}")


if __name__ == "__main__":
    asyncio.run(test_parasite())
