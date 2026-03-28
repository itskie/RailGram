# Deploying The Reel Transcoder Lambda

Follow these exact steps to deploy the Python transcode snippet to AWS.

### 1. Preparation (FFmpeg Layer)
AWS Lambda does not include FFmpeg by default. You need a Lambda Layer containing a static binary.
- Use the **Serverless Application Repository** or a public ARN.
- For `ap-south-1` (Mumbai), search for `ffmpeg-lambda-layer` in AWS Serverless Repo or compile a static `ffmpeg` Linux x86_64 binary and zip it up in a `bin/` folder.
- Ensure the binaries `ffmpeg` and `ffprobe` are located at `/opt/bin/ffmpeg` once the layer is attached.

### 2. Create the Lambda Function
- **Runtime**: Python 3.12 
- **Architecture**: x86_64
- **Permissions**: Create a new IAM Role.
- Attach the policy `AmazonS3FullAccess` to that exact role.
- Change the **Memory** inside general configuration from 128MB to **1024 MB**.
- **Crucial**: Edit **Ephemeral storage (/tmp)** and set it to **2048 MB** (to handle 1GB video downloads).
- Edit **Timeout** to **5 minutes** (transcoding chunks takes time).

### 3. Upload Code
- Copy everything inside `backend/scripts/transcoder_lambda.py` and paste it into the inline editor in your Lambda Console (name the file `lambda_function.py`).
- Click "Deploy".

### 4. Setup Environment Variables
Inside **Configuration > Environment variables**:
- Key: `WEBHOOK_URL` | Value: `https://railgram.in/api/v1/reels/webhook/status`
- Key: `WEBHOOK_SECRET` | Value: `super-secret-lambda-webhook-key-change-in-prod` (match your FastAPI `.env`)

### 5. Attach the S3 Trigger
Inside **Configuration > Triggers**:
- Select **S3**.
- Bucket: `railgram-media-prod`
- Event types: `All object create events`
- Prefix: `raw/`
- Suffix: `.mp4`
- Acknowledge recursive invocation warnings and click Add!

### 6. CloudFront Configuration
Your CDN domain `dzdr0nfpn0f2c.cloudfront.net` is already pointed at S3.
As soon as the lambda uploads `processed/{user_id}/{reel_id}/playlist.m3u8`, CloudFront will successfully serve the chunks to the React Native app. No extra configuration needed!
