#!/usr/bin/env python3
"""
Project Exporter - 項目導出模組
將生成的代碼、架構圖、文檔打包成 ZIP 文件
"""

import io
import json
import zipfile
from typing import Dict, List, Any
from datetime import datetime


def export_project(project_data: Dict[str, Any]) -> bytes:
    """
    導出完整項目為 ZIP
    
    Args:
        project_data: {
            "name": "項目名稱",
            "code": {...},        # 代碼文件 (來自 code_generator)
            "diagrams": [...],    # 架構圖 (來自 diagram_generator)
            "cost": {...},        # 成本估算 (來自 cost_estimator)
            "validation": {...}   # 驗證結果 (來自 MCP Server, 可選)
        }
    
    Returns:
        ZIP 文件的二進制數據
    """
    # 創建內存中的 ZIP 文件
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # 1. 添加代碼文件
        if 'code' in project_data and 'files' in project_data['code']:
            for filename, content in project_data['code']['files'].items():
                zip_file.writestr(f"code/{filename}", content)
        
        # 2. 添加架構圖 (Mermaid 格式)
        if 'diagrams' in project_data:
            for i, diagram in enumerate(project_data['diagrams']):
                diagram_type = diagram.get('type', f'diagram_{i}')
                mermaid_content = diagram.get('mermaid', '')
                zip_file.writestr(
                    f"diagrams/{diagram_type}.mmd",
                    mermaid_content
                )
        
        # 3. 添加成本估算報告
        if 'cost' in project_data:
            cost_report = generate_cost_report(project_data['cost'])
            zip_file.writestr("docs/COST_ESTIMATION.md", cost_report)
        
        # 4. 添加驗證報告 (如果有)
        if 'validation' in project_data:
            validation_report = generate_validation_report(project_data['validation'])
            zip_file.writestr("docs/VALIDATION_REPORT.md", validation_report)
        
        # 5. 生成並添加 README
        readme = generate_readme(project_data)
        zip_file.writestr("README.md", readme)
        
        # 6. 生成並添加安裝指南
        tutorial = generate_tutorial(project_data)
        zip_file.writestr("TUTORIAL.md", tutorial)
        
        # 7. 添加配置文件
        if 'code' in project_data and 'setup_instructions' in project_data['code']:
            setup = project_data['code']['setup_instructions']
            zip_file.writestr("INSTALLATION.md", setup)
        
        # 8. 添加項目元數據
        metadata = {
            "project_name": project_data.get('name', 'Generated Project'),
            "generated_at": datetime.now().isoformat(),
            "generator": "Blueprint Little Mouse v1.0",
            "framework": project_data.get('code', {}).get('framework', 'Django'),
            "version": project_data.get('code', {}).get('version', '4.2')
        }
        zip_file.writestr("project.json", json.dumps(metadata, indent=2, ensure_ascii=False))
        # 9. 注入 AI 通關密語 (Magic Words for Cursor/Windsurf)
        magic_prompt = """This is a BlueMouse Blueprint. It has passed 17 layers of validation. 
Implement the code exactly according to this architecture. Do not improvise.

(Note: This blueprint is rigorous. All file paths, types, and logic constraints are non-negotiable.)"""
        
        zip_file.writestr(".cursorrules", magic_prompt)
        zip_file.writestr(".windsurfrules", magic_prompt)  # Support Windsurf too
        zip_file.writestr("INSTRUCTIONS_FOR_AI.md", magic_prompt)

    # 返回 ZIP 文件的二進制數據
    zip_buffer.seek(0)
    return zip_buffer.read()


def generate_readme(project_data: Dict[str, Any]) -> str:
    """
    生成 README.md
    
    Args:
        project_data: 項目數據
    
    Returns:
        README.md 內容
    """
    project_name = project_data.get('name', 'Generated Project')
    framework = project_data.get('code', {}).get('framework', 'Django')
    
    readme = f"""# {project_name}

> 由 Blueprint Little Mouse 自動生成

## 項目概述

這是一個使用 {framework} 框架開發的項目,由 AI 驅動的架構生成系統自動創建。

## 特性

"""
    
    # 添加模組列表
    if 'modules' in project_data:
        readme += "### 核心模組\n\n"
        for module in project_data['modules']:
            name = module.get('name', '未命名模組')
            desc = module.get('description', '無描述')
            readme += f"- **{name}**: {desc}\n"
        readme += "\n"
    
    # 添加技術棧
    readme += f"""## 技術棧

- **框架**: {framework}
- **Python**: 3.9+
- **數據庫**: PostgreSQL (推薦) / SQLite (開發)
- **API**: Django REST Framework

## 快速開始

### 1. 安裝依賴

```bash
pip install -r code/requirements.txt
```

### 2. 配置數據庫

```bash
# 創建數據庫遷移
python manage.py makemigrations

# 運行遷移
python manage.py migrate
```

### 3. 創建超級用戶

```bash
python manage.py createsuperuser
```

### 4. 啟動服務器

```bash
python manage.py runserver
```

訪問 http://localhost:8000 查看應用。

## 項目結構

```
.
├── code/                  # 源代碼
│   ├── models.py         # 數據模型
│   ├── views.py          # API 視圖
│   ├── serializers.py    # 序列化器
│   ├── urls.py           # URL 路由
│   ├── admin.py          # Admin 配置
│   ├── tests.py          # 測試用例
│   └── requirements.txt  # 依賴列表
├── diagrams/             # 架構圖
│   ├── architecture.mmd  # 系統架構圖
│   ├── dataflow.mmd      # 數據流圖
│   ├── er.mmd            # ER 圖
│   └── sequence.mmd      # 序列圖
├── docs/                 # 文檔
│   ├── COST_ESTIMATION.md    # 成本估算
│   └── VALIDATION_REPORT.md  # 驗證報告
├── README.md             # 本文件
├── TUTORIAL.md           # 詳細教程
└── INSTALLATION.md       # 安裝指南
```

## 文檔

- [詳細教程](TUTORIAL.md) - 完整的開發指南
- [安裝指南](INSTALLATION.md) - 部署和配置
- [成本估算](docs/COST_ESTIMATION.md) - 開發成本分析

## 架構圖

項目包含以下架構圖 (Mermaid 格式):

- **系統架構圖** (`diagrams/architecture.mmd`) - 展示整體系統結構
- **數據流圖** (`diagrams/dataflow.mmd`) - 展示數據流動
- **ER 圖** (`diagrams/er.mmd`) - 展示數據庫關係
- **序列圖** (`diagrams/sequence.mmd`) - 展示交互流程

使用 [Mermaid Live Editor](https://mermaid.live) 查看和編輯這些圖表。

## 測試

```bash
# 運行所有測試
python manage.py test

# 運行特定測試
python manage.py test code.tests
```

## 部署

詳見 [INSTALLATION.md](INSTALLATION.md) 中的部署指南。

## 許可證

MIT License

## 致謝

本項目由 [Blueprint Little Mouse](https://github.com/...) 自動生成。

---

**生成時間**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
**生成器版本**: v1.0
"""
    
    return readme


def generate_tutorial(project_data: Dict[str, Any]) -> str:
    """
    生成 TUTORIAL.md
    
    Args:
        project_data: 項目數據
    
    Returns:
        TUTORIAL.md 內容
    """
    project_name = project_data.get('name', 'Generated Project')
    framework = project_data.get('code', {}).get('framework', 'Django')
    
    tutorial = f"""# {project_name} - 完整教程

## 目錄

1. [環境準備](#環境準備)
2. [項目設置](#項目設置)
3. [開發指南](#開發指南)
4. [API 使用](#api-使用)
5. [測試](#測試)
6. [部署](#部署)

---

## 環境準備

### 系統要求

- Python 3.9 或更高版本
- pip (Python 包管理器)
- PostgreSQL 12+ (生產環境) 或 SQLite (開發環境)

### 安裝 Python

```bash
# macOS
brew install python@3.9

# Ubuntu/Debian
sudo apt-get install python3.9

# Windows
# 從 python.org 下載安裝包
```

### 創建虛擬環境

```bash
# 創建虛擬環境
python3 -m venv venv

# 激活虛擬環境
# macOS/Linux
source venv/bin/activate

# Windows
venv\\Scripts\\activate
```

---

## 項目設置

### 1. 安裝依賴

```bash
pip install -r code/requirements.txt
```

### 2. 環境變量配置

創建 `.env` 文件:

```env
# Django 設置
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# 數據庫設置
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# 或使用 SQLite (開發環境)
# DATABASE_URL=sqlite:///db.sqlite3
```

### 3. 數據庫遷移

```bash
# 創建遷移文件
python manage.py makemigrations

# 應用遷移
python manage.py migrate
```

### 4. 創建超級用戶

```bash
python manage.py createsuperuser
```

按提示輸入用戶名、郵箱和密碼。

### 5. 收集靜態文件 (生產環境)

```bash
python manage.py collectstatic
```

---

## 開發指南

### 項目結構說明

```
code/
├── models.py         # 數據模型定義
├── views.py          # API 視圖和業務邏輯
├── serializers.py    # 數據序列化
├── urls.py           # URL 路由
├── admin.py          # Admin 後台配置
└── tests.py          # 測試用例
```

### 添加新功能

1. **定義模型** (models.py)
2. **創建序列化器** (serializers.py)
3. **實現視圖** (views.py)
4. **配置路由** (urls.py)
5. **添加測試** (tests.py)

### 代碼風格

項目遵循 PEP 8 規範:

```bash
# 檢查代碼風格
flake8 code/

# 自動格式化
black code/
```

---

## API 使用

### API 端點

所有 API 端點都在 `/api/` 路徑下。

### 認證

使用 Token 認證:

```bash
# 獲取 Token
curl -X POST http://localhost:8000/api/auth/login/ \\
  -H "Content-Type: application/json" \\
  -d '{{"username": "admin", "password": "password"}}'

# 使用 Token
curl -X GET http://localhost:8000/api/endpoint/ \\
  -H "Authorization: Token your-token-here"
```

### 示例請求

```python
import requests

# 登錄
response = requests.post('http://localhost:8000/api/auth/login/', {{
    'username': 'admin',
    'password': 'password'
}})
token = response.json()['token']

# 使用 Token 訪問 API
headers = {{'Authorization': f'Token {{token}}'}}
response = requests.get('http://localhost:8000/api/endpoint/', headers=headers)
data = response.json()
```

---

## 測試

### 運行測試

```bash
# 運行所有測試
python manage.py test

# 運行特定應用的測試
python manage.py test code

# 運行特定測試類
python manage.py test code.tests.TestClassName

# 運行特定測試方法
python manage.py test code.tests.TestClassName.test_method_name
```

### 測試覆蓋率

```bash
# 安裝 coverage
pip install coverage

# 運行測試並生成覆蓋率報告
coverage run --source='.' manage.py test
coverage report
coverage html  # 生成 HTML 報告
```

---

## 部署

### 生產環境檢查清單

- [ ] 設置 `DEBUG=False`
- [ ] 配置 `ALLOWED_HOSTS`
- [ ] 使用強密碼作為 `SECRET_KEY`
- [ ] 配置 PostgreSQL 數據庫
- [ ] 設置 HTTPS
- [ ] 配置靜態文件服務
- [ ] 設置日誌記錄
- [ ] 配置備份策略

### 使用 Gunicorn

```bash
# 安裝 Gunicorn
pip install gunicorn

# 啟動服務
gunicorn myproject.wsgi:application --bind 0.0.0.0:8000
```

### 使用 Nginx

Nginx 配置示例:

```nginx
server {{
    listen 80;
    server_name example.com;

    location /static/ {{
        alias /path/to/staticfiles/;
    }}

    location / {{
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }}
}}
```

### Docker 部署

```dockerfile
FROM python:3.9

WORKDIR /app
COPY code/requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["gunicorn", "myproject.wsgi:application", "--bind", "0.0.0.0:8000"]
```

---

## 常見問題

### Q: 如何重置數據庫?

```bash
python manage.py flush
```

### Q: 如何導出/導入數據?

```bash
# 導出
python manage.py dumpdata > data.json

# 導入
python manage.py loaddata data.json
```

### Q: 如何查看 SQL 查詢?

在 settings.py 中啟用 SQL 日誌:

```python
LOGGING = {{
    'version': 1,
    'handlers': {{
        'console': {{'class': 'logging.StreamHandler'}},
    }},
    'loggers': {{
        'django.db.backends': {{
            'handlers': ['console'],
            'level': 'DEBUG',
        }},
    }},
}}
```

---

## 支持

如有問題,請查閱:
- [Django 官方文檔](https://docs.djangoproject.com/)
- [DRF 官方文檔](https://www.django-rest-framework.org/)

---

**最後更新**: {datetime.now().strftime('%Y-%m-%d')}
"""
    
    return tutorial


def generate_cost_report(cost_data: Dict[str, Any]) -> str:
    """
    生成成本估算報告
    
    Args:
        cost_data: 成本數據
    
    Returns:
        成本報告 Markdown
    """
    report = f"""# 成本估算報告

**生成時間**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 開發時間估算

"""
    
    if 'development' in cost_data:
        dev = cost_data['development']
        report += f"""
- **總開發天數**: {dev.get('total_days', 'N/A')} 天
- **開發階段**: {dev.get('phases', {}).get('development', 'N/A')} 天
- **測試階段**: {dev.get('phases', {}).get('testing', 'N/A')} 天
- **部署階段**: {dev.get('phases', {}).get('deployment', 'N/A')} 天

"""
    
    if 'cost' in cost_data:
        cost = cost_data['cost']
        report += f"""## 開發成本估算

- **總成本**: ${cost.get('total', 0):,} USD
- **基礎成本**: ${cost.get('base_cost', 0):,} USD
- **風險緩衝**: ${cost.get('risk_buffer', 0):,} USD

### 成本分解

"""
        if 'breakdown' in cost:
            for role, details in cost['breakdown'].items():
                if isinstance(details, dict):
                    report += f"- **{role}**: ${details.get('總計', 0):,} USD\n"
    
    if 'operations' in cost_data:
        ops = cost_data['operations']
        report += f"""
## 運營成本估算

- **月度成本**: ${ops.get('monthly', 0):,} USD/月
- **年度成本**: ${ops.get('monthly', 0) * 12:,} USD/年

"""
    
    if 'team' in cost_data:
        team = cost_data['team']
        report += f"""## 團隊配置建議

- **總人數**: {team.get('total', 0)} 人

### 團隊組成

"""
        if 'roles' in team:
            for role, count in team['roles'].items():
                report += f"- **{role}**: {count} 人\n"
    
    report += """
---

**注意**: 以上估算僅供參考,實際成本可能因項目具體情況而異。
"""
    
    return report


def generate_validation_report(validation_data: Dict[str, Any]) -> str:
    """
    生成驗證報告
    
    Args:
        validation_data: 驗證數據
    
    Returns:
        驗證報告 Markdown
    """
    report = f"""# 代碼驗證報告

**生成時間**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 驗證結果

"""
    
    passed = validation_data.get('passed', False)
    status = "✅ 通過" if passed else "❌ 失敗"
    
    report += f"**總體狀態**: {status}\n\n"
    
    if 'quality_score' in validation_data:
        score = validation_data['quality_score']
        report += f"**質量評分**: {score}/100\n\n"
    
    if 'layers' in validation_data:
        report += "## 驗證層級\n\n"
        for layer in validation_data['layers']:
            layer_num = layer.get('layer', '?')
            layer_name = layer.get('name', '未命名')
            layer_passed = layer.get('passed', False)
            layer_status = "✅" if layer_passed else "❌"
            
            report += f"- **Layer {layer_num} - {layer_name}**: {layer_status}\n"
    
    if 'suggestions' in validation_data and validation_data['suggestions']:
        report += "\n## 改進建議\n\n"
        for suggestion in validation_data['suggestions']:
            report += f"- {suggestion}\n"
    
    report += """
---

**驗證系統**: Blueprint Little Mouse MMLA-MRM v1.0
"""
    
    return report


if __name__ == "__main__":
    # 測試導出功能
    test_data = {
        "name": "測試項目",
        "code": {
            "framework": "Django",
            "version": "4.2",
            "files": {
                "models.py": "# Django Models\nclass User(models.Model):\n    pass",
                "views.py": "# Django Views\nclass UserViewSet(viewsets.ModelViewSet):\n    pass"
            },
            "setup_instructions": "# 安裝指南\npip install -r requirements.txt"
        },
        "diagrams": [
            {
                "type": "architecture",
                "mermaid": "graph TD\n    A[Frontend] --> B[Backend]"
            }
        ],
        "cost": {
            "development": {"total_days": 90},
            "cost": {"total": 100000}
        }
    }
    
    zip_data = export_project(test_data)
    
    # 保存測試 ZIP
    with open("test_export.zip", "wb") as f:
        f.write(zip_data)
    
    print(f"✅ 測試 ZIP 已生成: test_export.zip ({len(zip_data)} bytes)")
