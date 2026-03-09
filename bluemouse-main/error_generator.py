#!/usr/bin/env python3
"""
失敗案例生成器 - Error Generator
自動為正確的函數生成常見錯誤變體,測試 Critic Agent 的檢測能力
"""

import ast
import json
from pathlib import Path
from server import mmla_validate_code_logic

class ErrorGenerator:
    def __init__(self):
        self.error_templates = {
            "missing_type_hints": self.remove_type_hints,
            "wrong_param_names": self.change_param_names,
            "wrong_return_type": self.change_return_type,
            "undeclared_dependency": self.add_undeclared_import,
            "wrong_function_name": self.change_function_name
        }
    
    def remove_type_hints(self, code: str) -> str:
        """移除類型提示"""
        try:
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # 移除參數類型提示
                    for arg in node.args.args:
                        arg.annotation = None
                    # 移除返回類型提示
                    node.returns = None
            
            return ast.unparse(tree)
        except:
            return code
    
    def change_param_names(self, code: str) -> str:
        """修改參數名稱"""
        replacements = {
            "email": "username",
            "password": "pwd",
            "user_id": "uid",
            "token": "auth_token",
            "address": "addr"
        }
        
        modified = code
        for old, new in replacements.items():
            if old in code:
                modified = modified.replace(f"{old}:", f"{new}:")
                modified = modified.replace(f"{old},", f"{new},")
                modified = modified.replace(f"{old})", f"{new})")
                break
        
        return modified
    
    def change_return_type(self, code: str) -> str:
        """修改返回類型"""
        try:
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    if node.returns:
                        # dict -> str, str -> dict
                        if isinstance(node.returns, ast.Name):
                            if node.returns.id == "dict":
                                node.returns.id = "str"
                            elif node.returns.id == "str":
                                node.returns.id = "dict"
            
            return ast.unparse(tree)
        except:
            return code
    
    def add_undeclared_import(self, code: str) -> str:
        """添加未聲明的依賴"""
        undeclared_imports = [
            "import requests",
            "import pandas",
            "import numpy",
            "from flask import Flask"
        ]
        
        # 隨機選一個未聲明的 import
        import random
        new_import = random.choice(undeclared_imports)
        
        return f"{new_import}\n{code}"
    
    def change_function_name(self, code: str) -> str:
        """修改函數名稱"""
        try:
            tree = ast.parse(code)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # 改成錯誤的名稱
                    node.name = f"wrong_{node.name}"
                    break
            
            return ast.unparse(tree)
        except:
            return code
    
    def generate_error_variants(self, correct_code: str, function_name: str, node_id: str):
        """為正確的代碼生成所有錯誤變體"""
        print(f"\n🔧 為 {function_name} 生成錯誤案例...")
        
        results = {
            "function": function_name,
            "node_id": node_id,
            "variants": []
        }
        
        for error_type, generator_func in self.error_templates.items():
            print(f"\n  測試: {error_type}")
            
            # 生成錯誤代碼
            error_code = generator_func(correct_code)
            
            # 驗證 Critic Agent 是否能抓到
            validation_result = mmla_validate_code_logic(error_code, node_id)
            result = json.loads(validation_result)
            
            detected = not result.get("success", False)
            
            variant_info = {
                "error_type": error_type,
                "detected": detected,
                "errors": result.get("errors", [])
            }
            
            results["variants"].append(variant_info)
            
            if detected:
                print(f"    ✅ Critic Agent 正確檢測到錯誤")
                print(f"       錯誤訊息: {result.get('errors', [])}")
            else:
                print(f"    ❌ Critic Agent 未檢測到錯誤 (漏報!)")
        
        return results
    
    def test_function_file(self, file_path: Path, node_id: str):
        """測試單個函數檔案"""
        print(f"\n{'='*60}")
        print(f"📝 測試檔案: {file_path.name}")
        print(f"{'='*60}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            correct_code = f.read()
        
        # 提取函數名
        try:
            tree = ast.parse(correct_code)
            function_name = None
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    function_name = node.name
                    break
        except:
            print("  ⚠️  無法解析檔案")
            return None
        
        if not function_name:
            print("  ⚠️  找不到函數定義")
            return None
        
        # 生成錯誤變體
        results = self.generate_error_variants(correct_code, function_name, node_id)
        
        # 統計
        total = len(results["variants"])
        detected = sum(1 for v in results["variants"] if v["detected"])
        
        print(f"\n📊 檢測率: {detected}/{total} ({detected/total*100:.1f}%)")
        
        return results
    
    def generate_report(self, all_results: list):
        """生成總體報告"""
        print(f"\n{'='*60}")
        print("📊 錯誤檢測能力報告")
        print(f"{'='*60}\n")
        
        total_variants = 0
        total_detected = 0
        error_type_stats = {}
        
        for result in all_results:
            if not result:
                continue
            
            for variant in result["variants"]:
                total_variants += 1
                if variant["detected"]:
                    total_detected += 1
                
                error_type = variant["error_type"]
                if error_type not in error_type_stats:
                    error_type_stats[error_type] = {"total": 0, "detected": 0}
                
                error_type_stats[error_type]["total"] += 1
                if variant["detected"]:
                    error_type_stats[error_type]["detected"] += 1
        
        print(f"總測試案例: {total_variants}")
        print(f"✅ 成功檢測: {total_detected} ({total_detected/max(total_variants,1)*100:.1f}%)")
        print(f"❌ 漏報: {total_variants - total_detected} ({(total_variants-total_detected)/max(total_variants,1)*100:.1f}%)")
        
        print("\n各錯誤類型檢測率:")
        for error_type, stats in error_type_stats.items():
            rate = stats["detected"] / max(stats["total"], 1) * 100
            print(f"  - {error_type}: {stats['detected']}/{stats['total']} ({rate:.1f}%)")
        
        # 儲存報告
        report_path = Path("error_detection_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump({
                "summary": {
                    "total_variants": total_variants,
                    "detected": total_detected,
                    "missed": total_variants - total_detected,
                    "detection_rate": total_detected / max(total_variants, 1)
                },
                "by_error_type": error_type_stats,
                "details": all_results
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n📄 詳細報告已儲存: {report_path}")


if __name__ == "__main__":
    generator = ErrorGenerator()
    
    # 測試幾個代表性函數
    test_cases = [
        ("verify_user.py", "leaf_login"),
        ("product_management.py", "leaf_product_management_1767885269"),
        ("onchain_analytics.py", "leaf_get_transaction_history_xxx"),  # 需要找到正確的 node_id
    ]
    
    all_results = []
    
    for file_name, node_id in test_cases:
        file_path = Path(file_name)
        if file_path.exists():
            result = generator.test_function_file(file_path, node_id)
            all_results.append(result)
    
    generator.generate_report(all_results)
