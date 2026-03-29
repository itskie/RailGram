## Qwen Added Memories
- RailGram Workflow: 1) Edit code locally → 2) Update README.md with changes → 3) Git commit & push to GitHub master → 4) SSH into EC2 (ssh -i ~/Downloads/railgram-key.pem ubuntu@13.127.69.178) → 5) Git pull on EC2 → 6) Rebuild frontend if needed (cd frontend && npm install --force && npm run build && sudo cp -r dist/* /var/www/html/) → 7) Test on https://railgram.in
