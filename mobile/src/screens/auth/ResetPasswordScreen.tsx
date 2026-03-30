import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import type { RootStackScreenProps } from '../../navigation/types';
import { authApi } from '../../api/client';
import { Eye, EyeOff } from 'lucide-react-native';

type Props = RootStackScreenProps<'ResetPassword'>;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const initialToken = route.params?.token ?? '';
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!token.trim()) { Alert.alert('Error', 'Token is required'); return; }
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }

    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), newPassword);
      setDone(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Invalid or expired token');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.heading}>Password Reset!</Text>
        <Text style={styles.body}>Your password has been updated successfully. You can now log in with your new password.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.icon}>🔑</Text>
        <Text style={styles.heading}>Set New Password</Text>
        <Text style={styles.body}>Enter the reset token from your email and choose a new password.</Text>

        <TextInput
          style={styles.input}
          placeholder="Reset token"
          placeholderTextColor="#999"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
        />

        <View style={styles.pwWrap}>
          <TextInput
            style={styles.pwInput}
            placeholder="New password (min 8 chars)"
            placeholderTextColor="#999"
            secureTextEntry={!showPw}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
            {showPw ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#999"
          secureTextEntry={!showPw}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 32, justifyContent: 'center', backgroundColor: '#fff', gap: 14 },
  icon: { fontSize: 48, textAlign: 'center' },
  heading: { fontSize: 24, fontWeight: 'bold', color: '#111', textAlign: 'center' },
  body: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 14, fontSize: 16, color: '#111', backgroundColor: '#fafafa',
  },
  pwWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, backgroundColor: '#fafafa',
  },
  pwInput: { flex: 1, padding: 14, fontSize: 16, color: '#111' },
  eyeBtn: { padding: 14 },
  button: { backgroundColor: '#E53935', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
