#!/bin/bash
# Move to the project directory
cd "$(dirname "$0")"

echo "🚀 Starting DevOps Center Server..."

# 1. Start the server (using npm run app:start)
# We use & to run it in the background
npm run app:start > /dev/null 2>&1 &
SERVER_PID=$!

# 2. Wait for the server to be ready
echo "⏳ Waiting for server to initialize..."
while ! curl -s http://localhost:4173 > /dev/null; do
  sleep 0.5
done

# 3. Open the browser
echo "🌐 Opening Dashboard..."
open http://localhost:4173

echo "✅ Dashboard is active."
echo "💡 The server will automatically stop when you close the browser tab (if Auto-shutdown is enabled)."
echo "   Alternatively, you can press Ctrl+C here to stop it manually."

# 4. Wait for the server process to end
wait $SERVER_PID
echo "🛑 Server stopped. Have a nice day!"
