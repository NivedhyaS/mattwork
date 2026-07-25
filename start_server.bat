@echo off
echo Starting Mattwork Server and Client...

set NODE_OPTIONS=--max-old-space-size=4096

start "Backend Server" cmd /k "cd server && npm run dev"
start "Frontend Client" cmd /k "cd client && npm run dev"

echo Both processes have been started in new windows!

