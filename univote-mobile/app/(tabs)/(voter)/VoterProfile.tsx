import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, FacialConfig } from '@/services/api';
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
    case 'not_enrolled': return 'Not Set Up';
    default: return 'Unknown';
  }
};

export default function VoterProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [facialConfig, setFacialConfig] = useState<FacialConfig | null>(null);
  const [isRequired, setIsRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalAction, setFaceModalAction] = useState<FaceVerificationAction>('enroll');

  const name = user?.name || 'James Lizada';
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const email = user?.email || 'jameslizada@campus.edu.ph';

  const mountedRef = React.useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFacialConfig = useCallback(async () => {
    try {
      const response = await api.getFacialConfig();
      if (!mountedRef.current) return;
      if (response.data) {
        setFacialConfig(response.data.facial_config);
        setIsRequired(response.data.is_required);
      }
    } catch (error) {
      console.error('Failed to load facial config:', error);
    }
  }, []);

  useEffect(() => {
    loadFacialConfig().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [loadFacialConfig]);


  const onRefresh = async () => {
    setRefreshing(true);
    await loadFacialConfig();
    setRefreshing(false);
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
    setFaceModalAction(facialConfig?.is_enrolled ? 'reenroll' : 'enroll');
    setFaceModalVisible(true);
  };

  const startVerify = () => {
    setFaceModalAction('verify');
    setFaceModalVisible(true);
  };

  const handleToggleEnabled = async (value: boolean) => {
    if (!facialConfig?.is_enrolled) {
      Alert.alert(
        'Not Enrolled',
        'You must enroll your face first before you can enable facial verification.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enroll Now', onPress: startEnroll },
        ]
      );
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

  const handleRemove = () => {
    Alert.alert(
      'Remove Facial Profile',
      'This will permanently remove your enrolled face data. You will need to re-enroll to use facial verification again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const res = await api.removeFacialProfile();
            if (res.data) {
              setFacialConfig(res.data.facial_config);
              Alert.alert('Removed', 'Your facial profile has been removed.');
            } else {
              Alert.alert('Error', res.error || 'Could not remove facial profile.');
            }
          },
        },
      ]
    );
  };

  const handleResetAttempts = () => {
    Alert.alert('Reset Attempts', 'Reset your failed face verification attempts?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          const res = await api.resetFacialAttempts();
          if (res.data) {
            setFacialConfig(res.data.facial_config);
            Alert.alert('Reset', 'Attempts have been reset.');
          } else {
            Alert.alert('Error', res.error || 'Could not reset attempts.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          <View style={styles.bellBadge} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>My Profile</Text>
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>Verified</Text>
        </View>
      </View>

      <View style={styles.infoCardsRow}>
        <View style={styles.infoCard}>
          <Ionicons name="school-outline" size={18} color={Colors.primary} style={styles.infoIcon} />
          <Text style={styles.infoValue}>3rd Year</Text>
          <Text style={styles.infoLabel}>Year Level</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="book-outline" size={18} color={Colors.primary} style={styles.infoIcon} />
          <Text style={styles.infoValue}>BSICT</Text>
          <Text style={styles.infoLabel}>Course</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="star-outline" size={18} color={Colors.primary} style={styles.infoIcon} />
          <Text style={styles.infoValue}>Active</Text>
          <Text style={styles.infoLabel}>Status</Text>
        </View>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerInner}>
          <View style={styles.initialsCircle}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerName}>{name}</Text>
            <View style={styles.participantBadge}>
              <Ionicons name="checkmark" size={10} color={Colors.primary} />
              <Text style={styles.participantText}>Election Participant</Text>
            </View>
            <Text style={styles.bannerEmail}>{email}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>2</Text>
          <Text style={styles.statLabel}>Votes Cast</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>100%</Text>
          <Text style={styles.statLabel}>Participation</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>2025</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
      </View>

      {/* ================ FACIAL VERIFICATION CONFIGURATION SECTION ================ */}
      <View style={styles.facialSection}>
        <View style={styles.facialSectionHeader}>
          <View style={styles.facialIconWrap}>
            <Ionicons name="person-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.facialSectionTitle}>Facial Verification</Text>
            <Text style={styles.facialSectionSubtitle}>
              Secure your votes with identity confirmation
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <View style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(facialConfig?.status || 'not_enrolled')}20` },
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { color: getStatusColor(facialConfig?.status || 'not_enrolled') },
              ]}>
                {getStatusLabel(facialConfig?.status || 'not_enrolled')}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={{ padding: 24 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            {facialConfig && (
              <>
                {/* Security Info Bar */}
                <View style={styles.securityInfoBar}>
                  <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                  <Text style={styles.securityInfoText}>
                    {isRequired
                      ? 'Required — Face verification is mandatory for voting.'
                      : 'Optional — You may toggle face verification for voting.'}
                  </Text>
                </View>

                {/* Config Info Grid */}
                <View style={styles.configGrid}>
                  <View style={styles.configCell}>
                    <Ionicons
                      name={facialConfig.is_enrolled ? 'checkmark-done-circle' : 'help-circle-outline'}
                      size={18}
                      color={facialConfig.is_enrolled ? Colors.success : Colors.textMuted}
                    />
                    <Text style={styles.configLabel}>Enrolled</Text>
                    <Text style={[
                      styles.configValue,
                      { color: facialConfig.is_enrolled ? Colors.success : Colors.textMuted },
                    ]}>
                      {facialConfig.is_enrolled ? 'Yes' : 'No'}
                    </Text>
                  </View>
                  <View style={styles.configCell}>
                    <Ionicons
                      name={facialConfig.is_enabled ? 'toggle' : 'toggle-outline'}
                      size={18}
                      color={facialConfig.is_enabled ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={styles.configLabel}>Enabled</Text>
                    <Text style={[
                      styles.configValue,
                      { color: facialConfig.is_enabled ? Colors.primary : Colors.textMuted },
                    ]}>
                      {facialConfig.is_enabled ? 'On' : 'Off'}
                    </Text>
                  </View>
                  <View style={styles.configCell}>
                    <Ionicons name="reload-circle-outline" size={18} color={Colors.warning} />
                    <Text style={styles.configLabel}>Attempts</Text>
                    <Text style={[
                      styles.configValue,
                      { color: facialConfig.verification_attempts >= 4 ? Colors.error : Colors.warning },
                    ]}>
                      {facialConfig.verification_attempts}/5
                    </Text>
                  </View>
                  <View style={styles.configCell}>
                    <Ionicons
                      name={facialConfig.is_verified ? 'ribbon-outline' : 'time-outline'}
                      size={18}
                      color={facialConfig.is_verified ? Colors.success : Colors.primary}
                    />
                    <Text style={styles.configLabel}>Verified</Text>
                    <Text style={[
                      styles.configValue,
                      { color: facialConfig.is_verified ? Colors.success : Colors.textMuted },
                    ]}>
                      {facialConfig.is_verified ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>

                {/* Detail Rows */}
                <View style={styles.detailRows}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailRowIcon}>
                      <Ionicons name="checkmark-done-circle-outline" size={16} color={Colors.primary} />
                    </View>
                    <View style={styles.detailRowContent}>
                      <Text style={styles.detailRowLabel}>Last Verified</Text>
                      <Text style={styles.detailRowValue}>
                        {formatDate(facialConfig.last_verified_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={[styles.detailRowIcon, { backgroundColor: '#FFEBEE' }]}>
                      <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                    </View>
                    <View style={styles.detailRowContent}>
                      <Text style={styles.detailRowLabel}>Last Failed Attempt</Text>
                      <Text style={styles.detailRowValue}>
                        {formatDate(facialConfig.last_failed_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={[styles.detailRowIcon, { backgroundColor: Colors.primaryBg }]}>
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                    </View>
                    <View style={styles.detailRowContent}>
                      <Text style={styles.detailRowLabel}>Last Updated</Text>
                      <Text style={styles.detailRowValue}>
                        {formatDate(facialConfig.updated_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Enable/Disable Toggle Row */}
                  <View style={[styles.detailRow, styles.toggleRow]}>
                    <View style={[styles.detailRowIcon, { backgroundColor: '#EDE7F6' }]}>
                      <Ionicons
                        name={facialConfig.is_enabled ? 'eye-outline' : 'eye-off-outline'}
                        size={16}
                        color={Colors.purple}
                      />
                    </View>
                    <View style={styles.detailRowContent}>
                      <Text style={styles.detailRowLabel}>Require Before Voting</Text>
                      <Text style={styles.detailRowHint}>
                        {facialConfig.is_enabled
                          ? 'Face ID will be required before submitting each vote.'
                          : 'Your account is enrolled but verification is skipped.'}
                      </Text>
                    </View>
                    {toggleLoading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Switch
                        value={facialConfig.is_enabled}
                        onValueChange={handleToggleEnabled}
                        trackColor={{ true: Colors.primary, false: '#ccd5df' }}
                        thumbColor="#fff"
                      />
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  {!facialConfig.is_enrolled ? (
                    <TouchableOpacity style={styles.primaryAction} onPress={startEnroll}>
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text style={styles.primaryActionText}>Enroll Face Now</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.secondaryAction} onPress={startVerify}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
                        <Text style={styles.secondaryActionText}>Test Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.primaryAction} onPress={startEnroll}>
                        <Ionicons name="refresh-outline" size={18} color="#fff" />
                        <Text style={styles.primaryActionText}>Re-Enroll Face</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={styles.secondaryActionRow}>
                  {facialConfig.verification_attempts >= 3 && (
                    <TouchableOpacity style={styles.textBtn} onPress={handleResetAttempts}>
                      <Ionicons name="refresh-circle" size={16} color={Colors.warning} />
                      <Text style={[styles.textBtnText, { color: Colors.warning }]}>Reset Attempts</Text>
                    </TouchableOpacity>
                  )}
                  {facialConfig.is_enrolled && (
                    <TouchableOpacity style={styles.textBtn} onPress={handleRemove}>
                      <Ionicons name="trash-outline" size={16} color={Colors.error} />
                      <Text style={[styles.textBtnText, { color: Colors.error }]}>Remove Face Data</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!facialConfig.is_enrolled && (
                  <View style={styles.setupNotice}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                    <Text style={styles.setupNoticeText}>
                      Enrolling your face will allow you to verify your identity quickly using just
                      your camera before casting votes. Your data is stored securely.
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* Account Information */}
      <View style={styles.accountSection}>
        <Text style={styles.accountTitle}>ACCOUNT INFORMATION</Text>

        <View style={styles.accountItem}>
          <View style={styles.accountIconWrap}>
            <Ionicons name="mail-outline" size={16} color={Colors.primary} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>Email Address</Text>
            <Text style={styles.accountValue}>{email}</Text>
          </View>
        </View>

        <View style={styles.accountItem}>
          <View style={[styles.accountIconWrap, { backgroundColor: '#F3E5F5' }]}>
            <Text style={[styles.accountIconText, { color: '#8E24AA' }]}>ID</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>Student ID</Text>
            <Text style={styles.accountValue}>2024-0042</Text>
          </View>
        </View>

        <View style={styles.accountItem}>
          <View style={[styles.accountIconWrap, { backgroundColor: '#FFF3E0' }]}>
            <Ionicons name="calendar-outline" size={16} color="#F57C00" />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>Member Since</Text>
            <Text style={styles.accountValue}>January 15, 2025</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>

      <FaceVerificationModal
        visible={faceModalVisible}
        onClose={() => setFaceModalVisible(false)}
        action={faceModalAction}
        context="profile"
        onSuccess={(result) => {
          setFacialConfig(result.facial_config);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { paddingBottom: 32 },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  bellBtn: { position: 'relative', padding: 4 },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: Colors.primary,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 10,
  },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#1a2a3a' },
  verifiedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  infoCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoIcon: { marginBottom: 6 },
  infoValue: { fontSize: 14, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  infoLabel: { fontSize: 10, color: '#8899aa', fontWeight: '600' },

  banner: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    overflow: 'visible',
  },
  bannerInner: { flexDirection: 'row', alignItems: 'center' },
  initialsCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  initialsText: { fontSize: 24, fontWeight: '800', color: Colors.primary },
  bannerInfo: { flex: 1 },
  bannerName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  participantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    marginBottom: 6,
  },
  participantText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  bannerEmail: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1a2a3a', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#8899aa', fontWeight: '600' },

  /* =================== FACIAL SECTION STYLES =================== */
  facialSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EAF1EA',
  },
  facialSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  facialIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facialSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a2a3a',
  },
  facialSectionSubtitle: {
    fontSize: 12,
    color: '#8899aa',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  securityInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  securityInfoText: {
    marginLeft: 8,
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },

  configGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  configCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFF2F5',
  },
  configLabel: {
    fontSize: 10,
    color: '#8899aa',
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  configValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },

  detailRows: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  detailRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailRowContent: {
    flex: 1,
  },
  detailRowLabel: {
    fontSize: 11,
    color: '#8899aa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2a3a',
    marginTop: 2,
  },
  detailRowHint: {
    fontSize: 11,
    color: '#8899aa',
    marginTop: 2,
    lineHeight: 14,
  },
  toggleRow: {
    borderBottomWidth: 0,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  primaryAction: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAction: {
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  secondaryActionText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  secondaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 6,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  textBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  setupNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 12,
  },
  setupNoticeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 17,
    fontWeight: '500',
  },

  /* ============================================================ */

  accountSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accountTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#99aabb',
    letterSpacing: 1,
    marginBottom: 12,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  accountIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountIconText: { fontSize: 10, fontWeight: '800' },
  accountInfo: { flex: 1 },
  accountLabel: { fontSize: 12, color: '#99aabb', marginBottom: 2 },
  accountValue: { fontSize: 14, fontWeight: '700', color: '#1a2a3a' },

  logoutBtn: {
    backgroundColor: '#f44336',
    borderRadius: 14,
    paddingVertical: 7,
    alignItems: 'center',
    marginHorizontal: 120,
  },
  logoutBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
