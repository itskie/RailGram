import { useState, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { reelsApi } from '../../../api/client';

interface UploadResult {
  s3_key: string;
}

export function useS3Upload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Need to hold onto the task to allow cancellation
  const uploadTaskRef = useRef<any>(null);

  const uploadFile = async (
    localUri: string,
    filename: string,
    mimeType: string,
    fileSizeBytes: number
  ): Promise<UploadResult> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // 1. Get the pre-signed URl from FastAPI
      const { upload_url, s3_key } = await reelsApi.uploadUrl(
        filename,
        mimeType,
        fileSizeBytes
      );

      // 2. Stream raw file bytes incrementally via expo-file-system
      // This prevents OutOfMemory errors on React Native when uploading ~1GB files
      uploadTaskRef.current = FileSystem.createUploadTask(
        upload_url,
        localUri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType?.BINARY_CONTENT || 1,
          headers: {
            'Content-Type': mimeType,
          },
        },
        ({ totalBytesSent, totalBytesExpectedToSend }) => {
          if (totalBytesExpectedToSend > 0) {
            const pct = Math.round((totalBytesSent / totalBytesExpectedToSend) * 100);
            setProgress(pct);
          }
        }
      );

      const response = await uploadTaskRef.current.uploadAsync();

      if (!response || response.status < 200 || response.status >= 300) {
        throw new Error(`S3 Upload failed: HTTP ${response?.status || 'Unknown'}`);
      }

      setProgress(100);
      return { s3_key };
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      throw err;
    } finally {
      setIsUploading(false);
      uploadTaskRef.current = null;
    }
  };

  const cancelUpload = () => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancelAsync();
    }
  };

  return { uploadFile, cancelUpload, progress, isUploading, error };
}
