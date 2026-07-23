/**
 * 隐藏博客正文内容
 * 在页面加载后移除正文内容，使其在网页源代码中不可见
 */

(function() {
  'use strict';
  
  // 等待 DOM 完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hidePostContent);
  } else {
    hidePostContent();
  }
  
  function hidePostContent() {
    // 查找文章内容容器（Butterfly 主题的文章正文类名）
    const contentSelectors = [
      '.post-content',           // 文章内容
      '.markdown-body',          // Markdown 内容
      '#article-container',      // 文章容器
      '.article-content'         // 其他可能的内容类
    ];
    
    for (let selector of contentSelectors) {
      const contentElement = document.querySelector(selector);
      if (contentElement) {
        // 替换为占位符
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
          padding: 20px;
          text-align: center;
          color: #999;
          font-size: 14px;
          min-height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        placeholder.textContent = '内容已隐藏';
        
        // 保存原始内容
        const originalContent = contentElement.innerHTML;
        localStorage.setItem('post-content-backup-' + window.location.pathname, originalContent);
        
        // 替换为占位符
        contentElement.innerHTML = placeholder.innerHTML;
        console.log('✓ 正文已隐藏，源代码中不可见');
        
        break;
      }
    }
  }
})();
