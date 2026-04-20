import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [step, setStep] = useState(1); // 1: email, 2: verify code, 3: reset password
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isDark = colorScheme === 'dark';

  // Step 1: Send reset email
  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Reset email sent to:', email);
      Alert.alert('Success', 'Reset code sent to your email');
      setStep(2);
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Code verified:', verificationCode);
      setStep(3);
    } catch (error) {
      Alert.alert('Error', 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Password reset for:', email);
      Alert.alert('Success', 'Your password has been reset. Please login with your new password.');
      router.replace('/login');
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Reset Password</ThemedText>
            <ThemedText style={styles.subtitle}>
              {step === 1 && 'Enter your email address'}
              {step === 2 && 'Enter the verification code'}
              {step === 3 && 'Create your new password'}
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Step 1: Email */}
            {step === 1 && (
              <>
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Email Address</ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: isDark ? '#444' : '#ddd',
                        color: isDark ? '#fff' : '#000',
                        backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                      },
                    ]}
                    placeholder="you@example.com"
                    placeholderTextColor={isDark ? '#888' : '#aaa'}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSendResetEmail}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Verification Code */}
            {step === 2 && (
              <>
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Verification Code</ThemedText>
                  <ThemedText style={styles.helperText}>
                    Enter the 6-digit code sent to {email}
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        borderColor: isDark ? '#444' : '#ddd',
                        color: isDark ? '#fff' : '#000',
                        backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                      },
                    ]}
                    placeholder="000000"
                    placeholderTextColor={isDark ? '#888' : '#aaa'}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="numeric"
                    maxLength={6}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify Code</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <ThemedText style={styles.resendText}>Didn't receive the code? </ThemedText>
                  <TouchableOpacity onPress={handleSendResetEmail} disabled={loading}>
                    <ThemedText style={styles.resendLink}>Resend</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <>
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>New Password</ThemedText>
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={[
                        styles.passwordInput,
                        {
                          borderColor: isDark ? '#444' : '#ddd',
                          color: isDark ? '#fff' : '#000',
                          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                        },
                      ]}
                      placeholder="Enter your new password"
                      placeholderTextColor={isDark ? '#888' : '#aaa'}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      disabled={loading}
                    >
                      <ThemedText style={styles.eyeIcon}>
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Confirm Password</ThemedText>
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={[
                        styles.passwordInput,
                        {
                          borderColor: isDark ? '#444' : '#ddd',
                          color: isDark ? '#fff' : '#000',
                          backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                        },
                      ]}
                      placeholder="Confirm your new password"
                      placeholderTextColor={isDark ? '#888' : '#aaa'}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={loading}
                    >
                      <ThemedText style={styles.eyeIcon}>
                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Bottom Link */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Remember your password? </ThemedText>
            <TouchableOpacity onPress={() => router.replace('/login')} disabled={loading}>
              <ThemedText style={styles.loginLink}>Login</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 120,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 20,
    padding: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  header: {
    marginBottom: Platform.OS === 'ios' ? 30 : 60,
    alignItems: 'center',
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 24 : 40,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: Platform.OS === 'ios' ? 14 : 18,
    opacity: 0.7,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordInputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  eyeIcon: {
    fontSize: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    fontSize: 14,
    opacity: 0.7,
  },
  resendLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
  },
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
