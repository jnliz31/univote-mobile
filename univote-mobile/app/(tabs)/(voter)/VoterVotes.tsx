import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';

interface VoteGroup {
  electionId: number;
  electionTitle: string;
  votedAt: string;
  selections: { position: string; candidate: string }[];
}

export default function VoterVotesScreen() {
  const [voteGroups, setVoteGroups] = useState<VoteGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = React.useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadVotes = useCallback(async () => {
    try {
      const response = await api.getVotes();
      if (!mountedRef.current) return;
      if (response.data && Array.isArray(response.data)) {
        // Group by election
        const groups = new Map<number, VoteGroup>();
        for (const vote of response.data) {
          const eid = vote.election_id;
          if (!groups.has(eid)) {
            groups.set(eid, {
              electionId: eid,
              electionTitle: vote.election?.title || `Election #${eid}`,
              votedAt: vote.created_at || '',
              selections: [],
            });
          }
          const g = groups.get(eid)!;
          g.selections.push({
            position: vote.candidate?.position || 'Candidate',
            candidate: vote.candidate?.name || '',
          });
        }
        if (!mountedRef.current) return;
        setVoteGroups(Array.from(groups.values()));
      }
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  }, []);

  useEffect(() => {
    loadVotes().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [loadVotes]);


  const onRefresh = async () => {
    setRefreshing(true);
    await loadVotes();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
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
        <Text style={styles.headerTitle}>View Votes</Text>
      </View>

      <View style={styles.banner}>
        <View style={styles.bannerInner}>
          <View>
            <Text style={styles.bannerTitle}>Your Votes</Text>
            <Text style={styles.bannerSubtitle}>View all elections you have voted in</Text>
          </View>
          <View style={styles.votesBadge}>
            <Text style={styles.votesBadgeText}>{voteGroups.length} Vote{voteGroups.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      </View>

      {voteGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>You haven&apos;t voted in any elections yet</Text>
        </View>
      ) : (
        voteGroups.map((v) => (
          <View key={v.electionId} style={styles.voteCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardElection}>{v.electionTitle}</Text>
                <Text style={styles.cardDate}>
                  Voted: {v.votedAt ? new Date(v.votedAt).toLocaleString() : 'Recently'}
                </Text>
              </View>
              <View style={styles.votedBadge}>
                <Ionicons name="checkmark" size={10} color="#fff" />
                <Text style={styles.votedBadgeText}>Voted</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              {v.selections.map((sel, i) => (
                <View key={i} style={[styles.selectionRow, i < v.selections.length - 1 && styles.selectionBorder]}>
                  <View style={styles.positionRow}>
                    <Ionicons name="bookmark" size={10} color="#999" style={styles.positionIcon} />
                    <Text style={styles.positionName}>{sel.position}</Text>
                  </View>
                  {sel.candidate ? (
                    <View style={styles.candidateTag}>
                      <Ionicons name="checkmark" size={10} color={Colors.primary} />
                      <Text style={styles.candidateText}>{sel.candidate}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))
      )}
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
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  banner: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  bannerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  votesBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  votesBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  voteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: { flex: 1 },
  cardElection: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  votedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectionRow: {
    paddingVertical: 10,
  },
  selectionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  positionIcon: { marginRight: 6 },
  positionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a2a3a',
  },
  candidateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  candidateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  resultsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },
  resultsLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#8899aa', textAlign: 'center' },
});
