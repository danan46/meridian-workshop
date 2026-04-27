<template>
  <div class="app">
    <header class="top-nav">
      <div class="nav-container">
        <div class="logo">
          <h1>{{ t('nav.companyName') }}</h1>
          <span class="subtitle">{{ t('nav.subtitle') }}</span>
        </div>
        <nav class="nav-tabs">
          <router-link to="/" :class="{ active: $route.path === '/' }">
            {{ t('nav.overview') }}
          </router-link>
          <router-link to="/inventory" :class="{ active: $route.path === '/inventory' }">
            {{ t('nav.inventory') }}
          </router-link>
          <router-link to="/orders" :class="{ active: $route.path === '/orders' }">
            {{ t('nav.orders') }}
          </router-link>
          <router-link to="/spending" :class="{ active: $route.path === '/spending' }">
            {{ t('nav.finance') }}
          </router-link>
          <router-link to="/demand" :class="{ active: $route.path === '/demand' }">
            {{ t('nav.demandForecast') }}
          </router-link>
          <router-link to="/reports" :class="{ active: $route.path === '/reports' }">
            {{ t('nav.reports') }}
          </router-link>
          <router-link to="/restocking" :class="{ active: $route.path === '/restocking' }">
            {{ t('nav.restocking') }}
          </router-link>
        </nav>
        <ThemeToggle />
        <LanguageSwitcher />
        <ProfileMenu
          @show-profile-details="showProfileDetails = true"
          @show-tasks="showTasks = true"
        />
      </div>
    </header>
    <FilterBar />
    <main class="main-content">
      <router-view />
    </main>

    <ProfileDetailsModal
      :is-open="showProfileDetails"
      @close="showProfileDetails = false"
    />

    <TasksModal
      :is-open="showTasks"
      :tasks="tasks"
      @close="showTasks = false"
      @add-task="addTask"
      @delete-task="deleteTask"
      @toggle-task="toggleTask"
    />
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { api } from './api'
import { useAuth } from './composables/useAuth'
import { useI18n } from './composables/useI18n'
import FilterBar from './components/FilterBar.vue'
import ProfileMenu from './components/ProfileMenu.vue'
import ProfileDetailsModal from './components/ProfileDetailsModal.vue'
import TasksModal from './components/TasksModal.vue'
import LanguageSwitcher from './components/LanguageSwitcher.vue'
import ThemeToggle from './components/ThemeToggle.vue'

export default {
  name: 'App',
  components: {
    FilterBar,
    ProfileMenu,
    ProfileDetailsModal,
    TasksModal,
    LanguageSwitcher,
    ThemeToggle
  },
  setup() {
    const { currentUser } = useAuth()
    const { t } = useI18n()
    const showProfileDetails = ref(false)
    const showTasks = ref(false)
    const apiTasks = ref([])

    // Merge mock tasks from currentUser with API tasks
    const tasks = computed(() => {
      return [...currentUser.value.tasks, ...apiTasks.value]
    })

    const loadTasks = async () => {
      try {
        apiTasks.value = await api.getTasks()
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }

    const addTask = async (taskData) => {
      try {
        const newTask = await api.createTask(taskData)
        // Add new task to the beginning of the array
        apiTasks.value.unshift(newTask)
      } catch (err) {
        console.error('Failed to add task:', err)
      }
    }

    const deleteTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const isMockTask = currentUser.value.tasks.some(t => t.id === taskId)

        if (isMockTask) {
          // Remove from mock tasks
          const index = currentUser.value.tasks.findIndex(t => t.id === taskId)
          if (index !== -1) {
            currentUser.value.tasks.splice(index, 1)
          }
        } else {
          // Remove from API tasks
          await api.deleteTask(taskId)
          apiTasks.value = apiTasks.value.filter(t => t.id !== taskId)
        }
      } catch (err) {
        console.error('Failed to delete task:', err)
      }
    }

    const toggleTask = async (taskId) => {
      try {
        // Check if it's a mock task (from currentUser)
        const mockTask = currentUser.value.tasks.find(t => t.id === taskId)

        if (mockTask) {
          // Toggle mock task status
          mockTask.status = mockTask.status === 'pending' ? 'completed' : 'pending'
        } else {
          // Toggle API task
          const updatedTask = await api.toggleTask(taskId)
          const index = apiTasks.value.findIndex(t => t.id === taskId)
          if (index !== -1) {
            apiTasks.value[index] = updatedTask
          }
        }
      } catch (err) {
        console.error('Failed to toggle task:', err)
      }
    }

    onMounted(loadTasks)

    return {
      t,
      showProfileDetails,
      showTasks,
      tasks,
      addTask,
      deleteTask,
      toggleTask
    }
  }
}
</script>

<style>
:root {
  --bg-base:       #f8fafc;
  --bg-card:       #ffffff;
  --bg-hover:      #f1f5f9;
  --bg-nav:        #ffffff;
  --border:        #e2e8f0;
  --border-strong: #cbd5e1;
  --text-primary:  #0f172a;
  --text-secondary:#64748b;
  --text-body:     #1e293b;
  --text-table:    #334155;
  --shadow-sm:     0 1px 3px rgba(0,0,0,0.08);
  --shadow-nav:    0 1px 3px 0 rgba(0,0,0,0.05);
}

html.dark {
  --bg-base:       #0f172a;
  --bg-card:       #1e293b;
  --bg-hover:      #334155;
  --bg-nav:        #1e293b;
  --border:        #334155;
  --border-strong: #475569;
  --text-primary:  #f1f5f9;
  --text-secondary:#94a3b8;
  --text-body:     #e2e8f0;
  --text-table:    #cbd5e1;
  --shadow-sm:     0 1px 3px rgba(0,0,0,0.4);
  --shadow-nav:    0 1px 3px 0 rgba(0,0,0,0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: var(--bg-base);
  color: var(--text-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background 0.2s ease, color 0.2s ease;
}

.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.top-nav {
  background: var(--bg-nav);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-nav);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 0 2rem;
  height: 70px;
}

.nav-container > .nav-tabs {
  margin-left: auto;
  margin-right: 1rem;
}

.nav-container > .language-switcher {
  margin-right: 1rem;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.logo h1 {
  font-size: 1.375rem;
  font-weight: 800;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.03em;
}

html.dark .logo h1 {
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
}

.subtitle {
  font-size: 0.813rem;
  color: var(--text-secondary);
  font-weight: 400;
  padding-left: 0.75rem;
  border-left: 1px solid var(--border);
}

.nav-tabs {
  display: flex;
  gap: 0.125rem;
}

.nav-tabs a {
  padding: 0.5rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
  border-radius: 8px;
  transition: all 0.15s ease;
  position: relative;
  white-space: nowrap;
}

.nav-tabs a:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-tabs a.active {
  color: #2563eb;
  background: #eff6ff;
  font-weight: 600;
}

.nav-tabs a.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background: linear-gradient(90deg, #2563eb, #7c3aed);
  border-radius: 2px 2px 0 0;
}

.main-content {
  flex: 1;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h2 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.375rem;
  letter-spacing: -0.025em;
}

.page-header p {
  color: #64748b;
  font-size: 0.938rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--bg-card);
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border);
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.stat-card:hover::before { opacity: 1; }

.stat-card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.stat-card.warning::before  { background: linear-gradient(90deg, #f97316, #eab308); opacity: 1; }
.stat-card.success::before  { background: linear-gradient(90deg, #10b981, #06b6d4); opacity: 1; }
.stat-card.danger::before   { background: linear-gradient(90deg, #ef4444, #f97316); opacity: 1; }
.stat-card.info::before     { background: linear-gradient(90deg, #3b82f6, #8b5cf6); opacity: 1; }

.stat-label {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.stat-card.warning .stat-value { color: #ea580c; }
.stat-card.success .stat-value { color: #059669; }
.stat-card.danger .stat-value  { color: #dc2626; }
.stat-card.info .stat-value    { color: #2563eb; }

.card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid var(--border);
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--border);
}

.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: var(--bg-hover);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

th {
  text-align: left;
  padding: 0.625rem 0.875rem;
  font-weight: 700;
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

td {
  padding: 0.625rem 0.875rem;
  border-top: 1px solid var(--border);
  color: var(--text-table);
  font-size: 0.875rem;
}

tbody tr {
  transition: background-color 0.12s ease;
}

tbody tr:hover {
  background: var(--bg-hover);
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.688rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge.success {
  background: #d1fae5;
  color: #065f46;
}

.badge.warning {
  background: #fed7aa;
  color: #92400e;
}

.badge.danger {
  background: #fecaca;
  color: #991b1b;
}

.badge.info {
  background: #dbeafe;
  color: #1e40af;
}

.badge.increasing {
  background: #d1fae5;
  color: #065f46;
}

.badge.decreasing {
  background: #fecaca;
  color: #991b1b;
}

.badge.stable {
  background: #e0e7ff;
  color: #3730a3;
}

.badge.high {
  background: #fecaca;
  color: #991b1b;
}

.badge.medium {
  background: #fed7aa;
  color: #92400e;
}

.badge.low {
  background: #dbeafe;
  color: #1e40af;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #64748b;
  font-size: 0.938rem;
}

.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 0.938rem;
}

/* ── Dark mode overrides ───────────────────────────── */
html.dark .card           { background: var(--bg-card); border-color: var(--border); }
html.dark .stat-card      { background: var(--bg-card); border-color: var(--border); }
html.dark .page-header h2 { color: var(--text-primary); }
html.dark .page-header p  { color: var(--text-secondary); }
html.dark .card-title     { color: var(--text-primary); }
html.dark .stat-label     { color: var(--text-secondary); }
html.dark .stat-value     { color: var(--text-primary); }
html.dark .logo h1        { color: var(--text-primary); }
html.dark .subtitle       { color: var(--text-secondary); border-color: var(--border); }
html.dark .nav-tabs a     { color: var(--text-secondary); }
html.dark .nav-tabs a:hover     { color: var(--text-primary); background: var(--bg-hover); }
html.dark .nav-tabs a.active    { color: #60a5fa; background: rgba(96,165,250,0.1); }
html.dark .nav-tabs a.active::after { background: #60a5fa; }
html.dark thead           { background: var(--bg-hover); border-color: var(--border); }
html.dark th              { color: var(--text-secondary); }
html.dark td              { color: var(--text-table); border-color: var(--border); }
html.dark tbody tr:hover  { background: var(--bg-hover); }
html.dark .loading        { color: var(--text-secondary); }
html.dark .error          { background: #450a0a; border-color: #991b1b; color: #fca5a5; }
html.dark .table-container { color: var(--text-table); }

/* Dropdowns (LanguageSwitcher, ProfileMenu) */
html.dark .language-button,
html.dark .profile-button { background: var(--bg-card); border-color: var(--border); color: var(--text-body); }
html.dark .dropdown-menu,
html.dark .profile-dropdown { background: var(--bg-card); border-color: var(--border); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
html.dark .dropdown-item,
html.dark .profile-menu-item { color: var(--text-body); }
html.dark .dropdown-item:hover,
html.dark .profile-menu-item:hover { background: var(--bg-hover); }
html.dark .dropdown-item.active { background: rgba(96,165,250,0.1); color: #60a5fa; }

/* KPI cards dark text */
html.dark .kpi-label  { color: var(--text-secondary); }
html.dark .kpi-value  { color: var(--text-primary); }
html.dark .kpi-goal   { color: var(--text-secondary); }
html.dark .kpi-progress-bar { background: var(--bg-hover); }

/* Section titles */
html.dark .section-title { color: var(--text-secondary); }

/* Filter bar dark */
html.dark .filters-bar { background: var(--bg-card); border-color: var(--border); }
</style>
