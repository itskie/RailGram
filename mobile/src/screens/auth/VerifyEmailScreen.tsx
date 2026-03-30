import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import type { RootStackScreenProps } from '../../navigation/types';
import { authApi } from '../../api/client';

type Props = RootStackScreenProps<'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const initialToken = route.params?.token ?? '';
  const [token, setToken] = useState(initialToken);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!token.trim()) { Alert.alert('Error', 'Enter your verification token'); return; }
    setLoading(true);
    try {
      await authApi.verifyEmail(token.trim());
      setVerified(true);
    } catch (e: any) {
      Alert.alert('Verification Failed', e.message || 'Invalid or expired token');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Enter your email address'); return; }
    setResendLoading(true);
    try {
      await authApi.resendVerification(email.trim());
      Alert.alert('Sent!', 'A new verification email has been sent to ' + email.trim());
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to resend verification email');
    } finally {
      setResendLoading(false);
    }
  };

  if (verified) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>✅</Text>
        <Text style={styles.heading}>Email Verified!</Text>
        <Text style={styles.body}>Your account is now verified. You can now enjoy all RailGram features.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>Continue to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.heading}>Verify Your Email</Text>
        <Text style={styles.body}>
          Enter the verification token from the email we sent you.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Verification token"
          placeholderTextColor="#999"
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
        />

        <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Email</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Didn't receive it?</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Enter your email to resend"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity style={styles.secondaryButton} onPress={handleResend} disabled={resendLoading}>
          {resendLoading
            ? <ActivityIndicator color="#E53935" />
            : <Text style={styles.secondaryButtonText}>Resend Verification Email</Text>
          }
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
  button: { backgroundColor: '#E53935', borderRadius: 10, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { fontSize: 13, color: '#aaa' },
  secondaryButton: {
    borderWidth: 1, borderColor: '#E53935', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  secondaryButtonText: { color: '#E53935', fontSize: 16, fontWeight: '600' },
});
