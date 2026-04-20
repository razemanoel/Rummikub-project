import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { api } from '../services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: email, 2: verify code, 3: reset password
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    setErrorMessage('');
    try {
      const response = await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });

      if (response.data?.success) {
        Alert.alert('Success', 'Verification code sent to your email');
        setStep(2);
      } else {
        Alert.alert('Error', response.data?.message || 'Failed to send reset email');
      }
    } catch (error: any) {
      // Handle rate limiting (429)
      if (error.response?.status === 429) {
        const message = error.response?.data?.message || 'Too many attempts. Please try again later.';
        setErrorMessage(message);
        Alert.alert('Too Many Attempts', message);
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to send reset email. Please try again.';
        setErrorMessage(errorMsg);
        Alert.alert('Error', errorMsg);
      }
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
    setErrorMessage('');
    try {
      // Note: Backend just validates the code exists
      // The actual consumption happens during password reset
      const response = await api.post('/auth/verify-code', {
        email: email.trim().toLowerCase(),
        code: verificationCode.trim(),
      });

      if (response.data?.success) {
        setStep(3);
      } else {
        const errorMsg = response.data?.message || 'Invalid verification code';
        setErrorMessage(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        const message = error.response?.data?.message || 'Too many attempts. Please try again later.';
        setErrorMessage(message);
        Alert.alert('Too Many Attempts', message);
      } else {
        const errorMsg = error.response?.data?.message || 'Invalid verification code. Please try again.';
        setErrorMessage(errorMsg);
        Alert.alert('Error', errorMsg);
      }
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
    setErrorMessage('');
    try {
      const response = await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code: verificationCode.trim(),
        newPassword: newPassword.trim(),
        confirmPassword: confirmPassword.trim(),
      });

      if (response.data?.success) {
        Alert.alert('Success', 'Your password has been reset. Please login with your new password.');
        router.replace('/login');
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to reset password';
        setErrorMessage(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        const message = error.response?.data?.message || 'Too many attempts. Please try again later.';
        setErrorMessage(message);
        Alert.alert('Too Many Attempts', message);
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to reset password. Please try again.';
        setErrorMessage(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrorMessage('');
    } else {
      router.back();
    }
  };

  return (
    <LinearGradient
      colors={['#0b1020', '#1b2250', '#0b1020']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <Ionicons name="key" size={22} color="#f59e0b" />
            <Text style={styles.logoText}>rummikub solver</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {step === 1 && 'Enter your email address'}
              {step === 2 && 'Enter the verification code'}
              {step === 3 && 'Create your new password'}
            </Text>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            ) : null}

            {/* Step 1: Email */}
            {step === 1 && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color="#9db4ff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="#9ca3af"
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
                  <LinearGradient
                    colors={['#4f8dfd', '#73a9ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <Text style={styles.buttonText}>SEND RESET CODE</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Verification Code */}
            {step === 2 && (
              <>
                <Text style={styles.helperText}>
                  Enter the 6-digit code sent to {email}
                </Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock" size={20} color="#9db4ff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="000000"
                    placeholderTextColor="#9ca3af"
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
                  <LinearGradient
                    colors={['#4f8dfd', '#73a9ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <Text style={styles.buttonText}>VERIFY CODE</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn't receive the code? </Text>
                  <TouchableOpacity onPress={handleSendResetEmail} disabled={loading}>
                    <Text style={styles.resendLink}>Resend</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="lock" size={20} color="#9db4ff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="New Password"
                    placeholderTextColor="#9ca3af"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color="#9db4ff"
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <MaterialIcons name="lock" size={20} color="#9db4ff" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9ca3af"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color="#9db4ff"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={['#4f8dfd', '#73a9ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <Text style={styles.buttonText}>RESET PASSWORD</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Back/Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {step === 1 ? "Remember your password? " : "Back to login? "}
            </Text>
            <TouchableOpacity
              onPress={step > 1 ? handleBack : () => router.replace('/login')}
              disabled={loading}
            >
              <Text style={styles.footerLink}>{step > 1 ? 'Go Back' : 'Login'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: 'rgba(12, 18, 40, 0.35)',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#d1d5db',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 15, 35, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(130,150,255,0.18)',
    borderRadius: 12,
    marginBottom: 14,
    paddingHorizontal: 12,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 17,
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 8,
    shadowColor: '#4f8dfd',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  resendText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  resendLink: {
    color: '#9db4ff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#d1d5db',
    fontSize: 16,
  },
  footerLink: {
    color: '#9db4ff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
  },
});
