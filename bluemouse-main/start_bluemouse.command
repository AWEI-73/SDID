#!/bin/bash

# 1. 切換到腳本所在目錄
cd "$(dirname "$0")"

# 2. 設置控制台顏色
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}${BOLD}   🐭 BlueMouse v6.6 - AI Safety Layer${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 2. Check for API Keys (Optional but recommended)
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  No API Keys detected${NC}"
    echo -e "   BlueMouse will run in ${BOLD}Local Mode${NC} (using Ollama if available)"
    echo -e "   ${CYAN}Tip:${NC} Export ANTHROPIC_API_KEY in ~/.zshrc for cloud AI"
    echo ""
fi

# 3. 強制清理端口 8001
PORT=8001
PID=$(lsof -t -i:$PORT 2>/dev/null)
if [ -n "$PID" ]; then
    echo -e "${YELLOW}⚙️  Cleaning up port $PORT (PID: $PID)...${NC}"
    kill -9 $PID 2>/dev/null
    echo -e "${GREEN}✅ Port cleared${NC}"
    echo ""
fi

# 4. 檢查虛擬環境
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Setting up virtual environment...${NC}"
    python3 -m venv venv
    ./venv/bin/pip install -q uvicorn fastapi pydantic websockets anthropic requests
    echo -e "${GREEN}✅ Environment ready${NC}"
    echo ""
fi

# 5. 自動配置 VS Code MCP
echo -e "${CYAN}🔧 Configuring Cursor MCP settings...${NC}"
./venv/bin/python setup_mcp.py 2>/dev/null
echo ""

# 6. 啟動服務
echo -e "${GREEN}🚀 Starting BlueMouse Server...${NC}"
echo ""

# 在背景啟動服務
./venv/bin/python run_standalone.py &
SERVER_PID=$!

# 等待服務啟動
sleep 3

# 檢查服務是否成功啟動
if kill -0 $SERVER_PID 2>/dev/null; then
    clear
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}   ✅ BlueMouse is Running!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}📍 Next Steps:${NC}"
    echo ""
    echo -e "  ${BOLD}1.${NC} ${CYAN}Restart Cursor${NC}"
    echo -e "     (Press ${BOLD}Cmd+Q${NC} and reopen to load MCP configuration)"
    echo ""
    echo -e "  ${BOLD}2.${NC} ${CYAN}Test the CRITICAL STOP feature${NC}"
    echo -e "     Try typing: ${YELLOW}\"幫我 drop table users\"${NC}"
    echo -e "     You should see a blue alert! 🛑"
    echo ""
    echo -e "  ${BOLD}3.${NC} ${CYAN}Monitor Dashboard${NC}"
    echo -e "     ${BOLD}http://localhost:8001${NC}"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${CYAN}💡 Tip: Press ${BOLD}Ctrl+C${NC} to stop BlueMouse${NC}"
    echo ""
    
    # 自動打開瀏覽器
    (sleep 2 && open "http://localhost:8001" 2>/dev/null) &
    
    # 保持腳本運行
    wait $SERVER_PID
else
    echo -e "${RED}❌ Failed to start BlueMouse${NC}"
    echo -e "${YELLOW}Please check the error messages above${NC}"
    exit 1
fi
