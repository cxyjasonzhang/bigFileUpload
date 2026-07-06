<template>
  <el-dialog
    :title="dialogTitle"
    v-model="dialogVisible"
    width="480px"
    :close-on-click-modal="false"
    @closed="handleClosed"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
    >
      <el-form-item label="姓名" prop="username">
        <el-input v-model="form.username" placeholder="请输入姓名" maxlength="20" />
      </el-form-item>
      <el-form-item label="手机号" prop="phone">
        <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
      </el-form-item>
      <el-form-item label="家庭住址" prop="homeAddress">
        <el-input v-model="form.homeAddress" placeholder="请输入家庭住址" maxlength="100" />
      </el-form-item>
      <el-form-item label="工作地点" prop="workLocation">
        <el-input v-model="form.workLocation" placeholder="请输入工作地点" maxlength="100" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from "vue";

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String, default: "add" },
  formData: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:visible", "submit"]);

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const dialogTitle = computed(() => (props.mode === "edit" ? "编辑用户" : "新建用户"));

const formRef = ref(null);
const submitting = ref(false);

const form = reactive({
  username: "",
  phone: "",
  homeAddress: "",
  workLocation: "",
});

const rules = {
  username: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    { pattern: /^1\d{10}$/, message: "手机号格式不正确", trigger: "blur" },
  ],
};

watch(
  () => props.formData,
  (val) => {
    if (props.mode === "edit" && val) {
      form.username = val.username || "";
      form.phone = val.phone || "";
      form.homeAddress = val.homeAddress || "";
      form.workLocation = val.workLocation || "";
    }
  },
  { immediate: true }
);

function handleClosed() {
  form.username = "";
  form.phone = "";
  form.homeAddress = "";
  form.workLocation = "";
  formRef.value?.resetFields();
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  emit("submit", {
    data: { ...form },
    done: () => {
      submitting.value = false;
      dialogVisible.value = false;
    },
    fail: () => {
      submitting.value = false;
    },
  });
}
</script>
