import json
import os
import subprocess
import urllib.request
import boto3
import urllib.parse
from uuid import UUID

s3 = boto3.client('s3')

# Environment Variables mapping to FastAPI Webhook
WEBHOOK_URL = os.environ.get('WEBHOOK_URL', 'https://railgram.in/api/v1/reels/webhook/status')
WEBHOOK_SECRET = os.environ.get('WEBHOOK_SECRET', 'super-secret-lambda-webhook-key-change-in-prod')

def update_webhook(reel_id: str, status: str, duration_secs: int = None, hls_key: str = None, thumbnail_key: str = None):
    data = {
        "reel_id": reel_id,
        "status": status
    }
    if duration_secs: data["duration_secs"] = duration_secs
    if hls_key: data["hls_key"] = hls_key
    if thumbnail_key: data["thumbnail_key"] = thumbnail_key

    req = urllib.request.Request(
        WEBHOOK_URL,
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'X-Webhook-Secret': WEBHOOK_SECRET
        },
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Webhook update {status} returned {response.status}")
    except Exception as e:
        print(f"Failed to call webhook: {str(e)}")


def lambda_handler(event, context):
    try:
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'])

        print(f"Processing s3://{bucket}/{key}")
        
        # Expected Key structure: raw/{user_id}/{reel_id}/filename.mp4
        parts = key.split('/')
        if len(parts) < 4 or parts[0] != 'raw':
            print("Ignoring non-raw or malformed key.")
            return

        user_id = parts[1]
        reel_id = parts[2]
        filename = parts[3]

        # Ephemeral paths (Max 10 GB limit in Lambda)
        local_raw = f"/tmp/{filename}"
        output_dir = f"/tmp/{reel_id}"
        os.makedirs(output_dir, exist_ok=True)

        print(f"Downloading to {local_raw}")
        s3.download_file(bucket, key, local_raw)

        # 1. Probe for duration
        probe_cmd = [
            "/opt/bin/ffprobe", # Assuming static layer provides it here
            "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", local_raw
        ]
        duration_out = subprocess.check_output(probe_cmd).decode('utf-8').strip()
        duration_secs = int(float(duration_out)) if duration_out else 0

        # 2. Extract Thumbnail
        local_thumb = f"{output_dir}/thumbnail.jpg"
        print("Extracting thumbnail...")
        thumb_cmd = [
            "/opt/bin/ffmpeg", "-y", "-i", local_raw,
            "-ss", "00:00:01", "-vframes", "1",
            "-q:v", "2",
            "-vf", "scale=-2:1280", # 9:16 approx mobile scaling
            local_thumb
        ]
        subprocess.run(thumb_cmd, check=True)

        # 3. Transcode to HLS
        # We ensure it scales to 720p 9:16 mobile ratio. Black bars if native ratio is wack.
        print("Transcoding to HLS...")
        hls_playlist = f"{output_dir}/playlist.m3u8"
        ffmpeg_cmd = [
            "/opt/bin/ffmpeg", "-y", "-i", local_raw,
            "-profile:v", "main", "-crf", "23",
            "-preset", "veryfast", "-g", "48", "-sc_threshold", "0",
            "-c:a", "aac", "-b:a", "128k",
            "-vf", "scale=-2:1280",
            "-hls_time", "4",
            "-hls_playlist_type", "vod",
            "-hls_segment_filename", f"{output_dir}/segment_%03d.ts",
            hls_playlist
        ]
        subprocess.run(ffmpeg_cmd, check=True)

        # 4. Upload Processed artifacts directly to S3 processed/
        print("Uploading to S3...")
        thumb_key = f"processed/{user_id}/{reel_id}/thumbnail.jpg"
        s3.upload_file(local_thumb, bucket, thumb_key, ExtraArgs={'ContentType': 'image/jpeg'})

        # Upload segment chunk files
        for chunk in os.listdir(output_dir):
            if chunk.endswith(".ts"):
                s3.upload_file(
                    f"{output_dir}/{chunk}", 
                    bucket, 
                    f"processed/{user_id}/{reel_id}/{chunk}",
                    ExtraArgs={'ContentType': 'video/MP2T'}
                )
        
        # Upload manifest explicitly last!
        hls_key = f"processed/{user_id}/{reel_id}/playlist.m3u8"
        s3.upload_file(
            hls_playlist, 
            bucket, 
            hls_key,
            ExtraArgs={'ContentType': 'application/x-mpegURL'}
        )
        
        print("Notifying FastAPI Webhook...")
        update_webhook(
            reel_id=reel_id,
            status="READY",
            duration_secs=duration_secs,
            hls_key=hls_key,
            thumbnail_key=thumb_key
        )
        
        return {"statusCode": 200, "body": "Success"}

    except Exception as e:
        print(f"Transcoding failed horribly: {e}")
        # Identify reel_id if possible
        try:
            record = event['Records'][0]
            key = record['s3']['object']['key']
            parts = key.split('/')
            r_id = parts[2]
            update_webhook(reel_id=r_id, status="FAILED")
        except:
             pass
        raise e
