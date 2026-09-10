<template>
  <div class="menu-page art-full-height">
    <!-- 搜索区域：名称 + 状态，前端过滤 -->
    <JetSearchBar
      ref="searchBarRef"
      v-model="searchFormState"
      :items="searchItems"
      :rules="searchRules"
      :is-expand="false"
      :show-expand="false"
      :show-reset-button="true"
      :show-search-button="true"
      :disabled-search-button="false"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 表格区域：树形菜单表格 -->
    <ElCard class="flex-1 art-table-card">
      <JetTableHeader
        v-model:columns="columnChecks"
        :loading="loading"
        layout="refresh,size,columns,fullscreen,settings"
        full-class="art-table-card"
        @refresh="handleRefresh"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton v-ripple type="primary" @click="handleAdd">
              <ElIcon>
                <Plus />
              </ElIcon>
              新增菜单
            </ElButton>
          </ElSpace>
        </template>
      </JetTableHeader>

      <JetTable
        ref="tableRef"
        row-key="menuId"
        :tree-props="{ children: 'children' }"
        :data="filteredTree"
        :columns="columns"
        :loading="loading"
        :height="computedTableHeight"
        empty-height="360px"
      >
        <!-- 类型列 -->
        <template #menuType="{ row }">
          <ElTag
            :type="row.menuType === 0 ? 'warning' : row.menuType === 1 ? 'primary' : 'info'"
            disable-transitions
          >
            {{ row.menuType === 0 ? '目录' : row.menuType === 1 ? '菜单' : '按钮' }}
          </ElTag>
        </template>

        <!-- 全屏列 -->
        <template #isFullScreen="{ row }">
          <ElTag
            v-if="row.menuType === 1"
            :type="row.isFullScreen === 1 ? 'primary' : 'info'"
            disable-transitions
          >
            {{ row.isFullScreen === 1 ? '全屏' : '否' }}
          </ElTag>
          <span v-else>-</span>
        </template>

        <!-- 状态列 -->
        <template #status="{ row }">
          <ElTag :type="row.status === 0 ? 'success' : 'danger'" disable-transitions>
            {{ row.status === 0 ? '正常' : '停用' }}
          </ElTag>
        </template>

        <!-- 操作列 -->
        <template #operation="{ row }">
          <!-- 新增下级（按钮类型不允许有子级，不显示） -->
          <JetButtonTable
            v-if="row.menuType !== 2"
            type="add"
            title="新增下级"
            @click="handleAddChild(row)"
          />
          <JetButtonTable type="edit" :row="row" @click="handleEdit(row)" />
          <JetButtonTable type="delete" :row="row" @click="handleDelete(row)" />
        </template>
      </JetTable>
    </ElCard>

    <!-- 菜单新增/编辑弹窗 -->
    <MenuEditDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :menu-data="currentMenu"
      :menu-tree="treeData"
      :default-parent-id="defaultParentId"
      @success="getData"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
// ElMessageBox 由 unplugin-auto-import 自动导入并注入样式（勿手动 import，否则样式不注入）
import { fetchGetMenuList, fetchDeleteMenu } from '@/utils/api'
import type { MenuItem } from '@/types/system/menu'
import MenuEditDialog from './modules/menu-edit-dialog.vue'
import { useTableColumns } from '@/hooks/core/useTableColumns'

type MenuListItem = MenuItem

/**
 * 菜单树节点
 * _siblingIndex / _siblingCount 用于上移/下移按钮的禁用判断
 */
type MenuTreeNode = MenuListItem & {
  children?: MenuTreeNode[]
  _siblingIndex?: number
  _siblingCount?: number
}

// 搜索栏 ref
const searchBarRef = ref()

// 表格 ref（用于调用 el-table 展开方法）
const tableRef = ref()

// 菜单新增/编辑弹窗状态
const dialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const currentMenu = ref<MenuListItem>()
/** 新增弹窗默认父级（「新增下级」时预选父级） */
const defaultParentId = ref(0)

// 搜索表单
const searchFormState = ref({
  menuName: '',
  status: '',
})

const { columns, columnChecks } = useTableColumns(() => [
  {
    prop: 'menuName',
    label: '菜单名称',
    minWidth: 150,
  },
  {
    prop: 'menuType',
    label: '类型',
    width: 90,
  },
  {
    prop: 'path',
    label: '路由地址',
    minWidth: 180,
  },
  {
    prop: 'perms',
    label: '权限标识',
    minWidth: 180,
  },
  {
    prop: 'icon',
    label: '图标',
    minWidth: 120,
  },
  {
    prop: 'isFullScreen',
    label: '全屏',
    minWidth: 100,
    useSlot: true,
  },
  {
    prop: 'orderNum',
    label: '排序',
    minWidth: 80,
  },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    useSlot: true,
  },
  {
    prop: 'operation',
    label: '操作',
    minWidth: 150,
    useSlot: true,
    fixed: 'right',
  },
])

// 搜索表单配置
const searchItems = computed(() => [
  {
    key: 'menuName',
    label: '菜单名称',
    type: 'input',
    props: {
      placeholder: '请输入菜单名称',
    },
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '全部', value: '' },
      { label: '正常', value: 0 },
      { label: '停用', value: 1 },
    ],
  },
])

// 搜索校验规则（无强制必填项）
const searchRules = {
  menuName: [{ required: false, message: '请输入菜单名称', trigger: 'blur' }],
}

// 数据状态
const loading = ref(false)
/** 完整菜单树（弹窗父级选择的数据源） */
const treeData = ref<MenuTreeNode[]>([])
/** 过滤后的菜单树（表格实际渲染数据） */
const filteredTree = ref<MenuTreeNode[]>([])

/**
 * 获取菜单列表（全量平铺 → 前端组装树）
 */
const getData = async () => {
  loading.value = true
  try {
    const res = await fetchGetMenuList()
    treeData.value = buildMenuTree(res.data.data.list)
    applySearch()
  } catch (error: any) {
    if (error?.response?.data?.msg) {
      ElMessage.error(error.response.data.msg)
    } else {
      console.error('获取菜单列表失败:', error)
    }
  } finally {
    loading.value = false
  }
}

/**
 * 刷新菜单列表
 */
const handleRefresh = () => {
  getData()
}

/**
 * 平铺列表组装成树（按后端返回的 order_num 顺序保持层级）
 * 父节点已被软删除时，子节点降级为根节点，避免数据丢失
 */
const buildMenuTree = (list: MenuListItem[]): MenuTreeNode[] => {
  const map = new Map<number, MenuTreeNode>()
  list.forEach((item) => map.set(item.menuId, { ...item, children: [] }))

  const roots: MenuTreeNode[] = []
  list.forEach((item) => {
    const node = map.get(item.menuId)!
    if (item.parentId === 0 || !map.has(item.parentId)) {
      roots.push(node)
    } else {
      map.get(item.parentId)!.children!.push(node)
    }
  })

  attachSiblingMeta(roots)
  return roots
}

/**
 * 为每个节点附加同级位置信息（上移/下移按钮禁用判断）
 */
const attachSiblingMeta = (nodes: MenuTreeNode[]) => {
  nodes.forEach((node, index) => {
    node._siblingIndex = index
    node._siblingCount = nodes.length
    if (node.children?.length) attachSiblingMeta(node.children)
  })
}

/**
 * 搜索
 */
const handleSearch = async () => {
  await searchBarRef.value?.validate()
  applySearch()
}

/**
 * 重置搜索
 */
const handleReset = () => {
  searchFormState.value.menuName = ''
  searchFormState.value.status = ''
  applySearch()
}

/**
 * 应用过滤条件到树数据，并展开全部节点
 */
const applySearch = () => {
  const { menuName, status } = searchFormState.value
  filteredTree.value = filterMenuTree(treeData.value, menuName.trim(), status)
  nextTick(expandAllRows)
}

/**
 * 前端过滤菜单树（保留父子链，避免出现断头树）
 * - 自身命中：保留完整子树
 * - 自身未命中：递归过滤子级，子级有命中则保留当前节点作为父链
 */
const filterMenuTree = (nodes: MenuTreeNode[], keyword: string, status: string): MenuTreeNode[] => {
  const result: MenuTreeNode[] = []
  for (const node of nodes) {
    const selfMatched =
      (!keyword || node.menuName.includes(keyword)) &&
      (status === '' || node.status === Number(status))
    if (selfMatched) {
      result.push(node)
    } else {
      const children = node.children ? filterMenuTree(node.children, keyword, status) : []
      if (children.length) {
        result.push({ ...node, children })
      }
    }
  }
  return result
}

/**
 * 展开所有树节点（过滤后新出现的节点也一并展开）
 */
const expandAllRows = () => {
  const table = tableRef.value?.elTableRef as any
  if (!table?.toggleRowExpansion) return
  const walk = (nodes: MenuTreeNode[]) => {
    nodes.forEach((node) => {
      table.toggleRowExpansion(node, true)
      if (node.children?.length) walk(node.children)
    })
  }
  walk(filteredTree.value)
}

// 计算实际的表格高度
const computedTableHeight = computed(() => '')

/**
 * 新增菜单（顶级，父级为根目录）
 */
const handleAdd = () => {
  dialogType.value = 'add'
  defaultParentId.value = 0
  currentMenu.value = undefined
  dialogVisible.value = true
}

/**
 * 新增下级（预选父级为当前行，仅目录/菜单类型可用）
 */
const handleAddChild = (row: MenuTreeNode) => {
  dialogType.value = 'add'
  defaultParentId.value = row.menuId
  currentMenu.value = undefined
  dialogVisible.value = true
}

/**
 * 编辑菜单
 */
const handleEdit = (row: MenuTreeNode) => {
  dialogType.value = 'edit'
  currentMenu.value = row
  dialogVisible.value = true
}

/**
 * 删除菜单（软删除，后端校验无子节点）
 */
const handleDelete = async (row: MenuTreeNode) => {
  try {
    await ElMessageBox.confirm(`确定要删除菜单「${row.menuName}」吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    await fetchDeleteMenu(row.menuId)
    ElMessage.success(`删除菜单「${row.menuName}」成功`)
    getData()
  } catch (error: any) {
    if (error?.response?.data?.msg) {
      ElMessage.error(error.response.data.msg)
    } else {
      ElMessage.info('已取消删除')
    }
  }
}

onMounted(() => {
  getData()
})
</script>

<style scoped>
.menu-page .el-card__body {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
