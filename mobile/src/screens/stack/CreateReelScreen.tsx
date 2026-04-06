import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { X, Clapperboard, ImagePlus, Train, MapPin, CheckCircle, Trash2, Camera } from 'lucide-react-native';
import Video from 'react-native-video';
import { api } from '../../api/client';

type VideoFile = { uri: string; name: string; type: string; size: number };
type ThumbFile = { uri: string; name: string; type: string };
type ThumbSource = 'gallery' | 'frame' | null;

const uploadToS3 = async (presignedUrl: string, fileUri: string, contentType: string) => {
  const blob = await fetch(fileUri).then(r => r.blob());
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
};

export default function CreateReelScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [video, setVideo] = useState<VideoFile | null>(null);
  const [thumbnail, setThumbnail] = useState<ThumbFile | null>(null);
  const [thumbSource, setThumbSource] = useState<ThumbSource>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [seekTime, setSeekTime] = useState(0);
  const [paused, setPaused] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trainNo, setTrainNo] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<any>(null);
  const seekbarWidth = useRef(width - 32);

  const seekPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.min(Math.max(x / seekbarWidth.current, 0), 1);
      const t = ratio * videoDuration;
      setSeekTime(t);
      videoRef.current?.seek(t);
      setPaused(true);
    },
    onPanResponderMove: (e) => {
      const x = e.nativeEvent.locationX;
      const ratio = Math.min(Math.max(x / seekbarWidth.current, 0), 1);
      const t = ratio * videoDuration;
      setSeekTime(t);
      videoRef.current?.seek(t);
    },
  });

  const pickVideo = () => {
    launchImageLibrary({ mediaType: 'video', videoQuality: 'high' }, (res) => {
      if (res.assets?.length) {
        const asset = res.assets[0];
        setVideo({
          uri: asset.uri!,
          name: asset.fileName || 'video.mp4',
          type: asset.type || 'video/mp4',
          size: asset.fileSize || 0,
        });
        setSeekTime(0);
        setVideoDuration(0);
        setThumbnail(null);
        setThumbSource(null);
      }
    });
  };

  const pickThumbnailFromGallery = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.9 }, (res) => {
      if (res.assets?.length) {
        const asset = res.assets[0];
        setThumbnail({ uri: asset.uri!, name: asset.fileName || 'thumb.jpg', type: asset.type || 'image/jpeg' });
        setThumbSource('gallery');
      }
    });
  };

  // Capture current video frame using react-native-view-shot or snapshot
  // On mobile we can't use canvas, so we use video's current snapshot via a seek + screenshot trick.
  // Instead: we use react-native-video's seek and then take a snapshot via a hidden view.
  // Simplest approach: use the video's current seek position as thumbnail_timestamp and
  // let backend/lambda handle it, OR capture via react-native-view-shot if available.
  // We'll use a practical approach: seek the video and use snapshot from video component.
  const captureFrame = () => {
    // Seek to current position — we'll pass seekTime as thumbnail_timestamp to backend
    // For preview we show a placeholder with the timestamp
    setThumbSource('frame');
    // thumbnail uri stays null — we pass thumbnail_timestamp to API instead
    setThumbnail({ uri: '', name: '', type: '' }); // placeholder to show "frame captured" UI
  };

  const removeThumbnail = () => {
    setThumbnail(null);
    setThumbSource(null);
  };

  const handlePublish = async () => {
    if (!video) {
      Alert.alert('No video', 'Please select a video first');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      // 1. Get presigned URL
      const presignRes = await api.post('/reels/upload-url', {
        filename: video.name,
        content_type: video.type,
        file_size_bytes: video.size,
      });
      const { key: s3Key, upload_url: uploadUrl } = presignRes.data;
      setProgress(0.1);

      // 2. Upload video to S3
      await uploadToS3(uploadUrl, video.uri, video.type);
      setProgress(0.75);

      // 3. Upload custom thumbnail if from gallery
      let thumbnailKey: string | undefined;
      if (thumbSource === 'gallery' && thumbnail && thumbnail.uri) {
        const thumbRes = await api.post('/media/presign', {
          filename: thumbnail.name,
          content_type: thumbnail.type,
          purpose: 'post',
        });
        await uploadToS3(thumbRes.data.upload_url, thumbnail.uri, thumbnail.type);
        thumbnailKey = thumbRes.data.key;
        setProgress(0.9);
      }

      // 4. Create reel
      await api.post('/reels', {
        s3_key: s3Key,
        title: title || undefined,
        description: description || undefined,
        train_number: trainNo || undefined,
        station_tag: stationCode || undefined,
        is_public: true,
        ...(thumbnailKey ? { thumbnail_key: thumbnailKey } : {}),
        ...(thumbSource === 'frame' ? { thumbnail_timestamp: Math.round(seekTime) } : {}),
      });

      setProgress(1);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || e.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const videoHeight = (width * 9) / 16;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>New Reel</Text>
          <TouchableOpacity
            style={[s.publishBtn, (uploading || !video) && s.publishBtnDisabled]}
            onPress={handlePublish}
            disabled={uploading || !video}
          >
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.publishBtnText}>Publish</Text>}
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        {uploading && (
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
          </View>
        )}

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Video preview */}
          {video ? (
            <View style={{ width, height: videoHeight, backgroundColor: '#000' }}>
              <Video
                ref={videoRef}
                source={{ uri: video.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                paused={paused}
                muted
                onLoad={(data) => {
                  const dur = data.duration;
                  setVideoDuration(isFinite(dur) ? dur : 0);
                  setPaused(true);
                }}
                onProgress={(data) => setSeekTime(data.currentTime)}
              />

              {/* Tap to play/pause */}
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setPaused(p => !p)}
              />

              {/* Remove video */}
              <TouchableOpacity style={s.removeBtn} onPress={() => { setVideo(null); setThumbnail(null); setThumbSource(null); }}>
                <Trash2 size={16} color="#ff4444" />
              </TouchableOpacity>

              {/* Capture frame button */}
              <TouchableOpacity style={s.captureBtn} onPress={() => { setPaused(true); captureFrame(); }}>
                <Camera size={14} color="#FF6B35" />
                <Text style={s.captureBtnText}>Use as thumbnail</Text>
              </TouchableOpacity>

              {/* Seekbar */}
              {videoDuration > 0 && (
                <View style={s.seekbarContainer}>
                  <View
                    style={s.seekbarTrack}
                    onLayout={(e) => { seekbarWidth.current = e.nativeEvent.layout.width; }}
                    {...seekPanResponder.panHandlers}
                  >
                    <View style={[s.seekbarFill, { width: `${(seekTime / videoDuration) * 100}%` as any }]} />
                    <View style={[s.seekbarThumb, { left: `${(seekTime / videoDuration) * 100}%` as any }]} />
                  </View>
                  <View style={s.seekbarTimes}>
                    <Text style={s.seekTime}>{formatTime(seekTime)}</Text>
                    <Text style={s.seekTime}>{formatTime(videoDuration)}</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity style={[s.videoPicker, { height: 200 }]} onPress={pickVideo}>
              <Clapperboard size={44} color="#333" />
              <Text style={s.videoPickerTitle}>Select Video Reel</Text>
              <Text style={s.videoPickerSub}>MP4 or MOV · up to 500MB</Text>
            </TouchableOpacity>
          )}

          <View style={s.form}>

            {/* Thumbnail section */}
            <Text style={s.sectionLabel}>Thumbnail</Text>
            {thumbnail ? (
              <View style={s.thumbSelected}>
                {thumbSource === 'gallery' && thumbnail.uri ? (
                  <Image source={{ uri: thumbnail.uri }} style={s.thumbPreview} resizeMode="cover" />
                ) : (
                  <View style={[s.thumbPreview, { backgroundColor: '#1a0a00', justifyContent: 'center', alignItems: 'center' }]}>
                    <Camera size={22} color="#FF6B35" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.thumbLabel}>
                    {thumbSource === 'frame' ? `📸 Frame at ${formatTime(seekTime)}` : thumbnail.name}
                  </Text>
                  <Text style={s.thumbSub}>Tap × to remove</Text>
                </View>
                <TouchableOpacity onPress={removeThumbnail} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color="#555" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.thumbOptions}>
                {video && (
                  <TouchableOpacity style={s.thumbOption} onPress={() => { setPaused(true); captureFrame(); }}>
                    <Camera size={20} color="#555" />
                    <Text style={s.thumbOptionText}>From video</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.thumbOption} onPress={pickThumbnailFromGallery}>
                  <ImagePlus size={20} color="#555" />
                  <Text style={s.thumbOptionText}>From gallery</Text>
                </TouchableOpacity>
              </View>
            )}
            {!thumbnail && (
              <Text style={s.thumbAutoText}>Auto-generated if not selected</Text>
            )}

            <View style={s.divider} />

            {/* Title */}
            <TextInput
              style={s.titleInput}
              placeholder="Reel title (e.g. WAP-7 High Speed Action)"
              placeholderTextColor="#444"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />

            <View style={s.divider} />

            {/* Description */}
            <TextInput
              style={s.descInput}
              placeholder="Share details about this run..."
              placeholderTextColor="#444"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={2200}
            />

            <View style={s.divider} />

            {/* Train no */}
            <View style={s.fieldRow}>
              <Train size={16} color="#FF6B35" strokeWidth={1.8} />
              <TextInput
                style={s.fieldInput}
                placeholder="Train number (e.g. 12951)"
                placeholderTextColor="#444"
                value={trainNo}
                onChangeText={setTrainNo}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* Station code */}
            <View style={s.fieldRow}>
              <MapPin size={16} color="#FF6B35" strokeWidth={1.8} />
              <TextInput
                style={s.fieldInput}
                placeholder="Station code (e.g. NDLS)"
                placeholderTextColor="#444"
                value={stationCode}
                onChangeText={(t) => setStationCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
              />
            </View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  publishBtn: { backgroundColor: '#FF6B35', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  publishBtnDisabled: { opacity: 0.4 },
  publishBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  progressTrack: { height: 3, backgroundColor: '#1e1e1e' },
  progressFill: { height: 3, backgroundColor: '#FF6B35' },

  videoPicker: {
    width: '100%', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0e0e0e', gap: 10,
  },
  videoPickerTitle: { color: '#555', fontSize: 15, fontWeight: '700' },
  videoPickerSub: { color: '#333', fontSize: 12 },

  removeBtn: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)',
  },
  captureBtn: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.4)',
  },
  captureBtnText: { color: '#FF6B35', fontSize: 11, fontWeight: '700' },

  seekbarContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 10, paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  seekbarTrack: {
    height: 4, backgroundColor: '#333', borderRadius: 2,
    marginBottom: 6, position: 'relative',
  },
  seekbarFill: { height: 4, backgroundColor: '#FF6B35', borderRadius: 2 },
  seekbarThumb: {
    position: 'absolute', top: -6, width: 16, height: 16,
    borderRadius: 8, backgroundColor: '#FF6B35', marginLeft: -8,
  },
  seekbarTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  seekTime: { color: '#888', fontSize: 10 },

  form: { paddingHorizontal: 16, paddingTop: 16 },

  sectionLabel: {
    color: '#444', fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10,
  },

  thumbSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111', borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: '#FF6B3530', marginBottom: 8,
  },
  thumbPreview: { width: 52, height: 52, borderRadius: 10 },
  thumbLabel: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  thumbSub: { color: '#555', fontSize: 11, marginTop: 2 },

  thumbOptions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  thumbOption: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 6,
    paddingVertical: 14, backgroundColor: '#111', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  thumbOptionText: { color: '#555', fontSize: 11, fontWeight: '700' },
  thumbAutoText: { color: '#333', fontSize: 11, marginBottom: 8 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#1e1e1e', marginVertical: 4 },
  titleInput: { color: '#fff', fontSize: 14, paddingVertical: 14 },
  descInput: {
    color: '#fff', fontSize: 14, paddingVertical: 14,
    minHeight: 80, textAlignVertical: 'top',
  },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  fieldInput: { flex: 1, color: '#fff', fontSize: 14 },
});
