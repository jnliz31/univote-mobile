<template>
    <div class="audit-logs-page">
        <!-- Summary Stat Cards -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon icon-total">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ summary.total || 0 }}</span>
                    <span class="stat-label">Total Audit Events</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon icon-mobile">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                        <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ summary.mobile || 0 }}</span>
                    <span class="stat-label">Mobile App Events</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon icon-web">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ summary.web || 0 }}</span>
                    <span class="stat-label">Web Browser Events</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon icon-vote">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                </div>
                <div class="stat-info">
                    <span class="stat-value">{{ summary.votes_cast || 0 }}</span>
                    <span class="stat-label">Votes Cast (VOTE_CAST)</span>
                </div>
            </div>
        </div>

        <!-- Filter & Search Bar -->
        <div class="card filter-card">
            <div class="filter-row">
                <div class="filter-group search-group">
                    <label>Search Logs</label>
                    <input
                        type="text"
                        v-model="filters.search"
                        @input="debounceFetch"
                        placeholder="Search by user, action, model, or IP..."
                        class="form-control"
                    />
                </div>

                <div class="filter-group">
                    <label>Platform</label>
                    <select v-model="filters.platform" @change="fetchLogs(1)" class="form-control">
                        <option value="">All Platforms</option>
                        <option value="Mobile App">Mobile App</option>
                        <option value="Web Browser">Web Browser</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label>Action Type</label>
                    <select v-model="filters.action" @change="fetchLogs(1)" class="form-control">
                        <option value="">All Actions</option>
                        <option v-for="actionOpt in availableActions" :key="actionOpt" :value="actionOpt">
                            {{ actionOpt }}
                        </option>
                    </select>
                </div>

                <div class="filter-group">
                    <label>Start Date</label>
                    <input type="date" v-model="filters.start_date" @change="fetchLogs(1)" class="form-control" />
                </div>

                <div class="filter-group">
                    <label>End Date</label>
                    <input type="date" v-model="filters.end_date" @change="fetchLogs(1)" class="form-control" />
                </div>

                <div class="filter-group btn-group">
                    <label>&nbsp;</label>
                    <button @click="resetFilters" class="btn btn-secondary">Reset</button>
                    <button @click="fetchLogs(1)" class="btn btn-primary">Refresh</button>
                </div>
            </div>
        </div>

        <!-- Logs Table Card -->
        <div class="card table-card">
            <div class="card-header">
                <h3>Centralized Audit Logs</h3>
                <span class="showing-text" v-if="pagination.total">
                    Showing {{ pagination.from }}-{{ pagination.to }} of {{ pagination.total }} records
                </span>
            </div>

            <div v-if="loading" class="loading-state">
                <div class="spinner"></div>
                <p>Loading audit log entries...</p>
            </div>

            <div v-else-if="logs.length === 0" class="empty-state">
                <div class="empty-icon-wrapper">
                    <svg class="svg-icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="3"/>
                        <line x1="14.2" y1="15.2" x2="16.5" y2="17.5"/>
                    </svg>
                </div>
                <p>No audit log records found matching the criteria.</p>
            </div>

            <div v-else class="table-wrapper">
                <table class="audit-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Timestamp</th>
                            <th>Actor / User</th>
                            <th>Action</th>
                            <th>Model / Entity</th>
                            <th>Platform</th>
                            <th>IP Address</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="log in logs" :key="log.id">
                            <td>#{{ log.id }}</td>
                            <td class="timestamp-cell">{{ formatDate(log.created_at) }}</td>
                            <td>
                                <div class="actor-cell">
                                    <span class="actor-name">{{ log.actor_name || 'System / Guest' }}</span>
                                    <span class="actor-type" v-if="log.user_type">{{ formatUserType(log.user_type) }}</span>
                                </div>
                            </td>
                            <td>
                                <span :class="['badge', getActionBadgeClass(log.action)]">
                                    {{ log.action }}
                                </span>
                            </td>
                            <td>
                                <span class="model-text" v-if="log.model_type">
                                    {{ formatModelName(log.model_type) }}
                                    <strong v-if="log.model_id">#{{ log.model_id }}</strong>
                                </span>
                                <span class="muted-text" v-else>—</span>
                            </td>
                            <td>
                                <span :class="['platform-badge', log.platform === 'Mobile App' ? 'platform-mobile' : 'platform-web']">
                                    <span class="platform-icon">
                                        <svg v-if="log.platform === 'Mobile App'" class="badge-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                            <line x1="12" y1="18" x2="12.01" y2="18"/>
                                        </svg>
                                        <svg v-else class="badge-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                            <line x1="2" y1="12" x2="22" y2="12"/>
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                        </svg>
                                    </span>
                                    {{ log.platform || 'Unknown' }}
                                </span>
                            </td>
                            <td class="ip-cell"><code>{{ log.ip_address || 'N/A' }}</code></td>
                            <td>
                                <button @click="openDetailModal(log)" class="btn-inspect">
                                    Inspect
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            <div class="pagination-bar" v-if="pagination.last_page > 1">
                <button
                    :disabled="pagination.current_page === 1"
                    @click="fetchLogs(pagination.current_page - 1)"
                    class="btn-page"
                >
                    &laquo; Previous
                </button>

                <span class="page-info">
                    Page <strong>{{ pagination.current_page }}</strong> of <strong>{{ pagination.last_page }}</strong>
                </span>

                <button
                    :disabled="pagination.current_page === pagination.last_page"
                    @click="fetchLogs(pagination.current_page + 1)"
                    class="btn-page"
                >
                    Next &raquo;
                </button>
            </div>
        </div>

        <!-- Detail Modal -->
        <div v-if="selectedLog" class="modal-backdrop" @click.self="closeModal">
            <div class="modal-card">
                <div class="modal-header">
                    <h4>Audit Log Details #{{ selectedLog.id }}</h4>
                    <button @click="closeModal" class="close-btn">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="meta-grid">
                        <div class="meta-item">
                            <label>Action:</label>
                            <span :class="['badge', getActionBadgeClass(selectedLog.action)]">{{ selectedLog.action }}</span>
                        </div>
                        <div class="meta-item">
                            <label>Platform:</label>
                            <span class="flex-align">
                                <svg v-if="selectedLog.platform === 'Mobile App'" class="inline-meta-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                                </svg>
                                <svg v-else class="inline-meta-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="2" y1="12" x2="22" y2="12"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                </svg>
                                {{ selectedLog.platform || 'Unknown' }}
                            </span>
                        </div>
                        <div class="meta-item">
                            <label>Actor:</label>
                            <span>{{ selectedLog.actor_name || 'N/A' }}</span>
                        </div>
                        <div class="meta-item">
                            <label>IP Address:</label>
                            <span><code>{{ selectedLog.ip_address || 'N/A' }}</code></span>
                        </div>
                        <div class="meta-item">
                            <label>Model Affected:</label>
                            <span>{{ selectedLog.model_type || 'N/A' }} (ID: {{ selectedLog.model_id || 'N/A' }})</span>
                        </div>
                        <div class="meta-item">
                            <label>Timestamp:</label>
                            <span>{{ formatDate(selectedLog.created_at) }}</span>
                        </div>
                    </div>

                    <div class="user-agent-section" v-if="selectedLog.user_agent">
                        <label>User Agent Header:</label>
                        <div class="ua-box"><code>{{ selectedLog.user_agent }}</code></div>
                    </div>

                    <div class="diff-section">
                        <div class="diff-box" v-if="selectedLog.old_values">
                            <h5 class="diff-title old-title">State Before Change (old_values)</h5>
                            <pre class="json-code">{{ JSON.stringify(selectedLog.old_values, null, 2) }}</pre>
                        </div>
                        <div class="diff-box" v-if="selectedLog.new_values">
                            <h5 class="diff-title new-title">State After Change (new_values)</h5>
                            <pre class="json-code">{{ JSON.stringify(selectedLog.new_values, null, 2) }}</pre>
                        </div>
                        <div class="diff-box full-width" v-if="!selectedLog.old_values && !selectedLog.new_values">
                            <p class="muted-text">No JSON diff payload recorded for this event.</p>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button @click="closeModal" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from "axios";

export default {
    name: "AdminAuditLogs",
    data() {
        return {
            logs: [],
            summary: {
                total: 0,
                mobile: 0,
                web: 0,
                votes_cast: 0,
            },
            availableActions: [],
            pagination: {
                current_page: 1,
                last_page: 1,
                from: 0,
                to: 0,
                total: 0,
            },
            filters: {
                search: "",
                platform: "",
                action: "",
                start_date: "",
                end_date: "",
            },
            loading: false,
            selectedLog: null,
            searchTimer: null,
        };
    },
    mounted() {
        this.fetchLogs();
    },
    methods: {
        async fetchLogs(page = 1) {
            this.loading = true;
            try {
                const response = await axios.get("/admin/audit-logs", {
                    params: {
                        page: page,
                        search: this.filters.search,
                        platform: this.filters.platform,
                        action: this.filters.action,
                        start_date: this.filters.start_date,
                        end_date: this.filters.end_date,
                    },
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (response.data) {
                    this.logs = response.data.logs.data || [];
                    this.pagination = {
                        current_page: response.data.logs.current_page || 1,
                        last_page: response.data.logs.last_page || 1,
                        from: response.data.logs.from || 0,
                        to: response.data.logs.to || 0,
                        total: response.data.logs.total || 0,
                    };
                    if (response.data.summary) {
                        this.summary = response.data.summary;
                    }
                    if (response.data.available_actions) {
                        this.availableActions = response.data.available_actions;
                    }
                }
            } catch (err) {
                console.error("Failed to load audit logs:", err);
            } finally {
                this.loading = false;
            }
        },
        debounceFetch() {
            clearTimeout(this.searchTimer);
            this.searchTimer = setTimeout(() => {
                this.fetchLogs(1);
            }, 350);
        },
        resetFilters() {
            this.filters = {
                search: "",
                platform: "",
                action: "",
                start_date: "",
                end_date: "",
            };
            this.fetchLogs(1);
        },
        openDetailModal(log) {
            this.selectedLog = log;
        },
        closeModal() {
            this.selectedLog = null;
        },
        formatDate(dateStr) {
            if (!dateStr) return "N/A";
            const date = new Date(dateStr);
            return date.toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
        },
        formatModelName(modelPath) {
            if (!modelPath) return "N/A";
            const parts = modelPath.split("\\");
            return parts[parts.length - 1];
        },
        formatUserType(userType) {
            if (!userType) return "";
            const parts = userType.split("\\");
            return parts[parts.length - 1];
        },
        getActionBadgeClass(action) {
            if (!action) return "badge-gray";
            if (action === "VOTE_CAST") return "badge-vote";
            if (action.startsWith("CREATE_")) return "badge-green";
            if (action.startsWith("UPDATE_")) return "badge-blue";
            if (action.startsWith("DELETE_")) return "badge-red";
            if (action === "LOGIN_SUCCESS") return "badge-green";
            if (action === "LOGIN_FAILED") return "badge-orange";
            return "badge-gray";
        },
    },
};
</script>

<style scoped>
.audit-logs-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* SVG Vector Icons */
.svg-icon {
    width: 22px;
    height: 22px;
}

.svg-icon-lg {
    width: 36px;
    height: 36px;
    color: #68756d;
}

.badge-svg {
    width: 14px;
    height: 14px;
    display: inline-block;
    vertical-align: middle;
}

.inline-meta-svg {
    width: 16px;
    height: 16px;
    margin-right: 4px;
}

.flex-align {
    display: inline-flex;
    align-items: center;
}

/* Stats Cards */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
}

.stat-card {
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 8px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-total {
    background: #e7efe8;
    color: #146c3a;
}

.icon-mobile {
    background: #f3e5f5;
    color: #7b1fa2;
}

.icon-web {
    background: #e0f7fa;
    color: #00796b;
}

.icon-vote {
    background: #e3f2fd;
    color: #1565c0;
}

.stat-info {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 22px;
    font-weight: 800;
    color: #17231d;
}

.stat-label {
    font-size: 13px;
    color: #68756d;
    font-weight: 500;
}

/* Filters */
.card {
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: flex-end;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 150px;
}

.search-group {
    flex: 2;
    min-width: 240px;
}

.filter-group label {
    font-size: 12px;
    font-weight: 700;
    color: #17231d;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.form-control {
    padding: 8px 12px;
    border: 1px solid #c8d4cb;
    border-radius: 6px;
    font-size: 14px;
    color: #17231d;
    outline: none;
    transition: border-color 0.2s;
}

.form-control:focus {
    border-color: #146c3a;
}

.btn-group {
    flex-direction: row;
    gap: 8px;
    align-items: flex-end;
}

.btn {
    padding: 9px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: background 0.2s;
}

.btn-primary {
    background: #146c3a;
    color: #ffffff;
}

.btn-primary:hover {
    background: #0f522c;
}

.btn-secondary {
    background: #e7efe8;
    color: #17231d;
}

.btn-secondary:hover {
    background: #d4e2d6;
}

/* Table */
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 750;
        color: #17231d;
    }
}

.showing-text {
    font-size: 13px;
    color: #68756d;
}

.table-wrapper {
    overflow-x: auto;
}

.audit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.audit-table th {
    background: #f4f7f4;
    color: #17231d;
    font-weight: 700;
    text-align: left;
    padding: 10px 14px;
    border-bottom: 2px solid #dce5de;
}

.audit-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #edf2ee;
    vertical-align: middle;
}

.timestamp-cell {
    white-space: nowrap;
    color: #4a5750;
}

.actor-cell {
    display: flex;
    flex-direction: column;
}

.actor-name {
    font-weight: 700;
    color: #17231d;
}

.actor-type {
    font-size: 11px;
    color: #68756d;
}

/* Badges */
.badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.03em;
}

.badge-vote {
    background: #e3f2fd;
    color: #0d47a1;
    border: 1px solid #bbdefb;
}

.badge-green {
    background: #e8f5e9;
    color: #1b5e20;
    border: 1px solid #c8e6c9;
}

.badge-blue {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
}

.badge-orange {
    background: #fff3e0;
    color: #e65100;
    border: 1px solid #ffe0b2;
}

.badge-red {
    background: #ffebee;
    color: #c62828;
    border: 1px solid #ffcdd2;
}

.badge-gray {
    background: #f5f5f5;
    color: #616161;
    border: 1px solid #e0e0e0;
}

/* Platform badge */
.platform-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
}

.platform-mobile {
    background: #f3e5f5;
    color: #6a1b9a;
}

.platform-web {
    background: #e0f7fa;
    color: #006064;
}

.btn-inspect {
    background: transparent;
    border: 1px solid #146c3a;
    color: #146c3a;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-inspect:hover {
    background: #146c3a;
    color: #ffffff;
}

/* Pagination */
.pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid #edf2ee;
}

.btn-page {
    padding: 6px 14px;
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    &:hover:not(:disabled) {
        background: #f4f7f4;
    }
}

/* Modal */
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
    padding: 20px;
}

.modal-card {
    background: #ffffff;
    border-radius: 8px;
    width: 100%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-header {
    padding: 16px 24px;
    border-bottom: 1px solid #dce5de;
    display: flex;
    justify-content: space-between;
    align-items: center;

    h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 800;
        color: #17231d;
    }
}

.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #68756d;
}

.modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    background: #f8faf8;
    padding: 14px;
    border-radius: 6px;
    border: 1px solid #e2ece4;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;

    label {
        font-size: 11px;
        font-weight: 700;
        color: #68756d;
        text-transform: uppercase;
    }
}

.user-agent-section {
    display: flex;
    flex-direction: column;
    gap: 4px;

    label {
        font-size: 12px;
        font-weight: 700;
        color: #17231d;
    }
}

.ua-box {
    background: #272822;
    color: #f8f8f2;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12px;
    word-break: break-all;
}

.diff-section {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.diff-box {
    flex: 1;
    min-width: 300px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.diff-title {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
}

.old-title {
    color: #c62828;
}

.new-title {
    color: #1b5e20;
}

.json-code {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    border-radius: 6px;
    font-family: monospace;
    font-size: 12px;
    max-height: 250px;
    overflow-y: auto;
    margin: 0;
}

.modal-footer {
    padding: 14px 24px;
    border-top: 1px solid #dce5de;
    display: flex;
    justify-content: flex-end;
}

.loading-state,
.empty-state {
    padding: 40px;
    text-align: center;
    color: #68756d;
}

.empty-icon-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 12px;
}

.spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e7efe8;
    border-top-color: #146c3a;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 12px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
