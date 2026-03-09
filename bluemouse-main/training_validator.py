#!/usr/bin/env python3
"""
批量驗證工具 - Training Validator
自動驗證所有 Python 函數檔案,生成驗證報告
"""

import os
import json
import ast
from pathlib import Path
from collections import defaultdict

def load_spec():
    """載入 MMLA 規格"""
    spec_file = Path("mmla_spec.json")
    if not spec_file.exists():
        return {}
    with open(spec_file, "r", encoding="utf-8") as f:
        return json.load(f)

def simple_validate(code: str, expected_name: str) -> dict:
    """簡化的驗證邏輯"""
    errors = []
    
    # 檢查語法
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {"success": False, "errors": [f"語法錯誤: {str(e)}"]}
    
    # 檢查函數名
    func_found = False
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            if node.name == expected_name:
                func_found = True
                # 檢查類型提示
                if not all(arg.annotation for arg in node.args.args):
                    errors.append("缺少類型提示")
                if not node.returns:
                    errors.append("缺少返回類型提示")
            break
    
    if not func_found:
        errors.append(f"找不到函數 {expected_name}")
    
    return {
        "success": len(errors) == 0,
        "errors": errors
    }

class TrainingValidator:
    def __init__(self, project_dir: str):
        self.project_dir = Path(project_dir)
        self.results = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "errors_by_type": defaultdict(int),
            "failed_files": []
        }
    
    def find_python_files(self):
        """找到所有 Python 函數檔案"""
        python_files = []
        
        # 排除測試檔案和工具檔案
        exclude_patterns = [
            "test_", "setup_", "server.py", "mmla_parser.py",
            "training_validator.py", "error_generator.py"
        ]
        
        for file in self.project_dir.glob("*.py"):
            if not any(pattern in file.name for pattern in exclude_patterns):
                python_files.append(file)
        
        return python_files
    
    def extract_function_name(self, code: str) -> str:
        """從代碼中提取函數名"""
        import ast
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    return node.name
        except:
            pass
        return None
    
    def find_matching_node(self, function_name: str):
        """在 MMLA spec 中找到匹配的節點 (簡化版)"""
        # 簡化版:直接返回函數名作為 ID
        return function_name
    
    def validate_file(self, file_path: Path):
        """驗證單個檔案"""
        print(f"📝 驗證: {file_path.name}")
        
        with open(file_path, "r", encoding="utf-8") as f:
            code = f.read()
        
        # 提取函數名
        function_name = self.extract_function_name(code)
        if not function_name:
            print(f"  ⚠️  無法提取函數名")
            return
        
        # 找到對應的 MMLA 節點
        node_id = self.find_matching_node(function_name)
        if not node_id:
            print(f"  ⚠️  找不到對應的 MMLA 節點: {function_name}")
            return
        
        # 執行驗證
        result = simple_validate(code, function_name)
        
        self.results["total"] += 1
        
        if result.get("success"):
            self.results["passed"] += 1
            print(f"  ✅ 通過")
        else:
            self.results["failed"] += 1
            errors = result.get("errors", [])
            print(f"  ❌ 失敗: {len(errors)} 個錯誤")
            
            for error in errors:
                print(f"     - {error}")
                # 統計錯誤類型
                if "signature mismatch" in error.lower():
                    self.results["errors_by_type"]["函數簽名不符"] += 1
                elif "dependencies" in error.lower():
                    self.results["errors_by_type"]["依賴未聲明"] += 1
                elif "syntax" in error.lower():
                    self.results["errors_by_type"]["語法錯誤"] += 1
                elif "arguments" in error.lower():
                    self.results["errors_by_type"]["參數錯誤"] += 1
                else:
                    self.results["errors_by_type"]["其他錯誤"] += 1
            
            self.results["failed_files"].append({
                "file": file_path.name,
                "function": function_name,
                "node_id": node_id,
                "errors": errors
            })
    
    def run(self):
        """執行批量驗證"""
        print("🚀 開始批量驗證...\n")
        
        python_files = self.find_python_files()
        print(f"找到 {len(python_files)} 個 Python 檔案\n")
        
        for file in python_files:
            self.validate_file(file)
            print()
        
        self.generate_report()
    
    def generate_report(self):
        """生成驗證報告"""
        print("=" * 60)
        print("📊 驗證報告")
        print("=" * 60)
        print(f"\n總函數數: {self.results['total']}")
        print(f"✅ 通過: {self.results['passed']} ({self.results['passed']/max(self.results['total'],1)*100:.1f}%)")
        print(f"❌ 失敗: {self.results['failed']} ({self.results['failed']/max(self.results['total'],1)*100:.1f}%)")
        
        if self.results["errors_by_type"]:
            print("\n🐛 錯誤類型統計:")
            for error_type, count in sorted(self.results["errors_by_type"].items(), key=lambda x: x[1], reverse=True):
                print(f"  - {error_type}: {count} 次")
        
        # 儲存詳細報告
        report_path = self.project_dir / "validation_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        print(f"\n📄 詳細報告已儲存: {report_path}")
        
        # 生成 Markdown 報告
        self.generate_markdown_report()
    
    def generate_markdown_report(self):
        """生成 Markdown 格式報告"""
        report_path = self.project_dir / "validation_report.md"
        
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("# 🎯 MMLA 訓練驗證報告\n\n")
            f.write(f"**驗證時間**: {Path(__file__).stat().st_mtime}\n\n")
            
            f.write("## 📊 總體統計\n\n")
            f.write(f"- 總函數數: {self.results['total']}\n")
            f.write(f"- ✅ 通過: {self.results['passed']} ({self.results['passed']/max(self.results['total'],1)*100:.1f}%)\n")
            f.write(f"- ❌ 失敗: {self.results['failed']} ({self.results['failed']/max(self.results['total'],1)*100:.1f}%)\n\n")
            
            if self.results["errors_by_type"]:
                f.write("## 🐛 錯誤類型分析\n\n")
                total_errors = sum(self.results["errors_by_type"].values())
                for error_type, count in sorted(self.results["errors_by_type"].items(), key=lambda x: x[1], reverse=True):
                    percentage = count / total_errors * 100
                    f.write(f"{count}. **{error_type}**: {count} 次 ({percentage:.1f}%)\n")
                f.write("\n")
            
            if self.results["failed_files"]:
                f.write("## ❌ 失敗檔案清單\n\n")
                for item in self.results["failed_files"]:
                    f.write(f"### {item['file']}\n")
                    f.write(f"- 函數: `{item['function']}`\n")
                    f.write(f"- 節點 ID: `{item['node_id']}`\n")
                    f.write(f"- 錯誤:\n")
                    for error in item['errors']:
                        f.write(f"  - {error}\n")
                    f.write("\n")
        
        print(f"📄 Markdown 報告已儲存: {report_path}")


if __name__ == "__main__":
    # 使用當前目錄
    validator = TrainingValidator(".")
    validator.run()
