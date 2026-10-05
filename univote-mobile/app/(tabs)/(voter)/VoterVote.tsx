import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { api, Election, FacialConfig } from '@/services/api';
import FaceVerificationModal, { FaceVerificationAction } from '@/components/FaceVerificationModal';

type Step = 'list' | 'vote' | 'success';

export default function VoterVoteScreen() {
  const [step, setStep] = useState<Step>('list');
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [votedElections, setVotedElections] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [facialConfig, setFacialConfig] = useState<FacialConfig | null>(null);
  const [facialRequired, setFacialRequired] = useState(true);
  const [facialSessionToken, setFacialSessionToken] = useState<string | null>(null);

  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalAction, setFaceModalAction] = useState<FaceVerificationAction>('enroll');

  const mountedRef = React.useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const electionsResp = await api.getElections('active');
      if (!mountedRef.current) return;
      if (electionsResp.data && Array.isArray(electionsResp.data)) {
        setElections(electionsResp.data);
        const voted = new Set<number>();
        await Promise.all(
          electionsResp.data.map(async (e) => {
            const check = await api.checkVote(e.id);
            if (check.data?.has_voted) voted.add(e.id);
          })
        );
        if (!mountedRef.current) return;
        setVotedElections(voted);
      }

      const facialResp = await api.getFacialConfig();
      if (!mountedRef.current) return;
      if (facialResp.data && !facialResp.error) {
        setFacialConfig(facialResp.data.facial_config);
        setFacialRequired(facialResp.data.is_required);
      }
    } catch (error) {
      console.error('Error loading elections:', error);
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

  const handleSelectElection = (election: Election) => {
    if (votedElections.has(election.id)) {
      Alert.alert('Already Voted', `You have already voted in "${election.title}".`);
      return;
    }
    setSelectedElection(election);
    setSelections({});
    setFacialSessionToken(null);
    setStep('vote');
  };

  const handleSelectCandidate = (position: string, candidateId: number) => {
    setSelections((prev) => ({ ...prev, [position]: candidateId }));
  };

  const needsFacialEnrollment = () => {
    if (!facialRequired) return false;
    if (!facialConfig) return true;
    return !facialConfig.is_enrolled;
  };

  const openFacialVerify = () => {
    if (needsFacialEnrollment()) {
      setFaceModalAction('enroll');
    } else {
      setFaceModalAction('verify');
    }
    setFaceModalVisible(true);
  };

  const handleFaceSuccess = (result: { session_token?: string; facial_config: FacialConfig }) => {
    setFacialConfig(result.facial_config);
    if (result.session_token) {
      setFacialSessionToken(result.session_token);
    } else if (facialRequired) {
      if (result.facial_config.is_enabled) {
        setFaceModalAction('verify');
        setTimeout(() => setFaceModalVisible(true), 100);
      }
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedElection) return;

    const positions = selectedElection.candidates
      ? [...new Set(selectedElection.candidates.map((c) => c.position || 'Candidate'))]
      : [];

    const missing = positions.filter((p) => !selections[p]);
    if (missing.length > 0) {
      Alert.alert('Incomplete', `Please select a candidate for: ${missing.join(', ')}`);
      return;
    }

    // Security enforcement: Facial verification is mandatory before casting any vote
    if (!facialConfig || !facialConfig.is_enrolled) {
      Alert.alert(
        'Face Enrollment Required',
        'You must enroll your face first before you can cast a vote. This protects the election from unauthorized voting.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enroll Now',
            onPress: () => {
              setFaceModalAction('enroll');
              setFaceModalVisible(true);
            },
          },
        ]
      );
      return;
    }

    if (!facialSessionToken) {
      Alert.alert(
        'Facial Verification Required',
        'To ensure election integrity, you must scan your face to confirm it matches the registered voter before casting your vote.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Scan & Verify',
            onPress: () => {
              setFaceModalAction('verify');
              setFaceModalVisible(true);
            },
          },
        ]
      );
      return;
    }

    const validCheck = await api.validateFacialSession(facialSessionToken);
    if (!validCheck.data?.valid) {
      Alert.alert(
        'Session Expired',
        'Your facial verification session has expired. Please scan and verify your face again before voting.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify Now',
            onPress: () => {
              setFacialSessionToken(null);
              setFaceModalAction('verify');
              setFaceModalVisible(true);
            },
          },
        ]
      );
      return;
    }

    const candidateIds = Object.values(selections);
    setSubmitting(true);
    const result = await api.castVotes(selectedElection.id, candidateIds, facialSessionToken || undefined);
    setSubmitting(false);

    if (result.error) {
      const err = result.error;
      const errLower = String(err).toLowerCase();
      if (errLower.includes('facial') && (errLower.includes('required') || errLower.includes('session'))) {
        setFacialSessionToken(null);
        Alert.alert(
          'Facial Verification Required',
          'Please complete facial verification before casting your vote.',
          [{ text: 'Verify Now', onPress: () => {
            setFaceModalAction(facialConfig?.is_enrolled ? 'verify' : 'enroll');
            setFaceModalVisible(true);
          }}]
        );
        return;
      }
      Alert.alert('Vote Failed', typeof err === 'string' ? err : JSON.stringify(err));
    } else {
      setVotedElections((prev) => new Set(prev).add(selectedElection.id));
      setFacialSessionToken(null);
      setStep('success');
    }
  };

  const handleBack = () => {
    setStep('list');
    setSelectedElection(null);
    setSelections({});
    setFacialSessionToken(null);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
      </View>
    );
  }

  if (step === 'success') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Text style={styles.successTitle}>Vote Submitted!</Text>
        <Text style={styles.successDesc}>
          Your vote for &quot;{selectedElection?.title}&quot; has been recorded successfully.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleBack}>
          <Text style={styles.primaryBtnText}>Back to Elections</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'vote' && selectedElection) {
    const candidates = selectedElection.candidates || [];
    const positions = [...new Set(candidates.map((c) => c.position || 'Candidate'))];
    const grouped = positions.map((pos) => ({
      position: pos,
      candidates: candidates.filter((c) => (c.position || 'Candidate') === pos),
    }));
    const allSelected = positions.every((p) => selections[p]);
    const facialReady = !facialRequired || !facialConfig?.is_enabled || !!facialSessionToken || !facialConfig?.is_enrolled;
    const canSubmit = allSelected && submitting === false;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cast Your Vote</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{selectedElection.title}</Text>
            <Text style={styles.bannerSubtitle}>Select one candidate per position</Text>
          </View>

          {facialRequired && facialConfig && (
            <View style={[
              styles.securityCard,
              facialSessionToken ? styles.securityVerified : styles.securityPending,
            ]}>
              <Ionicons
                name={facialSessionToken ? 'shield-checkmark' : 'shield-half-outline'}
                size={20}
                color={facialSessionToken ? Colors.success : Colors.primary}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[
                  styles.securityTitle,
                  { color: facialSessionToken ? Colors.success : Colors.primary },
                ]}>
                  {facialSessionToken ? 'Identity Verified' :
                    !facialConfig.is_enrolled ? 'Facial Enrollment Required' :
                    !facialConfig.is_enabled ? 'Facial Verification Disabled' :
                    'Facial Verification Pending'}
                </Text>
                <Text style={styles.securityDesc}>
                  {facialSessionToken
                    ? 'Your identity has been confirmed. You may submit your vote.'
                    : !facialConfig.is_enrolled
                      ? 'Tap below to enroll your face. This is required before voting.'
                      : !facialConfig.is_enabled
                        ? 'Facial verification is currently disabled for your account.'
                        : 'You must complete face verification before you can submit.'}
                </Text>
              </View>
              {!facialSessionToken && (facialConfig.is_enrolled ? facialConfig.is_enabled : true) && (
                <TouchableOpacity
                  style={styles.securityAction}
                  onPress={openFacialVerify}
                >
                  <Text style={styles.securityActionText}>
                    {facialConfig.is_enrolled ? 'Verify' : 'Enroll'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {grouped.map((group) => (
            <View key={group.position} style={styles.positionSection}>
              <Text style={styles.positionTitle}>{group.position}</Text>
              {group.candidates.map((c) => {
                const isSelected = selections[group.position] === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.candidateCard, isSelected && styles.candidateCardActive]}
                    onPress={() => handleSelectCandidate(group.position, c.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.radio}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>{c.name}</Text>
                      {c.description ? (
                        <Text style={styles.candidateDesc}>{c.description}</Text>
                      ) : null}
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!canSubmit) && styles.btnDisabled,
            ]}
            onPress={handleSubmitVote}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {facialRequired && facialConfig?.is_enabled && !facialSessionToken && facialConfig?.is_enrolled && (
                  <Ionicons name="shield-outline" size={16} color="rgba(255,255,255,0.8)" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.primaryBtnText}>
                  {!allSelected ? 'Complete Selections' :
                   facialRequired && facialConfig?.is_enabled && facialConfig?.is_enrolled && !facialSessionToken
                     ? 'Verify Face & Submit'
                     : 'Submit Vote'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

        <FaceVerificationModal
          visible={faceModalVisible}
          onClose={() => setFaceModalVisible(false)}
          action={faceModalAction}
          context="voting"
          onSuccess={handleFaceSuccess}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vote Now</Text>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Cast Your Vote</Text>
        <Text style={styles.bannerSubtitle}>Select an election to cast your vote</Text>
      </View>

      {elections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No active elections at the moment</Text>
        </View>
      ) : (
        elections.map((e) => {
          const hasVoted = votedElections.has(e.id);
          return (
            <TouchableOpacity
              key={e.id}
              style={[styles.card, hasVoted && styles.cardVoted]}
              onPress={() => handleSelectElection(e)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <Ionicons name="business-outline" size={20} color={Colors.primary} />
                </View>
                <View style={[styles.badge, hasVoted ? styles.badgeVoted : styles.badgeActive]}>
                  <View style={[styles.dot, hasVoted ? styles.dotVoted : styles.dotActive]} />
                  <Text style={[styles.badgeText, hasVoted && styles.badgeTextVoted]}>
                    {hasVoted ? 'Voted' : 'Active'}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{e.title}</Text>
              <Text style={styles.cardDesc}>{e.description || 'No description available'}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={12} color="#8899aa" />
                  <Text style={styles.metaText}>{e.candidates?.length || 0} Candidates</Text>
                </View>
                {facialRequired && (
                  <View style={styles.metaItem}>
                    <Ionicons name="shield-outline" size={12} color={Colors.primary} />
                    <Text style={[styles.metaText, { color: Colors.primary }]}>Face ID Secured</Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.voteBtn}>
                <Text style={styles.voteBtnText}>
                  {hasVoted ? 'View Election' : 'Vote Now'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" style={styles.voteBtnIcon} />
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    paddingBottom: 32,
  },

  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },

  banner: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },

  securityCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  securityPending: {
    backgroundColor: Colors.primaryBg,
    borderColor: Colors.primary,
  },
  securityVerified: {
    backgroundColor: '#E8F5E9',
    borderColor: Colors.success,
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 11,
    color: '#556677',
    lineHeight: 14,
  },
  securityAction: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    marginLeft: 10,
  },
  securityActionText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a2a3a',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#667788',
    lineHeight: 18,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#8899aa',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F5',
    marginBottom: 14,
  },
  voteBtn: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  voteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  voteBtnIcon: {
    marginTop: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8899aa',
    textAlign: 'center',
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1a2a3a', marginBottom: 8 },
  successDesc: { fontSize: 14, color: '#667788', textAlign: 'center', marginBottom: 28 },
  backBtn: { padding: 4 },
  positionSection: { marginHorizontal: 20, marginBottom: 20 },
  positionTitle: { fontSize: 16, fontWeight: '700', color: '#1a2a3a', marginBottom: 10 },
  candidateCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: '#E8EDF2',
  },
  candidateCardActive: { borderColor: Colors.primary, backgroundColor: '#F0F7F0' },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#ccd5df', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  candidateInfo: { flex: 1 },
  candidateName: { fontSize: 15, fontWeight: '700', color: '#1a2a3a' },
  candidateDesc: { fontSize: 12, color: '#8899aa', marginTop: 2 },
  primaryBtn: {
    height: 52, backgroundColor: Colors.primary,
    borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 20, marginTop: 8, marginBottom: 24,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardVoted: { opacity: 0.85 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeActive: { backgroundColor: '#E8F5E9' },
  badgeVoted: { backgroundColor: '#E3F2FD' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: Colors.primary },
  dotVoted: { backgroundColor: '#1976D2' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextVoted: { color: '#1976D2' },
});
