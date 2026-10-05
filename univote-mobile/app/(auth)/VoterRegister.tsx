import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { api } from '@/services/api';
import FaceVerificationModal from '@/components/FaceVerificationModal';

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const labels = ['', 'Weak', 'Fair', 'Strong'];
  const barColors = ['', Colors.error, Colors.warning, Colors.success];

  return (
    <View style={styles.strengthRow}>
      {[1, 2, 3].map((item) => (
        <View key={item} style={[styles.strengthBar, { backgroundColor: item <= score ? barColors[score] : '#e0e0e0' }]} />
      ))}
      <Text style={[styles.strengthLabel, { color: barColors[score] }]}>{labels[score]}</Text>
    </View>
  );
}

export default function VoterRegisterScreen() {
  const { registerStudent, finishRegistration } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [organizations, setOrganizations] = useState<{ id: number; name: string; code: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<number | undefined>();
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsError, setOrganizationsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [faceEnrollmentVisible, setFaceEnrollmentVisible] = useState(false);

  const loadOrganizations = async () => {
    setOrganizationsLoading(true);
    setOrganizationsError('');
    const response = await api.getOrganizations();
    if (response.data) {
      setOrganizations(response.data);
    } else {
      setOrganizationsError('Organizations are unavailable. Please ask an administrator to register one.');
    }
    setOrganizationsLoading(false);
  };

  useEffect(() => {
    loadOrganizations();
  }, []);


  const handleContinue = async () => {
    if (step === 1) {
      if (!email.trim() || !password || !confirmPassword) {
        Alert.alert('Missing Fields', 'Please enter your email and password.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Weak Password', 'Passwords must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match.');
        return;
      }
      setStep(2);
      return;
    }

    if (!fullName.trim() || !age.trim() || !sex || !course.trim() || !yearLevel || !organizationId) {
      Alert.alert('Missing Fields', 'Please complete your profile details.');
      return;
    }

    setLoading(true);
    const result = await registerStudent({
      fullName, email, password, age: Number(age), sex, course, yearLevel, organizationId,
    });
    setLoading(false);

    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    } else {
      setFaceEnrollmentVisible(true);
    }
  };

  const handleFaceEnrollmentSuccess = async () => {
    try {
      await finishRegistration();
      setFaceEnrollmentVisible(false);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Setup Incomplete', 'Your face was captured, but your account could not be opened. Please try again.');
    }
  };

  const handleFaceModalClose = () => {
    Alert.alert(
      'Face Registration Required',
      'Facial registration is mandatory for voting security. You cannot complete registration or proceed to vote without enrolling a clear, full face.',
      [
        { text: 'Complete Enrollment', style: 'default' },
        {
          text: 'Cancel Registration',
          style: 'destructive',
          onPress: () => {
            setFaceEnrollmentVisible(false);
            router.replace('/(auth)/VoterLogin');
          },
        },
      ]
    );
  };

  const pwMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Image source={require('../../assets/univote-logo.jpg')} style={styles.logoImage} />
          <Text style={styles.appName}>Univote</Text>
          <Text style={styles.appTagline}>Create your voting account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{step === 1 ? 'Create Account' : 'Complete Your Profile'}</Text>
          <Text style={styles.stepText}>Step {step} of 2</Text>

          {step === 1 ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Student Email</Text>
                <TextInput style={styles.input} placeholder="student@snsu.edu.ph" placeholderTextColor={Colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
                <Text style={styles.hint}>Must use your @snsu.edu.ph email</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.pwRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Create a password (min. 6 characters)" placeholderTextColor={Colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((value) => !value)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <PasswordStrength password={password} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.pwRow}>
                  <TextInput style={[styles.input, { flex: 1 }, pwMismatch && styles.inputError]} placeholder="Re-enter your password" placeholderTextColor={Colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm((value) => !value)}>
                    <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {pwMismatch && <Text style={styles.errorText}>Passwords do not match</Text>}
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} placeholder="Enter your full name" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Age</Text>
                <TextInput style={styles.input} placeholder="Enter your age" placeholderTextColor={Colors.textMuted} value={age} onChangeText={setAge} keyboardType="number-pad" />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Sex</Text>
                <View style={styles.choiceRow}>{['Male', 'Female', 'Other'].map((option) => <TouchableOpacity key={option} style={[styles.choice, sex === option && styles.choiceSelected]} onPress={() => setSex(option)}><Text style={[styles.choiceText, sex === option && styles.choiceTextSelected]}>{option}</Text></TouchableOpacity>)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Course</Text>
                <TextInput style={styles.input} placeholder="e.g. BS Information Technology" placeholderTextColor={Colors.textMuted} value={course} onChangeText={setCourse} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Year Level</Text>
                <View style={styles.choiceRow}>{['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'].map((option) => <TouchableOpacity key={option} style={[styles.choice, yearLevel === option && styles.choiceSelected]} onPress={() => setYearLevel(option)}><Text style={[styles.choiceText, yearLevel === option && styles.choiceTextSelected]}>{option}</Text></TouchableOpacity>)}</View>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Organization</Text>
                {organizationsLoading ? <ActivityIndicator color={Colors.primary} /> : organizations.length ? <View style={styles.choiceRow}>{organizations.map((organization) => <TouchableOpacity key={organization.id} style={[styles.choice, organizationId === organization.id && styles.choiceSelected]} onPress={() => setOrganizationId(organization.id)}><Text style={[styles.choiceText, organizationId === organization.id && styles.choiceTextSelected]}>{organization.name} ({organization.code})</Text></TouchableOpacity>)}</View> : <View style={styles.organizationEmpty}><Text style={styles.organizationEmptyText}>{organizationsError || 'No organizations have been registered yet.'}</Text><TouchableOpacity onPress={loadOrganizations}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>}
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.primaryBtn, loading && styles.btnDisabled]} onPress={handleContinue} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{step === 1 ? 'Continue' : 'Register'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => step === 1 ? router.back() : setStep(1)}>
            <Text style={styles.linkText}>{step === 1 ? <>Already have an account? <Text style={styles.linkBold}>Login</Text></> : <Text style={styles.linkBold}>Back to account details</Text>}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FaceVerificationModal
        visible={faceEnrollmentVisible}
        action="enroll"
        context="general"
        mandatory={true}
        onClose={handleFaceModalClose}
        onSuccess={handleFaceEnrollmentSuccess}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoImage: { width: 112, height: 112, borderRadius: 12, marginBottom: 12 },
  appName: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  appTagline: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 3 },
  card: { width: '100%', maxWidth: 390, backgroundColor: Colors.white, borderRadius: 24, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 14 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4, textAlign: 'center' },
  stepText: { color: Colors.textMuted, textAlign: 'center', fontSize: 12, marginBottom: 18 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  input: { height: 50, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: Colors.text, backgroundColor: '#fafafa' },
  inputError: { borderColor: Colors.error },
  pwRow: { flexDirection: 'row', alignItems: 'center' },
  eyeBtn: { position: 'absolute', right: 14, height: 50, justifyContent: 'center' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  choiceSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceText: { color: Colors.textSecondary, fontSize: 12 },
  choiceTextSelected: { color: Colors.white, fontWeight: '700' },
  organizationEmpty: { backgroundColor: '#f4f7f4', borderRadius: 8, padding: 12 },
  organizationEmptyText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  retryText: { color: Colors.primary, fontWeight: '700', marginTop: 6 },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4, marginLeft: 2 },
  errorText: { fontSize: 11, color: Colors.error, marginTop: 4, marginLeft: 2 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', width: 42 },
  primaryBtn: { height: 52, backgroundColor: Colors.primaryLight, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  btnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },
  linkRow: { alignItems: 'center', paddingVertical: 14 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  linkBold: { color: Colors.primaryLight, fontWeight: '700' },
});
