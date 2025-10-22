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
