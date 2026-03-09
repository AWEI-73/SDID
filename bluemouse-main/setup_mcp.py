import os
import json
import sys
from pathlib import Path

def setup_vscode_config():
    """
    Automates the creation of .vscode/mcp.json to register the BlueMouse server.
    This allows VS Code to automatically pick up the MCP server without global config.
    """
    workspace_root = os.getcwd()
    vscode_dir = os.path.join(workspace_root, ".vscode")
    mcp_config_path = os.path.join(vscode_dir, "mcp.json")
    
    # Determine python path (venv)
    if sys.platform == "win32":
        venv_python = os.path.join(workspace_root, "venv", "Scripts", "python.exe")
    else:
        venv_python = os.path.join(workspace_root, "venv", "bin", "python")
        
    if not os.path.exists(venv_python):
        print(f"⚠️ Venv python not found at {venv_python}. Using system python.")
        venv_python = sys.executable

    server_script = os.path.join(workspace_root, "server.py")
    
    config = {
        "mcpServers": {
            "blueprint-little-mouse": {
                "command": venv_python,
                "args": [server_script],
                "env": {
                    "PYTHONUNBUFFERED": "1"
                }
            }
        }
    }
    
    try:
        os.makedirs(vscode_dir, exist_ok=True)
        
        # Merge if exists
        if os.path.exists(mcp_config_path):
            try:
                with open(mcp_config_path, 'r', encoding='utf-8') as f:
                    existing_config = json.load(f)
                    if "mcpServers" in existing_config:
                        existing_config["mcpServers"].update(config["mcpServers"])
                        config = existing_config
            except Exception:
                pass # Overwrite if corrupt
                
        with open(mcp_config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
            
        print(f"✅ Auto-configured VS Code MCP settings at: {mcp_config_path}")
        print("   (Restart VS Code to apply)")
        
    except Exception as e:
        print(f"❌ Failed to setup MCP config: {e}")

if __name__ == "__main__":
    setup_vscode_config()
