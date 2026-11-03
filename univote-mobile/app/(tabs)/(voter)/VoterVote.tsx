import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { api, Election, FacialConfig, getFullImageUrl } from '@/services/api';
import FaceVerificationModal, { FaceVerificationAction } from '@/components/FaceVerificationModal';
import { useRouter } from 'expo-router';

type Step = 'list' | 'vote' | 'success';

// Aesthetic avatar background and text colors
const AVATAR_BG_COLORS = ['#E8F5E9', '#E3F2FD', '#F3E5F5', '#FFF3E0', '#E0F2F1', '#FBE9E7'];
const AVATAR_TEXT_COLORS = ['#2E7D32', '#1565C0', '#7B1FA2', '#E65100', '#00695C', '#D84315'];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return { bg: AVATAR_BG_COLORS[idx], text: AVATAR_TEXT_COLORS[idx] };
}

function getInitials(name: string): string {
  if (!name) return 'C';
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Candidate avatar — shows the uploaded photo when available, otherwise
// falls back to a colored circle with the candidate's initials.
function CandidateAvatar({ name, photo }: { name: string; photo?: string | null }) {
  const [photoError, setPhotoError] = useState(false);
  const avatar = getAvatarColors(name);
  const initials = getInitials(name);
  const photoUri = getFullImageUrl(photo);

  return (
    <View style={[styles.candidateAvatarCircle, { backgroundColor: avatar.bg }]}>
      {photoUri && !photoError ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.candidateAvatarImg}
          onError={() => setPhotoError(true)}
        />
      ) : (
        <Text style={[styles.candidateAvatarInitials, { color: avatar.text }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

export default function VoterVoteScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('list');
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [pendingElection, setPendingElection] = useState<Election | null>(null);
  const [selections, setSelections] = useState<Record<string, number[]>>({});
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
      // Direct navigation to their ballot receipt instead of a dead-end alert
      router.push('/(tabs)/(voter)/VoterVotes');
      return;
    }

    setPendingElection(election);

    // Requirement: Voter must scan face first before seeing candidate list
    if (facialRequired) {
      if (needsFacialEnrollment()) {
        Alert.alert(
          'Face Scan Required',
          'To ensure election security, you must enroll and scan your face first before you can view the ballot candidates.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPendingElection(null) },
            {
              text: 'Scan Face Now',
              onPress: () => {
                setFaceModalAction('enroll');
                setFaceModalVisible(true);
              },
            },
          ]
        );
      } else {
        setFaceModalAction('verify');
        setFaceModalVisible(true);
      }
      return;
    }

    setSelectedElection(election);
    setSelections({});
    setFacialSessionToken(null);
    setStep('vote');
  };

  const handleSelectCandidate = (position: string, candidateId: number, maxVotes: number) => {
    setSelections((prev) => {
      const selected = prev[position] || [];
      if (selected.includes(candidateId)) {
        const updated = selected.filter((id) => id !== candidateId);
        const next = { ...prev };
        if (updated.length > 0) {
          next[position] = updated;
        } else {
          delete next[position];
        }
        return next;
      }

      if (selected.length >= maxVotes) {
        return prev;
      }

      return { ...prev, [position]: [...selected, candidateId] };
    });
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
      // Face scan verified! Unlock candidates list and show ballot
      if (pendingElection) {
        setSelectedElection(pendingElection);
        setSelections({});
        setStep('vote');
      }
    } else if (facialRequired) {
      if (result.facial_config.is_enabled) {
        setFaceModalAction('verify');
        setTimeout(() => setFaceModalVisible(true), 150);
      }
    }
  };

  const handleCloseFaceModal = () => {
    setFaceModalVisible(false);
    if (!selectedElection) {
      setPendingElection(null);
    }
  };

  const handleSubmitVote = async () => {
    if (!selectedElection) return;

    const positions = selectedElection.candidates
      ? Array.from(new Set(selectedElection.candidates.map((c) => c.position || 'Candidate')))
      : [];

    const missing = positions.filter((p) => !selections[p]?.length);
    if (missing.length > 0) {
      Alert.alert('Incomplete Ballot', `Please select a candidate for: ${missing.join(', ')}`);
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

    const candidateIds = ballotGroups.flatMap((group) => selections[group.position] || []);
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
          [{
            text: 'Verify Now', onPress: () => {
              setFaceModalAction(facialConfig?.is_enrolled ? 'verify' : 'enroll');
              setFaceModalVisible(true);
            }
          }]
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
    setPendingElection(null);
    setSelections({});
    setFacialSessionToken(null);
  };

  // Grouped positions for active ballot
  const candidates = selectedElection?.candidates || [];
  const positions = Array.from(new Set(candidates.map((c) => c.position || 'Candidate')));
  const ballotGroups = positions.map((position) => ({
    position,
    candidates: candidates.filter((candidate) => (candidate.position || 'Candidate') === position),
    maxVotes: Math.max(
      1,
      Number(candidates.find((candidate) => (candidate.position || 'Candidate') === position)?.max_votes) || 1
    ),
  }));

  const selectedCount = useMemo(() => {
    return Object.values(selections).filter((selected) => selected.length > 0).length;
  }, [selections]);

  const totalPositions = useMemo(() => {
    return ballotGroups.length;
  }, [ballotGroups]);

  const allSelected = totalPositions > 0 && ballotGroups.every(
    (group) => (selections[group.position]?.length || 0) > 0
  );
  const progressRatio = totalPositions > 0 ? selectedCount / totalPositions : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingTitle}>Loading active elections...</Text>
          <Text style={styles.loadingSubtitle}>Connecting to secure ballot database</Text>
        </View>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────
  // STEP 3: VOTE SUCCESS CONFIRMATION
  // ──────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={styles.successScreen}>
        <View style={styles.successCard}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Ballot Successfully Cast!</Text>
          <Text style={styles.successElectionName}>
            {selectedElection?.title}
          </Text>
          <Text style={styles.successDesc}>
            Your selections have been securely encrypted and officially registered on the UniVote election ledger.
          </Text>

          {/* Verification Badge */}
          <View style={styles.successReceiptBadge}>
            <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
            <Text style={styles.successReceiptBadgeText}>Official Vote Receipt Generated</Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={styles.viewReceiptBtn}
            onPress={() => router.push('/(tabs)/(voter)/VoterVotes')}
            activeOpacity={0.85}
          >
            <Ionicons name="receipt-outline" size={18} color="#fff" />
            <Text style={styles.viewReceiptBtnText}>View My Ballot Receipt</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToElectionsBtn}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Text style={styles.backToElectionsBtnText}>Back to Elections List</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────
  // STEP 2: ACTIVE BALLOT VOTING SCREEN
  // ──────────────────────────────────────────────────────────
  if (step === 'vote' && selectedElection) {
    const canSubmit = allSelected && !submitting;

    return (
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.ballotHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.ballotHeaderCenter}>
            <Text style={styles.ballotHeaderTitle}>Official Ballot</Text>
            <Text style={styles.ballotHeaderSubtitle}>
              {selectedCount} of {totalPositions} position{totalPositions !== 1 ? 's' : ''} selected
            </Text>
          </View>
          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>{Math.round(progressRatio * 100)}%</Text>
          </View>
        </View>

        {/* Live Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.ballotContent} showsVerticalScrollIndicator={false}>
          {/* Election Info Card */}
          <View style={styles.electionOverviewCard}>
            <View style={styles.electionBadgeRow}>
              <View style={styles.officialPill}>
                <Ionicons name="shield-checkmark" size={12} color="#065F46" />
                <Text style={styles.officialPillText}>Campus Election</Text>
              </View>
              <View style={styles.activePill}>
                <View style={styles.greenPulseDot} />
                <Text style={styles.activePillText}>Voting Open</Text>
              </View>
            </View>
            <Text style={styles.electionOverviewTitle}>{selectedElection.title}</Text>
            <Text style={styles.electionOverviewDesc}>
              {selectedElection.description || 'Select at least one candidate for each position, up to its limit.'}
            </Text>
          </View>

          {/* Facial Security Status Banner */}
          {facialRequired && facialConfig && (
            <View
              style={[
                styles.securityCard,
                facialSessionToken ? styles.securityVerified : styles.securityPending,
              ]}
            >
              <View
                style={[
                  styles.securityIconWrap,
                  { backgroundColor: facialSessionToken ? '#DCFCE7' : '#FEF3C7' },
                ]}
              >
                <Ionicons
                  name={facialSessionToken ? 'shield-checkmark' : 'shield-half-outline'}
                  size={20}
                  color={facialSessionToken ? '#16A34A' : '#D97706'}
                />
              </View>
              <View style={styles.securityTextCol}>
                <Text
                  style={[
                    styles.securityTitle,
                    { color: facialSessionToken ? '#065F46' : '#92400E' },
                  ]}
                >
                  {facialSessionToken
                    ? 'Biometric Identity Verified'
                    : !facialConfig.is_enrolled
                      ? 'Facial Enrollment Required'
                      : 'Facial Verification Required'}
                </Text>
                <Text style={styles.securityDesc}>
                  {facialSessionToken
                    ? 'Identity confirmed. You are ready to cast your ballot.'
                    : !facialConfig.is_enrolled
                      ? 'Please enroll your face to unlock ballot submission.'
                      : 'Face verification is required before casting your vote.'}
                </Text>
              </View>
              {!facialSessionToken && (
                <TouchableOpacity
                  style={styles.securityActionBtn}
                  onPress={openFacialVerify}
                  activeOpacity={0.8}
                >
                  <Text style={styles.securityActionBtnText}>
                    {facialConfig.is_enrolled ? 'Scan Face' : 'Enroll'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Grouped Positions & Candidates */}
          {facialRequired && !facialSessionToken ? (
            <View style={styles.candidatesLockedBox}>
              <View style={styles.candidatesLockedIconCircle}>
                <Ionicons name="lock-closed" size={36} color={Colors.primary} />
              </View>
              <Text style={styles.candidatesLockedTitle}>Candidates Hidden for Security</Text>
              <Text style={styles.candidatesLockedDesc}>
                You must scan and verify your face first before seeing the lists of candidates.
              </Text>
              <TouchableOpacity
                style={styles.scanFaceUnlockBtn}
                onPress={openFacialVerify}
                activeOpacity={0.85}
              >
                <Ionicons name="scan-outline" size={18} color="#fff" />
                <Text style={styles.scanFaceUnlockBtnText}>Scan Face to Reveal Candidates</Text>
              </TouchableOpacity>
            </View>
          ) : (
            ballotGroups.map((group, groupIdx) => {
            const selectedForPosition = selections[group.position]?.length || 0;
            const isPositionChosen = selectedForPosition > 0;

            return (
              <View key={group.position} style={styles.positionSection}>
                {/* Position Section Header */}
                <View style={styles.positionHeaderRow}>
                  <View style={styles.positionTitleGroup}>
                    <View
                      style={[
                        styles.positionNumberBadge,
                        isPositionChosen && styles.positionNumberBadgeDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.positionNumberText,
                          isPositionChosen && styles.positionNumberTextDone,
                        ]}
                      >
                        {groupIdx + 1}
                      </Text>
                    </View>
                    <View style={styles.positionNameGroup}>
                      <Text style={styles.positionName}>{group.position}</Text>
                      <Text style={styles.positionLimitText}>
                        Select up to {group.maxVotes} candidate{group.maxVotes !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.choiceStatusBadge,
                      isPositionChosen ? styles.choiceStatusDone : styles.choiceStatusPending,
                    ]}
                  >
                    <Ionicons
                      name={isPositionChosen ? 'checkmark-circle' : 'ellipse-outline'}
                      size={13}
                      color={isPositionChosen ? '#16A34A' : '#6B7280'}
                    />
                    <Text
                      style={[
                        styles.choiceStatusText,
                        isPositionChosen ? styles.choiceStatusTextDone : styles.choiceStatusTextPending,
                      ]}
                    >
                      {selectedForPosition}/{group.maxVotes} selected
                    </Text>
                  </View>
                </View>

                {/* Candidate Selection Cards */}
                <View style={styles.candidatesList}>
                  {group.candidates.map((c) => {
                    const isSelected = (selections[group.position] || []).includes(c.id);
                    const selectionLimitReached =
                      !isSelected && selectedForPosition >= group.maxVotes;

                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.candidateCard,
                          isSelected && styles.candidateCardSelected,
                          selectionLimitReached && styles.candidateCardDisabled,
                        ]}
                        onPress={() => handleSelectCandidate(group.position, c.id, group.maxVotes)}
                        disabled={selectionLimitReached}
                        activeOpacity={0.8}
                      >
                        {/* Selection Check Indicator */}
                        <View style={[styles.customCheckbox, isSelected && styles.customCheckboxActive]}>
                          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>

                        {/* Candidate Avatar */}
                        <CandidateAvatar name={c.name} photo={c.photo} />

                        {/* Candidate Details */}
                        <View style={styles.candidateDetails}>
                          <Text style={[styles.candidateName, isSelected && styles.candidateNameSelected]}>
                            {c.name}
                          </Text>
                          {c.description ? (
                            <Text style={styles.candidateDesc} numberOfLines={2}>
                              {c.description}
                            </Text>
                          ) : null}
                        </View>

                        {/* Selected Pill */}
                        {isSelected && (
                          <View style={styles.selectedPill}>
                            <Text style={styles.selectedPillText}>Chosen</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })
          )}
        </ScrollView>

        {/* ── Sticky Bottom Submission Bar ── */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarMeta}>
            <Text style={styles.bottomBarSummary}>
              {facialRequired && !facialSessionToken
                ? 'Face scan required'
                : allSelected
                ? 'All positions selected'
                : `${totalPositions - selectedCount} position${totalPositions - selectedCount !== 1 ? 's' : ''} left`}
            </Text>
            <Text style={styles.bottomBarSubtext}>
              {facialRequired && !facialSessionToken
                ? 'Scan face to view candidates'
                : allSelected && facialSessionToken
                ? 'Ready to cast verified vote'
                : 'Select at least one candidate per position, up to each limit'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitVoteBtn,
              (!canSubmit || (facialRequired && !facialSessionToken)) && styles.submitVoteBtnDisabled,
            ]}
            onPress={handleSubmitVote}
            disabled={!canSubmit || (facialRequired && !facialSessionToken)}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.submitBtnInner}>
                {facialRequired && facialConfig?.is_enabled && !facialSessionToken && (
                  <Ionicons name="scan-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.submitVoteBtnText}>
                  {facialRequired && !facialSessionToken
                    ? 'Scan Face First'
                    : !allSelected
                    ? `Choose All (${totalPositions - selectedCount} left)`
                    : 'Cast My Ballot'}
                </Text>
                {allSelected && facialSessionToken && <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Biometric Verification Modal */}
        <FaceVerificationModal
          visible={faceModalVisible}
          onClose={handleCloseFaceModal}
          action={faceModalAction}
          context="voting"
          onSuccess={handleFaceSuccess}
        />
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────
  // STEP 1: ELECTIONS LIST VIEW
  // ──────────────────────────────────────────────────────────
  const activeUnvotedCount = elections.filter((e) => !votedElections.has(e.id)).length;
  const votedCount = votedElections.size;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Brand Top Bar ── */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <Image source={require('../../../assets/univote-logo.jpg')} style={styles.brandLogo} />
          <View>
            <Text style={styles.brandTitle}>UniVote</Text>
            <Text style={styles.brandSubtitle}>Active Ballot Center</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
          accessibilityLabel="Refresh active elections"
        >
          <Ionicons name="sync-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Hero Banner ── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroContent}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.liveTag}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveTagText}>Official Ballot Hub</Text>
            </View>
            <View style={styles.secureTag}>
              <Ionicons name="shield-checkmark" size={12} color="#A7F3D0" />
              <Text style={styles.secureTagText}>Biometric Secured</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Vote in Elections</Text>
          <Text style={styles.heroSubtitle}>
            Select an active campus election to review candidates and securely cast your vote.
          </Text>

          {/* Quick Stats Row */}
          <View style={styles.statPillsRow}>
            <View style={styles.statPill}>
              <Ionicons name="radio-button-on" size={14} color="#34D399" />
              <Text style={styles.statPillVal}>{activeUnvotedCount}</Text>
              <Text style={styles.statPillLabel}>Open to Vote</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Ionicons name="checkmark-done-circle-outline" size={15} color="#fff" />
              <Text style={styles.statPillVal}>{votedCount}</Text>
              <Text style={styles.statPillLabel}>Voted</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Ionicons name="lock-closed-outline" size={14} color="#fff" />
              <Text style={styles.statPillVal}>Face ID</Text>
              <Text style={styles.statPillLabel}>Protected</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Elections List ── */}
      {elections.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="file-tray-outline" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Active Elections</Text>
          <Text style={styles.emptyDesc}>
            There are no ongoing elections open for voting at the moment. Please check back later or view results of past elections.
          </Text>
          <TouchableOpacity
            style={styles.viewResultsBtn}
            onPress={() => router.push('/(tabs)/(voter)/VoterResults')}
            activeOpacity={0.8}
          >
            <Ionicons name="bar-chart-outline" size={16} color={Colors.primary} />
            <Text style={styles.viewResultsBtnText}>View Past Results</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Election Cards */
        <View style={styles.cardsList}>
          {elections.map((e) => {
            const hasVoted = votedElections.has(e.id);
            const candidateCount = e.candidates?.length || 0;

            return (
              <View key={e.id} style={[styles.electionCard, hasVoted && styles.electionCardVoted]}>
                {/* Card Top Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons
                      name={hasVoted ? 'checkmark-circle' : 'reader-outline'}
                      size={20}
                      color={hasVoted ? '#16A34A' : Colors.primary}
                    />
                  </View>
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.cardElectionTitle}>{e.title}</Text>
                    {e.description ? (
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.cardStatusPill,
                      hasVoted ? styles.cardStatusPillVoted : styles.cardStatusPillActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        hasVoted ? styles.statusDotVoted : styles.statusDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.cardStatusText,
                        hasVoted ? styles.cardStatusTextVoted : styles.cardStatusTextActive,
                      ]}
                    >
                      {hasVoted ? 'Voted' : 'Open'}
                    </Text>
                  </View>
                </View>

                {/* Card Meta Row */}
                <View style={styles.cardMetaRow}>
                  {e.election_type === 'course' && (e.course?.code || e.course?.name) ? (
                    <View style={[styles.metaBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                      <Ionicons name="school-outline" size={12} color="#2563EB" />
                      <Text style={[styles.metaBadgeText, { color: '#1D4ED8', fontWeight: '700' }]}>
                        {e.course?.code || e.course?.name}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.metaBadge}>
                    <Ionicons name="people-outline" size={12} color="#6B7280" />
                    <Text style={styles.metaBadgeText}>{candidateCount} Candidate{candidateCount !== 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.metaBadge}>
                    <Ionicons name="shield-checkmark-outline" size={12} color={Colors.primary} />
                    <Text style={[styles.metaBadgeText, { color: Colors.primary }]}>Facial ID Secured</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                {/* Card Button: Smart Navigation */}
                {hasVoted ? (
                  <TouchableOpacity
                    style={styles.viewBallotBtn}
                    onPress={() => router.push('/(tabs)/(voter)/VoterVotes')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="receipt-outline" size={15} color="#16A34A" />
                    <Text style={styles.viewBallotBtnText}>View My Cast Ballot</Text>
                    <Ionicons name="chevron-forward" size={14} color="#16A34A" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.voteNowBtn}
                    onPress={() => handleSelectElection(e)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="scan-outline" size={16} color="#fff" />
                    <Text style={styles.voteNowBtnText}>Scan Face & Vote</Text>
                    <Ionicons name="arrow-forward" size={15} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Security Assurance */}
      <View style={styles.securityFooter}>
        <Ionicons name="lock-closed" size={13} color="#9CA3AF" />
        <Text style={styles.securityFooterText}>
          One student, one vote. Biometrically verified to prevent duplicate voting.
        </Text>
      </View>

      {/* Biometric Verification Modal */}
      <FaceVerificationModal
        visible={faceModalVisible}
        onClose={handleCloseFaceModal}
        action={faceModalAction}
        context="voting"
        onSuccess={handleFaceSuccess}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    paddingBottom: 40,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 24,
  },
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    maxWidth: 320,
    width: '100%',
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Top Bar
  topBar: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A7F3D0',
    letterSpacing: 0.3,
  },
  secureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  secureTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
    marginBottom: 16,
  },
  statPillsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statPill: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  statPillVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  statPillLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Elections List
  cardsList: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  electionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  candidateCardDisabled: {
    opacity: 0.55,
  },
  electionCardVoted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1FAE5',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardElectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  cardStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  cardStatusPillActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  cardStatusPillVoted: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotVoted: {
    backgroundColor: '#3B82F6',
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardStatusTextActive: {
    color: '#065F46',
  },
  cardStatusTextVoted: {
    color: '#1E40AF',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaBadgeText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  voteNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 11,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  voteNowBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  viewBallotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  viewBallotBtnText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty State
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  viewResultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  viewResultsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ──────────────────────────────────────────────
  // BALLOT VOTING SCREEN (step === 'vote')
  // ──────────────────────────────────────────────
  ballotHeader: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ballotHeaderCenter: {
    flex: 1,
    marginLeft: 12,
  },
  ballotHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  ballotHeaderSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  progressPill: {
    backgroundColor: '#064E3B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#34D399',
  },
  ballotContent: {
    paddingBottom: 100, // Space for sticky bottom bar
  },
  electionOverviewCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  electionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  officialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  officialPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  electionOverviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  electionOverviewDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },

  // Security Card
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  securityPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  securityVerified: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  securityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTextCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  securityTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 10,
    color: '#6B7280',
    lineHeight: 14,
  },
  securityActionBtn: {
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  securityActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Position Section
  positionSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  positionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  positionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionNumberBadgeDone: {
    backgroundColor: '#16A34A',
  },
  positionNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  positionNumberTextDone: {
    color: '#fff',
  },
  positionName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  positionNameGroup: {
    flex: 1,
  },
  positionLimitText: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  choiceStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  choiceStatusDone: {
    backgroundColor: '#DCFCE7',
  },
  choiceStatusPending: {
    backgroundColor: '#F3F4F6',
  },
  choiceStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  choiceStatusTextDone: {
    color: '#15803D',
  },
  choiceStatusTextPending: {
    color: '#6B7280',
  },

  // Candidate Cards
  candidatesList: {
    gap: 8,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  candidateCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDF4',
    shadowColor: Colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  customCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  customCheckboxActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  candidateAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  candidateAvatarImg: {
    width: '100%',
    height: '100%',
  },
  candidateAvatarInitials: {
    fontSize: 13,
    fontWeight: '800',
  },
  candidateDetails: {
    flex: 1,
    marginRight: 6,
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  candidateNameSelected: {
    color: '#111827',
  },
  candidateDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 15,
  },
  selectedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  selectedPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },

  // Sticky Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBarMeta: {
    flex: 1,
    marginRight: 12,
  },
  bottomBarSummary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  bottomBarSubtext: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  submitVoteBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitVoteBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitVoteBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  // ──────────────────────────────────────────────
  // SUCCESS SCREEN
  // ──────────────────────────────────────────────
  successScreen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    textAlign: 'center',
  },
  successElectionName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  successDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  successReceiptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successReceiptBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  viewReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 8,
    width: '100%',
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  viewReceiptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  backToElectionsBtn: {
    paddingVertical: 8,
  },
  backToElectionsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Security Footer
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  securityFooterText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 15,
  },

  // Candidates Locked State
  candidatesLockedBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  candidatesLockedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  candidatesLockedTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  candidatesLockedDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  scanFaceUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  scanFaceUnlockBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
