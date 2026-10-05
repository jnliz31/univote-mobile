// API Configuration — connects to campus-vote Laravel backend
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const expoHostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
const expoDevHost = expoHostUri?.split(":")[0];
const defaultApiHost = expoDevHost ?? (Platform.OS === "android" ? "10.0.2.2" : "localhost");
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://${defaultApiHost}:8000/api`;


interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  error_code?: string;
  match_score?: number;
  attempts_remaining?: number;
  quality_detail?: {
    brightness?: number;
    sharpness?: number;
    min_required?: number;
  };
  facial_config?: FacialConfig;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "admin";
  hasVoted?: boolean;
  created_at?: string;
  facial_config?: FacialConfig;
  facial_required?: boolean;
  age?: number;
  sex?: string;
  course?: string;
  year_level?: string;
  organization_id?: number | null;
}

interface FacialConfig {
  is_enrolled: boolean;
  is_verified: boolean;
  is_enabled: boolean;
  status: "not_enrolled" | "enrolled" | "verified" | "disabled";
  verification_attempts: number;
  last_verified_at: string | null;
  last_failed_at: string | null;
  updated_at: string | null;
}

interface FacialVerifyResult {
  success: boolean;
  verified: boolean;
  match_score: number;
  threshold: number;
  message?: string;
  session_token?: string;
  session_expires_at?: string;
  facial_config?: FacialConfig;
  error_code?: string;
  attempts_remaining?: number;
  quality_detail?: {
    brightness?: number;
    sharpness?: number;
    min_required?: number;
  };
}

interface FacialConfigResponse {
  facial_config: FacialConfig;
  is_required: boolean;
  min_quality_score: number;
  max_attempts_before_lockout: number;
  session_ttl_minutes: number;
}

interface Election {
  id: number;
  title: string;
  description?: string;
  status: "draft" | "active" | "closed";
  start_date?: string;
  end_date?: string;
  candidates?: Candidate[];
  organization_id?: number | null;
}

interface Organization {
  id: number;
  name: string;
  code: string;
}

interface Candidate {
  id: number;
  election_id: number;
  name: string;
  position?: string;
  description?: string;
  photo?: string;
}

interface Vote {
  id: number;
  user_id: number;
  election_id: number;
  candidate_id: number;
  created_at?: string;
  election?: Election;
  candidate?: Candidate;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: "info" | "warning" | "success";
  created_at: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.loadToken();
  }

  async loadToken() {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      this.token = token;
    } catch (error) {
      console.error("Error loading token:", error);
    }
  }

  async setToken(token: string) {
    this.token = token;
    await AsyncStorage.setItem("auth_token", token);
  }

  async clearToken() {
    this.token = null;
    await AsyncStorage.removeItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0,
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const maxRetries = 3;
    const canRetry = !options.method || options.method === "GET" || options.method === "HEAD";

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      console.log(`[API] ${options.method || "GET"} ${url} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      console.log(`[API_BASE_URL] ${API_BASE_URL}`);

      const response = await fetch(url, { ...options, headers, signal: controller.signal });

      let data;
      try {
        data = await response.json();
      } catch {
        data = { message: response.statusText };
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const rawError = data?.error?.message || data?.error || data?.message;
        const errorMsg = typeof rawError === 'string'
          ? rawError
          : rawError
            ? Object.values(rawError).flat(Infinity).join(', ')
            : `Error ${response.status}`;
        // Use warn for 401 (expected when not logged in), error for other failures
        if (response.status === 401) {
          console.warn(`[API 401] ${endpoint} - Unauthenticated`);
        } else {
          console.error(`[API Error] ${errorMsg}`, data);
        }
        return {
          data: data as T,
          error: errorMsg,
          message: data?.message,
          error_code: data?.error_code,
          match_score: data?.match_score,
          attempts_remaining: data?.attempts_remaining,
          quality_detail: data?.quality_detail,
          facial_config: data?.facial_config,
        };
      }

      console.log(`[API Success] ${endpoint}`, data);
      return { data };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorDetails = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error("[API Timeout]", `Request to ${url} timed out after 30s`);
        if (canRetry && retryCount < maxRetries) {
          console.log(`[API Retry] Retrying request... (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        return { error: 'Request timed out. Please ensure the backend API is running and check your network connection.' };
      }

      console.error("[API Network Error]", {
        error: errorDetails,
        url,
        endpoint,
        method: options.method || "GET",
      });

      // Retry on network errors
      if (canRetry && retryCount < maxRetries) {
        console.log(`[API Retry] Retrying request after network error... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      return {
        error: `Network error: ${errorDetails}. Check that the backend is running at ${API_BASE_URL}.`,
      };
    }
  }

  // Auth endpoints
  async register(data: { fullName: string; email: string; password: string; age: number; sex: string; course: string; yearLevel: string; organizationId?: number }) {
    return this.request<{ user: User; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: data.fullName,
        email: data.email,
        password: data.password,
        age: data.age,
        sex: data.sex,
        course: data.course,
        year_level: data.yearLevel,
        organization_id: data.organizationId,
      }),
    });
  }

  async getOrganizations() {
    return this.request<Organization[]>('/organizations');
  }

  async login(email: string, password: string) {
    return this.request<{ user: User; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async googleLogin(params: { idToken?: string; email?: string; name?: string; googleId?: string }) {
    return this.request<{ user: User & { is_new_user?: boolean }; token: string }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({
        id_token: params.idToken,
        email: params.email,
        name: params.name,
        google_id: params.googleId,
      }),
    });
  }

  async logout() {
    const response = await this.request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
    this.clearToken();
    return response;
  }

  async getCurrentUser() {
    return this.request<User>("/user");
  }

  // Election endpoints
  async getElections(status?: string) {
    const endpoint = status ? `/elections?status=${status}` : "/elections";
    return this.request<Election[]>(endpoint);
  }

  async getElection(id: number) {
    return this.request<Election>(`/elections/${id}`);
  }

  async createElection(data: Partial<Election>) {
    return this.request<Election>("/elections", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateElection(id: number, data: Partial<Election>) {
    return this.request<Election>(`/elections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteElection(id: number) {
    return this.request<{ message: string }>(`/elections/${id}`, {
      method: "DELETE",
    });
  }

  async getElectionResults(id: number) {
    return this.request<{
      election: Election;
      positions: {
        id: number;
        name: string;
        candidates: {
          id: number;
          name: string;
          vote_count: number;
          percentage: number;
          winner: boolean;
        }[];
      }[];
      total_votes: number;
    }>(`/elections/${id}/results`);
  }

  // Candidate endpoints
  async getCandidates(electionId?: number) {
    const endpoint = electionId
      ? `/candidates?election_id=${electionId}`
      : "/candidates";
    return this.request<Candidate[]>(endpoint);
  }

  async getCandidate(id: number) {
    return this.request<Candidate>(`/candidates/${id}`);
  }

  async createCandidate(data: Partial<Candidate>) {
    return this.request<Candidate>("/candidates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCandidate(id: number, data: Partial<Candidate>) {
    return this.request<Candidate>(`/candidates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCandidate(id: number) {
    return this.request<{ message: string }>(`/candidates/${id}`, {
      method: "DELETE",
    });
  }

  // Vote endpoints
  async getVotes() {
    return this.request<Vote[]>("/votes");
  }

  async castVote(electionId: number, candidateId: number) {
    return this.request<Vote>("/votes", {
      method: "POST",
      body: JSON.stringify({
        election_id: electionId,
        candidate_id: candidateId,
      }),
    });
  }

  async castVotes(electionId: number, candidateIds: number[], facialSessionToken?: string) {
    const payload: Record<string, unknown> = {
      election_id: electionId,
      candidates: candidateIds,
    };
    if (facialSessionToken) {
      payload.facial_session_token = facialSessionToken;
    }
    return this.request<{ success: boolean; message: string; votes: number }>("/votes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async checkVote(electionId: number) {
    return this.request<{ has_voted: boolean }>(
      `/elections/${electionId}/check-vote`,
    );
  }

  // Announcement endpoints
  async getAnnouncements() {
    return this.request<Announcement[]>("/announcements");
  }

  async createAnnouncement(data: Partial<Announcement>) {
    return this.request<Announcement>("/announcements", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(id: number) {
    return this.request<{ message: string }>(`/announcements/${id}`, {
      method: "DELETE",
    });
  }

  // User endpoints
  async getUsers() {
    return this.request<User[]>("/users");
  }

  async getUser(id: number) {
    return this.request<User>(`/users/${id}`);
  }

  // Facial Verification endpoints
  async getFacialConfig() {
    return this.request<FacialConfigResponse>("/facial/config");
  }

  async enrollFace(faceData: string, qualityScore?: number) {
    const body: Record<string, unknown> = { face_data: faceData };
    if (qualityScore !== undefined) body.quality_score = qualityScore;
    return this.request<{ success: boolean; message: string; session_token?: string; session_expires_at?: string; facial_config: FacialConfig }>("/facial/enroll", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async verifyFace(faceData: string, context?: "voting" | "login" | "general") {
    const body: Record<string, unknown> = { face_data: faceData };
    if (context) body.context = context;
    return this.request<FacialVerifyResult>("/facial/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async validateFacialSession(sessionToken: string) {
    return this.request<{ valid: boolean }>("/facial/validate-session", {
      method: "POST",
      body: JSON.stringify({ session_token: sessionToken }),
    });
  }

  async resetFacialAttempts() {
    return this.request<{ success: boolean; message: string; facial_config: FacialConfig }>(
      "/facial/reset-attempts",
      { method: "POST" }
    );
  }

  async toggleFacialVerification(isEnabled: boolean) {
    return this.request<{ success: boolean; message: string; facial_config: FacialConfig }>("/facial/toggle", {
      method: "POST",
      body: JSON.stringify({ is_enabled: isEnabled }),
    });
  }

  async removeFacialProfile() {
    return this.request<{ success: boolean; message: string; facial_config: FacialConfig }>("/facial/remove", {
      method: "DELETE",
    });
  }

  // Diagnostic endpoint
  async checkBackendConnectivity() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      console.log(`[Diagnostic] Checking backend connectivity at ${API_BASE_URL}`);

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log("[Diagnostic] Backend is reachable", data);
        return { status: "ok", message: "Backend is reachable" };
      } else {
        console.warn("[Diagnostic] Backend returned", response.status);
        return { status: "error", message: `Backend returned status ${response.status}` };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Diagnostic] Backend is NOT reachable:", errorMsg);
      return {
        status: "error",
        message: `Cannot reach backend at ${API_BASE_URL}. Error: ${errorMsg}. Make sure:
1. Backend server is running
2. IP address ${API_BASE_URL} is correct
3. Device/emulator can access the network
4. Firewall is not blocking the connection`
      };
    }
  }
}

export const api = new ApiService();
export type { User, Election, Candidate, Vote, Announcement, FacialConfig, FacialVerifyResult, FacialConfigResponse };
