import { createApp } from "vue";
// Element Plus 按需导入：组件由 unplugin-vue-components 自动处理，样式由插件自动注入
// 仅保留暗色模式 CSS 变量（与组件按需导入无关）
import "element-plus/theme-chalk/dark/css-vars.css";
// main.js 或 App.vue
import 'element-plus/theme-chalk/el-date-picker-panel.css';
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
/* these are necessary styles for vue flow */
import '@vue-flow/core/dist/style.css';
/* this contains the default theme, these are optional styles */
import '@vue-flow/core/dist/theme-default.css';
import App from "./App.vue";
// 主题 CSS 变量（自定义语义色值）
import "@/styles/theme.css";
import '@/styles/core/tailwind.css' // tailwind
import '@/styles/index.scss' // 引入全局样式
import router from "./router";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { setupAuth, initAuth } from "./utils/auth";

// 注册认证拦截器（401 自动刷新、自动附加 Authorization 头）
setupAuth();

const app = createApp(App);

// 注册 Pinia 及状态持久化插件
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);

// 全局注册所有 Element Plus 图标，供菜单/按钮通过 <component :is="iconName"> 动态渲染
// （图标保持全量注册，不随组件按需导入，见 ADR-0001）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any);
}

// 挂载前先尝试用 refresh_token 恢复登录态，
// 并把「注册路由 + 挂载」一并推迟到恢复完成之后执行。
// 说明：app.use(router) 会立即触发首屏初始导航（路由守卫），
// 若此时 initAuth 还没跑完，authState.isLoggedIn 仍是 false，
// 已登录用户刷新后会被守卫误判为未登录而跳到 /login。
// 因此必须在登录态确定后再注册路由并挂载，初始导航才能拿到正确状态。
initAuth().finally(() => {
  app.use(router);
  app.mount("#app");
});
