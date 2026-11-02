<template>
    <div class="election-creation-page">
        <!-- Page Header -->
        <div class="page-header">
            <div class="header-content">
                <h1>Create New Election</h1>
                <p>Set up a new election with positions and candidates</p>
            </div>
            <router-link to="/admin/elections" class="btn-link">
                ← Back to Elections
            </router-link>
        </div>

        <!-- Form Container -->
        <div class="form-container">
            <form @submit.prevent="createElection">
                <!-- Basic Information Section -->
                <section class="form-section">
                    <div class="section-header">
                        <h2>Basic Information</h2>
                        <p>Election details</p>
                    </div>

                    <div class="form-group">
                        <label for="title" class="form-label">
                            <span class="required">*</span> Election Title
                        </label>
                        <input
                            v-model="form.title"
                            type="text"
                            id="title"
                            placeholder="e.g., Student President 2025"
                            class="form-input"
                            required
                        />
                        <p class="form-help">
                            Give your election a clear, descriptive title
                        </p>
                    </div>

                    <div class="form-group">
                        <label for="description" class="form-label">
                            Description
                        </label>
                        <textarea
                            v-model="form.description"
                            id="description"
                            placeholder="Optional: Add details about this election, timeline, instructions, etc."
                            class="form-textarea"
                            rows="4"
                        ></textarea>
                        <p class="form-help">
                            Voters will see this when participating
                        </p>
                    </div>

                    <!-- Election Scope / Type Selector -->
                    <div class="form-group">
                        <label class="form-label"><span class="required">*</span> Election Scope</label>
                        <div class="scope-options">
                            <label class="scope-option" :class="{ 'scope-selected': form.election_type === 'all' }">
                                <input type="radio" v-model="form.election_type" value="all" @change="onScopeChange" />
                                <div class="scope-icon scope-icon-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253M3 12c0 .778.099 1.533.284 2.253" /></svg>
                                </div>
                                <div class="scope-text">
                                    <span class="scope-label">Campus-Wide</span>
                                    <span class="scope-desc">All registered voters can participate</span>
                                </div>
                            </label>
                            <label class="scope-option" :class="{ 'scope-selected': form.election_type === 'organization' }">
                                <input type="radio" v-model="form.election_type" value="organization" @change="onScopeChange" />
                                <div class="scope-icon scope-icon-org">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6.75h1.5m-1.5 3h1.5m-1.5 3h1.5M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                                </div>
                                <div class="scope-text">
                                    <span class="scope-label">Organization / Department</span>
                                    <span class="scope-desc">Only voters from a specific department</span>
                                </div>
                            </label>
                            <label class="scope-option" :class="{ 'scope-selected': form.election_type === 'course' }">
                                <input type="radio" v-model="form.election_type" value="course" @change="onScopeChange" />
                                <div class="scope-icon scope-icon-course">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.57 50.57 0 0 0-2.658-.813A59.905 59.905 0 0 1 12 3.493a59.902 59.902 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" /></svg>
                                </div>
                                <div class="scope-text">
                                    <span class="scope-label">Specific Course</span>
                                    <span class="scope-desc">Only voters enrolled in a specific course</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Organization Selector (shown when scope = organization) -->
                    <div v-if="form.election_type === 'organization'" class="form-group scope-sub-field">
                        <label for="organization" class="form-label"><span class="required">*</span> Select Organization</label>
                        <select v-model="form.organization_id" id="organization" class="form-input" required>
                            <option :value="null" disabled>— Choose an organization —</option>
                            <option v-for="org in organizations" :key="org.id" :value="org.id">
                                {{ org.name }} ({{ org.code }})
                            </option>
                        </select>
                        <p class="form-help">Only voters belonging to this organization can vote in this election.</p>
                    </div>

                    <!-- Course Selector (shown when scope = course) -->
                    <div v-if="form.election_type === 'course'" class="form-group scope-sub-field">
                        <label for="course" class="form-label"><span class="required">*</span> Select Course</label>
                        <select v-model="form.course_id" id="course" class="form-input" required>
                            <option :value="null" disabled>— Choose a course —</option>
                            <optgroup v-for="org in organizationsWithCourses" :key="org.id" :label="org.name">
                                <option v-for="course in org.courses" :key="course.id" :value="course.id">
                                    {{ course.name }} ({{ course.code }})
                                </option>
                            </optgroup>
                            <optgroup v-if="unassignedCourses.length > 0" label="Other / Unassigned Courses">
                                <option v-for="course in unassignedCourses" :key="course.id" :value="course.id">
                                    {{ course.name }} ({{ course.code }})
                                </option>
                            </optgroup>
                            <template v-if="organizationsWithCourses.length === 0 && unassignedCourses.length === 0">
                                <option v-for="course in courses" :key="course.id" :value="course.id">
                                    {{ course.name }} ({{ course.code }})
                                </option>
                            </template>
                        </select>
                        <p class="form-help">Only voters enrolled in this course can vote. Organization is automatically determined by the course assignment.</p>
                        <p v-if="courses.length === 0" class="form-help scope-warn">⚠ No courses available.</p>
                    </div>
                </section>

                <!-- Positions & Candidates Section -->
                <section class="form-section">
                    <div class="section-header">
                        <h2>Positions & Candidates</h2>
                        <p>Define positions and add candidates for each</p>
                    </div>

                    <div
                        v-for="(pos, idx) in form.positions"
                        :key="idx"
                        class="position-card"
                    >
                        <!-- Position Header -->
                        <div class="position-header">
                            <div class="position-number">
                                Position {{ idx + 1 }}
                            </div>
                            <button
                                v-if="form.positions.length > 1"
                                type="button"
                                @click="removePosition(idx)"
                                class="btn-remove"
                                title="Remove this position"
                            >
                                🗑 Remove
                            </button>
                        </div>

                        <!-- Position Details -->
                        <div class="position-details">
                            <div class="detail-field">
                                <label
                                    :for="`pos-name-${idx}`"
                                    class="form-label"
                                >
                                    <span class="required">*</span> Position
                                    Name
                                </label>
                                <input
                                    :id="`pos-name-${idx}`"
                                    v-model="pos.name"
                                    type="text"
                                    placeholder="e.g., President, Vice President"
                                    class="form-input"
                                    required
                                />
                            </div>

                            <div class="detail-field">
                                <label
                                    :for="`max-votes-${idx}`"
                                    class="form-label"
                                >
                                    <span class="required">*</span> Max Votes
                                    Per Voter
                                </label>
                                <input
                                    :id="`max-votes-${idx}`"
                                    v-model.number="pos.max_votes"
                                    type="number"
                                    placeholder="1"
                                    min="1"
                                    class="form-input"
                                    required
                                />
                                <p class="form-help">
                                    How many candidates can each voter select
                                    for this position?
                                </p>
                            </div>
                        </div>

                        <!-- Candidates Section -->
                        <div class="candidates-container">
                            <div class="candidates-header">
                                <h4>
                                    Candidates for
                                    {{ pos.name || `Position ${idx + 1}` }}
                                </h4>
                                <span class="candidate-count"
                                    >{{
                                        pos.candidates.filter((c) =>
                                            c.name.trim(),
                                        ).length
                                    }}
                                    added</span
                                >
                            </div>

                            <div
                                v-for="(candidate, cIdx) in pos.candidates"
                                :key="cIdx"
                                class="candidate-row"
                            >
                                <div class="candidate-photo-wrap">
                                    <label
                                        class="candidate-photo-control"
                                        :title="candidate.photoPreview ? 'Change photo' : 'Add candidate photo'"
                                    >
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            class="candidate-photo-input"
                                            aria-label="Upload candidate photo"
                                            @change="onCandidatePhotoSelected(idx, cIdx, $event)"
                                        />
                                        <img
                                            v-if="candidate.photoPreview"
                                            :src="candidate.photoPreview"
                                            alt=""
                                            class="candidate-photo-img"
                                        />
                                        <span v-else class="candidate-photo-placeholder">＋</span>
                                    </label>
                                    <button
                                        v-if="candidate.photoPreview"
                                        type="button"
                                        class="candidate-photo-remove"
                                        title="Remove photo"
                                        @click="removeCandidatePhoto(idx, cIdx)"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div class="candidate-input-wrapper">
                                    <span class="candidate-number">{{
                                        cIdx + 1
                                    }}</span>
                                    <input
                                        v-model="candidate.name"
                                        type="text"
                                        :placeholder="`Candidate ${cIdx + 1} name`"
                                        class="form-input"
                                    />
                                </div>
                                <button
                                    v-if="pos.candidates.length > 1"
                                    type="button"
                                    @click="removeCandidate(idx, cIdx)"
                                    class="btn-remove-candidate"
                                    title="Remove candidate"
                                >
                                    ✕
                                </button>
                            </div>

                            <button
                                type="button"
                                @click="addCandidate(idx)"
                                class="btn-add-candidate"
                            >
                                <span>+ Add Candidate</span>
                            </button>
                        </div>
                    </div>

                    <!-- Add Position Button -->
                    <button
                        type="button"
                        @click="addPosition"
                        class="btn-add-position"
                    >
                        <span>+ Add Position</span>
                    </button>
                </section>

                <!-- Form Actions -->
                <div class="form-actions">
                    <button
                        type="submit"
                        class="btn btn-primary btn-lg"
                        :disabled="loading"
                    >
                        <span v-if="!loading">✓ Create Election</span>
                        <span v-else>
                            <span class="spinner-mini"></span>
                            Creating...
                        </span>
                    </button>
                    <router-link
                        to="/admin/elections"
                        class="btn btn-secondary btn-lg"
                    >
                        Cancel
                    </router-link>
                </div>
            </form>
        </div>
    </div>
</template>

<script>
import { useElectionStore } from "../../stores/electionStore.js";
import { useNotification } from "../../composables/useNotification.js";
import { adminAPI } from "../../services/api.js";

export default {
    name: "AdminCreateElection",
    setup() {
        const electionStore = useElectionStore();
        const { error: showError, success: showSuccess } = useNotification();
        return { electionStore, showError, showSuccess };
    },
    data() {
        return {
            form: {
                title: "",
                description: "",
                election_type: "all",
                organization_id: null,
                course_id: null,
                positions: [
                    {
                        name: "",
                        max_votes: 1,
                        candidates: [{ name: "", photo: null, photoPreview: null }],
                    },
                ],
            },
            loading: false,
            organizations: [],
            courses: [],
        };
    },
    computed: {
        organizationsWithCourses() {
            // Group courses under their organization for the optgroup display
            return this.organizations
                .map(org => ({
                    ...org,
                    courses: this.courses.filter(c => c.organization_id === org.id),
                }))
                .filter(org => org.courses.length > 0);
        },
        unassignedCourses() {
            return this.courses.filter(c => !c.organization_id);
        },
    },
    async mounted() {
        const response = await adminAPI.getOrganizations();
        const orgs = response.data.organizations || [];
        this.organizations = orgs;
        if (response.data.courses && response.data.courses.length > 0) {
            this.courses = response.data.courses;
        } else {
            this.courses = orgs.flatMap(o => (o.courses || []).map(c => ({ ...c, organization_id: o.id })));
        }
    },
    methods: {
        onScopeChange() {
            // Reset selections when scope changes
            this.form.organization_id = null;
            this.form.course_id = null;
        },
        addPosition() {
            this.form.positions.push({
                name: "",
                max_votes: 1,
                candidates: [{ name: "", photo: null, photoPreview: null }],
            });
        },
        removePosition(idx) {
            this.form.positions.splice(idx, 1);
        },
        addCandidate(positionIdx) {
            this.form.positions[positionIdx].candidates.push({ name: "", photo: null, photoPreview: null });
        },
        removeCandidate(positionIdx, candidateIdx) {
            this.form.positions[positionIdx].candidates.splice(candidateIdx, 1);
        },
        onCandidatePhotoSelected(positionIdx, candidateIdx, event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;

            if (!file.type.startsWith("image/")) {
                this.showError("Please select a valid image file (JPG, PNG or WebP).");
                event.target.value = "";
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                this.showError("Candidate photo must be smaller than 2 MB.");
                event.target.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const candidate = this.form.positions[positionIdx].candidates[candidateIdx];
                candidate.photo = e.target.result;
                candidate.photoPreview = e.target.result;
            };
            reader.readAsDataURL(file);
            event.target.value = "";
        },
        removeCandidatePhoto(positionIdx, candidateIdx) {
            const candidate = this.form.positions[positionIdx].candidates[candidateIdx];
            candidate.photo = null;
            candidate.photoPreview = null;
        },
        async createElection() {
            if (!this.form.title) {
                this.showError("Please enter election title");
                return;
            }

            if (this.form.election_type === 'organization' && !this.form.organization_id) {
                this.showError("Please select an organization for this election.");
                return;
            }

            if (this.form.election_type === 'course' && !this.form.course_id) {
                this.showError("Please select a course for this election.");
                return;
            }

            for (let i = 0; i < this.form.positions.length; i++) {
                const position = this.form.positions[i];
                if (!position.name) {
                    this.showError(`Please enter a name for position ${i + 1}`);
                    return;
                }

                if (!position.max_votes || position.max_votes < 1) {
                    this.showError(`Please enter a valid max votes for position: ${position.name}`);
                    return;
                }

                const validCandidates = position.candidates.filter((c) => c.name.trim());
                if (validCandidates.length === 0) {
                    this.showError(`Please add at least one candidate for position: ${position.name}`);
                    return;
                }
            }

            this.loading = true;

            try {
                const formData = {
                    title: this.form.title,
                    description: this.form.description,
                    election_type: this.form.election_type,
                    organization_id: this.form.election_type === 'organization' ? this.form.organization_id : null,
                    course_id: this.form.election_type === 'course' ? this.form.course_id : null,
                    positions: this.form.positions
                        .map((p) => ({
                            name: p.name,
                            max_votes: p.max_votes,
                            candidates: p.candidates
                                .filter((c) => c.name.trim())
                                .map((c) => ({
                                    name: c.name.trim(),
                                    photo: c.photo || null,
                                })),
                        }))
                        .filter((p) => p.name),
                };

                await this.electionStore.createElection(formData);

                this.showSuccess("Election created successfully!");
                this.$router.push("/admin/elections");
            } catch (error) {
                console.error("Error creating election:", error);
                this.showError(
                    "Failed to create election: " +
                        (error.response?.data?.message || error.message),
                );
            } finally {
                this.loading = false;
            }
        },
    },
};
</script>

<style scoped>
.election-creation-page {
    padding: 20px 0;
}

/* ==================== Header ==================== */
.page-header {
    background: #116b27;
    border-radius: 12px;
    padding: 40px;
    margin-bottom: 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 30px;
    color: white;
    box-shadow: 0 4px 20px rgba(13, 71, 161, 0.1);
}

.header-content h1 {
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 8px 0;
    letter-spacing: -0.5px;
}

.header-content p {
    font-size: 16px;
    opacity: 0.95;
    margin: 0;
    font-weight: 400;
}

.btn-link {
    color: white;
    background: rgba(255, 255, 255, 0.15);
    padding: 10px 16px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.2s ease;
    font-size: 14px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    white-space: nowrap;
}

.btn-link:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.4);
}

/* ==================== Form Container ==================== */
.form-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    overflow: hidden;
    max-width: 900px;
    margin: 0 auto;
}

form {
    padding: 40px;
}

/* ==================== Form Sections ==================== */
.form-section {
    margin-bottom: 40px;
    padding-bottom: 40px;
    border-bottom: 1px solid #f0f0f0;
}

.form-section:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
    margin-bottom: 0;
}

.section-header {
    margin-bottom: 30px;
}

.section-header h2 {
    font-size: 20px;
    font-weight: 700;
    color: #1565c0;
    margin: 0 0 8px 0;
    letter-spacing: -0.3px;
}

.section-header p {
    font-size: 14px;
    color: #888;
    margin: 0;
}

/* ==================== Form Groups & Inputs ==================== */
.form-group {
    margin-bottom: 24px;
}

.form-group:last-child {
    margin-bottom: 0;
}

.form-label {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.required {
    color: #d32f2f;
    margin-right: 4px;
}

.form-input,
.form-textarea {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.2s ease;
    background: #fafafa;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    background: white;
    border-color: #1565c0;
    box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.1);
}

.form-textarea {
    resize: vertical;
    min-height: 100px;
}

.form-help {
    font-size: 12px;
    color: #888;
    margin: 8px 0 0 0;
    font-style: italic;
}

/* ==================== Election Scope Selector ==================== */
.scope-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 4px;
}

@media (max-width: 640px) {
    .scope-options { grid-template-columns: 1fr; }
}

.scope-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border: 2px solid #e8e8e8;
    border-radius: 12px;
    padding: 14px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fafafa;
    position: relative;
}

.scope-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    width: 0; height: 0;
}

.scope-option:hover {
    border-color: #116b27;
    background: #f0fdf4;
}

.scope-selected {
    border-color: #116b27 !important;
    background: #f0fdf4 !important;
    box-shadow: 0 0 0 3px rgba(17, 107, 39, 0.12);
}

.scope-icon {
    width: 36px; height: 36px;
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}

.scope-icon svg { width: 20px; height: 20px; }

.scope-icon-all    { background: #e3f2fd; color: #1565c0; }
.scope-icon-org    { background: #f3e5f5; color: #7b1fa2; }
.scope-icon-course { background: #e8f5e9; color: #2e7d32; }

.scope-text { display: flex; flex-direction: column; gap: 3px; }
.scope-label { font-size: 13px; font-weight: 700; color: #1a1a1a; }
.scope-desc  { font-size: 11px; color: #888; line-height: 1.4; }

.scope-sub-field {
    background: #f8fffe;
    border: 1.5px solid #d1fae5;
    border-radius: 10px;
    padding: 16px 18px;
    margin-top: -10px;
}

.scope-warn {
    color: #b45309 !important;
    font-style: normal !important;
    font-weight: 600;
}

/* ==================== Election Scope Selector ==================== */
.scope-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 4px;
}

@media (max-width: 640px) {
    .scope-options { grid-template-columns: 1fr; }
}

.scope-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border: 2px solid #e8e8e8;
    border-radius: 12px;
    padding: 14px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #fafafa;
    position: relative;
}

.scope-option input[type="radio"] {
    position: absolute;
    opacity: 0;
    width: 0; height: 0;
}

.scope-option:hover {
    border-color: #116b27;
    background: #f0fdf4;
}

.scope-selected {
    border-color: #116b27 !important;
    background: #f0fdf4 !important;
    box-shadow: 0 0 0 3px rgba(17, 107, 39, 0.12);
}

.scope-icon {
    width: 36px; height: 36px;
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}

.scope-icon svg { width: 20px; height: 20px; }

.scope-icon-all    { background: #e3f2fd; color: #1565c0; }
.scope-icon-org    { background: #f3e5f5; color: #7b1fa2; }
.scope-icon-course { background: #e8f5e9; color: #2e7d32; }

.scope-text { display: flex; flex-direction: column; gap: 3px; }
.scope-label { font-size: 13px; font-weight: 700; color: #1a1a1a; }
.scope-desc  { font-size: 11px; color: #888; line-height: 1.4; }

.scope-sub-field {
    background: #f8fffe;
    border: 1.5px solid #d1fae5;
    border-radius: 10px;
    padding: 16px 18px;
    margin-top: -10px;
}

.scope-warn {
    color: #b45309 !important;
    font-style: normal !important;
    font-weight: 600;
}

/* ==================== Position Card ==================== */
.position-card {
    background: #f8f9fb;
    border: 2px solid #e8eef5;
    border-radius: 10px;
    padding: 24px;
    margin-bottom: 20px;
    transition: all 0.2s ease;
}

.position-card:hover {
    border-color: #1565c0;
    box-shadow: 0 4px 16px rgba(21, 101, 192, 0.08);
}

.position-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e0e0e0;
}

.position-number {
    font-size: 14px;
    font-weight: 700;
    color: #1565c0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.btn-remove {
    background: #ffebee;
    color: #d32f2f;
    border: 1px solid #ffcdd2;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-remove:hover {
    background: #ffcdd2;
    border-color: #ef5350;
}

/* Position Details */
.position-details {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
}

@media (max-width: 640px) {
    .position-details {
        grid-template-columns: 1fr;
    }
}

.detail-field {
    display: flex;
    flex-direction: column;
}

/* ==================== Candidates Container ==================== */
.candidates-container {
    background: white;
    border: 1px dashed #d0d0d0;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
}

.candidates-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.candidates-header h4 {
    font-size: 14px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.candidate-count {
    font-size: 12px;
    background: #e3f2fd;
    color: #0d47a1;
    padding: 4px 10px;
    border-radius: 12px;
    font-weight: 600;
}

/* Candidate Rows */
.candidate-row {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    align-items: center;
}

.candidate-row:last-child {
    margin-bottom: 16px;
}

.candidate-input-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
}

.candidate-number {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    background: #e3f2fd;
    color: #0d47a1;
    border-radius: 50%;
    font-weight: 700;
    font-size: 12px;
}

.candidate-input-wrapper .form-input {
    flex: 1;
    margin-bottom: 0;
}

.btn-remove-candidate {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    background: #ffebee;
    color: #d32f2f;
    border: 1px solid #ffcdd2;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
}

.btn-remove-candidate:hover {
    background: #ffcdd2;
}

/* Candidate Photo Upload */
.candidate-photo-wrap {
    position: relative;
    flex-shrink: 0;
}

.candidate-photo-control {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 10px;
    border: 2px dashed #1565c0;
    background: #f0f7ff;
    color: #1565c0;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.2s ease;
}

.candidate-photo-control:hover {
    border-color: #0d47a1;
    background: #e3f2fd;
}

.candidate-photo-input {
    display: none;
}

.candidate-photo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.candidate-photo-placeholder {
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
}

.candidate-photo-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: #d32f2f;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

/* Add Buttons */
.btn-add-candidate,
.btn-add-position {
    width: 100%;
    padding: 12px 16px;
    border: 2px dashed #1565c0;
    background: transparent;
    color: #1565c0;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.btn-add-candidate:hover,
.btn-add-position:hover {
    background: #e3f2fd;
    border-color: #0d47a1;
}

.btn-add-position {
    margin-top: 20px;
    padding: 14px 16px;
    font-size: 15px;
}

/* ==================== Form Actions ==================== */
.form-actions {
    display: flex;
    gap: 12px;
    margin-top: 36px;
    padding-top: 30px;
    border-top: 1px solid #f0f0f0;
}

@media (max-width: 640px) {
    .form-actions {
        flex-direction: column;
    }
}

.btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    position: relative;
    overflow: hidden;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background: #116b27;
    color: white;
    box-shadow: 0 4px 12px rgba(13, 71, 161, 0.3);
}

.btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #0a3d91 0%, #0d47a1 100%);
    box-shadow: 0 8px 24px rgba(13, 71, 161, 0.4);
    transform: translateY(-2px);
}

.btn-secondary {
    background: #f0f0f0;
    color: #1a1a1a;
    border: 1px solid #e0e0e0;
}

.btn-secondary:hover {
    background: #e8e8e8;
    border-color: #d0d0d0;
}

.btn-lg {
    padding: 14px 32px;
    font-size: 15px;
    flex: 1;
}

.spinner-mini {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-right: 4px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ==================== Responsive Design ==================== */
@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
        padding: 24px;
    }

    form {
        padding: 24px;
    }

    .section-header h2 {
        font-size: 18px;
    }

    .position-card {
        padding: 16px;
    }

    .candidates-container {
        padding: 16px;
    }
}

@media (max-width: 480px) {
    .page-header {
        padding: 16px;
    }

    .page-header h1 {
        font-size: 24px;
    }

    form {
        padding: 16px;
    }

    .form-actions {
        gap: 8px;
    }

    .btn-lg {
        padding: 12px 16px;
        font-size: 13px;
    }
}
</style>
