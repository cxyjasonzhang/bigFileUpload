<template>
  <el-dialog
    ref="dialogRef"
    :model-value="modelValue"
    :show-close="false"
    @update:model-value="handleVisibleChange"
    @opened="handleOpened"
    @closed="handleClosed"
    v-bind="$attrs"
  >
    <template #header>
      <div
        class="draggable-dialog-header"
        :class="{ 'is-draggable': draggable && !isFullscreen }"
        @pointerdown="onPointerDown"
      >
        <span class="dialog-title">{{ title }}</span>
        <div class="header-actions">
          <el-button
            v-if="fullscreenable"
            :icon="isFullscreen ? CopyDocument : FullScreen"
            circle
            size="small"
            class="action-btn"
            @click.stop="toggleFullscreen"
          />
          <el-button
            :icon="Close"
            circle
            size="small"
            class="action-btn close-btn"
            @click.stop="closeDialog"
          />
        </div>
      </div>
    </template>

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { FullScreen, CopyDocument, Close } from '@element-plus/icons-vue'

// ==================== Props ====================
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  draggable: { type: Boolean, default: true },
  fullscreenable: { type: Boolean, default: true },
})

// ==================== Emits ====================
const emit = defineEmits(['update:modelValue', 'fullscreen-change'])

// ==================== Refs & State ====================
const dialogRef = ref(null)
const isFullscreen = ref(false)

// Drag state (plain variables — no reactivity needed for perf)
let dragX = 0
let dragY = 0
let startMouseX = 0
let startMouseY = 0
let startDragX = 0
let startDragY = 0
let isDragging = false
let rafId = null
let pendingDelta = null

// Pre-computed boundary limits per drag session (based on original centered position)
let dragMinX = -Infinity
let dragMaxX = Infinity
let dragMinY = -Infinity
let dragMaxY = Infinity

// Cleanup-bound handlers
let boundOnMove = null
let boundOnUp = null
let boundOnResize = null

// ==================== DOM Access ====================
/**
 * Find the .el-dialog DOM element.
 * el-dialog uses <teleport> to body, so dialogRef.value.$el might be a comment node.
 * We search document.body for the .el-dialog that belongs to this instance.
 * Since our custom header is rendered inside .el-dialog, we can find it
 * by looking for .el-dialog containing our .draggable-dialog-header.
 */
function getDialogEl() {
  // Strategy 1: search from component root through Element Plus internals
  if (dialogRef.value) {
    // Element Plus Dialog exposes the inner dialog ref
    const innerDialog = dialogRef.value.dialogRef
    if (innerDialog) return innerDialog

    // Fallback: traverse from $el
    const rootEl = dialogRef.value.$el
    if (rootEl && rootEl.nodeType === 1) {
      const found = rootEl.querySelector?.('.el-dialog')
      if (found) return found
    }
  }

  // Strategy 2: find in body (teleported)
  const headers = document.querySelectorAll('.draggable-dialog-header')
  for (const header of headers) {
    const dialog = header.closest('.el-dialog')
    if (dialog) return dialog
  }

  return null
}

// ==================== Transform Update ====================
function updateTransform() {
  const el = getDialogEl()
  if (!el) return
  if (dragX === 0 && dragY === 0) {
    el.style.transform = ''
  } else {
    el.style.transform = `translate(${dragX}px, ${dragY}px)`
  }
}

// ==================== Drag: Boundary Calculation ====================
/**
 * Load the original (un-transformed, flex-centered) position from current visual state.
 * Since `transform: translate()` shifts getBoundingClientRect, we subtract current drag
 * offset to recover the original centered rectangle.
 */
function computeDragBounds() {
  const el = getDialogEl()
  if (!el) {
    dragMinX = -Infinity
    dragMaxX = Infinity
    dragMinY = -Infinity
    dragMaxY = Infinity
    return
  }

  const rect = el.getBoundingClientRect()
  const originalLeft = rect.left - dragX
  const originalRight = rect.right - dragX
  const originalTop = rect.top - dragY
  const originalBottom = rect.bottom - dragY

  dragMinX = -originalLeft
  dragMaxX = window.innerWidth - originalRight
  dragMinY = -originalTop
  dragMaxY = window.innerHeight - originalBottom
}

/**
 * Clamp current dragX/dragY to pre-computed stable bounds, then apply transform.
 */
function clampToBounds() {
  dragX = Math.max(dragMinX, Math.min(dragMaxX, dragX))
  dragY = Math.max(dragMinY, Math.min(dragMaxY, dragY))
  updateTransform()
}

// ==================== Drag: Pointer Events ====================
function onPointerDown(e) {
  if (!props.draggable || isFullscreen.value) return
  if (e.button !== 0) return

  isDragging = true
  startMouseX = e.clientX
  startMouseY = e.clientY
  startDragX = dragX
  startDragY = dragY

  // Pre-compute stable boundary limits for this drag session
  // based on the original (un-transformed) centered position
  computeDragBounds()

  document.addEventListener('pointermove', onPointerMove)
  document.addEventListener('pointerup', onPointerUp)
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'
}

function onPointerMove(e) {
  if (!isDragging) return

  pendingDelta = {
    x: e.clientX - startMouseX,
    y: e.clientY - startMouseY,
  }

  if (!rafId) {
    rafId = requestAnimationFrame(applyDrag)
  }
}

function applyDrag() {
  rafId = null
  if (!pendingDelta || !isDragging) return

  // Compute new position from drag start + delta
  dragX = startDragX + pendingDelta.x
  dragY = startDragY + pendingDelta.y

  // Clamp using pre-computed stable bounds (independent of current rect)
  dragX = Math.max(dragMinX, Math.min(dragMaxX, dragX))
  dragY = Math.max(dragMinY, Math.min(dragMaxY, dragY))

  updateTransform()
  pendingDelta = null
}

function onPointerUp() {
  isDragging = false

  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''

  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  // Release-time clamp: recompute bounds and clamp in case viewport changed
  computeDragBounds()
  clampToBounds()
}

// ==================== Close ====================
function closeDialog() {
  emit('update:modelValue', false)
}

// ==================== Fullscreen ====================
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  emit('fullscreen-change', isFullscreen.value)

  dragX = 0
  dragY = 0
}

// Watch fullscreen — directly toggle class on .el-dialog DOM element
// (class on <el-dialog> component goes to overlay wrapper, not .el-dialog)
watch(isFullscreen, async (val) => {
  await nextTick()
  const el = getDialogEl()
  if (!el) return

  if (val) {
    el.classList.add('is-fullscreen')
    // Also add class to the overlay for flex override
    const overlay = el.closest('.el-overlay-dialog') || el.parentElement
    if (overlay) overlay.classList.add('is-fullscreen-overlay')
  } else {
    el.classList.remove('is-fullscreen')
    const overlay = el.closest('.el-overlay-dialog') || el.parentElement
    if (overlay) overlay.classList.remove('is-fullscreen-overlay')
  }

  updateTransform()
})

// ==================== Dialog Lifecycle ====================
function handleOpened() {
  dragX = 0
  dragY = 0
  nextTick(() => {
    // Compute stable bounds for the initial centered position
    computeDragBounds()
    // Apply fullscreen class if it was set before dialog opened
    if (isFullscreen.value) {
      const el = getDialogEl()
      if (el) {
        el.classList.add('is-fullscreen')
        const overlay = el.closest('.el-overlay-dialog') || el.parentElement
        if (overlay) overlay.classList.add('is-fullscreen-overlay')
      }
    }
    updateTransform()
  })
}

function handleClosed() {
  isDragging = false
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  isFullscreen.value = false
  dragX = 0
  dragY = 0

  // Clean up DOM classes
  const el = getDialogEl()
  if (el) {
    el.classList.remove('is-fullscreen')
    el.style.transform = ''
    const overlay = el.closest('.el-overlay-dialog') || el.parentElement
    if (overlay) overlay.classList.remove('is-fullscreen-overlay')
  }
}

function handleVisibleChange(val) {
  emit('update:modelValue', val)
}

// ==================== Window Resize ====================
function onWindowResize() {
  if (isDragging) return
  if (!isFullscreen.value) {
    // Viewport changed → recompute original position & limits, then re-clamp
    computeDragBounds()
    clampToBounds()
  }
}

// ==================== Lifecycle ====================
boundOnMove = onPointerMove
boundOnUp = onPointerUp
boundOnResize = onWindowResize

window.addEventListener('resize', boundOnResize)

watch(
  () => props.draggable,
  (val) => {
    if (!val && isDragging) {
      isDragging = false
      document.removeEventListener('pointermove', boundOnMove)
      document.removeEventListener('pointerup', boundOnUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
  },
)

onUnmounted(() => {
  isDragging = false
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  document.removeEventListener('pointermove', boundOnMove)
  document.removeEventListener('pointerup', boundOnUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('resize', boundOnResize)
})
</script>

<style lang="scss" scoped>
.draggable-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  &.is-draggable {
    cursor: move;
    user-select: none;
  }

  .dialog-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 12px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
}
</style>

<style lang="scss">

.is-fullscreen-overlay {
  display: block !important;
  position: fixed !important;
  inset: 0 !important;
}

.is-fullscreen.el-dialog {
  width: 100vw !important;
  height: 100vh !important;
  max-height: 100vh !important;
  margin: 0 !important;
  border-radius: 0 !important;
  transform: none !important;

  // Flexbox 自适应 — header/footer 固定，body 填满剩余空间
  display: flex !important;
  flex-direction: column !important;

  .el-dialog__header {
    flex-shrink: 0;
    padding: 16px 20px;
  }

  .el-dialog__body {
    flex: 1;
    overflow: auto;
    min-height: 0;
    padding: 20px;
  }

  .el-dialog__footer {
    flex-shrink: 0;
    padding: 12px 20px;
  }
}

// Close button hover
.action-btn.close-btn:hover {
  color: var(--el-color-danger);
}
</style>
