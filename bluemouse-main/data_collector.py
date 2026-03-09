"""
數據收集器 - 自動收集各領域的函數數據
支持三種收集方式:
1. GitHub 爬蟲 (真實項目)
2. 開源庫分析
3. AI 生成 + 驗證
"""

import asyncio
import json
import os
from typing import List, Dict, Any
from datetime import datetime


class DomainDataCollector:
    """領域數據收集器"""
    
    # 15 個領域配置
    DOMAINS = {
        "web_development": {
            "target": 3500,
            "libraries": ["django", "flask", "fastapi", "express"],
            "github_topics": ["web-framework", "rest-api", "graphql"]
        },
        "data_science": {
            "target": 3500,
            "libraries": ["pandas", "numpy", "scipy", "statsmodels"],
            "github_topics": ["data-analysis", "statistics", "visualization"]
        },
        "machine_learning": {
            "target": 3500,
            "libraries": ["scikit-learn", "tensorflow", "pytorch", "keras"],
            "github_topics": ["deep-learning", "neural-network", "mlops"]
        },
        "devops": {
            "target": 3000,
            "libraries": ["ansible", "terraform", "kubernetes"],
            "github_topics": ["ci-cd", "infrastructure", "automation"]
        },
        "cloud_computing": {
            "target": 3000,
            "libraries": ["boto3", "azure-sdk", "google-cloud"],
            "github_topics": ["aws", "azure", "gcp"]
        },
        "blockchain": {
            "target": 2500,
            "libraries": ["web3", "ethers", "solidity"],
            "github_topics": ["smart-contracts", "defi", "nft"]
        },
        "game_development": {
            "target": 2500,
            "libraries": ["pygame", "unity", "godot"],
            "github_topics": ["game-engine", "physics", "multiplayer"]
        },
        "mobile_development": {
            "target": 2500,
            "libraries": ["react-native", "flutter", "kivy"],
            "github_topics": ["ios", "android", "cross-platform"]
        },
        "cybersecurity": {
            "target": 2500,
            "libraries": ["cryptography", "pycryptodome", "scapy"],
            "github_topics": ["penetration-testing", "encryption", "security"]
        },
        "quantitative_trading": {
            "target": 2000,
            "libraries": ["zipline", "backtrader", "ta-lib"],
            "github_topics": ["algorithmic-trading", "backtesting", "finance"]
        },
        "medical_tech": {
            "target": 2000,
            "libraries": ["pydicom", "nibabel", "medpy"],
            "github_topics": ["healthcare", "medical-imaging", "ehr"]
        },
        # 新增 4 個領域
        "iot": {
            "target": 4500,
            "libraries": ["paho-mqtt", "coap", "micropython"],
            "github_topics": ["iot", "embedded", "sensors"]
        },
        "edge_computing": {
            "target": 4500,
            "libraries": ["edge-tpu", "openvino", "tensorrt"],
            "github_topics": ["edge-ai", "fog-computing", "5g"]
        },
        "nlp": {
            "target": 4500,
            "libraries": ["transformers", "spacy", "nltk", "gensim"],
            "github_topics": ["natural-language-processing", "text-mining", "chatbot"]
        },
        "computer_vision": {
            "target": 4500,
            "libraries": ["opencv", "pillow", "torchvision", "detectron2"],
            "github_topics": ["image-processing", "object-detection", "face-recognition"]
        }
    }
    
    def __init__(self, domain: str):
        self.domain = domain
        self.config = self.DOMAINS.get(domain, {})
        self.target = self.config.get("target", 3000)
        self.collected = []
        
    async def collect_all(self) -> List[Dict[str, Any]]:
        """收集所有數據"""
        print(f"\n🎯 開始收集 {self.domain} 領域數據")
        print(f"目標: {self.target} 筆")
        
        # 方法 1: GitHub 爬蟲 (40%)
        github_target = int(self.target * 0.4)
        github_data = await self.collect_from_github(github_target)
        print(f"✅ GitHub 收集: {len(github_data)} 筆")
        
        # 方法 2: 開源庫分析 (30%)
        library_target = int(self.target * 0.3)
        library_data = await self.collect_from_libraries(library_target)
        print(f"✅ 開源庫收集: {len(library_data)} 筆")
        
        # 方法 3: AI 生成 (30%)
        ai_target = self.target - len(github_data) - len(library_data)
        ai_data = await self.ai_generate(ai_target)
        print(f"✅ AI 生成: {len(ai_data)} 筆")
        
        self.collected = github_data + library_data + ai_data
        print(f"📊 總計收集: {len(self.collected)} 筆")
        
        return self.collected
    
    async def collect_from_github(self, target: int) -> List[Dict]:
        """從 GitHub 收集真實函數"""
        print(f"  🔍 從 GitHub 收集 {target} 筆...")
        
        # 模擬收集 (實際需要 GitHub API)
        collected = []
        topics = self.config.get("github_topics", [])
        
        for topic in topics[:3]:  # 限制 3 個主題
            # 這裡應該調用 GitHub API
            # 暫時返回模擬數據
            count = target // len(topics)
            for i in range(count):
                collected.append({
                    "function_name": f"{self.domain}_{topic}_{i}",
                    "domain": self.domain,
                    "source": f"github/{topic}",
                    "code": f"def {self.domain}_{topic}_{i}(): pass",
                    "metadata": {
                        "source_type": "github",
                        "topic": topic,
                        "collected_at": datetime.now().isoformat()
                    }
                })
        
        return collected[:target]
    
    async def collect_from_libraries(self, target: int) -> List[Dict]:
        """從開源庫收集"""
        print(f"  📚 從開源庫收集 {target} 筆...")
        
        collected = []
        libraries = self.config.get("libraries", [])
        
        for lib in libraries[:3]:
            count = target // len(libraries)
            for i in range(count):
                collected.append({
                    "function_name": f"{lib}_function_{i}",
                    "domain": self.domain,
                    "source": f"library/{lib}",
                    "code": f"def {lib}_function_{i}(): pass",
                    "metadata": {
                        "source_type": "library",
                        "library": lib,
                        "collected_at": datetime.now().isoformat()
                    }
                })
        
        return collected[:target]
    
    async def ai_generate(self, target: int) -> List[Dict]:
        """AI 生成函數"""
        print(f"  🤖 AI 生成 {target} 筆...")
        
        from ultimate_parasite_ai import ai_generate
        
        collected = []
        batch_size = 10
        
        for batch in range(target // batch_size):
            prompt = f"""生成 {batch_size} 個 {self.domain} 領域的 Python 函數。
要求:
1. 函數必須是真實可用的
2. 包含完整的類型提示
3. 包含文檔字符串
4. 符合 PEP 8 規範

返回 JSON 格式:
[{{"name": "function_name", "code": "def function_name(): ..."}}]
"""
            
            try:
                response = await ai_generate(prompt, temperature=0.7)
                # 解析 AI 響應
                # 這裡需要實際的解析邏輯
                for i in range(batch_size):
                    collected.append({
                        "function_name": f"ai_{self.domain}_{batch}_{i}",
                        "domain": self.domain,
                        "source": "ai_generated",
                        "code": f"def ai_{self.domain}_{batch}_{i}(): pass",
                        "metadata": {
                            "source_type": "ai",
                            "batch": batch,
                            "collected_at": datetime.now().isoformat()
                        }
                    })
            except Exception as e:
                print(f"    ⚠️ AI 生成失敗: {e}")
                break
        
        return collected[:target]
    
    async def validate_and_save(self, output_file: str = "data_trap.jsonl"):
        """驗證並保存數據"""
        print(f"\n🔍 開始驗證 {len(self.collected)} 筆數據...")
        
        from validation_17_layers import validate_code_17_layers
        
        validated = []
        passed = 0
        
        for i, item in enumerate(self.collected):
            if i % 100 == 0:
                print(f"  進度: {i}/{len(self.collected)}")
            
            try:
                # 17 層驗證
                result = validate_code_17_layers(
                    item["code"],
                    item["function_name"],
                    None
                )
                
                if result["quality_score"] >= 85:
                    item["validation_result"] = result
                    validated.append(item)
                    passed += 1
            except Exception as e:
                print(f"    ⚠️ 驗證失敗: {e}")
        
        print(f"✅ 驗證通過: {passed}/{len(self.collected)} ({passed/len(self.collected)*100:.1f}%)")
        
        # 保存到文件
        with open(output_file, "a", encoding="utf-8") as f:
            for item in validated:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        
        print(f"💾 已保存到 {output_file}")
        
        return validated


async def collect_all_domains():
    """收集所有領域的數據"""
    print("="*70)
    print("🚀 開始收集 15 個領域的數據")
    print("目標: 50,000 筆")
    print("="*70)
    
    total_collected = 0
    
    for domain, config in DomainDataCollector.DOMAINS.items():
        collector = DomainDataCollector(domain)
        
        # 收集數據
        await collector.collect_all()
        
        # 驗證並保存
        validated = await collector.validate_and_save()
        
        total_collected += len(validated)
        print(f"📊 當前總計: {total_collected} 筆\n")
    
    print("="*70)
    print(f"🎉 收集完成! 總計: {total_collected} 筆")
    print("="*70)


if __name__ == "__main__":
    # 測試單個領域
    async def test_single_domain():
        collector = DomainDataCollector("nlp")
        await collector.collect_all()
        await collector.validate_and_save("test_data.jsonl")
    
    asyncio.run(test_single_domain())
