"""
架構圖生成器 - 藍圖小老鼠
使用 Mermaid 生成各種架構圖
"""

from typing import Dict, List, Any


def generate_diagram(
    blueprint: Dict[str, Any],
    diagram_type: str = "architecture"
) -> Dict[str, Any]:
    """
    生成架構圖
    
    Args:
        blueprint: 藍圖資訊
        diagram_type: 圖表類型 (architecture/dataflow/er/sequence)
        
    Returns:
        Mermaid 圖表代碼
    """
    if diagram_type == "architecture":
        return generate_architecture_diagram(blueprint)
    elif diagram_type == "dataflow":
        return generate_dataflow_diagram(blueprint)
    elif diagram_type == "er":
        return generate_er_diagram(blueprint)
    elif diagram_type == "sequence":
        return generate_sequence_diagram(blueprint)
    else:
        raise ValueError(f"不支持的圖表類型: {diagram_type}")


def generate_architecture_diagram(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """
    生成系統架構圖
    
    Args:
        blueprint: 藍圖資訊
        
    Returns:
        架構圖 Mermaid 代碼
    """
    modules = blueprint.get('modules', [])
    
    # 開始構建 Mermaid 圖
    mermaid = "graph TD\n"
    
    # 添加前端
    mermaid += "    A[前端 Web/App] --> B[API Gateway]\n"
    
    # 添加各個服務模組
    for i, module in enumerate(modules):
        module_id = chr(67 + i)  # C, D, E, ...
        module_name = module.get('name', f'模組{i+1}')
        
        # API Gateway 連接到各個服務
        mermaid += f"    B --> {module_id}[{module_name}]\n"
    
    # 添加數據庫
    db_id = chr(67 + len(modules))
    mermaid += f"    {db_id}[(PostgreSQL)]\n"
    
    # 各個服務連接到數據庫
    for i in range(len(modules)):
        module_id = chr(67 + i)
        mermaid += f"    {module_id} --> {db_id}\n"
    
    # 添加快取
    cache_id = chr(67 + len(modules) + 1)
    mermaid += f"    {cache_id}[(Redis 快取)]\n"
    
    # 部分服務使用快取
    if len(modules) > 0:
        mermaid += f"    C --> {cache_id}\n"
    
    # 添加樣式
    mermaid += "\n    classDef frontend fill:#667eea,stroke:#333,stroke-width:2px,color:#fff\n"
    mermaid += "    classDef service fill:#4facfe,stroke:#333,stroke-width:2px,color:#fff\n"
    mermaid += "    classDef database fill:#00f2fe,stroke:#333,stroke-width:2px,color:#fff\n"
    mermaid += "    class A frontend\n"
    mermaid += f"    class {','.join([chr(67+i) for i in range(len(modules))])} service\n"
    mermaid += f"    class {db_id},{cache_id} database\n"
    
    return {
        "type": "architecture",
        "mermaid": mermaid,
        "title": f"{blueprint.get('title', '系統')}架構圖",
        "description": "系統整體架構,展示前端、API Gateway、各個服務和數據層"
    }


def generate_dataflow_diagram(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """
    生成數據流圖
    
    Args:
        blueprint: 藍圖資訊
        
    Returns:
        數據流圖 Mermaid 代碼
    """
    modules = blueprint.get('modules', [])
    
    mermaid = "graph LR\n"
    
    # 用戶輸入
    mermaid += "    A[用戶輸入] --> B[前端驗證]\n"
    mermaid += "    B --> C[API 請求]\n"
    
    # 各個處理步驟
    for i, module in enumerate(modules[:3]):  # 只顯示前3個
        current_id = chr(67 + i + 1)
        next_id = chr(67 + i + 2)
        module_name = module.get('name', f'處理{i+1}')
        mermaid += f"    {current_id} --> {next_id}[{module_name}]\n"
    
    # 數據存儲
    final_id = chr(67 + min(len(modules), 3) + 1)
    mermaid += f"    {final_id} --> Z[(數據庫)]\n"
    mermaid += "    Z --> Y[返回結果]\n"
    
    return {
        "type": "dataflow",
        "mermaid": mermaid,
        "title": "數據流圖",
        "description": "展示數據在系統中的流動過程"
    }


def generate_er_diagram(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """
    生成 ER 圖 (實體關係圖)
    
    Args:
        blueprint: 藍圖資訊
        
    Returns:
        ER 圖 Mermaid 代碼
    """
    modules = blueprint.get('modules', [])
    
    mermaid = "erDiagram\n"
    
    # 用戶實體
    mermaid += "    USER ||--o{ ORDER : places\n"
    mermaid += "    USER {\n"
    mermaid += "        int id PK\n"
    mermaid += "        string username\n"
    mermaid += "        string email\n"
    mermaid += "        datetime created_at\n"
    mermaid += "    }\n\n"
    
    # 根據模組生成實體
    for module in modules[:3]:  # 只顯示前3個
        entity_name = module.get('name', '實體').replace('系統', '').replace('模組', '').upper()
        
        mermaid += f"    {entity_name} {{\n"
        mermaid += "        int id PK\n"
        mermaid += "        int user_id FK\n"
        mermaid += "        string name\n"
        mermaid += "        datetime created_at\n"
        mermaid += "    }\n\n"
        
        mermaid += f"    USER ||--o{{ {entity_name} : owns\n"
    
    return {
        "type": "er",
        "mermaid": mermaid,
        "title": "數據模型 ER 圖",
        "description": "展示數據庫表結構和關係"
    }


def generate_sequence_diagram(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """
    生成序列圖
    
    Args:
        blueprint: 藍圖資訊
        
    Returns:
        序列圖 Mermaid 代碼
    """
    modules = blueprint.get('modules', [])
    
    mermaid = "sequenceDiagram\n"
    mermaid += "    participant U as 用戶\n"
    mermaid += "    participant F as 前端\n"
    mermaid += "    participant A as API Gateway\n"
    
    # 添加服務參與者
    for i, module in enumerate(modules[:2]):  # 只顯示前2個
        service_name = module.get('name', f'服務{i+1}')
        mermaid += f"    participant S{i+1} as {service_name}\n"
    
    mermaid += "    participant D as 數據庫\n\n"
    
    # 交互流程
    mermaid += "    U->>F: 輸入數據\n"
    mermaid += "    F->>F: 前端驗證\n"
    mermaid += "    F->>A: API 請求\n"
    mermaid += "    A->>S1: 轉發請求\n"
    mermaid += "    S1->>D: 查詢數據\n"
    mermaid += "    D-->>S1: 返回數據\n"
    
    if len(modules) > 1:
        mermaid += "    S1->>S2: 調用服務\n"
        mermaid += "    S2->>D: 更新數據\n"
        mermaid += "    D-->>S2: 確認\n"
        mermaid += "    S2-->>S1: 返回結果\n"
    
    mermaid += "    S1-->>A: 返回響應\n"
    mermaid += "    A-->>F: 返回數據\n"
    mermaid += "    F-->>U: 顯示結果\n"
    
    return {
        "type": "sequence",
        "mermaid": mermaid,
        "title": "交互序列圖",
        "description": "展示用戶操作的完整交互流程"
    }


def generate_all_diagrams(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    """
    生成所有類型的圖表
    
    Args:
        blueprint: 藍圖資訊
        
    Returns:
        所有圖表
    """
    return {
        "architecture": generate_architecture_diagram(blueprint),
        "dataflow": generate_dataflow_diagram(blueprint),
        "er": generate_er_diagram(blueprint),
        "sequence": generate_sequence_diagram(blueprint)
    }


def generate_html_preview(diagrams: Dict[str, Any]) -> str:
    """
    生成 HTML 預覽頁面
    
    Args:
        diagrams: 圖表字典
        
    Returns:
        HTML 代碼
    """
    html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>系統架構圖</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .diagram-container {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h2 {
            color: #667eea;
            margin-top: 0;
        }
        .description {
            color: #666;
            margin-bottom: 20px;
        }
        .mermaid {
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>🐭 系統架構圖</h1>
"""
    
    for diagram_type, diagram in diagrams.items():
        html += f"""
    <div class="diagram-container">
        <h2>{diagram['title']}</h2>
        <p class="description">{diagram['description']}</p>
        <div class="mermaid">
{diagram['mermaid']}
        </div>
    </div>
"""
    
    html += """
    <script>
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
    </script>
</body>
</html>
"""
    
    return html
