import { useState, useRef } from 'react';
import { reels } from '../../../lib/api';

interface UploadResult {
  s3_key: string;
}

export function useS3Upload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const uploadFile = async (file: File): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Get the pre-signed URL from our backend
      const { upload_url, s3_key } = await reels.uploadUrl(
        file.name,
        file.type,
        file.size
      );

      // 2. Upload directly to S3 using XMLHttpRequest to track progress natively
      return await new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        // AWS requires exactly POST or PUT depending on how the URL was generated.
        // We generated a PUT url in Python via generate_presigned_url('put_object')
        xhr.open('PUT', upload_url, true);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            setProgress(percentage);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve({ s3_key });
          } else {
            reject(new Error(`S3 Upload failed: ${xhr.status} ${xhr.responseText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error occurred during upload.'));
        };

        xhr.onabort = () => {
          reject(new Error('Upload aborted by user.'));
        };

        xhr.send(file);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown upload error';
      setError(msg);
      throw err;
    } finally {
      setIsUploading(false);
      xhrRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
  };

  return { uploadFile, cancelUpload, progress, isUploading, error };
}
