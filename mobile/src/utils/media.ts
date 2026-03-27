/**
 * Media Upload Utility — Camera/Gallery + S3 Upload
 * Handles image/video selection and upload with presigned URLs
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export interface Media {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  mimeType: string;
  size?: number;
}

/**
 * Request camera/gallery permissions
 */
export async function requestMediaPermissions() {
  try {
    if (Platform.OS !== 'web') {
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
      const mediaLibraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraStatus.status !== 'granted' || mediaLibraryStatus.status !== 'granted') {
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to request permissions:', err);
    return false;
  }
}

/**
 * Pick an image from the gallery
 */
export async function pickImage(): Promise<Media | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: 'image',
      fileName: asset.fileName || `image_${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  } catch (err) {
    console.error('Failed to pick image:', err);
    return null;
  }
}

/**
 * Take a photo with the camera
 */
export async function takePhoto(): Promise<Media | null> {
  try {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      type: 'image',
      fileName: asset.fileName || `image_${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    };
  } catch (err) {
    console.error('Failed to take photo:', err);
    return null;
  }
}

/**
 * Get file size in bytes
 */
async function getFileSize(uri: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists && 'size' in fileInfo) {
      return fileInfo.size || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Upload media to S3 using presigned URL
 * 1. Request presigned URL from backend
 * 2. Upload file to S3 with presigned URL
 * 3. Return media_key for storing in DB
 */
export async function uploadMedia(
  media: Media,
  token: string,
  baseUrl = 'https://railgram.in'
): Promise<{ media_key: string; media_url: string } | null> {
  try {
    // Step 1: Get presigned URL from backend
    const fileSize = await getFileSize(media.uri);
    
    const presignedResponse = await fetch(`${baseUrl}/api/v1/media/presign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: media.fileName,
        content_type: media.mimeType,
        purpose: 'post', // or 'story', 'avatar', etc.
      }),
    });

    if (!presignedResponse.ok) {
      throw new Error('Failed to get presigned URL');
    }

    const presignedData = await presignedResponse.json();
    const { upload_url, key, cdn_url } = presignedData;

    // Step 2: Upload file to S3 using presigned URL
    const uploadResponse = await FileSystem.uploadAsync(upload_url, media.uri, {
      headers: {
        'Content-Type': media.mimeType,
      },
      httpMethod: 'PUT',
    });

    if (uploadResponse.status !== 200) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    return { media_key: key, media_url: cdn_url };
  } catch (err) {
    console.error('Failed to upload media:', err);
    return null;
  }
}

/**
 * Upload multiple media files
 */
export async function uploadMediaBatch(
  mediaList: Media[],
  token: string,
  baseUrl = 'https://railgram.in'
): Promise<{ media_key: string; media_url: string }[]> {
  try {
    const results = await Promise.all(
      mediaList.map((media) => uploadMedia(media, token, baseUrl))
    );
    return results.filter((r) => r !== null) as { media_key: string; media_url: string }[];
  } catch (err) {
    console.error('Batch upload failed:', err);
    return [];
  }
}

/**
 * Generate a unique media key for local tracking
 */
export function generateLocalMediaKey(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if file size is within limit (e.g., 50MB)
 */
export function isFileSizeValid(size: number, maxSizeBytes = 50 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSizeBytes;
}
