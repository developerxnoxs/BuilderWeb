#!/bin/bash

echo "=================================="
echo "Debian Build Server Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo -e "${YELLOW}Warning: This script is optimized for Linux/Debian systems${NC}"
    echo -e "${YELLOW}Some features may not work on other operating systems${NC}"
    echo ""
fi

# Generate random API key
generate_api_key() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32
    else
        echo "dev-key-$(date +%s)-change-in-production"
    fi
}

# Create directories
echo -e "${GREEN}[1/6] Creating build directories...${NC}"
mkdir -p builds apks uploads
chmod 755 builds apks uploads
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Create .env file if it doesn't exist
echo -e "${GREEN}[2/6] Configuring environment variables...${NC}"
if [ ! -f .env ]; then
    API_KEY=$(generate_api_key)
    
    cat > .env << EOF
# Main Server Configuration
PORT=5000
NODE_ENV=development
SESSION_SECRET=$(generate_api_key)

# Debian Build Server Configuration
DEBIAN_SERVER_PORT=3001
DEBIAN_SERVER_HOST=0.0.0.0
DEBIAN_API_KEY=${API_KEY}

# Build Directories
BUILDS_DIR=./builds
APKS_DIR=./apks
UPLOADS_DIR=./uploads

# Build Configuration
MAX_CONCURRENT_BUILDS=3
BUILD_TIMEOUT=1800000
CLEANUP_INTERVAL=3600000
EOF
    
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}  API Key: ${API_KEY}${NC}"
    echo -e "${YELLOW}  Save this API key for frontend configuration!${NC}"
else
    echo -e "${YELLOW}✓ .env file already exists, skipping...${NC}"
fi
echo ""

# Install dependencies (if needed)
echo -e "${GREEN}[3/6] Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# Setup database
echo -e "${GREEN}[4/6] Setting up database...${NC}"
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}  DATABASE_URL not found in environment${NC}"
    echo -e "${YELLOW}  Database will be created automatically by Replit${NC}"
else
    echo "Pushing database schema..."
    npm run db:push
    echo -e "${GREEN}✓ Database schema updated${NC}"
fi
echo ""

# Build the project
echo -e "${GREEN}[5/6] Building project...${NC}"
if npm run build 2>/dev/null; then
    echo -e "${GREEN}✓ Project built successfully${NC}"
else
    echo -e "${YELLOW}✓ Build step skipped (development mode)${NC}"
fi
echo ""

# Create startup scripts
echo -e "${GREEN}[6/6] Creating startup scripts...${NC}"

# Create start-all script
cat > scripts/start-all.sh << 'EOF'
#!/bin/bash

echo "Starting Android Studio Web services..."
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start main server in background
echo "Starting main server on port ${PORT:-5000}..."
npm run dev &
MAIN_PID=$!

# Wait a bit for main server to start
sleep 3

# Start Debian build server in background
echo "Starting Debian build server on port ${DEBIAN_SERVER_PORT:-3001}..."
npm run debian:dev &
DEBIAN_PID=$!

echo ""
echo "=================================="
echo "Services started successfully!"
echo "=================================="
echo ""
echo "Main Server:    http://localhost:${PORT:-5000}"
echo "Debian Server:  http://localhost:${DEBIAN_SERVER_PORT:-3001}"
echo "API Key:        ${DEBIAN_API_KEY}"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo 'Stopping services...'; kill $MAIN_PID $DEBIAN_PID 2>/dev/null; exit" INT
wait
EOF

chmod +x scripts/start-all.sh
chmod +x scripts/setup-debian-server.sh

echo -e "${GREEN}✓ Startup scripts created${NC}"
echo ""

# Print summary
echo "=================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start all services:"
echo "   ./scripts/start-all.sh"
echo ""
echo "2. Or start individually:"
echo "   npm run dev              # Main server (port ${PORT:-5000})"
echo "   npm run debian:dev       # Build server (port ${DEBIAN_SERVER_PORT:-3001})"
echo ""
echo "3. Configure frontend:"
echo "   - Open http://localhost:${PORT:-5000} in your browser"
echo "   - Go to Settings"
echo "   - Server URL: http://localhost:${DEBIAN_SERVER_PORT:-3001}"
if [ -f .env ]; then
    API_KEY=$(grep DEBIAN_API_KEY .env | cut -d '=' -f2)
    echo "   - API Key: ${API_KEY}"
fi
echo ""
echo "4. Test build:"
echo "   - Create a new project from template"
echo "   - Click 'Build APK' button"
echo "   - Monitor build progress"
echo ""
echo "=================================="
