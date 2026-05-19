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
import { useAuth } from '@/context/AuthContext';

export default function SignUpScreen() {
  const router = useRouter();
  const { signup, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loading = isLoading || localLoading;

  const validateEmail = (email: string): string | null => {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return 'Email is required';
  }

  if (trimmedEmail.includes(' ')) {
    return 'Email must not contain spaces';
  }

  if (trimmedEmail.length > 254) {
    return 'Email is too long';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!emailRegex.test(trimmedEmail)) {
    return 'Please enter a valid email address';
  }

  return null;
};

const validatePasswordForSignUp = (password: string): string | null => {
    if (!password) {
      return 'Password is required';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (/\s/.test(password)) {
      return 'Password must not contain spaces';
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`~;]/.test(password)) {
      return 'Password must contain at least one special character';
    }

    return null;
  };

  const handleSignUp = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setErrorMessage(emailError);
      Alert.alert('Invalid Email', emailError);
      return;
    }

    const passwordError = validatePasswordForSignUp(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      Alert.alert('Invalid Password', passwordError);
      return;
    }

    if (!confirmPassword) {
      const msg = 'Confirm password is required';
      setErrorMessage(msg);
      Alert.alert('Missing Field', msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      setErrorMessage(msg);
      Alert.alert('Password Mismatch', msg);
      return;
    }

    setLocalLoading(true);
    try {
      await signup(email.trim(), password, confirmPassword);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      router.replace('/(main)/(tabs)');
    } catch (error: any) {
      const errorMsg = error.message || 'Sign up failed. Please try again.';
      setErrorMessage(errorMsg);
      
      if (errorMsg.toLowerCase().includes('already')) {
        Alert.alert('Email Exists', 'This email is already registered. Please try logging in.');
      } else {
        Alert.alert('Sign Up Error', errorMsg);
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
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
            <Ionicons name="person-add" size={22} color="#f59e0b" />
            <Text style={styles.logoText}>rummikub solver</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Create Account</Text>

            <View style={styles.requirementsBox}>
              <View style={styles.requirementsHeader}>
                <Ionicons name="shield-checkmark" size={18} color="#f59e0b" />
                <Text style={styles.requirementsTitle}>Password requirements</Text>
              </View>

              {[
                'At least 8 characters',
                'One uppercase letter',
                'One lowercase letter',
                'One number',
                'One special character',
              ].map((item) => (
                <View key={item} style={styles.requirementRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#73a9ff" />
                  <Text style={styles.requirementText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            ) : null}

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={20} color="#9db4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#9db4ff" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
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

            {/* Confirm Password Input */}
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

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
              onPress={handleSignUp}
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
                  <Text style={styles.signUpButtonText}>CREATE ACCOUNT</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleBackToLogin} disabled={loading}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
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
  signUpButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 4,
    shadowColor: '#4f8dfd',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#d1d5db',
    fontSize: 16,
  },
  loginLink: {
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
  requirementsBox: {
    backgroundColor: 'rgba(79, 141, 253, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(79, 141, 253, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    marginBottom: 18,
  },

  requirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  requirementsTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  requirementText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
});
