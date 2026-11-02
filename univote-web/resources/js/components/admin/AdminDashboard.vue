<template>
    <section class="admin-dashboard">
        <!-- Dashboard Header with Live Controls -->
        <header class="dashboard-heading">
            <div class="heading-text">
                <div class="heading-eyebrow-row">
                    <span class="live-status-dot" :class="{ 'is-active': activeElectionsCount > 0 }"></span>
                    <p class="eyebrow">Election operations</p>
                </div>
                <h1>Control center</h1>
                <p class="heading-copy">Real-time election oversight, voter participation analytics, and operational control.</p>
            </div>

            <div class="heading-actions">
                <!-- Live Sync Status & Auto-refresh Controller -->
                <div class="sync-panel">
                    <div class="sync-indicator">
                        <span class="sync-dot" :class="{ 'syncing': isSyncing }"></span>
                        <span class="sync-label">
                            <template v-if="isSyncing">Syncing...</template>
                            <template v-else-if="lastSyncedAt">Synced {{ lastSyncedAt }}</template>
                            <template v-else>Connected</template>
                        </span>
                    </div>

                    <div class="auto-refresh-box">
                        <label for="autoRefreshSelect" class="sr-only">Auto-refresh rate</label>
                        <select id="autoRefreshSelect" v-model.number="autoRefreshSeconds" @change="onAutoRefreshChange" class="auto-refresh-select">
                            <option :value="0">Auto: Off</option>
                            <option :value="15">Auto: 15s</option>
                            <option :value="30">Auto: 30s</option>
                            <option :value="60">Auto: 60s</option>
                        </select>
                        <span v-if="autoRefreshSeconds > 0" class="countdown-pill" :title="`Next update in ${countdown}s`">
                            {{ countdown }}s
                        </span>
                    </div>
                </div>

                <!-- Manual Refresh Button -->
                <button
                    class="refresh-button"
                    type="button"
                    :disabled="loading || isSyncing"
                    @click="handleManualRefresh"
                    title="Refresh data immediately"
                >
                    <svg class="btn-svg" :class="{ 'spin-anim': isSyncing || loading }" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                    <span>{{ isSyncing ? "Updating..." : "Refresh" }}</span>
                </button>

                <!-- Create Election Primary Action -->
                <router-link to="/admin/elections/create" class="create-button">
                    <svg class="btn-svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    <span>Create election</span>
                </router-link>
            </div>
        </header>

        <!-- Modernized KPI Metrics Grid -->
        <section class="metrics-grid" aria-label="Election metrics">
            <!-- 1. Total Elections -->
            <article class="metric-card card-elections">
                <div class="metric-header">
                    <span class="metric-title">Total Elections</span>
                    <div class="metric-icon-wrap icon-emerald">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z"></path>
                            <polyline points="9 11 12 14 22 4"></polyline>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                        </svg>
                    </div>
                </div>
                <div class="metric-body">
                    <strong class="metric-number">{{ stats.total_elections }}</strong>
                    <div class="metric-tags">
                        <span class="metric-badge badge-emerald" v-if="activeElectionsCount > 0">
                            <span class="dot-live"></span>
                            {{ activeElectionsCount }} live now
                        </span>
                        <span class="metric-badge badge-neutral" v-else>
                            No active polls
                        </span>
                        <span class="metric-footnote">{{ completedElections }} concluded</span>
                    </div>
                </div>
            </article>

            <!-- 2. Registered Voters -->
            <article class="metric-card card-voters">
                <div class="metric-header">
                    <span class="metric-title">Registered Voters</span>
                    <div class="metric-icon-wrap icon-blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                </div>
                <div class="metric-body">
                    <strong class="metric-number">{{ stats.total_voters }}</strong>
                    <div class="metric-tags">
                        <span class="metric-badge badge-blue">
                            {{ participationRate }}% participation
                        </span>
                        <span class="metric-footnote" v-if="stats.completed_profiles !== undefined">
                            {{ stats.completed_profiles }} profile verified
                        </span>
                    </div>
                </div>
            </article>

            <!-- 3. Total Votes Recorded -->
            <article class="metric-card card-votes">
                <div class="metric-header">
                    <span class="metric-title">Votes Tallied</span>
                    <div class="metric-icon-wrap icon-amber">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="metric-body">
                    <strong class="metric-number">{{ stats.total_votes }}</strong>
                    <div class="metric-tags">
                        <span class="metric-badge badge-amber">
                            {{ votesPerElection }} avg / election
                        </span>
                        <span class="metric-footnote">Verified official ballots</span>
                    </div>
                </div>
            </article>

            <!-- 4. Operational Health -->
            <article class="metric-card card-health">
                <div class="metric-header">
                    <span class="metric-title">System Status</span>
                    <div class="metric-icon-wrap icon-purple">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </div>
                </div>
                <div class="metric-body">
                    <strong class="metric-number text-status">{{ activeElectionsCount > 0 ? "Active" : "Ready" }}</strong>
                    <div class="metric-tags">
                        <span class="metric-badge" :class="activeElectionsCount > 0 ? 'badge-emerald' : 'badge-neutral'">
                            <span class="dot-live" v-if="activeElectionsCount > 0"></span>
                            {{ activeElectionsCount > 0 ? `${activeElectionsCount} Active Polls` : "Awaiting Polls" }}
                        </span>
                        <span class="metric-footnote">Biometric &amp; DB Synced</span>
                    </div>
                </div>
            </article>
        </section>

        <!-- ===== LIVE ELECTION POLLS ===== -->
        <section class="polls-section" aria-label="Current election polls">
            <div class="polls-section-header">
                <div class="polls-title-group">
                    <span class="live-badge">
                        <span class="pulse-dot"></span>
                        LIVE ELECTION STANDINGS
                    </span>
                    <h2 class="polls-heading">Current election standings by scope</h2>
                    <p class="polls-subtext">Real-time vote distribution and leading candidates from active organization and course elections.</p>
                </div>
                <div class="polls-controls">
                    <label for="poll-org-filter" class="filter-label">Filter by scope</label>
                    <select id="poll-org-filter" v-model="selectedOrgFilter" class="org-filter-select">
                        <option value="all">All Elections</option>
                        <option value="general">Campus-wide / General</option>
                        <optgroup v-if="availablePollOrgs.length" label="Organizations">
                            <option v-for="org in availablePollOrgs" :key="org.id" :value="org.id">
                                {{ org.name }} ({{ org.code }})
                            </option>
                        </optgroup>
                        <optgroup v-if="availablePollCourses.length" label="Courses">
                            <option
                                v-for="course in availablePollCourses"
                                :key="course.id"
                                :value="`course:${course.id}`"
                            >
                                {{ course.code }}<template v-if="course.name && course.name !== course.code"> ({{ course.name }})</template>
                            </option>
                        </optgroup>
                    </select>
                </div>
            </div>

            <!-- Loading state -->
            <div v-if="loading && !electionPolls.length" class="polls-loading">
                <div class="spinner"></div>
                <p>Loading live poll data…</p>
            </div>

            <!-- No active polls empty state -->
            <div v-else-if="!filteredPolls.length" class="polls-empty">
                <div class="polls-empty-icon-wrap">
                    <svg viewBox="0 0 64 64" fill="none" class="polls-empty-svg">
                        <rect x="10" y="24" width="44" height="32" rx="4" stroke="#8da394" stroke-width="2.5" stroke-dasharray="4 4" fill="#f8faf8" />
                        <path d="M16 24V14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v10" stroke="#146c3a" stroke-width="2.5" />
                        <rect x="24" y="8" width="16" height="6" rx="2" fill="#146c3a" />
                        <path d="M26 36h12" stroke="#8da394" stroke-width="2.5" stroke-linecap="round" />
                    </svg>
                </div>
                <h3>No active elections currently running</h3>
                <p>Launch an election to track candidate standings and ballots live.</p>
                <router-link to="/admin/elections/create" class="create-button">
                    <svg class="btn-svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                    </svg>
                    <span>Create election</span>
                </router-link>
            </div>

            <!-- Election poll cards -->
            <div v-else class="polls-grid">
                <article v-for="poll in filteredPolls" :key="poll.id" class="poll-card">
                    <!-- Card header -->
                    <div class="poll-card-header">
                        <div class="poll-card-meta">
                            <span class="org-badge">
                                <svg class="badge-icon" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 2L2 7v2h16V7L10 2zM3 10v6h2v-6H3zm4 0v6h2v-6H7zm4 0v6h2v-6h-2zm4 0v6h2v-6h-2zM2 17v2h16v-2H2z" />
                                </svg>
                                {{ poll.course ? `${poll.course.code || poll.course.name}${poll.course.name && poll.course.name !== poll.course.code ? ` (${poll.course.name})` : ''}` : poll.organization ? `${poll.organization.name} (${poll.organization.code})` : 'Campus-wide / General' }}
                            </span>
                            <span class="poll-live-chip">
                                <span class="dot-live"></span>
                                Live Poll
                            </span>
                        </div>
                        <h3 class="poll-title">{{ poll.title }}</h3>
                        <p v-if="poll.description" class="poll-description">{{ poll.description }}</p>
                        <div class="poll-stats-row">
                            <span class="stat-chip">
                                <svg class="chip-svg" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M2 5a2 2 0 012-2h8a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm4-1a1 1 0 00-1 1v1h6V5a1 1 0 00-1-1H6zm-2 4v4a1 1 0 001 1h6a1 1 0 001-1V8H4z"/>
                                </svg>
                                {{ poll.total_votes }} ballots cast
                            </span>
                            <span class="stat-chip">
                                <svg class="chip-svg" viewBox="0 0 16 16" fill="currentColor">
                                    <path fill-rule="evenodd" d="M3 3.5a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zM3 7.5a.5.5 0 01.5-.5h9a.5.5 0 010 1h-9a.5.5 0 01-.5-.5zM3 11.5a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5z" clip-rule="evenodd"/>
                                </svg>
                                {{ poll.positions.length }} position{{ poll.positions.length !== 1 ? 's' : '' }}
                            </span>
                        </div>
                    </div>

                    <!-- Positions -->
                    <div class="positions-list">
                        <div v-for="position in poll.positions" :key="position.id" class="position-block">
                            <div class="position-header">
                                <span class="position-title">{{ position.name }}</span>
                                <span class="position-votes">{{ position.total_votes }} vote{{ position.total_votes !== 1 ? 's' : '' }}</span>
                            </div>

                            <!-- No candidates state -->
                            <p v-if="!position.candidates.length" class="no-candidates">No candidates registered for this position.</p>

                            <!-- Candidate rows -->
                            <div v-else class="candidates-list">
                                <div
                                    v-for="candidate in position.candidates"
                                    :key="candidate.id"
                                    class="candidate-row"
                                    :class="{ 'candidate-leading': candidate.is_leading }"
                                >
                                    <span class="rank-badge" :class="`rank-${candidate.rank}`">{{ getRankLabel(candidate.rank) }}</span>

                                    <!-- Avatar / photo -->
                                    <div class="candidate-avatar">
                                        <img v-if="candidate.photo" :src="candidate.photo" :alt="candidate.name" class="candidate-photo" />
                                        <span v-else class="candidate-initials">{{ getInitials(candidate.name) }}</span>
                                    </div>

                                    <!-- Info -->
                                    <div class="candidate-info">
                                        <div class="candidate-name-row">
                                            <span class="candidate-name">{{ candidate.name }}</span>
                                            <span v-if="candidate.is_leading" class="leader-badge">
                                                <svg class="leader-icon" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                                                </svg>
                                                Leader
                                            </span>
                                        </div>
                                        <span v-if="candidate.description" class="candidate-desc">{{ candidate.description }}</span>
                                    </div>

                                    <!-- Vote count + percentage -->
                                    <div class="candidate-result">
                                        <span class="vote-count">{{ candidate.vote_count }}</span>
                                        <span class="vote-pct">{{ candidate.percentage }}%</span>
                                    </div>

                                    <!-- Progress bar -->
                                    <div class="progress-wrap">
                                        <div
                                            class="progress-fill"
                                            :class="{ 'progress-leading': candidate.is_leading }"
                                            :style="{ width: `${candidate.percentage}%` }"
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="poll-card-footer">
                        <router-link :to="`/admin/elections/${poll.id}/edit`" class="poll-manage-link">
                            Manage election
                            <svg class="arrow-svg" viewBox="0 0 16 16" fill="currentColor">
                                <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                            </svg>
                        </router-link>
                        <router-link :to="`/admin/results/${poll.id}`" class="poll-results-link">
                            View results
                            <svg class="arrow-svg" viewBox="0 0 16 16" fill="currentColor">
                                <path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
                            </svg>
                        </router-link>
                    </div>
                </article>
            </div>
        </section>

        <!-- Organization Voter Statistics & Dynamic Charts -->
        <section class="org-stats-section" aria-label="Organization voter statistics">
            <AdminVoterCharts
                :organization-stats="organizationStats"
                :course-stats="courseStats"
                :loading="loading"
                :scoped-filter="selectedOrgFilter"
            />

            <!-- Organization Statistics Table Breakdown -->
            <article class="panel org-table-panel">
                <div class="panel-heading table-panel-header">
                    <div class="table-title-wrap">
                        <p class="panel-kicker">Data Breakdown</p>
                        <h2>Organization voter statistics</h2>
                        <p class="table-subtext">Departmental voting turnout and participation status.</p>
                    </div>

                    <div class="table-toolbar">
                        <!-- Search Box -->
                        <div class="table-search-box">
                            <svg class="search-svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
                            </svg>
                            <input
                                type="text"
                                v-model="tableSearch"
                                placeholder="Search organization..."
                                class="table-search-input"
                            />
                            <button
                                v-if="tableSearch"
                                type="button"
                                @click="tableSearch = ''"
                                class="search-clear-btn"
                                title="Clear search"
                            >
                                &times;
                            </button>
                        </div>

                        <!-- Turnout Filter -->
                        <div class="table-filter-wrap">
                            <label for="turnoutFilterSelect" class="sr-only">Filter by turnout</label>
                            <select id="turnoutFilterSelect" v-model="turnoutFilter" class="table-filter-select">
                                <option value="all">Turnout: All</option>
                                <option value="high">High (&ge; 70%)</option>
                                <option value="mid">Moderate (40% - 69%)</option>
                                <option value="low">Low (&lt; 40%)</option>
                            </select>
                        </div>

                        <!-- Export CSV Button -->
                        <button
                            type="button"
                            class="export-csv-btn"
                            @click="exportOrganizationStatsCSV"
                            title="Export organization statistics to CSV file"
                            :disabled="!filteredOrgStats.length"
                        >
                            <svg class="csv-icon" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                            <span>Export CSV</span>
                        </button>

                        <span class="badge-count">{{ filteredOrgStats.length }} of {{ organizationStats.length }} Orgs</span>
                    </div>
                </div>

                <div v-if="loading && !organizationStats.length" class="panel-loading">Loading organization voter data...</div>
                <div v-else-if="filteredOrgStats.length" class="table-responsive">
                    <table class="org-table">
                        <thead>
                            <tr>
                                <th @click="toggleTableSort('name')" class="sortable-th">
                                    <div class="th-content">
                                        <span>Organization</span>
                                        <span class="sort-icon">{{ getSortIndicator('name') }}</span>
                                    </div>
                                </th>
                                <th @click="toggleTableSort('total_voters')" class="sortable-th text-center">
                                    <div class="th-content text-center">
                                        <span>Total Voters</span>
                                        <span class="sort-icon">{{ getSortIndicator('total_voters') }}</span>
                                    </div>
                                </th>
                                <th @click="toggleTableSort('voted')" class="sortable-th text-center">
                                    <div class="th-content text-center">
                                        <span>Voted</span>
                                        <span class="sort-icon">{{ getSortIndicator('voted') }}</span>
                                    </div>
                                </th>
                                <th @click="toggleTableSort('not_voted')" class="sortable-th text-center">
                                    <div class="th-content text-center">
                                        <span>Not Voted</span>
                                        <span class="sort-icon">{{ getSortIndicator('not_voted') }}</span>
                                    </div>
                                </th>
                                <th @click="toggleTableSort('participation_percentage')" class="sortable-th">
                                    <div class="th-content">
                                        <span>Turnout</span>
                                        <span class="sort-icon">{{ getSortIndicator('participation_percentage') }}</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="org in filteredOrgStats" :key="org.id ?? 'unassigned'">
                                <td class="org-name-cell">
                                    <strong>{{ org.name }}</strong>
                                    <span class="org-code-pill">{{ org.code }}</span>
                                </td>
                                <td class="text-center font-bold">{{ org.total_voters }}</td>
                                <td class="text-center text-voted font-bold">{{ org.voted }}</td>
                                <td class="text-center text-not-voted font-bold">{{ org.not_voted }}</td>
                                <td>
                                    <div class="table-progress">
                                        <div class="table-progress-track">
                                            <div
                                                class="table-progress-bar"
                                                :class="getTurnoutGradeClass(org.participation_percentage)"
                                                :style="{ width: `${org.participation_percentage}%` }"
                                            ></div>
                                        </div>
                                        <span class="table-progress-text" :class="getTurnoutGradeClass(org.participation_percentage)">
                                            {{ org.participation_percentage }}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr class="table-summary-row">
                                <td class="font-bold">Total / Aggregated Average</td>
                                <td class="text-center font-bold">{{ filteredTotals.total }}</td>
                                <td class="text-center text-voted font-bold">{{ filteredTotals.voted }}</td>
                                <td class="text-center text-not-voted font-bold">{{ filteredTotals.not_voted }}</td>
                                <td>
                                    <div class="table-progress">
                                        <div class="table-progress-track">
                                            <div
                                                class="table-progress-bar"
                                                :class="getTurnoutGradeClass(filteredAvgTurnout)"
                                                :style="{ width: `${filteredAvgTurnout}%` }"
                                            ></div>
                                        </div>
                                        <span class="table-progress-text font-bold" :class="getTurnoutGradeClass(filteredAvgTurnout)">
                                            {{ filteredAvgTurnout }}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div v-else class="empty-filter-state">
                    <p>No organizations match your current search or filter criteria.</p>
                    <button type="button" @click="resetTableFilters" class="reset-filter-btn">
                        Reset filters
                    </button>
                </div>
            </article>
        </section>

        <!-- Streamlined Operations & Recent Activity (Removed redundancies) -->
        <section class="dashboard-grid">
            <!-- 1. Quick Operations Panel -->
            <article class="panel action-panel">
                <div class="panel-heading">
                    <div>
                        <p class="panel-kicker">Quick Launch</p>
                        <h2>Operational shortcuts</h2>
                    </div>
                </div>
                <div class="quick-tasks-list">
                    <router-link to="/admin/elections/create" class="action-card">
                        <div class="action-icon-wrap icon-emerald">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <div class="action-card-text">
                            <span class="action-title">Create new election</span>
                            <span class="action-sub">Set positions, configure schedule, and assign candidate slates.</span>
                        </div>
                        <svg class="chevron-svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </router-link>

                    <router-link to="/admin/voters" class="action-card">
                        <div class="action-icon-wrap icon-blue">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                            </svg>
                        </div>
                        <div class="action-card-text">
                            <span class="action-title">Voter registry &amp; facial profiles</span>
                            <span class="action-sub">{{ stats.total_voters }} registered voters &bull; verify profile completions.</span>
                        </div>
                        <svg class="chevron-svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </router-link>

                    <router-link to="/admin/announcements" class="action-card">
                        <div class="action-icon-wrap icon-amber">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <div class="action-card-text">
                            <span class="action-title">Publish announcement</span>
                            <span class="action-sub">Broadcast voting instructions and election bulletins to students.</span>
                        </div>
                        <svg class="chevron-svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </router-link>

                    <router-link to="/admin/audit-logs" class="action-card">
                        <div class="action-icon-wrap icon-purple">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <div class="action-card-text">
                            <span class="action-title">Security &amp; audit trails</span>
                            <span class="action-sub">Inspect login history, ballot integrity records, and administrative actions.</span>
                        </div>
                        <svg class="chevron-svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                        </svg>
                    </router-link>
                </div>
            </article>

            <!-- 2. Recent Elections Panel -->
            <article class="panel recent-panel">
                <div class="panel-heading">
                    <div>
                        <p class="panel-kicker">Records Log</p>
                        <h2>Recent elections</h2>
                    </div>
                    <router-link to="/admin/elections" class="panel-link">View all &rarr;</router-link>
                </div>
                <div v-if="recentElections.length" class="recent-list">
                    <div v-for="election in recentElections" :key="election.id" class="recent-row">
                        <div class="recent-info">
                            <div class="recent-title-line">
                                <h3>{{ election.title }}</h3>
                                <span :class="['status-pill', `status-${election.status}`]">{{ election.status }}</span>
                            </div>
                            <p class="recent-meta">
                                Created {{ formatDate(election.created_at) }} &bull; {{ election.votes_count || 0 }} votes cast
                            </p>
                        </div>
                        <div class="recent-actions">
                            <router-link :to="`/admin/elections/${election.id}/edit`" class="row-action" title="Manage election">
                                Manage
                            </router-link>
                            <router-link v-if="election.status !== 'draft'" :to="`/admin/results/${election.id}`" class="row-action-sub" title="View results">
                                Results
                            </router-link>
                        </div>
                    </div>
                </div>
                <div v-else class="empty-operations">
                    <p>No elections found in record.</p>
                    <router-link to="/admin/elections/create">Create your first election</router-link>
                </div>
            </article>
        </section>
    </section>
</template>

<script>
import { useElectionStore } from "../../stores/electionStore.js";
import { adminAPI } from "../../services/api.js";
import AdminVoterCharts from "./AdminVoterCharts.vue";

export default {
    name: "AdminDashboard",
    components: {
        AdminVoterCharts,
    },
    setup() {
        const electionStore = useElectionStore();
        return { electionStore };
    },
    data() {
        return {
            stats: { total_elections: 0, active_elections: 0, completed_elections: 0, total_voters: 0, total_votes: 0, completed_profiles: 0 },
            organizationStats: [],
            courseStats: [],
            electionPolls: [],
            recentElectionsList: [],
            selectedOrgFilter: "all",
            // Real-time synchronization
            autoRefreshSeconds: 30,
            countdown: 30,
            isSyncing: false,
            lastSyncedAt: null,
            timerInterval: null,
            isInitialLoaded: false,
            // Organization table search, filter & sort
            tableSearch: "",
            turnoutFilter: "all", // all, high, mid, low
            tableSortKey: "total_voters",
            tableSortOrder: "desc",
        };
    },
    computed: {
        loading() {
            // Only show blocking loading on initial mount
            return !this.isInitialLoaded && this.electionStore.isLoading;
        },
        elections() { return this.electionStore.elections || []; },
        activeElections() { return this.elections.filter((e) => e.status === "active"); },
        activeElectionsCount() {
            if (typeof this.stats.active_elections === "number") {
                return this.stats.active_elections;
            }
            if (this.electionPolls && this.electionPolls.length > 0) {
                return this.electionPolls.length;
            }
            return this.activeElections.length;
        },
        completedElections() {
            if (typeof this.stats.completed_elections === "number") {
                return this.stats.completed_elections;
            }
            const total = this.stats.total_elections || 0;
            const active = this.activeElectionsCount || 0;
            return Math.max(0, total - active);
        },
        recentElections() {
            if (this.recentElectionsList && this.recentElectionsList.length > 0) {
                return this.recentElectionsList;
            }
            return [...this.elections].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        },
        participationRate() { return this.stats.total_voters ? Math.min(100, Math.round((this.stats.total_votes / this.stats.total_voters) * 100)) : 0; },
        votesPerElection() { return this.stats.total_elections ? Math.round(this.stats.total_votes / this.stats.total_elections) : 0; },

        availablePollOrgs() {
            const seen = new Map();
            this.electionPolls.forEach((poll) => {
                if (poll.organization && poll.organization.id) {
                    const id = String(poll.organization.id);
                    if (!seen.has(id)) {
                        seen.set(id, {
                            ...poll.organization,
                            id: id // Ensure ID is a string
                        });
                    }
                }
            });
            return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
        },

        availablePollCourses() {
            const seen = new Map();
            this.electionPolls.forEach((poll) => {
                if (poll.course && poll.course.id) {
                    const id = String(poll.course.id);
                    if (!seen.has(id)) {
                        seen.set(id, {
                            ...poll.course,
                            id: id // Ensure ID is a string
                        });
                    }
                }
            });
            return Array.from(seen.values()).sort((a, b) =>
                (a.code || a.name || "").localeCompare(b.code || b.name || "")
            );
        },

        filteredPolls() {
            const filter = String(this.selectedOrgFilter);
            
            if (filter === "all") return this.electionPolls;
            
            if (filter === "general") {
                return this.electionPolls.filter((p) => !p.organization && !p.course);
            }

            if (filter.startsWith("course:")) {
                const courseId = filter.slice("course:".length);
                return this.electionPolls.filter((p) => p.course && String(p.course.id) === courseId);
            }

            // Organization filter: show elections for the org OR courses under the org
            return this.electionPolls.filter((p) => {
                // Direct organization match
                if (p.organization && String(p.organization.id) === filter) return true;
                
                // Course-scoped election under this organization
                if (p.course && String(p.course.organization_id) === filter) return true;
                
                return false;
            });
        },

        // Organization id driven by the "Filter by scope" dropdown.
        // Returns null for "all", "general" and course scopes (courses have no
        // organization rows, so the table/charts stay unscoped in those cases).
        scopedOrgId() {
            const filter = String(this.selectedOrgFilter);
            if (!filter || filter === "all" || filter === "general") return null;
            if (filter.startsWith("course:")) return null;
            return filter;
        },

        filteredOrgStats() {
            let list = [...this.organizationStats];

            // 0. Scope filter — narrow the table to the selected organization
            if (this.scopedOrgId !== null) {
                const target = String(this.scopedOrgId);
                list = list.filter((org) => String(org.id) === target);
            }

            // 1. Text search (Name or Code)
            if (this.tableSearch && this.tableSearch.trim()) {
                const query = this.tableSearch.trim().toLowerCase();
                list = list.filter((org) => {
                    const name = (org.name || "").toLowerCase();
                    const code = (org.code || "").toLowerCase();
                    return name.includes(query) || code.includes(query);
                });
            }

            // 2. Turnout filter
            if (this.turnoutFilter === "high") {
                list = list.filter((org) => (org.participation_percentage || 0) >= 70);
            } else if (this.turnoutFilter === "mid") {
                list = list.filter((org) => {
                    const p = org.participation_percentage || 0;
                    return p >= 40 && p < 70;
                });
            } else if (this.turnoutFilter === "low") {
                list = list.filter((org) => (org.participation_percentage || 0) < 40);
            }

            // 3. Sorting
            list.sort((a, b) => {
                let valA = a[this.tableSortKey];
                let valB = b[this.tableSortKey];

                if (typeof valA === "string") {
                    valA = valA.toLowerCase();
                    valB = (valB || "").toLowerCase();
                    return this.tableSortOrder === "asc"
                        ? valA.localeCompare(valB)
                        : valB.localeCompare(valA);
                }

                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
                return this.tableSortOrder === "asc" ? valA - valB : valB - valA;
            });

            return list;
        },

        filteredTotals() {
            return this.filteredOrgStats.reduce(
                (acc, org) => {
                    acc.total += org.total_voters || 0;
                    acc.voted += org.voted || 0;
                    acc.not_voted += org.not_voted || 0;
                    return acc;
                },
                { total: 0, voted: 0, not_voted: 0 }
            );
        },

        filteredAvgTurnout() {
            if (!this.filteredTotals.total) return 0;
            return Math.round((this.filteredTotals.voted / this.filteredTotals.total) * 100);
        },
    },
    async mounted() {
        await this.loadDashboard();
        this.isInitialLoaded = true;
        this.startAutoRefresh();
    },
    beforeUnmount() {
        this.clearAutoRefresh();
    },
    methods: {
        startAutoRefresh() {
            this.clearAutoRefresh();
            if (this.autoRefreshSeconds <= 0) return;
            this.countdown = this.autoRefreshSeconds;
            this.timerInterval = setInterval(() => {
                if (this.countdown > 1) {
                    this.countdown -= 1;
                } else {
                    this.countdown = this.autoRefreshSeconds;
                    this.loadDashboard(true);
                }
            }, 1000);
        },
        clearAutoRefresh() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },
        onAutoRefreshChange() {
            this.startAutoRefresh();
        },
        async handleManualRefresh() {
            this.clearAutoRefresh();
            await this.loadDashboard(false);
            this.startAutoRefresh();
        },
        async loadDashboard(silent = false) {
            this.isSyncing = true;
            try {
                const [dashboardResponse] = await Promise.all([
                    adminAPI.getDashboard(),
                    this.electionStore.loadAdminElections().catch((err) => {
                        console.error("Error loading admin elections:", err);
                        return { elections: [] };
                    }),
                ]);

                if (dashboardResponse?.data) {
                    if (dashboardResponse.data.stats) {
                        this.stats = { ...this.stats, ...dashboardResponse.data.stats };
                    }
                    if (dashboardResponse.data.organization_stats) {
                        this.organizationStats = dashboardResponse.data.organization_stats;
                    }
                    if (dashboardResponse.data.course_stats) {
                        this.courseStats = dashboardResponse.data.course_stats;
                    }
                    if (dashboardResponse.data.election_polls) {
                        this.electionPolls = dashboardResponse.data.election_polls;
                    }
                    if (dashboardResponse.data.recent_elections) {
                        this.recentElectionsList = dashboardResponse.data.recent_elections;
                    }
                }

                const now = new Date();
                this.lastSyncedAt = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
            } catch (error) {
                console.error("Error loading dashboard:", error);
            } finally {
                this.isSyncing = false;
            }
        },
        formatDate(date) {
            if (!date) return "recently";
            return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        },
        getInitials(name) {
            if (!name) return "?";
            return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
        },
        getRankLabel(rank) {
            if (rank === 1) return "1st";
            if (rank === 2) return "2nd";
            if (rank === 3) return "3rd";
            return `${rank}th`;
        },
        toggleTableSort(key) {
            if (this.tableSortKey === key) {
                this.tableSortOrder = this.tableSortOrder === "asc" ? "desc" : "asc";
            } else {
                this.tableSortKey = key;
                this.tableSortOrder = key === "name" ? "asc" : "desc";
            }
        },
        getSortIndicator(key) {
            if (this.tableSortKey !== key) return "↕";
            return this.tableSortOrder === "asc" ? "▲" : "▼";
        },
        resetTableFilters() {
            this.tableSearch = "";
            this.turnoutFilter = "all";
            this.tableSortKey = "total_voters";
            this.tableSortOrder = "desc";
        },
        getTurnoutGradeClass(pct) {
            if (pct >= 70) return "turnout-high";
            if (pct >= 40) return "turnout-mid";
            return "turnout-low";
        },
        exportOrganizationStatsCSV() {
            const rows = this.filteredOrgStats.length ? this.filteredOrgStats : this.organizationStats;
            if (!rows.length) return;

            const headers = [
                "Organization Name",
                "Organization Code",
                "Total Voters",
                "Voted",
                "Not Voted",
                "Turnout (%)"
            ];

            const csvRows = [
                headers.join(","),
                ...rows.map((org) => [
                    `"${(org.name || "").replace(/"/g, '""')}"`,
                    `"${(org.code || "").replace(/"/g, '""')}"`,
                    org.total_voters || 0,
                    org.voted || 0,
                    org.not_voted || 0,
                    org.participation_percentage || 0
                ].join(","))
            ];

            const csvContent = csvRows.join("\r\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const dateStr = new Date().toISOString().split("T")[0];
            link.href = url;
            link.download = `univote_organization_voter_stats_${dateStr}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },
    },
};
</script>

<style scoped>
/* ─── Base ─────────────────────────────────────────────── */
.admin-dashboard { color: #17231d; }

/* ─── Header ───────────────────────────────────────────── */
.dashboard-heading {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    align-items: flex-end;
    margin-bottom: 28px;
    flex-wrap: wrap;
}
.heading-text { flex: 1; min-width: 280px; }
.heading-eyebrow-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
}
.live-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #94a3b8;
    transition: background 0.2s ease;
}
.live-status-dot.is-active {
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25);
    animation: pulseDot 2s infinite;
}
.eyebrow, .panel-kicker {
    margin: 0;
    color: #146c3a;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    text-transform: uppercase;
}
h1 {
    margin: 0 0 6px;
    font-size: 32px;
    font-weight: 900;
    line-height: 1.15;
    color: #17231d;
    letter-spacing: -0.02em;
}
.heading-copy {
    max-width: 620px;
    margin: 0;
    color: #68756d;
    font-size: 14px;
    line-height: 1.5;
}

/* ─── Header Controls / Sync Panel ─────────────────────── */
.heading-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}
.sync-panel {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 8px;
    padding: 4px 8px 4px 12px;
    height: 40px;
}
.sync-indicator {
    display: flex;
    align-items: center;
    gap: 7px;
}
.sync-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    transition: all 0.2s;
}
.sync-dot.syncing {
    background: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25);
    animation: pulseDot 0.8s infinite;
}
.sync-label {
    font-size: 12px;
    font-weight: 650;
    color: #43544b;
    white-space: nowrap;
}
.auto-refresh-box {
    display: flex;
    align-items: center;
    gap: 6px;
    border-left: 1px solid #edf1ed;
    padding-left: 8px;
}
.auto-refresh-select {
    height: 30px;
    border: none;
    background: transparent;
    font-size: 12px;
    font-weight: 700;
    color: #146c3a;
    cursor: pointer;
    outline: none;
    padding-right: 4px;
}
.countdown-pill {
    font-size: 11px;
    font-weight: 800;
    color: #146c3a;
    background: #e6f4ea;
    border-radius: 999px;
    padding: 2px 7px;
    min-width: 26px;
    text-align: center;
}
.refresh-button {
    height: 40px;
    border-radius: 8px;
    padding: 0 14px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid #cdd8cf;
    background: #ffffff;
    color: #294033;
    transition: all 0.15s ease;
}
.refresh-button:hover:not(:disabled) {
    background: #f8faf8;
    border-color: #b6d6be;
}
.refresh-button:disabled {
    cursor: wait;
    opacity: 0.7;
}
.create-button {
    height: 40px;
    border-radius: 8px;
    padding: 0 16px;
    font: inherit;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    text-decoration: none;
    background: #146c3a;
    border: 1px solid #146c3a;
    color: #ffffff;
    box-shadow: 0 1px 3px rgba(20, 108, 58, 0.2);
    transition: all 0.15s ease;
}
.create-button:hover {
    background: #0f562e;
    border-color: #0f562e;
    box-shadow: 0 2px 6px rgba(20, 108, 58, 0.3);
}
.btn-svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}
.spin-anim {
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulseDot {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
}

/* ─── Metric Cards ─────────────────────────────────────── */
.metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 28px;
}
.metric-card {
    background: #ffffff;
    border: 1px solid #e1e8e3;
    border-radius: 12px;
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}
.metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(20, 108, 58, 0.07);
    border-color: #c4d7c8;
}
.metric-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
}
.metric-title {
    font-size: 13px;
    font-weight: 700;
    color: #55695f;
    letter-spacing: 0.01em;
}
.metric-icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.metric-icon-wrap svg {
    width: 20px;
    height: 20px;
}
.icon-emerald { background: #e8f5ec; color: #146c3a; }
.icon-blue    { background: #eff6ff; color: #1d4ed8; }
.icon-amber   { background: #fef3c7; color: #b45309; }
.icon-purple  { background: #f5f3ff; color: #7c3aed; }

.metric-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
}
.metric-number {
    font-size: 34px;
    font-weight: 900;
    line-height: 1;
    color: #17231d;
    letter-spacing: -0.02em;
}
.text-status { font-size: 28px; }
.metric-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}
.metric-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 750;
    padding: 3px 8px;
    border-radius: 6px;
}
.badge-emerald { background: #e8f5ec; color: #146c3a; }
.badge-blue    { background: #eff6ff; color: #1d4ed8; }
.badge-amber   { background: #fef3c7; color: #b45309; }
.badge-neutral { background: #f1f5f2; color: #55695f; }

.dot-live {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
}
.metric-footnote {
    font-size: 12px;
    font-weight: 600;
    color: #718378;
}

/* ─── Polls Section ────────────────────────────────────── */
.polls-section { margin-bottom: 28px; }
.polls-section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}
.polls-title-group { flex: 1; min-width: 0; }
.polls-heading { font-size: 22px; font-weight: 800; margin: 6px 0 4px; letter-spacing: -0.01em; color: #17231d; }
.polls-subtext { margin: 0; font-size: 13px; color: #68756d; }

.live-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #0f4024;
    color: #6ee7a0;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .08em;
    padding: 5px 12px;
    border-radius: 999px;
}
.pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5);
    animation: pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
}
@keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5); }
    70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
    100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}

.polls-controls { display: flex; flex-direction: column; gap: 5px; }
.filter-label { font-size: 12px; font-weight: 700; color: #68756d; }
.org-filter-select {
    height: 38px;
    padding: 0 12px;
    border: 1px solid #cdd8cf;
    border-radius: 8px;
    background: #ffffff;
    color: #17231d;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    min-width: 240px;
}
.org-filter-select:focus { outline: none; border-color: #146c3a; box-shadow: 0 0 0 3px rgba(20,108,58,.12); }

/* Loading & Empty states */
.polls-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 60px 20px; color: #68756d; font-size: 14px; }
.spinner { width: 32px; height: 32px; border: 3px solid #dce5de; border-top-color: #146c3a; border-radius: 50%; animation: spin 0.8s linear infinite; }

.polls-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 56px 20px;
    text-align: center;
    background: #ffffff;
    border: 1px dashed #dce5de;
    border-radius: 14px;
}
.polls-empty-icon-wrap {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: #f1f5f2;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
}
.polls-empty-svg { width: 40px; height: 40px; }
.polls-empty h3 { margin: 0; font-size: 18px; font-weight: 800; color: #17231d; }
.polls-empty p { margin: 0; font-size: 13px; color: #68756d; max-width: 380px; }

/* Polls grid */
.polls-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(480px, 1fr)); gap: 18px; }
.poll-card {
    border: 1px solid #dce5de;
    border-radius: 12px;
    background: #ffffff;
    overflow: hidden;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.poll-card:hover { box-shadow: 0 6px 24px rgba(20,108,58,.08); transform: translateY(-2px); }

.poll-card-header {
    padding: 20px 22px 16px;
    border-bottom: 1px solid #edf1ed;
    background: linear-gradient(135deg, #f7fbf8 0%, #ffffff 100%);
}
.poll-card-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.org-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #e3f3e7;
    color: #0e5930;
    font-size: 12px;
    font-weight: 750;
    padding: 4px 11px;
    border-radius: 999px;
}
.badge-icon { width: 14px; height: 14px; flex-shrink: 0; }
.poll-live-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #fef2f2;
    color: #dc2626;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 999px;
    letter-spacing: .02em;
}
.poll-title { font-size: 18px; font-weight: 800; margin: 0 0 5px; color: #17231d; }
.poll-description { font-size: 13px; color: #68756d; margin: 0 0 12px; line-height: 1.45; }
.poll-stats-row { display: flex; gap: 10px; flex-wrap: wrap; }
.stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: #f4f7f5;
    color: #43544b;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 6px;
}
.chip-svg { width: 13px; height: 13px; color: #68756d; }

/* Positions */
.positions-list { padding: 0 22px 8px; }
.position-block { padding: 16px 0; border-bottom: 1px solid #f0f4f1; }
.position-block:last-child { border-bottom: none; }
.position-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.position-title { font-size: 13px; font-weight: 800; color: #146c3a; text-transform: uppercase; letter-spacing: .06em; }
.position-votes { font-size: 12px; font-weight: 700; color: #68756d; background: #f4f7f5; padding: 3px 9px; border-radius: 6px; }
.no-candidates { font-size: 13px; color: #9eada6; padding: 8px 0; margin: 0; }

/* Candidates */
.candidates-list { display: grid; gap: 10px; }
.candidate-row {
    display: grid;
    grid-template-columns: 38px 42px 1fr auto;
    grid-template-rows: auto auto;
    column-gap: 12px;
    row-gap: 6px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 8px;
    background: #fafcfa;
    border: 1px solid #edf1ed;
    transition: background 0.15s ease;
}
.candidate-row:hover { background: #f3f8f4; }
.candidate-leading { background: linear-gradient(135deg, #f0faf4 0%, #e8f7ee 100%); border-color: #b2dfc2; }

/* Rank badge */
.rank-badge {
    grid-column: 1; grid-row: 1;
    align-self: center;
    display: inline-flex; justify-content: center; align-items: center;
    font-size: 11px; font-weight: 900; min-width: 34px; height: 24px;
    border-radius: 6px; text-align: center;
}
.rank-1 { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
.rank-2 { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.rank-3 { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
.rank-badge:not(.rank-1):not(.rank-2):not(.rank-3) { background: #f4f7f5; color: #68756d; }

/* Avatar */
.candidate-avatar {
    grid-column: 2; grid-row: 1;
    width: 42px; height: 42px; border-radius: 50%; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: #e3f3e7; flex-shrink: 0;
}
.candidate-photo { width: 100%; height: 100%; object-fit: cover; }
.candidate-initials { font-size: 14px; font-weight: 800; color: #146c3a; }

/* Info */
.candidate-info { grid-column: 3; grid-row: 1; min-width: 0; }
.candidate-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.candidate-name { font-size: 14px; font-weight: 750; color: #17231d; }
.leader-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    background: #fef9c3;
    color: #854d0e;
    border: 1px solid #fde047;
    padding: 2px 7px;
    border-radius: 999px;
}
.leader-icon { width: 12px; height: 12px; }
.candidate-desc { font-size: 12px; color: #68756d; display: block; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; }

/* Vote count */
.candidate-result { grid-column: 4; grid-row: 1; text-align: right; white-space: nowrap; }
.vote-count { display: block; font-size: 16px; font-weight: 900; color: #17231d; line-height: 1.2; }
.vote-pct { display: block; font-size: 12px; font-weight: 700; color: #68756d; }

/* Progress bar */
.progress-wrap {
    grid-column: 2 / -1; grid-row: 2;
    height: 6px; background: #e8eeea; border-radius: 999px; overflow: hidden;
}
.progress-fill {
    height: 100%; border-radius: inherit;
    background: linear-gradient(90deg, #5cb483, #146c3a);
    transition: width 0.6s cubic-bezier(.4,0,.2,1);
    min-width: 2px;
}
.progress-leading { background: linear-gradient(90deg, #34d399, #059669); }

/* Card footer */
.poll-card-footer {
    display: flex; align-items: center; justify-content: flex-end; gap: 16px;
    padding: 14px 22px;
    border-top: 1px solid #edf1ed;
    background: #fafcfa;
}
.poll-manage-link, .poll-results-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    color: #146c3a;
    transition: color 0.15s ease;
}
.poll-manage-link:hover { color: #0e4f2b; }
.poll-results-link { color: #68756d; }
.poll-results-link:hover { color: #294033; }
.arrow-svg { width: 14px; height: 14px; }

/* ─── Org Stats Table ─────────────────────────────────── */
.org-stats-section { margin-bottom: 28px; }
.org-table-panel { margin-top: 20px; }
.table-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 16px;
}
.table-title-wrap { flex: 1; min-width: 260px; }
.table-subtext { margin: 2px 0 0; font-size: 13px; color: #68756d; }
.table-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
.table-search-box {
    position: relative;
    display: flex;
    align-items: center;
}
.search-svg {
    position: absolute;
    left: 10px;
    width: 15px;
    height: 15px;
    color: #8da394;
    pointer-events: none;
}
.table-search-input {
    height: 36px;
    padding: 0 28px 0 32px;
    border: 1px solid #cdd8cf;
    border-radius: 8px;
    font-size: 13px;
    color: #17231d;
    background: #ffffff;
    width: 190px;
    transition: all 0.15s ease;
}
.table-search-input:focus {
    outline: none;
    border-color: #146c3a;
    box-shadow: 0 0 0 3px rgba(20, 108, 58, 0.12);
    width: 220px;
}
.search-clear-btn {
    position: absolute;
    right: 8px;
    background: none;
    border: none;
    font-size: 16px;
    color: #94a3b8;
    cursor: pointer;
    line-height: 1;
    padding: 2px;
}
.search-clear-btn:hover { color: #17231d; }

.table-filter-wrap { display: flex; align-items: center; }
.table-filter-select {
    height: 36px;
    padding: 0 10px;
    border: 1px solid #cdd8cf;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 650;
    color: #294033;
    background: #ffffff;
    cursor: pointer;
    outline: none;
}
.table-filter-select:focus {
    border-color: #146c3a;
    box-shadow: 0 0 0 3px rgba(20, 108, 58, 0.12);
}

.export-csv-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 12px;
    border: 1px solid #146c3a;
    border-radius: 8px;
    background: #f0faf3;
    color: #146c3a;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
}
.export-csv-btn:hover:not(:disabled) {
    background: #146c3a;
    color: #ffffff;
}
.export-csv-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.csv-icon { width: 14px; height: 14px; }
.badge-count { font-size: 12px; font-weight: 700; color: #146c3a; background: #e3f3e7; padding: 4px 10px; border-radius: 999px; }

.table-responsive { width: 100%; overflow-x: auto; }
.org-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.org-table th {
    padding: 12px 14px;
    text-align: left;
    font-weight: 750;
    color: #43544b;
    border-bottom: 2px solid #edf1ed;
    background: #fafcfa;
}
.sortable-th {
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
}
.sortable-th:hover {
    background: #f1f6f2;
    color: #146c3a;
}
.th-content {
    display: inline-flex;
    align-items: center;
    gap: 5px;
}
.sort-icon {
    font-size: 11px;
    color: #146c3a;
    opacity: 0.7;
}
.sortable-th:hover .sort-icon { opacity: 1; }

.org-table td { padding: 12px 14px; border-bottom: 1px solid #edf1ed; color: #17231d; }
.org-table tbody tr:hover { background: #fbfdfb; }
.org-name-cell { display: flex; align-items: center; gap: 8px; }
.org-code-pill { background: #e8eeea; color: #294033; font-size: 11px; font-weight: 750; padding: 2px 7px; border-radius: 4px; }
.text-center { text-align: center; }
.font-bold { font-weight: 750; }
.text-voted { color: #10b981; }
.text-not-voted { color: #f59e0b; }

.table-progress { display: flex; align-items: center; gap: 10px; min-width: 140px; }
.table-progress-track {
    flex: 1;
    height: 7px;
    background: #e8eeea;
    border-radius: 999px;
    overflow: hidden;
}
.table-progress-bar {
    height: 100%;
    border-radius: inherit;
    transition: width 0.4s ease;
}
.table-progress-bar.turnout-high { background: linear-gradient(90deg, #34d399, #10b981); }
.table-progress-bar.turnout-mid  { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.table-progress-bar.turnout-low  { background: linear-gradient(90deg, #f87171, #ef4444); }

.table-progress-text { font-size: 12px; font-weight: 800; }
.table-progress-text.turnout-high { color: #059669; }
.table-progress-text.turnout-mid  { color: #d97706; }
.table-progress-text.turnout-low  { color: #dc2626; }


/* Table Summary Footer */
.table-summary-row {
    background: #f7faf8;
    border-top: 2px solid #dce5de;
}
.table-summary-row td {
    padding: 14px 14px;
    border-bottom: none;
    color: #17231d;
}

/* Empty filter state */
.empty-filter-state {
    padding: 40px 20px;
    text-align: center;
    color: #68756d;
    font-size: 14px;
}
.empty-filter-state p { margin-bottom: 12px; }
.reset-filter-btn {
    padding: 7px 16px;
    background: #146c3a;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    transition: background 0.15s;
}
.reset-filter-btn:hover { background: #0f562e; }

/* ─── Streamlined Bottom Operations Grid ──────────────── */
.dashboard-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(320px, 1fr);
    gap: 20px;
}
.panel {
    min-width: 0;
    padding: 22px;
    border: 1px solid #dce5de;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
}
.panel-heading h2 { margin: 0; font-size: 18px; font-weight: 800; color: #17231d; }
.panel-link {
    color: #146c3a;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    white-space: nowrap;
    transition: color 0.15s ease;
}
.panel-link:hover { color: #0e4f2b; }

/* Quick Operations List */
.quick-tasks-list { display: grid; gap: 10px; }
.action-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    border: 1px solid #edf1ed;
    border-radius: 10px;
    background: #fbfdfb;
    text-decoration: none;
    color: #17231d;
    transition: all 0.15s ease;
}
.action-card:hover {
    background: #f3f8f4;
    border-color: #b6d6be;
    transform: translateX(2px);
}
.action-icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.action-icon-wrap svg { width: 18px; height: 18px; }
.action-card-text { flex: 1; min-width: 0; }
.action-title {
    display: block;
    font-size: 14px;
    font-weight: 750;
    color: #17231d;
    margin-bottom: 2px;
}
.action-sub {
    display: block;
    font-size: 12px;
    color: #68756d;
    line-height: 1.4;
}
.chevron-svg {
    width: 18px;
    height: 18px;
    color: #94a3b8;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
.action-card:hover .chevron-svg {
    color: #146c3a;
    transform: translateX(2px);
}

/* Recent Elections List */
.recent-list { display: grid; gap: 10px; }
.recent-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #edf1ed;
    border-radius: 8px;
    background: #fafcfa;
    transition: background 0.15s;
}
.recent-row:hover { background: #f4f8f5; }
.recent-info { flex: 1; min-width: 0; }
.recent-title-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px; }
.recent-title-line h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 750;
    color: #17231d;
}
.recent-meta { margin: 0; color: #68756d; font-size: 12px; }
.recent-actions { display: flex; align-items: center; gap: 8px; }
.row-action {
    border: 1px solid #cdd8cf;
    border-radius: 6px;
    padding: 5px 10px;
    color: #294033;
    font-size: 12px;
    font-weight: 750;
    text-decoration: none;
    background: #ffffff;
    transition: all 0.15s;
}
.row-action:hover {
    background: #eef5f0;
    border-color: #146c3a;
    color: #146c3a;
}
.row-action-sub {
    color: #68756d;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    padding: 5px 8px;
}
.row-action-sub:hover { color: #146c3a; }

.status-pill {
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 750;
    text-transform: capitalize;
}
.status-active { background: #e3f3e7; color: #146c3a; }
.status-ended, .status-closed { background: #eef0ee; color: #59665e; }
.status-draft { background: #fff2d6; color: #93620d; }

.empty-operations, .panel-loading { padding: 26px 0 6px; color: #68756d; font-size: 14px; text-align: center; }
.empty-operations p { margin-bottom: 8px; }
.empty-operations a { color: #146c3a; font-weight: 750; }

/* ─── Responsive ──────────────────────────────────────── */
@media (max-width: 1200px) {
    .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dashboard-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
    .dashboard-heading { align-items: flex-start; flex-direction: column; }
    .heading-actions { width: 100%; justify-content: flex-start; }
    .polls-section-header { flex-direction: column; align-items: flex-start; }
    .polls-grid { grid-template-columns: 1fr; }
    .org-filter-select { min-width: 100%; }
    .candidate-row { grid-template-columns: 34px 38px 1fr auto; }
}
@media (max-width: 480px) {
    .metrics-grid { grid-template-columns: 1fr; }
    .panel, .metric-card { padding: 16px; }
    .sync-panel { width: 100%; justify-content: space-between; }
    .heading-actions > * { flex: 1; }
    .recent-row { flex-direction: column; align-items: flex-start; gap: 8px; }
    .recent-actions { width: 100%; justify-content: flex-end; }
}
</style>
