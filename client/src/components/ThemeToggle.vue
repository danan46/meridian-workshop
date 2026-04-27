<template>
  <button class="theme-toggle" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="toggleDark">
    <svg v-if="isDark" width="18" height="18" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="2"/>
      <path d="M10 2V4M10 16V18M2 10H4M16 10H18M4.22 4.22L5.64 5.64M14.36 14.36L15.78 15.78M15.78 4.22L14.36 5.64M5.64 14.36L4.22 15.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <svg v-else width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</template>

<script setup>
import { useTheme } from '../composables/useTheme'
const { isDark, toggleDark } = useTheme()
</script>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 0.5rem;
}
.theme-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
