import { api } from '../api/client';

export async function uploadMedia(
  fileUri: string,
  fileName: string,
  contentType: string,
  purpose: 'post' | 'story' | 'avatar' = 'post',
): Promise<string> {
  // 1. Get presigned URL
  const presignRes = await api.post('/media/presign', {
    filename: fileName,
    content_type: contentType,
    purpose,
  });
  const { upload_url, key } = presignRes.data;

  // 2. PUT file directly to S3/R2
  const fileData = await fetch(fileUri);
  const blob = await fileData.blob();

  await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  return key;
}
