import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { usersApi, mediaApi, authApi } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { RootStackScreenProps } from '../../navigation/types';
import { Camera, Save, Lock, LogOut } from 'lucide-react-native';

type Props = RootStackScreenProps<'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const qc = useQueryClient();
  const { user: me, setUser } = useAuthStore();

  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [favouriteTrain, setFavouriteTrain] = useState(me?.favourite_train ?? '');
  const [homeStation, setHomeStation] = useState(me?.home_station ?? '');
  const [avatarUrl, setAvatarUrl] = useState(me?.avatar_url ?? '');
  const [isPrivate, setIsPrivate] = useState(me?.is_private ?? false);
  const [isUploading, setIsUploading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      qc.invalidateQueries({ queryKey: ['profile', me?.username] });
      navigation.goBack();
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update profile');
    },
  });

  const { logout } = useAuthStore();

  const deleteAccountMutation = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      logout();
      Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to delete account');
    },
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This will permanently delete all your posts, reels, and data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Warning',
              'All your data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: () => {
                    deleteAccountMutation.mutate();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to change avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setIsUploading(true);
    try {
      const filename = asset.uri.split('/').pop() ?? 'avatar.jpg';
      const contentType = asset.mimeType ?? 'image/jpeg';

      const { upload_url, cdn_url } = await mediaApi.presign({
        filename,
        content_type: contentType,
        purpose: 'avatar',
      });

      const blob = await fetch(asset.uri).then((r) => r.blob());
      await fetch(upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });

      setAvatarUrl(cdn_url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!displayName.trim()) {
      Alert.alert('Validation', 'Display name is required');
      return;
    }
    updateMutation.mutate({
      display_name: displayName.trim(),
      bio: bio.trim(),
      favourite_train: favouriteTrain.trim(),
      home_station: homeStation.trim(),
      avatar_url: avatarUrl || undefined,
      is_private: isPrivate,
    });
  };

  if (!me) return null;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={isUploading}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(displayName[0] ?? me.username[0]).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={16} color="#fff" />
              )}
            </View>
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>
      </View>

      {/* Fields */}
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell fellow railfans about yourself..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.halfField]}>
            <Text style={styles.label}>Favourite Train 🚂</Text>
            <TextInput
              style={styles.input}
              value={favouriteTrain}
              onChangeText={setFavouriteTrain}
              placeholder="e.g. Rajdhani"
              placeholderTextColor="#999"
            />
          </View>
          <View style={[styles.field, styles.halfField]}>
            <Text style={styles.label}>Home Station 🚉</Text>
            <TextInput
              style={styles.input}
              value={homeStation}
              onChangeText={setHomeStation}
              placeholder="e.g. NDLS"
              placeholderTextColor="#999"
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Private Account Toggle */}
        <View style={styles.privateToggle}>
          <View style={styles.privateToggleLeft}>
            <View style={styles.lockIconWrap}>
              <Lock size={20} color="#666" />
            </View>
            <View>
              <Text style={styles.privateToggleLabel}>Private Account</Text>
              <Text style={styles.privateToggleSub}>Only followers can see your posts</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggleSwitch, isPrivate && styles.toggleSwitchActive]}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <View style={[styles.toggleKnob, isPrivate && styles.toggleKnobActive]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, (updateMutation.isPending || isUploading) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={updateMutation.isPending || isUploading}
      >
        {updateMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Save size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Delete Account button */}
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDeleteAccount}
      >
        <LogOut size={18} color="#ef4444" />
        <Text style={styles.deleteBtnText}>Delete Account</Text>
      </TouchableOpacity>
      <Text style={styles.deleteBtnHint}>Permanently delete all your data</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: { marginTop: 8, fontSize: 12, color: '#999' },
  form: { padding: 16, gap: 16 },
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#111', backgroundColor: '#fafafa',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  privateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
  },
  privateToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  lockIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateToggleLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  privateToggleSub: { fontSize: 11, color: '#888', marginTop: 2 },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 3,
  },
  toggleSwitchActive: { backgroundColor: '#E53935' },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobActive: { transform: [{ translateX: 22 }] },
  saveBtn: {
    margin: 16, backgroundColor: '#E53935', borderRadius: 14,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  saveBtnDisabled: { backgroundColor: '#ccc' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: {
    margin: 16, marginTop: 0, marginBottom: 8,
    backgroundColor: 'transparent', borderRadius: 14,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#ef4444',
  },
  deleteBtnText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  deleteBtnHint: { textAlign: 'center', color: '#999', fontSize: 11, marginBottom: 16 },
});
