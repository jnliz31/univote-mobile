<template>
    <div class="dashboard-container" :class="{ 'admin-workspace': userRole === 'admin' }">
        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <router-link
                    to="/admin/dashboard"
                    class="sidebar-logo"
                >
                    <img src="/images/univote-logo.jpg" alt="Univote logo" />
                    Univote
                </router-link>
            </div>

            <nav class="sidebar-nav">
                <!-- Admin Sidebar -->
                <template v-if="userRole === 'admin'">
                    <p class="nav-section-label">Workspace</p>
                    <router-link
                        to="/admin/dashboard"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/dashboard' ? 'active' : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">⌂</span>
                        Home
                    </router-link>
                    <router-link
                        to="/admin/elections"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path.includes('/admin/elections')
                                ? 'active'
                                : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">▤</span>
                        Manage Election
                    </router-link>
                    <router-link
                        to="/admin/elections/create"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/elections/create'
                                ? 'active'
                                : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">+</span>
                        Create Election
                    </router-link>
                    <router-link
                        to="/admin/voters"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/voters' ? 'active' : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">♙</span>
                        Voters
                    </router-link>
                    <router-link
                        to="/admin/organizations"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/organizations' ? 'active' : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">◎</span>
                        Organizations
                    </router-link>
                    <router-link
                        to="/admin/results"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/results' ? 'active' : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">▣</span>
                        Results
                    </router-link>
                    <router-link
                        to="/admin/announcements"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/announcements'
                                ? 'active'
                                : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">▤</span>
                        Announcements
                    </router-link>
                    <router-link
                        to="/admin/audit-logs"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/audit-logs'
                                ? 'active'
                                : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">🛡</span>
                        Audit Logs
                    </router-link>
                    <router-link
                        to="/admin/profile"
                        class="nav-item"
                        active-class="active"
                        :exact-active-class="
                            $route.path === '/admin/profile'
                                ? 'active'
                                : ''
                        "
                    >
                        <span class="nav-icon" aria-hidden="true">◉</span>
                        Profile
                    </router-link>
                </template>
            </nav>

            <div class="sidebar-footer">
                <button @click="logout" class="btn-logout">
                    Logout
                </button>
                <div class="copyright">
                    © 2025 Univote. All rights reserved.
                </div>
            </div>
        </aside>
        <!-- Main Content -->
        <main class="main-content">
            <div class="top-bar">
                <div class="top-bar-left"><div class="top-bar-title">{{ pageTitle }}</div></div>
                <div class="top-bar-right">

                        <router-link to="/admin/elections/create" class="top-bar-action">+ New election</router-link>
                        <router-link to="/admin/profile" class="admin-identity" style="text-decoration: none;">
                            <img
                                v-if="authStore.user?.profile_picture_url"
                                :src="authStore.user.profile_picture_url"
                                class="admin-avatar-img"
                                alt="Profile"
                            />
                            <span v-else class="admin-avatar">{{ adminInitial }}</span>
                            <span>{{ authStore.user?.name || 'Administrator' }}</span>
                        </router-link>
                </div>
            </div>

            <div class="content-area">
                <!-- Alert messages -->
                <div v-if="message" :class="['alert', `alert-${message.type}`]">
                    {{ message.text }}
                </div>

                <router-view :key="$route.fullPath" />
            </div>
        </main>
    </div>
</template>

<script>
import { useAuthStore } from "../../stores/authStore.js";

export default {
    name: "DashboardLayout",
    setup() {
        const authStore = useAuthStore();
        return { authStore };
    },
    data() {
        return {
            pageTitle: "Dashboard",
            message: null,
        };
    },
    computed: {
        userRole() {
            return this.authStore.role || "admin";
        },
        adminInitial() {
            return (this.authStore.user?.name || "A").trim().charAt(0).toUpperCase();
        },
    },
    watch: {
        $route() {
            this.updatePageTitle();
        },
    },
    mounted() {
        this.updatePageTitle();
    },
    methods: {
        updatePageTitle() {
            const titles = {
                "/voter/dashboard": "Welcome",
                "/voter/vote": "Vote now",
                "/voter/votes": "View Votes",
                "/voter/results": "View Results",
                "/voter/profile": "Profile",
                "/admin/dashboard": "Dashboard",
                "/admin/elections": "Manage Elections",
                "/admin/elections/create": "Create Election",
                "/admin/voters": "Voters",
                "/admin/organizations": "Organizations",
                "/admin/results": "Results",
                "/admin/announcements": "Announcements",
                "/admin/audit-logs": "Audit Logs System",
                "/admin/profile": "Profile",
            };
            this.pageTitle = titles[this.$route.path] || "Dashboard";
        },
        async logout() {
            try {
                await this.authStore.logout();
                this.$router.push("/admin/login");
            } catch (error) {
                console.error("Logout error:", error);
                // Force logout anyway
                await this.authStore.logout();
                this.$router.push("/admin/login");
            }
        },
    },
};
</script>

<style scoped>
.dashboard-container {
    display: flex;
    min-height: 100vh;
    width: 100%;
}

.sidebar {
    width: 260px;
    background-color: #146c3a;
    color: white;
    display: flex;
    flex-direction: column;
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 1000;
}

.sidebar::-webkit-scrollbar {
    width: 6px;
}

.sidebar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
}

.sidebar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
}

.sidebar-header {
    padding: 30px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 24px;
    font-weight: 600;
    color: white;
    text-decoration: none;
}

.sidebar-logo img {
    width: 42px;
    height: 42px;
    object-fit: cover;
    border-radius: 6px;
}

.sidebar-nav {
    flex: 1;
    padding: 20px 0;
}

.nav-item {
    display: block;
    padding: 20px 20px;
    color: white;
    text-decoration: none;
    transition: background-color 0.2s;
    font-size: 16px;
}

.nav-icon {
    display: inline-block;
    width: 24px;
    margin-right: 8px;
    text-align: center;
    font-size: 17px;
    line-height: 1;
}

.nav-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
    background-color: #146c3a;
    border-left: 4px solid white;
}

.sidebar-footer {
    padding: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-logout {
    width: 100%;
    padding: 12px;
    background-color: white;
    color: #1e5128;
    border: none;
    border-radius: 25px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s;
}

.btn-logout:hover {
    background-color: #f0f0f0;
}

.copyright {
    text-align: center;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 15px;
}

.main-content {
    margin-left: 260px;
    width: calc(100% - 260px);
    min-height: 100vh;
    background-color: #f5f5f5;
}

.top-bar {
    background-color: #146c3a;
    color: white;
    padding: 15px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.top-bar-title {
    font-size: 18px;
    font-weight: 500;
}

.search-box {
    background: white;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #ddd;
    font-size: 14px;
    width: 250px;
}

.content-area {
    padding: 40px;
    width: 100%;
    max-width: 100%;
}

.alert {
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    border-left: 4px solid;
}

.alert-success {
    background: #d4edda;
    color: #155724;
    border-left-color: #28a745;
}

.alert-error {
    background: #f8d7da;
    color: #721c24;
    border-left-color: #dc3545;
}

.alert-info {
    background: #d1ecf1;
    color: #0c5460;
    border-left-color: #17a2b8;
}

/* Operational admin workspace */
.admin-workspace {
    --admin-ink: #17231d;
    --admin-muted: #68756d;
    --admin-line: #dce5de;
    --admin-surface: #f4f7f4;
    --admin-green: #146c3a;
    --admin-deep-green: #146c3a;
    --admin-lime: #d9ef72;
}

.admin-workspace .sidebar {
    width: 278px;
    background: var(--admin-deep-green);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    padding: 18px 12px;
}

.admin-workspace .sidebar-header {
    border: 0;
    padding: 8px 10px 30px;
}

.admin-workspace .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 21px;
    font-weight: 750;
}

.nav-section-label {
    margin: 4px 14px 10px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.admin-workspace .sidebar-nav {
    padding: 0;
}

.admin-workspace .nav-item {
    position: relative;
    margin: 3px 0;
    padding: 12px 14px;
    border-left: 0;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.76);
    font-size: 14px;
    font-weight: 600;
}

.admin-workspace .nav-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.admin-workspace .nav-item.active {
    background: rgba(217, 239, 114, 0.14);
    color: var(--admin-lime);
    border-left: 0;
}

.admin-workspace .nav-item.active::before {
    content: "";
    position: absolute;
    left: 0;
    top: 11px;
    bottom: 11px;
    width: 3px;
    border-radius: 3px;
    background: var(--admin-lime);
}

.admin-workspace .sidebar-footer {
    border-top-color: rgba(255, 255, 255, 0.1);
    padding: 18px 10px 6px;
}

.admin-workspace .btn-logout {
    border-radius: 6px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    font-size: 13px;
}

.admin-workspace .main-content {
    margin-left: 278px;
    width: calc(100% - 278px);
    background: var(--admin-surface);
}

.admin-workspace .top-bar {
    min-height: 72px;
    padding: 14px 34px;
    background: rgba(255, 255, 255, 0.92);
    color: var(--admin-ink);
    border-bottom: 1px solid var(--admin-line);
    box-shadow: none;
}

.admin-workspace .top-bar-title {
    font-size: 14px;
    font-weight: 700;
}

.top-bar-left {
    display: flex;
    align-items: center;
    gap: 12px;
}


.admin-workspace .top-bar-right {
    display: flex;
    align-items: center;
    gap: 18px;
}

.top-bar-action {
    padding: 9px 13px;
    border-radius: 6px;
    background: var(--admin-green);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
}

.admin-identity {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--admin-muted);
    font-size: 13px;
    font-weight: 600;
}

.admin-avatar {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #e7efe8;
    color: var(--admin-green);
    font-size: 12px;
    font-weight: 800;
}

.admin-avatar-img {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e7efe8;
}

.admin-workspace .content-area {
    max-width: 1480px;
    margin: 0 auto;
    padding: 34px;
}

@media (max-width: 820px) {
    .admin-workspace .sidebar {
        width: 220px;
        height: 100vh;
        padding: 14px 10px;
        overflow-y: auto;
    }

    .admin-workspace .sidebar-logo {
        font-size: 21px;
    }

    .admin-workspace .sidebar-header {
        padding: 8px 10px 30px;
    }

    .admin-workspace .sidebar-nav {
        display: block;
    }

    .admin-workspace .nav-item,
    .admin-workspace .nav-item.active {
        margin: 3px 0;
        padding: 12px 14px;
        font-size: 14px;
        white-space: normal;
    }

    .admin-workspace .nav-item.active::before {
        display: block;
    }

    .admin-workspace .main-content {
        margin-left: 220px;
        width: calc(100% - 220px);
    }

    .admin-workspace .top-bar {
        padding: 14px 18px;
    }

    .admin-identity span:last-child {
        display: none;
    }

    .admin-workspace .content-area {
        padding: 22px 18px;
    }
}
</style>
