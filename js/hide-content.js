/**
 * 动态加载文章正文内容
 * 从隐藏的脚本标签中读取 Base64 编码的内容，解码后显示在页面上
 * 这样查看源代码时看不到正文，但网页上能正常显示
 */

(function() {
  'use strict';
  
  function restorePostContent() {
    // 查找隐藏的内容数据
    const dataScript = document.getElementById('post-content-data');
    if (!dataScript) return;
    
    // 获取 Base64 编码的内容
    const encoded = dataScript.textContent;
    if (!encoded) return;
    
    try {
      // 解码
      const originalContent = atob(encoded);
      
      // 查找占位符
      const placeholder = document.getElementById('post-content-placeholder');
      if (placeholder) {
        // 替换占位符为真实内容
        placeholder.innerHTML = originalContent;
        console.log('✓ 正文已动态加载，源代码中不可见');
      }
      
      // 移除隐藏的脚本标签
      dataScript.remove();
    } catch (e) {
      console.error('Failed to restore post content:', e);
    }
  }
  
  // 等待 DOM 完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restorePostContent);
  } else {
    restorePostContent();
  }
})();
