import { defineConfig } from "vite";
import path from 'path'
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "url";
// Element Plus 按需导入（ADR-0001）
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import AutoImport from "unplugin-auto-import/vite";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(), // 添加这一行
    // 自动按需导入 Element Plus 组件（分析模板中的 <el-*> 标签）
    Components({
      resolvers: [
        ElementPlusResolver({
          // 自动按需导入组件样式（CSS）
          importStyle: "css",
        }),
      ],
      // 自动生成 components.d.ts 类型声明
      dts: "src/components.d.ts",
    }),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dts: 'src/types/import/auto-imports.d.ts',
      resolvers: [ElementPlusResolver()],
      eslintrc: {
        enabled: true,
        filepath: './.auto-import.json',
        globalsPropValue: true
      }
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      '@stores': resolvePath('src/store'),
      '@styles': resolvePath('src/assets/styles')
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});

function resolvePath(paths: string) {
  return path.resolve(__dirname, paths)
}
