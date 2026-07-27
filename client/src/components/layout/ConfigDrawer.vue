<template>
  <!-- 主题配置右侧抽屉 -->
  <el-drawer
    v-model="visible"
    title="主题设置"
    direction="rtl"
    size="320px"
    :z-index="2500"
  >
    <!-- 主题风格：浅色 / 暗色 -->
    <div class="config-section">
      <h4 class="config-label">主题风格</h4>
      <div class="config-mode">
        <el-button
          :type="layout.mode === 'light' ? 'primary' : 'default'"
          :icon="Sunny"
          size="large"
          @click="layout.setMode('light')"
        >
          浅色
        </el-button>
        <el-button
          :type="layout.mode === 'dark' ? 'primary' : 'default'"
          :icon="Moon"
          size="large"
          @click="layout.setMode('dark')"
        >
          暗色
        </el-button>
      </div>
    </div>

    <el-divider />

    <!-- 系统主题色：彩色圆形选择器 -->
    <div class="config-section">
      <h4 class="config-label">系统主题色</h4>
      <div class="config-colors">
        <div
          v-for="color in THEME_COLORS"
          :key="color"
          class="color-item"
          :class="{ active: layout.primaryColor === color }"
          :style="{ backgroundColor: color }"
          @click="layout.setPrimaryColor(color)"
        >
          <el-icon v-if="layout.primaryColor === color" class="color-check">
            <Check />
          </el-icon>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { Sunny, Moon, Check } from "@element-plus/icons-vue";
import { useLayoutStore } from "@/stores/layout";
import { THEME_COLORS } from "@/utils/color";

const layout = useLayoutStore();

/** 抽屉可见性由父组件控制 */
const visible = defineModel<boolean>({ required: true });
</script>

<style scoped>
.config-section {
  padding: 0 4px;
}

.config-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text-primary);
  margin: 0 0 12px;
}

.config-mode {
  display: flex;
  gap: 12px;
}

.config-mode .el-button {
  flex: 1;
}

.config-colors {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.color-item {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: transform 0.15s, border-color 0.15s;
}

.color-item:hover {
  transform: scale(1.12);
}

.color-item.active {
  border-color: var(--app-text-primary);
}

.color-check {
  color: #fff;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
