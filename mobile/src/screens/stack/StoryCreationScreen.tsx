import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import * as MediaUtils from '../../utils/media';
import type { RootStackScreenProps } from '../../navigation/types';

type Props = RootStackScreenProps<'StoryCreation'>;

export function StoryCreationScreen({ navigation }: Props) {
  const { token } = useAuthStore();
  const [selectedMedia, setSelectedMedia] = useState<MediaUtils.Media | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleTakePhoto = async () => {
    try {
      const hasPermission = await MediaUtils.requestMediaPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Camera and gallery permissions are required');
        return;
      }

      const media = await MediaUtils.takePhoto();
      if (media) {
        setSelectedMedia(media);
      }
    } catch (err) {
      console.error('Failed to take photo:', err);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handlePickPhoto = async () => {
    try {
      const hasPermission = await MediaUtils.requestMediaPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Camera and gallery permissions are required');
        return;
      }

      const media = await MediaUtils.pickImage();
      if (media) {
        setSelectedMedia(media);
      }
    } catch (err) {
      console.error('Failed to pick photo:', err);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  const handlePublishStory = async () => {
    if (!selectedMedia || !token) return;

    setUploading(true);
    try {
      // Upload media to S3
      const uploadResult = await MediaUtils.uploadMedia(selectedMedia, token);
      if (!uploadResult) {
        Alert.alert('Upload Failed', 'Failed to upload story image');
        setUploading(false);
        return;
      }

      const { media_key, media_url } = uploadResult;

      // Create story on backend
      const response = await fetch('https://railgram.in/api/v1/stories', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_key,
          caption: '', // Optional: add text overlay UI later
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create story');
      }

      Alert.alert('Success', 'Story published!');
      setSelectedMedia(null);
      
      // Go back to previous screen
      navigation.goBack();
    } catch (err) {
      console.error('Failed to publish story:', err);
      Alert.alert('Error', 'Failed to publish story');
    } finally {
      setUploading(false);
    }
  };

  if (selectedMedia) {
    // Preview screen
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedMedia(null)} disabled={uploading}>
            <Text style={styles.headerButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Story Preview</Text>
          <View style={styles.placeholder} />
        </View>

        <Image source={{ uri: selectedMedia.uri }} style={styles.preview} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => setSelectedMedia(null)}
            disabled={uploading}
          >
            <Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.publishButton, uploading && styles.actionButtonDisabled]}
            onPress={handlePublishStory}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionText}>Publish Story</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Selection screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Share a moment</Text>
        <Text style={styles.subtitle}>Choose how you'd like to create your story</Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
            <View style={styles.optionIcon}>
              <Text style={styles.optionEmoji}>📷</Text>
            </View>
            <Text style={styles.optionTitle}>Take a Photo</Text>
            <Text style={styles.optionSubtitle}>Use your camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handlePickPhoto}>
            <View style={styles.optionIcon}>
              <Text style={styles.optionEmoji}>🖼️</Text>
            </View>
            <Text style={styles.optionTitle}>Pick from Gallery</Text>
            <Text style={styles.optionSubtitle}>Choose existing photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.infoText}>
          ℹ️ Stories disappear after 24 hours
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40, // Spacer for centering
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
    width: '100%',
  },
  option: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  optionIcon: {
    marginBottom: 12,
  },
  optionEmoji: {
    fontSize: 48,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  preview: {
    flex: 1,
    width: '100%',
    resizeMode: 'cover',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  publishButton: {
    backgroundColor: '#E53935',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#000',
  },
  info: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F0F7FF',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});
