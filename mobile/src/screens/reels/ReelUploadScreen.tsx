import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { UploadCloud, X, Check, FileVideo } from 'lucide-react-native';
import { useS3Upload } from '../../features/reels/hooks/useS3Upload';
import { reelsApi } from '../../api/client';
import { draftUtils } from '../../features/reels/utils/drafts';
import { useNavigation } from '@react-navigation/native';

export default function ReelUploadScreen() {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trainNumber, setTrainNumber] = useState('');
  const [stationTag, setStationTag] = useState('');
  
  const { uploadFile, progress, isUploading } = useS3Upload();
  const navigation = useNavigation();

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true, // Let iOS/Android natively trim
      quality: 1, // Max quality
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 1024 * 1024 * 1024) {
        Alert.alert('Too Large', 'Maximum file size is 1GB.');
        return;
      }
      setVideoUri(asset.uri);
      setFileSize(asset.fileSize || 0);
    }
  };

  const clearSelection = () => {
    setVideoUri(null);
    setFileSize(0);
  };

  const saveAsDraft = async () => {
    if (!videoUri || !title) {
       Alert.alert('Missing Info', 'Please select a video and add a title before saving a draft.');
       return;
    }
    await draftUtils.saveDraft({
       localFileUri: videoUri,
       title,
       description,
       trainNumber,
       stationTag,
    });
    Alert.alert('Draft Saved', 'You can finish this upload later.');
    navigation.goBack();
  };

  const submitPost = async () => {
    if (!videoUri || !title) {
       Alert.alert('Missing Info', 'A video and title are mandatory.');
       return;
    }
    
    try {
       // Extract extension from URI
       const match = videoUri.match(/\.([a-zA-Z0-9]+)$/);
       let ext = match ? match[1] : 'mp4';
       if (ext === 'quicktime') ext = 'mov'; // iOS default
       const mimeType = `video/${ext}`;

       // 1. Upload via expo-file-system stream chunking
       const { s3_key } = await uploadFile(
           videoUri,
           `upload_${Date.now()}.${ext}`,
           mimeType,
           fileSize
       );

       // 2. Create in backend DB
       await reelsApi.create({
         s3_key,
         title,
         description,
         train_number: trainNumber || undefined,
         station_tag: stationTag || undefined,
         file_size_bytes: fileSize,
         is_public: true,
       });

       Alert.alert('Success', 'Reel is successfully processing! It will appear on your profile shortly.');
       navigation.goBack();
    } catch (err: any) {
       Alert.alert('Upload Failed', err.message);
       // We can automatically trigger draft save if network fails here as a fallback!
    }
  };

  return (
    <View style={styles.container}>
      {/* File Picker */}
      <View style={styles.pickerContainer}>
        {!videoUri ? (
          <TouchableOpacity style={styles.pickButton} onPress={pickVideo}>
             <UploadCloud color="#f97316" size={48} />
             <Text style={styles.pickTitle}>Select a Video</Text>
             <Text style={styles.pickSubtitle}>MP4, MOV up to 1GB</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.selectedContainer}>
             <View style={styles.selectedIcon}>
                <FileVideo color="#3f3f46" size={64} />
             </View>
             <TouchableOpacity style={styles.clearBtn} onPress={clearSelection}>
               <X color="white" size={20} />
             </TouchableOpacity>

             {/* Progress Overlay */}
             {isUploading && (
               <View style={styles.progressOverlay}>
                  <Text style={styles.progressText}>{progress}%</Text>
                  <View style={styles.progressBarBg}>
                     <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
               </View>
             )}
          </View>
        )}
      </View>

      {/* Form Fields */}
      <View style={styles.formContainer}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Amazing crossing..."
          placeholderTextColor="#71717a"
          value={title}
          onChangeText={setTitle}
          editable={!isUploading}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          placeholder="More details..."
          placeholderTextColor="#71717a"
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isUploading}
        />

        <View style={styles.row}>
           <View style={{ flex: 1 }}>
             <Text style={styles.label}>Train No.</Text>
             <TextInput
               style={styles.input}
               placeholder="12424"
               placeholderTextColor="#71717a"
               value={trainNumber}
               onChangeText={setTrainNumber}
               keyboardType="number-pad"
               editable={!isUploading}
             />
           </View>
           <View style={{ width: 16 }} />
           <View style={{ flex: 1 }}>
             <Text style={styles.label}>Station Code</Text>
             <TextInput
               style={styles.input}
               placeholder="NDLS"
               placeholderTextColor="#71717a"
               value={stationTag}
               onChangeText={setStationTag}
               autoCapitalize="characters"
               editable={!isUploading}
             />
           </View>
        </View>
      </View>

      {/* Bottom Buttons */}
      <View style={styles.buttonRow}>
         <TouchableOpacity 
            style={styles.draftBtn} 
            onPress={saveAsDraft}
            disabled={isUploading}
         >
            <Text style={styles.draftText}>Save Draft</Text>
         </TouchableOpacity>

         <TouchableOpacity 
            style={[styles.submitBtn, (!videoUri || !title || isUploading) && styles.disabledBtn]} 
            onPress={submitPost}
            disabled={!videoUri || !title || isUploading}
         >
            {isUploading ? (
               <>
                 <ActivityIndicator color="white" size="small" />
                 <Text style={styles.submitText}>Uploading...</Text>
               </>
            ) : (
               <>
                 <Check color="white" size={20} />
                 <Text style={styles.submitText}>Post Reel</Text>
               </>
            )}
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b', padding: 16 },
  pickerContainer: { height: 250, marginBottom: 24 },
  pickButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickTitle: { color: 'white', fontSize: 18, fontWeight: '600', marginTop: 12 },
  pickSubtitle: { color: '#a1a1aa', fontSize: 14, marginTop: 4 },
  selectedContainer: { flex: 1, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' },
  selectedIcon: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  clearBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  progressOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  progressText: { color: 'white', fontSize: 32, fontWeight: 'bold', marginBottom: 16 },
  progressBarBg: { width: '60%', height: 6, backgroundColor: '#3f3f46', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#f97316' }, // orange-500
  formContainer: { flex: 1 },
  label: { color: '#a1a1aa', fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: { backgroundColor: '#27272a', borderRadius: 12, padding: 16, color: 'white', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#3f3f46' },
  row: { flexDirection: 'row' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  draftBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#27272a', alignItems: 'center' },
  draftText: { color: 'white', fontSize: 16, fontWeight: '600' },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 16, borderRadius: 12, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' },
  disabledBtn: { backgroundColor: '#7c2d12', opacity: 0.5 },
  submitText: { color: 'white', fontSize: 16, fontWeight: '600' }
});
