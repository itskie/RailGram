#!/bin/bash
set -e
echo "==== 1. Claiming New Storage Space ===="
sudo growpart /dev/xvda 1 || true
sudo resize2fs /dev/xvda1 || true
sudo growpart /dev/nvme0n1 1 || true
sudo resize2fs /dev/nvme0n1p1 || true
df -h /

echo "==== 2. Pulling Code & Restarting Backend ===="
cd ~/RailGram
git pull origin master
sudo systemctl restart railgram || sudo docker compose -f docker-compose.prod.yml up --build -d

echo "==== 2a. Running DB Migrations ===="
sudo docker exec railgram_backend alembic upgrade head

echo "==== 2b. Flushing Redis Position Cache ===="
sudo docker exec railgram_redis redis-cli FLUSHALL

echo "==== 3. Building Frontend on t3.small ===="
cd frontend
npm install --legacy-peer-deps
npm run build

echo "==== 4. Deploying to Nginx ===="
sudo mkdir -p /var/www/html
sudo rm -rf /var/www/html/*
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
echo "==== ALL DONE! ✅ ===="
