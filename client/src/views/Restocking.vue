<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <!-- Budget input -->
    <div class="card budget-card">
      <div class="budget-row">
        <label class="budget-label">{{ t('restocking.budgetLabel') }}</label>
        <div class="budget-input-row">
          <span class="currency-prefix">$</span>
          <input
            v-model.number="budgetInput"
            type="number"
            min="0"
            step="100"
            class="budget-input"
            :placeholder="t('restocking.budgetPlaceholder')"
            @keyup.enter="applyBudget"
          />
          <button class="btn btn-primary" @click="applyBudget">
            {{ t('restocking.applyBudget') }}
          </button>
          <button v-if="activeBudget !== null" class="btn btn-secondary" @click="clearBudget">
            {{ t('restocking.clearBudget') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <!-- Summary stats -->
      <div class="stats-grid">
        <div class="stat-card" :class="withinBudget ? 'success' : 'danger'">
          <div class="stat-label">{{ t('restocking.totalCost') }}</div>
          <div class="stat-value">{{ formatCurrency(totalCost) }}</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">{{ t('restocking.itemsRecommended') }}</div>
          <div class="stat-value">{{ recommendations.length }}</div>
        </div>
        <div v-if="activeBudget !== null" class="stat-card" :class="withinBudget ? 'success' : 'danger'">
          <div class="stat-label">{{ t('restocking.budgetLabel') }}</div>
          <div class="stat-value">{{ formatCurrency(activeBudget) }}</div>
        </div>
        <div v-if="activeBudget !== null" class="stat-card" :class="withinBudget ? 'success' : 'danger'">
          <div class="stat-label">{{ withinBudget ? t('restocking.withinBudget') : t('restocking.overBudget') }}</div>
          <div class="stat-value">{{ formatCurrency(Math.abs(activeBudget - totalCost)) }}</div>
        </div>
      </div>

      <!-- No recommendations -->
      <div v-if="recommendations.length === 0" class="empty-state">
        {{ t('restocking.noRecommendations') }}
      </div>

      <!-- Recommendations table -->
      <div v-else class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.title') }}</h3>
          <div v-if="activeBudget !== null" class="budget-indicator" :class="withinBudget ? 'budget-ok' : 'budget-exceeded'">
            {{ withinBudget ? t('restocking.withinBudget') : t('restocking.overBudget') }}
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.sku') }}</th>
                <th>{{ t('restocking.table.itemName') }}</th>
                <th>{{ t('restocking.table.category') }}</th>
                <th>{{ t('restocking.table.warehouse') }}</th>
                <th>{{ t('restocking.table.currentStock') }}</th>
                <th>{{ t('restocking.table.reorderPoint') }}</th>
                <th>{{ t('restocking.table.suggestedQty') }}</th>
                <th>{{ t('restocking.table.unitCost') }}</th>
                <th>{{ t('restocking.table.totalCost') }}</th>
                <th>{{ t('restocking.table.demandTrend') }}</th>
                <th>{{ t('restocking.table.priority') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in recommendations"
                :key="item.id"
                :class="{ 'over-budget-row': activeBudget !== null && runningTotal(item) > activeBudget }"
              >
                <td><code>{{ item.sku }}</code></td>
                <td>{{ item.name }}</td>
                <td>{{ item.category }}</td>
                <td>{{ item.warehouse }}</td>
                <td>
                  <span :class="['badge', stockClass(item)]">
                    {{ item.quantity_on_hand }}
                  </span>
                </td>
                <td>{{ item.reorder_point }}</td>
                <td><strong>{{ item.suggested_qty }}</strong></td>
                <td>{{ formatCurrency(item.unit_cost) }}</td>
                <td>{{ formatCurrency(item.total_cost) }}</td>
                <td>
                  <span :class="['badge', trendClass(item.demand_trend)]">
                    {{ item.demand_trend }}
                  </span>
                </td>
                <td>
                  <span :class="['badge', priorityClass(item.priority)]">
                    {{ item.priority }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '@/api'
import { useI18n } from '@/composables/useI18n'
import { useFilters } from '@/composables/useFilters'

export default {
  name: 'Restocking',
  setup() {
    const { t } = useI18n()
    const { selectedLocation, selectedCategory, getCurrentFilters } = useFilters()
    const loading = ref(true)
    const error = ref(null)
    const recommendations = ref([])
    const totalCost = ref(0)
    const withinBudget = ref(true)
    const budgetInput = ref(null)
    const activeBudget = ref(null)

    const loadData = async (budget = null) => {
      try {
        loading.value = true
        error.value = null
        const filters = getCurrentFilters()
        const data = await api.getRestockingRecommendations(budget, filters)
        recommendations.value = data.recommendations
        totalCost.value = data.total_cost
        withinBudget.value = data.within_budget
      } catch (err) {
        error.value = t('restocking.loadError')
      } finally {
        loading.value = false
      }
    }

    const applyBudget = () => {
      activeBudget.value = budgetInput.value || null
      loadData(activeBudget.value)
    }

    const clearBudget = () => {
      activeBudget.value = null
      budgetInput.value = null
      loadData(null)
    }

    watch([selectedLocation, selectedCategory], () => loadData(activeBudget.value))

    // Running cumulative cost to highlight rows that exceed budget
    const runningTotals = computed(() => {
      let running = 0
      return recommendations.value.map(item => {
        running += item.total_cost
        return running
      })
    })

    const runningTotal = (item) => {
      const idx = recommendations.value.indexOf(item)
      return runningTotals.value[idx] ?? 0
    }

    const formatCurrency = (num) =>
      num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

    const stockClass = (item) => {
      const ratio = item.quantity_on_hand / item.reorder_point
      if (ratio < 0.5) return 'danger'
      if (ratio < 0.8) return 'warning'
      return 'info'
    }

    const trendClass = (trend) => {
      if (trend === 'increasing') return 'increasing'
      if (trend === 'decreasing') return 'decreasing'
      return 'stable'
    }

    const priorityClass = (priority) => {
      if (priority === 'high') return 'danger'
      if (priority === 'medium') return 'warning'
      return 'info'
    }

    onMounted(() => loadData())

    return {
      t,
      loading,
      error,
      recommendations,
      totalCost,
      withinBudget,
      budgetInput,
      activeBudget,
      applyBudget,
      clearBudget,
      runningTotal,
      formatCurrency,
      stockClass,
      trendClass,
      priorityClass
    }
  }
}
</script>

<style scoped>
.restocking {
  padding: 0;
}

.budget-card {
  margin-bottom: 1.5rem;
}

.budget-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.budget-label {
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
}

.budget-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.currency-prefix {
  font-size: 1rem;
  color: #64748b;
  font-weight: 600;
}

.budget-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.938rem;
  width: 200px;
  color: #0f172a;
}

.budget-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.budget-indicator {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.budget-ok {
  background: #d1fae5;
  color: #065f46;
}

.budget-exceeded {
  background: #fecaca;
  color: #991b1b;
}

.over-budget-row {
  background: #fff7ed !important;
  opacity: 0.6;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

code {
  font-family: monospace;
  font-size: 0.813rem;
  color: #3b82f6;
  background: #eff6ff;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}
</style>
