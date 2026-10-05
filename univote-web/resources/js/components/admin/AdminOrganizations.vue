<template>
    <section class="organizations-page">
        <div class="page-header">
            <div>
                <p class="eyebrow">Voter access</p>
                <h1>Organizations</h1>
                <p>Create the groups that can be assigned to voters and elections.</p>
            </div>
        </div>

        <form class="create-form" @submit.prevent="createOrganization">
            <input v-model="newName" class="form-input" placeholder="Full organization name" required />
            <input v-model="newCode" class="form-input code-input" placeholder="Code (e.g. CCS)" maxlength="20" required />
            <button class="btn-primary" type="submit" :disabled="loading">Add organization</button>
        </form>

        <div class="organization-list">
            <article v-for="organization in organizations" :key="organization.id" class="organization-row">
                <div v-if="editingId === organization.id" class="edit-fields">
                    <input v-model="editingName" class="form-input" />
                    <input v-model="editingCode" class="form-input code-input" maxlength="20" />
                </div>
                <div v-else>
                    <strong>{{ organization.name }} <span class="code-badge">{{ organization.code }}</span></strong>
                    <small>{{ organization.voters_count || 0 }} voters assigned</small>
                </div>
                <div class="row-actions">
                    <button v-if="editingId === organization.id" class="btn-primary" @click="saveOrganization(organization)" type="button">Save</button>
                    <button v-else class="btn-secondary" @click="startEditing(organization)" type="button">Edit</button>
                    <button class="btn-danger" @click="removeOrganization(organization)" type="button">Delete</button>
                </div>
            </article>
            <p v-if="!organizations.length" class="empty-state">No organizations yet.</p>
        </div>
    </section>
</template>

<script>
import { adminAPI } from "../../services/api.js";
import { useNotification } from "../../composables/useNotification.js";
import { useConfirmDialog } from "../../composables/useConfirmDialog.js";

export default {
    name: "AdminOrganizations",
    setup() {
        const { error: showError, success: showSuccess } = useNotification();
        const { confirmDangerous: showConfirmDangerous } = useConfirmDialog();
        return { showError, showSuccess, showConfirmDangerous };
    },
    data() {
        return { organizations: [], newName: "", newCode: "", editingId: null, editingName: "", editingCode: "", loading: false };
    },
    async mounted() {
        await this.loadOrganizations();
    },
    methods: {
        async loadOrganizations() {
            try {
                const response = await adminAPI.getOrganizations();
                this.organizations = response.data.organizations || [];
            } catch (error) {
                console.error("Error loading organizations:", error);
            }
        },
        async createOrganization() {
            this.loading = true;
            try {
                const response = await adminAPI.createOrganization({ name: this.newName, code: this.newCode });
                this.organizations.push(response.data.organization);
                this.newName = "";
                this.newCode = "";
                this.showSuccess("Organization created successfully!");
            } catch (error) {
                const errorMessage = error.response?.data?.message || error.message || "Failed to create organization";
                this.showError(errorMessage);
            } finally {
                this.loading = false;
            }
        },
        startEditing(organization) {
            this.editingId = organization.id;
            this.editingName = organization.name;
            this.editingCode = organization.code;
        },
        async saveOrganization(organization) {
            try {
                const response = await adminAPI.updateOrganization(organization.id, { name: this.editingName, code: this.editingCode });
                Object.assign(organization, response.data.organization);
                this.editingId = null;
                this.showSuccess("Organization updated successfully!");
            } catch (error) {
                const errorMessage = error.response?.data?.message || error.message || "Failed to update organization";
                this.showError(errorMessage);
            }
        },
        async removeOrganization(organization) {
            const confirmed = await this.showConfirmDangerous(
                "Are you sure you want to delete this organization? This action cannot be undone.",
                { title: "Delete Organization", confirmText: "Delete" }
            );
            if (!confirmed) return;

            try {
                await adminAPI.deleteOrganization(organization.id);
                this.organizations = this.organizations.filter((item) => item.id !== organization.id);
                this.showSuccess("Organization deleted successfully!");
            } catch (error) {
                const errorMessage = error.response?.data?.message || error.message || "Failed to delete organization";
                this.showError(errorMessage);
            }
        },
    },
};
</script>

<style scoped>
.organizations-page { padding: 20px 0; max-width: 900px; }
.page-header { background: #146c3a; color: #fff; border-radius: 12px; padding: 32px; margin-bottom: 24px; }
.eyebrow { margin: 0 0 8px; opacity: .7; text-transform: uppercase; font-size: 12px; letter-spacing: .08em; }
h1 { margin: 0 0 8px; }
.page-header p:last-child { margin: 0; opacity: .85; }
.create-form, .organization-row { display: flex; gap: 12px; align-items: center; }
.create-form { margin-bottom: 18px; }
.form-input { flex: 1; padding: 12px 14px; border: 1px solid #dce5de; border-radius: 6px; font: inherit; }
.code-input { max-width: 190px; text-transform: uppercase; }
.edit-fields { display: flex; flex: 1; gap: 8px; }
.organization-list { display: grid; gap: 10px; }
.organization-row { justify-content: space-between; padding: 16px; background: #fff; border: 1px solid #dce5de; border-radius: 8px; }
.organization-row strong, .organization-row small { display: block; }
.organization-row small { color: #68756d; margin-top: 4px; }
.code-badge { display: inline-block; margin-left: 8px; padding: 4px 8px; border-radius: 999px; background: #e7efe8; color: #146c3a; font-size: 11px; letter-spacing: .06em; vertical-align: middle; }
.row-actions { display: flex; gap: 8px; }
button { border: 0; border-radius: 6px; padding: 10px 14px; cursor: pointer; font: inherit; }
.btn-primary { background: #146c3a; color: #fff; }
.btn-secondary { background: #e7efe8; color: #146c3a; }
.btn-danger { background: #f8d7da; color: #721c24; }
.empty-state { color: #68756d; }
</style>
