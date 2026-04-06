import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) { Alert.alert('Error', 'Enter your email'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <ArrowLeft size={20} color="#aaa" strokeWidth={2} />
          <Text style={s.backText}>Back to Login</Text>
        </TouchableOpacity>

        <Text style={s.logo}>🚂 RailGram</Text>
        <Text style={s.title}>Forgot Password?</Text>

        {!sent ? (
          <>
            <Text style={s.subtitle}>Enter your registered email and we'll send you a reset link.</Text>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              placeholder="you@example.com"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send Reset Link</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <View style={s.sentBox}>
            <Text style={s.sentIcon}>📬</Text>
            <Text style={s.subtitle}>
              If an account with <Text style={{ color: '#fff', fontWeight: '700' }}>{email}</Text> exists, a reset link has been sent. Check your inbox!
            </Text>
            <Text style={[s.subtitle, { fontSize: 12 }]}>The link expires in 1 hour.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flexGrow: 1, paddingHorizontal: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 32 },
  backText: { color: '#aaa', fontSize: 14 },
  logo: { fontSize: 28, fontWeight: '700', color: '#FF6B35', textAlign: 'center', marginBottom: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#9ca3af', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  label: { color: '#d1d5db', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, color: '#fff', fontSize: 15, marginBottom: 16,
  },
  btn: {
    backgroundColor: '#FF6B35', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sentBox: { alignItems: 'center', marginTop: 24 },
  sentIcon: { fontSize: 48, marginBottom: 16 },
});
