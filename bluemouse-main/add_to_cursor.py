#!/usr/bin/env python3
"""
BlueMouse Cursor One-Click Installer
Automatically adds BlueMouse MCP server to Cursor configuration.
"""

import json
import os
import sys
import platform

def get_cursor_config_path():
    system = platform.system()
    home = os.path.expanduser("~")
    
    if system == "Darwin":  # macOS
        paths = [
            os.path.join(home, "Library/Application Support/Cursor/User/globalStorage/cursor-mcp/mcp_config.json"),
            os.path.join(home, "Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/mcp_config.json")
        ]
    elif system == "Windows":
        appdata = os.environ.get("APPDATA")
        if not appdata: return None
        paths = [
            os.path.join(appdata, "Cursor/User/globalStorage/cursor-mcp/mcp_config.json"),
            os.path.join(appdata, "Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/mcp_config.json")
        ]
    elif system == "Linux":
        config_home = os.environ.get("XDG_CONFIG_HOME", os.path.join(home, ".config"))
        paths = [
            os.path.join(config_home, "Cursor/User/globalStorage/cursor-mcp/mcp_config.json"),
            os.path.join(config_home, "Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/mcp_config.json")
        ]
    else:
        return None

    for p in paths:
        if os.path.exists(p):
            return p
    return None

def install():
    print("🐭 BlueMouse Cursor One-Click Installer")
    print("-" * 40)
    
    config_path = get_cursor_config_path()
    if not config_path:
        print("❌ Could not find Cursor MCP configuration automatically.")
        print("Please follow the manual installation guide in MCP_SUBMISSION_GUIDE.md")
        return

    print(f"✅ Found Cursor config at: {config_path}")
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except Exception as e:
        print(f"❌ Error reading config: {e}")
        return

    # Prepare entry
    project_root = os.path.dirname(os.path.abspath(__file__))
    server_path = os.path.join(project_root, "server.py")
    
    # Use the absolute path to the current python interpreter
    python_path = sys.executable

    mcp_entry = {
        "command": python_path,
        "args": [server_path],
        "env": {
            "PYTHONUNBUFFERED": "1"
        }
    }

    if "mcpServers" not in config:
        config["mcpServers"] = {}
    
    config["mcpServers"]["bluemouse"] = mcp_entry
    
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        print("🚀 Success! BlueMouse has been added to your Cursor MCP settings.")
        print("Please restart Cursor to apply the changes.")
    except Exception as e:
        print(f"❌ Error saving config: {e}")

if __name__ == "__main__":
    install()
