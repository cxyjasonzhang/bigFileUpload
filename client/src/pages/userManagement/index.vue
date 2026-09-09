<template>
  <div class="user-page art-full-height">
    <!-- 搜索区域 -->
    <JetSearchBar
      ref="searchBarRef"
      v-model="searchFormState"
      :items="searchItems"
      :rules="rules"
      :is-expand="false"
      :show-expand="true"
      :show-reset-button="true"
      :show-search-button="true"
      :disabled-search-button="false"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 表格区域 -->
    <ElCard class="flex-1 art-table-card">
      <!-- 表格工具栏 -->
      <JetTableHeader
        :loading="loading"
        layout="size,fullscreen"
        fullClass="user-page"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" @click="handleAdd" v-ripple>
              <ElIcon>
                <Plus />
              </ElIcon>
              新增用户
            </ElButton>

            <ElButton @click="handleBatchDelete" :disabled="selectedRows.length === 0" v-ripple>
              <ElIcon>
                <Delete />
              </ElIcon>
              批量删除 ({{ selectedRows.length }})
            </ElButton>
          </ElSpace>
        </template>
      </JetTableHeader>

      <JetTable
        ref="tableRef"
        :loading="loading"
        :pagination="pagination"
        :data="(data as User[])"
        :columns="columns"
        :height="computedTableHeight"
        empty-height="360px"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        @header-click="handleHeaderClick"
        @sort-change="handleSortChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
        <!-- 操作列 -->
        <template #operation="{ row }">
          <div class="flex">
            <JetButtonTable type="view" :row="row" @click="handleView(row)" />
            <JetButtonTable type="edit" :row="row" @click="handleEdit(row)" />
            <JetButtonTable type="delete" :row="row" @click="handleDelete(row)" />
          </div>
        </template>
      </JetTable>
    </ElCard>

    <!-- 用户新增/编辑弹窗 -->
    <UserFormDialog
      v-model="dialogVisible"
      :dialog-type="dialogType"
      :user-data="currentUser"
      @success="getData"
    />

    <!-- 用户查看弹窗 -->
    <UserViewDialog v-model="viewDialogVisible" :user-data="viewUser" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { Plus, Delete } from '@element-plus/icons-vue'
  // ElMessage 由 unplugin-auto-import 自动导入并注入样式（勿手动 import，否则样式不注入）
  import { useTable } from '@/hooks/core/useTable'
  import { fetchUsers, deleteUser } from '@/utils/api'
  import type { User } from '@/utils/api'
  import UserFormDialog from './modules/user-form-dialog.vue'
  import UserViewDialog from './modules/user-view-dialog.vue'

  // 选中的行
  const selectedRows = ref<User[]>([])

  // 用户新增/编辑弹窗状态
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const currentUser = ref<User>()

  // 用户查看弹窗状态
  const viewDialogVisible = ref(false)
  const viewUser = ref<User>()

  // 搜索表单 ref
  const searchBarRef = ref()

  // 表单搜索初始值
  const searchFormState = ref({
    username: '',
    phone: ''
  })

  // 搜索表单配置
  const searchItems = computed(() => [
    {
      key: 'username',
      label: '用户名',
      type: 'input',
      props: {
        placeholder: '请输入用户名'
      }
    },
    {
      key: 'phone',
      label: '手机号',
      type: 'input',
      props: {
        placeholder: '请输入手机号',
        maxlength: '11'
      }
    }
  ])

  // 校验规则
  const rules = {
    username: [{ required: false, message: '请输入用户名', trigger: 'blur' }],
    phone: [
      { required: false, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3456789]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
    ]
  }

  const handleSearch = async () => {
    await searchBarRef.value.validate()

    replaceSearchParams(buildSearchParams(searchFormState.value))
    getData()
  }

  const buildSearchParams = (params: typeof searchFormState.value) => {
    return { ...params }
  }

  const handleReset = () => {
    resetSearchParams()
  }

  /**
   * 使用 useTable Hook 管理表格数据
   * 提供完整的表格解决方案，包括数据获取、缓存、分页、搜索等功能
   */
  const {
    // 数据相关
    data, // 表格数据
    loading, // 加载中状态

    // 搜索相关
    replaceSearchParams, // 替换搜索参数
    resetSearchParams, // 重置搜索参数

    // 分页相关
    pagination, // 分页信息
    handleSizeChange, // 分页大小变化处理
    handleCurrentChange, // 当前页变化处理

    // 数据操作
    getData,

    // 刷新策略
    refreshRemove, // 删除后刷新：智能处理页码，避免空页面（适用于删除数据后）

    // 动态列配置方法
    columns // 表格列配置
  } = useTable({
    // 核心配置
    core: {
      apiFn: (params) => {
        // 调用后端接口获取用户列表（响应拆壳由 defaultResponseAdapter 统一处理）
        return fetchUsers({
          username: params.username || undefined,
          phone: params.phone || undefined,
          page: params.current,
          pageSize: params.size
        })
      },
      apiParams: {
        current: 1,
        size: 10
      },
      immediate: true, // 是否立即加载数据
      columnsFactory: () => [
        { type: 'selection', width: 50 },
        { type: 'globalIndex', width: 60, label: '序号' },
        {
          prop: 'username',
          label: '用户名',
          minWidth: 160,
          sortable: true
        },
        {
          prop: 'phone',
          label: '手机号',
          minWidth: 140,
          sortable: true
        },
        {
          prop: 'homeAddress',
          label: '家庭住址',
          minWidth: 220
        },
        {
          prop: 'workLocation',
          label: '工作地点',
          minWidth: 180
        },
        {
          prop: 'operation',
          label: '操作',
          width: 190,
          useSlot: true,
          fixed: 'right'
        }
      ]
    },

    // 性能优化
    performance: {
      enableCache: true, // 开启缓存
      cacheTime: 5 * 60 * 1000, // 5分钟
      debounceTime: 300,
      maxCacheSize: 100
    },

    // 生命周期钩子
    hooks: {
      onSuccess: (data) => {
        console.log('📊 用户数据加载成功:', data.length, '条')
      },
      onError: (error) => {
        console.error('❌ 数据加载失败:', error)
        ElMessage.error(error.message)
      }
    }
  })

  // 事件处理函数
  const handleSelectionChange = (selection: User[]) => {
    selectedRows.value = selection
  }

  const handleRowClick = (row: User) => {
    console.log('行点击:', row)
  }

  /**
   * 表头点击事件处理
   * @param column 列信息
   */
  const handleHeaderClick = (column: { label: string; property: string }) => {
    console.log('表头点击:', column)
  }

  /**
   * 排序信息类型
   */
  interface SortInfo {
    prop: string
    order: 'ascending' | 'descending' | null
  }

  /**
   * 排序变更事件处理
   * @param sortInfo 排序信息
   */
  const handleSortChange = (sortInfo: SortInfo) => {
    console.log('排序事件:', sortInfo)
  }

  // 计算实际的表格高度
  const computedTableHeight = computed(() => '')

  const handleAdd = () => {
    dialogType.value = 'add'
    currentUser.value = undefined
    dialogVisible.value = true
  }

  /**
   * 打开编辑弹窗
   * @param row 当前行数据
   */
  const handleEdit = (row: User) => {
    dialogType.value = 'edit'
    currentUser.value = row
    dialogVisible.value = true
  }

  /**
   * 删除单个用户
   * @param row 当前行数据
   */
  const handleDelete = async (row: User) => {
    try {
      await ElMessageBox.confirm(`确定要删除用户「${row.username}」吗？`, '警告', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })

      await deleteUser(row.id)
      ElMessage.success(`删除用户「${row.username}」成功`)
      // 智能刷新：删除后自动调整页码，避免停留在空页面
      refreshRemove()
    } catch (error: any) {
      if (error?.response?.data?.msg) {
        ElMessage.error(error.response.data.msg)
      } else {
        ElMessage.info('已取消删除')
      }
    }
  }

  const handleBatchDelete = async () => {
    try {
      await ElMessageBox.confirm(
        `确定要删除选中的 ${selectedRows.value.length} 个用户吗？`,
        '警告',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )

      // 循环调用删除接口逐条删除
      await Promise.all(selectedRows.value.map((row) => deleteUser(row.id)))

      ElMessage.success(`批量删除 ${selectedRows.value.length} 个用户成功`)
      selectedRows.value = []
      refreshRemove()
    } catch (error: any) {
      if (error?.response?.data?.msg) {
        ElMessage.error(error.response.data.msg)
      } else {
        ElMessage.info('已取消删除')
      }
    }
  }

  /**
   * 打开查看弹窗
   * @param row 当前行数据
   */
  const handleView = (row: User) => {
    viewUser.value = row
    viewDialogVisible.value = true
  }
</script>
