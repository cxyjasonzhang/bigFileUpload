<template>
  <div class="app-container">
    <h1>📁 大文件上传</h1>
    <FileUpload />
  </div>
</template>

<script setup>
import FileUpload from './components/FileUpload.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 40px 20px;
}

h1 {
  text-align: center;
  color: #fff;
  margin-bottom: 30px;
  font-size: 28px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
</style>
