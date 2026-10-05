import { createRouter, createWebHistory } from "vue-router";

// Auth pages
import AdminLogin from "../components/auth/AdminLogin.vue";

// Admin pages
import AdminDashboard from "../components/admin/AdminDashboard.vue";
import AdminElections from "../components/admin/AdminElections.vue";
import AdminCreateElection from "../components/admin/AdminCreateElection.vue";
import AdminEditElection from "../components/admin/AdminEditElection.vue";
import AdminVoters from "../components/admin/AdminVoters.vue";
import AdminOrganizations from "../components/admin/AdminOrganizations.vue";
import AdminResults from "../components/admin/AdminResults.vue";
import AdminAnnouncements from "../components/admin/AdminAnnouncements.vue";
import AdminAuditLogs from "../components/admin/AdminAuditLogs.vue";
import AdminProfile from "../components/admin/AdminProfile.vue";

// Layouts
import DashboardLayout from "../components/layouts/DashboardLayout.vue";
import AuthLayout from "../components/layouts/AuthLayout.vue";

// Import Pinia auth store
import { useAuthStore } from "../stores/authStore.js";

const routes = [
    // Auth routes (no authentication required)
    {
        path: "/",
        component: AuthLayout,
        children: [
            {
                path: "",
                redirect: "/admin/login",
            },
            {
                path: "/admin/login",
                name: "admin-login",
                component: AdminLogin,
            },
        ],
    },

    // Admin protected routes
    {
        path: "/admin",
        component: DashboardLayout,
        meta: { requiresAuth: true, role: "admin" },
        children: [
            {
                path: "dashboard",
                name: "admin-dashboard",
                component: AdminDashboard,
            },
            {
                path: "elections",
                name: "admin-elections",
                component: AdminElections,
            },
            {
                path: "elections/create",
                name: "admin-create-election",
                component: AdminCreateElection,
            },
            {
                path: "elections/:id/edit",
                name: "admin-edit-election",
                component: AdminEditElection,
            },
            {
                path: "voters",
                name: "admin-voters",
                component: AdminVoters,
            },
            {
                path: "organizations",
                name: "admin-organizations",
                component: AdminOrganizations,
            },
            {
                path: "results",
                name: "admin-results",
                component: AdminResults,
            },
            {
                path: "announcements",
                name: "admin-announcements",
                component: AdminAnnouncements,
            },
            {
                path: "audit-logs",
                name: "admin-audit-logs",
                component: AdminAuditLogs,
            },
            {
                path: "profile",
                name: "admin-profile",
                component: AdminProfile,
            },
        ],
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

// Authentication guard using Pinia store
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();

    // Check if route requires authentication
    if (to.meta.requiresAuth) {
        // Check if already authenticated
        if (authStore.isAuthenticated) {
            // Verify role matches if required
            if (to.meta.role && to.meta.role !== authStore.role) {
                next(`/${authStore.role}/dashboard` || `/admin/login`);
            } else {
                next();
            }
        } else {
            // Not authenticated, check server status
            const isAuthenticated = await authStore.checkAuthStatus();

            if (isAuthenticated) {
                // Verify role matches if required
                if (to.meta.role && to.meta.role !== authStore.role) {
                    next(`/${authStore.role}/dashboard` || `/admin/login`);
                } else {
                    next();
                }
            } else {
                // Redirect to appropriate login based on route
                next(`/admin/login`);
            }
        }
    } else {
        // Route doesn't require auth, allow access
        next();
    }
});

// Restore authentication state on app initialization
router.beforeResolve(async (to, from, next) => {
    const authStore = useAuthStore();

    // Only check on first load (from is unrecognized)
    if (!from.name && !authStore.isAuthenticated) {
        await authStore.checkAuthStatus();
    }

    next();
});

export default router;
