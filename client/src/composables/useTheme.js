import { ref, watch } from 'vue'

const isDark = ref(localStorage.getItem('theme') === 'dark')

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

// Apply on first load
applyTheme(isDark.value)

watch(isDark, applyTheme)

export function useTheme() {
  const toggleDark = () => { isDark.value = !isDark.value }
  return { isDark, toggleDark }
}
