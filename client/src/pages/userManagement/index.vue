<template>
  <div class="user-management">
    <!-- 搜索区域 -->
    <div class="search-bar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="用户名称">
          <el-input
            v-model="searchForm.username"
            placeholder="请输入用户名称"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input
            v-model="searchForm.phone"
            placeholder="请输入手机号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            查询
          </el-button>
          <el-button @click="handleReset">
            重置
          </el-button>
          <el-button type="success" @click="handleAdd">
            新增用户
          </el-button>
          <SvgIcon name="ai/a-24" color="skyblue" :size="104" />
        </el-form-item>
      </el-form>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="tableData"
      border
      stripe
      style="width: 100%"
      v-loading="loading"
      empty-text="暂无数据"
    >
      <el-table-column
        label="序号"
        type="index"
        width="70"
        align="center"
        :index="indexMethod"
      />
      <el-table-column prop="username" label="姓名" min-width="120" align="center" />
      <el-table-column prop="phone" label="手机号" min-width="140" align="center" />
      <el-table-column prop="homeAddress" label="家庭住址" min-width="260" show-overflow-tooltip />
      <el-table-column prop="workLocation" label="工作地点" min-width="220" show-overflow-tooltip />
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="handleEdit(row)">
            编辑
          </el-button>
          <el-popconfirm
            title="确定要删除该用户吗？"
            confirm-button-text="删除"
            cancel-button-text="取消"
            @confirm="handleDelete(row)"
          >
            <template #reference>
              <el-button type="danger" link size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 30]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 新建/编辑用户弹窗 -->
    <UserFormDialog
      v-model:visible="dialogVisible"
      :mode="dialogMode"
      :form-data="currentUser"
      @submit="handleFormSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";

defineOptions({ name: "UserManagement" });
import { ElMessage } from "element-plus";
import { fetchUsers, createUser, updateUser, deleteUser } from "@/utils/api";
import UserFormDialog from "@/components/UserFormDialog.vue";
import SvgIcon from "@/components/SvgIcon.vue";

// 搜索表单
const searchForm = reactive({
  username: "",
  phone: "",
});

// 分页参数
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});

// 表格数据
const tableData = ref<any[]>([]);
const loading = ref(false);

// 计算序号
function indexMethod(index) {
  return (pagination.page - 1) * pagination.pageSize + index + 1;
}

// 加载数据
async function loadData() {
  loading.value = true;
  try {
    const res = await fetchUsers({
      username: searchForm.username,
      phone: searchForm.phone,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
    if (res.data.code === 0) {
      tableData.value = res.data.data.list;
      pagination.total = res.data.data.total;
    } else {
      ElMessage.error(res.data.msg || "获取用户列表失败");
    }
  } catch (err) {
    ElMessage.error("网络请求失败，请稍后重试");
  } finally {
    loading.value = false;
  }
}

// 搜索
function handleSearch() {
  pagination.page = 1;
  loadData();
}

// 重置
function handleReset() {
  searchForm.username = "";
  searchForm.phone = "";
  pagination.page = 1;
  loadData();
}

// 页码变化
function handlePageChange(page) {
  pagination.page = page;
  loadData();
}

// 每页条数变化
function handlePageSizeChange(size) {
  pagination.pageSize = size;
  pagination.page = 1;
  loadData();
}

// ─── 弹窗相关 ───────────────────────────────────────────

const dialogVisible = ref(false);
const dialogMode = ref("add");
const currentUser = ref<any>({});

function handleAdd() {
  dialogMode.value = "add";
  currentUser.value = {};
  dialogVisible.value = true;
}

function handleEdit(row) {
  dialogMode.value = "edit";
  currentUser.value = { ...row };
  dialogVisible.value = true;
}

async function handleFormSubmit({ data, done, fail }) {
  try {
    if (dialogMode.value === "add") {
      await createUser(data);
    } else {
      await updateUser(currentUser.value.id, data);
    }
    done();
    if (dialogMode.value === "add") pagination.page = 1;
    loadData();
  } catch (err) {
    fail();
    ElMessage.error((err as any).response?.data?.msg || "操作失败，请稍后重试");
  }
}

async function handleDelete(row) {
  try {
    await deleteUser(row.id);
    ElMessage.success("删除成功");
    loadData();
  } catch (err) {
    ElMessage.error((err as any).response?.data?.msg || "删除失败，请稍后重试");
  }
}

onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
@use "./index.scss";
</style>
