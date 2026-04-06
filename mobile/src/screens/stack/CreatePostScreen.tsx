import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Image, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, FlatList, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { X, ImagePlus, Train, MapPin, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { api } from '../../api/client';
import { uploadMedia } from '../../utils/upload';

type MediaFile = { uri: string; name: string; type: string };

export default function CreatePostScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [caption, setCaption] = useState('');
  const [trainNo, setTrainNo] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [locoClass, setLocoClass] = useState('');
  const [locoNumber, setLocoNumber] = useState('');
  const [locoShed, setLocoShed] = useState('');
  const [locoZone, setLocoZone] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const pickImages = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.9, selectionLimit: 10 - files.length }, (res) => {
      if (res.assets?.length) {
        const newFiles = res.assets.map(a => ({
          uri: a.uri!,
          name: a.fileName || 'photo.jpg',
          type: a.type || 'image/jpeg',
        }));
        if (files.length + newFiles.length > 10) {
          setUploadError('Maximum 10 photos allowed.');
          return;
        }
        setUploadError('');
        setFiles(prev => [...prev, ...newFiles]);
        if (files.length === 0) setCurrentIdx(0);
      }
    });
  };

  const removeFile = (idx: number) => {
    const newFiles = files.filter((_, i) => i !== idx);
    setFiles(newFiles);
    if (currentIdx >= newFiles.length) setCurrentIdx(Math.max(0, newFiles.length - 1));
  };

  const handleShare = async () => {
    if (files.length === 0) {
      Alert.alert('No photos', 'Please add at least one photo');
      return;
    }
    setLoading(true);
    try {
      const mediaKeys: string[] = [];
      for (const f of files) {
        const key = await uploadMedia(f.uri, f.name, f.type, 'post');
        mediaKeys.push(key);
      }
      await api.post('/posts', {
        caption: caption || null,
        media_keys: mediaKeys,
        train_no: trainNo || null,
        station_code: stationCode || null,
        loco_class: locoClass || null,
        loco_number: locoNumber || null,
        loco_shed: locoShed || null,
        loco_zone: locoZone || null,
        post_type: 'photo',
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to post');
    } finally {
      setLoading(false);
    }
  };

  const previewWidth = width;
  const previewHeight = previewWidth;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>New Post</Text>
          <TouchableOpacity
            style={[s.shareBtn, (loading || files.length === 0) && s.shareBtnDisabled]}
            onPress={handleShare}
            disabled={loading || files.length === 0}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.shareBtnText}>Share</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Photo preview */}
          {files.length > 0 ? (
            <View style={{ width: previewWidth, height: previewHeight }}>
              <Image
                source={{ uri: files[currentIdx].uri }}
                style={{ width: previewWidth, height: previewHeight }}
                resizeMode="cover"
              />

              {/* Remove current */}
              <TouchableOpacity style={s.removeBtn} onPress={() => removeFile(currentIdx)}>
                <Trash2 size={16} color="#ff4444" />
              </TouchableOpacity>

              {/* Prev */}
              {currentIdx > 0 && (
                <TouchableOpacity style={[s.navBtn, s.navBtnLeft]} onPress={() => setCurrentIdx(i => i - 1)}>
                  <ChevronLeft size={20} color="#fff" />
                </TouchableOpacity>
              )}

              {/* Next */}
              {currentIdx < files.length - 1 && (
                <TouchableOpacity style={[s.navBtn, s.navBtnRight]} onPress={() => setCurrentIdx(i => i + 1)}>
                  <ChevronRight size={20} color="#fff" />
                </TouchableOpacity>
              )}

              {/* Counter */}
              <View style={s.counter}>
                <Text style={s.counterText}>{currentIdx + 1} / {files.length}</Text>
              </View>

              {/* Add more */}
              {files.length < 10 && (
                <TouchableOpacity style={s.addMoreBtn} onPress={pickImages}>
                  <Plus size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={[s.imagePicker, { height: previewHeight * 0.6 }]} onPress={pickImages}>
              <ImagePlus size={44} color="#333" />
              <Text style={s.imagePickerTitle}>Select Rail Photos</Text>
              <Text style={s.imagePickerSub}>Up to 10 photos</Text>
            </TouchableOpacity>
          )}

          {uploadError ? <Text style={s.errorText}>{uploadError}</Text> : null}

          {/* Dot indicators */}
          {files.length > 1 && (
            <View style={s.dots}>
              {files.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => setCurrentIdx(i)}>
                  <View style={[s.dot, i === currentIdx && s.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.form}>
            {/* Caption */}
            <TextInput
              style={s.captionInput}
              placeholder="Caption your journey..."
              placeholderTextColor="#444"
              value={caption}
              onChangeText={setCaption}
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

            <View style={s.divider} />

            {/* Loco specs */}
            <Text style={s.sectionLabel}>Locomotive Specs (Optional)</Text>
            <View style={s.locoGrid}>
              <View style={[s.locoField, { marginRight: 6 }]}>
                <TextInput
                  style={s.locoInput}
                  placeholder="CLASS"
                  placeholderTextColor="#444"
                  value={locoClass}
                  onChangeText={(t) => setLocoClass(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
              <View style={s.locoField}>
                <TextInput
                  style={s.locoInput}
                  placeholder="ROAD NO"
                  placeholderTextColor="#444"
                  value={locoNumber}
                  onChangeText={setLocoNumber}
                />
              </View>
            </View>
            <View style={[s.locoGrid, { marginTop: 8 }]}>
              <View style={[s.locoField, { marginRight: 6 }]}>
                <TextInput
                  style={s.locoInput}
                  placeholder="SHED"
                  placeholderTextColor="#444"
                  value={locoShed}
                  onChangeText={(t) => setLocoShed(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
              <View style={s.locoField}>
                <TextInput
                  style={s.locoInput}
                  placeholder="ZONE"
                  placeholderTextColor="#444"
                  value={locoZone}
                  onChangeText={(t) => setLocoZone(t.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
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
  shareBtn: { backgroundColor: '#FF6B35', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  shareBtnDisabled: { opacity: 0.4 },
  shareBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  imagePicker: {
    width: '100%', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#0e0e0e', gap: 12,
  },
  imagePickerTitle: { color: '#555', fontSize: 15, fontWeight: '700' },
  imagePickerSub: { color: '#333', fontSize: 12 },

  removeBtn: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 8,
    borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)',
  },
  navBtn: {
    position: 'absolute', top: '50%', marginTop: -20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  navBtnLeft: { left: 12 },
  navBtnRight: { right: 12 },
  counter: {
    position: 'absolute', bottom: 12, left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  addMoreBtn: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: '#FF6B35', borderRadius: 20, padding: 10,
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333' },
  dotActive: { backgroundColor: '#FF6B35', width: 18 },

  errorText: { color: '#ff4444', fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },

  form: { paddingHorizontal: 16, paddingTop: 4 },
  captionInput: {
    color: '#fff', fontSize: 14, paddingVertical: 16,
    minHeight: 80, textAlignVertical: 'top',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#1e1e1e', marginVertical: 4 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  fieldInput: { flex: 1, color: '#fff', fontSize: 14 },

  sectionLabel: {
    color: '#444', fontSize: 10, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 1.5,
    marginTop: 16, marginBottom: 10,
  },
  locoGrid: { flexDirection: 'row' },
  locoField: {
    flex: 1, backgroundColor: '#111', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  locoInput: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
