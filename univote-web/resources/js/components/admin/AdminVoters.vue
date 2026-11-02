<template>
    <div class="voters-management-page">
        <!-- Page Header -->
        <header class="page-header-row">
            <div>
                <span class="page-kicker">Voter Registry</span>
                <h1 class="page-title">Voters Management</h1>
                <p class="page-subtitle">View voter information, track voting status, and manage registration records.</p>
            </div>
            <div class="header-stats">
                <span class="stats-badge font-bold">{{ filteredVoters.length }} Voters Displayed</span>
            </div>
        </header>

        <!-- Filters & Search Bar -->
        <section class="toolbar-card" aria-label="Voter filtering controls">
            <div class="filter-group">
                <label for="orgFilterSelect" class="toolbar-label">Filter by Organization:</label>
                <select
                    id="orgFilterSelect"
                    v-model="selectedOrgFilter"
                    class="filter-select"
                >
                    <option value="all">All Organizations</option>
                    <option
                        v-for="org in organizations"
                        :key="org.id"
                        :value="org.id"
                    >
                        {{ org.name }} ({{ org.code }})
                    </option>
                    <option value="unassigned">Unassigned</option>
                </select>
            </div>

            <div class="filter-group">
                <label for="courseFilterSelect" class="toolbar-label">Filter by Course:</label>
                <select
                    id="courseFilterSelect"
                    v-model="selectedCourseFilter"
                    class="filter-select"
                >
                    <option value="all">All Courses</option>
                    <option
                        v-for="c in availableCourses"
                        :key="c.id || c.code || c.name"
                        :value="c.code || c.name"
                    >
                        {{ c.code || c.name }}<template v-if="c.name && c.code && c.name !== c.code"> ({{ c.name }})</template>
                    </option>
                    <option value="unassigned">Unassigned / No Course</option>
                </select>
            </div>

            <div class="filter-group search-group">
                <label for="voterSearchInput" class="toolbar-label">Search:</label>
                <input
                    id="voterSearchInput"
                    v-model="searchQuery"
                    type="search"
                    placeholder="Search by name, course, email..."
                    class="search-input"
                />
            </div>

            <div class="filter-group">
                <label for="voteStatusFilter" class="toolbar-label">Voting Status:</label>
                <select
                    id="voteStatusFilter"
                    v-model="voteStatusFilter"
                    class="filter-select"
                >
                    <option value="all">All Statuses</option>
                    <option value="voted">Voted</option>
                    <option value="not_voted">Not Voted</option>
                </select>
            </div>
        </section>

        <!-- Voters Table Card -->
        <div v-if="filteredVoters.length > 0" class="voters-container">
            <div class="table-responsive">
                <table class="voters-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Course</th>
                            <th>Organization</th>
                            <th>Voting Status</th>
                            <th class="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="voter in filteredVoters" :key="voter.id">
                            <td class="voter-name-cell">
                                <div class="name-wrapper">
                                    <span class="voter-name">{{ voter.name }}</span>
                                    <span class="voter-email">{{ voter.email }}</span>
                                </div>
                            </td>
                            <td>
                                <span class="voter-course" :title="getVoterCourseText(voter)">{{ getVoterCourseText(voter) }}</span>
                            </td>
                            <td>
                                <span v-if="voter.organization" class="org-pill">
                                    {{ voter.organization.code || voter.organization.name }}
                                </span>
                                <span v-else class="unassigned-pill">Unassigned</span>
                            </td>
                            <td>
                                <span
                                    :class="[
                                        'status-pill',
                                        voter.has_voted ? 'status-voted' : 'status-not-voted',
                                    ]"
                                >
                                    <span class="status-dot"></span>
                                    {{ voter.has_voted ? "Voted" : "Not Voted" }}
                                </span>
                            </td>
                            <td class="actions-cell">
                                <button
                                    type="button"
                                    class="btn btn-sm btn-outline-edit"
                                    title="Edit voter details"
                                    @click="openEditModal(voter)"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    class="btn btn-sm btn-danger"
                                    title="Delete voter"
                                    @click="deleteVoter(voter.id)"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div v-else-if="loading" class="empty-state">
            <p>Loading voter records...</p>
        </div>

        <div v-else class="empty-state">
            <div class="empty-icon-wrap" aria-hidden="true">♙</div>
            <h3>No voters found</h3>
            <p v-if="selectedOrgFilter !== 'all' || selectedCourseFilter !== 'all' || searchQuery || voteStatusFilter !== 'all'">
                Try adjusting your search query, course, or organization filters.
            </p>
            <p v-else>No voters are currently registered in the database.</p>
        </div>

        <!-- Edit Voter Modal -->
        <div v-if="isEditModalOpen" class="modal-backdrop" @click.self="closeEditModal">
            <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                <header class="modal-header">
                    <div>
                        <h3 id="modalTitle" class="modal-title">Edit Voter Information</h3>
                        <p class="modal-subtitle">Update student demographic and organization details safely.</p>
                    </div>
                    <button type="button" class="close-btn" @click="closeEditModal" aria-label="Close modal">×</button>
                </header>

                <form @submit.prevent="saveVoterEdit">
                    <div class="modal-body">
                        <!-- Validation Error Alert -->
                        <div v-if="formError" class="form-alert-error">
                            {{ formError }}
                        </div>

                        <!-- Name -->
                        <div class="form-group">
                            <label for="editName" class="form-label">Full Name <span class="required">*</span></label>
                            <input
                                id="editName"
                                v-model.trim="editForm.name"
                                type="text"
                                class="form-input"
                                :class="{ 'input-error': validationErrors.name }"
                                required
                            />
                            <span v-if="validationErrors.name" class="field-error">{{ validationErrors.name }}</span>
                        </div>

                        <!-- Course -->
                        <div class="form-group">
                            <label for="editCourseSelect" class="form-label">Course / Program</label>
                            <select
                                id="editCourseSelect"
                                v-model="editCourseSelectValue"
                                class="form-input"
                                @change="onEditCourseSelectChange"
                            >
                                <option value="">None / Unassigned</option>
                                <optgroup label="Available Courses">
                                    <option
                                        v-for="c in availableCourses"
                                        :key="c.id || c.code || c.name"
                                        :value="c.code || c.name"
                                    >
                                        {{ c.code || c.name }} <template v-if="c.name && c.code && c.name !== c.code">({{ c.name }})</template>
                                    </option>
                                </optgroup>
                                <option value="__custom__">Custom / Enter Other Course...</option>
                            </select>
                            <input
                                v-if="editCourseSelectValue === '__custom__'"
                                id="editCourseCustom"
                                v-model.trim="editForm.course"
                                type="text"
                                class="form-input custom-course-input"
                                placeholder="Type course code or name (e.g. BS Civil Engineering)"
                            />
                            <p class="field-hint">Select a course or enter a custom course name.</p>
                        </div>

                        <!-- Organization -->
                        <div class="form-group">
                            <label for="editOrganization" class="form-label">Organization</label>
                            <select
                                id="editOrganization"
                                v-model="editForm.organization_id"
                                class="form-input"
                            >
                                <option :value="null">Unassigned</option>
                                <option
                                    v-for="org in organizations"
                                    :key="org.id"
                                    :value="org.id"
                                >
                                    {{ org.name }} ({{ org.code }})
                                </option>
                            </select>
                            <p class="field-hint">Select the college or student organization this voter belongs to.</p>
                        </div>

                        <!-- Readonly Info Note -->
                        <div class="readonly-note">
                            <svg class="info-icon" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                            </svg>
                            <span>Voting history and credentials (email/password) are preserved and unaffected by profile edits.</span>
                        </div>
                    </div>

                    <footer class="modal-footer">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            :disabled="saving"
                            @click="closeEditModal"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="btn btn-primary"
                            :disabled="saving"
                        >
                            {{ saving ? "Saving changes..." : "Save changes" }}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    </div>
</template>

<script>
import { useElectionStore } from "../../stores/electionStore.js";
import { useNotification } from "../../composables/useNotification.js";
import { useConfirmDialog } from "../../composables/useConfirmDialog.js";
import { adminAPI } from "../../services/api.js";

export default {
    name: "AdminVoters",
    data() {
        return {
            organizationOptions: [],
            courseOptions: [],
            selectedOrgFilter: "all",
            selectedCourseFilter: "all",
            searchQuery: "",
            voteStatusFilter: "all",
            isEditModalOpen: false,
            saving: false,
            formError: null,
            validationErrors: {},
            editingVoterId: null,
            editCourseSelectValue: "",
            editForm: {
                name: "",
                course: "",
                course_id: null,
                organization_id: null,
            },
        };
    },
    setup() {
        const electionStore = useElectionStore();
        const { error: showError, success: showSuccess } = useNotification();
        const { confirmDangerous: showConfirmDangerous } = useConfirmDialog();
        return { electionStore, showError, showSuccess, showConfirmDangerous };
    },
    computed: {
        voters() {
            return this.electionStore.voters || [];
        },
        loading() {
            return this.electionStore.isLoading;
        },
        organizations() {
            return this.organizationOptions;
        },
        availableCourses() {
            const list = [...this.courseOptions];
            const knownKeys = new Set(
                list.map((c) => (c.code || c.name || "").toLowerCase().trim()).filter(Boolean)
            );

            // Also include distinct courses from registered voters if not in list
            (this.voters || []).forEach((v) => {
                const raw = typeof v.course === "string" ? v.course.trim() : "";
                if (raw && raw !== "Not Specified") {
                    const key = raw.toLowerCase();
                    if (!knownKeys.has(key)) {
                        knownKeys.add(key);
                        list.push({
                            id: v.course_id || `raw-${key}`,
                            code: raw,
                            name: raw,
                            voters_count: 1,
                        });
                    }
                }
            });

            return list;
        },
        filteredVoters() {
            return this.voters.filter((voter) => {
                // Organization filter
                if (this.selectedOrgFilter === "unassigned") {
                    if (voter.organization_id !== null && voter.organization_id !== undefined) {
                        return false;
                    }
                } else if (this.selectedOrgFilter !== "all") {
                    if (Number(voter.organization_id) !== Number(this.selectedOrgFilter)) {
                        return false;
                    }
                }

                // Course filter
                if (this.selectedCourseFilter === "unassigned") {
                    const cText = this.getVoterCourseText(voter);
                    if (cText && cText !== "—") {
                        return false;
                    }
                } else if (this.selectedCourseFilter !== "all") {
                    const sel = String(this.selectedCourseFilter).toLowerCase().trim();
                    const vCourse = (voter.course || "").toLowerCase().trim();
                    const vRelCode = (voter.course_relation?.code || "").toLowerCase().trim();
                    const vRelName = (voter.course_relation?.name || "").toLowerCase().trim();
                    const vCourseId = voter.course_id ? String(voter.course_id) : null;

                    const matchedCourse = this.availableCourses.find(
                        (c) =>
                            String(c.id) === sel ||
                            (c.code && c.code.toLowerCase().trim() === sel) ||
                            (c.name && c.name.toLowerCase().trim() === sel)
                    );

                    let matches = false;
                    if (matchedCourse) {
                        const targetId = String(matchedCourse.id);
                        const targetCode = (matchedCourse.code || "").toLowerCase().trim();
                        const targetName = (matchedCourse.name || "").toLowerCase().trim();

                        if (vCourseId && vCourseId === targetId) matches = true;
                        if (targetCode && (vCourse === targetCode || vRelCode === targetCode)) matches = true;
                        if (targetName && (vCourse === targetName || vRelName === targetName)) matches = true;
                    } else {
                        if (vCourse === sel || vRelCode === sel || vRelName === sel) matches = true;
                    }

                    if (!matches) {
                        return false;
                    }
                }

                // Voting status filter
                if (this.voteStatusFilter === "voted" && !voter.has_voted) {
                    return false;
                }
                if (this.voteStatusFilter === "not_voted" && voter.has_voted) {
                    return false;
                }

                // Search query
                if (this.searchQuery.trim()) {
                    const query = this.searchQuery.toLowerCase().trim();
                    const name = (voter.name || "").toLowerCase();
                    const email = (voter.email || "").toLowerCase();
                    const courseText = (this.getVoterCourseText(voter) || "").toLowerCase();
                    const orgName = (voter.organization?.name || "").toLowerCase();
                    const orgCode = (voter.organization?.code || "").toLowerCase();

                    return (
                        name.includes(query) ||
                        email.includes(query) ||
                        courseText.includes(query) ||
                        orgName.includes(query) ||
                        orgCode.includes(query)
                    );
                }

                return true;
            });
        },
    },
    mounted() {
        this.loadVoters();
        this.loadOrganizations();
    },
    methods: {
        getVoterCourseText(voter) {
            if (!voter) return "—";
            return voter.course || voter.course_relation?.code || voter.course_relation?.name || "—";
        },
        async loadVoters() {
            try {
                const data = await this.electionStore.loadVoters();
                if (data && (data.courses || data.enrolled_courses)) {
                    this.courseOptions = data.courses || data.enrolled_courses;
                }
            } catch (error) {
                console.error("Error loading voters:", error);
            }
        },
        async loadOrganizations() {
            try {
                const response = await adminAPI.getOrganizations();
                this.organizationOptions = response.data.organizations || [];
            } catch (error) {
                console.error("Error loading organizations:", error);
            }
        },
        openEditModal(voter) {
            this.formError = null;
            this.validationErrors = {};
            this.editingVoterId = voter.id;

            const courseText = voter.course || voter.course_relation?.code || voter.course_relation?.name || "";
            const matched = this.availableCourses.find((c) => {
                if (voter.course_id && c.id === voter.course_id) return true;
                const cCode = (c.code || "").toLowerCase().trim();
                const cName = (c.name || "").toLowerCase().trim();
                const target = courseText.toLowerCase().trim();
                return target && (target === cCode || target === cName);
            });

            if (!courseText) {
                this.editCourseSelectValue = "";
            } else if (matched) {
                this.editCourseSelectValue = matched.code || matched.name;
            } else {
                this.editCourseSelectValue = "__custom__";
            }

            this.editForm = {
                name: voter.name || "",
                course: courseText,
                course_id: voter.course_id ? Number(voter.course_id) : (matched && typeof matched.id === "number" ? matched.id : null),
                organization_id: voter.organization_id ? Number(voter.organization_id) : null,
            };
            this.isEditModalOpen = true;
        },
        onEditCourseSelectChange() {
            if (this.editCourseSelectValue === "__custom__") {
                this.editForm.course_id = null;
            } else if (!this.editCourseSelectValue) {
                this.editForm.course = null;
                this.editForm.course_id = null;
            } else {
                const selected = this.availableCourses.find(
                    (c) => (c.code || c.name) === this.editCourseSelectValue
                );
                if (selected) {
                    this.editForm.course = selected.code || selected.name;
                    this.editForm.course_id = typeof selected.id === "number" ? selected.id : null;
                    if (selected.organization_id && !this.editForm.organization_id) {
                        this.editForm.organization_id = Number(selected.organization_id);
                    }
                }
            }
        },
        closeEditModal() {
            this.isEditModalOpen = false;
            this.editingVoterId = null;
            this.formError = null;
            this.validationErrors = {};
        },
        validateForm() {
            this.validationErrors = {};
            if (!this.editForm.name.trim()) {
                this.validationErrors.name = "Full name is required.";
            }

            return Object.keys(this.validationErrors).length === 0;
        },
        async saveVoterEdit() {
            if (!this.validateForm()) {
                return;
            }

            this.saving = true;
            this.formError = null;

            try {
                const payload = {
                    name: this.editForm.name.trim(),
                    course: this.editForm.course ? this.editForm.course.trim() : null,
                    course_id: this.editForm.course_id || null,
                    organization_id: this.editForm.organization_id ? Number(this.editForm.organization_id) : null,
                };

                const response = await this.electionStore.updateVoter(this.editingVoterId, payload);
                this.showSuccess(response?.message || "Voter updated successfully!");
                this.closeEditModal();
            } catch (error) {
                console.error("Error updating voter:", error);
                const errorData = error.response?.data;
                if (errorData?.errors) {
                    this.validationErrors = Object.keys(errorData.errors).reduce((acc, key) => {
                        acc[key] = errorData.errors[key][0];
                        return acc;
                    }, {});
                }
                this.formError =
                    errorData?.message ||
                    error.message ||
                    "Failed to update voter. Please check the form.";
            } finally {
                this.saving = false;
            }
        },
        formatDate(date) {
            if (!date) return "—";
            return new Date(date).toLocaleDateString();
        },
        async deleteVoter(voterId) {
            const confirmed = await this.showConfirmDangerous(
                "Are you sure you want to delete this voter? This action cannot be undone.",
                {
                    title: "Delete Voter",
                    confirmText: "Delete",
                },
            );

            if (!confirmed) return;

            try {
                await this.electionStore.deleteVoter(voterId);
                this.showSuccess("Voter deleted successfully!");
            } catch (error) {
                console.error("Error deleting voter:", error);
                const errorMessage =
                    error.response?.data?.message ||
                    error.message ||
                    "Failed to delete voter";
                this.showError(errorMessage);
            }
        },
    },
};
</script>

<style scoped>
.voters-management-page {
    color: #17231d;
}

.page-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 24px;
    gap: 16px;
}

.page-kicker {
    margin: 0 0 6px;
    color: #146c3a;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    display: block;
}

.page-title {
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 6px;
    color: #17231d;
    line-height: 1.1;
}

.page-subtitle {
    margin: 0;
    color: #68756d;
    font-size: 14px;
}

.stats-badge {
    display: inline-block;
    padding: 6px 14px;
    background: #e3f3e7;
    color: #146c3a;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
}

/* Toolbar & Filters Card */
.toolbar-card {
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
}

.filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.search-group {
    flex: 1;
    min-width: 220px;
}

.toolbar-label {
    font-size: 12px;
    font-weight: 700;
    color: #43544b;
    white-space: nowrap;
}

.filter-select,
.search-input {
    padding: 7px 12px;
    border: 1px solid #cdd8cf;
    border-radius: 6px;
    font-size: 13px;
    color: #17231d;
    background: #ffffff;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.filter-select:focus,
.search-input:focus {
    border-color: #146c3a;
    box-shadow: 0 0 0 2px rgba(20, 108, 58, 0.15);
}

.search-input {
    width: 100%;
}

/* Table Layout */
.voters-container {
    background: #ffffff;
    border: 1px solid #dce5de;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    overflow: hidden;
}

.table-responsive {
    width: 100%;
    overflow-x: auto;
}

.voters-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.voters-table thead {
    background-color: #fafcfa;
    border-bottom: 2px solid #edf1ed;
}

.voters-table th {
    padding: 14px 16px;
    text-align: left;
    font-weight: 750;
    color: #43544b;
    white-space: nowrap;
}

.voters-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #edf1ed;
    vertical-align: middle;
}

.voters-table tbody tr:hover {
    background-color: #fbfdfb;
}

.voter-name-cell .name-wrapper {
    display: flex;
    flex-direction: column;
}

.voter-name {
    font-weight: 700;
    color: #17231d;
    font-size: 14px;
}

.voter-email {
    color: #68756d;
    font-size: 12px;
}

.voter-age {
    font-weight: 600;
}

.voter-course {
    max-width: 220px;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Sex Badges */
.sex-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 750;
}

.sex-male {
    background: #eff6ff;
    color: #1d4ed8;
}

.sex-female {
    background: #fdf2f8;
    color: #be185d;
}

.sex-other {
    background: #f5f3ff;
    color: #6d28d9;
}

/* Organization Badges */
.org-pill {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 5px;
    background: #e8eeea;
    color: #146c3a;
    font-weight: 750;
    font-size: 12px;
}

.unassigned-pill {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 5px;
    background: #f3f4f6;
    color: #6b7280;
    font-weight: 600;
    font-size: 12px;
}

/* Voting Status Badge */
.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 750;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}

.status-voted {
    background: #e3f3e7;
    color: #146c3a;
}

.status-voted .status-dot {
    background: #146c3a;
}

.status-not-voted {
    background: #fef3c7;
    color: #92400e;
}

.status-not-voted .status-dot {
    background: #d97706;
}

/* Actions */
.text-right {
    text-align: right;
}

.actions-cell {
    text-align: right;
    white-space: nowrap;
}

.actions-cell > * + * {
    margin-left: 8px;
}

.btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.btn-sm {
    padding: 5px 11px;
    font-size: 12px;
}

.btn-outline-edit {
    background: #ffffff;
    border: 1px solid #146c3a;
    color: #146c3a;
}

.btn-outline-edit:hover {
    background: #146c3a;
    color: #ffffff;
}

.btn-danger {
    background-color: #dc2626;
    color: white;
}

.btn-danger:hover {
    background-color: #b91c1c;
}

.btn-primary {
    background-color: #146c3a;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background-color: #0f522c;
}

.btn-secondary {
    background-color: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
    background-color: #e5e7eb;
}

.btn:disabled {
    opacity: 0.6;
    cursor: wait;
}

.empty-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border: 1px solid #dce5de;
    border-radius: 8px;
}

.empty-icon-wrap {
    font-size: 32px;
    margin-bottom: 8px;
    color: #9ca3af;
}

.empty-state h3 {
    margin: 0 0 6px 0;
    color: #17231d;
}

.empty-state p {
    margin: 0;
    color: #68756d;
    font-size: 14px;
}

/* Modal Styling */
.modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(15, 23, 19, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 16px;
    backdrop-filter: blur(2px);
}

.modal-dialog {
    background: #ffffff;
    width: 100%;
    max-width: 520px;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    animation: modalPop 0.2s ease-out;
}

@keyframes modalPop {
    from {
        transform: scale(0.96);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px 16px;
    border-bottom: 1px solid #edf1ed;
}

.modal-title {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 700;
    color: #17231d;
}

.modal-subtitle {
    margin: 0;
    font-size: 13px;
    color: #68756d;
}

.close-btn {
    border: none;
    background: transparent;
    font-size: 24px;
    line-height: 1;
    color: #9ca3af;
    cursor: pointer;
}

.close-btn:hover {
    color: #17231d;
}

.modal-body {
    padding: 20px 24px;
    max-height: 75vh;
    overflow-y: auto;
}

.form-group {
    margin-bottom: 16px;
}

.form-row {
    display: flex;
    gap: 16px;
}

.form-col {
    flex: 1;
}

.form-label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: #43544b;
    margin-bottom: 6px;
}

.required {
    color: #dc2626;
}

.form-input {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid #cdd8cf;
    border-radius: 6px;
    font-size: 13px;
    color: #17231d;
    background: #ffffff;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-input:focus {
    border-color: #146c3a;
    box-shadow: 0 0 0 2px rgba(20, 108, 58, 0.15);
}

.custom-course-input {
    margin-top: 8px;
}

.input-error {
    border-color: #dc2626;
}

.field-error {
    display: block;
    color: #dc2626;
    font-size: 11px;
    font-weight: 600;
    margin-top: 4px;
}

.field-hint {
    margin: 4px 0 0 0;
    font-size: 11px;
    color: #68756d;
}

.form-alert-error {
    padding: 10px 14px;
    background: #fef2f2;
    border: 1px solid #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 16px;
}

.readonly-note {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    background: #f0fdf4;
    border: 1px solid #dcfce7;
    border-radius: 6px;
    font-size: 12px;
    color: #166534;
    line-height: 1.4;
    margin-top: 8px;
}

.info-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 1px;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid #edf1ed;
    background: #fafcfa;
}

@media (max-width: 768px) {
    .page-header-row {
        flex-direction: column;
        align-items: flex-start;
    }
    .toolbar-card {
        flex-direction: column;
        align-items: stretch;
    }
    .filter-group {
        width: 100%;
        justify-content: space-between;
    }
    .filter-select {
        flex: 1;
    }
}
</style>
