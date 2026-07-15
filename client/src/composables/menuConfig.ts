// 菜单配置：路由导航的核心数据源
// 新增功能页只需在此追加一项，并在 router 中加对应子路由
export interface MenuItem {
  path: string;
  title: string;
  icon: string;
  desc?: string;
}

export const menuItems: MenuItem[] = [
  { path: "/workbench", title: "工作台", icon: "Odometer", desc: "系统概览与功能入口" },
  { path: "/upload", title: "文件上传", icon: "UploadFilled", desc: "大文件分片上传、断点续传" },
  { path: "/users", title: "用户管理", icon: "User", desc: "管理系统用户信息" },
  { path: "/icons", title: "图标管理", icon: "Picture", desc: "SVG 图标分组与导入" },
];
