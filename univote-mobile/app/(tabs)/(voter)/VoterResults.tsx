import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';

interface ResultPosition {
  id: number;
  name: string;
  candidates: {
    id: number;
    name: string;
    vote_count: number;
    percentage: number;
    winner: boolean;
  }[];
}

interface ResultElection {
  id: number;
  title: string;
  status: string;
  positions: ResultPosition[];
  total_votes: number;
}

function InitialsCircle({ initials }: { initials: string }) {
  return (
    <View style={styles.initialsCircle}>
      <Text style={styles.initialsText}>{initials}</Text>
    </View>
  );
}

function WinnerBadge() {
  return (
    <View style={styles.winnerBadge}>
      <Text style={styles.winnerText}>Winner</Text>
    </View>
  );
}

function CandidateCard({ candidate }: { candidate: any }) {
  const initials = candidate.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={styles.candidateCard}>
      <View style={styles.candidateTop}>
        <InitialsCircle initials={initials} />
        <Text style={styles.candidateName}>{candidate.name}</Text>
        {candidate.winner && <WinnerBadge />}
        <Text style={styles.voteCount}>{candidate.vote_count} votes</Text>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${candidate.percentage}%` }]}>
          <Text style={styles.progressText}>{candidate.percentage}%</Text>
        </View>
      </View>
    </View>
  );
}

export default function VoterResultsScreen() {
  const [results, setResults] = useState<ResultElection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = React.useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadResults = useCallback(async () => {
    try {
      const electionsRes = await api.getElections('closed');
      if (!mountedRef.current) return;
      const elections = Array.isArray(electionsRes.data) ? electionsRes.data : [];
      const fetched: ResultElection[] = [];
      for (const e of elections) {
        const r = await api.getElectionResults(e.id);
        if (!mountedRef.current) return;
        if (r.data) {
          fetched.push({
            id: r.data.election.id,
            title: r.data.election.title,
            status: r.data.election.status,
            positions: r.data.positions,
            total_votes: r.data.total_votes,
          });
        }
      }
      if (!mountedRef.current) return;
      setResults(fetched);
    } catch (error) {
      console.error('Error loading results:', error);
    }
  }, []);

  useEffect(() => {
    loadResults().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [loadResults]);


  const onRefresh = async () => {
    setRefreshing(true);
    await loadResults();
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
        <Text style={styles.headerTitle}>Results</Text>
      </View>

      <Text style={styles.pageTitle}>Election Results</Text>
      <Text style={styles.pageSubtitle}>View the results of ended elections</Text>

      {results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No results available yet</Text>
        </View>
      ) : (
        results.map((election) => (
          <View key={election.id} style={styles.electionWrapper}>
            <View style={styles.electionCard}>
              <View style={styles.electionIcon}>
                <Ionicons name="school-outline" size={18} color={Colors.primary} />
              </View>
              <Text style={styles.electionTitle}>{election.title}</Text>
              <View style={styles.endedBadge}>
                <Text style={styles.endedText}>{election.status}</Text>
              </View>
            </View>

            {election.positions.map((pos: ResultPosition) => (
              <View key={pos.id} style={styles.positionSection}>
                <Text style={styles.positionTitle}>{pos.name}</Text>
                {pos.candidates.map((c: any) => (
                  <CandidateCard key={c.id} candidate={c} />
                ))}
              </View>
            ))}
          </View>
        ))
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
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a2a3a',
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#8899aa',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  electionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  electionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  electionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2a3a',
  },
  endedBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  endedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  positionSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  positionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a2a3a',
    marginBottom: 10,
    marginTop: 4,
  },
  candidateCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E6EB',
  },
  candidateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  initialsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  initialsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  candidateName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2a3a',
  },
  winnerBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  winnerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  voteCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#556677',
  },
  progressBg: {
    height: 24,
    backgroundColor: '#E8EDF2',
    borderRadius: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
    minWidth: 36,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#8899aa', textAlign: 'center' },
  electionWrapper: { marginBottom: 20 },
});
