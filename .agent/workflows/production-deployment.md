---
description: the strict protocol for deploying RailGram exclusively on AWS EC2
---
# RailGram EC2 Remote Deployment Workflow

**Golden Rule:** The local laptop is just an editor. NEVER depend on the local filesystem or local processing power to build, compile, or migrate production data. 

To deploy future phases, strictly follow this EC2-only flow:

1. **Git Push:** Push the latest code modifications to the `master` branch on GitHub.
2. **Remote SSH:** Connect to the EC2 server: `ssh ubuntu@13.127.69.178`.
3. **Remote Sync:** Pull the code ON THE SERVER: `cd ~/RailGram && git pull origin master`
4. **Remote Backend Rebuild:** Run `docker compose -f docker-compose.prod.yml up --build -d` directly on the server.
5. **Remote DB Migration:** Generate and apply schemas inside the remote container exclusively: `docker exec railgram_backend alembic upgrade head`.
6. **Remote Frontend Compile:** Build the Vite frontend using the EC2 CPU and Memory (now t3.small/medium): `cd ~/RailGram/frontend && npm install && npm run build && sudo cp -r dist/* /var/www/html/`

This ensures 100% hardware independence. The developer can switch laptops, travel, or format their disk without ever breaking the production pipeline.
