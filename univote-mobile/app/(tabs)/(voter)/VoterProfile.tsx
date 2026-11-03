import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch,
  ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, FacialConfig, Organization, getFullImageUrl } from '@/services/api';
import FaceVerificationModal, { FaceVerificationAction } from '@/components/FaceVerificationModal';

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

const formatJoinDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'verified': return Colors.success;
    case 'enrolled': return Colors.primary;
    case 'disabled': return Colors.warning;
    default: return Colors.textMuted;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'verified': return 'Verified';
    case 'enrolled': return 'Enrolled';
    case 'disabled': return 'Disabled';
    case 'not_enrolled': return 'Not Enrolled';
    default: return 'Unknown';
  }
};

function InfoRow({ icon, label, value, iconBg, iconColor }: {
  icon: string; label: string; value: string; iconBg?: string; iconColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoRowIcon, { backgroundColor: iconBg || Colors.primaryBg }]}>
        <Ionicons name={icon as any} size={16} color={iconColor || Colors.primary} />
      </View>
      <View style={styles.infoRowContent}>
        <Text style={styles.infoRowLabel}>{label}</Text>
        <Text style={styles.infoRowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function VoterProfileScreen() {
  const { user, logout, updateProfile, updateProfilePicture, removeProfilePicture } = useAuth();
  const router = useRouter();

  const [facialConfig, setFacialConfig] = useState<FacialConfig | null>(null);
  const [isRequired, setIsRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalAction, setFaceModalAction] = useState<FaceVerificationAction>('enroll');
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Edit Profile modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const name = user?.name || '—';
  const email = user?.email || '—';
  const course = user?.course || '—';
  const yearLevel = user?.year_level || '—';
  const studentId = user?.student_id || '—';
  const joinedDate = formatJoinDate(user?.created_at);

  // Compute initials from name
  const initials = useMemo(() => {
    return name
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';
  }, [name]);

  const avatarUrl = useMemo(() => {
    return getFullImageUrl(user?.avatar_url || user?.avatar);
  }, [user?.avatar_url, user?.avatar]);

  // Compute real organization name (ensuring NO Org #3 or numeric IDs are displayed)
  const organizationName = useMemo(() => {
    if (user?.organization?.name) {
      return `${user.organization.name}${user.organization.code ? ` (${user.organization.code})` : ''}`;
    }
    if (user?.organization_id && organizations.length > 0) {
      const match = organizations.find((o) => o.id === user.organization_id);
      if (match) return `${match.name} (${match.code})`;
    }
    return user?.organization_id ? 'Assigned College Department' : 'Not assigned';
  }, [user?.organization, user?.organization_id, organizations]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [facialRes, orgsRes] = await Promise.allSettled([
        api.getFacialConfig(),
        api.getOrganizations(),
      ]);

      if (!mountedRef.current) return;

      if (facialRes.status === 'fulfilled' && facialRes.value.data) {
        setFacialConfig(facialRes.value.data.facial_config);
        setIsRequired(facialRes.value.data.is_required);
      }

      if (orgsRes.status === 'fulfilled' && orgsRes.value.data) {
        setOrganizations(orgsRes.value.data);
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleOpenEdit = () => {
    setEditName(user?.name || '');
    setEditError('');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();

    if (!trimmedName) {
      setEditError('Please enter your full name');
      return;
    }

    setEditSaving(true);
    setEditError('');

    const res = await updateProfile({
      name: trimmedName,
    });

    setEditSaving(false);

    if (res.success) {
      setEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your name has been updated successfully.');
    } else {
      setEditError(res.error || 'Failed to update name');
    }
  };

  const handlePickImage = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to take a profile picture.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          await uploadSelectedAvatar(result.assets[0]);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library permission is needed to choose a profile picture.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets[0]) {
          await uploadSelectedAvatar(result.assets[0]);
        }
      }
    } catch (e: any) {
      console.error('Image picker error:', e);
      Alert.alert('Error', 'Unable to pick image. Please try again.');
    }
  };

  const uploadSelectedAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingAvatar(true);
    try {
      const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      const res = await updateProfilePicture(base64Data);
      if (res.success) {
        Alert.alert('Success', 'Profile picture updated successfully!');
      } else {
        Alert.alert('Upload Failed', res.error || 'Failed to update profile picture.');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to update profile picture.');
    } finally {
      if (mountedRef.current) {
        setUploadingAvatar(false);
      }
    }
  };

  const handleRemoveAvatar = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setUploadingAvatar(true);
            try {
              const res = await removeProfilePicture();
              if (res.success) {
                Alert.alert('Success', 'Profile picture removed.');
              } else {
                Alert.alert('Error', res.error || 'Failed to remove profile picture.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to remove profile picture.');
            } finally {
              if (mountedRef.current) {
                setUploadingAvatar(false);
              }
            }
          },
        },
      ]
    );
  };

  const handleAvatarOptions = () => {
    const hasPhoto = Boolean(user?.avatar || user?.avatar_url);

    const buttons: any[] = [
      { text: 'Take Photo', onPress: () => handlePickImage(true) },
      { text: 'Choose from Gallery', onPress: () => handlePickImage(false) },
    ];

    if (hasPhoto) {
      buttons.push({
        text: 'Remove Photo',
        onPress: handleRemoveAvatar,
        style: 'destructive',
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile Picture', 'Add or change your profile picture anytime:', buttons);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/VoterLogin');
  };

  const confirmLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: handleLogout },
    ]);
  };

  const startEnroll = () => {
    if (facialConfig?.is_enrolled) {
      Alert.alert('Registration Complete', 'Facial registration is one-time only and has already been verified for your account.');
      return;
    }
    setFaceModalAction('enroll');
    setFaceModalVisible(true);
  };

  const handleToggleEnabled = async (value: boolean) => {
    if (!facialConfig?.is_enrolled) {
      Alert.alert('Not Enrolled', 'You must enroll your face first.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enroll Now', onPress: startEnroll },
      ]);
      return;
    }
    setToggleLoading(true);
    const res = await api.toggleFacialVerification(value);
    setToggleLoading(false);
    if (res.data) {
      setFacialConfig(res.data.facial_config);
    } else {
      Alert.alert('Error', res.error || 'Could not update setting.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Your Account</Text>
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>
        <TouchableOpacity style={styles.headerEditBtn} onPress={handleOpenEdit} activeOpacity={0.8}>
          <Ionicons name="create-outline" size={16} color={Colors.primary} />
          <Text style={styles.headerEditBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* ── Profile Banner ── */}
      <View style={styles.bannerCard}>
        <TouchableOpacity style={styles.bannerAvatarWrapper} onPress={handleAvatarOptions} activeOpacity={0.85}>
          <View style={styles.bannerAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.bannerAvatarImage} />
            ) : (
              <Text style={styles.bannerAvatarText}>{initials}</Text>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.avatarCameraBadge}>
            <Ionicons name="camera" size={13} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.bannerName}>{name}</Text>
        <Text style={styles.bannerEmail}>{email}</Text>
        <View style={styles.bannerBadgeRow}>
          <View style={styles.bannerBadge}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={styles.bannerBadgeText}>Verified Voter</Text>
          </View>
          {user?.is_profile_completed && (
            <View style={[styles.bannerBadge, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="person-circle" size={12} color={Colors.primary} />
              <Text style={[styles.bannerBadgeText, { color: Colors.primary }]}>Profile Complete</Text>
            </View>
          )}
        </View>
        <View style={styles.bannerButtonRow}>
          <TouchableOpacity style={styles.bannerEditBtn} onPress={handleOpenEdit} activeOpacity={0.85}>
            <Ionicons name="pencil" size={14} color="#fff" />
            <Text style={styles.bannerEditBtnText}>Edit Name</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bannerPhotoBtn} onPress={handleAvatarOptions} activeOpacity={0.85}>
            <Ionicons name="camera-outline" size={14} color={Colors.primary} />
            <Text style={styles.bannerPhotoBtnText}>{avatarUrl ? 'Change Photo' : 'Add Photo'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Quick Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="school-outline" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statValue} numberOfLines={1}>{yearLevel !== '—' ? yearLevel.replace(' Year', '\nYear') : '—'}</Text>
          <Text style={styles.statLabel}>Year Level</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="card-outline" size={20} color={Colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statValue} numberOfLines={1}>{studentId}</Text>
          <Text style={styles.statLabel}>Student ID</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name={user?.is_profile_completed ? "shield-checkmark-outline" : "hourglass-outline"} size={20} color={user?.is_profile_completed ? Colors.success : Colors.primary} style={{ marginBottom: 4 }} />
          <Text style={styles.statValue}>{user?.is_profile_completed ? 'Verified' : 'Pending'}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
      </View>

      {/* ── Student Information ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>STUDENT INFORMATION</Text>
          <TouchableOpacity style={styles.sectionEditLink} onPress={handleOpenEdit}>
            <Ionicons name="pencil" size={13} color={Colors.primary} />
            <Text style={styles.sectionEditText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <InfoRow icon="book-outline" label="Course" value={course} />
        <InfoRow icon="school-outline" label="Year Level" value={yearLevel} iconBg="#EDE7F6" iconColor="#7B1FA2" />
        <InfoRow
          icon="business-outline"
          label="College Department"
          value={organizationName}
          iconBg="#FFF3E0"
          iconColor="#E65100"
        />
      </View>

      {/* ── Account Information ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
        <InfoRow icon="mail-outline" label="Email Address" value={email} />
        <InfoRow icon="calendar-outline" label="Member Since" value={joinedDate} iconBg="#FFF8E1" iconColor="#F57C00" />
        <InfoRow
          icon={user?.is_profile_completed ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          label="Profile Status"
          value={user?.is_profile_completed ? 'Completed' : 'Incomplete'}
          iconBg={user?.is_profile_completed ? '#E8F5E9' : '#FFEBEE'}
          iconColor={user?.is_profile_completed ? Colors.success : Colors.error}
        />
        {user?.google_id && (
          <InfoRow icon="logo-google" label="Login Method" value="Google Account" iconBg="#FCE4EC" iconColor="#E53935" />
        )}
      </View>

      {/* ── Facial Verification ── */}
      <View style={styles.section}>
        <View style={styles.facialHeader}>
          <View style={styles.facialIconWrap}>
            <Ionicons name="scan-outline" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitleInline}>Facial Verification</Text>
            <Text style={styles.facialSubtitle}>Biometric security for voting</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(facialConfig?.status || 'not_enrolled')}20` }]}>
              <Text style={[styles.statusBadgeText, { color: getStatusColor(facialConfig?.status || 'not_enrolled') }]}>
                {getStatusLabel(facialConfig?.status || 'not_enrolled')}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : facialConfig ? (
          <>
            <View style={styles.securityBar}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
              <Text style={styles.securityBarText}>
                {isRequired
                  ? 'Required — Face scan is mandatory for voting.'
                  : 'Optional — Toggle face scan for voting.'}
              </Text>
            </View>

            <View style={styles.configGrid}>
              {[
                { label: 'Enrolled', value: facialConfig.is_enrolled ? 'Yes' : 'No', color: facialConfig.is_enrolled ? Colors.success : Colors.textMuted, icon: facialConfig.is_enrolled ? 'checkmark-done-circle' : 'help-circle-outline' },
                { label: 'Enabled', value: facialConfig.is_enabled ? 'On' : 'Off', color: facialConfig.is_enabled ? Colors.primary : Colors.textMuted, icon: facialConfig.is_enabled ? 'toggle' : 'toggle-outline' },
                { label: 'Verified', value: facialConfig.is_verified ? 'Yes' : 'No', color: facialConfig.is_verified ? Colors.success : Colors.textMuted, icon: facialConfig.is_verified ? 'ribbon-outline' : 'time-outline' },
              ].map((item) => (
                <View key={item.label} style={styles.configCell}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                  <Text style={styles.configLabel}>{item.label}</Text>
                  <Text style={[styles.configValue, { color: item.color }]}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Timeline rows */}
            <View style={styles.detailRows}>
              <InfoRow icon="checkmark-done-circle-outline" label="Last Verified" value={formatDate(facialConfig.last_verified_at)} />
              <InfoRow icon="close-circle-outline" label="Last Failed" value={formatDate(facialConfig.last_failed_at)} iconBg="#FFEBEE" iconColor={Colors.error} />
            </View>

            {/* Toggle switch (when optional) */}
            {!isRequired && facialConfig.is_enrolled && (
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>Enable for Voting</Text>
                  <Text style={styles.toggleHint}>Require face verification before casting ballots.</Text>
                </View>
                {toggleLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Switch
                    value={facialConfig.is_enabled}
                    onValueChange={handleToggleEnabled}
                    trackColor={{ false: '#CFD8DC', true: `${Colors.primary}80` }}
                    thumbColor={facialConfig.is_enabled ? Colors.primary : '#90A4AE'}
                  />
                )}
              </View>
            )}

            {/* One-time enrollment status / action */}
            {!facialConfig.is_enrolled ? (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.primaryAction} onPress={startEnroll}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.primaryActionText}>Enroll Facial Profile (One-Time)</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.enrolledStatusCard}>
                <View style={styles.enrolledStatusIcon}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.enrolledStatusTitle}>Face Profile Registered</Text>
                  <Text style={styles.enrolledStatusDesc}>
                    Facial registration is one-time only and permanently verified for this account.
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.noFacialNotice}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.noFacialText}>
              Enroll your face to enable biometric verification before casting votes.
            </Text>
          </View>
        )}
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.logoutBtnText}>Log Out</Text>
      </TouchableOpacity>

      {/* ── Edit Profile Modal ── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { if (!editSaving) setEditModalVisible(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <Text style={styles.modalSubtitle}>Update your name and personal details</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={editSaving}
              >
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Error Message */}
              {editError ? (
                <View style={styles.modalErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={styles.modalErrorText}>{editError}</Text>
                </View>
              ) : null}

              {/* Full Name (Editable) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="(Dela Cruz, Juan J.)"
                  placeholderTextColor={Colors.textMuted}
                  editable={!editSaving}
                />
                <Text style={styles.inputHelp}>Format: Dela Cruz, Juan J.</Text>
              </View>

              {/* Profile Photo Action */}
              <TouchableOpacity
                style={styles.modalPhotoAction}
                onPress={() => {
                  setEditModalVisible(false);
                  setTimeout(() => handleAvatarOptions(), 300);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={18} color={Colors.primary} />
                <Text style={styles.modalPhotoActionText}>
                  {avatarUrl ? 'Change Profile Picture' : 'Add Profile Picture'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>

              {/* Read-Only Academic Records */}
              <View style={styles.readOnlyCard}>
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyLabel}>Course</Text>
                  <Text style={styles.readOnlyValue}>{course}</Text>
                </View>
                <View style={styles.readOnlyDivider} />
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyLabel}>Year Level</Text>
                  <Text style={styles.readOnlyValue}>{yearLevel}</Text>
                </View>
                <View style={styles.readOnlyDivider} />
                <View style={styles.readOnlyRow}>
                  <Text style={styles.readOnlyLabel}>Department</Text>
                  <Text style={styles.readOnlyValue} numberOfLines={2}>{organizationName}</Text>
                </View>
              </View>

              {/* Locked Notice */}
              <View style={styles.lockedNotice}>
                <Ionicons name="lock-closed" size={16} color="#8899aa" />
                <Text style={styles.lockedNoticeText}>
                  Course, Year Level, and Department are restricted academic records and can only be modified by an administrator.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={editSaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, editSaving && styles.modalSaveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={editSaving}
              >
                {editSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={faceModalVisible}
        onClose={() => setFaceModalVisible(false)}
        action={faceModalAction}
        context="profile"
        onSuccess={() => {
          setFaceModalVisible(false);
          loadData();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerGreeting: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 2 },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  headerEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Banner
  bannerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EFF2F7',
  },
  bannerAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerAvatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  bannerName: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 4 },
  bannerEmail: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  bannerBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  bannerBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  bannerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  bannerEditBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EFF2F7',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '800', color: Colors.text, textAlign: 'center', minHeight: 18 },
  statLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  statDivider: { width: 1, height: 36, backgroundColor: '#EFF2F7' },

  // Sections
  section: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EFF2F7',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8899aa',
    letterSpacing: 0.8,
  },
  sectionEditLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
  },
  sectionEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionTitleInline: { fontSize: 15, fontWeight: '800', color: Colors.text },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA',
  },
  infoRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoRowContent: { flex: 1 },
  infoRowLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  infoRowValue: { fontSize: 14, fontWeight: '700', color: Colors.text, marginTop: 1 },

  // Facial Verification Section
  facialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  facialIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  facialSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

  securityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  securityBarText: { fontSize: 12, color: Colors.primary, fontWeight: '600', flex: 1 },

  configGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  configCell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEF2F6',
  },
  configLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 4 },
  configValue: { fontSize: 13, fontWeight: '800', marginTop: 2 },

  detailRows: { marginBottom: 4 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F3F5F8',
    marginBottom: 12,
  },
  toggleHint: { fontSize: 11, color: '#8899aa', marginTop: 2, lineHeight: 14 },

  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  primaryAction: {
    flex: 1, height: 46, backgroundColor: Colors.primary,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  enrolledStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  enrolledStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enrolledStatusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 2,
  },
  enrolledStatusDesc: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 16,
    fontWeight: '500',
  },

  noFacialNotice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#F0F7FF', borderRadius: 10, padding: 12,
  },
  noFacialText: {
    flex: 1, marginLeft: 8, fontSize: 12, color: '#1565C0',
    lineHeight: 17, fontWeight: '500',
  },

  // Logout
  logoutBtn: {
    backgroundColor: '#EF5350',
    borderRadius: 14, height: 50,
    flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    shadowColor: '#EF5350',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  logoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Edit Profile Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  modalSubtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalErrorText: { fontSize: 13, color: Colors.error, fontWeight: '600', flex: 1 },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  inputHelp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  sexOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sexOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sexOptionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sexOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  sexOptionTextActive: {
    color: '#fff',
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  lockedNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bannerAvatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  bannerAvatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
  bannerButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  bannerPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  bannerPhotoBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalPhotoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  modalPhotoActionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  readOnlyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  readOnlyLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  readOnlyValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
  readOnlyDivider: {
    height: 1,
    backgroundColor: '#EDF2F7',
    marginVertical: 4,
  },
});
