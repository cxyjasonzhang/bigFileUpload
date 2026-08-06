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
     <!-- <template #header>
        <div class="flex-cb">
          <h4 class="m-0">用户数据表格</h4>
          <div class="flex gap-2">
            <ElTag v-if="error" type="danger">{{ error.message }}</ElTag>
            <ElTag v-else-if="loading" type="warning">加载中...</ElTag>
            <ElTag v-else type="success">{{ data.length }} 条数据</ElTag>
          </div>
        </div>
      </template> -->

      <!-- 表格工具栏 -->
      <!-- fullClass 属性用于设置全屏区域，如果需要设置全屏区域，请使用此属性 -->
      <JetTableHeader
        :loading="loading"
        layout="size,fullscreen"
        fullClass="art-table-card"
      >
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" @click="handleAdd" v-ripple>
              <ElIcon>
                <Plus />
              </ElIcon>
              新增角色
            </ElButton>

            <ElButton @click="handleClearData" plain v-ripple> 清空数据 </ElButton>

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
        :data="(data as RoleListItem[])"
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
            <JetButtonTable type="edit" :row="row" @click="handleView(row)" />
            <JetButtonTable type="delete" :row="row" @click="handleView(row)" />
          </div>
        </template>
      </JetTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { useTable } from '@/hooks/core/useTable'
// import { fetchGetRoleList } from '@/api/system-manage'
import { ROLE_LIST_DATA } from '@/mock/temp/formData'

  type RoleListItem = Api.SystemManage.RoleListItem

  // 选中的行
  const selectedRows = ref<any[]>([])

  // 搜索表单 ref
  const searchBarRef = ref()

  // 表单搜索初始值
  const searchFormState = ref({
    name: '',
    phone: '',
    status: '1',
    department: '',
    daterange: ['2025-01-01', '2025-02-10']
  })

  // 搜索表单配置
  // 日期选择器有多种类型，具体可以查看 src/components/core/forms/art-search-bar/widget/art-search-date/README.md 文档
  const searchItems = computed(() => [
    {
      key: 'name',
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
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      options: [
        { label: '全部', value: '' },
        { label: '在线', value: '1' },
        { label: '离线', value: '2' },
        { label: '异常', value: '3' },
        { label: '注销', value: '4' }
      ]
    },
    {
      key: 'department',
      label: '部门',
      type: 'select',
      options: [
        { label: '全部', value: '' },
        { label: '技术部', value: '技术部' },
        { label: '产品部', value: '产品部' },
        { label: '运营部', value: '运营部' },
        { label: '市场部', value: '市场部' },
        { label: '设计部', value: '设计部' }
      ]
    },
    {
      key: 'daterange',
      label: '日期范围',
      type: 'daterange',
      props: {
        type: 'daterange',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        valueFormat: 'YYYY-MM-DD'
      }
    }
  ])

  // 校验规则
  const rules = {
    name: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3456789]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
    ]
  }

  const handleSearch = async () => {
    await searchBarRef.value.validate()

    console.log('搜索参数:', searchFormState.value)
    replaceSearchParams(buildSearchParams(searchFormState.value))
    getData()
  }

  const buildSearchParams = (params: typeof searchFormState.value) => {
    const { daterange, ...filtersParams } = params
    const [startTime, endTime] = Array.isArray(daterange) ? daterange : [null, null]

    return {
      ...filtersParams,
      startTime,
      endTime
    }
  }

  const handleReset = () => {
    // addCacheLog('🔄 重置搜索')
    // 重置搜索表单状态
    // searchFormState.value = { ...defaultFilter.value }
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
    // hasData, // 是否有数据
    // 搜索栏
    // 搜索相关
    searchParams, // 搜索参数
    replaceSearchParams, // 替换搜索参数
    resetSearchParams, // 重置搜索参数

    // 分页相关
    pagination, // 分页信息
    handleSizeChange, // 分页大小变化处理
    handleCurrentChange, // 当前页变化处理

    // 数据操作
    clearData, // 清空数据
    getData, 

    // 刷新策略
    refreshRemove, // 删除后刷新：智能处理页码，避免空页面（适用于删除数据后）

    // 动态列配置方法
    columns // 表格列配置
  } = useTable({
    // 核心配置
    core: {
      apiFn: (params) => {
        console.log('🚀 角色列表请求参数:', params)

        // 模拟分页：从 ROLE_LIST_DATA 中切片返回
        return new Promise<Api.Common.PaginatedResponse>((resolve) => {
          setTimeout(() => {
            const { current, size } = params
            const start = ((current - 1) * size)
            const records = ROLE_LIST_DATA.slice(start, start + size)
            resolve({
              records,
              current,
              size,
              total: ROLE_LIST_DATA.length
            })
          }, 300)
        })

        // 正式接口：return fetchGetRoleList(params)
      },
      apiParams: {
        current: 1,
        size: 20,
        // ...searchFormState.value
      },
      // 排除 apiParams 中的属性
      excludeParams: ['daterange'],
      // 自定义分页字段映射，未设置时将使用全局配置 tableConfig.ts 中的 paginationKey
      // paginationKey: {
      //   current: 'pageNum',
      //   size: 'pageSize'
      // },
      immediate: true, // 是否立即加载数据
      columnsFactory: () => [
        { type: 'selection', width: 50 },
        { type: 'globalIndex', width: 60, label: '序号' },
        {
          prop: 'roleName',
          label: '角色名称',
          minWidth: 160,
          sortable: true
        },
        {
          prop: 'roleCode',
          label: '角色编码',
          minWidth: 140,
          sortable: true
        },
        {
          prop: 'description',
          label: '角色描述',
          minWidth: 220
        },
        {
          prop: 'enabled',
          label: '状态',
          width: 100,
          sortable: true,
          formatter: (row: any) => row.enabled ? '启用' : '禁用'
        },
        {
          prop: 'createTime',
          label: '创建时间',
          minWidth: 180,
          sortable: true
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

    // 数据处理
    transform: {
      // 角色数据无需额外转换，mock 数据字段与列配置直接对应
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
      onSuccess: (data, response) => {
        console.log('📊 角色数据加载成功:', data.length, '条, total=', response.total)
      },
      onError: (error) => {
        console.error('❌ 数据加载失败:', error)
        ElMessage.error(error.message)
      }
    },

    // 调试配置
    debug: {
      enableLog: true,
      logLevel: 'info'
    }
  })

    // 事件处理函数
  const handleSelectionChange = (selection: RoleListItem[]) => {
    selectedRows.value = selection
    console.log('选择变更:', selection)
  }

  const handleRowClick = (row: RoleListItem) => {
    console.log('行点击:', row)
  }

  /**
   * 表头点击事件处理
   * @param column 列信息
   */
  const handleHeaderClick = (column: { label: string; property: string }) => {
    console.log('表头点击:', column)
    // logEvent('表头点击', `点击了 ${column.label} 列表头`)
  }

  // 事件日志记录
  // const logEvent = (type: string, message: string) => {
  //   if (!eventDemoEnabled.value) return

  //   const time = new Date().toLocaleTimeString()
  //   eventLogs.value.unshift({ type, message, time })

  //   // 限制日志数量
  //   if (eventLogs.value.length > 20) {
  //     eventLogs.value = eventLogs.value.slice(0, 20)
  //   }
  // }

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
    console.log('排序字段:', sortInfo.prop)
    console.log('排序方向:', sortInfo.order)
    // logEvent('排序变更', `字段: ${sortInfo.prop}, 方向: ${sortInfo.order}`)
  }

  // 计算实际的表格高度
  const computedTableHeight = computed(() => '')

  const handleAdd = () => {
    ElMessage.info('新增角色')
  }

  const handleBatchDelete = async () => {
    try {
      await ElMessageBox.confirm(
        `确定要删除选中的 ${selectedRows.value.length} 个角色吗？`,
        '警告',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )

      ElMessage.success(`批量删除 ${selectedRows.value.length} 个角色成功`)
      selectedRows.value = []
      setTimeout(() => {
        refreshRemove()
      }, 1000)
    } catch {
      ElMessage.info('已取消删除')
    }
  }

  const handleClearData = () => {
    clearData()
    ElMessage.info('数据已清空')
  }

  const handleView = (row: any) => {
    ElMessage.info(`查看角色 ${row.roleName}`)
  }
</script>

<style scoped>
  .user-info .el-avatar {
    flex-shrink: 0;
    width: 40px !important;
    height: 40px !important;
  }

  .user-info .el-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .custom-header:hover {
    color: var(--el-color-primary-light-3);
  }

  .demo-group .config-toggles .el-switch {
    --el-switch-on-color: var(--el-color-primary);
  }

  .demo-group .performance-info .el-alert {
    --el-alert-padding: 12px;
  }
</style>