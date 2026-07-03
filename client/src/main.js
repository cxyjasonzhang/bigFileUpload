import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import { setupAuth } from "./utils/auth.js";

// 注册认证拦截器（401 自动刷新、自动附加 Authorization 头）
setupAuth();

const app = createApp(App);
app.use(ElementPlus);
app.mount("#app");
