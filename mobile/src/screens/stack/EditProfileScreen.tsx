import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import { ArrowLeft, Camera } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

export default function EditProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, setUser, logout } = useAuthStore();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [favouriteTrain, setFavouriteTrain] = useState((user as any)?.favourite_train || '');
  const [homeStation, setHomeStation] = useState((user as any)?.home_station || '');
  const [isPrivate, setIsPrivate] = useState(user?.is_private || false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [uploading, setUploading] = useState(false);

  const updateMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch('/users/me', data);
      return res.data;
    },
    onSuccess: (data) => {
      setUser(data);
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      qc.invalidateQueries({ queryKey: ['user-posts', user?.username] });
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to update profile');
    },
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await api.delete('/auth/delete-account');
    },
    onSuccess: () => {
      logout();
    },
    onError: (e: any) => {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to delete account');
    },
  });

  const handlePickAvatar = async () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (response) => {
      if (response.didCancel || !response.assets?.[0]) return;
      const asset = response.assets[0];
      const uri = asset.uri!;
      const ext = uri.split('.').pop() || 'jpg';
      const mime = asset.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      setUploading(true);
      try {
        const presignRes = await api.post('/media/presign', {
          filename: `avatar.${ext}`,
          content_type: mime,
          purpose: 'avatar',
        });
        const { upload_url, cdn_url } = presignRes.data;

        const formData = new FormData();
        formData.append('file', { uri, type: mime, name: `avatar.${ext}` } as any);
        await fetch(upload_url, { method: 'PUT', body: formData, headers: { 'Content-Type': mime } });

        setAvatarUrl(cdn_url);
      } catch (e: any) {
        Alert.alert('Error', 'Failed to upload avatar');
      } finally {
        setUploading(false);
      }
    });
  };

  const handleSave = () => {
    updateMut.mutate({ display_name: displayName, bio, favourite_train: favouriteTrain, home_station: homeStation, is_private: isPrivate, avatar_url: avatarUrl });
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This will permanently delete your account and all your data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate() },
    ]);
  };

  const avatarSource = avatarUrl
    ? { uri: avatarUrl.startsWith('http') ? avatarUrl : `${CDN}${avatarUrl}` }
    : null;
  const avatarLetter = (user?.username || 'U')[0].toUpperCase();

  return (
    <View style={s.flex}>
      <ScrollView
        contentContainerStyle={[s.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending
              ? <ActivityIndicator color="#FF6B35" size="small" />
              : <Text style={s.saveBtn}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} disabled={uploading} style={s.avatarWrapper}>
            {avatarSource
              ? <Image source={avatarSource} style={s.avatarImg} />
              : <Text style={s.avatarText}>{avatarLetter}</Text>}
            <View style={s.cameraOverlay}>
              {uploading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Camera size={18} color="#fff" strokeWidth={2} />}
            </View>
          </TouchableOpacity>
          <Text style={s.changePhotoText}>Change Photo</Text>
        </View>

        {/* Fields */}
        <View style={s.fields}>
          <Text style={s.fieldLabel}>Display Name</Text>
          <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor="#555" />

          <Text style={s.fieldLabel}>Bio</Text>
          <TextInput style={[s.input, s.textArea]} value={bio} onChangeText={setBio} placeholder="Tell us about yourself" placeholderTextColor="#555" multiline numberOfLines={3} />

          <Text style={s.fieldLabel}>Favourite Train</Text>
          <TextInput style={s.input} value={favouriteTrain} onChangeText={setFavouriteTrain} placeholder="e.g. Rajdhani Express" placeholderTextColor="#555" />

          <Text style={s.fieldLabel}>Home Station</Text>
          <TextInput style={s.input} value={homeStation} onChangeText={setHomeStation} placeholder="e.g. NDLS" placeholderTextColor="#555" autoCapitalize="characters" />

          {/* Private Account Toggle */}
          <View style={s.toggleRow}>
            <View>
              <Text style={s.fieldLabel}>Private Account</Text>
              <Text style={s.toggleSubtext}>Only approved followers can see your posts</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#333', true: '#FF6B35' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Delete Account */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} disabled={deleteMut.isPending}>
          {deleteMut.isPending
            ? <ActivityIndicator color="#ef4444" />
            : <Text style={s.deleteBtnText}>Delete Account</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  saveBtn: { color: '#FF6B35', fontSize: 16, fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', borderWidth: 2.5, borderColor: '#FF6B35',
  },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: 'bold' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, alignItems: 'center',
  },
  changePhotoText: { color: '#FF6B35', fontSize: 13, fontWeight: '600', marginTop: 8 },
  fields: { gap: 4, marginBottom: 32 },
  fieldLabel: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  toggleSubtext: { color: '#555', fontSize: 11, marginTop: 2 },
  deleteBtn: {
    borderWidth: 1, borderColor: '#ef444440', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});
