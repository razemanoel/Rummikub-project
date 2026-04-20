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
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { login, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isDark = colorScheme === 'dark';

  const handleLogin = async () => {
    // Reset error message
    setErrorMessage('');

    // Validate inputs
    if (!email.trim()) {
      const msg = 'Email is required';
      setErrorMessage(msg);
      Alert.alert('Missing Field', msg);
      return;
    }

    if (!password.trim()) {
      const msg = 'Password is required';
      setErrorMessage(msg);
      Alert.alert('Missing Field', msg);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const msg = 'Please enter a valid email address';
      setErrorMessage(msg);
      Alert.alert('Invalid Email', msg);
      return;
    }

    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      setErrorMessage(msg);
      Alert.alert('Invalid Password', msg);
      return;
    }

    setLocalLoading(true);
    try {
      await login(email, password);
      // Reset form
      setEmail('');
      setPassword('');
      // Navigate to home/tabs screen
      router.replace('/(tabs)');
    } catch (error: any) {
      const errorMsg = error.message || 'Login failed. Please try again.';
      setErrorMessage(errorMsg);
      
      // Show specific error messages
      if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('does not exist')) {
        Alert.alert('User Not Found', 'No account found with this email address. Please sign up first.');
      } else if (errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('incorrect')) {
        Alert.alert('Invalid Credentials', 'Email or password is incorrect. Please try again.');
      } else {
        Alert.alert('Login Error', errorMsg);
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/signup');
  };

  const handleForgotPassword = () => {
    router.push('/forgotpassword');
  };

  const loading = isLoading || localLoading;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText style={styles.title}>Rummikub</ThemedText>
            <ThemedText style={styles.subtitle}>Welcome Back</ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Error Message */}
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? '#5a2a2a' : '#ffe6e6' }]}>
                <ThemedText style={[styles.errorText, { color: isDark ? '#ff9999' : '#cc0000' }]}>
                  ⚠️ {errorMessage}
                </ThemedText>
              </View>
            ) : null}
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Email</ThemedText>
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

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <View style={styles.passwordHeader}>
                <ThemedText style={styles.label}>Password</ThemedText>
              </View>
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
                  placeholder="Enter your password"
                  placeholderTextColor={isDark ? '#888' : '#aaa'}
                  value={password}
                  onChangeText={setPassword}
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

            {/* Forgot Password */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
            >
              <ThemedText style={styles.forgotPassword}>
                Forgot Password?
              </ThemedText>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Don't have an account? </ThemedText>
            <TouchableOpacity onPress={handleSignUp} disabled={loading}>
              <ThemedText style={styles.signUpLink}>Sign Up</ThemedText>
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  forgotPassword: {
    fontSize: 14,
    color: '#007AFF',
    textAlign: 'right',
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    opacity: 0.7,
  },
  signUpLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  errorBox: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#cc0000',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

